'use client';

import { cn } from '@/lib/utils';

interface Props {
  ticker: string;
  /** Logo varsa gösterilir; yoksa ticker initials + renkli bg fallback */
  size?: number;
  className?: string;
  rounded?: boolean;
}

/**
 * BIST hisse logosu — kendi sunucumuzda `/stock-logos/{TICKER}.svg` olarak host
 * ediliyor. Yoksa ticker baş harfleriyle renkli bg fallback (consistent hash).
 *
 * Next.js Image optimize etmiyor SVG'leri; <img> ile direkt serve edip
 * fallback için onError handler kullanılıyor. Tam SSR uyumlu.
 */
export function StockLogo({ ticker, size = 32, className, rounded = true }: Props) {
  const src = `/stock-logos/${ticker.toUpperCase()}.svg`;
  const initials = ticker.slice(0, 2).toUpperCase();
  const bgHue = hashHue(ticker);

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-white',
        rounded ? 'rounded-full' : 'rounded-md',
        'ring-1 ring-border/40',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={`${ticker} logo`}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-contain p-1"
        onError={(e) => {
          // Fallback: placeholder sibling'ini göster
          const t = e.currentTarget;
          t.style.display = 'none';
          const sib = t.nextElementSibling as HTMLElement | null;
          if (sib) sib.style.display = 'flex';
        }}
      />
      <span
        aria-hidden
        className="absolute inset-0 hidden items-center justify-center text-[10px] font-bold tracking-tighter"
        style={{
          background: `hsl(${bgHue} 55% 45%)`,
          color: '#fff',
          fontSize: size * 0.32,
        }}
      >
        {initials}
      </span>
    </span>
  );
}

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}
