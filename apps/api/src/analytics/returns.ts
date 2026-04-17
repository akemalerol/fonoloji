export interface PricePoint {
  date: string;
  price: number;
}

const DAY_MS = 86_400_000;

function isoToUtcMs(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y as number, (m as number) - 1, d as number);
}

function findOnOrBefore(points: PricePoint[], targetMs: number): PricePoint | null {
  let best: PricePoint | null = null;
  for (const p of points) {
    const pms = isoToUtcMs(p.date);
    if (pms <= targetMs) best = p;
    else break;
  }
  return best;
}

function findOnOrAfter(points: PricePoint[], targetMs: number): PricePoint | null {
  for (const p of points) {
    const pms = isoToUtcMs(p.date);
    if (pms >= targetMs) return p;
  }
  return null;
}

export function computeReturn(from: number, to: number): number | null {
  if (!Number.isFinite(from) || from <= 0 || !Number.isFinite(to)) return null;
  return roundTo((to - from) / from, 6);
}

export function returnOverDays(points: PricePoint[], days: number): number | null {
  if (points.length === 0) return null;
  const sorted = ensureSorted(points);
  const latest = sorted[sorted.length - 1]!;
  const targetMs = isoToUtcMs(latest.date) - days * DAY_MS;
  const baseline = findOnOrBefore(sorted, targetMs);
  if (!baseline) return null;
  return computeReturn(baseline.price, latest.price);
}

export function returnYtd(points: PricePoint[]): number | null {
  if (points.length === 0) return null;
  const sorted = ensureSorted(points);
  const latest = sorted[sorted.length - 1]!;
  const year = new Date(isoToUtcMs(latest.date)).getUTCFullYear();
  const ytdStart = Date.UTC(year, 0, 1);
  const baseline = findOnOrAfter(sorted, ytdStart);
  if (!baseline) return null;
  return computeReturn(baseline.price, latest.price);
}

export function returnAll(points: PricePoint[]): number | null {
  if (points.length < 2) return null;
  const sorted = ensureSorted(points);
  return computeReturn(sorted[0]!.price, sorted[sorted.length - 1]!.price);
}

export function dailyReturns(points: PricePoint[]): number[] {
  const sorted = ensureSorted(points);
  const out: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!.price;
    const curr = sorted[i]!.price;
    if (prev > 0) out.push((curr - prev) / prev);
  }
  return out;
}

export function ensureSorted(points: PricePoint[]): PricePoint[] {
  if (points.length <= 1) return points;
  const first = points[0]!.date;
  const last = points[points.length - 1]!.date;
  if (first <= last) return points;
  return [...points].sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function roundTo(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
