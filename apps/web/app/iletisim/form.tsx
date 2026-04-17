'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Loader2, Send } from 'lucide-react';
import * as React from 'react';

export function ContactForm() {
  const [fullName, setFullName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [subject, setSubject] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, subject, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data.error as string) || 'Gönderilemedi');
        return;
      }
      setDone(true);
      setFullName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="panel-highlight p-10 text-center"
      >
        <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/30">
          <CheckCircle2 className="h-6 w-6 text-emerald-400" />
        </div>
        <div className="display text-2xl">
          Mesajın <span className="display-italic gradient-text">iletildi</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Teşekkürler! Genelde 24 saat içinde e-postana dönüyoruz.
        </p>
        <button
          onClick={() => setDone(false)}
          className="mt-6 text-xs text-brand-400 underline-offset-2 hover:underline"
        >
          Yeni mesaj yaz
        </button>
      </motion.div>
    );
  }

  const inputBase =
    'w-full rounded-xl border border-border bg-card/40 px-4 py-3 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/60 focus:border-brand-500/50 focus:bg-card/60';

  return (
    <form onSubmit={submit} className="panel p-7 space-y-5">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field label="Ad Soyad">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Adın soyadın"
            required
            maxLength={200}
            className={inputBase}
          />
        </Field>
        <Field label="E-posta">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="sen@ornek.com"
            required
            className={inputBase}
          />
        </Field>
      </div>

      <Field label="Konu">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Mesajının konusu"
          required
          maxLength={300}
          className={inputBase}
        />
      </Field>

      <Field label="Mesaj">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Yazmaya başla…"
          required
          rows={6}
          maxLength={5000}
          className={`${inputBase} resize-none`}
        />
        <div className="mt-1 text-right text-[11px] text-muted-foreground/60">
          {message.length} / 5000
        </div>
      </Field>

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
        whileHover={{ scale: 1.005 }}
        whileTap={{ scale: 0.995 }}
        type="submit"
        disabled={loading}
        className="relative w-full disabled:opacity-60"
      >
        <div className="flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 via-brand-400 to-verdigris-400 font-semibold text-background shadow-lg shadow-brand-500/20 transition-all hover:shadow-brand-500/35">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Mesajı gönder
              <Send className="h-4 w-4" />
            </>
          )}
        </div>
      </motion.button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
