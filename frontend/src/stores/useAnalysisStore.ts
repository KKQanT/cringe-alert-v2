import { create } from 'zustand';

export interface FeedbackItem {
  timestamp_seconds: number;
  category: 'guitar' | 'vocals' | 'timing';
  severity: 'critical' | 'improvement' | 'minor';
  title: string;
  action?: string;
  description: string;
}

export interface AnalysisResult {
  overall_score: number;
  summary: string;
  song_name: string | null;
  song_artist: string | null;
  feedback_items: FeedbackItem[];
  strengths: string[];
  thought_signature: string | null;
}

interface AnalysisState {
  // Current analysis status
  isAnalyzing: boolean;
  analysisStatus: string;
  thinkingContent: string;

  // Results
  currentAnalysis: AnalysisResult | null;

  // Highlighted feedback (for coach to point at)
  highlightedFeedbackIndex: number | null;

  // History
  analysisHistory: AnalysisResult[];

  // Actions
  startAnalysis: () => void;
  setStatus: (status: string) => void;
  appendThinking: (content: string) => void;
  setAnalysisResult: (result: AnalysisResult) => void;
  setHighlightedFeedback: (index: number | null) => void;
  reset: () => void;
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  isAnalyzing: false,
  analysisStatus: '',
  thinkingContent: '',
  currentAnalysis: null,
  highlightedFeedbackIndex: null,
  analysisHistory: [],

  startAnalysis: () => set({
    isAnalyzing: true,
    analysisStatus: 'Starting...',
    thinkingContent: '',
    currentAnalysis: null
  }),

  setStatus: (status) => set({ analysisStatus: status }),

  appendThinking: (content) => set((state) => ({
    thinkingContent: state.thinkingContent + content
  })),

  setAnalysisResult: (result) => set((state) => ({
    isAnalyzing: false,
    currentAnalysis: result,
    analysisHistory: [...state.analysisHistory, result]
  })),

  setHighlightedFeedback: (index) => set({ highlightedFeedbackIndex: index }),

  reset: () => set({
    isAnalyzing: false,
    analysisStatus: '',
    thinkingContent: '',
    currentAnalysis: null
  })
}));
