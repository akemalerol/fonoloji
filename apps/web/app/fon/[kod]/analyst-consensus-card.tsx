'use client';

import { ChevronDown, ChevronUp, Sparkles, TrendingUp } from 'lucide-react';
import * as React from 'react';
import { cn, formatPercent, formatPrice } from '@/lib/utils';

// "Analist Konsensüsü" kartı — fon portföyündeki hisseler için İş Yatırım'ın
// analist verilerini ağırlıklı ortalamaya dönüştürür. Kapsamadaki hisselerin
// getiri potansiyellerini fon içindeki ağırlıkları ile weighted.
//
// "İş Yatırım analist verilerine göre hesaplanmıştır" disclaimer'ı UI'da
// görünür olmalı — veri İş Yatırım'ın parametrik tarayıcısından (tr-tr/analiz/hisse) geliyor.

interface Item {
  ticker: string;
  name: string | null;
  weight: number;
  closePrice: number | null;
  targetPrice: number | null;
  potentialPct: number | null;
  peRatio: number | null;
  recommendation: string | null;
}

interface Props {
  reportDate: string | null;
  stocksAsOfDate: string | null;
  totalWeight: number;
  coveredWeight: number;
  coverage: number;
  weightedPotential: number | null;
  recCount: Record<string, number>;
  items: Item[];
}

