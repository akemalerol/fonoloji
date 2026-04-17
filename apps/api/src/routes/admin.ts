import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getDb } from '../db/index.js';
import { planFor, PLANS } from '../auth/plans.js';
import { findUserById, setCustomLimits, setDisabled, setEmailVerified, setPlan, type UserRecord } from '../auth/users.js';
import { sendAdminBroadcast, sendContactReply } from '../services/mail.js';
import { generateTweet, postTweet, queueTweet, type TweetContext } from '../services/x.js';

const COOKIE_NAME = 'fonoloji_session';

async function readAdmin(req: FastifyRequest): Promise<UserRecord | null> {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    const payload = (await req.server.jwt.verify(token)) as { uid: number };
    const user = findUserById(getDb(), payload.uid);
    if (!user || user.role !== 'admin') return null;
    return user;
  } catch {
    return null;
  }
}

async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const user = await readAdmin(req);
  if (!user) {
    reply.code(403).send({ error: 'Yetkisiz' });
    return;
  }
  (req as FastifyRequest & { adminUser: UserRecord }).adminUser = user;
}

const planSchema = z.object({
  plan: z.enum(['free']),
});

export const adminRoute: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', requireAdmin);

  app.get('/stats', async () => {
    const db = getDb();
    const today = new Date();
    const day = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;
    const month = day.slice(0, 7);

    const users = db.prepare(`SELECT COUNT(*) as c FROM users`).get() as { c: number };
    const keys = db.prepare(`SELECT COUNT(*) as c FROM api_keys WHERE revoked_at IS NULL`).get() as { c: number };
    const reqToday = db
      .prepare(`SELECT SUM(count) as c FROM usage_counters WHERE period = ?`)
      .get(day) as { c: number | null };
    const reqMonth = db
      .prepare(`SELECT SUM(count) as c FROM usage_counters WHERE period = ?`)
      .get(month) as { c: number | null };

    const planDist = db
      .prepare(`SELECT plan, COUNT(*) as c FROM users GROUP BY plan`)
      .all() as Array<{ plan: string; c: number }>;

    // Last 14 days
    const days: Array<{ date: string; count: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      const row = db
        .prepare(`SELECT SUM(count) as c FROM usage_counters WHERE period = ?`)
        .get(k) as { c: number | null };
      days.push({ date: k, count: row.c ?? 0 });
    }

    return {
      totals: {
        users: users.c,
        activeKeys: keys.c,
        requestsToday: reqToday.c ?? 0,
        requestsMonth: reqMonth.c ?? 0,
      },
      planDistribution: planDist,
      last14days: days,
    };
  });

  app.get('/users', async (req) => {
    const { q } = (req.query as { q?: string }) ?? {};
    const db = getDb();
    const month = new Date().toISOString().slice(0, 7);
    const where = q ? `WHERE u.email LIKE ? OR u.name LIKE ?` : '';
    const params = q ? [`%${q.toLowerCase()}%`, `%${q}%`] : [];

    const rows = db
      .prepare(
        `SELECT u.id, u.email, u.name, u.plan, u.role, u.created_at, u.email_verified_at,
                u.custom_monthly_quota, u.custom_daily_quota, u.custom_rpm, u.limit_note,
                (SELECT COUNT(*) FROM api_keys k WHERE k.user_id = u.id AND k.revoked_at IS NULL) as key_count,
                (SELECT COALESCE(SUM(uc.count), 0) FROM usage_counters uc
                 JOIN api_keys k ON k.id = uc.key_id
                 WHERE k.user_id = u.id AND uc.period = ?) as usage_month
         FROM users u
         ${where}
         ORDER BY u.created_at DESC
         LIMIT 200`,
      )
      .all(month, ...params);

    return { items: rows };
  });

  app.get('/users/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const db = getDb();
    const user = findUserById(db, id);
    if (!user) return reply.code(404).send({ error: 'Kullanıcı bulunamadı' });

    const month = new Date().toISOString().slice(0, 7);
    const keys = db
      .prepare(
        `SELECT id, key_prefix, name, created_at, last_used_at, revoked_at
         FROM api_keys WHERE user_id = ? ORDER BY created_at DESC`,
      )
      .all(id);
    const monthlyUsage = db
      .prepare(
        `SELECT COALESCE(SUM(count), 0) as c FROM usage_counters uc
         JOIN api_keys k ON k.id = uc.key_id
         WHERE k.user_id = ? AND uc.period = ?`,
      )
      .get(id, month) as { c: number };

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        role: user.role,
        created_at: user.created_at,
      },
      keys,
      usage: { period: month, count: monthlyUsage.c },
      plan: planFor(user.plan),
    };
  });

  app.post('/users/:id/plan', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const parsed = planSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Geçersiz plan' });
    const db = getDb();
    const user = findUserById(db, id);
    if (!user) return reply.code(404).send({ error: 'Kullanıcı bulunamadı' });
    setPlan(db, id, parsed.data.plan);
    return { ok: true, plan: parsed.data.plan };
  });

  const limitsSchema = z.object({
    monthlyQuota: z.number().int().min(0).max(10_000_000).nullable(),
    dailyQuota: z.number().int().min(0).max(1_000_000).nullable(),
    rpm: z.number().int().min(0).max(10_000).nullable(),
    note: z.string().max(200).nullable(),
  });

  app.post('/users/:id/limits', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const parsed = limitsSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Geçersiz limit değerleri', details: parsed.error.flatten() });
    const db = getDb();
    const user = findUserById(db, id);
    if (!user) return reply.code(404).send({ error: 'Kullanıcı bulunamadı' });
    setCustomLimits(db, id, parsed.data);
    const fresh = findUserById(db, id)!;
    return {
      ok: true,
      custom_monthly_quota: fresh.custom_monthly_quota,
      custom_daily_quota: fresh.custom_daily_quota,
      custom_rpm: fresh.custom_rpm,
      limit_note: fresh.limit_note,
    };
  });

  app.get('/keys', async () => {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT k.id, k.key_prefix, k.name, k.created_at, k.last_used_at, k.revoked_at,
                u.email as user_email, u.id as user_id, u.plan as user_plan
         FROM api_keys k
         JOIN users u ON u.id = k.user_id
         ORDER BY k.last_used_at DESC NULLS LAST, k.created_at DESC
         LIMIT 200`,
      )
      .all();
    return { items: rows };
  });

  app.delete('/keys/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const db = getDb();
    const result = db
      .prepare(`UPDATE api_keys SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL`)
      .run(Date.now(), id);
    return reply.code(result.changes > 0 ? 200 : 404).send({ ok: result.changes > 0 });
  });

  app.get('/plans', async () => ({ items: Object.values(PLANS) }));

  // Contact messages (admin-only)
  app.get('/messages', async (req) => {
    const { q, unread } = (req.query as { q?: string; unread?: string }) ?? {};
    const db = getDb();
    const where: string[] = [];
    const params: unknown[] = [];
    if (unread === '1') where.push(`is_read = 0`);
    if (q) {
      where.push(`(full_name LIKE ? OR email LIKE ? OR subject LIKE ?)`);
      params.push(`%${q}%`, `%${q.toLowerCase()}%`, `%${q}%`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = db
      .prepare(
        `SELECT id, full_name, email, subject, message, is_read, replied_at, reply_subject,
                reply_body, created_at
         FROM contact_messages
         ${whereSql}
         ORDER BY created_at DESC
         LIMIT 500`,
      )
      .all(...params);
    const unreadCount = (db
      .prepare(`SELECT COUNT(*) as c FROM contact_messages WHERE is_read = 0`)
      .get() as { c: number }).c;
    return { items: rows, unreadCount };
  });

  app.post('/messages/:id/read', async (req) => {
    const id = Number((req.params as { id: string }).id);
    const db = getDb();
    db.prepare(`UPDATE contact_messages SET is_read = 1 WHERE id = ?`).run(id);
    return { ok: true };
  });

  app.delete('/messages/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const db = getDb();
    const result = db.prepare(`DELETE FROM contact_messages WHERE id = ?`).run(id);
    return reply.code(result.changes > 0 ? 200 : 404).send({ ok: result.changes > 0 });
  });

  const replySchema = z.object({
    subject: z.string().min(2).max(300),
    body: z.string().min(3).max(20_000),
  });

  app.post('/messages/:id/reply', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const parsed = replySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Geçersiz istek' });
    }
    const db = getDb();
    const msg = db
      .prepare(
        `SELECT id, full_name, email, subject, message FROM contact_messages WHERE id = ?`,
      )
      .get(id) as
      | { id: number; full_name: string; email: string; subject: string; message: string }
      | undefined;
    if (!msg) return reply.code(404).send({ error: 'Mesaj bulunamadı' });

    const result = await sendContactReply(msg.email, {
      subject: parsed.data.subject,
      body: parsed.data.body,
      originalSubject: msg.subject,
      originalMessage: msg.message,
      customerName: msg.full_name,
    });

    if (!result.ok) {
      return reply.code(502).send({ error: result.error ?? 'Mail gönderilemedi' });
    }

    const now = Date.now();
    db.prepare(
      `UPDATE contact_messages
       SET is_read = 1, replied_at = ?, reply_subject = ?, reply_body = ?
       WHERE id = ?`,
    ).run(now, parsed.data.subject, parsed.data.body, id);

    return { ok: true, repliedAt: now };
  });

  // Admin: verification toggle (baypass)
  app.post('/users/:id/verify-email', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const db = getDb();
    const user = findUserById(db, id);
    if (!user) return reply.code(404).send({ error: 'Kullanıcı bulunamadı' });
    setEmailVerified(db, id, true);
    return { ok: true, verified: true };
  });

  app.post('/users/:id/unverify-email', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const db = getDb();
    const user = findUserById(db, id);
    if (!user) return reply.code(404).send({ error: 'Kullanıcı bulunamadı' });
    setEmailVerified(db, id, false);
    return { ok: true, verified: false };
  });

  app.post('/users/:id/disable', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const db = getDb();
    const user = findUserById(db, id);
    if (!user) return reply.code(404).send({ error: 'Kullanıcı bulunamadı' });
    setDisabled(db, id, true);
    return { ok: true, disabled: true };
  });

  app.post('/users/:id/enable', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const db = getDb();
    const user = findUserById(db, id);
    if (!user) return reply.code(404).send({ error: 'Kullanıcı bulunamadı' });
    setDisabled(db, id, false);
    return { ok: true, disabled: false };
  });

  // Admin broadcast mail
  const mailSchema = z.object({
    from: z.enum(['no-reply', 'hello', 'alikemal']).default('no-reply'),
    recipients: z.enum(['single', 'all-verified', 'all']).default('single'),
    to: z.string().email().optional(),
    subject: z.string().min(2).max(300),
    body: z.string().min(3).max(50_000),
    html: z.boolean().optional().default(false),
  });

  app.post('/mail/send', async (req, reply) => {
    const parsed = mailSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Geçersiz istek' });
    }
    const { from, recipients, to, subject, body, html } = parsed.data;
    const db = getDb();

    let targets: string[] = [];
    if (recipients === 'single') {
      if (!to) return reply.code(400).send({ error: 'Tek alıcı modunda "to" gerekli' });
      targets = [to];
    } else if (recipients === 'all-verified') {
      targets = (db
        .prepare(`SELECT email FROM users WHERE email_verified_at IS NOT NULL AND disabled_at IS NULL`)
        .all() as { email: string }[]).map((u) => u.email);
    } else {
      targets = (db
        .prepare(`SELECT email FROM users WHERE disabled_at IS NULL`)
        .all() as { email: string }[]).map((u) => u.email);
    }

    if (targets.length === 0) {
      return reply.code(400).send({ error: 'Hedef alıcı bulunamadı' });
    }
    if (targets.length > 500) {
      return reply.code(400).send({ error: 'Tek seferde max 500 alıcı (şu anda ' + targets.length + ')' });
    }

    const result = await sendAdminBroadcast({ from, to: targets, subject, body, isHtml: html });
    return { ok: result.ok, sent: result.sent, failed: result.failed, error: result.error };
  });

  // ── X (Twitter) admin endpoints ───────────────────────────────────────────
  app.get('/x/queue', async () => {
    const db = getDb();
    const items = db
      .prepare(
        `SELECT id, content, kind, status, scheduled_at, posted_at, tweet_id, error, created_at
         FROM x_posts ORDER BY created_at DESC LIMIT 50`,
      )
      .all();
    return { items };
  });

  const tweetGenSchema = z.object({
    kind: z.enum(['daily_digest', 'fund_highlight', 'cpi_update', 'custom']),
    customPrompt: z.string().max(500).optional(),
  });

  app.post('/x/generate', async (req, reply) => {
    const parsed = tweetGenSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Geçersiz istek' });
    const db = getDb();

    const ctx: TweetContext = { kind: parsed.data.kind };
    if (parsed.data.kind === 'daily_digest') {
      ctx.topGainers = db
        .prepare(
          `SELECT m.code, m.return_1d as change FROM metrics m JOIN funds f ON f.code = m.code
           WHERE m.return_1d IS NOT NULL AND m.current_price > 0.001 AND m.return_1d > -0.95 AND m.return_1d < 5
             AND (m.aum IS NULL OR m.aum > 10000 OR m.investor_count > 0)
             AND f.trading_status LIKE '%TEFAS%işlem görüyor%'
           ORDER BY m.return_1d DESC LIMIT 5`,
        )
        .all() as Array<{ code: string; change: number }>;
      ctx.topLosers = db
        .prepare(
          `SELECT m.code, m.return_1d as change FROM metrics m JOIN funds f ON f.code = m.code
           WHERE m.return_1d IS NOT NULL AND m.current_price > 0.001 AND m.return_1d > -0.95 AND m.return_1d < 5
             AND (m.aum IS NULL OR m.aum > 10000 OR m.investor_count > 0)
             AND f.trading_status LIKE '%TEFAS%işlem görüyor%'
           ORDER BY m.return_1d ASC LIMIT 5`,
        )
        .all() as Array<{ code: string; change: number }>;
      ctx.trendRising = db
        .prepare(
          `SELECT f.code, f.name FROM funds f JOIN metrics m ON m.code = f.code
           WHERE m.ma_30 > m.ma_200 AND m.ma_200 > 0 AND m.return_1m > 0 AND m.aum > 10000000
           ORDER BY m.return_1m DESC LIMIT 5`,
        )
        .all() as Array<{ code: string; name: string }>;
      ctx.topInflow = db
        .prepare(
          `SELECT m.code, m.flow_1m FROM metrics m
           WHERE m.flow_1m IS NOT NULL AND m.flow_1m > 0
           ORDER BY m.flow_1m DESC LIMIT 5`,
        )
        .all()
        .map((r: any) => ({
          code: r.code,
          flowLabel: r.flow_1m >= 1e9 ? `+₺${(r.flow_1m / 1e9).toFixed(1)}Mr` : `+₺${(r.flow_1m / 1e6).toFixed(0)}Mn`,
        }));
    } else if (parsed.data.kind === 'cpi_update') {
      const cpi = db
        .prepare(`SELECT date, yoy_change, mom_change FROM cpi_tr ORDER BY date DESC LIMIT 1`)
        .get() as { date: string; yoy_change: number; mom_change: number | null } | undefined;
      if (cpi) ctx.cpi = { yoy: cpi.yoy_change, mom: cpi.mom_change, month: cpi.date.slice(0, 7) };
    } else if (parsed.data.kind === 'custom') {
      ctx.customPrompt = parsed.data.customPrompt;
    }

    const text = await generateTweet(ctx);
    if (!text) return reply.code(502).send({ error: 'Üretilemedi (OPENAI_API_KEY?)' });
    return { text };
  });

  const tweetPostSchema = z.object({
    content: z.string().min(1).max(280),
    kind: z.string().optional(),
    queue: z.boolean().optional(), // true = save to queue without posting
    scheduledAt: z.number().optional(),
  });

  app.post('/x/post', async (req, reply) => {
    const parsed = tweetPostSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Geçersiz istek' });
    const db = getDb();

    if (parsed.data.queue) {
      const id = queueTweet(db, {
        content: parsed.data.content,
        kind: parsed.data.kind,
        scheduledAt: parsed.data.scheduledAt,
      });
      return { ok: true, id, queued: true };
    }

    // Immediate send
    const result = await postTweet(parsed.data.content);
    const now = Date.now();
    const id = queueTweet(db, { content: parsed.data.content, kind: parsed.data.kind });
    if (result.ok) {
      db.prepare(
        `UPDATE x_posts SET status = 'sent', posted_at = ?, tweet_id = ? WHERE id = ?`,
      ).run(now, result.tweetId ?? null, id);
      return { ok: true, id, tweetId: result.tweetId };
    }
    db.prepare(`UPDATE x_posts SET status = 'failed', error = ? WHERE id = ?`).run(result.error ?? 'unknown', id);
    return reply.code(502).send({ ok: false, id, error: result.error });
  });

  app.delete('/x/posts/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const db = getDb();
    const r = db.prepare(`DELETE FROM x_posts WHERE id = ? AND status != 'sent'`).run(id);
    return reply.code(r.changes > 0 ? 200 : 404).send({ ok: r.changes > 0 });
  });
};
