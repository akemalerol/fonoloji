import type { FundType, OutputCurrency } from './input.js';

export interface PortfolioAllocation {
  stock?: number;
  governmentBond?: number;
  treasuryBill?: number;
  corporateBond?: number;
  eurobond?: number;
  gold?: number;
  cash?: number;
  other?: number;
}

export interface FundReturns {
  daily?: number;
  weekly?: number;
  monthly?: number;
  threeMonth?: number;
  sixMonth?: number;
  ytd?: number;
  oneYear?: number;
}

export interface FundPriceRecord {
  fundCode: string;
  fundName: string;
  fundType?: FundType;
  fundCategory?: string;
  date: string;
  price: number;
  currency: OutputCurrency;
  totalValue: number;
  sharesOutstanding: number;
  investorCount: number;
  dailyReturn?: number;
  portfolio?: PortfolioAllocation;
  returns?: FundReturns;
  metadata: {
    managementCompany?: string;
    scrapedAt: string;
    source: 'tefas.gov.tr';
  };
}

export interface FundListRecord {
  fundCode: string;
  fundName: string;
  fundType?: FundType;
  fundCategory?: string;
  managementCompany?: string;
  isActive: boolean;
  latestPrice: number;
  latestDate: string;
  totalValue: number;
  investorCount: number;
}

export interface FundDetailRecord {
  fundCode: string;
  fundName: string;
  fundType?: FundType;
  fundCategory?: string;
  managementCompany?: string;
  currentPrice: number;
  currentDate: string;
  returns: FundReturns;
  portfolio?: PortfolioAllocation;
  priceHistory: Array<{ date: string; price: number }>;
  metadata: {
    scrapedAt: string;
    source: 'tefas.gov.tr';
  };
}

export interface FundComparisonRecord {
  fundCode: string;
  fundName: string;
  fundCategory?: string;
  returnOneMonth?: number;
  returnThreeMonth?: number;
  returnSixMonth?: number;
  returnOneYear?: number;
  returnYTD?: number;
  totalValue?: number;
  investorCount?: number;
  metadata: {
    scrapedAt: string;
    source: 'tefas.gov.tr';
  };
}
