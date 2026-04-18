/**
 * KAP fon bildirimleri ingest — sadece KVH (kolektif yatırım kuruluşları).
 *
 * Modlar:
 *   runKapDisclosuresIngest({ days })        — cron'dan çağrılır, 3 günlük pencere
 *   backfillFundKapDisclosures(code)         — /disclosures endpoint'inden fire-and-forget, 180 günlük backfill
 *
 * Yeni insert edilen bildirimler için kap_alerts tablosunu kontrol edip ilgili
 * kullanıcılara e-posta gönderir.
 *
 * Usage (CLI):
 *   npx tsx src/scripts/ingestKapDisclosures.ts [--days=3]
 *   npx tsx src/scripts/ingestKapDisclosures.ts --backfill=TTE
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Resend } from 'resend';
import { getDb } from '../db/index.js';

const execFileAsync = promisify(execFile);

const KAP_API = 'https://www.kap.org.tr/tr/api';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const FROM = process.env.FONOLOJI_MAIL_FROM ?? 'Fonoloji <no-reply@fonoloji.com>';
const SITE = process.env.FONOLOJI_SITE_URL ?? 'https://fonoloji.com';

let _resend: Resend | null = null;
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_resend) _resend = new Resend(key);
  return _resend;
}

interface KapFundDisclosure {
  publishDate: string;
  fundCode: string;
  kapTitle: string;
  subject: string;
  summary?: string;
  disclosureIndex: number;
  attachmentCount: number;
  year: number;
  period: number;
  ruleType: string;
}

async function kapPost<T>(path: string, body: unknown): Promise<T> {
  const url = `${KAP_API}/${path}`;
  const { stdout } = await execFileAsync(
    'curl',
    [
      '-sL', '--max-time', '30',
      '-A', UA,
      '-H', 'Accept-Language: tr',
      '-H', 'Content-Type: application/json',
      '-H', 'Accept: application/json',
      '-X', 'POST',
      '-d', JSON.stringify(body),
      url,
    ],
    { maxBuffer: 10_000_000 },
  );
  if (stdout.includes('engellenmistir') || stdout.includes('blocked')) {
    throw new Error('KAP rate limit — IP engellenmiş');
  }
  return JSON.parse(stdout) as T;
}

async function fetchWindow(fromDate: string, toDate: string): Promise<KapFundDisclosure[]> {
  const baseBody = {
    fromDate, toDate,
    fundTypeList: [], mkkMemberOidList: [], fundOidList: [], passiveFundOidList: [],
    isLate: '', subjectList: [], discIndex: [], fromSrc: false, srcCategory: '',
  };
  const [general, financial] = await Promise.all([
    kapPost<KapFundDisclosure[]>('disclosure/funds/byCriteria', { ...baseBody, disclosureClass: '' }),
    kapPost<KapFundDisclosure[]>('disclosure/funds/byCriteria', { ...baseBody, disclosureClass: 'FR' }),
  ]);
  const all = [...general, ...financial];
  const seen = new Set<number>();
  return all.filter((d) => {
    if (seen.has(d.disclosureIndex)) return false;
    seen.add(d.disclosureIndex);
    return true;
  });
}

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseKapDate(raw: string): number {
  // KAP iki farklı format döndürüyor:
  //   byCriteria listesi      → "01.04.2026 19:53:31"  (DD.MM.YYYY)
  //   attachment-detail       → "2026.02.06 17:57:54"  (YYYY.MM.DD)
  //   (beklenmedik)           → "2026-02-06 17:57:54"  (YYYY-MM-DD)
  if (!raw) return Date.now();

  const m1 = raw.match(/^(\d{4})[.\-](\d{2})[.\-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (m1) {
    const [, y, mo, d, h, mi, s] = m1;
    const t = Date.parse(`${y}-${mo}-${d}T${h}:${mi}:${s}+03:00`);
    if (Number.isFinite(t)) return t;
  }
  const m2 = raw.match(/^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2})/);
  if (m2) {
    const [, d, mo, y, h, mi, s] = m2;
    const t = Date.parse(`${y}-${mo}-${d}T${h}:${mi}:${s}+03:00`);
    if (Number.isFinite(t)) return t;
  }
  return Date.now();
}

function alertEmailHtml(opts: {
  fundCode: string;
  fundName: string;
  items: Array<{ disclosure_index: number; subject: string | null; kap_title: string | null; publish_date: number }>;
}): string {
  const { fundCode, fundName, items } = opts;
  const rows = items.map((d) => {
    const ts = new Date(d.publish_date);
    const dateStr = `${String(ts.getDate()).padStart(2, '0')}.${String(ts.getMonth() + 1).padStart(2, '0')}.${ts.getFullYear()} ${String(ts.getHours()).padStart(2, '0')}:${String(ts.getMinutes()).padStart(2, '0')}`;
    const title = d.kap_title ?? d.subject ?? 'Bildirim';
    return `<tr><td style="padding:12px 14px;border-bottom:1px solid #24242b;">
      <div style="font-size:10px;color:#7a7a85;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">${d.subject ?? 'Bildirim'}</div>
      <a href="https://www.kap.org.tr/tr/Bildirim/${d.disclosure_index}" style="color:#f5f5f7;text-decoration:none;font-size:14px;">${title}</a>
      <div style="font-size:11px;color:#61616c;margin-top:4px;font-family:monospace;">${dateStr}</div>
    </td></tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0b0b10;font-family:-apple-system,sans-serif;color:#e8e8ec;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#15151b;border:1px solid #24242b;border-radius:20px;overflow:hidden;">
  <tr><td style="background:linear-gradient(135deg,#8B5CF6 0%,#06B6D4 100%);height:4px;"></td></tr>
  <tr><td style="padding:28px 32px;">
    <div style="font-size:10px;font-weight:700;color:#8B5CF6;text-transform:uppercase;letter-spacing:3px;margin-bottom:8px;">KAP BİLDİRİMİ</div>
    <h2 style="margin:0 0 4px;font-size:20px;color:#f5f5f7;font-family:Georgia,serif;font-weight:400;">${fundCode} · ${fundName}</h2>
    <p style="margin:8px 0 16px;font-size:13px;color:#a8a8b3;">Takip ettiğin fon için KAP'ta ${items.length} yeni bildirim yayınlandı.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f16;border-radius:12px;margin-top:8px;">${rows}</table>
    <p style="margin:22px 0 0;font-size:12px;color:#61616c;">
      <a href="${SITE}/fon/${fundCode}" style="color:#a8a8b3;">Fon sayfasını aç</a> ·
      <a href="${SITE}/alarmlarim" style="color:#a8a8b3;">Alarmları yönet</a>
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

async function notifyKapAlerts(insertedRecords: KapFundDisclosure[]): Promise<number> {
  if (insertedRecords.length === 0) return 0;
  const db = getDb();
  const resend = getResend();
  if (!resend) return 0;

  // Group inserted disclosures by fund
  const byFund = new Map<string, KapFundDisclosure[]>();
  for (const r of insertedRecords) {
    const code = r.fundCode?.toUpperCase();
    if (!code) continue;
    if (!byFund.has(code)) byFund.set(code, []);
    byFund.get(code)!.push(r);
  }

  let sent = 0;
  for (const [fundCode, records] of byFund) {
    const alerts = db
      .prepare(
        `SELECT a.id, a.user_id, a.last_notified_at, u.email, f.name as fund_name
         FROM kap_alerts a
         JOIN users u ON u.id = a.user_id
         LEFT JOIN funds f ON f.code = a.fund_code
         WHERE a.enabled = 1 AND a.fund_code = ? AND u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL`,
      )
      .all(fundCode) as Array<{ id: number; user_id: number; last_notified_at: number | null; email: string; fund_name: string | null }>;

    if (alerts.length === 0) continue;

    // Pull freshly inserted records (already have them) + enrich with current row shape
    const items = records.map((r) => ({
      disclosure_index: r.disclosureIndex,
      subject: r.subject,
      kap_title: r.kapTitle,
      publish_date: parseKapDate(r.publishDate),
    }));

    for (const a of alerts) {
      // Throttle: don't send more than once per hour per (user, fund)
      if (a.last_notified_at && Date.now() - a.last_notified_at < 60 * 60_000) continue;
      try {
        await resend.emails.send({
          from: FROM,
          to: a.email,
          subject: `📄 ${fundCode} — ${items.length} yeni KAP bildirimi`,
          html: alertEmailHtml({ fundCode, fundName: a.fund_name ?? fundCode, items }),
        });
        db.prepare(`UPDATE kap_alerts SET last_notified_at = ? WHERE id = ?`).run(Date.now(), a.id);
        sent++;
      } catch (err) {
        console.warn(`[kap-alerts] mail failed for ${fundCode}: ${(err as Error).message}`);
      }
    }
  }
  return sent;
}

interface Options { days: number; backfill: string | null; historical: number }

function parseArgs(): Options {
  const args = process.argv.slice(2);
  let days = 3;
  let backfill: string | null = null;
  let historical = 0;
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a.startsWith('--days=')) days = Number(a.slice(7));
    else if (a === '--days' && args[i + 1]) days = Number(args[++i]);
    else if (a.startsWith('--backfill=')) backfill = a.slice(11).toUpperCase();
    else if (a.startsWith('--historical=')) historical = Number(a.slice(13));
  }
  return { days, backfill, historical };
}

/**
 * Geçmişe doğru N x 30 günlük pencere yürüyerek tüm kayıtların
 * publish_date'lerini düzelt (ilk ingest'te fetched_at yazılmıştı).
 */
