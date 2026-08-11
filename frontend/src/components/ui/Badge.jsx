import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badge = cva(
  'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'border-line bg-raised text-ink-muted',
        signal:  'border-signal-500/30 bg-signal-500/12 text-signal-300',
        ok:      'border-ok/30       bg-ok/12       text-ok',
        warn:    'border-warn/30     bg-warn/12     text-warn',
        crit:    'border-crit/30     bg-crit/12     text-crit',
        info:    'border-info/30     bg-info/12     text-info',
        outline: 'border-line bg-transparent text-ink-faint',
      },
      size: {
        sm: 'px-2   py-0.5 text-2xs',
        md: 'px-2.5 py-1   text-xs',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'sm' },
  },
);

export function Badge({ className, tone, size, icon: Icon, children, ...props }) {
  return (
    <span className={cn(badge({ tone, size }), className)} {...props}>
      {Icon && <Icon className="h-3 w-3 shrink-0" />}
      {children}
    </span>
  );
}

const DOT_TONE = {
  ok: 'bg-ok', crit: 'bg-crit', warn: 'bg-warn',
  signal: 'bg-signal-400', neutral: 'bg-ink-ghost',
};

/**
 * StatusDot — a small live indicator. `pulse` adds a halo for "running" states
 * so an at-a-glance scan of the services list reads instantly.
 */
export function StatusDot({ tone = 'neutral', pulse = false, className }) {
  return (
    <span className={cn('relative inline-flex h-2 w-2 shrink-0', className)}>
      {pulse && (
        <span
          className={cn(
            'absolute inline-flex h-full w-full animate-breathe rounded-full opacity-60',
            DOT_TONE[tone],
          )}
        />
      )}
      <span className={cn('relative inline-flex h-2 w-2 rounded-full', DOT_TONE[tone])} />
    </span>
  );
}

/** Pill combining a dot and a label — used in the topbar and service rows. */
export function StatusPill({ tone = 'neutral', label, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-line bg-hull/80 px-2.5 py-1 text-2xs font-medium text-ink-muted',
        className,
      )}
    >
      <StatusDot tone={tone} pulse={tone === 'ok'} />
      {label}
    </span>
  );
}
