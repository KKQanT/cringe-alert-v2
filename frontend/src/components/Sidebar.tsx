import { useState } from 'react';
import { Siren, LayoutDashboard, Activity, Clock, Settings, UserCircle, ChevronRight } from 'lucide-react';

type NavItemProp = {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  hasSubmenu?: boolean;
};

const NavItem = ({ icon, label, active, hasSubmenu }: NavItemProp) => (
  <div
    className={`
      flex items-center justify-between px-4 py-3 rounded-xl transition-all cursor-pointer group
      ${active
        ? 'bg-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary-glow)]'
        : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)] hover:text-white'
      }
    `}
  >
    <div className="flex items-center gap-3">
      <div className={`${active ? 'text-white' : 'text-[var(--color-text-muted)] group-hover:text-white transition-colors'}`}>
        {icon}
      </div>
      <span className="font-medium text-sm">{label}</span>
    </div>
    {hasSubmenu && (
      <ChevronRight className="w-4 h-4 opacity-50" />
    )}
  </div>
);

export function Sidebar() {
  const [activeItem] = useState('Home');

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
      <nav className="flex-1 space-y-2">
        <div className="mb-2 px-4 text-xs font-bold text-[var(--color-text-dim)] uppercase tracking-wider">Menu</div>

        <NavItem
          icon={<LayoutDashboard className="w-5 h-5" />}
          label="Home"
          active={activeItem === 'Home'}
        />

        <NavItem
          icon={<Activity className="w-5 h-5" />}
          label="Analysis"
          hasSubmenu
        />

        <NavItem
          icon={<Clock className="w-5 h-5" />}
          label="History"
        />

        <div className="pt-6 mb-2 px-4 text-xs font-bold text-[var(--color-text-dim)] uppercase tracking-wider">Settings</div>

        <NavItem
          icon={<Settings className="w-5 h-5" />}
          label="Configurations"
        />
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
