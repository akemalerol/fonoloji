import { AdSlotClient } from './ad-slot-client';
import { cn } from '@/lib/utils';

// Server-rendered AdSense yerleşim sargısı.
// - Backend'den aktif slot bilgisini çeker (admin panelinden ayarlı mı?).
// - Yoksa/kapalıysa hiçbir şey render etmez — SEO'yu etkilemez.
// - Var ise minimal kart stiliyle sarıp "Reklam" mikro etiketi koyar —
//   site tasarımından sırıtmasın.
//
// Kullanım: <AdSlot placement="home-hero" />
//
// Cache: Next.js revalidate 5 dk — admin değişiklik yapınca en geç 5 dk sonra
// yeni slot aktif olur. Empty yerleşim'i de cacheliyoruz.

interface Props {
  placement: string;
  /** Ek tailwind sınıf — margin, max-width vb. */
  className?: string;
  /** "Reklam" etiketini gizle. Default false. */
  minimal?: boolean;
}

async function fetchAd(placement: string): Promise<{ slot_id: string; format: string } | null> {
  try {
    const base = process.env.FONOLOJI_API_URL ?? 'http://localhost:4000';
    const res = await fetch(`${base}/api/ads/${encodeURIComponent(placement)}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const d = (await res.json()) as { ad: { slot_id: string; format: string } | null };
    return d.ad ?? null;
  } catch {
    return null;
  }
}

export async function AdSlot({ placement, className, minimal }: Props) {
  const ad = await fetchAd(placement);
  if (!ad || !ad.slot_id) return null;

  return (
    <aside
      className={cn(
        'my-6 overflow-hidden rounded-xl border border-border/30 bg-card/20 p-3',
        'transition-colors hover:border-border/50',
        className,
      )}
      aria-label="Sponsorlu içerik"
    >
      {!minimal && (
        <div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/70">
          <span className="inline-block h-1 w-1 rounded-full bg-muted-foreground/40" /> Reklam
        </div>
      )}
      <AdSlotClient slotId={ad.slot_id} format={ad.format} />
    </aside>
  );
}
