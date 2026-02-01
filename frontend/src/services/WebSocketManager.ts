import { useAnalysisStore } from '../stores/useAnalysisStore';
import { useHostStore } from '../stores/useHostStore';
import { useLyricsStore } from '../stores/useLyricsStore';
import { useAppStore } from '../stores/useAppStore';

class WebSocketManager {
  private ws: WebSocket | null = null;
  private static instance: WebSocketManager;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  static getInstance() {
    if (!this.instance) {
      this.instance = new WebSocketManager();
    }
    return this.instance;
  }

  connect(sessionId: string) {
    const wsUrl = `${import.meta.env.VITE_WS_URL || 'ws://localhost:8000'}/ws/${sessionId}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      useAppStore.getState().setConnected(true);
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // Route to correct store based on source
      if (data.source === 'analyst') {
        this.handleAnalystMessage(data);
      } else if (data.source === 'host') {
        this.handleHostMessage(data);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket closed');
      useAppStore.getState().setConnected(false);
      this.attemptReconnect(sessionId);
    };
  }

  private attemptReconnect(sessionId: string) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      setTimeout(() => this.connect(sessionId), 2000 * this.reconnectAttempts);
    }
  }

  private handleAnalystMessage(data: any) {
    const store = useAnalysisStore.getState();

    switch (data.type) {
      case 'thinking':
        store.addThinking(data.content);
        break;
      case 'tool_call':
        if (data.tool === 'update_timeline_marker') {
          store.addMarker(data.params);
        } else if (data.tool === 'display_feedback') {
          store.addFeedback(data.params);
        } else if (data.tool === 'update_cringe_score') {
          store.setScore(data.params.score);
        } else if (data.tool === 'set_verdict') {
          store.setVerdict(data.params.verdict);
        } else if (data.tool === 'set_lyrics') {
          // Route to lyrics store
          const lyricsStore = useLyricsStore.getState();
          lyricsStore.setLyrics(data.params.lyrics, data.params.source);
        } else if (data.tool === 'request_lyrics_input') {
          // Host asks user to paste lyrics
          const lyricsStore = useLyricsStore.getState();
          lyricsStore.requestManualInput();
        } else if (data.tool === 'highlight_lyrics') {
          // Sync lyrics with video timestamp
          const lyricsStore = useLyricsStore.getState();
          lyricsStore.setCurrentIndex(data.params.index);
        }
        break;
      case 'complete':
        store.setComplete();
        break;
    }
  }

  private handleHostMessage(data: any) {
    const store = useHostStore.getState();

    switch (data.type) {
      case 'text':
        store.addMessage(data.content);
        break;
      case 'audio':
        store.queueAudio(data.audioData);
        break;
    }
  }

  send(message: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }
}

export const wsManager = WebSocketManager.getInstance();
