import { ArrowRight, Calculator, Dna, History, Radar } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Araçlar — Fonoloji',
  description: 'Portföy X-Ray, Fon DNA, DCA hesabı. TEFAS verilerini interaktif araçlarla analiz et.',
};

const TOOLS = [
  {
    href: '/arac/portfoy-analiz',
    icon: Radar,
    title: 'Portföy X-Ray',
    desc: 'Birden fazla fonun KAP portföylerini birleştirip asıl maruz kaldığın hisseleri bulur. Çeşitlenme yanılsamasını kırar.',
    accent: 'brand',
  },
  {
    href: '/arac/fon-dna',
    icon: Dna,
    title: 'Fon DNA',
    desc: 'İki fonun örtüşen ve farklı holdings\'lerini karşılaştırır. "Aynı fon, farklı paketleme" tuzağını açığa çıkarır.',
    accent: 'verdigris',
  },
  {
    href: '/arac/dca-hesabi',
    icon: Calculator,
    title: 'DCA hesabı',
    desc: '"Aylık düzenli yatırsaydım" — geçmişe dönüp dollar-cost averaging simülasyonu. Tek seferde yatırımla karşılaştırma dahil.',
    accent: 'amber',
  },
  {
    href: '/arac/geri-test',
    icon: History,
    title: 'Portföy geri-testi',
    desc: '2-10 fondan oluşan bir portföyü geçmişe karşı test et. Yıllık getiri, Sharpe, max drawdown, rebalancing etkisi.',
    accent: 'sky',
  },
  {
    href: '/hesapla',
    icon: Calculator,
    title: 'Yatırım Hesaplayıcı',
    desc: 'Seçtiğin fonla geçmiş yatırımın bugünkü değerini hesapla. Tek seferlik yatırım + getiri analizi.',
    accent: 'emerald',
  },
] as const;

export default function AracIndexPage() {
  return (
    <div className="container py-10 md:py-14">
      <div className="mb-10 border-b border-border/50 pb-6">
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Araçlar</div>
        <h1 className="display mt-2 text-5xl leading-none md:text-6xl">
          Fon <span className="display-italic gradient-text">analiz araçları</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          KAP portföy verisi + geçmiş fiyatlar üzerinde çalışan interaktif araçlar.
          Hiç giriş gerekmez. Yatırım tavsiyesi değildir.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className="panel group flex items-start gap-4 p-6 transition hover:border-brand-500/40"
            >
              <div className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-${t.accent}-500/10 text-${t.accent}-400 ring-1 ring-${t.accent}-400/20`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="serif text-xl leading-snug group-hover:text-brand-200">
                  {t.title}
                </h2>
                <p className="mt-1.5 text-sm text-muted-foreground">{t.desc}</p>
                <div className="mt-3 inline-flex items-center gap-1 text-xs text-brand-400 group-hover:text-brand-300">
                  Aç <ArrowRight className="h-3 w-3" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
