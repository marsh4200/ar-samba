import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, FolderTree, ScrollText,
  Settings, LogOut, ShieldCheck, Server,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/',         label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/users',    label: 'Users',     icon: Users },
  { to: '/shares',   label: 'Shares',    icon: FolderTree },
  { to: '/logs',     label: 'Activity',  icon: ScrollText },
  { to: '/settings', label: 'Settings',  icon: Settings },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  return (
    <div className="min-h-screen flex bg-bg">
      {/* Sidebar */}
      <aside className="hidden md:flex md:w-64 flex-col bg-bg-soft border-r border-white/5">
        <div className="px-5 py-5 flex items-center gap-3 border-b border-white/5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-glass">
            <Server className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-semibold leading-tight">SambaControl</div>
            <div className="text-[10px] uppercase tracking-wider text-neutral-500">ar-samba</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((n) => {
            const Icon = n.icon;
            return (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                    isActive
                      ? 'bg-brand/15 text-brand-400 border border-brand/20'
                      : 'text-neutral-400 hover:text-neutral-100 hover:bg-white/5 border border-transparent',
                  )
                }
              >
                <Icon className="w-4 h-4" />
                {n.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="px-3 py-3 border-t border-white/5 text-xs text-neutral-500 flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-success" />
          <span>Secure session</span>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-white/5 bg-bg-soft/60 backdrop-blur-md flex items-center justify-between px-4 md:px-6 sticky top-0 z-30">
          <div className="md:hidden font-semibold flex items-center gap-2">
            <Server className="w-4 h-4 text-brand-400" />
            SambaControl
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-sm leading-tight">{user?.username}</div>
              <div className="text-[10px] uppercase tracking-wider text-neutral-500">{user?.role}</div>
            </div>
            <button
              onClick={() => { logout(); nav('/login', { replace: true }); }}
              className="btn-ghost"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-[1400px] w-full mx-auto">
          <Outlet />
        </main>

        <footer className="px-6 py-3 text-[11px] text-neutral-600 text-center border-t border-white/5">
          SambaControl · marsh4200/ar-samba
        </footer>
      </div>
    </div>
  );
}
