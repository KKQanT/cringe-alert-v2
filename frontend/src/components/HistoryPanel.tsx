import React, { useRef, useEffect, useState } from 'react';
import { useAnalysisStore, type FeedbackItem } from '../stores/useAnalysisStore';
import { Brain, Guitar, Mic2, Clock, Sparkles, MessageSquare, ChevronDown, CheckCircle, SkipForward, Wrench } from 'lucide-react';
import { renderWithLyrics } from '../utils/renderLyrics';

interface HistoryPanelProps {
  onSeekTo?: (timestamp: number) => void;
  onOpenFixModal?: (index: number) => void;
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

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ onSeekTo, onOpenFixModal }) => {
  const { isAnalyzing, analysisStatus, thinkingContent, currentAnalysis, highlightedFeedbackIndex } = useAnalysisStore();
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());

  const feedbackRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (highlightedFeedbackIndex != null) {
      const el = feedbackRefs.current.get(highlightedFeedbackIndex);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlightedFeedbackIndex]);

  const handleSeekClick = (item: FeedbackItem) => {
    if (onSeekTo) {
      onSeekTo(item.timestamp_seconds);
    }
  };

  const toggleExpand = (index: number) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
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
          <p className="text-xs text-[var(--color-text-muted)] mt-1 relative z-10">{currentAnalysis.summary}</p>
        </div>
      )}

      {/* Fix Progress Bar */}
      {currentAnalysis && currentAnalysis.feedback_items.length > 0 && (() => {
        const total = currentAnalysis.feedback_items.length;
        const fixed = currentAnalysis.feedback_items.filter(f => f.status === 'fixed').length;
        const skipped = currentAnalysis.feedback_items.filter(f => f.status === 'skipped').length;
        const addressed = fixed + skipped;
        return (
          <div className="px-6 py-3 border-b border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[var(--color-text-muted)]">Fix Progress</span>
              <span className="text-xs text-[var(--color-primary)] font-bold">{fixed}/{total} fixed</span>
            </div>
            <div className="h-1.5 bg-[var(--color-surface-elevated)] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-[var(--color-primary)] transition-all duration-500"
                style={{ width: `${total > 0 ? (addressed / total) * 100 : 0}%` }}
              />
            </div>
          </div>
        );
      })()}

      {/* Scrollable content: Feedback Items + Strengths */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <div className="space-y-3">
          {currentAnalysis?.feedback_items.map((item, index) => {
            const isExpanded = expandedCards.has(index);
            const itemStatus = item.status ?? 'unfixed';
            return (
              <div
                key={index}
                ref={(el) => { if (el) feedbackRefs.current.set(index, el); else feedbackRefs.current.delete(index); }}
                className={`w-full text-left rounded-xl border-l-4 ${severityColors[item.severity]} transition-all animate-fadeInUp shadow-sm hover:shadow-md ${highlightedFeedbackIndex === index ? 'ring-2 ring-[var(--color-primary)] shadow-[0_0_15px_var(--color-primary-glow)]' : ''} ${itemStatus === 'fixed' ? 'opacity-70' : ''}`}
                style={{ animationDelay: `${index * 150}ms` }}
              >
                {/* Top section: clickable to seek */}
                <button
                  onClick={() => handleSeekClick(item)}
                  className="w-full text-left p-4 pb-1 hover:bg-white/5 transition-colors cursor-pointer rounded-t-xl"
                >
                  <div className="flex items-center gap-2">
                    <CategoryIcon category={item.category} />
                    <span className="font-medium text-sm flex-1">{item.title}</span>
                    {/* Status badge */}
                    {itemStatus === 'fixed' && (
                      <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/15 px-2 py-0.5 rounded-full">
                        <CheckCircle className="w-3 h-3" /> Fixed
                      </span>
                    )}
                    {itemStatus === 'skipped' && (
                      <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-500/15 px-2 py-0.5 rounded-full">
                        <SkipForward className="w-3 h-3" /> Skipped
                      </span>
                    )}
                    <span className="text-xs text-purple-400 font-mono flex-shrink-0">
                      {formatTimestamp(item.timestamp_seconds)}
                    </span>
                  </div>
                </button>

                {/* Action tip - always visible */}
                {item.action && (
                  <div className="px-4 pb-2">
                    <p className="text-sm font-semibold text-[var(--color-secondary)]">
                      {renderWithLyrics(item.action)}
                    </p>
                  </div>
                )}

                {/* Fix this button (only for unfixed items) */}
                {itemStatus === 'unfixed' && onOpenFixModal && (
                  <button
                    onClick={() => onOpenFixModal(index)}
                    className="mx-4 mb-2 px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)] bg-[var(--color-primary)]/10 hover:bg-[var(--color-primary)]/20 border border-[var(--color-primary)]/30 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Wrench className="w-3 h-3" /> Fix this
                  </button>
                )}

                {/* Toggle button */}
                <button
                  onClick={() => toggleExpand(index)}
                  className="w-full flex items-center gap-1 px-4 py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
                >
                  <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  {isExpanded ? 'Hide details' : 'Show details'}
                </button>

                {/* Expandable description */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-white/5">
                    <p className="text-xs text-gray-400 leading-relaxed">
                      {renderWithLyrics(item.description)}
                    </p>
                    {/* Show fix feedback if available */}
                    {item.fix_feedback && (
                      <div className="mt-2 pt-2 border-t border-white/5">
                        <p className="text-xs text-[var(--color-primary)]">AI Feedback: {item.fix_feedback}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {!currentAnalysis && !isAnalyzing && (
            <div className="flex flex-col items-center justify-center py-8 opacity-50 space-y-2">
              <Mic2 className="w-8 h-8 text-[var(--color-text-dim)]" />
              <p className="text-sm text-gray-400 text-center">
                Record a video to get feedback
              </p>
            </div>
          )}

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
      </div>
    </div>
  );
};
