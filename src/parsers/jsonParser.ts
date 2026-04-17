import type { FundPriceRow } from '../types/tefasResponse.js';

interface HistoryApiRow {
  TARIH?: string | number;
  FONKODU?: string;
  FONUNVAN?: string;
  FIYAT?: number | string;
  TEDPAYSAYISI?: number | string;
  KISISAYISI?: number | string;
  PORTFOYBUYUKLUK?: number | string;
  PORTFOYBUYUKLUGU?: number | string;
}

interface HistoryApiResponse {
  data?: HistoryApiRow[];
  recordsTotal?: number;
  recordsFiltered?: number;
}

export function parseHistoryApiResponse(body: string): FundPriceRow[] {
  if (!body) return [];
  let payload: HistoryApiResponse;
  try {
    payload = JSON.parse(body) as HistoryApiResponse;
  } catch {
    return [];
  }
  const rows = payload.data ?? [];
  const out: FundPriceRow[] = [];

  for (const row of rows) {
    const date = normalizeApiDate(row.TARIH);
    const fundCode = typeof row.FONKODU === 'string' ? row.FONKODU.trim() : '';
    if (!date || !fundCode) continue;

    out.push({
      date,
      fundCode,
      fundName: typeof row.FONUNVAN === 'string' ? row.FONUNVAN.trim() : '',
      price: toNumber(row.FIYAT),
      sharesOutstanding: toNumber(row.TEDPAYSAYISI),
      investorCount: Math.trunc(toNumber(row.KISISAYISI)),
      totalValue: toNumber(row.PORTFOYBUYUKLUK ?? row.PORTFOYBUYUKLUGU),
    });
  }

  return out;
}

function normalizeApiDate(raw: string | number | undefined): string | null {
  if (raw === undefined || raw === null) return null;

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return msToIso(raw);
  }

  const s = String(raw).trim();
  if (!s) return null;

  const aspNetMatch = /\/Date\((-?\d+)(?:[+-]\d+)?\)\//.exec(s);
  if (aspNetMatch) return msToIso(Number(aspNetMatch[1]));

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const ddmm = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(s);
  if (ddmm) {
    const [, d, m, y] = ddmm;
    return `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
  }

  const numeric = Number(s);
  if (Number.isFinite(numeric) && numeric > 1_000_000_000_000) {
    return msToIso(numeric);
  }

  return null;
}

function toNumber(raw: string | number | undefined): number {
  if (raw === undefined || raw === null) return 0;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  const s = String(raw).trim();
  if (!s) return 0;
  const n = Number(s);
  if (Number.isFinite(n)) return n;
  // Fallback for Turkish formatting
  const tr = Number(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(tr) ? tr : 0;
}

function msToIso(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear().toString().padStart(4, '0');
  const mo = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = d.getUTCDate().toString().padStart(2, '0');
  return `${y}-${mo}-${day}`;
}
