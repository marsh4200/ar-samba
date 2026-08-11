import * as RSwitch from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';

/**
 * Switch — label sits to the right and the whole row is the hit target.
 * `description` renders a second line for permission toggles that need
 * explaining without a tooltip.
 */
export function Switch({
  checked, onCheckedChange, disabled, id, label, description, className, size = 'md',
}) {
  const dims = size === 'sm'
    ? { root: 'h-4 w-7', thumb: 'h-3 w-3', shift: 'data-[state=checked]:translate-x-[13px]' }
    : { root: 'h-5 w-9', thumb: 'h-4 w-4', shift: 'data-[state=checked]:translate-x-[17px]' };

  return (
    <div className={cn('flex items-start gap-2.5', disabled && 'opacity-55', className)}>
      <RSwitch.Root
        id={id}
        checked={!!checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          'group relative shrink-0 rounded-full border border-line bg-abyss/80 transition-colors duration-200 ease-out',
          'shadow-[inset_0_1px_2px_rgba(0,0,0,.5)]',
          'data-[state=checked]:border-signal-500/60 data-[state=checked]:bg-signal-600',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-abyss',
          'disabled:cursor-not-allowed',
          dims.root,
          !disabled && 'cursor-pointer',
        )}
      >
        <RSwitch.Thumb
          className={cn(
            'block translate-x-0.5 rounded-full bg-ink-muted shadow-sm transition-transform duration-200 ease-out',
            'data-[state=checked]:bg-white',
            dims.thumb,
            dims.shift,
          )}
        />
      </RSwitch.Root>

      {label && (
        <label
          htmlFor={id}
          className={cn('min-w-0 select-none leading-tight', !disabled && 'cursor-pointer')}
        >
          <span className="block text-xs font-medium text-ink">{label}</span>
          {description && (
            <span className="mt-0.5 block text-2xs text-ink-faint">{description}</span>
          )}
        </label>
      )}
    </div>
  );
}
