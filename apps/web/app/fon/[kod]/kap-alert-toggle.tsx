'use client';

import { Bell, BellOff, Loader2 } from 'lucide-react';
import * as React from 'react';

export function KapAlertToggle({ code }: { code: string }) {
  const [status, setStatus] = React.useState<'loading' | 'anonymous' | 'off' | 'on'>('loading');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/kap-alerts/status?code=${encodeURIComponent(code)}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d: { enabled: boolean; anonymous?: boolean }) => {
        if (cancelled) return;
        if (d.anonymous) setStatus('anonymous');
        else setStatus(d.enabled ? 'on' : 'off');
      })
      .catch(() => {
        if (!cancelled) setStatus('anonymous');
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const toggle = async () => {
    if (status === 'anonymous' || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (status === 'on') {
        const r = await fetch(`/api/kap-alerts?code=${encodeURIComponent(code)}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (!r.ok) throw new Error('İptal başarısız');
        setStatus('off');
      } else {
        const r = await fetch('/api/kap-alerts', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        if (!r.ok) {
          const d = (await r.json().catch(() => ({ error: 'Hata' }))) as { error?: string };
          throw new Error(d.error ?? 'Kayıt başarısız');
        }
        setStatus('on');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
        <Loader2 className="h-3 w-3 animate-spin" /> yükleniyor
      </div>
    );
  }

  if (status === 'anonymous') {
    return (
      <a
        href={`/giris?next=/fon/${code}`}
        className="inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-background/40 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-brand-500/50 hover:text-brand-300"
      >
        <Bell className="h-3 w-3" /> KAP bildirimi için giriş yap
      </a>
    );
  }

  const on = status === 'on';
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] transition disabled:opacity-60 ${
          on
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15'
            : 'border-border/50 bg-background/40 text-muted-foreground hover:border-brand-500/50 hover:text-brand-300'
        }`}
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : on ? (
          <Bell className="h-3 w-3" />
        ) : (
          <BellOff className="h-3 w-3" />
        )}
        {on ? 'Takipte — e-posta gelecek' : 'KAP bildirimlerini e-postayla al'}
      </button>
      {error && <span className="text-[10px] text-loss">{error}</span>}
    </div>
  );
}
