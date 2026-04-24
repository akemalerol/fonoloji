import { ArrowRight, TrendingDown, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { StockLogo } from '@/components/fx/stock-logo';
import { cn, formatCompact, formatPrice } from '@/lib/utils';

export const revalidate = 600;

const TR_MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

function fmtReportDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  const mi = Number(m);
  if (!Number.isFinite(mi) || mi < 1 || mi > 12) return iso;
  if (d) return `${d} ${TR_MONTHS[mi - 1]} ${y}`;
  return `${TR_MONTHS[mi - 1]} ${y}`;
}

async function getData(ticker: string) {
  try {
    return await api.stockDetail(ticker);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { ticker: string } }): Promise<Metadata> {
  const d = await getData(params.ticker.toUpperCase());
  if (!d) return { title: 'Hisse bulunamadı — Fonoloji' };
  const rec = d.consensus.recommendation ?? 'Takip';
  return {
    title: `${d.ticker} (${d.name}) — Fon Sahipliği + Analist Konsensüsü | Fonoloji`,
    description: `${d.ticker} ${d.name} hissesini tutan ${d.summary.fundCount} TEFAS fonu + ${d.consensus.brokerCount} aracı kurumun hedef fiyat ve ${rec} tavsiyesi. ${fmtReportDate(d.reportDate)} portföy raporu.`,
  };
}

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

const BROKER_LABEL: Record<string, string> = {
  isyatirim: 'İş Yatırım',
  ykyatirim: 'Yapı Kredi Yatırım',
  ziraatyatirim: 'Ziraat Yatırım',
  garantibbvayatirim: 'Garanti BBVA Yatırım',
};

