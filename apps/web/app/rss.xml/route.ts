import { api } from '@/lib/api';

export const revalidate = 900;

const BASE = 'https://fonoloji.com';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  let items: string[] = [];
  try {
    const changes = await api.fundChanges();
    items = changes.items.slice(0, 50).map((c) => {
      const title = `${c.code} · ${c.field}: "${c.old_value ?? ''}" → "${c.new_value ?? ''}"`;
      const link = `${BASE}/fon/${c.code}`;
      const pubDate = new Date(c.detected_at).toUTCString();
      const description = `${c.name ?? c.code} — ${c.field} alanı ${
        c.old_value ? `"${c.old_value}"` : 'boş'
      } değerinden ${c.new_value ? `"${c.new_value}"` : 'boş'} değerine değişti.`;
      return `<item>
        <title>${escapeXml(title)}</title>
        <link>${link}</link>
        <guid isPermaLink="false">${BASE}/fund-change/${c.id}</guid>
        <pubDate>${pubDate}</pubDate>
        <description>${escapeXml(description)}</description>
      </item>`;
    });
  } catch {
    items = [];
  }

  const now = new Date().toUTCString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Fonoloji — Fon Değişiklikleri</title>
    <link>${BASE}</link>
    <description>TEFAS fonlarının ad, kategori, risk ve yönetim şirketi değişiklikleri.</description>
    <language>tr-TR</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${BASE}/rss.xml" rel="self" type="application/rss+xml"/>
    ${items.join('\n    ')}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=900, s-maxage=900',
    },
  });
}
