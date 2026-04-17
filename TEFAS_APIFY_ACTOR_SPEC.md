# TEFAS Fund Data Scraper — Apify Actor Project Spec

> **Amaç:** TEFAS (Türkiye Elektronik Fon Alım Satım Platformu) verilerini programatik olarak çeken, yapılandırılmış JSON/CSV çıktısı üreten ve Apify Store'da ücretli olarak satışa sunulacak production-grade bir Apify Actor geliştirmek.

---

## 1. Proje Genel Bakış

### 1.1 Problem

TEFAS (tefas.gov.tr), Türkiye'deki 836+ yatırım fonunun merkezi veri platformu. Ancak:

- **Resmi public API yok.** Geliştiriciler için dokümante edilmiş bir endpoint bulunmuyor.
- Web arayüzünden Excel indirmek **3 aylık tarih limiti** ile sınırlı.
- Mevcut açık kaynak çözümler ya Selenium tabanlı (yavaş, kırılgan) ya da bakımsız.
- Ticari düzeyde, güvenilir, ücretli bir TEFAS veri servisi **Apify Store'da mevcut değil**.

### 1.2 Çözüm

TEFAS'ın ASP.NET WebForms altyapısının arka planındaki HTTP POST endpoint'lerini kullanarak, headless browser olmadan hızlı veri çekimi yapan bir Apify Actor. Selenium kullanmıyoruz — doğrudan HTTP istekleriyle çalışıyoruz.

### 1.3 Hedef Müşteriler

- Fintech geliştiriciler (fon analiz uygulamaları)
- Quantitative araştırmacılar / portföy yöneticileri
- Robo-advisor platformları
- Finansal veri agregasyonu yapan şirketler
- Bireysel yatırımcı araçları geliştiren indie developer'lar

### 1.4 Gelir Modeli

- **Apify Store** — PPE (Pay-Per-Event) modeli: ~$0.50 / 1000 fon-gün veri noktası
- **RapidAPI** — Freemium + ücretli katmanlar (paralel kanal)

---

## 2. Teknik Mimari

### 2.1 Teknoloji Stack'i

```
Runtime:        Node.js 20+ (Apify standart)
Framework:      Apify SDK + Crawlee (HttpCrawler — tarayıcı yok)
HTTP Client:    got-scraping veya undici (Apify uyumlu)
Veri İşleme:    JSON parse, tarih normalizasyonu
Çıktı:          Apify Dataset (JSON/CSV/Excel export)
Test:           Jest / Vitest
Dil:            TypeScript
```

### 2.2 TEFAS Site Yapısı — Reverse Engineering Notları

TEFAS sitesi ASP.NET WebForms kullanıyor. Kritik sayfalar:

#### Sayfa 1: Fon Analiz
```
URL: https://www.tefas.gov.tr/FonAnaliz.aspx?FonKod={FON_KODU}
Yöntem: Sayfa içinde chart verileri <script> bloğunda inline JavaScript olarak gömülü.
Veri: 5 yıllık günlük fiyat verileri grafik datasından parse edilebilir.
```

#### Sayfa 2: Tarihsel Veriler
```
URL: https://www.tefas.gov.tr/TarihselVeriler.aspx
Yöntem: ASP.NET WebForms POST — ViewState + EventValidation gerekli
Kısıt: Tek sorguda max 3 ay
Veri: Fon kodu, fon adı, fiyat, tedavüldeki pay sayısı, kişi sayısı, toplam değer
      + Portföy dağılımı (26 varlık sınıfı yüzdesi)
```

#### Sayfa 3: Fon Karşılaştırma
```
URL: https://www.tefas.gov.tr/FonKarsilastirma.aspx
Yöntem: POST form submission
Veri: Fon kategorileri, getiri karşılaştırmaları
```

#### Sayfa 4: İstatistiki Raporlar
```
URL: https://www.tefas.gov.tr/IstatistikiRaporlar/FonBazliIslemHacmi.aspx
Veri: İşlem hacimleri, üye bazlı veriler
```

