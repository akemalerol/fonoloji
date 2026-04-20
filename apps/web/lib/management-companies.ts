// Portföy yönetim şirketleri + emeklilik şirketlerinin web alan adları.
// Favicon'lar Google Favicon API üzerinden çekilir (CDN cached, ücretsiz).
// Eksik olanlar için fallback baş harf rozeti.

export const COMPANY_DOMAINS: Record<string, string> = {
  // Büyük portföy yönetim şirketleri
  'is': 'isportfoy.com.tr',
  'ak': 'akportfoy.com.tr',
  'garanti': 'garantibbvaportfoy.com.tr',
  'yapi kredi': 'yapikrediportfoy.com.tr',
  'ziraat': 'ziraatportfoy.com.tr',
  'deniz': 'denizportfoy.com',
  'qnb': 'qnbportfoy.com',
  'teb': 'tebportfoy.com.tr',
  'hsbc': 'hsbcportfoy.com.tr',
  'oyak': 'oyakportfoy.com.tr',
  'kuveyt turk': 'kuveytturkportfoy.com.tr',
  'kuveyt türk': 'kuveytturkportfoy.com.tr',
  'albaraka': 'albarakaportfoy.com.tr',

  // Orta/küçük
  'azimut': 'azimut.com.tr',
  'fiba': 'fibaportfoy.com.tr',
  'hedef': 'hedefportfoy.com',
  'pardus': 'pardusportfoy.com',
  'istanbul': 'istanbulportfoy.com.tr',
  'rota': 'rotaportfoy.com.tr',
  'neo': 'neoportfoy.com.tr',
  'aktif': 'aktifportfoy.com.tr',
  'allbatross': 'allbatrossportfoy.com.tr',
  'nurol': 'nurolportfoy.com.tr',
  'inveo': 'inveoportfoy.com.tr',
  'atlas': 'atlasportfoy.com.tr',
  're-pie': 're-pieportfoy.com',
  'ata': 'ataportfoy.com.tr',
  'bulls': 'bullsportfoy.com.tr',
  'mt': 'mtportfoy.com.tr',
  'osmanlı': 'osmanliportfoy.com',
  'osmanli': 'osmanliportfoy.com',
  'tacirler': 'tacirler.com.tr',
  'qinvest': 'qinvestportfoy.com',
  'qi̇nvest': 'qinvestportfoy.com',
  'one': 'oneportfoy.com.tr',
  'strateji': 'stratejiportfoy.com',
  'bv': 'bvportfoy.com',
  'a1 capital': 'a1capitalportfoy.com',
  'a1 capi̇tal': 'a1capitalportfoy.com',
  'ünlü': 'unluportfoy.com',
  'unlu': 'unluportfoy.com',
  'pusula': 'pusulaportfoy.com',
  'global md': 'globalmdportfoy.com',
  'kare': 'kareportfoy.com.tr',
  'trive': 'triveportfoy.com',
  'piramit': 'piramitportfoy.com',
  'a cappıtal': 'acapitalportfoy.com',
  'phillip': 'phillipportfoy.com',
  'phi̇lli̇p': 'phillipportfoy.com',
  'gedik': 'gedikportfoy.com',
  'tera': 'teraportfoy.com',
  'finans': 'finansportfoy.com',
  'taaleri': 'taaleriportfoy.com',
  'arz': 'arzportfoy.com',
  'marmara capital': 'marmaracapitalportfoy.com',
  'marmara capi̇tal': 'marmaracapitalportfoy.com',
  'icbc turkey': 'icbcturkeyportfoy.com.tr',
  'i̇cbc turkey': 'icbcturkeyportfoy.com.tr',
  'destek': 'destekportfoy.com',
  'oyak yatirim': 'oyakyatirim.com.tr',

  // Emeklilik şirketleri
  'türkiye emeklilik': 'turkiyehayatemeklilik.com',
  'türki̇ye emeklilik': 'turkiyehayatemeklilik.com',
  'anadolu emeklilik': 'anadoluhayat.com.tr',
  'allianz emeklilik': 'allianz.com.tr',
  'agesa emeklilik': 'agesa.com.tr',
  'garanti emeklilik': 'garantibbvaemeklilik.com.tr',
  'hdi fiba emeklilik': 'hdifibaemeklilik.com.tr',
  'hdi fi̇ba emeklilik': 'hdifibaemeklilik.com.tr',
  'bnp paribas emeklilik': 'bnpparibascardif.com.tr',
  'metlife emeklilik': 'metlife.com.tr',
  'metli̇fe emeklilik': 'metlife.com.tr',
  'qnb emeklilik': 'qnbemeklilik.com.tr',
  'axa emeklilik': 'axahayat.com.tr',
  'katilim emeklilik': 'katilimemeklilik.com.tr',
  'fiba emeklilik': 'fibaemeklilik.com.tr',
  'vakıf emeklilik': 'vakifemeklilik.com.tr',
  'vakif emeklilik': 'vakifemeklilik.com.tr',
  'groupama emeklilik': 'groupama.com.tr',
  'ncr': 'ncr-atasay.com',
  'ray sigorta': 'raysigorta.com.tr',
  'cigna finans emeklilik': 'cignasaglik.com.tr',
};

// Şirket adından anahtar çıkar: "Yapı Kredi Portföy Yönetimi A.Ş." → "yapi kredi"
// Türkçe karakter normalize + "portföy|emeklilik yönetimi a.ş." gibi son ekleri at.
export function normalizeCompanyKey(name: string | null | undefined): string {
  if (!name) return '';
  let s = name.toLowerCase().trim();
  // Türkçe karakterler
  s = s
    .replace(/ı/g, 'i')
    .replace(/İ/gi, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/i̇/g, 'i'); // dotted-i combining diaeresis
  // Son ekleri sil
  s = s
    .replace(/\s+portf(o|ö)y\s+y(o|ö)netimi\s+a\.?s\.?\.?$/i, '')
    .replace(/\s+portf(o|ö)y\s*a\.?s\.?\.?$/i, '')
    .replace(/\s+emeklilik\s+(ve\s+hayat\s+)?a\.?s\.?\.?$/i, '')
    .replace(/\s+hayat\s+(ve\s+emeklilik\s+)?a\.?s\.?\.?$/i, '')
    .replace(/\s+a\.?s\.?\.?$/i, '')
    .replace(/\s+yonetimi$/i, '')
    .replace(/\s+portfoy$/i, '')
    .replace(/\s+yatirim$/i, '')
    .trim();
  return s;
}

export function companyDomain(name: string | null | undefined): string | null {
  const key = normalizeCompanyKey(name);
  if (!key) return null;
  return COMPANY_DOMAINS[key] ?? null;
}

// Google Favicon URL — 32/64px hızlı, CDN cached, fallback UI için de var.
export function faviconUrl(domain: string, size = 64): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}
