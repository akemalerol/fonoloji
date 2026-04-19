import { Building2, Crown } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { formatCompact, formatPercent } from '@/lib/utils';
import { cn } from '@/lib/utils';

export const revalidate = 300;
export const metadata = {
  title: 'Yönetim şirketi karşılaştır — İş Portföy, Ak Portföy, Garanti BBVA Portföy',
  description:
    'Türkiye\'nin en büyük portföy yönetim şirketlerini yan yana koy — fon sayısı, AUM, ortalama Sharpe, 1Y getiri. İş Portföy, Ak Portföy, Garanti BBVA Portföy ve daha fazlası.',
};

export default async function YoneticiKarsilastirPage({
  searchParams,
}: {
  searchParams: { adlar?: string };
}) {
  const all = await api.managementCompanies().catch(() => ({ items: [] }));
  const list = all.items as Array<{
    name: string;
    fund_count: number;
    total_aum: number;
    total_investors: number;
    avg_return_1y: number;
    avg_sharpe: number | null;
  }>;

  // Default — top 6 by AUM
  const defaults = list.slice(0, 6).map((c) => c.name);
  const selected = searchParams.adlar
    ? searchParams.adlar.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 10)
    : defaults;

  const rows = selected
    .map((name) => list.find((c) => c.name === name))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  if (rows.length === 0) notFound();

  // Best in each category
  const bestAum = Math.max(...rows.map((r) => r.total_aum ?? 0));
  const bestSharpe = Math.max(...rows.map((r) => r.avg_sharpe ?? -Infinity));
  const bestReturn = Math.max(...rows.map((r) => r.avg_return_1y ?? -Infinity));
  const bestCount = Math.max(...rows.map((r) => r.fund_count ?? 0));

  return (
    <div className="container py-10 md:py-14">
      <div className="mb-10 border-b border-border/50 pb-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <Building2 className="h-3 w-3 text-brand-400" /> Karşılaştırma
        </div>
        <h1 className="display mt-2 text-5xl leading-none md:text-6xl">
          Yönetim <span className="display-italic gradient-text">şirketleri</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Türkiye'nin en büyük portföy yönetim şirketlerinin karnesi:
          fon sayısı, toplam AUM, yatırımcı, ortalama 1Y getiri ve Sharpe.
          {searchParams.adlar
            ? ' Seçtiğin şirketler karşılaştırılıyor.'
            : ' Varsayılan olarak en büyük 6 şirket gösteriliyor.'}
        </p>
      </div>

      <div className="panel overflow-x-auto p-0">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="sticky left-0 bg-card px-4 py-3 text-left">Şirket</th>
              <th className="px-3 py-3 text-right">Fon</th>
              <th className="px-3 py-3 text-right">AUM</th>
              <th className="px-3 py-3 text-right">Yatırımcı</th>
              <th className="px-3 py-3 text-right">1Y ort.</th>
              <th className="px-3 py-3 text-right">Sharpe ort.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-t border-border/30">
                <td className="sticky left-0 bg-card px-4 py-3">
                  <Link
                    href={`/yonetici/${encodeURIComponent(r.name)}`}
                    className="font-medium hover:text-brand-300"
                  >
                    {r.name}
                  </Link>
                </td>
                <Cell value={r.fund_count} best={r.fund_count === bestCount} fmt={(v) => String(v)} />
                <Cell value={r.total_aum} best={r.total_aum === bestAum} fmt={formatCompact} />
                <Cell value={r.total_investors} best={false} fmt={formatCompact} />
                <Cell
                  value={r.avg_return_1y}
                  best={r.avg_return_1y === bestReturn}
                  fmt={(v) => formatPercent(v as number, 1)}
                  colorByValue
                />
                <Cell
                  value={r.avg_sharpe}
                  best={r.avg_sharpe === bestSharpe}
                  fmt={(v) => (v as number | null) !== null ? (v as number).toFixed(2) : '—'}
                />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 rounded-lg border border-border/40 bg-background/30 p-4 text-xs text-muted-foreground">
        <strong className="text-foreground">Kendin seç:</strong>{' '}
        URL'ye <span className="font-mono">?adlar=İŞ PORTFÖY,AK PORTFÖY,GARANTİ BBVA PORTFÖY</span>{' '}
        şeklinde ekleyerek istediğin şirketleri karşılaştırabilirsin.
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Tüm şirketler
        </h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {list.slice(0, 24).map((c) => (
            <Link
              key={c.name}
              href={`/yonetici/${encodeURIComponent(c.name)}`}
              className="rounded-md border border-border/40 bg-background/40 px-3 py-2 text-xs hover:border-brand-500/30 hover:text-foreground"
            >
              <div className="truncate font-medium">{c.name}</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                {c.fund_count} fon · {formatCompact(c.total_aum)}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Cell({
  value,
  best,
  fmt,
  colorByValue,
}: {
  value: number | null;
  best: boolean;
  fmt: (v: number | null) => string;
  colorByValue?: boolean;
}) {
  let colorCls = '';
  if (colorByValue && value !== null) colorCls = value >= 0 ? 'text-gain' : 'text-loss';
  return (
    <td className={cn('px-3 py-3 text-right font-mono tabular-nums', colorCls, best && 'font-semibold')}>
      <span className="inline-flex items-center gap-1.5">
        {best && value !== null && <Crown className="h-3 w-3 text-amber-400" />}
        {fmt(value)}
      </span>
    </td>
  );
}
