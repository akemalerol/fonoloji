import { Award, TrendingDown, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ShareButton } from '@/components/site/share-button';
import { api } from '@/lib/api';
import { formatCompact, formatPercent } from '@/lib/utils';

export const revalidate = 86400; // günlük

type FundRow = {
  code: string;
  name: string;
  category: string | null;
  aum: number | null;
  return_1y: number | null;
  return_ytd: number | null;
  real_return_1y: number | null;
  sharpe_90: number | null;
  volatility_90: number | null;
  max_drawdown_1y: number | null;
};

export async function generateMetadata({ params }: { params: { yil: string } }) {
  return {
    title: `${params.yil} yılın en iyi TEFAS fonları`,
    description: `${params.yil} yılında en yüksek getiri, en iyi Sharpe oranı ve en iyi reel getiriyi sağlayan TEFAS yatırım fonları.`,
  };
}

export default async function YilinEnIyiPage({ params }: { params: { yil: string } }) {
  const yil = parseInt(params.yil, 10);
  const thisYear = new Date().getFullYear();
  if (!Number.isFinite(yil) || yil < 2020 || yil > thisYear) notFound();

  // Mevcut yıl → YTD, eski yıl → tam yıllık getiri
  const isCurrent = yil === thisYear;
  const sortKey = isCurrent ? 'return_ytd' : 'return_1y';

  const { items: all } = await api.listFunds({ limit: 500, sort: sortKey, dir: 'desc' });
  const funds = all.filter((f) => (f as unknown as FundRow)[sortKey as keyof FundRow] !== null).slice(0, 100) as unknown as FundRow[];

  if (funds.length === 0) notFound();

  // Top 10 getiri
  const topReturn = funds.slice(0, 10);
  // Top 10 Sharpe
  const topSharpe = [...funds]
    .filter((f) => f.sharpe_90 !== null)
    .sort((a, b) => (b.sharpe_90 ?? 0) - (a.sharpe_90 ?? 0))
    .slice(0, 10);
  // Top 10 Reel getiri
  const topReal = [...funds]
    .filter((f) => f.real_return_1y !== null)
    .sort((a, b) => (b.real_return_1y ?? 0) - (a.real_return_1y ?? 0))
    .slice(0, 10);
  // En dirençli — en düşük max drawdown (en az negatif)
  const topResilient = [...funds]
    .filter((f) => f.max_drawdown_1y !== null && f.return_1y !== null && f.return_1y > 0)
    .sort((a, b) => (b.max_drawdown_1y ?? -100) - (a.max_drawdown_1y ?? -100))
    .slice(0, 10);

  const yearLabel = isCurrent ? `${yil} (yıl başından)` : `${yil}`;

  return (
    <div className="container py-10 md:py-14">
      <div className="mb-10 flex flex-wrap items-start justify-between gap-4 border-b border-border/50 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <Award className="h-3 w-3 text-amber-400" /> Yıllık Rapor
          </div>
          <h1 className="display mt-2 text-5xl leading-none md:text-6xl">
            <span className="display-italic gradient-text">{yearLabel}</span>
            <br />
            en iyi fonlar
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            TEFAS'ta {yearLabel} en yüksek getiri, en iyi Sharpe oranı,
            en yüksek reel getiri ve en dirençli (düşük drawdown + pozitif getiri)
            Türk yatırım fonları. Sadece TEFAS'ta aktif işlem gören, yeterli
            likidite ve yatırımcı sayısına sahip fonlar.
          </p>
        </div>
        <ShareButton
          url={`https://fonoloji.com/en-iyi-fonlar/${yil}`}
          text={`${yearLabel} TEFAS'ın en iyi fonları — Fonoloji`}
          label="Raporu paylaş"
        />
      </div>

      <div className="mb-6 flex flex-wrap gap-2 text-xs">
        {[thisYear, thisYear - 1, thisYear - 2, thisYear - 3].map((y) => (
          <Link
            key={y}
            href={`/en-iyi-fonlar/${y}`}
            className={`rounded-full border px-3 py-1 font-mono tabular-nums transition ${
              y === yil
                ? 'border-amber-500/50 bg-amber-500/10 text-amber-200'
                : 'border-border/50 bg-background/40 text-muted-foreground hover:border-amber-500/30 hover:text-foreground'
            }`}
          >
            {y}
          </Link>
        ))}
      </div>

      <Section
        title="En yüksek getiri"
        subtitle={`${yearLabel} dönemi`}
        icon={<TrendingUp className="h-4 w-4 text-gain" />}
        funds={topReturn}
        valueKey={sortKey as keyof FundRow}
        valueFmt={(v) => formatPercent(v as number, 1)}
      />

      <Section
        title="En iyi Sharpe (risk başına getiri)"
        subtitle="90 günlük Sharpe oranı"
        icon={<Award className="h-4 w-4 text-amber-400" />}
        funds={topSharpe}
        valueKey="sharpe_90"
        valueFmt={(v) => (v as number).toFixed(2)}
      />

      <Section
        title="En yüksek reel getiri"
        subtitle="TÜFE'den arındırılmış"
        icon={<TrendingUp className="h-4 w-4 text-verdigris-400" />}
        funds={topReal}
        valueKey="real_return_1y"
        valueFmt={(v) => formatPercent(v as number, 1)}
      />

      <Section
        title="En dirençli (pozitif getiri + düşük düşüş)"
        subtitle="Max drawdown küçük, yıllık getiri pozitif"
        icon={<TrendingDown className="h-4 w-4 text-emerald-400" />}
        funds={topResilient}
        valueKey="max_drawdown_1y"
        valueFmt={(v) => formatPercent(v as number, 1)}
      />

      <p className="mt-16 border-t border-border/40 pt-6 text-center text-xs text-muted-foreground">
        Kaynak: TEFAS günlük senkronizasyon · Sadece aktif işlem gören fonlar ·
        Yatırım tavsiyesi değildir
      </p>
    </div>
  );
}

function Section({
  title,
  subtitle,
  icon,
  funds,
  valueKey,
  valueFmt,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  funds: FundRow[];
  valueKey: keyof FundRow;
  valueFmt: (v: number | null) => string;
}) {
  if (funds.length === 0) return null;
  return (
    <section className="mb-12">
      <div className="mb-4 flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="serif text-2xl">{title}</h2>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {subtitle}
        </span>
      </div>
      <ol className="space-y-2">
        {funds.map((f, i) => {
          const v = f[valueKey] as number | null;
          return (
            <li key={f.code}>
              <Link
                href={`/fon/${f.code}`}
                className="panel group flex items-center gap-4 p-4 transition hover:border-brand-500/30"
              >
                <div className="w-6 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground/60">
                  #{i + 1}
                </div>
                <div className="inline-flex h-10 w-16 items-center justify-center rounded bg-gradient-to-br from-brand-500 to-verdigris-400 font-mono text-xs font-bold text-background">
                  {f.code}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{f.name}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {f.category ?? '—'}
                    {f.aum ? ` · ${formatCompact(f.aum)}` : ''}
                  </div>
                </div>
                <div className="font-mono text-xl font-semibold tabular-nums">
                  {valueFmt(v)}
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
