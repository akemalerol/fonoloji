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
import { trackRoute } from './routes/track.js';
import { seedAdPlacements } from './services/ads.js';
import { logApiRequest } from './services/tracking.js';

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
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://www.googletagmanager.com',
        'https://www.google-analytics.com',
        'https://pagead2.googlesyndication.com',
        'https://*.googlesyndication.com',
        'https://*.doubleclick.net',
        'https://*.googleadservices.com',
      ],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'data:'],
      frameSrc: [
        "'self'",
        'https://googleads.g.doubleclick.net',
        'https://*.doubleclick.net',
        'https://*.googlesyndication.com',
      ],
      connectSrc: [
        "'self'",
        'https://www.google-analytics.com',
        'https://region1.google-analytics.com',
        'https://*.googlesyndication.com',
        'https://*.doubleclick.net',
      ],
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

// Observability: /api/*, /v1/*, /admin-api/* çağrılarının request/response
// meta'sını api_requests tablosuna yaz. Analytics + admin paneli için.
function getClientIp(req: { headers: Record<string, string | string[] | undefined>; ip: string }): string {
  return (
    (req.headers['cf-connecting-ip'] as string) ||
    (req.headers['x-real-ip'] as string) ||
    ((req.headers['x-forwarded-for'] as string) ?? '').split(',')[0]?.trim() ||
    req.ip ||
    'unknown'
  );
}

app.addHook('onResponse', async (req, reply) => {
  const url = req.url;
  // Sadece public/auth API yollarını logla. Static/health gürültüsünü at.
  if (
    !url.startsWith('/api/') &&
    !url.startsWith('/v1/') &&
    !url.startsWith('/admin-api/') &&
    !url.startsWith('/auth/')
  ) {
    return;
  }
  if (url.startsWith('/api/health')) return;
  if (url.startsWith('/api/track')) return; // beacon'un kendisini loglama (sonsuz döngü)

  try {
    const db = getDb();
    const path = url.split('?')[0] ?? url;
    // API-key ise req.apiKey plugin'den gelir; user ise JWT'den çözülür
    const apiKeyId = (req as unknown as { apiKey?: { id: number } }).apiKey?.id ?? null;
    const userId = (req as unknown as { user?: { sub: number } }).user?.sub ?? null;
    const cfCountry = (req.headers['cf-ipcountry'] as string) ?? null;
    const origin = (req.headers['origin'] as string) ?? null;
    const refererRaw = (req.headers['referer'] as string) ?? null;
    // Referer'i 300 karakterden sonra kırp — uzun query string'li URL'ler DB'yi şişirmesin
    const referer = refererRaw && refererRaw.length > 300 ? refererRaw.slice(0, 300) : refererRaw;
    logApiRequest(db, {
      path,
      method: req.method,
      ip: getClientIp(req),
      country: cfCountry && cfCountry !== 'XX' ? cfCountry : null,
      userId,
      apiKeyId,
      status: reply.statusCode,
      durationMs: Math.round(reply.elapsedTime),
      userAgent: (req.headers['user-agent'] as string) ?? null,
      origin,
      referer,
    });
  } catch {
    // tracking hatası response'u engellemesin
  }
});

// Internal /api/* (cookie auth opsiyonel — Next.js SSR ve tarayıcı çağrıları).
// Next.js middleware external rewrite'larda çalışmadığı için anti-scraping
// (UA blocklist + rate-limit) burada, Fastify tarafında uygulanıyor.
// Programatik erişim isteyenler için: /v1/* (API-key, plan quota).
const BLOCKED_UA = [
  /\bcurl\//i,
  /\bwget\//i,
  /python-requests/i,
  /python-urllib/i,
  /\bhttpx\//i,
  /scrapy/i,
  /Go-http-client/i,
  /okhttp/i,
  /aiohttp/i,
  /^HTTPie/i,
  /\bNode\.js\b/i,
  /\bJava\//i,
  /PhantomJS/i,
  /HeadlessChrome/i,
  /Puppeteer/i,
  /Playwright/i,
  /BLEXBot/i,
  /MauiBot/i,
  /SeekportBot/i,
  /serpstatbot/i,
  /ZoominfoBot/i,
  /GPTBot/i,
  /ClaudeBot/i,
  /anthropic-ai/i,
  /CCBot/i,
  /PerplexityBot/i,
  /Bytespider/i,
  /DataForSeoBot/i,
  /SemrushBot/i,
  /AhrefsBot/i,
];
const ALLOWED_UA = [
  /Googlebot/i,
  /Bingbot/i,
  /DuckDuckBot/i,
  /YandexBot/i,
  /Applebot/i,
  /Slackbot/i,
  /TelegramBot/i,
  /WhatsApp/i,
  /facebookexternalhit/i,
  /Twitterbot/i,
  /LinkedInBot/i,
  /Discordbot/i,
];

await app.register(
  async (inner) => {
    // UA allowlist/blocklist — programatik erişimi /v1/*'e yönlendir.
    inner.addHook('onRequest', async (req, reply) => {
      const ua = (req.headers['user-agent'] as string) ?? '';
      if (ALLOWED_UA.some((re) => re.test(ua))) return;
      if (!ua || BLOCKED_UA.some((re) => re.test(ua))) {
        return reply.code(403).header('X-Blocked-Reason', 'automated-access').send({
          error: 'Otomatik erişim algılandı',
          message:
            'Veriyi otomatik kullanmak için ücretsiz API anahtarıyla https://fonoloji.com/api-docs → /v1/* kullan.',
        });
      }
    });

    await inner.register(rateLimit, {
      max: 60,
      timeWindow: '1 minute',
      // Next.js SSR aynı VPS'ten 127.0.0.1 üzerinden çağırıyor — tüm siteden
      // gelen SSR tek bir bucket'ı paylaşırsa bir SSR sayfası (/en-iyi-fonlar/[yil]
      // gibi limit=500'lük sorgular) diğerlerini 429'a itiyor. Loopback'i muaf tut.
      allowList: (req) => {
        const cf = req.headers['cf-connecting-ip'] as string | undefined;
        // Gerçek kullanıcı her zaman cf-connecting-ip taşır (Cloudflare önde).
        // CF header yoksa ve req.ip loopback ise → internal SSR çağrısı.
        if (cf) return false;
        const ip = req.ip ?? '';
        return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
      },
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

// Tracking beacon — UA blocklist ve rate-limit dışında; her sayfa ziyareti yazar
await app.register(trackRoute, { prefix: '/api' });

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

const db = getDb();
seedAdPlacements(db);
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
