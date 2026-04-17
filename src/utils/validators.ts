import type { Input, Mode } from '../types/input.js';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_MODES: readonly Mode[] = [
  'daily',
  'historical',
  'fund_list',
  'fund_detail',
  'comparison',
];
const VALID_FUND_TYPES = ['YAT', 'EMK', 'BYF', 'ALL'] as const;
const VALID_CURRENCIES = ['TRY', 'USD', 'EUR'] as const;
const FUND_CODE_RE = /^[A-Z0-9]{2,6}$/;

export interface ValidationWarning {
  field: string;
  message: string;
}

export interface ValidationResult {
  warnings: ValidationWarning[];
}

export function validateInput(input: Input): ValidationResult {
  const warnings: ValidationWarning[] = [];

  if (!input.mode) throw new Error('mode is required');
  if (!VALID_MODES.includes(input.mode)) {
    throw new Error(`mode must be one of: ${VALID_MODES.join(', ')} (got "${input.mode}")`);
  }

  if (input.startDate !== undefined && input.startDate !== '' && !ISO_DATE_RE.test(input.startDate)) {
    throw new Error(`startDate must be YYYY-MM-DD (got "${input.startDate}")`);
  }
  if (input.endDate !== undefined && input.endDate !== '' && !ISO_DATE_RE.test(input.endDate)) {
    throw new Error(`endDate must be YYYY-MM-DD (got "${input.endDate}")`);
  }

  if (input.startDate && input.endDate && input.startDate > input.endDate) {
    throw new Error(`startDate "${input.startDate}" must be <= endDate "${input.endDate}"`);
  }

  if (input.mode === 'historical' && !input.startDate) {
    throw new Error('startDate is required when mode is "historical"');
  }
  if (input.mode === 'fund_detail' && (!input.fundCodes || input.fundCodes.length === 0)) {
    throw new Error('fundCodes must contain at least one code when mode is "fund_detail"');
  }

  if (input.fundType && !VALID_FUND_TYPES.includes(input.fundType)) {
    throw new Error(`fundType must be one of: ${VALID_FUND_TYPES.join(', ')} (got "${input.fundType}")`);
  }

  if (input.outputCurrency && !VALID_CURRENCIES.includes(input.outputCurrency)) {
    throw new Error(
      `outputCurrency must be one of: ${VALID_CURRENCIES.join(', ')} (got "${input.outputCurrency}")`,
    );
  }
  if (input.outputCurrency && input.outputCurrency !== 'TRY') {
    warnings.push({
      field: 'outputCurrency',
      message: `Currency conversion not yet supported; returning TRY instead of ${input.outputCurrency}.`,
    });
  }

  if (input.fundCodes) {
    for (const code of input.fundCodes) {
      if (!FUND_CODE_RE.test(code)) {
        throw new Error(`fundCodes contains invalid code "${code}" (expected 2-6 uppercase alphanumerics)`);
      }
    }
  }

  if (input.maxRequestsPerMinute !== undefined) {
    if (!Number.isFinite(input.maxRequestsPerMinute) || input.maxRequestsPerMinute <= 0) {
      throw new Error(`maxRequestsPerMinute must be a positive number (got ${input.maxRequestsPerMinute})`);
    }
    if (input.maxRequestsPerMinute > 60) {
      warnings.push({
        field: 'maxRequestsPerMinute',
        message: `${input.maxRequestsPerMinute} rpm exceeds recommended max (60); risk of IP ban.`,
      });
    }
  }

  return { warnings };
}
