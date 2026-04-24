'use client';

import { Coins, Loader2, Search, TrendingDown, TrendingUp } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

interface Physical {
  code: string;
  name: string | null;
  description: string | null;
  buy: number | null;
  sell: number | null;
  changePct: number | null;
  unitsForAmount: number | null;
  spreadPct: number | null;
}

interface FundRow {
  code: string;
  name: string;
  currentPrice: number | null;
  unitsForAmount: number | null;
  return30d: number | null;
  gramGold30dReturn: number | null;
  realGoldReturn: number | null;
}

interface CompareResp {
  amountTl: number;
  physical: Physical[];
  fund: FundRow | null;
}

interface FundSuggestion {
  code: string;
  name: string;
  category: string | null;
}

function fmtTl(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return n.toLocaleString('tr-TR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtUnits(n: number | null | undefined, digits = 3): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  // 1000+ için compact
  if (n >= 1000) {
    return n.toLocaleString('tr-TR', { maximumFractionDigits: 0 });
  }
  return n.toLocaleString('tr-TR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

const POPULAR_AMOUNTS = [1000, 5000, 10_000, 50_000, 100_000];

export function GoldCompareClient() {
  const [amountInput, setAmountInput] = React.useState('10000');
  const [fundCode, setFundCode] = React.useState('');
  const [fundQuery, setFundQuery] = React.useState('');
  const [suggestions, setSuggestions] = React.useState<FundSuggestion[]>([]);
  const [data, setData] = React.useState<CompareResp | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = React.useState(false);

  const amount = Math.max(0, Number(amountInput.replace(/[^\d]/g, '')) || 0);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/gold/compare?amount=${amount}${fundCode ? `&fundCode=${encodeURIComponent(fundCode)}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hata');
    } finally {
      setLoading(false);
    }
  }, [amount, fundCode]);

  React.useEffect(() => {
    const t = setTimeout(fetchData, 300); // debounce
    return () => clearTimeout(t);
  }, [fetchData]);

  // Fon arama suggestions
  React.useEffect(() => {
    if (!fundQuery || fundQuery.length < 2) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/funds?q=${encodeURIComponent(fundQuery)}&limit=8`);
        if (!res.ok) return;
        const json = (await res.json()) as {
          items: Array<{ code: string; name: string; category: string | null }>;
        };
        setSuggestions(json.items.slice(0, 8));
      } catch {
        /* noop */
      }
    }, 250);
    return () => clearTimeout(t);
  }, [fundQuery]);

  return (
    <div className="space-y-6">
      {/* Girdiler */}
      <div className="grid gap-4 rounded-2xl border border-border/60 bg-card/40 p-5 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">
            Tutar (TL)
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value.replace(/[^\d]/g, ''))}
            className="w-full rounded-md border border-border/60 bg-background/40 px-3 py-2 text-lg font-mono tabular-nums focus:border-amber-500 focus:outline-none"
            placeholder="10000"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {POPULAR_AMOUNTS.map((a) => (
              <button
                key={a}
                onClick={() => setAmountInput(String(a))}
                className={cn(
                  'rounded-md border px-2 py-0.5 text-[11px] transition',
                  amount === a
                    ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                    : 'border-border/40 bg-muted/20 text-muted-foreground hover:border-border/80',
                )}
              >
                {a.toLocaleString('tr-TR')} TL
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">
            Fon kodu (opsiyonel)
          </label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={fundCode || fundQuery}
              onChange={(e) => {
                const v = e.target.value.toUpperCase();
                setFundQuery(v);
                if (v.length <= 6 && /^[A-Z]{0,6}$/.test(v)) setFundCode(v);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Örn: GAU, OGA, OPK"
              className="w-full rounded-md border border-border/60 bg-background/40 py-2 pl-9 pr-3 text-sm font-mono focus:border-amber-500 focus:outline-none"
            />
          </div>
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-border/60 bg-card shadow-lg">
              {suggestions.map((s) => (
                <button
                  key={s.code}
                  onMouseDown={() => {
                    setFundCode(s.code);
                    setFundQuery('');
                    setShowSuggestions(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted/30"
                >
                  <span className="font-mono font-semibold">{s.code}</span>
                  <span className="flex-1 truncate text-muted-foreground">{s.name}</span>
                </button>
              ))}
            </div>
          )}
          <div className="mt-1 text-[10px] text-muted-foreground">
            Altın fonları: GAU, OGA, OPK, OGK, IAU, AFO vb. — fon kodu girersen kıyaslamaya eklenir
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor…
        </div>
      )}

      {data && (
        <>
          {/* Fon karşılaştırması (varsa) */}
          {data.fund && (
            <div className="overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-card/40 p-5">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 ring-1 ring-amber-500/40">
                  <Coins className="h-4 w-4 text-amber-300" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-amber-300/80">Fon karşılaştırması</div>
                  <div className="text-sm font-semibold">{data.fund.code} · {data.fund.name}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat
                  label="Fon payı (alabilirsin)"
                  value={fmtUnits(data.fund.unitsForAmount)}
                  unit="adet"
                />
                <Stat
                  label="Fonun 30 gün getirisi"
                  value={fmtPct(data.fund.return30d)}
                  tone={data.fund.return30d !== null ? (data.fund.return30d >= 0 ? 'up' : 'down') : undefined}
                />
                <Stat
                  label="Gram altın 30 gün"
                  value={fmtPct(data.fund.gramGold30dReturn)}
                  tone={
                    data.fund.gramGold30dReturn !== null
                      ? data.fund.gramGold30dReturn >= 0
                        ? 'up'
                        : 'down'
                      : undefined
                  }
                />
                <Stat
                  label="Reel altın getirisi"
                  value={fmtPct(data.fund.realGoldReturn)}
                  tone={
                    data.fund.realGoldReturn !== null
                      ? data.fund.realGoldReturn >= 0
                        ? 'up'
                        : 'down'
                      : undefined
                  }
                  hint="Fon getirisi − Gram altın getirisi. Pozitifse fon altını yendi."
                />
              </div>
              {data.fund.gramGold30dReturn === null && (
                <p className="mt-3 text-[10px] text-muted-foreground">
                  30 günlük gram altın geçmişi henüz yeterli değil — Altınkaynak verisi birikiyor.
                  Veri tamam olunca reel altın getirisi otomatik görünecek.
                </p>
              )}
            </div>
          )}

          {/* Fiziki altın tablo */}
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
            <div className="border-b border-border/50 bg-muted/10 px-5 py-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {data.amountTl.toLocaleString('tr-TR')} TL ile fiziki altın
              </div>
              <div className="text-[10px] text-muted-foreground">
                Satış fiyatı üzerinden hesaplandı — bir ürünü SATIN alırken ödediğin tutar
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/10 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Ürün</th>
                  <th className="px-4 py-2 text-right">Satış (TL)</th>
                  <th className="px-4 py-2 text-right">Alabilirsin</th>
                  <th className="px-4 py-2 text-right">Spread</th>
                  <th className="px-4 py-2 text-right">Değişim</th>
                </tr>
              </thead>
              <tbody>
                {data.physical.map((p) => (
                  <tr key={p.code} className="border-t border-border/40 hover:bg-muted/10">
                    <td className="px-4 py-2">
                      <div className="text-sm font-semibold">{p.name ?? p.code}</div>
                      {p.description && (
                        <div className="truncate text-[10px] text-muted-foreground" title={p.description}>
                          {p.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs tabular-nums">
                      {fmtTl(p.sell)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="font-mono text-sm font-semibold tabular-nums">
                        {fmtUnits(p.unitsForAmount)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {p.code === 'GA' || p.code === 'GAT' || p.code === 'AG_T'
                          ? 'gram'
                          : p.code === 'XAUUSD'
                            ? 'ons'
                            : 'adet'}
                      </div>
                    </td>
                    <td
                      className={cn(
                        'px-4 py-2 text-right font-mono text-xs tabular-nums',
                        p.spreadPct !== null && p.spreadPct > 5 && 'text-rose-300',
                        p.spreadPct !== null && p.spreadPct <= 2 && 'text-emerald-300',
                        p.spreadPct !== null && p.spreadPct > 2 && p.spreadPct <= 5 && 'text-amber-300',
                      )}
                    >
                      {p.spreadPct !== null ? `%${p.spreadPct.toFixed(2)}` : '—'}
                    </td>
                    <td
                      className={cn(
                        'px-4 py-2 text-right font-mono text-xs tabular-nums',
                        p.changePct !== null && p.changePct >= 0.01 && 'text-emerald-300',
                        p.changePct !== null && p.changePct <= -0.01 && 'text-rose-300',
                        (p.changePct === null || Math.abs(p.changePct) < 0.01) && 'text-muted-foreground',
                      )}
                    >
                      <span className="inline-flex items-center justify-end gap-0.5">
                        {p.changePct !== null && p.changePct >= 0.01 && <TrendingUp className="h-3 w-3" />}
                        {p.changePct !== null && p.changePct <= -0.01 && <TrendingDown className="h-3 w-3" />}
                        {fmtPct(p.changePct)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-border/40 bg-muted/10 p-4 text-[11px] leading-relaxed text-muted-foreground">
            <p>
              <strong className="text-muted-foreground/90">Nasıl okunur?</strong>{' '}
              <strong>Spread</strong> = alış-satış farkı yüzdesi. Fiziki altını alıp aynı gün satarsan
              bu yüzdeyi kaybedersin. <strong>Çeyrek altın spread'i genelde %5-10</strong> (yüksek);{' '}
              <strong>gram altın toptan %1-2</strong> (düşük). Altın fonu işlem ücretini yönetim
              ücreti + spread olarak yönetim içinde öder — TEFAS'ta alım-satım anında spread
              ödemezsin ama yıllık yönetim ücreti (%1-2) vardır.
            </p>
            <p className="mt-2">
              <strong className="text-muted-foreground/90">Reel altın getirisi</strong>: fon payının
              değeri TL'de artarken aynı dönemde gram altın da artar. Fon altını yenebilmesi için
              gram altın getirisini aşması gerekir. Negatif çıkarsa altın daha karlı.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  tone,
  hint,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: 'up' | 'down';
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-background/30 p-3" title={hint}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={cn(
          'mt-1 font-mono text-xl tabular-nums',
          tone === 'up' && 'text-emerald-300',
          tone === 'down' && 'text-rose-300',
        )}
      >
        {value}
        {unit && <span className="ml-1 text-xs text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}
