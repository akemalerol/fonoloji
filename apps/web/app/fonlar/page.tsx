import { Activity, ArrowUpDown, Flame, Rocket, Shield, Sparkles, TrendingUp, Waves } from 'lucide-react';
import Link from 'next/link';
import { ChangePill } from '@/components/fx/change-pill';
import { PortfolioChip } from '@/components/fx/portfolio-chip';
import { Badge } from '@/components/ui/badge';
import { api, type FundRow } from '@/lib/api';
import { cn, formatCompact, formatPrice, fundTypeLabel } from '@/lib/utils';

export const metadata = { title: 'Fonlar' };
export const revalidate = 60;

type SortKey = 'aum' | 'return_1d' | 'return_1m' | 'return_1y' | 'return_ytd' | 'volatility' | 'sharpe' | 'risk' | 'investors' | 'name';
type PresetKey = 'sharpe' | 'return_1y' | 'low_vol' | 'popular' | 'winners' | 'fresh';

const PRESETS: Record<PresetKey, {
  label: string;
  desc: string;
  icon: React.ElementType;
  sort: SortKey;
  filter: (f: FundRow) => boolean;
  limit: number;
}> = {
  sharpe: {
    label: '🏆 En iyi Sharpe',
    desc: 'Risk başına getirisi en yüksek fonlar',
    icon: Sparkles,
    sort: 'sharpe',
    filter: (f) => (f.sharpe_90 ?? -Infinity) > 0.5 && (f.aum ?? 0) > 50_000_000,
    limit: 40,
  },
  return_1y: {
    label: '🔥 1Y en yüksek getiri',
    desc: 'Son 12 ayda en çok kazandıran',
    icon: Flame,
    sort: 'return_1y',
    filter: (f) => (f.return_1y ?? -Infinity) > 0 && (f.aum ?? 0) > 10_000_000,
    limit: 40,
  },
  low_vol: {
    label: '🛡️ Düşük volatilite',
    desc: 'En az dalgalanan — muhafazakar',
    icon: Shield,
    sort: 'volatility',
    filter: (f) => (f.volatility_90 ?? Infinity) < 0.1 && (f.return_1y ?? -Infinity) > 0,
    limit: 40,
  },
  popular: {
    label: '💰 Popüler (> ₺1 Mr)',
    desc: 'Büyük fonlar — kurumsal ilgi yüksek',
    icon: Waves,
    sort: 'aum',
    filter: (f) => (f.aum ?? 0) > 1_000_000_000,
    limit: 50,
  },
  winners: {
    label: '📈 Kazananlar (1A + 1Y pozitif)',
    desc: 'Kısa ve uzun vadede yükselen',
    icon: TrendingUp,
    sort: 'return_1m',
    filter: (f) => (f.return_1m ?? -Infinity) > 0 && (f.return_1y ?? -Infinity) > 0 && (f.aum ?? 0) > 10_000_000,
    limit: 50,
  },
  fresh: {
    label: '✨ Hızlı yükselenler',
    desc: 'Son 1 ayda pozitif sapma > %5',
    icon: Rocket,
    sort: 'return_1m',
    filter: (f) => (f.return_1m ?? 0) > 0.05 && (f.aum ?? 0) > 20_000_000,
    limit: 40,
  },
};

