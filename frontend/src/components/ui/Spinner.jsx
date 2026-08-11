import { cn } from '@/lib/utils';

/**
 * Spinner — a two-arc ring rather than a lucide glyph, so the stroke weight
 * matches our iconography at every size.
 */
export function Spinner({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label="Loading"
      className={cn('h-4 w-4 animate-spin', className)}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity=".2" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Centred loader for route-level suspense. */
export function FullScreenLoader({ label = 'Loading' }) {
  return (
    <div className="grid min-h-screen place-items-center bg-abyss">
      <div className="flex flex-col items-center gap-4">
        <Spinner className="h-7 w-7 text-signal-400" />
        <div className="text-sm text-ink-faint">{label}</div>
      </div>
    </div>
  );
}

/** In-panel loader used inside cards and tables. */
export function PanelLoader({ label, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-16', className)}>
      <Spinner className="h-6 w-6 text-signal-400" />
      {label && <div className="text-xs text-ink-faint">{label}</div>}
    </div>
  );
}
