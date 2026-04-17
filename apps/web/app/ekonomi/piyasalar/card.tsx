'use client';

import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import * as React from 'react';

interface Ticker {
  symbol: string;
  name: string;
  value: number;
  change_pct: number | null;
  previous: number | null;
  fetched_at: number;
}

const FORMAT: Record<string, (v: number) => string> = {
  USDTRY: (v) => `₺${v.toFixed(4)}`,
  EURTRY: (v) => `₺${v.toFixed(4)}`,
  GBPTRY: (v) => `₺${v.toFixed(4)}`,
  GOLDUSD_OZ: (v) => `$${v.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`,
  GOLDTRY_GR: (v) => `₺${v.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`,
  SILVERUSD_OZ: (v) => `$${v.toFixed(3)}`,
  SILVERTRY_GR: (v) => `₺${v.toFixed(3)}`,
  BTCUSD: (v) => `$${v.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`,
  ETHUSD: (v) => `$${v.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`,
  BIST100: (v) => v.toLocaleString('tr-TR', { maximumFractionDigits: 2 }),
  NDX: (v) => v.toLocaleString('tr-TR', { maximumFractionDigits: 2 }),
  SPX: (v) => v.toLocaleString('tr-TR', { maximumFractionDigits: 2 }),
  FTSE: (v) => v.toLocaleString('tr-TR', { maximumFractionDigits: 2 }),
  DAX: (v) => v.toLocaleString('tr-TR', { maximumFractionDigits: 2 }),
};

const ACCENT: Record<string, string> = {
  BIST100: 'emerald',
  USDTRY: 'green',
  EURTRY: 'sky',
  GBPTRY: 'indigo',
  GOLDTRY_GR: 'amber',
  GOLDUSD_OZ: 'amber',
  SILVERTRY_GR: 'slate',
  SILVERUSD_OZ: 'slate',
  NDX: 'cyan',
  SPX: 'blue',
  FTSE: 'rose',
  DAX: 'yellow',
  BTCUSD: 'orange',
  ETHUSD: 'indigo',
};

export function MarketCard({ ticker: initial }: { ticker: Ticker }) {
  const [ticker, setTicker] = React.useState(initial);
  const [flash, setFlash] = React.useState<'up' | 'down' | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/market/live', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { items: Ticker[] };
        if (cancelled) return;
        const next = data.items.find((t) => t.symbol === ticker.symbol);
        if (!next) return;
        if (next.value !== ticker.value) {
          setFlash(next.value > ticker.value ? 'up' : 'down');
          setTimeout(() => setFlash(null), 1200);
        }
        setTicker(next);
      } catch {}
    };
    const id = setInterval(load, 5_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [ticker]);

  const fmt = FORMAT[ticker.symbol] ?? ((v: number) => v.toFixed(2));
  const accent = ACCENT[ticker.symbol] ?? 'neutral';
  const change = ticker.change_pct ?? 0;
  const up = change > 0;
  const down = change < 0;
  const flat = change === 0;

  const changeColor = up ? 'text-gain' : down ? 'text-loss' : 'text-muted-foreground';
  const bgRing = flash === 'up' ? 'ring-gain/50 bg-gain/5' : flash === 'down' ? 'ring-loss/50 bg-loss/5' : `ring-border hover:ring-${accent}-500/30`;

  return (
    <div
      className={`panel relative overflow-hidden rounded-xl p-4 ring-1 transition-all duration-300 ${bgRing}`}
    >
      {/* Accent corner wash */}
      <div
        aria-hidden
        className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-${accent}-500/10 blur-2xl`}
      />

      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            {ticker.symbol}
          </div>
          <div className={`inline-flex items-center gap-0.5 font-mono text-xs tabular-nums ${changeColor}`}>
            {up && <ArrowUpRight className="h-3 w-3" />}
            {down && <ArrowDownRight className="h-3 w-3" />}
            {flat && <Minus className="h-3 w-3" />}
            %{(change * 100).toFixed(2)}
          </div>
        </div>
        <div className="mt-0.5 truncate text-sm text-foreground/90">{ticker.name}</div>

        <div className="mt-4 flex items-baseline gap-2">
          <span className="font-mono text-2xl font-semibold tabular-nums">{fmt(ticker.value)}</span>
        </div>

        {ticker.previous !== null && (
          <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
            <span>Önceki kapanış</span>
            <span className="font-mono tabular-nums">{fmt(ticker.previous)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
