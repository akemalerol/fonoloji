import Link from 'next/link';
import { ChangePill } from '@/components/fx/change-pill';
import { formatCompact, formatPercent } from '@/lib/utils';

export const revalidate = 60;
export const metadata = { title: 'Risk Skoru Dağılımı' };

const API_BASE = process.env.FONOLOJI_API_URL ?? 'http://localhost:4000';

interface DistRow {
  score: number;
  fund_count: number;
  avg_return_1y: number | null;
  avg_volatility: number | null;
  total_aum: number | null;
}

interface TopFund {
  risk_score: number;
  code: string;
  name: string;
  category: string;
  return_1y: number;
  aum: number;
}

const RISK_META: Record<number, { label: string; bg: string; ring: string }> = {
  1: { label: 'Çok Düşük', bg: 'bg-emerald-500', ring: 'ring-emerald-500/30' },
  2: { label: 'Düşük', bg: 'bg-emerald-400', ring: 'ring-emerald-400/30' },
  3: { label: 'Orta-Düşük', bg: 'bg-lime-400', ring: 'ring-lime-400/30' },
  4: { label: 'Orta', bg: 'bg-amber-400', ring: 'ring-amber-400/30' },
  5: { label: 'Orta-Yüksek', bg: 'bg-orange-400', ring: 'ring-orange-400/30' },
  6: { label: 'Yüksek', bg: 'bg-rose-400', ring: 'ring-rose-400/30' },
  7: { label: 'Çok Yüksek', bg: 'bg-rose-500', ring: 'ring-rose-500/30' },
};

async function loadData() {
  const res = await fetch(`${API_BASE}/api/insights/risk-distribution`, { next: { revalidate: 60 } });
  if (!res.ok) return { distribution: [], topByScore: {} as Record<number, TopFund[]> };
  return (await res.json()) as { distribution: DistRow[]; topByScore: Record<number, TopFund[]> };
}

export default async function RiskScorePage() {
  const { distribution, topByScore } = await loadData();
  const totalFunds = distribution.reduce((s, d) => s + d.fund_count, 0);
  const maxCount = Math.max(...distribution.map((d) => d.fund_count), 1);

  return (
    <div className="container py-10">
      <div className="mb-8 border-b border-border/50 pb-6">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">keşifler</div>
        <h1 className="display mt-2 text-5xl leading-none md:text-6xl">
          TEFAS <span className="display-italic text-brand-400">Risk Skoru</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          TEFAS her fona 1-7 arası bir risk skoru veriyor (1 en düşük, 7 en yüksek). Bu sayfa
          dağılımı, ortalama getiri ve her risk seviyesinin liderlerini gösteriyor.
        </p>
        <div className="mt-3 text-xs text-muted-foreground">
          Toplam <span className="font-mono tabular-nums text-foreground">{totalFunds}</span> fon
          veriyle değerlendirildi.
        </div>
      </div>

      {/* Distribution bar chart */}
      <div className="panel mb-8 p-6">
        <h2 className="mb-6 serif text-2xl">Skor başına fon sayısı</h2>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6, 7].map((score) => {
            const row = distribution.find((d) => d.score === score);
            const count = row?.fund_count ?? 0;
            const pct = (count / maxCount) * 100;
            const meta = RISK_META[score]!;
            return (
              <div key={score} className="flex items-center gap-4">
                <div className="w-12 text-sm">
                  <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${meta.bg} font-mono text-xs font-bold text-background`}>
                    {score}
                  </span>
                </div>
                <div className="w-32 text-xs text-muted-foreground">{meta.label}</div>
                <div className="relative flex-1">
                  <div className="h-7 overflow-hidden rounded-md bg-secondary/40">
                    <div
                      className={`h-full ${meta.bg} transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <div className="w-20 text-right">
                  <span className="font-mono tabular-nums">{count}</span>
                  <span className="ml-1 text-xs text-muted-foreground">fon</span>
                </div>
                <div className="hidden w-28 text-right text-xs text-muted-foreground md:block">
                  Ort. 1Y:{' '}
                  <span className={(row?.avg_return_1y ?? 0) >= 0 ? 'text-gain' : 'text-loss'}>
                    {row?.avg_return_1y !== null && row?.avg_return_1y !== undefined
                      ? formatPercent(row.avg_return_1y)
                      : '—'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top funds per risk score */}
      <h2 className="mb-4 serif text-2xl">Her seviyenin liderleri (1Y getiriye göre)</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6, 7].map((score) => {
          const tops = topByScore[score] ?? [];
          if (tops.length === 0) return null;
          const meta = RISK_META[score]!;
          return (
            <div key={score} className={`panel relative overflow-hidden p-5 ring-1 ${meta.ring}`}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${meta.bg} font-mono text-xs font-bold text-background`}>
                    {score}
                  </span>
                  <span className="serif text-base">{meta.label}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {distribution.find((d) => d.score === score)?.fund_count ?? 0} fon
                </span>
              </div>
              <ul className="divide-y divide-border/50">
                {tops.map((f) => (
                  <li key={f.code} className="flex items-center gap-2 py-2">
                    <Link
                      href={`/fon/${f.code}`}
                      className="inline-flex h-6 w-12 shrink-0 items-center justify-center rounded bg-secondary/70 font-mono text-[10px] font-bold"
                    >
                      {f.code}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs">{f.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {formatCompact(f.aum)}
                      </div>
                    </div>
                    <ChangePill value={f.return_1y} className="text-xs" />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
