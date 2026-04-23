const API_BASE =
  typeof window === 'undefined'
    ? (process.env.FONOLOJI_API_URL ?? 'http://localhost:4000')
    : '';

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    throw new Error(`API ${path} → ${res.status}`);
  }
  return (await res.json()) as T;
}

export interface FundRow {
  code: string;
  name: string;
  type?: string;
  category?: string;
  management_company?: string;
  isin?: string;
  risk_score?: number;
  kap_url?: string;
  trading_status?: string;
  trading_start?: string;
  trading_end?: string;
  buy_valor?: number;
  sell_valor?: number;
  current_price?: number;
  current_date?: string;
  return_1d?: number;
  return_1w?: number;
  return_1m?: number;
  return_3m?: number;
  return_6m?: number;
  return_1y?: number;
  return_ytd?: number;
  return_all?: number;
  volatility_30?: number;
  volatility_90?: number;
  sharpe_90?: number;
  max_drawdown_1y?: number;
  ma_30?: number;
  ma_90?: number;
  ma_200?: number;
  aum?: number;
  investor_count?: number;
  flow_1w?: number;
  flow_1m?: number;
  flow_3m?: number;
  sortino_90?: number;
  calmar_1y?: number;
  beta_1y?: number;
  real_return_1y?: number;
  // Latest portfolio snapshot — surfaced from JOIN in list/detail endpoints
  stock?: number;
  government_bond?: number;
  treasury_bill?: number;
  corporate_bond?: number;
  eurobond?: number;
  gold?: number;
  cash?: number;
  other?: number;
  portfolio_date?: string;
}

export interface MonthlyReturn {
  month: string;
  return: number;
}

export interface DrawdownPoint {
  date: string;
  drawdown: number;
  peak?: number;
}

export interface FundDetail {
  fund: FundRow & { first_seen?: string; last_seen?: string };
  portfolio?: {
    stock: number;
    government_bond: number;
    treasury_bill: number;
    corporate_bond: number;
    eurobond: number;
    gold: number;
    cash: number;
    other: number;
  };
}

export interface PricePoint {
  date: string;
  price: number;
  total_value?: number | null;
  investor_count?: number | null;
}

export interface Mover {
  code: string;
  name: string;
  category?: string;
  change: number;
  aum: number;
}

export interface FlowItem {
  code: string;
  name: string;
  category?: string;
  flow: number;
  aum: number;
  investor_count: number;
}

export interface CategoryStat {
  category: string;
  period: string;
  fund_count: number;
  total_aum: number;
  avg_return: number;
  median_return: number;
  top_fund_code: string;
  top_fund_return: number;
}

