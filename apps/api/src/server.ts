import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import { registerCron } from './cron/index.js';
import { getDb } from './db/index.js';
import { requireApiKey } from './auth/middleware.js';
import { PLANS } from './auth/plans.js';
import { adminRoute } from './routes/admin.js';
import { authRoute } from './routes/auth.js';
import { contactRoute } from './routes/contact.js';
import { fundsRoute } from './routes/funds.js';
import { insightsRoute } from './routes/insights.js';
import { portfolioRoute } from './routes/portfolio.js';

const app = Fastify({
  logger: { transport: { target: 'pino-pretty' } },
  trustProxy: true,
});

// Fail loud if production is running with insecure default secrets.
const cookieSecret = process.env.FONOLOJI_COOKIE_SECRET;
const jwtSecret = process.env.FONOLOJI_JWT_SECRET;
if (process.env.NODE_ENV === 'production') {
  if (!cookieSecret || cookieSecret.length < 32 || cookieSecret.includes('change-me')) {
    app.log.error('[SECURITY] FONOLOJI_COOKIE_SECRET is missing/weak. Set a 32+ char random string.');
  }
  if (!jwtSecret || jwtSecret.length < 32 || jwtSecret.includes('change-me')) {
    app.log.error('[SECURITY] FONOLOJI_JWT_SECRET is missing/weak. Set a 32+ char random string.');
  }
}

await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://www.googletagmanager.com', 'https://www.google-analytics.com'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", 'https://www.google-analytics.com', 'https://region1.google-analytics.com'],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
});

// CORS whitelist for credentialed (cookie) endpoints.
// Non-whitelisted browser origins are rejected entirely so reflected
// Origin + credentials=true cannot be abused to read auth-protected data.
// Server-to-server callers (no Origin header) still work everywhere.
const ALLOWED_ORIGINS = new Set([
  'https://fonoloji.com',
  'https://www.fonoloji.com',
  process.env.FONOLOJI_SITE_URL ?? '',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

await app.register(cors, {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // server-to-server / same-origin
    if (ALLOWED_ORIGINS.has(origin)) return cb(null, true);
    return cb(null, false); // block unknown browser origins (no ACAO emitted)
  },
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  maxAge: 86400,
});
await app.register(cookie, {
  secret: cookieSecret ?? 'fonoloji-dev-secret-change-me',
});
await app.register(jwt, {
  secret: jwtSecret ?? 'fonoloji-dev-jwt-secret-change-me',
});

// Internal /api/* (cookie auth opsiyonel — Next.js SSR ve tarayıcı çağrıları).
// Scraping'i kısıtlamak için IP başına rate-limit. Programatik erişim için /v1/*.
await app.register(
  async (inner) => {
    await inner.register(rateLimit, {
      max: 60,
      timeWindow: '1 minute',
      keyGenerator: (req) =>
        (req.headers['cf-connecting-ip'] as string) ||
        (req.headers['x-real-ip'] as string) ||
        ((req.headers['x-forwarded-for'] as string) ?? '').split(',')[0]?.trim() ||
        req.ip,
      errorResponseBuilder: () => ({
        statusCode: 429,
        error: 'Too Many Requests',
        message:
          'Dakikada 60 istek sınırını aştın. Programatik erişim için ücretsiz API anahtarı al: https://fonoloji.com/api-docs',
      }),
    });
    await inner.register(fundsRoute);
    await inner.register(insightsRoute);
    await inner.register(contactRoute);
  },
  { prefix: '/api' },
);

// Public /v1/* (requires X-API-Key).
await app.register(
  async (inner) => {
    inner.addHook('preHandler', requireApiKey);
    await inner.register(fundsRoute);
    await inner.register(insightsRoute);
  },
  { prefix: '/v1' },
);

// Auth routes at /auth/* (cookie-based).
await app.register(authRoute, { prefix: '/auth' });

// Portfolio / alerts (user-owned, cookie auth)
await app.register(portfolioRoute, { prefix: '/api' });

// Admin routes at /admin-api/* (cookie-based, role=admin).
await app.register(adminRoute, { prefix: '/admin-api' });

// Public plans listing (convenience for pricing page).
app.get('/plans', async () => ({ items: Object.values(PLANS) }));

app.get('/api/health', async () => {
  const db = getDb();
  const { c } = db.prepare(`SELECT COUNT(*) as c FROM funds`).get() as { c: number };
  return { ok: true, funds: c, now: new Date().toISOString() };
});

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? '0.0.0.0';

getDb();
registerCron({
  info: (m) => app.log.info(m),
  error: (...args) => app.log.error(args),
});

app
  .listen({ port, host })
  .then(() => app.log.info(`Fonoloji API http://${host}:${port}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
