import { Siren, LayoutDashboard, Clock, UserCircle, Plus, Film, Trophy } from 'lucide-react';
import type { SessionSummary } from '../services/api';

interface SidebarProps {
  sessions: SessionSummary[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return null;
  const color = score > 80 ? 'text-red-400 bg-red-500/10' : score > 50 ? 'text-yellow-400 bg-yellow-500/10' : 'text-green-400 bg-green-500/10';
  return (
    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${color}`}>
      {score}
    </span>
  );
}

export function Sidebar({ sessions, activeSessionId, onSelectSession, onNewSession }: SidebarProps) {
  return (
    <aside className="w-64 h-screen sticky top-0 bg-[var(--color-surface-base)] border-r border-[var(--color-border)] flex flex-col p-6 overflow-y-auto z-50">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10 px-2">
        <div className="w-10 h-10 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] rounded-xl flex items-center justify-center shadow-lg shadow-[var(--color-primary-glow)]">
          <Siren className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-lg tracking-tight text-white">Cringe Alert</h1>
          <p className="text-[10px] text-[var(--color-secondary)] font-semibold tracking-wider uppercase">Analyst V2</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col space-y-2 min-h-0">
        <div className="mb-2 px-4 text-xs font-bold text-[var(--color-text-dim)] uppercase tracking-wider">Menu</div>

        {/* Home / New Session */}
        <div
          onClick={onNewSession}
          className="flex items-center justify-between px-4 py-3 rounded-xl transition-all cursor-pointer group text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)] hover:text-white"
        >
          <div className="flex items-center gap-3">
            <LayoutDashboard className="w-5 h-5" />
            <span className="font-medium text-sm">New Session</span>
          </div>
          <Plus className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* History Section */}
        <div className="pt-4 mb-2 px-4 text-xs font-bold text-[var(--color-text-dim)] uppercase tracking-wider flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" />
          History
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar min-h-0">
          {sessions.length === 0 && (
            <div className="px-4 py-3 text-xs text-[var(--color-text-dim)]">
              No sessions yet. Upload a video to get started.
            </div>
          )}
          {sessions.map((session) => {
            const isActive = session.session_id === activeSessionId;
            return (
              <div
                key={session.session_id}
                onClick={() => onSelectSession(session.session_id)}
                className={`
                  px-4 py-3 rounded-xl transition-all cursor-pointer group
                  ${isActive
                    ? 'bg-[var(--color-primary)]/15 border border-[var(--color-primary)]/30 text-white'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)] hover:text-white'
                  }
                `}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Film className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="text-sm font-medium truncate">
                      {formatDate(session.created_at)}
                    </span>
                  </div>
                  <ScoreBadge score={session.original_score} />
                </div>
                <div className="flex items-center gap-2 pl-5.5 text-xs text-[var(--color-text-dim)]">
                  {session.has_original && (
                    <span className="flex items-center gap-1">
                      Original
                    </span>
                  )}
                  {session.practice_clip_count > 0 && (
                    <span>+{session.practice_clip_count} clips</span>
                  )}
                  {session.has_final && (
                    <span className="flex items-center gap-1">
                      <Trophy className="w-3 h-3 text-[var(--color-secondary)]" />
                      Final
                    </span>
                  )}
                  {session.improvement != null && (
                    <span className={session.improvement > 0 ? 'text-green-400' : 'text-red-400'}>
                      {session.improvement > 0 ? '+' : ''}{session.improvement}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </nav>

      {/* User / Help Section */}
      <div className="mt-auto border-t border-[var(--color-border)] pt-6">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-full bg-[var(--color-surface-mid)] border border-[var(--color-border)] flex items-center justify-center overflow-hidden">
            <UserCircle className="w-full h-full text-[var(--color-text-dim)]" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Hackathon Judge</div>
            <div className="text-xs text-[var(--color-text-dim)]">Trial User</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
