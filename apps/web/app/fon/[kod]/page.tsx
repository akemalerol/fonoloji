import { Activity, ArrowRight, Calendar, ExternalLink, Shield, Sparkles, TrendingDown, TrendingUp, Users, Wallet } from 'lucide-react';
import { KapDisclosuresCard } from './kap-disclosures-card';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChangePill } from '@/components/fx/change-pill';
import { DrawdownChart } from '@/components/fx/drawdown-chart';
import { LiveEstimate } from '@/components/fx/live-estimate';
import { MonthlyHistogram } from '@/components/fx/monthly-histogram';
import { RiskGauge } from '@/components/fx/risk-gauge';
import { PeriodTabs } from '@/components/fx/period-tabs';
import { Explainer } from '@/components/fx/explainer';
import { PortfolioDonut, type PortfolioSlice } from '@/components/fx/portfolio-donut';
import { PortfolioTimeline } from '@/components/fx/portfolio-timeline';
import { PriceChart } from '@/components/fx/price-chart';
import { SeasonalityHeatmap } from '@/components/fx/seasonality-heatmap';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { decodeCategory, decodeFundName, editorialSnippet } from '@/lib/decoders';
import { cn, formatCompact, formatDate, formatNumber, formatPercent, formatPrice, fundTypeLabel } from '@/lib/utils';

export const revalidate = 60;

