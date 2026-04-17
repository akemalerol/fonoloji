import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChangePill } from '@/components/fx/change-pill';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
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

  return (
    <div className="container py-10">
      <div className="mb-6">
        <Link href="/fonlar" className="text-xs text-muted-foreground hover:text-foreground">
          ← Fonlar
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <Badge variant="muted">{data.funds.length} fon</Badge>
          <span>Toplam: {formatCompact(totalAum)}</span>
          <span>{formatNumber(totalInvestors)} yatırımcı</span>
        </div>
      </div>

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
