import { createHash } from 'node:crypto';
import type { Database } from 'better-sqlite3';

interface FundSnapshot {
  code: string;
  name: string;
  category: string | null;
  management_company: string | null;
  current_price: number | null;
  return_1m: number | null;
  return_1y: number | null;
  sharpe_90: number | null;
  volatility_90: number | null;
  real_return_1y: number | null;
  max_drawdown_1y: number | null;
  aum: number | null;
  risk_score: number | null;
  portfolio: Record<string, number> | null;
}

const MODEL = process.env.FONOLOJI_AI_MODEL ?? 'gpt-4o-mini';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

function promptHashOf(f: FundSnapshot): string {
  return createHash('sha256')
    .update(
      [
        f.code,
        f.return_1m?.toFixed(3),
        f.return_1y?.toFixed(3),
        f.sharpe_90?.toFixed(2),
        f.real_return_1y?.toFixed(3),
        JSON.stringify(f.portfolio ?? {}),
      ].join('|'),
    )
    .digest('hex')
    .slice(0, 16);
}

function buildPrompt(f: FundSnapshot): string {
  const p = f.portfolio;
  const pct = (v: number | null) => (v === null ? '—' : `%${(v * 100).toFixed(1)}`);
  const portfolioStr = p
    ? Object.entries(p)
        .filter(([, v]) => v > 1)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k}: %${v.toFixed(0)}`)
        .join(', ')
    : 'veri yok';

  return `TEFAS fonunun verisi aşağıda. 80-120 kelime, sade Türkçe, 3-4 cümle.

KOD: ${f.code} · ${f.name}
Kategori: ${f.category ?? '-'} · Yönetim: ${f.management_company ?? '-'}
Getiriler: 1A=${pct(f.return_1m)} · 1Y=${pct(f.return_1y)} · Reel(1Y)=${pct(f.real_return_1y)}
Risk: Sharpe=${f.sharpe_90?.toFixed(2) ?? '-'} · Volatilite=${pct(f.volatility_90)} · Maks drawdown=${pct(f.max_drawdown_1y)} · TEFAS risk=${f.risk_score ?? '-'}/7
Portföy: ${portfolioStr}
AUM: ${f.aum ? (f.aum / 1_000_000_000).toFixed(2) + ' Mr ₺' : '-'}

ZORUNLU KURALLAR:
- "Yatırım tavsiyesi değildir" ifadesini ASLA kullanma, ne başta ne sonda.
- "Al", "sat", "tut", "öneririm", "tavsiye ederim" gibi kararsal kelimeler KULLANMA.
- Tamamen gözlem tonunda yaz: "fon şu pozisyonda", "şu göstergeye göre şöyle görünüyor".
- Doğrudan ilk cümlede veriye gir, açılış klişesi atma.

Yorum içeriği: 1) Getirinin reel mi nominal mi olduğunu belirt. 2) Portföy kompozisyonunun kategorisiyle tutarlılığına değin. 3) Risk-getiri dengesini tek cümlede özetle.`;
}

async function callOpenAI(prompt: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: 'Sen Türk finans analizi yazan bir ekonomistsin. Kısa, net, veri odaklı yazarsın.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 260,
        temperature: 0.4,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

// Daily / weekly market digest — AI commentary from aggregate numbers
export interface DigestInput {
  period: 'day' | 'week';
  topGainers: Array<{ code: string; name: string; change: number }>;
  topLosers: Array<{ code: string; name: string; change: number }>;
  categoryAvg: Array<{ category: string; avg_return: number }>;
  totalFunds: number;
  totalAum: number;
  cpiYoy: number | null;
}

export async function getMarketDigest(
  db: Database,
  input: DigestInput,
): Promise<{ summary: string | null; cached: boolean }> {
  const todayKey = new Date().toISOString().slice(0, 10);
  const cacheKey = `__digest_${input.period}_${todayKey}`;

  const cached = db
    .prepare(`SELECT summary, generated_at FROM ai_summaries WHERE code = ?`)
    .get(cacheKey) as { summary: string; generated_at: number } | undefined;

  if (cached && Date.now() - cached.generated_at < 6 * 3600 * 1000) {
    return { summary: cached.summary, cached: true };
  }

  const resend = process.env.OPENAI_API_KEY;
  if (!resend) return { summary: null, cached: false };

  const periodLabel = input.period === 'day' ? 'bugün' : 'bu hafta';
  const gainers = input.topGainers
    .slice(0, 5)
    .map((g) => `${g.code} (%${(g.change * 100).toFixed(1)})`)
    .join(', ');
  const losers = input.topLosers
    .slice(0, 5)
    .map((l) => `${l.code} (%${(l.change * 100).toFixed(1)})`)
    .join(', ');
  const bestCat = input.categoryAvg
    .slice(0, 3)
    .map((c) => `${c.category}: %${(c.avg_return * 100).toFixed(1)}`)
    .join('; ');

  const prompt = `TEFAS pazarının ${periodLabel}kü özetini 2-3 kısa paragrafta (100-140 kelime) yaz. Ton: finansal köşe yazısı, Türkçe, sade.