function recStyle(rec: string | null): { label: string; cls: string } {
  switch (rec) {
    case 'AL':
      return { label: 'AL', cls: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30' };
    case 'SAT':
      return { label: 'SAT', cls: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30' };
    case 'TUT':
      return { label: 'TUT', cls: 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30' };
    case 'GÖZDEN GEÇİRİLİYOR':
      return { label: 'GG', cls: 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30' };
    default:
      return { label: '—', cls: 'bg-muted/30 text-muted-foreground' };
  }
}

function formatTrDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function AnalystConsensusCard(props: Props) {
  const [expanded, setExpanded] = React.useState(false);

  if (!props.reportDate || props.items.length === 0) return null;

  const covered = props.items.filter((i) => i.potentialPct !== null && i.targetPrice !== null);
  const uncovered = props.items.filter((i) => i.potentialPct === null);
  const visibleItems = expanded ? props.items : props.items.slice(0, 8);

  const potential = props.weightedPotential;
  const potentialDirection = potential === null ? 'neutral' : potential >= 0 ? 'up' : 'down';

  const totalRecWithCoverage =
    (props.recCount.AL ?? 0) +
    (props.recCount.TUT ?? 0) +
    (props.recCount.SAT ?? 0) +
    (props.recCount['GÖZDEN GEÇİRİLİYOR'] ?? 0);

  return (
    <section className="mt-8 rounded-2xl border border-border/60 bg-gradient-to-br from-card/60 to-card/30 p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-brand-500/15 p-2 text-brand-300">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold md:text-lg">Analist Konsensüsü</h2>
            <p className="mt-0.5 max-w-xl text-xs text-muted-foreground">
              Fon portföyündeki hisseler için İş Yatırım analistlerinin hedef fiyat & getiri
              potansiyeli verilerinin ağırlıklı ortalaması.
            </p>
          </div>
        </div>
        <div className="text-right text-[11px] text-muted-foreground">
          <div>Portföy: <span className="font-mono">{formatTrDate(props.reportDate)}</span></div>
          {props.stocksAsOfDate && (
            <div>Analist verisi: <span className="font-mono">{formatTrDate(props.stocksAsOfDate)}</span></div>
          )}
        </div>
      </header>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Ağırlıklı potansiyel
          </div>
          <div
            className={cn(
              'mt-1 flex items-baseline gap-1 font-mono text-2xl tabular-nums',
              potentialDirection === 'up' && 'text-emerald-300',
              potentialDirection === 'down' && 'text-rose-300',
            )}
          >
            {potential !== null && potential >= 0 && '+'}
            {potential !== null ? `${potential.toFixed(1)}%` : '—'}
            {potential !== null && <TrendingUp className="h-4 w-4 self-center opacity-70" />}
          </div>
          <div className="text-[10px] text-muted-foreground">Kapsanan hisse üstünden</div>
        </div>

        <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Analist Kapsama
          </div>
          <div className="mt-1 font-mono text-2xl tabular-nums">
            {(props.coverage * 100).toFixed(0)}%
          </div>
          <div className="text-[10px] text-muted-foreground">
            {props.coveredWeight.toFixed(1)}% / {props.totalWeight.toFixed(1)}% hisse
          </div>
        </div>

        <div className="rounded-lg border border-border/40 bg-muted/20 p-3 md:col-span-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Öneri Dağılımı (hisse sayısı)
          </div>
          {totalRecWithCoverage > 0 ? (
            <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-muted/30">
              {(['AL', 'TUT', 'SAT', 'GÖZDEN GEÇİRİLİYOR'] as const).map((rec) => {
                const n = props.recCount[rec] ?? 0;
                if (n === 0) return null;
                const pct = (n / totalRecWithCoverage) * 100;
                const bg =
                  rec === 'AL'
                    ? 'bg-emerald-500/80'
                    : rec === 'SAT'
                      ? 'bg-rose-500/80'
                      : rec === 'TUT'
                        ? 'bg-amber-500/80'
                        : 'bg-sky-500/80';
                return (
                  <div key={rec} className={bg} style={{ width: `${pct}%` }} title={`${rec}: ${n}`} />
                );
              })}
            </div>
          ) : (
            <div className="mt-2 text-[11px] text-muted-foreground">Öneri etiketi yok.</div>
          )}
          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
            {(['AL', 'TUT', 'SAT', 'GÖZDEN GEÇİRİLİYOR'] as const).map((rec) => {
              const n = props.recCount[rec] ?? 0;
              if (n === 0) return null;
              const { cls } = recStyle(rec);
              return (
                <span key={rec} className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', cls)}>
                  {rec === 'GÖZDEN GEÇİRİLİYOR' ? 'GG' : rec} · {n}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-border/40">
        <table className="w-full text-sm">
          <thead className="bg-muted/20 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Hisse</th>
              <th className="px-3 py-2 text-right">Fon Ağırlık</th>
              <th className="px-3 py-2 text-right">Kapanış</th>
              <th className="px-3 py-2 text-right">Hedef</th>
              <th className="px-3 py-2 text-right">Potansiyel</th>
              <th className="px-3 py-2 text-right">F/K</th>
              <th className="px-3 py-2 text-center">Öneri</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((it) => {
              const { label, cls } = recStyle(it.recommendation);
              const pot = it.potentialPct;
              return (
                <tr key={it.ticker} className="border-t border-border/40 hover:bg-muted/10">
                  <td className="px-3 py-2">
                    <div className="font-mono text-xs font-semibold text-foreground">{it.ticker}</div>
                    {it.name && (
                      <div className="truncate text-[10px] text-muted-foreground" title={it.name}>
                        {it.name}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                    %{it.weight.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {it.closePrice !== null ? formatPrice(it.closePrice) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                    {it.targetPrice !== null ? formatPrice(it.targetPrice) : '—'}
                  </td>
                  <td
                    className={cn(
                      'px-3 py-2 text-right font-mono text-xs tabular-nums',
                      pot !== null && pot >= 0 && 'text-emerald-300',
                      pot !== null && pot < 0 && 'text-rose-300',
                      pot === null && 'text-muted-foreground',
                    )}
                  >
                    {pot !== null ? `${pot >= 0 ? '+' : ''}${pot.toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {it.peRatio !== null ? it.peRatio.toFixed(1) : '—'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', cls)}>
                      {label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {props.items.length > 8 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex w-full items-center justify-center gap-1 border-t border-border/40 bg-muted/10 py-2 text-xs text-muted-foreground hover:bg-muted/20 hover:text-foreground"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" /> Daha az göster
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" /> {props.items.length - 8} hisseyi daha göster
              </>
            )}
          </button>
        )}
      </div>

      {uncovered.length > 0 && (
        <p className="mt-3 text-[10px] text-muted-foreground">
          {uncovered.length} hisse İş Yatırım kapsamı dışında (analist takibi yok).
        </p>
      )}

      <p className="mt-3 border-t border-border/30 pt-3 text-[10px] leading-relaxed text-muted-foreground">
        <strong className="text-muted-foreground/90">Kaynak:</strong> Bu kart, İş Yatırım araştırma
        ekibinin kamuya açık parametrik hisse tarayıcısından alınan hedef fiyat ve öneri
        verileriyle hazırlanmıştır. Fon portföyündeki son bildirilen hisse dağılımı esas
        alınarak ağırlıklı ortalama hesaplanır. Bilgi amaçlıdır; yatırım tavsiyesi değildir.
      </p>
    </section>
  );
}
