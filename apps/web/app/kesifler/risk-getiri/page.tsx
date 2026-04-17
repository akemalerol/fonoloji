import { RiskReturnScatter } from '@/components/fx/risk-return-scatter';
import { api } from '@/lib/api';

export const revalidate = 60;
export const metadata = { title: 'Risk-Getiri' };

export default async function RiskReturnPage() {
  const data = await api.riskReturn();
  const items = data.items.filter((i) => i.return_1y !== null && i.volatility_90 !== null);

  return (
    <div className="container py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Risk-Getiri Haritası</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Her nokta bir fon. X: yıllıklandırılmış volatilite (90g), Y: 1 yıllık getiri, boyut: fon büyüklüğü.
          Sağ üst = yüksek getiri + yüksek risk, sol üst = verimlilik cenneti.
        </p>
      </div>
      <div className="panel p-4">
        <RiskReturnScatter items={items} />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard title="Toplam fon" value={items.length.toString()} />
        <StatCard
          title="En yüksek Sharpe (benzer)"
          value={
            items.length
              ? items
                  .reduce((best, i) =>
                    i.volatility_90 > 0 && i.return_1y / i.volatility_90 > best.return_1y / best.volatility_90
                      ? i
                      : best,
                  )
                  .code
              : '—'
          }
        />
        <StatCard
          title="En düşük volatilite"
          value={
            items.length
              ? items.reduce((m, i) => (i.volatility_90 < m.volatility_90 ? i : m)).code
              : '—'
          }
        />
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="panel p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="mt-1 font-mono text-lg font-semibold">{value}</div>
    </div>
  );
}
