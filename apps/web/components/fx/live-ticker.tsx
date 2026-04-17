'use client';

import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import * as React from 'react';

interface Ticker {
  symbol: string;
  name: string;
  value: number;
  change_pct: number | null;
  previous: number | null;
  source: string;
  fetched_at: number;
}

const FORMAT: Record<string, (v: number) => string> = {
  USDTRY: (v) => `₺${v.toFixed(2)}`,
  EURTRY: (v) => `₺${v.toFixed(2)}`,
  GBPTRY: (v) => `₺${v.toFixed(2)}`,
  GOLDUSD_OZ: (v) => `$${v.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`,
  GOLDTRY_GR: (v) => `₺${v.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`,
  SILVERUSD_OZ: (v) => `$${v.toFixed(2)}`,
  SILVERTRY_GR: (v) => `₺${v.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`,
  BTCUSD: (v) => `$${v.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`,
  ETHUSD: (v) => `$${v.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`,
  BIST100: (v) => v.toLocaleString('tr-TR', { maximumFractionDigits: 0 }),
};

const SHORT_NAME: Record<string, string> = {
  USDTRY: 'USD/TL',
  EURTRY: 'EUR/TL',
  GBPTRY: 'GBP/TL',
  GOLDUSD_OZ: 'Ons Altın',
  GOLDTRY_GR: 'Gram Altın',
  SILVERUSD_OZ: 'Ons Gümüş',
  SILVERTRY_GR: 'Gram Gümüş',
  BTCUSD: 'Bitcoin',
  ETHUSD: 'Ethereum',
  BIST100: 'BIST 100',
};

/**
 * Per-symbol visual theme — each ticker gets a branded accent color chip
 * so nothing visually "drifts" into the neighbouring item.
 */
interface Theme {
  chip: string; // ring + bg
  label: string; // label text color
  value: string; // value text (plain or gradient)
  dot: React.ReactNode; // small leading icon/dot
}

const GOLD_DOT = (
  <span
    aria-hidden
    className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_30%,#FDE68A_0%,#F59E0B_55%,#B45309_100%)] shadow-[0_0_8px_rgba(245,158,11,0.45)] ring-1 ring-amber-300/40"
  >
    <span className="absolute inset-[2px] rounded-full bg-[radial-gradient(circle_at_40%_35%,rgba(255,255,255,0.35)_0%,transparent_55%)]" />
  </span>
);

const SILVER_DOT = (
  <span
    aria-hidden
    className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle_at_30%_30%,#F8FAFC_0%,#CBD5E1_55%,#64748B_100%)] shadow-[0_0_8px_rgba(203,213,225,0.35)] ring-1 ring-slate-300/40"
  >
    <span className="absolute inset-[2px] rounded-full bg-[radial-gradient(circle_at_40%_35%,rgba(255,255,255,0.45)_0%,transparent_55%)]" />
  </span>
);

function Glyph({ letter, gradient }: { letter: string; gradient: string }) {
  return (
    <span
      aria-hidden
      className={`relative inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-background shadow-sm ring-1 ring-white/10 ${gradient}`}
    >
      {letter}
    </span>
  );
}