### 2.3 Veri Çekme Stratejisi

```
ADIM 1: Initial Request (GET)
  → Sayfayı GET ile çek
  → __VIEWSTATE, __VIEWSTATEGENERATOR, __EVENTVALIDATION değerlerini parse et
  → Bu değerler her istekte güncellenmeli (ASP.NET anti-forgery mekanizması)

ADIM 2: Data Request (POST)
  → Form verilerini hazırla (fon kodu, tarih aralığı, fon tipi)
  → __VIEWSTATE + __EVENTVALIDATION + form alanları ile POST gönder
  → Response'daki HTML/JSON verisini parse et

ADIM 3: Pagination / Window Sliding
  → 3 aylık pencere kısıtlamasını aş: tarih aralığını 90'ar günlük dilimlere böl
  → Her dilim için ADIM 1-2'yi tekrarla
  → Tüm dilimleri birleştir, dedup yap
```

### 2.4 Anti-Bot / Rate Limiting Stratejisi

```
- İstekler arası minimum 1-2 saniye delay (respectful scraping)
- Apify Proxy kullanımı (residential proxy opsiyonel)
- User-Agent rotation
- Referrer header'ı doğru set et (tefas.gov.tr)
- Cookie/session yönetimi — her session için fresh ViewState
- Hata durumunda exponential backoff + retry (max 3)
```

---

## 3. Actor Input Schema

```json
{
  "title": "TEFAS Fund Scraper",
  "type": "object",
  "schemaVersion": 1,
  "properties": {
    "mode": {
      "title": "Scraping Mode",
      "type": "string",
      "description": "Veri çekme modu",
      "enum": ["daily", "historical", "fund_list", "fund_detail", "comparison"],
      "default": "daily"
    },
    "fundCodes": {
      "title": "Fund Codes",
      "type": "array",
      "description": "Çekilecek fon kodları listesi. Boş bırakılırsa tüm fonlar çekilir.",
      "items": { "type": "string" },
      "default": [],
      "editor": "stringList",
      "example": ["TTE", "AFT", "YAC", "IPB"]
    },
    "fundType": {
      "title": "Fund Type",
      "type": "string",
      "description": "Fon tipi filtresi",
      "enum": ["YAT", "EMK", "BYF", "ALL"],
      "enumTitles": ["Yatırım Fonu", "Emeklilik Fonu", "Borsa Yatırım Fonu", "Tümü"],
      "default": "ALL"
    },
    "startDate": {
      "title": "Start Date",
      "type": "string",
      "description": "Başlangıç tarihi (YYYY-MM-DD). Historical mode için zorunlu.",
      "editor": "datepicker",
      "example": "2024-01-01"
    },
    "endDate": {
      "title": "End Date",
      "type": "string",
      "description": "Bitiş tarihi (YYYY-MM-DD). Boş bırakılırsa bugünün tarihi kullanılır.",
      "editor": "datepicker",
      "example": "2024-12-31"
    },
    "includePortfolio": {
      "title": "Include Portfolio Allocation",
      "type": "boolean",
      "description": "Portföy dağılımı verilerini de çek (26 varlık sınıfı yüzdesi)",
      "default": false
    },
    "includeComparison": {
      "title": "Include Fund Category",
      "type": "boolean",
      "description": "Fon kategorisi bilgisini ekle (Hisse Fonu, Tahvil Fonu vb.)",
      "default": true
    },
    "outputCurrency": {
      "title": "Output Currency",
      "type": "string",
      "description": "Fiyat çıktı para birimi",
      "enum": ["TRY", "USD", "EUR"],
      "default": "TRY"
    },
    "maxRequestsPerMinute": {
      "title": "Max Requests Per Minute",
      "type": "integer",
      "description": "Dakikadaki maksimum istek sayısı (rate limiting)",
      "default": 30,
      "minimum": 5,
      "maximum": 60
    },
    "proxy": {
      "title": "Proxy Configuration",
      "type": "object",
      "description": "Apify proxy ayarları",
      "editor": "proxy",
      "default": { "useApifyProxy": true }
    }
  },
  "required": ["mode"]
}
```

