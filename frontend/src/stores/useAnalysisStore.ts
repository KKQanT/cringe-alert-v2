import { create } from 'zustand';

export interface FeedbackItem {
  timestamp_seconds: number;
  category: 'guitar' | 'vocals' | 'timing';
  severity: 'critical' | 'improvement' | 'minor';
  title: string;
  description: string;
}

export interface AnalysisResult {
  overall_score: number;
  summary: string;
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

  // History
  analysisHistory: AnalysisResult[];

  // Actions
  startAnalysis: () => void;
  setStatus: (status: string) => void;
  appendThinking: (content: string) => void;
  setAnalysisResult: (result: AnalysisResult) => void;
  reset: () => void;
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  isAnalyzing: false,
  analysisStatus: '',
  thinkingContent: '',
  currentAnalysis: null,
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

  reset: () => set({
    isAnalyzing: false,
    analysisStatus: '',
    thinkingContent: '',
    currentAnalysis: null
  })
}));
