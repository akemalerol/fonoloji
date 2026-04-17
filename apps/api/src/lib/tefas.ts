import { existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TefasClient } from '../../../../src/scrapers/tefasClient.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_COOKIE_FILE =
  process.env.FONOLOJI_COOKIE_FILE ?? `${__dirname}/../../../../tefas-cookies.json`;

let client: TefasClient | null = null;

function readCookieHeader(): string {
  try {
    if (!existsSync(DEFAULT_COOKIE_FILE)) return '';
    const raw = readFileSync(DEFAULT_COOKIE_FILE, 'utf-8');
    const data = JSON.parse(raw) as { cookieHeader?: string; userAgent?: string; capturedAt?: number };
    return data.cookieHeader ?? '';
  } catch {
    return '';
  }
}

function readUserAgent(): string | undefined {
  try {
    if (!existsSync(DEFAULT_COOKIE_FILE)) return undefined;
    const data = JSON.parse(readFileSync(DEFAULT_COOKIE_FILE, 'utf-8')) as { userAgent?: string };
    return data.userAgent;
  } catch {
    return undefined;
  }
}

export function getTefasClient(): TefasClient {
  if (client) return client;
  client = new TefasClient({
    maxRequestsPerMinute: Number(process.env.FONOLOJI_RPM ?? 30),
    proxyUrl: process.env.FONOLOJI_PROXY_URL,
    cookieHeader: readCookieHeader(),
    userAgent: readUserAgent(),
  });
  return client;
}

export function resetTefasClient(): void {
  client = null;
}

export { TefasClient };
