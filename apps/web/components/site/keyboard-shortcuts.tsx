'use client';

import { Command as CmdIcon, Keyboard } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

const SHORTCUTS: Array<{ keys: string[]; label: string }> = [
  { keys: ['?'], label: 'Bu yardım penceresini aç/kapat' },
  { keys: ['⌘', 'K'], label: 'Fon arama kutusunu aç' },
  { keys: ['g', 'f'], label: 'Fonlar sayfasına git' },
  { keys: ['g', 'a'], label: 'Araçlar sayfasına git' },
  { keys: ['g', 'k'], label: 'Kategoriler sayfasına git' },
  { keys: ['g', 'e'], label: 'Ekonomi sayfasına git' },
  { keys: ['g', 'h'], label: 'Ana sayfa' },
  { keys: ['g', 'p'], label: 'Piyasalar dashboard' },
  { keys: ['g', 'l'], label: 'Alarmlarım' },
  { keys: ['t'], label: 'Tema değiştir (dark/light)' },
  { keys: ['Esc'], label: 'Modal kapat' },
];

export function KeyboardShortcuts() {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [awaitingG, setAwaitingG] = React.useState(false);
  const gTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      const tag = t?.tagName;
      // Input/textarea/contenteditable içinde değilken etkin
      if (tag === 'INPUT' || tag === 'TEXTAREA' || t?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return; // Cmd+K kendi handler'ında

      if (e.key === '?') { e.preventDefault(); setHelpOpen((o) => !o); return; }
      if (e.key === 'Escape') { setHelpOpen(false); setAwaitingG(false); return; }
      if (e.key === 't' || e.key === 'T') {
        const cur = document.documentElement.classList.contains('light');
        document.documentElement.classList.toggle('light', !cur);
        try { localStorage.setItem('fonoloji-theme', !cur ? 'light' : 'dark'); } catch {}
        return;
      }
      if (awaitingG) {
        const k = e.key.toLowerCase();
        if (gTimer.current) clearTimeout(gTimer.current);
        setAwaitingG(false);
        const nav: Record<string, string> = {
          f: '/fonlar', a: '/arac', k: '/kategoriler', e: '/ekonomi',
          h: '/', p: '/ekonomi/piyasalar', l: '/alarmlarim',
        };
        if (nav[k]) { e.preventDefault(); router.push(nav[k]); }
        return;
      }
      if (e.key === 'g' || e.key === 'G') {
        setAwaitingG(true);
        if (gTimer.current) clearTimeout(gTimer.current);
        gTimer.current = setTimeout(() => setAwaitingG(false), 1500);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (gTimer.current) clearTimeout(gTimer.current);
    };
  }, [awaitingG, router]);

  return (
    <>
      {awaitingG && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full border border-border bg-popover px-4 py-2 font-mono text-xs shadow-2xl">
          <CmdIcon className="mr-1.5 inline h-3 w-3" /> <kbd className="rounded bg-background px-1.5">g</kbd> bekliyor…
        </div>
      )}
      {helpOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          onClick={() => setHelpOpen(false)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-border px-5 py-3">
              <div className="flex items-center gap-2">
                <Keyboard className="h-4 w-4 text-brand-400" />
                <span className="serif text-lg">Klavye kısayolları</span>
              </div>
            </div>
            <ul className="divide-y divide-border/40">
              {SHORTCUTS.map((s, i) => (
                <li key={i} className="flex items-center justify-between px-5 py-2 text-sm">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="flex gap-1">
                    {s.keys.map((k, j) => (
                      <kbd
                        key={j}
                        className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[11px]"
                      >
                        {k}
                      </kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
