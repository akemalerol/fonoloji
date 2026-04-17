'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { GlassInput } from '@/components/auth/glass-card';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPw, setShowPw] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [needsVerify, setNeedsVerify] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (params.get('verified') === '1') setNotice('E-posta başarıyla doğrulandı. Şimdi giriş yapabilirsin.');
    if (params.get('registered') === '1') setNotice('Kayıt tamamlandı — e-postanı kontrol et.');
  }, [params]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNeedsVerify(null);
    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403 && data.status === 'verify_required') {
        setNeedsVerify(email);
        setError(data.error ?? 'E-postanı doğrulaman gerekiyor.');
        return;
      }
      if (!res.ok) {
        setError((data.error as string) || 'Giriş başarısız');
        return;
      }
      router.push('/panel');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (!needsVerify) return;
    setLoading(true);
    try {
      await fetch('/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: needsVerify }),
      });
    } finally {
      setLoading(false);
      router.push(`/kayit/dogrulama?email=${encodeURIComponent(needsVerify)}`);
    }
  }

  return (
    <form onSubmit={submit} className="relative space-y-4">
      <div className="space-y-3">
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
          placeholder="Şifre"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
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

      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300"
          >
            {notice}
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl border border-loss/30 bg-loss/10 px-3 py-2 text-xs text-loss"
          >
            {error}
            {needsVerify && (
              <button
                type="button"
                onClick={resend}
                className="ml-2 font-semibold text-brand-400 underline-offset-2 hover:underline"
              >
                Kodu tekrar gönder
              </button>
            )}
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
                Giriş yap
                <ArrowRight className="h-3.5 w-3.5" />
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </motion.button>

      <div className="flex items-center justify-between pt-1 text-xs">
        <Link href="/kayit" className="text-muted-foreground transition-colors hover:text-foreground">
          Hesabın yok mu?
        </Link>
        <span className="text-muted-foreground/60">TEFAS fon analizi</span>
      </div>
    </form>
  );
}
