import * as cheerio from 'cheerio';
import { getDb } from '../db/index.js';
import { getTefasClient } from '../lib/tefas.js';

const PROFILE_URL = (code: string) => `https://www.tefas.gov.tr/FonAnaliz.aspx?FonKod=${encodeURIComponent(code)}`;

interface FundProfile {
  isin?: string;
  risk_score?: number;
  kap_url?: string;
  trading_status?: string;
  trading_start?: string;
  trading_end?: string;
  buy_valor?: number;
  sell_valor?: number;
}

function parseProfile(html: string): FundProfile {
  const $ = cheerio.load(html);
  const result: FundProfile = {};

  $('tr.fund-profile-row, tr.fund-profile-alternate').each((_i, row) => {
    const headerCell = $(row).find('td.fund-profile-header').first();
    const itemCell = $(row).find('td.fund-profile-item').first();
    const label = headerCell.text().trim();
    const value = itemCell.text().trim();
    const kapLink = headerCell.find('a.fund-kap-link').attr('href');

    switch (true) {
      case label === 'ISIN Kodu':
        result.isin = value || undefined;
        break;
      case label === 'Fonun Risk Değeri': {
        const n = Number(value);
        if (Number.isFinite(n) && n >= 1 && n <= 7) result.risk_score = n;
        break;
      }
      case label === 'Platform İşlem Durumu':
        result.trading_status = value || undefined;
        break;
      case label === 'İşlem Başlangıç Saati':
        result.trading_start = value || undefined;
        break;
      case label === 'Son İşlem Saati':
        result.trading_end = value || undefined;
        break;
      case label === 'Fon Alış Valörü': {
        const n = Number(value);
        if (Number.isFinite(n)) result.buy_valor = n;
        break;
      }
      case label === 'Fon Satış Valörü': {
        const n = Number(value);
        if (Number.isFinite(n)) result.sell_valor = n;
        break;
      }
      case label.includes('KAP'):
        if (kapLink) result.kap_url = kapLink;
        break;
    }
  });

  return result;
}

interface Options {
  limit: number | null;
  fundCodes: string[] | null;
  forceRefresh: boolean;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let fundCodes: string[] | null = null;
  let forceRefresh = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a.startsWith('--limit=')) limit = Number(a.slice(8));
    else if (a === '--limit' && args[i + 1]) limit = Number(args[++i]);
    else if (a.startsWith('--codes=')) fundCodes = a.slice(8).split(',');
    else if (a === '--force') forceRefresh = true;
  }
  return { limit, fundCodes, forceRefresh };
}

async function main(): Promise<void> {
  const { limit, fundCodes, forceRefresh } = parseArgs();
  const db = getDb();
  const client = getTefasClient();

  const baseQuery = forceRefresh
    ? `SELECT code FROM funds ORDER BY code`
    : `SELECT code FROM funds WHERE profile_updated_at IS NULL ORDER BY code`;

  const allCodes: string[] = (fundCodes
    ? fundCodes.map((c) => c.trim().toUpperCase())
    : (db.prepare(baseQuery).all() as Array<{ code: string }>).map((r) => r.code));

  const targetCodes = limit ? allCodes.slice(0, limit) : allCodes;
  if (targetCodes.length === 0) {
    console.log('[profile] zaten doldurulmuş, --force ile zorla yenile.');
    return;
  }
  console.log(`[profile] ${targetCodes.length} fon profili çekilecek`);

  const updateStmt = db.prepare(
    `UPDATE funds SET
       isin = COALESCE(@isin, isin),
       risk_score = COALESCE(@risk_score, risk_score),
       kap_url = COALESCE(@kap_url, kap_url),
       trading_status = COALESCE(@trading_status, trading_status),
       trading_start = COALESCE(@trading_start, trading_start),
       trading_end = COALESCE(@trading_end, trading_end),
       buy_valor = COALESCE(@buy_valor, buy_valor),
       sell_valor = COALESCE(@sell_valor, sell_valor),
       profile_updated_at = @now
     WHERE code = @code`,
  );

  const startedAt = Date.now();
  let processed = 0;
  let success = 0;
  let skipped = 0;
  const CONCURRENCY = Number(process.env.FONOLOJI_PROFILE_CONCURRENCY ?? '5');

  async function processOne(code: string): Promise<void> {
    try {
      const html = await rawGet(PROFILE_URL(code));
      if (!html || html.length < 1000 || html.includes('Request Rejected')) {
        skipped++;
        return;
      }
      const profile = parseProfile(html);
      updateStmt.run({
        code,
        isin: profile.isin ?? null,
        risk_score: profile.risk_score ?? null,
        kap_url: profile.kap_url ?? null,
        trading_status: profile.trading_status ?? null,
        trading_start: profile.trading_start ?? null,
        trading_end: profile.trading_end ?? null,
        buy_valor: profile.buy_valor ?? null,
        sell_valor: profile.sell_valor ?? null,
        now: Date.now(),
      });
      success++;
    } catch (err) {
      skipped++;
      if (skipped < 5) console.warn(`  ${code} hata: ${(err as Error).message}`);
    }
  }

  // Process in chunks of CONCURRENCY for parallelism + bounded memory.
  for (let i = 0; i < targetCodes.length; i += CONCURRENCY) {
    const chunk = targetCodes.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(processOne));
    processed += chunk.length;

    if (processed % 200 === 0 || processed === targetCodes.length) {
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
      const rate = (processed / Number(elapsed)).toFixed(1);
      console.log(`  ${processed}/${targetCodes.length} (${success} OK, ${skipped} skip, ${elapsed}s, ${rate}/s)`);
    }
  }

  console.log(
    `\n[profile] Bitti: ${processed} fon, ${success} OK, ${skipped} skip, ${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
  );

  // unused after refactor — silence TS
  void client;
  void fetchViaGet;
}

// FonAnaliz is a GET endpoint, not POST. Use a custom GET via the tefas client's session.
async function fetchViaGet(
  client: ReturnType<typeof getTefasClient>,
  code: string,
): Promise<string | null> {
  // The TefasClient currently exposes initSession (GET) which returns body indirectly via captureHiddenFields.
  // Instead, use lower-level access by calling initSession then no-op postDirect.
  try {
    await client.initSession(PROFILE_URL(code));
    // initSession reads the page; but doesn't return body. Hack: call postDirect with empty form (will GET-equivalent? no it's POST). Skip and do raw fetch.
    const fetched = await rawGet(PROFILE_URL(code));
    return fetched;
  } catch {
    return null;
  }
}

async function rawGet(url: string): Promise<string | null> {
  // Use undici (Node native) for direct GET — bypasses TefasClient (which only handles POST cookies).
  const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  const res = await fetch(url, {
    headers: {
      'User-Agent': ua,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'tr-TR,tr;q=0.9',
      'Accept-Encoding': 'gzip, deflate',
    },
  }).catch(() => null);
  if (!res || !res.ok) return null;
  return await res.text();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[profile] hata:', err);
    process.exit(1);
  });
