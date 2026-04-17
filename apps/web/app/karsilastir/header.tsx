'use client';

import { Loader2, Plus, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { api, type FundRow } from '@/lib/api';
import { cn } from '@/lib/utils';

export function CompareHeader({ codes }: { codes: string[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<FundRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [local, setLocal] = React.useState(codes);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setLocal(codes);
  }, [codes.join(',')]);

  // Debounced search
  React.useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      api
        .search(query)
        .then((d) => setResults(d.items.slice(0, 10)))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  React.useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function apply(next: string[]) {
    setLocal(next);
    const qs = next.length ? `?kodlar=${next.join(',')}` : '';
    router.push(`/karsilastir${qs}`);
  }

  function add(code: string) {
    const next = Array.from(new Set([...local, code.toUpperCase()])).slice(0, 6);
    apply(next);
    setOpen(false);
    setQuery('');
  }

  function remove(code: string) {
    apply(local.filter((c) => c !== code));
  }

  function clear() {
    apply([]);
  }

  const canAdd = local.length < 6;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {local.length === 0 && (
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-500 to-verdigris-400 px-5 py-2.5 text-sm font-semibold text-background shadow-lg shadow-brand-500/20 hover:shadow-brand-500/35"
          >
            <Search className="h-4 w-4" />
            Fon ara ve ekle
          </button>
        )}

        {local.map((code) => (
          <span
            key={code}
            className="group inline-flex items-center gap-1.5 rounded-full border border-brand-500/40 bg-brand-500/10 pl-3 pr-1 py-1 text-sm"
          >
            <span className="font-mono font-semibold text-foreground">{code}</span>
            <button
              onClick={() => remove(code)}
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-loss/20 hover:text-loss"
              aria-label={`${code} kaldır`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        {local.length > 0 && canAdd && (
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1 text-sm text-muted-foreground hover:border-brand-500 hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Fon ekle ({local.length}/6)
          </button>
        )}

        {local.length > 0 && (
          <button
            onClick={clear}
            className="ml-auto text-xs text-muted-foreground hover:text-loss"
          >
            Tümünü temizle
          </button>
        )}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-background/80 backdrop-blur-sm pt-[20vh]"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Fon kodu veya ismi ara… (ör: TTE, İş Portföy)"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <kbd className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">ESC</kbd>
            </div>

            <div className="max-h-[50vh] overflow-y-auto">
              {query.length < 2 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  Aramaya başla — en az 2 karakter
                </div>
              ) : results.length === 0 && !loading ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  "{query}" için sonuç yok
                </div>
              ) : (
                <ul>
                  {results.map((f) => {
                    const already = local.includes(f.code);
                    return (
                      <li key={f.code}>
                        <button
                          onClick={() => !already && add(f.code)}
                          disabled={already}
                          className={cn(
                            'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary hover:text-foreground',
                            already && 'opacity-50',
                          )}
                        >
                          <span className="inline-flex h-8 w-14 items-center justify-center rounded bg-gradient-to-br from-brand-500 to-verdigris-400 font-mono text-xs font-bold text-background">
                            {f.code}
                          </span>
                          <span className="min-w-0 flex-1">
                            <div className="truncate text-sm">{f.name}</div>
                            <div className="text-[11px] text-muted-foreground">{f.category ?? '—'}</div>
                          </span>
                          {already && (
                            <span className="rounded-full bg-brand-500/20 px-2 py-0.5 text-[10px] text-brand-400">
                              ekli
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
              Seçili: <strong>{local.length}</strong>/6 · En az 2 fon eklediğinde karşılaştırma açılır
            </div>
          </div>
        </div>
      )}
    </>
  );
}
