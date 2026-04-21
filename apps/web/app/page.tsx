import { ArrowRight, ArrowUpRight, Calendar, Compass, Flame, LineChart as LineChartIcon, Percent, Sparkles, TrendingUp, Waves } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ChangePill } from '@/components/fx/change-pill';
import { LiveTicker } from '@/components/fx/live-ticker';
import { Marquee } from '@/components/fx/marquee';
import { MoverRow } from '@/components/fx/mover-row';
import { AnimatedGradientText } from '@/components/magic/animated-gradient-text';
import { BorderBeam } from '@/components/magic/border-beam';
import { MagicCard } from '@/components/magic/magic-card';
import { NumberTicker } from '@/components/magic/number-ticker';
import { WordRotate } from '@/components/magic/word-rotate';
import { api } from '@/lib/api';
import { cn, formatCompact, formatPercent, formatPrice } from '@/lib/utils';
import { AdSlot } from '@/components/ads/ad-slot';

// Decorative hero animations — load after initial paint to protect LCP.
const Meteors = dynamic(() => import('@/components/magic/meteors').then((m) => m.Meteors), {
  ssr: false,
  loading: () => null,
});
const RetroGrid = dynamic(() => import('@/components/magic/retro-grid').then((m) => m.RetroGrid), {
  ssr: false,
  loading: () => null,
});
const Spotlight = dynamic(() => import('@/components/magic/spotlight').then((m) => m.Spotlight), {
  ssr: false,
  loading: () => null,
});

export const revalidate = 60;

