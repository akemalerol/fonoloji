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

const compactFormatter = new Intl.NumberFormat('tr-TR', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const numberFormatter = new Intl.NumberFormat('tr-TR', {
  maximumFractionDigits: 0,
});

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return currencyFormatter.format(value);
}

export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return compactFormatter.format(value).replace('Mn', 'M').replace('B', 'Mr').replace('Mr', 'Mrd');
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
