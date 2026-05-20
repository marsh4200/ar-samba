import * as RSwitch from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';

export function Switch({ checked, onCheckedChange, disabled, id, label }) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 cursor-pointer select-none">
      <RSwitch.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          'w-9 h-5 rounded-full bg-white/10 transition-colors',
          'data-[state=checked]:bg-brand',
          'disabled:opacity-50',
        )}
      >
        <RSwitch.Thumb
          className={cn(
            'block w-4 h-4 rounded-full bg-white shadow translate-x-0.5',
            'transition-transform',
            'data-[state=checked]:translate-x-[18px]',
          )}
        />
      </RSwitch.Root>
      {label && <span className="text-sm text-neutral-300">{label}</span>}
    </label>
  );
}
