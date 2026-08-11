import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar, MobileSidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { SystemProvider } from '@/context/SystemContext';
import { cn } from '@/lib/utils';

const COLLAPSE_KEY = 'arsamba.nav.collapsed';

/**
 * AppLayout — fixed rail + sticky topbar + scrolling content column.
 *
 * The rail collapse preference is remembered because on a laptop at a client
 * site the extra 190px of table width matters, and re-collapsing on every
 * visit would be tedious.
 */
export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch { /* private mode */ }
  }, [collapsed]);

  // Close the drawer on navigation and lock body scroll while it's open.
  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  // Escape closes the drawer
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  return (
    <SystemProvider>
      <div className="min-h-screen">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
        <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />

        <div
          className={cn(
            'flex min-h-screen flex-col transition-[padding] duration-300 ease-out',
            collapsed ? 'lg:pl-[76px]' : 'lg:pl-[264px]',
          )}
        >
          <Topbar onOpenNav={() => setMobileOpen(true)} />

          <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            <div className="mx-auto w-full max-w-[1440px]">
              <Outlet />
            </div>
          </main>

          <footer className="border-t border-line/60 px-4 py-4 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-2 text-2xs text-ink-ghost sm:flex-row">
              <span>AR Samba — Samba share &amp; ACL management</span>
              <span className="font-mono">marsh4200/ar-samba</span>
            </div>
          </footer>
        </div>
      </div>
    </SystemProvider>
  );
}
