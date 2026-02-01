import { create } from 'zustand';

interface AppState {
  currentVideoUrl: string | null;
  isRecorderOpen: boolean;

  setVideoUrl: (url: string) => void;
  openRecorder: () => void;
  closeRecorder: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentVideoUrl: null,
  isRecorderOpen: false,

  setVideoUrl: (url) => set({ currentVideoUrl: url }),
  openRecorder: () => set({ isRecorderOpen: true }),
  closeRecorder: () => set({ isRecorderOpen: false }),
}));
