import type { FundRow } from '@/lib/api';

const COLORS: Record<string, string> = {
  stock: '#F59E0B',
  government_bond: '#2DD4BF',
  treasury_bill: '#0EA5E9',
  corporate_bond: '#FB7185',
  eurobond: '#C084FC',
  gold: '#FCD34D',
  cash: '#10B981',
  other: '#94A3B8',
};

const LABELS: Record<string, string> = {
  stock: 'Hisse',
  government_bond: 'Devlet Tahvili',
  treasury_bill: 'Hazine Bonosu',
  corporate_bond: 'Özel Sektör',
  eurobond: 'Eurobond',
  gold: 'Altın',
  cash: 'Nakit',
  other: 'Diğer',
};

/**
 * Compact horizontal stacked bar showing a fund's allocation.
 * Designed for table rows — height 8px, tooltip-rich.
 */
export function PortfolioChip({ fund }: { fund: FundRow }) {
  const slices = (
    ['stock', 'government_bond', 'treasury_bill', 'corporate_bond', 'eurobond', 'gold', 'cash', 'other'] as const
  )
    .map((k) => ({ key: k, value: fund[k] ?? 0 }))
    .filter((s) => s.value > 0.5);

  const total = slices.reduce((a, b) => a + b.value, 0);
  if (total < 10) {
    return <span className="text-[10px] text-muted-foreground/50">—</span>;
  }

  // Build tooltip text
  const tooltip = slices
    .sort((a, b) => b.value - a.value)
    .map((s) => `${LABELS[s.key]} %${s.value.toFixed(0)}`)
    .join(' · ');

  return (
    <div
      className="flex h-2 w-full min-w-[80px] overflow-hidden rounded-full bg-secondary/40"
      title={tooltip}
    >
      {slices.map((s) => (
        <div
          key={s.key}
          style={{
            width: `${(s.value / total) * 100}%`,
            background: COLORS[s.key],
          }}
        />
      ))}
    </div>
  );
}
