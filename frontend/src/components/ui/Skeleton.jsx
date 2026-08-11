import { cn } from '@/lib/utils';

/** Shape-preserving placeholder — keeps layout stable while data lands. */
export function Skeleton({ className }) {
  return (
    <div className={cn('relative overflow-hidden rounded-lg bg-raised', className)}>
      <div className="absolute inset-0 shimmer" />
    </div>
  );
}

/** Skeleton rows sized to match the real data table. */
export function SkeletonRows({ rows = 5, cols = 4 }) {
  return (
    <div className="divide-y divide-line/50">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={c}
              className={cn('h-4', c === 0 ? 'w-40' : c === cols - 1 ? 'ml-auto w-16' : 'w-28')}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
