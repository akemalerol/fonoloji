import Link from 'next/link';
import { AuthHeader, GlassCard } from '@/components/auth/glass-card';
import { VerifyForm } from './form';

export const metadata = { title: 'E-posta Doğrula · Fonoloji' };
export const dynamic = 'force-dynamic';

export default function VerifyPage({ searchParams }: { searchParams: { email?: string; dev?: string } }) {
  const email = searchParams.email ?? '';
  const dev = searchParams.dev;

  return (
    <div className="relative min-h-[85vh] overflow-hidden">
      <div className="pointer-events-none absolute inset-0 aurora opacity-60" />
      <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle_at_50%_30%,rgba(20,184,166,0.18),transparent_50%),radial-gradient(circle_at_30%_80%,rgba(245,158,11,0.15),transparent_50%)]" />

      <div className="container relative flex min-h-[85vh] flex-col items-center justify-center py-12">
        <div className="w-full max-w-[440px]">
          <GlassCard>
            <AuthHeader
              title={
                <>
                  E-postayı <span className="display-italic gradient-text">doğrula</span>
                </>
              }
              subtitle={
                <>
                  <span className="text-foreground/90">{email || 'adresine'}</span> adresine 6 haneli kod gönderildi.
                </>
              }
            />
            <VerifyForm initialEmail={email} devCode={dev} />
          </GlassCard>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Yanlış adres mi?{' '}
            <Link href="/kayit" className="font-semibold text-foreground hover:text-brand-400">
              Geri dön
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
