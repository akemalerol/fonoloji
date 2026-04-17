import { Info } from 'lucide-react';
import Link from 'next/link';
import { ChangePill } from '@/components/fx/change-pill';
import { api } from '@/lib/api';
import { formatCompact, formatPercent } from '@/lib/utils';

export const revalidate = 60;
export const metadata = { title: 'Reel Getiri' };

// Assumed Turkey CPI YoY (stub — replaced by TCMB EVDS feed on server).
const CPI_YOY = 0.42;

export default async function RealReturnPage() {
  const { items } = await api.listFunds({ sort: 'return_1y', limit: 60 });
  const withReal = items
    .filter((f) => f.return_1y !== null && f.return_1y !== undefined)
    .map((f) => {
      const nominal = f.return_1y!;
      const real = (1 + nominal) / (1 + CPI_YOY) - 1;
      return { ...f, real };
    })
    .sort((a, b) => b.real - a.real);

  return (
    <div className="container py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Reel Getiri</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Nominal getiri aldatır. Aynı veri, enflasyondan arındırılmış hâli gerçek kazancı gösterir.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-3 py-1 text-xs text-muted-foreground">
          <Info className="h-3 w-3" />
          Kullanılan TÜFE YoY: <span className="font-semibold text-foreground">{formatPercent(CPI_YOY)}</span>
          <span className="text-[10px]">(TCMB EVDS canlı feed deploy'dan sonra bağlanır)</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card/40">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-secondary/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="py-3 pl-4 text-left font-medium">Kod</th>
              <th className="py-3 text-left font-medium">Fon</th>
              <th className="py-3 text-right font-medium">Nominal 1Y</th>
              <th className="py-3 text-right font-medium">TÜFE</th>
              <th className="py-3 text-right font-medium">Reel</th>
              <th className="py-3 pr-4 text-right font-medium">Fon büyüklüğü</th>
            </tr>
          </thead>
          <tbody>
            {withReal.slice(0, 40).map((f) => (
              <tr key={f.code} className="border-b border-border/60 last:border-0">
                <td className="py-3 pl-4">
                  <Link href={`/fon/${f.code}`} className="inline-flex items-center rounded bg-secondary/70 px-2 py-0.5 font-mono text-xs font-bold">
                    {f.code}
                  </Link>
                </td>
                <td className="max-w-[320px] py-3">
                  <Link href={`/fon/${f.code}`} className="truncate hover:text-brand-400">
                    {f.name}
                  </Link>
                </td>
                <td className="py-3 text-right">
                  <ChangePill value={f.return_1y ?? null} className="justify-end" />
                </td>
                <td className="py-3 text-right tabular-nums text-muted-foreground">{formatPercent(CPI_YOY)}</td>
                <td className="py-3 text-right">
                  <ChangePill value={f.real} className="justify-end font-semibold" />
                </td>
                <td className="py-3 pr-4 text-right tabular-nums">{formatCompact(f.aum)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
