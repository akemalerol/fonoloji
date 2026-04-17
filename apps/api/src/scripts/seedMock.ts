import { getDb } from '../db/index.js';
import {
  recomputeAllMetrics,
  recomputeCategoryStats,
  recomputeDailySummary,
} from '../analytics/recompute.js';

interface SeedFund {
  code: string;
  name: string;
  type: 'YAT' | 'EMK' | 'BYF';
  category: string;
  management_company: string;
  start_price: number;
  annual_drift: number; // drift in daily return units (~ annual / 252)
  volatility: number;   // annualized
  factor: number;       // loading on market factor
  baseline_investors: number;
  baseline_aum: number;
}

const FUNDS: SeedFund[] = [
  { code: 'TTE', name: 'TEB PORTFÖY HİSSE SENEDİ FONU', type: 'YAT', category: 'Hisse Senedi Fonu', management_company: 'TEB Portföy Yönetimi A.Ş.', start_price: 1.0, annual_drift: 0.55, volatility: 0.42, factor: 1.0, baseline_investors: 12000, baseline_aum: 1_200_000_000 },
  { code: 'AFT', name: 'AK PORTFÖY HİSSE SENEDİ FONU', type: 'YAT', category: 'Hisse Senedi Fonu', management_company: 'Ak Portföy Yönetimi A.Ş.', start_price: 1.0, annual_drift: 0.48, volatility: 0.40, factor: 0.95, baseline_investors: 15000, baseline_aum: 2_100_000_000 },
  { code: 'YAC', name: 'YAPI KREDİ PORTFÖY HİSSE SENEDİ FONU', type: 'YAT', category: 'Hisse Senedi Fonu', management_company: 'Yapı Kredi Portföy Yönetimi A.Ş.', start_price: 1.0, annual_drift: 0.52, volatility: 0.38, factor: 0.90, baseline_investors: 18000, baseline_aum: 2_800_000_000 },
  { code: 'IPB', name: 'İŞ PORTFÖY BIST 30 ENDEKS FONU', type: 'YAT', category: 'Hisse Senedi Fonu', management_company: 'İş Portföy Yönetimi A.Ş.', start_price: 1.0, annual_drift: 0.50, volatility: 0.44, factor: 1.05, baseline_investors: 25000, baseline_aum: 3_500_000_000 },
  { code: 'GAF', name: 'GARANTİ PORTFÖY HİSSE SENEDİ FONU', type: 'YAT', category: 'Hisse Senedi Fonu', management_company: 'Garanti Portföy Yönetimi A.Ş.', start_price: 1.0, annual_drift: 0.46, volatility: 0.39, factor: 0.92, baseline_investors: 20000, baseline_aum: 2_400_000_000 },

  { code: 'TZD', name: 'TEB PORTFÖY DEĞİŞKEN FON', type: 'YAT', category: 'Değişken Fon', management_company: 'TEB Portföy Yönetimi A.Ş.', start_price: 1.0, annual_drift: 0.35, volatility: 0.22, factor: 0.45, baseline_investors: 8000, baseline_aum: 650_000_000 },
  { code: 'AYB', name: 'AK PORTFÖY DEĞİŞKEN ÖZEL FON', type: 'YAT', category: 'Değişken Fon', management_company: 'Ak Portföy Yönetimi A.Ş.', start_price: 1.0, annual_drift: 0.38, volatility: 0.20, factor: 0.40, baseline_investors: 9500, baseline_aum: 820_000_000 },
  { code: 'GPD', name: 'GARANTİ PORTFÖY DEĞİŞKEN FON', type: 'YAT', category: 'Değişken Fon', management_company: 'Garanti Portföy Yönetimi A.Ş.', start_price: 1.0, annual_drift: 0.37, volatility: 0.24, factor: 0.50, baseline_investors: 7500, baseline_aum: 580_000_000 },

  { code: 'TI4', name: 'TEB PORTFÖY KISA VADELİ BORÇLANMA ARAÇLARI FONU', type: 'YAT', category: 'Tahvil Fonu', management_company: 'TEB Portföy Yönetimi A.Ş.', start_price: 1.0, annual_drift: 0.40, volatility: 0.06, factor: -0.15, baseline_investors: 11000, baseline_aum: 950_000_000 },
  { code: 'ATE', name: 'AK PORTFÖY KISA VADELİ BORÇLANMA ARAÇLARI FONU', type: 'YAT', category: 'Tahvil Fonu', management_company: 'Ak Portföy Yönetimi A.Ş.', start_price: 1.0, annual_drift: 0.42, volatility: 0.05, factor: -0.10, baseline_investors: 13500, baseline_aum: 1_100_000_000 },
  { code: 'YKT', name: 'YAPI KREDİ PORTFÖY UZUN VADELİ BORÇLANMA ARAÇLARI FONU', type: 'YAT', category: 'Tahvil Fonu', management_company: 'Yapı Kredi Portföy Yönetimi A.Ş.', start_price: 1.0, annual_drift: 0.36, volatility: 0.09, factor: -0.25, baseline_investors: 6500, baseline_aum: 480_000_000 },

  { code: 'TKF', name: 'TEB PORTFÖY PARA PİYASASI FONU', type: 'YAT', category: 'Para Piyasası Fonu', management_company: 'TEB Portföy Yönetimi A.Ş.', start_price: 1.0, annual_drift: 0.45, volatility: 0.02, factor: 0.02, baseline_investors: 22000, baseline_aum: 3_800_000_000 },
  { code: 'APP', name: 'AK PORTFÖY PARA PİYASASI FONU', type: 'YAT', category: 'Para Piyasası Fonu', management_company: 'Ak Portföy Yönetimi A.Ş.', start_price: 1.0, annual_drift: 0.44, volatility: 0.02, factor: 0.01, baseline_investors: 35000, baseline_aum: 5_200_000_000 },

  { code: 'TAU', name: 'TEB PORTFÖY ALTIN FONU', type: 'YAT', category: 'Kıymetli Madenler', management_company: 'TEB Portföy Yönetimi A.Ş.', start_price: 1.0, annual_drift: 0.62, volatility: 0.28, factor: -0.10, baseline_investors: 16000, baseline_aum: 1_450_000_000 },
  { code: 'AAU', name: 'AK PORTFÖY ALTIN FONU', type: 'YAT', category: 'Kıymetli Madenler', management_company: 'Ak Portföy Yönetimi A.Ş.', start_price: 1.0, annual_drift: 0.58, volatility: 0.30, factor: -0.08, baseline_investors: 14500, baseline_aum: 1_200_000_000 },
  { code: 'GAU', name: 'GARANTİ PORTFÖY ALTIN FONU', type: 'YAT', category: 'Kıymetli Madenler', management_company: 'Garanti Portföy Yönetimi A.Ş.', start_price: 1.0, annual_drift: 0.60, volatility: 0.29, factor: -0.09, baseline_investors: 19000, baseline_aum: 1_850_000_000 },

  { code: 'TEU', name: 'TEB PORTFÖY EUROBOND (DÖVİZ) FONU', type: 'YAT', category: 'Eurobond', management_company: 'TEB Portföy Yönetimi A.Ş.', start_price: 1.0, annual_drift: 0.50, volatility: 0.18, factor: 0.15, baseline_investors: 7000, baseline_aum: 620_000_000 },
  { code: 'ADE', name: 'AK PORTFÖY EUROBOND (DÖVİZ) FONU', type: 'YAT', category: 'Eurobond', management_company: 'Ak Portföy Yönetimi A.Ş.', start_price: 1.0, annual_drift: 0.52, volatility: 0.17, factor: 0.12, baseline_investors: 8500, baseline_aum: 780_000_000 },

  { code: 'IAE', name: 'İŞ PORTFÖY BIST 30 A TİPİ BORSA YATIRIM FONU', type: 'BYF', category: 'BYF - Hisse', management_company: 'İş Portföy Yönetimi A.Ş.', start_price: 10.0, annual_drift: 0.51, volatility: 0.43, factor: 1.02, baseline_investors: 5500, baseline_aum: 420_000_000 },
  { code: 'Z30', name: 'Z PORTFÖY BIST 30 BANKA BYF', type: 'BYF', category: 'BYF - Sektör', management_company: 'Ziraat Portföy Yönetimi A.Ş.', start_price: 10.0, annual_drift: 0.44, volatility: 0.48, factor: 1.15, baseline_investors: 3200, baseline_aum: 210_000_000 },
  { code: 'GAB', name: 'GARANTİ PORTFÖY ALTIN BYF', type: 'BYF', category: 'BYF - Altın', management_company: 'Garanti Portföy Yönetimi A.Ş.', start_price: 10.0, annual_drift: 0.59, volatility: 0.27, factor: -0.08, baseline_investors: 8500, baseline_aum: 650_000_000 },

  { code: 'AVT', name: 'AVİVASA EMEKLİLİK HİSSE GRUBU STANDART EMEKLİLİK YATIRIM FONU', type: 'EMK', category: 'Emeklilik - Hisse', management_company: 'Aviva Sigorta A.Ş.', start_price: 1.0, annual_drift: 0.47, volatility: 0.38, factor: 0.88, baseline_investors: 45000, baseline_aum: 4_200_000_000 },
  { code: 'ANA', name: 'ANADOLU HAYAT EMEKLİLİK KATILIM STANDART E.Y.F.', type: 'EMK', category: 'Emeklilik - Katılım', management_company: 'Anadolu Hayat Emeklilik A.Ş.', start_price: 1.0, annual_drift: 0.43, volatility: 0.20, factor: 0.35, baseline_investors: 38000, baseline_aum: 3_100_000_000 },
  { code: 'GHE', name: 'GARANTİ EMEKLİLİK VE HAYAT A.Ş. HİSSE SENEDİ E.Y.F.', type: 'EMK', category: 'Emeklilik - Hisse', management_company: 'Garanti Emeklilik A.Ş.', start_price: 1.0, annual_drift: 0.48, volatility: 0.40, factor: 0.92, baseline_investors: 52000, baseline_aum: 5_800_000_000 },
  { code: 'AEL', name: 'ALLIANZ YAŞAM VE EMEKLİLİK LİKİT FON E.Y.F.', type: 'EMK', category: 'Emeklilik - Para Piyasası', management_company: 'Allianz Yaşam ve Emeklilik A.Ş.', start_price: 1.0, annual_drift: 0.44, volatility: 0.03, factor: 0.02, baseline_investors: 71000, baseline_aum: 8_200_000_000 },
  { code: 'NNK', name: 'NN HAYAT VE EMEKLİLİK KATKI E.Y.F.', type: 'EMK', category: 'Emeklilik - Katkı', management_company: 'NN Hayat ve Emeklilik A.Ş.', start_price: 1.0, annual_drift: 0.41, volatility: 0.08, factor: 0.10, baseline_investors: 28000, baseline_aum: 2_300_000_000 },

  { code: 'FPD', name: 'FİBA PORTFÖY DEĞİŞKEN FON', type: 'YAT', category: 'Değişken Fon', management_company: 'Fiba Portföy Yönetimi A.Ş.', start_price: 1.0, annual_drift: 0.36, volatility: 0.23, factor: 0.48, baseline_investors: 4500, baseline_aum: 320_000_000 },
  { code: 'QBB', name: 'QNB FİNANS PORTFÖY BIST 30 HİSSE SENEDİ YOĞUN FON', type: 'YAT', category: 'Hisse Senedi Fonu', management_company: 'QNB Finans Portföy Yönetimi A.Ş.', start_price: 1.0, annual_drift: 0.49, volatility: 0.41, factor: 1.00, baseline_investors: 11000, baseline_aum: 1_050_000_000 },
  { code: 'IGH', name: 'İSTANBUL PORTFÖY GÜNEŞLİ HİSSE SENEDİ FONU', type: 'YAT', category: 'Hisse Senedi Fonu', management_company: 'İstanbul Portföy Yönetimi A.Ş.', start_price: 1.0, annual_drift: 0.56, volatility: 0.46, factor: 1.08, baseline_investors: 2800, baseline_aum: 180_000_000 },
];