export async function refreshHistorical(windows: number): Promise<{
  windows: number; inserted: number; updated: number;
}> {
  const today = new Date();
  let totalInserted = 0, totalUpdated = 0;

  for (let i = 0; i < windows; i++) {
    const end = new Date(today);
    end.setDate(end.getDate() - i * 30);
    const start = new Date(end);
    start.setDate(start.getDate() - 29);
    const fromDate = toYmd(start);
    const toDate = toYmd(end);

    try {
      console.log(`[kap-historical] ${fromDate} → ${toDate}`);
      const rows = await fetchWindow(fromDate, toDate);
      const { inserted, updated } = insertRecords(rows);
      totalInserted += inserted;
      totalUpdated += updated;
      console.log(`  +${inserted} yeni, ${updated} güncellendi (toplam ${rows.length})`);
      await new Promise((r) => setTimeout(r, 1500));
    } catch (err) {
      console.warn(`  hata: ${(err as Error).message}`);
      if ((err as Error).message.includes('rate limit')) break;
    }
  }
  return { windows, inserted: totalInserted, updated: totalUpdated };
}

function insertRecords(records: KapFundDisclosure[]): { inserted: number; updated: number; insertedRecords: KapFundDisclosure[] } {
  const db = getDb();
  const existsStmt = db.prepare('SELECT 1 FROM kap_disclosures WHERE disclosure_index = ?');
  const insertStmt = db.prepare(
    `INSERT INTO kap_disclosures
     (disclosure_index, fund_code, publish_date, subject, kap_title, rule_type, period, year, attachment_count, summary, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  // UPDATE publish_date + diğer metadata — mevcut kayıtların yanlış tarihleri düzeltilir.
  // fetched_at dokunulmaz (ilk fetch izini koru).
  const updateStmt = db.prepare(
    `UPDATE kap_disclosures SET
       fund_code = ?, publish_date = ?, subject = ?, kap_title = ?,
       rule_type = ?, period = ?, year = ?, attachment_count = ?, summary = ?
     WHERE disclosure_index = ?`,
  );
  const now = Date.now();
  let inserted = 0, updated = 0;
  const insertedRecords: KapFundDisclosure[] = [];
  const txn = db.transaction((xs: KapFundDisclosure[]) => {
    for (const d of xs) {
      const idx = d.disclosureIndex;
      const code = d.fundCode?.toUpperCase() ?? null;
      const pd = parseKapDate(d.publishDate);
      const sub = d.subject ?? null;
      const title = d.kapTitle ?? null;
      const rt = d.ruleType ?? null;
      const per = d.period ?? null;
      const yr = d.year ?? null;
      const att = d.attachmentCount ?? 0;
      const sum = d.summary ?? null;

      if (existsStmt.get(idx)) {
        updateStmt.run(code, pd, sub, title, rt, per, yr, att, sum, idx);
        updated++;
      } else {
        insertStmt.run(idx, code, pd, sub, title, rt, per, yr, att, sum, now);
        inserted++;
        insertedRecords.push(d);
      }
    }
  });
  txn(records);
  return { inserted, updated, insertedRecords };
}

export async function runKapDisclosuresIngest(overrides?: { days?: number }): Promise<{
  fetched: number; inserted: number; updated: number; alertsSent: number;
}> {
  const days = overrides?.days ?? parseArgs().days;
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - Math.max(1, days));
  const fromDate = toYmd(from);
  const toDate = toYmd(today);

  console.log(`[kap-disclosures] Fetching ${fromDate} → ${toDate}`);
  const rows = await fetchWindow(fromDate, toDate);
  console.log(`[kap-disclosures] ${rows.length} fon bildirimi alındı`);

  const { inserted, updated, insertedRecords } = insertRecords(rows);
  console.log(`[kap-disclosures] +${inserted} yeni, ${updated} güncellendi`);

  const alertsSent = await notifyKapAlerts(insertedRecords);
  if (alertsSent > 0) console.log(`[kap-disclosures] 📧 ${alertsSent} kullanıcıya bildirim gönderildi`);

  return { fetched: rows.length, inserted, updated, alertsSent };
}

/**
 * Kullanıcı /fon/[kod] sayfasına girdiğinde fire-and-forget tetiklenir.
 * 180 gün geri gider (6 x 30 gün pencere, rate limit dostu).
 * Global lock — aynı anda birden fazla backfill çalışmaz.
 */
let backfillLock = false;

export async function backfillFundKapDisclosures(fundCode: string): Promise<void> {
  if (backfillLock) {
    console.log(`[kap-backfill] ${fundCode} skipped (başka backfill çalışıyor)`);
    return;
  }
  backfillLock = true;
  const db = getDb();
  const code = fundCode.toUpperCase();
  try {
    console.log(`[kap-backfill] ${code} — 180 gün backfill başlıyor`);
    const today = new Date();
    let totalInserted = 0;
    const allInserted: KapFundDisclosure[] = [];

    // 6 pencere x 30 gün
    for (let i = 0; i < 6; i++) {
      const end = new Date(today);
      end.setDate(end.getDate() - i * 30);
      const start = new Date(end);
      start.setDate(start.getDate() - 29);
      const fromDate = toYmd(start);
      const toDate = toYmd(end);

      try {
        const rows = await fetchWindow(fromDate, toDate);
        const { inserted, insertedRecords } = insertRecords(rows);
        totalInserted += inserted;
        allInserted.push(...insertedRecords);
        console.log(`[kap-backfill] ${code} window ${fromDate}→${toDate}: +${inserted}`);
        await new Promise((r) => setTimeout(r, 1500)); // KAP nezaket arası
      } catch (err) {
        console.warn(`[kap-backfill] ${code} window ${fromDate}→${toDate} hata: ${(err as Error).message}`);
        // Rate limit yedi, abort
        if ((err as Error).message.includes('rate limit')) break;
      }
    }

    // Mark ALL funds that had a record in this backfill as "backfilled now"
    // (so their own /disclosures visit doesn't re-trigger)
    const touched = new Set(allInserted.map((r) => r.fundCode?.toUpperCase()).filter(Boolean) as string[]);
    touched.add(code); // also mark the requested fund, even if it had no hits
    const mark = db.prepare(`UPDATE funds SET kap_backfilled_at = ? WHERE code = ?`);
    const markTxn = db.transaction((codes: string[]) => {
      const now = Date.now();
      for (const c of codes) mark.run(now, c);
    });
    markTxn([...touched]);

    console.log(`[kap-backfill] ${code} done: +${totalInserted} new, ${touched.size} fund marked`);

    // Fire alert emails for newly inserted records
    await notifyKapAlerts(allInserted);
  } finally {
    backfillLock = false;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const opts = parseArgs();
  const main = opts.backfill
    ? backfillFundKapDisclosures(opts.backfill).then(() => ({ ok: true }))
    : opts.historical > 0
      ? refreshHistorical(opts.historical).then(() => ({ ok: true }))
      : runKapDisclosuresIngest();
  main
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[kap-disclosures] hata:', err);
      process.exit(1);
    });
}
