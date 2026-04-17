import type { Database } from 'better-sqlite3';

export interface UserRecord {
  id: number;
  email: string;
  password_hash: string;
  name: string | null;
  plan: string;
  role: string;
  email_verified_at: number | null;
  disabled_at: number | null;
  created_at: number;
  updated_at: number;
}

export function findUserByEmail(db: Database, email: string): UserRecord | null {
  return (db.prepare(`SELECT * FROM users WHERE email = ?`).get(email.toLowerCase()) as UserRecord | undefined) ?? null;
}

export function findUserById(db: Database, id: number): UserRecord | null {
  return (db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as UserRecord | undefined) ?? null;
}

export function isWhitelistedAdmin(email: string): boolean {
  const raw = process.env.FONOLOJI_ADMIN_EMAILS ?? '';
  if (!raw) return false;
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

export function createUser(
  db: Database,
  args: { email: string; passwordHash: string; name?: string | null },
): UserRecord {
  const now = Date.now();
  const isAdmin = isWhitelistedAdmin(args.email);
  const role = isAdmin ? 'admin' : 'user';
  // Admin whitelist bypass: email is auto-verified, skip the code step.
  const verifiedAt = isAdmin ? now : null;
  const result = db
    .prepare(
      `INSERT INTO users (email, password_hash, name, plan, role, email_verified_at, created_at, updated_at)
       VALUES (?, ?, ?, 'free', ?, ?, ?, ?)`,
    )
    .run(args.email.toLowerCase(), args.passwordHash, args.name ?? null, role, verifiedAt, now, now);
  return findUserById(db, Number(result.lastInsertRowid))!;
}

export function setEmailVerified(db: Database, userId: number, verified: boolean): void {
  const now = Date.now();
  db.prepare(
    `UPDATE users SET email_verified_at = ?, updated_at = ? WHERE id = ?`,
  ).run(verified ? now : null, now, userId);
}

export function setDisabled(db: Database, userId: number, disabled: boolean): void {
  const now = Date.now();
  db.prepare(
    `UPDATE users SET disabled_at = ?, updated_at = ? WHERE id = ?`,
  ).run(disabled ? now : null, now, userId);
}

export function setPlan(db: Database, userId: number, plan: string): void {
  db.prepare(`UPDATE users SET plan = ?, updated_at = ? WHERE id = ?`).run(plan, Date.now(), userId);
}
