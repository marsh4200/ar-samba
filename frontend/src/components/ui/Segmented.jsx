import { cn } from '@/lib/utils';

/**
 * Segmented — a horizontal filter control. Scrolls rather than wraps on
 * mobile so the row height stays fixed.
 */
export function Segmented({ options, value, onChange, className, size = 'md' }) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-line bg-hull/70 p-1',
        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {options.map((o) => {
        const val = typeof o === 'string' ? o : o.value;
        const lbl = typeof o === 'string' ? o : o.label;
        const count = typeof o === 'object' ? o.count : undefined;
        const active = val === value;
        return (
          <button
            key={val}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(val)}
            className={cn(
              'relative shrink-0 rounded-lg font-medium capitalize transition-all duration-200 ease-out',
              size === 'sm' ? 'px-2.5 py-1 text-2xs' : 'px-3 py-1.5 text-xs',
              active
                ? 'bg-signal-500/15 text-signal-300 shadow-[inset_0_0_0_1px_rgba(14,165,233,.3)]'
                : 'text-ink-faint hover:bg-raised hover:text-ink-muted',
            )}
          >
            {lbl}
            {count != null && (
              <span className={cn('ml-1.5 tnum', active ? 'text-signal-400/80' : 'text-ink-ghost')}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
