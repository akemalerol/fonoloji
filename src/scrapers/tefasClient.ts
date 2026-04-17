import { extractHiddenField } from '../parsers/htmlParser.js';

export const TEFAS_ORIGIN = 'https://www.tefas.gov.tr';
export const HISTORICAL_URL = `${TEFAS_ORIGIN}/TarihselVeriler.aspx`;

const DEFAULT_USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
];

export interface FetchRequest {
  method: 'GET' | 'POST';
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface FetchResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

export type Fetcher = (req: FetchRequest) => Promise<FetchResponse>;

export interface TefasClientOptions {
  maxRequestsPerMinute?: number;
  proxyUrl?: string;
  userAgent?: string;
  fetcher?: Fetcher;
  maxRetries?: number;
  baseRetryDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  nowProvider?: () => number;
  /**
   * Pre-captured cookie header string (name1=value1; name2=value2 …).
   * Used to bypass TEFAS F5 WAF JavaScript challenges by replaying cookies
   * obtained from a headless browser warm-up.
   */
  cookieHeader?: string;
}

export class HttpError extends Error {
  constructor(public readonly status: number, public readonly body: string) {
    super(`HTTP ${status}`);
    this.name = 'HttpError';
  }
}

export class TefasClient {
  private readonly fetcher: Fetcher;
  private readonly userAgent: string;
  private readonly minIntervalMs: number;
  private readonly maxRetries: number;
  private readonly baseRetryDelayMs: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;

  private lastRequestAt = 0;
  private viewState = '';
  private viewStateGenerator = '';
  private eventValidation = '';
  private readonly cookieHeader: string;

  constructor(options: TefasClientOptions = {}) {
    const rpm = options.maxRequestsPerMinute ?? 30;
    this.minIntervalMs = rpm > 0 ? Math.floor(60_000 / rpm) : 0;
    this.userAgent = options.userAgent ?? pickRandomUserAgent();
    this.maxRetries = options.maxRetries ?? 3;
    this.baseRetryDelayMs = options.baseRetryDelayMs ?? 1_000;
    this.sleep = options.sleep ?? defaultSleep;
    this.now = options.nowProvider ?? Date.now;
    this.cookieHeader = options.cookieHeader ?? '';
    this.fetcher = options.fetcher ?? createDefaultFetcher({ proxyUrl: options.proxyUrl });
  }

  async initSession(pageUrl: string): Promise<void> {
    const response = await this.request({
      method: 'GET',
      url: pageUrl,
      headers: this.baseHeaders(pageUrl),
    });
    this.captureHiddenFields(response.body);
  }

  async postDirect(
    url: string,
    formData: Record<string, string>,
    options: { referer?: string; acceptJson?: boolean } = {},
  ): Promise<string> {
    const payload = new URLSearchParams();
    for (const [key, value] of Object.entries(formData)) {
      payload.set(key, value);
    }

    const headers: Record<string, string> = {
      ...this.baseHeaders(options.referer ?? url),
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Origin': TEFAS_ORIGIN,
      'X-Requested-With': 'XMLHttpRequest',
    };
    if (options.acceptJson) {
      headers.Accept = 'application/json, text/javascript, */*; q=0.01';
    }

    const response = await this.request({
      method: 'POST',
      url,
      headers,
      body: payload.toString(),
    });
    return response.body;
  }

  async postForm(pageUrl: string, formData: Record<string, string>): Promise<string> {
    const payload = new URLSearchParams();
    payload.set('__VIEWSTATE', this.viewState);
    payload.set('__VIEWSTATEGENERATOR', this.viewStateGenerator);
    payload.set('__EVENTVALIDATION', this.eventValidation);
    for (const [key, value] of Object.entries(formData)) {
      payload.set(key, value);
    }

    const response = await this.request({
      method: 'POST',
      url: pageUrl,
      headers: {
        ...this.baseHeaders(pageUrl),
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': TEFAS_ORIGIN,
      },
      body: payload.toString(),
    });

    this.captureHiddenFields(response.body);
    return response.body;
  }

  getHiddenFields(): { viewState: string; viewStateGenerator: string; eventValidation: string } {
    return {
      viewState: this.viewState,
      viewStateGenerator: this.viewStateGenerator,
      eventValidation: this.eventValidation,
    };
  }

  private async request(req: FetchRequest): Promise<FetchResponse> {
    await this.respectRateLimit();

    let lastError: unknown;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.fetcher(req);
        if (response.status >= 500) {
          throw new HttpError(response.status, response.body);
        }
        if (response.status >= 400) {
          throw new HttpError(response.status, response.body);
        }
        this.lastRequestAt = this.now();
        return response;
      } catch (err) {
        lastError = err;
        const isClientError = err instanceof HttpError && err.status >= 400 && err.status < 500;
        if (isClientError || attempt >= this.maxRetries) {
          throw err;
        }
        const delay = this.baseRetryDelayMs * 2 ** (attempt - 1);
        await this.sleep(delay);
      }
    }
    throw lastError;
  }

  private async respectRateLimit(): Promise<void> {
    if (this.minIntervalMs <= 0 || this.lastRequestAt === 0) return;
    const elapsed = this.now() - this.lastRequestAt;
    if (elapsed < this.minIntervalMs) {
      await this.sleep(this.minIntervalMs - elapsed);
    }
  }

  private baseHeaders(referer: string): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': this.userAgent,
      'Referer': referer,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
      'Cache-Control': 'no-cache',
    };
    if (this.cookieHeader) headers.Cookie = this.cookieHeader;
    return headers;
  }

  private captureHiddenFields(html: string): void {
    const vs = extractHiddenField(html, '__VIEWSTATE');
    const vg = extractHiddenField(html, '__VIEWSTATEGENERATOR');
    const ev = extractHiddenField(html, '__EVENTVALIDATION');
    if (vs) this.viewState = vs;
    if (vg) this.viewStateGenerator = vg;
    if (ev) this.eventValidation = ev;
  }
}

function pickRandomUserAgent(): string {
  const ua = DEFAULT_USER_AGENTS[Math.floor(Math.random() * DEFAULT_USER_AGENTS.length)];
  return ua ?? DEFAULT_USER_AGENTS[0]!;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createDefaultFetcher(options: { proxyUrl?: string }): Fetcher {
  let resolved: Fetcher | null = null;

  return async (req) => {
    if (!resolved) {
      const { gotScraping } = await import('got-scraping');
      const { CookieJar } = await import('tough-cookie');
      const jar = new CookieJar();

      resolved = async (inner) => {
        const response = await gotScraping({
          url: inner.url,
          method: inner.method,
          headers: inner.headers,
          body: inner.body,
          cookieJar: jar,
          throwHttpErrors: false,
          followRedirect: true,
          ...(options.proxyUrl ? { proxyUrl: options.proxyUrl } : {}),
        });
        return {
          status: response.statusCode,
          headers: response.headers as Record<string, string | string[] | undefined>,
          body: typeof response.body === 'string' ? response.body : String(response.body ?? ''),
        };
      };
    }
    return resolved(req);
  };
}
