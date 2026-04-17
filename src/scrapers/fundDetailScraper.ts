import { parseChartData, type ChartPricePoint } from '../parsers/chartParser.js';
import { parsePortfolioAllocation } from '../parsers/portfolioParser.js';
import type { FundDetailRecord, FundReturns, PortfolioAllocation } from '../types/fund.js';
import { TEFAS_ORIGIN, type TefasClient } from './tefasClient.js';
import * as cheerio from 'cheerio';

export const FUND_ANALIZ_URL = (fundCode: string) =>
  `${TEFAS_ORIGIN}/FonAnaliz.aspx?FonKod=${encodeURIComponent(fundCode)}`;

export interface FetchFundDetailParams {
  fundCode: string;
  scrapedAt: string;
}

export async function fetchFundDetail(
  client: TefasClient,
  params: FetchFundDetailParams,
): Promise<FundDetailRecord | null> {
  const url = FUND_ANALIZ_URL(params.fundCode);
  await client.initSession(url);
  const html = await client.postForm(url, {});

  const priceHistory = parseChartData(html);
  if (priceHistory.length === 0) return null;

  const meta = extractFundMeta(html, params.fundCode);
  const portfolio = parsePortfolioAllocation(html);
  const returns = computeReturns(priceHistory);
  const latest = priceHistory[priceHistory.length - 1]!;

  return {
    fundCode: params.fundCode,
    fundName: meta.fundName ?? params.fundCode,
    ...(meta.fundCategory ? { fundCategory: meta.fundCategory } : {}),
    ...(meta.managementCompany ? { managementCompany: meta.managementCompany } : {}),
    currentPrice: latest.price,
    currentDate: latest.date,
    returns,
    ...(Object.keys(portfolio).length > 0 ? { portfolio } : {}),
    priceHistory,
    metadata: {
      scrapedAt: params.scrapedAt,
      source: 'tefas.gov.tr',
    },
  };
}

interface FundMeta {
  fundName?: string;
  fundCategory?: string;
  managementCompany?: string;
}

function extractFundMeta(html: string, fundCode: string): FundMeta {
  const $ = cheerio.load(html);
  const titleText = $('#MainContent_FonAdi, #MainContent_FormViewMainFonCode h1, .fund-name').first().text().trim();
  const pageTitle = $('title').text().trim();
  const fundName = titleText || pageTitle.replace(/.*\|/, '').trim() || undefined;

  const category = $('#MainContent_FonKategorisi, #MainContent_DropDownListKategori').first().text().trim();
  const company = $('#MainContent_KurucuUnvan, #MainContent_KurucuAdi').first().text().trim();

  void fundCode;
  return {
    fundName: fundName && fundName.length > 0 ? fundName : undefined,
    fundCategory: category && category.length > 0 ? category : undefined,
    managementCompany: company && company.length > 0 ? company : undefined,
  };
}

export function computeReturns(history: ChartPricePoint[]): FundReturns {
  if (history.length === 0) return {};
  const sorted = [...history].sort((a, b) => (a.date < b.date ? -1 : 1));
  const latest = sorted[sorted.length - 1]!;
  const latestMs = parseIsoToUtc(latest.date);

  const returns: FundReturns = {};
  const windows: Array<[keyof FundReturns, number]> = [
    ['daily', 1],
    ['weekly', 7],
    ['monthly', 30],
    ['threeMonth', 90],
    ['sixMonth', 180],
    ['oneYear', 365],
  ];

  for (const [key, days] of windows) {
    const targetMs = latestMs - days * 86_400_000;
    const baseline = findNearestOnOrBefore(sorted, targetMs);
    if (baseline && baseline.price > 0) {
      returns[key] = roundTo((latest.price - baseline.price) / baseline.price, 6);
    }
  }

  const ytdTarget = Date.UTC(new Date(latestMs).getUTCFullYear(), 0, 1);
  const ytdBaseline = findNearestOnOrAfter(sorted, ytdTarget);
  if (ytdBaseline && ytdBaseline.price > 0) {
    returns.ytd = roundTo((latest.price - ytdBaseline.price) / ytdBaseline.price, 6);
  }

  return returns;
}

function findNearestOnOrBefore(sorted: ChartPricePoint[], targetMs: number): ChartPricePoint | null {
  let result: ChartPricePoint | null = null;
  for (const p of sorted) {
    if (parseIsoToUtc(p.date) <= targetMs) result = p;
    else break;
  }
  return result;
}

function findNearestOnOrAfter(sorted: ChartPricePoint[], targetMs: number): ChartPricePoint | null {
  for (const p of sorted) {
    if (parseIsoToUtc(p.date) >= targetMs) return p;
  }
  return null;
}

function parseIsoToUtc(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y as number, (m as number) - 1, d as number);
}

function roundTo(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

// Re-export for type usage.
export type { PortfolioAllocation };
