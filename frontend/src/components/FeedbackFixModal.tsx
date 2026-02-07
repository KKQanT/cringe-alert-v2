import React, { useState, useCallback } from 'react';
import { X, Guitar, Mic2, Clock, MessageSquare, CheckCircle, XCircle, SkipForward, RotateCcw, Loader2 } from 'lucide-react';
import { Recorder } from './Recorder';
import { evaluateFixStream, useGetSignedUrl, uploadFileToUrl } from '../services/api';
import { useAnalysisStore, type FeedbackItem, type FixResult } from '../stores/useAnalysisStore';
import { useSessionStore } from '../stores/useSessionStore';
import { renderWithLyrics } from '../utils/renderLyrics';

interface FeedbackFixModalProps {
  isOpen: boolean;
  feedbackIndex: number | null;
  feedbackItem: FeedbackItem | null;
  onClose: () => void;
  onFixed: (index: number) => void;
  sessionId: string | null;
  originalVideoUrl: string | null;
}

type ModalPhase = 'idle' | 'recording' | 'uploading' | 'evaluating' | 'result';

const CategoryIcon = ({ category }: { category: string }) => {
  switch (category) {
    case 'guitar': return <Guitar className="w-5 h-5 text-orange-400" />;
    case 'vocals': return <Mic2 className="w-5 h-5 text-blue-400" />;
    case 'timing': return <Clock className="w-5 h-5 text-purple-400" />;
    default: return <MessageSquare className="w-5 h-5 text-gray-400" />;
  }
};

const severityBadge = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  improvement: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  minor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

