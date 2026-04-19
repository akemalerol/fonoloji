import { ArrowRight, Layers, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { ChangePill } from '@/components/fx/change-pill';
import { Explainer } from '@/components/fx/explainer';
import { OverlayChart } from '@/components/fx/overlay-chart';
import { PortfolioDonut, type PortfolioSlice } from '@/components/fx/portfolio-donut';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { cn, formatCompact, formatNumber, formatPercent, formatPrice, fundTypeLabel } from '@/lib/utils';
import { ShareButton } from '@/components/site/share-button';
import { CompareHeader } from './header';

export const revalidate = 60;
export const metadata = { title: 'Karşılaştır · Fonoloji' };

const PORTFOLIO_KEYS = [
  'stock',
  'government_bond',
  'treasury_bill',
  'corporate_bond',
  'eurobond',
  'gold',
  'cash',
  'other',
] as const;

export default async function ComparePage({
  searchParams,
}: {
  searchParams: { kodlar?: string; period?: string };
}) {
  const codes = (searchParams.kodlar ?? '')
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 6);
  const period = searchParams.period ?? '1y';

  // Empty state — user hasn't chosen anything yet.
  if (codes.length === 0) {
    return <EmptyCompare />;
  }

  if (codes.length < 2) {
    return <OneFundState code={codes[0]!} />;
  }

  const [details, histories, corrData] = await Promise.all([
    Promise.all(codes.map((c) => api.getFund(c).catch(() => null))),
    Promise.all(
      codes.map((c) => api.getHistory(c, period).catch(() => ({ code: c, period, points: [] }))),
    ),
    api.correlation(codes).catch(() => null),
  ]);

  const valid = details
    .map((d, i) => (d ? { detail: d, history: histories[i]! } : null))
    .filter((v): v is NonNullable<typeof v> => Boolean(v));

  if (valid.length < 2) {
    return (
      <div className="container py-20 text-center">
        <div className="display text-3xl">Fon bulunamadı</div>
        <p className="mt-2 text-sm text-muted-foreground">
          Kodların doğru olduğundan emin ol — <Link className="text-brand-400" href="/karsilastir">sıfırla</Link>
        </p>
      </div>
    );
  }

  const series = valid.map((v) => ({ code: v.detail.fund.code, points: v.history.points }));

  const codesJoined = valid.map((v) => v.detail.fund.code).join(',');
  const shareUrl = `https://fonoloji.com/karsilastir?kodlar=${codesJoined}`;
  const shareText = `${valid.map((v) => v.detail.fund.code).join(' vs ')} — Fonoloji karşılaştırması`;

  return (
    <div className="container py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CompareHeader codes={valid.map((v) => v.detail.fund.code)} />
        <ShareButton url={shareUrl} text={shareText} label="Karşılaştırmayı paylaş" />
      </div>

      {/* Summary strip — quick stats */}
      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-4">
        <SummaryCard
          label="Karşılaştırılan"
          value={String(valid.length)}
          sub={`${valid.length}/6 fon`}
        />
        <SummaryCard
          label="Kazanan (1Y)"
          value={(() => {
            const best = valid.reduce((a, b) =>
              (a.detail.fund.return_1y ?? -Infinity) > (b.detail.fund.return_1y ?? -Infinity) ? a : b,
            );
            return best.detail.fund.code;
          })()}
          sub="1 yıllık en yüksek getiri"
          highlight
        />
        <SummaryCard
          label="En düşük volatilite"
          value={(() => {
            const best = valid.reduce((a, b) =>
              (a.detail.fund.volatility_90 ?? Infinity) < (b.detail.fund.volatility_90 ?? Infinity) ? a : b,
            );
            return best.detail.fund.code;
          })()}
          sub="90 günlük stddev"
        />
        <SummaryCard
          label="En iyi Sharpe"
          value={(() => {
            const best = valid.reduce((a, b) =>
              (a.detail.fund.sharpe_90 ?? -Infinity) > (b.detail.fund.sharpe_90 ?? -Infinity) ? a : b,
            );
            return best.detail.fund.code;
          })()}
          sub="risk başına getiri"
          highlight
        />
      </div>

      {/* Overlay price chart */}
      <div className="mt-6 panel p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Normalize fiyat eğrisi</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              İlk gün = 100 · aynı başlangıç noktasından karşılaştırma
            </p>
          </div>
          <PeriodSwitcher codes={valid.map((v) => v.detail.fund.code)} active={period} />
        </div>
        <OverlayChart series={series} />
      </div>

      {/* Big metrics comparison table */}
      <div className="mt-6 overflow-hidden panel">
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Metrik karşılaştırma
          </h2>
          <span className="text-[10px] text-muted-foreground">
            Her satırda en iyi değer parlak · yatayda kaydırın
          </span>
        </div>
        <div className="overflow-x-auto">
          <MetricsTable funds={valid.map((v) => v.detail.fund)} />
        </div>
      </div>

      {/* Portfolio allocation side-by-side */}
      <div className="mt-6 panel p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold">Portföy dağılımları</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Her fonun son snapshot'ı</p>
        </div>
        <div
          className="grid gap-6"
          style={{ gridTemplateColumns: `repeat(${Math.min(valid.length, 3)}, minmax(0, 1fr))` }}
        >
          {valid.map(({ detail }) => {
            const p = detail.portfolio;
            const slices: PortfolioSlice[] = p
              ? PORTFOLIO_KEYS.map((k) => ({ key: k, value: p[k] ?? 0 }))
              : [];
            return (
              <div key={detail.fund.code} className="border-t border-border/40 pt-4 md:border-t-0 md:pt-0">
                <div className="mb-2 flex items-center gap-2">
                  <Link
                    href={`/fon/${detail.fund.code}`}
                    className="inline-flex h-7 w-12 items-center justify-center rounded bg-gradient-to-br from-brand-500 to-verdigris-400 font-mono text-[11px] font-bold text-background"
                  >
                    {detail.fund.code}
                  </Link>
                  <span className="truncate text-xs text-muted-foreground">
                    {detail.fund.name}
                  </span>
                </div>
                {slices.length > 0 && slices.some((s) => s.value > 0) ? (
                  <PortfolioDonut data={slices} size={180} />
                ) : (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    Portföy verisi yok
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Correlation matrix — enriched with insights */}
      {corrData && corrData.matrix.length > 0 && (
        <div className="mt-6 panel p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Korelasyon matrisi</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Pearson · günlük getirilerin birlikte hareket etme derecesi. +1 tam paralel, −1 tam zıt, 0 ilgisiz.
            </p>
          </div>

          {/* Insight tiles */}
          <CorrelationInsights matrix={corrData.matrix} />

          <div className="mt-6">
            <CorrelationHeatmap codes={corrData.codes} matrix={corrData.matrix} />
          </div>

          {/* Legend */}
          <div className="mt-5 grid grid-cols-2 gap-2 border-t border-border/40 pt-4 text-[11px] md:grid-cols-4">
            <LegendRow color="#10B981" label="+0.7 — +1.0" desc="Çok güçlü aynı yön" />
            <LegendRow color="#10B98160" label="+0.3 — +0.7" desc="Orta paralel" />
            <LegendRow color="#F43F5E60" label="−0.3 — −0.7" desc="Orta zıt yön" />
            <LegendRow color="#F43F5E" label="−0.7 — −1.0" desc="Güçlü hedge" />
          </div>
        </div>
      )}

      <div className="mt-10 rounded-2xl border border-border/50 bg-card/30 p-5 text-xs text-muted-foreground">
        <strong className="text-foreground">İpucu:</strong> Bu sayfanın URL'ini kopyalayıp paylaşabilirsin.
        Fon eklemek veya çıkarmak için üstteki seçiciyi kullan.
      </div>
    </div>
  );
}

function EmptyCompare() {
  return (
    <div className="container py-20">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-verdigris-500/20 ring-1 ring-border">
          <Layers className="h-6 w-6 text-brand-400" />
        </div>
        <h1 className="display text-5xl leading-[1.02] md:text-6xl">
          İki fonu <span className="display-italic gradient-text">yan yana</span> koy
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-sm text-muted-foreground md:text-base">
          Fiyat, getiri, risk, korelasyon, portföy dağılımı — hepsini aynı ekranda.
          Kendi seçtiğin minimum 2, maksimum 6 fon.
        </p>

        <div className="mt-8">
          <CompareHeader codes={[]} />
        </div>

        <div className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-3">
          <FeatureTile
            icon={Sparkles}
            title="Kazananı bul"
            desc="Getiri, volatilite, Sharpe'da en iyi fonu renk ile işaretliyoruz."
          />
          <FeatureTile
            icon={Layers}
            title="Portföy yan yana"
            desc="Her fonun varlık dağılımını donut olarak gösteriyoruz."
          />
          <FeatureTile
            icon={ArrowRight}
            title="Paylaşılabilir"
            desc="URL'i kopyalayıp paylaş — seçim hep saklı."
          />
        </div>
      </div>
    </div>
  );
}

function OneFundState({ code }: { code: string }) {
  return (
    <div className="container py-16">
      <div className="mx-auto max-w-xl text-center">
        <div className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">tek fon seçili</div>
        <h1 className="display text-4xl">Bir fon daha ekle</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          <Badge variant="default">{code}</Badge> seçildi. Karşılaştırma için minimum 2 fon gerekli.
        </p>
        <div className="mt-8">
          <CompareHeader codes={[code]} />
        </div>
      </div>
    </div>
  );
}

function FeatureTile({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
}) {
  return (
    <div className="panel p-5 text-left">
      <Icon className="mb-3 h-4 w-4 text-brand-400" />
      <div className="serif text-lg">{title}</div>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn('panel p-4', highlight && 'panel-highlight')}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('mt-1 font-mono text-2xl tabular-nums', highlight && 'text-brand-400')}>
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function PeriodSwitcher({ codes, active }: { codes: string[]; active: string }) {
  const periods = [
    { v: '1m', l: '1A' },
    { v: '3m', l: '3A' },
    { v: '6m', l: '6A' },
    { v: '1y', l: '1Y' },
    { v: '5y', l: '5Y' },
    { v: 'all', l: 'Tüm' },
  ];
  const base = codes.length ? `/karsilastir?kodlar=${codes.join(',')}` : '/karsilastir?';
  return (
    <div className="flex rounded-full border border-border/60 bg-card/40 p-1 text-[11px]">
      {periods.map((p) => (
        <Link
          key={p.v}
          href={`${base}&period=${p.v}`}
          className={cn(
            'rounded-full px-2.5 py-1 transition-colors',
            active === p.v ? 'bg-brand-500 text-background' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {p.l}
        </Link>
      ))}
    </div>
  );
}

function MetricsTable({ funds }: { funds: Array<import('@/lib/api').FundRow> }) {
  type ExplainerTerm = import('@/components/fx/explainer').ExplainerProps['term'];
  const rows: Array<{
    key: string;
    label: string;
    explain?: ExplainerTerm;
    fmt: (f: import('@/lib/api').FundRow) => unknown;
    better: 'high' | 'low' | 'none';
    pill?: boolean;
    pct?: boolean;
    decimal?: boolean;
    color?: boolean;
  }> = [
    { key: 'price', label: 'Fiyat', fmt: (f) => formatPrice(f.current_price ?? 0, 4), better: 'none' },
    { key: 'return_1d', label: '1 Gün', fmt: (f) => f.return_1d, better: 'high', pill: true },
    { key: 'return_1m', label: '1 Ay', fmt: (f) => f.return_1m, better: 'high', pill: true },
    { key: 'return_3m', label: '3 Ay', fmt: (f) => f.return_3m, better: 'high', pill: true },
    { key: 'return_1y', label: '1 Yıl', fmt: (f) => f.return_1y, better: 'high', pill: true },
    { key: 'return_ytd', label: 'YBİ', fmt: (f) => f.return_ytd, better: 'high', pill: true },
    { key: 'volatility_90', label: 'Volatilite (90g)', explain: 'volatility', fmt: (f) => f.volatility_90, better: 'low', pct: true },
    { key: 'sharpe_90', label: 'Sharpe (90g)', explain: 'sharpe_90', fmt: (f) => f.sharpe_90, better: 'high', decimal: true },
    { key: 'sortino_90', label: 'Sortino (90g)', explain: 'sortino', fmt: (f) => f.sortino_90, better: 'high', decimal: true },
    { key: 'calmar_1y', label: 'Calmar (1Y)', explain: 'calmar', fmt: (f) => f.calmar_1y, better: 'high', decimal: true },
    { key: 'beta_1y', label: 'Beta (1Y)', explain: 'beta', fmt: (f) => f.beta_1y, better: 'none', decimal: true },
    { key: 'real_return_1y', label: 'Reel getiri (1Y)', explain: 'real_return', fmt: (f) => f.real_return_1y, better: 'high', pct: true, color: true },
    { key: 'max_drawdown_1y', label: 'Max Drawdown (1Y)', explain: 'drawdown', fmt: (f) => f.max_drawdown_1y, better: 'high', pct: true, color: true },
    { key: 'aum', label: 'Fon Büyüklüğü', explain: 'aum', fmt: (f) => formatCompact(f.aum), better: 'none' },
    { key: 'investor_count', label: 'Yatırımcı', fmt: (f) => formatNumber(f.investor_count), better: 'none' },
    { key: 'risk_score', label: 'TEFAS Risk (1-7)', explain: 'risk_score', fmt: (f) => (f.risk_score != null ? `R${f.risk_score}` : '—'), better: 'none' },
  ];

  return (
    <table className="w-full text-sm">
      <thead className="border-b border-border bg-secondary/30 text-xs uppercase tracking-wider text-muted-foreground">
        <tr>
          <th className="py-3 pl-4 text-left font-medium">Metrik</th>
          {funds.map((f) => (
            <th key={f.code} className="py-3 px-3 text-right font-medium">
              <Link href={`/fon/${f.code}`} className="font-mono font-bold hover:text-brand-400">
                {f.code}
              </Link>
              <div className="mt-0.5 text-[10px] font-normal normal-case text-muted-foreground/80">
                {f.type ? fundTypeLabel(f.type) : '—'}
              </div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr className="border-b border-border/40">
          <td className="py-2.5 pl-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Ad
          </td>
          {funds.map((f) => (
            <td key={f.code} className="py-2.5 px-3 text-right text-xs text-muted-foreground">
              <span className="block max-w-[200px] truncate" title={f.name}>{f.name}</span>
              <span className="mt-0.5 block text-[10px] text-muted-foreground/70">{f.category}</span>
            </td>
          ))}
        </tr>
        {rows.map((row) => {
          const values = funds.map((f) => {
            const v = (row.fmt as (f: import('@/lib/api').FundRow) => unknown)(f);
            return typeof v === 'number' ? v : null;
          });
          const numericValues = values.filter((v): v is number => v !== null);
          const bestValue =
            row.better === 'high' ? Math.max(...numericValues) :
            row.better === 'low' ? Math.min(...numericValues) : null;

          return (
            <tr key={row.key} className="border-b border-border/40 last:border-0">
              <td className="py-2.5 pl-4 text-xs text-muted-foreground">
                {row.explain ? (
                  <Explainer term={row.explain}>{row.label}</Explainer>
                ) : (
                  row.label
                )}
              </td>
              {funds.map((f, i) => {
                const raw = (row.fmt as (f: import('@/lib/api').FundRow) => unknown)(f);
                const numeric = values[i];
                const isBest = bestValue !== null && numeric === bestValue && numericValues.length > 1;
                let display: React.ReactNode;
                if (row.pill && numeric !== null) {
                  display = <ChangePill value={numeric} className="justify-end text-xs" />;
                } else if (typeof raw === 'number') {
                  const colored = (row as { color?: boolean }).color;
                  display = (
                    <span
                      className={cn(
                        'tabular-nums',
                        colored && raw > 0 && 'text-gain',
                        colored && raw < 0 && 'text-loss',
                      )}
                    >
                      {(row as { pct?: boolean }).pct
                        ? formatPercent(raw)
                        : (row as { decimal?: boolean }).decimal
                        ? raw.toFixed(2)
                        : raw}
                    </span>
                  );
                } else {
                  display = <span className="tabular-nums text-muted-foreground">{raw as string ?? '—'}</span>;
                }
                return (
                  <td
                    key={f.code}
                    className={cn(
                      'py-2.5 px-3 text-right text-xs',
                      isBest && 'bg-brand-500/10 text-foreground font-semibold ring-1 ring-inset ring-brand-500/30',
                    )}
                  >
                    {display}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function LegendRow({ color, label, desc }: { color: string; label: string; desc: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block h-3 w-5 rounded-sm" style={{ background: color }} />
      <div>
        <div className="font-mono text-[10px] text-foreground">{label}</div>
        <div className="text-[10px] text-muted-foreground/80">{desc}</div>
      </div>
    </div>
  );
}

function CorrelationInsights({
  matrix,
}: {
  matrix: Array<{ a: string; b: string; r: number | null }>;
}) {
  // Off-diagonal only
  const offDiag = matrix.filter((m) => m.a !== m.b && m.r !== null) as Array<{
    a: string;
    b: string;
    r: number;
  }>;
  if (offDiag.length === 0) return null;

  // Dedupe: only keep a<b
  const unique = offDiag.filter((m) => m.a < m.b);

  const sorted = [...unique].sort((a, b) => b.r - a.r);
  const mostCorrelated = sorted[0]!;
  const leastCorrelated = sorted[sorted.length - 1]!;

  const avgR = unique.reduce((acc, m) => acc + m.r, 0) / unique.length;
  const highCount = unique.filter((m) => m.r > 0.7).length;
  const hedgeCount = unique.filter((m) => m.r < 0).length;

  const verdict =
    avgR > 0.75
      ? { text: 'Çok benzer fonlar — çeşitlendirme yok', tone: 'loss' as const }
      : avgR > 0.5
      ? { text: 'Orta benzer — kısmi çeşitlendirme', tone: 'amber' as const }
      : avgR > 0.2
      ? { text: 'İyi dengeli portföy adayı', tone: 'gain' as const }
      : { text: 'Güçlü hedge — ters hareket eden fonlar', tone: 'gain' as const };

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <InsightTile
        label="Ortalama korelasyon"
        value={avgR.toFixed(2)}
        hint={verdict.text}
        tone={verdict.tone}
        big
      />
      <InsightTile
        label="En benzer çift"
        value={`${mostCorrelated.a} ↔ ${mostCorrelated.b}`}
        hint={`r = ${mostCorrelated.r.toFixed(2)}`}
        tone={mostCorrelated.r > 0.7 ? 'loss' : 'muted'}
      />
      <InsightTile
        label="En zıt çift"
        value={`${leastCorrelated.a} ↔ ${leastCorrelated.b}`}
        hint={`r = ${leastCorrelated.r.toFixed(2)}`}
        tone={leastCorrelated.r < 0 ? 'gain' : 'muted'}
      />
      <InsightTile
        label="Dağılım"
        value={`${highCount} benzer · ${hedgeCount} hedge`}
        hint={`${unique.length} çift toplamda`}
        tone="muted"
      />
    </div>
  );
}

function InsightTile({
  label,
  value,
  hint,
  tone,
  big,
}: {
  label: string;
  value: string;
  hint: string;
  tone: 'gain' | 'loss' | 'amber' | 'muted';
  big?: boolean;
}) {
  const toneClass = {
    gain: 'text-gain',
    loss: 'text-loss',
    amber: 'text-amber-400',
    muted: 'text-foreground',
  }[tone];
  return (
    <div className="rounded-xl border border-border/50 bg-card/30 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('mt-1 font-mono tabular-nums', big ? 'text-2xl' : 'text-base', toneClass)}>
        {value}
      </div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div>
    </div>
  );
}

function CorrelationHeatmap({
  codes,
  matrix,
}: {
  codes: string[];
  matrix: Array<{ a: string; b: string; r: number | null }>;
}) {
  const lookup = new Map<string, number | null>();
  for (const m of matrix) {
    lookup.set(`${m.a}|${m.b}`, m.r);
    lookup.set(`${m.b}|${m.a}`, m.r);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs tabular-nums">
        <thead>
          <tr>
            <th />
            {codes.map((c) => (
              <th key={c} className="px-2 py-1 text-muted-foreground">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {codes.map((row) => (
            <tr key={row}>
              <th className="px-2 py-1 text-right text-muted-foreground">{row}</th>
              {codes.map((col) => {
                const r = lookup.get(`${row}|${col}`);
                if (r === null || r === undefined)
                  return (
                    <td
                      key={col}
                      className="border border-border/40 px-3 py-2 text-center text-muted-foreground"
                    >
                      —
                    </td>
                  );
                const alpha = Math.abs(r);
                const bg =
                  row === col
                    ? 'rgba(245, 158, 11, 0.35)'
                    : r > 0
                    ? `rgba(16, 185, 129, ${alpha * 0.7})`
                    : `rgba(244, 63, 94, ${alpha * 0.7})`;
                return (
                  <td
                    key={col}
                    className="border border-border/40 px-3 py-2 text-center font-medium"
                    style={{ background: bg }}
                  >
                    {r.toFixed(2)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
