import React from 'react';
import { useSessionStore } from '../stores/useSessionStore';
import { useAnalysisStore } from '../stores/useAnalysisStore';
import { CheckCircle2, Circle, ArrowRight, Film } from 'lucide-react';

/**
 * MemoryIndicator - Shows session progress through the coaching flow:
 * Upload Original → Fix Issues → Record Final
 */
interface MemoryIndicatorProps {
  onRecordFinal?: () => void;
}

export const MemoryIndicator: React.FC<MemoryIndicatorProps> = ({ onRecordFinal }) => {
  const {
    originalVideo,
    feedbackAddressed,
    feedbackTotal,
    finalVideo,
  } = useSessionStore();
  const { currentAnalysis } = useAnalysisStore();

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
          <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${improvement > 0 ? 'bg-green-500/10 text-green-400' : improvement < 0 ? 'bg-red-500/10 text-red-400' : 'bg-gray-500/10 text-gray-400'
            }`}>
            {improvement > 0 ? '+' : ''}{improvement} pts
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {steps.map((step, i) => (
          <React.Fragment key={step.label}>
            {i > 0 && (
              <ArrowRight className={`w-4 h-4 flex-shrink-0 ${steps[i - 1].done ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-dim)]'
                }`} />
            )}
            <div className={`flex-1 rounded-xl p-3 border transition-colors ${step.done
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

      {/* Record Final button - shown when analysis is done but no final video yet */}
      {/* Record Final button - shown when analysis is done but no final video yet */}
      {currentAnalysis && !finalVideo?.score && onRecordFinal && (
        <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
          <button
            onClick={onRecordFinal}
            className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-[var(--color-primary)] via-cyan-400 to-[#0891b2] p-[1px] shadow-[0_0_20px_var(--color-primary-glow)] transition-all hover:shadow-[0_0_30px_var(--color-primary-glow)] hover:-translate-y-0.5 cursor-pointer"
          >
            <div className="relative flex items-center justify-center gap-3 rounded-xl bg-black/20 backdrop-blur-sm px-6 py-4 transition-colors group-hover:bg-transparent">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20 group-hover:bg-white/30 transition-colors">
                <Film className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-white font-bold text-sm uppercase tracking-wider">Record Final Take</span>
                <span className="text-white/80 text-[10px] font-medium">Capture your improved performance</span>
              </div>
              <ArrowRight className="ml-auto w-5 h-5 text-white opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </div>
          </button>
        </div>
      )}
    </div>
  );
};

export default MemoryIndicator;
