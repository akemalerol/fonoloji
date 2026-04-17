import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PanelClient } from './client';
import type { Me } from '@/lib/auth';

export const metadata = { title: 'Panel' };
export const dynamic = 'force-dynamic';

const API_BASE = process.env.FONOLOJI_API_URL ?? 'http://localhost:4000';

async function loadMe(): Promise<Me | null> {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get('fonoloji_session');
  if (!sessionCookie) return null;
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Cookie: `${sessionCookie.name}=${sessionCookie.value}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return (await res.json()) as Me;
}

export default async function PanelPage() {
  const me = await loadMe();
  if (!me) redirect('/giris');

  return <PanelClient initial={me} />;
}
