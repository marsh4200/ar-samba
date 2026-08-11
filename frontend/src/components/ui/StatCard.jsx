import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';

const TONE = {
  signal: 'border-signal-500/25 bg-signal-500/10 text-signal-300',
  ok:     'border-ok/25   bg-ok/10   text-ok',
  warn:   'border-warn/25 bg-warn/10 text-warn',
  crit:   'border-crit/25 bg-crit/10 text-crit',
  info:   'border-info/25 bg-info/10 text-info',
  neutral:'border-line    bg-raised  text-ink-muted',
};

/**
 * StatCard — one metric, its label, and one line of supporting context.
 * `accent` paints a thin left edge so a row of cards can be scanned by colour.
 */
export function StatCard({
  icon: Icon, label, value, hint, tone = 'signal', trailing, loading = false, className,
}) {
  return (
    <div className={cn('surface group overflow-hidden p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="eyebrow">{label}</div>
          {loading ? (
            <Skeleton className="mt-3 h-7 w-20" />
          ) : (
            <div className="mt-2 font-display text-2xl font-semibold leading-none text-ink tnum">
              {value}
            </div>
          )}
          {hint && (
            <div className="mt-2 truncate text-2xs text-ink-faint" title={typeof hint === 'string' ? hint : undefined}>
              {hint}
            </div>
          )}
        </div>

        {Icon && (
          <span
            className={cn(
              'grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition-transform duration-300 ease-out group-hover:scale-105',
              TONE[tone] || TONE.signal,
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
        )}
      </div>

      {trailing && <div className="mt-4">{trailing}</div>}
    </div>
  );
}
