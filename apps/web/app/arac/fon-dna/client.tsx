'use client';

import { Dna, Loader2 } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type Overlap = Awaited<ReturnType<typeof api.fundOverlap>>;

export function FonDnaClient({ initialA, initialB }: { initialA?: string; initialB?: string }) {
  const [a, setA] = React.useState(initialA ?? '');
  const [b, setB] = React.useState(initialB ?? '');
  const [result, setResult] = React.useState<Overlap | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function run() {
    if (!a.trim() || !b.trim()) { setError('İki fon kodu gerekli'); return; }
    if (a.trim().toUpperCase() === b.trim().toUpperCase()) {
      setError('Aynı fonu seçtin'); return;
    }
    setError(null); setLoading(true);
    try {
      const d = await api.fundOverlap(a.trim(), b.trim());
      setResult(d);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  React.useEffect(() => {
    if (initialA && initialB) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="container py-10 md:py-14">
      <div className="mb-10 border-b border-border/50 pb-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <Dna className="h-3 w-3 text-verdigris-400" /> Araç
        </div>
        <h1 className="display mt-2 text-5xl leading-none md:text-6xl">
          Fon <span className="display-italic gradient-text">DNA'sı</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          İki fonun KAP portföylerini karşılaştırır — ne kadar örtüştüklerini (%) söyler.
          "Aynı fon, farklı paketleme" tuzağını açığa çıkarır. %70+ örtüşme varsa
          aslında çeşitlendirme değil, kopya tutuyorsun.
        </p>
      </div>

      <div className="panel mb-6 p-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_1fr_auto]">
          <input
            value={a}
            onChange={(e) => setA(e.target.value.toUpperCase())}
            placeholder="A Fonu (örn. TTE)"
            className="rounded-lg border border-border bg-background/40 px-3 py-2 font-mono text-sm uppercase outline-none focus:border-brand-500/50"
          />
          <div className="hidden items-center justify-center text-lg text-muted-foreground md:flex">↔</div>
          <input
            value={b}
            onChange={(e) => setB(e.target.value.toUpperCase())}
            placeholder="B Fonu (örn. IPB)"
            className="rounded-lg border border-border bg-background/40 px-3 py-2 font-mono text-sm uppercase outline-none focus:border-brand-500/50"
          />
          <button
            onClick={run}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-500 to-verdigris-400 px-5 py-2 text-sm font-semibold text-background shadow-lg shadow-brand-500/20 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Karşılaştır
          </button>
        </div>
        {error && (
          <div className="mt-3 rounded-lg border border-loss/40 bg-loss/10 px-3 py-2 text-xs text-loss">
            {error}
          </div>
        )}
      </div>

      {result && <OverlapResult result={result} />}

      <p className="mt-16 text-center text-xs text-muted-foreground">
        Kaynak: KAP portföy dağılım raporları · Yatırım tavsiyesi değildir.
      </p>
    </div>
  );
}

function OverlapResult({ result }: { result: Overlap }) {
  const overlapColor = result.overlapPct >= 70 ? 'text-loss' : result.overlapPct >= 40 ? 'text-amber-300' : 'text-emerald-300';
  const verdict = result.overlapPct >= 70
    ? 'Neredeyse aynı fon — çeşitlenme yanılsaması'
    : result.overlapPct >= 40
      ? 'Ciddi örtüşme — çeşitlenme sınırlı'
      : result.overlapPct >= 15
        ? 'Orta örtüşme — bazı ortak hisseler var'
        : 'Farklı portföyler — iyi çeşitlenme';

  return (
    <>
      {/* Headline */}
      <div className="panel mb-6 p-8 text-center">
        <div className={cn('font-mono text-6xl font-bold tabular-nums md:text-8xl', overlapColor)}>
          %{result.overlapPct.toFixed(0)}
        </div>
        <div className={cn('mt-2 text-lg font-semibold', overlapColor)}>{verdict}</div>
        <div className="mt-3 text-xs text-muted-foreground">
          <Link href={`/fon/${result.codeA}`} className="font-mono hover:text-foreground">{result.codeA}</Link>
          {' vs '}
          <Link href={`/fon/${result.codeB}`} className="font-mono hover:text-foreground">{result.codeB}</Link>
          {result.reportDateA && ` · ${result.codeA} raporu ${result.reportDateA}, ${result.codeB} raporu ${result.reportDateB}`}
        </div>
      </div>

      {/* Breakdown */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="panel p-4 text-center">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Ortak</div>
          <div className="mt-1 font-mono text-2xl font-semibold">%{result.bothPct.toFixed(1)}</div>
        </div>
        <div className="panel p-4 text-center">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Sadece {result.codeA}
          </div>
          <div className="mt-1 font-mono text-2xl font-semibold text-brand-300">%{result.onlyAPct.toFixed(1)}</div>
        </div>
        <div className="panel p-4 text-center">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Sadece {result.codeB}
          </div>
          <div className="mt-1 font-mono text-2xl font-semibold text-verdigris-300">%{result.onlyBPct.toFixed(1)}</div>
        </div>
      </div>

      {/* Common holdings */}
      {result.commonHoldings.length > 0 && (
        <div className="panel mb-6 p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Ortak holdings — ilk {result.commonHoldings.length}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2 text-left">Varlık</th>
                  <th className="pb-2 text-right">{result.codeA}'da</th>
                  <th className="pb-2 text-right">{result.codeB}'de</th>
                  <th className="pb-2 text-right">Min (örtüşen)</th>
                </tr>
              </thead>
              <tbody>
                {result.commonHoldings.map((c) => (
                  <tr key={c.asset_name} className="border-t border-border/30">
                    <td className="py-2 pr-3 font-mono font-semibold">{c.asset_name}</td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums text-brand-300">%{c.weight_a.toFixed(1)}</td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums text-verdigris-300">%{c.weight_b.toFixed(1)}</td>
                    <td className="py-2 text-right font-mono tabular-nums">%{c.min.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Unique */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <UniqueList code={result.codeA} items={result.uniqueToA} accent="brand" />
        <UniqueList code={result.codeB} items={result.uniqueToB} accent="verdigris" />
      </div>
    </>
  );
}

function UniqueList({
  code,
  items,
  accent,
}: {
  code: string;
  items: Array<{ asset_name: string; weight: number }>;
  accent: 'brand' | 'verdigris';
}) {
  if (items.length === 0) return null;
  const color = accent === 'brand' ? 'text-brand-300' : 'text-verdigris-300';
  return (
    <div className="panel p-6">
      <h3 className={cn('mb-3 text-sm font-semibold uppercase tracking-wider', color)}>
        Sadece {code}'de · {items.length} varlık
      </h3>
      <ul className="space-y-1.5 text-sm">
        {items.slice(0, 10).map((it) => (
          <li key={it.asset_name} className="flex items-center justify-between">
            <span className="font-mono">{it.asset_name}</span>
            <span className={cn('font-mono tabular-nums', color)}>%{it.weight.toFixed(1)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
