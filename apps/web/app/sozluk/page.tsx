import { Book } from 'lucide-react';
import { EXPLAINERS } from '@/components/fx/explainer';

export const metadata = {
  title: 'Finansal terimler sözlüğü — Fonoloji',
  description:
    'Sharpe, Sortino, drawdown, volatilite, reel getiri, AUM, korelasyon… TEFAS fon yatırımcısının bilmesi gereken tüm finansal terimler örneklerle.',
};

const TITLE_OVERRIDES: Record<string, string> = {
  drawdown: 'Drawdown — Max Düşüş',
  aum: 'AUM — Fon Büyüklüğü',
  sharpe: 'Sharpe Oranı',
  sortino: 'Sortino Oranı',
  volatility: 'Volatilite',
  real_return: 'Reel Getiri',
  correlation: 'Korelasyon',
  beta: 'Beta Katsayısı',
  calmar: 'Calmar Oranı',
  investor_count: 'Yatırımcı Sayısı',
};

export default function SozlukPage() {
  const entries = Object.entries(EXPLAINERS).sort(([a], [b]) => a.localeCompare(b, 'tr'));

  return (
    <div className="container py-10 md:py-14">
      <div className="mb-10 border-b border-border/50 pb-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <Book className="h-3 w-3 text-brand-400" /> Referans
        </div>
        <h1 className="display mt-2 text-5xl leading-none md:text-6xl">
          Finansal <span className="display-italic gradient-text">terimler</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          TEFAS fonlarını değerlendirmek için bilmen gereken temel kavramlar —
          Sharpe, drawdown, reel getiri, volatilite, korelasyon. Her biri
          sade dille + örneklerle.
        </p>
      </div>

      <nav className="mb-8 flex flex-wrap gap-2">
        {entries.map(([key]) => (
          <a
            key={key}
            href={`#${key}`}
            className="rounded-full border border-border/50 bg-background/40 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:border-brand-500/40 hover:text-foreground"
          >
            {TITLE_OVERRIDES[key] ?? key}
          </a>
        ))}
      </nav>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {entries.map(([key, data]) => (
          <article
            key={key}
            id={key}
            className="panel scroll-mt-20 p-6"
          >
            <h2 className="serif text-2xl leading-tight">{data.title}</h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
              {data.body}
            </div>
          </article>
        ))}
      </div>

      <p className="mt-16 text-center text-xs text-muted-foreground">
        Fon sayfalarında ilgili metriklerin yanındaki <span className="font-mono">?</span> ikonuyla da erişilir
      </p>
    </div>
  );
}
