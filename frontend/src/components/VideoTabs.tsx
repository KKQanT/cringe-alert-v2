import React from 'react';
import { useSessionStore, type VideoType } from '../stores/useSessionStore';

interface VideoTabsProps {
  onSwitchVideo: (type: VideoType, practiceClipId?: string) => void;
}

export const VideoTabs: React.FC<VideoTabsProps> = ({ onSwitchVideo }) => {
  const { originalVideo, practiceClips, finalVideo, activeVideoType, selectedPracticeClipId } = useSessionStore();
  const [isPracticeExpanded, setIsPracticeExpanded] = React.useState(false);

  const formatTime = (seconds?: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="mb-2 space-y-2">
      {/* Main Tabs */}
      <div className="flex gap-2">
        {/* Original Tab */}
        <button
          onClick={() => onSwitchVideo('original')}
          disabled={!originalVideo}
          className={`px-4 py-2 rounded-lg font-medium transition ${activeVideoType === 'original' && !isPracticeExpanded
            ? 'bg-purple-600 text-white'
            : originalVideo
              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            }`}
        >
          📹 Original
        </button>

        {/* Practice Tab */}
        <button
          onClick={() => {
            if (practiceClips.length > 0) {
              setIsPracticeExpanded(!isPracticeExpanded);
              if (!isPracticeExpanded) {
                onSwitchVideo('practice', practiceClips[practiceClips.length - 1].id);
              }
            }
          }}
          disabled={practiceClips.length === 0}
          className={`px-4 py-2 rounded-lg font-medium transition ${activeVideoType === 'practice' || isPracticeExpanded
            ? 'bg-blue-600 text-white'
            : practiceClips.length > 0
              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            }`}
        >
          🎬 Practice {practiceClips.length > 0 && `(${practiceClips.length})`}
        </button>

        {/* Final Tab */}
        <button
          onClick={() => onSwitchVideo('final')}
          disabled={!finalVideo}
          className={`px-4 py-2 rounded-lg font-medium transition ${activeVideoType === 'final' && !isPracticeExpanded
            ? 'bg-green-600 text-white'
            : finalVideo
              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
            }`}
        >
          🏁 Final
        </button>
      </div>

      {/* Practice Clips Expanded List */}
      {isPracticeExpanded && practiceClips.length > 0 && (
        <div className="bg-gray-800/50 rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
          <div className="text-xs text-gray-400 font-semibold mb-2">Practice Clips:</div>
          {practiceClips.map((clip, index) => (
            <button
              key={clip.id}
              onClick={() => onSwitchVideo('practice', clip.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition ${selectedPracticeClipId === clip.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">Clip {index + 1}</span>
                {clip.sectionStart !== undefined && clip.sectionEnd !== undefined && (
                  <span className="text-xs opacity-75">
                    {formatTime(clip.sectionStart)} - {formatTime(clip.sectionEnd)}
                  </span>
                )}
              </div>
              {clip.focusHint && (
                <div className="text-xs opacity-75 mt-1">"{clip.focusHint}"</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
