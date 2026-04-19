import { Archive } from 'lucide-react';
import Link from 'next/link';
import { formatCompact } from '@/lib/utils';

export const metadata = {
  title: 'Kapanmış fonlar arşivi — Fonoloji',
  description:
    'TEFAS\'ta eskiden işlem gören, şu an listede olmayan veya güncellenmemiş fonların arşivi. Tarihsel kayıt + son gözlenen metrikler.',
};
export const revalidate = 3600;

interface Row {
  code: string;
  name: string;
  type: string | null;
  category: string | null;
  management_company: string | null;
  trading_status: string | null;
  first_seen: string | null;
  last_seen: string | null;
  current_price: number | null;
  aum: number | null;
  investor_count: number | null;
  return_1y: number | null;
  return_all: number | null;
}

async function fetchArchived(): Promise<Row[]> {
  try {
    const base = process.env.FONOLOJI_API_URL ?? 'http://localhost:4000';
    const res = await fetch(`${base}/api/funds/archived`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const d = await res.json();
    return d.items as Row[];
  } catch {
    return [];
  }
}

function daysAgo(date: string | null): string {
  if (!date) return '—';
  const diff = (Date.now() - new Date(date).getTime()) / 86_400_000;
  if (diff < 1) return 'bugün';
  if (diff < 30) return `${Math.floor(diff)} gün önce`;
  const months = Math.floor(diff / 30);
  if (months < 12) return `${months} ay önce`;
  return `${(diff / 365).toFixed(1)} yıl önce`;
}

export default async function ArsivPage() {
  const items = await fetchArchived();

  return (
    <div className="container py-10 md:py-14">
      <div className="mb-10 border-b border-border/50 pb-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <Archive className="h-3 w-3 text-muted-foreground" /> Arşiv
        </div>
        <h1 className="display mt-2 text-5xl leading-none md:text-6xl">
          Kapanmış <span className="display-italic gradient-text">fonlar</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          TEFAS'ta eskiden işlem gören, şu an listede olmayan veya 30+ gündür
          güncellenmeyen fonlar. Tarihsel kayıt — son gözlenen fiyat, fon büyüklüğü, getiri
          ve işlem durumu. Birçoğu birleşmiş, tasfiye edilmiş veya isim değiştirmiş.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="panel p-10 text-center">
          <p className="text-sm text-muted-foreground">Arşiv boş.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((f) => (
            <Link
              key={f.code}
              href={`/fon/${f.code}`}
              className="panel group flex flex-wrap items-center gap-4 p-4 opacity-80 transition hover:opacity-100"
            >
              <div className="inline-flex h-10 w-16 items-center justify-center rounded bg-muted font-mono text-xs font-bold text-muted-foreground">
                {f.code}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{f.name}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  {f.management_company && <span>{f.management_company}</span>}
                  {f.category && <><span>·</span><span>{f.category}</span></>}
                  {f.trading_status && <><span>·</span><span className="text-amber-300">{f.trading_status.slice(0, 40)}</span></>}
                </div>
              </div>
              <div className="hidden items-center gap-6 text-right md:flex">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">Son büyüklük</div>
                  <div className="font-mono text-sm tabular-nums">{f.aum ? formatCompact(f.aum) : '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">Son güncelleme</div>
                  <div className="font-mono text-sm tabular-nums">{daysAgo(f.last_seen)}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <p className="mt-16 text-center text-xs text-muted-foreground">
        Kaynak: TEFAS · trading_status'u "işlem görüyor" olmayan veya 30+ gündür güncellenmeyen kayıtlar
      </p>
    </div>
  );
}
