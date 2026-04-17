import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { GlassCard, AuthHeader } from '@/components/auth/glass-card';
import { LoginForm } from './form';

export const metadata = { title: 'Giriş · Fonoloji' };
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

export default async function LoginPage() {
  if (await alreadyLoggedIn()) redirect('/panel');

  return (
    <div className="relative min-h-[85vh] overflow-hidden">
      <div className="pointer-events-none absolute inset-0 aurora opacity-60" />
      <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle_at_50%_0%,rgba(245,158,11,0.18),transparent_50%),radial-gradient(circle_at_80%_100%,rgba(45,212,191,0.12),transparent_50%)]" />

      <div className="container relative flex min-h-[85vh] flex-col items-center justify-center py-12">
        <div className="w-full max-w-[420px]">
          <GlassCard>
            <AuthHeader
              title={
                <>
                  Hoşgeldin <span className="display-italic gradient-text">tekrar</span>
                </>
              }
              subtitle="TEFAS fonlarını akılcıyla karşıla"
            />
            <LoginForm />
          </GlassCard>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Hesabın yok mu?{' '}
            <Link
              href="/kayit"
              className="group relative inline-block font-semibold text-foreground transition-colors"
            >
              <span className="relative z-10 group-hover:text-brand-400">Ücretsiz hesap aç</span>
              <span className="absolute bottom-0 left-0 h-[1px] w-0 bg-brand-400 transition-all group-hover:w-full" />
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