EN ÇOK YÜKSELENLER: ${gainers}
EN ÇOK DÜŞENLER: ${losers}
EN İYİ KATEGORİLER: ${bestCat}
TOPLAM FON: ${input.totalFunds}
TOPLAM AUM: ${(input.totalAum / 1_000_000_000).toFixed(1)} Mr TL
${input.cpiYoy ? `TÜFE YIL BAZINDA: %${(input.cpiYoy * 100).toFixed(1)}` : ''}

Zorunlu yazım kuralları:
- "Yatırım tavsiyesi değildir" ifadesini ASLA kullanma.
- "Al", "sat", "tut", "öneririm", "tavsiye ederim" gibi kararsal kelimeler KULLANMA.
- Gözlem tonu: "pazarda şu oldu", "şu kategori öne çıktı", "veri şunu gösteriyor" şeklinde.
- Doğrudan veriyle başla, klişe giriş atma ("Bu hafta/bugün..." ile başlayabilirsin ama sadece veriye bağla).
- Sayıları hikayeye bağla: neden yükseldi, neden düştü, kategoriler arası fark neyi ima ediyor.
- Enflasyon verisi varsa nominal vs reel getiri ayrımına değin.
- Fon kodlarını aynen yaz (TTE, IPB gibi).
- Başlık ATMA, direkt paragraflarla başla.`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resend}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.FONOLOJI_AI_MODEL ?? 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'Sen Türk yatırım fonu pazarını yorumlayan bir köşe yazarısın. Veriyi hikâyeye çevirirsin; kuru istatistik atmazsın.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 320,
        temperature: 0.55,
      }),
    });

    if (!res.ok) return { summary: null, cached: false };
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const summary = data.choices?.[0]?.message?.content?.trim();
    if (!summary) return { summary: null, cached: false };

    db.prepare(
      `INSERT INTO ai_summaries (code, summary, model, generated_at, prompt_hash)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(code) DO UPDATE SET
         summary = excluded.summary, generated_at = excluded.generated_at`,
    ).run(cacheKey, summary, 'gpt-4o-mini', Date.now(), todayKey);

    return { summary, cached: false };
  } catch {
    return { summary: null, cached: false };
  }
}

export async function getOrGenerateAiSummary(
  db: Database,
  snapshot: FundSnapshot,
  opts: { force?: boolean } = {},
): Promise<{ summary: string | null; cached: boolean; model?: string }> {
  const code = snapshot.code;
  const now = Date.now();
  const hash = promptHashOf(snapshot);

  if (!opts.force) {
    const row = db
      .prepare(`SELECT summary, model, generated_at, prompt_hash FROM ai_summaries WHERE code = ?`)
      .get(code) as
      | { summary: string; model: string; generated_at: number; prompt_hash: string }
      | undefined;
    if (row && row.prompt_hash === hash && now - row.generated_at < CACHE_TTL_MS) {
      return { summary: row.summary, cached: true, model: row.model };
    }
  }

  const prompt = buildPrompt(snapshot);
  const result = await callOpenAI(prompt);
  if (!result) return { summary: null, cached: false };

  db.prepare(
    `INSERT INTO ai_summaries (code, summary, model, generated_at, prompt_hash)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(code) DO UPDATE SET
       summary = excluded.summary,
       model = excluded.model,
       generated_at = excluded.generated_at,
       prompt_hash = excluded.prompt_hash`,
  ).run(code, result, MODEL, now, hash);

  return { summary: result, cached: false, model: MODEL };
}
