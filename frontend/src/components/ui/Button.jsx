import { forwardRef } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/Spinner';

const button = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl',
    'font-medium transition-all duration-200 ease-out select-none',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70',
    'focus-visible:ring-offset-2 focus-visible:ring-offset-abyss',
    'disabled:pointer-events-none disabled:opacity-45',
    'active:scale-[.985]',
  ].join(' '),
  {
    variants: {
      variant: {
        primary: [
          'bg-gradient-to-b from-signal-400 to-signal-600 text-white',
          'shadow-[0_1px_0_0_rgba(255,255,255,.18)_inset,0_6px_18px_-8px_rgba(14,165,233,.8)]',
          'hover:from-signal-300 hover:to-signal-500',
        ].join(' '),
        secondary: 'bg-raised text-ink border border-line hover:bg-line/70 hover:border-line',
        outline: 'border border-line bg-transparent text-ink-muted hover:bg-raised hover:text-ink',
        ghost: 'text-ink-muted hover:bg-raised hover:text-ink',
        danger: [
          'bg-gradient-to-b from-crit to-crit-dim text-white',
          'shadow-[0_1px_0_0_rgba(255,255,255,.15)_inset,0_6px_18px_-8px_rgba(220,38,38,.75)]',
          'hover:brightness-110',
        ].join(' '),
        'danger-quiet':
          'border border-crit/30 bg-crit/10 text-crit hover:bg-crit/20 hover:border-crit/50',
        link: 'text-signal-400 hover:text-signal-300 underline-offset-4 hover:underline px-0',
      },
      size: {
        xs:   'h-7  px-2.5 text-2xs',
        sm:   'h-8  px-3   text-xs',
        md:   'h-10 px-4   text-sm',
        lg:   'h-11 px-5   text-sm',
        icon: 'h-9  w-9    text-sm',
        'icon-sm': 'h-8 w-8 text-xs',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

/**
 * Unified button. `loading` swaps the leading icon for a spinner and blocks
 * input, so callers never have to hand-roll the busy state.
 */
export const Button = forwardRef(function Button(
  { className, variant, size, block, loading = false, icon: Icon, children, disabled, ...props },
  ref,
) {
  const iconOnly = size === 'icon' || size === 'icon-sm';
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(button({ variant, size, block }), className)}
      {...props}
    >
      {loading ? (
        <Spinner className={iconOnly ? 'h-4 w-4' : 'h-4 w-4 shrink-0'} />
      ) : (
        Icon && <Icon className={cn('shrink-0', size === 'xs' ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
      )}
      {children}
    </button>
  );
});

/** Anchor styled as a button — same visual language, different semantics. */
export function ButtonLink({ className, variant, size, block, icon: Icon, children, ...props }) {
  return (
    <a className={cn(button({ variant, size, block }), className)} {...props}>
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      {children}
    </a>
  );
}

export { button as buttonVariants };
