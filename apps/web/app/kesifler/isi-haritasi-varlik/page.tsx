import { Grid3X3 } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatCompact } from '@/lib/utils';

export const metadata = {
  title: 'Varlık ısı haritası — kategori × varlık tipi',
  description:
    'Hangi TEFAS fon kategorisi ne kadar hisse, tahvil, nakit, altın ve eurobond tutuyor? Ortalama dağılımın kategori bazlı ısı haritası.',
};
export const revalidate = 900;

interface Row {
  category: string;
  fund_count: number;
  stock: number;
  govbond: number;
  corpbond: number;
  eurobond: number;
  cash: number;
  gold: number;
  other: number;
  total_aum: number | null;
}

const COLS: Array<{ key: keyof Row; label: string; color: string }> = [
  { key: 'stock', label: 'Hisse', color: 'emerald' },
  { key: 'govbond', label: 'Dev.Tahv.', color: 'sky' },
  { key: 'corpbond', label: 'Özel Tahv.', color: 'blue' },
  { key: 'eurobond', label: 'Eurobond', color: 'violet' },
  { key: 'cash', label: 'Nakit/Repo', color: 'amber' },
  { key: 'gold', label: 'Altın', color: 'yellow' },
  { key: 'other', label: 'Diğer', color: 'gray' },
];

function bucket(value: number): number {
  if (value >= 70) return 5;
  if (value >= 40) return 4;
  if (value >= 20) return 3;
  if (value >= 5) return 2;
  if (value > 0) return 1;
  return 0;
}

// tailwind safelist-friendly class map
const CELL_CLASSES: Record<string, string[]> = {
  emerald: ['bg-emerald-500/5', 'bg-emerald-500/15', 'bg-emerald-500/30', 'bg-emerald-500/45', 'bg-emerald-500/60', 'bg-emerald-500/80'],
  sky: ['bg-sky-500/5', 'bg-sky-500/15', 'bg-sky-500/30', 'bg-sky-500/45', 'bg-sky-500/60', 'bg-sky-500/80'],
  blue: ['bg-blue-500/5', 'bg-blue-500/15', 'bg-blue-500/30', 'bg-blue-500/45', 'bg-blue-500/60', 'bg-blue-500/80'],
  violet: ['bg-violet-500/5', 'bg-violet-500/15', 'bg-violet-500/30', 'bg-violet-500/45', 'bg-violet-500/60', 'bg-violet-500/80'],
  amber: ['bg-amber-500/5', 'bg-amber-500/15', 'bg-amber-500/30', 'bg-amber-500/45', 'bg-amber-500/60', 'bg-amber-500/80'],
  yellow: ['bg-yellow-500/5', 'bg-yellow-500/15', 'bg-yellow-500/30', 'bg-yellow-500/45', 'bg-yellow-500/60', 'bg-yellow-500/80'],
  gray: ['bg-gray-500/5', 'bg-gray-500/15', 'bg-gray-500/30', 'bg-gray-500/45', 'bg-gray-500/60', 'bg-gray-500/80'],
};

export default async function IsiHaritasiVarlikPage() {
  const { items } = await api.exposureHeatmap().catch(() => ({ items: [] as Row[] }));

  return (
    <div className="container py-10 md:py-14">
      <div className="mb-10 border-b border-border/50 pb-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <Grid3X3 className="h-3 w-3 text-verdigris-400" /> Keşifler
        </div>
        <h1 className="display mt-2 text-5xl leading-none md:text-6xl">
          Varlık <span className="display-italic gradient-text">ısı haritası</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Her TEFAS fon kategorisinin ortalama varlık dağılımı. Yoğun renk = yüksek ağırlık.
          "Tahvil fonu ne kadar hisse tutuyor?", "Değişken fonda altın var mı?" gibi gizli
          maruziyetleri açığa çıkarır.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="panel p-10 text-center">
          <p className="text-sm text-muted-foreground">Veri hazırlanıyor…</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="sticky left-0 bg-background pb-3 pr-4 text-left">Kategori</th>
                <th className="pb-3 pr-3 text-right">Fon</th>
                <th className="pb-3 pr-3 text-right">AUM</th>
                {COLS.map((c) => (
                  <th key={c.key} className="pb-3 text-center">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.category} className="border-t border-border/30">
                  <td className="sticky left-0 bg-background py-2 pr-4">
                    <Link href={`/kategori/${encodeURIComponent(r.category)}`} className="text-sm hover:text-brand-300">
                      {r.category}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {r.fund_count}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {r.total_aum ? formatCompact(r.total_aum) : '—'}
                  </td>
                  {COLS.map((c) => {
                    const v = Number(r[c.key]) || 0;
                    const b = bucket(v);
                    const bg = CELL_CLASSES[c.color]?.[b] ?? 'bg-transparent';
                    return (
                      <td key={c.key} className="px-1 py-1">
                        <div className={`flex h-9 items-center justify-center rounded font-mono text-[11px] tabular-nums ${bg} ${b >= 3 ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {v >= 1 ? `%${v.toFixed(0)}` : v > 0 ? `%${v.toFixed(1)}` : '—'}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span>Renk yoğunluğu:</span>
        {[0, 1, 2, 3, 4, 5].map((b) => (
          <div key={b} className="flex items-center gap-1">
            <span className={`h-4 w-6 rounded ${CELL_CLASSES.emerald[b]}`} />
            <span className="font-mono text-[10px]">
              {b === 0 ? '0%' : b === 1 ? '<5%' : b === 2 ? '5-20%' : b === 3 ? '20-40%' : b === 4 ? '40-70%' : '>70%'}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-12 text-center text-xs text-muted-foreground">
        Kaynak: TEFAS portföy snapshot'ları · Kategori ortalaması
      </p>
    </div>
  );
}
