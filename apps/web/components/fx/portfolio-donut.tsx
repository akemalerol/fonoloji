'use client';

import { useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

const LABELS: Record<string, string> = {
  stock: 'Hisse Senedi',
  government_bond: 'Devlet Tahvili',
  treasury_bill: 'Hazine Bonosu',
  corporate_bond: 'Özel Sektör',
  eurobond: 'Eurobond',
  gold: 'Altın',
  cash: 'Nakit / Mevduat',
  other: 'Diğer',
};

// Distinct-per-slice palette. Stays coherent with brand (amber) + verdigris
// accent, distributes other slices across warm + cool spectrum.
const COLORS: Record<string, string> = {
  stock: '#F59E0B',         // amber — equity / primary brand
  government_bond: '#2DD4BF', // verdigris — govt debt (accent)
  treasury_bill: '#0EA5E9',  // steel blue
  corporate_bond: '#FB7185', // coral — corporate bonds
  eurobond: '#C084FC',       // soft violet — foreign debt
  gold: '#FCD34D',           // warm gold — precious metals
  cash: '#10B981',           // emerald — cash / deposits
  other: '#94A3B8',          // warm slate — catch-all
};

const ICONS: Record<string, string> = {
  stock: '📈',
  government_bond: '🏛️',
  treasury_bill: '📜',
  corporate_bond: '🏢',
  eurobond: '💱',
  gold: '🥇',
  cash: '💰',
  other: '◌',
};

export interface PortfolioSlice {
  key: string;
  value: number;
}

export function PortfolioDonut({ data, size = 240 }: { data: PortfolioSlice[]; size?: number }) {
  const prepared = useMemo(
    () =>
      data
        .filter((s) => s.value > 0.05)
        .sort((a, b) => b.value - a.value)
        .map((s) => ({
          key: s.key,
          name: LABELS[s.key] ?? s.key,
          value: Math.round(s.value * 100) / 100,
          color: COLORS[s.key] ?? '#A855F7',
          icon: ICONS[s.key] ?? '◌',
        })),
    [data],
  );

  const total = prepared.reduce((a, b) => a + b.value, 0);
  const largest = prepared[0];
  const [active, setActive] = useState<string | null>(null);
  const activeSlice = prepared.find((p) => p.key === active) ?? largest;

  return (
    <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[auto_1fr]">
      <div className="relative" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={prepared}
              dataKey="value"
              innerRadius="62%"
              outerRadius="100%"
              paddingAngle={1.5}
              isAnimationActive={false}
              onMouseEnter={(_, idx) => setActive(prepared[idx]?.key ?? null)}
              onMouseLeave={() => setActive(null)}
            >
              {prepared.map((entry) => (
                <Cell
                  key={entry.key}
                  fill={entry.color}
                  stroke="transparent"
                  style={{
                    opacity: !active || active === entry.key ? 1 : 0.35,
                    transition: 'opacity 0.2s',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {activeSlice && (
            <>
              <span className="text-xl">{activeSlice.icon}</span>
              <span className="mt-1 max-w-[120px] truncate text-[11px] uppercase tracking-wider text-muted-foreground">
                {activeSlice.name}
              </span>
              <span className="font-mono text-3xl font-semibold tabular-nums" style={{ color: activeSlice.color }}>
                %{activeSlice.value.toFixed(1)}
              </span>
            </>
          )}
        </div>
      </div>

      <ul className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-1">
        {prepared.map((s) => (
          <li
            key={s.key}
            className={`flex items-center justify-between gap-3 rounded-md px-2 py-1.5 transition-colors ${
              active === s.key ? 'bg-white/5' : 'hover:bg-white/[0.03]'
            }`}
            onMouseEnter={() => setActive(s.key)}
            onMouseLeave={() => setActive(null)}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: s.color, boxShadow: `0 0 0 2px ${s.color}15` }}
              />
              <span className="flex items-center gap-1.5 truncate text-foreground/90">
                <span className="text-xs opacity-70">{s.icon}</span>
                <span className="truncate">{s.name}</span>
              </span>
            </span>
            <span className="flex items-center gap-2 tabular-nums">
              <span className="h-1.5 w-10 shrink-0 overflow-hidden rounded-full bg-secondary/40">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${Math.min(100, s.value)}%`, background: s.color }}
                />
              </span>
              <span className="w-14 text-right font-mono text-xs font-semibold">%{s.value.toFixed(2)}</span>
            </span>
          </li>
        ))}
        {total < 99.5 && (
          <li className="mt-2 border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
            Toplam: %{total.toFixed(2)} (TEFAS ham veri {'<'}%100 olabilir)
          </li>
        )}
      </ul>
    </div>
  );
}
