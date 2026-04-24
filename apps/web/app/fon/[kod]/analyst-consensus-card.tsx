'use client';

import { ChevronDown, ChevronUp, TrendingUp, Users } from 'lucide-react';
import * as React from 'react';
import { ExchangeBadge, StockLogo } from '@/components/fx/stock-logo';
import { cn, formatPrice } from '@/lib/utils';

// "Analist Konsensüsü" kartı — fon portföyündeki hisseler için birden fazla aracı
// kurumun (İş Yatırım, Yapı Kredi Yatırım, ...) hedef fiyat + AL/TUT/SAT görüşünü
// birleştirir ve fon ağırlığı ile weighted ortalama potansiyel hesaplar.
//
// "Primary broker" = her hisse için hedef fiyat yayınlayanlar arasında market cap
// en büyüğü (büyük kap aracı kurum = daha güvenilir proxy). Tabloda o görüş
// gösterilir; diğer kurumların görüşleri brokers[] altında. UI satır tıklanınca
// alternatif hedef fiyatları açar.

interface BrokerView {
  broker: string;
  targetPrice: number | null;
  potentialPct: number | null;
  recommendation: string | null;
  entryDate: string | null;
  reportTitle: string | null;
  reportUrl: string | null;
  asOfDate: string;
}

interface Item {
  ticker: string;
  name: string | null;
  weight: number;
  closePrice: number | null;
  targetPrice: number | null;
  potentialPct: number | null;
  peRatio: number | null;
  recommendation: string | null;
  primaryBroker: string | null;
  brokers: BrokerView[];
  brokerCount: number;
  targetRange: { min: number | null; max: number | null; avg: number | null } | null;
}

interface Props {
  reportDate: string | null;
  stocksAsOfDate: string | null;
  brokers: string[];
  totalWeight: number;
  coveredWeight: number;
  coverage: number;
  weightedPotential: number | null;
  recCount: Record<string, number>;
  items: Item[];
}

// Kurumların görünen adları ve logoları. Yeni broker eklendikçe buraya ekle.
// bgClass: logonun arka planı — YKY logosu beyaz olduğu için brand lacivert,
// diğerleri beyaz.
const BROKER_META: Record<
  string,
  { label: string; shortLabel: string; logo?: string; bgClass?: string }
> = {
  isyatirim: {
    label: 'İş Yatırım',
    shortLabel: 'İş',
    logo: '/brand/isyatirim-logo.svg',
    bgClass: 'bg-white',
  },
  ykyatirim: {
    label: 'Yapı Kredi Yatırım',
    shortLabel: 'YKY',
    logo: '/brand/ykyatirim-logo.svg',
    bgClass: 'bg-[#003aa6]',
  },
  ziraatyatirim: {
    label: 'Ziraat Yatırım',
    shortLabel: 'Ziraat',
    logo: '/brand/ziraatyatirim-logo.png',
    bgClass: 'bg-white',
  },
  garantibbvayatirim: {
    label: 'Garanti BBVA Yatırım',
    shortLabel: 'Garanti',
    logo: '/brand/garantibbvayatirim-logo.svg',
    bgClass: 'bg-white',
  },
};

function brokerLabel(key: string): string {
  return BROKER_META[key]?.label ?? key;
}

function brokerShort(key: string): string {
  return BROKER_META[key]?.shortLabel ?? key.slice(0, 3).toUpperCase();
}