// Auto-generated synthetic funds to approximate TEFAS's 836+ universe so demo feels realistic.
const COMPANIES: Array<{ prefix: string; name: string }> = [
  { prefix: 'T', name: 'TEB Portföy Yönetimi A.Ş.' },
  { prefix: 'A', name: 'Ak Portföy Yönetimi A.Ş.' },
  { prefix: 'Y', name: 'Yapı Kredi Portföy Yönetimi A.Ş.' },
  { prefix: 'I', name: 'İş Portföy Yönetimi A.Ş.' },
  { prefix: 'G', name: 'Garanti Portföy Yönetimi A.Ş.' },
  { prefix: 'Z', name: 'Ziraat Portföy Yönetimi A.Ş.' },
  { prefix: 'Q', name: 'QNB Finans Portföy Yönetimi A.Ş.' },
  { prefix: 'F', name: 'Fiba Portföy Yönetimi A.Ş.' },
  { prefix: 'H', name: 'Halk Portföy Yönetimi A.Ş.' },
  { prefix: 'D', name: 'Deniz Portföy Yönetimi A.Ş.' },
  { prefix: 'N', name: 'ING Portföy Yönetimi A.Ş.' },
  { prefix: 'V', name: 'Vakıf Portföy Yönetimi A.Ş.' },
  { prefix: 'K', name: 'Kare Portföy Yönetimi A.Ş.' },
  { prefix: 'L', name: 'Azimut Portföy Yönetimi A.Ş.' },
  { prefix: 'P', name: 'Pasha Yatırım Bankası A.Ş.' },
  { prefix: 'R', name: 'RE-PIE Portföy Yönetimi A.Ş.' },
  { prefix: 'B', name: 'BNP Paribas Portföy Yönetimi A.Ş.' },
  { prefix: 'U', name: 'UB Portföy Yönetimi A.Ş.' },
];

