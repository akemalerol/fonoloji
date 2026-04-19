import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getDb } from '../db/index.js';
import { findUserById, type UserRecord } from '../auth/users.js';

const COOKIE_NAME = 'fonoloji_session';

async function readUser(req: FastifyRequest): Promise<UserRecord | null> {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    const payload = (await req.server.jwt.verify(token)) as { uid: number };
    return findUserById(getDb(), payload.uid);
  } catch {
    return null;
  }
}

async function requireUser(req: FastifyRequest, reply: FastifyReply): Promise<UserRecord | null> {
  const user = await readUser(req);
  if (!user) {
    reply.code(401).send({ error: 'Oturum gerekli' });
    return null;
  }
  if (user.disabled_at) {
    reply.code(403).send({ error: 'Hesap pasif' });
    return null;
  }
  return user;
}

const alertSchema = z.object({
  code: z.string().min(2).max(6).transform((s) => s.toUpperCase()),
  kind: z.enum(['price_above', 'price_below', 'return_above', 'return_below']),
  threshold: z.number(),
});

export const portfolioRoute: FastifyPluginAsync = async (app) => {
  // ALERTS
  app.get('/alerts', async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT a.*, f.name, m.current_price, m.return_1m FROM price_alerts a
         LEFT JOIN funds f ON f.code = a.code
         LEFT JOIN metrics m ON m.code = a.code
         WHERE a.user_id = ? ORDER BY a.created_at DESC`,
      )
      .all(user.id);
    return { items: rows };
  });

  app.post('/alerts', async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const parsed = alertSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Geçersiz istek' });
    }
    const db = getDb();
    const count = (db
      .prepare(`SELECT COUNT(*) as c FROM price_alerts WHERE user_id = ? AND enabled = 1`)
      .get(user.id) as { c: number }).c;
    if (count >= 20) {
      return reply.code(400).send({ error: 'Max 20 aktif alarm' });
    }
    const r = db
      .prepare(
        `INSERT INTO price_alerts (user_id, code, kind, threshold, enabled, created_at) VALUES (?, ?, ?, ?, 1, ?)`,
      )
      .run(user.id, parsed.data.code, parsed.data.kind, parsed.data.threshold, Date.now());
    return { id: Number(r.lastInsertRowid), ok: true };
  });

  app.delete('/alerts/:id', async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const id = Number((req.params as { id: string }).id);
    const db = getDb();
    const result = db
      .prepare(`DELETE FROM price_alerts WHERE id = ? AND user_id = ?`)
      .run(id, user.id);
    return reply.code(result.changes > 0 ? 200 : 404).send({ ok: result.changes > 0 });
  });

  // KAP ALERTS — per-fund, no threshold. User opts in for a fund; email sent on new disclosure.
  app.get('/kap-alerts', async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT a.id, a.fund_code, a.enabled, a.last_notified_at, a.created_at, f.name
         FROM kap_alerts a LEFT JOIN funds f ON f.code = a.fund_code
         WHERE a.user_id = ? ORDER BY a.created_at DESC`,
      )
      .all(user.id);
    return { items: rows };
  });

  app.get('/kap-alerts/status', async (req, reply) => {
    const user = await readUser(req);
    if (!user) return { enabled: false, anonymous: true };
    const { code } = req.query as { code?: string };
    if (!code) return reply.code(400).send({ error: 'code gerekli' });
    const db = getDb();
    const row = db
      .prepare(`SELECT id, enabled FROM kap_alerts WHERE user_id = ? AND fund_code = ?`)
      .get(user.id, code.toUpperCase()) as { id: number; enabled: number } | undefined;
    return { enabled: Boolean(row && row.enabled), id: row?.id ?? null };
  });

  const kapAlertSchema = z.object({
    code: z.string().min(2).max(8).transform((s) => s.toUpperCase()),
  });

  app.post('/kap-alerts', async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const parsed = kapAlertSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Geçersiz istek' });
    const db = getDb();

    // Max 50 KAP alarmı — yüksek tuttum, bu sadece fon başına flag
    const count = (db
      .prepare(`SELECT COUNT(*) as c FROM kap_alerts WHERE user_id = ? AND enabled = 1`)
      .get(user.id) as { c: number }).c;
    if (count >= 50) {
      return reply.code(400).send({ error: 'Max 50 aktif KAP takibi' });
    }

    // Upsert — aynı fon için tekrar enable edilebilsin
    const existing = db
      .prepare(`SELECT id, enabled FROM kap_alerts WHERE user_id = ? AND fund_code = ?`)
      .get(user.id, parsed.data.code) as { id: number; enabled: number } | undefined;

    if (existing) {
      db.prepare(`UPDATE kap_alerts SET enabled = 1 WHERE id = ?`).run(existing.id);
      return { id: existing.id, ok: true };
    }
    const r = db
      .prepare(`INSERT INTO kap_alerts (user_id, fund_code, enabled, created_at) VALUES (?, ?, 1, ?)`)
      .run(user.id, parsed.data.code, Date.now());
    return { id: Number(r.lastInsertRowid), ok: true };
  });

  app.delete('/kap-alerts', async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const { code } = req.query as { code?: string };
    if (!code) return reply.code(400).send({ error: 'code gerekli' });
    const db = getDb();
    const result = db
      .prepare(`UPDATE kap_alerts SET enabled = 0 WHERE user_id = ? AND fund_code = ?`)
      .run(user.id, code.toUpperCase());
    return reply.code(result.changes > 0 ? 200 : 404).send({ ok: result.changes > 0 });
  });

  // WATCHLIST — "izliyorum" listesi. Portföyden ve alarmlardan ayrı.
  app.get('/watchlist', async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT w.id, w.fund_code, w.folder, w.created_at, f.name, f.category, f.risk_score,
                m.current_price, m.return_1m, m.return_1y, m.return_ytd, m.aum, m.sharpe_90
         FROM watchlist w
         LEFT JOIN funds f ON f.code = w.fund_code
         LEFT JOIN metrics m ON m.code = w.fund_code
         WHERE w.user_id = ?
         ORDER BY w.folder IS NULL, w.folder, w.created_at DESC`,
      )
      .all(user.id);
    return { items: rows };
  });

  app.get('/watchlist/status', async (req, reply) => {
    const user = await readUser(req);
    if (!user) return { enabled: false, anonymous: true };
    const { code } = req.query as { code?: string };
    if (!code) return reply.code(400).send({ error: 'code gerekli' });
    const db = getDb();
    const row = db
      .prepare(`SELECT id FROM watchlist WHERE user_id = ? AND fund_code = ?`)
      .get(user.id, code.toUpperCase()) as { id: number } | undefined;
    return { enabled: Boolean(row), id: row?.id ?? null };
  });

  const watchlistSchema = z.object({
    code: z.string().min(2).max(8).transform((s) => s.toUpperCase()),
    folder: z.string().max(40).nullable().optional(),
  });

  app.patch('/watchlist', async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const body = (req.body ?? {}) as { code?: string; folder?: string | null };
    if (!body.code) return reply.code(400).send({ error: 'code gerekli' });
    const db = getDb();
    const result = db
      .prepare(`UPDATE watchlist SET folder = ? WHERE user_id = ? AND fund_code = ?`)
      .run(body.folder ?? null, user.id, body.code.toUpperCase());
    return reply.code(result.changes > 0 ? 200 : 404).send({ ok: result.changes > 0 });
  });

  app.post('/watchlist', async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const parsed = watchlistSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Geçersiz istek' });
    const db = getDb();
    // Max 100 watchlist item
    const count = (db
      .prepare(`SELECT COUNT(*) as c FROM watchlist WHERE user_id = ?`)
      .get(user.id) as { c: number }).c;
    if (count >= 100) return reply.code(400).send({ error: 'Max 100 takip' });
    try {
      const r = db
        .prepare(`INSERT INTO watchlist (user_id, fund_code, created_at) VALUES (?, ?, ?)`)
        .run(user.id, parsed.data.code, Date.now());
      return { id: Number(r.lastInsertRowid), ok: true };
    } catch {
      // UNIQUE constraint — zaten var
      return { ok: true };
    }
  });

  app.delete('/watchlist', async (req, reply) => {
    const user = await requireUser(req, reply);
    if (!user) return;
    const { code } = req.query as { code?: string };
    if (!code) return reply.code(400).send({ error: 'code gerekli' });
    const db = getDb();
    const result = db
      .prepare(`DELETE FROM watchlist WHERE user_id = ? AND fund_code = ?`)
      .run(user.id, code.toUpperCase());
    return reply.code(result.changes > 0 ? 200 : 404).send({ ok: result.changes > 0 });
  });

  // Sosyal kanıt — fon için kaç kullanıcı takipte/alarmda/portföyde.
  // Privacy: sadece sayı, hiç kimlik sızdırmaz. Anonim / girişsiz kullanıcıya da açık.
  app.get('/funds/:code/social-proof', async (req) => {
    const { code } = req.params as { code: string };
    const db = getDb();
    const upper = code.toUpperCase();
    const watchlistCount = (db
      .prepare(`SELECT COUNT(DISTINCT user_id) as c FROM watchlist WHERE fund_code = ?`)
      .get(upper) as { c: number }).c;
    const alertCount = (db
      .prepare(`SELECT COUNT(DISTINCT user_id) as c FROM price_alerts WHERE code = ? AND enabled = 1`)
      .get(upper) as { c: number }).c;
    const kapAlertCount = (db
      .prepare(`SELECT COUNT(DISTINCT user_id) as c FROM kap_alerts WHERE fund_code = ? AND enabled = 1`)
      .get(upper) as { c: number }).c;
    const portfolioCount = (db
      .prepare(
        `SELECT COUNT(DISTINCT p.user_id) as c FROM portfolio_holdings h
         JOIN virtual_portfolios p ON p.id = h.portfolio_id WHERE h.code = ?`,
      )
      .get(upper) as { c: number }).c;
    return {
      code: upper,
      watchlist: watchlistCount,
      priceAlerts: alertCount,
      kapAlerts: kapAlertCount,
      portfolio: portfolioCount,
      total: watchlistCount + alertCount + kapAlertCount + portfolioCount,
    };
  });

  // Fund changes audit (public feed — last 100)
  app.get('/fund-changes', async () => {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT c.id, c.code, c.field, c.old_value, c.new_value, c.detected_at, f.name
         FROM fund_changes c LEFT JOIN funds f ON f.code = c.code
         ORDER BY c.detected_at DESC LIMIT 100`,
      )
      .all();
    return { items: rows };
  });
};
