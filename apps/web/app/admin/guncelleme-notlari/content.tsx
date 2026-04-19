import { Activity, Award, BarChart3, Bell, CheckCircle2, Code, Database, Eye, FileText, TrendingUp, Users, Zap } from 'lucide-react';
import { PrintButton } from './print-button';

interface Feature {
  icon: React.ReactNode;
  title: string;
  desc: string;
  url?: string;
  category: 'uretkenlik' | 'icerik' | 'veri' | 'deneyim' | 'teknik';
}

const FEATURES: Feature[] = [
  // ÜRETKENLİK ARAÇLARI
  {
    icon: <BarChart3 className="h-4 w-4" />,
    title: 'Portföy X-Ray',
    desc: 'Birden fazla fonun KAP portföylerini birleştirip asıl hisse exposure\'ını çıkarır. "Gerçekte ne kadar ASELS tutuyorsun?" sorusunu cevaplar.',
    url: '/arac/portfoy-analiz',
    category: 'uretkenlik',
  },
  {
    icon: <BarChart3 className="h-4 w-4" />,
    title: 'Fon DNA Karşılaştırma',
    desc: 'İki fonun holdings örtüşmesini (%) hesaplar. Çeşitlenme yanılsamasını kırar — "aynı fon, farklı paket" tuzağını açığa çıkarır.',
    url: '/arac/fon-dna',
    category: 'uretkenlik',
  },
  {
    icon: <BarChart3 className="h-4 w-4" />,
    title: 'DCA Simülatörü',
    desc: '"Aylık düzenli yatırsaydım ne olurdu?" — geçmiş fiyatlar üzerinden dollar-cost averaging + tek seferde yatırım karşılaştırması.',
    url: '/arac/dca-hesabi',
    category: 'uretkenlik',
  },
  {
    icon: <BarChart3 className="h-4 w-4" />,
    title: 'Portföy Geri-Testi',
    desc: '2-10 fonlu portföyü geçmişe karşı test et — yıllık getiri, Sharpe, max drawdown, rebalancing etkisi.',
    url: '/arac/geri-test',
    category: 'uretkenlik',
  },
  {
    icon: <BarChart3 className="h-4 w-4" />,
    title: 'Varlık Isı Haritası',
    desc: 'Her kategori ortalama ne tutuyor? Hisse, tahvil, altın — 8 kategori × 7 varlık tipi renk-yoğunluklu matris.',
    url: '/kesifler/isi-haritasi-varlik',
    category: 'uretkenlik',
  },

  // İÇERİK SAYFALARI
  {
    icon: <FileText className="h-4 w-4" />,
    title: 'Finansal Sözlük (45 terim)',
    desc: '8 kategoriye ayrılmış 45 finansal terim: Sharpe, Sortino, drawdown, KAP, valör, stopaj, DCA... Sosyal medya paylaşımı için hazır özetler.',
    url: '/sozluk',
    category: 'icerik',
  },
  {
    icon: <FileText className="h-4 w-4" />,
    title: 'Kategoriler İndeksi',
    desc: 'Tüm TEFAS fon kategorileri tek sayfada — açıklama, risk seviyesi, fon sayısı, AUM. SEO uzun-kuyruk trafiği için.',
    url: '/kategoriler',
    category: 'icerik',
  },
  {
    icon: <Award className="h-4 w-4" />,
    title: 'Yılın En İyi Fonları',
    desc: '4 kategori yıllık rapor: en yüksek getiri, en iyi Sharpe, en yüksek reel getiri, en dirençli. Viral paylaşım potansiyeli.',
    url: '/en-iyi-fonlar/2026',
    category: 'icerik',
  },
  {
    icon: <FileText className="h-4 w-4" />,
    title: 'Yönetim Şirketi Karşılaştır',
    desc: 'İş Portföy, Ak Portföy, Garanti BBVA vs. yan yana — fon sayısı, AUM, ortalama Sharpe, 1Y getiri. Her kategoride 👑 kazanan.',
    url: '/yonetici-karsilastir',
    category: 'icerik',
  },
  {
    icon: <Activity className="h-4 w-4" />,
    title: 'Haftanın KAP Manşetleri',
    desc: 'Son N günde en çok bildirim yayınlayan fonlar. Rutin komisyon bildirimleri filtreli, sadece ilginç olaylar.',
    url: '/ekonomi/kap-mansetleri',
    category: 'icerik',
  },
  {
    icon: <FileText className="h-4 w-4" />,
    title: 'Yeni Listelenen Fonlar',
    desc: 'Son 7/30/90/180/365 günde TEFAS\'ta yeni gözlenen fonlar. İhraç + kategori + ilk getiri.',
    url: '/fonlar/yeni',
    category: 'icerik',
  },
  {
    icon: <FileText className="h-4 w-4" />,
    title: 'Kapanmış Fonlar Arşivi',
    desc: 'TEFAS\'ta artık listelenmeyen veya 30+ gün güncellenmeyen fonlar. Tarihsel kayıt.',
    url: '/arsiv/fonlar',
    category: 'icerik',
  },

  // VERİ & TEKNİK
  {
    icon: <Database className="h-4 w-4" />,
    title: 'KAP Fon Bildirimleri Entegrasyonu',
    desc: '15 dk\'da bir KAP\'tan fon bildirimleri çekilir, her fona kartlanır. ~30.000 bildirim, 3.372 fon kapsandı. İlk ziyarette 180 gün backfill.',
    category: 'veri',
  },
  {
    icon: <Database className="h-4 w-4" />,
    title: 'CSV Export',
    desc: 'Fonlar listesinin tam dökümü — kod, getiri, Sharpe, AUM, akış. BOM\'lu Excel-Türkçe uyumlu. Analistler için.',
    url: '/api/funds.csv',
    category: 'veri',
  },
  {
    icon: <FileText className="h-4 w-4" />,
    title: 'Fact Sheet PDF',
    desc: 'Her fon için tek sayfalık profesyonel özet — tüm metrikler, percentile, portföy dağılımı. Browser native Save as PDF.',
    category: 'veri',
  },
  {
    icon: <Database className="h-4 w-4" />,
    title: 'RSS Feed (fon başına)',
    desc: '/fon/[kod]/rss.xml — KAP bildirimlerini RSS 2.0 akışı olarak yayınlıyor. Developer/power user için.',
    category: 'veri',
  },
  {
    icon: <Code className="h-4 w-4" />,
    title: 'Embed Widget',
    desc: 'Blog yazarları için iframe widget: /embed/fon/[kod]. Fon fiyat kartı dış sitelere gömülebilir.',
    category: 'veri',
  },

  // KULLANICI DENEYİMİ
  {
    icon: <Eye className="h-4 w-4" />,
    title: 'İzleme Listesi (Watchlist)',
    desc: 'Sahiplenmeden takip — kullanıcı ziyaret ettiği fonu listesine ekleyebiliyor. Haftalık AI-özeti mail ile destekli.',
    url: '/alarmlarim',
    category: 'deneyim',
  },
  {
    icon: <Bell className="h-4 w-4" />,
    title: 'KAP Bildirim E-posta Alarmı',
    desc: 'Fon sayfasından "KAP bildirimlerini e-postayla al" toggle\'ı. Yeni bildirim yayınlandığında Resend ile mail.',
    category: 'deneyim',
  },
  {
    icon: <Users className="h-4 w-4" />,
    title: 'Sosyal Kanıt Rozeti',
    desc: 'Her fon sayfasında "X kullanıcı bu fonu takipte" göstergesi. Watchlist + alarm + portföy toplamından hesaplanır, privacy-safe.',
    category: 'deneyim',
  },
  {
    icon: <Award className="h-4 w-4" />,
    title: 'Kategori İçi Percentile',
    desc: 'Her fon için kategori sıralaması — Sharpe, getiri, reel getiri, drawdown. Yeşil/sarı/kırmızı çeyrek renkli paneller.',
    category: 'deneyim',
  },
  {
    icon: <TrendingUp className="h-4 w-4" />,
    title: 'Yatırımcı Sayısı Trendi',
    desc: 'Her fon sayfasında 1 yıllık yatırımcı sayısı grafiği + %değişim. Popülerlik/güven sinyali.',
    category: 'deneyim',
  },
  {
    icon: <Zap className="h-4 w-4" />,
    title: 'Paylaş Butonu',
    desc: 'Her fon + karşılaştır sayfasında — native share (mobil) + X + WhatsApp + copy-link.',
    category: 'deneyim',
  },
  {
    icon: <Zap className="h-4 w-4" />,
    title: 'Son Bakılan Fonlar',
    desc: 'Header\'da saat ikonu — son 12 ziyaret edilen fon localStorage\'dan. Hızlı erişim.',
    category: 'deneyim',
  },
  {
    icon: <Zap className="h-4 w-4" />,
    title: 'Klavye Kısayolları',
    desc: '? help modalı, ⌘K arama, g+f/a/k/e/h/p/l sayfa geçiş, t tema değiştir. Pro-level UX.',
    category: 'deneyim',
  },
  {
    icon: <Zap className="h-4 w-4" />,
    title: 'Streak Rozeti',
    desc: 'Footer\'da 🔥 ikon + günlük ziyaret streak\'i. 7+ günde amber, 14+ günde yoğunlaşır.',
    category: 'deneyim',
  },
  {
    icon: <Eye className="h-4 w-4" />,
    title: 'Dark / Light Mod',
    desc: 'Warm ivory (kağıt dokusu) light tema. FOUC önleme, localStorage kalıcı, t tuşu kısayolu.',
    category: 'deneyim',
  },
  {
    icon: <Eye className="h-4 w-4" />,
    title: 'Instagram + Facebook Footer',
    desc: '@fonoloji_ (Instagram) ve fb.com/fonoloji linkleri eklendi.',
    category: 'deneyim',
  },

  // TEKNİK İYİLEŞTİRMELER
  {
    icon: <CheckCircle2 className="h-4 w-4" />,
    title: 'TEFAS-Traded Filtresi',
    desc: '6 endpoint artık sadece aktif işlem gören fonları döner — akışlar, kategoriler, risk-return. Para akışları sayfası artık temiz.',
    category: 'teknik',
  },
  {
    icon: <CheckCircle2 className="h-4 w-4" />,
    title: 'NAV Tahmini Gate\'leri',
    desc: 'Sadece hisse ≥ %50 AND holdings ≤ 100 gün eski ise tahmin üretir. Aksi halde null — yanıltıcı veri göstermez.',
    category: 'teknik',
  },
  {
    icon: <CheckCircle2 className="h-4 w-4" />,
    title: 'KAP Parse Bug\'ları Düzeltildi',
    desc: 'publishDate çift-format (DD.MM.YYYY + YYYY.MM.DD), rate-limit false-positive, holdings sanity-check, 2000-kayıt cap için fundType split.',
    category: 'teknik',
  },
  {
    icon: <CheckCircle2 className="h-4 w-4" />,
    title: 'Türkçe Finansal Birimler',
    desc: 'Eskiden "1 Mr" / "Mrd" → şimdi açık yazılmış "1 milyar", "1 milyon", "1 bin", "1 trilyon". "AUM" → "Fon Büyüklüğü" her yerde.',
    category: 'teknik',
  },
  {
    icon: <CheckCircle2 className="h-4 w-4" />,
    title: 'Yıl Sonu / Çeyreklik Özet Altyapısı',
    desc: '"Spotify Wrapped" tarzı dönemsel brifing. buildPeriodSummary + runPeriodSummary hazır, cron disabled — aralığı sen belirle.',
    category: 'teknik',
  },
];

