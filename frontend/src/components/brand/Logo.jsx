import { useId } from 'react';
import { cn } from '@/lib/utils';

/**
 * BrandMark — a drive-bay stack in a rounded tile. Three bays, each with its
 * own activity LED; the top LED is lit, echoing the "one active head" look of
 * a real NAS faceplate.
 */
export function BrandMark({ className, size = 36, glow = true }) {
  // Unique per instance: several marks render at once (sidebar, drawer,
  // topbar) and duplicate SVG ids make the gradients resolve to whichever
  // element came first in the document — which may be display:none.
  const uid = useId().replace(/:/g, '');
  const tile = `tile-${uid}`;
  const bay = `bay-${uid}`;
  const edge = `edge-${uid}`;

  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      role="img"
      aria-label="AR Samba"
    >
      <defs>
        <linearGradient id={tile} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1E293B" />
          <stop offset="1" stopColor="#0B0F1A" />
        </linearGradient>
        <linearGradient id={bay} x1="10" y1="0" x2="38" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#38BDF8" />
          <stop offset="1" stopColor="#0284C7" />
        </linearGradient>
        <linearGradient id={edge} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#38BDF8" stopOpacity=".7" />
          <stop offset=".5" stopColor="#38BDF8" stopOpacity=".12" />
          <stop offset="1" stopColor="#6366F1" stopOpacity=".45" />
        </linearGradient>
      </defs>

      {/* Chassis */}
      <rect x="1" y="1" width="46" height="46" rx="13" fill={`url(#${tile})`} />
      <rect x="1" y="1" width="46" height="46" rx="13" fill="none" stroke={`url(#${edge})`} strokeWidth="1.5" />

      {/* Drive bays */}
      <rect x="11" y="12"   width="26" height="7" rx="3.5" fill={`url(#${bay})`} />
      <rect x="11" y="21.5" width="26" height="7" rx="3.5" fill={`url(#${bay})`} opacity=".55" />
      <rect x="11" y="31"   width="26" height="7" rx="3.5" fill={`url(#${bay})`} opacity=".28" />

      {/* Activity LEDs */}
      <circle cx="32.5" cy="15.5" r="1.6" fill="#0B0F1A" />
      <circle cx="32.5" cy="25"   r="1.6" fill="#0B0F1A" opacity=".7" />
      <circle cx="32.5" cy="34.5" r="1.6" fill="#0B0F1A" opacity=".5" />
      {glow && <circle cx="32.5" cy="15.5" r="1.6" fill="#7DD3FC" />}
    </svg>
  );
}

/**
 * Wordmark — "AR" carries the weight, "SAMBA" is set light and wide so the
 * lockup reads as a product name rather than two words of equal rank.
 */
export function Wordmark({ className, sub = 'Share Control' }) {
  return (
    <div className={cn('min-w-0 leading-none', className)}>
      <div className="font-display text-[15px] font-bold tracking-tight text-ink">
        AR<span className="ml-1 font-medium tracking-[.18em] text-ink-muted">SAMBA</span>
      </div>
      {sub && <div className="mt-1 text-[9px] uppercase tracking-[.2em] text-ink-ghost">{sub}</div>}
    </div>
  );
}

/** Full lockup used in the sidebar, login and setup screens. */
export function Logo({ className, size = 36, sub, showWordmark = true }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <BrandMark size={size} />
      {showWordmark && <Wordmark sub={sub} />}
    </div>
  );
}
