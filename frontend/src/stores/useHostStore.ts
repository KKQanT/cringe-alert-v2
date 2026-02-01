import { create } from 'zustand';

interface HostMessage {
  id: string;
  content: string;
  timestamp: number;
}

interface HostState {
  messages: HostMessage[];
  audioQueue: string[]; // base64 audio chunks
  isPlaying: boolean;

  // Actions
  addMessage: (content: string) => void;
  queueAudio: (audioData: string) => void;
  dequeueAudio: () => string | undefined;
  setPlaying: (playing: boolean) => void;
  reset: () => void;
}

export const useHostStore = create<HostState>((set, get) => ({
  messages: [],
  audioQueue: [],
  isPlaying: false,

  addMessage: (content) => set((state) => ({
    messages: [...state.messages, {
      id: crypto.randomUUID(),
      content,
      timestamp: Date.now()
    }]
  })),

  queueAudio: (audioData) => set((state) => ({
    audioQueue: [...state.audioQueue, audioData]
  })),

  dequeueAudio: () => {
    const queue = get().audioQueue;
    if (queue.length === 0) return undefined;
    set({ audioQueue: queue.slice(1) });
    return queue[0];
  },

  setPlaying: (playing) => set({ isPlaying: playing }),

  reset: () => set({ messages: [], audioQueue: [], isPlaying: false }),
}));
