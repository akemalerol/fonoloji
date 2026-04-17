'use client';

import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import * as React from 'react';
import { countryFlag, isSessionOpen, MARKET_META } from '@/lib/market-meta';

interface Ticker {
  symbol: string;
  name: string;
  value: number;
  change_pct: number | null;
  previous: number | null;
  fetched_at: number;
}

export function MarketCard({ ticker: initial }: { ticker: Ticker }) {
  const [ticker, setTicker] = React.useState(initial);
  const [flash, setFlash] = React.useState<'up' | 'down' | null>(null);
  const [now, setNow] = React.useState(() => new Date());

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
        setNow(new Date());
      } catch {}
    };
    const id = setInterval(load, 5_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [ticker]);

  const meta = MARKET_META[ticker.symbol];
  const fmt = meta?.format ?? ((v: number) => v.toFixed(2));
  const accent = meta?.accent ?? 'neutral';
  const flag = countryFlag(meta?.country);
  const open = meta ? isSessionOpen(meta.window, now) : false;
  const always24 = meta?.window.tz === 'UTC' && !meta.window.weekendsClosed;

  const change = ticker.change_pct ?? 0;
  const up = change > 0;
  const down = change < 0;
  const flat = change === 0;

  const changeColor = up ? 'text-gain' : down ? 'text-loss' : 'text-muted-foreground';
  const bgRing =
    flash === 'up'
      ? 'ring-gain/50 bg-gain/5'
      : flash === 'down'
        ? 'ring-loss/50 bg-loss/5'
        : `ring-border hover:ring-${accent}-500/30`;

  return (
    <div className={`panel relative overflow-hidden rounded-xl p-4 ring-1 transition-all duration-300 ${bgRing}`}>
      <div
        aria-hidden
        className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-${accent}-500/10 blur-2xl`}
      />

      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {flag && <span className="text-base leading-none">{flag}</span>}
            <span className="truncate text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              {ticker.symbol}
            </span>
          </div>
          <div className={`inline-flex shrink-0 items-center gap-0.5 font-mono text-xs tabular-nums ${changeColor}`}>
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

        <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span
              className={`inline-flex h-1.5 w-1.5 rounded-full ${
                always24 ? 'bg-emerald-400' : open ? 'bg-emerald-400' : 'bg-muted-foreground/40'
              }`}
            />
            {always24 ? '7/24 açık' : open ? 'Seans açık' : 'Kapalı'}
          </span>
          {ticker.previous !== null && (
            <span className="font-mono tabular-nums">Önceki: {fmt(ticker.previous)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
