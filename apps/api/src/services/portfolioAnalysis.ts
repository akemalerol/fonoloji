/**
 * Portföy X-Ray + Fon DNA overlap analizi.
 *
 * KAP holdings verisini kullanarak:
 *   1. Portfolio X-Ray: bir fon sepetinin underlying hisse exposure'ını aggregate eder
 *   2. Fund Overlap: iki fon arasındaki holdings benzerliğini (%) hesaplar
 */

import type { Database } from 'better-sqlite3';

export interface FundInput {
  code: string;
  weight: number; // 0-1
}

interface HoldingRow {
  asset_name: string;
  asset_code: string | null;
  asset_type: string;
  weight: number;
  report_date: string;
}

interface XrayExposure {
  asset_name: string;
  asset_code: string | null;
  asset_type: string;
  total_weight: number;   // portföyün yüzde kaçı bu varlığa
  contributions: Array<{ fund_code: string; weight: number }>;
}

export interface PortfolioXray {
  totalStockPct: number;
  totalBondPct: number;
  totalCashPct: number;
  totalGoldPct: number;
  totalOtherPct: number;
  fundCount: number;
  coveragePct: number; // holdings'i bilinen portföy ağırlığı
  exposures: XrayExposure[];
  concentration: Array<{ asset_name: string; weight: number; note: string }>;
  warnings: string[];
}

function getLatestHoldings(db: Database, code: string): HoldingRow[] {
  const latest = db
    .prepare(`SELECT MAX(report_date) as d FROM fund_holdings WHERE code = ?`)
    .get(code) as { d: string | null } | undefined;
  if (!latest?.d) return [];
  return db
    .prepare(
      `SELECT asset_name, asset_code, asset_type, weight, report_date
       FROM fund_holdings WHERE code = ? AND report_date = ?`,
    )
    .all(code, latest.d) as HoldingRow[];
}

export function analyzePortfolio(db: Database, funds: FundInput[]): PortfolioXray {
  const normalized = funds
    .filter((f) => f.weight > 0)
    .map((f) => ({ code: f.code.toUpperCase(), weight: f.weight }));

  const totalInputWeight = normalized.reduce((s, f) => s + f.weight, 0);
  // Normalize weights to sum = 1
  const withNormal = normalized.map((f) => ({ code: f.code, weight: f.weight / totalInputWeight }));

  const exposureMap = new Map<string, XrayExposure>();
  const typeTotals: Record<string, number> = { stock: 0, bond: 0, cash: 0, gold: 0, other: 0 };
  let coveredWeight = 0; // holdings'i bulunan fonların toplam ağırlığı
  const warnings: string[] = [];

  for (const { code, weight: fundWeight } of withNormal) {
    const holdings = getLatestHoldings(db, code);
    if (holdings.length === 0) {
      warnings.push(`${code}: KAP portföy verisi yok`);
      continue;
    }
    coveredWeight += fundWeight;

    for (const h of holdings) {
      const contribution = (h.weight / 100) * fundWeight; // fon ağırlığı × varlık ağırlığı
      // Varlık tipine göre toplam bucket
      const bucket = mapToBucket(h.asset_type);
      typeTotals[bucket] = (typeTotals[bucket] ?? 0) + contribution;

      // Varlık bazında aggregation
      const key = h.asset_code || h.asset_name;
      const existing = exposureMap.get(key);
      if (existing) {
        existing.total_weight += contribution;
        existing.contributions.push({ fund_code: code, weight: contribution });
      } else {
        exposureMap.set(key, {
          asset_name: h.asset_name,
          asset_code: h.asset_code,
          asset_type: h.asset_type,
          total_weight: contribution,
          contributions: [{ fund_code: code, weight: contribution }],
        });
      }
    }
  }

  const exposures = [...exposureMap.values()]
    .map((e) => ({
      ...e,
      total_weight: Math.round(e.total_weight * 10000) / 100, // convert to %
      contributions: e.contributions
        .map((c) => ({ ...c, weight: Math.round(c.weight * 10000) / 100 }))
        .sort((a, b) => b.weight - a.weight),
    }))
    .sort((a, b) => b.total_weight - a.total_weight);

  // Konsantrasyon analizi — tek varlıkta > %10 exposure uyarı
  const concentration: Array<{ asset_name: string; weight: number; note: string }> = [];
  for (const e of exposures) {
    if (e.total_weight >= 10 && e.asset_type === 'stock') {
      concentration.push({
        asset_name: e.asset_name,
        weight: e.total_weight,
        note: `Portföyünün %${e.total_weight.toFixed(1)}'i tek hissede — konsantrasyon riski`,
      });
    }
  }

  // Coverage bilgisi
  const coveragePct = Math.round(coveredWeight * 10000) / 100;
  if (coveragePct < 50) {
    warnings.push(`Analiz kapsamı düşük — portföyünün sadece %${coveragePct}'ine KAP verisi var`);
  }

  return {
    totalStockPct: Math.round((typeTotals.stock ?? 0) * 10000) / 100,
    totalBondPct: Math.round(((typeTotals.bond ?? 0)) * 10000) / 100,
    totalCashPct: Math.round((typeTotals.cash ?? 0) * 10000) / 100,
    totalGoldPct: Math.round((typeTotals.gold ?? 0) * 10000) / 100,
    totalOtherPct: Math.round((typeTotals.other ?? 0) * 10000) / 100,
    fundCount: withNormal.length,
    coveragePct,
    exposures: exposures.slice(0, 50),
    concentration,
    warnings,
  };
}

