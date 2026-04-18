'use client';

import { Bell, Eye, FileText, Loader2, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { cn, formatPrice } from '@/lib/utils';

interface Alert {
  id: number;
  code: string;
  kind: 'price_above' | 'price_below' | 'return_above' | 'return_below';
  threshold: number;
  triggered_at: number | null;
  enabled: number;
  created_at: number;
  name: string | null;
  current_price: number | null;
  return_1m: number | null;
}

const KIND_LABELS: Record<Alert['kind'], string> = {
  price_above: 'Fiyat ≥',
  price_below: 'Fiyat ≤',
  return_above: '1A getirisi ≥',
  return_below: '1A getirisi ≤',
};

interface KapAlert {
  id: number;
  fund_code: string;
  enabled: number;
  last_notified_at: number | null;
  created_at: number;
  name: string | null;
}

interface WatchItem {
  id: number;
  fund_code: string;
  created_at: number;
  name: string | null;
  category: string | null;
  current_price: number | null;
  return_1m: number | null;
  return_1y: number | null;
  aum: number | null;
  sharpe_90: number | null;
}

export function AlertsClient() {
  const [alerts, setAlerts] = React.useState<Alert[]>([]);
  const [kapAlerts, setKapAlerts] = React.useState<KapAlert[]>([]);
  const [watchlist, setWatchlist] = React.useState<WatchItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [addOpen, setAddOpen] = React.useState(false);

  async function load() {
    setLoading(true);
    const [priceRes, kapRes, watchRes] = await Promise.all([
      fetch('/api/alerts', { credentials: 'include' }),
      fetch('/api/kap-alerts', { credentials: 'include' }),
      fetch('/api/watchlist', { credentials: 'include' }),
    ]);
    if (priceRes.ok) {
      const d = await priceRes.json();
      setAlerts(d.items);
    }
    if (kapRes.ok) {
      const d = await kapRes.json();
      setKapAlerts((d.items as KapAlert[]).filter((a) => a.enabled === 1));
    }
    if (watchRes.ok) {
      const d = await watchRes.json();
      setWatchlist(d.items);
    }
    setLoading(false);
  }

  React.useEffect(() => {
    load();
  }, []);

  async function deleteAlert(id: number) {
    if (!confirm('Bu alarmı sil?')) return;
    await fetch(`/api/alerts/${id}`, { method: 'DELETE', credentials: 'include' });
    await load();
  }

  async function deleteKapAlert(code: string) {
    if (!confirm(`${code} için KAP takibini kapat?`)) return;
    await fetch(`/api/kap-alerts?code=${encodeURIComponent(code)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    await load();
  }

  async function deleteWatch(code: string) {
    await fetch(`/api/watchlist?code=${encodeURIComponent(code)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    await load();
  }

  return (
    <div className="container py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border/50 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <Bell className="h-3 w-3 text-brand-400" />
            Alarmlar
          </div>
          <h1 className="display mt-2 text-5xl leading-none md:text-6xl">
            Fiyat <span className="display-italic gradient-text">alarmı</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            Fiyat eşiği veya KAP bildirimi — ilgili olay gerçekleşince
            e-postana düşer. Max 20 fiyat alarmı, 50 KAP takibi. Yatırım
            tavsiyesi değildir.
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-500 to-verdigris-400 px-4 py-2 text-sm font-semibold text-background shadow-lg shadow-brand-500/20"
        >
          <Plus className="h-4 w-4" /> Alarm ekle
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="panel p-10 text-center">
          <Bell className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <div className="display text-2xl">Henüz alarm yok</div>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Bir fonu "hedefe ulaşınca haber ver" diye izleyebilirsin.
          </p>
          <button
            onClick={() => setAddOpen(true)}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-500 to-verdigris-400 px-5 py-2 text-sm font-semibold text-background"
          >
            <Plus className="h-4 w-4" /> İlk alarmı oluştur
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((a) => {
            const label = KIND_LABELS[a.kind];
            const isPrice = a.kind.startsWith('price_');
            const now = isPrice ? a.current_price : a.return_1m !== null ? a.return_1m * 100 : null;
            const pct = now !== null
              ? ((now - a.threshold) / a.threshold) * 100
              : null;
            return (
              <div key={a.id} className="panel flex flex-wrap items-center gap-4 p-4">
                <Link
                  href={`/fon/${a.code}`}
                  className="inline-flex h-10 w-16 items-center justify-center rounded bg-gradient-to-br from-brand-500 to-verdigris-400 font-mono text-xs font-bold text-background"
                >
                  {a.code}
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{a.name ?? '—'}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    <strong className="text-foreground">{label}</strong>{' '}
                    {isPrice ? formatPrice(a.threshold, 4) : `%${a.threshold}`}
                    {' · '}
                    Güncel: <span className="font-mono">{now !== null ? (isPrice ? formatPrice(now, 4) : `%${now.toFixed(2)}`) : '—'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {a.triggered_at && Date.now() - a.triggered_at < 24 * 3_600_000 && (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-400">
                      tetiklendi
                    </span>
                  )}
                  {pct !== null && (
                    <span
                      className={cn(
                        'font-mono text-xs tabular-nums',
                        a.kind.endsWith('_above') === pct >= 0 ? 'text-muted-foreground' : 'text-brand-400',
                      )}
                    >
                      {pct >= 0 ? '+' : ''}
                      {pct.toFixed(1)}%
                    </span>
                  )}
                  <button
                    onClick={() => deleteAlert(a.id)}
                    className="rounded p-1 text-muted-foreground hover:bg-loss/20 hover:text-loss"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* İzleme listesi */}
      {!loading && (
        <div className="mt-12">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-border/40 pb-3">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <Eye className="h-3 w-3 text-brand-400" />
                İzleme listesi
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Sahiplenmeden izlediğin fonlar. Fon sayfalarındaki 👁 "İzleme listeme ekle" butonu ile eklersin.
              </p>
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              {watchlist.length} fon · max 100
            </span>
          </div>

          {watchlist.length === 0 ? (
            <div className="panel p-8 text-center">
              <Eye className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <div className="text-sm">Henüz izlediğin fon yok</div>
              <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground">
                Herhangi bir fon sayfasına git → sağ üstteki "İzleme listeme ekle" butonuna tıkla.
                Portföye almadan takip edebilirsin.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {watchlist.map((w) => {
                const r1m = w.return_1m ?? null;
                const r1y = w.return_1y ?? null;
                return (
                  <div key={w.id} className="panel flex flex-wrap items-center gap-4 p-4">
                    <Link
                      href={`/fon/${w.fund_code}`}
                      className="inline-flex h-10 w-16 items-center justify-center rounded bg-gradient-to-br from-brand-500 to-verdigris-400 font-mono text-xs font-bold text-background"
                    >
                      {w.fund_code}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{w.name ?? '—'}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {w.category ?? '—'}
                        {w.sharpe_90 !== null && (
                          <> · <span className="font-mono">Sharpe {w.sharpe_90.toFixed(2)}</span></>
                        )}
                      </div>
                    </div>
                    <div className="hidden items-center gap-4 text-xs md:flex">
                      {r1m !== null && (
                        <div className="text-right">
                          <div className="text-[10px] text-muted-foreground">1 Ay</div>
                          <div className={cn('font-mono font-semibold', r1m >= 0 ? 'text-gain' : 'text-loss')}>
                            {r1m >= 0 ? '+' : ''}{(r1m * 100).toFixed(1)}%
                          </div>
                        </div>
                      )}
                      {r1y !== null && (
                        <div className="text-right">
                          <div className="text-[10px] text-muted-foreground">1 Yıl</div>
                          <div className={cn('font-mono font-semibold', r1y >= 0 ? 'text-gain' : 'text-loss')}>
                            {r1y >= 0 ? '+' : ''}{(r1y * 100).toFixed(1)}%
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => deleteWatch(w.fund_code)}
                      className="rounded p-1 text-muted-foreground hover:bg-loss/20 hover:text-loss"
                      title="İzleme listesinden çıkar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* KAP bildirim takibi — opt-in per fund from /fon/[kod] toggle */}
      {!loading && (
        <div className="mt-12">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 border-b border-border/40 pb-3">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <FileText className="h-3 w-3 text-verdigris-400" />
                KAP bildirim takibi
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Fon sayfasındaki "KAP bildirimlerini e-postayla al" toggle'ı ile eklenir.
              </p>
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              {kapAlerts.length} aktif
            </span>
          </div>

          {kapAlerts.length === 0 ? (
            <div className="panel p-8 text-center">
              <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <div className="text-sm">Henüz KAP takibi yok</div>
              <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground">
                Bir fonun sayfasını aç → sağ üstteki 🔔 "KAP bildirimlerini e-postayla al"
                butonuna tıkla. Yeni bildirim yayınlandığında e-posta atarız.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {kapAlerts.map((k) => (
                <div key={k.id} className="panel flex flex-wrap items-center gap-4 p-4">
                  <Link
                    href={`/fon/${k.fund_code}`}
                    className="inline-flex h-10 w-16 items-center justify-center rounded bg-gradient-to-br from-verdigris-500 to-brand-400 font-mono text-xs font-bold text-background"
                  >
                    {k.fund_code}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{k.name ?? '—'}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      <strong className="text-foreground">Tüm KAP bildirimleri</strong>
                      {' · '}
                      {k.last_notified_at
                        ? `Son mail: ${new Date(k.last_notified_at).toLocaleDateString('tr-TR')}`
                        : 'Henüz mail gönderilmedi'}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteKapAlert(k.fund_code)}
                    className="rounded p-1 text-muted-foreground hover:bg-loss/20 hover:text-loss"
                    title="Takibi kapat"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {addOpen && <AddAlertModal onClose={() => setAddOpen(false)} onAdded={() => { setAddOpen(false); load(); }} />}
    </div>
  );
}

function AddAlertModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [code, setCode] = React.useState('');
  const [kind, setKind] = React.useState<Alert['kind']>('price_above');
  const [threshold, setThreshold] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: code.toUpperCase(), kind, threshold: Number(threshold) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Kaydedilemedi');
        return;
      }
      onAdded();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-6 py-4">
          <div className="serif text-xl">Yeni alarm</div>
        </div>

        <div className="space-y-3 p-6">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Fon kodu
            </label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
              placeholder="TTE"
              className="w-full rounded-lg border border-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-brand-500/50"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Koşul
            </label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as Alert['kind'])}
              className="w-full rounded-lg border border-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-brand-500/50"
            >
              <option value="price_above">Fiyat ≥ eşik</option>
              <option value="price_below">Fiyat ≤ eşik</option>
              <option value="return_above">1A getirisi ≥ % eşik</option>
              <option value="return_below">1A getirisi ≤ % eşik</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Eşik değer
            </label>
            <input
              type="number"
              step="any"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              required
              placeholder={kind.startsWith('price_') ? '100' : '10 (yani %10)'}
              className="w-full rounded-lg border border-border bg-background/40 px-3 py-2 text-sm outline-none focus:border-brand-500/50"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {kind.startsWith('price_') ? 'TL cinsinden fon fiyatı' : 'Yüzde (ör: 15 = %15)'}
            </p>
          </div>
          {error && (
            <div className="rounded-lg border border-loss/30 bg-loss/10 px-3 py-2 text-xs text-loss">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border bg-card/50 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            İptal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-500 to-verdigris-400 px-5 py-1.5 text-sm font-semibold text-background disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Oluştur
          </button>
        </div>
      </form>
    </div>
  );
}
