import { useRef, forwardRef, useImperativeHandle } from 'react';

interface VideoPlayerProps {
  src: string | null;
  className?: string;
  onDurationChange?: (duration: number) => void;
}

export interface VideoPlayerRef {
  seekTo: (time: number) => void;
  play: () => void;
  pause: () => void;
  getDuration: () => number;
}

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(({ src, className, onDurationChange }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useImperativeHandle(ref, () => ({
    seekTo: (time: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime = time;
      }
    },
    play: () => videoRef.current?.play(),
    pause: () => videoRef.current?.pause(),
    getDuration: () => videoRef.current?.duration || 0,
  }));

  const handleLoadedMetadata = () => {
    if (videoRef.current && onDurationChange) {
      onDurationChange(videoRef.current.duration);
    }
  };

  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-black/50 text-gray-400 ${className}`}>
        <p>No video selected</p>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      src={src}
      className={`w-full h-full object-contain ${className}`}
      controls
      playsInline
      onLoadedMetadata={handleLoadedMetadata}
    />
  );
});

VideoPlayer.displayName = "VideoPlayer";
