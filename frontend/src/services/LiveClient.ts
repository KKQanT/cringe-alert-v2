/**
 * LiveClient - WebSocket client for real-time coaching with Gemini 2.5 Live
 * 
 * Handles:
 * - WebSocket connection to backend
 * - Audio capture from microphone (PCM 16kHz)
 * - Audio playback (PCM 24kHz)
 * - Tool call execution
 */

export interface LiveClientCallbacks {
  onConnected: () => void;
  onDisconnected: () => void;
  onText: (text: string) => void;
  onToolCall: (name: string, args: Record<string, unknown>) => void;
  onError: (error: string) => void;
}

export class LiveClient {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private audioWorklet: AudioWorkletNode | null = null;
  private isConnected = false;
  private callbacks: LiveClientCallbacks;

  // Audio playback
  private playbackQueue: Float32Array[] = [];
  private isPlaying = false;

  constructor(callbacks: LiveClientCallbacks) {
    this.callbacks = callbacks;
  }

  async connect(): Promise<void> {
    const wsUrl = `ws://localhost:8000/ws/coach`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('LiveClient: WebSocket connected');
    };

    this.ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        await this.handleMessage(data);
      } catch (e) {
        console.error('LiveClient: Failed to parse message', e);
      }
    };

    this.ws.onclose = () => {
      console.log('LiveClient: WebSocket disconnected');
      this.isConnected = false;
      this.callbacks.onDisconnected();
    };

    this.ws.onerror = (error) => {
      console.error('LiveClient: WebSocket error', error);
      this.callbacks.onError('WebSocket connection failed');
    };
  }

  private async handleMessage(data: { type: string;[key: string]: unknown }) {
    switch (data.type) {
      case 'connected':
        this.isConnected = true;
        this.callbacks.onConnected();
        break;

      case 'text':
        this.callbacks.onText(data.content as string);
        break;

      case 'audio':
        await this.playAudio(data.data as string);
        break;

      case 'tool_call':
        this.callbacks.onToolCall(data.name as string, data.args as Record<string, unknown>);
        break;

      case 'error':
        this.callbacks.onError(data.message as string);
        break;
    }
  }

  async startMicrophone(): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Not connected to server');
    }

    try {
      // Get microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      // Create audio context
      this.audioContext = new AudioContext({ sampleRate: 16000 });

      // Load audio worklet for processing
      await this.audioContext.audioWorklet.addModule(
        URL.createObjectURL(new Blob([AUDIO_PROCESSOR_CODE], { type: 'application/javascript' }))
      );

      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.audioWorklet = new AudioWorkletNode(this.audioContext, 'audio-processor');

      // Handle audio data from worklet
      this.audioWorklet.port.onmessage = (event) => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          const pcmData = event.data as Int16Array;
          const base64 = this.int16ArrayToBase64(pcmData);
          this.ws.send(JSON.stringify({ type: 'audio', data: base64 }));
        }
      };

      source.connect(this.audioWorklet);
      console.log('LiveClient: Microphone started');

    } catch (e) {
      console.error('LiveClient: Failed to start microphone', e);
      throw e;
    }
  }

  stopMicrophone(): void {
    if (this.audioWorklet) {
      this.audioWorklet.disconnect();
      this.audioWorklet = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    console.log('LiveClient: Microphone stopped');
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

  disconnect(): void {
    this.stopMicrophone();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  private async playAudio(base64Data: string): Promise<void> {
    try {
      // Decode base64 to Int16Array
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const int16Data = new Int16Array(bytes.buffer);

      // Convert to Float32 for Web Audio
      const float32Data = new Float32Array(int16Data.length);
      for (let i = 0; i < int16Data.length; i++) {
        float32Data[i] = int16Data[i] / 32768.0;
      }

      // Queue for playback
      this.playbackQueue.push(float32Data);

      if (!this.isPlaying) {
        await this.processPlaybackQueue();
      }
    } catch (e) {
      console.error('LiveClient: Failed to play audio', e);
    }
  }

  private async processPlaybackQueue(): Promise<void> {
    if (this.playbackQueue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const playbackContext = new AudioContext({ sampleRate: 24000 });

    while (this.playbackQueue.length > 0) {
      const data = this.playbackQueue.shift()!;
      const buffer = playbackContext.createBuffer(1, data.length, 24000);
      // Create a new Float32Array with ArrayBuffer to satisfy TypeScript
      const channelData = new Float32Array(data);
      buffer.copyToChannel(channelData, 0);

      const source = playbackContext.createBufferSource();
      source.buffer = buffer;
      source.connect(playbackContext.destination);
      source.start();

      // Wait for playback to complete
      await new Promise(resolve => setTimeout(resolve, (data.length / 24000) * 1000));
    }

    playbackContext.close();
    this.isPlaying = false;
  }

  private int16ArrayToBase64(data: Int16Array): string {
    const bytes = new Uint8Array(data.buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

// Audio Worklet processor code (inline)
const AUDIO_PROCESSOR_CODE = `
class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(0);
    this.CHUNK_SIZE = 1024;
  }
  
  process(inputs) {
    const input = inputs[0];
    if (input && input[0]) {
      // Append new samples to buffer
      const newBuffer = new Float32Array(this.buffer.length + input[0].length);
      newBuffer.set(this.buffer);
      newBuffer.set(input[0], this.buffer.length);
      this.buffer = newBuffer;
      
      // Process in chunks
      while (this.buffer.length >= this.CHUNK_SIZE) {
        const chunk = this.buffer.slice(0, this.CHUNK_SIZE);
        this.buffer = this.buffer.slice(this.CHUNK_SIZE);
        
        // Convert Float32 to Int16
        const int16Data = new Int16Array(chunk.length);
        for (let i = 0; i < chunk.length; i++) {
          const s = Math.max(-1, Math.min(1, chunk[i]));
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        this.port.postMessage(int16Data);
      }
    }
    return true;
  }
}
registerProcessor('audio-processor', AudioProcessor);
`;
