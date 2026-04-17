import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getDb } from '../db/index.js';
import { limitByIp } from '../auth/authLimiter.js';
import { createApiKey, listKeysForUser, revokeKey } from '../auth/keys.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { planFor, PLANS } from '../auth/plans.js';
import { createUser, findUserByEmail, findUserById, type UserRecord } from '../auth/users.js';
import {
  canResendFor,
  consumeVerification,
  createVerification,
  findActiveVerification,
  markEmailVerified,
} from '../auth/verifications.js';
import { generateVerifyCode, sendVerificationEmail } from '../services/mail.js';

const COOKIE_NAME = 'fonoloji_session';
const MAX_AGE_SEC = 60 * 60 * 24 * 30;

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: UserRecord;
  }
}

export interface AuthTokenPayload {
  uid: number;
  email: string;
}

async function setSession(reply: FastifyReply, user: UserRecord): Promise<void> {
  const token = await reply.server.jwt.sign({ uid: user.id, email: user.email });
  reply.setCookie(COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE_SEC,
  });
}

function clearSession(reply: FastifyReply): void {
  reply.clearCookie(COOKIE_NAME, { path: '/' });
}

async function readSession(req: FastifyRequest): Promise<UserRecord | null> {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    const payload = (await req.server.jwt.verify(token)) as AuthTokenPayload;
    return findUserById(getDb(), payload.uid);
  } catch {
    return null;
  }
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const user = await readSession(req);
  if (!user) {
    reply.code(401).send({ error: 'Yetkilendirme gerekli' });
    return;
  }
  req.authUser = user;
}

const registerSchema = z.object({
  email: z.string().email('Geçerli e-posta gerekli').max(200),
  password: z.string().min(8, 'Şifre en az 8 karakter').max(200),
  name: z.string().max(80).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6).regex(/^\d+$/),
});

const resendSchema = z.object({
  email: z.string().email(),
});

const keyCreateSchema = z.object({
  name: z.string().max(80).optional(),
});