---

## 4. Actor Output Schema

### 4.1 Mode: `daily` / `historical` — Fon Fiyat Verisi

```json
{
  "fundCode": "TTE",
  "fundName": "TEB PORTFÖY HİSSE SENEDİ FONU (HİSSE SENEDİ YOĞUN FON)",
  "fundType": "YAT",
  "fundCategory": "Hisse Senedi Fonu",
  "date": "2024-06-15",
  "price": 3.456789,
  "currency": "TRY",
  "totalValue": 1234567890.50,
  "sharesOutstanding": 357246813,
  "investorCount": 12450,
  "dailyReturn": 0.0234,
  "portfolio": {
    "stock": 85.23,
    "governmentBond": 5.12,
    "treasuryBill": 3.45,
    "corporateBond": 2.10,
    "eurobond": 0.00,
    "gold": 0.00,
    "cash": 4.10,
    "other": 0.00
  },
  "metadata": {
    "managementCompany": "TEB PORTFÖY YÖNETİMİ A.Ş.",
    "scrapedAt": "2024-06-15T18:30:00.000Z",
    "source": "tefas.gov.tr"
  }
}
```

### 4.2 Mode: `fund_list` — Tüm Fonların Listesi

```json
{
  "fundCode": "TTE",
  "fundName": "TEB PORTFÖY HİSSE SENEDİ FONU",
  "fundType": "YAT",
  "fundCategory": "Hisse Senedi Fonu",
  "managementCompany": "TEB PORTFÖY YÖNETİMİ A.Ş.",
  "isActive": true,
  "latestPrice": 3.456789,
  "latestDate": "2024-06-15",
  "totalValue": 1234567890.50,
  "investorCount": 12450
}
```

### 4.3 Mode: `fund_detail` — Tek Fon Detayı

```json
{
  "fundCode": "TTE",
  "fundName": "TEB PORTFÖY HİSSE SENEDİ FONU",
  "fundType": "YAT",
  "fundCategory": "Hisse Senedi Fonu",
  "managementCompany": "TEB PORTFÖY YÖNETİMİ A.Ş.",
  "currentPrice": 3.456789,
  "returns": {
    "daily": 0.0234,
    "weekly": 0.0567,
    "monthly": 0.1234,
    "threeMonth": 0.2345,
    "sixMonth": 0.3456,
    "ytd": 0.4567,
    "oneYear": 0.5678
  },
  "portfolio": { "...yukarıdaki gibi..." },
  "priceHistory": [
    { "date": "2024-06-15", "price": 3.456789 },
    { "date": "2024-06-14", "price": 3.434567 }
  ]
}
```

### 4.4 Mode: `comparison` — Fon Karşılaştırma

```json
{
  "fundCode": "TTE",
  "fundName": "TEB PORTFÖY HİSSE SENEDİ FONU",
  "fundCategory": "Hisse Senedi Fonu",
  "returnOneMonth": 0.1234,
  "returnThreeMonth": 0.2345,
  "returnSixMonth": 0.3456,
  "returnOneYear": 0.5678,
  "returnYTD": 0.4567,
  "totalValue": 1234567890.50,
  "investorCount": 12450,
  "rank": {
    "inCategory": 5,
    "totalInCategory": 45,
    "overall": 23,
    "totalFunds": 836
  }
}
```

---

## 5. Proje Dosya Yapısı

