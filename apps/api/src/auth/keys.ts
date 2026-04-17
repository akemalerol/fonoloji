import { createHash, randomBytes } from 'node:crypto';
import type { Database } from 'better-sqlite3';

const PREFIX = 'fon_';

export interface ApiKeyRecord {
  id: number;
  user_id: number;
  key_hash: string;
  key_prefix: string;
  name: string | null;
  last_used_at: number | null;
  revoked_at: number | null;
  created_at: number;
}

export function generatePlainKey(): { plain: string; hash: string; prefix: string } {
  const token = randomBytes(24).toString('base64url');
  const plain = `${PREFIX}${token}`;
  return {
    plain,
    hash: hashKey(plain),
    prefix: plain.slice(0, 12),
  };
}

export function hashKey(plain: string): string {
  return createHash('sha256').update(plain).digest('hex');
}

export function createApiKey(db: Database, userId: number, name: string | null): { plain: string; record: ApiKeyRecord } {
  const { plain, hash, prefix } = generatePlainKey();
  const now = Date.now();
  const result = db
    .prepare(
      `INSERT INTO api_keys (user_id, key_hash, key_prefix, name, created_at) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(userId, hash, prefix, name, now);
  const record = db
    .prepare(`SELECT * FROM api_keys WHERE id = ?`)
    .get(result.lastInsertRowid) as ApiKeyRecord;
  return { plain, record };
}

export function findActiveKey(db: Database, plain: string): ApiKeyRecord | null {
  if (!plain) return null;
  const hash = hashKey(plain);
  const row = db
    .prepare(`SELECT * FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL`)
    .get(hash) as ApiKeyRecord | undefined;
  return row ?? null;
}

export function listKeysForUser(db: Database, userId: number): ApiKeyRecord[] {
  return db
    .prepare(
      `SELECT * FROM api_keys WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC`,
    )
    .all(userId) as ApiKeyRecord[];
}

export function revokeKey(db: Database, userId: number, keyId: number): boolean {
  const result = db
    .prepare(`UPDATE api_keys SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL`)
    .run(Date.now(), keyId, userId);
  return result.changes > 0;
}

export function touchKey(db: Database, keyId: number): void {
  db.prepare(`UPDATE api_keys SET last_used_at = ? WHERE id = ?`).run(Date.now(), keyId);
}
