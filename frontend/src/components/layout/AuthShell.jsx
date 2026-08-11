import { useId } from 'react';
import { BrandMark, Wordmark } from '@/components/brand/Logo';
import { cn } from '@/lib/utils';

/**
 * AuthShell — a two-column lockup: brand panel on the left, form on the right.
 *
 * The left panel carries a faint drive-bay motif built from the same rounded
 * bars as the logo, scaled up. It's the one decorative moment in the app, and
 * it only appears here where there's no data to compete with.
 */
export function AuthShell({ eyebrow, heading, blurb, points = [], children, footer }) {
  const bayId = `auth-bay-${useId().replace(/:/g, '')}`;
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* ── Brand panel ─────────────────────────────────────────────── */}
      <div className="relative hidden overflow-hidden border-r border-line/60 bg-hull lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* Oversized drive-bay motif */}
        <svg
          aria-hidden
          viewBox="0 0 400 400"
          className="pointer-events-none absolute -bottom-32 -right-40 h-[620px] w-[620px] opacity-[.07]"
        >
          <defs>
            <linearGradient id={bayId} x1="0" y1="0" x2="400" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#38BDF8" />
              <stop offset="1" stopColor="#6366F1" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect
              key={i}
              x="20"
              y={30 + i * 60}
              width={340 - i * 18}
              height="34"
              rx="17"
              fill={`url(#${bayId})`}
              opacity={1 - i * 0.14}
            />
          ))}
        </svg>

        {/* Signal wash */}
        <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-signal-500/12 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <BrandMark size={40} />
          <Wordmark />
        </div>

        <div className="relative max-w-md">
          {eyebrow && <div className="mb-4 eyebrow text-signal-400">{eyebrow}</div>}
          <h1 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight text-ink text-balance">
            {heading}
          </h1>
          {blurb && (
            <p className="mt-5 text-sm leading-relaxed text-ink-muted text-balance">{blurb}</p>
          )}

          {points.length > 0 && (
            <ul className="mt-8 space-y-3.5">
              {points.map((p) => (
                <li key={p.label} className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-line bg-panel text-signal-400">
                    <p.icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-ink">{p.label}</div>
                    <div className="mt-0.5 text-2xs leading-relaxed text-ink-faint">{p.hint}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="relative text-2xs text-ink-ghost">
          Self-hosted on your own server. No data leaves the network.
        </div>
      </div>

      {/* ── Form panel ──────────────────────────────────────────────── */}
      <div className="flex min-h-screen flex-col justify-center px-5 py-12 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-[26rem]">
          {/* Mobile brand */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark size={38} />
            <Wordmark />
          </div>

          {children}

          {footer && <div className="mt-8 text-center text-2xs text-ink-ghost">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

/** Heading block used above each auth form. */
export function AuthHeading({ title, description, className }) {
  return (
    <div className={cn('mb-7', className)}>
      <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">{title}</h2>
      {description && (
        <p className="mt-2 text-sm leading-relaxed text-ink-faint">{description}</p>
      )}
    </div>
  );
}
