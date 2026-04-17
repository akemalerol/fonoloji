'use client';

import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface Point {
  date: string;
  yoy_change: number;
  mom_change: number | null;
}

function fmtXaxis(iso: string) {
  const [y, m] = iso.split('-');
  return `${m}/${y!.slice(2)}`;
}

export function CpiCharts({ history }: { history: Point[] }) {
  const yoyData = history.map((h) => ({ date: h.date, value: h.yoy_change * 100 }));
  const momData = history
    .filter((h) => h.mom_change !== null)
    .map((h) => ({ date: h.date, value: (h.mom_change as number) * 100 }));

  return (
    <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Yearly */}
      <div className="panel p-5">
        <div className="mb-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            TÜFE · Yıllık değişim
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground/70">
            Her ayın 12-ay yıllık enflasyon oranı
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={yoyData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="yoyFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" stroke="#71717A" fontSize={10} tickFormatter={fmtXaxis} minTickGap={40} />
            <YAxis stroke="#71717A" fontSize={10} tickFormatter={(v) => `%${v.toFixed(0)}`} width={40} />
            <Tooltip
              contentStyle={{
                background: 'rgba(17,17,19,0.96)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                fontSize: 12,
                padding: '8px 12px',
                color: '#f5f5f7',
              }}
              labelStyle={{ color: '#a8a8b3', marginBottom: 4 }}
              itemStyle={{ color: '#f5f5f7' }}
              labelFormatter={(v) => fmtXaxis(v as string)}
              formatter={(v: number) => [`%${v.toFixed(2)}`, 'Yıllık']}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#F59E0B"
              strokeWidth={2}
              fill="url(#yoyFill)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly */}
      <div className="panel p-5">
        <div className="mb-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            TÜFE · Aylık değişim
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground/70">
            Bir önceki aya göre yüzdesel değişim
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={momData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <XAxis dataKey="date" stroke="#71717A" fontSize={10} tickFormatter={fmtXaxis} minTickGap={40} />
            <YAxis stroke="#71717A" fontSize={10} tickFormatter={(v) => `%${v.toFixed(1)}`} width={45} />
            <Tooltip
              contentStyle={{
                background: 'rgba(17,17,19,0.96)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                fontSize: 12,
                padding: '8px 12px',
                color: '#f5f5f7',
              }}
              labelStyle={{ color: '#a8a8b3', marginBottom: 4 }}
              itemStyle={{ color: '#f5f5f7' }}
              labelFormatter={(v) => fmtXaxis(v as string)}
              formatter={(v: number) => [`%${v.toFixed(2)}`, 'Aylık']}
            />
            <Bar dataKey="value" fill="#2DD4BF" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
