import { create } from 'zustand';

interface LyricLine {
  index: number;
  timestamp: number; // Start time in seconds
  text: string;
  chord?: string;
}

interface LyricsState {
  lyrics: LyricLine[];
  currentIndex: number;
  source: string | null;
  isManualInputRequested: boolean;

  // Actions
  setLyrics: (lyrics: LyricLine[], source: string) => void;
  setCurrentIndex: (index: number) => void;
  requestManualInput: () => void;
  reset: () => void;
}

export const useLyricsStore = create<LyricsState>((set) => ({
  lyrics: [],
  currentIndex: 0,
  source: null,
  isManualInputRequested: false,

  setLyrics: (lyrics, source) => set({
    lyrics,
    source,
    currentIndex: 0,
    isManualInputRequested: false
  }),

  setCurrentIndex: (index) => set({ currentIndex: index }),

  requestManualInput: () => set({ isManualInputRequested: true }),

  reset: () => set({
    lyrics: [],
    currentIndex: 0,
    source: null,
    isManualInputRequested: false,
  }),
}));
