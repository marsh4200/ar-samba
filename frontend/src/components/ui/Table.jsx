import { cn } from '@/lib/utils';

/**
 * Table set. Wrapped in a horizontal scroller so wide data degrades to a
 * swipe on tablet rather than squashing columns.
 */
export function TableWrap({ className, children }) {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }) {
  return <thead>{children}</thead>;
}

export function TH({ className, align = 'left', children, ...props }) {
  return (
    <th
      className={cn(
        'data-head',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function TBody({ children }) {
  return <tbody>{children}</tbody>;
}

export function TR({ className, children, ...props }) {
  return (
    <tr className={cn('data-row', className)} {...props}>
      {children}
    </tr>
  );
}

export function TD({ className, align = 'left', children, ...props }) {
  return (
    <td
      className={cn(
        'data-cell',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
}

/**
 * EmptyState — an empty screen is an invitation to act, so this always takes
 * an action rather than just reporting absence.
 */
export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-16 text-center', className)}>
      {Icon && (
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-line bg-raised">
          <Icon className="h-6 w-6 text-ink-faint" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-ink-faint">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
