<div align="center">

# Fonoloji

**Türk yatırım fonları için profesyonel analiz platformu**

2.500+ TEFAS fonu · Sharpe, Sortino, reel getiri · KAP portföy dağılımı · anlık NAV tahmini · canlı piyasa

[🌐 fonoloji.com](https://fonoloji.com) &nbsp;·&nbsp; [📈 Canlı demo](https://fonoloji.com/kesifler) &nbsp;·&nbsp; [📚 API dokümanı](https://fonoloji.com/api-docs) &nbsp;·&nbsp; [𝕏 @fonoloji_](https://x.com/fonoloji_)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=nextdotjs)
![Fastify](https://img.shields.io/badge/Fastify-4-000?logo=fastify)
![SQLite](https://img.shields.io/badge/SQLite-WAL-003B57?logo=sqlite)

</div>

---

## Ne bu?

Fonoloji, TEFAS'ın ham NAV verisini profesyonel yatırım metriklerine dönüştüren, reklamsız ve açık kaynak bir platformdur. TEFAS'ın ekranı operasyon için tasarlanmıştır; Fonoloji'nin ekranı **karar** için.

---

## Ne yapabiliyor?

### Fon analizi
- **TEFAS'ın sunmadığı metrikleri hesaplıyoruz** — Sharpe, Sortino, Calmar, Beta, Max Drawdown, 90 günlük volatilite, reel getiri (TÜFE düşülmüş), benchmark alpha, yönetici skoru
- **En iyi fonlar** — dönem bazlı sıralamalı listeleme; yükselen/düşenler, para akışı, yönetici karşılaştırması
- **Fon karşılaştırma** — iki veya daha fazla fonu yan yana; korelasyon matrisi, çakışma analizi
- **Kategori & harita görünümü** — fon evrenini kümelenmiş olarak keşfet
- **Embed widget** — herhangi bir sayfaya tek satır ile fon kartı göm

### Portföy & holdings
- **KAP'tan her ay gerçek portföyü çekiyoruz** — hangi hisseden ne kadar tuttuğunu, sektör dağılımını, konsantrasyon riskini biliyoruz
- **Anlık NAV tahmini** — portföy + canlı hisse fiyatları ile gün içi fon değeri tahmini
- **Portföy analizi** — kendi fon sepetinizi girin, toplam risk ve çakışma oranı çıkarsın

### Canlı piyasa
- **BIST 100** — 5 saniyede bir polling, gerçek zamanlı endeks fiyatı
- **Döviz kurları** — USD/TL, EUR/TL, GBP/TL anlık
- **Altın** — ons altın ve gram altın canlı
- **Hisse senetleri** — BIST'te işlem gören hisseler için anlık fiyat, grafik ve şirket bilgisi
- **Ekonomi takvimi** — TCMB, TÜİK ve global merkez bankası kararları; önem seviyesine göre filtreleme

### Haberler & yapay zeka
- **Günlük market digest** — GPT-4o-mini ile özetlenmiş sabah bülteni
- **Fon hikayesi** — her fonun performans seyrini anlatı formatında sun
- **KAP duyuruları** — fon birleşmesi, isim değişikliği, özel durum bildirimleri

### Alarmlar & bildirimler
- **Fiyat alarmları** — belirlediğin eşiği geçince e-posta ile haber ver
- **Portföy değişikliği alarmı** — KAP'tan yeni holdings gelince otomatik bildirim
- **Haftalık özet** — takip ettiğin fonların haftalık performans raporu

### Geliştirici API
- Tüm veri JSON REST API üzerinden erişilebilir
- Cookie + API-Key kimlik doğrulama
- Fon verileri, metrikler, portföy, canlı piyasa, ekonomi takvimi — tek endpoint ailesi
- Ücretsiz kota ile başla, yüksek hacim için özel limit

---

## Teknik özellikler

| Katman | Teknoloji | Görevi |
|---|---|---|
| Web | Next.js 14 (App Router) + Tailwind | SSR + ISR, dark-first |
| API | Fastify 4 + Zod | Tip güvenli REST, cookie + API-Key auth |
| DB | better-sqlite3 (WAL) | ~2.500 fon × 5 yıl fiyat + analytics |
| İş mantığı | Analytics recompute + node-cron | Her 3 saatte metrikler, her dk canlı piyasa |
| Scraper | got-scraping + cheerio | TEFAS ASP.NET WebForms, Selenium'suz |
| Hisse fiyatı | yahoo-finance2 | On-demand + 15dk cache |
| PDF | pdftotext (poppler) | KAP portföy raporları |
| AI | OpenAI gpt-4o-mini | Günlük market digest, fon hikayesi |
| Ekonomi takvimi | TradingView Economic Calendar | 10dk cache, önem filtreli |
| Infra | PM2, Cloudflare, Resend | Tek VPS + CDN önde |

### Mimari

```
                  ┌──────────────────────┐
                  │ Cloudflare (CDN+WAF) │
                  └───────────┬──────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                           │
    ┌───▼────┐   same-origin /api               ┌───▼────┐
    │  Next  │ ◄──────────────────────────────► │ Fastify│
    │  :3000 │                                  │  :4000 │
    └────────┘                                  └───┬────┘
                                                    │
                                   ┌────────────────┼────────────────┐
                                   │                │                │
                              ┌────▼───┐      ┌─────▼────┐    ┌──────▼──────┐
                              │ SQLite │      │   cron   │    │ TEFAS / KAP │
                              │ (WAL)  │      │ scraper  │    │  Yahoo / TV │
                              └────────┘      └──────────┘    └─────────────┘
```

---

## Başlangıç

### Gereksinimler

- Node.js 20+
- `pdftotext` (KAP PDF parse için — macOS: `brew install poppler`, Ubuntu: `apt install poppler-utils`)

### Kurulum

```bash
git clone https://github.com/akemalerol/fonoloji.git
cd fonoloji
npm install

cp .env.example .env
# .env'i aç, en azından FONOLOJI_COOKIE_SECRET ve FONOLOJI_JWT_SECRET set et:
#   openssl rand -hex 32

npm run dev
```

API `:4000`'de, web `:3000`'de başlar. İlk açılışta DB boştur; tarihsel verileri çek:

```bash
npm run api:ingest -- --days 365
```

### Docker ile

```bash
docker build -t fonoloji .
docker run -p 3000:3000 -p 4000:4000 --env-file .env fonoloji
```

---

## Repo yapısı

```
apps/
├── api/                  Fastify REST API
│   └── src/
│       ├── routes/       Fonlar, insights, portföy, hisseler, makro, auth, admin
│       ├── analytics/    Sharpe, Sortino, CAGR, drawdown, korelasyon, alpha, stres
│       ├── scrapers/     TEFAS HTML/JSON scraper (ViewState + cookie yönetimi)
│       ├── scripts/      Ingest, KAP holdings, hisse fiyatları, NAV tahmini, TÜFE
│       ├── cron/         Zamanlanmış işler (fiyat güncelleme, analytics, alarm)
│       └── services/     AI (GPT-4o-mini), mail (Resend), X/Twitter, canlı piyasa
├── web/                  Next.js 14 frontend
│   ├── app/              Router — fonlar, karsilastir, hisse, ekonomi, kesifler, harita...
│   ├── components/       Finans widget'ları (fx/), animasyon (magic/), site shell
│   └── lib/              API client, utils
src/                      Apify Actor (standalone TEFAS scraper)
tests/                    Vitest
```

---

## API

`api.fonoloji.com` üzerinden erişilebilir. Kayıt sonrası kişisel API key.

**Limit:** Tek tier, tamamen **ücretsiz**.

| | Aylık kota | Günlük kap | Dakikada | Fiyat |
|---|---|---|---|---|
| Kayıtlı kullanıcı | 30.000 | 3.000 | 60 | **0 ₺** — ömür boyu |

Yüksek hacim (ör. backfill, akademik araştırma, kurumsal entegrasyon) için [iletişim](https://fonoloji.com/iletisim).

**API ile yapabilecekleriniz:**

- Tüm TEFAS fonlarını listele, filtrele, sırala; tek bir fonu detaylıca sorgula
- Fiyat geçmişi, risk metrikleri, dönem getirileri
- KAP portföy dağılımı — hisse, sektör, varlık sınıfı bazında
- Anlık NAV tahmini (gün içi canlı portföy × hisse fiyatı)
- Canlı piyasa — BIST100, döviz, altın, hisse senetleri
- Ekonomi takvimi — Türkiye ve küresel makro olaylar
- Fon günlük özeti, yükselen/düşenler, para akışı
- Yapay zeka ile oluşturulmuş market bülteni

Full şema ve interaktif dokümantasyon: [fonoloji.com/api-docs](https://fonoloji.com/api-docs)

---

## Katkıda bulunma

Pull request'ler açık. Büyük değişiklikler için önce issue aç.

```bash
npm test              # Vitest
npm run typecheck     # tsc --noEmit
npm run lint          # ESLint
```

İlgilendiğimiz katkılar:
- Parser iyileştirmeleri (özellikle KAP PDF formatları)
- Yeni metrik / görselleştirme (R², alpha, Treynor, information ratio...)
- Yeni veri kaynağı (SPK, Takasbank, TÜİK EVDS)
- İngilizce localization

---

## Yasal

Fonoloji bağımsız bir araçtır — TEFAS, Takasbank, SPK veya herhangi bir fon kurucusuyla resmi ilişkisi yoktur. Tüm veriler TEFAS'ın kamuya açık sayfalarından ve KAP'tan toplanır.

**Burada yer alan hiçbir şey yatırım tavsiyesi değildir.** Geçmiş performans gelecek getiriyi garanti etmez. Yatırım kararlarınızı kendi araştırmanıza dayanarak verin.

---

## Lisans

MIT — [LICENSE](LICENSE)

---

<div align="center">
<sub>Yapan: <a href="https://x.com/fonoloji_">@fonoloji_</a> · Sorular için <a href="https://fonoloji.com/iletisim">iletişim</a></sub>
</div>
