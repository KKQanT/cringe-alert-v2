import { useRef, useCallback, useState, useEffect } from 'react';
import {
  analyzeVideoStream, useGetSignedUrl, uploadFileToUrl,
  fetchUserSessions, fetchFullSession, createSession,
  type FullSession,
} from './services/api';
import { useSessionStore } from './stores/useSessionStore';
import { useAnalysisStore, type AnalysisResult } from './stores/useAnalysisStore';
import { Recorder } from './components/Recorder';
import { VideoPlayer, type VideoPlayerRef } from './components/VideoPlayer';
import { HistoryPanel } from './components/HistoryPanel';
import { FeedbackTimeline } from './components/FeedbackTimeline';
import { CoachPanel } from './components/CoachPanel';
import { VideoTabs } from './components/VideoTabs';
import { MemoryIndicator } from './components/MemoryIndicator';
import { FinalComparison } from './components/FinalComparison';
import { Sidebar } from './components/Sidebar';
import {
  Search, Sparkles, TrendingDown, Mic, BarChart2, Upload, Download,
  Circle, Film
} from 'lucide-react';
import './index.css';

const USER_ID = '1';

function restoreAnalysisFromSession(data: FullSession) {
  // Restore analysis store from the active video's analysis data
  // Priority: final > original > most recent practice clip
  const video = data.final_video ?? data.original_video;
  const lastPractice = data.practice_clips.length > 0
    ? data.practice_clips[data.practice_clips.length - 1]
    : null;

  const source = (video && video.score != null) ? video : lastPractice;

  if (source && source.score != null) {
    const result: AnalysisResult = {
      overall_score: source.score,
      summary: ('summary' in source ? source.summary : source.feedback) ?? '',
      feedback_items: (source.feedback_items ?? []).map(f => ({
        timestamp_seconds: f.timestamp_seconds,
        category: f.category as 'guitar' | 'vocals' | 'timing',
        severity: f.severity as 'critical' | 'improvement' | 'minor',
        title: f.title,
        description: f.description,
      })),
      strengths: source.strengths ?? [],
      thought_signature: source.thought_signature ?? null,
    };
    useAnalysisStore.getState().setAnalysisResult(result);
  }
}

