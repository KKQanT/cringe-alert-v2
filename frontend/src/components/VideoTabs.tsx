import React from 'react';
import { useSessionStore, type VideoType } from '../stores/useSessionStore';
import { Video, Clapperboard, Flag } from 'lucide-react';

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

  const getButtonClass = (isActive: boolean, isDisabled: boolean) => {
    if (isDisabled) return 'bg-[var(--color-surface-elevated)] text-[var(--color-text-dim)] opacity-50 cursor-not-allowed border border-transparent';
    if (isActive) return 'bg-[var(--color-primary)] text-white shadow-[0_0_15px_var(--color-primary-glow)] border border-[var(--color-primary)]';
    return 'bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-surface-mid)] border border-[var(--color-border)]';
  };

  return (
    <div className="flex items-center gap-4 relative">
      {/* Main Tabs Group */}
      <div className="flex p-1 bg-[var(--color-surface-elevated)] rounded-xl border border-[var(--color-border)]">
        {/* Original Tab */}
        <button
          onClick={() => onSwitchVideo('original')}
          disabled={!originalVideo}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${getButtonClass(activeVideoType === 'original' && !isPracticeExpanded, !originalVideo)}`}
        >
          <Video className="w-4 h-4" /> Original
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
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${getButtonClass(activeVideoType === 'practice' || isPracticeExpanded, practiceClips.length === 0)}`}
        >
          <Clapperboard className="w-4 h-4" /> Practice {practiceClips.length > 0 && `(${practiceClips.length})`}
        </button>

        {/* Final Tab */}
        <button
          onClick={() => onSwitchVideo('final')}
          disabled={!finalVideo}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${getButtonClass(activeVideoType === 'final' && !isPracticeExpanded, !finalVideo)}`}
        >
          <Flag className="w-4 h-4" /> Final
        </button>
      </div>

      {/* Practice Clips Expanded List (Dropdown style) */}
      {isPracticeExpanded && practiceClips.length > 0 && (
        <div className="absolute top-full left-0 mt-2 z-50 w-64 glass-panel rounded-xl p-2 space-y-1 animate-fadeInUp">
          <div className="px-3 py-1 text-[10px] text-[var(--color-text-dim)] font-bold uppercase tracking-wider">
            Practice Sessions
          </div>
          {practiceClips.map((clip, index) => (
            <button
              key={clip.id}
              onClick={() => onSwitchVideo('practice', clip.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all group border border-transparent ${selectedPracticeClipId === clip.id
                  ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/30 text-[var(--color-primary)]'
                  : 'hover:bg-white/5 text-[var(--color-text-muted)] hover:text-white'
                }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">Clip {index + 1}</span>
                {clip.sectionStart !== undefined && clip.sectionEnd !== undefined && (
                  <span className="text-xs opacity-60 font-mono">
                    {formatTime(clip.sectionStart)} - {formatTime(clip.sectionEnd)}
                  </span>
                )}
              </div>
              {clip.focusHint && (
                <div className="text-xs opacity-70 mt-0.5 truncate group-hover:opacity-100">
                  "{clip.focusHint}"
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
