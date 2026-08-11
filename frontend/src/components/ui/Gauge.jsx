import { useEffect, useId, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Gauge — a 270° arc built from discrete tick segments rather than a smooth
 * ring, so it reads like the meter on a rack-mounted appliance. Ticks light
 * up in sequence and the whole arc sweeps in on mount.
 */

const TONE = {
  signal: { lit: '#38BDF8', glow: 'rgba(56,189,248,.55)' },
  ok:     { lit: '#34D399', glow: 'rgba(52,211,153,.55)' },
  warn:   { lit: '#FBBF24', glow: 'rgba(251,191,36,.55)' },
  crit:   { lit: '#F87171', glow: 'rgba(248,113,113,.6)'  },
};

const START = 135;   // degrees — bottom-left
const SWEEP = 270;   // degrees of travel
const TICKS = 40;

export function Gauge({
  value = 0,
  label,
  sublabel,
  tone = 'signal',
  size = 132,
  unit = '%',
  loading = false,
  className,
}) {
  const target = Math.max(0, Math.min(100, Number(value) || 0));
  const glowId = `gauge-glow-${useId().replace(/:/g, '')}`;
  const [shown, setShown] = useState(0);

  // Sweep from empty to the real value once on mount, then track updates
  // directly so a 15s poll doesn't re-animate from zero every time.
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setShown(target); return undefined; }
    const id = requestAnimationFrame(() => setShown(target));
    return () => cancelAnimationFrame(id);
  }, [target]);

  const colors = TONE[tone] || TONE.signal;
  const litCount = Math.round((shown / 100) * TICKS);

  const r1 = 34;  // inner radius of tick
  const r2 = 45;  // outer radius of tick

  const ticks = Array.from({ length: TICKS }, (_, i) => {
    const a = ((START + (SWEEP * (i + 0.5)) / TICKS) * Math.PI) / 180;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    return {
      i,
      x1: 50 + r1 * cos, y1: 50 + r1 * sin,
      x2: 50 + r2 * cos, y2: 50 + r2 * sin,
      lit: i < litCount,
    };
  });

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-0">
          <defs>
            <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Unlit track */}
          {ticks.map((t) => (
            <line
              key={`u-${t.i}`}
              x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
              stroke="#1E293B"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
          ))}

          {/* Lit segments */}
          <g filter={`url(#${glowId})`}>
            {ticks.filter((t) => t.lit).map((t) => (
              <line
                key={`l-${t.i}`}
                x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
                stroke={colors.lit}
                strokeWidth="2.6"
                strokeLinecap="round"
                style={{
                  transition: 'opacity .35s ease-out',
                  transitionDelay: `${t.i * 12}ms`,
                }}
              />
            ))}
          </g>
        </svg>

        {/* Readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {loading ? (
            <div className="h-7 w-12 animate-breathe rounded bg-raised" />
          ) : (
            <div className="flex items-baseline gap-0.5">
              <span
                className="font-display text-2xl font-semibold leading-none tnum"
                style={{ color: colors.lit }}
              >
                {Math.round(target)}
              </span>
              <span className="text-xs font-medium text-ink-faint">{unit}</span>
            </div>
          )}
          {sublabel && (
            <div className="mt-1.5 max-w-[80%] truncate text-2xs text-ink-faint">{sublabel}</div>
          )}
        </div>
      </div>

      {label && (
        <div className="mt-1 eyebrow text-ink-muted">{label}</div>
      )}
    </div>
  );
}