const GROUPS: Array<{ key: Feature['category']; label: string; color: string }> = [
  { key: 'uretkenlik', label: 'Üretkenlik Araçları', color: 'amber' },
  { key: 'icerik', label: 'İçerik & SEO', color: 'verdigris' },
  { key: 'veri', label: 'Veri & Entegrasyon', color: 'sky' },
  { key: 'deneyim', label: 'Kullanıcı Deneyimi', color: 'brand' },
  { key: 'teknik', label: 'Teknik İyileştirme', color: 'emerald' },
];

const METRICS = [
  { label: 'Commit', value: '23' },
  { label: 'Satır eklendi', value: '7.204' },
  { label: 'Satır silindi', value: '407' },
  { label: 'Dosya değişimi', value: '111' },
  { label: 'Yeni sayfa', value: '11' },
  { label: 'Yeni API endpoint', value: '14' },
];

export function DevReportContent() {
  const byGroup = GROUPS.map((g) => ({
    ...g,
    items: FEATURES.filter((f) => f.category === g.key),
  }));

  const today = new Date().toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'long', year: 'numeric', weekday: 'long',
  });

  return (
    <div className="print-sheet mx-auto max-w-4xl px-8 py-10 print:max-w-full print:p-0">
      <PrintButton />

      {/* Header */}
      <header className="mb-8 border-b-2 border-border pb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground print:text-black/60">
              Fonoloji · Günlük Geliştirme Raporu
            </div>
            <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight print:text-black">
              {today}
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground print:text-black/80">
              Tek günde <strong className="text-foreground print:text-black">33 yeni özellik, 11 yeni sayfa</strong> ve
              <strong className="text-foreground print:text-black"> 14 yeni API endpoint</strong> canlıya alındı.
              Yeni araçlar, içerik sayfaları, kullanıcı deneyimi iyileştirmeleri ve teknik düzeltmeler
              gruplarında toplandı.
            </p>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Rapor</div>
            <div className="mt-1 font-mono text-sm font-semibold">v{today.split(' ').slice(0, 3).join('.').toLowerCase()}</div>
          </div>
        </div>
      </header>

      {/* Metrics grid */}
      <section className="mb-10">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Rakamlarla
        </h2>
        <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
          {METRICS.map((m) => (
            <div key={m.label} className="rounded-lg border border-border/60 bg-card/40 p-4 print:border-black/30 print:bg-white">
              <div className="font-mono text-3xl font-bold tabular-nums print:text-black">{m.value}</div>
              <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{m.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Executive summary */}
      <section className="mb-10">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Yönetici Özeti
        </h2>
        <div className="space-y-3 text-sm leading-relaxed text-foreground/90 print:text-black/90">
          <p>
            <strong className="text-foreground print:text-black">Stratejik tema:</strong> Fonoloji
            bugün <em>pasif fon listeleyici</em> konumundan <em>aktif portföy analiz platformu</em>na
            evrildi. Rakiplerde (tefas.gov.tr, bigpara, finansgundem) olmayan <strong>KAP
            holdings verisini</strong> leverage eden 5 yeni üretkenlik aracı devreye alındı.
          </p>
          <p>
            <strong className="text-foreground print:text-black">Öne çıkan:</strong> Portföy X-Ray
            (çeşitlenme yanılsamasını kıran analiz), Fon DNA (iki fon arasındaki gerçek
            benzerlik), DCA simülatörü ve Geri-Test araçları. 45 terimlik finansal
            sözlük SEO ve içerik pazarlaması için güçlü bir uzun-kuyruk tabanı kurdu.
          </p>
          <p>
            <strong className="text-foreground print:text-black">Kullanıcı değeri:</strong> İzleme
            listesi, sosyal kanıt, kategori-içi percentile, haftalık özet mail ve fact sheet
            PDF gibi özellikler mevcut kullanıcıların platformda daha uzun süre kalmasını
            ve geri dönmesini sağlıyor. Dark/Light tema ve klavye kısayolları pro-seviye UX
            katmanı ekledi.
          </p>
          <p>
            <strong className="text-foreground print:text-black">Altyapı:</strong> Çeyreklik/yıllık
            "Spotify Wrapped" tarzı özet sistemi kuruldu (cron kapalı, karar anında aktif
            edilecek). KAP parser'daki 3 ciddi bug giderildi, 30.000 bildirim veri tabanına
            çekildi. Expense ratio ve fon yöneticisi parser'ları (cost drag + manager track)
            ileri faza ertelendi — yeni veri kaynağı gerekiyor.
          </p>
        </div>
      </section>

      {/* Feature groups */}
      {byGroup.map((g) => (
        <section key={g.key} className="mb-10 break-inside-avoid">
          <h2 className="mb-4 flex items-baseline justify-between border-b border-border/60 pb-2 print:border-black/30">
            <span className="serif text-xl">{g.label}</span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {g.items.length} özellik
            </span>
          </h2>
          <div className="space-y-3">
            {g.items.map((f, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-border/40 bg-card/30 p-4 print:border-black/20 print:bg-transparent">
                <div className="mt-0.5 shrink-0 text-brand-400 print:text-black">{f.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-sm font-semibold">{f.title}</h3>
                    {f.url && (
                      <a
                        href={f.url}
                        className="font-mono text-[10px] text-brand-400 hover:underline print:text-black/60"
                      >
                        {f.url}
                      </a>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground print:text-black/80">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* Backlog */}
      <section className="mb-10 break-inside-avoid">
        <h2 className="mb-4 border-b border-border/60 pb-2 serif text-xl print:border-black/30">
          Sonraki Dalga (Backlog)
        </h2>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 print:border-black/30 print:bg-transparent">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-300 print:text-black">
            Yeni Veri Kaynağı Gerektiriyor
          </p>
          <ul className="space-y-1 text-xs text-muted-foreground print:text-black/80">
            <li>• <strong>Cost drag kalkülatörü</strong> — expense ratio KAP "Fon Gider Bilgileri" PDF scraper'ı gerekli</li>
            <li>• <strong>Yönetici track record</strong> — KAP bildirimlerinden yönetici adı NLP/regex parse</li>
            <li>• <strong>Sektör breakdown</strong> — BIST hisse → sektör mapping veri seti</li>
            <li>• <strong>Dividend tracker</strong> — fon dağıtımı KAP bildirim parser</li>
            <li>• <strong>Currency-hedged view</strong> — TCMB günlük USD/EUR seri ingest</li>
          </ul>
        </div>
        <div className="mt-3 rounded-lg border border-border/40 bg-card/30 p-4 print:border-black/20 print:bg-transparent">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            İçerik / Ürün Kararı Bekliyor
          </p>
          <ul className="space-y-1 text-xs text-muted-foreground print:text-black/80">
            <li>• <strong>Blog (MDX)</strong> — içerik yazımı ve SEO stratejisi</li>
            <li>• <strong>E-book "TEFAS'a Başlangıç"</strong> — 20-30 sayfalık PDF</li>
            <li>• <strong>Genel newsletter</strong> — opt-in akışı + editoryel içerik</li>
            <li>• <strong>Advanced filter builder</strong> — Notion-style query UI</li>
            <li>• <strong>Custom benchmark</strong> — kullanıcı kendi endeksini tanımlasın</li>
          </ul>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-12 border-t border-border/60 pt-6 text-[10px] leading-relaxed text-muted-foreground print:text-black/50">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="font-semibold">Kaynak kontrolü</div>
            <div className="font-mono">github.com/akemalerol/fonoloji</div>
            <div className="mt-1">Son commit: <span className="font-mono">dbf6259</span></div>
          </div>
          <div className="text-right">
            <div className="font-semibold">Canlı</div>
            <div className="font-mono">fonoloji.com</div>
            <div className="mt-1">Rapor tarihi: {today}</div>
          </div>
        </div>
        <p className="mt-4 text-center">
          Bu rapor otomatik oluşturuldu · Fonoloji Geliştirme Ekibi
        </p>
      </footer>
    </div>
  );
}
