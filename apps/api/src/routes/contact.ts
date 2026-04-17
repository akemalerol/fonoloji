import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getDb } from '../db/index.js';
import { sendContactNotification } from '../services/mail.js';

const contactSchema = z.object({
  fullName: z.string().min(2, 'Ad soyad gerekli').max(200),
  email: z.string().email('Geçerli e-posta gerekli'),
  subject: z.string().min(2).max(300),
  message: z.string().min(5).max(5000),
});

interface Bucket {
  perMin: number[];
  perHour: number[];
}
const buckets = new Map<string, Bucket>();

function rateLimit(ip: string): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  const b = buckets.get(ip) ?? { perMin: [], perHour: [] };
  b.perMin = b.perMin.filter((t) => now - t < 60_000);
  b.perHour = b.perHour.filter((t) => now - t < 3_600_000);
  if (b.perMin.length >= 5) return { ok: false, retryAfter: 60 };
  if (b.perHour.length >= 20) return { ok: false, retryAfter: 3600 };
  b.perMin.push(now);
  b.perHour.push(now);
  buckets.set(ip, b);
  return { ok: true };
}

export const contactRoute: FastifyPluginAsync = async (app) => {
  app.post('/contact', async (req, reply) => {
    const rl = rateLimit(req.ip);
    if (!rl.ok) {
      reply.header('Retry-After', String(rl.retryAfter ?? 60));
      return reply.code(429).send({ error: 'Çok fazla istek. Biraz sonra tekrar deneyin.' });
    }
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? 'Geçersiz istek' });
    }

    const data = {
      fullName: parsed.data.fullName.trim(),
      email: parsed.data.email.toLowerCase().trim(),
      subject: parsed.data.subject.trim(),
      message: parsed.data.message.trim(),
    };

    const db = getDb();
    const now = Date.now();
    const result = db
      .prepare(
        `INSERT INTO contact_messages (full_name, email, subject, message, ip, user_agent, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(data.fullName, data.email, data.subject, data.message, req.ip, req.headers['user-agent'] ?? null, now);

    const adminEmail = process.env.FONOLOJI_CONTACT_TO ?? 'alikemal@fonoloji.com';
    sendContactNotification(adminEmail, data).catch((err) => {
      req.log.error({ err }, '[contact] notify error');
    });

    return reply.code(201).send({ ok: true, id: Number(result.lastInsertRowid) });
  });
};
