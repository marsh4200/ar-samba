import * as RD from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Dialog({ open, onOpenChange, children }) {
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </RD.Root>
  );
}

const SIZES = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-xl',
  lg: 'sm:max-w-3xl',
  xl: 'sm:max-w-5xl',
};

/**
 * DialogContent — header and footer stay pinned while the body scrolls, so
 * long forms (the ACL editor especially) never lose their action buttons.
 *
 * On mobile this docks to the bottom of the viewport as a sheet; from `sm`
 * up it centres as a conventional modal.
 */
export function DialogContent({
  children, className, title, description, icon: Icon, size = 'md',
  footer, tone = 'default', hideClose = false,
}) {
  return (
    <RD.Portal>
      <RD.Overlay className="fixed inset-0 z-[100] bg-abyss/80 backdrop-blur-sm animate-fade-in" />
      <RD.Content
        onOpenAutoFocus={(e) => {
          // Let the first real input take focus instead of the close button.
          const el = e.currentTarget.querySelector('[data-autofocus]');
          if (el) { e.preventDefault(); el.focus(); }
        }}
        className={cn(
          'fixed z-[101] flex flex-col overflow-hidden border border-line bg-panel shadow-float shadow-inset',
          'inset-x-0 bottom-0 max-h-[92vh] rounded-t-3xl animate-rise-in',
          'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100vw-3rem)]',
          'sm:max-h-[86vh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:animate-pop-in',
          SIZES[size] || SIZES.md,
          className,
        )}
      >
        {/* Grab handle — mobile sheet affordance only */}
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-line sm:hidden" />

        <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-4 sm:px-6 sm:pt-5">
          <div className="flex min-w-0 items-start gap-3">
            {Icon && (
              <span
                className={cn(
                  'mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border',
                  tone === 'danger'
                    ? 'border-crit/30 bg-crit/12 text-crit'
                    : 'border-line bg-raised text-signal-400',
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0">
              <RD.Title className="font-display text-base font-semibold leading-snug text-ink">
                {title}
              </RD.Title>
              {description ? (
                <RD.Description className="mt-1 text-xs leading-relaxed text-ink-faint">
                  {description}
                </RD.Description>
              ) : (
                <RD.Description className="sr-only">{title}</RD.Description>
              )}
            </div>
          </div>

          {!hideClose && (
            <RD.Close
              aria-label="Close"
              className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-raised hover:text-ink"
            >
              <X className="h-4 w-4" />
            </RD.Close>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6">{children}</div>

        {footer && (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line/60 bg-hull/50 px-5 py-4 sm:px-6">
            {footer}
          </div>
        )}
      </RD.Content>
    </RD.Portal>
  );
}

/** Footer helper so every modal's action row lines up identically. */
export function DialogFooter({ className, children }) {
  return (
    <div className={cn('flex items-center justify-end gap-2 pt-5', className)}>{children}</div>
  );
}

export const DialogTrigger = RD.Trigger;
export const DialogClose = RD.Close;
