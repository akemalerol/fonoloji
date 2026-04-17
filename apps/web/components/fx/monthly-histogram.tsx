'use client';

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface MonthlyReturn {
  month: string;
  return: number;
}

export function MonthlyHistogram({ data }: { data: MonthlyReturn[] }) {
  if (data.length === 0) return null;
  const display = data.slice(-24); // last 24 months max

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={display} margin={{ top: 10, right: 5, bottom: 0, left: 0 }}>
        <XAxis
          dataKey="month"
          stroke="#71717A"
          fontSize={10}
          tickFormatter={(v) => v.slice(2)}
          interval={Math.max(0, Math.floor(display.length / 12) - 1)}
        />
        <YAxis
          stroke="#71717A"
          fontSize={10}
          tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
          width={45}
        />
        <Tooltip
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          contentStyle={{
            background: 'rgba(17,17,19,0.96)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            fontSize: 12,
            padding: '8px 12px',
            color: '#f5f5f7',
            backdropFilter: 'blur(8px)',
          }}
          labelStyle={{ color: '#a8a8b3', marginBottom: 4, fontSize: 11 }}
          itemStyle={{ color: '#f5f5f7' }}
          formatter={(v: number) => [`${(v * 100).toFixed(2)}%`, 'Aylık getiri']}
        />
        <Bar dataKey="return" radius={[3, 3, 0, 0]} isAnimationActive={false}>
          {display.map((d, i) => (
            <Cell key={i} fill={d.return >= 0 ? '#10B981' : '#F43F5E'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
