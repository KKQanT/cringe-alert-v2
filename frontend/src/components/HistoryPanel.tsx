import React from 'react';
import { useAnalysisStore, type FeedbackItem } from '../stores/useAnalysisStore';
import { Brain, Guitar, Mic2, Clock, Sparkles, MessageSquare } from 'lucide-react';

interface HistoryPanelProps {
  onSeekTo?: (timestamp: number) => void;
}

const severityColors = {
  critical: 'border-red-500 bg-red-500/10',
  improvement: 'border-yellow-500 bg-yellow-500/10',
  minor: 'border-blue-500 bg-blue-500/10',
};

const CategoryIcon = ({ category }: { category: string }) => {
  switch (category) {
    case 'guitar': return <Guitar className="w-4 h-4 text-orange-400" />;
    case 'vocals': return <Mic2 className="w-4 h-4 text-blue-400" />;
    case 'timing': return <Clock className="w-4 h-4 text-purple-400" />;
    default: return <MessageSquare className="w-4 h-4 text-gray-400" />;
  }
};

const formatTimestamp = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ onSeekTo }) => {
  const { isAnalyzing, analysisStatus, thinkingContent, currentAnalysis, highlightedFeedbackIndex } = useAnalysisStore();

  const handleFeedbackClick = (item: FeedbackItem) => {
    if (onSeekTo) {
      onSeekTo(item.timestamp_seconds);
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Hidden Header - managed by parent */}
      <div className="hidden items-center gap-2 mb-4">
        <Brain className="w-5 h-5 text-[var(--color-primary)]" />
        <h2 className="font-semibold text-lg">Analyst</h2>
        <span className="text-xs text-gray-400 ml-auto">Gemini 3 Pro</span>
      </div>


      {/* Thinking Stream */}
      {(isAnalyzing || thinkingContent) && (
        <div className="bg-[var(--color-surface-elevated)] rounded-lg p-3 mb-4 min-h-[4rem] max-h-[8rem] overflow-y-auto border border-[var(--color-border)]">
          <p className="text-xs text-[var(--color-primary)] mb-2 flex items-center gap-2 font-semibold">
            <Sparkles className="w-3 h-3 animate-pulse" />
            {analysisStatus || 'Thinking...'}
          </p>
          {thinkingContent && (
            <p className="text-sm text-[var(--color-text-muted)] whitespace-pre-wrap">{thinkingContent}</p>
          )}
          {isAnalyzing && !thinkingContent && (
            <div className="flex gap-1 ml-5">
              <div className="w-2 h-2 bg-[var(--color-primary)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-[var(--color-primary)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-[var(--color-primary)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          )}
        </div>
      )}

      {/* Score Display */}
      {currentAnalysis && (
        <div className="text-center mb-4 py-4 bg-[var(--color-surface-elevated)] rounded-xl border border-[var(--color-border)] relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-primary)]/5 to-[var(--color-secondary)]/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="text-3xl font-bold text-white relative z-10">
            {currentAnalysis.overall_score}<span className="text-lg text-[var(--color-text-dim)] font-medium">/100</span>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-1 relative z-10">{currentAnalysis.summary}</p>
        </div>
      )}

      {/* Feedback Items */}
      <div className="space-y-3 overflow-y-auto flex-1 p-6 custom-scrollbar">
        {currentAnalysis?.feedback_items.map((item, index) => (
          <button
            key={index}
            onClick={() => handleFeedbackClick(item)}
            className={`w-full text-left p-4 rounded-xl border-l-4 ${severityColors[item.severity]} hover:bg-white/5 transition-all cursor-pointer animate-fadeInUp shadow-sm hover:shadow-md ${highlightedFeedbackIndex === index ? 'ring-2 ring-[var(--color-primary)] shadow-[0_0_15px_var(--color-primary-glow)]' : ''}`}
            style={{ animationDelay: `${index * 150}ms` }}
          >
            <div className="flex items-center gap-2 mb-1">
              <CategoryIcon category={item.category} />
              <span className="font-medium text-sm">{item.title}</span>
              <span className="ml-auto text-xs text-purple-400 font-mono">
                {formatTimestamp(item.timestamp_seconds)}
              </span>
            </div>
            <p className="text-xs text-gray-400">{item.description}</p>
          </button>
        ))}

        {!currentAnalysis && !isAnalyzing && (
          <div className="flex flex-col items-center justify-center py-8 opacity-50 space-y-2">
            <Mic2 className="w-8 h-8 text-[var(--color-text-dim)]" />
            <p className="text-sm text-gray-400 text-center">
              Record a video to get feedback
            </p>
          </div>
        )}
      </div>

      {/* Strengths */}
      {currentAnalysis?.strengths && currentAnalysis.strengths.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-yellow-500" /> Strengths
          </p>
          <div className="flex flex-wrap gap-2">
            {currentAnalysis.strengths.map((strength, index) => (
              <span key={index} className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                {strength}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