const THEMES: Record<string, Theme> = {
  BIST100: {
    chip: 'bg-gradient-to-r from-emerald-500/[0.08] to-transparent ring-1 ring-emerald-400/20',
    label: 'font-semibold text-emerald-200/90',
    value: 'bg-gradient-to-b from-white to-emerald-100 bg-clip-text text-transparent',
    dot: <Glyph letter="₺" gradient="bg-gradient-to-br from-emerald-300 to-emerald-600" />,
  },
  USDTRY: {
    chip: 'bg-gradient-to-r from-green-600/[0.08] to-transparent ring-1 ring-green-500/20',
    label: 'font-semibold text-green-200/90',
    value: 'bg-gradient-to-b from-white to-green-100 bg-clip-text text-transparent',
    dot: <Glyph letter="$" gradient="bg-gradient-to-br from-green-300 to-green-700" />,
  },
  EURTRY: {
    chip: 'bg-gradient-to-r from-sky-500/[0.08] to-transparent ring-1 ring-sky-400/20',
    label: 'font-semibold text-sky-200/90',
    value: 'bg-gradient-to-b from-white to-sky-100 bg-clip-text text-transparent',
    dot: <Glyph letter="€" gradient="bg-gradient-to-br from-sky-300 to-sky-600" />,
  },
  GBPTRY: {
    chip: 'bg-gradient-to-r from-indigo-500/[0.08] to-transparent ring-1 ring-indigo-400/20',
    label: 'font-semibold text-indigo-200/90',
    value: 'bg-gradient-to-b from-white to-indigo-100 bg-clip-text text-transparent',
    dot: <Glyph letter="£" gradient="bg-gradient-to-br from-indigo-300 to-indigo-600" />,
  },
  GOLDUSD_OZ: {
    chip: 'bg-gradient-to-r from-amber-500/[0.08] to-transparent ring-1 ring-amber-400/20',
    label: 'font-semibold text-amber-200/90',
    value: 'bg-gradient-to-b from-amber-200 to-amber-400 bg-clip-text text-transparent',
    dot: GOLD_DOT,
  },
  GOLDTRY_GR: {
    chip: 'bg-gradient-to-r from-amber-500/[0.08] to-transparent ring-1 ring-amber-400/20',
    label: 'font-semibold text-amber-200/90',
    value: 'bg-gradient-to-b from-amber-200 to-amber-400 bg-clip-text text-transparent',
    dot: GOLD_DOT,
  },
  SILVERUSD_OZ: {
    chip: 'bg-gradient-to-r from-slate-400/[0.08] to-transparent ring-1 ring-slate-300/20',
    label: 'font-semibold text-slate-200/90',
    value: 'bg-gradient-to-b from-slate-100 to-slate-300 bg-clip-text text-transparent',
    dot: SILVER_DOT,
  },
  SILVERTRY_GR: {
    chip: 'bg-gradient-to-r from-slate-400/[0.08] to-transparent ring-1 ring-slate-300/20',
    label: 'font-semibold text-slate-200/90',
    value: 'bg-gradient-to-b from-slate-100 to-slate-300 bg-clip-text text-transparent',
    dot: SILVER_DOT,
  },
  BTCUSD: {
    chip: 'bg-gradient-to-r from-orange-500/[0.1] to-transparent ring-1 ring-orange-400/25',
    label: 'font-semibold text-orange-200/95',
    value: 'bg-gradient-to-b from-orange-100 to-orange-300 bg-clip-text text-transparent',
    dot: <Glyph letter="₿" gradient="bg-gradient-to-br from-orange-300 to-orange-600" />,
  },
  ETHUSD: {
    chip: 'bg-gradient-to-r from-indigo-400/[0.1] to-transparent ring-1 ring-indigo-400/25',
    label: 'font-semibold text-indigo-200/95',
    value: 'bg-gradient-to-b from-indigo-100 to-indigo-300 bg-clip-text text-transparent',
    dot: <Glyph letter="Ξ" gradient="bg-gradient-to-br from-indigo-300 to-indigo-600" />,
  },
};

const FALLBACK_THEME: Theme = {
  chip: 'ring-1 ring-border/50',
  label: 'text-muted-foreground',
  value: '',
  dot: null,
};

export function LiveTicker({
  tickers: initialTickers,
  updatedAt: initialUpdatedAt,
}: {
  tickers: Ticker[];
  updatedAt: number | null;
}) {
  const [tickers, setTickers] = React.useState(initialTickers);
  const [updatedAt, setUpdatedAt] = React.useState(initialUpdatedAt);
  const [flash, setFlash] = React.useState<Record<string, 'up' | 'down' | null>>({});
  const [now, setNow] = React.useState(Date.now());

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/market/live', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { items: Ticker[]; updated_at: number | null };
        if (cancelled) return;

        const newFlash: Record<string, 'up' | 'down' | null> = {};
        for (const newT of data.items) {
          const old = tickers.find((t) => t.symbol === newT.symbol);
          if (old && old.value !== newT.value) {
            newFlash[newT.symbol] = newT.value > old.value ? 'up' : 'down';
          }
        }
        if (Object.keys(newFlash).length > 0) {
          setFlash(newFlash);
          setTimeout(() => setFlash({}), 1500);
        }

        setTickers(data.items);
        setUpdatedAt(data.updated_at);
      } catch {}
    }
    const interval = setInterval(load, 5_000);
    const clock = setInterval(() => setNow(Date.now()), 5_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
      clearInterval(clock);
    };
  }, [tickers]);

  if (tickers.length === 0) return null;

  const agoSec = updatedAt ? Math.round((now - updatedAt) / 1000) : null;
  const agoText =
    agoSec === null
      ? ''
      : agoSec < 60
        ? 'az önce'
        : agoSec < 3600
          ? `${Math.round(agoSec / 60)}dk önce`
          : `${Math.round(agoSec / 3600)}sa önce`;

  return (
    <div className="panel px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          {agoSec !== null ? agoText : 'canlı'}
        </div>
        {tickers.map((t) => {
          const fmt = FORMAT[t.symbol] ?? ((v: number) => v.toFixed(2));
          const up = (t.change_pct ?? 0) >= 0;
          const f = flash[t.symbol];
          const theme = THEMES[t.symbol] ?? FALLBACK_THEME;
          return (
            <div
              key={t.symbol}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-sm transition-colors ${theme.chip} ${
                f === 'up' ? '!bg-gain/15 !ring-gain/40' : f === 'down' ? '!bg-loss/15 !ring-loss/40' : ''
              }`}
            >
              {theme.dot}
              <span className={`text-[10.5px] uppercase tracking-wider ${theme.label}`}>
                {SHORT_NAME[t.symbol] ?? t.name}
              </span>
              <span className={`font-mono tabular-nums font-semibold ${theme.value}`}>
                {fmt(t.value)}
              </span>
              {t.change_pct !== null && (
                <span
                  className={`inline-flex items-center gap-0.5 font-mono text-[10.5px] ${
                    up ? 'text-gain' : 'text-loss'
                  }`}
                >
                  {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  %{(t.change_pct * 100).toFixed(2)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
