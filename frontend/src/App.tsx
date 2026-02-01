import { useRef, useCallback, useState } from 'react';
import { analyzeVideoStream } from './services/api';
import { useAppStore } from './stores/useAppStore';
import { useAnalysisStore, type AnalysisResult } from './stores/useAnalysisStore';
import { Recorder } from './components/Recorder';
import { VideoPlayer, type VideoPlayerRef } from './components/VideoPlayer';
import { HistoryPanel } from './components/HistoryPanel';
import { FeedbackTimeline } from './components/FeedbackTimeline';
import './index.css';

function App() {
  const { currentVideoUrl, isRecorderOpen, setVideoUrl, openRecorder, closeRecorder } = useAppStore();
  const { currentAnalysis, startAnalysis, setStatus, appendThinking, setAnalysisResult } = useAnalysisStore();
  const videoPlayerRef = useRef<VideoPlayerRef>(null);
  const [videoDuration, setVideoDuration] = useState(0);

  const handleSeekTo = useCallback((timestamp: number) => {
    videoPlayerRef.current?.seekTo(timestamp);
    videoPlayerRef.current?.play();
  }, []);

  const runStreamingAnalysis = useCallback(async (blobName: string) => {
    startAnalysis();
    let analysisText = '';

    try {
      for await (const chunk of analyzeVideoStream(blobName)) {
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
            // Backend sends parsed JSON in the content field
            try {
              const result: AnalysisResult = JSON.parse(chunk.content);
              setAnalysisResult(result);
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
  }, [startAnalysis, setStatus, appendThinking, setAnalysisResult]);

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-white">
      {/* Header */}
      <header className="border-b border-white/10 py-4 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
            🚨 Cringe Alert
          </h1>
          <button className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all duration-200 shadow-lg shadow-purple-500/25">
            Judge My Performance
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-12rem)]">
          {/* Host Panel */}
          <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">🎙️</span>
              <h2 className="font-semibold text-lg">Host</h2>
              <span className="text-xs text-gray-400 ml-auto">Gemini 2.5 Live</span>
            </div>
            <div className="space-y-3 overflow-y-auto h-[calc(100%-3rem)]">
              <div className="bg-[var(--color-surface-elevated)] rounded-lg p-3 text-sm text-gray-300">
                <p>👋 Hey there! Ready to judge your performance?</p>
              </div>
            </div>
          </div>

          {/* Video Playground */}
          <div className="lg:col-span-2 bg-[var(--color-surface)] rounded-xl p-4 border border-white/5 flex flex-col">
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden mb-4">
              {isRecorderOpen ? (
                <Recorder
                  onUploadComplete={({ downloadUrl, blobName }) => {
                    setVideoUrl(downloadUrl);
                    closeRecorder();
                    runStreamingAnalysis(blobName);
                  }}
                />
              ) : (
                <VideoPlayer
                  ref={videoPlayerRef}
                  src={currentVideoUrl}
                  className="w-full h-full"
                  onDurationChange={setVideoDuration}
                />
              )}

              {/* Manual Recorder Toggle (Safe UX) */}
              {!isRecorderOpen && (
                <div className="absolute top-4 right-4 z-10">
                  <button
                    onClick={openRecorder}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg"
                  >
                    Record New Take
                  </button>
                </div>
              )}
              {!isRecorderOpen && !currentVideoUrl && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <div className="text-6xl mb-4">🎬</div>
                    <p className="text-gray-400">Click "Record" to start</p>
                  </div>
                </div>
              )}
              {/* Feedback Timeline Overlay - positioned on the native scrubber */}
              {!isRecorderOpen && currentVideoUrl && currentAnalysis?.feedback_items && (
                <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none px-3 pb-[12px]">
                  <FeedbackTimeline
                    feedbackItems={currentAnalysis.feedback_items}
                    videoDuration={videoDuration}
                    onSeekTo={handleSeekTo}
                  />
                </div>
              )}
            </div>

            {/* Lyrics Panel */}
            <div className="mt-4 bg-[var(--color-surface-elevated)] rounded-lg p-4 min-h-[8rem]">
              <p className="text-gray-400 text-sm">♪ Lyrics will appear here...</p>
            </div>
          </div>

          {/* Analyst Panel - Now using HistoryPanel */}
          <HistoryPanel onSeekTo={handleSeekTo} />
        </div>

        {/* Cringe Score */}
        <div className="mt-6 bg-[var(--color-surface)] rounded-xl p-6 border border-white/5 text-center">
          <h3 className="text-lg font-semibold text-gray-400 mb-2">Cringe Score</h3>
          <div className="text-6xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            {currentAnalysis ? `${currentAnalysis.overall_score}/100` : '--/100'}
          </div>
          <p className="text-gray-400 mt-2">
            {currentAnalysis ? currentAnalysis.summary : 'Upload a video to get your score!'}
          </p>
        </div>
      </main>
    </div>
  );
}

export default App;
