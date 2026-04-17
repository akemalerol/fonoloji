import { dailyReturns, ensureSorted, type PricePoint, roundTo } from './returns.js';

const TRADING_DAYS_PER_YEAR = 252;

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function stdDev(values: number[], sample = true): number {
  if (values.length <= 1) return 0;
  const m = mean(values);
  const sum = values.reduce((acc, v) => acc + (v - m) ** 2, 0);
  return Math.sqrt(sum / (sample ? values.length - 1 : values.length));
}

export function annualizedVolatility(
  points: PricePoint[],
  windowDays: number,
): number | null {
  const sorted = ensureSorted(points);
  if (sorted.length < 2) return null;
  const window = sorted.slice(-windowDays - 1);
  const returns = dailyReturns(window);
  if (returns.length < 5) return null;
  const vol = stdDev(returns) * Math.sqrt(TRADING_DAYS_PER_YEAR);
  return roundTo(vol, 6);
}

export function sharpe(
  points: PricePoint[],
  windowDays: number,
  riskFreeAnnual = 0.45,
): number | null {
  const sorted = ensureSorted(points);
  if (sorted.length < 30) return null;
  const window = sorted.slice(-windowDays - 1);
  const returns = dailyReturns(window);
  if (returns.length < 10) return null;
  const rfDaily = riskFreeAnnual / TRADING_DAYS_PER_YEAR;
  const excess = returns.map((r) => r - rfDaily);
  const sd = stdDev(excess);
  if (sd === 0) return null;
  const s = (mean(excess) / sd) * Math.sqrt(TRADING_DAYS_PER_YEAR);
  return roundTo(s, 4);
}

export function maxDrawdown(points: PricePoint[]): number | null {
  const sorted = ensureSorted(points);
  if (sorted.length < 2) return null;
  let peak = sorted[0]!.price;
  let maxDd = 0;
  for (const p of sorted) {
    if (p.price > peak) peak = p.price;
    const dd = (p.price - peak) / peak;
    if (dd < maxDd) maxDd = dd;
  }
  return roundTo(maxDd, 6);
}

export function movingAverage(points: PricePoint[], days: number): number | null {
  const sorted = ensureSorted(points);
  const window = sorted.slice(-days);
  if (window.length < Math.min(days, 10)) return null;
  const avg = mean(window.map((p) => p.price));
  return roundTo(avg, 6);
}

/**
 * Sortino ratio — like Sharpe but only penalises downside volatility.
 * Higher = better. Especially useful for asymmetric strategies.
 */
export function sortino(
  points: PricePoint[],
  windowDays: number,
  riskFreeAnnual = 0.45,
): number | null {
  const sorted = ensureSorted(points);
  if (sorted.length < 30) return null;
  const window = sorted.slice(-windowDays - 1);
  const returns = dailyReturns(window);
  if (returns.length < 10) return null;
  const rfDaily = riskFreeAnnual / TRADING_DAYS_PER_YEAR;
  const excess = returns.map((r) => r - rfDaily);
  const downside = excess.filter((r) => r < 0);
  if (downside.length < 3) return null;
  const downsideStd = Math.sqrt(downside.reduce((a, r) => a + r * r, 0) / downside.length);
  if (downsideStd === 0) return null;
  const s = (mean(excess) / downsideStd) * Math.sqrt(TRADING_DAYS_PER_YEAR);
  return roundTo(s, 4);
}

/**
 * Calmar ratio — annualised return divided by max drawdown.
 * A measure of "return per unit of pain". Higher = better.
 */
export function calmar(points: PricePoint[], periodDays = 365): number | null {
  const sorted = ensureSorted(points);
  if (sorted.length < 30) return null;
  const window = sorted.slice(-periodDays);
  if (window.length < 30) return null;

  const first = window[0]!;
  const last = window[window.length - 1]!;
  if (first.price <= 0) return null;

  // Annualised return (simple compound)
  const totalReturn = last.price / first.price - 1;
  const years = window.length / 252;
  const annualised = years > 0 ? Math.pow(1 + totalReturn, 1 / years) - 1 : 0;

  // Max drawdown (negative number)
  let peak = window[0]!.price;
  let maxDd = 0;
  for (const p of window) {
    if (p.price > peak) peak = p.price;
    const dd = (p.price - peak) / peak;
    if (dd < maxDd) maxDd = dd;
  }
  if (maxDd >= 0) return null; // no drawdown ever, undefined Calmar
  return roundTo(annualised / Math.abs(maxDd), 4);
}

/**
 * Beta — sensitivity of fund returns to market returns.
 * beta = Cov(R_fund, R_market) / Var(R_market)
 * 1.0 = moves with market, >1 amplified, <1 dampened, <0 inverse.
 */
export function beta(
  fundPoints: PricePoint[],
  marketPoints: PricePoint[],
  windowDays = 365,
): number | null {
  const sortedFund = ensureSorted(fundPoints).slice(-windowDays);
  const sortedMarket = ensureSorted(marketPoints).slice(-windowDays);
  if (sortedFund.length < 30 || sortedMarket.length < 30) return null;

  // Align by date
  const marketMap = new Map<string, number>();
  sortedMarket.forEach((p) => marketMap.set(p.date, p.price));

  const fundReturns: number[] = [];
  const marketReturns: number[] = [];
  for (let i = 1; i < sortedFund.length; i++) {
    const fPrev = sortedFund[i - 1]!;
    const fCurr = sortedFund[i]!;
    const mPrev = marketMap.get(fPrev.date);
    const mCurr = marketMap.get(fCurr.date);
    if (mPrev === undefined || mCurr === undefined || mPrev === 0 || fPrev.price === 0) continue;
    fundReturns.push((fCurr.price - fPrev.price) / fPrev.price);
    marketReturns.push((mCurr - mPrev) / mPrev);
  }
  if (fundReturns.length < 30) return null;

  const mFund = mean(fundReturns);
  const mMarket = mean(marketReturns);
  let cov = 0;
  let varMarket = 0;
  for (let i = 0; i < fundReturns.length; i++) {
    cov += (fundReturns[i]! - mFund) * (marketReturns[i]! - mMarket);
    varMarket += (marketReturns[i]! - mMarket) ** 2;
  }
  if (varMarket === 0) return null;
  return roundTo(cov / varMarket, 4);
}
