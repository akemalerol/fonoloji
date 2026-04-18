'use client';

import { Trophy } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

interface Bucket {
  rank: number;
  total: number;
  percentile: number;
  value: number | null;
}

const METRICS: Array<{ key: string; label: string; fmt: (v: number) => string }> = [
  { key: 'sharpe_90', label: 'Sharpe', fmt: (v) => v.toFixed(2) },
  { key: 'return_1y', label: '1Y Getiri', fmt: (v) => `%${(v * 100).toFixed(1)}` },
  { key: 'real_return_1y', label: 'Reel 1Y', fmt: (v) => `%${(v * 100).toFixed(1)}` },
  { key: 'max_drawdown_1y', label: 'Max DD', fmt: (v) => `%${(v * 100).toFixed(1)}` },
  { key: 'volatility_90', label: 'Volatilite', fmt: (v) => `%${(v * 100).toFixed(1)}` },
  { key: 'aum', label: 'AUM', fmt: (v) => v >= 1e9 ? `${(v / 1e9).toFixed(1)} Mr` : `${(v / 1e6).toFixed(0)} Mn` },
];

function colorFor(pct: number): { text: string; bg: string; border: string; label: string } {
  if (pct >= 75) return { text: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'Üst' };
  if (pct >= 50) return { text: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: 'Orta-üst' };
  if (pct >= 25) return { text: 'text-orange-300', bg: 'bg-orange-500/10', border: 'border-orange-500/30', label: 'Orta-alt' };
  return { text: 'text-loss', bg: 'bg-loss/10', border: 'border-loss/30', label: 'Alt' };
}

export function PercentileBadges({
  code,
  category,
  initialData,
}: {
  code: string;
  category: string | null;
  initialData?: { metrics: Record<string, Bucket | null>; categorySize: number } | null;
}) {
  const [data, setData] = React.useState(initialData ?? null);
  const [loading, setLoading] = React.useState(!initialData);

  React.useEffect(() => {
    if (initialData) return;
    let cancelled = false;
    fetch(`/api/funds/${encodeURIComponent(code)}/percentile`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.metrics) setData(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [code, initialData]);

  if (loading) {
    return <div className="mt-2 h-10 animate-pulse rounded bg-card/40" />;
  }
  if (!data) return null;

  const visible = METRICS.filter((m) => data.metrics[m.key]);
  if (visible.length === 0) return null;

  return (
    <div className="panel mt-8 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Trophy className="h-3.5 w-3.5 text-amber-400" /> Kategorisi içinde sıralama
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {category ?? '—'} · {data.categorySize} fon arasında. Üst yüzdelik = daha iyi.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {visible.map((m) => {
          const bucket = data.metrics[m.key]!;
          const color = colorFor(bucket.percentile);
          return (
            <div
              key={m.key}
              className={cn('rounded-lg border p-3 transition', color.border, color.bg)}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  {m.label}
                </span>
                <span className={cn('font-mono text-[10px] tabular-nums', color.text)}>
                  {bucket.rank}/{bucket.total}
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-2">
                <span className="font-mono text-lg font-semibold tabular-nums">
                  {bucket.value !== null && Number.isFinite(bucket.value) ? m.fmt(bucket.value) : '—'}
                </span>
                <span className={cn('font-mono text-sm font-semibold tabular-nums', color.text)}>
                  %{bucket.percentile}
                </span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-border/40">
                <div
                  className={cn('h-full rounded-full', color.bg.replace('/10', '/60'))}
                  style={{ width: `${bucket.percentile}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
