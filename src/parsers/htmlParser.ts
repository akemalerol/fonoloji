import * as cheerio from 'cheerio';
import type { FundPriceRow } from '../types/tefasResponse.js';

export function extractHiddenField(html: string, fieldName: string): string {
  if (!html) return '';
  const $ = cheerio.load(html);
  const value = $(`input#${escapeSelector(fieldName)}`).attr('value');
  if (typeof value === 'string') return value;
  const byName = $(`input[name="${fieldName}"]`).attr('value');
  return typeof byName === 'string' ? byName : '';
}

export function parseHistoricalTable(html: string): FundPriceRow[] {
  if (!html) return [];
  const $ = cheerio.load(html);
  const rows: FundPriceRow[] = [];

  $('#MainContent_GridViewFonlar tr').each((_index, el) => {
    const cells = $(el).find('td');
    if (cells.length < 7) return;

    const dateRaw = $(cells[0]).text().trim();
    const fundCode = $(cells[1]).text().trim();
    const fundName = $(cells[2]).text().trim();
    if (!dateRaw || !fundCode) return;

    rows.push({
      date: normalizeDate(dateRaw),
      fundCode,
      fundName,
      price: parseTurkishNumber($(cells[3]).text()),
      sharesOutstanding: parseTurkishNumber($(cells[4]).text()),
      investorCount: Math.trunc(parseTurkishNumber($(cells[5]).text())),
      totalValue: parseTurkishNumber($(cells[6]).text()),
    });
  });

  return rows;
}

export function normalizeDate(ddmmyyyy: string): string {
  const trimmed = ddmmyyyy.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 3) return trimmed;
  const [d, m, y] = parts;
  if (!d || !m || !y) return trimmed;
  return `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

export function parseTurkishNumber(raw: string): number {
  if (raw === undefined || raw === null) return 0;
  const s = String(raw).trim();
  if (!s) return 0;
  const normalized = s.replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function escapeSelector(value: string): string {
  return value.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}