```
tefas-scraper/
├── .actor/
│   ├── actor.json              # Apify actor konfigürasyonu
│   └── input_schema.json       # Yukarıdaki input schema
├── src/
│   ├── main.ts                 # Actor entry point
│   ├── routes/
│   │   ├── daily.ts            # Günlük veri çekme modu
│   │   ├── historical.ts       # Tarihsel veri çekme modu
│   │   ├── fundList.ts         # Fon listesi çekme
│   │   ├── fundDetail.ts       # Tek fon detayı
│   │   └── comparison.ts       # Karşılaştırma modu
│   ├── scrapers/
│   │   ├── tefasClient.ts      # Ana TEFAS HTTP client (ViewState yönetimi)
│   │   ├── pricesScraper.ts    # Fiyat verisi scraper
│   │   ├── portfolioScraper.ts # Portföy dağılımı scraper
│   │   └── comparisonScraper.ts# Karşılaştırma verisi scraper
│   ├── parsers/
│   │   ├── htmlParser.ts       # ASP.NET HTML response parser
│   │   ├── chartParser.ts      # Grafik inline JS verisini parse et
│   │   └── excelParser.ts      # Excel response parser (eğer gerekirse)
│   ├── utils/
│   │   ├── dateWindows.ts      # 3 aylık pencere bölücü
│   │   ├── currencyConverter.ts# TRY/USD/EUR çevrim
│   │   ├── rateLimiter.ts      # Rate limiting yardımcısı
│   │   ├── retry.ts            # Exponential backoff retry
│   │   └── validators.ts       # Input validasyonu
│   └── types/
│       ├── fund.ts             # Fon veri tipleri
│       ├── input.ts            # Input schema tipleri
│       └── tefasResponse.ts    # TEFAS response tipleri
├── tests/
│   ├── tefasClient.test.ts
│   ├── dateWindows.test.ts
│   ├── htmlParser.test.ts
│   └── fixtures/
│       ├── sampleResponse.html # Test için örnek TEFAS HTML response
│       └── sampleChart.js      # Test için örnek chart verisi
├── package.json
├── tsconfig.json
├── .eslintrc.json
├── .gitignore
├── Dockerfile                  # Apify actor Dockerfile
├── README.md                   # Apify Store açıklama sayfası
└── CHANGELOG.md
```

---

## 6. Çekirdek Modül Detayları

### 6.1 `tefasClient.ts` — Ana HTTP Client

Bu modül tüm TEFAS iletişimini yönetir. Kritik sorumlulukları:

```typescript
// Pseudo-kod — implementasyon rehberi

class TefasClient {
  private session: got.Got; // veya undici client
  private viewState: string;
  private viewStateGenerator: string;
  private eventValidation: string;
  private cookies: CookieJar;

  /**
   * Yeni bir session başlat.
   * GET isteği ile sayfayı çek, ASP.NET hidden field'ları parse et.
   */
  async initSession(pageUrl: string): Promise<void> {
    const response = await this.session.get(pageUrl);
    this.viewState = this.extractHiddenField(response.body, '__VIEWSTATE');
    this.viewStateGenerator = this.extractHiddenField(response.body, '__VIEWSTATEGENERATOR');
    this.eventValidation = this.extractHiddenField(response.body, '__EVENTVALIDATION');
    // Cookie'leri sakla — ASP.NET session cookie kritik
  }

  /**
   * Form verisi ile POST isteği gönder.
   * Her POST sonrası ViewState güncellenir.
   */
  async postFormData(pageUrl: string, formData: Record<string, string>): Promise<string> {
    const payload = {
      __VIEWSTATE: this.viewState,
      __VIEWSTATEGENERATOR: this.viewStateGenerator,
      __EVENTVALIDATION: this.eventValidation,
      ...formData
    };

    const response = await this.session.post(pageUrl, {
      form: payload,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': pageUrl,
        'Origin': 'https://www.tefas.gov.tr',
        'User-Agent': '...rotated UA...'
      }
    });

    // Yeni ViewState'i güncelle (sonraki istekler için)
    this.viewState = this.extractHiddenField(response.body, '__VIEWSTATE');
    this.eventValidation = this.extractHiddenField(response.body, '__EVENTVALIDATION');

    return response.body;
  }

  private extractHiddenField(html: string, fieldName: string): string {
    // Regex veya cheerio ile id="fieldName" olan input'un value'sunu çek
    const regex = new RegExp(`id="${fieldName}".*?value="([^"]*)"`, 's');
    const match = html.match(regex);
    return match ? match[1] : '';
  }
}
```

### 6.2 `dateWindows.ts` — Tarih Penceresi Bölücü

```typescript
/**
 * TEFAS 3 aylık pencere kısıtlamasını aşmak için
 * tarih aralığını 90'ar günlük dilimlere böler.
 *
 * Örnek: 2023-01-01 → 2024-12-31 = 8 dilim
 */