export async function generateMetadata({ params }: { params: { kod: string } }) {
  try {
    const detail = await api.getFund(params.kod.toUpperCase());
    const f = detail.fund;
    const code = params.kod.toUpperCase();
    const return1yText = f.return_1y !== undefined && f.return_1y !== null
      ? ` 1Y getiri %${(f.return_1y * 100).toFixed(1)}.`
      : '';
    const description = `${f.name} (${code}) fon analizi. ${f.category ?? ''}.${return1yText} Sharpe, reel getiri, portföy dağılımı ve risk metrikleri — Fonoloji. Yatırım tavsiyesi değildir.`;
    return {
      title: `${code} — ${f.name}`,
      description,
      alternates: {
        canonical: `https://fonoloji.com/fon/${code}`,
      },
      openGraph: {
        title: `${code} · ${f.name}`,
        description,
        url: `https://fonoloji.com/fon/${code}`,
        type: 'article',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${code} · Fonoloji`,
        description,
      },
    };
  } catch {
    return { title: params.kod.toUpperCase() };
  }
}

export default async function FundDetailPage({
  params,
  searchParams,
}: {
  params: { kod: string };
  searchParams: { period?: string };
}) {
  const code = params.kod.toUpperCase();
  let detail;
  try {
    detail = await api.getFund(code);
  } catch {
    notFound();
  }
  if (!detail) notFound();

  const period = searchParams.period ?? '1y';
  const [history, monthly, drawdown, timeline, advanced, aiSummary, disclosures] = await Promise.all([
    api.getHistory(code, period),
    api.getMonthly(code).catch(() => ({ code, months: [] })),
    api.getDrawdown(code).catch(() => ({ code, points: [] })),
    api.getPortfolioTimeline(code, 180).catch(() => ({ code, points: [] })),
    api.advanced(code).catch(() => ({ code, stress_periods: [], seasonality: [], leakage: null, bench_alpha: { '3m': null, '1y': null } })),
    api.aiSummary(code).catch(() => ({ code, summary: null as string | null, cached: false, model: undefined as string | undefined })),
    api.disclosures(code, 50).catch(() => ({ code, items: [] as Array<{ disclosure_index: number; subject: string | null; kap_title: string | null; rule_type: string | null; period: number | null; year: number | null; publish_date: number; attachment_count: number; summary: string | null }>, backfillTriggered: false })),
  ]);
  const points = history.points;
  const firstPrice = points[0]?.price ?? 0;
  const lastPrice = points[points.length - 1]?.price ?? 0;
  const periodReturn = firstPrice > 0 ? (lastPrice - firstPrice) / firstPrice : 0;

  const { fund, portfolio } = detail;

  // Editorial snippet + decoders (category meaning, name tags)
  const commentary = editorialSnippet({
    return_1m: fund.return_1m ?? null,
    return_1y: fund.return_1y ?? null,
    flow_1m: fund.flow_1m ?? null,
    volatility_90: fund.volatility_90 ?? null,
    sharpe_90: fund.sharpe_90 ?? null,
    real_return_1y: fund.real_return_1y ?? null,
    max_drawdown_1y: fund.max_drawdown_1y ?? null,
  });
  const catInfo = decodeCategory(fund.category);
  const nameTags = decodeFundName(fund.name, fund.management_company);

  const portfolioSlices: PortfolioSlice[] = portfolio
    ? (['stock', 'government_bond', 'treasury_bill', 'corporate_bond', 'eurobond', 'gold', 'cash', 'other'] as const).map(
        (key) => ({ key, value: portfolio[key] ?? 0 }),
      )
    : [];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FinancialProduct',
    name: fund.name,
    identifier: [
      { '@type': 'PropertyValue', propertyID: 'TEFAS_CODE', value: fund.code },
      ...(fund.isin ? [{ '@type': 'PropertyValue', propertyID: 'ISIN', value: fund.isin }] : []),
    ],
    category: fund.category ?? undefined,
    provider: fund.management_company
      ? { '@type': 'Organization', name: fund.management_company }
      : undefined,
    url: `https://fonoloji.com/fon/${fund.code}`,
    description: `${fund.name} — ${fund.category ?? 'TEFAS yatırım fonu'}. Yatırım tavsiyesi değildir.`,
    ...(fund.current_price !== undefined && fund.current_price !== null
      ? { offers: { '@type': 'Offer', price: fund.current_price, priceCurrency: 'TRY' } }
      : {}),
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Ana sayfa', item: 'https://fonoloji.com' },
      { '@type': 'ListItem', position: 2, name: 'Fonlar', item: 'https://fonoloji.com/fonlar' },
      fund.category && {
        '@type': 'ListItem',
        position: 3,
        name: fund.category,
        item: `https://fonoloji.com/kategori/${encodeURIComponent(fund.category)}`,
      },
      {
        '@type': 'ListItem',
        position: fund.category ? 4 : 3,
        name: fund.code,
        item: `https://fonoloji.com/fon/${fund.code}`,
      },
    ].filter(Boolean),
  };

  return (
    <div className="container py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Link href="/fonlar" className="hover:text-foreground">Fonlar</Link>
          <span>/</span>
          <span>{fund.category ?? '—'}</span>
        </div>
        <div className="mt-3 grid grid-cols-[auto_1fr] gap-x-5 gap-y-6 md:grid-cols-[auto_1fr_auto] md:items-start">
          <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-verdigris-400 font-mono text-lg font-bold text-background">
            {fund.code}
          </div>
          <div className="min-w-0">
            <h1 className="display text-balance text-3xl leading-tight md:text-5xl">{fund.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {fund.type && <Badge variant="muted">{fundTypeLabel(fund.type)}</Badge>}
              {fund.category && <Badge variant="muted">{fund.category}</Badge>}
              {fund.management_company && (
                <span className="max-w-full truncate" title={fund.management_company}>
                  · {fund.management_company}
                </span>
              )}
            </div>
          </div>
          <div className="col-span-2 md:col-span-1 md:text-right">
            <div className="font-mono text-3xl tabular-nums md:text-4xl">{formatPrice(fund.current_price ?? 0, 6)}</div>
            <div className="mt-1 flex items-center gap-2 text-xs md:justify-end">
              <ChangePill value={fund.return_1d ?? null} />
              <span className="text-muted-foreground">· {formatDate(fund.current_date)}</span>
            </div>
            <div className="md:flex md:justify-end">
              <LiveEstimate code={fund.code} />
            </div>
          </div>
        </div>
      </div>

      {/* Name-decoded tags */}
      {nameTags.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-1.5">
          {nameTags.map((t) => (
            <span
              key={t.label}
              className={cn(
                'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px]',
                t.kind === 'company' && 'border-brand-500/40 bg-brand-500/10 text-brand-300',
                t.kind === 'asset' && 'border-verdigris-500/40 bg-verdigris-500/10 text-verdigris-300',
                t.kind === 'structure' && 'border-amber-500/40 bg-amber-500/10 text-amber-300',
                t.kind === 'currency' && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
                t.kind === 'access' && 'border-rose-500/40 bg-rose-500/10 text-rose-300',
              )}
            >
              {t.label}
            </span>
          ))}
        </div>
      )}

      {/* Editorial commentary + category explainer */}
      {(commentary.length > 0 || catInfo) && (
        <div className="panel mb-6 p-5">
          {commentary.length > 0 && (
            <>
              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Sparkles className="h-3 w-3 text-brand-400" /> Kısa yorum
              </div>
              <p className="text-sm leading-relaxed text-foreground/90">
                {commentary.map((line, i) => (
                  <span key={i}>
                    <MarkBold>{line}</MarkBold>
                    {i < commentary.length - 1 && ' '}
                  </span>
                ))}
              </p>
            </>
          )}
          {catInfo && (
            <div className={cn('mt-4 rounded-lg border border-border/40 bg-background/40 p-3 text-xs', commentary.length === 0 && 'mt-0')}>
              <div className="mb-1 flex items-center gap-2">
                <span className="font-semibold text-foreground">Bu kategori ne?</span>
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase',
                    catInfo.risk === 'low' && 'bg-emerald-500/20 text-emerald-300',
                    catInfo.risk === 'mid' && 'bg-amber-500/20 text-amber-300',
                    catInfo.risk === 'high' && 'bg-rose-500/20 text-rose-300',
                  )}
                >
                  {catInfo.risk === 'low' ? 'Düşük risk' : catInfo.risk === 'mid' ? 'Orta risk' : 'Yüksek risk'}
                </span>
              </div>
              <p className="text-muted-foreground">{catInfo.short}</p>
              <p className="mt-1 text-muted-foreground/80"><strong className="text-foreground/70">Uygun:</strong> {catInfo.who}</p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <MetricCell label="1G" value={fund.return_1d} />
        <MetricCell label="1H" value={fund.return_1w} />
        <MetricCell label="1A" value={fund.return_1m} />
        <MetricCell label="3A" value={fund.return_3m} />
        <MetricCell label="1Y" value={fund.return_1y} />
        <MetricCell label="YBI" value={fund.return_ytd} />
      </div>

      <div className="mt-8 panel p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Fiyat grafiği</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Bu dönem getirisi
              <span className={cn('ml-1 font-medium', periodReturn >= 0 ? 'text-gain' : 'text-loss')}>
                {formatPercent(periodReturn)}
              </span>
            </p>
          </div>
          <PeriodTabs />
        </div>
        <PriceChart data={points} positive={periodReturn >= 0} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="panel p-6 md:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Portföy dağılımı</h3>
            {portfolioSlices.length > 0 && (
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                son snapshot
              </span>
            )}
          </div>
          {portfolioSlices.length > 0 ? (
            <PortfolioDonut data={portfolioSlices} />
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">Portföy verisi henüz çekilmedi</div>
          )}
        </div>
        <div className="panel p-6">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Shield className="h-3.5 w-3.5" /> TEFAS Risk Skoru
          </h3>
          <RiskGauge value={fund.risk_score ?? null} />
          <div className="mt-6 space-y-3 border-t border-border/50 pt-4">
            <InfoRow
              icon={<Sparkles className="h-4 w-4 text-brand-400" />}
              labelNode={<Explainer term="sharpe_90">Sharpe (90g)</Explainer>}
              value={fund.sharpe_90?.toFixed(2) ?? '—'}
              sub="Risk düzeltilmiş getiri"
            />
            <InfoRow
              icon={<TrendingUp className="h-4 w-4 text-verdigris-400" />}
              labelNode={<Explainer term="volatility">Volatilite (90g)</Explainer>}
              value={fund.volatility_90 ? `${(fund.volatility_90 * 100).toFixed(1)}%` : '—'}
              sub="Yıllıklandırılmış stddev"
            />
            <InfoRow
              icon={<ArrowRight className="h-4 w-4 text-amber-400 rotate-[135deg]" />}
              labelNode={<Explainer term="drawdown">Max Drawdown (1Y)</Explainer>}
              value={fund.max_drawdown_1y ? formatPercent(fund.max_drawdown_1y) : '—'}
              sub="En dip"
            />
          </div>
        </div>

        {(fund.isin || fund.kap_url || fund.trading_status) && (
          <div className="panel p-6 md:col-span-3">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Künye
            </h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              {fund.isin && (
                <KunyeCell label="ISIN" value={fund.isin} mono />
              )}
              {fund.trading_status && (
                <KunyeCell label="Durum" value={fund.trading_status} />
              )}
              {fund.trading_start && fund.trading_end && (
                <KunyeCell label="İşlem saati" value={`${fund.trading_start} – ${fund.trading_end}`} mono />
              )}
              {fund.buy_valor !== undefined && (
                <KunyeCell label="Alış valörü" value={`T+${fund.buy_valor}`} mono />
              )}
              {fund.sell_valor !== undefined && (
                <KunyeCell label="Satış valörü" value={`T+${fund.sell_valor}`} mono />
              )}
              {fund.kap_url && (
                <a
                  href={fund.kap_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 self-end text-xs text-brand-400 hover:text-brand-300 md:col-span-1"
                >
                  KAP Bilgi <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        )}

        <div className="panel p-6 md:col-span-2">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Büyüklük & akış</h3>
          <div className="grid grid-cols-3 gap-4">
            <Stat
              icon={<Wallet className="h-4 w-4 text-brand-400" />}
              labelNode={<Explainer term="aum">Fon büyüklüğü</Explainer>}
              sublabel="Yönetilen Varlık Büyüklüğü"
              value={formatCompact(fund.aum)}
              change={fund.flow_1m}
            />
            <Stat
              icon={<Users className="h-4 w-4 text-verdigris-400" />}
              label="Yatırımcı"
              value={formatNumber(fund.investor_count)}
            />
            <Stat
              icon={<Calendar className="h-4 w-4 text-amber-400" />}
              label="Takipteyiz"
              sublabel={fund.first_seen ? `${formatDate(fund.first_seen)} tarihinden beri` : undefined}
              value={`${Math.max(1, Math.round(((new Date(fund.last_seen ?? Date.now()).getTime() - new Date(fund.first_seen ?? Date.now()).getTime()) / 86_400_000)))} gün`}
            />
          </div>
        </div>

        <div className="panel p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Hareketli ortalamalar</h3>
          <MaRow label="MA 30" value={fund.ma_30} current={fund.current_price} />
          <MaRow label="MA 90" value={fund.ma_90} current={fund.current_price} />
          <MaRow label="MA 200" value={fund.ma_200} current={fund.current_price} />
        </div>

        {/* Faz C: ileri risk metrikleri */}
        <div className="panel p-6 md:col-span-3">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Activity className="h-3.5 w-3.5" /> İleri Analitik
          </h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <AdvMetric
              labelNode={<Explainer term="sortino">Sortino (90g)</Explainer>}
              value={fund.sortino_90?.toFixed(2)}
              hint={
                fund.sortino_90 === undefined || fund.sortino_90 === null
                  ? '—'
                  : fund.sortino_90 > 1
                  ? 'İyi (>1)'
                  : fund.sortino_90 > 0
                  ? 'Pozitif'
                  : 'Negatif'
              }
            />
            <AdvMetric
              labelNode={<Explainer term="calmar">Calmar (1Y)</Explainer>}
              value={fund.calmar_1y?.toFixed(2)}
              hint={
                fund.calmar_1y === undefined || fund.calmar_1y === null
                  ? '—'
                  : fund.calmar_1y > 0.5
                  ? 'Sağlam'
                  : 'Düşük'
              }
            />
            <AdvMetric
              labelNode={<Explainer term="beta">Beta (1Y, BIST 30)</Explainer>}
              value={fund.beta_1y?.toFixed(2)}
              hint={
                fund.beta_1y === undefined || fund.beta_1y === null
                  ? '—'
                  : Math.abs(fund.beta_1y) > 1.1
                  ? 'Piyasaya hassas'
                  : Math.abs(fund.beta_1y) < 0.3
                  ? 'Bağımsız'
                  : 'Orta'
              }
            />
            <AdvMetric
              labelNode={<Explainer term="real_return">Reel getiri (1Y)</Explainer>}
              value={fund.real_return_1y !== undefined && fund.real_return_1y !== null ? formatPercent(fund.real_return_1y) : '—'}
              hint="TÜFE'den arındırılmış"
              positive={(fund.real_return_1y ?? 0) > 0}
              negative={(fund.real_return_1y ?? 0) < 0}
            />
          </div>
        </div>

        {monthly.months.length > 0 && (
          <div className="panel p-6 md:col-span-2">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" /> Aylık getiri (son 24 ay)
            </h3>
            <MonthlyHistogram data={monthly.months} />
          </div>
        )}

        {drawdown.points.length > 0 && (
          <div className="panel p-6">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <TrendingDown className="h-3.5 w-3.5 text-loss" />
              <Explainer term="drawdown">Drawdown (1 yıl)</Explainer>
            </h3>
            <DrawdownChart data={drawdown.points} />
          </div>
        )}

        {timeline.points.length > 1 && (
          <div className="panel p-6 md:col-span-3">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                <Activity className="h-3.5 w-3.5 text-brand-400" /> Portföy DNA'sı (son 180 gün)
              </h3>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                {timeline.points.length} snapshot · dağılımın zamanla değişimi
              </span>
            </div>
            <PortfolioTimeline data={timeline.points} />
          </div>
        )}
      </div>

      <KapDisclosuresCard
        code={fund.code}
        items={disclosures.items}
        backfillTriggered={Boolean(disclosures.backfillTriggered)}
      />

      {/* AI summary (if configured) */}
      {aiSummary.summary && (
        <div className="panel-highlight mt-8 p-6">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              AI özet
            </span>
          </div>
          <p className="text-[15px] leading-relaxed text-foreground/90">{aiSummary.summary}</p>
          <div className="mt-3 text-[10px] text-muted-foreground">
            Otomatik üretilmiştir · yatırım tavsiyesi değildir
          </div>
        </div>
      )}

      {/* Bench-alpha — percentile in category */}
      {(advanced.bench_alpha['1y'] || advanced.bench_alpha['3m']) && (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {(['3m', '1y'] as const).map((p) => {
            const a = advanced.bench_alpha[p];
            if (!a) return null;
            const over = a.alpha > 0;
            return (
              <div key={p} className="panel p-5">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Kategori içi sıralama ({p.toUpperCase()})
                  </div>
                  <div className={cn('font-mono text-lg font-semibold', over ? 'text-gain' : 'text-loss')}>
                    {over ? '+' : ''}
                    {formatPercent(a.alpha)}
                  </div>
                </div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-[10px] text-muted-foreground">Bu fon</div>
                    <div className="font-mono text-sm">{formatPercent(a.fundReturn)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-muted-foreground">Kategori medyan</div>
                    <div className="font-mono text-sm">{formatPercent(a.categoryMedian)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-muted-foreground">Yüzdelik</div>
                    <div className="font-mono text-sm">%{a.percentile}</div>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="relative h-1.5 rounded-full bg-secondary/40">
                    <div
                      className={cn('absolute inset-y-0 left-0 rounded-full', over ? 'bg-gain' : 'bg-loss')}
                      style={{ width: `${a.percentile}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {a.sampleSize} rakip fon içinden {a.percentile}%'lik dilime ait
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Category leakage warning */}
      {advanced.leakage && advanced.leakage.flagged && (
        <div className="mt-6 panel border-amber-500/40 bg-amber-500/5 p-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
              ⚠
            </div>
            <div>
              <div className="text-sm font-semibold">Kategori sapması</div>
              <p className="mt-1 text-xs text-muted-foreground">
                {advanced.leakage.reason}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Seasonality heatmap */}
      {advanced.seasonality.length > 12 && (
        <div className="mt-6 panel p-6">
          <div className="mb-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5 text-brand-400" />
              Ay-bazlı mevsimsellik
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Her ayın tarihsel getirisi. Yılları üst üste koyup Ocak'ın, Mart'ın genel davranışını gör.
            </p>
          </div>
          <SeasonalityHeatmap data={advanced.seasonality} />
        </div>
      )}

      {/* Stress test — worst drawdown periods */}
      {advanced.stress_periods.length > 0 && (
        <div className="mt-6 panel p-6">
          <div className="mb-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <TrendingDown className="h-3.5 w-3.5 text-loss" />
              Tarihsel stres dönemleri
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Fiyatın zirveden en sert düşüş periyotları — gerçek drawdown gözlemi
            </p>
          </div>
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border/50">
                <th className="py-2 text-left font-medium">Zirve</th>
                <th className="py-2 text-left font-medium">Dip</th>
                <th className="py-2 text-right font-medium">Süre</th>
                <th className="py-2 text-right font-medium">Düşüş</th>
              </tr>
            </thead>
            <tbody>
              {advanced.stress_periods.slice(0, 5).map((p, i) => (
                <tr key={i} className="border-b border-border/30 last:border-0">
                  <td className="py-2.5 text-xs text-muted-foreground">{formatDate(p.start)}</td>
                  <td className="py-2.5 text-xs text-muted-foreground">{formatDate(p.end)}</td>
                  <td className="py-2.5 text-right tabular-nums text-muted-foreground">{p.days} gün</td>
                  <td className="py-2.5 text-right font-mono text-loss">
                    {formatPercent(p.drawdown)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Compare + Story + Export CTA */}
      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-4">
        <Link
          href={`/hikaye/${fund.code}`}
          className="panel-highlight group relative flex flex-col justify-between overflow-hidden p-5 transition-all hover:-translate-y-0.5 md:col-span-2"
        >
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              yeni
            </div>
            <div className="mt-1 serif text-xl">
              {fund.code}'nın <span className="display-italic text-brand-400">hikayesi</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Scroll animated · 6 bölümde fonun yolculuğu.
            </div>
          </div>
          <div className="mt-4 text-xs text-brand-400 group-hover:text-brand-300">
            Hikaye modunda aç →
          </div>
        </Link>

        <Link
          href={`/karsilastir?kodlar=${fund.code}`}
          className="panel group flex items-center justify-between p-5 transition-all hover:-translate-y-0.5 hover:border-brand-500/50"
        >
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              karşılaştır
            </div>
            <div className="mt-1 serif text-lg">
              Başka fonla <span className="display-italic text-brand-400">karşılaştır</span>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-brand-400" />
        </Link>

        <ExportBox code={fund.code} fundName={fund.name} />
      </div>
    </div>
  );
}

function ExportBox({ code, fundName }: { code: string; fundName: string }) {
  const slug = code.toLowerCase();
  return (
    <div className="panel p-5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Veri çıktısı</div>
      <div className="mt-1 serif text-lg">Dışa aktar</div>
      <div className="mt-1 text-[11px] text-muted-foreground" title={fundName}>
        {fundName.slice(0, 40)}…
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={`/api/funds/${code}/history?period=all&format=csv`}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-card/40 px-3 py-1.5 text-xs transition-colors hover:border-brand-500 hover:text-foreground"
          download={`${slug}-fiyat.csv`}
        >
          CSV fiyat
        </a>
        <a
          href={`/api/funds/${code}`}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-card/40 px-3 py-1.5 text-xs transition-colors hover:border-brand-500 hover:text-foreground"
          download={`${slug}.json`}
        >
          JSON
        </a>
      </div>
    </div>
  );
}

function AdvMetric({
  label,
  labelNode,
  value,
  hint,
  positive,
  negative,
}: {
  label?: string;
  labelNode?: React.ReactNode;
  value?: string;
  hint?: string;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {labelNode ?? label}
      </div>
      <div
        className={cn(
          'mt-1 font-mono text-2xl tabular-nums',
          positive && 'text-gain',
          negative && 'text-loss',
        )}
      >
        {value ?? '—'}
      </div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value?: number | null }) {
  const positive = (value ?? 0) > 0;
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card/50 p-3 transition-colors',
        positive ? 'hover:border-gain/30' : 'hover:border-loss/30',
      )}
    >
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">
        <ChangePill value={value ?? null} />
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  labelNode,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label?: string;
  labelNode?: React.ReactNode;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <div>
          <div className="text-sm">{labelNode ?? label}</div>
          {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
        </div>
      </div>
      <div className="tabular-nums">{value}</div>
    </div>
  );
}

function Stat({
  icon,
  label,
  labelNode,
  sublabel,
  value,
  change,
}: {
  icon: React.ReactNode;
  label?: string;
  labelNode?: React.ReactNode;
  sublabel?: string;
  value: string;
  change?: number | null;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        {icon}
        {labelNode ?? label}
      </div>
      {sublabel && <div className="mt-0.5 text-[10px] text-muted-foreground/70">{sublabel}</div>}
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
      {change !== undefined && change !== null && (
        <div className="mt-1 text-xs">
          <ChangePill value={change} /> 1A
        </div>
      )}
    </div>
  );
}

function KunyeCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('mt-1 text-sm', mono && 'font-mono')}>{value}</div>
    </div>
  );
}

function MarkBold({ children }: { children: string }) {
  // Render **text** as bold spans inline
  const parts = children.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? (
          <strong key={i} className="font-semibold text-foreground">
            {p.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function MaRow({ label, value, current }: { label: string; value?: number | null; current?: number | null }) {
  const diff = value && current && value > 0 ? (current - value) / value : null;
  return (
    <div className="flex items-center justify-between border-b border-border/40 py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3 text-sm tabular-nums">
        <span>{value ? formatPrice(value, 4) : '—'}</span>
        <ChangePill value={diff} className="min-w-[60px] justify-end text-xs" />
      </div>
    </div>
  );
}
