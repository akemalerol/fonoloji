'use client';

import { Activity, Cpu, Database, Globe, HardDrive, MemoryStick, Monitor, Server, Shield, Smartphone, Tablet, Wifi } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

// Admin observability paneli — GP_NEW tarzı:
//  - Sistem sağlığı strip (CPU/RAM/Disk/DB/VPN/Node)
//  - Sunucu kartı (IP, CPU model, hostname, uptime)
//  - Canlı snapshot (aktif ziyaretçi, saatlik view/api/error)
//  - Saatlik timeline (mini sparkline)
//  - Cihaz dağılımı (mobile/desktop/tablet/bot)
//  - Alt sekmeler: Canlı ziyaretçiler / Sayfa İstatistikleri / API Analitiği / Mailler

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

// ISO 3166-1 alpha-2 country code → flag emoji via regional indicator pair.
// 'TR' → 🇹🇷, 'US' → 🇺🇸. Invalid/bilinmeyen → null.
function flagEmoji(code: string | null | undefined): string | null {
  if (!code || code.length !== 2) return null;
  const cc = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return null;
  const base = 0x1f1e6 - 'A'.charCodeAt(0);
  return String.fromCodePoint(cc.charCodeAt(0) + base, cc.charCodeAt(1) + base);
}

function FlagBadge({ country }: { country: string | null | undefined }) {
  const flag = flagEmoji(country);
  if (!flag) return <span className="text-muted-foreground/50">—</span>;
  return (
    <span title={country ?? ''} className="inline-flex items-center gap-1 text-xs">
      <span className="text-base leading-none">{flag}</span>
      <span className="font-mono text-[10px] text-muted-foreground">{country}</span>
    </span>
  );
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

function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}g ${h}sa`;
  if (h > 0) return `${h}sa ${m}dk`;
  return `${m}dk`;
}

function healthTint(percent: number, warn = 60, crit = 85): string {
  if (percent >= crit) return 'bg-rose-500';
  if (percent >= warn) return 'bg-amber-500';
  return 'bg-emerald-500';
}
function healthText(percent: number, warn = 60, crit = 85): string {
  if (percent >= crit) return 'text-rose-400';
  if (percent >= warn) return 'text-amber-400';
  return 'text-emerald-400';
}

interface SystemHealth {
  ok: boolean;
  now: number;
  node: string;
  platform: string;
  arch: string;
  hostname: string;
  uptimeSeconds: number;
  processUptimeSeconds: number;
  publicIp: string | null;
  cpu: {
    model: string;
    cores: number;
    usagePercent: number;
    loadAvg: { '1m': number; '5m': number; '15m': number };
  };
  memory: { totalMb: number; usedMb: number; freeMb: number; percent: number; processRssMb: number; processHeapMb: number };
  disk: { totalGb: number; usedGb: number; availGb: number; percent: number } | null;
  db: { sizeMb: number; ok: boolean; ms: number };
  vpn: { connected: boolean; endpoint?: string };
}

interface Snapshot {
  activeNow: number;
  lastHour: { views: number; uniqueVisitors: number; apiCalls: number; apiErrors: number; avgMs: number };
}

interface TimelineItem {
  bucket: number;
  views: number;
  uniq: number;
  calls: number;
  errors: number;
}

interface DevicesResp {
  devices: { mobile: number; tablet: number; desktop: number; bot: number; unknown: number };
  browsers: Array<{ name: string; count: number }>;
}

function HealthStrip() {
  const [h, setH] = React.useState<SystemHealth | null>(null);
  React.useEffect(() => {
    const load = () =>
      fetch('/admin-api/system-health', { credentials: 'include' })
        .then((r) => r.json())
        .then(setH)
        .catch(() => {});
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, []);
  if (!h) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/40 p-4 text-xs text-muted-foreground">
        Sistem sağlığı yükleniyor…
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Activity className="h-3.5 w-3.5 text-emerald-400" /> Sistem Sağlığı
        <span className="ml-auto font-normal normal-case text-[10px]">10 sn'de bir güncellenir</span>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <HealthCard label="Sunucu" icon={<Server className="h-3.5 w-3.5" />} ok detail={fmtUptime(h.processUptimeSeconds) + ' prc'} />
        <HealthCard
          label="Database"
          icon={<Database className="h-3.5 w-3.5" />}
          ok={h.db.ok}
          detail={`${h.db.ms}ms · ${h.db.sizeMb}MB`}
        />
        <HealthCard
          label="VPN (IPsec)"
          icon={<Shield className="h-3.5 w-3.5" />}
          ok={h.vpn.connected}
          detail={h.vpn.connected ? h.vpn.endpoint ?? 'bağlı' : 'kopuk'}
        />
        <HealthCard
          label="Memory"
          icon={<MemoryStick className="h-3.5 w-3.5" />}
          ok={h.memory.percent < 80}
          detail={`${h.memory.usedMb}/${h.memory.totalMb} MB`}
        />
        <HealthCard
          label="Disk"
          icon={<HardDrive className="h-3.5 w-3.5" />}
          ok={h.disk ? h.disk.percent < 85 : true}
          detail={h.disk ? `${h.disk.usedGb}/${h.disk.totalGb} GB` : 'n/a'}
        />
        <HealthCard label="Node" icon={<Cpu className="h-3.5 w-3.5" />} ok detail={h.node} />
      </div>

      {/* Server info + 3 progress bars */}
      <div className="rounded-xl border border-border/60 bg-card/40 p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Server className="h-3.5 w-3.5" /> Sunucu Bilgileri
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <ProgressBar
            label="CPU"
            percent={h.cpu.usagePercent}
            detail={`${h.cpu.cores} çekirdek · Load ${h.cpu.loadAvg['1m']} / ${h.cpu.loadAvg['5m']} / ${h.cpu.loadAvg['15m']}`}
          />
          <ProgressBar
            label="RAM"
            percent={h.memory.percent}
            detail={`${Math.round((h.memory.usedMb / 1024) * 10) / 10} / ${Math.round((h.memory.totalMb / 1024) * 10) / 10} GB`}
          />
          {h.disk && (
            <ProgressBar label="Disk" percent={h.disk.percent} detail={`${h.disk.usedGb} / ${h.disk.totalGb} GB`} crit={90} warn={75} />
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
          <InfoBlock label="Dış IP" value={h.publicIp ?? '—'} mono />
          <InfoBlock label="CPU" value={h.cpu.model.split('@')[0]?.trim().slice(0, 28) ?? '—'} small />
          <InfoBlock label="Hostname" value={h.hostname} mono />
          <InfoBlock label="Uptime" value={fmtUptime(h.uptimeSeconds)} />
        </div>
      </div>
    </div>
  );
}

function HealthCard({ label, icon, ok, detail }: { label: string; icon: React.ReactNode; ok: boolean; detail: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/30 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon} {label}
        <span className={cn('ml-auto h-1.5 w-1.5 rounded-full', ok ? 'bg-emerald-400' : 'bg-rose-400')} />
      </div>
      <div className="mt-1 truncate text-xs text-foreground/90" title={detail}>{detail}</div>
    </div>
  );
}

function ProgressBar({
  label,
  percent,
  detail,
  warn = 60,
  crit = 85,
}: {
  label: string;
  percent: number;
  detail: string;
  warn?: number;
  crit?: number;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={cn('font-mono text-xs font-bold tabular-nums', healthText(percent, warn, crit))}>{percent}%</div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted/50">
        <div
          className={cn('h-full rounded-full transition-all duration-500', healthTint(percent, warn, crit))}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground">{detail}</div>
    </div>
  );
}

function InfoBlock({ label, value, mono, small }: { label: string; value: string; mono?: boolean; small?: boolean }) {
  return (
    <div className="rounded-lg bg-muted/30 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('mt-0.5', mono && 'font-mono', small ? 'text-[11px]' : 'text-xs font-semibold')}>{value}</div>
    </div>
  );
}

function LiveSnapshot() {
  const [s, setS] = React.useState<Snapshot | null>(null);
  React.useEffect(() => {
    const load = () =>
      fetch('/admin-api/analytics/snapshot', { credentials: 'include' })
        .then((r) => r.json())
        .then(setS)
        .catch(() => {});
    load();
    const t = setInterval(load, 5_000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <StatCard
        label="ŞU AN AKTİF"
        value={s?.activeNow ?? '—'}
        sub="Son 5 dk"
        pulse
      />
      <StatCard label="1 SAATLİK VIEW" value={s?.lastHour.views ?? '—'} sub={`${s?.lastHour.uniqueVisitors ?? 0} benzersiz`} />
      <StatCard label="1 SAATLİK API" value={s?.lastHour.apiCalls ?? '—'} sub={`ort ${s?.lastHour.avgMs ?? 0}ms`} />
      <StatCard
        label="HATA"
        value={s?.lastHour.apiErrors ?? '—'}
        sub="1 saatte 4xx/5xx"
        accent={s?.lastHour.apiErrors ? 'rose' : 'neutral'}
      />
      <StatCard label="CANLI STATÜ" value={s ? 'OK' : '—'} sub="5 sn refresh" accent="emerald" pulse />
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent = 'neutral',
  pulse,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: 'neutral' | 'emerald' | 'rose' | 'brand';
  pulse?: boolean;
}) {
  const accentCls = {
    neutral: 'from-card/40 to-card/20',
    emerald: 'from-emerald-500/15 to-emerald-500/5',
    rose: 'from-rose-500/15 to-rose-500/5',
    brand: 'from-brand-500/15 to-brand-500/5',
  }[accent];
  return (
    <div className={cn('rounded-xl border border-border/60 bg-gradient-to-br p-4', accentCls)}>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
        {pulse && <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
        </span>}
      </div>
      <div className="mt-1 font-mono text-2xl tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function TimelineChart() {
  const [items, setItems] = React.useState<TimelineItem[]>([]);
  const [hours, setHours] = React.useState(24);
  React.useEffect(() => {
    fetch(`/admin-api/analytics/timeline?hours=${hours}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []));
  }, [hours]);
  const maxViews = Math.max(1, ...items.map((i) => i.views));
  const maxCalls = Math.max(1, ...items.map((i) => i.calls));
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4">
      <div className="mb-3 flex items-center gap-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trafik Zaman Çizelgesi</div>
        <div className="ml-auto flex flex-wrap gap-1">
          {[1, 2, 5, 12, 24, 168].map((h) => (
            <button
              key={h}
              onClick={() => setHours(h)}
              className={cn(
                'rounded-md px-2 py-1 text-xs',
                hours === h ? 'bg-brand-500/20 text-brand-200' : 'bg-muted/30 hover:bg-muted/50',
              )}
            >
              {h === 168 ? '7g' : `${h}sa`}
            </button>
          ))}
        </div>
      </div>
      {items.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">Veri yok.</div>
      ) : (
        <div className="flex h-32 items-end gap-0.5">
          {items.map((i) => {
            const vh = (i.views / maxViews) * 100;
            const ch = (i.calls / maxCalls) * 100;
            return (
              <div key={i.bucket} className="flex flex-1 flex-col justify-end gap-0.5" title={`${new Date(i.bucket).toLocaleString('tr-TR')}\nViews: ${i.views} · API: ${i.calls}`}>
                <div className="rounded-t bg-brand-500/60" style={{ height: `${vh}%` }} />
                <div className="rounded-b bg-verdigris-500/50" style={{ height: `${ch * 0.6}%` }} />
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-2 flex gap-4 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded bg-brand-500/60" /> Sayfa görüntüleme</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded bg-verdigris-500/50" /> API çağrıları</span>
      </div>
    </div>
  );
}

function DeviceBreakdown() {
  const [d, setD] = React.useState<DevicesResp | null>(null);
  React.useEffect(() => {
    fetch('/admin-api/analytics/devices?hours=24', { credentials: 'include' })
      .then((r) => r.json())
      .then(setD);
  }, []);
  if (!d) return null;
  const total = d.devices.mobile + d.devices.tablet + d.devices.desktop + d.devices.bot + d.devices.unknown || 1;
  const row = (
    label: string,
    count: number,
    icon: React.ReactNode,
  ) => (
    <div className="rounded-lg border border-border/40 bg-muted/20 p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-1 font-mono text-lg">{count}</div>
      <div className="text-[10px] text-muted-foreground">{Math.round((count / total) * 100)}%</div>
    </div>
  );
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cihaz & Tarayıcı (24 sa)</div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {row('Masaüstü', d.devices.desktop, <Monitor className="h-3 w-3" />)}
        {row('Mobil', d.devices.mobile, <Smartphone className="h-3 w-3" />)}
        {row('Tablet', d.devices.tablet, <Tablet className="h-3 w-3" />)}
        {row('Bot', d.devices.bot, <Globe className="h-3 w-3" />)}
        {row('Diğer', d.devices.unknown, <Wifi className="h-3 w-3" />)}
      </div>
      {d.browsers.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tarayıcılar</div>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            {d.browsers.slice(0, 8).map((b) => (
              <span key={b.name} className="rounded-full bg-muted/30 px-2 py-0.5">
                {b.name} <span className="text-muted-foreground">· {b.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function Observability() {
  const [tab, setTab] = React.useState<Tab>('live');
  return (
    <div className="space-y-4">
      <HealthStrip />
      <LiveSnapshot />
      <div className="grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-3"><TimelineChart /></div>
        <div className="lg:col-span-2"><DeviceBreakdown /></div>
      </div>
      <div className="mt-6 flex gap-2 border-b border-border/50">
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
  country: string | null;
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
        <div className="ml-auto flex flex-wrap gap-1">
          {[5, 15, 60, 120, 300, 720, 1440].map((m) => (
            <button
              key={m}
              onClick={() => setMinutes(m)}
              className={cn(
                'rounded-md px-2 py-1 text-xs',
                minutes === m ? 'bg-brand-500/20 text-brand-200' : 'bg-muted/30 hover:bg-muted/50',
              )}
            >
              {m < 60 ? `${m} dk` : m === 1440 ? '24 sa' : `${m / 60} sa`}
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
              <th className="px-3 py-2 text-left">Ülke</th>
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
                  <td className="px-3 py-2"><FlagBadge country={r.country} /></td>
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
                <td colSpan={7} className="px-3 py-6 text-center text-xs text-muted-foreground">
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
        <div className="ml-auto flex flex-wrap gap-1">
          {[1, 2, 5, 12, 24, 168].map((h) => (
            <button
              key={h}
              onClick={() => setHours(h)}
              className={cn(
                'rounded-md px-2 py-1 text-xs',
                hours === h ? 'bg-brand-500/20 text-brand-200' : 'bg-muted/30 hover:bg-muted/50',
              )}
            >
              {h === 168 ? '7 gün' : `${h}sa`}
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
  topIps: Array<{ ip: string; calls: number; errors: number; user_agent: string | null; country: string | null }>;
  ipPagination?: { page: number; pageSize: number; total: number; pageCount: number };
  topCountries?: Array<{ country: string; calls: number; unique_ips: number }>;
  topOrigins?: Array<{ origin: string; calls: number; unique_ips: number }>;
  topReferers?: Array<{ referer: string; calls: number }>;
}

interface IpDetailResp {
  ip: string;
  hours: number;
  totals: {
    calls: number;
    uniquePaths: number;
    uniqueFunds: number;
    errors: number;
    avgMs: number;
    firstSeen: number;
    lastSeen: number;
    country: string | null;
    userAgent: string | null;
  };
  topEndpoints: Array<{ path: string; method: string; calls: number; avgMs: number; errors: number }>;
  topFunds: Array<{ fund_code: string; calls: number }>;
  recent: Array<{ ts: number; method: string; path: string; fund_code: string | null; status: number; duration_ms: number; api_key_id: number | null; user_id: number | null; origin?: string | null; referer?: string | null }>;
  linkedUser: { id: number; email: string; plan: string; role: string } | null;
  linkedKeys: Array<{ id: number; key_prefix: string; name: string | null; email: string | null }>;
  topOrigins?: Array<{ origin: string; calls: number }>;
  topReferers?: Array<{ referer: string; calls: number }>;
}

function ApiStats() {
  const [data, setData] = React.useState<ApiStatsResp | null>(null);
  const [hours, setHours] = React.useState(24);
  const [loading, setLoading] = React.useState(true);
  const [ipPage, setIpPage] = React.useState(1);
  const [drillIp, setDrillIp] = React.useState<string | null>(null);

  React.useEffect(() => {
    setLoading(true);
    fetch(`/admin-api/api-stats?hours=${hours}&page=${ipPage}&pageSize=20`, { credentials: 'include' })
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [hours, ipPage]);

  React.useEffect(() => {
    // Pencere değişince sayfa 1'e dön
    setIpPage(1);
  }, [hours]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="text-xs text-muted-foreground">
          {loading
            ? 'Yükleniyor…'
            : `${data?.totals.calls ?? 0} çağrı · ${data?.totals.unique_ips ?? 0} IP · ${data?.totals.errors ?? 0} hata · ort ${Math.round(data?.totals.avg_ms ?? 0)}ms`}
        </div>
        <div className="ml-auto flex flex-wrap gap-1">
          {[1, 2, 5, 12, 24, 168].map((h) => (
            <button
              key={h}
              onClick={() => setHours(h)}
              className={cn(
                'rounded-md px-2 py-1 text-xs',
                hours === h ? 'bg-brand-500/20 text-brand-200' : 'bg-muted/30 hover:bg-muted/50',
              )}
            >
              {h === 168 ? '7 gün' : `${h}sa`}
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
          <div className="flex items-center justify-between border-b border-border/40 bg-muted/20 px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">
            <span>IP'ler — tıklayınca detay</span>
            {data?.ipPagination && (
              <span className="font-normal normal-case text-[10px]">
                {data.ipPagination.total} IP toplam
              </span>
            )}
          </div>
          <table className="w-full text-sm">
            <tbody>
              {(data?.topIps ?? []).map((ip) => (
                <tr key={ip.ip} className="cursor-pointer border-t border-border/40 hover:bg-muted/20" onClick={() => setDrillIp(ip.ip)}>
                  <td className="px-3 py-1.5 font-mono text-xs">
                    <span className="mr-2">{flagEmoji(ip.country) ?? ''}</span>
                    <span className="hover:text-brand-300">{ip.ip}</span>
                  </td>
                  <td className="px-3 py-1.5 text-right text-xs">{ip.calls}</td>
                  <td className={cn('px-3 py-1.5 text-right text-xs', ip.errors > 0 && 'text-rose-400')}>
                    {ip.errors > 0 ? `${ip.errors} hata` : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right text-xs text-muted-foreground">{uaShort(ip.user_agent)}</td>
                </tr>
              ))}
              {(data?.topIps ?? []).length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-xs text-muted-foreground">
                    Bu pencerede IP yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {data?.ipPagination && data.ipPagination.pageCount > 1 && (
            <div className="flex items-center justify-between border-t border-border/40 bg-muted/10 px-3 py-2 text-xs">
              <button
                type="button"
                disabled={ipPage <= 1}
                onClick={() => setIpPage((p) => Math.max(1, p - 1))}
                className="rounded-md bg-muted/40 px-2 py-1 hover:bg-muted/60 disabled:opacity-40"
              >
                ← Önceki
              </button>
              <span className="text-muted-foreground">
                Sayfa {ipPage} / {data.ipPagination.pageCount}
              </span>
              <button
                type="button"
                disabled={ipPage >= data.ipPagination.pageCount}
                onClick={() => setIpPage((p) => Math.min(data.ipPagination!.pageCount, p + 1))}
                className="rounded-md bg-muted/40 px-2 py-1 hover:bg-muted/60 disabled:opacity-40"
              >
                Sonraki →
              </button>
            </div>
          )}
        </div>
        <div className="rounded-lg border border-border/60">
          <div className="border-b border-border/40 bg-muted/20 px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">
            Ülke dağılımı
          </div>
          <table className="w-full text-sm">
            <tbody>
              {(data?.topCountries ?? []).map((c) => (
                <tr key={c.country} className="border-t border-border/40">
                  <td className="px-3 py-1.5 text-sm">
                    <span className="mr-2 text-base">{flagEmoji(c.country) ?? '🌐'}</span>
                    <span className="font-mono text-xs text-muted-foreground">{c.country}</span>
                  </td>
                  <td className="px-3 py-1.5 text-right text-xs">{c.calls}</td>
                  <td className="px-3 py-1.5 text-right text-xs text-muted-foreground">{c.unique_ips} IP</td>
                </tr>
              ))}
              {(data?.topCountries ?? []).length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-center text-xs text-muted-foreground">Ülke verisi yok</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Hangi sitelerden API çağrılıyor — Origin header (CORS) */}
        <div className="rounded-lg border border-border/60 md:col-span-2">
          <div className="border-b border-border/40 bg-muted/20 px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">
            API'yi çağıran siteler (Origin)
          </div>
          <table className="w-full text-sm">
            <tbody>
              {(data?.topOrigins ?? []).map((o) => (
                <tr key={o.origin} className="border-t border-border/40">
                  <td className="px-3 py-1.5 text-xs">
                    <a href={o.origin} target="_blank" rel="noreferrer" className="text-brand-400 hover:underline break-all">
                      {o.origin}
                    </a>
                  </td>
                  <td className="px-3 py-1.5 text-right text-xs">{o.calls}</td>
                  <td className="px-3 py-1.5 text-right text-xs text-muted-foreground">{o.unique_ips} IP</td>
                </tr>
              ))}
              {(data?.topOrigins ?? []).length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-center text-xs text-muted-foreground">
                    Harici siteden Origin header'ı ile gelen çağrı yok. (SSR ve terminal istekleri Origin göndermez.)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Referer — tam URL, harici siteden hangi sayfanın çağırdığı */}
        {(data?.topReferers ?? []).length > 0 && (
          <div className="rounded-lg border border-border/60 md:col-span-2">
            <div className="border-b border-border/40 bg-muted/20 px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">
              Referer URL'leri — hangi sayfadan çağrı
            </div>
            <table className="w-full text-sm">
              <tbody>
                {(data?.topReferers ?? []).map((r) => (
                  <tr key={r.referer} className="border-t border-border/40">
                    <td className="px-3 py-1.5 text-xs">
                      <a href={r.referer} target="_blank" rel="noreferrer" className="break-all text-brand-400 hover:underline">
                        {r.referer}
                      </a>
                    </td>
                    <td className="px-3 py-1.5 text-right text-xs">{r.calls}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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
      {drillIp && <IpDetailModal ip={drillIp} hours={hours} onClose={() => setDrillIp(null)} />}
    </div>
  );
}

function IpDetailModal({ ip, hours, onClose }: { ip: string; hours: number; onClose: () => void }) {
  const [d, setD] = React.useState<IpDetailResp | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    fetch(`/admin-api/api-stats/ip?ip=${encodeURIComponent(ip)}&hours=${hours}`, { credentials: 'include' })
      .then((r) => r.json())
      .then(setD)
      .finally(() => setLoading(false));
  }, [ip, hours]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mt-8 w-full max-w-4xl rounded-xl border border-border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/50 bg-muted/20 px-4 py-3">
          <div>
            <div className="flex items-center gap-2 font-mono text-sm">
              {flagEmoji(d?.totals.country) ?? ''}
              <span className="font-semibold">{ip}</span>
              {d?.linkedUser && (
                <span className="rounded-full bg-brand-500/20 px-2 py-0.5 text-[10px] text-brand-300">
                  👤 {d.linkedUser.email} · {d.linkedUser.plan}
                </span>
              )}
              {d?.linkedKeys && d.linkedKeys.length > 0 && (
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300">
                  🔑 {d.linkedKeys.length} anahtar
                </span>
              )}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">Son {hours} saat · {uaShort(d?.totals.userAgent)}</div>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted/50" aria-label="kapat">
            ✕
          </button>
        </div>

        {loading || !d ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Yükleniyor…</div>
        ) : (
          <div className="max-h-[80vh] overflow-y-auto p-4 space-y-4">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              <MiniStat label="Toplam istek" value={d.totals.calls} />
              <MiniStat label="Endpoint" value={d.totals.uniquePaths} />
              <MiniStat label="Farklı fon" value={d.totals.uniqueFunds} />
              <MiniStat label="Hata" value={d.totals.errors} accent={d.totals.errors > 0 ? 'rose' : 'neutral'} />
              <MiniStat label="Ort ms" value={Math.round(d.totals.avgMs ?? 0)} />
            </div>

            {d.linkedKeys.length > 0 && (
              <div className="rounded-lg border border-border/60 bg-card/30 p-3">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Kullanılan API anahtarları</div>
                <div className="space-y-1">
                  {d.linkedKeys.map((k) => (
                    <div key={k.id} className="flex items-center gap-2 text-xs">
                      <span className="font-mono">{k.key_prefix}…</span>
                      {k.name && <span className="text-muted-foreground">· {k.name}</span>}
                      {k.email && <span className="ml-auto text-muted-foreground">{k.email}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-border/60">
                <div className="border-b border-border/40 bg-muted/20 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Sorguladığı endpoint'ler
                </div>
                <table className="w-full text-xs">
                  <tbody>
                    {d.topEndpoints.map((e, i) => (
                      <tr key={i} className="border-t border-border/40">
                        <td className="px-3 py-1 font-mono">
                          <span className="mr-1.5 rounded bg-muted/30 px-1 py-0.5 text-[9px]">{e.method}</span>
                          {e.path}
                        </td>
                        <td className="px-3 py-1 text-right">{e.calls}</td>
                        <td className="px-3 py-1 text-right text-muted-foreground">{Math.round(e.avgMs)}ms</td>
                        <td className={cn('px-3 py-1 text-right', e.errors > 0 && 'text-rose-400')}>{e.errors > 0 ? `${e.errors} ✕` : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="rounded-lg border border-border/60">
                <div className="border-b border-border/40 bg-muted/20 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Sorguladığı fonlar
                </div>
                {d.topFunds.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs text-muted-foreground">Fon sorgusu yok.</div>
                ) : (
                  <table className="w-full text-xs">
                    <tbody>
                      {d.topFunds.map((f) => (
                        <tr key={f.fund_code} className="border-t border-border/40">
                          <td className="px-3 py-1">
                            <a href={`/fon/${f.fund_code}`} target="_blank" rel="noreferrer" className="font-mono text-brand-400 hover:underline">
                              {f.fund_code}
                            </a>
                          </td>
                          <td className="px-3 py-1 text-right">{f.calls}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border/60">
              <div className="border-b border-border/40 bg-muted/20 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Son 100 istek — kronolojik
              </div>
              <div className="max-h-[260px] overflow-y-auto">
                <table className="w-full text-xs">
                  <tbody>
                    {d.recent.map((r, i) => (
                      <tr key={i} className="border-t border-border/40">
                        <td className="whitespace-nowrap px-3 py-1 font-mono text-[10px] text-muted-foreground">{formatTs(r.ts)}</td>
                        <td className="px-3 py-1">
                          <span className="mr-1.5 rounded bg-muted/30 px-1 py-0.5 text-[9px]">{r.method}</span>
                          <span className="font-mono">{r.path}</span>
                        </td>
                        <td className="px-3 py-1 text-right text-muted-foreground">{r.duration_ms}ms</td>
                        <td
                          className={cn(
                            'px-3 py-1 text-right font-mono text-[10px]',
                            r.status >= 500 && 'text-rose-400',
                            r.status >= 400 && r.status < 500 && 'text-amber-400',
                            r.status >= 200 && r.status < 300 && 'text-emerald-400',
                          )}
                        >
                          {r.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, accent = 'neutral' }: { label: string; value: number | string; accent?: 'neutral' | 'rose' | 'emerald' }) {
  const color = accent === 'rose' ? 'text-rose-400' : accent === 'emerald' ? 'text-emerald-400' : 'text-foreground';
  return (
    <div className="rounded-lg border border-border/40 bg-muted/10 p-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('mt-0.5 font-mono text-lg tabular-nums', color)}>{value}</div>
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
