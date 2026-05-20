import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Spinner({ className }) {
  return <Loader2 className={cn('w-4 h-4 animate-spin', className)} />;
}

export function FullScreenLoader({ label = 'Loading…' }) {
  return (
    <div className="min-h-screen flex items-center justify-center gap-3 text-neutral-400">
      <Spinner className="w-5 h-5" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
