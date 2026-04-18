'use client';

import { ExternalLink, FileText } from 'lucide-react';
import * as React from 'react';
import { KapAlertToggle } from './kap-alert-toggle';

interface Item {
  disclosure_index: number;
  subject: string | null;
  kap_title: string | null;
  rule_type: string | null;
  period: number | null;
  year: number | null;
  publish_date: number;
  attachment_count: number;
  summary: string | null;
}

type FilterKey = 'all' | 'portfoy' | 'ozel_durum' | 'finansal' | 'diger';

const FILTERS: Array<{ key: FilterKey; label: string; match: (s: string | null) => boolean }> = [
  { key: 'all', label: 'Tümü', match: () => true },
  {
    key: 'portfoy',
    label: 'Portföy Raporları',
    match: (s) => Boolean(s && /Portföy|portföy/.test(s)),
  },
  {
    key: 'finansal',
    label: 'Finansal / İzahname',
    match: (s) => Boolean(s && (/Finansal|İzahname|izahname|Sorumluluk|Yatırımcı Bilgi|İhraç/.test(s))),
  },
  {
    key: 'ozel_durum',
    label: 'Özel Durum',
    match: (s) => Boolean(s && /Özel Durum|Genel Açıklama/i.test(s)),
  },
  {
    key: 'diger',
    label: 'Diğer',
    match: (s) => {
      if (!s) return true;
      const matched = /Portföy|portföy|Finansal|İzahname|izahname|Sorumluluk|Yatırımcı Bilgi|İhraç|Özel Durum|Genel Açıklama/.test(s);
      return !matched;
    },
  },
];

function formatTs(ms: number): { date: string; time: string } {
  const ts = new Date(ms);
  const date = `${String(ts.getDate()).padStart(2, '0')}.${String(ts.getMonth() + 1).padStart(2, '0')}.${ts.getFullYear()}`;
  const time = `${String(ts.getHours()).padStart(2, '0')}:${String(ts.getMinutes()).padStart(2, '0')}`;
  return { date, time };
}

export function KapDisclosuresCard({
  code,
  items,
  backfillTriggered,
}: {
  code: string;
  items: Item[];
  backfillTriggered: boolean;
}) {
  const [activeFilter, setActiveFilter] = React.useState<FilterKey>('all');
  const activeDef = FILTERS.find((f) => f.key === activeFilter) ?? FILTERS[0]!;

  const counts = React.useMemo(() => {
    const c: Record<FilterKey, number> = { all: items.length, portfoy: 0, ozel_durum: 0, finansal: 0, diger: 0 };
    for (const it of items) {
      for (const f of FILTERS) {
        if (f.key !== 'all' && f.match(it.subject)) c[f.key]++;
      }
    }
    return c;
  }, [items]);

  const filtered = items.filter((it) => activeDef.match(it.subject));

  return (
    <div className="panel mt-8 p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <FileText className="h-3.5 w-3.5 text-verdigris-400" /> Son KAP bildirimleri
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {items.length > 0
              ? `Bu fona ait son ${items.length} kamuyu aydınlatma bildirimi — portföy, finansal rapor, özel durum.`
              : backfillTriggered
                ? 'KAP arşivi arka planda çekiliyor — birkaç dakika sonra sayfayı yenile.'
                : 'Bu fona ait kayıtlı KAP bildirimi yok.'}
          </p>
        </div>
        <KapAlertToggle code={code} />
      </div>

      {items.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const count = counts[f.key];
            const disabled = count === 0;
            const active = f.key === activeFilter;
            return (
              <button
                key={f.key}
                type="button"
                disabled={disabled}
                onClick={() => setActiveFilter(f.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition ${
                  active
                    ? 'border-verdigris-500/60 bg-verdigris-500/15 text-verdigris-200'
                    : disabled
                      ? 'border-border/30 bg-background/20 text-muted-foreground/40 cursor-not-allowed'
                      : 'border-border/50 bg-background/40 text-muted-foreground hover:border-verdigris-500/40 hover:text-foreground'
                }`}
              >
                {f.label}
                <span className="font-mono text-[10px] tabular-nums opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {filtered.length > 0 ? (
        <ul className="divide-y divide-border/40">
          {filtered.map((d) => {
            const { date, time } = formatTs(d.publish_date);
            const title = d.kap_title ?? d.subject ?? 'Bildirim';
            return (
              <li key={d.disclosure_index} className="py-3 first:pt-0 last:pb-0">
                <a
                  href={`https://www.kap.org.tr/tr/Bildirim/${d.disclosure_index}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {d.subject && (
                        <span className="inline-flex items-center rounded-md border border-verdigris-500/30 bg-verdigris-500/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-verdigris-300">
                          {d.subject}
                        </span>
                      )}
                      {d.attachment_count > 0 && (
                        <span className="font-mono text-[10px] text-muted-foreground/70">
                          {d.attachment_count} ek
                        </span>
                      )}
                    </div>
                    <div className="mt-1 truncate text-sm text-foreground/90 group-hover:text-foreground">
                      {title}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-xs tabular-nums text-foreground/80">{date}</div>
                    <div className="font-mono text-[10px] tabular-nums text-muted-foreground">{time}</div>
                  </div>
                  <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60 group-hover:text-brand-400" />
                </a>
              </li>
            );
          })}
        </ul>
      ) : items.length > 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground/80">
          Bu kategoride bildirim yok.
        </p>
      ) : null}

      <div className="mt-4 text-[10px] text-muted-foreground/70">
        Kaynak: kap.org.tr · her 15 dk'da bir senkronlanır · fonu ilk ziyarette 180 gün geriye backfill
      </div>
    </div>
  );
}
