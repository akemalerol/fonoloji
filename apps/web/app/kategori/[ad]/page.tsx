import { Info } from 'lucide-react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChangePill } from '@/components/fx/change-pill';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { decodeCategory } from '@/lib/decoders';
import { formatCompact, formatNumber, formatPercent } from '@/lib/utils';

export const revalidate = 60;

export async function generateMetadata({ params }: { params: { ad: string } }) {
  return { title: decodeURIComponent(params.ad) };
}

export default async function CategoryPage({ params }: { params: { ad: string } }) {
  const name = decodeURIComponent(params.ad);
  let data;
  try {
    data = await api.category(name);
  } catch {
    notFound();
  }
  if (!data || data.funds.length === 0) notFound();

  const periods: Array<{ key: string; label: string }> = [
    { key: '1m', label: '1 Aylık' },
    { key: '3m', label: '3 Aylık' },
    { key: '1y', label: '1 Yıllık' },
    { key: 'ytd', label: 'YBI' },
  ];

  const totalAum = data.funds.reduce((s, f) => s + (f.aum ?? 0), 0);
  const totalInvestors = data.funds.reduce((s, f) => s + (f.investor_count ?? 0), 0);
  const catInfo = decodeCategory(name);

  return (
    <div className="container py-10">
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <Link href="/kategoriler" className="hover:text-foreground">Kategoriler</Link>
          <span>/</span>
          <Link href="/fonlar" className="hover:text-foreground">Fonlar</Link>
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <Badge variant="muted">{data.funds.length} fon</Badge>
          <span>Toplam: {formatCompact(totalAum)}</span>
          <span>{formatNumber(totalInvestors)} yatırımcı</span>
        </div>
      </div>

      {catInfo && (
        <div className="panel mb-8 p-5">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-foreground">Bu kategori nedir?</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{catInfo.short}</p>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                    Kim için uygun
                  </div>
                  <div className="mt-1 text-xs text-foreground/80">{catInfo.who}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                    Risk seviyesi
                  </div>
                  <div className={`mt-1 text-xs font-semibold ${
                    catInfo.risk === 'low' ? 'text-emerald-300' :
                    catInfo.risk === 'mid' ? 'text-amber-300' :
                    catInfo.risk === 'high' ? 'text-loss' :
                    'text-muted-foreground'
                  }`}>
                    {catInfo.risk === 'low' ? 'Düşük' : catInfo.risk === 'mid' ? 'Orta' : catInfo.risk === 'high' ? 'Yüksek' : 'Değişken'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {periods.map((p) => {
          const stat = data.stats.find((s) => s.period === p.key);
          return (
            <div key={p.key} className="panel p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{p.label}</div>
              <div className="mt-1 text-lg font-semibold">
                Ortalama:{' '}
                <span className={(stat?.avg_return ?? 0) >= 0 ? 'text-gain' : 'text-loss'}>
                  {stat ? formatPercent(stat.avg_return) : '—'}
                </span>
              </div>
              {stat && (
                <div className="mt-1 text-xs text-muted-foreground">
                  En iyi: <Link href={`/fon/${stat.top_fund_code}`} className="font-mono font-semibold text-foreground">{stat.top_fund_code}</Link>{' '}
                  <span className="text-gain">{formatPercent(stat.top_fund_return)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card/40">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-secondary/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="py-3 pl-4 text-left font-medium">Kod</th>
              <th className="py-3 text-left font-medium">Fon</th>
              <th className="py-3 text-right font-medium">1A</th>
              <th className="py-3 text-right font-medium">1Y</th>
              <th className="py-3 text-right font-medium">Sharpe</th>
              <th className="py-3 pr-4 text-right font-medium">Fon büyüklüğü</th>
            </tr>
          </thead>
          <tbody>
            {data.funds.map((f) => (
              <tr key={f.code} className="border-b border-border/60 last:border-0">
                <td className="py-3 pl-4">
                  <Link href={`/fon/${f.code}`} className="inline-flex rounded bg-secondary/70 px-2 py-0.5 font-mono text-xs font-bold">
                    {f.code}
                  </Link>
                </td>
                <td className="max-w-[260px] py-3">
                  <Link href={`/fon/${f.code}`} className="truncate hover:text-brand-400">
                    {f.name}
                  </Link>
                  {f.management_company && <div className="text-[11px] text-muted-foreground">{f.management_company}</div>}
                </td>
                <td className="py-3 text-right">
                  <ChangePill value={f.return_1m ?? null} className="justify-end" />
                </td>
                <td className="py-3 text-right">
                  <ChangePill value={f.return_1y ?? null} className="justify-end" />
                </td>
                <td className="py-3 text-right tabular-nums text-muted-foreground">{f.sharpe_90?.toFixed(2) ?? '—'}</td>
                <td className="py-3 pr-4 text-right tabular-nums">{formatCompact(f.aum)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
