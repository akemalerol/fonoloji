'use client';

import { Users } from 'lucide-react';
import * as React from 'react';
import { api } from '@/lib/api';
import { cn, formatNumber } from '@/lib/utils';

export function InvestorTrend({ code }: { code: string }) {
  const [series, setSeries] = React.useState<Array<{ date: string; count: number }> | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    api.getHistory(code, '1y')
      .then((d) => {
        if (cancelled) return;
        const s = d.points
          .filter((p) => typeof p.investor_count === 'number' && p.investor_count > 0)
          .map((p) => ({ date: p.date, count: p.investor_count as number }));
        setSeries(s);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [code]);

  if (loading) return <div className="panel mt-8 h-28 animate-pulse bg-card/30" />;
  if (!series || series.length < 7) return null;

  const first = series[0]!.count;
  const last = series[series.length - 1]!.count;
  const min = Math.min(...series.map((p) => p.count));
  const max = Math.max(...series.map((p) => p.count));
  const range = max - min || 1;
  const changePct = first > 0 ? (last - first) / first : 0;
  const positive = changePct >= 0;

  // Subsample to ~200 points for perf
  const step = Math.max(1, Math.floor(series.length / 200));
  const sampled = series.filter((_, i) => i % step === 0 || i === series.length - 1);

  const w = 800;
  const h = 90;
  const path = sampled
    .map((p, i) => {
      const x = (i / (sampled.length - 1)) * w;
      const y = h - ((p.count - min) / range) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="panel mt-8 p-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Users className="h-3.5 w-3.5 text-verdigris-400" /> Yatırımcı sayısı trendi
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Son 1 yıl içinde fona giren-çıkan kişi sayısı. Güven ve popülerlik sinyali.
          </p>
        </div>
        <div className="text-right">
          <div className="font-mono text-2xl font-semibold tabular-nums">
            {formatNumber(last)}
          </div>
          <div className={cn('font-mono text-xs tabular-nums', positive ? 'text-gain' : 'text-loss')}>
            {positive ? '+' : ''}{(changePct * 100).toFixed(1)}% · 1Y
          </div>
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" preserveAspectRatio="none">
        <path
          d={`${path} L${w},${h} L0,${h} Z`}
          fill="currentColor"
          className={positive ? 'text-gain/10' : 'text-loss/10'}
        />
        <path d={path} fill="none" strokeWidth="2" stroke="currentColor" className={positive ? 'text-gain' : 'text-loss'} />
      </svg>
      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="font-mono">Başlangıç: {formatNumber(first)}</span>
        <span className="font-mono">Aralık: {formatNumber(min)} – {formatNumber(max)}</span>
      </div>
    </div>
  );
}
