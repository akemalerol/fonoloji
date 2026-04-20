import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getDb } from '../db/index.js';
import { logPageVisit } from '../services/tracking.js';

// Client-side beacon: tarayıcı her sayfa yüklemesinde buraya POST'lar.
// Admin paneli "canlı ziyaretçi" ve "popüler sayfa" görünümü için kullanılır.

const trackSchema = z.object({
  path: z.string().min(1).max(500),
  referer: z.string().max(500).optional().nullable(),
  sessionId: z.string().max(64).optional().nullable(),
});

function getIp(req: { headers: Record<string, string | string[] | undefined>; ip: string }): string {
  return (
    (req.headers['cf-connecting-ip'] as string) ||
    (req.headers['x-real-ip'] as string) ||
    ((req.headers['x-forwarded-for'] as string) ?? '').split(',')[0]?.trim() ||
    req.ip ||
    'unknown'
  );
}

export const trackRoute: FastifyPluginAsync = async (app) => {
  app.post('/track', async (req, reply) => {
    const parsed = trackSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ ok: false });
    const { path, referer, sessionId } = parsed.data;

    // URL saniteliği: sorgu stringini kırp
    const cleanPath = path.split('?')[0] ?? path;
    if (cleanPath.length > 200) return reply.code(400).send({ ok: false });

    const userId =
      (req as unknown as { user?: { sub: number } }).user?.sub ?? null;

    logPageVisit(getDb(), {
      path: cleanPath,
      ip: getIp(req),
      userId,
      userAgent: (req.headers['user-agent'] as string) ?? null,
      referer: referer ?? null,
      sessionId: sessionId ?? null,
    });

    return { ok: true };
  });
};