export default async function StockPage({ params }: { params: { ticker: string } }) {
  const ticker = params.ticker.toUpperCase();
  const data = await getData(ticker);
  if (!data) notFound();

  const { consensus, brokers, holders, ownershipTrend, summary } = data;
  const topHolders = holders.slice(0, 20);
  const allHolders = holders;

  const pot =
    consensus.closePrice && consensus.targetRange?.avg
      ? ((consensus.targetRange.avg - consensus.closePrice) / consensus.closePrice) * 100
      : null;

  // Fon akış trendi — son vs bir önceki rapor dönemi
  const trend =
    ownershipTrend.length >= 2
      ? ownershipTrend[ownershipTrend.length - 1]!.fund_count -
        ownershipTrend[ownershipTrend.length - 2]!.fund_count
      : 0;

  return (
    <div className="container py-8 md:py-10">
      {/* Hero */}
      <div className="mb-8 rounded-2xl border border-border/60 bg-gradient-to-br from-brand-500/5 to-card/40 p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <StockLogo ticker={data.ticker} size={64} className="mt-1 shadow-sm" />
            <div>
              <div className="mb-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Hisse · {fmtReportDate(data.reportDate)} portföy raporu
              </div>
              <h1 className="display text-balance text-4xl leading-[1.02] md:text-6xl">
                <span className="font-mono text-brand-400">{data.ticker}</span>
                <span className="block text-xl text-muted-foreground md:text-2xl">{data.name}</span>
              </h1>
            </div>
          </div>
          {consensus.closePrice && (
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Kapanış</div>
              <div className="font-mono text-3xl tabular-nums md:text-4xl">
                {formatPrice(consensus.closePrice, 2)}
                <span className="ml-1 text-sm text-muted-foreground">TL</span>
              </div>
              {consensus.recommendation && (
                <div className="mt-1 flex items-center justify-end gap-2 text-xs">
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', recStyle(consensus.recommendation).cls)}>
                    {recStyle(consensus.recommendation).label}
                  </span>
                  {data.primaryBroker && (
                    <span className="text-muted-foreground">
                      · {BROKER_LABEL[data.primaryBroker] ?? data.primaryBroker}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stat grid */}
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat
            label="Bu hisseyi tutan fon"
            value={summary.fundCount.toString()}
            unit="fon"
            sub={
              trend !== 0 ? (
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 text-[10px]',
                    trend > 0 ? 'text-emerald-300' : 'text-rose-300',
                  )}
                >
                  {trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {trend > 0 ? `+${trend}` : trend} önceki döneme göre
                </span>
              ) : undefined
            }
          />
          <Stat
            label="Fonlardaki toplam değer"
            value={formatCompact(summary.totalMarketValueTl ?? 0)}
            unit="TL"
          />
          <Stat
            label="Ortalama fon ağırlığı"
            value={`%${summary.avgWeightInFunds.toFixed(2)}`}
            sub={<span className="text-[10px] text-muted-foreground">max %{summary.maxWeightInFunds.toFixed(2)}</span>}
          />
          <Stat
            label={`Analist konsensüsü`}
            value={
              pot !== null ? `${pot >= 0 ? '+' : ''}${pot.toFixed(1)}%` : '—'
            }
            unit="potansiyel"
            sub={
              consensus.targetRange ? (
                <span className="text-[10px] text-muted-foreground">
                  {consensus.brokerCount} kurum · ort hedef {formatPrice(consensus.targetRange.avg, 2)} TL
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground">kapsam dışı</span>
              )
            }
            tone={pot !== null ? (pot >= 0 ? 'up' : 'down') : undefined}
          />
        </div>

        {consensus.peRatio !== null && consensus.marketCapMnTl !== null && (
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>F/K: <span className="font-mono text-foreground">{consensus.peRatio.toFixed(1)}</span></span>
            <span>
              Piyasa değeri:{' '}
              <span className="font-mono text-foreground">
                {consensus.marketCapMnTl >= 1000
                  ? `${(consensus.marketCapMnTl / 1000).toFixed(1)} milyar`
                  : `${consensus.marketCapMnTl.toFixed(0)} milyon`}{' '}
                TL
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Analist konsensüsü (4 broker) */}
      {brokers.length > 0 && (
        <section className="mb-8">
          <h2 className="display mb-4 text-2xl">
            Analist Konsensüsü{' '}
            <span className="text-muted-foreground">({brokers.length} kurum)</span>
          </h2>
          <div className="overflow-hidden rounded-xl border border-border/60">
            <table className="w-full text-sm">
              <thead className="bg-muted/20 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Kurum</th>
                  <th className="px-3 py-2 text-right">Hedef Fiyat</th>
                  <th className="px-3 py-2 text-right">Potansiyel</th>
                  <th className="px-3 py-2 text-center">Tavsiye</th>
                  <th className="px-3 py-2 text-right">Giriş</th>
                  <th className="px-3 py-2 text-right">Rapor</th>
                </tr>
              </thead>
              <tbody>
                {brokers.map((b) => {
                  const rec = recStyle(b.recommendation);
                  const validTarget = b.target_price !== null && b.target_price > 0;
                  return (
                    <tr key={b.broker} className="border-t border-border/40 hover:bg-muted/10">
                      <td className="px-3 py-2 font-semibold">{BROKER_LABEL[b.broker] ?? b.broker}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs tabular-nums">
                        {validTarget ? formatPrice(b.target_price!, 2) : '—'}
                      </td>
                      <td
                        className={cn(
                          'px-3 py-2 text-right font-mono text-xs tabular-nums',
                          b.potential_pct !== null && b.potential_pct > 0 && 'text-emerald-300',
                          b.potential_pct !== null && b.potential_pct < 0 && 'text-rose-300',
                        )}
                      >
                        {validTarget && b.potential_pct !== null
                          ? `${b.potential_pct >= 0 ? '+' : ''}${b.potential_pct.toFixed(1)}%`
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', rec.cls)}>
                          {rec.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-[11px] text-muted-foreground">
                        {b.entry_date ? fmtReportDate(b.entry_date) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {b.report_url ? (
                          <a
                            href={b.report_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-sky-300 underline hover:text-sky-200"
                          >
                            Rapor ↗
                          </a>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Fon sahipleri */}
      <section className="mb-8">
        <h2 className="display mb-4 text-2xl">
          {data.ticker} Hissesini Tutan Fonlar{' '}
          <span className="text-muted-foreground">({summary.fundCount})</span>
        </h2>
        <div className="overflow-hidden rounded-xl border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/20 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Fon</th>
                <th className="px-3 py-2 text-left">Kategori</th>
                <th className="px-3 py-2 text-right">Ağırlık</th>
                <th className="px-3 py-2 text-right">Piyasa Değ.</th>
                <th className="px-3 py-2 text-right">1A</th>
                <th className="px-3 py-2 text-right">1Y</th>
              </tr>
            </thead>
            <tbody>
              {topHolders.map((h) => {
                const r1m = h.return_1m !== null ? h.return_1m * 100 : null;
                const r1y = h.return_1y !== null ? h.return_1y * 100 : null;
                return (
                  <tr key={h.code} className="border-t border-border/40 hover:bg-muted/10">
                    <td className="px-3 py-2">
                      <Link
                        href={`/fon/${h.code}`}
                        className="group inline-flex items-center gap-2"
                      >
                        <span className="font-mono text-xs font-semibold text-brand-300 group-hover:text-brand-200">
                          {h.code}
                        </span>
                        <span className="truncate text-[11px] text-muted-foreground group-hover:text-foreground">
                          {h.fund_name}
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-[11px] text-muted-foreground">{h.category ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-mono text-sm font-semibold tabular-nums">
                      %{h.weight.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {h.market_value ? formatCompact(h.market_value) : '—'}
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2 text-right font-mono text-xs tabular-nums',
                        r1m !== null && r1m > 0 && 'text-emerald-300',
                        r1m !== null && r1m < 0 && 'text-rose-300',
                      )}
                    >
                      {r1m !== null ? `${r1m >= 0 ? '+' : ''}${r1m.toFixed(1)}%` : '—'}
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2 text-right font-mono text-xs tabular-nums',
                        r1y !== null && r1y > 0 && 'text-emerald-300',
                        r1y !== null && r1y < 0 && 'text-rose-300',
                      )}
                    >
                      {r1y !== null ? `${r1y >= 0 ? '+' : ''}${r1y.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {allHolders.length > 20 && (
            <div className="border-t border-border/40 bg-muted/10 py-2 text-center text-[11px] text-muted-foreground">
              + {allHolders.length - 20} fon daha bu hisseyi tutuyor
            </div>
          )}
        </div>
      </section>

      {/* Zaman içinde fon sahipliği */}
      {ownershipTrend.length >= 2 && (
        <section className="mb-8">
          <h2 className="display mb-4 text-2xl">Fon Sahipliği Trendi</h2>
          <div className="overflow-hidden rounded-xl border border-border/60">
            <table className="w-full text-sm">
              <thead className="bg-muted/20 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Dönem</th>
                  <th className="px-3 py-2 text-right">Fon sayısı</th>
                  <th className="px-3 py-2 text-right">Ort. ağırlık</th>
                  <th className="px-3 py-2 text-right">Toplam değer</th>
                </tr>
              </thead>
              <tbody>
                {[...ownershipTrend].reverse().map((t) => (
                  <tr key={t.report_date} className="border-t border-border/40 hover:bg-muted/10">
                    <td className="px-3 py-2 font-mono text-xs">{fmtReportDate(t.report_date)}</td>
                    <td className="px-3 py-2 text-right font-mono text-sm tabular-nums">{t.fund_count}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground tabular-nums">
                      %{t.avg_weight.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground tabular-nums">
                      {t.total_mv_mn !== null ? `${t.total_mv_mn.toLocaleString('tr-TR')} mn TL` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Footer CTA */}
      <div className="mt-10 rounded-xl border border-border/40 bg-muted/10 p-5 text-center text-sm">
        <Link
          href="/fonlar"
          className="inline-flex items-center gap-1 text-brand-400 hover:text-brand-300"
        >
          Tüm TEFAS fonlarını incele <ArrowRight className="h-3 w-3" />
        </Link>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Bilgi amaçlıdır; yatırım tavsiyesi değildir. Portföy verileri KAP raporlarından,
          analist verileri İş Yatırım/YKY/Ziraat/Garanti BBVA resmi kaynaklarından derlenmiştir.
        </p>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  sub,
  tone,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: React.ReactNode;
  tone?: 'up' | 'down';
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-background/30 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={cn(
          'mt-1 font-mono text-xl tabular-nums md:text-2xl',
          tone === 'up' && 'text-emerald-300',
          tone === 'down' && 'text-rose-300',
        )}
      >
        {value}
        {unit && <span className="ml-1 text-[11px] text-muted-foreground">{unit}</span>}
      </div>
      {sub && <div className="mt-0.5">{sub}</div>}
    </div>
  );
}
