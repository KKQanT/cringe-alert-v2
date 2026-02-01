import React from 'react';
import { useAnalysisStore, type FeedbackItem } from '../stores/useAnalysisStore';

interface HistoryPanelProps {
  onSeekTo?: (timestamp: number) => void;
}

const severityColors = {
  critical: 'border-red-500 bg-red-500/10',
  improvement: 'border-yellow-500 bg-yellow-500/10',
  minor: 'border-blue-500 bg-blue-500/10',
};

const categoryIcons = {
  guitar: '🎸',
  vocals: '🎤',
  timing: '⏱️',
};

const formatTimestamp = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ onSeekTo }) => {
  const { isAnalyzing, analysisStatus, thinkingContent, currentAnalysis } = useAnalysisStore();

  const handleFeedbackClick = (item: FeedbackItem) => {
    if (onSeekTo) {
      onSeekTo(item.timestamp_seconds);
    }
  };

  return (
    <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-white/5 flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">🧠</span>
        <h2 className="font-semibold text-lg">Analyst</h2>
        <span className="text-xs text-gray-400 ml-auto">Gemini 3 Pro</span>
      </div>

      {/* Thinking Stream */}
      {(isAnalyzing || thinkingContent) && (
        <div className="bg-[var(--color-surface-elevated)] rounded-lg p-3 mb-4 min-h-[4rem] max-h-[8rem] overflow-y-auto">
          <p className="text-xs text-gray-400 mb-2">💭 {analysisStatus || 'Thinking...'}</p>
          {thinkingContent && (
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{thinkingContent}</p>
          )}
          {isAnalyzing && !thinkingContent && (
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          )}
        </div>
      )}

      {/* Score Display */}
      {currentAnalysis && (
        <div className="text-center mb-4 py-2 bg-gradient-to-r from-purple-600/20 to-pink-600/20 rounded-lg">
          <div className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            {currentAnalysis.overall_score}/100
          </div>
          <p className="text-xs text-gray-400 mt-1">{currentAnalysis.summary}</p>
        </div>
      )}

      {/* Feedback Items */}
      <div className="space-y-2 overflow-y-auto flex-1">
        {currentAnalysis?.feedback_items.map((item, index) => (
          <button
            key={index}
            onClick={() => handleFeedbackClick(item)}
            className={`w-full text-left p-3 rounded-lg border-l-4 ${severityColors[item.severity]} hover:bg-white/5 transition cursor-pointer animate-fadeInUp`}
            style={{ animationDelay: `${index * 150}ms` }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span>{categoryIcons[item.category]}</span>
              <span className="font-medium text-sm">{item.title}</span>
              <span className="ml-auto text-xs text-purple-400 font-mono">
                {formatTimestamp(item.timestamp_seconds)}
              </span>
            </div>
            <p className="text-xs text-gray-400">{item.description}</p>
          </button>
        ))}

        {!currentAnalysis && !isAnalyzing && (
          <p className="text-sm text-gray-400 text-center py-4">
            Record a video to get feedback
          </p>
        )}
      </div>

      {/* Strengths */}
      {currentAnalysis?.strengths && currentAnalysis.strengths.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-xs text-gray-400 mb-2">✨ Strengths</p>
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
