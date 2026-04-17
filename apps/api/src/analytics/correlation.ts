import { dailyReturns, ensureSorted, type PricePoint, roundTo } from './returns.js';
import { mean, stdDev } from './risk.js';

export interface AlignedSeries {
  dates: string[];
  returnsA: number[];
  returnsB: number[];
}

export function alignReturns(a: PricePoint[], b: PricePoint[]): AlignedSeries {
  const sortedA = ensureSorted(a);
  const sortedB = ensureSorted(b);
  const mapB = new Map<string, number>();
  sortedB.forEach((p) => mapB.set(p.date, p.price));

  const commonPriceA: number[] = [];
  const commonPriceB: number[] = [];
  const dates: string[] = [];
  for (const p of sortedA) {
    const bPrice = mapB.get(p.date);
    if (bPrice !== undefined) {
      commonPriceA.push(p.price);
      commonPriceB.push(bPrice);
      dates.push(p.date);
    }
  }

  const returnsA: number[] = [];
  const returnsB: number[] = [];
  for (let i = 1; i < commonPriceA.length; i++) {
    const pa = commonPriceA[i - 1]!;
    const pb = commonPriceB[i - 1]!;
    if (pa > 0 && pb > 0) {
      returnsA.push((commonPriceA[i]! - pa) / pa);
      returnsB.push((commonPriceB[i]! - pb) / pb);
    }
  }

  return { dates: dates.slice(1, returnsA.length + 1), returnsA, returnsB };
}

export function pearsonCorrelation(a: number[], b: number[]): number | null {
  if (a.length !== b.length || a.length < 10) return null;
  const mA = mean(a);
  const mB = mean(b);
  let numerator = 0;
  for (let i = 0; i < a.length; i++) {
    numerator += (a[i]! - mA) * (b[i]! - mB);
  }
  const sdA = stdDev(a);
  const sdB = stdDev(b);
  if (sdA === 0 || sdB === 0) return null;
  const r = numerator / ((a.length - 1) * sdA * sdB);
  return roundTo(r, 4);
}

export function correlation(a: PricePoint[], b: PricePoint[]): number | null {
  const aligned = alignReturns(a, b);
  return pearsonCorrelation(aligned.returnsA, aligned.returnsB);
}

export function dailyReturnsOf(points: PricePoint[]): number[] {
  return dailyReturns(points);
}