export const authRoute: FastifyPluginAsync = async (app) => {
  app.post('/register', async (req, reply) => {
    if (!(await limitByIp(req, reply, { keyPrefix: 'register', windowSec: 3600, max: 5 }))) return;
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten().fieldErrors });
    }
    const db = getDb();
    const existing = findUserByEmail(db, parsed.data.email);
    if (existing) {
      if (existing.email_verified_at) {
        return reply.code(409).send({ error: 'Bu e-posta zaten kayıtlı' });
      }
      // Same email not yet verified — resend code (after cooldown check)
      const cd = canResendFor(db, existing.id);
      if (!cd.ok) {
        return reply
          .code(429)
          .send({ error: `Biraz bekleyin, ${cd.retryAfterSec}s sonra tekrar deneyin.` });
      }
      const code = generateVerifyCode();
      createVerification(db, existing.id, code);
      const result = await sendVerificationEmail(parsed.data.email, code, existing.name);
      return {
        status: 'verify_required',
        email: existing.email,
        mail: { sent: result.ok, error: result.error, devCode: result.devCode },
      };
    }

    const user = createUser(db, {
      email: parsed.data.email,
      passwordHash: hashPassword(parsed.data.password),
      name: parsed.data.name ?? null,
    });

    // Admin whitelist: auto-verified in createUser → skip email, log in directly.
    if (user.email_verified_at) {
      const keys = listKeysForUser(db, user.id);
      let apiKeyReveal: { id: number; plain: string; prefix: string; name: string | null } | undefined;
      if (keys.length === 0) {
        const { plain, record: keyRecord } = createApiKey(db, user.id, 'Default');
        apiKeyReveal = { id: keyRecord.id, plain, prefix: keyRecord.key_prefix, name: keyRecord.name };
      }
      await setSession(reply, user);
      return reply.code(201).send({
        status: 'verified',
        user: sanitizeUser(user),
        plan: planFor(user.plan),
        apiKey: apiKeyReveal,
      });
    }

    const code = generateVerifyCode();
    createVerification(db, user.id, code);
    const result = await sendVerificationEmail(user.email, code, user.name);
    return reply.code(201).send({
      status: 'verify_required',
      email: user.email,
      mail: { sent: result.ok, error: result.error, devCode: result.devCode },
    });
  });

  app.post('/verify', async (req, reply) => {
    if (!(await limitByIp(req, reply, { keyPrefix: 'verify', windowSec: 60, max: 10 }))) return;
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Geçersiz doğrulama bilgisi' });
    const db = getDb();
    const user = findUserByEmail(db, parsed.data.email);
    if (!user) return reply.code(404).send({ error: 'Hesap bulunamadı' });
    if (user.email_verified_at) {
      await setSession(reply, user);
      return { status: 'already_verified', user: sanitizeUser(user), plan: planFor(user.plan) };
    }
    const record = findActiveVerification(db, user.id, parsed.data.code);
    if (!record) return reply.code(400).send({ error: 'Kod hatalı veya süresi dolmuş' });

    consumeVerification(db, record.id);
    markEmailVerified(db, user.id);
    const fresh = findUserById(db, user.id)!;

    // Create default API key on first verification if none exists
    const keys = listKeysForUser(db, user.id);
    let apiKeyReveal: { id: number; plain: string; prefix: string; name: string | null } | undefined;
    if (keys.length === 0) {
      const { plain, record: keyRecord } = createApiKey(db, user.id, 'Default');
      apiKeyReveal = { id: keyRecord.id, plain, prefix: keyRecord.key_prefix, name: keyRecord.name };
    }

    await setSession(reply, fresh);
    return {
      status: 'verified',
      user: sanitizeUser(fresh),
      plan: planFor(fresh.plan),
      apiKey: apiKeyReveal,
    };
  });

  app.post('/resend-verification', async (req, reply) => {
    if (!(await limitByIp(req, reply, { keyPrefix: 'resend', windowSec: 3600, max: 5 }))) return;
    const parsed = resendSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Geçersiz istek' });
    const db = getDb();
    const user = findUserByEmail(db, parsed.data.email);
    // Security: don't reveal whether email exists
    if (!user || user.email_verified_at) {
      return { status: 'ok' };
    }
    const cd = canResendFor(db, user.id);
    if (!cd.ok) {
      return reply
        .code(429)
        .send({ error: `Biraz bekleyin, ${cd.retryAfterSec}s sonra tekrar deneyin.` });
    }
    const code = generateVerifyCode();
    createVerification(db, user.id, code);
    const result = await sendVerificationEmail(user.email, code, user.name);
    return { status: 'ok', mail: { sent: result.ok, error: result.error, devCode: result.devCode } };
  });

  app.post('/login', async (req, reply) => {
    if (!(await limitByIp(req, reply, { keyPrefix: 'login', windowSec: 60, max: 10 }))) return;
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Geçersiz giriş bilgileri' });
    const db = getDb();
    const user = findUserByEmail(db, parsed.data.email);
    if (!user || !verifyPassword(parsed.data.password, user.password_hash)) {
      return reply.code(401).send({ error: 'E-posta veya şifre hatalı' });
    }
    if (user.disabled_at) {
      return reply.code(403).send({ error: 'Hesabın devre dışı bırakılmış. İletişime geç.' });
    }
    if (!user.email_verified_at) {
      // Offer resend via separate call; block login.
      return reply.code(403).send({
        status: 'verify_required',
        error: 'E-postanı doğrulaman gerekiyor. Gelen kutunu kontrol et.',
        email: user.email,
      });
    }
    await setSession(reply, user);
    return { user: sanitizeUser(user), plan: planFor(user.plan) };
  });

  app.post('/logout', async (_req, reply) => {
    clearSession(reply);
    return { ok: true };
  });

  app.get('/me', async (req, reply) => {
    const user = await readSession(req);
    if (!user) return reply.code(401).send({ error: 'Oturum yok' });
    const db = getDb();
    const keys = listKeysForUser(db, user.id).map((k) => ({
      id: k.id,
      prefix: k.key_prefix,
      name: k.name,
      createdAt: k.created_at,
      lastUsedAt: k.last_used_at,
    }));
    const period = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`;
    const usage = db
      .prepare(
        `SELECT SUM(count) as total FROM usage_counters uc
         JOIN api_keys k ON k.id = uc.key_id
         WHERE k.user_id = ? AND uc.period = ?`,
      )
      .get(user.id, period) as { total: number | null };

    return {
      user: sanitizeUser(user),
      plan: planFor(user.plan),
      keys,
      usage: {
        period,
        count: usage.total ?? 0,
      },
    };
  });

  app.post(
    '/api-keys',
    { preHandler: requireAuth },
    async (req, reply) => {
      const parsed = keyCreateSchema.safeParse(req.body ?? {});
      if (!parsed.success) return reply.code(400).send({ error: 'Geçersiz isim' });
      const db = getDb();
      const { plain, record } = createApiKey(db, req.authUser!.id, parsed.data.name ?? 'Yeni anahtar');
      return { id: record.id, plain, prefix: record.key_prefix, name: record.name };
    },
  );

  app.delete(
    '/api-keys/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const id = Number((req.params as { id: string }).id);
      if (!Number.isFinite(id)) return reply.code(400).send({ error: 'Geçersiz id' });
      const ok = revokeKey(getDb(), req.authUser!.id, id);
      return reply.code(ok ? 200 : 404).send({ ok });
    },
  );

  app.get('/plans', async () => {
    return { items: Object.values(PLANS) };
  });
};

function sanitizeUser(u: UserRecord) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    plan: u.plan,
    role: u.role,
    emailVerifiedAt: u.email_verified_at ?? null,
    createdAt: u.created_at,
  };
}
