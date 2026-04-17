/**
 * Shared metadata for all live market tickers: display format, session hours,
 * country (for flags), colour accent, and short labels. Consumed by the
 * dashboard cards and the session status computation.
 */

export interface SessionWindow {
  tz: string;
  open: [number, number];
  close: [number, number];
  weekendsClosed: boolean;
  /** Where the exchange is based, e.g. "New York" — shown on session badge. */
  city?: string;
}

export interface TickerMeta {
  format: (v: number) => string;
  accent: string;
  /** ISO country code for flag emoji. `undefined` = no flag (e.g. crypto, commodity). */
  country?: string;
  /** Short label for the group header chip. */
  shortLabel?: string;
  window: SessionWindow;
}

const FX_WINDOW: SessionWindow = { tz: 'UTC', open: [0, 0], close: [24, 0], weekendsClosed: true };
const CRYPTO_WINDOW: SessionWindow = { tz: 'UTC', open: [0, 0], close: [24, 0], weekendsClosed: false };

export const MARKET_META: Record<string, TickerMeta> = {
  // ─── Türkiye ─────────────────────────────────────────────
  BIST100: {
    format: (v) => v.toLocaleString('tr-TR', { maximumFractionDigits: 2 }),
    accent: 'emerald',
    country: 'TR',
    shortLabel: 'İstanbul',
    window: { tz: 'Europe/Istanbul', open: [9, 55], close: [18, 30], weekendsClosed: true, city: 'İstanbul' },
  },

  // ─── Döviz ───────────────────────────────────────────────
  USDTRY: { format: (v) => `₺${v.toFixed(4)}`, accent: 'green', window: FX_WINDOW },
  EURTRY: { format: (v) => `₺${v.toFixed(4)}`, accent: 'sky', window: FX_WINDOW },
  GBPTRY: { format: (v) => `₺${v.toFixed(4)}`, accent: 'indigo', window: FX_WINDOW },

  // ─── Değerli metaller ────────────────────────────────────
  GOLDTRY_GR: { format: (v) => `₺${v.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`, accent: 'amber', window: FX_WINDOW },
  GOLDUSD_OZ: { format: (v) => `$${v.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`, accent: 'amber', window: FX_WINDOW },
  SILVERTRY_GR: { format: (v) => `₺${v.toFixed(3)}`, accent: 'slate', window: FX_WINDOW },
  SILVERUSD_OZ: { format: (v) => `$${v.toFixed(3)}`, accent: 'slate', window: FX_WINDOW },

  // ─── Global borsalar ─────────────────────────────────────
  NDX: {
    format: (v) => v.toLocaleString('tr-TR', { maximumFractionDigits: 2 }),
    accent: 'cyan', country: 'US', shortLabel: 'Nasdaq',
    window: { tz: 'America/New_York', open: [9, 30], close: [16, 20], weekendsClosed: true, city: 'New York' },
  },
  SPX: {
    format: (v) => v.toLocaleString('tr-TR', { maximumFractionDigits: 2 }),
    accent: 'blue', country: 'US', shortLabel: 'NYSE',
    window: { tz: 'America/New_York', open: [9, 30], close: [16, 20], weekendsClosed: true, city: 'New York' },
  },
  DJI: {
    format: (v) => v.toLocaleString('tr-TR', { maximumFractionDigits: 2 }),
    accent: 'blue', country: 'US', shortLabel: 'Dow',
    window: { tz: 'America/New_York', open: [9, 30], close: [16, 20], weekendsClosed: true, city: 'New York' },
  },
  FTSE: {
    format: (v) => v.toLocaleString('tr-TR', { maximumFractionDigits: 2 }),
    accent: 'rose', country: 'GB', shortLabel: 'Londra',
    window: { tz: 'Europe/London', open: [8, 0], close: [16, 50], weekendsClosed: true, city: 'London' },
  },
  DAX: {
    format: (v) => v.toLocaleString('tr-TR', { maximumFractionDigits: 2 }),
    accent: 'yellow', country: 'DE', shortLabel: 'Frankfurt',
    window: { tz: 'Europe/Berlin', open: [9, 0], close: [17, 50], weekendsClosed: true, city: 'Frankfurt' },
  },
  CAC: {
    format: (v) => v.toLocaleString('tr-TR', { maximumFractionDigits: 2 }),
    accent: 'indigo', country: 'FR', shortLabel: 'Paris',
    window: { tz: 'Europe/Paris', open: [9, 0], close: [17, 50], weekendsClosed: true, city: 'Paris' },
  },
  N225: {
    format: (v) => v.toLocaleString('tr-TR', { maximumFractionDigits: 2 }),
    accent: 'rose', country: 'JP', shortLabel: 'Tokyo',
    window: { tz: 'Asia/Tokyo', open: [9, 0], close: [15, 20], weekendsClosed: true, city: 'Tokyo' },
  },
  HSI: {
    format: (v) => v.toLocaleString('tr-TR', { maximumFractionDigits: 2 }),
    accent: 'red', country: 'HK', shortLabel: 'Hong Kong',
    window: { tz: 'Asia/Hong_Kong', open: [9, 30], close: [16, 20], weekendsClosed: true, city: 'Hong Kong' },
  },
  KOSPI: {
    format: (v) => v.toLocaleString('tr-TR', { maximumFractionDigits: 2 }),
    accent: 'cyan', country: 'KR', shortLabel: 'Seoul',
    window: { tz: 'Asia/Seoul', open: [9, 0], close: [15, 50], weekendsClosed: true, city: 'Seoul' },
  },
  NIFTY: {
    format: (v) => v.toLocaleString('tr-TR', { maximumFractionDigits: 2 }),
    accent: 'orange', country: 'IN', shortLabel: 'Mumbai',
    window: { tz: 'Asia/Kolkata', open: [9, 15], close: [15, 50], weekendsClosed: true, city: 'Mumbai' },
  },

  // ─── Kripto (7/24) ───────────────────────────────────────
  BTCUSD: { format: (v) => `$${v.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`, accent: 'orange', window: CRYPTO_WINDOW },
  ETHUSD: { format: (v) => `$${v.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`, accent: 'indigo', window: CRYPTO_WINDOW },
  BNBUSD: { format: (v) => `$${v.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`, accent: 'yellow', window: CRYPTO_WINDOW },
  SOLUSD: { format: (v) => `$${v.toFixed(2)}`, accent: 'purple', window: CRYPTO_WINDOW },
  XRPUSD: { format: (v) => `$${v.toFixed(4)}`, accent: 'slate', window: CRYPTO_WINDOW },
  DOGEUSD: { format: (v) => `$${v.toFixed(4)}`, accent: 'amber', window: CRYPTO_WINDOW },
  ADAUSD: { format: (v) => `$${v.toFixed(4)}`, accent: 'blue', window: CRYPTO_WINDOW },
  TRXUSD: { format: (v) => `$${v.toFixed(4)}`, accent: 'red', window: CRYPTO_WINDOW },
  AVAXUSD: { format: (v) => `$${v.toFixed(3)}`, accent: 'rose', window: CRYPTO_WINDOW },
  LINKUSD: { format: (v) => `$${v.toFixed(3)}`, accent: 'sky', window: CRYPTO_WINDOW },
};

/** Convert ISO country code (e.g. "TR") to flag emoji. */
export function countryFlag(iso: string | undefined): string {
  if (!iso || iso.length !== 2) return '';
  const A = 127397; // regional indicator base - 'A'
  return String.fromCodePoint(...iso.toUpperCase().split('').map((c) => c.charCodeAt(0) + A));
}

export function isSessionOpen(window: SessionWindow, now: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: window.tz,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const wd = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const day = dayMap[wd] ?? 1;
  if (window.weekendsClosed && (day === 0 || day === 6)) return false;
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const nowMin = hour * 60 + minute;
  const openMin = window.open[0] * 60 + window.open[1];
  const closeMin = window.close[0] * 60 + window.close[1];
  return nowMin >= openMin && nowMin < closeMin;
}
