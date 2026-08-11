import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

let _id = 0;

const KIND = {
  success: { icon: CheckCircle2,   bar: 'bg-ok',        ring: 'border-ok/30',        fg: 'text-ok' },
  error:   { icon: XCircle,        bar: 'bg-crit',      ring: 'border-crit/35',      fg: 'text-crit' },
  warning: { icon: AlertTriangle,  bar: 'bg-warn',      ring: 'border-warn/30',      fg: 'text-warn' },
  info:    { icon: Info,           bar: 'bg-signal-400',ring: 'border-signal-500/30',fg: 'text-signal-400' },
};

function Toast({ toast, onDismiss }) {
  const meta = KIND[toast.kind] || KIND.info;
  const Icon = meta.icon;
  const [leaving, setLeaving] = useState(false);

  const close = useCallback(() => {
    setLeaving(true);
    setTimeout(() => onDismiss(toast.id), 160);
  }, [onDismiss, toast.id]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-auto relative flex gap-3 overflow-hidden rounded-xl border bg-panel/95 p-3.5 pr-9',
        'shadow-float shadow-inset backdrop-blur-md transition-all duration-150 ease-out',
        meta.ring,
        leaving ? 'translate-x-2 opacity-0' : 'animate-slide-in',
      )}
    >
      {/* Left accent rail */}
      <span className={cn('absolute inset-y-0 left-0 w-0.5', meta.bar)} />

      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', meta.fg)} />

      <div className="min-w-0 flex-1">
        {toast.title && (
          <div className="text-xs font-semibold leading-snug text-ink">{toast.title}</div>
        )}
        {toast.message && (
          <div className="mt-1 break-words text-2xs leading-relaxed text-ink-muted">
            {toast.message}
          </div>
        )}
      </div>

      <button
        onClick={close}
        aria-label="Dismiss"
        className="absolute right-2 top-2.5 grid h-6 w-6 place-items-center rounded-md text-ink-ghost transition-colors hover:bg-raised hover:text-ink-muted"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    const tm = timers.current.get(id);
    if (tm) { clearTimeout(tm); timers.current.delete(id); }
  }, []);

  const push = useCallback((t) => {
    const id = ++_id;
    setToasts((cur) => [
      ...cur.slice(-4), // cap the stack so a burst of errors can't fill the screen
      { id, kind: t.kind || 'info', title: t.title, message: t.message },
    ]);
    const tm = setTimeout(() => dismiss(id), t.duration ?? 4000);
    timers.current.set(id, tm);
    return id;
  }, [dismiss]);

  // Clear any in-flight timers on unmount
  useEffect(() => {
    const map = timers.current;
    return () => { map.forEach(clearTimeout); map.clear(); };
  }, []);

  const value = {
    success: (title, message) => push({ kind: 'success', title, message }),
    error:   (title, message) => push({ kind: 'error',   title, message, duration: 6500 }),
    warning: (title, message) => push({ kind: 'warning', title, message, duration: 5500 }),
    info:    (title, message) => push({ kind: 'info',    title, message }),
    push,
    dismiss,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 top-4 z-[200] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-5 sm:top-5 sm:w-[min(24rem,calc(100vw-2.5rem))]">
        {toasts.map((t) => (
          <div key={t.id} className="w-full">
            <Toast toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
