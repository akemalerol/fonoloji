import { log } from 'apify';
import { parseHistoryApiResponse } from '../parsers/jsonParser.js';
import type { FundType } from '../types/input.js';
import type { FundPriceRow } from '../types/tefasResponse.js';
import { splitDateRange, toDdMmYyyy } from '../utils/dateWindows.js';
import { TEFAS_ORIGIN, type TefasClient } from './tefasClient.js';

export const HISTORY_API_URL = `${TEFAS_ORIGIN}/api/DB/BindHistoryInfo`;
export const HISTORY_PAGE_URL = `${TEFAS_ORIGIN}/TarihselVeriler.aspx`;

export const HISTORY_FORM_FIELDS = {
  fundType: 'fontip',
  subType: 'sfontur',
  fundCode: 'fonkod',
  fundGroup: 'fongrup',
  startDate: 'bastarih',
  endDate: 'bittarih',
  fundTypeCode: 'fonturkod',
  fundNameType: 'fonunvantip',
} as const;

export interface FetchHistoricalParams {
  fundCodes: string[];
  fundType: FundType;
  start: string;
  end: string;
}

export async function fetchHistoricalPrices(
  client: TefasClient,
  params: FetchHistoricalParams,
): Promise<FundPriceRow[]> {
  const windows = splitDateRange(params.start, params.end);
  if (windows.length === 0) return [];

  const fundCodes = params.fundCodes.length > 0 ? params.fundCodes : [''];
  const fundTypes = params.fundType === 'ALL' ? ['YAT', 'EMK', 'BYF'] : [params.fundType];
  const seen = new Set<string>();
  const results: FundPriceRow[] = [];

  // Warm up session so cookies (ASP.NET_SessionId etc.) are set before API call.
  await client.initSession(HISTORY_PAGE_URL);

  for (const window of windows) {
    for (const fundCode of fundCodes) {
      for (const fundType of fundTypes) {
        const formData: Record<string, string> = {
          [HISTORY_FORM_FIELDS.fundType]: fundType,
          [HISTORY_FORM_FIELDS.subType]: '',
          [HISTORY_FORM_FIELDS.fundCode]: fundCode,
          [HISTORY_FORM_FIELDS.fundGroup]: '',
          [HISTORY_FORM_FIELDS.startDate]: toDdMmYyyy(window.start),
          [HISTORY_FORM_FIELDS.endDate]: toDdMmYyyy(window.end),
          [HISTORY_FORM_FIELDS.fundTypeCode]: '',
          [HISTORY_FORM_FIELDS.fundNameType]: '',
        };

        const body = await client.postDirect(HISTORY_API_URL, formData, {
          referer: HISTORY_PAGE_URL,
          acceptJson: true,
        });

        const rows = parseHistoryApiResponse(body);
        log.debug(
          `TEFAS API response: fundType=${fundType} fundCode="${fundCode}" window=${window.start}..${window.end} bytes=${body.length} parsedRows=${rows.length}`,
        );
        if (rows.length === 0 && body.includes('Request Rejected')) {
          log.warning(
            `TEFAS WAF blocked request (fundType=${fundType}, window=${window.start}..${window.end}). Enable Apify residential proxy with apifyProxyCountry="TR".`,
          );
        }
        for (const row of rows) {
          const key = `${row.date}|${row.fundCode}`;
          if (seen.has(key)) continue;
          seen.add(key);
          results.push(row);
        }
      }
    }
  }

  return results;
}
