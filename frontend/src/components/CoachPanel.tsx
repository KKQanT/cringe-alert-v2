import React, { useState, useRef, useCallback, useEffect } from 'react';
import { LiveClient } from '../services/LiveClient';
import { useAnalysisStore } from '../stores/useAnalysisStore';
import { useSessionStore } from '../stores/useSessionStore';

interface CoachPanelProps {
  onSeekTo?: (timestamp: number, whichVideo?: 'original' | 'latest') => void;
  onShowOriginal?: () => void;
  onRecordFinal?: () => void;
}

interface ChatMessage {
  role: 'coach' | 'user' | 'system';
  content: string;
  timestamp: Date;
}

export const CoachPanel: React.FC<CoachPanelProps> = ({ onSeekTo, onShowOriginal, onRecordFinal }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);

  const clientRef = useRef<LiveClient | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { currentAnalysis } = useAnalysisStore();
  const { openRecorder } = useSessionStore();

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
      case 'start_practice': {
        const focusHint = args.focus_hint as string | undefined;
        const sectionStart = args.section_start as number | undefined;
        const sectionEnd = args.section_end as number | undefined;
        addMessage('system', `🎬 Starting practice${focusHint ? `: "${focusHint}"` : ''}`);
        // Countdown then open recorder
        startCountdown(3, () => {
          openRecorder(focusHint, sectionStart, sectionEnd);
        });
        break;
      }

      case 'seek_video': {
        const timestamp = args.timestamp_seconds as number;
        const whichVideo = (args.which_video as string) || 'latest';
        addMessage('system', `⏩ Jumping to ${Math.floor(timestamp / 60)}:${String(Math.floor(timestamp % 60)).padStart(2, '0')} (${whichVideo})`);
        onSeekTo?.(timestamp, whichVideo as 'original' | 'latest');
        break;
      }

      case 'show_original': {
        addMessage('system', `📹 Switching to original video`);
        onShowOriginal?.();
        break;
      }

      case 'record_final': {
        const confirmationMessage = args.confirmation_message as string | undefined;
        addMessage('system', `🎤 ${confirmationMessage || 'Time for your final take!'}`);
        // Countdown then open recorder for final
        startCountdown(3, () => {
          onRecordFinal?.();
        });
        break;
      }
    }
  }, [addMessage, openRecorder, onSeekTo, onShowOriginal, onRecordFinal]);

  const startCountdown = (seconds: number, onComplete?: () => void) => {
    setCountdown(seconds);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          onComplete?.();
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
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 min-h-[200px] max-h-[calc(100vh-24rem)]">
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
