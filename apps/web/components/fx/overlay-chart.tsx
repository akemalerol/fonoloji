'use client';

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';

interface OverlayChartProps {
  series: Array<{ code: string; points: Array<{ date: string; price: number }> }>;
  height?: number;
}

const COLORS = ['#F59E0B', '#22D3EE', '#F59E0B', '#10B981', '#F43F5E'];

export function OverlayChart({ series, height = 360 }: OverlayChartProps) {
  if (series.length === 0) return null;

  // Normalize: index 100 at first common date
  const normalized = series.map((s, idx) => {
    const base = s.points[0]?.price ?? 1;
    return {
      code: s.code,
      color: COLORS[idx % COLORS.length],
      points: s.points.map((p) => ({ date: p.date, [s.code]: (p.price / base) * 100 })),
    };
  });

  const dateSet = new Set<string>();
  normalized.forEach((n) => n.points.forEach((p) => dateSet.add(p.date as string)));
  const dates = Array.from(dateSet).sort();

  const merged = dates.map((date) => {
    const row: Record<string, unknown> = { date };
    normalized.forEach((n) => {
      const point = n.points.find((p) => p.date === date);
      if (point) row[n.code] = point[n.code];
    });
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={merged} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis dataKey="date" stroke="#71717A" fontSize={11} tickLine={false} axisLine={false} minTickGap={40} />
        <YAxis
          stroke="#71717A"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={50}
          tickFormatter={(v) => Math.round(Number(v)).toString()}
        />
        <Tooltip
          contentStyle={{
            background: 'rgba(17,17,19,0.95)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: '#a1a1aa', fontSize: 11 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {normalized.map((n) => (
          <Line
            key={n.code}
            type="monotone"
            dataKey={n.code}
            stroke={n.color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
