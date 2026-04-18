'use client';

import { Eye, EyeOff, Loader2 } from 'lucide-react';
import * as React from 'react';

export function WatchlistToggle({ code }: { code: string }) {
  const [status, setStatus] = React.useState<'loading' | 'anonymous' | 'off' | 'on'>('loading');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/watchlist/status?code=${encodeURIComponent(code)}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d: { enabled: boolean; anonymous?: boolean }) => {
        if (cancelled) return;
        if (d.anonymous) setStatus('anonymous');
        else setStatus(d.enabled ? 'on' : 'off');
      })
      .catch(() => { if (!cancelled) setStatus('anonymous'); });
    return () => { cancelled = true; };
  }, [code]);

  const toggle = async () => {
    if (status === 'anonymous' || busy) return;
    setBusy(true);
    try {
      if (status === 'on') {
        const r = await fetch(`/api/watchlist?code=${encodeURIComponent(code)}`, {
          method: 'DELETE', credentials: 'include',
        });
        if (r.ok) setStatus('off');
      } else {
        const r = await fetch('/api/watchlist', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        if (r.ok) setStatus('on');
      }
    } finally { setBusy(false); }
  };

  if (status === 'loading') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
        <Loader2 className="h-3 w-3 animate-spin" />
      </span>
    );
  }
  if (status === 'anonymous') {
    return (
      <a
        href={`/giris?next=/fon/${code}`}
        className="inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-background/40 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-brand-500/50 hover:text-brand-300"
      >
        <Eye className="h-3 w-3" /> İzleme listeme ekle
      </a>
    );
  }
  const on = status === 'on';
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] transition disabled:opacity-60 ${
        on
          ? 'border-brand-500/50 bg-brand-500/10 text-brand-200 hover:bg-brand-500/15'
          : 'border-border/50 bg-background/40 text-muted-foreground hover:border-brand-500/40 hover:text-brand-300'
      }`}
    >
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : on ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
      {on ? 'İzliyorsun' : 'İzleme listeme ekle'}
    </button>
  );
}
