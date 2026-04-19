import { NextResponse } from 'next/server';
import { api } from '@/lib/api';

export const revalidate = 900;

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function GET(_req: Request, { params }: { params: { kod: string } }) {
  const code = params.kod.toUpperCase();
  const [detail, disclosures] = await Promise.all([
    api.getFund(code).catch(() => null),
    api.disclosures(code, 30).catch(() => ({ items: [] })),
  ]);

  if (!detail) return new NextResponse('not found', { status: 404 });

  const siteUrl = 'https://fonoloji.com';
  const fundUrl = `${siteUrl}/fon/${code}`;
  const fundTitle = detail.fund.name;

  const items = disclosures.items
    .map((d) => {
      const date = new Date(d.publish_date);
      const title = d.kap_title ?? d.subject ?? `KAP bildirimi ${d.disclosure_index}`;
      return `<item>
  <title>${esc(title)}</title>
  <link>https://www.kap.org.tr/tr/Bildirim/${d.disclosure_index}</link>
  <guid isPermaLink="false">kap-${d.disclosure_index}</guid>
  <pubDate>${date.toUTCString()}</pubDate>
  <category>${esc(d.subject ?? 'KAP')}</category>
  <description>${esc(d.summary ?? title)}</description>
</item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${esc(code + ' — ' + fundTitle)}</title>
  <link>${fundUrl}</link>
  <atom:link href="${fundUrl}/rss.xml" rel="self" type="application/rss+xml" />
  <description>${esc(code + ' fonu için KAP bildirimleri — Fonoloji')}</description>
  <language>tr-TR</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
</channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=900, s-maxage=900',
    },
  });
}
