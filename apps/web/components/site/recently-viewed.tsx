'use client';

import { Clock } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

interface Item { code: string; name: string; ts: number }

const KEY = 'fonoloji-recent';
const MAX = 12;

export function pushRecent(code: string, name: string): void {
  try {
    const raw = localStorage.getItem(KEY);
    const list: Item[] = raw ? JSON.parse(raw) : [];
    const without = list.filter((x) => x.code !== code);
    const next: Item[] = [{ code, name, ts: Date.now() }, ...without].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}

export function RecentlyViewedDropdown() {
  const [items, setItems] = React.useState<Item[]>([]);
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, []);

  if (items.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Son bakılan fonlar"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <Clock className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-border bg-popover shadow-2xl">
          <div className="border-b border-border/60 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Son bakılan fonlar
          </div>
          <ul className="max-h-80 overflow-y-auto py-1">
            {items.map((it) => (
              <li key={it.code}>
                <Link
                  href={`/fon/${it.code}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted"
                >
                  <span className="inline-flex h-7 w-11 shrink-0 items-center justify-center rounded bg-gradient-to-br from-brand-500 to-verdigris-400 font-mono text-[10px] font-bold text-background">
                    {it.code}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs">{it.name}</span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="border-t border-border/60 p-2">
            <button
              type="button"
              onClick={() => { try { localStorage.removeItem(KEY); } catch {} setItems([]); setOpen(false); }}
              className="w-full rounded-md px-2 py-1 text-left text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Listeyi temizle
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Hook — fon sayfasında kullanıcı landin'ginde çağır
export function RecordRecentFund({ code, name }: { code: string; name: string }) {
  React.useEffect(() => { pushRecent(code, name); }, [code, name]);
  return null;
}
