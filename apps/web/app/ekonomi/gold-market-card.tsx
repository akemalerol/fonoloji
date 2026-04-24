import { Coins, TrendingDown, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

// Altınkaynak canlı altın/döviz piyasası — ekonomi sayfasındaki kart.
// Sırasıyla: gram altın, çeyrek/yarım/tam, 22/18/14 ayar, bilezik + USD/EUR.
// Her satırda alış/satış ve günlük değişim. Veri 5dk cron, ISR 300sn.

const FEATURED_CODES = [
  'GA', // gram altın
  'C', // çeyrek
  'Y', // yarım
  'T', // teklik
  'A', // ata cumhuriyet
  'B', // 22 ayar bilezik
  '18', // 18 ayar
  '14', // 14 ayar
  'AG_T', // gümüş gram
  'XAUUSD', // ons altın USD
  'USD', // $/TL
  'EUR', // €/TL
];

function fmtTl(n: number | null, digits = 2): string {
  if (n === null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('tr-TR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtPct(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

export async function GoldMarketCard() {
  const data = await api.goldLive().catch(() => null);
  if (!data || data.items.length === 0) return null;

  const itemsByCode = new Map(data.items.map((i) => [i.code, i]));
  const featured = FEATURED_CODES.map((c) => itemsByCode.get(c)).filter(
    (x): x is NonNullable<typeof x> => x !== undefined,
  );

  const updated = data.fetchedAt ? new Date(data.fetchedAt) : null;

  return (
    <section className="mt-12 overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-amber-500/5 to-card/40">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15 ring-1 ring-amber-500/40">
            <Coins className="h-5 w-5 text-amber-300" />
          </div>
          <div>
            <h2 className="display text-2xl">Altın Piyasası</h2>
            <p className="text-[11px] text-muted-foreground">
              Altınkaynak canlı veri · alış/satış spread'li · 5dk güncelleme
            </p>
          </div>
        </div>
        <div className="text-right text-[11px] text-muted-foreground">
          {updated && (
            <>
              <div>
                Son güncelleme:{' '}
                <span className="font-mono">
                  {updated.toLocaleTimeString('tr-TR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Europe/Istanbul',
                  })}
                </span>
              </div>
              <div className="opacity-60">
                {updated.toLocaleDateString('tr-TR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  timeZone: 'Europe/Istanbul',
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="p-5">
        <div className="overflow-hidden rounded-lg border border-border/40">
          <table className="w-full text-sm">
            <thead className="bg-muted/20 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Ürün</th>
                <th className="px-3 py-2 text-right">Alış</th>
                <th className="px-3 py-2 text-right">Satış</th>
                <th className="px-3 py-2 text-right">Değişim</th>
                <th className="px-3 py-2 text-right">Spread</th>
              </tr>
            </thead>
            <tbody>
              {featured.map((it) => {
                const spreadPct =
                  it.sell && it.buy && it.sell > 0
                    ? ((it.sell - it.buy) / it.sell) * 100
                    : null;
                const chg = it.change_pct;
                const digits = it.code === 'USD' || it.code === 'EUR' ? 3 : 2;
                return (
                  <tr key={it.code} className="border-t border-border/40 hover:bg-muted/10">
                    <td className="px-3 py-2">
                      <div className="font-semibold text-foreground">
                        {it.name ?? it.code}
                      </div>
                      {it.description && (
                        <div
                          className="truncate text-[10px] text-muted-foreground"
                          title={it.description}
                        >
                          {it.description}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {fmtTl(it.buy, digits)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-sm font-semibold tabular-nums">
                      {fmtTl(it.sell, digits)}
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2 text-right font-mono text-xs tabular-nums',
                        chg !== null && chg >= 0 && 'text-emerald-300',
                        chg !== null && chg < 0 && 'text-rose-300',
                        chg === null && 'text-muted-foreground',
                      )}
                    >
                      <span className="inline-flex items-center justify-end gap-0.5">
                        {chg !== null && chg >= 0.01 && <TrendingUp className="h-3 w-3" />}
                        {chg !== null && chg <= -0.01 && <TrendingDown className="h-3 w-3" />}
                        {fmtPct(chg)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                      {spreadPct !== null ? `%${spreadPct.toFixed(2)}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
          <strong className="text-muted-foreground/90">Spread</strong> = alış/satış arasındaki
          fark, bir ürünü alıp hemen satarsan kaybettiğin yüzde. Altın fonlarında bu maliyet fon
          içinde yönetim ücretine gömülüdür;{' '}
          <a className="text-amber-300 underline hover:text-amber-200" href="/araclar/altin-karsilastirma">
            Fiziki Altın vs Altın Fonu karşılaştırma aracı →
          </a>
        </p>
      </div>
    </section>
  );
}
