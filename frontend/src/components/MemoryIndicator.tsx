import React from 'react';
import { useSessionStore } from '../stores/useSessionStore';
import { Brain } from 'lucide-react';

/**
 * MemoryIndicator - Shows what the Coach remembers about the current session
 * Displays thought signature status and session context
 */
export const MemoryIndicator: React.FC = () => {
  const {
    sessionId,
    originalVideo,
    practiceClips,
    finalVideo,
  } = useSessionStore();

  // Don't show anything if no session
  if (!sessionId && !originalVideo) {
    return null;
  }

  const hasMemory = originalVideo?.score !== undefined;
  const practiceCount = practiceClips.length;
  const signature = originalVideo?.thoughtSignature;

  return (
    <div className="memory-indicator">
      <div className="memory-header flex items-center gap-2 mb-2">
        <Brain className="w-5 h-5 text-[var(--color-primary)]" />
        <span className="memory-title font-semibold text-white">Coach Memory</span>
        <span className={`memory-status text-xs px-2 py-0.5 rounded-full ${hasMemory ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'} ml-auto`}>
          {hasMemory ? '● Active' : '○ Waiting'}
        </span>
      </div>

      {hasMemory && (
        <div className="memory-content space-y-2">
          {/* Original Score */}
          {originalVideo?.score !== undefined && (
            <div className="memory-item flex justify-between text-sm">
              <span className="memory-label text-[var(--color-text-muted)]">Original Score:</span>
              <span className="memory-value score font-mono text-white">{originalVideo.score}/100</span>
            </div>
          )}

          {/* Practice Clips */}
          {practiceCount > 0 && (
            <div className="memory-item flex justify-between text-sm">
              <span className="memory-label text-[var(--color-text-muted)]">Practice Clips:</span>
              <span className="memory-value text-white">{practiceCount} recorded</span>
            </div>
          )}

          {/* Final Score */}
          {finalVideo?.score !== undefined && (
            <div className="memory-item flex justify-between text-sm">
              <span className="memory-label text-[var(--color-text-muted)]">Final Score:</span>
              <div className="flex items-center gap-2">
                <span className="memory-value score font-mono text-white">{finalVideo.score}/100</span>
                {originalVideo?.score !== undefined && (
                  <span className={`text-xs ${finalVideo.score > originalVideo.score ? 'text-green-400' : 'text-red-400'}`}>
                    {finalVideo.score > originalVideo.score ? '+' : ''}
                    {finalVideo.score - originalVideo.score}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Thought Signature (truncated) */}
          {signature && (
            <div className="memory-signature text-xs mt-2 p-2 bg-black/20 rounded">
              <span className="signature-label text-[var(--color-text-dim)] block mb-1">Context:</span>
              <code className="signature-value text-[var(--color-primary)] font-mono break-all">{signature.slice(0, 30)}...</code>
            </div>
          )}
        </div>
      )}

      {!hasMemory && (
        <div className="memory-waiting text-center text-xs text-[var(--color-text-dim)] py-2">
          Upload a video to start coaching session
        </div>
      )}
    </div>
  );
};

export default MemoryIndicator;
