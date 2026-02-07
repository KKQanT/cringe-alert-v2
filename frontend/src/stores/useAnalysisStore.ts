import { create } from 'zustand';

export interface FeedbackItem {
  timestamp_seconds: number;
  category: 'guitar' | 'vocals' | 'timing';
  severity: 'critical' | 'improvement' | 'minor';
  title: string;
  action?: string;
  description: string;
  status?: string;  // 'unfixed' | 'fixed' | 'skipped'
  fix_clip_url?: string;
  fix_clip_blob_name?: string;
  fix_feedback?: string;
  fix_attempts?: number;
}

export interface FixResult {
  is_fixed: boolean;
  explanation: string;
  tips?: string;
}

export interface AnalysisResult {
  overall_score: number;
  summary: string;
  song_name: string | null;
  song_artist: string | null;
  feedback_items: FeedbackItem[];
  strengths: string[];
  thought_signature: string | null;
  comparison_summary?: string;
  ig_postable?: boolean;
  ig_verdict?: string;
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

  // Fix modal state
  fixModalOpen: boolean;
  fixModalFeedbackIndex: number | null;
  fixEvaluating: boolean;
  fixResult: FixResult | null;

  // History
  analysisHistory: AnalysisResult[];

  // Actions
  startAnalysis: () => void;
  setStatus: (status: string) => void;
  appendThinking: (content: string) => void;
  setAnalysisResult: (result: AnalysisResult) => void;
  setHighlightedFeedback: (index: number | null) => void;

  // Fix modal actions
  openFixModal: (index: number) => void;
  closeFixModal: () => void;
  setFixEvaluating: (evaluating: boolean) => void;
  setFixResult: (result: FixResult | null) => void;
  updateFeedbackItemStatus: (index: number, status: string, fixFeedback?: string) => void;

  reset: () => void;
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  isAnalyzing: false,
  analysisStatus: '',
  thinkingContent: '',
  currentAnalysis: null,
  highlightedFeedbackIndex: null,
  fixModalOpen: false,
  fixModalFeedbackIndex: null,
  fixEvaluating: false,
  fixResult: null,
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

  openFixModal: (index) => set({
    fixModalOpen: true,
    fixModalFeedbackIndex: index,
    fixEvaluating: false,
    fixResult: null,
  }),

  closeFixModal: () => set({
    fixModalOpen: false,
    fixModalFeedbackIndex: null,
    fixEvaluating: false,
    fixResult: null,
  }),

  setFixEvaluating: (evaluating) => set({ fixEvaluating: evaluating }),

  setFixResult: (result) => set({ fixResult: result, fixEvaluating: false }),

  updateFeedbackItemStatus: (index, status, fixFeedback) => set((state) => {
    if (!state.currentAnalysis) return {};
    const items = [...state.currentAnalysis.feedback_items];
    if (index < 0 || index >= items.length) return {};
    items[index] = {
      ...items[index],
      status,
      fix_feedback: fixFeedback ?? items[index].fix_feedback,
      fix_attempts: (items[index].fix_attempts ?? 0) + 1,
    };
    return {
      currentAnalysis: { ...state.currentAnalysis, feedback_items: items },
    };
  }),

  reset: () => set({
    isAnalyzing: false,
    analysisStatus: '',
    thinkingContent: '',
    currentAnalysis: null,
    fixModalOpen: false,
    fixModalFeedbackIndex: null,
    fixEvaluating: false,
    fixResult: null,
  })
}));
