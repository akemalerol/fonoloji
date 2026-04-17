'use client';

import { ArrowRight, Search, TrendingDown, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn, formatCompact, formatCurrency, formatDate, formatPercent, formatPrice } from '@/lib/utils';

interface SearchHit {
  code: string;
  name: string;
  category?: string;
}

interface PricePoint {
  date: string;
  price: number;
}

const TRY = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });
const PRESETS = [
  { label: '1.000 ₺', value: 1000 },
  { label: '10.000 ₺', value: 10000 },
  { label: '50.000 ₺', value: 50000 },
  { label: '100.000 ₺', value: 100000 },
];

export function CalculatorClient() {
  const [code, setCode] = React.useState('');
  const [codeQuery, setCodeQuery] = React.useState('');
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [amount, setAmount] = React.useState(10000);
  const [startDate, setStartDate] = React.useState(() => {
    const d = new Date();
    d.setUTCFullYear(d.getUTCFullYear() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [history, setHistory] = React.useState<PricePoint[]>([]);
  const [fundName, setFundName] = React.useState<string | null>(null);
  const [cpi, setCpi] = React.useState<Array<{ date: string; yoy_change: number }>>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Fund search
  React.useEffect(() => {
    if (codeQuery.length < 2) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    fetch(`/api/search?q=${encodeURIComponent(codeQuery)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => setHits(d.items ?? []))
      .catch(() => {});
    return () => ctrl.abort();
  }, [codeQuery]);

  async function calculate() {
    if (!code) {
      setError('Önce bir fon seç');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [detailRes, historyRes, cpiRes] = await Promise.all([
        fetch(`/api/funds/${encodeURIComponent(code)}`).then((r) => r.json()),
        fetch(`/api/funds/${encodeURIComponent(code)}/history?period=all`).then((r) => r.json()),
        fetch(`/api/economy/cpi`).then((r) => r.json()).catch(() => ({ history: [] })),
      ]);
      setFundName(detailRes.fund?.name ?? code);
      setHistory(historyRes.points ?? []);
      setCpi(cpiRes.history ?? []);
    } catch (err) {
      setError('Veri alınamadı: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Compound monthly CPI between two dates. Each cpi entry has date (YYYY-MM-01) + yoy_change (annual YoY).
  // We compute cumulative inflation by chaining monthly m-o-m changes where available, else derive from YoY.
  function compoundInflation(startDate: string, endDate: string): number | null {
    if (cpi.length === 0) return null;
    const startM = startDate.slice(0, 7);
    const endM = endDate.slice(0, 7);
    const months = cpi
      .map((c) => ({ ym: c.date.slice(0, 7), yoy: c.yoy_change }))
      .filter((c) => c.ym >= startM && c.ym <= endM)
      .sort((a, b) => a.ym.localeCompare(b.ym));
    if (months.length < 2) return null;
    // Approximation: (1 + latest_yoy)^(months/12) as proxy — use real YoY chain:
    // If we have N months of YoY data, compound them geometrically as monthly returns.
    // Since YoY = annual, monthly equivalent ≈ (1+yoy)^(1/12) - 1
    const monthly = months.map((m) => Math.pow(1 + m.yoy, 1 / 12) - 1);
    return monthly.reduce((acc, r) => (1 + acc) * (1 + r) - 1, 0);
  }

  // Find start price ≥ start date
  const filtered = React.useMemo(() => {
    if (history.length === 0) return [];
    return history.filter((p) => p.date >= startDate);
  }, [history, startDate]);

  const summary = React.useMemo(() => {
    if (filtered.length < 2) return null;
    const startPrice = filtered[0]!.price;
    const endPrice = filtered[filtered.length - 1]!.price;
    const units = amount / startPrice;
    const endValue = units * endPrice;
    const totalReturn = (endValue - amount) / amount;

    const days =
      (new Date(filtered[filtered.length - 1]!.date).getTime() -
        new Date(filtered[0]!.date).getTime()) /
      86_400_000;
    const annualised = days > 30 ? Math.pow(1 + totalReturn, 365 / days) - 1 : null;

    let peak = startPrice * units;
    let maxDd = 0;
    const series = filtered.map((p) => {
      const value = units * p.price;
      if (value > peak) peak = value;
      const dd = (value - peak) / peak;
      if (dd < maxDd) maxDd = dd;
      return { date: p.date, value };
    });

    // Real (inflation-adjusted) return using CPI history
    const inflation = compoundInflation(filtered[0]!.date, filtered[filtered.length - 1]!.date);
    const realReturn = inflation !== null ? (1 + totalReturn) / (1 + inflation) - 1 : null;
    const realEndValue = inflation !== null ? amount * (1 + realReturn!) : null;

    return {
      startPrice,
      endPrice,
      startDate: filtered[0]!.date,
      endDate: filtered[filtered.length - 1]!.date,
      units,
      endValue,
      totalReturn,
      annualised,
      maxDd,
      series,
      inflation,
      realReturn,
      realEndValue,
    };
  }, [filtered, amount, cpi]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[400px_1fr]">
      {/* INPUTS */}
      <div className="panel space-y-5 p-6">
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
            Fon
          </label>
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={codeQuery}
                onChange={(e) => setCodeQuery(e.target.value)}
                placeholder={code || 'Kod veya isim yaz...'}
                className="pl-9"
              />
            </div>
            {hits.length > 0 && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-xl">
                {hits.slice(0, 8).map((h) => (
                  <button
                    key={h.code}
                    type="button"
                    onClick={() => {
                      setCode(h.code);
                      setCodeQuery('');
                      setHits([]);
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <span className="inline-flex h-6 w-12 items-center justify-center rounded bg-secondary/70 font-mono text-[10px] font-bold">
                      {h.code}
                    </span>
                    <span className="truncate">{h.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {code && !codeQuery && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-2 py-1 text-xs">
              <span className="font-mono font-semibold">{code}</span>
              <button onClick={() => setCode('')} className="text-muted-foreground hover:text-foreground">
                ✕
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
            Tutar (₺)
          </label>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            min={100}
            step={500}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => setAmount(p.value)}
                className={cn(
                  'rounded-full border border-border bg-secondary/40 px-3 py-1 text-xs hover:bg-secondary',
                  amount === p.value && 'border-brand-500 bg-brand-500/20 text-brand-400',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground">
            Başlangıç tarihi
          </label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              { label: '1Y', value: 365 },
              { label: '6A', value: 180 },
              { label: '3A', value: 90 },
              { label: '1A', value: 30 },
            ].map((p) => (
              <button
                key={p.value}
                onClick={() => {
                  const d = new Date();
                  d.setUTCDate(d.getUTCDate() - p.value);
                  setStartDate(d.toISOString().slice(0, 10));
                }}
                className="rounded-full border border-border bg-secondary/40 px-3 py-1 text-xs hover:bg-secondary"
              >
                {p.label} önce
              </button>
            ))}
          </div>
        </div>

        <Button onClick={calculate} disabled={loading} className="w-full">
          {loading ? 'Hesaplanıyor…' : 'Hesapla'}
        </Button>
        {error && (
          <div className="rounded-md border border-loss/30 bg-loss/10 p-3 text-xs text-loss">{error}</div>
        )}
      </div>

      {/* RESULTS */}
      {summary ? (
        <div className="space-y-6">
          <div className="panel p-6">
            {fundName && (
              <Link
                href={`/fon/${code}`}
                className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300"
              >
                {code} — {fundName} <ArrowRight className="h-3 w-3" />
              </Link>
            )}
            <div className="mt-4 grid grid-cols-2 gap-6 md:grid-cols-4">
              <Cell label="Bugünkü değer" value={formatCurrency(summary.endValue)} highlight />
              <Cell
                label="Toplam getiri"
                value={formatPercent(summary.totalReturn)}
                positive={summary.totalReturn > 0}
                negative={summary.totalReturn < 0}
              />
              <Cell
                label="Yıllıklandırılmış"
                value={summary.annualised !== null ? formatPercent(summary.annualised) : '—'}
                positive={(summary.annualised ?? 0) > 0}
                negative={(summary.annualised ?? 0) < 0}
              />
              <Cell label="Max düşüş" value={formatPercent(summary.maxDd)} negative />
            </div>

            {summary.realReturn !== null && summary.realEndValue !== null && summary.inflation !== null && (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                    TÜFE'den arındırılmış (reel)
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Dönem enflasyonu: <span className="font-mono text-foreground">{formatPercent(summary.inflation)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                  <Cell
                    label="Reel değer (bugünün TL'si)"
                    value={formatCurrency(summary.realEndValue)}
                  />
                  <Cell
                    label="Reel getiri"
                    value={formatPercent(summary.realReturn)}
                    positive={summary.realReturn > 0}
                    negative={summary.realReturn < 0}
                  />
                  <Cell
                    label="Alım gücü değişimi"
                    value={summary.realReturn > 0 ? `+${formatPercent(summary.realReturn).replace('+', '')}` : formatPercent(summary.realReturn)}
                    positive={summary.realReturn > 0}
                    negative={summary.realReturn < 0}
                  />
                </div>
                <p className="mt-3 text-[11px] text-muted-foreground/80">
                  {summary.realReturn > 0
                    ? `Bu yatırım enflasyonu ${formatPercent(summary.realReturn).replace('-', '')} kadar yendi — alım gücün arttı.`
                    : `Nominal kazanç olsa da enflasyon karşısında alım gücün ${formatPercent(Math.abs(summary.realReturn)).replace('-', '')} eridi.`}
                </p>
              </div>
            )}
            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border/50 pt-4 text-xs md:grid-cols-4">
              <Detail label="Başlangıç" value={formatDate(summary.startDate)} />
              <Detail label="Bitiş" value={formatDate(summary.endDate)} />
              <Detail label="Birim sayısı" value={`${TRY.format(summary.units)} adet`} />
              <Detail
                label="Birim fiyatı"
                value={`${formatPrice(summary.startPrice, 4)} → ${formatPrice(summary.endPrice, 4)}`}
              />
            </div>
          </div>

          <div className="panel p-6">
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              {summary.totalReturn >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5 text-gain" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-loss" />
              )}
              Yatırımının zaman içindeki değeri
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={summary.series} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="calcFill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={summary.totalReturn >= 0 ? '#10B981' : '#F43F5E'}
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="100%"
                      stopColor={summary.totalReturn >= 0 ? '#10B981' : '#F43F5E'}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  stroke="#71717A"
                  fontSize={10}
                  minTickGap={60}
                />
                <YAxis
                  stroke="#71717A"
                  fontSize={10}
                  tickFormatter={(v) => formatCompact(Number(v))}
                  width={70}
                />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(17,17,19,0.95)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [formatCurrency(v), 'Değer']}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={summary.totalReturn >= 0 ? '#10B981' : '#F43F5E'}
                  strokeWidth={2}
                  fill="url(#calcFill)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="panel flex min-h-[400px] items-center justify-center p-10 text-center text-sm text-muted-foreground">
          {loading ? 'Hesaplanıyor…' : 'Sol tarafta fon, tutar ve tarih seç, "Hesapla" bas.'}
        </div>
      )}
    </div>
  );
}

function Cell({
  label,
  value,
  highlight,
  positive,
  negative,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={cn(
          'mt-1 font-mono text-2xl tabular-nums md:text-3xl',
          highlight && 'text-brand-400',
          positive && 'text-gain',
          negative && 'text-loss',
        )}
      >
        {value}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono">{value}</div>
    </div>
  );
}
