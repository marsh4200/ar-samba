import { cn } from '@/lib/utils';

const TONES = {
  signal: 'from-signal-400 to-signal-600',
  ok:     'from-ok  to-ok-dim',
  warn:   'from-warn to-warn-dim',
  crit:   'from-crit to-crit-dim',
  /* Back-compat aliases for the pre-v2 tone names */
  brand:   'from-signal-400 to-signal-600',
  success: 'from-ok  to-ok-dim',
  danger:  'from-crit to-crit-dim',
};

const SIZES = { xs: 'h-1', sm: 'h-1.5', md: 'h-2', lg: 'h-2.5' };

/** Pick a tone from the value itself — used by capacity bars. */
export function toneForPercent(v) {
  if (v >= 90) return 'crit';
  if (v >= 75) return 'warn';
  return 'signal';
}

export function Progress({
  value = 0, className, animated = true, tone = 'signal', size = 'md', showTrack = true,
}) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        'relative w-full overflow-hidden rounded-full',
        showTrack && 'bg-abyss/80 shadow-[inset_0_1px_2px_rgba(0,0,0,.5)]',
        SIZES[size] || SIZES.md,
        className,
      )}
    >
      <div
        className={cn(
          'relative h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out',
          TONES[tone] || TONES.signal,
        )}
        style={{ width: `${v}%` }}
      >
        {animated && v > 0 && v < 100 && <div className="absolute inset-0 shimmer" />}
      </div>
    </div>
  );
}
