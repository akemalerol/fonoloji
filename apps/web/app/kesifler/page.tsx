import { ArrowRight, Building2, Calculator, Compass, Flame, LineChart, Network, Percent, Scale, Shield, Waves } from 'lucide-react';
import Link from 'next/link';
import { AdSlot } from '@/components/ads/ad-slot';
import { BentoCard, BentoGrid } from '@/components/fx/bento';
import { DotBackground } from '@/components/fx/grid-background';

export const metadata = { title: 'Keşifler' };

const CARDS = [
  {
    href: '/kesifler/risk-getiri',
    title: 'Risk-Getiri Haritası',
    desc: 'Volatilite-yıllık getiri scatter plot. Kategoriye göre renklendirilmiş.',
    icon: Scale,
    colSpan: 3 as const,
    gradient: 'from-brand-500/10 to-verdigris-500/5',
  },
  {
    href: '/kesifler/korelasyon',
    title: 'Korelasyon Matrisi',
    desc: 'En büyük 15 fon arası günlük getiri korelasyonu. Diversification için elzem.',
    icon: Network,
    colSpan: 3 as const,
    gradient: 'from-amber-500/10 to-rose-500/5',
  },
  {
    href: '/kesifler/isi-haritasi',
    title: 'Volatilite Isı Haritası',
    desc: 'Her fonun günlük getirilerini takvim hücreleri olarak görselleştir.',
    icon: Flame,
    colSpan: 2 as const,
    gradient: 'from-loss/10 to-amber-500/5',
  },
  {
    href: '/kesifler/para-akisi',
    title: 'Para Akışı',
    desc: 'Son 1 ayda fon büyüklüğü en çok artan ve azalan fonlar.',
    icon: Waves,
    colSpan: 2 as const,
    gradient: 'from-verdigris-500/10 to-brand-500/5',
  },
  {
    href: '/kesifler/trend',
    title: 'Trend Sinyalleri',
    desc: 'MA 30/200 kesişimlerine göre yükselen ve düşüş trendindeki fonlar.',
    icon: LineChart,
    colSpan: 2 as const,
    gradient: 'from-gain/10 to-brand-500/5',
  },
  {
    href: '/kesifler/risk-skoru',
    title: 'Risk Skoru Dağılımı',
    desc: 'TEFAS\'ın 1-7 risk skorlarına göre fonların dağılımı + her seviyenin liderleri.',
    icon: Shield,
    colSpan: 3 as const,
    gradient: 'from-rose-500/10 via-amber-500/5 to-emerald-500/10',
  },
  {
    href: '/kesifler/reel-getiri',
    title: 'Reel Getiri',
    desc: 'TÜFE enflasyonundan arındırılmış getiri — nominal değil, gerçek.',
    icon: Compass,
    colSpan: 3 as const,
    gradient: 'from-brand-500/15 via-verdigris-500/5 to-amber-500/10',
  },
  {
    href: '/kesifler/isi-haritasi-varlik',
    title: 'Varlık Isı Haritası',
    desc: 'Her kategori ortalama ne tutuyor? Hisse, tahvil, altın, nakit — kategori × varlık tipi.',
    icon: Compass,
    colSpan: 3 as const,
    gradient: 'from-verdigris-500/15 to-brand-500/5',
  },
  {
    href: '/hesapla',
    title: 'Yatırım Hesaplayıcı',
    desc: 'X TL\'yi Y tarihinde yatırsaydın bugün ne kadardı? Geriye dönük gerçek hesap.',
    icon: Calculator,
    colSpan: 3 as const,
    gradient: 'from-amber-500/10 via-emerald-500/5 to-verdigris-500/10',
  },
  {
    href: '/yonetici',
    title: 'Yönetim Şirketleri',
    desc: 'Tüm portföy yönetim şirketlerinin büyüklük, ortalama getiri ve Sharpe karnesi.',
    icon: Building2,
    colSpan: 3 as const,
    gradient: 'from-verdigris-500/10 to-brand-500/5',
  },
  {
    href: '/ekonomi',
    title: 'Ekonomi & TÜFE',
    desc: 'Canlı enflasyon, TÜİK açıklama takvimi, son 24 ayın yıllık/aylık değişimi.',
    icon: Percent,
    colSpan: 3 as const,
    gradient: 'from-amber-500/15 via-rose-500/5 to-brand-500/10',
  },
];

export default function DiscoverPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-border/50">
        <DotBackground />
        <div className="container relative py-24 md:py-32">
          <div className="max-w-3xl">
            <div className="mb-6 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Keşifler
            </div>
            <h1 className="display text-balance text-5xl leading-[1.02] md:text-7xl">
              Veriden <span className="display-italic text-brand-400">içgörü</span>
              <br />
              çıkarmanın yolları
            </h1>
            <p className="mt-6 max-w-xl text-muted-foreground">
              Raw TEFAS verisi yetmez. Fonoloji bu veriyi risk, korelasyon, akış ve trend
              analizleriyle işler — karşına okunur infografikler çıkar.
            </p>
          </div>
        </div>
      </section>

      <div className="container pt-8"><AdSlot placement="kesif-top" className="mx-auto max-w-5xl" /></div>

      <section className="container py-12">
        <BentoGrid>
          {CARDS.map((c) => (
            <BentoCard key={c.href} colSpan={c.colSpan}>
              <Link href={c.href} className="flex h-full flex-col">
                <div className={`absolute inset-0 bg-gradient-to-br ${c.gradient} opacity-80`} />
                <div className="relative flex h-full flex-col">
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-background/70 ring-1 ring-border">
                    <c.icon className="h-5 w-5 text-brand-400" />
                  </div>
                  <h3 className="serif text-2xl leading-tight md:text-3xl">{c.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{c.desc}</p>
                  <div className="mt-auto flex items-center gap-1 pt-6 text-xs uppercase tracking-wider text-brand-400 transition-transform group-hover:translate-x-1">
                    Aç <ArrowRight className="h-3 w-3" />
                  </div>
                </div>
              </Link>
            </BentoCard>
          ))}
        </BentoGrid>
      </section>
    </>
  );
}
