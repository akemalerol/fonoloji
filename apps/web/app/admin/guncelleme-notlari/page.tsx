import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DevReportContent } from './content';

export const metadata = {
  title: 'Geliştirme Notları — Admin',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

const API_BASE = process.env.FONOLOJI_API_URL ?? 'http://localhost:4000';

async function checkAdmin(): Promise<boolean> {
  const cookieStore = cookies();
  const session = cookieStore.get('fonoloji_session');
  if (!session) return false;
  const cookieHeader = `${session.name}=${session.value}`;
  const res = await fetch(`${API_BASE}/admin-api/stats`, {
    headers: { Cookie: cookieHeader },
    cache: 'no-store',
  });
  return res.ok;
}

export default async function AdminDevReportPage() {
  const ok = await checkAdmin();
  if (!ok) redirect('/giris?next=/admin/guncelleme-notlari');
  return <DevReportContent />;
}
