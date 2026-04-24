'use client';

import { TrendingDown, TrendingUp } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

interface PriceData {
  name?: string | null;
  price: number | null;
  previous: number | null;
  changePct: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  currency: string | null;
  marketState: string | null;
  isDelayed: boolean;
  delayMinutes: number;
  fetchedAt: number;
}

interface Props {
  ticker: string;
  initial?: PriceData | null;
}

function fmtPrice(v: number | null, currency: string | null): string {
  if (v === null || !Number.isFinite(v)) return '—';
  const digits = v >= 100 ? 2 : 4;
  return v.toLocaleString('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function symbolForCurrency(c: string | null): string {
  if (c === 'TRY') return '₺';
  if (c === 'USD') return '$';
  if (c === 'EUR') return '€';
  if (c === 'GBP') return '£';
  if (c === 'JPY') return '¥';
  return c ? ` ${c}` : '';
}

export function LivePrice({ ticker, initial }: Props) {
  const [data, setData] = React.useState<PriceData | null>(initial ?? null);
  const [loading, setLoading] = React.useState(!initial);

  const fetchPrice = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/stocks/${encodeURIComponent(ticker)}/price`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const json = (await res.json()) as PriceData;
        setData(json);
      }
    } catch {
      /* sessiz */
    } finally {
      setLoading(false);
    }
  }, [ticker]);

  React.useEffect(() => {
    fetchPrice();
    // Sadece piyasa açıkken polling; kapalı olunca son değer zaten DB'de
    const poll = setInterval(() => {
      if (data?.marketState === 'REGULAR' || data?.marketState === 'PRE' || data?.marketState === 'POST') {
        fetchPrice();
      }
    }, 30_000);
    return () => clearInterval(poll);
  }, [fetchPrice, data?.marketState]);

  if (loading && !data) {
    return (
      <div className="mt-4 h-16 w-48 animate-pulse rounded-lg bg-muted/20" />
    );
  }

  if (!data || data.price === null) {
    return (
      <div className="mt-4 text-xs text-muted-foreground">Canlı fiyat verisi yok</div>
    );
  }

  const pct = data.changePct ?? 0;
  const up = pct >= 0;
  const sym = symbolForCurrency(data.currency);

  // Market state badge
  let statusLabel: string;
  let statusColor: string;
  if (data.marketState === 'REGULAR') {
    statusLabel = data.isDelayed ? `Canlı · ${data.delayMinutes}dk gecikmeli` : 'Canlı';
    statusColor = data.isDelayed ? 'text-amber-300' : 'text-emerald-300';
  } else if (data.marketState === 'PRE') {
    statusLabel = 'Açılış öncesi';
    statusColor = 'text-sky-300';
  } else if (data.marketState === 'POST' || data.marketState === 'POSTPOST') {
    statusLabel = 'Kapanış sonrası';
    statusColor = 'text-sky-300';
  } else {
    statusLabel = 'Son kapanış';
    statusColor = 'text-muted-foreground';
  }

  const updatedTime = new Date(data.fetchedAt).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  });

  return (
    <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-2">
      <div>
        <div className="font-mono text-4xl tabular-nums md:text-5xl">
          <span>{sym}</span>
          {fmtPrice(data.price, data.currency)}
        </div>
        <div
          className={cn(
            'mt-1 inline-flex items-center gap-1 font-mono text-sm tabular-nums',
            up ? 'text-emerald-300' : 'text-rose-300',
          )}
        >
          {up ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          <span>
            {up ? '+' : ''}
            {pct.toFixed(2)}%
          </span>
          {data.previous !== null && (
            <span className="ml-2 text-muted-foreground">
              önceki: {sym}{fmtPrice(data.previous, data.currency)}
            </span>
          )}
        </div>
      </div>
      <div className="text-[10px] leading-relaxed text-muted-foreground">
        <div>
          <span className={cn('inline-flex items-center gap-1', statusColor)}>
            {data.marketState === 'REGULAR' && (
              <span className="relative inline-flex h-1.5 w-1.5">
                <span
                  className={cn(
                    'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
                    data.isDelayed ? 'bg-amber-400' : 'bg-emerald-400',
                  )}
                />
                <span
                  className={cn(
                    'relative inline-flex h-1.5 w-1.5 rounded-full',
                    data.isDelayed ? 'bg-amber-400' : 'bg-emerald-400',
                  )}
                />
              </span>
            )}
            {statusLabel}
          </span>
          {' · '}
          <span className="font-mono">{updatedTime}</span>
        </div>
        {(data.dayHigh !== null || data.dayLow !== null) && (
          <div className="mt-0.5">
            Günlük: {data.dayLow !== null ? `${sym}${fmtPrice(data.dayLow, data.currency)}` : '—'}
            {' — '}
            {data.dayHigh !== null ? `${sym}${fmtPrice(data.dayHigh, data.currency)}` : '—'}
          </div>
        )}
      </div>
    </div>
  );
}
