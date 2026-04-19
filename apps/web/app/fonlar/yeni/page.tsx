import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import { formatCompact, formatPercent } from '@/lib/utils';

export const metadata = {
  title: 'Yeni listelenen fonlar — TEFAS',
  description:
    'Son 30 günde TEFAS\'ta yeni işlem görmeye başlayan yatırım fonları, emeklilik fonları ve BYF\'ler.',
};
export const revalidate = 1800;

interface Row {
  code: string;
  name: string;
  type: string | null;
  category: string | null;
  management_company: string | null;
  first_seen: string | null;
  current_price: number | null;
  return_1m: number | null;
  aum: number | null;
}

async function fetchNew(days: number): Promise<Row[]> {
  try {
    const base = process.env.FONOLOJI_API_URL ?? 'http://localhost:4000';
    const res = await fetch(`${base}/api/funds/new?days=${days}&limit=100`, { next: { revalidate: 1800 } });
    if (!res.ok) return [];
    const d = await res.json();
    return d.items as Row[];
  } catch { return []; }
}

function daysAgo(date: string | null): string {
  if (!date) return '—';
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
  if (diff === 0) return 'bugün';
  if (diff === 1) return 'dün';
  return `${diff} gün önce`;
}

export default async function YeniFonlarPage({ searchParams }: { searchParams: { days?: string } }) {
  const days = Math.min(Math.max(Number(searchParams.days ?? '30'), 7), 365);
  const items = await fetchNew(days);

  return (
    <div className="container py-10 md:py-14">
      <div className="mb-10 border-b border-border/50 pb-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <Sparkles className="h-3 w-3 text-brand-400" /> Yenilikler
        </div>
        <h1 className="display mt-2 text-5xl leading-none md:text-6xl">
          <span className="display-italic gradient-text">Yeni</span> listelenen fonlar
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Son {days} günde TEFAS'ta ilk kez gözlenen fonlar. İhraç veren portföy yönetim
          şirketi + kategori + ilk fiyat. Yatırımcı sayısı düşük olabilir — yeni olduğu için.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {[7, 30, 90, 180, 365].map((d) => (
            <Link
              key={d}
              href={`/fonlar/yeni?days=${d}`}
              className={`rounded-full border px-3 py-1 font-mono tabular-nums transition ${
                d === days ? 'border-brand-500/50 bg-brand-500/10 text-brand-200' : 'border-border/50 bg-background/40 text-muted-foreground hover:border-brand-500/30'
              }`}
            >
              son {d} gün
            </Link>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="panel p-10 text-center">
          <p className="text-sm text-muted-foreground">Bu dönemde yeni listelenen fon yok.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((f) => (
            <Link
              key={f.code}
              href={`/fon/${f.code}`}
              className="panel group flex flex-wrap items-center gap-4 p-4 transition hover:border-brand-500/30"
            >
              <div className="inline-flex h-10 w-16 items-center justify-center rounded bg-gradient-to-br from-brand-500 to-verdigris-400 font-mono text-xs font-bold text-background">
                {f.code}
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-300">
                <Sparkles className="h-2.5 w-2.5" /> yeni
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{f.name}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  {f.management_company && <span>{f.management_company}</span>}
                  {f.category && <><span>·</span><span>{f.category}</span></>}
                  <span>·</span>
                  <span className="font-mono">{daysAgo(f.first_seen)}</span>
                </div>
              </div>
              <div className="hidden items-center gap-6 text-right md:flex">
                {f.aum !== null && (
                  <div>
                    <div className="text-[10px] text-muted-foreground/70">AUM</div>
                    <div className="font-mono text-sm tabular-nums">{formatCompact(f.aum)}</div>
                  </div>
                )}
                {f.return_1m !== null && (
                  <div>
                    <div className="text-[10px] text-muted-foreground/70">1 Ay</div>
                    <div className={`font-mono text-sm tabular-nums ${f.return_1m >= 0 ? 'text-gain' : 'text-loss'}`}>
                      {formatPercent(f.return_1m, 1)}
                    </div>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
