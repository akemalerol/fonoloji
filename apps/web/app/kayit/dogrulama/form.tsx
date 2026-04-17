'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, RefreshCw, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

export function VerifyForm({ initialEmail, devCode }: { initialEmail: string; devCode?: string }) {
  const router = useRouter();
  const [email] = React.useState(initialEmail);
  const [code, setCode] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const isComplete = code.length === 6 && /^\d{6}$/.test(code);

  React.useEffect(() => {
    if (isComplete && !loading && !success) submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete]);

  async function submit() {
    if (!email || !isComplete) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data.error as string) || 'Kod hatalı');
        setCode('');
        return;
      }
      setSuccess(true);
      setTimeout(() => {
        router.push('/panel');
        router.refresh();
      }, 900);
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (!email || cooldown > 0) return;
    setResending(true);
    setError(null);
    try {
      const res = await fetch('/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data.error as string) || 'Tekrar gönderilemedi');
        return;
      }
      setCooldown(60);
    } finally {
      setResending(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-5"
    >
      {devCode && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          <strong>Dev:</strong> Mail yapılandırılmamış. Test kodu: <span className="font-mono">{devCode}</span>
        </div>
      )}

      <div className="flex justify-center">
        <InputOTP
          autoFocus
          maxLength={6}
          value={code}
          onChange={(v) => setCode(v.replace(/\D/g, ''))}
          disabled={loading || success}
          containerClassName="gap-2"
        >
          <InputOTPGroup className="gap-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <InputOTPSlot
                key={i}
                index={i}
                className={success ? 'border-emerald-500/50 bg-emerald-500/10' : ''}
              />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl border border-loss/30 bg-loss/10 px-3 py-2 text-center text-xs text-loss"
          >
            {error}
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-300"
          >
            <CheckCircle2 className="h-4 w-4" />
            Doğrulandı, panele yönlendiriliyorsun…
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="submit"
        disabled={!isComplete || loading || success}
        className="relative w-full disabled:opacity-50"
      >
        <div className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-500 via-brand-400 to-verdigris-400 text-sm font-semibold text-background transition-all">
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
                Doğrula <ArrowRight className="h-3.5 w-3.5" />
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </button>

      <div className="flex items-center justify-between pt-1 text-xs">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Shield className="h-3 w-3" /> Kod 10dk geçerli
        </span>
        <button
          type="button"
          onClick={resend}
          disabled={cooldown > 0 || resending || !email}
          className="inline-flex items-center gap-1 text-brand-400 transition-colors hover:text-brand-300 disabled:text-muted-foreground"
        >
          <RefreshCw className={`h-3 w-3 ${resending ? 'animate-spin' : ''}`} />
          {cooldown > 0 ? `${cooldown}s sonra tekrar` : 'Kodu yeniden gönder'}
        </button>
      </div>
    </form>
  );
}
