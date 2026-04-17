import type { FastifyReply, FastifyRequest } from 'fastify';

type BucketKey = string;

interface Bucket {
  hits: number[];
}

const STORE = new Map<string, Map<BucketKey, Bucket>>();

function prune(hits: number[], windowMs: number): number[] {
  const now = Date.now();
  return hits.filter((t) => now - t < windowMs);
}

export interface LimitConfig {
  windowSec: number;
  max: number;
  keyPrefix: string;
}

/**
 * Per-IP sliding window rate limit for sensitive endpoints.
 * Returns `true` if request is allowed; `false` (and responds 429) if over limit.
 *
 * Usage:
 *   preHandler: (req, reply) => limitByIp(req, reply, { windowSec: 60, max: 10, keyPrefix: 'login' })
 */
export async function limitByIp(
  req: FastifyRequest,
  reply: FastifyReply,
  cfg: LimitConfig,
): Promise<boolean> {
  const store = STORE.get(cfg.keyPrefix) ?? new Map<BucketKey, Bucket>();
  STORE.set(cfg.keyPrefix, store);

  const ip = req.ip || 'unknown';
  const bucket = store.get(ip) ?? { hits: [] };
  bucket.hits = prune(bucket.hits, cfg.windowSec * 1000);
  if (bucket.hits.length >= cfg.max) {
    const oldest = bucket.hits[0] ?? Date.now();
    const retryAfter = Math.ceil((cfg.windowSec * 1000 - (Date.now() - oldest)) / 1000);
    reply.header('Retry-After', String(Math.max(1, retryAfter)));
    reply.code(429).send({ error: `Çok fazla istek. ${retryAfter}s sonra tekrar deneyin.` });
    return false;
  }
  bucket.hits.push(Date.now());
  store.set(ip, bucket);
  return true;
}
