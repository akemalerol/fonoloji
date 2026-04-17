import { api } from '@/lib/api';

export const revalidate = 60;
export const metadata = { title: 'Korelasyon Matrisi' };

export default async function CorrelationPage() {
  const { items: topFunds } = await api.listFunds({ sort: 'aum', limit: 15 });
  const codes = topFunds.map((f) => f.code);
  const matrix = await api.correlation(codes);

  const lookup = new Map<string, number | null>();
  for (const m of matrix.matrix) {
    lookup.set(`${m.a}|${m.b}`, m.r);
    lookup.set(`${m.b}|${m.a}`, m.r);
  }

  return (
    <div className="container py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Korelasyon Matrisi</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          fon büyüklüğüne göre en büyük {codes.length} fon arası Pearson korelasyonu (son 1 yıl günlük getiriler).
          Yüksek pozitif (yeşil) → birlikte hareket ediyor. Negatif (kırmızı) → ters. Düşük korelasyonlu
          fonlar portföy çeşitlendirmesi için aranır.
        </p>
      </div>
      <div className="panel overflow-x-auto p-4">
        <table className="min-w-full border-collapse text-xs tabular-nums">
          <thead>
            <tr>
              <th />
              {codes.map((c) => (
                <th key={c} className="px-2 py-1 font-mono text-[10px] text-muted-foreground">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {codes.map((row) => (
              <tr key={row}>
                <th className="px-2 py-1 text-right font-mono text-[10px] text-muted-foreground">{row}</th>
                {codes.map((col) => {
                  const r = lookup.get(`${row}|${col}`);
                  if (r === null || r === undefined)
                    return (
                      <td key={col} className="border border-border/40 p-2 text-center text-muted-foreground">
                        —
                      </td>
                    );
                  const alpha = Math.abs(r);
                  const bg =
                    r > 0
                      ? `rgba(16, 185, 129, ${alpha * 0.7})`
                      : `rgba(244, 63, 94, ${alpha * 0.7})`;
                  const textColor = alpha > 0.5 ? '#fff' : 'inherit';
                  return (
                    <td
                      key={col}
                      className="border border-border/40 p-2 text-center"
                      style={{ background: bg, color: textColor }}
                    >
                      {r.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
