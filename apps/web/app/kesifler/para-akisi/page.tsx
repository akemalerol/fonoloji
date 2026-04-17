import Link from 'next/link';
import { ChangePill } from '@/components/fx/change-pill';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatCompact, formatNumber } from '@/lib/utils';

export const revalidate = 60;
export const metadata = { title: 'Para Akışı' };

const PERIODS = [
  { value: '1w', label: 'Son 1 Hafta' },
  { value: '1m', label: 'Son 1 Ay' },
  { value: '3m', label: 'Son 3 Ay' },
];

export default async function FlowPage({ searchParams }: { searchParams: { period?: string } }) {
  const period = searchParams.period ?? '1m';
  const data = await api.flow(period, 25);

  return (
    <div className="container py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Para Akışı</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Toplam fon büyüklüğü değişimine göre giriş ve çıkış lideri fonlar.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-secondary/30 p-1">
          {PERIODS.map((p) => (
            <Link
              key={p.value}
              href={`?period=${p.value}`}
              className={`rounded-md px-3 py-1 text-xs ${
                period === p.value
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Column title="Girişler" badge="inflow" items={data.inflow} />
        <Column title="Çıkışlar" badge="outflow" items={data.outflow} />
      </div>
    </div>
  );
}

function Column({ title, badge, items }: { title: string; badge: 'inflow' | 'outflow'; items: Array<{ code: string; name: string; category?: string; flow: number; aum: number; investor_count: number }> }) {
  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center gap-2 px-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Badge variant={badge === 'inflow' ? 'gain' : 'loss'}>{badge}</Badge>
      </div>
      <ul className="divide-y divide-border/40">
        {items.map((f) => (
          <li key={f.code} className="flex items-center gap-3 py-3">
            <Link
              href={`/fon/${f.code}`}
              className="inline-flex h-8 w-14 items-center justify-center rounded bg-secondary/70 font-mono text-xs font-bold"
            >
              {f.code}
            </Link>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{f.name}</div>
              <div className="truncate text-[11px] text-muted-foreground">
                {f.category ?? '—'} · {formatNumber(f.investor_count)} yatırımcı · fon büyüklüğü {formatCompact(f.aum)}
              </div>
            </div>
            <ChangePill value={f.flow} className="text-sm" />
          </li>
        ))}
      </ul>
    </div>
  );
}
