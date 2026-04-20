import type { Database } from 'better-sqlite3';

// Observability: page_visits, api_requests, outgoing_emails tabloları için
// tek noktadan yazıcılar. 30 gün sonra cron otomatik temizler.

const FUND_CODE_RE = /\/funds\/([A-Z0-9]{2,8})(\/|$)/i;

export function extractFundCode(path: string): string | null {
  const m = path.match(FUND_CODE_RE);
  return m ? m[1]!.toUpperCase() : null;
}

interface ApiRequestRow {
  path: string;
  method: string;
  ip: string | null;
  country: string | null;
  userId: number | null;
  apiKeyId: number | null;
  status: number | null;
  durationMs: number | null;
  userAgent: string | null;
  origin: string | null;
  referer: string | null;
}

export function logApiRequest(db: Database, row: ApiRequestRow): void {
  try {
    db.prepare(
      `INSERT INTO api_requests (ts, path, method, fund_code, ip, country, user_id, api_key_id, status, duration_ms, user_agent, origin, referer)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      Date.now(),
      row.path,
      row.method,
      extractFundCode(row.path),
      row.ip,
      row.country,
      row.userId,
      row.apiKeyId,
      row.status,
      row.durationMs,
      row.userAgent,
      row.origin,
      row.referer,
    );
  } catch {
    // tracking tablosu yazımı site performansını düşürmemeli — sessizce yut
  }
}

interface PageVisitRow {
  path: string;
  ip: string;
  country: string | null;
  userId: number | null;
  userAgent: string | null;
  referer: string | null;
  sessionId: string | null;
}

export function logPageVisit(db: Database, row: PageVisitRow): void {
  try {
    db.prepare(
      `INSERT INTO page_visits (ts, path, ip, country, user_id, user_agent, referer, session_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      Date.now(),
      row.path,
      row.ip,
      row.country,
      row.userId,
      row.userAgent,
      row.referer,
      row.sessionId,
    );
  } catch {
    /* noop */
  }
}

interface OutgoingEmailRow {
  toEmail: string;
  subject: string;
  template: string | null;
  bodyHtml: string | null;
  status: 'sent' | 'failed';
  error?: string | null;
  userId?: number | null;
  contactMessageId?: number | null;
}

export function logOutgoingEmail(db: Database, row: OutgoingEmailRow): void {
  try {
    // text preview — HTML tag'lerini temizle, ilk 300 char
    const preview = row.bodyHtml
      ? row.bodyHtml
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 300)
      : null;
    db.prepare(
      `INSERT INTO outgoing_emails (ts, to_email, subject, template, body_preview, body_html, status, error, user_id, contact_message_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      Date.now(),
      row.toEmail,
      row.subject,
      row.template,
      preview,
      row.bodyHtml,
      row.status,
      row.error ?? null,
      row.userId ?? null,
      row.contactMessageId ?? null,
    );
  } catch {
    /* noop */
  }
}

// 30 gün sonra eski kayıtları sil. Cron'dan günlük çağrılır.
export function purgeOldTracking(db: Database, days = 30): { deleted: number } {
  const cutoff = Date.now() - days * 86_400_000;
  let deleted = 0;
  for (const table of ['page_visits', 'api_requests', 'outgoing_emails']) {
    const r = db.prepare(`DELETE FROM ${table} WHERE ts < ?`).run(cutoff);
    deleted += r.changes;
  }
  return { deleted };
}
