import { Building2 } from 'lucide-react';
import Link from 'next/link';
import { ChangePill } from '@/components/fx/change-pill';
import { formatCompact, formatNumber } from '@/lib/utils';

export const metadata = { title: 'Yönetim Şirketleri' };
export const revalidate = 60;

const API_BASE = process.env.FONOLOJI_API_URL ?? 'http://localhost:4000';

interface CompanyRow {
  name: string;
  fund_count: number;
  total_aum: number | null;
  total_investors: number | null;
  avg_return_1y: number | null;
  avg_sharpe: number | null;
}

async function loadCompanies(): Promise<CompanyRow[]> {
  const res = await fetch(`${API_BASE}/api/management-companies`, { next: { revalidate: 60 } });
  if (!res.ok) return [];
  const data = (await res.json()) as { items: CompanyRow[] };
  return data.items;
}

export default async function ManagementCompaniesPage() {
  const items = await loadCompanies();

  return (
    <div className="container py-10">
      <div className="mb-8 border-b border-border/50 pb-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <Building2 className="h-3 w-3 text-brand-400" />
          dizin
        </div>
        <h1 className="display mt-2 text-5xl leading-none md:text-6xl">
          Yönetim <span className="display-italic text-brand-400">şirketleri</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          {items.length} portföy yönetim şirketi · fon büyüklüğüne göre sıralı · ortalama 1 yıllık getiri ve
          Sharpe oranıyla
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card/40">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="border-b border-border bg-secondary/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="py-3 pl-4 text-left font-medium">Şirket</th>
              <th className="py-3 text-right font-medium">Fon sayısı</th>
              <th className="py-3 text-right font-medium">Toplam fon büyüklüğü</th>
              <th className="py-3 text-right font-medium">Yatırımcı</th>
              <th className="py-3 text-right font-medium">Ort. 1Y getiri</th>
              <th className="py-3 pr-4 text-right font-medium">Ort. Sharpe</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.name} className="border-b border-border/50 last:border-0">
                <td className="py-3 pl-4">
                  <Link
                    href={`/yonetici/${encodeURIComponent(c.name)}`}
                    className="text-sm hover:text-brand-400"
                  >
                    {c.name}
                  </Link>
                </td>
                <td className="py-3 text-right tabular-nums">{c.fund_count}</td>
                <td className="py-3 text-right tabular-nums">{formatCompact(c.total_aum)}</td>
                <td className="py-3 text-right tabular-nums text-muted-foreground">
                  {formatNumber(c.total_investors)}
                </td>
                <td className="py-3 text-right">
                  <ChangePill value={c.avg_return_1y} className="justify-end" />
                </td>
                <td className="py-3 pr-4 text-right tabular-nums">
                  {c.avg_sharpe?.toFixed(2) ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
