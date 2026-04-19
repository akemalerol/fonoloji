import { ArrowUpRight, Facebook, Instagram, Mail } from 'lucide-react';
import Link from 'next/link';
import { StreakBadge } from './streak-badge';

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const SECTIONS = [
  {
    title: 'Veri',
    items: [
      { href: '/fonlar', label: 'Fonlar' },
      { href: '/fonlar/yeni', label: 'Yeni listelenenler' },
      { href: '/arsiv/fonlar', label: 'Kapanmış fonlar' },
      { href: '/kategoriler', label: 'Kategoriler' },
      { href: '/haftalik', label: 'Haftalık Raporlar' },
      { href: '/ekonomi', label: 'TÜFE / Ekonomi' },
    ],
  },
  {
    title: 'Keşfet',
    items: [
      { href: '/kesifler', label: 'Keşifler' },
      { href: '/kesifler/risk-getiri', label: 'Risk-Getiri' },
      { href: '/kesifler/korelasyon', label: 'Korelasyon' },
      { href: '/kesifler/isi-haritasi-varlik', label: 'Varlık ısı haritası' },
      { href: '/ekonomi/kap-mansetleri', label: 'KAP manşetleri' },
      { href: '/en-iyi-fonlar/2026', label: 'Yılın en iyileri' },
    ],
  },
  {
    title: 'Araçlar',
    items: [
      { href: '/arac', label: 'Tüm araçlar' },
      { href: '/arac/portfoy-analiz', label: 'Portföy X-Ray' },
      { href: '/arac/fon-dna', label: 'Fon DNA' },
      { href: '/arac/dca-hesabi', label: 'DCA hesabı' },
      { href: '/arac/geri-test', label: 'Geri-test' },
      { href: '/hesapla', label: 'Yatırım Hesaplayıcı' },
    ],
  },
  {
    title: 'Referans',
    items: [
      { href: '/sozluk', label: 'Finansal Sözlük' },
      { href: '/yonetici', label: 'Yönetim Şirketleri' },
      { href: '/yonetici-karsilastir', label: 'Şirket Karşılaştır' },
      { href: '/api-docs', label: 'API Dokümanı' },
      { href: '/iletisim', label: 'İletişim' },
      { href: '/hakkinda', label: 'Hakkında' },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/60 bg-gradient-to-b from-transparent to-card/30">
      <div className="container py-14">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-6">
          <div className="col-span-2">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="relative h-8 w-8 overflow-hidden rounded-full border border-border bg-gradient-to-br from-brand-500 via-brand-400 to-verdigris-400">
                <div className="absolute inset-[1.5px] rounded-full bg-background" />
                <span className="absolute inset-0 flex items-center justify-center serif text-base italic text-foreground">
                  f
                </span>
              </div>
              <span className="serif text-xl leading-none tracking-tight">Fonoloji</span>
            </Link>
            <p className="mt-4 max-w-sm text-xs leading-relaxed text-muted-foreground">
              TEFAS'ın halka açık verisini okunur analizlere dönüştürür. Yatırım tavsiyesi değildir;
              tüm rakamlar bilgilendirme amaçlıdır.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <a
                href="https://x.com/fonoloji_"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <XIcon className="h-3.5 w-3.5" /> @fonoloji_
                <ArrowUpRight className="h-3 w-3" />
              </a>
              <a
                href="https://instagram.com/fonoloji_"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <Instagram className="h-3.5 w-3.5" /> @fonoloji_
                <ArrowUpRight className="h-3 w-3" />
              </a>
              <a
                href="https://fb.com/fonoloji"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <Facebook className="h-3.5 w-3.5" /> fb.com/fonoloji
                <ArrowUpRight className="h-3 w-3" />
              </a>
              <a
                href="mailto:hello@fonoloji.com"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <Mail className="h-3.5 w-3.5" /> hello@fonoloji.com
                <ArrowUpRight className="h-3 w-3" />
              </a>
            </div>
          </div>

          {SECTIONS.map((section) => (
            <div key={section.title}>
              <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {section.title}
              </div>
              <ul className="space-y-2">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-xs text-muted-foreground/90 transition-colors hover:text-foreground"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-border/60 pt-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span>
              © {new Date().getFullYear()} Fonoloji · Kaynak: tefas.gov.tr (public) · Tüm rakamlar bilgilendirme amaçlıdır.
            </span>
            <StreakBadge />
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <a href="https://x.com/fonoloji_" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
              <XIcon className="h-3 w-3" /> @fonoloji_
            </a>
            <span className="text-muted-foreground/40">·</span>
            <a href="https://instagram.com/fonoloji_" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
              <Instagram className="h-3 w-3" /> @fonoloji_
            </a>
            <span className="text-muted-foreground/40">·</span>
            <a href="https://fb.com/fonoloji" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
              <Facebook className="h-3 w-3" /> fonoloji
            </a>
            <span className="text-muted-foreground/40">·</span>
            <Link href="/iletisim" className="hover:text-foreground">İletişim</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