const VARIANTS: Array<{
  suffix: string;
  nameSuffix: string;
  type: 'YAT' | 'EMK' | 'BYF';
  category: string;
  drift: number;
  vol: number;
  factor: number;
  investorScale: number;
  aumScale: number;
}> = [
  { suffix: 'HI', nameSuffix: 'HİSSE SENEDİ FONU', type: 'YAT', category: 'Hisse Senedi Fonu', drift: 0.5, vol: 0.42, factor: 1.0, investorScale: 1.0, aumScale: 1.0 },
  { suffix: 'HZ', nameSuffix: 'HİSSE SENEDİ YOĞUN FON', type: 'YAT', category: 'Hisse Senedi Fonu', drift: 0.54, vol: 0.44, factor: 1.05, investorScale: 0.7, aumScale: 0.6 },
  { suffix: 'BN', nameSuffix: 'BIST 100 ENDEKS FONU', type: 'YAT', category: 'Hisse Senedi Fonu', drift: 0.48, vol: 0.41, factor: 0.98, investorScale: 0.8, aumScale: 0.75 },
  { suffix: 'DE', nameSuffix: 'DEĞİŞKEN FON', type: 'YAT', category: 'Değişken Fon', drift: 0.37, vol: 0.22, factor: 0.45, investorScale: 0.6, aumScale: 0.5 },
  { suffix: 'DO', nameSuffix: 'DEĞİŞKEN ÖZEL FON', type: 'YAT', category: 'Değişken Fon', drift: 0.39, vol: 0.21, factor: 0.42, investorScale: 0.4, aumScale: 0.35 },
  { suffix: 'TH', nameSuffix: 'KISA VADELİ BORÇLANMA ARAÇLARI FONU', type: 'YAT', category: 'Tahvil Fonu', drift: 0.41, vol: 0.06, factor: -0.15, investorScale: 0.9, aumScale: 0.8 },
  { suffix: 'TU', nameSuffix: 'UZUN VADELİ BORÇLANMA ARAÇLARI FONU', type: 'YAT', category: 'Tahvil Fonu', drift: 0.37, vol: 0.09, factor: -0.22, investorScale: 0.5, aumScale: 0.4 },
  { suffix: 'PP', nameSuffix: 'PARA PİYASASI FONU', type: 'YAT', category: 'Para Piyasası Fonu', drift: 0.45, vol: 0.02, factor: 0.02, investorScale: 2.0, aumScale: 2.5 },
  { suffix: 'KL', nameSuffix: 'LİKİT KAMU FON', type: 'YAT', category: 'Para Piyasası Fonu', drift: 0.44, vol: 0.02, factor: 0.01, investorScale: 1.5, aumScale: 1.8 },
  { suffix: 'AL', nameSuffix: 'ALTIN FONU', type: 'YAT', category: 'Kıymetli Madenler', drift: 0.6, vol: 0.29, factor: -0.08, investorScale: 1.1, aumScale: 1.0 },
  { suffix: 'KG', nameSuffix: 'GÜMÜŞ FONU', type: 'YAT', category: 'Kıymetli Madenler', drift: 0.55, vol: 0.34, factor: -0.12, investorScale: 0.3, aumScale: 0.2 },
  { suffix: 'EB', nameSuffix: 'EUROBOND (DÖVİZ) FONU', type: 'YAT', category: 'Eurobond', drift: 0.51, vol: 0.18, factor: 0.14, investorScale: 0.5, aumScale: 0.45 },
  { suffix: 'DY', nameSuffix: 'DIŞ BORÇLANMA ARAÇLARI FONU', type: 'YAT', category: 'Eurobond', drift: 0.49, vol: 0.19, factor: 0.16, investorScale: 0.4, aumScale: 0.35 },
  { suffix: 'KT', nameSuffix: 'KATILIM FONU', type: 'YAT', category: 'Katılım Fonu', drift: 0.42, vol: 0.19, factor: 0.3, investorScale: 0.6, aumScale: 0.5 },
  { suffix: 'KY', nameSuffix: 'KATILIM HİSSE SENEDİ FONU', type: 'YAT', category: 'Katılım Fonu', drift: 0.48, vol: 0.38, factor: 0.85, investorScale: 0.5, aumScale: 0.4 },
  { suffix: 'BA', nameSuffix: 'BIST 30 BORSA YATIRIM FONU', type: 'BYF', category: 'BYF - Hisse', drift: 0.51, vol: 0.43, factor: 1.02, investorScale: 0.3, aumScale: 0.25 },
  { suffix: 'BG', nameSuffix: 'ALTIN BORSA YATIRIM FONU', type: 'BYF', category: 'BYF - Altın', drift: 0.59, vol: 0.28, factor: -0.08, investorScale: 0.4, aumScale: 0.3 },
  { suffix: 'BK', nameSuffix: 'BANKACILIK SEKTÖRÜ BYF', type: 'BYF', category: 'BYF - Sektör', drift: 0.44, vol: 0.48, factor: 1.15, investorScale: 0.2, aumScale: 0.15 },
  { suffix: 'EH', nameSuffix: 'EMEKLİLİK HİSSE SENEDİ FONU', type: 'EMK', category: 'Emeklilik - Hisse', drift: 0.47, vol: 0.38, factor: 0.88, investorScale: 3.0, aumScale: 2.8 },
  { suffix: 'EK', nameSuffix: 'EMEKLİLİK KATILIM STANDART FONU', type: 'EMK', category: 'Emeklilik - Katılım', drift: 0.43, vol: 0.2, factor: 0.35, investorScale: 2.5, aumScale: 2.2 },
  { suffix: 'EP', nameSuffix: 'EMEKLİLİK PARA PİYASASI FONU', type: 'EMK', category: 'Emeklilik - Para Piyasası', drift: 0.44, vol: 0.03, factor: 0.02, investorScale: 4.0, aumScale: 4.5 },
  { suffix: 'EB', nameSuffix: 'EMEKLİLİK BORÇLANMA ARAÇLARI FONU', type: 'EMK', category: 'Emeklilik - Borçlanma', drift: 0.41, vol: 0.08, factor: -0.1, investorScale: 2.0, aumScale: 1.8 },
  { suffix: 'EK', nameSuffix: 'EMEKLİLİK KATKI FONU', type: 'EMK', category: 'Emeklilik - Katkı', drift: 0.41, vol: 0.08, factor: 0.1, investorScale: 2.0, aumScale: 1.7 },
  { suffix: 'ED', nameSuffix: 'EMEKLİLİK DEĞİŞKEN FONU', type: 'EMK', category: 'Emeklilik - Değişken', drift: 0.4, vol: 0.22, factor: 0.42, investorScale: 1.5, aumScale: 1.3 },
];

