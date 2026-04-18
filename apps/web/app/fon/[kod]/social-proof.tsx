'use client';

import { Bell, Briefcase, Eye, FileText, Users } from 'lucide-react';
import * as React from 'react';

interface Proof {
  watchlist: number;
  priceAlerts: number;
  kapAlerts: number;
  portfolio: number;
  total: number;
}

export function SocialProof({ code }: { code: string }) {
  const [data, setData] = React.useState<Proof | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/funds/${encodeURIComponent(code)}/social-proof`)
      .then((r) => r.json())
      .then((d: Proof) => { if (!cancelled) setData(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [code]);

  if (!data || data.total === 0) return null;

  const chips: Array<{ icon: React.ReactNode; value: number; label: string }> = [
    { icon: <Eye className="h-3 w-3" />, value: data.watchlist, label: 'izliyor' },
    { icon: <Briefcase className="h-3 w-3" />, value: data.portfolio, label: 'portföyde' },
    { icon: <Bell className="h-3 w-3" />, value: data.priceAlerts, label: 'fiyat alarmı' },
    { icon: <FileText className="h-3 w-3" />, value: data.kapAlerts, label: 'KAP alarmı' },
  ].filter((c) => c.value > 0);

  if (chips.length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-border/40 bg-background/30 px-3 py-2 text-[11px] text-muted-foreground">
      <Users className="h-3 w-3 text-brand-400" />
      <span className="font-semibold text-foreground">{data.total}</span>
      <span>kullanıcı bu fonu takipte</span>
      <span className="text-muted-foreground/40">·</span>
      {chips.map((c, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {c.icon}
          <span className="font-mono tabular-nums">{c.value}</span>
          <span>{c.label}</span>
          {i < chips.length - 1 && <span className="ml-1 text-muted-foreground/40">·</span>}
        </span>
      ))}
    </div>
  );
}