export const api = {
  listFunds: (params: Record<string, string | number | undefined | null> = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') qs.set(k, String(v));
    }
    return fetchJson<{ items: FundRow[] }>(`/api/funds?${qs.toString()}`);
  },
  getFund: (code: string) => fetchJson<FundDetail>(`/api/funds/${encodeURIComponent(code)}`),
  getHistory: (code: string, period = '1y') =>
    fetchJson<{ code: string; period: string; points: PricePoint[] }>(
      `/api/funds/${encodeURIComponent(code)}/history?period=${period}`,
    ),
  getMonthly: (code: string) =>
    fetchJson<{ code: string; months: MonthlyReturn[] }>(
      `/api/funds/${encodeURIComponent(code)}/monthly-returns`,
    ),
  getDrawdown: (code: string) =>
    fetchJson<{ code: string; points: DrawdownPoint[] }>(
      `/api/funds/${encodeURIComponent(code)}/drawdown`,
    ),
  getPortfolioTimeline: (code: string, days = 180) =>
    fetchJson<{
      code: string;
      points: Array<{
        date: string;
        stock: number;
        government_bond: number;
        treasury_bill: number;
        corporate_bond: number;
        eurobond: number;
        gold: number;
        cash: number;
        other: number;
      }>;
    }>(`/api/funds/${encodeURIComponent(code)}/portfolio-timeline?days=${days}`),
  cpi: () =>
    fetchJson<{
      latest: { date: string; yoy_change: number; mom_change: number | null; index_value: number | null; source: string } | null;
      history: Array<{ date: string; yoy_change: number; mom_change: number | null }>;
      next: { period: string; scheduled_date: string; scheduled_time: string } | null;
    }>(`/api/economy/cpi`),
  advanced: (code: string) =>
    fetchJson<{
      code: string;
      stress_periods: Array<{ start: string; end: string; drawdown: number; days: number }>;
      seasonality: Array<{ year: string; month: number; return: number }>;
      leakage: { flagged: boolean; mainLabel: string; actualDominant: string; actualDominantPct: number; reason: string } | null;
      bench_alpha: {
        '3m': { period: string; fundReturn: number; categoryMedian: number; alpha: number; percentile: number; sampleSize: number } | null;
        '1y': { period: string; fundReturn: number; categoryMedian: number; alpha: number; percentile: number; sampleSize: number } | null;
      };
    }>(`/api/funds/${encodeURIComponent(code)}/advanced`),
  aiSummary: (code: string) =>
    fetchJson<{ code: string; summary: string | null; cached: boolean; model?: string }>(
      `/api/funds/${encodeURIComponent(code)}/ai-summary`,
    ),
  managerScore: (name: string) =>
    fetchJson<{ score: number; strengths: string[]; weaknesses: string[]; sampleSize: number } | { score: null }>(
      `/api/management-companies/${encodeURIComponent(name)}/score`,
    ),
  liveMarket: () =>
    fetchJson<{
      items: Array<{
        symbol: string;
        name: string;
        value: number;
        change_pct: number | null;
        previous: number | null;
        source: string;
        fetched_at: number;
      }>;
      updated_at: number | null;
    }>(`/api/market/live`),
  marketDigest: (period: 'day' | 'week' = 'day') =>
    fetchJson<{
      period: string;
      summary: string | null;
      cached: boolean;
      topGainers: Array<{ code: string; name: string; change: number }>;
      topLosers: Array<{ code: string; name: string; change: number }>;
    }>(`/api/market/digest?period=${period}`),
  fundChanges: () =>
    fetchJson<{
      items: Array<{
        id: number;
        code: string;
        name: string;
        field: string;
        old_value: string | null;
        new_value: string | null;
        detected_at: number;
      }>;
    }>(`/api/fund-changes`),
  search: (q: string) => fetchJson<{ items: FundRow[] }>(`/api/search?q=${encodeURIComponent(q)}`),
  summaryToday: () =>
    fetchJson<{
      date: string;
      topGainers: Array<{ code: string; name: string; return_1d: number }>;
      topLosers: Array<{ code: string; name: string; return_1d: number }>;
      totalFunds: number;
      totalAum: number;
      totalInvestors: number;
    }>(`/api/summary/today`),
  movers: (period = '1d', limit = 10) =>
    fetchJson<{ period: string; gainers: Mover[]; losers: Mover[] }>(
      `/api/insights/movers?period=${period}&limit=${limit}`,
    ),
  flow: (period = '1m', limit = 20) =>
    fetchJson<{ period: string; inflow: FlowItem[]; outflow: FlowItem[] }>(
      `/api/insights/flow?period=${period}&limit=${limit}`,
    ),
  riskReturn: () =>
    fetchJson<{
      items: Array<{
        code: string;
        name: string;
        category: string;
        return_1y: number;
        volatility_90: number;
        aum: number;
      }>;
    }>(`/api/insights/risk-return`),
  heatmap: (code: string) =>
    fetchJson<{ code: string; cells: Array<{ date: string; return: number }> }>(
      `/api/insights/heatmap/${encodeURIComponent(code)}`,
    ),
  correlation: (codes: string[]) =>
    fetchJson<{
      codes: string[];
      matrix: Array<{ a: string; b: string; r: number | null }>;
    }>(`/api/insights/correlation?codes=${codes.map(encodeURIComponent).join(',')}`),
  trend: () =>
    fetchJson<{
      rising: Array<{ code: string; name: string; category: string; return_1m: number }>;
      falling: Array<{ code: string; name: string; category: string; return_1m: number }>;
    }>(`/api/insights/trend`),
  categories: () => fetchJson<{ items: CategoryStat[] }>(`/api/categories`),
  category: (name: string) =>
    fetchJson<{
      category: string;
      stats: CategoryStat[];
      funds: FundRow[];
    }>(`/api/categories/${encodeURIComponent(name)}`),
  managementCompanies: () =>
    fetchJson<{
      items: Array<{
        name: string;
        fund_count: number;
        total_aum: number;
        total_investors: number;
        avg_return_1y: number;
        avg_sharpe: number | null;
      }>;
    }>(`/api/management-companies`),
  exposureHeatmap: () =>
    fetchJson<{
      items: Array<{
        category: string;
        fund_count: number;
        stock: number;
        govbond: number;
        corpbond: number;
        eurobond: number;
        cash: number;
        gold: number;
        other: number;
        total_aum: number | null;
      }>;
    }>(`/api/insights/exposure-heatmap`),
  portfolioXray: (funds: Array<{ code: string; weight: number }>) =>
    fetch('/api/tools/portfolio-xray', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ funds }),
    }).then((r) => r.json()) as Promise<{
      totalStockPct: number;
      totalBondPct: number;
      totalCashPct: number;
      totalGoldPct: number;
      totalOtherPct: number;
      fundCount: number;
      coveragePct: number;
      exposures: Array<{
        asset_name: string;
        asset_code: string | null;
        asset_type: string;
        total_weight: number;
        contributions: Array<{ fund_code: string; weight: number }>;
      }>;
      concentration: Array<{ asset_name: string; weight: number; note: string }>;
      warnings: string[];
    }>,
  fundOverlap: (a: string, b: string) =>
    fetchJson<{
      codeA: string;
      codeB: string;
      overlapPct: number;
      bothPct: number;
      onlyAPct: number;
      onlyBPct: number;
      reportDateA: string | null;
      reportDateB: string | null;
      commonHoldings: Array<{ asset_name: string; asset_code: string | null; weight_a: number; weight_b: number; min: number }>;
      uniqueToA: Array<{ asset_name: string; weight: number }>;
      uniqueToB: Array<{ asset_name: string; weight: number }>;
    }>(`/api/tools/fund-overlap?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`),
  percentile: (code: string) =>
    fetchJson<{
      code: string;
      category: string;
      categorySize: number;
      metrics: Record<string, { rank: number; total: number; percentile: number; value: number | null } | null>;
    }>(`/api/funds/${encodeURIComponent(code)}/percentile`),
  trendingKap: (days = 7, limit = 30) =>
    fetchJson<{
      period_days: number;
      items: Array<{
        fund_code: string;
        name: string | null;
        category: string | null;
        bildirim_sayisi: number;
        son_bildirim: number;
        subjects: string;
      }>;
    }>(`/api/kap/trending-funds?days=${days}&limit=${limit}`),
  disclosures: (code: string, limit = 20) =>
    fetchJson<{
      code: string;
      items: Array<{
        disclosure_index: number;
        subject: string | null;
        kap_title: string | null;
        rule_type: string | null;
        period: number | null;
        year: number | null;
        publish_date: number;
        attachment_count: number;
        summary: string | null;
      }>;
      backfillTriggered?: boolean;
    }>(`/api/funds/${encodeURIComponent(code)}/disclosures?limit=${limit}`),
  holdings: (code: string) =>
    fetchJson<{
      code: string;
      holdings: Array<{
        asset_name: string;
        asset_code: string | null;
        asset_type: string;
        weight: number;
        market_value: number | null;
        report_date: string;
      }>;
    }>(`/api/funds/${encodeURIComponent(code)}/holdings`),
  liveEstimate: (code: string) =>
    fetchJson<{
      code: string;
      estimate: {
        estimated_change_pct: number;
        confidence: number;
        holdings_date: string;
        stock_coverage_pct: number;
        components: Array<{
          ticker: string;
          weight: number;
          change_pct: number | null;
          contribution: number;
        }>;
        non_stock_pct: number;
        updated_at: number;
      } | null;
      reason?: string;
    }>(`/api/funds/${encodeURIComponent(code)}/live-estimate`),

  analystConsensus: (code: string) =>
    fetchJson<{
      reportDate: string | null;
      stocksAsOfDate: string | null;
      brokers: string[];
      totalWeight: number;
      coveredWeight: number;
      coverage: number;
      weightedPotential: number | null;
      recCount: Record<string, number>;
      items: Array<{
        ticker: string;
        name: string | null;
        weight: number;
        closePrice: number | null;
        targetPrice: number | null;
        potentialPct: number | null;
        peRatio: number | null;
        recommendation: string | null;
        primaryBroker: string | null;
        brokers: Array<{
          broker: string;
          targetPrice: number | null;
          potentialPct: number | null;
          recommendation: string | null;
          entryDate: string | null;
          reportTitle: string | null;
          reportUrl: string | null;
          asOfDate: string;
        }>;
        brokerCount: number;
        targetRange: { min: number | null; max: number | null; avg: number | null } | null;
      }>;
    }>(`/api/funds/${encodeURIComponent(code)}/analyst-consensus`),
};
