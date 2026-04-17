import * as cheerio from 'cheerio';
import { getDb } from '../db/index.js';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const TR_MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  ocak: 1, şubat: 2, mart: 3, nisan: 4, mayıs: 5, haziran: 6, temmuz: 7, ağustos: 8, eylül: 9, ekim: 10, kasım: 11, aralık: 12,
};

interface CpiReading {
  period: string; // YYYY-MM (reporting period, not announcement month)
  announcedAt: string; // ISO datetime
  yoyChange: number;
  momChange: number | null;
  indexValue: number | null;
  source: string;
}

async function rawGet(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,tr;q=0.7',
      },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function periodFromRefAndAnnounceDate(refMonthText: string, announceDate: string): string | null {
  const clean = refMonthText.toLowerCase().replace(/[^a-zçğıöşü]+/g, ' ').trim();
  const parts = clean.split(/\s+/);
  const monthNum = TR_MONTHS[parts[0] ?? ''];
  if (!monthNum) return null;
  const [ay, am] = announceDate.split('-').map(Number);
  if (!ay || !am) return null;
  let refYear = ay;
  if (monthNum >= am) refYear = ay - 1;
  return `${refYear}-${String(monthNum).padStart(2, '0')}`;
}

async function fetchYoyFromTradingEconomics(): Promise<CpiReading | null> {
  const html = await rawGet('https://tradingeconomics.com/turkey/inflation-cpi');
  if (!html) return null;
  const $ = cheerio.load(html);

  type Best = { announceDate: string; refMonth: string; actual: number };
  let best: Best | null = null;

  // Each historical release lives in a row with: date cell | time cell | label | reference | actual | previous
  $('tr').each((_i, tr) => {
    const tds = $(tr).find('td');
    if (tds.length < 4) return;
    const first = $(tds[0]).text().trim();
    const dateMatch = /^(\d{4}-\d{2}-\d{2})$/.exec(first);
    if (!dateMatch) return;
    if (!$(tr).text().toLowerCase().includes('inflation rate yoy')) return;

    const refMonthCell = $(tr).find('#reference').first().text().trim();
    const actualCell = $(tr).find('#actual').first().text().trim();
    const pctMatch = /(-?\d+\.\d+)/.exec(actualCell);
    if (!refMonthCell || !pctMatch) return;
    const actual = Number(pctMatch[1]);
    if (!Number.isFinite(actual)) return;

    if (!best || dateMatch[1]! > best.announceDate) {
      best = { announceDate: dateMatch[1]!, refMonth: refMonthCell, actual };
    }
  });

  if (!best) return null;
  const b: Best = best;
  const period = periodFromRefAndAnnounceDate(b.refMonth, b.announceDate);
  if (!period) return null;

  return {
    period,
    announcedAt: `${b.announceDate}T10:00:00+03:00`,
    yoyChange: b.actual / 100,
    momChange: null,
    indexValue: null,
    source: 'tradingeconomics.com/turkey/inflation-cpi',
  };
}

async function fetchMomFromTradingEconomics(period: string): Promise<number | null> {
  const html = await rawGet('https://tradingeconomics.com/turkey/inflation-rate-mom');
  if (!html) return null;
  const $ = cheerio.load(html);

  type Best = { announceDate: string; refMonth: string; actual: number };
  let best: Best | null = null;
  $('tr').each((_i, tr) => {
    const tds = $(tr).find('td');
    if (tds.length < 4) return;
    const first = $(tds[0]).text().trim();
    const dateMatch = /^(\d{4}-\d{2}-\d{2})$/.exec(first);
    if (!dateMatch) return;
    if (!$(tr).text().toLowerCase().includes('inflation rate mom')) return;
    const refMonthCell = $(tr).find('#reference').first().text().trim();
    const actualCell = $(tr).find('#actual').first().text().trim();
    const pctMatch = /(-?\d+\.\d+)/.exec(actualCell);
    if (!refMonthCell || !pctMatch) return;
    const actual = Number(pctMatch[1]);
    if (!Number.isFinite(actual)) return;
    const itemPeriod = periodFromRefAndAnnounceDate(refMonthCell, dateMatch[1]!);
    if (itemPeriod !== period) return;
    best = { announceDate: dateMatch[1]!, refMonth: refMonthCell, actual };
  });

  return best ? (best as { actual: number }).actual / 100 : null;
}

