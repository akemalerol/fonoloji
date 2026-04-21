import { NextResponse, type NextRequest } from 'next/server';

/**
 * Anti-scraper middleware — 3 katman:
 *   1. User-Agent blocklist (bariz scraper araçları)
 *   2. Honeypot tuzağı (/_hp/ path — hidden link, bot yakalama)
 *   3. Basit in-memory rate limit (fon veri sayfaları için 120 req/dk/IP)
 *
 * Gerçek koruma Cloudflare WAF/rate-limit katmanında olmalı; bu middleware
 * tamamlayıcı savunmadır, CF önünde zaten temiz trafik varsayıyor.
 */

// Bariz scraper/lib User-Agent'ları. Boş UA da aşağıda yakalanıyor.
const BLOCKED_UA_PATTERNS = [
  /\bcurl\//i,
  /\bwget\//i,
  /python-requests/i,
  /python-urllib/i,
  /scrapy/i,
  /Go-http-client/i,
  /okhttp/i,
  /aiohttp/i,
  /^HTTPie/i,
  /\bNode\.js\b/i, // node fetch default
  /\bJava\//i,
  /PhantomJS/i,
  /HeadlessChrome/i, // headless fingerprint (Puppeteer default)
  /BLEXBot/i,
  /MauiBot/i,
  /SeekportBot/i,
  /serpstatbot/i,
  /ZoominfoBot/i,
];

// Arama motoru & saygın bot'lar — geçir
const ALLOW_UA_PATTERNS = [
  /Googlebot/i,
  /Bingbot/i,
  /DuckDuckBot/i,
  /YandexBot/i,
  /Yandex\./i,
  /Applebot/i,
  /Slackbot/i,
  /TelegramBot/i,
  /WhatsApp/i,
  /facebookexternalhit/i,
  /Twitterbot/i,
  /LinkedInBot/i,
  /Discordbot/i,
];

// Rate-limit bucket: ip → {count, resetAt}
// Not: Serverless'te persist olmaz; process restart'ta sıfırlanır.
// Cloudflare rate-limit bu işin doğru yeri, bu fallback.
const buckets = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 120; // dakikada max istek
const WINDOW_MS = 60_000;

function getIp(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now > b.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    // Hafızayı temizle — 1000 üstü bucket varsa eskisini at
    if (buckets.size > 1000) {
      for (const [k, v] of buckets) {
        if (now > v.resetAt) buckets.delete(k);
      }
    }
    return false;
  }
  b.count++;
  return b.count > RATE_LIMIT;
}

export function middleware(req: NextRequest) {
  const ua = req.headers.get('user-agent') ?? '';
  const ip = getIp(req);
  const path = req.nextUrl.pathname;

  // 1. Honeypot — robots.txt disallow, gizli link. Bot tıklayınca 403.
  if (path.startsWith('/_hp/')) {
    console.log(`[honeypot] caught ${ip} ua="${ua.slice(0, 100)}"`);
    return new NextResponse('Forbidden', { status: 403 });
  }

  // 2. Arama motoru ise her zaman geç
  const isAllowed = ALLOW_UA_PATTERNS.some((re) => re.test(ua));
  if (isAllowed) return NextResponse.next();

  // 3. Blocklist — UA açıkça scraper
  const isBlocked = !ua || BLOCKED_UA_PATTERNS.some((re) => re.test(ua));
  if (isBlocked) {
    return new NextResponse(
      JSON.stringify({
        error: 'Otomatik erişim algılandı',
        message: 'Veriyi otomatik kullanmak için ücretsiz API\'mizi kullan: https://fonoloji.com/api-docs',
      }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Blocked-Reason': 'automated-access',
        },
      },
    );
  }

  // 4. Rate limit — fon veri sayfaları (SSR).
  // /api/* için rate-limit Fastify tarafında (next.js middleware external
  // rewrite'larda çalışmıyor — o yüzden UA blocklist + rate-limit backend'de).
  const isDataPath =
    path.startsWith('/fon/') ||
    path.startsWith('/fonlar') ||
    path.startsWith('/kategori');
  if (isDataPath && rateLimited(ip)) {
    return new NextResponse(
      JSON.stringify({
        error: 'Çok fazla istek',
        message: 'Dakikada 120 istek sınırını aştın. Verileri programatik almak için API\'mizi kullan.',
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Retry-After': '60',
        },
      },
    );
  }

  return NextResponse.next();
}

// Middleware'in çalışacağı path'ler — static asset, admin/auth/v1/embed/api'yi dışarıda bırak.
// Not: /api/* için middleware çalışmaz (external rewrite'lar Next.js tarafından
// middleware'den önce proxy'leniyor) — anti-scraping bu yüzden Fastify
// tarafında onRequest hook ile uygulanıyor (apps/api/src/server.ts).
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|admin-api/|auth/|v1/|embed/|hooks/|.*\\.(?:xml|txt|png|jpg|svg|ico|webp|avif|css|js|woff|woff2)$).*)',
  ],
};
