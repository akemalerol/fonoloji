import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn, formatPercent } from '@/lib/utils';

export function ChangePill({ value, className }: { value: number | null | undefined; className?: string }) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-muted-foreground tabular-nums', className)}>
        <Minus className="h-3 w-3" />—
      </span>
    );
  }
  const positive = value > 0;
  const negative = value < 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 tabular-nums',
        positive && 'text-gain',
        negative && 'text-loss',
        !positive && !negative && 'text-muted-foreground',
        className,
      )}
    >
      {positive && <ArrowUpRight className="h-3 w-3" />}
      {negative && <ArrowDownRight className="h-3 w-3" />}
      {formatPercent(value)}
    </span>
  );
}
