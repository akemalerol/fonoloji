'use client';

import * as React from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Period = '1d' | '5d' | '1m' | '3m' | '6m' | '1y' | '5y' | 'max';
const PERIODS: Array<{ key: Period; label: string }> = [
  { key: '1d', label: '1G' },
  { key: '5d', label: '5G' },
  { key: '1m', label: '1A' },
  { key: '3m', label: '3A' },
  { key: '6m', label: '6A' },
  { key: '1y', label: '1Y' },
  { key: '5y', label: '5Y' },
  { key: 'max', label: 'Max' },
];

interface ChartData {
  ticker: string;
  currency: string | null;
  points: Array<{ date: number; price: number }>;
}

function fmtPrice(v: number, currency: string | null): string {
  const digits = v >= 100 ? 2 : 4;
  const s = v.toLocaleString('tr-TR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return currency === 'TRY' ? `₺${s}` : currency === 'USD' ? `$${s}` : currency === 'EUR' ? `€${s}` : s;
}

function fmtAxisDate(ts: number, period: Period): string {
  const d = new Date(ts);
  if (period === '1d' || period === '5d') {
    return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });
  }
  if (period === '1m' || period === '3m' || period === '6m' || period === '1y') {
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
  }
  return d.toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' });
}

function fmtTooltipDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  });
}

interface Props {
  ticker: string;
}

export function StockPriceChart({ ticker }: Props) {
  const [period, setPeriod] = React.useState<Period>('1y');
  const [data, setData] = React.useState<ChartData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/stocks/${encodeURIComponent(ticker)}/chart?period=${period}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: ChartData) => {
        if (cancelled) return;
        setData(d);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Hata');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [ticker, period]);

  const first = data?.points[0]?.price ?? 0;
  const last = data?.points[data.points.length - 1]?.price ?? 0;
  const change = first > 0 ? ((last - first) / first) * 100 : 0;
  const positive = change >= 0;
  const color = positive ? '#10B981' : '#F43F5E';

  return (
    <section className="mt-8 rounded-2xl border border-border/60 bg-card/40 p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="display text-2xl">Fiyat Grafiği</h2>
          {data && !loading && (
            <p className="mt-1 text-xs text-muted-foreground">
              {period.toUpperCase()} · {data.points.length} nokta ·{' '}
              <span className={cn('font-mono', positive ? 'text-emerald-300' : 'text-rose-300')}>
                {positive ? '+' : ''}
                {change.toFixed(2)}%
              </span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border border-border/50 bg-background/30 p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                'rounded-md px-2.5 py-1 text-[11px] font-semibold transition',
                period === p.key
                  ? 'bg-brand-500/20 text-brand-200 ring-1 ring-brand-500/40'
                  : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading && !data && (
        <div className="flex h-64 items-center justify-center text-xs text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Yükleniyor…
        </div>
      )}

      {error && !data && (
        <div className="flex h-64 items-center justify-center text-xs text-rose-300">
          Grafik yüklenemedi: {error}
        </div>
      )}

      {data && data.points.length > 0 && (
        <div className="relative">
          {loading && (
            <div className="absolute right-2 top-2 text-[10px] text-muted-foreground">
              <Loader2 className="inline h-3 w-3 animate-spin" />
            </div>
          )}
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={data.points} margin={{ top: 10, right: 6, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="stockFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#71717A"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                minTickGap={50}
                tickFormatter={(ts: number) => fmtAxisDate(ts, period)}
              />
              <YAxis
                stroke="#71717A"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                domain={['auto', 'auto']}
                tickFormatter={(v: number) => fmtPrice(v, data.currency)}
                width={70}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(ts: number) => fmtTooltipDate(ts)}
                formatter={(val: number) => [fmtPrice(val, data.currency), 'Fiyat']}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke={color}
                strokeWidth={2}
                fill="url(#stockFill)"
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {data && data.points.length === 0 && !loading && (
        <div className="flex h-64 items-center justify-center text-xs text-muted-foreground">
          Bu periyot için veri yok.
        </div>
      )}
    </section>
  );
}