export const FeedbackFixModal: React.FC<FeedbackFixModalProps> = ({
  isOpen,
  feedbackIndex,
  feedbackItem,
  onClose,
  onFixed,
  sessionId,
  originalVideoUrl,
}) => {
  const [phase, setPhase] = useState<ModalPhase>('idle');
  const [evaluationStatus, setEvaluationStatus] = useState('');
  const { fixResult, setFixResult, setFixEvaluating, updateFeedbackItemStatus } = useAnalysisStore();
  const { feedbackAddressed, feedbackTotal } = useSessionStore();

  const getSignedUrlMutation = useGetSignedUrl();

  const handleRecordComplete = useCallback(async ({ downloadUrl, blobName }: { downloadUrl: string; blobName: string }) => {
    if (feedbackIndex == null || !sessionId) return;

    setPhase('evaluating');
    setFixEvaluating(true);
    setEvaluationStatus('Starting evaluation...');

    try {
      for await (const chunk of evaluateFixStream(blobName, sessionId, feedbackIndex)) {
        switch (chunk.type) {
          case 'status':
            setEvaluationStatus(chunk.content);
            break;
          case 'thinking':
            setEvaluationStatus('AI is thinking...');
            break;
          case 'complete':
            try {
              const result: FixResult = JSON.parse(chunk.content);
              setFixResult(result);
              setPhase('result');

              // Update the feedback item status in the store
              updateFeedbackItemStatus(
                feedbackIndex,
                result.is_fixed ? 'fixed' : 'unfixed',
                result.explanation + (result.tips ? `\n\nTip: ${result.tips}` : ''),
              );

              // Update session store progress
              if (result.is_fixed) {
                useSessionStore.setState((s) => ({
                  feedbackAddressed: s.feedbackAddressed + 1,
                }));
              }
            } catch {
              console.error('Failed to parse fix result');
              setPhase('idle');
            }
            break;
          case 'error':
            setEvaluationStatus(`Error: ${chunk.content}`);
            setPhase('idle');
            break;
        }
      }
    } catch (error) {
      console.error('Fix evaluation failed:', error);
      setEvaluationStatus('Evaluation failed');
      setPhase('idle');
    } finally {
      setFixEvaluating(false);
    }
  }, [feedbackIndex, sessionId, setFixResult, setFixEvaluating, updateFeedbackItemStatus]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || feedbackIndex == null || !sessionId) return;

    setPhase('uploading');
    try {
      const filename = `fix_${Date.now()}_${file.name}`;
      const { upload_url, download_url, filename: blobName } = await getSignedUrlMutation.mutateAsync({
        filename,
        contentType: file.type,
      });
      await uploadFileToUrl(upload_url, file, file.type);
      handleRecordComplete({ downloadUrl: download_url, blobName });
    } catch (err) {
      console.error('Upload failed:', err);
      setPhase('idle');
    }
  }, [feedbackIndex, sessionId, getSignedUrlMutation, handleRecordComplete]);

  const handleSkip = useCallback(() => {
    if (feedbackIndex == null) return;
    updateFeedbackItemStatus(feedbackIndex, 'skipped');
    onClose();
  }, [feedbackIndex, updateFeedbackItemStatus, onClose]);

  const handleTryAgain = useCallback(() => {
    setPhase('idle');
    setFixResult(null);
    setEvaluationStatus('');
  }, [setFixResult]);

  const handleMarkFixed = useCallback(() => {
    if (feedbackIndex == null) return;
    onFixed(feedbackIndex);
    onClose();
  }, [feedbackIndex, onFixed, onClose]);

  if (!isOpen || feedbackIndex == null || !feedbackItem) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] bg-[var(--color-surface-base)] rounded-2xl border border-[var(--color-border)] shadow-2xl flex flex-col overflow-hidden animate-fadeInUp">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center gap-3">
          <CategoryIcon category={feedbackItem.category} />
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white text-lg truncate">{feedbackItem.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full border ${severityBadge[feedbackItem.severity]}`}>
                {feedbackItem.severity}
              </span>
              <span className="text-xs text-[var(--color-text-dim)]">
                {feedbackItem.category}
              </span>
              {feedbackItem.fix_attempts != null && feedbackItem.fix_attempts > 0 && (
                <span className="text-xs text-[var(--color-text-dim)]">
                  Attempt #{(feedbackItem.fix_attempts ?? 0) + 1}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-[var(--color-text-muted)]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Feedback Detail */}
          <div className="space-y-3">
            {feedbackItem.action && (
              <div className="bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 rounded-xl p-4">
                <p className="text-sm font-semibold text-[var(--color-secondary)]">
                  {renderWithLyrics(feedbackItem.action)}
                </p>
              </div>
            )}
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
              {renderWithLyrics(feedbackItem.description)}
            </p>
          </div>

          {/* Recording / Upload Area */}
          {(phase === 'idle' || phase === 'recording') && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-white">Record your fix</h4>
              <div className="rounded-xl overflow-hidden border border-[var(--color-border)] bg-black" style={{ height: '300px' }}>
                <Recorder
                  onUploadComplete={handleRecordComplete}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-text-dim)]">or</span>
                <label className="text-xs text-[var(--color-primary)] hover:underline cursor-pointer">
                  upload a video file
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Uploading state */}
          {phase === 'uploading' && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 text-[var(--color-primary)] animate-spin" />
              <p className="text-sm text-[var(--color-text-muted)]">Uploading clip...</p>
            </div>
          )}

          {/* Evaluating state */}
          {phase === 'evaluating' && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 text-[var(--color-primary)] animate-spin" />
              <p className="text-sm text-[var(--color-text-muted)]">{evaluationStatus}</p>
            </div>
          )}

          {/* Result */}
          {phase === 'result' && fixResult && (
            <div className="space-y-4">
              <div className={`rounded-xl p-5 border ${fixResult.is_fixed
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-yellow-500/10 border-yellow-500/30'
              }`}>
                <div className="flex items-center gap-3 mb-3">
                  {fixResult.is_fixed ? (
                    <>
                      <CheckCircle className="w-6 h-6 text-green-400" />
                      <span className="font-bold text-green-400 text-lg">Fixed!</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-6 h-6 text-yellow-400" />
                      <span className="font-bold text-yellow-400 text-lg">Not quite there yet</span>
                    </>
                  )}
                </div>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                  {fixResult.explanation}
                </p>
                {fixResult.tips && !fixResult.is_fixed && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <p className="text-sm text-[var(--color-secondary)]">
                      Tip: {fixResult.tips}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-[var(--color-border)] flex items-center gap-3">
          {phase === 'result' && fixResult && (
            <>
              {fixResult.is_fixed ? (
                <button
                  onClick={handleMarkFixed}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white px-4 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" /> Done
                </button>
              ) : (
                <button
                  onClick={handleTryAgain}
                  className="flex-1 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/80 text-white px-4 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-5 h-5" /> Try Again
                </button>
              )}
            </>
          )}
          <button
            onClick={handleSkip}
            className="px-4 py-3 rounded-xl bg-[var(--color-surface-elevated)] hover:bg-[var(--color-surface-mid)] text-[var(--color-text-muted)] border border-[var(--color-border)] transition font-medium flex items-center gap-2"
          >
            <SkipForward className="w-4 h-4" /> Skip
          </button>
          {(phase === 'idle' || phase === 'recording') && (
            <button
              onClick={onClose}
              className="px-4 py-3 rounded-xl bg-[var(--color-surface-elevated)] hover:bg-[var(--color-surface-mid)] text-[var(--color-text-muted)] border border-[var(--color-border)] transition font-medium"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
