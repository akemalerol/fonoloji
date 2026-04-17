// Category and fund-name decoders — turn cryptic TEFAS labels into readable insight.

export const CATEGORY_DICT: Record<string, { short: string; who: string; risk: 'low' | 'mid' | 'high' }> = {
  'Hisse Senedi Şemsiye Fonu': {
    short: 'Portföyünün büyük kısmı BIST hisse senetlerinden oluşur. Büyüme odaklı.',
    who: 'Uzun vadeli, volatiliteye dayanıklı yatırımcı için.',
    risk: 'high',
  },
  'Hisse Senedi Yoğun Fon': {
    short: 'Portföyünün en az %80\'i hisse. Kısa vadede sert iniş-çıkışa hazırlıklı olun.',
    who: 'Hisseye yoğun ağırlık vermek isteyen.',
    risk: 'high',
  },
  'Borçlanma Araçları Şemsiye Fonu': {
    short: 'Devlet/özel sektör tahvil ve bonolarına yatırır. Düzenli faiz geliri odaklı.',
    who: 'Orta vadeli, sabit getiri arayan yatırımcı.',
    risk: 'mid',
  },
  'Para Piyasası Şemsiye Fonu': {
    short: 'Kısa vadeli repo, mevduat, hazine bonosu. Düşük risk, düşük volatilite.',
    who: 'Nakit parasını değerlendirmek isteyen.',
    risk: 'low',
  },
  'Katılım Şemsiye Fonu': {
    short: 'Faiz içermeyen, İslami finansa uygun ürünler (sukuk, katılım hesabı).',
    who: 'İslami prensiplere uyum arayan yatırımcı.',
    risk: 'mid',
  },
  'Altın Katılım Fonu': {
    short: 'Fiziki altın / altın sertifikalarına yatırır. Enflasyon hedgesi.',
    who: 'Altın tutmak isteyen, TL volatilitesinden korunmak isteyen.',
    risk: 'mid',
  },
  'Kıymetli Madenler Şemsiye Fonu': {
    short: 'Altın, gümüş ve diğer değerli madenler. Enflasyon/döviz hedgesi.',
    who: 'Değerli madenlerle çeşitlendirme isteyen.',
    risk: 'mid',
  },
  'Değişken Şemsiye Fonu': {
    short: 'Hisse, tahvil, altın, döviz arasında dinamik dağılım yapar. Yönetici kararlı.',
    who: 'Yönetim ekibine güvenen, aktif yönetim isteyen.',
    risk: 'mid',
  },
  'Fon Sepeti Şemsiye Fonu': {
    short: 'Başka fonlara yatırım yapar (fund-of-funds). Çeşitlendirme aracı.',
    who: 'Birden fazla fonu tek ürünle almak isteyen.',
    risk: 'mid',
  },
  'Karma Şemsiye Fonu': {
    short: 'Hisse + tahvil + altın karması. Dengeli profil.',
    who: 'Orta risk toleransı olan, çeşitlendirme arayan.',
    risk: 'mid',
  },
  'Serbest Şemsiye Fonu': {
    short: 'Her tür varlığa yatırabilir, nitelikli yatırımcı fonudur. Genelde yüksek getiri-risk.',
    who: 'Yüksek getiri beklentisi olan, daha yüksek risk alabilen.',
    risk: 'high',
  },
  'Hisse Senedi Yoğun BYF': {
    short: 'Hisse odaklı borsa yatırım fonu (ETF). Anlık BIST fiyatı ile işlem görür.',
    who: 'Borsada anlık alım-satım yapan yatırımcı.',
    risk: 'high',
  },
  'BYF': {
    short: 'Borsa Yatırım Fonu (ETF). Bir endeksi veya varlığı takip eder.',
    who: 'Pasif yönetim + düşük masraf isteyen.',
    risk: 'mid',
  },
  'Eurobond Fon': {
    short: 'Türk hazine Eurobond\'larına yatırır. Dolar/Euro bazlı sabit getiri.',
    who: 'Döviz bazlı sabit getiri isteyen.',
    risk: 'mid',
  },
  'Gayrimenkul Yatırım Fonu': {
    short: 'Gayrimenkul ve gayrimenkul sertifikalarına yatırır.',
    who: 'Likit gayrimenkul riski arayan yatırımcı.',
    risk: 'mid',
  },
  'OKS Standart Fon': {
    short: 'Bireysel Emeklilik Sistemi (BES) standart fonu. Dengeli dağılım.',
    who: 'BES katılımcıları.',
    risk: 'mid',
  },
};