function codeChar(i: number): string {
  return String.fromCharCode(65 + (i % 26));
}

function generateSynthetic(): SeedFund[] {
  const out: SeedFund[] = [];
  const used = new Set(FUNDS.map((f) => f.code));
  let variantOffset = 0;
  for (const co of COMPANIES) {
    const variantCount = 8 + (variantOffset % 5);
    for (let i = 0; i < variantCount; i++) {
      const v = VARIANTS[(variantOffset + i) % VARIANTS.length]!;
      const third = codeChar(variantOffset + i);
      const code = `${co.prefix}${v.suffix[0]}${third}`;
      if (used.has(code) || code.length !== 3) continue;
      used.add(code);
      const drift = v.drift * (0.92 + Math.random() * 0.16);
      const vol = v.vol * (0.85 + Math.random() * 0.3);
      const factor = v.factor * (0.85 + Math.random() * 0.3);
      const investors = Math.round(4000 * v.investorScale * (0.5 + Math.random() * 1.5));
      const aum = Math.round(400_000_000 * v.aumScale * (0.3 + Math.random() * 1.7));
      const name = `${co.name.replace(' A.Ş.', '').toUpperCase()} ${v.nameSuffix}`.replace('YÖNETİMİ', 'PORTFÖY');
      out.push({
        code,
        name,
        type: v.type,
        category: v.category,
        management_company: co.name,
        start_price: v.type === 'BYF' ? 10 : 1,
        annual_drift: drift,
        volatility: vol,
        factor,
        baseline_investors: investors,
        baseline_aum: aum,
      });
      variantOffset++;
    }
  }
  return out;
}

