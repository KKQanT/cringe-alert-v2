import { create } from 'zustand';
import type { SessionSummary, FullSession } from '../services/api';

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

  // Session list (for sidebar)
  sessions: SessionSummary[];
  setSessions: (sessions: SessionSummary[]) => void;

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
  recorderType: 'practice' | 'final' | null;

  // Actions
  startNewSession: () => void;
  setSessionId: (id: string) => void;

  // Load from backend
  loadFromBackend: (data: FullSession) => void;

  // Video actions
  setOriginalVideo: (url: string, blobName: string) => void;
  updateOriginalAnalysis: (score: number, thoughtSignature?: string) => void;
  addPracticeClip: (clip: Omit<PracticeClip, 'id' | 'createdAt'>) => void;
  setFinalVideo: (url: string, blobName: string) => void;
  updateFinalAnalysis: (score: number, thoughtSignature?: string) => void;

  // View actions
  switchToVideo: (type: VideoType, practiceClipId?: string) => void;

  // Recorder actions
  openRecorder: (focusHint?: string, sectionStart?: number, sectionEnd?: number, autoStart?: boolean, type?: 'practice' | 'final') => void;
  closeRecorder: () => void;

  // For backward compatibility
  setVideoUrl: (url: string) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  // Initial state
  sessionId: null,
  sessions: [],
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
  recorderType: null,

  setSessions: (sessions) => set({ sessions }),

  setSessionId: (id) => set({ sessionId: id }),

  startNewSession: () => set({
    sessionId: null,
    originalVideo: null,
    practiceClips: [],
    finalVideo: null,
    activeVideoType: 'original',
    currentVideoUrl: null,
    selectedPracticeClipId: null,
    isRecorderOpen: false,
  }),

  loadFromBackend: (data: FullSession) => {
    const originalVideo: SessionVideo | null = data.original_video
      ? {
          url: data.original_video.url,
          blobName: data.original_video.blob_name,
          score: data.original_video.score ?? undefined,
          thoughtSignature: data.original_video.thought_signature ?? undefined,
          createdAt: new Date(data.created_at),
        }
      : null;

    const practiceClips: PracticeClip[] = data.practice_clips.map((c, i) => ({
      id: `clip_${i}_${c.clip_number}`,
      url: c.url,
      blobName: c.blob_name,
      sectionStart: c.section_start ?? undefined,
      sectionEnd: c.section_end ?? undefined,
      focusHint: c.focus_hint ?? undefined,
      createdAt: new Date(c.created_at),
    }));

    const finalVideo: SessionVideo | null = data.final_video
      ? {
          url: data.final_video.url,
          blobName: data.final_video.blob_name,
          score: data.final_video.score ?? undefined,
          thoughtSignature: data.final_video.thought_signature ?? undefined,
          createdAt: new Date(data.final_video.analyzed_at ?? data.updated_at),
        }
      : null;

    // Determine which video to show
    let activeVideoType: VideoType = 'original';
    let currentVideoUrl: string | null = null;
    if (finalVideo) {
      activeVideoType = 'final';
      currentVideoUrl = finalVideo.url;
    } else if (originalVideo) {
      activeVideoType = 'original';
      currentVideoUrl = originalVideo.url;
    }

    set({
      sessionId: data.session_id,
      originalVideo,
      practiceClips,
      finalVideo,
      activeVideoType,
      currentVideoUrl,
      selectedPracticeClipId: null,
      isRecorderOpen: false,
    });
  },

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

  openRecorder: (focusHint, sectionStart, sectionEnd, autoStart = false, type = 'practice') => set({
    isRecorderOpen: true,
    autoStartRecording: autoStart,
    recorderFocusHint: focusHint ?? null,
    recorderSectionStart: sectionStart ?? null,
    recorderSectionEnd: sectionEnd ?? null,
    recorderType: type,
  }),

  closeRecorder: () => set({
    isRecorderOpen: false,
    autoStartRecording: false,
    recorderFocusHint: null,
    recorderSectionStart: null,
    recorderSectionEnd: null,
    recorderType: null,
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