export function decodeCategory(name?: string | null) {
  if (!name) return null;
  // Exact match first
  if (CATEGORY_DICT[name]) return CATEGORY_DICT[name];
  // Fuzzy (contains)
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(CATEGORY_DICT)) {
    if (lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower)) return v;
  }
  return null;
}

// Fund-name decoder: breaks a fund name into tags.
// Input: "AK PORTFÖY EUROBOND SERBEST (DÖVİZ) FONU"
// Output: [{label: 'Ak Portföy', type: 'company'}, {label: 'Eurobond', type: 'asset'}, ...]
export interface NameTag {
  label: string;
  kind: 'company' | 'asset' | 'structure' | 'currency' | 'access';
}

const TAG_PATTERNS: Array<{ re: RegExp; label: string; kind: NameTag['kind'] }> = [
  { re: /\beurobond\b/i, label: 'Eurobond', kind: 'asset' },
  { re: /\baltın\b/i, label: 'Altın', kind: 'asset' },
  { re: /\bgümüş\b/i, label: 'Gümüş', kind: 'asset' },
  { re: /\bhisse senedi\b/i, label: 'Hisse Senedi', kind: 'asset' },
  { re: /\bpara piyasası\b/i, label: 'Para Piyasası', kind: 'asset' },
  { re: /\bkatılım\b/i, label: 'Katılım (İslami)', kind: 'asset' },
  { re: /\bdeğişken\b/i, label: 'Değişken', kind: 'structure' },
  { re: /\bkarma\b/i, label: 'Karma', kind: 'structure' },
  { re: /\bçoklu varlık\b/i, label: 'Çoklu Varlık', kind: 'structure' },
  { re: /\bserbest\b/i, label: 'Serbest (nitelikli)', kind: 'access' },
  { re: /\bfon sepeti\b/i, label: 'Fon Sepeti', kind: 'structure' },
  { re: /\bemeklilik\b/i, label: 'BES (Emeklilik)', kind: 'access' },
  { re: /\bokr\b|\boks\b/i, label: 'OKS (Emeklilik)', kind: 'access' },
  { re: /\bborsa yatırım fonu\b|\bbyf\b/i, label: 'BYF (ETF)', kind: 'structure' },
  { re: /\(döviz\)|\bdöviz\b/i, label: 'Döviz', kind: 'currency' },
  { re: /\b\(usd\)|dolar\b/i, label: 'USD', kind: 'currency' },
  { re: /\b\(eur\)|euro\b/i, label: 'EUR', kind: 'currency' },
  { re: /\(tl\)|türk lirası/i, label: 'TL', kind: 'currency' },
  { re: /\bbist\b|\bborsa istanbul\b/i, label: 'BIST', kind: 'asset' },
  { re: /\btahvil\b|\bbono\b|\bborçlanma\b/i, label: 'Tahvil/Bono', kind: 'asset' },
  { re: /\bendeks\b/i, label: 'Endeks', kind: 'structure' },
  { re: /\bsürdürülebilir\b|\besg\b/i, label: 'Sürdürülebilirlik (ESG)', kind: 'structure' },
  { re: /\btematik\b/i, label: 'Tematik', kind: 'structure' },
  { re: /\byabancı\b/i, label: 'Yabancı', kind: 'asset' },
  { re: /\bkira sertifikası\b|\bsukuk\b/i, label: 'Kira Sertifikası', kind: 'asset' },
  { re: /\bgayrimenkul\b/i, label: 'Gayrimenkul', kind: 'asset' },
];