FUNDS.push(...generateSynthetic());


const TRADING_DAYS = 500;
const DAILY_DRIFT_DIVISOR = 252;
const DAILY_VOL_DIVISOR = Math.sqrt(252);

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isWeekend(d: Date): boolean {
  const dow = d.getUTCDay();
  return dow === 0 || dow === 6;
}

function main(): void {
  const db = getDb();

  // Clean existing mock data so seed is idempotent.
  db.exec(`
    DELETE FROM prices;
    DELETE FROM funds;
    DELETE FROM metrics;
    DELETE FROM portfolio_snapshots;
    DELETE FROM daily_summary;
    DELETE FROM category_stats;
  `);

  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - TRADING_DAYS * 1.45);

  // Generate a shared "market factor" returns series.
  const marketRng = mulberry32(42);
  const marketVol = 0.32 / DAILY_VOL_DIVISOR;
  const marketDrift = 0.45 / DAILY_DRIFT_DIVISOR;
  const marketReturns: number[] = [];
  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    if (!isWeekend(cursor)) {
      dates.push(isoDate(cursor));
      marketReturns.push(marketDrift + marketVol * normal(marketRng));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const insertFund = db.prepare(
    `INSERT INTO funds (code, name, type, category, management_company, first_seen, last_seen, updated_at)
     VALUES (@code, @name, @type, @category, @management_company, @first_seen, @last_seen, @updated_at)`,
  );
  const insertPrice = db.prepare(
    `INSERT INTO prices (code, date, price, shares_outstanding, investor_count, total_value)
     VALUES (@code, @date, @price, @shares_outstanding, @investor_count, @total_value)`,
  );
  const insertPortfolio = db.prepare(
    `INSERT INTO portfolio_snapshots (code, date, stock, government_bond, treasury_bill, corporate_bond, eurobond, gold, cash, other)
     VALUES (@code, @date, @stock, @government_bond, @treasury_bill, @corporate_bond, @eurobond, @gold, @cash, @other)`,
  );

  const now = Date.now();
  const txn = db.transaction(() => {
    for (const fund of FUNDS) {
      const rng = mulberry32(hashSeed(fund.code));
      const idioDrift = fund.annual_drift / DAILY_DRIFT_DIVISOR;
      const idioVol = fund.volatility / DAILY_VOL_DIVISOR;

      let price = fund.start_price;
      let investors = fund.baseline_investors * (0.6 + rng() * 0.4);
      let aum = fund.baseline_aum * (0.6 + rng() * 0.4);

      insertFund.run({
        code: fund.code,
        name: fund.name,
        type: fund.type,
        category: fund.category,
        management_company: fund.management_company,
        first_seen: dates[0]!,
        last_seen: dates[dates.length - 1]!,
        updated_at: now,
      });

      for (let i = 0; i < dates.length; i++) {
        const date = dates[i]!;
        const idio = idioDrift + idioVol * normal(rng);
        const ret = idio + fund.factor * marketReturns[i]!;
        price = Math.max(0.001, price * (1 + ret));

        // AUM and investor drift
        aum *= 1 + ret + (rng() - 0.5) * 0.004;
        investors += (rng() - 0.45) * fund.baseline_investors * 0.0025;

        insertPrice.run({
          code: fund.code,
          date,
          price,
          shares_outstanding: aum / price,
          investor_count: Math.max(100, Math.round(investors)),
          total_value: aum,
        });
      }

      // Portfolio snapshot by category
      const portfolio = buildPortfolio(fund.category, rng);
      insertPortfolio.run({
        code: fund.code,
        date: dates[dates.length - 1]!,
        ...portfolio,
      });
    }
  });
  txn();

  console.log(`[seed] ${FUNDS.length} fon, ${dates.length} gün, ${FUNDS.length * dates.length} fiyat satırı`);

  console.log('[seed] Metrics hesaplanıyor…');
  recomputeAllMetrics(db);
  recomputeDailySummary(db);
  recomputeCategoryStats(db);
  console.log('[seed] Tamamlandı.');
}

