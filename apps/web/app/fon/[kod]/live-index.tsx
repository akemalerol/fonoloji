'use client';

import { TrendingDown, TrendingUp } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

// /fon/BIST, /fon/USDTRY vb. endeks/kur sayfalarında hero'daki
// SSR-zaman statik fiyatının yerine canlı değer — live_market'ten 5sn polling.

interface Item {
  symbol: string;
  value: number;
  change_pct: number | null;
  previous: number | null;
  fetched_at: number;
}

interface LiveResp {
  items: Item[];
  updated_at: number | null;
}

interface Props {
  code: string;              // URL ticker (BIST, USDTRY, XU100, ALTIN, GUMUS)
  initialPrice: number;
  initialChange?: number | null;
}

// URL kodu → live_market.symbol eşleme
const CODE_TO_SYMBOL: Record<string, string> = {
  BIST: 'BIST100',
  BIST100: 'BIST100',
  XU100: 'BIST100',
  USDTRY: 'USDTRY',
  EURTRY: 'EURTRY',
  GBPTRY: 'GBPTRY',
  ALTIN: 'GOLDTRY_GR',
  GUMUS: 'SILVERTRY_GR',
};

function fmt(v: number, symbol: string): string {
  // Endeks 2 haneli, kur 4 haneli
  const isFx = symbol.endsWith('TRY');
  const digits = isFx ? 4 : 2;
  return v.toLocaleString('tr-TR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function LiveIndexPrice({ code, initialPrice, initialChange }: Props) {
  const symbol = CODE_TO_SYMBOL[code.toUpperCase()] ?? code.toUpperCase();
  const [price, setPrice] = React.useState(initialPrice);
  const [changePct, setChangePct] = React.useState<number | null>(
    initialChange !== undefined && initialChange !== null
      ? initialChange * 100  // fund.return_1d gibi fraction ise çarp
      : null,
  );
  const [fetchedAt, setFetchedAt] = React.useState<number | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch('/api/market/live', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as LiveResp;
      const match = data.items.find((i) => i.symbol === symbol);
      if (!match) return;
      setPrice(match.value);
      setChangePct(match.change_pct !== null ? match.change_pct * 100 : null);
      setFetchedAt(match.fetched_at);
    } catch {
      /* sessiz */
    }
  }, [symbol]);

  React.useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5_000);
    return () => clearInterval(t);
  }, [refresh]);

  const up = (changePct ?? 0) >= 0;
  const updatedTime = fetchedAt
    ? new Date(fetchedAt).toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Europe/Istanbul',
      })
    : null;

  return (
    <div>
      <div className="font-mono text-3xl tabular-nums md:text-4xl">{fmt(price, symbol)}</div>
      <div className="mt-1 flex items-center gap-2 text-xs md:justify-end">
        {changePct !== null && (
          <span
            className={cn(
              'inline-flex items-center gap-1 font-mono tabular-nums',
              up ? 'text-emerald-300' : 'text-rose-300',
            )}
          >
            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {up ? '+' : ''}
            {changePct.toFixed(2)}%
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          Canlı {updatedTime ? `· ${updatedTime}` : ''}
        </span>
      </div>
    </div>
  );
}
