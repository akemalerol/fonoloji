import {
  Award, BarChart3, Bell, Compass, Eye, FileText, Flame,
  Moon, Newspaper, Radar, Sparkles, Star, TrendingUp, Users, Zap,
} from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Yenilikler — Fonoloji',
  description:
    'Fonoloji\u2019ye yeni eklenen özellikler — portföy analiz araçları, haftanın KAP manşetleri, yılın en iyi fonları, izleme listesi, finansal sözlük ve daha fazlası.',
};
export const revalidate = 3600;

interface Release {
  date: string;
  title: string;
  emoji: string;
  summary: string;
  items: Array<{
    icon: React.ReactNode;
    title: string;
    desc: string;
    url?: string;
    tag?: 'yeni' | 'beta' | 'geliştirildi';
  }>;
}

const RELEASES: Release[] = [
  {
    date: '18 Nisan 2026',
    title: 'Büyük Güncelleme — Analiz Araçları & İçerik',
    emoji: '🚀',
    summary:
      'Fonoloji\'yi artık sadece liste değil, tam bir analiz platformu olarak kullanabilirsin. Portföyünü x-ray cihazından geçir, iki fonun aslında ne kadar benzer olduğunu gör, geçmişe dönüp "düzenli yatırsaydım" testi yap. 45 terimlik sözlükten yılın şampiyon fonlarına kadar pek çok yeni şey var.',
    items: [
      {
        icon: <Radar className="h-4 w-4" />,
        title: 'Portföy X-Ray',
        desc: 'Birden fazla fonun ardındaki gerçek hisseleri tek ekranda gör. "Farklı fonlar aldım ama aynı hisseye 3 kez mi yatırmışım?" sorusunun cevabı.',
        url: '/arac/portfoy-analiz',
        tag: 'yeni',
      },
      {
        icon: <BarChart3 className="h-4 w-4" />,
        title: 'Fon DNA\'sı',
        desc: 'İki fonu karşılaştır — sadece getiriye değil, içlerinde ne var ne yok ona bak. %70+ örtüşme varsa aslında aynı fonu alıyorsun, sen farkında değilsin.',
        url: '/arac/fon-dna',
        tag: 'yeni',
      },
      {
        icon: <TrendingUp className="h-4 w-4" />,
        title: 'Düzenli Yatırım Simülatörü (DCA)',
        desc: '"Her ay 2.000 TL yatırsaydım bugün ne olurdu?" — geçmiş fiyatlara göre tam rakamla anlatıyor. Tek seferde yatırımla da karşılaştırıyor.',
        url: '/arac/dca-hesabi',
        tag: 'yeni',
      },
      {
        icon: <Zap className="h-4 w-4" />,
        title: 'Portföy Geri-Testi',
        desc: '2-10 fondan portföy kur, 1/3/5 yıl geriye test et. Kar/zarar, en kötü düşüş, yıllık ortalama — hepsi tek sayfada.',
        url: '/arac/geri-test',
        tag: 'yeni',
      },
      {
        icon: <Compass className="h-4 w-4" />,
        title: 'Varlık Isı Haritası',
        desc: 'Hangi fon kategorisi ne kadar hisse, tahvil, altın tutuyor? Renk yoğunluğuyla anında görülüyor.',
        url: '/kesifler/isi-haritasi-varlik',
        tag: 'yeni',
      },
      {
        icon: <FileText className="h-4 w-4" />,
        title: 'Finansal Sözlük',
        desc: 'Sharpe, drawdown, volatilite, KAP, valör, stopaj — 45 finansal terim, sade Türkçe, örneklerle. Kafa karıştıran terimleri açıklıyor.',
        url: '/sozluk',
        tag: 'yeni',
      },
      {
        icon: <Award className="h-4 w-4" />,
        title: 'Yılın En İyi Fonları',
        desc: 'En yüksek getiri, en iyi Sharpe, en yüksek enflasyon-sonrası getiri, en dirençli — 4 kategoride yıllık şampiyonlar.',
        url: '/en-iyi-fonlar/2026',
        tag: 'yeni',
      },
      {
        icon: <Users className="h-4 w-4" />,
        title: 'Yönetim Şirketi Karşılaştır',
        desc: 'İş Portföy, Ak Portföy, Garanti BBVA vs — şirketleri yan yana koyabilirsin. Fon sayısı, AUM, ortalama Sharpe karnesi.',
        url: '/yonetici-karsilastir',
        tag: 'yeni',
      },
      {
        icon: <Newspaper className="h-4 w-4" />,
        title: 'Haftanın KAP Manşetleri',
        desc: 'Son 7/30 günde hangi fon en çok bildirim yayınladı? Portföy değişikliği, yönetici atama, isim güncellemesi — hepsi burada.',
        url: '/ekonomi/kap-mansetleri',
        tag: 'yeni',
      },
      {
        icon: <Sparkles className="h-4 w-4" />,
        title: 'Yeni Listelenen Fonlar',
        desc: 'TEFAS\'a son zamanlarda eklenen yeni fonları tek sayfada bul. 7/30/90/180/365 gün seçenekleri.',
        url: '/fonlar/yeni',
        tag: 'yeni',
      },
      {
        icon: <FileText className="h-4 w-4" />,
        title: 'Kapanmış Fonlar Arşivi',
        desc: 'Artık işlem görmeyen fonların tarihsel kaydı. Eskiden var olan, birleşmiş veya kapanmış fonları araştırabilirsin.',
        url: '/arsiv/fonlar',
        tag: 'yeni',
      },
      {
        icon: <Eye className="h-4 w-4" />,
        title: 'İzleme Listesi',
        desc: 'Bir fonu sahiplenmeden takibe al — fon sayfasında "İzleme listeme ekle" butonu. Haftalık özet mail de geliyor.',
        url: '/alarmlarim',
        tag: 'yeni',
      },
      {
        icon: <Bell className="h-4 w-4" />,
        title: 'KAP Bildirim E-Posta Alarmı',
        desc: 'Takip ettiğin fonda yeni bildirim çıktı mı? Otomatik e-posta atıyoruz. Artık KAP\'a tek tek bakmana gerek yok.',
        tag: 'yeni',
      },
      {
        icon: <Award className="h-4 w-4" />,
        title: 'Kategorisinde Kaçıncı?',
        desc: 'Her fon sayfasında "Sharpe\'ta %95 üst, getiri %78 üst" gibi kategori içi sıralama gösterilir. Yeşil/sarı/kırmızı renkli.',
        tag: 'yeni',
      },
      {
        icon: <Users className="h-4 w-4" />,
        title: 'Sosyal Kanıt',
        desc: 'Her fonda "X kullanıcı bu fonu takipte" satırı. Hangi fonun popüler olduğunu bir bakışta gör.',
        tag: 'yeni',
      },
      {
        icon: <FileText className="h-4 w-4" />,
        title: 'Fact Sheet (PDF İndir)',
        desc: 'Her fon için profesyonel tek-sayfalık PDF raporu — metrikler, portföy, sıralama. Danışmanına/muhasebecine yollayabilirsin.',
        tag: 'yeni',
      },
      {
        icon: <Moon className="h-4 w-4" />,
        title: 'Açık Tema',
        desc: 'Gündüz gözünü yormadan çalışmak için beyaz/kremsi açık tema. Header\'daki güneş/ay ikonuyla geçiş. T tuşuna basarak da.',
        tag: 'yeni',
      },
      {
        icon: <Flame className="h-4 w-4" />,
        title: 'Ziyaret Serin',
        desc: 'Footer\'da küçük 🔥 ikonu — üst üste kaç gün Fonoloji\u2019ye baktığını gösterir. Zamanla alevleniyor.',
        tag: 'yeni',
      },
      {
        icon: <Star className="h-4 w-4" />,
        title: 'Son Bakılan Fonlar',
        desc: 'Header\'daki saat ikonundan son 12 fon. Bir fona tekrar bakmak için arama yapmana gerek yok.',
        tag: 'yeni',
      },
      {
        icon: <Zap className="h-4 w-4" />,
        title: 'Klavye Kısayolları',
        desc: '? tuşuna bas → tüm kısayolları gör. g+f (Fonlar), g+k (Kategoriler), ⌘K arama, t tema. Profesyonel hız.',
        tag: 'yeni',
      },
    ],
  },
];

