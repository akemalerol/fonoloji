'use client';

import { FileText, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

interface BrokerItem {
  broker: string;
  label: string;
  kind: 'native' | 'generated';
  cadence: string;
  stockCount: number;
  asOfDate: string | null;
}

const TR_MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

function formatTrDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  const mIdx = Number(m);
  if (!y || !Number.isFinite(mIdx) || mIdx < 1 || mIdx > 12) return iso;
  if (d) return `${d} ${TR_MONTHS[mIdx - 1]} ${y}`;
  return `${TR_MONTHS[mIdx - 1]} ${y}`;
}

const BROKER_BG: Record<string, string> = {
  isyatirim: 'from-[#0033A0]/15 via-brand-500/5 to-transparent',
  ykyatirim: 'from-[#003aa6]/20 via-brand-500/10 to-transparent',
  ziraatyatirim: 'from-emerald-500/15 via-brand-500/5 to-transparent',
  garantibbvayatirim: 'from-amber-500/15 via-brand-500/5 to-transparent',
};

export function AnalystReportsClient({ items }: { items: BrokerItem[] }) {
  const [selected, setSelected] = React.useState<string>(items[0]?.broker ?? 'isyatirim');
  const [loading, setLoading] = React.useState(true);
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    setLoading(true);
  }, [selected, reloadKey]);

  const current = items.find((i) => i.broker === selected);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card/40 p-8 text-center text-sm text-muted-foreground">
        Henüz rapor yok. Veri çekilirken bekle, birkaç dakika içinde gelir.
      </div>
    );
  }

  // #toolbar=0&navpanes=0&scrollbar=0 → Chrome/Edge'de toolbar gizlenir, indirme butonu yok.
  const src = `/api/broker-reports/${selected}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`;

  return (
    <div className="space-y-5">
      {/* Broker chip'leri */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {items.map((b) => (
          <button
            key={b.broker}
            onClick={() => setSelected(b.broker)}
            className={cn(
              'group relative overflow-hidden rounded-xl border p-4 text-left transition',
              selected === b.broker
                ? 'border-brand-500 bg-brand-500/5 ring-1 ring-brand-500/40'
                : 'border-border/60 bg-card/40 hover:border-border/90',
            )}
          >
            <div
              className={cn(
                'absolute inset-0 bg-gradient-to-br opacity-60 transition group-hover:opacity-80',
                BROKER_BG[b.broker] ?? 'from-brand-500/10 to-transparent',
              )}
            />
            <div className="relative">
              <div className="flex items-start justify-between gap-2">
                <div className="font-serif text-lg font-semibold leading-tight">{b.label}</div>
                {b.kind === 'generated' && (
                  <span
                    className="inline-flex items-center gap-0.5 rounded bg-brand-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-brand-200"
                    title="Fonoloji tarafından API verisinden derlenmiştir"
                  >
                    <Sparkles className="h-2.5 w-2.5" /> Fonoloji
                  </span>
                )}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">{b.cadence}</div>
              <div className="mt-3 flex items-baseline gap-3 text-xs">
                <span>
                  <span className="font-mono text-sm text-foreground">{b.stockCount}</span>{' '}
                  <span className="text-muted-foreground">hisse</span>
                </span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">{formatTrDate(b.asOfDate)}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Seçili broker başlığı + yenile */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Yayınlanan rapor
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-lg font-semibold">
            <FileText className="h-4 w-4 text-brand-400" />
            {current?.label}
            <span className="text-xs font-normal text-muted-foreground">
              — {formatTrDate(current?.asOfDate ?? null)}
            </span>
          </div>
        </div>
        <button
          onClick={() => setReloadKey((k) => k + 1)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-card/40 px-3 py-1.5 text-xs hover:bg-card/70"
          title="En güncel raporu yeniden çek"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Yenile
        </button>
      </div>

      {/* PDF viewer — indirmeyi gizlemek için iframe + oncontextmenu */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-[#1e1e1e]">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/80 px-4 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Rapor yükleniyor…
            </div>
          </div>
        )}
        <iframe
          key={`${selected}-${reloadKey}`}
          src={src}
          title={current?.label}
          className="h-[80vh] min-h-[600px] w-full border-0"
          onLoad={() => setLoading(false)}
          // Context menu'den "farklı kaydet" yine mümkün; native browser PDF viewer ile
          // tam engellemek mümkün değil. Toolbar hack'i çoğu kullanıcı için yeterli.
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>

      <p className="pt-2 text-[11px] leading-relaxed text-muted-foreground">
        <strong className="text-muted-foreground/90">Kaynak:</strong>{' '}
        {current?.kind === 'generated'
          ? `Fonoloji tarafından ${current.label}'ın resmi API'sinden çekilen verilerle derlenmiştir.`
          : `${current?.label}'ın resmi web sitesinden doğrudan alınan güncel rapor.`}{' '}
        Bilgi amaçlıdır; yatırım tavsiyesi değildir.
      </p>
    </div>
  );
}
