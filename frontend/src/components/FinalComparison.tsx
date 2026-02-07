import React from 'react';
import { useSessionStore } from '../stores/useSessionStore';
import { TrendingUp, TrendingDown, CheckCircle, AlertTriangle, X } from 'lucide-react';

interface FinalComparisonProps {
  originalFeedback?: { title: string; category: string }[];
  finalFeedback?: { title: string; category: string }[];
  onClose?: () => void;
}

export const FinalComparison: React.FC<FinalComparisonProps> = ({
  originalFeedback = [],
  finalFeedback = [],
  onClose
}) => {
  const { originalVideo, finalVideo } = useSessionStore();

  if (!originalVideo?.score || !finalVideo?.score) {
    return null;
  }

  const improvement = finalVideo.score - originalVideo.score;
  const isImproved = improvement > 0;

  // Compare feedback: find what was fixed vs still needs work
  const originalIssues = new Set(originalFeedback.map(f => f.title.toLowerCase()));
  const finalIssues = new Set(finalFeedback.map(f => f.title.toLowerCase()));

  // Fixed = was in original, not in final
  const fixed: string[] = [];
  originalFeedback.forEach(f => {
    if (!finalIssues.has(f.title.toLowerCase())) {
      fixed.push(f.title);
    }
  });

  // Still needs work = in both original and final
  const stillNeedsWork: string[] = [];
  originalFeedback.forEach(f => {
    if (finalIssues.has(f.title.toLowerCase())) {
      stillNeedsWork.push(f.title);
    }
  });

  // New issues = in final but not original
  const newIssues: string[] = [];
  finalFeedback.forEach(f => {
    if (!originalIssues.has(f.title.toLowerCase())) {
      newIssues.push(f.title);
    }
  });

  return (
    <div className="final-comparison">
      <div className="final-comparison-header">
        <h3>🎉 Performance Comparison</h3>
        {onClose && (
          <button className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        )}
      </div>

      <div className="score-comparison">
        <div className="score-box original-score">
          <span className="label">Original</span>
          <span className="score">{originalVideo.score}</span>
        </div>
        <div className={`improvement-arrow ${isImproved ? 'positive' : 'negative'}`}>
          {isImproved ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
          <span className="diff">
            {isImproved ? '+' : ''}{improvement}
          </span>
        </div>
        <div className="score-box final-score">
          <span className="label">Final</span>
          <span className="score">{finalVideo.score}</span>
        </div>
      </div>

      {isImproved && improvement >= 10 && (
        <div className="celebration">
          🔥 Amazing improvement! You crushed it!
        </div>
      )}

      <div className="feedback-comparison">
        {fixed.length > 0 && (
          <div className="feedback-section fixed">
            <h4><CheckCircle size={16} /> Fixed!</h4>
            <ul>
              {fixed.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {stillNeedsWork.length > 0 && (
          <div className="feedback-section needs-work">
            <h4><AlertTriangle size={16} /> Still needs work</h4>
            <ul>
              {stillNeedsWork.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {newIssues.length > 0 && (
          <div className="feedback-section new-issues">
            <h4>New areas to focus on</h4>
            <ul>
              {newIssues.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
