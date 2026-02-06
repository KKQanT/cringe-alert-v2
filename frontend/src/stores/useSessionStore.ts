import { create } from 'zustand';

// Video types in the app
export type VideoType = 'original' | 'practice' | 'final';

export interface PracticeClip {
  id: string;
  url: string;
  blobName: string;
  sectionStart?: number;
  sectionEnd?: number;
  focusHint?: string;
  createdAt: Date;
}

export interface SessionVideo {
  url: string;
  blobName: string;
  score?: number;
  thoughtSignature?: string;
  createdAt: Date;
}

interface SessionState {
  // Session
  sessionId: string | null;

  // Videos
  originalVideo: SessionVideo | null;
  practiceClips: PracticeClip[];
  finalVideo: SessionVideo | null;

  // Current view
  activeVideoType: VideoType;
  currentVideoUrl: string | null;
  selectedPracticeClipId: string | null;

  // Recorder state
  isRecorderOpen: boolean;
  autoStartRecording: boolean;
  recorderFocusHint: string | null;
  recorderSectionStart: number | null;
  recorderSectionEnd: number | null;

  // Actions
  startNewSession: () => void;

  // Video actions
  setOriginalVideo: (url: string, blobName: string) => void;
  updateOriginalAnalysis: (score: number, thoughtSignature?: string) => void;
  addPracticeClip: (clip: Omit<PracticeClip, 'id' | 'createdAt'>) => void;
  setFinalVideo: (url: string, blobName: string) => void;
  updateFinalAnalysis: (score: number, thoughtSignature?: string) => void;

  // View actions
  switchToVideo: (type: VideoType, practiceClipId?: string) => void;

  // Recorder actions
  openRecorder: (focusHint?: string, sectionStart?: number, sectionEnd?: number, autoStart?: boolean) => void;
  closeRecorder: () => void;

  // For backward compatibility
  setVideoUrl: (url: string) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  // Initial state
  sessionId: null,
  originalVideo: null,
  practiceClips: [],
  finalVideo: null,
  activeVideoType: 'original',
  currentVideoUrl: null,
  selectedPracticeClipId: null,
  isRecorderOpen: false,
  autoStartRecording: false,
  recorderFocusHint: null,
  recorderSectionStart: null,
  recorderSectionEnd: null,

  startNewSession: () => set({
    sessionId: `session_${Date.now()}`,
    originalVideo: null,
    practiceClips: [],
    finalVideo: null,
    activeVideoType: 'original',
    currentVideoUrl: null,
    selectedPracticeClipId: null,
    isRecorderOpen: false,
  }),

  setOriginalVideo: (url, blobName) => set({
    originalVideo: {
      url,
      blobName,
      createdAt: new Date(),
    },
    currentVideoUrl: url,
    activeVideoType: 'original',
  }),

  updateOriginalAnalysis: (score, thoughtSignature) => set((state) => ({
    originalVideo: state.originalVideo ? {
      ...state.originalVideo,
      score,
      thoughtSignature,
    } : null,
  })),

  addPracticeClip: (clip) => set((state) => {
    const newClip: PracticeClip = {
      ...clip,
      id: `clip_${Date.now()}`,
      createdAt: new Date(),
    };
    return {
      practiceClips: [...state.practiceClips, newClip],
      currentVideoUrl: newClip.url,
      activeVideoType: 'practice',
      selectedPracticeClipId: newClip.id,
    };
  }),

  setFinalVideo: (url, blobName) => set({
    finalVideo: {
      url,
      blobName,
      createdAt: new Date(),
    },
    currentVideoUrl: url,
    activeVideoType: 'final',
  }),

  updateFinalAnalysis: (score, thoughtSignature) => set((state) => ({
    finalVideo: state.finalVideo ? {
      ...state.finalVideo,
      score,
      thoughtSignature,
    } : null,
  })),

  switchToVideo: (type, practiceClipId) => {
    const state = get();
    let url: string | null = null;

    switch (type) {
      case 'original':
        url = state.originalVideo?.url ?? null;
        break;
      case 'practice':
        if (practiceClipId) {
          url = state.practiceClips.find(c => c.id === practiceClipId)?.url ?? null;
        } else if (state.practiceClips.length > 0) {
          url = state.practiceClips[state.practiceClips.length - 1].url;
        }
        break;
      case 'final':
        url = state.finalVideo?.url ?? null;
        break;
    }

    set({
      activeVideoType: type,
      currentVideoUrl: url,
      selectedPracticeClipId: practiceClipId ?? null,
    });
  },

  openRecorder: (focusHint, sectionStart, sectionEnd, autoStart = false) => set({
    isRecorderOpen: true,
    autoStartRecording: autoStart,
    recorderFocusHint: focusHint ?? null,
    recorderSectionStart: sectionStart ?? null,
    recorderSectionEnd: sectionEnd ?? null,
  }),

  closeRecorder: () => set({
    isRecorderOpen: false,
    autoStartRecording: false,
    recorderFocusHint: null,
    recorderSectionStart: null,
    recorderSectionEnd: null,
  }),

  // Backward compatibility - sets as original if no original exists
  setVideoUrl: (url) => {
    const state = get();
    if (!state.originalVideo) {
      set({
        originalVideo: { url, blobName: '', createdAt: new Date() },
        currentVideoUrl: url,
        activeVideoType: 'original',
      });
    } else {
      set({ currentVideoUrl: url });
    }
  },
}));

// Alias for backward compatibility with old useAppStore
export const useAppStore = useSessionStore;
