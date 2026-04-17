'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import { Search, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { cn, formatPercent } from '@/lib/utils';

interface SearchItem {
  code: string;
  name: string;
  category?: string;
  return_1d?: number;
}

export function CommandMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [items, setItems] = React.useState<SearchItem[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    if (query.length < 2) {
      setItems([]);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [query, open]);

  const go = (code: string) => {
    onOpenChange(false);
    setQuery('');
    router.push(`/fon/${code}`);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-[50%] top-[20%] z-50 w-full max-w-xl translate-x-[-50%] overflow-hidden rounded-xl border border-border bg-popover p-0 shadow-2xl',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-top-8',
          )}
        >
          <DialogPrimitive.Title className="sr-only">Fon ara</DialogPrimitive.Title>
          <Command shouldFilter={false} className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground">
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Command.Input
                autoFocus
                value={query}
                onValueChange={setQuery}
                placeholder="Fon kodu veya ad (örn. TTE, hisse senedi)…"
                className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              />
              <kbd className="rounded bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                ESC
              </kbd>
            </div>
            <Command.List className="max-h-[380px] overflow-y-auto p-2">
              {loading && <div className="py-6 text-center text-sm text-muted-foreground">Aranıyor…</div>}
              {!loading && query.length >= 2 && items.length === 0 && (
                <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                  "{query}" için sonuç yok.
                </Command.Empty>
              )}
              {items.length > 0 && (
                <Command.Group heading="Fonlar">
                  {items.map((item) => (
                    <Command.Item
                      key={item.code}
                      value={item.code}
                      onSelect={() => go(item.code)}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm data-[selected=true]:bg-secondary data-[selected=true]:text-foreground"
                    >
                      <div className="flex h-8 w-12 shrink-0 items-center justify-center rounded bg-gradient-to-br from-brand-500 to-verdigris-400 font-mono text-xs font-bold text-background">
                        {item.code}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{item.name}</div>
                        {item.category && (
                          <div className="text-xs text-muted-foreground">{item.category}</div>
                        )}
                      </div>
                      {item.return_1d !== undefined && item.return_1d !== null && (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 tabular-nums text-xs',
                            item.return_1d > 0 ? 'text-gain' : item.return_1d < 0 ? 'text-loss' : 'text-muted-foreground',
                          )}
                        >
                          <TrendingUp className="h-3 w-3" />
                          {formatPercent(item.return_1d)}
                        </span>
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {query.length < 2 && (
                <Command.Group heading="Öneri">
                  <Command.Item
                    className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm data-[selected=true]:bg-secondary data-[selected=true]:text-foreground"
                    value="browse"
                    onSelect={() => {
                      onOpenChange(false);
                      router.push('/fonlar');
                    }}
                  >
                    Tüm fonları gör →
                  </Command.Item>
                  <Command.Item
                    className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm data-[selected=true]:bg-secondary data-[selected=true]:text-foreground"
                    value="discover"
                    onSelect={() => {
                      onOpenChange(false);
                      router.push('/kesifler');
                    }}
                  >
                    Keşifler sayfası →
                  </Command.Item>
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
