import { parseComparisonTable } from '../parsers/comparisonParser.js';
import type { FundComparisonRecord } from '../types/fund.js';
import type { FundType } from '../types/input.js';
import { TEFAS_ORIGIN, type TefasClient } from './tefasClient.js';

export const FON_KARSILASTIRMA_URL = `${TEFAS_ORIGIN}/FonKarsilastirma.aspx`;

export const COMPARISON_FORM_FIELDS = {
  fundType: 'MainContent_RadioButtonListFonTuru',
  searchButton: 'MainContent_ButtonArama',
  eventTarget: '__EVENTTARGET',
  eventArgument: '__EVENTARGUMENT',
} as const;

export interface FetchComparisonParams {
  fundType: FundType;
  scrapedAt: string;
}

export async function fetchComparison(
  client: TefasClient,
  params: FetchComparisonParams,
): Promise<FundComparisonRecord[]> {
  await client.initSession(FON_KARSILASTIRMA_URL);

  const formData: Record<string, string> = {
    [COMPARISON_FORM_FIELDS.eventTarget]: COMPARISON_FORM_FIELDS.searchButton,
    [COMPARISON_FORM_FIELDS.eventArgument]: '',
  };
  if (params.fundType !== 'ALL') {
    formData[COMPARISON_FORM_FIELDS.fundType] = params.fundType;
  }

  const html = await client.postForm(FON_KARSILASTIRMA_URL, formData);
  return parseComparisonTable(html, params.scrapedAt);
}
