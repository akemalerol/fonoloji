'use client';

import * as React from 'react';

interface Window {
  tz: string;
  open: [number, number];
  close: [number, number];
  weekendsClosed: boolean;
}

const WINDOWS: Record<string, Window> = {
  BIST100: { tz: 'Europe/Istanbul', open: [9, 55], close: [18, 30], weekendsClosed: true },
  USDTRY: { tz: 'UTC', open: [0, 0], close: [24, 0], weekendsClosed: true },
  EURTRY: { tz: 'UTC', open: [0, 0], close: [24, 0], weekendsClosed: true },
  GBPTRY: { tz: 'UTC', open: [0, 0], close: [24, 0], weekendsClosed: true },
  GOLDTRY_GR: { tz: 'UTC', open: [0, 0], close: [24, 0], weekendsClosed: true },
  GOLDUSD_OZ: { tz: 'UTC', open: [0, 0], close: [24, 0], weekendsClosed: true },
  SILVERTRY_GR: { tz: 'UTC', open: [0, 0], close: [24, 0], weekendsClosed: true },
  SILVERUSD_OZ: { tz: 'UTC', open: [0, 0], close: [24, 0], weekendsClosed: true },
  NDX: { tz: 'America/New_York', open: [9, 30], close: [16, 20], weekendsClosed: true },
  SPX: { tz: 'America/New_York', open: [9, 30], close: [16, 20], weekendsClosed: true },
  FTSE: { tz: 'Europe/London', open: [8, 0], close: [16, 50], weekendsClosed: true },
  DAX: { tz: 'Europe/Berlin', open: [9, 0], close: [17, 50], weekendsClosed: true },
  BTCUSD: { tz: 'UTC', open: [0, 0], close: [24, 0], weekendsClosed: false },
  ETHUSD: { tz: 'UTC', open: [0, 0], close: [24, 0], weekendsClosed: false },
};

function isOpen(w: Window, now: Date): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: w.tz,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const wd = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const day = dayMap[wd] ?? 1;
  if (w.weekendsClosed && (day === 0 || day === 6)) return false;
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const nowMin = hour * 60 + minute;
  const openMin = w.open[0] * 60 + w.open[1];
  const closeMin = w.close[0] * 60 + w.close[1];
  return nowMin >= openMin && nowMin < closeMin;
}

export function MarketSessionBadge({ symbols }: { symbols: string[] }) {
  const [now, setNow] = React.useState(() => new Date());

  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const windows = symbols.map((s) => WINDOWS[s]).filter((w): w is Window => Boolean(w));
  if (windows.length === 0) return null;

  const allOpen = windows.every((w) => isOpen(w, now));
  const anyOpen = windows.some((w) => isOpen(w, now));

  const label = allOpen ? 'Seans açık' : anyOpen ? 'Kısmen açık' : 'Seans kapalı';
  const color = allOpen ? 'emerald' : anyOpen ? 'amber' : 'muted-foreground';
  const dotClass = allOpen
    ? 'bg-emerald-400'
    : anyOpen
      ? 'bg-amber-400'
      : 'bg-muted-foreground/50';

  return (
    <div className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-${color}`}>
      <span className="relative flex h-1.5 w-1.5">
        {allOpen && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${dotClass}`} />
      </span>
      {label}
    </div>
  );
}
