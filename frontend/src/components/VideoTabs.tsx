import React from 'react';
import { useSessionStore, type VideoType } from '../stores/useSessionStore';
import { Video, Flag } from 'lucide-react';

interface VideoTabsProps {
  onSwitchVideo: (type: VideoType, practiceClipId?: string) => void;
}

export const VideoTabs: React.FC<VideoTabsProps> = ({ onSwitchVideo }) => {
  const { originalVideo, finalVideo, activeVideoType } = useSessionStore();

  const getButtonClass = (isActive: boolean, isDisabled: boolean) => {
    if (isDisabled) return 'bg-[var(--color-surface-elevated)] text-[var(--color-text-dim)] opacity-50 cursor-not-allowed border border-transparent';
    if (isActive) return 'bg-[var(--color-primary)] text-white shadow-[0_0_15px_var(--color-primary-glow)] border border-[var(--color-primary)] cursor-pointer';
    return 'bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-surface-mid)] border border-[var(--color-border)] cursor-pointer';
  };

  return (
    <div className="flex items-center gap-4 relative">
      <div className="flex p-1 bg-[var(--color-surface-elevated)] rounded-xl border border-[var(--color-border)]">
        {/* Original Tab */}
        <button
          onClick={() => onSwitchVideo('original')}
          disabled={!originalVideo}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${getButtonClass(activeVideoType === 'original', !originalVideo)}`}
        >
          <Video className="w-4 h-4" /> Original
        </button>

        {/* Final Tab */}
        <button
          onClick={() => onSwitchVideo('final')}
          disabled={!finalVideo}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${getButtonClass(activeVideoType === 'final', !finalVideo)}`}
        >
          <Flag className="w-4 h-4" /> Final
        </button>
      </div>
    </div>
  );
};
