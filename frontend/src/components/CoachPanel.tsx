import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ChatClient } from '../services/LiveClient';
import { useAnalysisStore } from '../stores/useAnalysisStore';
import { useSessionStore } from '../stores/useSessionStore';
import { MessageSquare, Send, Wifi, WifiOff, Info } from 'lucide-react';

interface CoachPanelProps {
  onSeekTo?: (timestamp: number, whichVideo?: 'original' | 'latest') => void;
  onShowOriginal?: () => void;
  onRecordFinal?: () => void;
  onSwitchTab?: (tab: 'original' | 'practice' | 'final') => void;
  onHighlightFeedback?: (index: number) => void;
  onOpenFixModal?: (index: number) => void;
}

interface ChatMessage {
  role: 'coach' | 'user' | 'system';
  content: string;
  timestamp: Date;
}

export const CoachPanel: React.FC<CoachPanelProps> = ({ onSeekTo, onShowOriginal, onRecordFinal, onSwitchTab, onHighlightFeedback, onOpenFixModal }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);

  const clientRef = useRef<ChatClient | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { currentAnalysis } = useAnalysisStore();
  const { openRecorder, sessionId } = useSessionStore();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when connected
  useEffect(() => {
    if (isConnected) {
      inputRef.current?.focus();
    }
  }, [isConnected]);

  const addMessage = useCallback((role: ChatMessage['role'], content: string) => {
    setMessages(prev => [...prev, { role, content, timestamp: new Date() }]);
  }, []);

  // Accumulate streamed text into the last coach message
  const appendToLastCoachMessage = useCallback((text: string) => {
    setMessages(prev => {
      const last = prev[prev.length - 1];
      if (last && last.role === 'coach') {
        return [...prev.slice(0, -1), { ...last, content: last.content + text }];
      }
      return [...prev, { role: 'coach', content: text, timestamp: new Date() }];
    });
  }, []);

  const handleToolCall = useCallback((name: string, args: Record<string, unknown>) => {
    console.log('Tool call:', name, args);

    // Send tool result back to model
    const sendResult = (result: Record<string, unknown> = { status: 'ok' }) => {
      clientRef.current?.sendToolResult(name, result);
    };

    switch (name) {
      case 'open_feedback_modal': {
        const feedbackIndex = (args.index as number) ?? 0;
        addMessage('system', `Opening fix modal for feedback item ${feedbackIndex + 1}`);
        onOpenFixModal?.(feedbackIndex);
        sendResult();
        break;
      }

      case 'seek_video': {
        const timestamp = args.timestamp_seconds as number ?? 0;
        const whichVideo = (args.which_video as string) || 'latest';

        if (typeof timestamp === 'number' && Number.isFinite(timestamp) && timestamp >= 0) {
          addMessage('system', `Jumping to ${Math.floor(timestamp / 60)}:${String(Math.floor(timestamp % 60)).padStart(2, '0')} (${whichVideo})`);
          onSeekTo?.(timestamp, whichVideo as 'original' | 'latest');
          sendResult();
        } else {
          console.warn('seek_video called with invalid timestamp:', args);
          addMessage('system', `Coach wants to seek but no valid timestamp provided`);
          sendResult({ status: 'error', message: 'invalid timestamp' });
        }
        break;
      }

      case 'show_original': {
        addMessage('system', `Switching to original video`);
        onShowOriginal?.();
        sendResult();
        break;
      }

      case 'record_final': {
        const confirmationMessage = args.confirmation_message as string | undefined;
        addMessage('system', `${confirmationMessage || 'Time for your final take!'}`);
        startCountdown(3, () => {
          onRecordFinal?.();
        });
        sendResult();
        break;
      }

      case 'show_feedback_card': {
        const feedbackIndex = (args.index as number) ?? 0;
        addMessage('system', `Highlighting feedback item ${feedbackIndex + 1}`);
        onHighlightFeedback?.(feedbackIndex);
        sendResult();
        break;
      }

      case 'switch_tab': {
        const tab = (args.tab as string) ?? 'original';
        if (['original', 'practice', 'final'].includes(tab)) {
          addMessage('system', `Switching to ${tab} tab`);
          onSwitchTab?.(tab as 'original' | 'practice' | 'final');
          sendResult();
        }
        break;
      }
    }
  }, [addMessage, openRecorder, onSeekTo, onShowOriginal, onRecordFinal, onSwitchTab, onHighlightFeedback, onOpenFixModal]);

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

    const client = new ChatClient({
      onConnected: () => {
        setIsConnected(true);
        addMessage('system', 'Coach connected!');
      },
      onDisconnected: () => {
        setIsConnected(false);
        addMessage('system', 'Coach disconnected');
      },
      onText: (text) => {
        appendToLastCoachMessage(text);
      },
      onToolCall: handleToolCall,
      onError: (error) => {
        addMessage('system', `Error: ${error}`);
      }
    });

    clientRef.current = client;

    try {
      await client.connect(sessionId ?? undefined);

      // Send analysis context if available
      if (currentAnalysis) {
        client.sendContext(currentAnalysis);
      }
    } catch (e) {
      console.error('Failed to connect:', e);
      addMessage('system', 'Failed to connect to coach');
    }
  }, [addMessage, appendToLastCoachMessage, handleToolCall, currentAnalysis, sessionId]);

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const sendMessage = useCallback(() => {
    const text = inputText.trim();
    if (!text || !clientRef.current || !isConnected) return;

    addMessage('user', text);
    clientRef.current.sendText(text);
    setInputText('');
  }, [inputText, isConnected, addMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  // Auto-connect when analysis completes (proactive coach)
  const prevAnalysisRef = useRef<typeof currentAnalysis>(null);
  useEffect(() => {
    if (currentAnalysis && !prevAnalysisRef.current && !isConnected && !clientRef.current) {
      // Analysis just appeared, auto-connect
      connect();
    }
    prevAnalysisRef.current = currentAnalysis;
  }, [currentAnalysis, isConnected, connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Header - HIDDEN in favor of Parent Header */}
      <div className="hidden items-center gap-2 mb-4">
        <MessageSquare className="w-5 h-5 text-[var(--color-primary)]" />
        <h2 className="font-semibold text-lg">Coach</h2>
        <span className="text-xs text-gray-400 ml-auto">Gemini 3 Flash</span>
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-500'}`} />
      </div>

      {/* Connection Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-white/5">
        <span className="text-xs font-medium text-[var(--color-text-muted)]">STATUS</span>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Wifi className="w-3 h-3 text-[var(--color-success)]" />
          ) : (
            <WifiOff className="w-3 h-3 text-[var(--color-text-dim)]" />
          )}
          <span className={`text-xs ${isConnected ? 'text-[var(--color-success)]' : 'text-[var(--color-text-dim)]'}`}>
            {isConnected ? 'LIVE' : 'OFFLINE'}
          </span>
          <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-[var(--color-success)] animate-pulse' : 'bg-[var(--color-text-dim)]'}`} />
        </div>
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
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 p-6 custom-scrollbar">
        {messages.length === 0 && !isConnected && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8 opacity-50">
            <MessageSquare className="w-12 h-12 mb-3 text-[var(--color-primary)]" />
            <p className="text-sm text-gray-400">
              Click "Start Session" to chat with your coach!
            </p>
          </div>
        )}

        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-5 py-3 shadow-sm ${msg.role === 'coach'
                ? 'bg-[var(--color-primary)]/10 text-white border border-[var(--color-primary)]/20 shadow-[0_4px_20px_rgba(6,182,212,0.1)]'
                : msg.role === 'user'
                  ? 'bg-[var(--color-surface-elevated)] text-white border border-[var(--color-border)]'
                  : 'bg-[var(--color-surface-mid)] text-[var(--color-text-dim)] text-sm italic flex items-center gap-2 border border-[var(--color-border)]'
                }`}
            >
              {msg.role === 'system' && <Info className="w-4 h-4 inline-block mr-2 opacity-70" />}
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Controls */}
      <div className="flex gap-3 px-6 pb-6 mt-auto">
        {!isConnected ? (
          <button
            onClick={connect}
            className="flex-1 bg-gradient-to-r from-[var(--color-primary)] to-[#0891b2] hover:shadow-[0_0_20px_var(--color-primary-glow)] text-white px-4 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 transform hover:-translate-y-0.5"
          >
            <MessageSquare className="w-5 h-5" /> Start Session
          </button>
        ) : (
          <>
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="flex-1 bg-[var(--color-surface-elevated)] text-white px-4 py-3 rounded-xl border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-primary)] placeholder:text-[var(--color-text-dim)]"
            />
            <button
              onClick={sendMessage}
              disabled={!inputText.trim()}
              className="px-4 py-3 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/80 text-white transition font-medium disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
            <button
              onClick={disconnect}
              className="px-4 py-3 rounded-xl bg-[var(--color-surface-elevated)] hover:bg-red-500/20 text-[var(--color-text-muted)] hover:text-red-500 border border-[var(--color-border)] hover:border-red-500/50 transition font-medium"
            >
              End
            </button>
          </>
        )}
      </div>
    </div>
  );
};
