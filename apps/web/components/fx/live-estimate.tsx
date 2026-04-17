'use client';

import { Activity, TrendingDown, TrendingUp } from 'lucide-react';
import * as React from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

export function LiveEstimate({ code }: { code: string }) {
  const [data, setData] = React.useState<{
    estimated_change_pct: number;
    confidence: number;
    holdings_date: string;
    stock_coverage_pct: number;
    components: Array<{
      ticker: string;
      weight: number;
      change_pct: number | null;
      contribution: number;
    }>;
    non_stock_pct: number;
  } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await api.liveEstimate(code);
        if (!cancelled && res.estimate) setData(res.estimate);
      } catch {}
      if (!cancelled) setLoading(false);
    }
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [code]);

  if (loading) {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
        <Activity className="h-3 w-3" /> Gün içi tahmin yükleniyor…
      </div>
    );
  }

  if (!data) return null;

  const est = data.estimated_change_pct;
  const isUp = est > 0;
  const isDown = est < 0;
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Activity;

  return (
    <div className="mt-3">
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-xs transition-colors hover:bg-card/60"
      >
        <Icon className={cn('h-3.5 w-3.5', isUp && 'text-gain', isDown && 'text-loss', !isUp && !isDown && 'text-muted-foreground')} />
        <span className="text-muted-foreground">Gün içi tahmin:</span>
        <span className={cn('font-mono font-semibold tabular-nums', isUp && 'text-gain', isDown && 'text-loss')}>
          {isUp ? '+' : ''}{est.toFixed(2)}%
        </span>
        <span className="rounded-full bg-secondary/60 px-1.5 py-0.5 text-[9px] text-muted-foreground">
          güven {(data.confidence * 100).toFixed(0)}%
        </span>
        <span className="text-[9px] text-muted-foreground/60">
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {expanded && (
        <div className="mt-2 rounded-lg border border-border/50 bg-card/30 p-3 text-xs">
          <div className="mb-2 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Holdings: {data.holdings_date} · Hisse kapsam: %{data.stock_coverage_pct}</span>
            <span>Nakit/tahvil: %{data.non_stock_pct}</span>
          </div>
          <div className="space-y-1">
            {data.components.filter(c => c.change_pct !== null).map(c => (
              <div key={c.ticker} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold">{c.ticker}</span>
                  <span className="text-muted-foreground">%{c.weight.toFixed(1)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn('font-mono tabular-nums', (c.change_pct ?? 0) > 0 ? 'text-gain' : (c.change_pct ?? 0) < 0 ? 'text-loss' : 'text-muted-foreground')}>
                    {(c.change_pct ?? 0) > 0 ? '+' : ''}{c.change_pct?.toFixed(2)}%
                  </span>
                  <span className={cn('font-mono tabular-nums text-[10px]', c.contribution > 0 ? 'text-gain/70' : c.contribution < 0 ? 'text-loss/70' : 'text-muted-foreground/50')}>
                    {c.contribution > 0 ? '+' : ''}{(c.contribution * 100).toFixed(3)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 border-t border-border/30 pt-2 text-[10px] text-muted-foreground/60">
            Tahmin, KAP portföy dağılım raporu + anlık BIST fiyatları ile hesaplanır. Gerçek fon fiyatı farklılık gösterebilir.
          </div>
        </div>
      )}
    </div>
  );
}
