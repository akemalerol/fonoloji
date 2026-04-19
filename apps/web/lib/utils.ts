import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const currencyFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('tr-TR', {
  maximumFractionDigits: 0,
});

const trNum = (v: number, maxFrac = 1): string =>
  v.toLocaleString('tr-TR', { maximumFractionDigits: maxFrac });

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return currencyFormatter.format(value);
}

/**
 * Türkçe finans birimleri — tam isimleri yazar (kısaltma değil).
 * Örnek: 1.500 → "1,5 bin", 1.500.000 → "1,5 milyon",
 *        1.500.000.000 → "1,5 milyar", 1.500.000.000.000 → "1,5 trilyon".
 */
export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}${trNum(abs / 1e12)} trilyon`;
  if (abs >= 1e9) return `${sign}${trNum(abs / 1e9)} milyar`;
  if (abs >= 1e6) return `${sign}${trNum(abs / 1e6)} milyon`;
  if (abs >= 1e3) return `${sign}${trNum(abs / 1e3)} bin`;
  return `${sign}${trNum(abs, 0)}`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return numberFormatter.format(value);
}

export function formatPrice(value: number | null | undefined, digits = 6): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatPercent(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(digits)}%`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

export function colorForChange(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'text-muted-foreground';
  if (value > 0) return 'text-gain';
  if (value < 0) return 'text-loss';
  return 'text-muted-foreground';
}

export function bgForChange(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'bg-muted';
  if (value > 0) return 'bg-gain/10';
  if (value < 0) return 'bg-loss/10';
  return 'bg-muted';
}

const FUND_TYPE_LABELS: Record<string, string> = {
  YAT: 'Yatırım Fonu',
  EMK: 'Emeklilik Fonu (BES)',
  BYF: 'Borsa Yatırım Fonu (ETF)',
};

const FUND_TYPE_SHORT: Record<string, string> = {
  YAT: 'Yatırım',
  EMK: 'Emeklilik',
  BYF: 'ETF',
};

export function fundTypeLabel(code: string | null | undefined): string {
  if (!code) return '—';
  return FUND_TYPE_LABELS[code] ?? code;
}

export function fundTypeShort(code: string | null | undefined): string {
  if (!code) return '—';
  return FUND_TYPE_SHORT[code] ?? code;
}
