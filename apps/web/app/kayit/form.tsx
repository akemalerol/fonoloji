'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { GlassInput } from '@/components/auth/glass-card';

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPw, setShowPw] = React.useState(false);
  const [agreed, setAgreed] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) {
      setError('Kullanım koşullarını kabul etmelisin.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = typeof data.error === 'string' ? data.error : 'Kayıt başarısız';
        setError(errMsg);
        return;
      }
      const q = new URLSearchParams({ email });
      if (data?.mail?.devCode) q.set('dev', String(data.mail.devCode));
      router.push(`/kayit/dogrulama?${q.toString()}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="relative space-y-4">
      <div className="space-y-3">
        <GlassInput
          icon={User}
          placeholder="Ad Soyad"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          maxLength={80}
        />
        <GlassInput
          icon={Mail}
          type="email"
          placeholder="E-posta adresi"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <GlassInput
          icon={Lock}
          type={showPw ? 'text' : 'password'}
          placeholder="Şifre (en az 8 karakter)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
          right={
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showPw ? 'Şifreyi gizle' : 'Şifreyi göster'}
            >
              {showPw ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          }
        />
      </div>

      <label className="flex cursor-pointer items-start gap-2 pt-1 text-[11px] text-muted-foreground">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-3.5 w-3.5 appearance-none rounded border border-white/20 bg-white/5 transition-all checked:border-brand-500 checked:bg-brand-500"
          style={{
            backgroundImage: agreed
              ? "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='white'><path d='M13.5 4.5l-7.5 7.5-3.5-3.5 1-1 2.5 2.5 6.5-6.5z'/></svg>\")"
              : undefined,
            backgroundSize: '14px',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
          }}
        />
        <span className="leading-relaxed">
          <Link href="/hakkinda" className="underline underline-offset-2 hover:text-foreground">
            Kullanım koşullarını
          </Link>{' '}
          ve KVKK aydınlatma metnini okudum, kabul ediyorum.
        </span>
      </label>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl border border-loss/30 bg-loss/10 px-3 py-2 text-xs text-loss"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        type="submit"
        disabled={loading}
        className="relative mt-2 w-full"
      >
        <div className="absolute inset-0 rounded-xl bg-brand-500/30 opacity-0 blur-lg transition-opacity group-hover:opacity-70" />
        <div className="relative flex h-11 items-center justify-center gap-1.5 overflow-hidden rounded-xl bg-gradient-to-r from-brand-500 via-brand-400 to-verdigris-400 text-sm font-semibold text-background transition-all">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.span key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-background/70 border-t-transparent" />
              </motion.span>
            ) : (
              <motion.span
                key="t"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1"
              >
                Hesap oluştur
                <ArrowRight className="h-3.5 w-3.5" />
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </motion.button>

      <p className="pt-1 text-center text-[11px] text-muted-foreground">
        Kayıt olunca e-posta adresine 6 haneli doğrulama kodu gönderilecek.
      </p>
    </form>
  );
}
