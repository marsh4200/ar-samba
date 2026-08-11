import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, FolderTree, Users, ScrollText, Settings,
  PanelLeftClose, PanelLeftOpen, X, Cpu, MemoryStick,
} from 'lucide-react';
import { BrandMark, Wordmark } from '@/components/brand/Logo';
import { StatusDot } from '@/components/ui/Badge';
import { useSystem } from '@/context/SystemContext';
import { cn } from '@/lib/utils';

/**
 * Nav is grouped by what the user is managing versus what they're observing —
 * the split mirrors how the work actually happens: you configure shares and
 * users, then you watch the log to confirm what changed.
 */
const NAV_GROUPS = [
  {
    label: 'Manage',
    items: [
      { to: '/',       label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/shares', label: 'Shares',    icon: FolderTree },
      { to: '/users',  label: 'Users',     icon: Users },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/logs',     label: 'Activity', icon: ScrollText },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

function NavItem({ item, collapsed, onNavigate }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium',
          'transition-all duration-200 ease-out',
          collapsed && 'justify-center px-0',
          isActive
            ? 'bg-signal-500/12 text-signal-300'
            : 'text-ink-muted hover:bg-raised hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* Active edge marker — a lit rail rather than a filled pill */}
          <span
            className={cn(
              'absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-signal-400 transition-all duration-200',
              isActive ? 'opacity-100' : 'opacity-0',
            )}
          />
          <Icon
            className={cn(
              'h-[18px] w-[18px] shrink-0 transition-colors',
              isActive ? 'text-signal-400' : 'text-ink-faint group-hover:text-ink-muted',
            )}
          />
          {!collapsed && <span className="truncate">{item.label}</span>}
        </>
      )}
    </NavLink>
  );
}

/** Compact live CPU/RAM readout pinned to the bottom of the rail. */
function SystemRail({ collapsed }) {
  const { metrics, metricsSupported, smbActive, version } = useSystem();

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-3 border-t border-line/60 px-2 py-4">
        <StatusDot tone={smbActive ? 'ok' : 'crit'} pulse={smbActive} />
        {version && <div className="font-mono text-[9px] text-ink-ghost">{version}</div>}
      </div>
    );
  }

  const rows = metricsSupported && metrics
    ? [
        { icon: Cpu,         label: 'CPU', value: metrics.cpu_percent },
        { icon: MemoryStick, label: 'RAM', value: metrics.memory_percent },
      ]
    : [];

  return (
    <div className="border-t border-line/60 px-3 py-4">
      {rows.length > 0 && (
        <div className="mb-4 space-y-2.5">
          {rows.map((r) => {
            const v = Math.max(0, Math.min(100, Number(r.value) || 0));
            const tone = v >= 90 ? 'bg-crit' : v >= 75 ? 'bg-warn' : 'bg-signal-400';
            const Icon = r.icon;
            return (
              <div key={r.label} className="flex items-center gap-2.5">
                <Icon className="h-3.5 w-3.5 shrink-0 text-ink-ghost" />
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-abyss">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700 ease-out', tone)}
                    style={{ width: `${v}%` }}
                  />
                </div>
                <span className="w-8 text-right font-mono text-[10px] text-ink-faint tnum">
                  {Math.round(v)}%
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[10px] text-ink-faint">
          <StatusDot tone={smbActive ? 'ok' : 'crit'} pulse={smbActive} />
          <span>{smbActive ? 'Samba running' : 'Samba stopped'}</span>
        </div>
        {version && (
          <span className="font-mono text-[10px] text-ink-ghost">v{version}</span>
        )}
      </div>
    </div>
  );
}

function SidebarInner({ collapsed, onToggle, onNavigate, onCloseMobile, isMobile }) {
  return (
    <div className="flex h-full flex-col bg-hull">
      {/* Brand */}
      <div
        className={cn(
          'flex h-16 shrink-0 items-center gap-3 border-b border-line/60 px-4',
          collapsed && 'justify-center px-0',
        )}
      >
        <BrandMark size={collapsed ? 32 : 34} />
        {!collapsed && <Wordmark />}

        {isMobile && (
          <button
            onClick={onCloseMobile}
            aria-label="Close navigation"
            className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-raised hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label} className={cn(gi > 0 && 'mt-6')}>
            {!collapsed && <div className="mb-2 px-3 eyebrow">{group.label}</div>}
            {collapsed && gi > 0 && <div className="mx-auto mb-3 h-px w-6 bg-line" />}
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavItem
                  key={item.to}
                  item={item}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <SystemRail collapsed={collapsed} />

      {/* Collapse control — desktop only */}
      {!isMobile && (
        <button
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'flex items-center gap-2.5 border-t border-line/60 px-4 py-3 text-xs font-medium',
            'text-ink-ghost transition-colors hover:bg-raised hover:text-ink-muted',
            collapsed && 'justify-center px-0',
          )}
        >
          {collapsed
            ? <PanelLeftOpen className="h-4 w-4" />
            : <><PanelLeftClose className="h-4 w-4" /> Collapse</>}
        </button>
      )}
    </div>
  );
}

export function Sidebar({ collapsed, onToggle }) {
  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 hidden border-r border-line/60 transition-[width] duration-300 ease-out lg:block',
        collapsed ? 'w-[76px]' : 'w-[264px]',
      )}
    >
      <SidebarInner collapsed={collapsed} onToggle={onToggle} />
    </aside>
  );
}

export function MobileSidebar({ open, onClose }) {
  return (
    <>
      <div
        onClick={onClose}
        aria-hidden={!open}
        className={cn(
          'fixed inset-0 z-40 bg-abyss/80 backdrop-blur-sm transition-opacity duration-300 lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[280px] border-r border-line/60 shadow-float',
          'transition-transform duration-300 ease-out lg:hidden',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <SidebarInner
          collapsed={false}
          isMobile
          onNavigate={onClose}
          onCloseMobile={onClose}
        />
      </aside>
    </>
  );
}
