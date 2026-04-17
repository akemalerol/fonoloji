import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminClient } from './client';

export const metadata = { title: 'Admin' };
export const dynamic = 'force-dynamic';

const API_BASE = process.env.FONOLOJI_API_URL ?? 'http://localhost:4000';

async function loadAdmin() {
  const cookieStore = cookies();
  const session = cookieStore.get('fonoloji_session');
  if (!session) return null;
  const cookieHeader = `${session.name}=${session.value}`;
  const [statsRes, usersRes, keysRes, meRes] = await Promise.all([
    fetch(`${API_BASE}/admin-api/stats`, { headers: { Cookie: cookieHeader }, cache: 'no-store' }),
    fetch(`${API_BASE}/admin-api/users`, { headers: { Cookie: cookieHeader }, cache: 'no-store' }),
    fetch(`${API_BASE}/admin-api/keys`, { headers: { Cookie: cookieHeader }, cache: 'no-store' }),
    fetch(`${API_BASE}/auth/me`, { headers: { Cookie: cookieHeader }, cache: 'no-store' }),
  ]);
  if (!statsRes.ok || !usersRes.ok || !keysRes.ok || !meRes.ok) return null;

  const stats = await statsRes.json();
  const users = (await usersRes.json()).items;
  const keys = (await keysRes.json()).items;
  const me = await meRes.json();
  return { stats, users, keys, me };
}

export default async function AdminPage() {
  const data = await loadAdmin();
  if (!data) redirect('/giris');
  return <AdminClient {...data} />;
}