async function fetchNextAnnouncementFromTradingEconomics(): Promise<{ date: string; time: string } | null> {
  const html = await rawGet('https://tradingeconomics.com/turkey/inflation-cpi');
  if (!html) return null;
  const $ = cheerio.load(html);

  const today = new Date().toISOString().slice(0, 10);
  let best: { date: string; time: string } | null = null;

  $('tr').each((_i, tr) => {
    const tds = $(tr).find('td');
    if (tds.length < 2) return;
    const first = $(tds[0]).text().trim();
    const dateMatch = /^(\d{4}-\d{2}-\d{2})$/.exec(first);
    if (!dateMatch) return;
    if (dateMatch[1]! <= today) return;
    if (!$(tr).text().toLowerCase().includes('inflation rate yoy')) return;

    // TradingEconomics shows time in UTC; TÜİK's standard release is 10:00 TR (UTC+3).
    if (!best || dateMatch[1]! < best.date) {
      best = { date: dateMatch[1]!, time: '10:00' };
    }
  });

  return best;
}

function scheduledAnnouncementFor(period: string): { date: string; time: string } {
  const [yr, mo] = period.split('-').map(Number);
  const nextMonth = mo === 12 ? { y: yr! + 1, m: 1 } : { y: yr!, m: mo! + 1 };
  let day = 3;
  const testDate = new Date(Date.UTC(nextMonth.y, nextMonth.m - 1, day));
  const dow = testDate.getUTCDay();
  if (dow === 0) day = 4;
  else if (dow === 6) day = 5;
  return {
    date: `${nextMonth.y}-${String(nextMonth.m).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    time: '10:00',
  };
}

export async function runCpiIngest(): Promise<{
  inserted: boolean;
  period: string | null;
  yoy: number | null;
}> {
  const db = getDb();
  console.log('[cpi] TradingEconomics\'tan TÜFE çekiliyor…');

  const reading = await fetchYoyFromTradingEconomics();
  if (!reading) {
    console.warn('[cpi] TÜFE yıllık değer bulunamadı. Fallback kaynak denensin.');
    return { inserted: false, period: null, yoy: null };
  }

  // Optionally enrich with monthly change
  try {
    const mom = await fetchMomFromTradingEconomics(reading.period);
    if (mom !== null) reading.momChange = mom;
  } catch {
    /* non-critical */
  }

  const dateStr = `${reading.period}-01`;
  db.prepare(
    `INSERT INTO cpi_tr (date, index_value, yoy_change, mom_change, source, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       index_value = excluded.index_value,
       yoy_change = excluded.yoy_change,
       mom_change = excluded.mom_change,
       source = excluded.source,
       updated_at = excluded.updated_at`,
  ).run(dateStr, reading.indexValue, reading.yoyChange, reading.momChange, reading.source, Date.now());

  db.prepare(
    `INSERT INTO cpi_announcements (period, scheduled_date, scheduled_time, actual_datetime, published, source, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?)
     ON CONFLICT(period) DO UPDATE SET
       actual_datetime = excluded.actual_datetime,
       published = 1,
       source = excluded.source,
       updated_at = excluded.updated_at`,
  ).run(
    reading.period,
    reading.announcedAt.slice(0, 10),
    reading.announcedAt.slice(11, 16),
    reading.announcedAt,
    reading.source,
    Date.now(),
  );

  // Backfill historical rows too (last 24 months) so site has a rich history table.
  try {
    await backfillHistorical(db);
  } catch (err) {
    console.warn('[cpi] historical backfill skipped:', (err as Error).message);
  }

  // Find next announcement date from source, else fall back to computed schedule.
  const nextFromSource = await fetchNextAnnouncementFromTradingEconomics();
  const nextPeriod = (() => {
    const [y, m] = reading.period.split('-').map(Number);
    const ny = m === 12 ? y! + 1 : y!;
    const nm = m === 12 ? 1 : m! + 1;
    return `${ny}-${String(nm).padStart(2, '0')}`;
  })();
  const nextInfo = nextFromSource ?? scheduledAnnouncementFor(reading.period);
  db.prepare(
    `INSERT INTO cpi_announcements (period, scheduled_date, scheduled_time, published, source, updated_at)
     VALUES (?, ?, ?, 0, ?, ?)
     ON CONFLICT(period) DO UPDATE SET
       scheduled_date = excluded.scheduled_date,
       scheduled_time = excluded.scheduled_time,
       updated_at = excluded.updated_at`,
  ).run(nextPeriod, nextInfo.date, nextInfo.time, nextFromSource ? 'tradingeconomics' : 'schedule', Date.now());

  console.log(
    `[cpi] ${reading.period} TÜFE yıllık %${(reading.yoyChange * 100).toFixed(2)}` +
      (reading.momChange !== null ? `, aylık %${(reading.momChange * 100).toFixed(2)}` : '') +
      ` — sıradaki: ${nextInfo.date} ${nextInfo.time}`,
  );
  return { inserted: true, period: reading.period, yoy: reading.yoyChange };
}

async function backfillHistorical(db: any): Promise<void> {
  const html = await rawGet('https://tradingeconomics.com/turkey/inflation-cpi');
  if (!html) return;
  const $ = cheerio.load(html);

  const rows: CpiReading[] = [];
  $('tr').each((_i, tr) => {
    const tds = $(tr).find('td');
    if (tds.length < 4) return;
    const first = $(tds[0]).text().trim();
    const dateMatch = /^(\d{4}-\d{2}-\d{2})$/.exec(first);
    if (!dateMatch) return;
    if (!$(tr).text().toLowerCase().includes('inflation rate yoy')) return;

    const refMonthCell = $(tr).find('#reference').first().text().trim();
    const actualCell = $(tr).find('#actual').first().text().trim();
    const pctMatch = /(-?\d+\.\d+)/.exec(actualCell);
    if (!refMonthCell || !pctMatch) return;
    const actual = Number(pctMatch[1]);
    if (!Number.isFinite(actual)) return;

    const period = periodFromRefAndAnnounceDate(refMonthCell, dateMatch[1]!);
    if (!period) return;
    rows.push({
      period,
      announcedAt: `${dateMatch[1]}T10:00:00+03:00`,
      yoyChange: actual / 100,
      momChange: null,
      indexValue: null,
      source: 'tradingeconomics.com',
    });
  });

  const stmt = db.prepare(
    `INSERT INTO cpi_tr (date, yoy_change, source, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       yoy_change = COALESCE(excluded.yoy_change, yoy_change),
       source = excluded.source,
       updated_at = excluded.updated_at`,
  );
  const annStmt = db.prepare(
    `INSERT INTO cpi_announcements (period, scheduled_date, scheduled_time, actual_datetime, published, source, updated_at)
     VALUES (?, ?, '10:00', ?, 1, ?, ?)
     ON CONFLICT(period) DO UPDATE SET
       actual_datetime = excluded.actual_datetime,
       published = 1,
       updated_at = excluded.updated_at`,
  );
  const txn = db.transaction(() => {
    for (const r of rows) {
      stmt.run(`${r.period}-01`, r.yoyChange, r.source, Date.now());
      annStmt.run(r.period, r.announcedAt.slice(0, 10), r.announcedAt, r.source, Date.now());
    }
  });
  txn();
  console.log(`[cpi] Historical backfill: ${rows.length} kayıt işlendi`);
}

export function seedUpcomingAnnouncements(): void {
  const db = getDb();
  const now = new Date();
  const startYear = now.getUTCFullYear();
  const rows: Array<{ period: string; date: string }> = [];

  for (let m = 1; m <= 12; m++) {
    const period = `${startYear}-${String(m).padStart(2, '0')}`;
    const sched = scheduledAnnouncementFor(period);
    rows.push({ period, date: sched.date });
  }
  for (let m = 1; m <= 6; m++) {
    const period = `${startYear + 1}-${String(m).padStart(2, '0')}`;
    const sched = scheduledAnnouncementFor(period);
    rows.push({ period, date: sched.date });
  }

  const stmt = db.prepare(
    `INSERT INTO cpi_announcements (period, scheduled_date, scheduled_time, published, source, updated_at)
     VALUES (?, ?, '10:00', 0, 'schedule', ?)
     ON CONFLICT(period) DO NOTHING`,
  );
  const txn = db.transaction(() => {
    for (const r of rows) stmt.run(r.period, r.date, Date.now());
  });
  txn();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCpiIngest()
    .then((r) => {
      if (!r.inserted) process.exit(2);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[cpi] hata:', err);
      process.exit(1);
    });
}