export default async function HomePage() {
  const [topAum, movers1d, movers1m, flow, trend, categoriesRaw, cpi, digest, summary, liveMarket] = await Promise.all([
    api.listFunds({ sort: 'aum', limit: 25 }),
    api.movers('1d', 10),
    api.movers('1m', 8),
    api.flow('1m', 6),
    api.trend(),
    api.categories(),
    api.cpi().catch(() => ({ latest: null, history: [], next: null })),
    api.marketDigest('day').catch(() => ({ period: 'day', summary: null as string | null, cached: false, topGainers: [], topLosers: [] })),
    api.summaryToday().catch(() => ({ date: null as string | null, totalFunds: 0, totalAum: 0, totalInvestors: 0, topGainers: [], topLosers: [] })),
    api.liveMarket().catch(() => ({ items: [], updated_at: null })),
  ]);

  // Use ALL-fund totals from daily_summary — not just top 25
  const totalAum = summary.totalAum || topAum.items.reduce((sum, f) => sum + (f.aum ?? 0), 0);
  const totalInvestors = summary.totalInvestors || topAum.items.reduce((sum, f) => sum + (f.investor_count ?? 0), 0);
  const totalFundCount = summary.totalFunds || topAum.items.length;
  const ticker = topAum.items.slice(0, 20);
  const catSorted = [...categoriesRaw.items].sort((a, b) => (b.avg_return ?? 0) - (a.avg_return ?? 0));

  return (
    <>
      {/* GLOBAL LIVE MARKET STRIP — right under the header */}
      {liveMarket.items.length > 0 && (
        <LiveTicker tickers={liveMarket.items} />
      )}

      {/* HERO */}
      <section className="relative isolate overflow-hidden">
        <RetroGrid />
        <Spotlight className="-top-40 left-1/2 -translate-x-1/2" />
        <div className="pointer-events-none absolute inset-0">
          <Meteors number={14} />
        </div>
        <div className="container relative py-28 md:py-40">
          <div className="mx-auto max-w-4xl">
            <div className="mb-6 flex justify-center">
              <AnimatedBadge />
            </div>

            <h1 className="display text-balance text-center text-[56px] leading-[0.95] md:text-[112px]">
              TEFAS fonlarının
              <br />
              <span className="display-italic">
                <AnimatedGradientText>akılcı</AnimatedGradientText>{' '}
                <WordRotate
                  words={['analizi', 'hikâyesi', 'haritası', 'nabzı']}
                  className="gradient-text"
                />
              </span>
            </h1>

            <p className="mx-auto mt-8 max-w-xl text-balance text-center text-base text-muted-foreground md:text-lg">
              TEFAS'ta 800+ fon var. Fonoloji bu fonları risk, getiri, korelasyon ve
              sermaye akışı üzerinden <span className="italic text-foreground">okunur</span> kılar.
            </p>

            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link
                href="/fonlar"
                className="group relative overflow-hidden rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-colors"
              >
                Tüm fonları gör
                <ArrowRight className="ml-2 inline-block h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/kesifler"
                className="group inline-flex items-center gap-2 rounded-full border border-border bg-card/40 px-6 py-3 text-sm font-medium backdrop-blur transition-colors hover:bg-card/80"
              >
                Keşifler
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </div>
          </div>

          {/* Hero ticker */}
          <div className="mx-auto mt-20 max-w-6xl">
            <div className="relative overflow-hidden rounded-full border border-border bg-background/60 backdrop-blur">
              <Marquee pauseOnHover className="py-3">
                {ticker.map((f) => (
                  <Link
                    key={f.code}
                    href={`/fon/${f.code}`}
                    className="inline-flex items-center gap-3 px-2 text-sm tabular-nums"
                  >
                    <span className="font-mono text-[11px] font-semibold">{f.code}</span>
                    <span className="text-muted-foreground">{formatPrice(f.current_price ?? 0, 4)}</span>
                    <ChangePill value={f.return_1d ?? null} className="text-xs" />
                  </Link>
                ))}
              </Marquee>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="container relative pb-12">
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-3 md:grid-cols-4">
            <HeroStat
              label="Takip edilen fon"
              value={totalFundCount}
              icon={<Sparkles className="h-3.5 w-3.5 text-brand-400" />}
            />
            <HeroStat
              label="Toplam fon büyüklüğü"
              value={totalAum >= 1e12 ? Math.round((totalAum / 1e12) * 10) / 10 : Math.round(totalAum / 1e9)}
              decimalPlaces={totalAum >= 1e12 ? 1 : 0}
              prefix="₺"
              suffix={totalAum >= 1e12 ? ' trilyon' : ' milyar'}
              icon={<Waves className="h-3.5 w-3.5 text-verdigris-400" />}
            />
            <HeroStat
              label="Yatırımcı pozisyonu"
              value={totalInvestors >= 1_000_000 ? Math.round(totalInvestors / 1_000_000) : Math.round(totalInvestors / 1_000)}
              suffix={totalInvestors >= 1_000_000 ? ' milyon' : ' bin'}
              icon={<Compass className="h-3.5 w-3.5 text-emerald-400" />}
            />
            <CpiStat cpi={cpi} />
          </div>

        </div>
      </section>

      <div className="container"><AdSlot placement="home-hero" className="mx-auto max-w-5xl" /></div>

      {/* EDITORIAL LEAD */}
      <section className="container pt-12">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            — bölüm 01 · piyasanın nabzı —
          </div>
          <h2 className="display text-4xl md:text-6xl">
            Bugün fonlar <span className="display-italic text-brand-400">nasıl</span> nefes alıyor?
          </h2>
        </div>
      </section>

      {/* BUGÜN NE ÇIKTI — AI generated daily commentary */}
      {digest.summary && (
        <section className="container mt-10">
          <div className="panel-highlight mx-auto max-w-4xl p-8 md:p-10">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand-400" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Günün özeti · Fonoloji AI
                </span>
              </div>
              <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-brand-400">
                {new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long' })}
              </span>
            </div>
            <div className="prose prose-invert max-w-none">
              {digest.summary.split(/\n\n+/).map((p, i) => (
                <p key={i} className="mb-3 text-[15px] leading-relaxed text-foreground/90 last:mb-0">
                  {p}
                </p>
              ))}
            </div>
            {digest.topGainers.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2 border-t border-border/40 pt-4">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Bahsi geçenler:
                </span>
                {[...digest.topGainers, ...digest.topLosers].slice(0, 6).map((m) => (
                  <Link
                    key={m.code}
                    href={`/fon/${m.code}`}
                    className="font-mono text-[11px] text-brand-400 hover:text-brand-300"
                  >
                    {m.code}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* MOVERS BENTO */}
      <section className="container mt-12">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          {/* Gainers — equal width */}
          <MagicCard className="md:col-span-6" gradientColor="#10B981" gradientOpacity={0.45}>
            <div className="relative overflow-hidden p-5 md:p-7">
              <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-gain/10 blur-3xl" />
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-gain/15 ring-1 ring-gain/30">
                    <TrendingUp className="h-3.5 w-3.5 text-gain" />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Günün yükselenleri
                  </span>
                </div>
                <Link
                  href="/fonlar?sort=return_1d"
                  className="text-[11px] text-muted-foreground transition-colors hover:text-gain"
                >
                  Tümü →
                </Link>
              </div>
              <ul className="space-y-0.5">
                {(() => {
                  const list = movers1d.gainers.slice(0, 6);
                  const max = Math.max(...list.map((m) => Math.abs(m.change)), 0.0001);
                  return list.map((m, i) => (
                    <li key={m.code}>
                      <MoverRow
                        code={m.code}
                        name={m.name}
                        category={m.category}
                        change={m.change}
                        rank={i + 1}
                        maxAbsChange={max}
                      />
                    </li>
                  ));
                })()}
              </ul>
              <BorderBeam duration={18} colorFrom="#10B981" colorTo="#F59E0B" />
            </div>
          </MagicCard>

          {/* Losers — equal width */}
          <MagicCard className="md:col-span-6" gradientColor="#F43F5E" gradientOpacity={0.4}>
            <div className="relative overflow-hidden p-5 md:p-7">
              <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-loss/10 blur-3xl" />
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-loss/15 ring-1 ring-loss/30">
                    <Flame className="h-3.5 w-3.5 text-loss" />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Günün düşenleri
                  </span>
                </div>
                <Link
                  href="/fonlar?sort=return_1d&dir=asc"
                  className="text-[11px] text-muted-foreground transition-colors hover:text-loss"
                >
                  Tümü →
                </Link>
              </div>
              <ul className="space-y-0.5">
                {(() => {
                  const list = movers1d.losers.slice(0, 6);
                  const max = Math.max(...list.map((m) => Math.abs(m.change)), 0.0001);
                  return list.map((m, i) => (
                    <li key={m.code}>
                      <MoverRow
                        code={m.code}
                        name={m.name}
                        category={m.category}
                        change={m.change}
                        rank={i + 1}
                        maxAbsChange={max}
                        negative
                      />
                    </li>
                  ));
                })()}
              </ul>
            </div>
          </MagicCard>

          {/* Flow card */}
          <MagicCard className="md:col-span-4">
            <div className="relative p-6">
              <Waves className="mb-4 h-5 w-5 text-brand-400" />
              <div className="serif text-2xl leading-none">Aylık para akışı</div>
              <p className="mt-1 text-xs text-muted-foreground">Fon büyüklüğü giriş/çıkış liderleri</p>
              <ul className="mt-5 space-y-2">
                {flow.inflow.slice(0, 4).map((f) => (
                  <li key={f.code} className="flex items-center justify-between text-sm">
                    <Link href={`/fon/${f.code}`} className="font-mono text-xs font-semibold hover:text-brand-400">
                      {f.code}
                    </Link>
                    <ChangePill value={f.flow} className="text-xs" />
                  </li>
                ))}
              </ul>
              <Link
                href="/kesifler/para-akisi"
                className="mt-5 inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300"
              >
                Detay <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </MagicCard>

          {/* Trend card */}
          <MagicCard className="md:col-span-4">
            <div className="relative p-6">
              <Compass className="mb-4 h-5 w-5 text-verdigris-400" />
              <div className="serif text-2xl leading-none">Yükselen trend</div>
              <p className="mt-1 text-xs text-muted-foreground">MA 30/200 kesişim sinyali</p>
              <ul className="mt-5 space-y-2">
                {trend.rising.slice(0, 4).map((r) => (
                  <li key={r.code} className="flex items-center justify-between text-sm">
                    <Link href={`/fon/${r.code}`} className="font-mono text-xs font-semibold hover:text-brand-400">
                      {r.code}
                    </Link>
                    <ChangePill value={r.return_1m} className="text-xs" />
                  </li>
                ))}
              </ul>
              <Link
                href="/kesifler/trend"
                className="mt-5 inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300"
              >
                Detay <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </MagicCard>

          {/* Category leaders */}
          <MagicCard className="md:col-span-4">
            <div className="relative p-6">
              <Sparkles className="mb-4 h-5 w-5 text-amber-400" />
              <div className="serif text-2xl leading-none">Kategori şampiyonu</div>
              <p className="mt-1 text-xs text-muted-foreground">1 yıllık ortalama getiri</p>
              <ul className="mt-5 space-y-3">
                {catSorted.slice(0, 3).map((c) => (
                  <li key={c.category}>
                    <div className="truncate text-xs text-muted-foreground">{c.category}</div>
                    <div className="mt-0.5 flex items-center justify-between">
                      <Link href={`/fon/${c.top_fund_code}`} className="font-mono text-xs font-semibold hover:text-brand-400">
                        {c.top_fund_code}
                      </Link>
                      <span className="text-gain tabular-nums text-xs">{formatPercent(c.top_fund_return)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </MagicCard>
        </div>
      </section>

      <div className="container pt-12"><AdSlot placement="home-middle" className="mx-auto max-w-5xl" /></div>

      {/* EDITORIAL BREAK 2 */}
      <section className="container pt-24">
        <div className="mx-auto max-w-4xl">
          <div className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            — bölüm 02 · aylık seçki —
          </div>
          <h2 className="display max-w-2xl text-4xl leading-tight md:text-6xl">
            Son 30 günde <span className="display-italic text-brand-400">öne çıkanlar</span>
          </h2>
          <p className="mt-4 max-w-xl text-muted-foreground">
            Yüzdesel getiriler TEFAS değil, Fonoloji tarafından ham fiyatlardan yeniden üretilir.
            Aylık pozitif değişim — takip değeri.
          </p>
        </div>
      </section>

      <section className="container mt-10">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {movers1m.gainers.slice(0, 8).map((m, i) => (
            <FundTileCard key={m.code} {...m} rank={i + 1} />
          ))}
        </div>
      </section>

      <div className="container pt-12"><AdSlot placement="home-bottom" className="mx-auto max-w-5xl" /></div>

      {/* CTA SECTION */}
      <section className="container pb-24 pt-24">
        <div className="relative isolate overflow-hidden rounded-3xl border border-border p-10 md:p-16">
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-brand-500/10 via-background to-verdigris-500/5" />
          <div className="absolute inset-0 -z-10 [background-image:radial-gradient(circle_at_70%_20%,rgba(245, 158, 11,0.15),transparent_40%),radial-gradient(circle_at_20%_80%,rgba(45,212,191,0.1),transparent_40%)]" />
          <Meteors number={8} />
          <div className="relative mx-auto max-w-3xl text-center">
            <div className="mb-4 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              keşif merkezi
            </div>
            <h2 className="display text-4xl md:text-6xl">
              Veriden <span className="display-italic text-brand-400">içgörü</span> çıkar
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
              Korelasyon matrisi, risk-getiri haritası, volatilite ısı haritası, trend sinyalleri,
              reel getiri — hepsi tek sayfada.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/kesifler"
                className="group inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background"
              >
                Keşfet <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/karsilastir"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card/40 px-6 py-3 text-sm font-medium backdrop-blur hover:bg-card/80"
              >
                Fon karşılaştır
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function AnimatedBadge() {
  return (
    <div className="group relative inline-flex items-center gap-2 rounded-full border border-brand-500/40 bg-gradient-to-r from-brand-500/10 via-brand-500/5 to-verdigris-500/10 px-4 py-1.5 text-xs text-foreground/90 backdrop-blur-xl">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
      </span>
      <span>Canlı piyasa</span>
      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
    </div>
  );
}

function HeroStat({
  label,
  value,
  prefix,
  suffix,
  icon,
  decimalPlaces,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  icon?: React.ReactNode;
  decimalPlaces?: number;
}) {
  return (
    <div className="panel relative overflow-hidden p-5">
      <div className="mb-3 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        {prefix && <span className="serif text-2xl text-muted-foreground">{prefix}</span>}
        <div className="display text-4xl tabular-nums md:text-5xl">
          <NumberTicker value={value} decimalPlaces={decimalPlaces ?? 0} />
        </div>
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

function CpiStat({
  cpi,
}: {
  cpi: { latest: { date: string; yoy_change: number; mom_change: number | null } | null; next: { period: string; scheduled_date: string; scheduled_time: string } | null };
}) {
  const yoy = cpi.latest?.yoy_change ?? null;
  const next = cpi.next;
  return (
    <div className="panel relative overflow-hidden p-5">
      <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-amber-500/10 blur-2xl" />
      <div className="relative">
        <div className="mb-3 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <Percent className="h-3.5 w-3.5 text-amber-400" />
          TÜFE (yıllık)
        </div>
        <div className="flex items-baseline gap-1">
          <div className="display text-4xl tabular-nums md:text-5xl">
            {yoy !== null ? `%${(yoy * 100).toFixed(1)}` : '—'}
          </div>
        </div>
        {next && (
          <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
            <Calendar className="h-2.5 w-2.5" />
            Sıradaki: {formatShortTrDate(next.scheduled_date)}
          </div>
        )}
      </div>
    </div>
  );
}

function formatShortTrDate(iso: string): string {
  const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const [y, m, d] = iso.split('-');
  return `${d} ${months[Number(m) - 1]} ${y!.slice(2)}`;
}

function FundTileCard({ code, name, change, aum, rank }: { code: string; name: string; change: number; aum: number; rank: number }) {
  return (
    <Link
      href={`/fon/${code}`}
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-border bg-card/40 p-5 transition-all',
        'hover:-translate-y-0.5 hover:border-brand-500/40 hover:bg-card/80',
      )}
    >
      <div className="absolute right-4 top-4 serif text-xs text-muted-foreground/60">
        {String(rank).padStart(2, '0')}
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm font-semibold">{code}</span>
        <ChangePill value={change} className="text-xs" />
      </div>
      <div className="mt-3 line-clamp-2 text-sm leading-snug text-muted-foreground">{name}</div>
      <div className="mt-4 flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Fon büyüklüğü</span>
        <span className="text-sm tabular-nums">{formatCompact(aum)}</span>
      </div>
      <div className="absolute inset-x-5 bottom-0 h-px bg-gradient-to-r from-transparent via-brand-500/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}
