'use client';

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface DrawdownPoint {
  date: string;
  drawdown: number;
}

export function DrawdownChart({ data }: { data: DrawdownPoint[] }) {
  if (data.length === 0) return null;
  // Cap to last 1 year for clarity
  const display = data.slice(-365);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={display} margin={{ top: 8, right: 5, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="ddFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F43F5E" stopOpacity={0.1} />
            <stop offset="100%" stopColor="#F43F5E" stopOpacity={0.5} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          stroke="#71717A"
          fontSize={10}
          tickFormatter={(v) => v.slice(5)}
          minTickGap={50}
        />
        <YAxis
          stroke="#71717A"
          fontSize={10}
          domain={['dataMin', 0]}
          tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
          width={50}
        />
        <Tooltip
          contentStyle={{
            background: 'rgba(17,17,19,0.95)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(v: number) => [`${(v * 100).toFixed(2)}%`, 'Drawdown']}
        />
        <Area
          type="monotone"
          dataKey="drawdown"
          stroke="#F43F5E"
          strokeWidth={1.5}
          fill="url(#ddFill)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
