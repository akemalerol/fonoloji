import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthHeader, GlassCard } from '@/components/auth/glass-card';
import { RegisterForm } from './form';

export const metadata = { title: 'Kayıt · Fonoloji' };
export const dynamic = 'force-dynamic';

const API_BASE = process.env.FONOLOJI_API_URL ?? 'http://localhost:4000';

async function alreadyLoggedIn(): Promise<boolean> {
  const session = cookies().get('fonoloji_session');
  if (!session) return false;
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Cookie: `${session.name}=${session.value}` },
    cache: 'no-store',
  });
  return res.ok;
}

export default async function RegisterPage() {
  if (await alreadyLoggedIn()) redirect('/panel');

  return (
    <div className="relative min-h-[85vh] overflow-hidden">
      <div className="pointer-events-none absolute inset-0 aurora opacity-60" />
      <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle_at_30%_10%,rgba(245,158,11,0.18),transparent_50%),radial-gradient(circle_at_70%_90%,rgba(236,72,153,0.14),transparent_50%)]" />

      <div className="container relative flex min-h-[85vh] flex-col items-center justify-center py-12">
        <div className="w-full max-w-[440px]">
          <GlassCard>
            <AuthHeader
              title={
                <>
                  Hesap <span className="display-italic gradient-text">oluştur</span>
                </>
              }
              subtitle="500 istek/ay ücretsiz — kart gerekmez"
            />
            <RegisterForm />
          </GlassCard>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Zaten hesabın var mı?{' '}
            <Link
              href="/giris"
              className="group relative inline-block font-semibold text-foreground transition-colors"
            >
              <span className="relative z-10 group-hover:text-brand-400">Giriş yap</span>
              <span className="absolute bottom-0 left-0 h-[1px] w-0 bg-brand-400 transition-all group-hover:w-full" />
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
