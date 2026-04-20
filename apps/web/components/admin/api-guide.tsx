'use client';

import {
  Activity,
  BarChart3,
  Building2,
  Calendar,
  Compass,
  Database,
  FileText,
  Flame,
  Gauge,
  Globe,
  Info,
  LineChart,
  List,
  Newspaper,
  PieChart,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

// Admin paneli için — kullanıcıların Fonoloji API'sinden çekebileceği
// verilerin tamamen Türkçe, kodsuz özeti. Rapor havasında, non-teknik.

interface Item {
  title: string;
  desc: string;
  params?: string;
}

interface Section {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  blurb: string;
  items: Item[];
}

const SECTIONS: Section[] = [
  {
    icon: List,
    title: 'Fon Listeleri',
    blurb: 'Binlerce TEFAS fonunu filtreleyerek ya da toplu olarak çekme.',
    items: [
      {
        title: 'Tüm fonlar',
        desc: 'Aktif TEFAS fonlarının tamamı, istenen metriklere göre sıralanmış. Yatırımcı sayısı, risk skoru, büyüklük, getiri dönemleri gibi alanlarla birlikte döner.',
        params: 'Kategoriye, tipe (YAT/EMK/BYF), arama metnine göre filtre; aum/sharpe/return_1y gibi alana göre sıralama.',
      },
      {
        title: 'Yeni listelenen fonlar',
        desc: 'Son 7/30/90/180/365 gün içinde TEFAS\'a yeni eklenen fonlar. Pazarlanmaya başlamış taze fonları tespit etmek için.',
      },
      {
        title: 'Kapanmış/arşiv fonlar',
        desc: 'Artık işlem görmeyen, birleşmiş veya TEFAS listesinden düşmüş fonların tarihsel kaydı.',
      },
      {
        title: 'Fon arama',
        desc: 'Kod veya isme göre hızlı fon arama — Türkçe karakter ve kısmî eşleşme desteği.',
        params: 'Sorgu metni (örn: "ziraat altın", "TTE", "teknoloji").',
      },
      {
        title: 'CSV dışa aktarma',
        desc: 'Filtrelenmiş fon listesi CSV formatında indirilebilir — Excel\'e doğrudan açılabilir format.',
      },
    ],
  },
  {
    icon: Info,
    title: 'Tek Fon — Temel Bilgi',
    blurb: 'Seçilen bir fonun künyesi, fiyatı, portföyü ve KAP bilgileri.',
    items: [
      {
        title: 'Fon detay kartı',
        desc: 'Fonun adı, yönetim şirketi, kategori, ISIN, KAP sayfası linki, risk skoru, TEFAS işlem durumu, son portföy snapshot (hisse, tahvil, altın, döviz ağırlıkları).',
      },
      {
        title: 'Fiyat geçmişi',
        desc: 'Seçilen dönem için günlük NAV serisi. Grafik çizmek, indikatör hesaplamak için hazır.',
        params: '1 hafta, 1 ay, 3 ay, 1 yıl, YTD veya tüm zamanlar.',
      },
      {
        title: 'Portföy zaman çizelgesi',
        desc: 'Fonun aylık portföy kompozisyon değişimi — hisse ağırlığı yıl içinde nasıl değişmiş? KAP portföy raporlarından üretilir.',
      },
      {
        title: 'KAP bildirimleri',
        desc: 'O fona ait son duyurular: portföy dağılım raporu, yönetici değişikliği, isim güncellemesi, genel açıklama vb.',
      },
      {
        title: 'Tutucu hisse kırılımı',
        desc: 'Fon en son KAP portföy raporunda hangi hisseleri ne oranda tutuyor? Son 6 ayın holdings kayıtları.',
      },
    ],
  },
  {
    icon: Gauge,
    title: 'Tek Fon — Analiz Metrikleri',
    blurb: 'Fonun performans ve risk profilini özetleyen hazır hesaplar.',
    items: [
      {
        title: 'Kategori percentile\'ı',
        desc: 'Fonun kendi kategorisindeki sıralaması: "Sharpe\'ta %95 üst dilimde, 1-yıl getiride %78 üst dilimde" gibi. Yeşil/sarı/kırmızı çıktılar.',
      },
      {
        title: 'Aylık getiri matrisi',
        desc: 'Son 3 yılın ay×yıl getiri tablosu — mevsimsellik, tutarlılık kontrolü için.',
      },
      {
        title: 'Maksimum düşüş (drawdown)',
        desc: 'Fonun en yüksek noktasından dibe ne kadar çektiğinin zaman serisi. Stres testi göstergesi.',
      },
      {
        title: 'Benchmark karşılaştırma',
        desc: 'Fonun BIST100 veya TÜFE gibi referanslara göre kümülatif getirisi.',
      },
      {
        title: 'Gelişmiş metrik seti',
        desc: 'Sortino, Calmar, beta, reel getiri, 90-günlük Sharpe, volatilite, 1-yıl max drawdown — hepsi tek çağrıda.',
      },
      {
        title: 'Canlı gün-içi tahmin',
        desc: 'Fonun bugünkü kapanış NAV\'ının anlık tahmini — portföydeki hisselerin gün-içi hareketine göre.',
      },
      {
        title: 'Tahmin başarı karnesi',
        desc: 'Geçmiş gün-içi tahminlerimizin gerçekleşme doğruluğu.',
      },
      {
        title: 'AI özet',
        desc: 'Fonun dönem performansının sade Türkçe 1-2 cümlelik açıklaması.',
      },
    ],
  },
  {
    icon: Compass,
    title: 'Keşif & Piyasa Trendleri',
    blurb: 'Binlerce fonu tarayıp öne çıkanı bulma, dönem liderleri.',
    items: [
      {
        title: 'Günün özeti',
        desc: 'Bugünün en çok yükselen/düşenleri, toplam AUM, aktif fon sayısı, ortalama getiri.',
      },
      {
        title: 'En çok yükselen/düşen fonlar',
        desc: 'Günlük, haftalık, aylık, 3 aylık, yıllık, YTD periyotlarında getiri liderleri.',
        params: 'Dönem seç, en yüksek N fonu getir (1 gün, 1 hafta, 1 ay, ...).',
      },
      {
        title: 'Sermaye akışı',
        desc: 'Yatırımcıların son 1 hafta / 1 ay / 3 ayda en çok hangi fonlara giriş/çıkış yaptığı (yatırımcı sayısı × NAV değişimi).',
      },
      {
        title: 'Risk dağılımı',
        desc: 'TEFAS genelindeki 1-7 risk skoru dağılımı.',
      },
      {
        title: 'Varlık ısı haritası',
        desc: 'Hangi kategori ne kadar hisse, tahvil, altın, döviz tutuyor? Renkli ısı haritası verisi.',
      },
      {
        title: 'Risk-getiri dağılımı',
        desc: 'X: volatilite, Y: yıllık getiri — tüm fonların konumu. Scatter chart için hazır.',
      },
      {
        title: 'Korelasyon',
        desc: 'İki fonun 90/180/365 gün korelasyonu. Portföy çeşitlendirmesi analizinde kullanılır.',
      },
      {
        title: 'Trend',
        desc: 'Son haftanın yükselen kategorileri, haftanın kaybettiren kategorileri.',
      },
      {
        title: 'Yıl sonu tahmini',
        desc: 'Mevcut performansa göre yıl sonuna kadar kalan günlerde hedef değerlere ulaşma olasılığı.',
      },
    ],
  },
  {
    icon: PieChart,
    title: 'Kategoriler',
    blurb: 'Benzer fonların grup istatistikleri.',
    items: [
      {
        title: 'Tüm kategoriler',
        desc: 'TEFAS\'taki kategoriler + her birinde kaç fon, ortalama getiri, ortalama risk.',
      },
      {
        title: 'Kategori detayı',
        desc: 'Bir kategori adında: o kategoriye ait tüm fonlar, ortalama 1y getiri, medyan sharpe, toplam AUM.',
      },
      {
        title: 'Kategorideki en iyi fon',
        desc: 'Her kategori için ön plana çıkan "kategori şampiyonu" — Sharpe\'ı en yüksek veya 1-yıl getirisi en iyi.',
      },
    ],
  },
  {
    icon: Building2,
    title: 'Yönetim Şirketleri',
    blurb: 'Portföy şirketi bazlı karşılaştırma ve skorlama.',
    items: [
      {
        title: 'Tüm yönetim şirketleri',
        desc: 'İş Portföy, Ak Portföy, Garanti, Ziraat vs. — her birinin fon sayısı, toplam AUM, ortalama Sharpe.',
      },
      {
        title: 'Şirket karnesi',
        desc: 'Seçilen şirketin tüm fonlarının getiri ortalaması, risk profili, en iyi-en kötü fonu, büyüklüğün dağılımı.',
      },
      {
        title: 'Şirket skoru (0-100)',
        desc: 'Şirketin genel performans skoru — AUM, ortalama getiri, tutarlılık ağırlıklandırması.',
      },
    ],
  },
  {
    icon: Newspaper,
    title: 'KAP Bildirimleri',
    blurb: 'Şirketlerin resmi açıklama akışı.',
    items: [
      {
        title: 'Son bildirimler',
        desc: 'Son 30/90 gün içinde yayınlanmış tüm KAP bildirimleri — tüm fonlar genelinde.',
      },
      {
        title: 'Trend fonlar',
        desc: 'Son 7/30 günde en çok KAP bildirimi yayınlayan fonlar — aktivite göstergesi.',
      },
      {
        title: 'Fon bazlı bildirimler',
        desc: 'Tek fonun KAP disclosure akışı — kronolojik, konu ile birlikte.',
      },
    ],
  },
  {
    icon: Wrench,
    title: 'Araçlar',
    blurb: 'Portföy analizi ve karşılaştırma.',
    items: [
      {
        title: 'Portföy X-Ray',
        desc: '2-10 fondan portföy ver, ardındaki gerçek hisse/tahvil/altın maruziyetini çıkarır. "Farklı fonlar aldım ama aynı hisseye 3 kez mi yatırmışım?" sorusu.',
      },
      {
        title: 'Fon DNA — örtüşme',
        desc: 'İki fonun portföy kompozisyonu ne kadar benzer? %0-100 aralığında skor + hangi hisselerde ortaklar.',
      },
      {
        title: 'Portföy önerisi',
        desc: 'Kullanıcı hedeflerine göre (muhafazakâr/dengeli/büyüme) önerilen fon setleri — yapay bir asistan gibi.',
      },
    ],
  },
  {
    icon: Globe,
    title: 'Piyasa & Ekonomi',
    blurb: 'Gün içi canlı takip + makro veriler.',
    items: [
      {
        title: 'Canlı piyasa',
        desc: 'BIST100, USD/TRY, EUR/TRY, altın ons, Brent petrol — gün içi güncel değerler. 5 saniyede bir yenilenir.',
      },
      {
        title: 'Piyasa özeti',
        desc: 'Son N saat / günün piyasa hareketi — hisseler, döviz, emtialar için getiri ve değişim.',
      },
      {
        title: 'TÜFE / Enflasyon',
        desc: 'TÜİK\'in aylık TÜFE yayını + tüm yılların tarihsel serisi. Reel getiri hesabı için kullanılır.',
      },
    ],
  },
];

export function ApiGuide() {
  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-border/60 bg-gradient-to-br from-brand-500/10 to-verdigris-500/5 p-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-300">
          <Sparkles className="h-3.5 w-3.5" /> API Kılavuzu · Admin görünümü
        </div>
        <h2 className="mt-2 serif text-2xl">Fonoloji API'si üzerinden neler sorgulanabilir?</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Aşağıda, API anahtarı olan bir kullanıcının Fonoloji'den çekebildiği tüm veri kategorileri
          Türkçe olarak özetlenmiştir. Her kategori altında o gruptaki sorgular ve ne iş yaradıkları
          gün-içinde nasıl kullanılabileceği açıklanıyor.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-muted/40 px-2.5 py-1">Toplam {SECTIONS.reduce((s, x) => s + x.items.length, 0)}+ farklı sorgu türü</span>
          <span className="rounded-full bg-muted/40 px-2.5 py-1">2500+ fon</span>
          <span className="rounded-full bg-muted/40 px-2.5 py-1">5 yıl tarihsel veri</span>
          <span className="rounded-full bg-muted/40 px-2.5 py-1">KAP entegrasyonu</span>
          <span className="rounded-full bg-muted/40 px-2.5 py-1">Gün-içi tahmin</span>
        </div>
      </div>

      <div className="space-y-6">
        {SECTIONS.map((s, i) => (
          <section key={i}>
            <div className="mb-3 flex items-baseline gap-3 border-b border-border/40 pb-2">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/15 text-brand-300">
                <s.icon className="h-4 w-4" />
              </span>
              <div>
                <h3 className="serif text-xl">{s.title}</h3>
                <div className="text-[11px] text-muted-foreground">{s.blurb}</div>
              </div>
              <span className="ml-auto rounded-full bg-muted/30 px-2.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {s.items.length} sorgu
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {s.items.map((it, j) => (
                <div key={j} className="rounded-lg border border-border/50 bg-card/30 p-3.5">
                  <div className="font-semibold text-sm">{it.title}</div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{it.desc}</p>
                  {it.params && (
                    <div className="mt-2 rounded-md bg-muted/20 px-2 py-1.5 text-[11px] text-muted-foreground/90">
                      <span className="font-semibold text-foreground/80">Seçenekler:</span> {it.params}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="rounded-xl border border-border/60 bg-card/30 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Target className="h-3.5 w-3.5" /> Kısa özet
        </div>
        <p className="mt-2 text-sm text-foreground/85 leading-relaxed">
          Özetle: API üzerinden bir kullanıcı <strong>fonları arayabilir</strong>, tek bir fonun
          <strong> tüm geçmişini ve portföyünü çekebilir</strong>, piyasanın o anki
          <strong> trend liderlerini</strong> ve kategori içi <strong>sıralamalarını</strong> alabilir,
          portföy yönetim şirketlerini karşılaştırabilir, KAP bildirimlerini takip edebilir ve kendi
          portföyünü <strong>X-Ray ile analiz ettirebilir</strong>. Piyasa gün-içi verileri ve TÜFE
          gibi makro değişkenler de aynı API üzerinden geliyor.
        </p>
      </div>
    </div>
  );
}