interface DateWindow {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

function splitDateRange(startDate: string, endDate: string, maxDays: number = 90): DateWindow[] {
  // Implementation:
  // 1. startDate'ten başla
  // 2. maxDays kadar ilerle veya endDate'e ulaş
  // 3. Dilimleri array olarak döndür
  // 4. Son dilimin endDate'i aşmamasına dikkat et
}
```

### 6.3 `htmlParser.ts` — ASP.NET Response Parser

```typescript
/**
 * TEFAS'ın HTML response'larını parse eder.
 *
 * TarihselVeriler.aspx response'ı genelde bir HTML tablosu içerir:
 * <table id="MainContent_GridViewFonlar">
 *   <tr><th>TARİH</th><th>FON KODU</th><th>FON ADI</th>...</tr>
 *   <tr><td>15.06.2024</td><td>TTE</td><td>TEB PORTFÖY...</td>...</tr>
 * </table>
 *
 * Bazı response'lar Excel dosyası olarak da dönebilir.
 * FonAnaliz sayfası ise chart verisini inline <script> bloğunda barındırır.
 */

import * as cheerio from 'cheerio';

interface FundPriceRow {
  date: string;
  fundCode: string;
  fundName: string;
  price: number;
  sharesOutstanding: number;
  investorCount: number;
  totalValue: number;
}

function parseHistoricalTable(html: string): FundPriceRow[] {
  const $ = cheerio.load(html);
  const rows: FundPriceRow[] = [];

  $('#MainContent_GridViewFonlar tr').each((i, el) => {
    if (i === 0) return; // header row skip
    const cells = $(el).find('td');
    rows.push({
      date: normalizeDate($(cells[0]).text().trim()),    // DD.MM.YYYY → YYYY-MM-DD
      fundCode: $(cells[1]).text().trim(),
      fundName: $(cells[2]).text().trim(),
      price: parseFloat($(cells[3]).text().trim().replace(',', '.')),
      sharesOutstanding: parseFloat($(cells[4]).text().trim().replace(/\./g, '').replace(',', '.')),
      investorCount: parseInt($(cells[5]).text().trim().replace(/\./g, '')),
      totalValue: parseFloat($(cells[6]).text().trim().replace(/\./g, '').replace(',', '.'))
    });
  });

  return rows;
}

function normalizeDate(ddmmyyyy: string): string {
  // "15.06.2024" → "2024-06-15"
  const [day, month, year] = ddmmyyyy.split('.');
  return `${year}-${month}-${day}`;
}
```

### 6.4 `chartParser.ts` — FonAnaliz Grafik Verisi Parser

```typescript
/**
 * FonAnaliz.aspx sayfasında fon fiyat grafiği var.
 * Bu grafik verisi inline JavaScript <script> bloğunda gömülü.
 *
 * Grafik chartMainContent_FonFiyatGrafik ID'li bir Chart.js veya
 * ASP.NET Chart control instance'ı.
 *
 * Script bloğunu regex ile bulup, fiyat data array'ini parse ediyoruz.
 * Bu yöntemle 5 yıllık günlük veri tek seferde çekilebilir
 * (3 aylık pencere kısıtlaması yok).
 *
 * NOT: Bu yöntem kırılgan — TEFAS grafik yapısını değiştirirse bozulabilir.
 * Fallback olarak TarihselVeriler.aspx pencereleme yöntemini kullan.
 */

function parseChartData(html: string): Array<{date: string; price: number}> {
  // 1. "chartMainContent_FonFiyatGrafik" içeren <script> bloğunu bul
  // 2. İçindeki data array'ini (genelde categories: [...] ve series data: [...])
  //    regex veya JSON parse ile çıkar
  // 3. Tarih ve fiyat eşleştirmelerini döndür
}
```

---

## 7. Apify Actor Konfigürasyonu

### 7.1 `.actor/actor.json`

```json
{
  "actorSpecification": 1,
  "name": "tefas-fund-scraper",
  "title": "TEFAS Turkish Fund Data Scraper",
  "description": "Scrape investment fund data from Turkey's Electronic Fund Trading Platform (TEFAS). Get daily prices, historical data, portfolio allocations, and fund comparisons for 836+ Turkish mutual funds, pension funds, and ETFs.",
  "version": "1.0.0",
  "buildTag": "latest",
  "environmentVariables": {},
  "dockerfile": "./Dockerfile",
  "input": "./input_schema.json",
  "storages": {
    "dataset": {
      "actorSpecification": 1,
      "title": "TEFAS Fund Data",
      "views": {
        "overview": {
          "title": "Fund Prices",
          "transformation": {
            "fields": ["fundCode", "fundName", "date", "price", "totalValue", "investorCount"],
            "flatten": []
          },
          "display": {
            "component": "table",
            "properties": {
              "fundCode": { "label": "Fund Code", "format": "text" },
              "fundName": { "label": "Fund Name", "format": "text" },
              "date": { "label": "Date", "format": "date" },
              "price": { "label": "Price (TRY)", "format": "number" },
              "totalValue": { "label": "Total Value", "format": "number" },
              "investorCount": { "label": "Investors", "format": "number" }
            }
          }
        }
      }
    }
  }
}
```

### 7.2 Dockerfile

```dockerfile
FROM apify/actor-node:20

COPY --chown=myuser package*.json ./
RUN npm install --omit=dev --omit=optional \
    && npm cache clean --force

COPY --chown=myuser . ./

RUN npm run build

CMD ["npm", "start"]
```

### 7.3 package.json (Key Dependencies)

```json
{
  "name": "tefas-fund-scraper",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node dist/main.js",
    "build": "tsc",
    "test": "vitest run",
    "lint": "eslint src/"
  },
  "dependencies": {
    "apify": "^3.0.0",
    "crawlee": "^3.0.0",
    "cheerio": "^1.0.0",
    "got-scraping": "^4.0.0",
    "tough-cookie": "^4.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^1.0.0",
    "@types/node": "^20.0.0",
    "eslint": "^8.0.0"
  }
}
```

---

## 8. main.ts — Actor Entry Point

```typescript
import { Actor } from 'apify';
import { TefasClient } from './scrapers/tefasClient.js';
import { scrapeDailyData } from './routes/daily.js';
import { scrapeHistoricalData } from './routes/historical.js';
import { scrapeFundList } from './routes/fundList.js';
import { scrapeFundDetail } from './routes/fundDetail.js';
import { scrapeComparison } from './routes/comparison.js';
import type { Input } from './types/input.js';

