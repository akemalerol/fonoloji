'use client';

import { History, Loader2, Plus, Trash2 } from 'lucide-react';
import * as React from 'react';
import { api } from '@/lib/api';
import { cn, formatCompact, formatCurrency } from '@/lib/utils';

interface Row { code: string; weight: string }

interface PortfolioResult {
  firstDate: string;
  lastDate: string;
  initialValue: number;
  finalValue: number;
  totalReturnPct: number;
  annualizedPct: number;
  maxDrawdownPct: number;
  sharpe: number | null;
  points: Array<{ date: string; value: number }>;
  rebalanceCount: number;
}

const PERIODS = [
  { label: '1 yıl', period: '1y' as const },
  { label: '3 yıl', period: '5y' as const },
  { label: '5 yıl', period: '5y' as const },
  { label: 'Tümü', period: 'all' as const },
];

export function BacktestClient() {
  const [rows, setRows] = React.useState<Row[]>([
    { code: '', weight: '' },
    { code: '', weight: '' },
  ]);
  const [initial, setInitial] = React.useState('100000');
  const [periodKey, setPeriodKey] = React.useState<'1y' | '5y' | 'all'>('1y');
  const [periodLabel, setPeriodLabel] = React.useState('1 yıl');
  const [rebalance, setRebalance] = React.useState<'none' | 'quarterly' | 'yearly'>('none');
  const [result, setResult] = React.useState<PortfolioResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const totalW = rows.reduce((s, r) => s + (Number(r.weight) || 0), 0);

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((xs) => xs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() { if (rows.length < 10) setRows([...rows, { code: '', weight: '' }]); }
  function removeRow(i: number) { if (rows.length > 1) setRows(rows.filter((_, idx) => idx !== i)); }
  function equalize() {
    const filled = rows.filter((r) => r.code.trim());
    if (filled.length === 0) return;
    const w = (100 / filled.length).toFixed(1);
    setRows(rows.map((r) => (r.code.trim() ? { ...r, weight: w } : r)));
  }

  async function run() {
    setError(null);
    const funds = rows
      .filter((r) => r.code.trim() && Number(r.weight) > 0)
      .map((r) => ({ code: r.code.trim().toUpperCase(), weight: Number(r.weight) }));
    if (funds.length === 0) { setError('En az 1 fon + ağırlık gerekli'); return; }
    const initialTl = Number(initial);
    if (!Number.isFinite(initialTl) || initialTl <= 0) { setError('Geçersiz başlangıç tutarı'); return; }

    setLoading(true);
    try {
      // Her fon için fiyat serisi çek
      const series = await Promise.all(
        funds.map(async (f) => {
          const h = await api.getHistory(f.code, periodKey);
          return { ...f, points: h.points as Array<{ date: string; price: number }> };
        }),
      );
      if (series.some((s) => !s.points || s.points.length < 10)) {
        setError('Bir veya birden fazla fonun yeterli geçmiş verisi yok'); return;
      }

      // Ortak tarih seti — tüm fonlarda olan tarihler (intersection)
      const dateSets = series.map((s) => new Set(s.points.map((p) => p.date)));
      const firstSet = dateSets[0]!;
      const commonDates: string[] = [];
      for (const d of firstSet) {
        if (dateSets.every((ds) => ds.has(d))) commonDates.push(d);
      }
      commonDates.sort();
      if (commonDates.length < 10) { setError('Ortak veri dönemi çok kısa'); return; }

      // Price map: code -> date -> price
      const priceMap = new Map<string, Map<string, number>>();
      for (const s of series) {
        const m = new Map<string, number>();
        for (const p of s.points) m.set(p.date, p.price);
        priceMap.set(s.code, m);
      }

      // Normalize weights
      const totalInputW = funds.reduce((a, f) => a + f.weight, 0);
      const normalized = funds.map((f) => ({ code: f.code, weight: f.weight / totalInputW }));

      // Initialize units
      const firstDate = commonDates[0]!;
      const units = new Map<string, number>();
      for (const n of normalized) {
        const p = priceMap.get(n.code)!.get(firstDate)!;
        units.set(n.code, (initialTl * n.weight) / p);
      }

      // Rebalance period → days
      const rebalDays = rebalance === 'quarterly' ? 90 : rebalance === 'yearly' ? 365 : 0;
      let lastRebalanceDate = firstDate;
      let rebalanceCount = 0;

      const points: Array<{ date: string; value: number }> = [];
      let runningMax = initialTl;
      let maxDd = 0;
      const returns: number[] = [];
      let prevValue = initialTl;

      for (const d of commonDates) {
        let totalValue = 0;
        for (const n of normalized) {
          const p = priceMap.get(n.code)!.get(d)!;
          totalValue += (units.get(n.code) ?? 0) * p;
        }
        points.push({ date: d, value: totalValue });

        if (prevValue > 0 && d !== firstDate) {
          returns.push((totalValue - prevValue) / prevValue);
        }
        prevValue = totalValue;

        if (totalValue > runningMax) runningMax = totalValue;
        const dd = (totalValue - runningMax) / runningMax;
        if (dd < maxDd) maxDd = dd;

        // Rebalance check
        if (rebalDays > 0) {
          const diffDays = (new Date(d).getTime() - new Date(lastRebalanceDate).getTime()) / 86_400_000;
          if (diffDays >= rebalDays) {
            for (const n of normalized) {
              const p = priceMap.get(n.code)!.get(d)!;
              units.set(n.code, (totalValue * n.weight) / p);
            }
            lastRebalanceDate = d;
            rebalanceCount++;
          }
        }
      }

      const lastDate = commonDates[commonDates.length - 1]!;
      const finalValue = points[points.length - 1]!.value;
      const totalReturnPct = (finalValue - initialTl) / initialTl;
      const yearsElapsed = (new Date(lastDate).getTime() - new Date(firstDate).getTime()) / (365.25 * 86_400_000);
      const annualizedPct = yearsElapsed > 0 ? Math.pow(finalValue / initialTl, 1 / yearsElapsed) - 1 : 0;

      // Sharpe (daily returns, annualize)
      let sharpe: number | null = null;
      if (returns.length > 30) {
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
        const stdev = Math.sqrt(variance);
        if (stdev > 0) sharpe = (mean * 252) / (stdev * Math.sqrt(252));
      }

      setResult({
        firstDate, lastDate,
        initialValue: initialTl,
        finalValue,
        totalReturnPct,
        annualizedPct,
        maxDrawdownPct: maxDd,
        sharpe,
        points,
        rebalanceCount,
      });
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  return (
    <div className="container py-10 md:py-14">
      <div className="mb-10 border-b border-border/50 pb-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <History className="h-3 w-3 text-amber-400" /> Araç
        </div>
        <h1 className="display mt-2 text-5xl leading-none md:text-6xl">
          Portföy <span className="display-italic gradient-text">geri-testi</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          2-10 fondan oluşan portföyü geçmişe karşı test et. Yıllık getiri, Sharpe,
          max drawdown ve rebalancing'in etkisini gör.
        </p>
      </div>

      <div className="panel mb-6 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Fonlar + ağırlıklar</h2>
          <div className="flex items-center gap-2">
            <span className={cn('font-mono text-xs tabular-nums', Math.abs(totalW - 100) < 0.1 ? 'text-emerald-400' : 'text-amber-300')}>
              toplam: %{totalW.toFixed(1)}
            </span>
            <button onClick={equalize} className="rounded-md border border-border/50 bg-background/40 px-2 py-1 text-[11px] text-muted-foreground hover:border-brand-500/40">
              Eşit böl
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={r.code}
                onChange={(e) => updateRow(i, { code: e.target.value.toUpperCase() })}
                placeholder="Kod (örn. TTE)"
                className="flex-1 rounded-lg border border-border bg-background/40 px-3 py-2 font-mono text-sm uppercase outline-none focus:border-brand-500/50"
              />
              <input
                type="number" min="0" max="100" step="0.1"
                value={r.weight}
                onChange={(e) => updateRow(i, { weight: e.target.value })}
                placeholder="%"
                className="w-24 rounded-lg border border-border bg-background/40 px-3 py-2 text-sm tabular-nums outline-none focus:border-brand-500/50"
              />
              <button onClick={() => removeRow(i)} className="rounded p-2 text-muted-foreground hover:bg-loss/20 hover:text-loss">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <button onClick={addRow} disabled={rows.length >= 10} className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background/40 px-3 py-1.5 text-xs text-muted-foreground hover:border-brand-500/40 disabled:opacity-40">
          <Plus className="h-3 w-3" /> Fon ekle
        </button>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Başlangıç (TL)</label>
            <input
              type="number" min="1" step="1000" value={initial}
              onChange={(e) => setInitial(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background/40 px-3 py-2 font-mono text-sm tabular-nums outline-none focus:border-brand-500/50"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Dönem</label>
            <div className="mt-1 flex flex-wrap gap-1">
              {PERIODS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => { setPeriodKey(p.period); setPeriodLabel(p.label); }}
                  className={cn('rounded-md border px-2 py-1 font-mono text-[11px]', periodLabel === p.label ? 'border-brand-500/50 bg-brand-500/10 text-brand-200' : 'border-border/50 bg-background/40 text-muted-foreground')}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Rebalancing</label>
            <div className="mt-1 flex flex-wrap gap-1">
              {[['none','Yok'],['quarterly','3 aylık'],['yearly','Yıllık']].map(([k,l]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setRebalance(k as typeof rebalance)}
                  className={cn('rounded-md border px-2 py-1 font-mono text-[11px]', rebalance === k ? 'border-brand-500/50 bg-brand-500/10 text-brand-200' : 'border-border/50 bg-background/40 text-muted-foreground')}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={run}
          disabled={loading}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-500 to-verdigris-400 px-5 py-2 text-sm font-semibold text-background shadow-lg shadow-brand-500/20 disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Geri-test yap
        </button>
        {error && (
          <div className="mt-3 rounded-lg border border-loss/40 bg-loss/10 px-3 py-2 text-xs text-loss">{error}</div>
        )}
      </div>

      {result && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="panel p-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Toplam Getiri</div>
              <div className={cn('mt-1 font-mono text-2xl font-semibold tabular-nums', result.totalReturnPct > 0 ? 'text-gain' : 'text-loss')}>
                {result.totalReturnPct > 0 ? '+' : ''}%{(result.totalReturnPct * 100).toFixed(1)}
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">{result.firstDate} → {result.lastDate}</div>
            </div>
            <div className="panel p-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Yıllık ort.</div>
              <div className={cn('mt-1 font-mono text-2xl font-semibold tabular-nums', result.annualizedPct > 0 ? 'text-gain' : 'text-loss')}>
                %{(result.annualizedPct * 100).toFixed(1)}
              </div>
            </div>
            <div className="panel p-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Max Drawdown</div>
              <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-loss">
                %{(result.maxDrawdownPct * 100).toFixed(1)}
              </div>
            </div>
            <div className="panel p-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Sharpe</div>
              <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">
                {result.sharpe !== null ? result.sharpe.toFixed(2) : '—'}
              </div>
            </div>
          </div>

          <div className="panel p-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Değer grafiği
              </h3>
              <span className="font-mono text-xs text-muted-foreground">
                {formatCurrency(result.initialValue)} → {formatCurrency(result.finalValue)}
              </span>
            </div>
            {/* Basit inline grafik — küçük bar chart */}
            <MiniChart points={result.points} initial={result.initialValue} />
            <div className="mt-4 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
              <span>Başlangıç: <strong className="text-foreground">{formatCompact(result.initialValue)}</strong></span>
              <span>Final: <strong className="text-foreground">{formatCompact(result.finalValue)}</strong></span>
              <span>Rebalance: <strong className="text-foreground">{result.rebalanceCount} kez</strong></span>
              <span>Gün sayısı: <strong className="text-foreground">{result.points.length}</strong></span>
            </div>
          </div>
        </>
      )}

      <p className="mt-16 text-center text-xs text-muted-foreground">
        Geçmiş performans gelecek performansın garantisi değildir · Vergi/komisyon hariç
      </p>
    </div>
  );
}

function MiniChart({ points, initial }: { points: Array<{ date: string; value: number }>; initial: number }) {
  if (points.length < 2) return null;
  const values = points.map((p) => p.value);
  const min = Math.min(...values, initial);
  const max = Math.max(...values, initial);
  const range = max - min || 1;
  const w = 800;
  const h = 200;

  // Subsample for performance — max 400 points
  const step = Math.max(1, Math.floor(points.length / 400));
  const sampled = points.filter((_, i) => i % step === 0);

  const path = sampled
    .map((p, i) => {
      const x = (i / (sampled.length - 1)) * w;
      const y = h - ((p.value - min) / range) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const initialY = h - ((initial - min) / range) * h;
  const last = sampled[sampled.length - 1]!;
  const profitable = last.value >= initial;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" preserveAspectRatio="none">
      <line x1={0} y1={initialY} x2={w} y2={initialY} stroke="currentColor" strokeDasharray="4 4" className="text-muted-foreground/30" />
      <path d={path} fill="none" strokeWidth="2" className={profitable ? 'text-gain' : 'text-loss'} stroke="currentColor" />
      <path d={`${path} L${w},${h} L0,${h} Z`} fill="currentColor" className={profitable ? 'text-gain/10' : 'text-loss/10'} />
    </svg>
  );
}
