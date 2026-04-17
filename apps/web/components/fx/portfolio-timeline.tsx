'use client';

import { useMemo } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const SERIES = [
  { key: 'stock', label: 'Hisse Senedi', color: '#F59E0B' },
  { key: 'government_bond', label: 'Devlet Tahvili', color: '#2DD4BF' },
  { key: 'treasury_bill', label: 'Hazine Bonosu', color: '#0EA5E9' },
  { key: 'corporate_bond', label: 'Özel Sektör', color: '#FB7185' },
  { key: 'eurobond', label: 'Eurobond', color: '#C084FC' },
  { key: 'gold', label: 'Altın', color: '#FCD34D' },
  { key: 'cash', label: 'Nakit', color: '#10B981' },
  { key: 'other', label: 'Diğer', color: '#94A3B8' },
] as const;

export interface TimelinePoint {
  date: string;
  stock: number;
  government_bond: number;
  treasury_bill: number;
  corporate_bond: number;
  eurobond: number;
  gold: number;
  cash: number;
  other: number;
}

function fmtDate(d: string): string {
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y!.slice(2)}`;
}

export function PortfolioTimeline({ data }: { data: TimelinePoint[] }) {
  const active = useMemo(() => {
    return SERIES.filter((s) => data.some((d) => (d as unknown as Record<string, number>)[s.key] > 0.1));
  }, [data]);

  if (data.length < 2) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Zaman serisi için yeterli veri yok (en az 2 anlık görüntü gerekli).
      </div>
    );
  }

  return (
    <div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
            <defs>
              {active.map((s) => (
                <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0.7} />
                </linearGradient>
              ))}
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={fmtDate}
              interval="preserveStartEnd"
              minTickGap={48}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(v) => `%${v}`}
              domain={[0, 100]}
              width={40}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(17,17,19,0.96)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                fontSize: 12,
                padding: 12,
                backdropFilter: 'blur(8px)',
              }}
              itemStyle={{ padding: '2px 0' }}
              labelFormatter={(v) => fmtDate(v as string)}
              formatter={(v: number, name: string) => {
                const found = SERIES.find((s) => s.key === name);
                return [`%${v.toFixed(2)}`, found?.label ?? name];
              }}
            />
            {active.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stackId="1"
                stroke={s.color}
                fill={`url(#g-${s.key})`}
                strokeWidth={0.5}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {active.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
