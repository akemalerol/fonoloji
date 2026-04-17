import { TrendingDown, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { ChangePill } from '@/components/fx/change-pill';
import { api } from '@/lib/api';

export const revalidate = 60;
export const metadata = { title: 'Trend Sinyalleri' };

export default async function TrendPage() {
  const trend = await api.trend();

  return (
    <div className="container py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Trend Sinyalleri</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          MA 30/200 kesişim kuralı: Fiyat &gt; MA30 &gt; MA200 → yükseliş trendi. Tersi ise düşüş.
          Basit, şeffaf, üç aylık kullanım için uygun.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Column title="Yükseliş trendi" icon={<TrendingUp className="h-4 w-4 text-gain" />} items={trend.rising} />
        <Column title="Düşüş trendi" icon={<TrendingDown className="h-4 w-4 text-loss" />} items={trend.falling} />
      </div>
    </div>
  );
}

function Column({ title, icon, items }: { title: string; icon: React.ReactNode; items: Array<{ code: string; name: string; category: string; return_1m: number | null }> }) {
  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center gap-2 px-2">
        {icon}
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <ul className="divide-y divide-border/40">
        {items.length === 0 && <li className="py-4 text-sm text-muted-foreground">Sinyal yok.</li>}
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
              <div className="truncate text-[11px] text-muted-foreground">{f.category}</div>
            </div>
            <ChangePill value={f.return_1m ?? null} className="text-sm" />
          </li>
        ))}
      </ul>
    </div>
  );
}
