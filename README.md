<div align="center">

# Fonoloji

**Türk yatırım fonları için profesyonel analiz platformu**

2.500+ TEFAS fonu · Sharpe, Sortino, reel getiri · KAP portföy dağılımı · anlık NAV tahmini

[🌐 fonoloji.com](https://fonoloji.com) · [📈 Canlı demo](https://fonoloji.com/kesifler) · [📚 API dokümanı](https://fonoloji.com/api-docs) · [𝕏 @fonoloji_](https://x.com/fonoloji_)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=nextdotjs)
![Fastify](https://img.shields.io/badge/Fastify-4-000?logo=fastify)
![SQLite](https://img.shields.io/badge/SQLite-WAL-003B57?logo=sqlite)

</div>

---

## Ne bu?

Fonoloji, TEFAS'ın ham NAV verisini profesyonel yatırım metriklerine dönüştüren, reklamsız ve açık kaynak bir platformdur. TEFAS'ın ekranı operasyon için tasarlanmıştır; Fonoloji'nin ekranı **karar** için.

- **TEFAS'ın sunmadığı metrikleri hesaplıyoruz** — Sharpe, Sortino, Calmar, Beta, Max Drawdown, 90g volatilite, reel getiri (enflasyon düşülmüş)
- **KAP'tan her ay fonun gerçek portföyünü çekiyoruz** — hangi hisseden ne kadar tuttuğunu biliyoruz, bu sayede anlık NAV tahmini yapabiliyoruz
- **Canlı piyasa** — BIST100, USD/TL, EUR/TL, GBP/TL, ons altın, gram altın saniyelik güncelleniyor
- **Fon uyarıları** — fiyat/getiri/portföy değişikliklerini email ile bildiriyoruz; fon birleşmesi, isim değişikliği, KAP duyuruları dahil
- **Geliştirici dostu REST API** — kendi uygulamanıza entegre edin

---

## Teknik Özellikler

| Katman | Teknoloji | Görevi |
|---|---|---|
| Web | Next.js 14 (App Router) + Tailwind | SSR + ISR, dark-first |
| API | Fastify 4 + Zod | Tip güvenli REST, cookie + API-Key auth |
| DB | better-sqlite3 (WAL) | ~2500 fon × 5 yıl fiyat + analytics |
| İş mantığı | Analytics recompute + node-cron | Her 3 saatte metrikler, her dk canlı piyasa |
| Scraper | got-scraping + cheerio | TEFAS ASP.NET WebForms, Selenium'suz |
| PDF | pdftotext (poppler) | KAP portföy raporları |
| AI | OpenAI gpt-4o-mini | Günlük market digest, tweet üretimi |
| Infra | PM2, Cloudflare, Resend | Tek VPS + CDN önde |

### Mimari

```
                  ┌──────────────────────┐
                  │ Cloudflare (CDN+WAF) │
                  └───────────┬──────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                           │
    ┌───▼────┐   same-origin /api               ┌───▼───┐
    │  Next  │ ◄──────────────────────────────► │ Fastify│
    │  :3000 │                                  │  :4000 │
    └────────┘                                  └───┬────┘
                                                    │
                                         ┌──────────┼──────────┐
                                         │          │          │
                                    ┌────▼───┐ ┌────▼────┐ ┌───▼───┐
                                    │ SQLite │ │  cron   │ │ TEFAS │
                                    │ (WAL)  │ │ scraper │ │ /KAP  │
                                    └────────┘ └─────────┘ └───────┘
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

## Repo Yapısı

```
apps/
├── api/                  Fastify REST API
│   └── src/
│       ├── routes/       /funds, /insights, /auth, /admin-api, /portfolio
│       ├── analytics/    Sharpe, Sortino, CAGR, drawdown, korelasyon
│       ├── scrapers/     TEFAS HTML/JSON scraper
│       ├── scripts/      Ingest, KAP holdings, NAV estimate, CPI
│       ├── cron/         Zamanlanmış işler
│       └── services/     Mail, AI, X/Twitter
├── web/                  Next.js 14 frontend
│   ├── app/              Router (fonlar, karsilastir, kesifler, fon/[kod]...)
│   ├── components/       fx/ (finans widget), magic/ (animasyon), site/
│   └── lib/              API client, utils
src/                      Apify Actor (standalone TEFAS scraper)
tests/                    Vitest
```

---

## API

### Public REST API

`api.fonoloji.com` üzerinden erişilebilir. Kayıt sonrası kişisel API key.

```bash
curl -H "X-API-Key: $KEY" https://fonoloji.com/v1/funds?limit=10
```

**Limit:** Tek tier, tamamen **ücretsiz**.

| | Aylık kota | Günlük kap | Dakikada | Fiyat |
|---|---|---|---|---|
| Kayıtlı kullanıcı | 30.000 | 3.000 | 60 | **0 ₺** — ömür boyu |

Yüksek hacim (ör. backfill, akademik araştırma, kurumsal entegrasyon) için [iletişim](https://fonoloji.com/iletisim) — özel limit açıyoruz.

**Öne çıkan endpoint'ler:**

```http
GET /v1/funds                      # Tüm fonlar (filtrele, sırala)
GET /v1/funds/:code                # Fon detay + metrikler
GET /v1/funds/:code/prices         # Fiyat geçmişi
GET /v1/funds/:code/holdings       # KAP portföy dağılımı
GET /v1/movers?period=1d           # Günün yükselen/düşenleri
GET /v1/search?q=hisse             # Fuzzy arama
GET /v1/market/live                # FX, altın, BIST100
GET /v1/economy/cpi                # TÜFE serisi
GET /v1/nav/estimate/:code         # Anlık NAV tahmini (Pro+)
```

Full schema: [fonoloji.com/api-docs](https://fonoloji.com/api-docs)

### Apify Actor

Sadece TEFAS scraper'ı ayrı çalıştırmak için — `src/main.ts` + `.actor/`. Detay: [src/README.md](src/README.md) (legacy).

---

## Katkıda Bulunma

Pull request'ler açık. Büyük değişiklikler için önce issue aç.

```bash
npm test              # Vitest
npm run typecheck     # tsc --noEmit
npm run lint          # ESLint
```

İlgilendiğimiz katkılar:
- 🐛 Parser iyileştirmeleri (özellikle KAP PDF formatları)
- 📊 Yeni metrik / görselleştirme (R², alpha, Treynor, information ratio...)
- 🔌 Yeni veri kaynağı (SPK, Takasbank, TÜİK EVDS)
- 🌍 İngilizce localization

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
