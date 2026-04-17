import type { Database } from 'better-sqlite3';

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ACTIVE_PER_USER = 3;

export interface VerificationRecord {
  id: number;
  user_id: number;
  code: string;
  expires_at: number;
  used_at: number | null;
  created_at: number;
}

export function createVerification(db: Database, userId: number, code: string): VerificationRecord {
  const now = Date.now();

  // Invalidate older active codes to prevent spam / race conditions.
  db.prepare(
    `UPDATE email_verifications SET used_at = ? WHERE user_id = ? AND used_at IS NULL`,
  ).run(now, userId);

  const result = db
    .prepare(
      `INSERT INTO email_verifications (user_id, code, expires_at, created_at)
       VALUES (?, ?, ?, ?)`,
    )
    .run(userId, code, now + CODE_TTL_MS, now);
  return (db
    .prepare(`SELECT * FROM email_verifications WHERE id = ?`)
    .get(Number(result.lastInsertRowid)) as VerificationRecord);
}

export function findActiveVerification(
  db: Database,
  userId: number,
  code: string,
): VerificationRecord | null {
  const row = db
    .prepare(
      `SELECT * FROM email_verifications
       WHERE user_id = ? AND code = ? AND used_at IS NULL AND expires_at > ?
       ORDER BY id DESC LIMIT 1`,
    )
    .get(userId, code, Date.now()) as VerificationRecord | undefined;
  return row ?? null;
}

export function consumeVerification(db: Database, id: number): void {
  db.prepare(`UPDATE email_verifications SET used_at = ? WHERE id = ?`).run(Date.now(), id);
}

export function markEmailVerified(db: Database, userId: number): void {
  const now = Date.now();
  db.prepare(
    `UPDATE users SET email_verified_at = ?, updated_at = ? WHERE id = ? AND email_verified_at IS NULL`,
  ).run(now, now, userId);
}

export function canResendFor(db: Database, userId: number): { ok: boolean; retryAfterSec?: number } {
  const row = db
    .prepare(
      `SELECT created_at FROM email_verifications
       WHERE user_id = ? ORDER BY id DESC LIMIT 1`,
    )
    .get(userId) as { created_at: number } | undefined;
  if (!row) return { ok: true };
  const elapsed = Date.now() - row.created_at;
  const cooldownMs = 60_000; // 60s
  if (elapsed < cooldownMs) return { ok: false, retryAfterSec: Math.ceil((cooldownMs - elapsed) / 1000) };
  return { ok: true };
}

export function countActiveToday(db: Database, userId: number): number {
  const since = Date.now() - 24 * 3600 * 1000;
  const row = db
    .prepare(
      `SELECT COUNT(*) as c FROM email_verifications WHERE user_id = ? AND created_at >= ?`,
    )
    .get(userId, since) as { c: number };
  return row.c;
}

export function canCreateMore(db: Database, userId: number): boolean {
  return countActiveToday(db, userId) < MAX_ACTIVE_PER_USER * 5;
}
