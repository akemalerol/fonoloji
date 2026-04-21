'use client';

import { AlertCircle, CheckCircle2, Clock, Loader2, PlayCircle, RefreshCw, Search } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

// İş Yatırım çağrı geçmişi + güncel hisse tablosu + manuel tetikleme paneli.
// Admin panelinde ayrı sekme olarak yaşar.

interface Run {
  id: number;
  started_at: number;
  finished_at: number | null;
  duration_ms: number | null;
  total: number | null;
  tagged: number | null;
  errors: number | null;
  trigger: string | null;
  error_message: string | null;
  status: 'running' | 'ok' | 'error';
}

interface Stock {
  ticker: string;
  name: string | null;
  close_price: number | null;
  target_price: number | null;
  potential_pct: number | null;
  pe_ratio: number | null;
  market_cap_mn_tl: number | null;
  recommendation: string | null;
  as_of_date: string;
  updated_at: number;
}

interface RunsResp {
  items: Run[];
  stats: { total_runs: number; ok: number; failed: number; last_run: number | null };
  latest: { stocks: number; as_of_date: string | null };
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDateTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatCompactMn(v: number | null): string {
  if (v === null) return '—';
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}tr`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}mr`;
  return `${v.toFixed(0)}mn`;
}

function recStyle(rec: string | null): { label: string; cls: string } {
  switch (rec) {
    case 'AL': return { label: 'AL', cls: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30' };
    case 'SAT': return { label: 'SAT', cls: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30' };
    case 'TUT': return { label: 'TUT', cls: 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30' };
    case 'GÖZDEN GEÇİRİLİYOR': return { label: 'GG', cls: 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30' };
    default: return { label: '—', cls: 'bg-muted/30 text-muted-foreground' };
  }
}

export function AnalystPanel() {
  const [runs, setRuns] = React.useState<RunsResp | null>(null);
  const [stocks, setStocks] = React.useState<Stock[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [triggering, setTriggering] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [view, setView] = React.useState<'runs' | 'stocks'>('runs');
  const [error, setError] = React.useState<string | null>(null);

  const loadRuns = React.useCallback(async () => {
    const res = await fetch('/admin-api/isyatirim/runs?limit=50', { credentials: 'include' });
    if (res.ok) setRuns(await res.json());
  }, []);

  const loadStocks = React.useCallback(async (query = '') => {
    const url = `/admin-api/isyatirim/stocks?limit=200${query ? `&q=${encodeURIComponent(query)}` : ''}`;
    const res = await fetch(url, { credentials: 'include' });
    if (res.ok) {
      const d = await res.json();
      setStocks(d.items ?? []);
    }
  }, []);

  React.useEffect(() => {
    Promise.all([loadRuns(), loadStocks()]).finally(() => setLoading(false));
  }, [loadRuns, loadStocks]);

  React.useEffect(() => {
    const t = setInterval(() => {
      // "running" varsa 5 sn'de bir, yoksa 30sn
      const hasRunning = runs?.items.some((r) => r.status === 'running');
      if (hasRunning) loadRuns();
    }, 5000);
    return () => clearInterval(t);
  }, [runs, loadRuns]);

  const trigger = async () => {
    setTriggering(true);
    setError(null);
    try {
      const res = await fetch('/admin-api/isyatirim/run', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Tetiklenemedi');
      // 1sn sonra refresh
      setTimeout(loadRuns, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hata');
    } finally {
      setTriggering(false);
    }
  };

  const onSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    loadStocks(q);
  };

  const hasRunning = runs?.items.some((r) => r.status === 'running');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Yükleniyor…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border/60 bg-card/40 p-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            İş Yatırım Analist İngest
          </div>
          <div className="mt-1 text-base">
            {runs?.latest.stocks ?? 0} hisse · son {runs?.latest.as_of_date ?? '—'} tarihli
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Toplam {runs?.stats.total_runs ?? 0} sorgu · {runs?.stats.ok ?? 0} ok · {runs?.stats.failed ?? 0} hata
            {runs?.stats.last_run && ` · son: ${formatDateTime(runs.stats.last_run)}`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadRuns}
            className="inline-flex items-center gap-1.5 rounded-md bg-muted/30 px-3 py-2 text-xs hover:bg-muted/50"
            title="Listeyi yenile"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Yenile
          </button>
          <button
            onClick={trigger}
            disabled={triggering || hasRunning}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold text-background transition',
              triggering || hasRunning
                ? 'bg-muted/40 text-muted-foreground'
                : 'bg-brand-500 hover:bg-brand-400',
            )}
          >
            {triggering || hasRunning ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {hasRunning ? 'Sorgu çalışıyor…' : 'Başlatılıyor…'}
              </>
            ) : (
              <>
                <PlayCircle className="h-3.5 w-3.5" /> Şimdi Çek
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
          {error}
        </div>
      )}

      <div className="flex gap-2 border-b border-border/50">
        <button
          onClick={() => setView('runs')}
          className={cn(
            '-mb-px border-b-2 px-3 py-2 text-sm',
            view === 'runs' ? 'border-brand-500 text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          Sorgu Geçmişi
        </button>
        <button
          onClick={() => setView('stocks')}
          className={cn(
            '-mb-px border-b-2 px-3 py-2 text-sm',
            view === 'stocks' ? 'border-brand-500 text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          Güncel Hisse Tablosu
        </button>
      </div>

      {view === 'runs' ? (
        <div className="overflow-auto rounded-lg border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/20 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Başlangıç</th>
                <th className="px-3 py-2 text-left">Tetik</th>
                <th className="px-3 py-2 text-left">Durum</th>
                <th className="px-3 py-2 text-right">Süre</th>
                <th className="px-3 py-2 text-right">Hisse</th>
                <th className="px-3 py-2 text-right">Etiketli</th>
                <th className="px-3 py-2 text-right">Hata</th>
                <th className="px-3 py-2 text-left">Hata Mesajı</th>
              </tr>
            </thead>
            <tbody>
              {(runs?.items ?? []).map((r) => (
                <tr key={r.id} className="border-t border-border/40 hover:bg-muted/10">
                  <td className="px-3 py-2 font-mono text-xs">{formatDateTime(r.started_at)}</td>
                  <td className="px-3 py-2 text-xs">
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[10px] uppercase',
                        r.trigger === 'manual' ? 'bg-brand-500/15 text-brand-200' : 'bg-muted/30 text-muted-foreground',
                      )}
                    >
                      {r.trigger ?? '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {r.status === 'running' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-sky-300">
                        <Loader2 className="h-3 w-3 animate-spin" /> çalışıyor
                      </span>
                    ) : r.status === 'ok' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" /> ok
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-rose-300">
                        <AlertCircle className="h-3 w-3" /> hata
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                    {formatDuration(r.duration_ms)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{r.total ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">{r.tagged ?? '—'}</td>
                  <td className={cn('px-3 py-2 text-right font-mono text-xs', r.errors && r.errors > 0 && 'text-rose-300')}>
                    {r.errors ?? '—'}
                  </td>
                  <td className="px-3 py-2 max-w-md truncate text-[11px] text-muted-foreground" title={r.error_message ?? ''}>
                    {r.error_message ?? '—'}
                  </td>
                </tr>
              ))}
              {(runs?.items ?? []).length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-12 text-center text-sm text-muted-foreground">
                    <Clock className="mx-auto mb-2 h-6 w-6 opacity-40" />
                    Henüz kayıtlı sorgu yok. "Şimdi Çek" ile başlat.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-3">
          <form onSubmit={onSearch} className="flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ticker veya isim…"
                className="w-full rounded-md border border-border/60 bg-muted/10 py-2 pl-8 pr-3 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="rounded-md bg-muted/30 px-3 py-2 text-xs hover:bg-muted/50"
            >
              Ara
            </button>
          </form>
          <div className="overflow-auto rounded-lg border border-border/60">
            <table className="w-full text-sm">
              <thead className="bg-muted/20 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Hisse</th>
                  <th className="px-3 py-2 text-right">Kapanış</th>
                  <th className="px-3 py-2 text-right">Hedef</th>
                  <th className="px-3 py-2 text-right">Potansiyel</th>
                  <th className="px-3 py-2 text-right">F/K</th>
                  <th className="px-3 py-2 text-right">Piyasa Değ.</th>
                  <th className="px-3 py-2 text-center">Öneri</th>
                  <th className="px-3 py-2 text-right">Tarih</th>
                </tr>
              </thead>
              <tbody>
                {stocks.map((s) => {
                  const { label, cls } = recStyle(s.recommendation);
                  const pot = s.potential_pct;
                  const validTarget = s.target_price !== null && s.target_price > 0;
                  return (
                    <tr key={s.ticker} className="border-t border-border/40 hover:bg-muted/10">
                      <td className="px-3 py-2">
                        <div className="font-mono text-xs font-semibold">{s.ticker}</div>
                        {s.name && (
                          <div className="max-w-[220px] truncate text-[10px] text-muted-foreground" title={s.name}>
                            {s.name}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs">
                        {s.close_price !== null ? s.close_price.toFixed(2) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs">
                        {validTarget ? s.target_price!.toFixed(2) : '—'}
                      </td>
                      <td
                        className={cn(
                          'px-3 py-2 text-right font-mono text-xs tabular-nums',
                          validTarget && pot !== null && pot >= 0 && 'text-emerald-300',
                          validTarget && pot !== null && pot < 0 && 'text-rose-300',
                          !validTarget && 'text-muted-foreground',
                        )}
                      >
                        {validTarget && pot !== null ? `${pot >= 0 ? '+' : ''}${pot.toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                        {s.pe_ratio !== null ? s.pe_ratio.toFixed(1) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                        {formatCompactMn(s.market_cap_mn_tl)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', cls)}>
                          {label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[10px] text-muted-foreground">
                        {s.as_of_date}
                      </td>
                    </tr>
                  );
                })}
                {stocks.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-sm text-muted-foreground">
                      {q ? `"${q}" için sonuç yok.` : 'Henüz hisse verisi yok.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
