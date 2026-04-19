// Kapsamlı finansal sözlük — /sozluk sayfası ve sosyal medya içerik kaynağı.
// Her terimde: title, short (1-2 satır özet), body (paragraflar), related (diğer terim slug'ları).

export interface GlossaryEntry {
  slug: string;
  title: string;
  category: 'getiri' | 'risk' | 'risk-ayarli' | 'portfoy' | 'fon-turu' | 'tefas-kap' | 'piyasa' | 'maliyet';
  short: string;       // paylaşılabilir kısa özet
  body: string[];      // detaylı paragraflar (markdown benzeri bold desteği)
  example?: string;
  related?: string[];
}

export const GLOSSARY: GlossaryEntry[] = [
  // ============================================================
  // GETİRİ ÖLÇÜTLERİ
  // ============================================================
  {
    slug: 'nominal-getiri',
    title: 'Nominal Getiri',
    category: 'getiri',
    short: 'Fonun fiyat olarak ne kadar büyüdüğü — enflasyon düşülmemiş ham sayı.',
    body: [
      'Nominal getiri, bir fonun başlangıç fiyatından bitiş fiyatına kadar **olan yüzdesel değişimdir**. Yani "fon kaç para kazandı?" sorusunun en ham cevabı.',
      'Türkiye gibi yüksek enflasyonlu ülkelerde nominal getiri yanıltıcı olabilir: %40 getiri varken enflasyon %50 ise aslında **reel olarak paranın alım gücü azalmıştır**.',
      'Nominal getiriye bakarken mutlaka TÜFE ile kıyaslanmalı. Reel getiri bu karşılaştırmayı yapar.',
    ],
    example: 'Fon 100 TL\'den 145 TL\'ye çıktı → nominal getiri %45. Enflasyon %50 ise reel getiri ≈ −%3.',
    related: ['reel-getiri', 'tufe', 'ytd'],
  },
  {
    slug: 'reel-getiri',
    title: 'Reel Getiri',
    category: 'getiri',
    short: 'Enflasyondan arındırılmış gerçek getiri. Paranın alım gücü ne kadar arttı/azaldı?',
    body: [
      'Nominal getiriden enflasyon etkisi çıkarılırsa reel getiri kalır. Formül: **(1 + nominal) / (1 + enflasyon) − 1**.',
      'Türkiye\'de yatırım kararlarında en önemli ölçüttür — "fonun getirisi enflasyonu geçti mi?" sorusunun net cevabı.',
      'Negatif reel getiri, fon kâr etse bile paranızın alım gücünün azaldığı anlamına gelir.',
    ],
    example: 'Nominal %40, TÜFE %50 → reel ≈ −%6.7. Yani %40 kazanmış gibi görünen yatırım aslında %6.7 kaybettirmiş.',
    related: ['nominal-getiri', 'tufe'],
  },
  {
    slug: 'ytd',
    title: 'YBİ / Yıl Başından İtibaren (YTD)',
    category: 'getiri',
    short: 'Takvim yılının başından bugüne kadar fonun getirisi.',
    body: [
      'Year-to-Date — **ocak başından ölçüm gününe** kadar olan getiri. Yıllık plan yapanlar için en anlamlı periyot.',
      'Dikkat: YBİ, mevsimsel etkilere açıktır. Ocak-Mart dönemi iyi geçtiyse yıl başarı göstergesi olmayabilir.',
    ],
    example: 'Fon 1 Ocak\'ta 10 TL, 1 Haziran\'da 12,5 TL → YBİ %25.',
    related: ['nominal-getiri', 'cagr'],
  },
  {
    slug: 'cagr',
    title: 'CAGR — Yıllık Bileşik Büyüme',
    category: 'getiri',
    short: 'Çok yıllı getirinin bir yıllığa indirgenmiş eşleniği. "Her yıl ortalama %X kazandırmış."',
    body: [
      'Compound Annual Growth Rate — **bileşik yıllık büyüme oranı**. Bir yatırımın birden fazla yıl boyunca her yıl eşit oranla büyüdüğü varsayılarak hesaplanan ortalama yıllık getiri.',
      'Formül: `(final/başlangıç) ^ (1/yıl) − 1`. 3 yılda %50 kazandıran bir fonun CAGR\'ı ≈ %14.5\'tır — her yıl %16.7 değil.',
      'Uzun vadeli karşılaştırmalarda toplam getiriden çok daha anlamlı. "Borsa yıllık ortalama %15 kazandırır" ifadesi CAGR\'dır.',
    ],
    example: '100 TL 5 yıl sonra 200 TL oldu → CAGR = 2^(1/5) − 1 ≈ %14.87 yıllık ortalama.',
    related: ['nominal-getiri'],
  },

  // ============================================================
  // RİSK ÖLÇÜTLERİ
  // ============================================================
  {
    slug: 'volatilite',
    title: 'Volatilite (Oynaklık)',
    category: 'risk',
    short: 'Fon fiyatının dalgalanma miktarı. Yüksek volatilite = yüksek risk.',
    body: [
      'Volatilite, fon fiyatının **ortalaması etrafında ne kadar gezdiği**. İstatistiksel olarak standart sapma ile ölçülür.',
      '90 günlük volatilite %20 demek, fon fiyatının ortalama %20 bandında yukarı-aşağı oynadığı anlamına gelir — büyük gün-içi hareketler, yüksek risk demektir.',
      'Düşük volatilite = istikrarlı/sakin (genelde tahvil, para piyasası). Yüksek volatilite = heyecanlı (hisse, serbest fonlar).',
    ],
    example: 'Para piyasası fonu: %2-5 yıllık volatilite. Hisse fonu: %25-40. Kripto BYF: %60+.',
    related: ['standart-sapma', 'max-drawdown', 'risk-skoru'],
  },
  {
    slug: 'standart-sapma',
    title: 'Standart Sapma',
    category: 'risk',
    short: 'Volatilitenin matematik arkasındaki formül. Ortalama etrafında saçılım ölçüsü.',
    body: [
      'Standart sapma, bir veri setinin ortalamadan ne kadar uzaklaştığının ölçüsüdür. Finansta, **günlük getiri verilerinin standart sapması = volatilite** olarak kullanılır.',
      'Bell eğrisinde (normal dağılım) veriyi ±1 standart sapma içinde %68\'ini, ±2 içinde %95\'ini yakalar. Yani 1σ = normal bir gün, 3σ = çok nadir olay.',
    ],
    related: ['volatilite'],
  },
  {
    slug: 'max-drawdown',
    title: 'Max Drawdown',
    category: 'risk',
    short: 'Fonun en büyük zirve-dip kaybı. Tarihteki en kötü düşüşü.',
    body: [
      'Fonun bir zirvedeki değerinden sonraki bir dibe kadar düştüğü **en büyük yüzdesel kayıp**. En dürüst risk ölçüsü — gerçekten yaşanmış, teorik değil.',
      'Yatırımcının "ben bu düşüşe dayanabilir miyim?" sorusunun cevabıdır. %40 drawdown\'lı bir fona girersen, en kötü durumda paranın %40\'ının geçici de olsa erimesine hazırlıklı olmalısın.',
      'Volatiliteden daha somut: volatilite istatistiksel, max drawdown yaşanmış gerçek.',
    ],
    example: 'Fon 100\'den 150\'ye çıktı sonra 90\'a düştü → max drawdown = (90−150)/150 = −%40.',
    related: ['volatilite', 'calmar'],
  },
  {
    slug: 'beta',
    title: 'Beta Katsayısı',
    category: 'risk',
    short: 'Fonun piyasayla birlikte ne kadar hareket ettiği. 1 = piyasa gibi, >1 = daha heyecanlı.',
    body: [
      'Fonun **piyasa (ör. BIST100) değişimlerine duyarlılığı**. Beta = 1 → piyasa %1 çıkarsa fon da %1 çıkar. Beta = 1.5 → piyasa %1 çıkarsa fon %1.5 çıkar (ve düşerken de daha çok düşer).',
      'Savunmacı fonlar (beta < 1): para piyasası, katılım, altın fonları. Agresif fonlar (beta > 1): kaldıraçlı BYF, teknoloji ağırlıklı hisse fonları.',
      'Beta 0\'a yakın fonlar, piyasaya bağlı olmayan alternatif stratejilerdir (emtia, hedge fon benzeri).',
    ],
    related: ['volatilite', 'alfa', 'r-kare'],
  },
  {
    slug: 'alfa',
    title: 'Alfa — Piyasa Üstü Getiri',
    category: 'risk',
    short: 'Fonun piyasa hareketini çıktıktan sonra yarattığı ekstra getiri. Yönetici becerisinin ölçüsü.',
    body: [
      'Alfa, fon yöneticisinin **piyasayı aşan getiri yaratma becerisi**. Piyasa %20 yükselmişse ve fon (beta ile düzeltilmiş olarak) %25 yükselmişse, alfa = %5\'tir.',
      'Pozitif alfa = yönetici değer katıyor. Negatif alfa = pasif endeks fonundan bile geriye düşmüş.',
      'Alfa tek başına anlamlı olmayabilir — yüksek risk (beta) alıp yüksek alfa üretmek kolay. Sharpe gibi risk-ayarlı ölçülerle birlikte değerlendirilmeli.',
    ],
    related: ['beta', 'sharpe', 'r-kare'],
  },
  {
    slug: 'downside-risk',
    title: 'Aşağı Yönlü Risk',
    category: 'risk',
    short: 'Sadece kayıp tarafındaki volatilite. Sortino\'nun kalbi.',
    body: [
      'Volatilite kayıpları ve kazançları eşit sayar, ama yatırımcı için tek gerçek risk **kayıp tarafıdır**. Aşağı yönlü risk (downside deviation) yalnızca hedefin altında kalan günleri sayar.',
      'Pozitif volatilite (yukarı spike\'lar) Sharpe\'ı cezalandırır — Sortino bu soruna çare olarak sadece downside\'ı sayar.',
    ],
    related: ['sortino', 'volatilite', 'var'],
  },

  // ============================================================
  // RİSK-AYARLI GETİRİ ÖLÇÜTLERİ
  // ============================================================
  {
    slug: 'sharpe',
    title: 'Sharpe Oranı',
    category: 'risk-ayarli',
    short: 'Risk başına getiri. Ne kadar riske girdin, karşılığı ne?',
    body: [
      'Risk-ayarlı getiri ölçüsünün altın standardı. Formül: **(Fon getirisi − Risksiz faiz) / Volatilite**.',
      'Sharpe 2\'den yüksek → mükemmel. 1-2 → iyi. 0-1 → vasat. Negatif → risksiz faizin altında kalmış.',
      'İki fon aynı getiriyi verdiyse, Sharpe\'ı yüksek olan "daha az dalgalanarak" oraya ulaşmıştır — dolayısıyla daha iyi.',
    ],
    example: 'Fon A %40 getiri, volatilite %30, risksiz %35 → Sharpe = (40−35)/30 = 0.17. Vasat.\nFon B %25 getiri, volatilite %8, risksiz %35 → Sharpe = (25−35)/8 = −1.25. Risksizden kötü.',
    related: ['sortino', 'volatilite', 'calmar'],
  },
  {
    slug: 'sortino',
    title: 'Sortino Oranı',
    category: 'risk-ayarli',
    short: 'Sharpe\'ın sadece düşüş-volatilitesine bakan versiyonu. Daha adil.',
    body: [
      'Sortino, Sharpe ile aynı mantık ama paydada sadece **aşağı yönlü volatilite** var. Fikir şu: yükseliş dalgalanması "risk" değildir; cezalandırılmamalı.',
      'Özellikle asimetrik getiri dağılımına sahip fonlar (opsiyon stratejileri, pozitif sürprize açık fonlar) için Sharpe\'tan daha adil bir ölçü.',
      'Pratikte Sharpe\'tan her zaman yüksek çıkar. 2\'den yüksek çok iyi, 1\'in üstü iyidir.',
    ],
    related: ['sharpe', 'downside-risk'],
  },
  {
    slug: 'calmar',
    title: 'Calmar Oranı',
    category: 'risk-ayarli',
    short: 'Yıllık getiri ÷ max drawdown. "En kötü düşüşüne karşı ne kazandın?"',
    body: [
      'Formül: **Yıllık getiri / |Max Drawdown|**. Sharpe volatiliteye, Calmar **gerçek yaşanmış en büyük kayba** bakar.',
      'Emeklilik ve uzun vadeli yatırımcılar için çok anlamlı: "Kaybı göze aldım mı? Karşılığı yeterli mi?"',
      'Calmar 2+ → güçlü risk-getiri dengesi. 1 → getiri kadar potansiyel kayıp var.',
    ],
    example: 'Fon 3 yılda ortalama %20/yıl kazandı, en kötü düşüş −%25 idi → Calmar = 20/25 = 0.8.',
    related: ['max-drawdown', 'sharpe'],
  },
  {
    slug: 'information-ratio',
    title: 'Information Ratio',
    category: 'risk-ayarli',
    short: 'Benchmark\'ı ne kadar tutarlı aştın? Aktif yönetim becerisinin ölçüsü.',
    body: [
      'Fon getirisi ile benchmark arasındaki farkın (**active return**) volatilitesine bölünmüş hâli. Aktif yönetim tutarlılığını ölçer.',
      'Yüksek IR = yönetici benchmark\'ı sürekli ve istikrarlı aşıyor. Düşük/negatif IR = aktif yönetim getirmiyor, endeks fonu daha iyi.',
    ],
    related: ['sharpe', 'alfa'],
  },

  // ============================================================
  // PORTFÖY KAVRAMLARI
  // ============================================================
  {
    slug: 'diversifikasyon',
    title: 'Çeşitlendirme (Diversifikasyon)',
    category: 'portfoy',
    short: 'Tek sepete yumurta koymamak. Farklı varlıklara dağıtarak riski azaltmak.',
    body: [
      '"Hepsini tek bir hisseye, tek bir sektöre, tek bir ülkeye yatırma." Çeşitlendirme, **birbirinden bağımsız hareket eden varlıklara** yatırım yaparak toplam riski azaltır.',
      'Gerçek çeşitlenme için varlıklar arasında **düşük korelasyon** olmalı. Aynı kategoride 5 fon tutarak çeşitlenmiş olmazsın — hepsi aynı anda düşer.',
      'Portföy X-Ray aracı, farklı görünen fonlarının aslında aynı hisseleri tuttuğunu açığa çıkarır.',
    ],
    related: ['korelasyon', 'rebalancing'],
  },
  {
    slug: 'korelasyon',
    title: 'Korelasyon',
    category: 'portfoy',
    short: 'İki varlığın birlikte hareket etme derecesi. −1 ile +1 arası.',
    body: [
      '**+1**: iki varlık aynı anda aynı yönde hareket eder (BIST ETF + BIST fonu).\n**0**: bağımsız hareket ederler (hisse + altın sıkça).\n**−1**: zıt hareket (teorik; gerçekte nadir).',
      'Portföy kurarken düşük veya negatif korelasyonlu varlıklar ararsın. Biri düşerken diğeri çıkarsa, toplam volatilitesi azalır.',
      'Fon DNA aracı, iki fonun korelasyonunu değil ama **holdings örtüşmesini** ölçer — daha kesin bir çeşitlenme göstergesi.',
    ],
    related: ['diversifikasyon', 'r-kare'],
  },
  {
    slug: 'rebalancing',
    title: 'Yeniden Dengeleme (Rebalancing)',
    category: 'portfoy',
    short: 'Belirli aralıklarla portföy dağılımını hedef oranlara geri çekmek.',
    body: [
      'Hisse %60, tahvil %40 hedeflediğin portföyde hisseler iyi performans gösterip %75\'e çıktı. Rebalancing = bir kısmını satıp tahvile çevirerek 60/40\'a geri dönme.',
      '**Otomatik olarak yükseni sat, düşüğü al** demektir. Disiplin sağlar, kâr realize eder, risk dengesi korunur.',
      'Çeyreklik veya yıllık rebalancing yaygındır. Çok sık yapmak vergi/komisyon artırır.',
    ],
    related: ['diversifikasyon'],
  },
  {
    slug: 'dca',
    title: 'DCA — Dollar-Cost Averaging',
    category: 'portfoy',
    short: 'Birikimini tek seferde değil, düzenli aralıklarla yatırmak. Volatiliteden yararlanmak.',
    body: [
      '**Dollar-Cost Averaging** (maliyet ortalaması) — her ay/hafta aynı tutarı yatırırsın. Fiyat düşünce daha çok, çıkınca daha az adet alırsın.',
      'Piyasanın zamanlamasını yapmaya çalışmaktan kurtarır. Davranışsal olarak panik satışı engeller.',
      'Ama yükselen bir piyasada tek seferde yatırım (lump-sum) istatistiksel olarak genelde daha iyi sonuç verir. DCA\'nın asıl faydası **psikolojik** ve yeni birikim girişi yapan için uygun.',
    ],
    example: 'Her ay 1.000 TL TTE alırsan, fiyat 10\'dan 8\'e düştüğünde 125 adet alırsın, 10 iken 100 adet. Ortalama maliyetin 9 olur.',
    related: ['rebalancing'],
  },
  {
    slug: 'r-kare',
    title: 'R-Kare (R²)',
    category: 'portfoy',
    short: 'Fonun getirisinin ne kadarı benchmark\'tan geliyor? %90+ = büyük ölçüde endeks fonu.',
    body: [
      '0-100 arası bir değer. **R² = %95** → fonun getirisinin %95\'i BIST100\'le açıklanıyor, sadece %5\'i yönetici kararları.',
      'Yüksek R² + düşük alfa = "gizli endeks fonu" — aktif fon gibi görünüp endeksi kopyalayan ama yüksek ücret alan.',
      'Düşük R² = yönetici bağımsız stratejiyle hareket ediyor (serbest, tematik, özel fonlar).',
    ],
    related: ['beta', 'alfa'],
  },

  // ============================================================
  // FON TÜRLERİ
  // ============================================================
  {
    slug: 'byf-etf',
    title: 'BYF / ETF — Borsa Yatırım Fonu',
    category: 'fon-turu',
    short: 'Borsa\'da hisse gibi alınıp satılan, çoğunlukla endeks takip eden fon.',
    body: [
      'Exchange-Traded Fund — **borsada hisse gibi işlem gören fon**. TEFAS\'ta da, Borsa İstanbul\'da da alınıp satılabilir. Gün içinde fiyatı değişir.',
      'Genelde pasif — BIST30, BIST100 gibi endeksleri takip eder. Yönetim ücreti aktif fonlardan düşüktür (%0.3-0.8 tipik).',
      'Avantaj: şeffaf, ucuz, anlık alım-satım. Dezavantaj: dar bir strateji, dalgalanmalı.',
    ],
    related: ['yatirim-fonu', 'tefas'],
  },
  {
    slug: 'yatirim-fonu',
    title: 'Yatırım Fonu',
    category: 'fon-turu',
    short: 'Birden fazla yatırımcının parasının bir havuzda profesyonelce yönetildiği yapı.',
    body: [
      'Yatırım fonu, çok sayıda yatırımcının parasını **profesyonel bir portföy yöneticisi** tarafından hisse, tahvil, döviz gibi varlıklara yatıran toplu yatırım aracıdır.',
      'Her yatırımcının fondaki payı "pay" (unit) cinsinden ifade edilir. Fon değeri toplam portföyün değerinden, pay sayısına bölerek bulunur (NAV).',
      'TEFAS\'ta 2.500+ yatırım fonu var. Emeklilik (BES) fonları ayrı kategori.',
    ],
    related: ['byf-etf', 'nav', 'tefas'],
  },
  {
    slug: 'emeklilik-fonu',
    title: 'Emeklilik Fonu (BES)',
    category: 'fon-turu',
    short: 'Bireysel Emeklilik Sistemi\'nde birikim yapmak için kurulmuş uzun vadeli fonlar.',
    body: [
      'BES — **Bireysel Emeklilik Sistemi**. Devlet %30 (üst sınırlı) katkı payı ekler. Birikim vergi avantajlıdır.',
      'Emeklilik fonları yalnızca BES kapsamında alınabilir; TEFAS\'taki normal fonlardan ayrıdır.',
      'Uzun vadeli (10+ yıl) yatırım için — erken çıkışta vergi avantajı kaybolur.',
    ],
    related: ['yatirim-fonu'],
  },
  {
    slug: 'serbest-fon',
    title: 'Serbest Fon',
    category: 'fon-turu',
    short: 'Geniş yetkili, "nitelikli yatırımcı" için — her türlü strateji serbest.',
    body: [
      'Kısıtlama neredeyse yok: türev, kaldıraç, short, emtia, yabancı hisse — hepsi serbest. Ancak **nitelikli yatırımcı** tanımını karşılayan kişilere satılır (genelde 1M TL+ birikim).',
      'Hedge fon benzeri stratejiler — yüksek potansiyel getiri, yüksek risk, genelde yüksek ücret.',
      'Bireysel yatırımcı için erişilemez; ama TEFAS\'ta görünürler.',
    ],
    related: ['yatirim-fonu'],
  },
  {
    slug: 'semsiye-fon',
    title: 'Şemsiye Fon',
    category: 'fon-turu',
    short: 'Bir yönetim şirketinin aynı amaca yönelik birden fazla alt-fonundan oluşan yapı.',
    body: [
      'Şemsiye fon kendisi yatırım aracı **değil** — altındaki alt-fonlar yatırım aracıdır. "Hisse Senedi Şemsiye Fonu" altında "Türkiye Hisse", "Teknoloji Hisse", "Bankacılık Hisse" gibi birden fazla fon olabilir.',
      'Yatırımcı şemsiye fon almaz — alt-fonlardan birini alır.',
    ],
    related: ['yatirim-fonu'],
  },
  {
    slug: 'fon-sepeti',
    title: 'Fon Sepeti Fonu',
    category: 'fon-turu',
    short: 'Başka fonlara yatırım yapan "fonların fonu". Çeşitlenme kolaylığı.',
    body: [
      'Başka yatırım fonlarını tutan fon — "fund of funds". Otomatik çeşitlenme sağlar ama **çifte yönetim ücreti** çıkabilir (hem sepet fonunun hem de alt-fonların).',
      'Tek başına fon seçemeyen ya da dengelenmiş portföy isteyen için uygun.',
    ],
    related: ['yatirim-fonu'],
  },
  {
    slug: 'para-piyasasi',
    title: 'Para Piyasası Fonu',
    category: 'fon-turu',
    short: 'Kısa vadeli, çok düşük riskli. Nakit benzeri — gün-içi likidite.',
    body: [
      'Çok kısa vadeli (genellikle <90 gün) borçlanma araçları, repo ve mevduata yatırım yapan **düşük risk, düşük getiri** fonlar.',
      'Nakit park etmek için ideal. Para piyasası fonu değeri genelde TL mevduata yakın.',
    ],
    related: ['yatirim-fonu'],
  },
  {
    slug: 'katilim-fonu',
    title: 'Katılım Fonu (İslami)',
    category: 'fon-turu',
    short: 'Faiz içermeyen enstrümanlara yatırım — katılım bankacılığı prensipleri.',
    body: [
      '**Faiz içermez**; kira sertifikası (sukuk), İslami hisse, katılım endeksleri, gayrimenkul gibi araçlara yatırır.',
      'Danışma kurulu denetimli. Dini hassasiyeti olan yatırımcılar için.',
    ],
    related: ['yatirim-fonu'],
  },

  // ============================================================
  // TEFAS / KAP ÖZEL
  // ============================================================
  {
    slug: 'tefas',
    title: 'TEFAS',
    category: 'tefas-kap',
    short: 'Türkiye Elektronik Fon Alım Satım Platformu — tüm fonların tek noktada işlem gördüğü yer.',
    body: [
      'Türkiye\'deki **tüm yatırım fonlarının** (emeklilik hariç, BEFAS ayrı) alınıp satılabildiği elektronik platform. Aracı kurumun hangi fonu sunduğu farketmez — TEFAS\'ta hepsine erişirsin.',
      'SPK denetimi altında. Günlük NAV fiyatlama, T+1/T+2 valörlü alış-satış.',
      'Fonoloji, TEFAS\'ın halka açık verisini okunur analize çevirir.',
    ],
    related: ['nav', 'valor'],
  },
  {
    slug: 'befas',
    title: 'BEFAS',
    category: 'tefas-kap',
    short: 'Bireysel Emeklilik fonlarının platformu. BES fonları burada işlem görür.',
    body: [
      'TEFAS emeklilik fonlarını hariç tutar; emeklilik fonları **BEFAS** üzerinden alınır-satılır.',
      'BES katılımcısıysanız aracı kurumunuz üzerinden BEFAS\'a erişirsiniz.',
    ],
    related: ['tefas', 'emeklilik-fonu'],
  },
  {
    slug: 'kap',
    title: 'KAP — Kamuyu Aydınlatma Platformu',
    category: 'tefas-kap',
    short: 'Şirketlerin, fonların kamuya resmi bildirimlerini yayınladığı platform.',
    body: [
      'SPK\'nın işlettiği resmi platform. Halka açık şirketler + fonlar **izahname değişikliği, yönetici ataması, portföy raporu, özel durum** gibi bildirimleri burada yayınlar.',
      'Yatırımcı için kritik — fonun aldığı kararlar, portföyün ne tuttuğu, riskler buradan duyurulur.',
      'Fonoloji, KAP\'tan her 15 dakikada bir fon bildirimlerini çeker.',
    ],
    related: ['portfoy-dagilim', 'izahname'],
  },
  {
    slug: 'portfoy-dagilim',
    title: 'Portföy Dağılım Raporu',
    category: 'tefas-kap',
    short: 'Fonun hangi varlıklara ne kadar yatırdığını aylık olarak KAP\'a yüklediği rapor.',
    body: [
      'Her ayın sonunda (genelde bir sonraki ayın ilk 10 günü) fon, **tuttuğu her hisse/tahvil/altını ve yüzde ağırlığını** KAP\'a yükler.',
      'Fonun "gerçek" stratejisini anlamanın yolu — pazarlama metninden değil, gerçekten ne aldığından.',
      'Fonoloji bu raporları parse eder; Portföy X-Ray ve Fon DNA araçları üstüne kurulur.',
    ],
    related: ['kap', 'izahname'],
  },
  {
    slug: 'izahname',
    title: 'İzahname',
    category: 'tefas-kap',
    short: 'Fonun resmi "tanımlama belgesi". Strateji, risk, ücret — hepsi yazılıdır.',
    body: [
      'Fonun resmi kuruluş ve işletme belgesi. Yatırım stratejisi, risk seviyesi, yönetim ücreti, giriş/çıkış komisyonu, karşılaştırma endeksi — hepsi burada.',
      'Fon alım öncesi okunması gereken belge. Değişiklikler yine KAP\'ta yayınlanır.',
    ],
    related: ['kap', 'yatirimci-bilgi-formu'],
  },
  {
    slug: 'yatirimci-bilgi-formu',
    title: 'Yatırımcı Bilgi Formu (YBF)',
    category: 'tefas-kap',
    short: 'İzahnamenin 2 sayfalık, okunabilir özet versiyonu.',
    body: [
      'SPK zorunlu olarak istediği **sade Türkçe** özet belgesi. Risk skoru, geçmiş getiri, ücret, tavsiye süresi burada toparlanmış.',
      'Alış öncesi en azından bu belge okunmalı.',
    ],
    related: ['izahname'],
  },
  {
    slug: 'valor',
    title: 'Valör (T+1, T+2)',
    category: 'tefas-kap',
    short: 'İşlemin fiilen gerçekleşme tarihi. "T+1" = bir iş günü sonra.',
    body: [
      'Alış/satış emri verdiğin gün değil, **fiilen hesabına giren/çıkan fon payı** günü.',
      'Türk fonlarında **alış genelde T+1, satış T+2** tipiktir. Cuma günü satış verdin mi, para Salı günü hesaba geçer.',
      'Emeklilik fonları farklı kurallara tabidir.',
    ],
    related: ['tefas'],
  },
  {
    slug: 'nav',
    title: 'NAV — Net Aktif Değer',
    category: 'tefas-kap',
    short: 'Fon payının birim fiyatı. Günde bir kez, gün sonu hesaplanır.',
    body: [
      'Net Asset Value — fonun **toplam varlığı** / **toplam pay sayısı**. Günde bir kez, gün sonu değerlerinden hesaplanır.',
      'Fonlarda hisse gibi gün içi fiyat dalgalanması yoktur — 1 gün önce emir ver, ertesi gün NAV\'dan işlem görür.',
      'BYF/ETF\'lerde iki fiyat vardır: intra-day market price ve NAV. Bunlar ayrışabilir (premium/discount).',
    ],
    related: ['byf-etf', 'valor'],
  },

  // ============================================================
  // PİYASA KAVRAMLARI
  // ============================================================
  {
    slug: 'bist100',
    title: 'BIST 100',
    category: 'piyasa',
    short: 'Borsa İstanbul\'un en büyük 100 şirketini temsil eden ana endeks.',
    body: [
      'Borsa İstanbul\'un en likit 100 hissesini ağırlıklandırılmış olarak tutan endeks. Türk ekonomisinin "nabzı" kabul edilir.',
      'Hisse ağırlıklı fonlar BIST100\'ü benchmark olarak kullanır. Bir fon uzun vadede BIST100\'ü geçememişse, "BIST100 endeks BYF\'si daha iyiydi" demektir.',
    ],
    related: ['byf-etf'],
  },
  {
    slug: 'eurobond',
    title: 'Eurobond',
    category: 'piyasa',
    short: 'Devletin veya şirketin yabancı para cinsinden çıkardığı tahvil. Dolar/Euro hedge aracı.',
    body: [
      'Türkiye\'nin ya da Türk şirketlerinin **dolar veya euro cinsinden** çıkardığı tahvil. Türk lirası yerine döviz getirisi sağlar.',
      'Eurobond fonları yüksek enflasyon + TL değer kaybı dönemlerinde savunma aracı. Faiz geliri döviz üzerinden, TL\'ye dönüşte kur kazancı da olur.',
    ],
    related: ['faiz'],
  },
  {
    slug: 'repo',
    title: 'Repo / Ters Repo',
    category: 'piyasa',
    short: 'Kısa vadeli borç verme/alma. Para piyasasının temel aracı.',
    body: [
      'Bir taraf senedi **belirli bir süre için satıp** sonra geri alır. Satan için finansman (repo), alan için kısa vadeli yatırım (ters repo).',
      'Para piyasası fonlarının ana varlığı — günlük/haftalık likidite.',
    ],
    related: ['para-piyasasi'],
  },
  {
    slug: 'faiz',
    title: 'Faiz (Risksiz Getiri)',
    category: 'piyasa',
    short: 'Sharpe oranında "risksiz" kabul edilen referans. Genelde TCMB politika faizi veya TL mevduat.',
    body: [
      'Risk-ayarlı getiri hesaplamalarının çıpası. Türkiye\'de genelde **TCMB 1 hafta repo** veya **hazine kısa vadeli bono faizi** referans alınır.',
      'Faiz %40 ise, %40\'tan az getiri veren risk alan fon "risksize kaybetmiş" demektir.',
    ],
    related: ['sharpe'],
  },
  {
    slug: 'tufe',
    title: 'TÜFE — Tüketici Fiyat Endeksi',
    category: 'piyasa',
    short: 'Enflasyonun resmi ölçüsü. Reel getiriyi hesaplamak için kullanılır.',
    body: [
      'TÜİK\'in aylık yayınladığı, tüketici sepetinin fiyat değişimini gösteren endeks. **Enflasyon = TÜFE yıllık değişimi**.',
      'Fonoloji her fonun 1 yıllık nominal getirisini TÜFE ile düzeltir → reel getiri kartında gösterir.',
    ],
    related: ['reel-getiri', 'nominal-getiri'],
  },

  // ============================================================
  // MALİYET / YAPI
  // ============================================================
  {
    slug: 'fon-buyuklugu',
    title: 'Fon Büyüklüğü',
    category: 'maliyet',
    short: 'Fonun yönettiği toplam para. Yatırımcı güvenin ve ölçeğin ölçüsü.',
    body: [
      'Fonun tüm yatırımcılarından topladığı ve yönettiği toplam para miktarı (Assets Under Management - AUM).',
      'Yüksek büyüklük = kurumsal güven + ölçek ekonomisi. Düşük büyüklük = çevik ama kapanma riski yüksek, likidite az.',
      'Çok büyük fonlar küçük hisselere giremezler (ölçek sorunu) — yöneticinin esnekliği düşer.',
    ],
    example: 'İyi bir büyüklük aralığı: 500 milyon − 10 milyar TL. Altı çevik, üstü hantal olabilir.',
    related: ['yatirimci-sayisi', 'yonetim-ucreti'],
  },
  {
    slug: 'yatirimci-sayisi',
    title: 'Yatırımcı Sayısı',
    category: 'maliyet',
    short: 'Fona yatırım yapan farklı kişi/kurum sayısı. Popülerlik + güven sinyali.',
    body: [
      'Fonun kaç ayrı yatırımcıdan para aldığı. Çok sayıda küçük yatırımcı = **bireysel kitle**. Az sayıda büyük yatırımcı = **kurumsal**.',
      'Artış trendi yatırımcı güveninin göstergesi; azalış uyarı işareti olabilir.',
    ],
    related: ['fon-buyuklugu'],
  },
  {
    slug: 'yonetim-ucreti',
    title: 'Yönetim Ücreti',
    category: 'maliyet',
    short: 'Fon yöneticisinin yıllık aldığı, fon değeri üzerinden kesilen ücret.',
    body: [
      'Yıllık bazda, fon varlığının **günlük küçük parçalar hâlinde** kesilen ücret. Nominal getiriden düşülür — ilan edilen getiride zaten yansımıştır.',
      'Pasif endeks BYF\'lerde %0.3-0.8, aktif fonlarda %1-2, serbest fonlarda %2-3 tipiktir.',
      '10 yıllık yatırımda %1 fark = %10+ toplam fark.',
    ],
    related: ['byf-etf', 'yatirim-fonu'],
  },
  {
    slug: 'risk-skoru',
    title: 'Risk Skoru (1-7)',
    category: 'maliyet',
    short: 'SPK\'nın her fona atadığı 1-7 arası standart risk ölçüsü.',
    body: [
      '**1 = en düşük risk** (para piyasası, kısa vadeli tahvil).\n**7 = en yüksek risk** (kaldıraçlı BYF, kripto, serbest).',
      'Volatilite bazlı hesaplanır. Karşılaştırma standardı — tüm fonlar aynı ölçekte.',
    ],
    related: ['volatilite'],
  },
  {
    slug: 'stopaj',
    title: 'Stopaj Vergisi',
    category: 'maliyet',
    short: 'Fon gelirinden kaynakta kesilen vergi. Oran fon tipine göre değişir.',
    body: [
      'Türkiye\'de fon kazançlarından **kaynakta kesilen vergi**. Bireysel yatırımcı için:',
      '- Hisse senedi yoğun fonlar: **%0** (en az bir yıl tutulursa)\n- BYF: **%10**\n- Para piyasası, tahvil fonları: **%10**\n- Eurobond: **%10**',
      'Emeklilik fonları farklı vergi rejimine tabidir.',
    ],
    related: ['bsmv'],
  },
  {
    slug: 'bsmv',
    title: 'BSMV — Banka ve Sigorta Muamele Vergisi',
    category: 'maliyet',
    short: 'Bazı finansal işlemlerde kesilen yüzde 5 vergi.',
    body: [
      'Aracı kurumun aldığı komisyondan **%5** BSMV kesilir. Çoğunlukla yatırımcıya yansıtılmaz, ama fon alışverişinde toplam maliyete eklenir.',
    ],
    related: ['stopaj'],
  },
];

export const GLOSSARY_CATEGORIES: Array<{ key: GlossaryEntry['category']; label: string }> = [
  { key: 'getiri', label: 'Getiri' },
  { key: 'risk', label: 'Risk' },
  { key: 'risk-ayarli', label: 'Risk-Ayarlı Getiri' },
  { key: 'portfoy', label: 'Portföy' },
  { key: 'fon-turu', label: 'Fon Türleri' },
  { key: 'tefas-kap', label: 'TEFAS / KAP' },
  { key: 'piyasa', label: 'Piyasa' },
  { key: 'maliyet', label: 'Maliyet & Yapı' },
];
