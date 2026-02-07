import React from 'react';
import { useSessionStore } from '../stores/useSessionStore';
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';

/**
 * MemoryIndicator - Shows session progress through the coaching flow:
 * Upload Original → Fix Issues → Record Final
 */
export const MemoryIndicator: React.FC = () => {
  const {
    originalVideo,
    feedbackAddressed,
    feedbackTotal,
    finalVideo,
  } = useSessionStore();

  const steps = [
    {
      label: 'Original',
      done: !!originalVideo?.score,
      detail: originalVideo?.score != null ? `Score: ${originalVideo.score}` : null,
    },
    {
      label: 'Fix Issues',
      done: feedbackTotal > 0 && feedbackAddressed > 0,
      detail: feedbackTotal > 0 ? `${feedbackAddressed}/${feedbackTotal} fixed` : null,
    },
    {
      label: 'Final',
      done: !!finalVideo?.score,
      detail: finalVideo?.score != null ? `Score: ${finalVideo.score}` : null,
    },
  ];

  const improvement = (originalVideo?.score != null && finalVideo?.score != null)
    ? finalVideo.score - originalVideo.score
    : null;

  return (
    <div className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="font-semibold text-white text-sm">Session Progress</span>
        {improvement != null && (
          <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
            improvement > 0 ? 'bg-green-500/10 text-green-400' : improvement < 0 ? 'bg-red-500/10 text-red-400' : 'bg-gray-500/10 text-gray-400'
          }`}>
            {improvement > 0 ? '+' : ''}{improvement} pts
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {steps.map((step, i) => (
          <React.Fragment key={step.label}>
            {i > 0 && (
              <ArrowRight className={`w-4 h-4 flex-shrink-0 ${
                steps[i - 1].done ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-dim)]'
              }`} />
            )}
            <div className={`flex-1 rounded-xl p-3 border transition-colors ${
              step.done
                ? 'border-[var(--color-primary)]/30 bg-[var(--color-primary)]/5'
                : 'border-[var(--color-border)] bg-[var(--color-surface-base)]'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                {step.done ? (
                  <CheckCircle2 className="w-4 h-4 text-[var(--color-primary)]" />
                ) : (
                  <Circle className="w-4 h-4 text-[var(--color-text-dim)]" />
                )}
                <span className={`text-xs font-medium ${step.done ? 'text-white' : 'text-[var(--color-text-dim)]'}`}>
                  {step.label}
                </span>
              </div>
              {step.detail && (
                <p className="text-xs text-[var(--color-text-muted)] pl-6">{step.detail}</p>
              )}
            </div>
          </React.Fragment>
        ))}
      </div>

      {!originalVideo?.score && (
        <p className="text-xs text-[var(--color-text-dim)] mt-3 text-center">
          Upload or record a video to begin
        </p>
      )}
    </div>
  );
};

export default MemoryIndicator;
