import { NextResponse } from 'next/server';
import { api } from '@/lib/api';
import { formatPercent, formatPrice } from '@/lib/utils';

export const revalidate = 300;

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function GET(_req: Request, { params }: { params: { kod: string } }) {
  const code = params.kod.toUpperCase();
  let detail;
  try {
    detail = await api.getFund(code);
  } catch {
    return new NextResponse('<html><body>Fon bulunamadı</body></html>', {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
  if (!detail) return new NextResponse('not found', { status: 404 });

  const { fund } = detail;
  const change = fund.return_1d ?? 0;
  const up = change > 0, down = change < 0;
  const color = up ? '#10b981' : down ? '#F43F5E' : '#71717a';
  const changeStr = fund.return_1d !== null ? formatPercent(fund.return_1d) : '—';

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<title>${esc(code)} — Fonoloji</title>
<style>
html,body{margin:0;padding:0;background:transparent;font-family:-apple-system,system-ui,sans-serif;}
a.w{display:block;width:100%;max-width:360px;background:#15151b;color:#f5f5f7;border:1px solid #24242b;border-radius:14px;padding:14px 16px;text-decoration:none;box-sizing:border-box;}
a.w:hover{border-color:#F59E0B;}
.h{display:flex;align-items:center;gap:10px;}
.c{display:inline-flex;align-items:center;justify-content:center;height:28px;padding:0 10px;border-radius:6px;background:linear-gradient(135deg,#F59E0B,#2DD4BF);color:#0a0a0f;font-family:monospace;font-size:11px;font-weight:700;}
.n{flex:1;min-width:0;font-size:11px;color:#a8a8b3;text-overflow:ellipsis;white-space:nowrap;overflow:hidden;}
.p{margin-top:10px;display:flex;align-items:baseline;gap:8px;}
.v{font-family:monospace;font-size:24px;font-weight:600;}
.ch{font-family:monospace;font-size:13px;font-weight:600;color:${color};}
.ft{margin-top:10px;font-size:9px;color:#61616c;letter-spacing:1px;text-transform:uppercase;}
</style>
</head>
<body>
<a class="w" href="https://fonoloji.com/fon/${esc(code)}" target="_parent" rel="noopener">
  <div class="h">
    <span class="c">${esc(code)}</span>
    <span class="n">${esc(fund.name)}</span>
  </div>
  <div class="p">
    <span class="v">₺${esc(formatPrice(fund.current_price, 4))}</span>
    <span class="ch">${esc(changeStr)}</span>
  </div>
  <div class="ft">FONOLOJI · ${esc(fund.category ?? 'TEFAS fonu')}</div>
</a>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      'X-Frame-Options': 'ALLOWALL', // embed için iframe'e izin ver
      'Content-Security-Policy': "frame-ancestors *",
    },
  });
}
