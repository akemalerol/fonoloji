interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<number, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
}

export function consume(keyId: number, perMinute: number): RateLimitResult {
  const now = Date.now();
  const minuteMs = 60_000;
  const bucket = buckets.get(keyId);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(keyId, { count: 1, resetAt: now + minuteMs });
    return { allowed: true, remaining: perMinute - 1, resetInMs: minuteMs };
  }
  if (bucket.count >= perMinute) {
    return { allowed: false, remaining: 0, resetInMs: bucket.resetAt - now };
  }
  bucket.count += 1;
  return { allowed: true, remaining: perMinute - bucket.count, resetInMs: bucket.resetAt - now };
}
