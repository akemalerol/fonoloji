'use client';

import { Activity, Ban, Check, CheckCircle2, ClipboardCopy, ExternalLink, Eye, Gauge, Key, Loader2, Mail, MailPlus, MoreVertical, Reply, Send, ShieldOff, Sparkles, Trash2, Twitter, UserCheck, UserX, Users as UsersIcon, Wallet, XCircle } from 'lucide-react';
import { Observability } from '@/components/admin/observability';
import * as React from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/material-dropdown';
import { cn } from '@/lib/utils';

interface Stats {
  totals: { users: number; activeKeys: number; requestsToday: number; requestsMonth: number };
  planDistribution: Array<{ plan: string; c: number }>;
  last14days: Array<{ date: string; count: number }>;
}

interface User {
  id: number;
  email: string;
  name: string | null;
  plan: string;
  role: string;
  created_at: number;
  key_count: number;
  usage_month: number;
  email_verified_at: number | null;
  disabled_at: number | null;
  custom_monthly_quota: number | null;
  custom_daily_quota: number | null;
  custom_rpm: number | null;
  limit_note: string | null;
}

interface KeyRow {
  id: number;
  key_prefix: string;
  name: string | null;
  created_at: number;
  last_used_at: number | null;
  revoked_at: number | null;
  user_email: string;
  user_id: number;
  user_plan: string;
}

interface Message {
  id: number;
  full_name: string;
  email: string;
  subject: string;
  message: string;
  is_read: 0 | 1;
  replied_at: number | null;
  reply_subject: string | null;
  reply_body: string | null;
  created_at: number;
}

const PLANS = ['free'] as const;

