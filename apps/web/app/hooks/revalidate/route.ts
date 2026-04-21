import { revalidatePath } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';

// ISR cache'i manuel invalidate eden webhook — TEFAS ingest'i bittikten
// sonra API cron'u tarafından çağırılır. Aksi hâlde `revalidate = 60` ile
// gelen ilk ziyaretçi stale sürümü görür (stale-while-revalidate). Bu endpoint
// ingest sonrası cache'i anında geçersiz kılarak "ilk ziyaretçi fresh" deneyimi sağlar.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const secret = process.env.FONOLOJI_REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: 'secret yapılandırılmamış' }, { status: 500 });
  }
  const auth = req.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'yetkisiz' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    paths?: string[];
    layout?: boolean;
  };

  const paths = body.paths?.length ? body.paths : ['/'];
  const useLayout = body.layout ?? true;

  const revalidated: string[] = [];
  for (const p of paths) {
    if (typeof p !== 'string' || !p.startsWith('/') || p.length > 200) continue;
    try {
      revalidatePath(p, useLayout ? 'layout' : 'page');
      revalidated.push(p);
    } catch {
      /* noop — tek path hata atsa diğerlerini bozmasın */
    }
  }

  return NextResponse.json({ ok: true, revalidated, at: Date.now() });
}
