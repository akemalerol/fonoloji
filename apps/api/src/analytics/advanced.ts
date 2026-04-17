import type { Database } from 'better-sqlite3';

export interface StressPeriod {
  start: string;
  end: string;
  drawdown: number;
  days: number;
}

export interface SeasonalityCell {
  year: string;
  month: number;
  return: number;
}

// Historical stress periods — drawdowns > 5% from peak to trough
export function computeStressPeriods(
  prices: Array<{ date: string; price: number }>,
  minDrawdown = 0.05,
): StressPeriod[] {
  if (prices.length < 30) return [];
  const periods: StressPeriod[] = [];
  let peak = prices[0]!;
  let trough = peak;
  let inDraw = false;

  for (const p of prices) {
    if (p.price > peak.price) {
      if (inDraw) {
        const dd = (trough.price - peak.price) / peak.price;
        if (Math.abs(dd) >= minDrawdown) {
          const days = Math.round(
            (new Date(trough.date).getTime() - new Date(peak.date).getTime()) / 86_400_000,
          );
          periods.push({
            start: peak.date,
            end: trough.date,
            drawdown: Math.round(dd * 10_000) / 10_000,
            days,
          });
        }
      }
      peak = p;
      trough = p;
      inDraw = false;
    } else if (p.price < trough.price) {
      trough = p;
      inDraw = true;
    }
  }
  return periods.sort((a, b) => a.drawdown - b.drawdown).slice(0, 10);
}

// Monthly seasonality: year-month return grid for calendar heatmap
export function computeSeasonality(prices: Array<{ date: string; price: number }>): SeasonalityCell[] {
  if (prices.length < 60) return [];
  const monthlyClose = new Map<string, { date: string; price: number }>();
  for (const p of prices) {
    monthlyClose.set(p.date.slice(0, 7), p);
  }
  const sorted = [...monthlyClose.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const out: SeasonalityCell[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]![1];
    const curr = sorted[i]![1];
    if (prev.price > 0) {
      const ym = sorted[i]![0];
      const [year, monthStr] = ym.split('-');
      const month = Number(monthStr);
      out.push({
        year: year!,
        month,
        return: Math.round(((curr.price - prev.price) / prev.price) * 10_000) / 10_000,
      });
    }
  }
  return out;
}

// Category leakage: does the portfolio match the category label?
export interface LeakageReport {
  flagged: boolean;
  mainLabel: string;
  actualDominant: string;
  actualDominantPct: number;
  reason: string;
}

const CATEGORY_EXPECTATIONS: Array<{ match: RegExp; expect: 'stock' | 'bond' | 'cash' | 'gold' | 'mixed' }> = [
  { match: /hisse/i, expect: 'stock' },
  { match: /borçlanma/i, expect: 'bond' },
  { match: /para piyasası/i, expect: 'cash' },
  { match: /katılım/i, expect: 'cash' },
  { match: /altın|kıymetli maden/i, expect: 'gold' },
  { match: /eurobond/i, expect: 'bond' },
  { match: /değişken|karma|fon sepeti|serbest/i, expect: 'mixed' },
];

export function detectLeakage(
  category: string | null | undefined,
  portfolio: Record<string, number> | null,
): LeakageReport | null {
  if (!category || !portfolio) return null;
  const expect = CATEGORY_EXPECTATIONS.find((c) => c.match.test(category))?.expect;
  if (!expect || expect === 'mixed') return null;

  const buckets = {
    stock: portfolio.stock ?? 0,
    bond: (portfolio.government_bond ?? 0) + (portfolio.treasury_bill ?? 0) + (portfolio.corporate_bond ?? 0) + (portfolio.eurobond ?? 0),
    cash: portfolio.cash ?? 0,
    gold: portfolio.gold ?? 0,
  };
  const total = Object.values(buckets).reduce((a, b) => a + b, 0);
  if (total < 50) return null;

  const dominantEntry = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0]!;
  const dominant = dominantEntry[0] as keyof typeof buckets;
  const dominantPct = dominantEntry[1];

  const expectedPct = buckets[expect as keyof typeof buckets];
  const flagged = expect !== dominant && expectedPct < dominantPct - 15;

  if (!flagged) return null;

  return {
    flagged: true,
    mainLabel: expect,
    actualDominant: dominant,
    actualDominantPct: Math.round(dominantPct * 100) / 100,
    reason: `"${category}" olmasına rağmen portföyün %${Math.round(dominantPct)}'i ${dominant === 'stock' ? 'hisse' : dominant === 'bond' ? 'tahvil' : dominant === 'cash' ? 'nakit' : 'altın'} — beklentinin ötesinde.`,
  };
}

