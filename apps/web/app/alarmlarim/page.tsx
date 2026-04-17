import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AlertsClient } from './client';

export const metadata = { title: 'Alarmlarım · Fonoloji' };
export const dynamic = 'force-dynamic';

const API_BASE = process.env.FONOLOJI_API_URL ?? 'http://localhost:4000';

export default async function AlertsPage() {
  const session = cookies().get('fonoloji_session');
  if (!session) redirect('/giris?next=/alarmlarim');

  const me = await fetch(`${API_BASE}/auth/me`, {
    headers: { Cookie: `${session.name}=${session.value}` },
    cache: 'no-store',
  });
  if (!me.ok) redirect('/giris?next=/alarmlarim');

  return <AlertsClient />;
}
