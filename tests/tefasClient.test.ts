import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  HttpError,
  TefasClient,
  type FetchRequest,
  type FetchResponse,
  type Fetcher,
} from '../src/scrapers/tefasClient.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string): string =>
  readFileSync(join(__dirname, 'fixtures', name), 'utf-8');

interface CallLog {
  requests: FetchRequest[];
  sleeps: number[];
}

function makeHarness(responses: Array<FetchResponse | (() => FetchResponse)>) {
  const log: CallLog = { requests: [], sleeps: [] };
  let callIndex = 0;

  const fetcher: Fetcher = async (req) => {
    log.requests.push(req);
    const entry = responses[callIndex++];
    if (!entry) throw new Error(`Unexpected request #${callIndex}: ${req.method} ${req.url}`);
    return typeof entry === 'function' ? entry() : entry;
  };

  const sleep = async (ms: number) => {
    log.sleeps.push(ms);
  };

  return { fetcher, sleep, log };
}

describe('TefasClient', () => {
  it('parses ViewState and cookies from initSession', async () => {
    const { fetcher, sleep, log } = makeHarness([
      { status: 200, headers: {}, body: fixture('sampleInitial.html') },
    ]);
    const client = new TefasClient({ fetcher, sleep, maxRequestsPerMinute: 0 });

    await client.initSession('https://www.tefas.gov.tr/TarihselVeriler.aspx');

    const fields = client.getHiddenFields();
    expect(fields.viewState).toBe('/wEPDwUKLTYxNDk2Njg3NWRkINITIAL_VS_TOKEN==');
    expect(fields.viewStateGenerator).toBe('CA0B0334');
    expect(fields.eventValidation).toBe('/wEdAAjINITIAL_EV_TOKEN');
    expect(log.requests).toHaveLength(1);
    expect(log.requests[0]!.method).toBe('GET');
  });

  it('sends hidden fields + form data on postForm and refreshes ViewState', async () => {
    const { fetcher, sleep, log } = makeHarness([
      { status: 200, headers: {}, body: fixture('sampleInitial.html') },
      { status: 200, headers: {}, body: fixture('samplePostResponse.html') },
    ]);
    const client = new TefasClient({ fetcher, sleep, maxRequestsPerMinute: 0 });

    await client.initSession('https://www.tefas.gov.tr/TarihselVeriler.aspx');
    const body = await client.postForm('https://www.tefas.gov.tr/TarihselVeriler.aspx', {
      MainContent_TextBoxStartDate: '01.06.2024',
      MainContent_TextBoxEndDate: '30.06.2024',
    });

    expect(body).toContain('TEB PORTFÖY');
    expect(log.requests).toHaveLength(2);

    const postReq = log.requests[1]!;
    expect(postReq.method).toBe('POST');
    expect(postReq.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(postReq.headers['Origin']).toBe('https://www.tefas.gov.tr');
    expect(postReq.headers['Referer']).toBe('https://www.tefas.gov.tr/TarihselVeriler.aspx');

    const params = new URLSearchParams(postReq.body);
    expect(params.get('__VIEWSTATE')).toBe('/wEPDwUKLTYxNDk2Njg3NWRkINITIAL_VS_TOKEN==');
    expect(params.get('__EVENTVALIDATION')).toBe('/wEdAAjINITIAL_EV_TOKEN');
    expect(params.get('MainContent_TextBoxStartDate')).toBe('01.06.2024');
    expect(params.get('MainContent_TextBoxEndDate')).toBe('30.06.2024');

    const refreshed = client.getHiddenFields();
    expect(refreshed.viewState).toBe('/wEPDwUKRENEWED_VS_TOKEN==');
    expect(refreshed.eventValidation).toBe('/wEdAAjRENEWED_EV_TOKEN');
  });

  it('respects rate limit between requests', async () => {
    let now = 1_000_000;
    const { fetcher, log } = makeHarness([
      { status: 200, headers: {}, body: fixture('sampleInitial.html') },
      { status: 200, headers: {}, body: fixture('samplePostResponse.html') },
    ]);
    const sleep = async (ms: number) => {
      log.sleeps.push(ms);
      now += ms;
    };
    const client = new TefasClient({
      fetcher,
      sleep,
      nowProvider: () => now,
      maxRequestsPerMinute: 30, // 2000ms minimum interval
    });

    await client.initSession('https://www.tefas.gov.tr/TarihselVeriler.aspx');
    // First request consumed 0ms of "real" time; second should sleep for full interval.
    await client.postForm('https://www.tefas.gov.tr/TarihselVeriler.aspx', {});

    expect(log.sleeps).toEqual([2000]);
  });

  it('retries on 5xx with exponential backoff then succeeds', async () => {
    const successBody = fixture('sampleInitial.html');
    const { fetcher, sleep, log } = makeHarness([
      { status: 500, headers: {}, body: 'boom' },
      { status: 502, headers: {}, body: 'boom' },
      { status: 200, headers: {}, body: successBody },
    ]);
    const client = new TefasClient({
      fetcher,
      sleep,
      maxRequestsPerMinute: 0,
      baseRetryDelayMs: 1000,
      maxRetries: 3,
    });

    await client.initSession('https://www.tefas.gov.tr/TarihselVeriler.aspx');

    expect(log.sleeps).toEqual([1000, 2000]);
    expect(log.requests).toHaveLength(3);
    expect(client.getHiddenFields().viewState).toContain('INITIAL_VS_TOKEN');
  });

  it('does not retry on 4xx client errors', async () => {
    const { fetcher, sleep, log } = makeHarness([
      { status: 400, headers: {}, body: 'bad request' },
    ]);
    const client = new TefasClient({
      fetcher,
      sleep,
      maxRequestsPerMinute: 0,
      maxRetries: 3,
    });

    await expect(
      client.initSession('https://www.tefas.gov.tr/TarihselVeriler.aspx'),
    ).rejects.toBeInstanceOf(HttpError);
    expect(log.requests).toHaveLength(1);
    expect(log.sleeps).toHaveLength(0);
  });

  it('throws after exhausting retries on persistent 5xx', async () => {
    const { fetcher, sleep, log } = makeHarness([
      { status: 500, headers: {}, body: 'boom' },
      { status: 500, headers: {}, body: 'boom' },
      { status: 500, headers: {}, body: 'boom' },
    ]);
    const client = new TefasClient({
      fetcher,
      sleep,
      maxRequestsPerMinute: 0,
      baseRetryDelayMs: 100,
      maxRetries: 3,
    });

    await expect(
      client.initSession('https://www.tefas.gov.tr/TarihselVeriler.aspx'),
    ).rejects.toBeInstanceOf(HttpError);
    expect(log.requests).toHaveLength(3);
    expect(log.sleeps).toEqual([100, 200]);
  });
});
