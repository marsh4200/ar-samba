import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const ToastContext = createContext(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

let _id = 0;

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
    const toast = { id, kind: t.kind || 'info', title: t.title, message: t.message };
    setToasts((cur) => [...cur, toast]);
    const tm = setTimeout(() => dismiss(id), t.duration ?? 4000);
    timers.current.set(id, tm);
    return id;
  }, [dismiss]);

  const value = {
    success: (title, message) => push({ kind: 'success', title, message }),
    error:   (title, message) => push({ kind: 'error',   title, message, duration: 6000 }),
    info:    (title, message) => push({ kind: 'info',    title, message }),
    dismiss,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 w-[360px] max-w-[calc(100vw-2rem)]">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'glass rounded-lg p-3 pr-8 relative animate-slide-up',
              t.kind === 'success' && 'border-success/30',
              t.kind === 'error'   && 'border-danger/40',
              t.kind === 'info'    && 'border-brand/30',
            )}
          >
            <div className="flex gap-3 items-start">
              {t.kind === 'success' && <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />}
              {t.kind === 'error'   && <AlertCircle  className="w-5 h-5 text-danger  shrink-0 mt-0.5" />}
              {t.kind === 'info'    && <Info         className="w-5 h-5 text-brand   shrink-0 mt-0.5" />}
              <div className="min-w-0">
                {t.title && <div className="text-sm font-medium truncate">{t.title}</div>}
                {t.message && <div className="text-xs text-neutral-400 mt-0.5 break-words">{t.message}</div>}
              </div>
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="absolute top-2 right-2 text-neutral-500 hover:text-neutral-200"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
