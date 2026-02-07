import { useQuery, useMutation, QueryClient } from '@tanstack/react-query';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

// ============ Types ============

export interface SessionSummary {
  session_id: string;
  created_at: string;
  has_original: boolean;
  has_final: boolean;
  practice_clip_count: number;
  original_score: number | null;
  final_score: number | null;
  improvement: number | null;
}

export interface VideoAnalysisData {
  url: string;
  blob_name: string;
  score: number | null;
  summary: string | null;
  feedback_items: Array<{
    timestamp_seconds: number;
    category: string;
    severity: string;
    title: string;
    description: string;
  }>;
  strengths: string[];
  thought_signature: string | null;
  analyzed_at: string | null;
}

export interface PracticeClipData {
  clip_number: number;
  url: string;
  blob_name: string;
  section_start: number | null;
  section_end: number | null;
  focus_hint: string | null;
  feedback: string | null;
  score: number | null;
  feedback_items: Array<{
    timestamp_seconds: number;
    category: string;
    severity: string;
    title: string;
    description: string;
  }>;
  strengths: string[];
  thought_signature: string | null;
  created_at: string;
}

export interface FullSession {
  session_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  original_video: VideoAnalysisData | null;
  practice_clips: PracticeClipData[];
  final_video: VideoAnalysisData | null;
  improvement: number | null;
}

// ============ Session API ============

export async function fetchUserSessions(userId: string = '1'): Promise<SessionSummary[]> {
  const response = await fetch(`${API_BASE}/api/sessions?user_id=${encodeURIComponent(userId)}`);
  if (!response.ok) throw new Error('Failed to fetch sessions');
  return response.json();
}

export async function fetchFullSession(sessionId: string): Promise<FullSession> {
  const response = await fetch(`${API_BASE}/api/sessions/${encodeURIComponent(sessionId)}/full`);
  if (!response.ok) throw new Error('Failed to fetch full session');
  return response.json();
}

export async function createSession(userId: string = '1'): Promise<{ session_id: string }> {
  const response = await fetch(`${API_BASE}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!response.ok) throw new Error('Failed to create session');
  return response.json();
}

// ============ Hooks ============

// Health check query
export const useHealthCheck = () => {
  return useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/health`);
      return response.json();
    },
  });
};

// Get signed URL from backend
export const useGetSignedUrl = () => {
  return useMutation({
    mutationFn: async ({ filename, contentType }: { filename: string; contentType: string }) => {
      const response = await fetch(`${API_BASE}/api/upload/signed-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, content_type: contentType }),
      });
      if (!response.ok) throw new Error('Failed to get signed URL');
      return response.json() as Promise<{ upload_url: string; download_url: string; filename: string }>;
    },
  });
};

// Upload file to the signed URL
export const uploadFileToUrl = async (signedUrl: string, file: Blob, contentType: string) => {
  const response = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });
  if (!response.ok) throw new Error('Failed to upload file');
  return true;
};

// Trigger video analysis
export const useAnalyzeVideo = () => {
  return useMutation({
    mutationFn: async (videoUrl: string) => {
      const response = await fetch(`${API_BASE}/api/analyze/video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_url: videoUrl }),
      });
      if (!response.ok) throw new Error('Failed to start analysis');
      return response.json();
    },
  });
};

// Streaming analysis - returns an async iterator of chunks
export async function* analyzeVideoStream(
  videoUrl: string,
  sessionId?: string,
  videoType?: 'original' | 'practice' | 'final'
): AsyncGenerator<{
  type: 'status' | 'thinking' | 'analysis' | 'complete' | 'error';
  content: string;
}> {
  const body: Record<string, string> = { video_url: videoUrl };
  if (sessionId) body.session_id = sessionId;
  if (videoType) body.video_type = videoType;

  const response = await fetch(`${API_BASE}/api/analyze/video/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error('Failed to start streaming analysis');
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          yield data;
        } catch (e) {
          console.error('Failed to parse SSE data:', e);
        }
      }
    }
  }
}