function hashSeed(code: string): number {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h << 5) - h + code.charCodeAt(i);
  return (h >>> 0) || 1;
}

function buildPortfolio(category: string, rng: () => number) {
  const base = {
    stock: 0,
    government_bond: 0,
    treasury_bill: 0,
    corporate_bond: 0,
    eurobond: 0,
    gold: 0,
    cash: 0,
    other: 0,
  };
  const jitter = (v: number) => Math.max(0, v + (rng() - 0.5) * 6);
  const norm = (obj: typeof base) => {
    const total = Object.values(obj).reduce((a, b) => a + b, 0);
    if (total === 0) return obj;
    for (const k of Object.keys(obj) as Array<keyof typeof obj>) obj[k] = (obj[k] / total) * 100;
    return obj;
  };
  switch (true) {
    case /Hisse/.test(category):
      return norm({ ...base, stock: jitter(85), cash: jitter(5), corporate_bond: jitter(4), government_bond: jitter(3), other: jitter(3) });
    case /Tahvil/.test(category):
      return norm({ ...base, government_bond: jitter(50), corporate_bond: jitter(25), treasury_bill: jitter(15), cash: jitter(8), other: jitter(2) });
    case /Para Piyasası/.test(category):
      return norm({ ...base, cash: jitter(60), government_bond: jitter(25), treasury_bill: jitter(12), other: jitter(3) });
    case /Değişken/.test(category):
      return norm({ ...base, stock: jitter(40), government_bond: jitter(20), corporate_bond: jitter(12), cash: jitter(15), gold: jitter(8), other: jitter(5) });
    case /Altın|Kıymetli/.test(category):
      return norm({ ...base, gold: jitter(85), cash: jitter(10), other: jitter(5) });
    case /Eurobond/.test(category):
      return norm({ ...base, eurobond: jitter(80), cash: jitter(12), government_bond: jitter(5), other: jitter(3) });
    case /Emeklilik/.test(category):
      return norm({ ...base, stock: jitter(45), government_bond: jitter(25), corporate_bond: jitter(10), gold: jitter(5), cash: jitter(10), other: jitter(5) });
    case /BYF/.test(category):
      return norm({ ...base, stock: jitter(70), cash: jitter(15), gold: jitter(10), other: jitter(5) });
    default:
      return norm({ ...base, stock: jitter(30), government_bond: jitter(30), cash: jitter(25), other: jitter(15) });
  }
}

main();
