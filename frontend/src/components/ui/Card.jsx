import { cn } from '@/lib/utils';

/**
 * Card — the base raised surface. `flush` removes body padding for tables.
 */
export function Card({ className, children, interactive = false, ...props }) {
  return (
    <div
      className={cn('surface', interactive && 'surface-hover cursor-pointer', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, title, description, icon: Icon, action, children }) {
  if (children) {
    return (
      <div className={cn('flex items-start justify-between gap-4 px-5 py-4', className)}>
        {children}
      </div>
    );
  }
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 border-b border-line/60 px-5 py-4',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line/80 bg-raised text-signal-400">
            <Icon className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-ink">{title}</h2>
          {description && (
            <p className="mt-1 text-xs leading-relaxed text-ink-faint">{description}</p>
          )}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

export function CardBody({ className, flush = false, children }) {
  return <div className={cn(!flush && 'p-5', className)}>{children}</div>;
}

export function CardFooter({ className, children }) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 border-t border-line/60 bg-hull/40 px-5 py-3',
        className,
      )}
    >
      {children}
    </div>
  );
}
