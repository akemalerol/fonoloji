'use client';

import { Copy, LogOut, Plus, RefreshCw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Me } from '@/lib/auth';
import { cn } from '@/lib/utils';

export function PanelClient({ initial }: { initial: Me }) {
  const router = useRouter();
  const [me, setMe] = React.useState(initial);
  const [newKey, setNewKey] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  async function refresh() {
    const res = await fetch('/auth/me', { credentials: 'include' });
    if (res.ok) setMe((await res.json()) as Me);
  }

  async function createKey() {
    setLoading(true);
    try {
      const res = await fetch('/auth/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: `Anahtar ${me.keys.length + 1}` }),
      });
      if (res.ok) {
        const data = (await res.json()) as { plain: string };
        setNewKey(data.plain);
        await refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  async function revokeKey(id: number) {
    if (!confirm('Bu anahtar iptal edilsin mi? İşlem geri alınamaz.')) return;
    await fetch(`/auth/api-keys/${id}`, { method: 'DELETE', credentials: 'include' });
    await refresh();
  }

  async function logout() {
    await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
    router.push('/');
    router.refresh();
  }

  async function copyKey(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  const { user, plan, usage, keys } = me;
  const used = usage.count;
  const quota = plan.monthlyQuota;
  const pct = Math.min(100, Math.round((used / quota) * 100));

  return (
    <div className="container py-10">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b border-border/50 pb-6">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">panel</div>
          <h1 className="display mt-2 text-5xl leading-none md:text-6xl">
            {user.name ? `Merhaba, ${user.name}` : user.email}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            <Badge variant="default">{plan.name}</Badge> · {user.email}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="h-3.5 w-3.5" /> Yenile
          </Button>
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut className="h-3.5 w-3.5" /> Çıkış
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Usage card */}
        <div className="panel p-6 lg:col-span-2">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Bu ay kullanım</div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-4xl tabular-nums">{used.toLocaleString('tr-TR')}</span>
                <span className="text-sm text-muted-foreground">/ {quota.toLocaleString('tr-TR')} istek</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Dakika limiti</div>
              <div className="font-mono text-lg">{plan.rateLimitPerMinute} rpm</div>
            </div>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/50">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                pct > 85 ? 'bg-loss' : pct > 60 ? 'bg-amber-500' : 'bg-gain',
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            %{pct} kullanıldı · dönem {usage.period} · sıfırlama ayın 1'i
          </p>
          {pct > 60 && (
            <Link
              href="/iletisim"
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-xs hover:bg-card"
            >
              Kurumsal plan için iletişim →
            </Link>
          )}
        </div>

        {/* Plan card */}
        <div className="panel p-6">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Mevcut plan</div>
          <div className="mt-1 serif text-3xl">{plan.name}</div>
          <div className="mt-1 font-mono text-sm text-muted-foreground">
            {plan.priceTRY === 0 ? 'Ücretsiz' : `₺${plan.priceTRY}/ay`}
          </div>
          <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
            {plan.features.map((f) => (
              <li key={f}>· {f}</li>
            ))}
          </ul>
          <Link
            href="/iletisim"
            className="mt-4 inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300"
          >
            Özel plan için iletişim →
          </Link>
        </div>

        {/* Keys card */}
        <div className="panel p-6 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">API Anahtarları</div>
              <h2 className="serif text-2xl">Erişim Anahtarların</h2>
            </div>
            <Button onClick={createKey} disabled={loading} size="sm">
              <Plus className="h-3.5 w-3.5" /> Yeni anahtar
            </Button>
          </div>

          {newKey && (
            <div className="mb-4 rounded-lg border border-brand-500/40 bg-brand-500/10 p-4">
              <div className="mb-2 text-xs uppercase tracking-wider text-brand-400">
                Yeni anahtarın — yalnızca ŞİMDİ gösterilir, kopyala ve güvenli yere kaydet
              </div>
              <div className="flex items-center gap-2 overflow-x-auto">
                <code className="flex-1 rounded bg-background/70 px-3 py-2 font-mono text-xs">{newKey}</code>
                <Button size="sm" variant="outline" onClick={() => copyKey(newKey)}>
                  <Copy className="h-3.5 w-3.5" /> {copied ? 'Kopyalandı' : 'Kopyala'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setNewKey(null)}>
                  Kapat
                </Button>
              </div>
            </div>
          )}

          {keys.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Henüz anahtarın yok. "Yeni anahtar" ile başla.
            </div>
          ) : (
            <ul className="divide-y divide-border/50">
              {keys.map((k) => (
                <li key={k.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <code className="font-mono text-sm">{k.prefix}…</code>
                      {k.name && <span className="text-sm text-muted-foreground">· {k.name}</span>}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      Oluşturma: {new Date(k.createdAt).toLocaleString('tr-TR')} ·{' '}
                      {k.lastUsedAt
                        ? `Son kullanım: ${new Date(k.lastUsedAt).toLocaleString('tr-TR')}`
                        : 'Henüz kullanılmadı'}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => revokeKey(k.id)}>
                    <Trash2 className="h-3.5 w-3.5" /> İptal
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Docs quicklink */}
        <div className="panel p-6 lg:col-span-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Başlangıç</div>
              <div className="mt-1 serif text-2xl">İlk isteğini at</div>
            </div>
            <Link
              href="/api-docs"
              className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300"
            >
              Tam doküman →
            </Link>
          </div>
          <pre className="mt-4 overflow-x-auto rounded-lg border border-border bg-background/50 p-4 font-mono text-xs">
            <code>{`curl -H "X-API-Key: fon_..." https://fonoloji.com/v1/funds/TTE`}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
