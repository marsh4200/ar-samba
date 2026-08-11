import { useLocation, useNavigate } from 'react-router-dom';
import {
  Menu, LogOut, Settings, ChevronDown, ShieldCheck, HardDrive,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useSystem } from '@/context/SystemContext';
import { BrandMark } from '@/components/brand/Logo';
import { StatusDot } from '@/components/ui/Badge';
import {
  DropdownMenu, DropdownTrigger, DropdownContent, DropdownItem,
  DropdownLabel, DropdownSeparator,
} from '@/components/ui/DropdownMenu';
import { cn, initials, toneForName } from '@/lib/utils';

const TITLES = {
  '/':         'Dashboard',
  '/shares':   'Shares',
  '/users':    'Users',
  '/logs':     'Activity',
  '/settings': 'Settings',
};

export function Topbar({ onOpenNav }) {
  const { user, logout } = useAuth();
  const { smbActive, smbState, dashboard } = useSystem();
  const nav = useNavigate();
  const { pathname } = useLocation();

  const title = TITLES[pathname] || 'AR Samba';
  const storage = dashboard?.storage?.[0];

  function signOut() {
    logout();
    nav('/login', { replace: true });
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-line/60 px-4 sm:px-6',
        'bg-abyss/85 backdrop-blur-xl',
      )}
    >
      {/* Mobile: nav trigger + mark */}
      <button
        onClick={onOpenNav}
        aria-label="Open navigation"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-raised hover:text-ink lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      <BrandMark size={28} className="lg:hidden" />

      {/* Page title — the shell's only heading on mobile */}
      <h2 className="hidden truncate font-display text-sm font-semibold text-ink-muted lg:block">
        {title}
      </h2>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {/* Live capacity readout — visible on tablet up */}
        {storage && (
          <div className="hidden items-center gap-2 rounded-full border border-line bg-hull/80 px-3 py-1.5 md:flex">
            <HardDrive className="h-3.5 w-3.5 text-ink-faint" />
            <span className="font-mono text-2xs text-ink-muted tnum">
              {storage.percent.toFixed(0)}%
            </span>
            <span className="text-2xs text-ink-ghost">used</span>
          </div>
        )}

        {/* Samba service state */}
        <div
          className="flex items-center gap-2 rounded-full border border-line bg-hull/80 px-3 py-1.5"
          title={smbState ? `smbd — ${smbState}` : undefined}
        >
          <StatusDot tone={smbActive ? 'ok' : 'crit'} pulse={smbActive} />
          <span className="text-2xs font-medium text-ink-muted">
            <span className="hidden sm:inline">Samba </span>
            {smbActive ? 'online' : 'offline'}
          </span>
        </div>

        {/* Account menu */}
        <DropdownMenu>
          <DropdownTrigger asChild>
            <button
              className={cn(
                'flex items-center gap-2.5 rounded-xl border border-transparent py-1.5 pl-1.5 pr-2',
                'transition-colors hover:border-line hover:bg-raised',
                'data-[state=open]:border-line data-[state=open]:bg-raised',
              )}
            >
              <span
                className={cn(
                  'grid h-8 w-8 shrink-0 place-items-center rounded-lg border font-display text-2xs font-bold',
                  toneForName(user?.username),
                )}
              >
                {initials(user?.username)}
              </span>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-xs font-semibold text-ink">{user?.username}</span>
                <span className="block text-[10px] uppercase tracking-wider text-ink-ghost">
                  {user?.role}
                </span>
              </span>
              <ChevronDown className="hidden h-3.5 w-3.5 text-ink-ghost sm:block" />
            </button>
          </DropdownTrigger>

          <DropdownContent>
            <DropdownLabel>Signed in as</DropdownLabel>
            <div className="px-2.5 pb-2">
              <div className="font-mono text-xs text-ink">{user?.username}</div>
              {user?.email && (
                <div className="mt-0.5 truncate text-2xs text-ink-faint">{user.email}</div>
              )}
            </div>
            <DropdownSeparator />
            <DropdownItem icon={Settings} onSelect={() => nav('/settings')}>
              Settings
            </DropdownItem>
            <DropdownItem icon={ShieldCheck} onSelect={() => nav('/logs')}>
              Activity log
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem icon={LogOut} tone="danger" onSelect={signOut}>
              Sign out
            </DropdownItem>
          </DropdownContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
