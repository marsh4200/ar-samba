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

export function DialogContent({ children, className, title, description }) {
  return (
    <RD.Portal>
      <RD.Overlay className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm animate-fade-in" />
      <RD.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-[101] -translate-x-1/2 -translate-y-1/2',
          'w-[min(560px,calc(100vw-2rem))] max-h-[85vh] overflow-y-auto',
          'rounded-xl glass p-6 animate-slide-up',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            {title && <RD.Title className="text-lg font-semibold">{title}</RD.Title>}
            {description && (
              <RD.Description className="text-sm text-neutral-400 mt-1">{description}</RD.Description>
            )}
          </div>
          <RD.Close className="text-neutral-500 hover:text-neutral-100" aria-label="Close">
            <X className="w-5 h-5" />
          </RD.Close>
        </div>
        {children}
      </RD.Content>
    </RD.Portal>
  );
}

export const DialogTrigger = RD.Trigger;
export const DialogClose = RD.Close;
