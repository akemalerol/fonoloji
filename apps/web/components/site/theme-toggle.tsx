'use client';

import { Moon, Sun } from 'lucide-react';
import * as React from 'react';

// Theme toggle with View Transitions API cross-fade.
//
// Modern tarayıcı: document.startViewTransition(toggle) → GPU cross-fade,
// sayfa layout thrash etmez. Kasma hissi yok.
// Eski tarayıcı: plain toggle (transition'sız ama hızlı).
//
// DOM = source of truth (React state stale olabilir, class'ı direkt oku).

type Theme = 'dark' | 'light';

export function ThemeToggle() {
  const [theme, setTheme] = React.useState<Theme>('dark');
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    const stored = (typeof localStorage !== 'undefined' ? localStorage.getItem('fonoloji-theme') : null) as Theme | null;
    if (stored) {
      document.documentElement.classList.toggle('light', stored === 'light');
    }
    const current: Theme = document.documentElement.classList.contains('light') ? 'light' : 'dark';
    setTheme(current);
    setMounted(true);
  }, []);

  const applyTheme = (next: Theme) => {
    document.documentElement.classList.toggle('light', next === 'light');
    try { localStorage.setItem('fonoloji-theme', next); } catch {}
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', next === 'light' ? '#f6efe0' : '#0a0a0f');
    setTheme(next);
  };

  const toggle = () => {
    // DOM = source of truth
    const currentlyLight = document.documentElement.classList.contains('light');
    const next: Theme = currentlyLight ? 'dark' : 'light';

    // View Transitions API — Chrome 111+, Safari 18+. Yoksa düz uygula.
    if (typeof document !== 'undefined' && typeof document.startViewTransition === 'function') {
      document.startViewTransition(() => applyTheme(next));
    } else {
      applyTheme(next);
    }
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