export function decodeFundName(name: string, managementCompany?: string | null): NameTag[] {
  const tags: NameTag[] = [];
  const seen = new Set<string>();

  if (managementCompany) {
    const label = managementCompany.replace(/\s+(portföy|portfoy)\s+yönetimi.*$/i, ' Portföy').trim();
    tags.push({ label, kind: 'company' });
    seen.add(label);
  }

  for (const { re, label, kind } of TAG_PATTERNS) {
    if (seen.has(label)) continue;
    if (re.test(name)) {
      tags.push({ label, kind });
      seen.add(label);
    }
  }

  return tags;
}

// Editorial snippet — auto-generated 2-3 sentence commentary from numbers.
export function editorialSnippet(f: {
  return_1m?: number | null;
  return_1y?: number | null;
  flow_1m?: number | null;
  volatility_90?: number | null;
  sharpe_90?: number | null;
  real_return_1y?: number | null;
  max_drawdown_1y?: number | null;
}): string[] {
  const lines: string[] = [];

  // Line 1: momentum
  if (f.return_1m !== undefined && f.return_1m !== null) {
    if (f.return_1m > 0.1) lines.push(`Son 30 günde **+%${(f.return_1m * 100).toFixed(1)}** ile güçlü bir ralli yaşadı.`);
    else if (f.return_1m > 0.03) lines.push(`Son 30 günde **+%${(f.return_1m * 100).toFixed(1)}** — pozitif momentum.`);
    else if (f.return_1m < -0.05) lines.push(`Son 30 günde **%${(f.return_1m * 100).toFixed(1)}** kaybetti — dikkatli ol.`);
    else if (f.return_1m < -0.01) lines.push(`Son 30 gün yatay-aşağı (%${(f.return_1m * 100).toFixed(1)}).`);
    else lines.push(`Son 30 gün yatay (≈%${(f.return_1m * 100).toFixed(1)}) — radar dışı.`);
  }

  // Line 2: flow / popularity
  if (f.flow_1m !== undefined && f.flow_1m !== null) {
    if (f.flow_1m > 0.2) lines.push(`AUM **%${(f.flow_1m * 100).toFixed(0)}** arttı — yatırımcı ilgisi güçlü.`);
    else if (f.flow_1m > 0.05) lines.push(`AUM %${(f.flow_1m * 100).toFixed(1)} büyüdü — hafif giriş var.`);
    else if (f.flow_1m < -0.1) lines.push(`AUM **%${(f.flow_1m * 100).toFixed(0)}** küçüldü — kitle çıkışı sinyali.`);
  }

  // Line 3: risk adjusted
  if (f.sharpe_90 !== undefined && f.sharpe_90 !== null) {
    if (f.sharpe_90 > 1.5) lines.push(`Sharpe **${f.sharpe_90.toFixed(2)}** — risk başına getirisi yüksek, etkileyici.`);
    else if (f.sharpe_90 > 0.8) lines.push(`Sharpe **${f.sharpe_90.toFixed(2)}** — makul risk-getiri dengesi.`);
    else if (f.sharpe_90 < 0) lines.push(`Sharpe negatif (${f.sharpe_90.toFixed(2)}) — risksiz faizin altında performans.`);
  }

  // Line 4: real return
  if (f.real_return_1y !== undefined && f.real_return_1y !== null) {
    if (f.real_return_1y > 0.1) lines.push(`Enflasyondan **%${(f.real_return_1y * 100).toFixed(1)}** reel kazanç sağladı.`);
    else if (f.real_return_1y > 0) lines.push(`TÜFE'yi yendi, reel getiri %${(f.real_return_1y * 100).toFixed(1)}.`);
    else lines.push(`TÜFE'nin altında kaldı — reel getiri **%${(f.real_return_1y * 100).toFixed(1)}**.`);
  }

  return lines.slice(0, 3); // Max 3 lines to keep it editorial, not verbose
}
