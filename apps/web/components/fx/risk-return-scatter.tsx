'use client';

import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';

interface Item {
  code: string;
  name: string;
  category: string;
  return_1y: number;
  volatility_90: number;
  aum: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Hisse Senedi Fonu': '#F59E0B',
  'Değişken Fon': '#22D3EE',
  'Tahvil Fonu': '#F59E0B',
  'Para Piyasası Fonu': '#10B981',
  'Kıymetli Madenler': '#EAB308',
  Eurobond: '#EC4899',
  'Emeklilik - Hisse': '#A855F7',
  'Emeklilik - Katılım': '#06B6D4',
  'Emeklilik - Para Piyasası': '#84CC16',
  'Emeklilik - Katkı': '#F472B6',
  'BYF - Hisse': '#0EA5E9',
  'BYF - Sektör': '#FB923C',
  'BYF - Altın': '#FACC15',
};

export function RiskReturnScatter({ items }: { items: Item[] }) {
  const grouped: Record<string, Item[]> = {};
  for (const item of items) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category]!.push(item);
  }

  return (
    <ResponsiveContainer width="100%" height={520}>
      <ScatterChart margin={{ top: 20, right: 20, left: 20, bottom: 30 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.06)" />
        <XAxis
          type="number"
          dataKey="volatility_90"
          name="Volatilite"
          stroke="#71717A"
          fontSize={11}
          tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
          label={{ value: 'Yıllıklandırılmış Volatilite', position: 'bottom', offset: 0, fill: '#71717A', fontSize: 11 }}
        />
        <YAxis
          type="number"
          dataKey="return_1y"
          name="1Y Getiri"
          stroke="#71717A"
          fontSize={11}
          tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
          label={{ value: '1 Yıllık Getiri', angle: -90, position: 'insideLeft', fill: '#71717A', fontSize: 11 }}
        />
        <ZAxis type="number" dataKey="aum" range={[40, 500]} />
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          contentStyle={{
            background: 'rgba(17,17,19,0.95)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            fontSize: 12,
          }}
          content={({ active, payload }) => {
            if (!active || !payload || payload.length === 0) return null;
            const p = payload[0]!.payload as Item;
            return (
              <div className="rounded-lg border border-border bg-popover p-3 text-xs">
                <div className="font-mono font-bold">{p.code}</div>
                <div className="max-w-[240px] truncate text-muted-foreground">{p.name}</div>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                  <span className="text-muted-foreground">1Y</span>
                  <span className="text-right tabular-nums">{(p.return_1y * 100).toFixed(2)}%</span>
                  <span className="text-muted-foreground">Volatilite</span>
                  <span className="text-right tabular-nums">{(p.volatility_90 * 100).toFixed(2)}%</span>
                </div>
              </div>
            );
          }}
        />
        {Object.entries(grouped).map(([cat, data]) => (
          <Scatter key={cat} name={cat} data={data} fill={CATEGORY_COLORS[cat] ?? '#F59E0B'} />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}
