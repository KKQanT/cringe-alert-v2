/**
 * ChatClient - Text-only WebSocket client for coaching with Gemini 3 Flash
 *
 * Handles:
 * - WebSocket connection to backend
 * - Sending/receiving text messages
 * - Tool call dispatching
 * - Tool result responses
 */

export interface ChatClientCallbacks {
  onConnected: () => void;
  onDisconnected: () => void;
  onText: (text: string) => void;
  onToolCall: (name: string, args: Record<string, unknown>) => void;
  onError: (error: string) => void;
}

export class ChatClient {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private callbacks: ChatClientCallbacks;

  constructor(callbacks: ChatClientCallbacks) {
    this.callbacks = callbacks;
  }

  async connect(sessionId?: string): Promise<void> {
    const baseUrl = `ws://localhost:8000/ws/coach`;
    const wsUrl = sessionId
      ? `${baseUrl}?session_id=${encodeURIComponent(sessionId)}`
      : baseUrl;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('ChatClient: WebSocket connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (e) {
        console.error('ChatClient: Failed to parse message', e);
      }
    };

    this.ws.onclose = () => {
      console.log('ChatClient: WebSocket disconnected');
      this.isConnected = false;
      this.callbacks.onDisconnected();
    };

    this.ws.onerror = (error) => {
      console.error('ChatClient: WebSocket error', error);
      this.callbacks.onError('WebSocket connection failed');
    };
  }

  private handleMessage(data: { type: string; [key: string]: unknown }) {
    switch (data.type) {
      case 'connected':
        this.isConnected = true;
        this.callbacks.onConnected();
        break;

      case 'text':
        this.callbacks.onText(data.content as string);
        break;

      case 'tool_call':
        this.callbacks.onToolCall(
          data.name as string,
          data.args as Record<string, unknown>
        );
        break;

      case 'error':
        this.callbacks.onError(data.message as string);
        break;
    }
  }

  sendText(text: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'text', content: text }));
    }
  }

  sendContext(analysis: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'context', analysis }));
    }
  }

  sendToolResult(name: string, result: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'tool_result', name, result }));
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}