// "AL" veya "EÜ" (Endeks Üzeri) pozitif, "SAT"/"EA" negatif, "TUT" nötr, "GG" review.
function recStyle(rec: string | null): { label: string; cls: string } {
  switch (rec) {
    case 'AL':
    case 'EÜ':
      return { label: rec, cls: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30' };
    case 'SAT':
    case 'EA':
      return { label: rec, cls: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30' };
    case 'TUT':
      return { label: 'TUT', cls: 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30' };
    case 'GÖZDEN GEÇİRİLİYOR':
      return { label: 'GG', cls: 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30' };
    default:
      return { label: '—', cls: 'bg-muted/30 text-muted-foreground' };
  }
}

const TR_MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

function formatTrDate(iso: string | null): string {
  if (!iso) return '—';
  const parts = iso.split('-');
  const y = parts[0];
  const mIdx = Number(parts[1]);
  const d = parts[2];
  if (!y || !Number.isFinite(mIdx) || mIdx < 1 || mIdx > 12) return iso;
  if (d) return `${d}.${String(mIdx).padStart(2, '0')}.${y}`;
  return `${TR_MONTHS[mIdx - 1]} ${y}`;
}

export function AnalystConsensusCard(props: Props) {
  const [expanded, setExpanded] = React.useState(false);
  const [openRow, setOpenRow] = React.useState<string | null>(null);

  if (!props.reportDate || props.items.length === 0) return null;

  const uncovered = props.items.filter((i) => i.potentialPct === null);
  const visibleItems = expanded ? props.items : props.items.slice(0, 8);

  const potential = props.weightedPotential;
  const potentialDirection = potential === null ? 'neutral' : potential >= 0 ? 'up' : 'down';

  const totalRecWithCoverage =
    (props.recCount.AL ?? 0) +
    (props.recCount.TUT ?? 0) +
    (props.recCount.SAT ?? 0) +
    (props.recCount['GÖZDEN GEÇİRİLİYOR'] ?? 0);

  const brokerList = props.brokers ?? [];
  const isSingleBroker = brokerList.length <= 1;
  const title = isSingleBroker
    ? brokerList[0] === 'isyatirim'
      ? 'İŞ YATIRIM TAVSİYESİ'
      : brokerList.length === 1
        ? `${brokerLabel(brokerList[0]!).toUpperCase()} TAVSİYESİ`
        : 'ANALİST KONSENSÜSÜ'
    : 'ANALİST KONSENSÜSÜ';

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card/60 to-card/30">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/50 bg-gradient-to-r from-[#003976]/15 via-[#003976]/5 to-transparent px-5 py-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 items-center gap-2">
            {brokerList.length > 0 &&
              brokerList.map((b) => {
                const meta = BROKER_META[b];
                if (meta?.logo) {
                  return (
                    <div
                      key={b}
                      className={cn(
                        'flex h-12 w-24 items-center justify-center rounded-lg p-2 shadow-sm ring-1 ring-border/40',
                        meta.bgClass ?? 'bg-white',
                      )}
                      title={meta.label}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={meta.logo} alt={meta.label} className="h-full w-auto" loading="lazy" />
                    </div>
                  );
                }
                return (
                  <div
                    key={b}
                    className="flex h-12 items-center justify-center rounded-lg bg-white px-3 text-[10px] font-bold text-[#003976] shadow-sm ring-1 ring-border/40"
                    title={meta?.label ?? b}
                  >
                    {meta?.shortLabel ?? b.toUpperCase()}
                  </div>
                );
              })}
          </div>
          <div>
            <h2 className="display text-xl font-bold tracking-tight md:text-2xl">{title}</h2>
            <p className="mt-0.5 max-w-xl text-[11px] text-muted-foreground">
              {isSingleBroker
                ? 'Fon portföyündeki hisseler için aracı kurumun hedef fiyat ve getiri potansiyeli verilerinin ağırlıklı ortalaması.'
                : `Fon portföyündeki hisseler için ${brokerList.length} aracı kurumun hedef fiyat ve AL/TUT/SAT görüşlerinin birleşimi.`}
            </p>
          </div>
        </div>
        <div className="text-right text-[11px] text-muted-foreground">
          <div>
            Portföy: <span className="font-mono">{formatTrDate(props.reportDate)}</span>
          </div>
          {props.stocksAsOfDate && (
            <div>
              Analist verisi: <span className="font-mono">{formatTrDate(props.stocksAsOfDate)}</span>
            </div>
          )}
        </div>
      </div>
      <div className="p-5">
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
                <th className="px-3 py-2 text-center">Kurum</th>
                <th className="px-3 py-2 text-center">Öneri</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((it) => {
                const { label, cls } = recStyle(it.recommendation);
                const pot = it.potentialPct;
                const isOpen = openRow === it.ticker;
                const hasMultiple = it.brokerCount > 1;
                const showRange = it.targetRange && it.targetRange.min !== it.targetRange.max;
                return (
                  <React.Fragment key={it.ticker}>
                    <tr
                      className={cn(
                        'border-t border-border/40 hover:bg-muted/10',
                        hasMultiple && 'cursor-pointer',
                      )}
                      onClick={() => hasMultiple && setOpenRow((v) => (v === it.ticker ? null : it.ticker))}
                    >
                      <td className="px-3 py-2">
                        <a
                          href={`/hisse/${it.ticker}`}
                          className="flex items-center gap-2 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <StockLogo ticker={it.ticker} size={22} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1 font-mono text-xs font-semibold text-foreground">
                              <span>{it.ticker}</span>
                              <ExchangeBadge ticker={it.ticker} />
                            </div>
                            {it.name && (
                              <div className="truncate text-[10px] text-muted-foreground" title={it.name}>
                                {it.name}
                              </div>
                            )}
                          </div>
                        </a>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                        %{it.weight.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-muted-foreground">
                        {it.closePrice !== null ? formatPrice(it.closePrice) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                        {it.targetPrice !== null ? formatPrice(it.targetPrice) : '—'}
                        {showRange && it.targetRange && (
                          <div className="text-[9px] text-muted-foreground">
                            {formatPrice(it.targetRange.min!)}–{formatPrice(it.targetRange.max!)}
                          </div>
                        )}
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
                      <td className="px-3 py-2 text-center">
                        {it.brokerCount > 0 ? (
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                              hasMultiple
                                ? 'bg-sky-500/15 text-sky-200 ring-1 ring-sky-500/30'
                                : 'bg-muted/30 text-muted-foreground',
                            )}
                            title={it.brokers.map((b) => brokerLabel(b.broker)).join(', ')}
                          >
                            {hasMultiple && <Users className="h-3 w-3" />}
                            {it.brokerCount > 1 ? `${it.brokerCount} kurum` : brokerShort(it.primaryBroker ?? '')}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', cls)}>
                          {label}
                        </span>
                      </td>
                    </tr>
                    {isOpen && hasMultiple && (
                      <tr className="border-t border-border/40 bg-muted/10">
                        <td colSpan={7} className="px-3 py-3">
                          <div className="grid gap-2">
                            {it.brokers.map((b) => {
                              const { label: rLabel, cls: rCls } = recStyle(b.recommendation);
                              return (
                                <div
                                  key={b.broker}
                                  className="flex flex-wrap items-center gap-3 rounded-md border border-border/40 bg-card/40 px-3 py-2 text-[11px]"
                                >
                                  <span className="min-w-24 font-semibold text-foreground">
                                    {brokerLabel(b.broker)}
                                  </span>
                                  <span className="text-muted-foreground">
                                    Hedef:{' '}
                                    <span className="font-mono text-foreground">
                                      {b.targetPrice !== null ? formatPrice(b.targetPrice) : '—'}
                                    </span>
                                  </span>
                                  <span className="text-muted-foreground">
                                    Potansiyel:{' '}
                                    <span
                                      className={cn(
                                        'font-mono',
                                        b.potentialPct !== null && b.potentialPct >= 0 && 'text-emerald-300',
                                        b.potentialPct !== null && b.potentialPct < 0 && 'text-rose-300',
                                      )}
                                    >
                                      {b.potentialPct !== null
                                        ? `${b.potentialPct >= 0 ? '+' : ''}${b.potentialPct.toFixed(1)}%`
                                        : '—'}
                                    </span>
                                  </span>
                                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', rCls)}>
                                    {rLabel}
                                  </span>
                                  {b.entryDate && (
                                    <span className="text-[10px] text-muted-foreground">
                                      Giriş: {formatTrDate(b.entryDate)}
                                    </span>
                                  )}
                                  {b.reportUrl && (
                                    <a
                                      href={b.reportUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="ml-auto text-[10px] text-sky-300 underline hover:text-sky-200"
                                      title={b.reportTitle ?? undefined}
                                    >
                                      Rapor ↗
                                    </a>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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
            {uncovered.length} hisse aracı kurumlar tarafından kapsam dışı (analist takibi yok).
          </p>
        )}

        <p className="mt-3 border-t border-border/30 pt-3 text-[10px] leading-relaxed text-muted-foreground">
          <strong className="text-muted-foreground/90">Kaynak:</strong>{' '}
          {brokerList.length > 0
            ? brokerList.map((b) => brokerLabel(b)).join(', ')
            : 'Aracı kurum'}{' '}
          araştırma ekiplerinin kamuya açık hedef fiyat ve öneri verileri; fon portföyündeki son
          bildirilen hisse dağılımı esas alınarak ağırlıklı ortalama hesaplanır. Bilgi amaçlıdır;
          yatırım tavsiyesi değildir.
        </p>
      </div>
    </section>
  );
}
