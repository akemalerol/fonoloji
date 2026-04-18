import { ExternalLink, Flame, Megaphone } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';

export const metadata = {
  title: 'Haftanın KAP manşet fonları',
  description:
    'Son 7 günde KAP\'ta en çok bildirim yayınlayan yatırım fonları. Portföy değişikliği, isim güncellemesi, yönetici atama — her şey burada.',
};
export const revalidate = 900; // 15 dk

type Item = Awaited<ReturnType<typeof api.trendingKap>>['items'][number];

function formatTs(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function daysBefore(ms: number): string {
  const diff = Date.now() - ms;
  const d = Math.floor(diff / 86_400_000);
  if (d === 0) return 'bugün';
  if (d === 1) return 'dün';
  return `${d} gün önce`;
}

export default async function KapManşetleriPage({
  searchParams,
}: {
  searchParams: { days?: string };
}) {
  const days = Math.min(Math.max(Number(searchParams.days ?? '7'), 1), 90);
  const { items, period_days } = await api.trendingKap(days, 50).catch(() => ({
    period_days: days,
    items: [] as Item[],
  }));

  return (
    <div className="container py-10 md:py-14">
      <div className="mb-10 border-b border-border/50 pb-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <Flame className="h-3 w-3 text-amber-400" />
          KAP radarı
        </div>
        <h1 className="display mt-2 text-5xl leading-none md:text-6xl">
          <span className="display-italic gradient-text">Haftanın</span> KAP manşetleri
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Son {period_days} günde KAP'ta ilginç bildirim yayınlayan fonlar.
          Portföy raporu, izahname değişikliği, özel durum, yatırımcı bilgi formu — yatırımcının
          fark etmesi gereken her şey. Rutin komisyon bildirimleri sayılmaz.
        </p>

        <div className="mt-6 flex flex-wrap gap-2 text-xs">
          {[1, 3, 7, 14, 30].map((d) => (
            <Link
              key={d}
              href={`/ekonomi/kap-mansetleri?days=${d}`}
              className={`rounded-full border px-3 py-1 font-mono tabular-nums transition ${
                d === period_days
                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-200'
                  : 'border-border/50 bg-background/40 text-muted-foreground hover:border-amber-500/30 hover:text-foreground'
              }`}
            >
              son {d} gün
            </Link>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="panel p-10 text-center">
          <Megaphone className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <div className="display text-2xl">Bu dönemde ilginç bildirim yok</div>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Daha geniş bir pencere deneyebilirsin — bazen ay başına kadar bekler.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it, i) => {
            const subjects = (it.subjects ?? '').split(',').map((s) => s.trim()).filter(Boolean);
            return (
              <Link
                key={it.fund_code}
                href={`/fon/${it.fund_code}`}
                className="panel group flex flex-wrap items-center gap-4 p-4 transition hover:border-amber-500/30 hover:bg-card/60"
              >
                <div className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground/60">
                  #{i + 1}
                </div>
                <div className="inline-flex h-10 w-16 items-center justify-center rounded bg-gradient-to-br from-amber-500 to-brand-400 font-mono text-xs font-bold text-background">
                  {it.fund_code}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{it.name ?? '—'}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{it.category ?? '—'}</span>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="font-mono">Son: {daysBefore(it.son_bildirim)} ({formatTs(it.son_bildirim)})</span>
                  </div>
                  {subjects.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {subjects.slice(0, 4).map((s) => (
                        <span
                          key={s}
                          className="inline-flex items-center rounded-md border border-verdigris-500/30 bg-verdigris-500/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-verdigris-300"
                        >
                          {s}
                        </span>
                      ))}
                      {subjects.length > 4 && (
                        <span className="font-mono text-[10px] text-muted-foreground/60">
                          +{subjects.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-mono text-2xl font-semibold tabular-nums text-amber-300">
                      {it.bildirim_sayisi}
                    </div>
                    <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                      bildirim
                    </div>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-amber-400" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <p className="mt-16 border-t border-border/40 pt-6 text-center text-xs text-muted-foreground">
        Kaynak: kap.org.tr · Rutin komisyon bildirimleri filtrelenmiştir · Yatırım tavsiyesi değildir.
      </p>
    </div>
  );
}
