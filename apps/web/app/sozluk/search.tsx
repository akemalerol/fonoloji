'use client';

import { Search, X } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { GLOSSARY } from '@/lib/glossary';

// Fuzzy-lite arama — baş harfler + substring match, case-insensitive + TR fold.
function trFold(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

export function GlossarySearch() {
  const [q, setQ] = React.useState('');
  const query = trFold(q.trim());

  const results = React.useMemo(() => {
    if (!query || query.length < 2) return [];
    return GLOSSARY.filter((e) => {
      const t = trFold(e.title);
      const s = trFold(e.short);
      const slug = trFold(e.slug);
      return t.includes(query) || s.includes(query) || slug.includes(query);
    }).slice(0, 8);
  }, [query]);

  return (
    <div className="mb-6 mt-8 md:max-w-2xl">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Terim ara: Sharpe, reel getiri, volatilite…"
          className="w-full rounded-lg border border-border/60 bg-background/40 py-3 pl-10 pr-10 text-sm focus:border-brand-500 focus:outline-none"
        />
        {q && (
          <button
            onClick={() => setQ('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Temizle"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {results.length > 0 && (
        <div className="mt-2 overflow-hidden rounded-lg border border-border/60 bg-card shadow-lg">
          {results.map((r) => (
            <Link
              key={r.slug}
              href={`/sozluk/${r.slug}`}
              className="block border-b border-border/30 px-4 py-3 last:border-0 hover:bg-muted/20"
            >
              <div className="text-sm font-semibold text-foreground">{r.title}</div>
              <div className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{r.short}</div>
            </Link>
          ))}
        </div>
      )}

      {q && results.length === 0 && query.length >= 2 && (
        <div className="mt-2 rounded-lg border border-border/40 bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
          &quot;{q}&quot; için sonuç yok. <Link href="/iletisim" className="text-brand-400 hover:text-brand-300">Bize yaz</Link>,
          terimi ekleyelim.
        </div>
      )}
    </div>
  );
}
