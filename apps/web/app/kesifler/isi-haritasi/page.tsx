import Link from 'next/link';
import { CalendarHeatmap } from '@/components/fx/calendar-heatmap';
import { api } from '@/lib/api';
import { formatPercent } from '@/lib/utils';

export const revalidate = 60;
export const metadata = { title: 'Volatilite Isı Haritası' };

export default async function HeatmapPage({ searchParams }: { searchParams: { kod?: string } }) {
  const { items } = await api.listFunds({ sort: 'aum', limit: 12 });
  const selected = (searchParams.kod ?? items[0]?.code ?? 'TTE').toUpperCase();
  const heatmap = await api.heatmap(selected);
  const cells = heatmap.cells.slice(-365);

  const positive = cells.filter((c) => c.return > 0).length;
  const negative = cells.filter((c) => c.return < 0).length;
  const maxGain = cells.reduce((m, c) => (c.return > m.return ? c : m), cells[0] ?? { date: '', return: 0 });
  const maxLoss = cells.reduce((m, c) => (c.return < m.return ? c : m), cells[0] ?? { date: '', return: 0 });

  return (
    <div className="container py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Volatilite Isı Haritası</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Her kare bir gün. Yeşil: pozitif getiri, kırmızı: negatif. Koyuluk = büyüklük.
          Fonun "ritmini" tek bakışta görürsün.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {items.map((f) => (
          <Link
            key={f.code}
            href={`?kod=${f.code}`}
            className={`rounded-md border px-2.5 py-1 font-mono text-xs ${
              f.code === selected
                ? 'border-brand-500 bg-brand-500/20 text-brand-400'
                : 'border-border bg-secondary/40 text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.code}
          </Link>
        ))}
      </div>

      <div className="panel p-6">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Fon</div>
            <div className="font-mono text-xl font-semibold">{selected}</div>
          </div>
          <div className="flex gap-3 text-xs">
            <Stat label="Yeşil gün" value={positive.toString()} color="text-gain" />
            <Stat label="Kırmızı gün" value={negative.toString()} color="text-loss" />
            <Stat label="En iyi gün" value={formatPercent(maxGain.return)} color="text-gain" />
            <Stat label="En kötü gün" value={formatPercent(maxLoss.return)} color="text-loss" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <CalendarHeatmap cells={cells} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-mono text-sm tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