export function AdminClient({
  stats: initialStats,
  users: initialUsers,
  keys: initialKeys,
  me,
}: {
  stats: Stats;
  users: User[];
  keys: KeyRow[];
  me: { user: { email: string; name: string | null } };
}) {
  const [stats, setStats] = React.useState(initialStats);
  const [users, setUsers] = React.useState(initialUsers);
  const [keys, setKeys] = React.useState(initialKeys);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [tab, setTab] = React.useState<'users' | 'keys' | 'messages' | 'mail' | 'x' | 'observability'>('users');
  const [q, setQ] = React.useState('');
  const [openMsg, setOpenMsg] = React.useState<Message | null>(null);
  const [editingLimits, setEditingLimits] = React.useState<User | null>(null);

  React.useEffect(() => {
    if (tab === 'messages') loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Poll messages once for unread badge
  React.useEffect(() => {
    fetch('/admin-api/messages?unread=1', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setUnreadCount(d.unreadCount ?? 0))
      .catch(() => {});
  }, []);

  async function loadMessages() {
    const res = await fetch('/admin-api/messages', { credentials: 'include' });
    const data = await res.json();
    setMessages(data.items ?? []);
    setUnreadCount(data.unreadCount ?? 0);
  }

  async function markRead(id: number) {
    await fetch(`/admin-api/messages/${id}/read`, { method: 'POST', credentials: 'include' });
    await loadMessages();
  }

  async function deleteMsg(id: number) {
    if (!confirm('Bu mesajı sil?')) return;
    await fetch(`/admin-api/messages/${id}`, { method: 'DELETE', credentials: 'include' });
    setOpenMsg(null);
    await loadMessages();
  }

  async function toggleVerify(u: User) {
    const endpoint = u.email_verified_at ? 'unverify-email' : 'verify-email';
    const label = u.email_verified_at ? 'iptal et' : 'doğrula';
    if (!confirm(`"${u.email}" kullanıcısının doğrulamasını ${label}?`)) return;
    await fetch(`/admin-api/users/${u.id}/${endpoint}`, { method: 'POST', credentials: 'include' });
    await refresh();
  }

  async function toggleDisable(u: User) {
    const endpoint = u.disabled_at ? 'enable' : 'disable';
    const label = u.disabled_at ? 'aktifleştir' : 'pasife al';
    if (!confirm(`"${u.email}" kullanıcısını ${label}?`)) return;
    await fetch(`/admin-api/users/${u.id}/${endpoint}`, { method: 'POST', credentials: 'include' });
    await refresh();
  }

  async function refresh() {
    const [s, u, k] = await Promise.all([
      fetch('/admin-api/stats', { credentials: 'include' }).then((r) => r.json()),
      fetch(`/admin-api/users${q ? `?q=${encodeURIComponent(q)}` : ''}`, {
        credentials: 'include',
      }).then((r) => r.json()),
      fetch('/admin-api/keys', { credentials: 'include' }).then((r) => r.json()),
    ]);
    setStats(s);
    setUsers(u.items);
    setKeys(k.items);
  }

  async function changePlan(userId: number, plan: string) {
    const res = await fetch(`/admin-api/users/${userId}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ plan }),
    });
    if (res.ok) await refresh();
  }

  async function saveLimits(
    userId: number,
    limits: { monthlyQuota: number | null; dailyQuota: number | null; rpm: number | null; note: string | null },
  ): Promise<boolean> {
    const res = await fetch(`/admin-api/users/${userId}/limits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(limits),
    });
    if (res.ok) {
      await refresh();
      return true;
    }
    return false;
  }

  async function revokeKey(id: number) {
    if (!confirm('Bu anahtarı iptal et?')) return;
    await fetch(`/admin-api/keys/${id}`, { method: 'DELETE', credentials: 'include' });
    await refresh();
  }

  const filteredUsers = q
    ? users.filter(
        (u) =>
          u.email.toLowerCase().includes(q.toLowerCase()) ||
          u.name?.toLowerCase().includes(q.toLowerCase()),
      )
    : users;

  return (
    <div className="container py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border/50 pb-6">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">admin</div>
          <h1 className="display mt-2 text-5xl leading-none md:text-6xl">
            Kontrol <span className="display-italic text-brand-400">paneli</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {me.user.name ?? me.user.email} · yönetim görünümü
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/admin/guncelleme-notlari"
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300 transition hover:bg-amber-500/15"
          >
            📋 Geliştirme Notları
          </a>
          <Button variant="outline" size="sm" onClick={refresh}>
            Yenile
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={UsersIcon} label="Kullanıcı" value={stats.totals.users} />
        <StatCard icon={Key} label="Aktif anahtar" value={stats.totals.activeKeys} />
        <StatCard icon={Activity} label="Bugün istek" value={stats.totals.requestsToday} />
        <StatCard icon={Wallet} label="Ay toplamı" value={stats.totals.requestsMonth} />
      </div>

      {/* Chart + plan dist */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="panel p-5">
          <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
            Son 14 gün · API istek sayısı
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={stats.last14days} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="adminFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                stroke="#71717A"
                fontSize={10}
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis stroke="#71717A" fontSize={10} width={40} />
              <Tooltip
                contentStyle={{
                  background: 'rgba(17,17,19,0.95)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#F59E0B"
                strokeWidth={2}
                fill="url(#adminFill)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="panel p-5">
          <div className="mb-4 text-xs uppercase tracking-wider text-muted-foreground">Plan dağılımı</div>
          <ul className="space-y-3">
            {PLANS.map((p) => {
              const c = stats.planDistribution.find((d) => d.plan === p)?.c ?? 0;
              const total = stats.totals.users || 1;
              const pct = Math.round((c / total) * 100);
              return (
                <li key={p}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="capitalize">{p}</span>
                    <span className="font-mono tabular-nums">
                      {c} <span className="text-xs text-muted-foreground">({pct}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary/50">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        p === 'free' ? 'bg-muted-foreground/50' : 'bg-brand-500',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-8 flex gap-2 border-b border-border/50">
        <TabBtn active={tab === 'users'} onClick={() => setTab('users')}>
          Kullanıcılar ({users.length})
        </TabBtn>
        <TabBtn active={tab === 'keys'} onClick={() => setTab('keys')}>
          Anahtarlar ({keys.length})
        </TabBtn>
        <TabBtn active={tab === 'messages'} onClick={() => setTab('messages')}>
          <span className="inline-flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            Mesajlar
            {unreadCount > 0 && (
              <span className="rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-semibold text-background">
                {unreadCount}
              </span>
            )}
          </span>
        </TabBtn>
        <TabBtn active={tab === 'mail'} onClick={() => setTab('mail')}>
          <span className="inline-flex items-center gap-1.5">
            <MailPlus className="h-3.5 w-3.5" />
            Mail Gönder
          </span>
        </TabBtn>
        <TabBtn active={tab === 'x'} onClick={() => setTab('x')}>
          <span className="inline-flex items-center gap-1.5">
            <Twitter className="h-3.5 w-3.5" />
            X (Tweet)
          </span>
        </TabBtn>
        <TabBtn active={tab === 'observability'} onClick={() => setTab('observability')}>
          <span className="inline-flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            Canlı + Analitik
          </span>
        </TabBtn>
      </div>

      {(tab === 'users' || tab === 'keys') && (
        <div className="mt-4">
          <Input
            placeholder="Email veya isimle ara…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-sm"
          />
        </div>
      )}

      {tab === 'users' ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card/40">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-3 pl-4 text-left font-medium">ID</th>
                <th className="py-3 text-left font-medium">E-posta</th>
                <th className="py-3 text-left font-medium">İsim</th>
                <th className="py-3 text-left font-medium">Plan</th>
                <th className="py-3 text-left font-medium">Limit</th>
                <th className="py-3 text-left font-medium">Rol</th>
                <th className="py-3 text-right font-medium">Anahtar</th>
                <th className="py-3 text-right font-medium">Ay kullanım</th>
                <th className="py-3 text-right font-medium">Kayıt</th>
                <th className="py-3 pr-4 text-right font-medium">Aksiyon</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr
                  key={u.id}
                  className={cn(
                    'border-b border-border/50 last:border-0',
                    u.disabled_at && 'opacity-50',
                  )}
                >
                  <td className="py-3 pl-4 font-mono text-xs">#{u.id}</td>
                  <td className="py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className={u.disabled_at ? 'line-through' : ''}>{u.email}</span>
                      {u.email_verified_at ? (
                        <span
                          title="E-posta doğrulandı"
                          className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400"
                        />
                      ) : (
                        <span
                          title="E-posta doğrulanmadı"
                          className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-400"
                        />
                      )}
                      {u.disabled_at && (
                        <Badge variant="loss" className="text-[10px]">pasif</Badge>
                      )}
                    </div>
                  </td>
                  <td className="py-3 text-sm text-muted-foreground">{u.name ?? '—'}</td>
                  <td className="py-3">
                    <select
                      value={u.plan}
                      onChange={(e) => changePlan(u.id, e.target.value)}
                      className="rounded border border-border bg-background px-2 py-1 font-mono text-xs"
                    >
                      {PLANS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3">
                    {u.custom_monthly_quota !== null || u.custom_daily_quota !== null || u.custom_rpm !== null ? (
                      <button
                        onClick={() => setEditingLimits(u)}
                        title={u.limit_note ?? 'Özel limit tanımlı'}
                        className="inline-flex items-center gap-1 rounded border border-brand-500/40 bg-brand-500/10 px-1.5 py-0.5 font-mono text-[10px] text-brand-300 hover:bg-brand-500/20"
                      >
                        <Gauge className="h-3 w-3" />
                        {[u.custom_rpm && `${u.custom_rpm}/dk`, u.custom_daily_quota && `${(u.custom_daily_quota / 1000).toFixed(0)}k/g`]
                          .filter(Boolean).join(' · ') || 'özel'}
                      </button>
                    ) : (
                      <button
                        onClick={() => setEditingLimits(u)}
                        className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70 hover:text-foreground"
                      >
                        <Gauge className="h-3 w-3" /> tanımla
                      </button>
                    )}
                  </td>
                  <td className="py-3">
                    {u.role === 'admin' ? (
                      <Badge variant="default">admin</Badge>
                    ) : (
                      <Badge variant="muted">user</Badge>
                    )}
                  </td>
                  <td className="py-3 text-right tabular-nums">{u.key_count}</td>
                  <td className="py-3 text-right tabular-nums">
                    {u.usage_month.toLocaleString('tr-TR')}
                  </td>
                  <td className="py-3 text-right text-xs text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString('tr-TR')}
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" aria-label="Aksiyonlar">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>{u.email}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => setEditingLimits(u)}>
                          <Gauge className="h-4 w-4" />
                          Özel limit tanımla
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => toggleVerify(u)}>
                          {u.email_verified_at ? (
                            <>
                              <XCircle className="h-4 w-4 text-amber-400" />
                              Doğrulamayı iptal et
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                              Manuel doğrula
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => toggleDisable(u)}>
                          {u.disabled_at ? (
                            <>
                              <UserCheck className="h-4 w-4 text-emerald-400" />
                              Aktifleştir
                            </>
                          ) : (
                            <>
                              <Ban className="h-4 w-4 text-loss" />
                              Pasife al
                            </>
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : tab === 'keys' ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card/40">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/30 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-3 pl-4 text-left font-medium">Prefix</th>
                <th className="py-3 text-left font-medium">İsim</th>
                <th className="py-3 text-left font-medium">Sahip</th>
                <th className="py-3 text-left font-medium">Plan</th>
                <th className="py-3 text-left font-medium">Son kullanım</th>
                <th className="py-3 text-left font-medium">Oluşturma</th>
                <th className="py-3 text-left font-medium">Durum</th>
                <th className="py-3 pr-4 text-right font-medium">Aksiyon</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id} className="border-b border-border/50 last:border-0">
                  <td className="py-3 pl-4">
                    <code className="font-mono text-xs">{k.key_prefix}</code>
                  </td>
                  <td className="py-3 text-xs text-muted-foreground">{k.name ?? '—'}</td>
                  <td className="py-3 text-sm">
                    {k.user_email} <span className="text-xs text-muted-foreground">#{k.user_id}</span>
                  </td>
                  <td className="py-3">
                    <Badge variant="muted">{k.user_plan}</Badge>
                  </td>
                  <td className="py-3 text-xs text-muted-foreground">
                    {k.last_used_at ? new Date(k.last_used_at).toLocaleString('tr-TR') : '—'}
                  </td>
                  <td className="py-3 text-xs text-muted-foreground">
                    {new Date(k.created_at).toLocaleDateString('tr-TR')}
                  </td>
                  <td className="py-3">
                    {k.revoked_at ? (
                      <Badge variant="loss">iptal</Badge>
                    ) : (
                      <Badge variant="gain">aktif</Badge>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-right">
                    {!k.revoked_at && (
                      <Button size="sm" variant="ghost" onClick={() => revokeKey(k.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : tab === 'messages' ? (
        /* Messages */
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="panel overflow-hidden">
            {messages.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Henüz mesaj yok.</div>
            ) : (
              <ul className="divide-y divide-border/50">
                {messages.map((m) => (
                  <li
                    key={m.id}
                    onClick={() => {
                      setOpenMsg(m);
                      if (!m.is_read) markRead(m.id);
                    }}
                    className={`cursor-pointer p-4 transition-colors hover:bg-card/60 ${
                      openMsg?.id === m.id ? 'bg-card/70' : ''
                    } ${m.is_read ? '' : 'bg-brand-500/5'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {!m.is_read && <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />}
                          <span className="truncate text-sm font-semibold">{m.full_name}</span>
                          <span className="truncate text-xs text-muted-foreground">{m.email}</span>
                        </div>
                        <div className="mt-0.5 truncate text-sm">{m.subject}</div>
                        <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">{m.message}</div>
                      </div>
                      <div className="shrink-0 text-[10px] text-muted-foreground">
                        {new Date(m.created_at).toLocaleDateString('tr-TR')}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="panel p-6">
            {openMsg ? (
              <MessagePanel
                msg={openMsg}
                onDelete={() => deleteMsg(openMsg.id)}
                onReplied={() => {
                  void loadMessages();
                }}
              />
            ) : (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Sol taraftan bir mesaj seç.
              </div>
            )}
          </div>
        </div>
      ) : tab === 'mail' ? (
        /* Mail composer */
        <MailComposer totalUsers={stats.totals.users} />
      ) : tab === 'x' ? (
        /* X (Tweet) composer + queue */
        <XComposer />
      ) : (
        /* Observability: canlı ziyaretçi + analitik + mail kopyaları */
        <div className="mt-6">
          <Observability />
        </div>
      )}

      {editingLimits && (
        <LimitsModal
          user={editingLimits}
          onClose={() => setEditingLimits(null)}
          onSave={async (limits) => {
            const ok = await saveLimits(editingLimits.id, limits);
            if (ok) setEditingLimits(null);
            return ok;
          }}
        />
      )}
    </div>
  );
}

function LimitsModal({
  user,
  onClose,
  onSave,
}: {
  user: User;
  onClose: () => void;
  onSave: (limits: {
    monthlyQuota: number | null;
    dailyQuota: number | null;
    rpm: number | null;
    note: string | null;
  }) => Promise<boolean>;
}) {
  const [monthly, setMonthly] = React.useState(user.custom_monthly_quota?.toString() ?? '');
  const [daily, setDaily] = React.useState(user.custom_daily_quota?.toString() ?? '');
  const [rpm, setRpm] = React.useState(user.custom_rpm?.toString() ?? '');
  const [note, setNote] = React.useState(user.limit_note ?? '');
  const [saving, setSaving] = React.useState(false);

  const parse = (v: string): number | null => {
    const t = v.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
  };

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({
        monthlyQuota: parse(monthly),
        dailyQuota: parse(daily),
        rpm: parse(rpm),
        note: note.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setSaving(true);
    try {
      await onSave({ monthlyQuota: null, dailyQuota: null, rpm: null, note: null });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Gauge className="h-3.5 w-3.5 text-brand-400" /> Özel limit tanımla
        </div>
        <div className="mb-5 font-mono text-sm">{user.email}</div>

        <p className="mb-4 text-xs text-muted-foreground">
          Boş bırakılırsa free planın varsayılan limiti kullanılır (60/dk · 3.000/gün · 30.000/ay).
          Tanımlanan alanlar kullanıcının default'unu override eder.
        </p>

        <div className="space-y-3">
          <LimitField
            label="Dakikada"
            suffix="istek/dk"
            placeholder="60"
            value={rpm}
            onChange={setRpm}
          />
          <LimitField
            label="Günlük kap"
            suffix="istek/gün"
            placeholder="3000"
            value={daily}
            onChange={setDaily}
          />
          <LimitField
            label="Aylık kota"
            suffix="istek/ay"
            placeholder="30000"
            value={monthly}
            onChange={setMonthly}
          />
          <div>
            <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted-foreground">
              Not (dahili)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ör. Araştırmacı · Mart sonuna kadar"
              maxLength={200}
              rows={2}
              className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={handleReset} disabled={saving}>
            Varsayılana dön
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
              İptal
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Kaydet'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LimitField({
  label,
  suffix,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  suffix: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <div className="flex items-center rounded-md border border-border bg-background focus-within:border-brand-500">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent px-3 py-2 font-mono text-sm outline-none placeholder:text-muted-foreground/50"
        />
        <span className="pr-3 font-mono text-[11px] text-muted-foreground">{suffix}</span>
      </div>
    </div>
  );
}


function XComposer() {
  const [content, setContent] = React.useState('');
  const [kind, setKind] = React.useState<'daily_digest' | 'fund_highlight' | 'cpi_update' | 'custom'>('daily_digest');
  const [customPrompt, setCustomPrompt] = React.useState('');
  const [generating, setGenerating] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [result, setResult] = React.useState<{ ok: boolean; msg: string } | null>(null);

  async function generate() {
    setGenerating(true);
    setResult(null);
    setCopied(false);
    try {
      const res = await fetch('/admin-api/x/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ kind, customPrompt: kind === 'custom' ? customPrompt : undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, msg: data.error || 'Üretim başarısız' });
        return;
      }
      setContent(data.text);
      setResult({ ok: true, msg: 'AI tweet üretti — düzenle, kopyala veya X\'te paylaş.' });
    } finally {
      setGenerating(false);
    }
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setResult({ ok: false, msg: 'Kopyalanamadı' });
    }
  }

  function openInX() {
    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(content)}`;
    window.open(url, '_blank', 'width=600,height=400');
  }

  const charCount = content.length;
  const overLimit = charCount > 280;

  return (
    <div className="mt-4">
      <div className="panel p-6 max-w-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Twitter className="h-4 w-4 text-verdigris-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Tweet oluştur
            </h2>
          </div>
          <span className="rounded-full bg-verdigris-500/15 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-verdigris-400">
            @fonoloji_
          </span>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              AI tema
            </label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
              className="w-full rounded-lg border border-border bg-card/40 px-3 py-2 text-sm focus:border-brand-500/50 focus:bg-card/60 focus:outline-none"
            >
              <option value="daily_digest">Günün özeti (en çok yükselen/düşen)</option>
              <option value="cpi_update">TÜFE güncellemesi</option>
              <option value="fund_highlight">Fon vurgusu</option>
              <option value="custom">Özel prompt</option>
            </select>
          </div>

          {kind === 'custom' && (
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Prompt
              </label>
              <input
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Ne hakkında yazsın? (AI prompt)"
                className="w-full rounded-lg border border-border bg-card/40 px-3 py-2 text-sm focus:border-brand-500/50 focus:bg-card/60 focus:outline-none"
              />
            </div>
          )}

          <button
            onClick={generate}
            disabled={generating}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-brand-500/40 bg-brand-500/10 px-3 py-2 text-sm text-brand-400 transition-colors hover:bg-brand-500/20 disabled:opacity-50"
          >
            {generating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> AI ile yazılıyor…
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" /> AI ile üret
              </>
            )}
          </button>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Tweet içeriği
              </label>
              <span className={cn('text-[10px] tabular-nums', overLimit ? 'text-loss' : 'text-muted-foreground')}>
                {charCount} / 280
              </span>
            </div>
            <textarea
              value={content}
              onChange={(e) => { setContent(e.target.value); setCopied(false); }}
              placeholder="Tweet metnini yaz veya AI ile üret…"
              rows={6}
              maxLength={280}
              className="w-full resize-none rounded-lg border border-border bg-card/40 px-3 py-2 text-sm leading-relaxed focus:border-brand-500/50 focus:bg-card/60 focus:outline-none"
            />
          </div>

          {result && (
            <div
              className={cn(
                'rounded-lg border px-3 py-2 text-xs',
                result.ok
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-loss/30 bg-loss/10 text-loss',
              )}
            >
              {result.msg}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-3">
            <button
              onClick={copyToClipboard}
              disabled={!content.trim() || overLimit}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm transition-all disabled:opacity-50',
                copied
                  ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400'
                  : 'border-border bg-card/60 text-foreground hover:bg-card',
              )}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Kopyalandı
                </>
              ) : (
                <>
                  <ClipboardCopy className="h-3.5 w-3.5" /> Kopyala
                </>
              )}
            </button>
            <button
              onClick={openInX}
              disabled={!content.trim() || overLimit}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-500 to-verdigris-400 px-5 py-1.5 text-sm font-semibold text-background disabled:opacity-50"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              X'te paylaş
            </button>
          </div>

          <p className="text-[10px] text-muted-foreground/60 text-center">
            AI tweet üretir → düzenlersin → X'te paylaş butonu ile direkt X açılır, metin hazır gelir.
          </p>
        </div>
      </div>
    </div>
  );
}

function MailComposer({ totalUsers }: { totalUsers: number }) {
  const [from, setFrom] = React.useState<'no-reply' | 'hello' | 'alikemal'>('no-reply');
  const [recipients, setRecipients] = React.useState<'single' | 'all-verified' | 'all'>('single');
  const [to, setTo] = React.useState('');
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');
  const [html, setHtml] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [result, setResult] = React.useState<
    { ok: boolean; sent?: number; failed?: number; error?: string } | null
  >(null);

  async function send() {
    if (!subject.trim() || !body.trim()) {
      setResult({ ok: false, error: 'Konu ve mesaj gerekli' });
      return;
    }
    if (recipients === 'single' && !to.trim()) {
      setResult({ ok: false, error: 'Alıcı e-posta gerekli' });
      return;
    }
    const confirmed =
      recipients === 'single' ||
      confirm(
        `${recipients === 'all' ? 'TÜM' : 'Tüm doğrulanmış'} kullanıcılara mail gönderiyorsun. Emin misin?`,
      );
    if (!confirmed) return;

    setSending(true);
    setResult(null);
    try {
      const res = await fetch('/admin-api/mail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          from,
          recipients,
          to: recipients === 'single' ? to : undefined,
          subject,
          body,
          html,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, error: data.error || 'Gönderilemedi' });
        return;
      }
      setResult({ ok: data.ok, sent: data.sent, failed: data.failed, error: data.error });
      if (data.ok) {
        setTo('');
        setSubject('');
        setBody('');
      }
    } finally {
      setSending(false);
    }
  }

  const inputClass =
    'w-full rounded-lg border border-border bg-card/40 px-3 py-2 text-sm focus:border-brand-500/50 focus:bg-card/60 focus:outline-none';

  return (
    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
      <div className="panel p-6">
        <div className="mb-5 flex items-center gap-2">
          <MailPlus className="h-4 w-4 text-brand-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Mail oluştur
          </h2>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Gönderen
              </label>
              <select
                value={from}
                onChange={(e) => setFrom(e.target.value as typeof from)}
                className={inputClass + ' font-mono'}
              >
                <option value="no-reply">no-reply@fonoloji.com</option>
                <option value="hello">hello@fonoloji.com</option>
                <option value="alikemal">alikemal@fonoloji.com</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Alıcı tipi
              </label>
              <select
                value={recipients}
                onChange={(e) => setRecipients(e.target.value as typeof recipients)}
                className={inputClass}
              >
                <option value="single">Tek kişi</option>
                <option value="all-verified">Tüm doğrulanmışlar</option>
                <option value="all">TÜM kullanıcılar ({totalUsers})</option>
              </select>
            </div>
          </div>

          {recipients === 'single' ? (
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Alıcı e-posta
              </label>
              <input
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="ornek@mail.com"
                className={inputClass}
              />
            </div>
          ) : (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              <strong>Dikkat:</strong> Bu mod{' '}
              {recipients === 'all-verified' ? 'doğrulanmış aktif kullanıcılara' : 'TÜM aktif kullanıcılara'}{' '}
              mail gönderir. Max 500 alıcı/gönderim.
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Konu
            </label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Mail konusu"
              maxLength={300}
              className={inputClass}
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Mesaj
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={html}
                  onChange={(e) => setHtml(e.target.checked)}
                  className="h-3 w-3 rounded border-border"
                />
                HTML (ham)
              </label>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={html ? '<p>HTML...</p>' : 'Düz metin — satır sonları otomatik korunur.'}
              rows={12}
              maxLength={50_000}
              className={`${inputClass} resize-none font-${html ? 'mono' : 'sans'}`}
            />
            <div className="mt-1 text-right text-[10px] text-muted-foreground/60">
              {body.length} / 50000
            </div>
          </div>

          {result && (
            <div
              className={cn(
                'rounded-lg border px-3 py-2 text-xs',
                result.ok
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-loss/30 bg-loss/10 text-loss',
              )}
            >
              {result.ok ? (
                <>
                  ✅ Gönderildi: <strong>{result.sent}</strong> başarılı
                  {result.failed ? `, ${result.failed} başarısız` : ''}
                </>
              ) : (
                <>❌ {result.error}</>
              )}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border/60 pt-4">
            <div className="text-[11px] text-muted-foreground">
              Kimden:{' '}
              <span className="font-mono text-foreground/80">
                {from === 'no-reply'
                  ? 'no-reply@fonoloji.com'
                  : from === 'hello'
                  ? 'hello@fonoloji.com'
                  : 'alikemal@fonoloji.com'}
              </span>
            </div>
            <button
              onClick={send}
              disabled={sending}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-500 to-verdigris-400 px-5 py-2 text-sm font-semibold text-background shadow-lg shadow-brand-500/20 disabled:opacity-50"
            >
              {sending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Gönderiliyor
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" /> Gönder
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="panel p-5">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          İpuçları
        </h3>
        <ul className="space-y-2 text-xs text-muted-foreground">
          <li>• <strong>Düz metin</strong> modu: aynen yazdığın gibi gider. Branding yok, footer yok.</li>
          <li>• <strong>HTML</strong> modu: kendi HTML'ini ham olarak gönder.</li>
          <li>• Toplu gönderimde Resend rate limit'i korumak için 8&apos;li batch + 900ms bekleme var.</li>
          <li>• Max 500 alıcı/istek. Daha fazla için bölerek gönder.</li>
          <li>• <code className="rounded bg-background px-1 font-mono text-[10px]">alikemal@fonoloji.com</code> Resend&apos;de domain verify olduysa çalışır.</li>
        </ul>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <div className="panel p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-brand-400" />
        {label}
      </div>
      <div className="mt-2 font-mono text-3xl tabular-nums">
        {value.toLocaleString('tr-TR')}
      </div>
    </div>
  );
}

interface ThreadReply {
  id: number;
  ts: number;
  to_email: string;
  subject: string;
  body_preview: string | null;
  body_html: string | null;
  status: 'sent' | 'failed';
  error: string | null;
}

function MessagePanel({
  msg,
  onDelete,
  onReplied,
}: {
  msg: Message;
  onDelete: () => void;
  onReplied: () => void;
}) {
  const [composing, setComposing] = React.useState(false);
  const [subject, setSubject] = React.useState(`Re: ${msg.subject}`);
  const [body, setBody] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  const [thread, setThread] = React.useState<ThreadReply[]>([]);
  const [openReplyId, setOpenReplyId] = React.useState<number | null>(null);

  const loadThread = React.useCallback(() => {
    fetch(`/admin-api/messages/${msg.id}/thread`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setThread(d.replies ?? []))
      .catch(() => setThread([]));
  }, [msg.id]);

  React.useEffect(() => {
    setComposing(false);
    setSubject(`Re: ${msg.subject}`);
    setBody('');
    setError(null);
    setSent(false);
    loadThread();
  }, [msg.id, msg.subject, loadThread]);

  async function send() {
    if (body.trim().length < 3) {
      setError('Yanıt en az 3 karakter olmalı');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/admin-api/messages/${msg.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ subject, body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data.error as string) || 'Mail gönderilemedi');
        return;
      }
      setSent(true);
      onReplied();
    } finally {
      setSending(false);
    }
  }

  const alreadyReplied = msg.replied_at !== null && !sent;

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3 border-b border-border/50 pb-3">
        <div className="min-w-0 flex-1">
          <div className="serif text-xl leading-tight">{msg.subject}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {msg.full_name} &lt;
            <a href={`mailto:${msg.email}`} className="hover:text-brand-400">
              {msg.email}
            </a>
            &gt;
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {new Date(msg.created_at).toLocaleString('tr-TR')}
            {msg.replied_at && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-400">
                <Check className="h-2.5 w-2.5" /> Yanıtlandı
              </span>
            )}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onDelete} title="Sil">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{msg.message}</div>

      {thread.length > 0 && (
        <div className="mt-6 space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Gönderdiğin yanıtlar ({thread.length})
          </div>
          {thread.map((r) => (
            <div key={r.id} className="rounded-lg border border-border/60 bg-card/40">
              <button
                type="button"
                onClick={() => setOpenReplyId(openReplyId === r.id ? null : r.id)}
                className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.subject}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {new Date(r.ts).toLocaleString('tr-TR')} → {r.to_email}
                  </div>
                  {r.body_preview && (
                    <div className="mt-1 line-clamp-2 text-xs text-muted-foreground/80">{r.body_preview}</div>
                  )}
                </div>
                <span className={cn(
                  'shrink-0 rounded px-1.5 py-0.5 text-[10px]',
                  r.status === 'sent' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300',
                )}>
                  {r.status === 'sent' ? 'gönderildi' : 'hata'}
                </span>
              </button>
              {openReplyId === r.id && r.body_html && (
                <div className="border-t border-border/40 p-2">
                  <iframe
                    srcDoc={r.body_html}
                    className="h-96 w-full rounded border border-border/40 bg-white"
                    sandbox=""
                  />
                </div>
              )}
              {openReplyId === r.id && r.error && (
                <div className="border-t border-border/40 px-3 py-2 text-xs text-rose-300">{r.error}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {sent ? (
        <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          <div className="flex items-center gap-2 font-semibold">
            <Check className="h-4 w-4" /> Yanıt gönderildi
          </div>
          <div className="mt-1 text-xs text-emerald-300/80">
            {msg.email} adresine <strong>no-reply@fonoloji.com</strong>'dan gönderildi.
          </div>
        </div>
      ) : !composing ? (
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            onClick={() => setComposing(true)}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-500 to-verdigris-400 px-4 py-2 text-sm font-semibold text-background shadow-lg shadow-brand-500/20"
          >
            <Reply className="h-3.5 w-3.5" />
            {alreadyReplied ? 'Tekrar yanıtla' : 'Yanıtla'}
          </button>
          <a
            href={`mailto:${msg.email}?subject=${encodeURIComponent(`Re: ${msg.subject}`)}`}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <Mail className="h-3 w-3" /> Harici mail
          </a>
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-border bg-card/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Reply className="mr-1 inline h-3 w-3" /> Yanıt oluştur
            </div>
            <div className="text-[10px] text-muted-foreground">
              Kimden: <span className="font-mono text-foreground/80">no-reply@fonoloji.com</span>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Kime
              </label>
              <input
                readOnly
                value={`${msg.full_name} <${msg.email}>`}
                className="w-full cursor-not-allowed rounded-lg border border-border bg-background/40 px-3 py-2 text-sm text-muted-foreground"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Konu
              </label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-lg border border-border bg-background/40 px-3 py-2 text-sm focus:border-brand-500/50 focus:bg-background/60 focus:outline-none"
                maxLength={300}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Mesaj
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={9}
                placeholder="Merhaba…"
                className="w-full resize-none rounded-lg border border-border bg-background/40 px-3 py-2 text-sm leading-relaxed focus:border-brand-500/50 focus:bg-background/60 focus:outline-none"
                maxLength={20_000}
              />
              <div className="mt-1 text-right text-[10px] text-muted-foreground/60">
                {body.length} / 20000
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-loss/30 bg-loss/10 px-3 py-2 text-xs text-loss">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => setComposing(false)}
                disabled={sending}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                İptal
              </button>
              <button
                onClick={send}
                disabled={sending || body.trim().length < 3}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-500 to-verdigris-400 px-5 py-2 text-sm font-semibold text-background shadow-lg shadow-brand-500/20 disabled:opacity-50"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Gönderiliyor
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" /> Gönder
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {msg.reply_body && !composing && !sent && (
        <div className="mt-6 rounded-xl border border-border/60 bg-card/20 p-4">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
            Son yanıt · {msg.replied_at ? new Date(msg.replied_at).toLocaleString('tr-TR') : ''}
          </div>
          <div className="mb-2 text-xs font-medium">{(msg as Message & { reply_subject?: string }).reply_subject}</div>
          <div className="whitespace-pre-wrap text-sm text-muted-foreground">
            {(msg as Message & { reply_body?: string }).reply_body}
          </div>
        </div>
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-2 text-sm font-medium transition-colors',
        active
          ? 'border-b-2 border-brand-400 text-foreground'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