export default async function FundsPage({
  searchParams,
}: {
  searchParams: { type?: string; category?: string; sort?: string; dir?: string; q?: string; preset?: PresetKey };
}) {
  const preset = searchParams.preset && PRESETS[searchParams.preset] ? searchParams.preset : undefined;
  const presetCfg = preset ? PRESETS[preset] : null;
  const sort = (presetCfg?.sort ?? (searchParams.sort as SortKey)) ?? 'aum';
  const dir: 'asc' | 'desc' = searchParams.dir === 'asc' ? 'asc' : 'desc';

  const { items: allItems } = await api.listFunds({
    type: searchParams.type,
    category: searchParams.category,
    sort,
    dir,
    q: searchParams.q,
    limit: 500,
  });

  const items = presetCfg ? allItems.filter(presetCfg.filter).slice(0, presetCfg.limit) : allItems;

  const types = Array.from(new Set(allItems.map((f) => f.type).filter(Boolean))) as string[];
  const categories = Array.from(new Set(allItems.map((f) => f.category).filter(Boolean))) as string[];

  return (
    <div className="container py-10">
      <div className="mb-8 flex items-end justify-between gap-4 border-b border-border/50 pb-6">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Dizin</div>
          <h1 className="display mt-2 text-5xl leading-none md:text-6xl">Fonlar</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            <span className="font-mono tabular-nums text-foreground">{items.length}</span> fon
            {presetCfg ? (
              <> · filtre: <strong className="text-foreground">{presetCfg.label}</strong></>
            ) : (
              <> · fon büyüklüğüne göre sıralı</>
            )}
          </p>
        </div>
        <a
          href="/api/funds.csv?limit=2000"
          download
          className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background/40 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-brand-500/40 hover:text-foreground"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3"><path d="M12 3v12m0 0l-4-4m4 4l4-4M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2" /></svg>
          CSV indir
        </a>
      </div>

      {/* Akıllı seçiciler — preset chip'leri */}
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2">
          <Activity className="h-3 w-3 text-brand-400" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Akıllı seçiciler
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/fonlar"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs transition-all',
              !preset
                ? 'border-brand-500 bg-brand-500/15 text-foreground shadow-sm'
                : 'border-border bg-card/40 text-muted-foreground hover:border-border hover:text-foreground',
            )}
          >
            Tümü
          </Link>
          {Object.entries(PRESETS).map(([key, cfg]) => {
            const active = preset === key;
            return (
              <Link
                key={key}
                href={`/fonlar?preset=${key}`}
                title={cfg.desc}
                className={cn(
                  'group inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs transition-all',
                  active
                    ? 'border-brand-500 bg-brand-500/15 text-foreground shadow-sm'
                    : 'border-border bg-card/40 text-muted-foreground hover:border-border hover:text-foreground hover:-translate-y-0.5',
                )}
              >
                {cfg.label}
              </Link>
            );
          })}
        </div>
        {presetCfg && (
          <p className="mt-2 text-[11px] text-muted-foreground">{presetCfg.desc}</p>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterGroup
          label="Tip"
          current={searchParams.type}
          options={types}
          paramKey="type"
          formatLabel={fundTypeLabel}
        />
        <FilterGroup
          label="Kategori"
          current={searchParams.category}
          options={categories}
          paramKey="category"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card/40">
        <table className="w-full min-w-[1000px] table-fixed text-sm">
          <colgroup>
            <col className="w-[72px]" />
            <col />
            <col className="w-[60px]" />
            <col className="w-[90px]" />
            <col className="w-[72px]" />
            <col className="w-[72px]" />
            <col className="w-[72px]" />
            <col className="w-[150px]" />
            <col className="w-[90px]" />
            <col className="w-[80px]" />
            <col className="w-[110px]" />
            <col className="w-[40px]" />
          </colgroup>
          <thead className="border-b border-border bg-secondary/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="py-3 pl-4 text-left font-medium">Kod</th>
              <SortHeader label="Fon" sortKey="name" current={sort} currentDir={dir} />
              <SortHeader label="Risk" sortKey="risk" current={sort} currentDir={dir} align="left" />
              <SortHeader label="Fiyat" sortKey="aum" current={sort} currentDir={dir} align="right" hideOnMobile />
              <SortHeader label="1G" sortKey="return_1d" current={sort} currentDir={dir} align="right" />
              <SortHeader label="1A" sortKey="return_1m" current={sort} currentDir={dir} align="right" hideOnMobile />
              <SortHeader label="1Y" sortKey="return_1y" current={sort} currentDir={dir} align="right" />
              <th className="hidden py-3 text-left font-medium md:table-cell">Portföy</th>
              <SortHeader label="Volatilite" sortKey="volatility" current={sort} currentDir={dir} align="right" hideOnMobile />
              <SortHeader label="Sharpe" sortKey="sharpe" current={sort} currentDir={dir} align="right" hideOnMobile />
              <SortHeader label="Fon büyüklüğü" sortKey="aum" current={sort} currentDir={dir} align="right" />
              <th className="py-3 pr-4" />
            </tr>
          </thead>
          <tbody>
            {items.map((f) => (
              <Row key={f.code} fund={f} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ fund }: { fund: FundRow }) {
  return (
    <tr className="border-b border-border/60 transition-colors hover:bg-secondary/30">
      <td className="py-3 pl-4">
        <Link
          href={`/fon/${fund.code}`}
          className="inline-flex items-center rounded bg-secondary/70 px-2 py-0.5 font-mono text-xs font-bold"
        >
          {fund.code}
        </Link>
      </td>
      <td className="py-3 pr-3">
        <Link href={`/fon/${fund.code}`} className="block min-w-0">
          <div className="truncate text-sm leading-tight hover:text-brand-400" title={fund.name}>
            {fund.name}
          </div>
          {fund.category && (
            <div className="mt-0.5 truncate text-[11px] text-muted-foreground" title={fund.category}>
              {fund.category}
            </div>
          )}
        </Link>
      </td>
      <td className="py-3">
        {fund.risk_score ? (
          <span className="inline-flex items-center gap-0.5 rounded-md bg-secondary/60 px-1.5 py-0.5 text-[11px] font-mono">
            R{fund.risk_score}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="hidden py-3 text-right tabular-nums md:table-cell">
        {formatPrice(fund.current_price ?? 0, 4)}
      </td>
      <td className="py-3 text-right">
        <ChangePill value={fund.return_1d ?? null} className="justify-end" />
      </td>
      <td className="hidden py-3 text-right md:table-cell">
        <ChangePill value={fund.return_1m ?? null} className="justify-end" />
      </td>
      <td className="py-3 text-right">
        <ChangePill value={fund.return_1y ?? null} className="justify-end" />
      </td>
      <td className="hidden py-3 pl-3 pr-4 md:table-cell">
        <div className="w-full max-w-[130px]">
          <PortfolioChip fund={fund} />
        </div>
      </td>
      <td className="hidden py-3 text-right tabular-nums text-muted-foreground md:table-cell">
        {fund.volatility_90 ? `${(fund.volatility_90 * 100).toFixed(1)}%` : '—'}
      </td>
      <td className="hidden py-3 text-right tabular-nums text-muted-foreground md:table-cell">
        {fund.sharpe_90?.toFixed(2) ?? '—'}
      </td>
      <td className="py-3 text-right tabular-nums">{formatCompact(fund.aum)}</td>
      <td className="py-3 pr-4 text-right">
        <Link
          href={`/fon/${fund.code}`}
          className="text-xs text-muted-foreground transition-colors hover:text-brand-400"
        >
          →
        </Link>
      </td>
    </tr>
  );
}

function SortHeader({
  label,
  sortKey,
  current,
  currentDir,
  align = 'left',
  hideOnMobile,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  currentDir: 'asc' | 'desc';
  align?: 'left' | 'right';
  hideOnMobile?: boolean;
}) {
  const active = current === sortKey;
  // Click logic: same column → flip dir; different column → desc (except name which defaults asc)
  const nextDir = active ? (currentDir === 'desc' ? 'asc' : 'desc') : sortKey === 'name' ? 'asc' : 'desc';
  return (
    <th
      className={cn(
        'py-3 font-medium',
        align === 'right' && 'text-right',
        hideOnMobile && 'hidden md:table-cell',
      )}
    >
      <Link
        href={`?sort=${sortKey}&dir=${nextDir}`}
        className={cn(
          'inline-flex items-center gap-1 transition-colors hover:text-foreground',
          active && 'text-foreground',
        )}
      >
        {label}
        <ArrowUpDown className={cn('h-3 w-3 transition-opacity', active ? 'opacity-100' : 'opacity-40')} />
        {active && (
          <span className="font-mono text-[8px] text-brand-400">{currentDir === 'desc' ? '↓' : '↑'}</span>
        )}
      </Link>
    </th>
  );
}

function FilterGroup({
  label,
  current,
  options,
  paramKey,
  formatLabel,
}: {
  label: string;
  current?: string;
  options: string[];
  paramKey: string;
  formatLabel?: (v: string) => string;
}) {
  const fmt = formatLabel ?? ((v: string) => v);
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-card/40 p-1">
      <span className="px-2 text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <Link href={`?${paramKey}=`}>
        <Badge variant={!current ? 'default' : 'muted'} className="cursor-pointer">
          Tümü
        </Badge>
      </Link>
      {options.slice(0, 6).map((opt) => (
        <Link key={opt} href={`?${paramKey}=${encodeURIComponent(opt)}`}>
          <Badge variant={current === opt ? 'default' : 'muted'} className="cursor-pointer">
            {fmt(opt)}
          </Badge>
        </Link>
      ))}
    </div>
  );
}
