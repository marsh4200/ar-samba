import * as DM from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils';

export const DropdownMenu = DM.Root;
export const DropdownTrigger = DM.Trigger;

export function DropdownContent({ className, align = 'end', sideOffset = 6, children }) {
  return (
    <DM.Portal>
      <DM.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-[120] min-w-[11rem] overflow-hidden rounded-xl border border-line bg-panel p-1.5',
          'shadow-float shadow-inset',
          'data-[state=open]:animate-fade-in',
          className,
        )}
      >
        {children}
      </DM.Content>
    </DM.Portal>
  );
}

export function DropdownItem({ className, icon: Icon, tone = 'default', children, ...props }) {
  return (
    <DM.Item
      className={cn(
        'flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium outline-none transition-colors',
        tone === 'danger'
          ? 'text-crit data-[highlighted]:bg-crit/12'
          : 'text-ink-muted data-[highlighted]:bg-raised data-[highlighted]:text-ink',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
        className,
      )}
      {...props}
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
      {children}
    </DM.Item>
  );
}

export function DropdownLabel({ className, children }) {
  return (
    <DM.Label className={cn('px-2.5 pb-1.5 pt-2 eyebrow', className)}>{children}</DM.Label>
  );
}

export function DropdownSeparator({ className }) {
  return <DM.Separator className={cn('my-1.5 h-px bg-line/70', className)} />;
}
