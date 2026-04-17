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
  // Per-user overrides win over plan defaults.
  const monthlyLimit = user.custom_monthly_quota ?? plan.monthlyQuota;
  const dailyLimit = user.custom_daily_quota ?? plan.dailyQuota;
  const rpmLimit = user.custom_rpm ?? plan.rateLimitPerMinute;

  const month = monthKey();
  const day = dayKey();

  const monthRow = db
    .prepare(`SELECT count FROM usage_counters WHERE key_id = ? AND period = ?`)
    .get(record.id, month) as { count: number } | undefined;
  const monthlyCount = monthRow?.count ?? 0;

  const dayRow = db
    .prepare(`SELECT count FROM usage_counters WHERE key_id = ? AND period = ?`)
    .get(record.id, day) as { count: number } | undefined;
  const dailyCount = dayRow?.count ?? 0;

  if (monthlyCount >= monthlyLimit) {
    reply.headers({
      'x-ratelimit-limit-monthly': monthlyLimit,
      'x-ratelimit-remaining-monthly': 0,
    });
    reply.code(429).send({
      error: `Aylık ${monthlyLimit.toLocaleString('tr-TR')} istek kotası doldu.`,
      plan: plan.id,
      contact: '/iletisim',
    });
    return;
  }

  if (dailyCount >= dailyLimit) {
    reply.headers({
      'x-ratelimit-limit-daily': dailyLimit,
      'x-ratelimit-remaining-daily': 0,
    });
    reply.code(429).send({
      error: `Günlük ${dailyLimit.toLocaleString('tr-TR')} istek kap'ı aşıldı. Yarın sıfırlanır.`,
      plan: plan.id,
      contact: '/iletisim',
    });
    return;
  }

  const rl = consume(record.id, rpmLimit);
  reply.headers({
    'x-ratelimit-limit': rpmLimit,
    'x-ratelimit-remaining': rl.remaining,
    'x-ratelimit-reset': Math.ceil(rl.resetInMs / 1000),
    'x-ratelimit-limit-daily': dailyLimit,
    'x-ratelimit-remaining-daily': Math.max(0, dailyLimit - dailyCount - 1),
    'x-ratelimit-limit-monthly': monthlyLimit,
    'x-ratelimit-remaining-monthly': Math.max(0, monthlyLimit - monthlyCount - 1),
  });
  if (!rl.allowed) {
    reply.header('retry-after', Math.ceil(rl.resetInMs / 1000));
    reply.code(429).send({
      error: `Dakikada ${rpmLimit} istek sınırı aşıldı.`,
      retryAfterSec: Math.ceil(rl.resetInMs / 1000),
    });
    return;
  }

  const incr = db.prepare(
    `INSERT INTO usage_counters (key_id, period, count) VALUES (?, ?, 1)
     ON CONFLICT(key_id, period) DO UPDATE SET count = count + 1`,
  );
  db.transaction(() => {
    incr.run(record.id, month);
    incr.run(record.id, day);
  })();
  touchKey(db, record.id);

  req.apiKey = { id: record.id, prefix: record.key_prefix };
  req.apiUser = user;
}
