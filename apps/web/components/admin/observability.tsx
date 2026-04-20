'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

// Admin observability paneli:
//  - Canlı ziyaretçiler (son 5 dk)
//  - API çağrı analitiği (endpoint, fon, IP, status)
//  - Giden mail kopyaları

type Tab = 'live' | 'api' | 'mail' | 'pages';

function formatTs(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function agoShort(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}sn`;
  if (s < 3600) return `${Math.round(s / 60)}dk`;
  if (s < 86400) return `${Math.round(s / 3600)}sa`;
  return `${Math.round(s / 86400)}g`;
}

function uaShort(ua: string | null | undefined): string {
  if (!ua) return '—';
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Chrome\//.test(ua) && !/Chromium|OPR/.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return 'Safari';
  if (/Googlebot/i.test(ua)) return 'Googlebot';
  if (/Bingbot/i.test(ua)) return 'Bingbot';
  if (/Applebot/i.test(ua)) return 'Applebot';
  return ua.split(/[ /]/)[0] ?? '—';
}

export function Observability() {
  const [tab, setTab] = React.useState<Tab>('live');
  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-border/50">
        {([
          { k: 'live', label: 'Canlı' },
          { k: 'pages', label: 'Sayfa İst.' },
          { k: 'api', label: 'API Çağrıları' },
          { k: 'mail', label: 'Giden Mailler' },
        ] as Array<{ k: Tab; label: string }>).map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm',
              tab === t.k
                ? 'border-brand-500 text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'live' && <LiveVisitors />}
      {tab === 'pages' && <PageStats />}
      {tab === 'api' && <ApiStats />}
      {tab === 'mail' && <MailLog />}
    </div>
  );
}

// ---------- CANLI ZİYARETÇİ ----------

interface LiveRow {
  ip: string;
  user_id: number | null;
  email: string | null;
  last_ts: number;
  pageviews: number;
  last_path: string;
  last_referer: string | null;
  user_agent: string | null;
}

function LiveVisitors() {
  const [rows, setRows] = React.useState<LiveRow[]>([]);
  const [minutes, setMinutes] = React.useState(5);
  const [loading, setLoading] = React.useState(true);
  const [drill, setDrill] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    fetch(`/admin-api/live-visitors?minutes=${minutes}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setRows(d.items ?? []))
      .finally(() => setLoading(false));
  }, [minutes]);

  React.useEffect(() => {
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="text-xs text-muted-foreground">
          {loading ? 'Yükleniyor…' : `${rows.length} benzersiz ziyaretçi · son ${minutes} dk`}
        </div>
        <div className="ml-auto flex gap-1">
          {[5, 15, 60].map((m) => (
            <button
              key={m}
              onClick={() => setMinutes(m)}
              className={cn(
                'rounded-md px-2 py-1 text-xs',
                minutes === m ? 'bg-brand-500/20 text-brand-200' : 'bg-muted/30 hover:bg-muted/50',
              )}
            >
              {m} dk
            </button>
          ))}
          <button onClick={load} className="rounded-md bg-muted/30 px-2 py-1 text-xs hover:bg-muted/50">
            Yenile
          </button>
        </div>
      </div>
      <div className="overflow-auto rounded-lg border border-border/60">
        <table className="w-full text-sm">
          <thead className="bg-muted/20 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">IP</th>
              <th className="px-3 py-2 text-left">Kullanıcı</th>
              <th className="px-3 py-2 text-left">Son Sayfa</th>
              <th className="px-3 py-2 text-right">Görüntüleme</th>
              <th className="px-3 py-2 text-left">Tarayıcı</th>
              <th className="px-3 py-2 text-right">Son</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <React.Fragment key={r.ip}>
                <tr className="border-t border-border/40 hover:bg-muted/10">
                  <td className="px-3 py-2 font-mono text-xs">
                    <button
                      onClick={() => setDrill(drill === r.ip ? null : r.ip)}
                      className="hover:text-brand-300"
                    >
                      {r.ip}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {r.email ? <span className="text-foreground">{r.email}</span> : <span className="text-muted-foreground">anonim</span>}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <a href={r.last_path} target="_blank" rel="noreferrer" className="text-brand-400 hover:underline">
                      {r.last_path}
                    </a>
                  </td>
                  <td className="px-3 py-2 text-right text-xs">{r.pageviews}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{uaShort(r.user_agent)}</td>
                  <td className="px-3 py-2 text-right text-xs text-muted-foreground">{agoShort(r.last_ts)}</td>
                </tr>
                {drill === r.ip && <TrailRow ip={r.ip} />}
              </React.Fragment>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Son {minutes} dakikada ziyaretçi yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TrailRow({ ip }: { ip: string }) {
  const [items, setItems] = React.useState<Array<{ ts: number; path: string; referer: string | null }>>([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    fetch(`/admin-api/visitor-trail?ip=${encodeURIComponent(ip)}&limit=40`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .finally(() => setLoading(false));
  }, [ip]);
  return (
    <tr className="bg-muted/5">
      <td colSpan={6} className="px-3 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          IP {ip} — son 40 ziyaret
        </div>
        {loading ? (
          <div className="py-2 text-xs text-muted-foreground">Yükleniyor…</div>
        ) : (
          <ul className="mt-2 space-y-1 text-xs">
            {items.map((it, i) => (
              <li key={i} className="flex items-baseline gap-3 font-mono">
                <span className="w-20 text-muted-foreground/70">{formatTs(it.ts).slice(6)}</span>
                <a href={it.path} target="_blank" rel="noreferrer" className="flex-1 text-brand-400 hover:underline">
                  {it.path}
                </a>
                {it.referer && (
                  <span className="max-w-xs truncate text-muted-foreground/60" title={it.referer}>
                    ← {it.referer}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </td>
    </tr>
  );
}

// ---------- SAYFA İSTATİSTİKLERİ ----------

interface PageStatsResp {
  windowHours: number;
  totals: { views: number; unique_ips: number };
  topPaths: Array<{ path: string; views: number; unique_ips: number }>;
  topReferers: Array<{ referer: string; c: number }>;
}

function PageStats() {
  const [data, setData] = React.useState<PageStatsResp | null>(null);
  const [hours, setHours] = React.useState(24);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    fetch(`/admin-api/page-stats?hours=${hours}`, { credentials: 'include' })
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [hours]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="text-xs text-muted-foreground">
          {loading ? 'Yükleniyor…' : `${data?.totals.views ?? 0} toplam · ${data?.totals.unique_ips ?? 0} benzersiz IP · son ${hours} saat`}
        </div>
        <div className="ml-auto flex gap-1">
          {[1, 24, 168].map((h) => (
            <button
              key={h}
              onClick={() => setHours(h)}
              className={cn(
                'rounded-md px-2 py-1 text-xs',
                hours === h ? 'bg-brand-500/20 text-brand-200' : 'bg-muted/30 hover:bg-muted/50',
              )}
            >
              {h === 168 ? '7 gün' : h === 24 ? '24 saat' : '1 saat'}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border/60">
          <div className="border-b border-border/40 bg-muted/20 px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">
            En çok görüntülenen sayfalar
          </div>
          <table className="w-full text-sm">
            <tbody>
              {(data?.topPaths ?? []).map((p) => (
                <tr key={p.path} className="border-t border-border/40">
                  <td className="px-3 py-2 font-mono text-xs">
                    <a href={p.path} target="_blank" rel="noreferrer" className="text-brand-400 hover:underline">
                      {p.path}
                    </a>
                  </td>
                  <td className="px-3 py-2 text-right text-xs">{p.views}</td>
                  <td className="px-3 py-2 text-right text-xs text-muted-foreground">{p.unique_ips} IP</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-lg border border-border/60">
          <div className="border-b border-border/40 bg-muted/20 px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">
            Referer kaynakları
          </div>
          <table className="w-full text-sm">
            <tbody>
              {(data?.topReferers ?? []).map((r) => (
                <tr key={r.referer} className="border-t border-border/40">
                  <td className="px-3 py-2 text-xs truncate max-w-xs" title={r.referer}>
                    {r.referer}
                  </td>
                  <td className="px-3 py-2 text-right text-xs">{r.c}</td>
                </tr>
              ))}
              {(data?.topReferers ?? []).length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-center text-xs text-muted-foreground">Referer yok</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------- API ÇAĞRI ANALİTİĞİ ----------

interface ApiStatsResp {
  windowHours: number;
  totals: { calls: number; avg_ms: number; errors: number; unique_ips: number };
  topEndpoints: Array<{ path: string; method: string; calls: number; avg_ms: number; errors: number }>;
  topFunds: Array<{ fund_code: string; calls: number; unique_ips: number }>;
  statusDist: Array<{ status: number; c: number }>;
  topIps: Array<{ ip: string; calls: number; errors: number; user_agent: string | null }>;
}

function ApiStats() {
  const [data, setData] = React.useState<ApiStatsResp | null>(null);
  const [hours, setHours] = React.useState(24);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    fetch(`/admin-api/api-stats?hours=${hours}`, { credentials: 'include' })
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [hours]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="text-xs text-muted-foreground">
          {loading
            ? 'Yükleniyor…'
            : `${data?.totals.calls ?? 0} çağrı · ${data?.totals.unique_ips ?? 0} IP · ${data?.totals.errors ?? 0} hata · ort ${Math.round(data?.totals.avg_ms ?? 0)}ms`}
        </div>
        <div className="ml-auto flex gap-1">
          {[1, 24, 168].map((h) => (
            <button
              key={h}
              onClick={() => setHours(h)}
              className={cn(
                'rounded-md px-2 py-1 text-xs',
                hours === h ? 'bg-brand-500/20 text-brand-200' : 'bg-muted/30 hover:bg-muted/50',
              )}
            >
              {h === 168 ? '7 gün' : h === 24 ? '24 saat' : '1 saat'}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border/60">
          <div className="border-b border-border/40 bg-muted/20 px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">
            Top endpoint'ler
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-1.5 text-left">Path</th>
                <th className="px-3 py-1.5 text-right">Çağrı</th>
                <th className="px-3 py-1.5 text-right">Ort ms</th>
                <th className="px-3 py-1.5 text-right">Hata</th>
              </tr>
            </thead>
            <tbody>
              {(data?.topEndpoints ?? []).map((e, i) => (
                <tr key={i} className="border-t border-border/40">
                  <td className="px-3 py-1.5 font-mono text-xs">
                    <span className="mr-2 rounded bg-muted/30 px-1 py-0.5 text-[10px]">{e.method}</span>
                    {e.path}
                  </td>
                  <td className="px-3 py-1.5 text-right text-xs">{e.calls}</td>
                  <td className="px-3 py-1.5 text-right text-xs text-muted-foreground">{Math.round(e.avg_ms)}</td>
                  <td className={cn('px-3 py-1.5 text-right text-xs', e.errors > 0 && 'text-rose-400')}>{e.errors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-lg border border-border/60">
          <div className="border-b border-border/40 bg-muted/20 px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">
            En çok sorgulanan fonlar
          </div>
          <table className="w-full text-sm">
            <tbody>
              {(data?.topFunds ?? []).map((f) => (
                <tr key={f.fund_code} className="border-t border-border/40">
                  <td className="px-3 py-1.5 text-xs">
                    <a href={`/fon/${f.fund_code}`} target="_blank" rel="noreferrer" className="font-mono text-brand-400 hover:underline">
                      {f.fund_code}
                    </a>
                  </td>
                  <td className="px-3 py-1.5 text-right text-xs">{f.calls}</td>
                  <td className="px-3 py-1.5 text-right text-xs text-muted-foreground">{f.unique_ips} IP</td>
                </tr>
              ))}
              {(data?.topFunds ?? []).length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-center text-xs text-muted-foreground">Veri yok</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="rounded-lg border border-border/60">
          <div className="border-b border-border/40 bg-muted/20 px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">
            Top IP'ler
          </div>
          <table className="w-full text-sm">
            <tbody>
              {(data?.topIps ?? []).map((ip) => (
                <tr key={ip.ip} className="border-t border-border/40">
                  <td className="px-3 py-1.5 font-mono text-xs">{ip.ip}</td>
                  <td className="px-3 py-1.5 text-right text-xs">{ip.calls}</td>
                  <td className={cn('px-3 py-1.5 text-right text-xs', ip.errors > 0 && 'text-rose-400')}>
                    {ip.errors > 0 ? `${ip.errors} hata` : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right text-xs text-muted-foreground">{uaShort(ip.user_agent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-lg border border-border/60">
          <div className="border-b border-border/40 bg-muted/20 px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">
            HTTP status dağılımı
          </div>
          <table className="w-full text-sm">
            <tbody>
              {(data?.statusDist ?? []).map((s) => (
                <tr key={s.status} className="border-t border-border/40">
                  <td
                    className={cn(
                      'px-3 py-1.5 font-mono text-xs',
                      s.status >= 500 && 'text-rose-400',
                      s.status >= 400 && s.status < 500 && 'text-amber-400',
                      s.status >= 200 && s.status < 300 && 'text-emerald-400',
                    )}
                  >
                    {s.status}
                  </td>
                  <td className="px-3 py-1.5 text-right text-xs">{s.c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------- GİDEN MAILLER ----------

interface MailRow {
  id: number;
  ts: number;
  to_email: string;
  subject: string;
  template: string | null;
  body_preview: string | null;
  status: 'sent' | 'failed';
  error: string | null;
}

function MailLog() {
  const [rows, setRows] = React.useState<MailRow[]>([]);
  const [q, setQ] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState<number | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (q) qs.set('q', q);
    fetch(`/admin-api/mail-log?${qs}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setRows(d.items ?? []))
      .finally(() => setLoading(false));
  }, [q]);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') load();
          }}
          placeholder="Alıcı veya konu ara…"
          className="w-64 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
        />
        <button onClick={load} className="rounded-md bg-muted/30 px-3 py-1.5 text-xs hover:bg-muted/50">
          Ara
        </button>
        <div className="ml-auto text-xs text-muted-foreground">
          {loading ? 'Yükleniyor…' : `${rows.length} mail`}
        </div>
      </div>
      <div className="overflow-auto rounded-lg border border-border/60">
        <table className="w-full text-sm">
          <thead className="bg-muted/20 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Zaman</th>
              <th className="px-3 py-2 text-left">Alıcı</th>
              <th className="px-3 py-2 text-left">Konu</th>
              <th className="px-3 py-2 text-left">Tür</th>
              <th className="px-3 py-2 text-left">Durum</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <React.Fragment key={m.id}>
                <tr className="cursor-pointer border-t border-border/40 hover:bg-muted/10" onClick={() => setOpen(open === m.id ? null : m.id)}>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{formatTs(m.ts)}</td>
                  <td className="px-3 py-2 text-xs">{m.to_email}</td>
                  <td className="px-3 py-2 text-xs">{m.subject}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{m.template ?? '—'}</td>
                  <td className="px-3 py-2 text-xs">
                    {m.status === 'sent' ? (
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300">gönderildi</span>
                    ) : (
                      <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] text-rose-300">hata</span>
                    )}
                  </td>
                </tr>
                {open === m.id && <MailDetail id={m.id} preview={m.body_preview} error={m.error} />}
              </React.Fragment>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Mail yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MailDetail({ id, preview, error }: { id: number; preview: string | null; error: string | null }) {
  const [html, setHtml] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch(`/admin-api/mail-log/${id}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setHtml(d.body_html ?? null))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <tr className="bg-muted/5">
      <td colSpan={5} className="px-3 py-3">
        {error && (
          <div className="mb-2 rounded bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</div>
        )}
        {preview && (
          <div className="mb-2 text-xs text-muted-foreground">
            <span className="font-semibold">Önizleme:</span> {preview}
          </div>
        )}
        {loading ? (
          <div className="text-xs text-muted-foreground">Yükleniyor…</div>
        ) : html ? (
          <iframe
            srcDoc={html}
            className="h-[500px] w-full rounded border border-border/60 bg-white"
            sandbox=""
          />
        ) : (
          <div className="text-xs text-muted-foreground">HTML gövde yok.</div>
        )}
      </td>
    </tr>
  );
}
