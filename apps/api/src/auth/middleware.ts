import type { FastifyReply, FastifyRequest } from 'fastify';
import { getDb } from '../db/index.js';
import { findActiveKey, touchKey } from './keys.js';
import { planFor } from './plans.js';
import { consume } from './rateLimiter.js';
import { findUserById, type UserRecord } from './users.js';

declare module 'fastify' {
  interface FastifyRequest {
    apiKey?: { id: number; prefix: string };
    apiUser?: UserRecord;
  }
}

function monthKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function dayKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export async function requireApiKey(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const headerKey = (req.headers['x-api-key'] as string | undefined) ?? undefined;
  const queryKey =
    typeof (req.query as { api_key?: string })?.api_key === 'string'
      ? (req.query as { api_key: string }).api_key
      : undefined;
  const auth = req.headers.authorization ?? '';
  const bearerKey = auth.startsWith('Bearer ') ? auth.slice(7) : undefined;
  const plain = headerKey ?? queryKey ?? bearerKey;

  if (!plain) {
    reply.code(401).send({
      error: 'API anahtarı gerekli. X-API-Key başlığını ekleyin.',
      docs: '/api-docs',
    });
    return;
  }

  const db = getDb();
  const record = findActiveKey(db, plain);
  if (!record) {
    reply.code(401).send({ error: 'Geçersiz veya iptal edilmiş API anahtarı.' });
    return;
  }
  const user = findUserById(db, record.user_id);
  if (!user) {
    reply.code(401).send({ error: 'Anahtara bağlı kullanıcı bulunamadı.' });
    return;
  }

  const plan = planFor(user.plan);

  // Monthly quota check
  const month = monthKey();
  const row = db
    .prepare(`SELECT count FROM usage_counters WHERE key_id = ? AND period = ?`)
    .get(record.id, month) as { count: number } | undefined;
  const monthlyCount = row?.count ?? 0;
  if (monthlyCount >= plan.monthlyQuota) {
    reply.headers({
      'x-ratelimit-limit-monthly': plan.monthlyQuota,
      'x-ratelimit-remaining-monthly': 0,
    });
    reply
      .code(429)
      .send({
        error: `Aylık ${plan.monthlyQuota.toLocaleString('tr-TR')} istek kotası doldu. Planınızı yükseltin.`,
        plan: plan.id,
        upgradeUrl: '/fiyatlandirma',
      });
    return;
  }

  // Per-minute rate limit
  const rl = consume(record.id, plan.rateLimitPerMinute);
  reply.headers({
    'x-ratelimit-limit': plan.rateLimitPerMinute,
    'x-ratelimit-remaining': rl.remaining,
    'x-ratelimit-reset': Math.ceil(rl.resetInMs / 1000),
    'x-ratelimit-limit-monthly': plan.monthlyQuota,
    'x-ratelimit-remaining-monthly': Math.max(0, plan.monthlyQuota - monthlyCount - 1),
  });
  if (!rl.allowed) {
    reply.header('retry-after', Math.ceil(rl.resetInMs / 1000));
    reply.code(429).send({
      error: `Dakikada ${plan.rateLimitPerMinute} istek sınırı aşıldı.`,
      retryAfterSec: Math.ceil(rl.resetInMs / 1000),
    });
    return;
  }

  // Increment & touch (both monthly and daily buckets)
  const incr = db.prepare(
    `INSERT INTO usage_counters (key_id, period, count) VALUES (?, ?, 1)
     ON CONFLICT(key_id, period) DO UPDATE SET count = count + 1`,
  );
  const day = dayKey();
  db.transaction(() => {
    incr.run(record.id, month);
    incr.run(record.id, day);
  })();
  touchKey(db, record.id);

  req.apiKey = { id: record.id, prefix: record.key_prefix };
  req.apiUser = user;
}