await Actor.init();

const input = await Actor.getInput<Input>();
if (!input) throw new Error('Input is required');

// Validate input
validateInput(input);

// Initialize TEFAS client
const client = new TefasClient({
  maxRequestsPerMinute: input.maxRequestsPerMinute ?? 30,
  proxy: input.proxy,
});

// Charge PPE event at start — Apify monetization
await Actor.createChargeEvent({
  eventName: 'scrape-started',
});

try {
  let resultCount = 0;

  switch (input.mode) {
    case 'daily':
      resultCount = await scrapeDailyData(client, input);
      break;
    case 'historical':
      resultCount = await scrapeHistoricalData(client, input);
      break;
    case 'fund_list':
      resultCount = await scrapeFundList(client, input);
      break;
    case 'fund_detail':
      resultCount = await scrapeFundDetail(client, input);
      break;
    case 'comparison':
      resultCount = await scrapeComparison(client, input);
      break;
    default:
      throw new Error(`Unknown mode: ${input.mode}`);
  }

  // Charge per result — PPE billing
  // Her 100 sonuç için bir event charge et
  const chargeableUnits = Math.ceil(resultCount / 100);
  for (let i = 0; i < chargeableUnits; i++) {
    await Actor.createChargeEvent({
      eventName: 'data-points-100',
    });
  }

  Actor.log.info(`Scraping complete. ${resultCount} data points collected.`);

} catch (error) {
  Actor.log.error('Scraping failed', { error: (error as Error).message });
  throw error;
}

