import { ArrowRight, Building2, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChangePill } from '@/components/fx/change-pill';
import { Badge } from '@/components/ui/badge';
import { formatCompact, formatNumber, formatPercent } from '@/lib/utils';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

const API_BASE = process.env.FONOLOJI_API_URL ?? 'http://localhost:4000';

interface CompanyDetail {
  name: string;
  stats: {
    fund_count: number;
    total_aum: number | null;
    total_investors: number | null;
    avg_return_1y: number | null;
    avg_return_1m: number | null;
    avg_return_3m: number | null;
    avg_sharpe: number | null;
    avg_volatility: number | null;
  };
  funds: Array<{
    code: string;
    name: string;
    category: string | null;
    risk_score: number | null;
    current_price: number | null;
    return_1m: number | null;
    return_1y: number | null;
    aum: number | null;
    investor_count: number | null;
    sharpe_90: number | null;
  }>;
  categoryBreakdown: Array<{ category: string; count: number; aum: number | null }>;
}

export async function generateMetadata({ params }: { params: { ad: string } }) {
  return { title: decodeURIComponent(params.ad) };
}

export default async function CompanyPage({ params }: { params: { ad: string } }) {
  const decoded = decodeURIComponent(params.ad);
  const [res, scoreRes] = await Promise.all([
    fetch(`${API_BASE}/api/management-companies/${encodeURIComponent(decoded)}`, { cache: 'no-store' }),
    fetch(`${API_BASE}/api/management-companies/${encodeURIComponent(decoded)}/score`, {
      cache: 'no-store',
    }).catch(() => null),
  ]);
  if (!res.ok) notFound();
  const data = (await res.json()) as CompanyDetail;
  const score = scoreRes && scoreRes.ok
    ? ((await scoreRes.json()) as {
        score: number | null;
        strengths?: string[];
        weaknesses?: string[];
        sampleSize?: number;
      })
    : null;

  return (
    <div className="container py-10">
      <div className="mb-8 border-b border-border/50 pb-6">
        <Link href="/yonetici" className="text-xs text-muted-foreground hover:text-foreground">
          ← Yönetim Şirketleri
        </Link>
        <div className="mt-2 flex flex-wrap items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-verdigris-400 text-background">
            <Building2 className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h1 className="display text-balance text-3xl leading-tight md:text-5xl">{data.name}</h1>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge variant="muted">{data.stats.fund_count} fon</Badge>
              <Badge variant="muted">{formatCompact(data.stats.total_aum)}  Fon büyüklüğü</Badge>
              <Badge variant="muted">{formatNumber(data.stats.total_investors)} yatırımcı</Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Manager behavior score */}
      {score && score.score !== null && (
        <div className="mb-6 panel p-6">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-baseline gap-2">
              <span className="display text-6xl tabular-nums gradient-text">{score.score}</span>
              <span className="text-muted-foreground">/100</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Yönetici davranış skoru
              </div>
              <div className="mt-1 text-sm">
                {score.score >= 75
                  ? 'Güçlü performans · disiplinli yönetim'
                  : score.score >= 55
                  ? 'Makul performans · sektör ortalamasında'
                  : score.score >= 35
                  ? 'Ortalamanın altında'
                  : 'Zayıf — rakiplerine göre geride'}
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                {score.sampleSize} fon üzerinden Sharpe medyan, 1Y getiri, volatilite ve fon büyüklüğü değerlendirmesi
              </div>
            </div>
            <div className="relative h-2 w-32 overflow-hidden rounded-full bg-secondary/40 shrink-0 self-center">
              <div
                className="h-full rounded-full bg-gradient-to-r from-loss via-amber-500 to-gain transition-all"
                style={{ width: `${score.score}%` }}
              />
            </div>
          </div>
          {(score.strengths?.length || score.weaknesses?.length) && (
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {score.strengths && score.strengths.length > 0 && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                    Güçlü yönler
                  </div>
                  <ul className="space-y-0.5 text-xs text-muted-foreground">
                    {score.strengths.map((s) => (
                      <li key={s}>• {s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {score.weaknesses && score.weaknesses.length > 0 && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                    Zayıflıklar
                  </div>
                  <ul className="space-y-0.5 text-xs text-muted-foreground">
                    {score.weaknesses.map((s) => (
                      <li key={s}>• {s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card label="Ort. 1A" value={data.stats.avg_return_1m !== null ? formatPercent(data.stats.avg_return_1m) : '—'} positive={(data.stats.avg_return_1m ?? 0) > 0} negative={(data.stats.avg_return_1m ?? 0) < 0} />
        <Card label="Ort. 3A" value={data.stats.avg_return_3m !== null ? formatPercent(data.stats.avg_return_3m) : '—'} positive={(data.stats.avg_return_3m ?? 0) > 0} negative={(data.stats.avg_return_3m ?? 0) < 0} />
        <Card label="Ort. 1Y" value={data.stats.avg_return_1y !== null ? formatPercent(data.stats.avg_return_1y) : '—'} positive={(data.stats.avg_return_1y ?? 0) > 0} negative={(data.stats.avg_return_1y ?? 0) < 0} />
        <Card label="Ort. Sharpe" value={data.stats.avg_sharpe?.toFixed(2) ?? '—'} highlight />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="panel p-6 lg:col-span-1">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Kategori dağılımı
          </h2>
          <ul className="space-y-2 text-sm">
            {data.categoryBreakdown.slice(0, 12).map((c) => (
              <li key={c.category} className="flex items-center justify-between">
                <span className="truncate text-muted-foreground">{c.category}</span>
                <span className="ml-2 font-mono tabular-nums">{c.count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel p-6 lg:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" /> Tüm fonları (fon büyüklüğüne göre sıralı)
          </h2>
          <div className="overflow-hidden rounded-lg border border-border/50">
            <table className="w-full text-xs">
              <thead className="border-b border-border bg-secondary/30 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 pl-3 text-left font-medium">Kod</th>
                  <th className="py-2 text-left font-medium">Fon</th>
                  <th className="py-2 text-right font-medium">Risk</th>
                  <th className="py-2 text-right font-medium">1Y</th>
                  <th className="py-2 pr-3 text-right font-medium">Fon büyüklüğü</th>
                </tr>
              </thead>
              <tbody>
                {data.funds.slice(0, 30).map((f) => (
                  <tr key={f.code} className="border-b border-border/40 last:border-0">
                    <td className="py-2 pl-3">
                      <Link href={`/fon/${f.code}`} className="font-mono text-xs font-bold hover:text-brand-400">
                        {f.code}
                      </Link>
                    </td>
                    <td className="py-2 max-w-[280px] truncate">{f.name}</td>
                    <td className="py-2 text-right">
                      {f.risk_score ? <span className="font-mono">R{f.risk_score}</span> : '—'}
                    </td>
                    <td className="py-2 text-right">
                      <ChangePill value={f.return_1y} className="justify-end" />
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatCompact(f.aum)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.funds.length > 30 && (
            <div className="mt-3 text-xs text-muted-foreground">
              İlk 30 fon gösteriliyor (toplam {data.funds.length}).
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({
  label,
  value,
  positive,
  negative,
  highlight,
}: {
  label: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="panel p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={`mt-1 font-mono text-2xl tabular-nums ${
          positive ? 'text-gain' : negative ? 'text-loss' : highlight ? 'text-brand-400' : ''
        }`}
      >
        {value}
      </div>
    </div>
  );
}
