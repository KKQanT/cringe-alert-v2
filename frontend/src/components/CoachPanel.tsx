import React, { useState, useRef, useCallback, useEffect } from 'react';
import { LiveClient } from '../services/LiveClient';
import { useAnalysisStore } from '../stores/useAnalysisStore';
import { useAppStore } from '../stores/useAppStore';

interface CoachPanelProps {
  onSeekTo?: (timestamp: number) => void;
}

interface ChatMessage {
  role: 'coach' | 'user' | 'system';
  content: string;
  timestamp: Date;
}

export const CoachPanel: React.FC<CoachPanelProps> = ({ onSeekTo }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);

  const clientRef = useRef<LiveClient | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { currentAnalysis } = useAnalysisStore();
  const { openRecorder } = useAppStore();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = useCallback((role: ChatMessage['role'], content: string) => {
    setMessages(prev => [...prev, { role, content, timestamp: new Date() }]);
  }, []);

  const handleToolCall = useCallback((name: string, args: Record<string, unknown>) => {
    console.log('Tool call:', name, args);

    switch (name) {
      case 'open_recorder':
        addMessage('system', `🎬 Opening recorder${args.focus_hint ? `: "${args.focus_hint}"` : ''}`);
        openRecorder();
        break;

      case 'seek_video':
        const timestamp = args.timestamp_seconds as number;
        addMessage('system', `⏩ Jumping to ${Math.floor(timestamp / 60)}:${String(Math.floor(timestamp % 60)).padStart(2, '0')}`);
        onSeekTo?.(timestamp);
        break;

      case 'start_countdown':
        const seconds = (args.seconds as number) || 3;
        addMessage('system', `⏱️ Starting countdown...`);
        startCountdown(seconds);
        break;
    }
  }, [addMessage, openRecorder, onSeekTo]);

  const startCountdown = (seconds: number) => {
    setCountdown(seconds);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const connect = useCallback(async () => {
    if (clientRef.current) return;

    const client = new LiveClient({
      onConnected: () => {
        setIsConnected(true);
        addMessage('system', '🎙️ Coach connected!');
      },
      onDisconnected: () => {
        setIsConnected(false);
        setIsListening(false);
        addMessage('system', '📴 Coach disconnected');
      },
      onText: (text) => {
        addMessage('coach', text);
      },
      onToolCall: handleToolCall,
      onError: (error) => {
        addMessage('system', `❌ Error: ${error}`);
      }
    });

    clientRef.current = client;

    try {
      await client.connect();

      // Send analysis context if available
      if (currentAnalysis) {
        client.sendContext(currentAnalysis);
      }
    } catch (e) {
      console.error('Failed to connect:', e);
      addMessage('system', '❌ Failed to connect to coach');
    }
  }, [addMessage, handleToolCall, currentAnalysis]);

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    setIsConnected(false);
    setIsListening(false);
  }, []);

  const toggleMicrophone = useCallback(async () => {
    if (!clientRef.current || !isConnected) return;

    if (isListening) {
      clientRef.current.stopMicrophone();
      setIsListening(false);
    } else {
      try {
        await clientRef.current.startMicrophone();
        setIsListening(true);
      } catch (e) {
        console.error('Failed to start microphone:', e);
        addMessage('system', '❌ Failed to access microphone');
      }
    }
  }, [isConnected, isListening, addMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
      }
    };
  }, []);

  return (
    <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-white/5 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">🎙️</span>
        <h2 className="font-semibold text-lg">Coach</h2>
        <span className="text-xs text-gray-400 ml-auto">Gemini 2.5 Live</span>

        {/* Connection indicator */}
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-500'}`} />
      </div>

      {/* Countdown Overlay */}
      {countdown !== null && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 rounded-xl">
          <div className="text-8xl font-bold text-white animate-pulse">
            {countdown}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 min-h-[200px]">
        {messages.length === 0 && !isConnected && (
          <p className="text-sm text-gray-400 text-center py-8">
            Click "Start Session" to talk with your coach!
          </p>
        )}

        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2 ${msg.role === 'coach'
                  ? 'bg-gradient-to-r from-purple-600/30 to-pink-600/30 text-white'
                  : msg.role === 'user'
                    ? 'bg-blue-600/30 text-white'
                    : 'bg-gray-600/30 text-gray-300 text-sm italic'
                }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        {!isConnected ? (
          <button
            onClick={connect}
            className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 py-3 rounded-xl font-semibold transition"
          >
            🎙️ Start Session
          </button>
        ) : (
          <>
            <button
              onClick={toggleMicrophone}
              className={`flex-1 px-4 py-3 rounded-xl font-semibold transition ${isListening
                  ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                  : 'bg-gray-600 hover:bg-gray-700 text-white'
                }`}
            >
              {isListening ? '🔴 Listening...' : '🎤 Hold to Talk'}
            </button>
            <button
              onClick={disconnect}
              className="px-4 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white transition"
            >
              ✕
            </button>
          </>
        )}
      </div>
    </div>
  );
};
