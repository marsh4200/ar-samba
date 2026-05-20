import { cn } from '@/lib/utils';

const TONES = {
  brand:   'from-brand-400 to-brand-600',
  success: 'from-emerald-400 to-emerald-600',
  danger:  'from-rose-400 to-rose-600',
};

export function Progress({ value = 0, className, animated = true, tone = 'brand' }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('h-2 rounded-full bg-white/5 overflow-hidden relative', className)}>
      <div
        className={cn(
          'h-full bg-gradient-to-r transition-[width] duration-500 ease-out relative',
          TONES[tone] || TONES.brand,
        )}
        style={{ width: `${v}%` }}
      >
        {animated && v > 0 && v < 100 && <div className="absolute inset-0 shimmer" />}
      </div>
    </div>
  );
}
