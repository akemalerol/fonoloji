'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface PriceChartProps {
  data: Array<{ date: string; price: number }>;
  positive?: boolean;
  height?: number;
}

export function PriceChart({ data, positive = true, height = 340 }: PriceChartProps) {
  const color = positive ? '#10B981' : '#F43F5E';
  const brandColor = '#F59E0B';
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={brandColor} stopOpacity={0.35} />
            <stop offset="100%" stopColor={brandColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis
          dataKey="date"
          stroke="#71717A"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          minTickGap={40}
        />
        <YAxis
          stroke="#71717A"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          domain={['dataMin', 'dataMax']}
          width={60}
          tickFormatter={(v) => Number(v).toFixed(2)}
        />
        <Tooltip
          contentStyle={{
            background: 'rgba(17,17,19,0.95)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            fontSize: 12,
            padding: '8px 12px',
          }}
          labelStyle={{ color: '#a1a1aa', fontSize: 11 }}
          formatter={(v: number) => [v.toFixed(6), 'Fiyat']}
        />
        <Area
          type="monotone"
          dataKey="price"
          stroke={brandColor}
          strokeWidth={2}
          fill="url(#priceFill)"
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="price"
          stroke={color}
          strokeWidth={0}
          fill="transparent"
          dot={false}
          activeDot={{ r: 4, fill: brandColor, stroke: '#fff', strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