// Manager behavior score: from aggregate metrics across all funds of the company
export interface ManagerScore {
  score: number; // 0-100
  strengths: string[];
  weaknesses: string[];
  sampleSize: number;
}

export function computeManagerScore(db: Database, companyName: string): ManagerScore | null {
  const rows = db
    .prepare(
      `SELECT m.sharpe_90, m.return_1y, m.volatility_90, m.aum, m.return_ytd
       FROM funds f JOIN metrics m ON m.code = f.code
       WHERE f.management_company = ?`,
    )
    .all(companyName) as Array<{ sharpe_90: number | null; return_1y: number | null; volatility_90: number | null; aum: number | null; return_ytd: number | null }>;

  if (rows.length < 3) return null;

  const sharpes = rows.map((r) => r.sharpe_90).filter((v): v is number => v !== null);
  const returns1y = rows.map((r) => r.return_1y).filter((v): v is number => v !== null);
  const vols = rows.map((r) => r.volatility_90).filter((v): v is number => v !== null);

  const median = (arr: number[]) => {
    const s = [...arr].sort((a, b) => a - b);
    return s.length === 0 ? 0 : s[Math.floor(s.length / 2)]!;
  };
  const avg = (arr: number[]) => (arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length);

  const medSharpe = median(sharpes);
  const medReturn = median(returns1y);
  const medVol = median(vols);
  const avgAum = avg(rows.map((r) => r.aum ?? 0));

  // Scoring heuristic: 0-100
  let score = 50;
  score += Math.min(20, medSharpe * 15);            // +15 per unit sharpe, cap 20
  score += Math.min(15, medReturn * 30);            // +30% per 1.0 return, cap 15
  score += Math.min(10, Math.log10(Math.max(avgAum, 1)) - 7); // logarithmic size bonus
  score -= Math.min(10, medVol * 40);               // -40 per 25% vol, cap 10
  score = Math.max(0, Math.min(100, Math.round(score)));

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  if (medSharpe > 1) strengths.push('Yüksek risk-düzeltilmiş getiri (Sharpe medyanı >1)');
  if (medSharpe < 0) weaknesses.push('Sharpe negatif — risksiz faizin altında');
  if (medReturn > 0.3) strengths.push('Fonların çoğu güçlü 1Y getiriye sahip');
  if (medReturn < 0) weaknesses.push('1Y medyan getiri negatif');
  if (medVol > 0.2) weaknesses.push('Yüksek volatilite — riskli yönetim');
  if (avgAum > 5_000_000_000) strengths.push('Büyük ölçekli AUM — kurumsal güven');
  if (rows.length > 30) strengths.push(`Geniş ürün yelpazesi (${rows.length} fon)`);

  return { score, strengths, weaknesses, sampleSize: rows.length };
}

// Bench-alpha: how this fund's return compares to its category median
export interface BenchAlpha {
  period: '1m' | '3m' | '1y';
  fundReturn: number;
  categoryMedian: number;
  alpha: number;
  percentile: number;
  sampleSize: number;
}

export function computeBenchAlpha(
  db: Database,
  code: string,
  category: string,
  period: '1m' | '3m' | '1y' = '1y',
): BenchAlpha | null {
  const col = { '1m': 'return_1m', '3m': 'return_3m', '1y': 'return_1y' }[period];
  const rows = db
    .prepare(
      `SELECT m.code, m.${col} as r FROM metrics m
       JOIN funds f ON f.code = m.code
       WHERE f.category = ? AND m.${col} IS NOT NULL`,
    )
    .all(category) as Array<{ code: string; r: number }>;

  if (rows.length < 3) return null;

  const self = rows.find((r) => r.code === code);
  if (!self) return null;

  const sorted = [...rows].sort((a, b) => a.r - b.r);
  const median = sorted[Math.floor(sorted.length / 2)]!.r;
  const rank = sorted.findIndex((r) => r.code === code);
  const percentile = Math.round((rank / (sorted.length - 1)) * 100);

  return {
    period,
    fundReturn: self.r,
    categoryMedian: median,
    alpha: Math.round((self.r - median) * 10_000) / 10_000,
    percentile,
    sampleSize: rows.length,
  };
}
