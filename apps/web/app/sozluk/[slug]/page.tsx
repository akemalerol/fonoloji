import { ArrowLeft, Book } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GLOSSARY, GLOSSARY_CATEGORIES } from '@/lib/glossary';

interface PageProps {
  params: { slug: string };
}

export function generateStaticParams() {
  return GLOSSARY.map((e) => ({ slug: e.slug }));
}

export function generateMetadata({ params }: PageProps): Metadata {
  const e = GLOSSARY.find((x) => x.slug === params.slug);
  if (!e) return { title: 'Bulunamadı — Sözlük' };
  return {
    title: `${e.title} nedir? — Fonoloji Finansal Sözlük`,
    description: e.short,
    openGraph: {
      title: `${e.title} nedir?`,
      description: e.short,
      type: 'article',
    },
  };
}

function renderBody(paragraphs: string[]) {
  return paragraphs.map((p, i) => (
    <p
      key={i}
      className="mb-3 leading-relaxed text-muted-foreground"
      dangerouslySetInnerHTML={{
        __html: p
          .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-foreground">$1</strong>')
          .replace(/\n/g, '<br/>'),
      }}
    />
  ));
}

export default function TermPage({ params }: PageProps) {
  const e = GLOSSARY.find((x) => x.slug === params.slug);
  if (!e) notFound();

  const cat = GLOSSARY_CATEGORIES.find((c) => c.key === e.category);
  const related = (e.related ?? [])
    .map((slug) => GLOSSARY.find((g) => g.slug === slug))
    .filter((x): x is NonNullable<typeof x> => x !== undefined);

  // JSON-LD DefinedTerm schema — SEO için
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: e.title,
    description: e.short,
    inDefinedTermSet: {
      '@type': 'DefinedTermSet',
      name: 'Fonoloji Finansal Sözlük',
      url: 'https://fonoloji.com/sozluk',
    },
    termCode: e.slug,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="container py-10 md:py-14">
        <Link
          href="/sozluk"
          className="mb-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Sözlüğe dön
        </Link>

        <article className="mx-auto max-w-3xl">
          <div className="mb-6 border-b border-border/50 pb-6">
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <Book className="h-3 w-3 text-brand-400" />
              {cat?.label ?? 'Sözlük'}
            </div>
            <h1 className="display text-4xl leading-[1.05] md:text-6xl">{e.title}</h1>
            <p className="mt-4 text-lg leading-relaxed text-foreground/90">{e.short}</p>
          </div>

          <div className="prose prose-invert max-w-none">{renderBody(e.body)}</div>

          {e.example && (
            <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                Örnek
              </div>
              <p
                className="text-sm leading-relaxed text-amber-100/90"
                dangerouslySetInnerHTML={{
                  __html: e.example.replace(
                    /\*\*([^*]+)\*\*/g,
                    '<strong class="text-amber-200">$1</strong>',
                  ),
                }}
              />
            </div>
          )}

          {related.length > 0 && (
            <div className="mt-10 border-t border-border/50 pt-6">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                İlgili terimler
              </h3>
              <div className="grid gap-2 md:grid-cols-2">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/sozluk/${r.slug}`}
                    className="group block rounded-lg border border-border/40 bg-card/40 p-3 transition hover:border-brand-500/40"
                  >
                    <div className="font-semibold text-foreground group-hover:text-brand-200">
                      {r.title}
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                      {r.short}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </article>
      </div>
    </>
  );
}
