import { Sparkles, TrendingDown, TrendingUp, Waves } from 'lucide-react';
import Link from 'next/link';
import { ChangePill } from '@/components/fx/change-pill';
import { api } from '@/lib/api';
import { formatCompact, formatDate, formatNumber, formatPercent } from '@/lib/utils';

export const revalidate = 300;
export const metadata = { title: 'Haftalık Bülten' };

export default async function WeeklyPage() {
  const [movers, flow, categories, topAum, digest] = await Promise.all([
    api.movers('1w', 10),
    api.flow('1w', 5),
    api.categories(),
    api.listFunds({ sort: 'aum', limit: 5 }),
    api.marketDigest('week').catch(() => ({ period: 'week', summary: null as string | null, cached: false, topGainers: [], topLosers: [] })),
  ]);

  const catSorted = [...categories.items].sort((a, b) => (b.avg_return ?? 0) - (a.avg_return ?? 0));
  const weekEnding = new Date();

  const narrative = buildNarrative({
    topGainer: movers.gainers[0],
    topLoser: movers.losers[0],
    bestCategory: catSorted[0],
    worstCategory: catSorted[catSorted.length - 1],
    topInflow: flow.inflow[0],
    topOutflow: flow.outflow[0],
  });

  return (
    <div className="container py-10">
      <div className="mb-10 border-b border-border/50 pb-8">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <Sparkles className="h-3 w-3 text-brand-400" />
          bülten · otomatik derlenmiştir
        </div>
        <h1 className="display mt-4 text-balance text-5xl leading-[1.02] md:text-7xl">
          Haftalık <span className="display-italic text-brand-400">özet</span>
        </h1>
        <div className="mt-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Hafta sonu {formatDate(weekEnding.toISOString().slice(0, 10))}
        </div>
      </div>

      {digest.summary && (
        <div className="panel-highlight mb-8 p-8 md:p-10">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-400" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Haftanın özeti · Fonoloji AI
            </span>
          </div>
          <div className="prose prose-invert max-w-none">
            {digest.summary.split(/\n\n+/).map((p, i) => (
              <p key={i} className="mb-3 text-[15px] leading-relaxed text-foreground/90 last:mb-0">
                {p}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="panel mb-8 p-6 md:p-8">
        <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Rakamların dili
        </div>
        <div className="prose prose-invert max-w-none text-base leading-relaxed">
          {narrative.map((paragraph, i) => (
            <p key={i} className="mb-4 text-muted-foreground last:mb-0">
              {paragraph}
            </p>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Column title="Haftanın yükselenleri" icon={<TrendingUp className="h-4 w-4 text-gain" />}>
          {movers.gainers.slice(0, 8).map((m) => (
            <MoverLine key={m.code} {...m} />
          ))}
        </Column>
        <Column title="Haftanın düşenleri" icon={<TrendingDown className="h-4 w-4 text-loss" />}>
          {movers.losers.slice(0, 8).map((m) => (
            <MoverLine key={m.code} {...m} />
          ))}
        </Column>
        <Column title="Para akışı" icon={<Waves className="h-4 w-4 text-brand-400" />}>
          <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Giriş liderleri</div>
          {flow.inflow.slice(0, 4).map((f) => (
            <MoverLine key={f.code} code={f.code} name={f.name} change={f.flow} aum={f.aum} />
          ))}
          <div className="mb-2 mt-4 text-xs uppercase tracking-wider text-muted-foreground">Çıkış liderleri</div>
          {flow.outflow.slice(0, 4).map((f) => (
            <MoverLine key={f.code} code={f.code} name={f.name} change={f.flow} aum={f.aum} />
          ))}
        </Column>
        <Column title="Kategori performansı" icon={<Sparkles className="h-4 w-4 text-amber-400" />}>
          {catSorted.slice(0, 8).map((c) => (
            <div key={c.category} className="flex items-center justify-between py-2 text-sm">
              <Link href={`/kategori/${encodeURIComponent(c.category)}`} className="truncate">
                {c.category}
              </Link>
              <ChangePill value={c.avg_return ?? null} />
            </div>
          ))}
        </Column>
      </div>
    </div>
  );
}

function Column({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="panel p-5">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <div className="divide-y divide-border/40">{children}</div>
    </div>
  );
}

function MoverLine({ code, name, change, aum }: { code: string; name: string; change: number; aum?: number }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Link href={`/fon/${code}`} className="inline-flex h-7 w-12 items-center justify-center rounded bg-secondary/70 font-mono text-[11px] font-bold">
        {code}
      </Link>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{name}</div>
        {aum !== undefined && <div className="truncate text-[11px] text-muted-foreground">Büyüklük {formatCompact(aum)}</div>}
      </div>
      <ChangePill value={change} className="text-sm" />
    </div>
  );
}

function buildNarrative(ctx: {
  topGainer?: { code: string; name: string; change: number };
  topLoser?: { code: string; name: string; change: number };
  bestCategory?: { category: string; avg_return: number };
  worstCategory?: { category: string; avg_return: number };
  topInflow?: { code: string; flow: number };
  topOutflow?: { code: string; flow: number };
}): string[] {
  const paragraphs: string[] = [];
  if (ctx.topGainer && ctx.topLoser) {
    paragraphs.push(
      `Bu hafta pazarın en büyük yükselişi ${ctx.topGainer.code} — ${ctx.topGainer.name} — oldu ve ` +
        `${formatPercent(ctx.topGainer.change)} kazandı. Diğer uçta ${ctx.topLoser.code} ` +
        `${formatPercent(ctx.topLoser.change)} ile haftanın en çok değer kaybeden fonu oldu.`,
    );
  }
  if (ctx.bestCategory && ctx.worstCategory) {
    paragraphs.push(
      `Kategori seviyesinde ${ctx.bestCategory.category} ortalama ${formatPercent(ctx.bestCategory.avg_return)} ile öne çıktı. ` +
        `${ctx.worstCategory.category} ise ${formatPercent(ctx.worstCategory.avg_return)} getiri ortalamasıyla geri kaldı.`,
    );
  }
  if (ctx.topInflow && ctx.topOutflow) {
    paragraphs.push(
      `Fon büyüklüğü tarafında yatırımcılar ${ctx.topInflow.code} fonuna ${formatPercent(ctx.topInflow.flow)} oranında ` +
        `sermaye taşıdı. ${ctx.topOutflow.code} ise ${formatPercent(ctx.topOutflow.flow)} ile haftanın en büyük çıkışını yaşadı.`,
    );
  }
  paragraphs.push(
    'Tüm rakamlar Fonoloji\'nin kendi hesapladığı metriklerdir; TEFAS\'ın raw verisi üzerinden yüzdesel getiriler yeniden üretilmiştir.',
  );
  return paragraphs;
}
