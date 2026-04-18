'use client';

import { AlertTriangle, Loader2, Plus, Radar, Trash2 } from 'lucide-react';
import * as React from 'react';
import { api } from '@/lib/api';
import { cn, formatCompact } from '@/lib/utils';

interface Row { code: string; weight: string }

type XrayResult = Awaited<ReturnType<typeof api.portfolioXray>>;

export function PortfoyAnalizClient() {
  const [rows, setRows] = React.useState<Row[]>([
    { code: '', weight: '' },
    { code: '', weight: '' },
    { code: '', weight: '' },
  ]);
  const [result, setResult] = React.useState<XrayResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const totalWeight = rows.reduce((s, r) => s + (Number(r.weight) || 0), 0);

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((xs) => xs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function addRow() {
    if (rows.length >= 20) return;
    setRows((xs) => [...xs, { code: '', weight: '' }]);
  }

  function removeRow(i: number) {
    setRows((xs) => (xs.length <= 1 ? xs : xs.filter((_, idx) => idx !== i)));
  }

  function equalWeight() {
    const filled = rows.filter((r) => r.code.trim());
    if (filled.length === 0) return;
    const w = (100 / filled.length).toFixed(1);
    setRows((xs) => xs.map((r) => (r.code.trim() ? { ...r, weight: w } : r)));
  }

  async function run() {
    setError(null);
    const funds = rows
      .filter((r) => r.code.trim() && Number(r.weight) > 0)
      .map((r) => ({ code: r.code.trim().toUpperCase(), weight: Number(r.weight) }));
    if (funds.length === 0) { setError('En az bir fon + ağırlık gerekli'); return; }
    setLoading(true);
    try {
      const d = await api.portfolioXray(funds);
      if ('error' in d) throw new Error(String((d as { error?: string }).error ?? 'Hata'));
      setResult(d);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  return (
    <div className="container py-10 md:py-14">
      <div className="mb-10 border-b border-border/50 pb-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <Radar className="h-3 w-3 text-brand-400" /> Araç
        </div>
        <h1 className="display mt-2 text-5xl leading-none md:text-6xl">
          Portföy <span className="display-italic gradient-text">X-Ray</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Birden fazla fonun KAP portföy raporlarını birleştiriyor — asıl hangi hisseye ne kadar
          maruz kaldığını gösteriyor. "3 farklı fonda toplam %17 ASELS" gibi gizli
          konsantrasyonları bulur. Çeşitlenme yanılsamalarını kırar.
        </p>
      </div>

      {/* Input */}
      <div className="panel mb-6 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Fonlar + ağırlıklar
          </h2>
          <div className="flex items-center gap-2">
            <span className={cn(
              'font-mono text-xs tabular-nums',
              Math.abs(totalWeight - 100) < 0.1 ? 'text-emerald-400' : 'text-amber-300',
            )}>
              toplam: %{totalWeight.toFixed(1)}
            </span>
            <button
              onClick={equalWeight}
              className="rounded-md border border-border/50 bg-background/40 px-2 py-1 text-[11px] text-muted-foreground hover:border-brand-500/40 hover:text-foreground"
            >
              Eşit böl
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={r.code}
                onChange={(e) => updateRow(i, { code: e.target.value.toUpperCase() })}
                placeholder="Kod (örn. TTE)"
                className="flex-1 rounded-lg border border-border bg-background/40 px-3 py-2 font-mono text-sm uppercase outline-none focus:border-brand-500/50"
              />
              <input
                type="number"
                min="0" max="100" step="0.1"
                value={r.weight}
                onChange={(e) => updateRow(i, { weight: e.target.value })}
                placeholder="%"
                className="w-24 rounded-lg border border-border bg-background/40 px-3 py-2 text-sm tabular-nums outline-none focus:border-brand-500/50"
              />
              <button
                onClick={() => removeRow(i)}
                className="rounded p-2 text-muted-foreground hover:bg-loss/20 hover:text-loss"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={addRow}
            disabled={rows.length >= 20}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background/40 px-3 py-1.5 text-xs text-muted-foreground hover:border-brand-500/40 hover:text-foreground disabled:opacity-40"
          >
            <Plus className="h-3 w-3" /> Fon ekle
          </button>
          <button
            onClick={run}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-500 to-verdigris-400 px-5 py-2 text-sm font-semibold text-background shadow-lg shadow-brand-500/20 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Analiz et
          </button>
        </div>
        {error && (
          <div className="mt-3 rounded-lg border border-loss/40 bg-loss/10 px-3 py-2 text-xs text-loss">
            {error}
          </div>
        )}
      </div>

      {/* Result */}
      {result && <XrayResults result={result} />}

      <p className="mt-16 text-center text-xs text-muted-foreground">
        Kaynak: KAP portföy dağılım raporları · Yatırım tavsiyesi değildir.
      </p>
    </div>
  );
}

function XrayResults({ result }: { result: XrayResult }) {
  const totalClass = result.totalStockPct + result.totalBondPct + result.totalCashPct + result.totalGoldPct + result.totalOtherPct;

  return (
    <>
      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="panel mb-6 border-amber-500/40 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5" /> Uyarılar
          </div>
          <ul className="mt-2 list-inside list-disc text-xs text-amber-200/80">
            {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {/* Asset class breakdown */}
      <div className="panel mb-6 p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Varlık sınıfı dağılımı
        </h3>
        <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
          <Tile label="Hisse" value={result.totalStockPct} color="text-emerald-300" />
          <Tile label="Tahvil" value={result.totalBondPct} color="text-brand-300" />
          <Tile label="Nakit/Repo" value={result.totalCashPct} color="text-sky-300" />
          <Tile label="Altın" value={result.totalGoldPct} color="text-amber-300" />
          <Tile label="Diğer" value={result.totalOtherPct} color="text-muted-foreground" />
        </div>
        <div className="flex h-3 overflow-hidden rounded-full bg-border/40">
          {[
            { pct: result.totalStockPct, cls: 'bg-emerald-500' },
            { pct: result.totalBondPct, cls: 'bg-brand-500' },
            { pct: result.totalCashPct, cls: 'bg-sky-500' },
            { pct: result.totalGoldPct, cls: 'bg-amber-500' },
            { pct: result.totalOtherPct, cls: 'bg-muted-foreground/40' },
          ].map((s, i) => s.pct > 0 && (
            <div key={i} className={s.cls} style={{ width: `${(s.pct / Math.max(totalClass, 0.01)) * 100}%` }} />
          ))}
        </div>
        <div className="mt-3 text-[10px] text-muted-foreground/70">
          Kapsam: %{result.coveragePct} · {result.fundCount} fon analiz edildi
        </div>
      </div>

      {/* Concentration warnings */}
      {result.concentration.length > 0 && (
        <div className="panel mb-6 border-loss/40 bg-loss/5 p-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-loss">
            <AlertTriangle className="h-3.5 w-3.5" /> Konsantrasyon riski
          </h3>
          <ul className="space-y-2">
            {result.concentration.map((c) => (
              <li key={c.asset_name} className="flex items-center justify-between text-sm">
                <span className="font-mono font-semibold">{c.asset_name}</span>
                <span className="font-mono text-loss">%{c.weight.toFixed(1)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Exposure table */}
      {result.exposures.length > 0 && (
        <div className="panel p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Underlying exposure · ilk {result.exposures.length} varlık
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2 text-left">Varlık</th>
                  <th className="pb-2 text-left">Tip</th>
                  <th className="pb-2 text-right">Ağırlık</th>
                  <th className="pb-2 text-left">Hangi fonlardan</th>
                </tr>
              </thead>
              <tbody>
                {result.exposures.map((e) => (
                  <tr key={`${e.asset_code}-${e.asset_name}`} className="border-t border-border/30">
                    <td className="py-2 pr-3 font-mono font-semibold">{e.asset_name}</td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{e.asset_type}</td>
                    <td className="py-2 pr-3 text-right">
                      <span className={cn(
                        'font-mono tabular-nums',
                        e.total_weight >= 10 ? 'text-loss' : e.total_weight >= 5 ? 'text-amber-300' : 'text-foreground/80',
                      )}>
                        %{e.total_weight.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {e.contributions.slice(0, 3).map((c) => `${c.fund_code} (%${c.weight.toFixed(1)})`).join(' · ')}
                      {e.contributions.length > 3 && ` +${e.contributions.length - 3}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

function Tile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-border/40 bg-background/30 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('mt-1 font-mono text-xl font-semibold tabular-nums', color)}>
        %{value.toFixed(1)}
      </div>
    </div>
  );
}
