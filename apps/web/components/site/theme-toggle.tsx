'use client';

import { Moon, Sun } from 'lucide-react';
import * as React from 'react';

// DOM truth-source theme toggle + smooth cross-fade.
//
// Eski bug'lar:
// - "ilk basış boş dönüyor": localStorage'da 'light' saklı ama DOM'da .light class
//   yokken (erken sayfa yüklemesi) toggle React state'e güveniyordu → first click
//   devalue edilip görsel değişmiyordu. Fix: DOM class'ını source of truth yap.
// - Geçiş sert: renk aniden değişiyordu. Fix: toggle anında html'e geçici
//   .theme-transition class'ı ekle (350ms sonra kaldırılıyor), globals.css
//   bu class varken tüm bg/color/border/ring'lere 300ms ease transition uyguluyor.

export function ThemeToggle() {
  const [theme, setTheme] = React.useState<'dark' | 'light'>('dark');
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    const stored = (typeof localStorage !== 'undefined' ? localStorage.getItem('fonoloji-theme') : null) as 'dark' | 'light' | null;
    if (stored) {
      // Stored tercihi DOM ile eşitle — layout script race'ine karşı güvence
      document.documentElement.classList.toggle('light', stored === 'light');
    }
    const current: 'dark' | 'light' = document.documentElement.classList.contains('light') ? 'light' : 'dark';
    setTheme(current);
    setMounted(true);
  }, []);

  const toggle = () => {
    // DOM = source of truth (React state olabilir stale)
    const currentlyLight = document.documentElement.classList.contains('light');
    const next: 'dark' | 'light' = currentlyLight ? 'dark' : 'light';

    // Smooth transition — geçici class 350ms sonra kaldırılır
    document.documentElement.classList.add('theme-transition');
    window.setTimeout(() => {
      document.documentElement.classList.remove('theme-transition');
    }, 380);

    document.documentElement.classList.toggle('light', next === 'light');
    setTheme(next);
    try { localStorage.setItem('fonoloji-theme', next); } catch {}
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
