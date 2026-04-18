'use client';

import { Calendar, Calculator, Loader2, TrendingUp } from 'lucide-react';
import * as React from 'react';
import { api } from '@/lib/api';
import { cn, formatCompact, formatCurrency } from '@/lib/utils';

interface SimResult {
  totalInvested: number;
  finalValue: number;
  profitTry: number;
  profitPct: number;
  totalUnits: number;
  avgCost: number;
  lastPrice: number;
  monthlyRows: Array<{ date: string; price: number; units: number; invested: number; value: number }>;
  periodMonths: number;
  firstDate: string;
  lastDate: string;
  lumpSumValue: number;  // comparison: hepsini başta yatırsaydın
  lumpSumProfit: number;
}

const START_DATES = [
  { label: '6 ay', months: 6 },
  { label: '1 yıl', months: 12 },
  { label: '2 yıl', months: 24 },
  { label: '3 yıl', months: 36 },
  { label: '5 yıl', months: 60 },
];

export function DcaClient() {
  const [code, setCode] = React.useState('TTE');
  const [monthly, setMonthly] = React.useState('1000');
  const [months, setMonths] = React.useState(12);
  const [result, setResult] = React.useState<SimResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function run() {
    setError(null);
    const monthlyTl = Number(monthly);
    if (!code.trim() || !Number.isFinite(monthlyTl) || monthlyTl <= 0) {
      setError('Fon kodu ve aylık miktar gerekli'); return;
    }
    setLoading(true);
    try {
      const period = months >= 60 ? '5y' : months >= 36 ? '5y' : months >= 12 ? '1y' : months >= 6 ? '6m' : '6m';
      const hist = await api.getHistory(code.trim(), period);
      if (!hist.points || hist.points.length === 0) {
        setError('Bu fonun geçmiş verisi yok'); return;
      }
      // Filter to requested window
      const nowMs = Date.now();
      const cutoffMs = nowMs - months * 30.44 * 86_400_000;
      const points = hist.points.filter((p) => new Date(p.date).getTime() >= cutoffMs);
      if (points.length < 30) {
        setError(`${months} aylık yeterli veri yok`); return;
      }

      // Monthly buy: alış her ayın ilk available gününde
      const monthlyBuys: Array<{ date: string; price: number }> = [];
      const seenMonth = new Set<string>();
      for (const p of points) {
        const ym = p.date.slice(0, 7);
        if (!seenMonth.has(ym)) {
          seenMonth.add(ym);
          monthlyBuys.push({ date: p.date, price: p.price });
        }
      }

      const rows: SimResult['monthlyRows'] = [];
      let totalUnits = 0;
      let totalInvested = 0;
      const lastPrice = points[points.length - 1]!.price;

      for (const b of monthlyBuys) {
        const units = monthlyTl / b.price;
        totalUnits += units;
        totalInvested += monthlyTl;
        rows.push({
          date: b.date,
          price: b.price,
          units,
          invested: totalInvested,
          value: totalUnits * lastPrice,
        });
      }

      const finalValue = totalUnits * lastPrice;
      const profitTry = finalValue - totalInvested;
      const profitPct = totalInvested > 0 ? (finalValue - totalInvested) / totalInvested : 0;
      const avgCost = totalUnits > 0 ? totalInvested / totalUnits : 0;

      // Lump-sum comparison: aynı toplam tutarı başlangıçta yatırsaydı
      const firstPrice = monthlyBuys[0]?.price ?? 0;
      const lumpUnits = firstPrice > 0 ? totalInvested / firstPrice : 0;
      const lumpSumValue = lumpUnits * lastPrice;

      setResult({
        totalInvested,
        finalValue,
        profitTry,
        profitPct,
        totalUnits,
        avgCost,
        lastPrice,
        monthlyRows: rows,
        periodMonths: rows.length,
        firstDate: monthlyBuys[0]?.date ?? '',
        lastDate: points[points.length - 1]?.date ?? '',
        lumpSumValue,
        lumpSumProfit: lumpSumValue - totalInvested,
      });
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  return (
    <div className="container py-10 md:py-14">
      <div className="mb-10 border-b border-border/50 pb-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <Calculator className="h-3 w-3 text-verdigris-400" /> Araç
        </div>
        <h1 className="display mt-2 text-5xl leading-none md:text-6xl">
          DCA <span className="display-italic gradient-text">hesabı</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          "Eğer aylık düzenli yatırsaydım..." — geçmişe dönüp dollar-cost averaging sonucunu
          hesaplar. Düzenli aylık katkı vs. tek seferde yatırma karşılaştırması da dahil.
          Davranışsal bir düşünce egzersizi — yatırım tavsiyesi değildir.
        </p>
      </div>

      <div className="panel mb-6 p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Fon kodu
            </label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="TTE"
              className="mt-1 w-full rounded-lg border border-border bg-background/40 px-3 py-2 font-mono text-sm uppercase outline-none focus:border-brand-500/50"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Aylık yatırım (TL)
            </label>
            <input
              type="number" min="1" step="100"
              value={monthly}
              onChange={(e) => setMonthly(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background/40 px-3 py-2 font-mono text-sm tabular-nums outline-none focus:border-brand-500/50"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Dönem
            </label>
            <div className="mt-1 flex flex-wrap gap-1">
              {START_DATES.map((d) => (
                <button
                  key={d.months}
                  type="button"
                  onClick={() => setMonths(d.months)}
                  className={cn(
                    'rounded-md border px-2 py-1 font-mono text-[11px] transition',
                    months === d.months
                      ? 'border-brand-500/50 bg-brand-500/10 text-brand-200'
                      : 'border-border/50 bg-background/40 text-muted-foreground hover:border-brand-500/40',
                  )}
                >
                  {d.label}
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
          Hesapla
        </button>
        {error && (
          <div className="mt-3 rounded-lg border border-loss/40 bg-loss/10 px-3 py-2 text-xs text-loss">
            {error}
          </div>
        )}
      </div>

      {result && <DcaResult result={result} code={code} />}

      <p className="mt-16 text-center text-xs text-muted-foreground">
        Hesaplama fiyat değişimlerine bakar — vergi, stopaj ve komisyonlar hariç · Yatırım tavsiyesi değildir
      </p>
    </div>
  );
}

function DcaResult({ result, code }: { result: SimResult; code: string }) {
  const profitable = result.profitTry > 0;
  const dcaBetter = result.finalValue > result.lumpSumValue;

  return (
    <>
      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="panel p-5">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Calendar className="h-3 w-3" /> Toplam yatırım
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums">
            {formatCurrency(result.totalInvested)}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {result.periodMonths} ay · {result.firstDate} → {result.lastDate}
          </div>
        </div>

        <div className="panel p-5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Bugünkü değer
          </div>
          <div className="mt-2 font-mono text-2xl font-semibold tabular-nums">
            {formatCurrency(result.finalValue)}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {result.totalUnits.toFixed(2)} adet × {result.lastPrice.toFixed(4)} TL
          </div>
        </div>

        <div className={cn('panel p-5', profitable ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-loss/30 bg-loss/5')}>
          <div className={cn('flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider', profitable ? 'text-emerald-300' : 'text-loss')}>
            <TrendingUp className="h-3 w-3" /> Kar/Zarar
          </div>
          <div className={cn('mt-2 font-mono text-2xl font-semibold tabular-nums', profitable ? 'text-emerald-300' : 'text-loss')}>
            {profitable ? '+' : ''}{formatCurrency(result.profitTry)}
          </div>
          <div className={cn('mt-1 text-[11px]', profitable ? 'text-emerald-300/80' : 'text-loss/80')}>
            {profitable ? '+' : ''}%{(result.profitPct * 100).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Comparison: DCA vs lump-sum */}
      <div className="panel mb-6 p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          DCA vs Tek Seferlik Yatırım
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className={cn('rounded-lg border p-4', dcaBetter ? 'border-brand-500/50 bg-brand-500/5' : 'border-border/40')}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">Aylık DCA</span>
              {dcaBetter && <span className="text-[10px] font-semibold text-brand-300">KAZANDIĞIN</span>}
            </div>
            <div className="mt-2 font-mono text-lg font-semibold tabular-nums">
              {formatCurrency(result.finalValue)}
            </div>
            <div className={cn('text-xs', result.profitTry > 0 ? 'text-emerald-300' : 'text-loss')}>
              {result.profitTry > 0 ? '+' : ''}{formatCurrency(result.profitTry)}
            </div>
          </div>
          <div className={cn('rounded-lg border p-4', !dcaBetter ? 'border-brand-500/50 bg-brand-500/5' : 'border-border/40')}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">Tek seferde</span>
              {!dcaBetter && <span className="text-[10px] font-semibold text-brand-300">KAZANDIĞIN</span>}
            </div>
            <div className="mt-2 font-mono text-lg font-semibold tabular-nums">
              {formatCurrency(result.lumpSumValue)}
            </div>
            <div className={cn('text-xs', result.lumpSumProfit > 0 ? 'text-emerald-300' : 'text-loss')}>
              {result.lumpSumProfit > 0 ? '+' : ''}{formatCurrency(result.lumpSumProfit)}
            </div>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Aynı toplam tutarı ({formatCompact(result.totalInvested)}) başlangıçta yatırmış olsaydın yukarıdaki sonuç çıkardı.
          Fark: <strong>{formatCurrency(Math.abs(result.finalValue - result.lumpSumValue))}</strong>.
        </p>
      </div>

      {/* Monthly rows */}
      <div className="panel p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Aylık alışlar
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="pb-2 text-left">Ay</th>
                <th className="pb-2 text-right">Fiyat</th>
                <th className="pb-2 text-right">Adet</th>
                <th className="pb-2 text-right">Kümülatif yatırım</th>
                <th className="pb-2 text-right">Günümüz değeri</th>
              </tr>
            </thead>
            <tbody>
              {result.monthlyRows.map((r) => (
                <tr key={r.date} className="border-t border-border/30">
                  <td className="py-2 font-mono tabular-nums">{r.date.slice(0, 7)}</td>
                  <td className="py-2 text-right font-mono tabular-nums">{r.price.toFixed(4)}</td>
                  <td className="py-2 text-right font-mono tabular-nums text-muted-foreground">{r.units.toFixed(2)}</td>
                  <td className="py-2 text-right font-mono tabular-nums">{formatCompact(r.invested)}</td>
                  <td className={cn('py-2 text-right font-mono tabular-nums', r.value >= r.invested ? 'text-emerald-300' : 'text-loss')}>
                    {formatCompact(r.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
