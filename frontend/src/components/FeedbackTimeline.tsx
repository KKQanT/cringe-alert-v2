import { type FeedbackItem } from '../stores/useAnalysisStore';

interface FeedbackTimelineProps {
  feedbackItems: FeedbackItem[];
  videoDuration: number;
  onSeekTo?: (timestamp: number) => void;
}

const severityColors = {
  critical: 'bg-red-500',
  improvement: 'bg-yellow-500',
  minor: 'bg-blue-500',
};

export const FeedbackTimeline: React.FC<FeedbackTimelineProps> = ({
  feedbackItems,
  videoDuration,
  onSeekTo,
}) => {
  if (!videoDuration || videoDuration <= 0 || feedbackItems.length === 0) {
    return null;
  }

  return (
    <div className="h-4 relative w-full">
      {/* Feedback dots only - no background bar */}
      {feedbackItems.map((item, index) => {
        const position = (item.timestamp_seconds / videoDuration) * 100;
        // Clamp position to valid range
        const clampedPosition = Math.min(Math.max(position, 1), 99);

        return (
          <button
            key={index}
            onClick={() => onSeekTo?.(item.timestamp_seconds)}
            className={`absolute top-1/2 w-3 h-3 rounded-full ${severityColors[item.severity]} 
                       shadow-lg cursor-pointer hover:scale-150 transition-transform
                       -translate-y-1/2 -translate-x-1/2 pointer-events-auto
                       ring-2 ring-white/30`}
            style={{
              left: `${clampedPosition}%`,
            }}
            title={`${item.title} (${Math.floor(item.timestamp_seconds / 60)}:${String(Math.floor(item.timestamp_seconds % 60)).padStart(2, '0')})`}
          />
        );
      })}
    </div>
  );
};