export default function YeniliklerPage() {
  return (
    <div className="container py-10 md:py-14">
      <div className="mb-10 border-b border-border/50 pb-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <Sparkles className="h-3 w-3 text-amber-400" /> Güncellemeler
        </div>
        <h1 className="display mt-2 text-5xl leading-none md:text-6xl">
          <span className="display-italic gradient-text">Yenilikler</span>
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Fonoloji'ye yeni eklenen her özelliği burada duyuruyoruz.
          Portföyünü analiz etmek, en iyi fonları bulmak ve doğru kararları vermek
          için neler getirdiğimizi keşfet.
        </p>
      </div>

      <div className="space-y-16">
        {RELEASES.map((r, idx) => (
          <section key={idx} className="relative">
            {/* Timeline spot */}
            <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{r.emoji}</span>
                  <div>
                    <div className="font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">
                      {r.date}
                    </div>
                    <h2 className="serif text-3xl leading-tight md:text-4xl">{r.title}</h2>
                  </div>
                </div>
              </div>
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-emerald-300">
                {r.items.length} yeni özellik
              </span>
            </div>

            <p className="mb-8 max-w-3xl text-base leading-relaxed text-foreground/85">
              {r.summary}
            </p>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {r.items.map((item, i) => {
                const inner = (
                  <>
                    <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500/20 to-verdigris-500/20 text-brand-400 ring-1 ring-brand-400/20">
                      {item.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <h3 className="text-sm font-semibold group-hover:text-brand-200">
                          {item.title}
                        </h3>
                        {item.tag && (
                          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amber-300">
                            {item.tag}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {item.desc}
                      </p>
                      {item.url && (
                        <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-brand-400 group-hover:text-brand-300">
                          Keşfet →
                        </div>
                      )}
                    </div>
                  </>
                );
                if (item.url) {
                  return (
                    <Link key={i} href={item.url} className="panel group flex items-start gap-3 p-5 transition hover:border-brand-500/40">
                      {inner}
                    </Link>
                  );
                }
                return (
                  <div key={i} className="panel flex items-start gap-3 p-5">
                    {inner}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-20 border-t border-border/40 pt-6 text-center text-xs text-muted-foreground">
        Eksik bir şey mi gördün, bir önerin mi var?{' '}
        <Link href="/iletisim" className="text-brand-400 hover:text-brand-300">
          bize yaz
        </Link>{' '}
        — dinliyoruz.
      </p>
    </div>
  );
}
