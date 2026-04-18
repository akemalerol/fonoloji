import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { formatCompact, formatPercent, formatPrice } from '@/lib/utils';
import { PrintButton } from './print-button';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: { kod: string } }) {
  const code = params.kod.toUpperCase();
  return {
    title: `${code} Fact Sheet`,
    description: `${code} fonu için yatırımcı bilgi özeti — Fonoloji`,
    robots: { index: false, follow: false },
  };
}

function fmtShort(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(digits)}%`;
}

function fmtNum(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return v.toFixed(digits);
}

export default async function FactSheetPage({ params }: { params: { kod: string } }) {
  const code = params.kod.toUpperCase();
  let detail;
  try {
    detail = await api.getFund(code);
  } catch {
    notFound();
  }
  if (!detail) notFound();
  const { fund, portfolio } = detail;
  const percentile = await api.percentile(code).catch(() => null);

  return (
    <div className="print-sheet mx-auto max-w-3xl px-8 py-10 print:max-w-full print:p-0">
      <PrintButton fundCode={code} fundName={fund.name} />

      {/* Header */}
      <header className="mb-8 border-b border-border/60 pb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted-foreground print:text-black/60">
              Fon Özet Raporu · {new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </div>
            <h1 className="mt-2 text-4xl font-semibold leading-tight tracking-tight print:text-black">
              {fund.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground print:text-black/70">
              <span className="font-mono text-base font-bold text-foreground print:text-black">{fund.code}</span>
              <span>·</span>
              <span>{fund.category ?? '—'}</span>
              {fund.management_company && (
                <>
                  <span>·</span>
                  <span>{fund.management_company}</span>
                </>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Güncel Fiyat</div>
            <div className="mt-1 font-mono text-2xl font-semibold tabular-nums">
              ₺{formatPrice(fund.current_price, 4)}
            </div>
            {fund.return_1d !== null && fund.return_1d !== undefined && (
              <div className={`font-mono text-xs tabular-nums ${fund.return_1d >= 0 ? 'text-emerald-600' : 'text-rose-600'} print:text-black`}>
                {fmtShort(fund.return_1d)} (1G)
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Key stats grid */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Ana Ölçütler
        </h2>
        <div className="grid grid-cols-3 gap-4 print:gap-2">
          <Stat label="Fon büyüklüğü" value={formatCompact(fund.aum)} />
          <Stat label="Yatırımcı" value={formatCompact(fund.investor_count)} />
          <Stat label="Risk skoru" value={fund.risk_score !== null && fund.risk_score !== undefined ? `${fund.risk_score} / 7` : '—'} />
          <Stat label="1 Aylık" value={fmtShort(fund.return_1m)} color={fund.return_1m ?? 0} />
          <Stat label="3 Aylık" value={fmtShort(fund.return_3m)} color={fund.return_3m ?? 0} />
          <Stat label="1 Yıllık" value={fmtShort(fund.return_1y)} color={fund.return_1y ?? 0} />
          <Stat label="Yıl Başından" value={fmtShort(fund.return_ytd)} color={fund.return_ytd ?? 0} />
          <Stat label="Reel 1 Yıl" value={fmtShort(fund.real_return_1y)} color={fund.real_return_1y ?? 0} />
          <Stat label="Sharpe (90g)" value={fmtNum(fund.sharpe_90)} />
          <Stat label="Sortino (90g)" value={fmtNum(fund.sortino_90)} />
          <Stat label="Volatilite (90g)" value={fmtShort(fund.volatility_90, 1)} />
          <Stat label="Max Drawdown (1Y)" value={fmtShort(fund.max_drawdown_1y, 1)} />
        </div>
      </section>

      {/* Percentile */}
      {percentile && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Kategorisi İçinde
          </h2>
          <p className="mb-3 text-sm text-muted-foreground print:text-black/70">
            {percentile.category} · {percentile.categorySize} fon
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[
              ['sharpe_90', 'Sharpe'],
              ['return_1y', '1Y Getiri'],
              ['real_return_1y', 'Reel 1Y'],
              ['max_drawdown_1y', 'Max DD'],
              ['volatility_90', 'Volatilite'],
              ['aum', 'Büyüklük'],
            ].map(([k, label]) => {
              const b = percentile.metrics[k as string];
              if (!b) return null;
              return (
                <div key={k as string} className="rounded-lg border border-border/50 p-3 print:border-black/30">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {label}
                  </div>
                  <div className="mt-1 font-mono text-lg font-semibold tabular-nums">
                    %{b.percentile} <span className="text-xs text-muted-foreground">({b.rank}/{b.total})</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Portfolio */}
      {portfolio && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Portföy Dağılımı
          </h2>
          <div className="space-y-2">
            {(
              [
                ['stock', 'Hisse Senedi', '#10b981'],
                ['government_bond', 'Devlet Tahvili', '#0ea5e9'],
                ['treasury_bill', 'Hazine Bonosu', '#3b82f6'],
                ['corporate_bond', 'Özel Sektör Tahvili', '#8b5cf6'],
                ['eurobond', 'Eurobond', '#d946ef'],
                ['cash', 'Nakit/Repo', '#f59e0b'],
                ['gold', 'Altın', '#eab308'],
                ['other', 'Diğer', '#71717a'],
              ] as const
            )
              .map(([k, lbl, color]) => ({
                label: lbl,
                value: (portfolio as Record<string, number>)[k] ?? 0,
                color,
              }))
              .filter((x) => x.value > 0.01)
              .sort((a, b) => b.value - a.value)
              .map((row) => (
                <div key={row.label} className="flex items-center gap-3">
                  <div className="w-44 shrink-0 text-xs text-foreground/90 print:text-black">{row.label}</div>
                  <div className="flex-1">
                    <div className="h-5 overflow-hidden rounded-sm bg-muted/40 print:bg-black/10">
                      <div className="h-full" style={{ width: `${Math.min(100, row.value)}%`, backgroundColor: row.color }} />
                    </div>
                  </div>
                  <div className="w-16 shrink-0 text-right font-mono text-sm tabular-nums">
                    %{row.value.toFixed(1)}
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Trading info */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          İşlem Bilgileri
        </h2>
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          {fund.isin && <KV k="ISIN" v={fund.isin} />}
          {fund.risk_score !== null && fund.risk_score !== undefined && <KV k="Risk skoru" v={`${fund.risk_score}/7`} />}
          {fund.trading_start && fund.trading_end && <KV k="İşlem saati" v={`${fund.trading_start} – ${fund.trading_end}`} />}
          {fund.buy_valor !== undefined && fund.buy_valor !== null && <KV k="Alış valörü" v={`T+${fund.buy_valor}`} />}
          {fund.sell_valor !== undefined && fund.sell_valor !== null && <KV k="Satış valörü" v={`T+${fund.sell_valor}`} />}
          {fund.trading_status && <KV k="Durum" v={fund.trading_status} />}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-10 border-t border-border/60 pt-4 text-[10px] leading-relaxed text-muted-foreground print:text-black/50">
        <p>
          Kaynak: TEFAS, KAP · Veriler günlük güncellenir · fonoloji.com
        </p>
        <p className="mt-1">
          <strong>Yatırım tavsiyesi değildir.</strong> Geçmiş performans gelecek performansın garantisi değildir.
          Yatırım kararlarınızı kendi risk iştahınıza ve araştırmanıza göre verin.
        </p>
        <p className="mt-2 font-mono">fonoloji.com/fon/{fund.code}</p>
      </footer>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: number }) {
  const cls = color === undefined ? '' : color > 0 ? 'text-emerald-600 print:text-black' : color < 0 ? 'text-rose-600 print:text-black' : '';
  return (
    <div className="rounded-lg border border-border/50 p-3 print:border-black/30">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-base font-semibold tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="mt-0.5 font-mono text-sm">{v}</div>
    </div>
  );
}
