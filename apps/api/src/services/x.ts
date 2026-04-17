import { createHmac, randomBytes } from 'node:crypto';
import type { Database } from 'better-sqlite3';

/**
 * X (Twitter) v2 API client using OAuth 1.0a user context.
 *
 * Credentials from env (required to post):
 *   X_API_KEY, X_API_SECRET           — developer app consumer keys
 *   X_ACCESS_TOKEN, X_ACCESS_SECRET   — user-specific OAuth tokens
 *
 * Free tier (as of 2025): 500 tweets/month · 1500 reads — enough for a few daily posts.
 * Sign-up: developer.x.com → Projects & Apps → create app → Keys & Tokens.
 */

interface OAuthParams {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessSecret: string;
}

function percentEncode(s: string): string {
  return encodeURIComponent(s).replace(/[!*'()]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function buildOAuthHeader(method: string, url: string, body: Record<string, unknown>, creds: OAuthParams): string {
  const params: Record<string, string> = {
    oauth_consumer_key: creds.consumerKey,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: '1.0',
  };

  // Build signature base — includes query-like encoding of params (not body for v2 JSON)
  const signKeys = Object.keys(params).sort();
  const paramStr = signKeys.map((k) => `${percentEncode(k)}=${percentEncode(params[k]!)}`).join('&');
  const base = [method.toUpperCase(), percentEncode(url), percentEncode(paramStr)].join('&');
  const signingKey = `${percentEncode(creds.consumerSecret)}&${percentEncode(creds.accessSecret)}`;
  const signature = createHmac('sha1', signingKey).update(base).digest('base64');
  params.oauth_signature = signature;

  const allKeys = Object.keys(params).sort();
  return (
    'OAuth ' +
    allKeys.map((k) => `${percentEncode(k)}="${percentEncode(params[k]!)}"`).join(', ')
  );
}

export interface PostTweetResult {
  ok: boolean;
  tweetId?: string;
  error?: string;
}

export async function postTweet(text: string): Promise<PostTweetResult> {
  const consumerKey = process.env.X_API_KEY;
  const consumerSecret = process.env.X_API_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessSecret = process.env.X_ACCESS_SECRET;

  if (!consumerKey || !consumerSecret || !accessToken || !accessSecret) {
    return { ok: false, error: 'X credentials missing (X_API_KEY/SECRET + X_ACCESS_TOKEN/SECRET)' };
  }

  const url = 'https://api.x.com/2/tweets';
  const auth = buildOAuthHeader('POST', url, {}, {
    consumerKey,
    consumerSecret,
    accessToken,
    accessSecret,
  });

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });
    const data = (await res.json()) as { data?: { id: string }; errors?: Array<{ message: string }>; title?: string; detail?: string };
    if (!res.ok || !data.data?.id) {
      const err = data.errors?.[0]?.message ?? data.detail ?? data.title ?? 'Unknown error';
      return { ok: false, error: `${res.status}: ${err}` };
    }
    return { ok: true, tweetId: data.data.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Generate a Fonoloji-flavored tweet with OpenAI from a prompt context.
 * Returns null if no API key or generation fails.
 */
export interface TweetContext {
  kind: 'daily_digest' | 'fund_highlight' | 'cpi_update' | 'custom';
  topGainers?: Array<{ code: string; change: number }>;
  topLosers?: Array<{ code: string; change: number }>;
  trendRising?: Array<{ code: string; name: string }>;
  topInflow?: Array<{ code: string; flowLabel: string }>;
  highlight?: { code: string; name: string; metric: string; value: string };
  cpi?: { yoy: number; mom: number | null; month: string };
  customPrompt?: string;
}

export async function generateTweet(ctx: TweetContext): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  let prompt = '';
  switch (ctx.kind) {
    case 'daily_digest': {
      const g = ctx.topGainers?.slice(0, 5).map((x) => `${x.code} %${(x.change * 100).toFixed(1)}`).join(', ');
      const l = ctx.topLosers?.slice(0, 3).map((x) => `${x.code} %${(x.change * 100).toFixed(1)}`).join(', ');
      const trendUp = ctx.trendRising?.slice(0, 3).map((x) => x.code).join(', ');
      const flowIn = ctx.topInflow?.slice(0, 3).map((x) => `${x.code} (${x.flowLabel})`).join(', ');
      prompt = `Bugünkü TEFAS fon piyasasını özetleyen dikkat çekici bir tweet yaz.

VERİ:
🔺 En çok yükselenler: ${g || 'veri yok'}
🔻 En çok düşenler: ${l || 'veri yok'}
📈 Trend sinyali (MA30>MA200 kesişim): ${trendUp || 'veri yok'}
💰 En çok para giren fonlar (aylık): ${flowIn || 'veri yok'}

KURALLAR:
- 2-3 emoji kullan, doğal yerlere koy
- Öne çıkan fon kodlarını hashtag yap: #TTE #OHI gibi
- Genel etiketler de ekle: #TEFAS #fon (toplam 3-5 hashtag)
- Dikkat çekici bir giriş cümlesiyle başla
- Öne çıkan 2-3 fon kodunu ver, rakamlarıyla
- Sonuna "📊 fonoloji.com" ekle
- Max 270 karakter
- Yatırım tavsiyesi verme, sadece bilgilendirme`;
      break;
    }
    case 'fund_highlight': {
      const h = ctx.highlight!;
      prompt = `Bir fonun dikkat çekici performansını vurgulayan tweet yaz.

FON: ${h.code} — ${h.name}
METRİK: ${h.metric}: ${h.value}

KURALLAR:
- 2-3 emoji kullan
- #TEFAS #${h.code} ve ilgili etiketler ekle
- Fonun neden dikkat çekici olduğunu kısa açıkla
- Sonuna "📊 fonoloji.com/fon/${h.code}" ekle
- Max 270 karakter
- Yatırım tavsiyesi verme`;
      break;
    }
    case 'cpi_update': {
      const c = ctx.cpi!;
      prompt = `TÜFE/enflasyon açıklaması hakkında tweet yaz.

VERİ:
📅 Dönem: ${c.month}
📊 Yıllık TÜFE: %${(c.yoy * 100).toFixed(2)}
${c.mom !== null ? `📈 Aylık değişim: %${(c.mom * 100).toFixed(2)}` : ''}

KURALLAR:
- 2-3 emoji kullan
- #TÜFE #enflasyon #ekonomi etiketleri ekle
- Fon yatırımcıları için ne anlama geldiğini kısa değin (reel getiri bağlamı)
- Sonuna "📊 fonoloji.com/ekonomi" ekle
- Max 270 karakter
- Yorum yok, sadece veri ve bağlam`;
      break;
    }
    case 'custom':
      prompt = (ctx.customPrompt ?? '') + '\n\nKURALLAR: 2-3 emoji kullan. #TEFAS ve ilgili 1-2 etiket ekle. Sonuna "📊 fonoloji.com" ekle. Max 270 karakter. Yatırım tavsiyesi verme.';
      break;
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.FONOLOJI_AI_MODEL ?? 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: `Sen @fonoloji_ hesabı için tweet yazan yaratıcı bir finans editörüsün. Türk yatırım fonu (TEFAS) dünyasını takip ediyorsun.

YAZIM STİLİN:
- Enerjik, merak uyandıran, dikkat çekici
- Emoji'leri doğal kullan (zorlamadan, 2-3 tane)
- Hashtag'leri sona koy: #TEFAS #fon gibi (2-4 tane)
- Kısa cümleler, noktalama temiz
- Rakamları öne çıkar, yüzdeleri vurgula
- "Tavsiye", "öneririm", "al/sat", "yatırım tavsiyesi" ASLA kullanma — sadece bilgilendirme
- Tweet max 270 karakter olsun
- Tweetin tırnak içinde olmasın, direkt metni yaz`,
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 200,
        temperature: 0.8,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    let text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return null;
    text = text.replace(/^["']|["']$/g, '');
    return text;
  } catch {
    return null;
  }
}

export function queueTweet(
  db: Database,
  opts: { content: string; kind?: string; scheduledAt?: number },
): number {
  const now = Date.now();
  const r = db
    .prepare(
      `INSERT INTO x_posts (content, kind, status, scheduled_at, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(opts.content, opts.kind ?? 'manual', opts.scheduledAt ? 'scheduled' : 'draft', opts.scheduledAt ?? null, now);
  return Number(r.lastInsertRowid);
}
