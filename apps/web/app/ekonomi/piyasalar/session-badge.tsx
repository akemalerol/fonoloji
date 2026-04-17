'use client';

import * as React from 'react';
import { countryFlag, isSessionOpen, MARKET_META } from '@/lib/market-meta';

/**
 * Shows how many tickers in a group are open right now, and — on larger
 * screens — which specific exchanges are open (with flag emoji).
 */
export function MarketSessionBadge({ symbols }: { symbols: string[] }) {
  const [now, setNow] = React.useState(() => new Date());

  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const entries = symbols
    .map((s) => ({ symbol: s, meta: MARKET_META[s] }))
    .filter((e): e is { symbol: string; meta: NonNullable<(typeof MARKET_META)[string]> } => Boolean(e.meta));

  if (entries.length === 0) return null;

  const openEntries = entries.filter((e) => isSessionOpen(e.meta.window, now));
  const allOpen = openEntries.length === entries.length;
  const anyOpen = openEntries.length > 0;

  const label = allOpen ? 'Tümü açık' : anyOpen ? `${openEntries.length}/${entries.length} açık` : 'Kapalı';
  const color = allOpen ? 'text-emerald-300' : anyOpen ? 'text-amber-300' : 'text-muted-foreground';
  const dotClass = allOpen ? 'bg-emerald-400' : anyOpen ? 'bg-amber-400' : 'bg-muted-foreground/50';

  // Deduplicate by city so "Nasdaq / NYSE / Dow — New York" doesn't repeat three times.
  const seenCities = new Set<string>();
  const openCities = openEntries
    .map((e) => ({ city: e.meta.window.city ?? e.meta.shortLabel ?? e.symbol, country: e.meta.country }))
    .filter((c) => {
      if (seenCities.has(c.city)) return false;
      seenCities.add(c.city);
      return true;
    });

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 text-right">
      <div className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider ${color}`}>
        <span className="relative flex h-1.5 w-1.5">
          {anyOpen && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          )}
          <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${dotClass}`} />
        </span>
        {label}
      </div>

      {openCities.length > 0 && (
        <div className="hidden items-center gap-1 text-[10px] text-muted-foreground sm:inline-flex">
          <span className="text-muted-foreground/50">·</span>
          {openCities.map((c, i) => (
            <span key={c.city} className="inline-flex items-center gap-0.5">
              {c.country && <span className="text-xs leading-none">{countryFlag(c.country)}</span>}
              <span>{c.city}</span>
              {i < openCities.length - 1 && <span className="ml-1 text-muted-foreground/40">·</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
