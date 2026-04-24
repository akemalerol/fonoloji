import { ArrowUpRight, Calendar, Percent, TrendingDown, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { CpiCharts } from './charts';
import { GoldMarketCard } from './gold-market-card';

export const metadata = { title: 'Ekonomi & TÜFE' };
export const revalidate = 300;

const MONTHS_LONG = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const MONTHS_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

function fmtMonth(iso: string): string {
  const [y, m] = iso.split('-');
  return `${MONTHS_LONG[Number(m) - 1]} ${y}`;
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d} ${MONTHS_SHORT[Number(m) - 1]} ${y}`;
}

export default async function EconomyPage() {
  const cpi = await api.cpi().catch(() => ({ latest: null, history: [], next: null }));
  const latest = cpi.latest;
  const history = cpi.history; // ASC order from backend
  const next = cpi.next;

  // Build yearly aggregate — compound monthly MoM for each calendar year
  const byYear = new Map<string, { moms: number[]; lastYoy: number; anchor: string }>();
  for (const h of history) {
    const year = h.date.slice(0, 4);
    const entry = byYear.get(year) ?? { moms: [], lastYoy: h.yoy_change, anchor: h.date };
    if (h.mom_change !== null) entry.moms.push(h.mom_change);
    entry.lastYoy = h.yoy_change; // last reading of that year
    entry.anchor = h.date;
    byYear.set(year, entry);
  }
  const yearly = Array.from(byYear.entries())
    .map(([year, v]) => {
      const compound = v.moms.reduce((acc, r) => (1 + acc) * (1 + r) - 1, 0);
      return {
        year,
        yearly_compound: v.moms.length >= 6 ? compound : null, // only show if enough data
        last_yoy: v.lastYoy,
      };
    })
    .sort((a, b) => Number(b.year) - Number(a.year));

  return (
    <div className="container py-10">
      <div className="mb-10 border-b border-border/50 pb-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <Percent className="h-3 w-3 text-amber-400" />
          Ekonomi
        </div>
        <h1 className="display mt-2 text-5xl leading-none md:text-6xl">
          <span className="display-italic text-amber-400">TÜFE</span> ve reel getiri
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          TÜİK'in ayın 3'ünde yayınladığı TÜFE verisi otomatik çekilir, fon reel getirileri güncel tutulur.
          Kaynak:{' '}
          <a href="https://data.tuik.gov.tr" target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:text-brand-300">
            data.tuik.gov.tr
          </a>
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/ekonomi/piyasalar"
            className="group inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-2 text-xs backdrop-blur transition-colors hover:border-brand-500/50 hover:bg-card"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            Canlı piyasalar dashboard'u
            <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
          <Link
            href="/ekonomi/kap-mansetleri"
            className="group inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-2 text-xs backdrop-blur transition-colors hover:border-amber-500/50 hover:bg-card"
          >
            🔥 Haftanın KAP manşetleri
            <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
          <Link
            href={`/en-iyi-fonlar/${new Date().getFullYear()}`}
            className="group inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-2 text-xs backdrop-blur transition-colors hover:border-amber-500/50 hover:bg-card"
          >
            🏆 Yılın en iyi fonları
            <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="panel-highlight p-6 md:col-span-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">En son TÜFE (yıllık)</div>
          {latest ? (
            <>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="display text-6xl tabular-nums md:text-7xl gradient-text-warm">
                  %{(latest.yoy_change * 100).toFixed(2)}
                </span>
                {latest.mom_change !== null && (
                  <span className="text-sm text-muted-foreground">
                    aylık <span className="font-mono text-foreground">%{(latest.mom_change * 100).toFixed(2)}</span>
                  </span>
                )}
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                Dönem: <span className="text-foreground">{fmtMonth(latest.date.slice(0, 7))}</span>
              </div>
            </>
          ) : (
            <div className="mt-3 text-sm text-muted-foreground">TÜFE verisi henüz çekilmedi.</div>
          )}
        </div>

        <div className="panel p-6">
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Calendar className="h-3 w-3 text-brand-400" /> Sıradaki açıklama
          </div>
          {next ? (
            <>
              <div className="display text-3xl">{fmtDate(next.scheduled_date)}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                saat <span className="font-mono text-foreground">{next.scheduled_time}</span> (TR)
              </div>
              <div className="mt-3 text-xs text-muted-foreground">Dönem: {fmtMonth(next.period)}</div>
              <div className="mt-4 border-t border-border/50 pt-3 text-[11px] text-muted-foreground">
                Açıklamadan 5 dakika sonra otomatik çekiliyor.
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">Takvim yüklenemedi.</div>
          )}
        </div>
      </div>

      {/* Charts */}
      {history.length > 2 && <CpiCharts history={history} />}

      {/* Yearly aggregate */}
      {yearly.length > 1 && (
        <div className="panel mt-8 p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-amber-400" /> Yıllık TÜFE serisi ({yearly.length} yıl)
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {yearly.map((y) => {
              const yoy = y.last_yoy;
              const hot = yoy >= 0.3;
              return (
                <div
                  key={y.year}
                  className="rounded-xl border border-border/50 bg-card/40 p-3 transition-colors hover:bg-card/60"
                >
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">{y.year}</div>
                  <div className={`mt-1 font-mono text-2xl tabular-nums ${hot ? 'text-loss' : 'text-amber-400'}`}>
                    %{(yoy * 100).toFixed(1)}
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">yıl sonu yıllık</div>
                  {y.yearly_compound !== null && (
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      dönem içi: <span className="font-mono">%{(y.yearly_compound * 100).toFixed(1)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly history table */}
      {history.length > 0 && (
        <div className="panel mt-8 p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-amber-400" />
            Aylık TÜFE serisi · son {history.length} ay
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2 pl-1 text-left font-medium">Dönem</th>
                  <th className="pb-2 text-right font-medium">Yıllık değişim</th>
                  <th className="pb-2 pr-1 text-right font-medium">Aylık değişim</th>
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().map((h) => {
                  const yoy = h.yoy_change;
                  const mom = h.mom_change;
                  return (
                    <tr key={h.date} className="border-b border-border/30 last:border-0">
                      <td className="py-2 pl-1 text-muted-foreground">{fmtMonth(h.date.slice(0, 7))}</td>
                      <td className="py-2 text-right font-mono tabular-nums">
                        <span className={yoy >= 0.3 ? 'text-loss' : 'text-amber-400'}>%{(yoy * 100).toFixed(2)}</span>
                      </td>
                      <td className="py-2 pr-1 text-right font-mono tabular-nums">
                        {mom !== null ? (
                          <span className="inline-flex items-center gap-1">
                            {mom >= 0 ? (
                              <TrendingUp className="h-3 w-3 text-loss" />
                            ) : (
                              <TrendingDown className="h-3 w-3 text-gain" />
                            )}
                            %{(mom * 100).toFixed(2)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <GoldMarketCard />
    </div>
  );
}