await Actor.exit();
```

---

## 9. Monetization — PPE Event Tanımları

Apify Store'da şu event'leri tanımla:

| Event Name | Açıklama | Önerilen Fiyat |
|---|---|---|
| `scrape-started` | Actor başarıyla başlatıldı | $0.01 |
| `data-points-100` | Her 100 fon-gün veri noktası | $0.05 |
| `fund-detail-report` | Tek fon detay raporu | $0.10 |
| `comparison-report` | Karşılaştırma raporu | $0.15 |

**Primary event:** `data-points-100` — Kullanıcılar Store sayfasında bunu görür.

**Örnek maliyet hesabı:**
- Günlük 836 fon çekmek = 836 data point = ~$0.42
- 1 yıllık tarihsel veri (836 fon × 250 iş günü) = 209,000 data point = ~$104.50
- Tek bir fonun 5 yıllık verisi = ~1,250 data point = ~$0.63

---

## 10. README.md — Apify Store Sayfası

README İngilizce yazılmalı — global erişim için. Şu bölümleri içermeli:

1. **Hero açıklama** — "Programmatic access to 836+ Turkish mutual funds, pension funds, and ETFs from TEFAS"
2. **Features listesi** — günlük fiyat, tarihsel veri, portföy, karşılaştırma
3. **Quick start code** — Python ve Node.js örnekleri ile Apify Client kullanımı
4. **Input parameters** — Tüm parametrelerin açıklaması
5. **Output examples** — JSON snippet'ları
6. **Use cases** — Fintech, quant research, robo-advisor, kişisel portföy takip
7. **Pricing** — PPE event açıklaması
8. **FAQ** — Rate limits, veri güncelleme sıklığı, desteklenen fon tipleri
9. **Limitations** — 3 aylık pencere notu, TEFAS kaynaklı gecikmeler

---

## 11. Test Stratejisi

### 11.1 Unit Tests

```
tests/
├── dateWindows.test.ts       # Tarih bölme doğru çalışıyor mu
├── htmlParser.test.ts        # HTML tablo parse doğru mu
├── chartParser.test.ts       # Chart verisi parse doğru mu
├── currencyConverter.test.ts # Kur çevrimi
└── validators.test.ts        # Input validasyonu
```

### 11.2 Integration Tests

```
- Gerçek TEFAS sitesine tek bir istek at (1 fon, 1 gün)
- Response yapısının değişip değişmediğini kontrol et
- ViewState mekanizmasının çalıştığını doğrula
```

### 11.3 Smoke Test (Apify'da)

```
- Actor'ü "daily" modunda çalıştır
- En az 10 fon verisi döndüğünü kontrol et
- Veri yapısının output schema'ya uygun olduğunu doğrula
```

---

## 12. Paralel Satış Kanalı: RapidAPI

Aynı core logic'i kullanarak, RapidAPI'da da listele:

```
RapidAPI Endpoint Planı:

GET /funds                    → Tüm fonların listesi
GET /funds/{code}             → Tek fon detayı
GET /funds/{code}/history     → Tarihsel fiyat verisi
GET /funds/{code}/portfolio   → Portföy dağılımı
GET /funds/compare            → Fon karşılaştırma
GET /market/summary           → Günlük piyasa özeti

