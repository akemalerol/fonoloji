import { Book } from 'lucide-react';
import Link from 'next/link';
import { GLOSSARY, GLOSSARY_CATEGORIES, type GlossaryEntry } from '@/lib/glossary';

export const metadata = {
  title: 'Finansal terimler sözlüğü — Fonoloji',
  description:
    'TEFAS fon yatırımcısının bilmesi gereken 40+ finansal terim: Sharpe, Sortino, drawdown, volatilite, beta, alfa, korelasyon, DCA, KAP, valör, stopaj, reel getiri ve dahası. Sade Türkçe, örneklerle.',
};

function renderBody(paragraphs: string[]): React.ReactNode {
  return paragraphs.map((p, i) => (
    <p key={i} dangerouslySetInnerHTML={{
      __html: p
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br/>'),
    }} />
  ));
}

function grouped() {
  const out: Record<GlossaryEntry['category'], GlossaryEntry[]> = {
    getiri: [], risk: [], 'risk-ayarli': [], portfoy: [], 'fon-turu': [], 'tefas-kap': [], piyasa: [], maliyet: [],
  };
  for (const e of GLOSSARY) out[e.category].push(e);
  return out;
}

export default function SozlukPage() {
  const sections = grouped();

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
          TEFAS fonlarını değerlendirirken karşına çıkacak <strong className="text-foreground">{GLOSSARY.length} terim</strong> — kategorilere ayrılmış,
          her biri sade Türkçe, örnekli. Fon sayfalarındaki <span className="font-mono">?</span> tooltip'lerine
          buradan derin açıklamaya ulaşılır.
        </p>
      </div>

      {/* Kategori navigasyonu */}
      <nav className="sticky top-16 z-20 -mx-4 mb-8 border-b border-border/40 bg-background/90 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap gap-2">
          {GLOSSARY_CATEGORIES.map((c) => {
            const count = sections[c.key]?.length ?? 0;
            return (
              <a
                key={c.key}
                href={`#${c.key}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background/40 px-3 py-1 text-[11px] text-muted-foreground transition hover:border-brand-500/40 hover:text-foreground"
              >
                {c.label}
                <span className="font-mono tabular-nums opacity-60">{count}</span>
              </a>
            );
          })}
        </div>
      </nav>

      {/* İçerik — kategoriye göre bölümlenmiş */}
      {GLOSSARY_CATEGORIES.map((cat) => {
        const entries = sections[cat.key];
        if (!entries || entries.length === 0) return null;
        return (
          <section key={cat.key} id={cat.key} className="mb-14 scroll-mt-28">
            <h2 className="serif display-italic mb-5 text-3xl text-brand-300">
              {cat.label}
            </h2>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {entries.map((e) => (
                <article key={e.slug} id={e.slug} className="panel scroll-mt-28 p-6">
                  <h3 className="serif text-xl leading-tight">{e.title}</h3>
                  <p className="mt-2 text-sm italic text-brand-300/80">{e.short}</p>
                  <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
                    {renderBody(e.body)}
                  </div>
                  {e.example && (
                    <div className="mt-4 rounded-lg border border-verdigris-500/25 bg-verdigris-500/5 p-3 text-xs leading-relaxed">
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-verdigris-400">Örnek</div>
                      <div
                        className="text-foreground/85"
                        dangerouslySetInnerHTML={{
                          __html: e.example.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>'),
                        }}
                      />
                    </div>
                  )}
                  {e.related && e.related.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border/40 pt-3">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                        İlgili:
                      </span>
                      {e.related.map((r) => {
                        const target = GLOSSARY.find((x) => x.slug === r);
                        if (!target) return null;
                        return (
                          <a
                            key={r}
                            href={`#${r}`}
                            className="rounded-full border border-border/50 bg-background/40 px-2 py-0.5 text-[10px] text-muted-foreground hover:border-brand-500/40 hover:text-foreground"
                          >
                            {target.title}
                          </a>
                        );
                      })}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        );
      })}

      <p className="mt-16 border-t border-border/40 pt-6 text-center text-xs text-muted-foreground">
        Eksik terim var mı? <Link href="/iletisim" className="text-brand-400 hover:text-brand-300">bize yaz</Link> — ekleriz.
      </p>
    </div>
  );
}