function App() {
  const {
    sessionId, sessions, setSessions, setSessionId, loadFromBackend,
    currentVideoUrl, isRecorderOpen, autoStartRecording, recorderType,
    recorderFocusHint, recorderSectionStart, recorderSectionEnd,
    setVideoUrl, setOriginalVideo, openRecorder, closeRecorder, switchToVideo,
    updateOriginalAnalysis, updateFinalAnalysis, setFinalVideo,
    addPracticeClip, originalVideo, finalVideo, startNewSession,
  } = useSessionStore();
  const { currentAnalysis, startAnalysis, setStatus, appendThinking, setAnalysisResult } = useAnalysisStore();
  const videoPlayerRef = useRef<VideoPlayerRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [originalFeedback, setOriginalFeedback] = useState<{ title: string; category: string }[]>([]);
  const [finalFeedback, setFinalFeedback] = useState<{ title: string; category: string }[]>([]);

  const getSignedUrlMutation = useGetSignedUrl();

  // On mount: restore most recent session or create new one
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const sessionList = await fetchUserSessions(USER_ID);
        if (cancelled) return;
        setSessions(sessionList);

        if (sessionList.length > 0) {
          const fullSession = await fetchFullSession(sessionList[0].session_id);
          if (cancelled) return;
          loadFromBackend(fullSession);
          restoreAnalysisFromSession(fullSession);
        } else {
          const { session_id } = await createSession(USER_ID);
          if (cancelled) return;
          setSessionId(session_id);
        }
      } catch (err) {
        console.error('Failed to restore session:', err);
        // Fallback: create a new session
        try {
          const { session_id } = await createSession(USER_ID);
          if (!cancelled) setSessionId(session_id);
        } catch (createErr) {
          console.error('Failed to create session:', createErr);
        }
      }
    }
    init();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSeekTo = useCallback((timestamp: number) => {
    videoPlayerRef.current?.seekTo(timestamp);
    videoPlayerRef.current?.play();
  }, []);

  const determineVideoType = useCallback((): 'original' | 'practice' | 'final' => {
    if (!originalVideo) return 'original';
    if (originalVideo.score) return 'final';
    return 'original';
  }, [originalVideo]);

  const runStreamingAnalysis = useCallback(async (blobName: string, videoType?: 'original' | 'practice' | 'final') => {
    const currentSessionId = useSessionStore.getState().sessionId;
    const type = videoType ?? determineVideoType();

    startAnalysis();
    let analysisText = '';

    try {
      for await (const chunk of analyzeVideoStream(blobName, currentSessionId ?? undefined, type)) {
        switch (chunk.type) {
          case 'status':
            setStatus(chunk.content);
            break;
          case 'thinking':
            appendThinking(chunk.content);
            break;
          case 'analysis':
            analysisText += chunk.content;
            break;
          case 'complete':
            try {
              const result: AnalysisResult = JSON.parse(chunk.content);
              setAnalysisResult(result);
              const feedbackList = result.feedback_items?.map(f => ({ title: f.title, category: f.category })) || [];

              if (type === 'final') {
                updateFinalAnalysis(result.overall_score, result.thought_signature ?? undefined);
                setFinalFeedback(feedbackList);
                setShowComparison(true);
              } else {
                updateOriginalAnalysis(result.overall_score, result.thought_signature ?? undefined);
                setOriginalFeedback(feedbackList);
              }

              // Refresh session list after analysis is saved
              fetchUserSessions(USER_ID).then(list => setSessions(list)).catch(() => {});
            } catch {
              console.error('Failed to parse analysis result:', chunk.content);
              setStatus('Analysis complete (parsing error)');
            }
            break;
          case 'error':
            setStatus(`Error: ${chunk.content}`);
            break;
        }
      }
    } catch (error) {
      console.error('Streaming analysis failed:', error);
      setStatus('Analysis failed');
    }
  }, [startAnalysis, setStatus, appendThinking, setAnalysisResult, determineVideoType, updateOriginalAnalysis, updateFinalAnalysis, setSessions]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/mov'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid video file (MP4, WebM, or MOV)');
      return;
    }

    setIsUploading(true);
    try {
      // Ensure we have a session
      let currentSessionId = useSessionStore.getState().sessionId;
      if (!currentSessionId) {
        const { session_id } = await createSession(USER_ID);
        setSessionId(session_id);
        currentSessionId = session_id;
      }

      const videoType = determineVideoType();

      const filename = `upload_${Date.now()}_${file.name}`;
      const { upload_url, download_url, filename: blobName } = await getSignedUrlMutation.mutateAsync({
        filename,
        contentType: file.type
      });

      await uploadFileToUrl(upload_url, file, file.type);

      if (videoType === 'original') {
        setOriginalVideo(download_url, blobName);
      } else if (videoType === 'final') {
        setFinalVideo(download_url, blobName);
      } else {
        setVideoUrl(download_url);
      }

      runStreamingAnalysis(blobName, videoType);
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Failed to upload video');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [getSignedUrlMutation, setVideoUrl, setOriginalVideo, setFinalVideo, setSessionId, determineVideoType, runStreamingAnalysis]);

  const handleNewSession = useCallback(async () => {
    try {
      const { session_id } = await createSession(USER_ID);
      startNewSession();
      setSessionId(session_id);
      useAnalysisStore.getState().reset();
      setShowComparison(false);
      setOriginalFeedback([]);
      setFinalFeedback([]);
      // Refresh session list
      fetchUserSessions(USER_ID).then(list => setSessions(list)).catch(() => {});
    } catch (err) {
      console.error('Failed to create new session:', err);
    }
  }, [startNewSession, setSessionId, setSessions]);

  const handleLoadSession = useCallback(async (targetSessionId: string) => {
    try {
      const fullSession = await fetchFullSession(targetSessionId);
      loadFromBackend(fullSession);
      useAnalysisStore.getState().reset();
      restoreAnalysisFromSession(fullSession);
      setShowComparison(false);
      setOriginalFeedback([]);
      setFinalFeedback([]);
    } catch (err) {
      console.error('Failed to load session:', err);
    }
  }, [loadFromBackend]);

  return (
    <div className="flex h-screen bg-[var(--color-background)] text-[var(--color-text)] font-sans overflow-hidden">
      {/* Sidebar - Fixed Left */}
      <Sidebar
        sessions={sessions}
        activeSessionId={sessionId}
        onSelectSession={handleLoadSession}
        onNewSession={handleNewSession}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[url('/grid-pattern.svg')] bg-[length:40px_40px]">
        {/* Top Header / Breadcrumb Bar */}
        <header className="px-8 py-5 flex items-center justify-between bg-[var(--color-background)]/80 backdrop-blur-md border-b border-[var(--color-border)] sticky top-0 z-40">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Performance Dashboard</h2>
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] mt-1">
              <span>Overview</span>
              <span>/</span>
              <span className="text-[var(--color-primary)] font-medium">Session Analysis</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Search Bar */}
            <div className="relative hidden md:group md:block">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-text-dim)]">
                <Search className="w-5 h-5" />
              </div>
              <input
                type="text"
                placeholder="Search analysis..."
                className="bg-[var(--color-surface-base)] border border-[var(--color-border)] rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] transition-all w-64 group-hover:w-80 shadow-inner"
              />
            </div>

            <button className="px-6 py-2.5 bg-gradient-to-r from-[var(--color-primary)] to-[#0891b2] text-white rounded-xl font-bold hover:shadow-[0_0_20px_var(--color-primary-glow)] transition-all duration-300 transform hover:-translate-y-0.5 flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              <span>Judge My Performance</span>
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">

          {/* Top Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Cringe Score Card */}
            <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group hover:border-[var(--color-primary)] transition-colors duration-300">
              <div className="absolute -right-6 -top-6 w-32 h-32 bg-[var(--color-primary)]/10 rounded-full blur-3xl group-hover:bg-[var(--color-primary)]/20 transition-all"></div>

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[var(--color-text-muted)] font-medium text-sm uppercase tracking-wider">Cringe Score</h3>
                  <span className={`px-2 py-1 rounded text-xs font-bold ${currentAnalysis && currentAnalysis.overall_score > 80 ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                    {currentAnalysis ? (currentAnalysis.overall_score > 80 ? 'CRITICAL' : 'OPTIMAL') : 'WAITING'}
                  </span>
                </div>

                <div className="flex items-baseline gap-2 mb-4">
                  <TrendingDown className={`w-8 h-8 ${currentAnalysis && currentAnalysis.overall_score > 80 ? 'text-red-500' : 'text-[var(--color-primary)]'}`} />
                  <span className="text-5xl font-bold text-white tracking-tighter">
                    {currentAnalysis ? currentAnalysis.overall_score : '--'}
                  </span>
                  <span className="text-xl text-[var(--color-text-dim)] font-medium">/ 100</span>
                </div>

                {/* Progress Bar */}
                <div className="h-2 bg-[var(--color-surface-elevated)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] relative"
                    style={{ width: `${currentAnalysis ? currentAnalysis.overall_score : 0}%` }}
                  >
                    <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/50 blur-[2px]"></div>
                  </div>
                </div>
                <p className="text-xs text-[var(--color-text-dim)] mt-3">
                  {currentAnalysis ? 'Score calculated based on performance metrics.' : 'Upload video to calculate.'}
                </p>
              </div>
            </div>

            {/* Memory/Context Card */}
            <div className="md:col-span-2">
              <div className="glass-panel p-1 rounded-2xl h-full flex flex-col justify-center">
                {showComparison && finalVideo?.score ? (
                  <FinalComparison
                    originalFeedback={originalFeedback}
                    finalFeedback={finalFeedback}
                    onClose={() => setShowComparison(false)}
                  />
                ) : (
                  <MemoryIndicator />
                )}
              </div>
            </div>
          </div>

          {/* Main Workspace Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">

            {/* Left Column: Coach (3 cols) */}
            <div className="lg:col-span-3 flex flex-col h-full rounded-2xl overflow-hidden glass-panel border-[var(--color-border)]">
              <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-base)]/50">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <Mic className="w-5 h-5 text-[var(--color-primary)]" />
                  <span>AI Coach</span>
                </h3>
              </div>
              <div className="flex-1 p-0 overflow-hidden bg-[var(--color-surface-mid)]">
                <CoachPanel
                  onSeekTo={handleSeekTo}
                  onShowOriginal={() => switchToVideo('original')}
                  onRecordFinal={() => openRecorder(undefined, undefined, undefined, true, 'final')}
                  onSwitchTab={(tab) => switchToVideo(tab)}
                  onHighlightFeedback={(index) => useAnalysisStore.getState().setHighlightedFeedback(index)}
                />
              </div>
            </div>

            {/* Middle Column: Video Workspace (6 cols) */}
            <div className="lg:col-span-6 flex flex-col gap-6">
              {/* Video Player Card */}
              <div className="glass-panel rounded-2xl p-1 shadow-2xl shadow-black/50 overflow-hidden flex flex-col h-full">
                {/* Custom Video Tabs Styling - Increased Padding */}
                <div className="px-6 py-4 flex items-center justify-between bg-[var(--color-surface-base)]">
                  <VideoTabs onSwitchVideo={switchToVideo} />
                  <div className="flex gap-2">
                    <button
                      className={`p-2 rounded-lg hover:bg-white/10 transition-colors ${!isRecorderOpen && currentVideoUrl ? 'text-white' : 'text-gray-600'}`}
                      title="Download"
                      disabled={!currentVideoUrl}
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="relative flex-1 bg-black group overflow-hidden rounded-b-xl">
                  {isRecorderOpen ? (
                    <Recorder
                      autoStart={autoStartRecording}
                      onUploadComplete={({ downloadUrl, blobName }) => {
                        const recordingType = recorderType;

                        if (recordingType === 'practice') {
                          addPracticeClip({
                            url: downloadUrl,
                            blobName,
                            focusHint: recorderFocusHint ?? undefined,
                            sectionStart: recorderSectionStart ?? undefined,
                            sectionEnd: recorderSectionEnd ?? undefined,
                          });
                          closeRecorder();
                          runStreamingAnalysis(blobName, 'practice');
                        } else if (recordingType === 'final') {
                          setFinalVideo(downloadUrl, blobName);
                          closeRecorder();
                          runStreamingAnalysis(blobName, 'final');
                        } else {
                          setOriginalVideo(downloadUrl, blobName);
                          closeRecorder();
                          runStreamingAnalysis(blobName, 'original');
                        }
                      }}
                    />
                  ) : (
                    <div className="relative h-full">
                      <VideoPlayer
                        ref={videoPlayerRef}
                        src={currentVideoUrl}
                        className="w-full h-full object-contain"
                        onDurationChange={setVideoDuration}
                      />
                    </div>
                  )}

                  {/* Floating Action Buttons */}
                  {!isRecorderOpen && (
                    <div className="absolute bottom-8 right-8 z-30 flex flex-col gap-3 opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                      <button
                        onClick={() => openRecorder()}
                        className="bg-red-500 hover:bg-red-600 text-white p-4 rounded-full shadow-lg shadow-red-500/30 transition-transform active:scale-95 flex items-center justify-center"
                        title="Record Video"
                      >
                        <Circle className="w-6 h-6 fill-current" />
                      </button>
                      <div className="relative">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                          className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white p-4 rounded-full shadow-lg shadow-[var(--color-primary-glow)] transition-transform active:scale-95"
                          title="Upload Video"
                        >
                          {isUploading ? (
                            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <Upload className="w-6 h-6" />
                          )}
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </div>
                    </div>
                  )}

                  {/* Empty State */}
                  {!isRecorderOpen && !currentVideoUrl && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                      <div className="text-center p-8 bg-black/40 backdrop-blur-sm rounded-3xl border border-white/5 flex flex-col items-center">
                        <Film className="w-16 h-16 mb-4 text-[var(--color-primary)] opacity-80 drop-shadow-[0_0_15px_rgba(6,182,212,0.3)]" />
                        <h4 className="text-xl font-bold text-white mb-2">Ready for Action?</h4>
                        <p className="text-[var(--color-text-dim)]">Record or upload a video to start the analysis.</p>
                      </div>
                    </div>
                  )}

                  {/* Feedback Timeline */}
                  {!isRecorderOpen && currentVideoUrl && currentAnalysis?.feedback_items && (
                    <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none px-4 pb-3 bg-gradient-to-t from-black/80 to-transparent pt-12">
                      <FeedbackTimeline
                        feedbackItems={currentAnalysis.feedback_items}
                        videoDuration={videoDuration}
                        onSeekTo={handleSeekTo}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Analysis History (3 cols) */}
            <div className="lg:col-span-3 flex flex-col h-full rounded-2xl overflow-hidden glass-panel border-[var(--color-border)]">
              <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-base)]/50">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <BarChart2 className="w-5 h-5 text-[var(--color-secondary)]" />
                  <span>Analysis</span>
                </h3>
              </div>
              <div className="flex-1 overflow-hidden bg-[var(--color-surface-mid)]">
                <HistoryPanel onSeekTo={handleSeekTo} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