Fiyatlandırma:
- Basic (Free):  100 istek/ay
- Pro ($9.99):   5,000 istek/ay
- Ultra ($29.99): 25,000 istek/ay
- Mega ($49.99):  Sınırsız
```

Bunun için ayrı bir FastAPI veya Express wrapper yazılacak. Mac Mini'ndeki sunucuda host edilebilir.

---

## 13. Yol Haritası

### Faz 1 — MVP (Hafta 1-2)
- [ ] TEFAS endpoint'lerini reverse-engineer et (DevTools ile)
- [ ] TefasClient — ViewState yönetimi ile HTTP POST
- [ ] Daily mode — tüm fonların günlük verisini çek
- [ ] Historical mode — 3 aylık pencere bölücü
- [ ] HTML tablo parser
- [ ] Unit test'ler
- [ ] Apify Store'a yayınla (free tier ile)

### Faz 2 — Genişletme (Hafta 3-4)
- [ ] Fund detail mode — chart data parser
- [ ] Portfolio allocation desteği
- [ ] Comparison mode
- [ ] PPE monetization aktif et
- [ ] README ve Store page optimize et

### Faz 3 — Paralel Kanal (Hafta 5-6)
- [ ] RapidAPI wrapper (FastAPI)
- [ ] Mac Mini'de deploy (Cloudflare Tunnel ile)
- [ ] RapidAPI Store'da listele

### Faz 4 — Katma Değer (Hafta 7+)
- [ ] Fon performans hesaplama (getiri, volatilite, Sharpe)
- [ ] Kategori bazlı ranking
- [ ] Webhook desteği (günlük veri bildirimi)
- [ ] MCP Server versiyonu (Claude Desktop entegrasyonu)

---

## 14. Kritik Uyarılar ve Riskler

### Yasal
- TEFAS terms of service'i otomatik veri çekimi konusunda belirsiz
- Çekilen veri halka açık ancak **ticari redistribution** farklı bir kategori
- Türkiye'de KVKK ve SPK düzenlemelerine dikkat
- **Öneri:** "Yatırım tavsiyesi değildir" disclaimer'ı her yerde olmalı

### Teknik
- ASP.NET ViewState değişebilir — parser'lar kırılabilir
- TEFAS IP ban uygulayabilir — Apify residential proxy kullan
- Site bakım/güncelleme dönemlerinde downtime olabilir
- Chart parser özellikle kırılgan — fallback mekanizması şart

### İş
- Niş pazar — Türk finans verisi talep eden developer sayısı sınırlı
- Gerçekçi gelir beklentisi: Aylık $200-800 (ilk 6 ay)
- Bakım maliyeti: Haftalık ~2 saat (site değişiklikleri kontrolü)

---

## 15. Referans Projeler (İncelenecek Kaynak Kodlar)

| Proje | URL | Yaklaşım | Not |
|---|---|---|---|
| tefas-crawler | github.com/burakyilmaz321/tefas-crawler | HTTP POST + pandas | En popüler, Python |
| finance-api | github.com/ahmethakanbesel/finance-api | Go + SQLite scraper | Multi-source |
| tefas (atahanuz) | github.com/atahanuz/tefas | Selenium | 5 yıl veri, yavaş |
| borsa-mcp | github.com/saidsurucu/borsa-mcp | FastMCP + TEFAS | MCP referans |
| tefas-api (serifcolakel) | Medium makalesi | Go + ChromeDP + Redis | Enterprise pattern |

---

## 16. Geliştirme Başlangıç Komutları

```bash
# Apify CLI ile proje oluştur
npx apify-cli create tefas-fund-scraper --template project_cheerio_crawler_ts

# Veya sıfırdan
mkdir tefas-scraper && cd tefas-scraper
npm init -y
npm install apify crawlee cheerio got-scraping tough-cookie
npm install -D typescript vitest @types/node

# TypeScript config
npx tsc --init

# Apify actor config
mkdir .actor
# actor.json ve input_schema.json dosyalarını oluştur

# Test
npm run test

# Local çalıştırma
npx apify-cli run

# Apify'a push
npx apify-cli push
```

---

> **Bu doküman Claude Code'a verildiğinde, önce `src/scrapers/tefasClient.ts` ve `src/utils/dateWindows.ts` ile başlamasını, ardından `src/parsers/htmlParser.ts` yazmasını, ve son olarak `src/main.ts` ile route'ları bağlamasını iste. Her adımda test yazsın.**
