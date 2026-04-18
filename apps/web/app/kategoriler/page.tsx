import { Compass, TrendingUp, Users } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { decodeCategory } from '@/lib/decoders';
import { formatCompact, formatPercent } from '@/lib/utils';

export const metadata = {
  title: 'TEFAS fon kategorileri — Fonoloji',
  description:
    'Para piyasası, hisse senedi, borçlanma araçları, kıymetli madenler, katılım, serbest — tüm TEFAS fon kategorileri nedir, kim için uygun, hangi fonlar var. 2.500+ fon kategori kategori.',
};
export const revalidate = 300;

function riskColor(risk?: 'low' | 'mid' | 'high' | 'var' | null): string {
  if (risk === 'low') return 'text-emerald-300';
  if (risk === 'mid') return 'text-amber-300';
  if (risk === 'high') return 'text-loss';
  return 'text-muted-foreground';
}

function riskLabel(risk?: 'low' | 'mid' | 'high' | 'var' | null): string {
  if (risk === 'low') return 'Düşük';
  if (risk === 'mid') return 'Orta';
  if (risk === 'high') return 'Yüksek';
  return 'Değişken';
}

export default async function KategoriIndexPage() {
  const { items } = await api.categories().catch(() => ({ items: [] }));

  return (
    <div className="container py-10 md:py-14">
      <div className="mb-10 border-b border-border/50 pb-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <Compass className="h-3 w-3 text-brand-400" /> Keşfet
        </div>
        <h1 className="display mt-2 text-5xl leading-none md:text-6xl">
          TEFAS fon <span className="display-italic gradient-text">kategorileri</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Türk yatırım fonları şemsiye kategorilere ayrılır: para piyasası, hisse senedi,
          borçlanma araçları, kıymetli madenler, katılım, serbest, fon sepeti, değişken...
          Her kategori farklı risk-getiri profiline sahip.
          Hangi kategori kim için uygun?
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {items.map((cat) => {
          const info = decodeCategory(cat.category);
          return (
            <Link
              key={cat.category}
              href={`/kategori/${encodeURIComponent(cat.category)}`}
              className="panel group flex flex-col gap-3 p-5 transition hover:border-brand-500/40"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="serif text-lg leading-snug group-hover:text-brand-200">
                    {cat.category}
                  </h2>
                  <span
                    className={`shrink-0 rounded-full border border-border/50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${riskColor(info?.risk)}`}
                  >
                    {riskLabel(info?.risk)}
                  </span>
                </div>
                {info && (
                  <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                    {info.short}
                  </p>
                )}
              </div>

              <div className="mt-auto grid grid-cols-3 gap-2 border-t border-border/30 pt-3 text-[11px]">
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70">Fon</div>
                  <div className="flex items-center gap-1 font-mono tabular-nums">
                    <Users className="h-3 w-3 text-muted-foreground/50" />
                    {cat.fund_count ?? 0}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70">AUM</div>
                  <div className="font-mono tabular-nums">
                    {cat.total_aum ? formatCompact(cat.total_aum) : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70">1Y Ort.</div>
                  <div className={`flex items-center gap-1 font-mono tabular-nums ${(cat.avg_return ?? 0) > 0 ? 'text-gain' : (cat.avg_return ?? 0) < 0 ? 'text-loss' : ''}`}>
                    <TrendingUp className="h-3 w-3 opacity-60" />
                    {cat.avg_return !== null && cat.avg_return !== undefined
                      ? formatPercent(cat.avg_return, 1)
                      : '—'}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {items.length === 0 && (
        <div className="panel p-10 text-center">
          <p className="text-sm text-muted-foreground">Kategori verisi henüz yüklenmedi.</p>
        </div>
      )}

      <p className="mt-16 border-t border-border/40 pt-6 text-center text-xs text-muted-foreground">
        Veriler TEFAS'tan günlük olarak senkronlanır · Yatırım tavsiyesi değildir
      </p>
    </div>
  );
}
