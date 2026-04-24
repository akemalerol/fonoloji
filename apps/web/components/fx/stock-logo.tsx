'use client';

import { cn } from '@/lib/utils';

interface Props {
  ticker: string;
  /** Logo varsa gösterilir; yoksa ticker initials + renkli bg fallback */
  size?: number;
  className?: string;
  /** Dışarıdaki beyaz çerçevelemeyi kapat — logo dairenin kenarına kadar gelsin */
  tightCrop?: boolean;
}

// Bloomberg exchange suffix → TR emoji bayrağı + kısa etiket (hover title)
const EX_META: Record<string, { flag: string; name: string }> = {
  US: { flag: '🇺🇸', name: 'ABD (NASDAQ/NYSE)' },
  LN: { flag: '🇬🇧', name: 'Londra (LSE)' },
  BB: { flag: '🇧🇪', name: 'Brüksel (Euronext)' },
  FP: { flag: '🇫🇷', name: 'Paris (Euronext)' },
  NA: { flag: '🇳🇱', name: 'Amsterdam (Euronext)' },
  GY: { flag: '🇩🇪', name: 'Frankfurt (XETRA)' },
  GR: { flag: '🇩🇪', name: 'Almanya' },
  SW: { flag: '🇨🇭', name: 'İsviçre (SIX)' },
  SM: { flag: '🇪🇸', name: 'Madrid (BME)' },
  IM: { flag: '🇮🇹', name: 'İtalya (Borsa Italiana)' },
  JP: { flag: '🇯🇵', name: 'Tokyo (TSE)' },
  HK: { flag: '🇭🇰', name: 'Hong Kong (HKEX)' },
  KS: { flag: '🇰🇷', name: 'Seul (KRX)' },
  AU: { flag: '🇦🇺', name: 'Avustralya (ASX)' },
  CN: { flag: '🇨🇦', name: 'Kanada (TSX)' },
  SP: { flag: '🇨🇳', name: 'Şanghay (SSE)' },
};

/**
 * BIST + yabancı hisse logosu — `/stock-logos/{TICKER}.svg` self-hosted.
 *
 * - Daire kırpma: logolar SVG'lerinin doğal viewBox'ı farklı iç padding taşıyor;
 *   `tightCrop` ile daireyi küçültmek yerine imajı doldur.
 * - Fallback: logo yoksa ticker baş harfleri + hashed hue bg.
 * - Bloomberg format (AMZN US, AAL LN) → trim edilip base ticker dosyası aranır.
 */
export function StockLogo({ ticker, size = 32, className, tightCrop = true }: Props) {
  const raw = ticker.toUpperCase().trim();
  // Bloomberg format → base ticker (file isminde boşluk var, URL'de encode edilir)
  const hasSuffix = /\s+[A-Z]{2}$/.test(raw);
  const base = hasSuffix ? raw.replace(/\s+[A-Z]{2}$/, '') : raw;
  const src = `/stock-logos/${encodeURIComponent(raw)}.svg`;

  const bgHue = hashHue(base);
  const initials = base.slice(0, 2);

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-white',
        'rounded-full ring-1 ring-border/40',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`${raw} logo`}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        className={cn(
          'h-full w-full',
          // tightCrop: logoyu daire içine bastır (cover+scale), padding yok
          // Aksi hâlde contain+hafif padding
          tightCrop ? 'scale-110 object-cover' : 'object-contain p-1',
        )}
        onError={(e) => {
          const t = e.currentTarget;
          t.style.display = 'none';
          const sib = t.nextElementSibling as HTMLElement | null;
          if (sib) sib.style.display = 'flex';
        }}
      />
      <span
        aria-hidden
        className="absolute inset-0 hidden items-center justify-center font-bold tracking-tighter"
        style={{
          background: `hsl(${bgHue} 55% 45%)`,
          color: '#fff',
          fontSize: size * 0.38,
        }}
      >
        {initials}
      </span>
    </span>
  );
}

/**
 * Ticker'ın yanında gösterilebilecek kompakt borsa/ülke rozeti.
 * Bloomberg format için (AMZN US → 🇺🇸 US), BIST için gösterilmez (default kabul).
 */
export function ExchangeBadge({ ticker, className }: { ticker: string; className?: string }) {
  const m = /\s+([A-Z]{2})$/.exec(ticker.trim());
  if (!m) return null;
  const suffix = m[1]!;
  const meta = EX_META[suffix];
  if (!meta) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded bg-muted/30 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-muted-foreground ring-1 ring-border/30',
        className,
      )}
      title={meta.name}
    >
      <span aria-hidden>{meta.flag}</span>
      <span>{suffix}</span>
    </span>
  );
}

/** Ticker'dan base sembol (suffix'siz) çıkar: "AMZN US" → "AMZN" */
export function stripExchangeSuffix(ticker: string): string {
  return ticker.trim().replace(/\s+[A-Z]{2}$/, '');
}

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}
