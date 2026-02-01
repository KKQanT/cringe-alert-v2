// Analysis types
export interface Marker {
  id: string;
  timestamp: number;
  type: 'good' | 'cringe';
  reason: string;
}

export interface Feedback {
  id: string;
  timestamp: number;
  type: 'good' | 'cringe';
  message: string;
}

// Lyrics types
export interface LyricLine {
  index: number;
  timestamp: number;
  text: string;
  chord?: string;
}

// WebSocket message types
export interface AnalystMessage {
  source: 'analyst';
  type: 'thinking' | 'tool_call' | 'complete';
  content?: string;
  tool?: string;
  params?: Record<string, any>;
}

export interface HostMessage {
  source: 'host';
  type: 'text' | 'audio';
  content?: string;
  audioData?: string;
}

export type WebSocketMessage = AnalystMessage | HostMessage;

// Verdict types
export type Verdict = 'POST' | 'DONT_POST';
