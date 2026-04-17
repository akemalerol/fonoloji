const MONTHS_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

export function SeasonalityHeatmap({
  data,
}: {
  data: Array<{ year: string; month: number; return: number }>;
}) {
  if (data.length === 0) return null;

  const years = Array.from(new Set(data.map((d) => d.year))).sort((a, b) => Number(b) - Number(a));
  const byKey = new Map<string, number>();
  for (const d of data) byKey.set(`${d.year}-${d.month}`, d.return);

  const absMax = Math.max(...data.map((d) => Math.abs(d.return)), 0.01);
  const monthlyAvg = Array.from({ length: 12 }, (_, i) => {
    const values = data.filter((d) => d.month === i + 1).map((d) => d.return);
    if (values.length === 0) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
  });

  const cellColor = (v: number) => {
    const alpha = Math.min(Math.abs(v) / absMax, 1) * 0.9;
    return v >= 0 ? `rgba(16, 185, 129, ${alpha})` : `rgba(244, 63, 94, ${alpha})`;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[11px] tabular-nums">
        <thead>
          <tr>
            <th className="py-1.5 pr-3 text-left text-muted-foreground font-medium">Yıl</th>
            {MONTHS_TR.map((m) => (
              <th key={m} className="px-1 py-1.5 text-center font-medium text-muted-foreground">
                {m}
              </th>
            ))}
            <th className="pl-3 text-right font-medium text-muted-foreground">Toplam</th>
          </tr>
        </thead>
        <tbody>
          {years.map((year) => {
            const yearReturns = data.filter((d) => d.year === year).map((d) => d.return);
            const yearSum = yearReturns.length
              ? yearReturns.reduce((a, b) => (1 + a) * (1 + b) - 1, 0)
              : null;
            return (
              <tr key={year}>
                <td className="py-1 pr-3 font-mono text-muted-foreground">{year}</td>
                {MONTHS_TR.map((_, i) => {
                  const v = byKey.get(`${year}-${i + 1}`);
                  return (
                    <td
                      key={i}
                      className="relative border border-border/30 px-1 py-1.5 text-center"
                      style={{ background: v !== undefined ? cellColor(v) : 'transparent', minWidth: '36px' }}
                      title={v !== undefined ? `${year} ${MONTHS_TR[i]}: ${(v * 100).toFixed(2)}%` : '—'}
                    >
                      {v !== undefined ? (
                        <span className={Math.abs(v) > 0.08 ? 'font-semibold text-foreground' : 'text-foreground/80'}>
                          {(v * 100).toFixed(0)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40">·</span>
                      )}
                    </td>
                  );
                })}
                <td
                  className="border border-border/30 pl-2 pr-2 py-1.5 text-right font-semibold"
                  style={{ background: yearSum !== null ? cellColor(yearSum) : 'transparent' }}
                >
                  {yearSum !== null ? `${yearSum >= 0 ? '+' : ''}${(yearSum * 100).toFixed(0)}%` : '—'}
                </td>
              </tr>
            );
          })}
          {/* Average row */}
          <tr className="border-t-2 border-border">
            <td className="py-1 pr-3 text-muted-foreground font-medium">Ort.</td>
            {monthlyAvg.map((v, i) => (
              <td
                key={i}
                className="border border-border/30 px-1 py-1.5 text-center text-[10px]"
                style={{ background: v !== null ? cellColor(v) : 'transparent' }}
              >
                {v !== null ? `${(v * 100).toFixed(1)}` : '—'}
              </td>
            ))}
            <td className="border border-border/30 pl-2 pr-2 text-right text-[10px] text-muted-foreground">ort</td>
          </tr>
        </tbody>
      </table>
      <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>Değerler % olarak</span>
        <span className="ml-auto inline-flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded" style={{ background: 'rgba(244, 63, 94, 0.7)' }} />
          düşüş
          <span className="inline-block h-2 w-4 rounded" style={{ background: 'rgba(16, 185, 129, 0.7)' }} />
          kazanç
        </span>
      </div>
    </div>
  );
}
