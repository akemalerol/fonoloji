export interface DateWindow {
  start: string;
  end: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function splitDateRange(start: string, end: string, maxDays = 90): DateWindow[] {
  if (!DATE_RE.test(start) || !DATE_RE.test(end)) {
    throw new Error(`Invalid date format; expected YYYY-MM-DD (got "${start}", "${end}")`);
  }
  if (maxDays <= 0) {
    throw new Error(`maxDays must be positive (got ${maxDays})`);
  }

  const startMs = parseIsoDateToUtc(start);
  const endMs = parseIsoDateToUtc(end);
  if (startMs > endMs) return [];

  const dayMs = 86_400_000;
  const windows: DateWindow[] = [];
  let cursor = startMs;

  while (cursor <= endMs) {
    const windowEnd = Math.min(cursor + (maxDays - 1) * dayMs, endMs);
    windows.push({
      start: toIsoDate(cursor),
      end: toIsoDate(windowEnd),
    });
    cursor = windowEnd + dayMs;
  }

  return windows;
}

export function toDdMmYyyy(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function today(): string {
  return toIsoDate(Date.now());
}

function parseIsoDateToUtc(iso: string): number {
  const parts = iso.split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  return Date.UTC(year, month - 1, day);
}

function toIsoDate(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear().toString().padStart(4, '0');
  const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = d.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}
