import React from 'react';
import { useSessionStore } from '../stores/useSessionStore';
import { useAnalysisStore } from '../stores/useAnalysisStore';
import { TrendingUp, TrendingDown, CheckCircle, AlertTriangle, X, Instagram } from 'lucide-react';

interface FinalComparisonProps {
  onClose?: () => void;
}

export const FinalComparison: React.FC<FinalComparisonProps> = ({ onClose }) => {
  const { originalVideo, finalVideo } = useSessionStore();
  const { currentAnalysis } = useAnalysisStore();

  if (!originalVideo?.score || !finalVideo?.score) {
    return null;
  }

  const improvement = finalVideo.score - originalVideo.score;
  const isImproved = improvement > 0;

  const comparisonSummary = currentAnalysis?.comparison_summary;
  const igPostable = currentAnalysis?.ig_postable;
  const igVerdict = currentAnalysis?.ig_verdict;

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-white text-sm">Performance Comparison</h3>
        {onClose && (
          <button className="p-1 hover:bg-white/10 rounded transition-colors" onClick={onClose}>
            <X size={16} className="text-[var(--color-text-dim)]" />
          </button>
        )}
      </div>

      {/* Score Comparison */}
      <div className="flex items-center justify-center gap-4">
        <div className="text-center">
          <p className="text-xs text-[var(--color-text-dim)] mb-1">Original</p>
          <span className="text-2xl font-bold text-white">{originalVideo.score}</span>
        </div>
        <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full ${isImproved ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
          {isImproved ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          <span className="font-bold text-sm">{isImproved ? '+' : ''}{improvement}</span>
        </div>
        <div className="text-center">
          <p className="text-xs text-[var(--color-text-dim)] mb-1">Final</p>
          <span className="text-2xl font-bold text-white">{finalVideo.score}</span>
        </div>
      </div>

      {isImproved && improvement >= 10 && (
        <div className="text-center text-sm text-yellow-400 font-semibold">
          Amazing improvement! You crushed it!
        </div>
      )}

      {/* AI Comparison Summary */}
      {comparisonSummary && (
        <div className="bg-[var(--color-surface-elevated)] rounded-xl p-3 border border-[var(--color-border)]">
          <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{comparisonSummary}</p>
        </div>
      )}

      {/* IG Verdict */}
      {igVerdict && (
        <div className={`rounded-xl p-3 border flex items-start gap-2 ${igPostable ? 'bg-green-500/10 border-green-500/30' : 'bg-yellow-500/10 border-yellow-500/30'}`}>
          <Instagram className={`w-4 h-4 flex-shrink-0 mt-0.5 ${igPostable ? 'text-green-400' : 'text-yellow-400'}`} />
          <div>
            <span className={`text-xs font-bold ${igPostable ? 'text-green-400' : 'text-yellow-400'}`}>
              {igPostable ? 'IG-Ready!' : 'Not quite IG-worthy...'}
            </span>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{igVerdict}</p>
          </div>
        </div>
      )}
    </div>
  );
};
