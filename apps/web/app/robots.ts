import type { MetadataRoute } from 'next';

// Arama motoru tarayıcıları (Google, Bing, DuckDuckGo) için site açık.
// AI / veri toplayan botları ve tanınmış scraper'ları açıkça yasakla.
// Not: Saygılı bot'lar robots.txt'e uyar; agresif scraper'lar uymaz —
// asıl engel Cloudflare WAF + rate-limit katmanında yapılır.
const BLOCKED_BOTS = [
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  'CCBot',
  'Google-Extended',
  'FacebookBot',
  'PerplexityBot',
  'YouBot',
  'Amazonbot',
  'Bytespider',
  'ImagesiftBot',
  'Diffbot',
  'DataForSeoBot',
  'SemrushBot',
  'AhrefsBot',
  'MJ12bot',
  'DotBot',
  'PetalBot',
  'magpie-crawler',
  'omgili',
  'HTTrack',
  'WebCopier',
  'WebStripper',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Varsayılan: herkese açık (arama motoru dahil)
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/panel',
          '/admin',
          '/admin-api/',
          '/auth/',
          '/yonetici-admin/',
          '/giris',
          '/kayit',
          '/alarmlarim',
          '/api/',
        ],
      },
      // AI ve scraper botları: full disallow
      ...BLOCKED_BOTS.map((bot) => ({
        userAgent: bot,
        disallow: '/',
      })),
    ],
    sitemap: 'https://fonoloji.com/sitemap.xml',
  };
}