function mapToBucket(assetType: string): 'stock' | 'bond' | 'cash' | 'gold' | 'other' {
  if (assetType === 'stock') return 'stock';
  if (['government_bond', 'treasury_bill', 'corporate_bond', 'eurobond'].includes(assetType)) return 'bond';
  if (['cash', 'repo'].includes(assetType)) return 'cash';
  if (assetType === 'gold') return 'gold';
  return 'other';
}

export interface FundOverlap {
  codeA: string;
  codeB: string;
  overlapPct: number;          // Jaccard-like: min(weight_a, weight_b) sum
  bothPct: number;             // iki fonda da bulunan varlıkların A'daki toplam ağırlığı
  onlyAPct: number;
  onlyBPct: number;
  reportDateA: string | null;
  reportDateB: string | null;
  commonHoldings: Array<{ asset_name: string; asset_code: string | null; weight_a: number; weight_b: number; min: number }>;
  uniqueToA: Array<{ asset_name: string; weight: number }>;
  uniqueToB: Array<{ asset_name: string; weight: number }>;
}

export function computeFundOverlap(db: Database, codeA: string, codeB: string): FundOverlap | null {
  const a = getLatestHoldings(db, codeA);
  const b = getLatestHoldings(db, codeB);
  if (a.length === 0 || b.length === 0) return null;

  const mapB = new Map<string, HoldingRow>();
  for (const h of b) {
    const key = h.asset_code || h.asset_name;
    mapB.set(key, h);
  }

  const common: FundOverlap['commonHoldings'] = [];
  const uniqueA: FundOverlap['uniqueToA'] = [];
  let bothSumOfMin = 0;   // Σ min(w_a, w_b)
  let bothA = 0;
  let onlyA = 0;

  for (const h of a) {
    const key = h.asset_code || h.asset_name;
    const other = mapB.get(key);
    if (other) {
      const min = Math.min(h.weight, other.weight);
      common.push({
        asset_name: h.asset_name,
        asset_code: h.asset_code,
        weight_a: h.weight,
        weight_b: other.weight,
        min,
      });
      bothSumOfMin += min;
      bothA += h.weight;
    } else {
      uniqueA.push({ asset_name: h.asset_name, weight: h.weight });
      onlyA += h.weight;
    }
  }

  const aKeys = new Set(a.map((h) => h.asset_code || h.asset_name));
  const uniqueB: FundOverlap['uniqueToB'] = [];
  let onlyB = 0;
  for (const h of b) {
    const key = h.asset_code || h.asset_name;
    if (!aKeys.has(key)) {
      uniqueB.push({ asset_name: h.asset_name, weight: h.weight });
      onlyB += h.weight;
    }
  }

  common.sort((x, y) => y.min - x.min);
  uniqueA.sort((x, y) => y.weight - x.weight);
  uniqueB.sort((x, y) => y.weight - x.weight);

  return {
    codeA,
    codeB,
    overlapPct: Math.round(bothSumOfMin * 100) / 100,
    bothPct: Math.round(bothA * 100) / 100,
    onlyAPct: Math.round(onlyA * 100) / 100,
    onlyBPct: Math.round(onlyB * 100) / 100,
    reportDateA: a[0]?.report_date ?? null,
    reportDateB: b[0]?.report_date ?? null,
    commonHoldings: common.slice(0, 30),
    uniqueToA: uniqueA.slice(0, 20),
    uniqueToB: uniqueB.slice(0, 20),
  };
}
