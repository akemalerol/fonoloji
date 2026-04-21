'use client';

import { CheckCircle2, Megaphone, Save, ToggleLeft, ToggleRight, XCircle } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

// Admin paneli — AdSense yerleşim yönetimi.
// Her yerleşim için: slot_id (Google'dan), format, aç/kapat.
// Değişiklik PATCH /admin-api/ads/:placement

interface Ad {
  id: number;
  placement: string;
  label: string | null;
  slot_id: string | null;
  format: string;
  enabled: 0 | 1;
  impressions: number;
  created_at: number;
  updated_at: number;
  note: string;
}

const FORMATS = [
  { value: 'auto', label: 'Otomatik (önerilen)' },
  { value: 'fluid', label: 'Akıcı (içerik içi)' },
  { value: 'rectangle', label: 'Dikdörtgen' },
  { value: 'horizontal', label: 'Yatay banner' },
  { value: 'vertical', label: 'Dikey' },
];

export function AdsManager() {
  const [rows, setRows] = React.useState<Ad[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    fetch('/admin-api/ads', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setRows(d.items ?? []))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function save(placement: string, patch: Partial<Ad>) {
    setSavingId(placement);
    try {
      const res = await fetch(`/admin-api/ads/${placement}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const updated = await res.json();
        setRows((prev) => prev.map((r) => (r.placement === placement ? { ...r, ...updated } : r)));
        setToast('Kaydedildi ✓');
        setTimeout(() => setToast(null), 2000);
      } else {
        setToast('Hata');
        setTimeout(() => setToast(null), 2500);
      }
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-gradient-to-br from-brand-500/10 to-verdigris-500/5 p-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-300">
          <Megaphone className="h-3.5 w-3.5" /> Reklam yerleşimleri
        </div>
        <h2 className="mt-2 serif text-2xl">AdSense slot yönetimi</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Google AdSense panelinden kopyaladığın <strong>slot ID</strong>'yi ilgili yerleşime yapıştır,
          "Açık" duruma getir. Boş veya kapalı yerleşim sitede hiçbir şey göstermez. Yerleşim stili
          panel kartlarıyla uyumlu — "Reklam" etiketiyle diskret görünüm.
        </p>
        <div className="mt-3 rounded-md bg-muted/30 p-3 text-[11px] text-muted-foreground">
          <strong className="text-foreground/80">Slot ID nereden?</strong> AdSense → Reklamlar → "Genel bakış" →
          "Yeni reklam birimi" → türü seç → oluşturduktan sonra <code className="rounded bg-background/60 px-1">data-ad-slot="..."</code>
          değeri. Sadece sayılar (örn: <code className="rounded bg-background/60 px-1">1234567890</code>).
        </div>
      </div>

      {toast && (
        <div className="sticky top-4 z-10 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-center text-xs text-emerald-200">
          {toast}
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Yükleniyor…</div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <AdRow key={r.placement} ad={r} saving={savingId === r.placement} onSave={(patch) => save(r.placement, patch)} />
          ))}
        </div>
      )}
    </div>
  );
}

function AdRow({ ad, saving, onSave }: { ad: Ad; saving: boolean; onSave: (patch: Partial<Ad>) => void }) {
  const [slotId, setSlotId] = React.useState(ad.slot_id ?? '');
  const [format, setFormat] = React.useState(ad.format);
  const dirty = slotId !== (ad.slot_id ?? '') || format !== ad.format;
  const ready = slotId.trim().length > 0;

  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-colors',
        ad.enabled && ad.slot_id ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border/50 bg-card/30',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              {ad.placement}
            </span>
            {ad.enabled ? (
              ad.slot_id ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300">
                  <CheckCircle2 className="h-3 w-3" /> Aktif
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-300">
                  Slot ID bekleniyor
                </span>
              )
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">
                Kapalı
              </span>
            )}
            <span className="ml-auto text-[10px] text-muted-foreground">{ad.impressions} gösterim</span>
          </div>
          <div className="mt-1 font-semibold text-sm">{ad.label}</div>
          <div className="text-[11px] text-muted-foreground">{ad.note}</div>
        </div>
        <button
          type="button"
          onClick={() => onSave({ enabled: ad.enabled ? 0 : 1 })}
          disabled={saving || (!ad.enabled && !ad.slot_id)}
          className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-muted/40 disabled:opacity-40"
          title={ad.enabled ? 'Kapat' : 'Aç'}
        >
          {ad.enabled ? <ToggleRight className="h-5 w-5 text-emerald-400" /> : <ToggleLeft className="h-5 w-5" />}
        </button>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_180px_auto]">
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Slot ID (AdSense)
          </label>
          <input
            value={slotId}
            onChange={(e) => setSlotId(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="1234567890"
            className="w-full rounded-lg border border-border bg-background/40 px-3 py-2 font-mono text-sm focus:border-brand-500/50 focus:bg-background/60 focus:outline-none"
            maxLength={32}
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Format
          </label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="w-full rounded-lg border border-border bg-background/40 px-3 py-2 text-sm focus:border-brand-500/50 focus:bg-background/60 focus:outline-none"
          >
            {FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="button"
            disabled={!dirty || !ready || saving}
            onClick={() => onSave({ slot_id: slotId, format })}
            className={cn(
              'inline-flex h-[38px] items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors',
              dirty && ready
                ? 'bg-gradient-to-r from-brand-500 to-verdigris-400 text-background shadow-lg shadow-brand-500/20 hover:opacity-90'
                : 'bg-muted/30 text-muted-foreground',
            )}
          >
            <Save className="h-3.5 w-3.5" /> Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
