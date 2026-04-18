'use client';

import { Moon, Sun } from 'lucide-react';
import * as React from 'react';

export function ThemeToggle() {
  const [theme, setTheme] = React.useState<'dark' | 'light'>('dark');
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    const stored = (typeof localStorage !== 'undefined' ? localStorage.getItem('fonoloji-theme') : null) as 'dark' | 'light' | null;
    const current: 'dark' | 'light' = stored ?? (document.documentElement.classList.contains('light') ? 'light' : 'dark');
    setTheme(current);
    setMounted(true);
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.classList.toggle('light', next === 'light');
    try { localStorage.setItem('fonoloji-theme', next); } catch {}
    // Meta theme-color'u da güncelle
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', next === 'light' ? '#f6efe0' : '#0a0a0f');
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Tema değiştir"
      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
    >
      {mounted && theme === 'light'
        ? <Moon className="h-4 w-4" />
        : <Sun className="h-4 w-4" />}
    </button>
  );
}
