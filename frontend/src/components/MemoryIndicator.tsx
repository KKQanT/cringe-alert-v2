import React from 'react';
import { useSessionStore } from '../stores/useSessionStore';

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
      <div className="memory-header">
        <span className="memory-icon">🧠</span>
        <span className="memory-title">Coach Memory</span>
        <span className={`memory-status ${hasMemory ? 'active' : 'inactive'}`}>
          {hasMemory ? '● Active' : '○ Waiting'}
        </span>
      </div>

      {hasMemory && (
        <div className="memory-content">
          {/* Original Score */}
          {originalVideo?.score !== undefined && (
            <div className="memory-item">
              <span className="memory-label">Original Score:</span>
              <span className="memory-value score">{originalVideo.score}/100</span>
            </div>
          )}

          {/* Practice Clips */}
          {practiceCount > 0 && (
            <div className="memory-item">
              <span className="memory-label">Practice Clips:</span>
              <span className="memory-value">{practiceCount} recorded</span>
            </div>
          )}

          {/* Final Score */}
          {finalVideo?.score !== undefined && (
            <div className="memory-item">
              <span className="memory-label">Final Score:</span>
              <span className="memory-value score">{finalVideo.score}/100</span>
              {originalVideo?.score !== undefined && (
                <span className={`improvement ${finalVideo.score > originalVideo.score ? 'positive' : 'negative'}`}>
                  {finalVideo.score > originalVideo.score ? '+' : ''}
                  {finalVideo.score - originalVideo.score}
                </span>
              )}
            </div>
          )}

          {/* Thought Signature (truncated) */}
          {signature && (
            <div className="memory-signature">
              <span className="signature-label">Context:</span>
              <code className="signature-value">{signature.slice(0, 20)}...</code>
            </div>
          )}
        </div>
      )}

      {!hasMemory && (
        <div className="memory-waiting">
          Upload a video to start coaching session
        </div>
      )}
    </div>
  );
};

export default MemoryIndicator;
