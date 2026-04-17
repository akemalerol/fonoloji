import { ArrowDownRight, ArrowUpRight, Bitcoin, Circle, CircleDot, DollarSign, Globe, Landmark, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import { MarketCard } from './card';
import { MarketSessionBadge } from './session-badge';

export const metadata = {
  title: 'Canlı Piyasalar',
  description: 'BIST, döviz, altın, gümüş, global borsalar ve kripto — hepsi tek bir dashboard\'da, anlık.',
};
export const revalidate = 30;

interface Group {
  title: string;
  subtitle: string;
  symbols: string[];
  accent: string;
  icon: React.ReactNode;
}

const GROUPS: Group[] = [
  {
    title: 'Türkiye',
    subtitle: 'BIST 100 endeksi',
    symbols: ['BIST100'],
    accent: 'emerald',
    icon: <Landmark className="h-3.5 w-3.5" />,
  },
  {
    title: 'Döviz',
    subtitle: 'TCMB referansları — Yahoo spot',
    symbols: ['USDTRY', 'EURTRY', 'GBPTRY'],
    accent: 'sky',
    icon: <DollarSign className="h-3.5 w-3.5" />,
  },
  {
    title: 'Değerli metaller',
    subtitle: 'Altın ve gümüş — ons ve gram',
    symbols: ['GOLDTRY_GR', 'GOLDUSD_OZ', 'SILVERTRY_GR', 'SILVERUSD_OZ'],
    accent: 'amber',
    icon: <Circle className="h-3.5 w-3.5" />,
  },
  {
    title: 'Global borsalar',
    subtitle: 'Dünyanın en büyük 10 endeksi — piyasa saatlerine göre, ~15 dk gecikmeli',
    symbols: ['NDX', 'SPX', 'DJI', 'FTSE', 'DAX', 'CAC', 'N225', 'HSI', 'KOSPI', 'NIFTY'],
    accent: 'cyan',
    icon: <Globe className="h-3.5 w-3.5" />,
  },
  {
    title: 'Kripto',
    subtitle: 'Top 10 — 7/24 piyasa, anlık',
    symbols: ['BTCUSD', 'ETHUSD', 'BNBUSD', 'SOLUSD', 'XRPUSD', 'DOGEUSD', 'ADAUSD', 'TRXUSD', 'AVAXUSD', 'LINKUSD'],
    accent: 'orange',
    icon: <Bitcoin className="h-3.5 w-3.5" />,
  },
];

export default async function PiyasalarPage() {
  const { items } = await api.liveMarket().catch(() => ({ items: [] }));
  const bySymbol = new Map(items.map((t) => [t.symbol, t]));

  const totalTickers = items.length;
  const upCount = items.filter((t) => (t.change_pct ?? 0) > 0).length;
  const downCount = items.filter((t) => (t.change_pct ?? 0) < 0).length;

  return (
    <div className="container py-10 md:py-14">
      {/* Header */}
      <div className="mb-10 border-b border-border/50 pb-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          Canlı
        </div>
        <h1 className="display mt-2 text-5xl leading-none md:text-6xl">
          <span className="display-italic gradient-text">Piyasalar</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          BIST, döviz, altın, gümüş, global borsalar ve kripto — hepsi tek yerde. Her kart
          değerin yanında günlük değişimi, ait olduğu seansı ve piyasanın açık/kapalı durumunu
          gösteriyor.
        </p>

        {/* Top-level stats */}
        <div className="mt-6 flex flex-wrap items-center gap-6 text-xs text-muted-foreground">
          <div className="inline-flex items-center gap-1.5">
            <CircleDot className="h-3 w-3 text-foreground/70" />
            <span>{totalTickers} ticker takipte</span>
          </div>
          <div className="inline-flex items-center gap-1.5">
            <ArrowUpRight className="h-3 w-3 text-gain" />
            <span className="text-gain">{upCount} yükselişte</span>
          </div>
          <div className="inline-flex items-center gap-1.5">
            <ArrowDownRight className="h-3 w-3 text-loss" />
            <span className="text-loss">{downCount} düşüşte</span>
          </div>
          <div className="inline-flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3 text-muted-foreground" />
            <span>{totalTickers - upCount - downCount} değişim yok</span>
          </div>
        </div>
      </div>

      {/* Groups */}
      <div className="space-y-12">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <div className="mb-4 flex items-baseline justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md bg-${g.accent}-500/10 text-${g.accent}-400 ring-1 ring-${g.accent}-400/20`}>
                    {g.icon}
                  </span>
                  <h2 className="serif text-2xl">{g.title}</h2>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{g.subtitle}</p>
              </div>
              <MarketSessionBadge symbols={g.symbols} />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {g.symbols.map((sym) => {
                const t = bySymbol.get(sym);
                if (!t) return null;
                return <MarketCard key={sym} ticker={t} />;
              })}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-16 border-t border-border/40 pt-6 text-center text-xs text-muted-foreground">
        Kaynak: Yahoo Finance (~15 dk gecikmeli) · Crypto 7/24 · BIST T+1 fon fiyatları ayrıca{' '}
        <a href="/fonlar" className="text-brand-400 hover:text-brand-300">/fonlar</a> altında.
      </p>
    </div>
  );
}
