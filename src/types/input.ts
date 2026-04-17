export type Mode = 'daily' | 'historical' | 'fund_list' | 'fund_detail' | 'comparison';

export type FundType = 'YAT' | 'EMK' | 'BYF' | 'ALL';

export type OutputCurrency = 'TRY' | 'USD' | 'EUR';

export interface ProxyConfig {
  useApifyProxy?: boolean;
  apifyProxyGroups?: string[];
  apifyProxyCountry?: string;
  proxyUrls?: string[];
}

export interface Input {
  mode: Mode;
  fundCodes?: string[];
  fundType?: FundType;
  startDate?: string;
  endDate?: string;
  includePortfolio?: boolean;
  includeComparison?: boolean;
  outputCurrency?: OutputCurrency;
  maxRequestsPerMinute?: number;
  proxy?: ProxyConfig;
}
