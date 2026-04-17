import { cn } from '@/lib/utils';

const RISK_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Çok Düşük', color: 'text-emerald-400' },
  2: { label: 'Düşük', color: 'text-emerald-400' },
  3: { label: 'Orta-Düşük', color: 'text-lime-400' },
  4: { label: 'Orta', color: 'text-amber-400' },
  5: { label: 'Orta-Yüksek', color: 'text-orange-400' },
  6: { label: 'Yüksek', color: 'text-rose-400' },
  7: { label: 'Çok Yüksek', color: 'text-rose-500' },
};

const SEGMENT_BG = [
  'bg-emerald-500',
  'bg-emerald-400',
  'bg-lime-400',
  'bg-amber-400',
  'bg-orange-400',
  'bg-rose-400',
  'bg-rose-500',
];

export function RiskGauge({ value, className }: { value: number | null | undefined; className?: string }) {
  if (value === null || value === undefined || !RISK_LABELS[value]) {
    return (
      <div className={cn('text-sm text-muted-foreground', className)}>Risk verisi yok</div>
    );
  }
  const meta = RISK_LABELS[value]!;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-baseline gap-3">
        <span className={cn('font-mono text-4xl font-semibold tabular-nums', meta.color)}>{value}</span>
        <span className="text-xs text-muted-foreground">/ 7</span>
        <span className={cn('text-sm', meta.color)}>{meta.label}</span>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5, 6, 7].map((seg) => (
          <div
            key={seg}
            className={cn(
              'h-2 flex-1 rounded-full transition-all',
              seg <= value ? SEGMENT_BG[seg - 1] : 'bg-muted',
              seg === value && 'h-3 -translate-y-px',
            )}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>Düşük risk</span>
        <span>Yüksek risk</span>
      </div>
    </div>
  );
}

export function RiskBadge({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined || !RISK_LABELS[value]) return null;
  const meta = RISK_LABELS[value]!;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs tabular-nums', meta.color)}>
      <span className="font-mono font-semibold">R{value}</span>
      <span className="text-muted-foreground">·</span>
      <span>{meta.label}</span>
    </span>
  );
}
