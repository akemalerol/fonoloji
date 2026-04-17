import { getDb } from '../db/index.js';
import { getTefasClient } from '../lib/tefas.js';

const ALLOC_API_URL = 'https://www.tefas.gov.tr/api/DB/BindHistoryAllocation';
const REFERER = 'https://www.tefas.gov.tr/TarihselVeriler.aspx';

interface AllocRow {
  TARIH?: number | string;
  FONKODU?: string;
  // TEFAS asset class fields (raw codes)
  HS?: number;     // Hisse Senedi
  DT?: number;     // Devlet Tahvili
  HB?: number;     // Hazine Bonosu
  OSBA?: number;   // Özel Sektör Borçlanma Aracı
  EUT?: number;    // Eurobond
  KH?: number;     // Katılım Hesabı
  VM?: number;     // Vadeli Mevduat
  TPP?: number;    // Ters Repo / Para Piyasası
  REPO?: number;   // Repo
  KKS?: number;    // Kira Sertifikası
  BB?: number;     // Borsa Para Piyasası
  BYF?: number;    // Borsa Yatırım Fonu
  KMKK?: number;   // Kıymetli Madenler (altın/gümüş)
  GA?: number;     // Gayrimenkul
  T?: number;      // Türev
  YT?: number;     // Yabancı Tahvil
  YHB?: number;    // Yabancı Hisse Senedi
  VK?: number;     // Vadeli Mevduat Katılım
  DB?: number;     // Dövize Endeksli Borçlanma
  FB?: number;     // Finansman Bonosu
  KB?: number;     // Katılım Bankası
  TKHB?: number;   // Türkiye Kalkınma ve Hazine Bonosu (rare)
  [key: string]: number | string | undefined;
}

interface NormalizedAllocation {
  stock: number;
  government_bond: number;
  treasury_bill: number;
  corporate_bond: number;
  eurobond: number;
  gold: number;
  cash: number;
  other: number;
}

// Exhaustive field-to-bucket mapping. TEFAS can add new field codes over time;
// any unrecognized numeric field falls into `other` so the total always sums correctly.
const FIELD_MAP: Record<string, keyof NormalizedAllocation> = {
  // Equity
  HS: 'stock',
  YHS: 'stock',
  YHB: 'stock',

  // Government bonds (domestic + foreign sovereign)
  DT: 'government_bond',
  YT: 'government_bond',
  KİBD: 'government_bond',

  // Treasury bills
  HB: 'treasury_bill',
  TKHB: 'treasury_bill',

  // Corporate bonds (domestic + foreign, plus FX-indexed + commercial paper)
  OSBA: 'corporate_bond',
  OST: 'corporate_bond',
  ÖSDB: 'corporate_bond',
  YBOSB: 'corporate_bond',
  FB: 'corporate_bond',
  DB: 'corporate_bond',

  // Eurobond
  EUT: 'eurobond',

  // Gold / precious metals (direct + lease certs + BYF form)
  KMKK: 'gold',
  KM: 'gold',
  KMKKS: 'gold',
  KMKBA: 'gold',
  KMBYF: 'gold',

  // Cash / deposits / money market (all TL/FX/gold/participation variants)
  VM: 'cash',
  VMTL: 'cash',
  VMD: 'cash',
  VMAU: 'cash',
  VK: 'cash',
  KH: 'cash',
  KHTL: 'cash',
  KHD: 'cash',
  KHAU: 'cash',
  KB: 'cash',
  TPP: 'cash',
  TR: 'cash', // Ters repo — cash equivalent
  R: 'cash',
  REPO: 'cash',
  BB: 'cash',
  BPP: 'cash',

  // Everything else: derivatives, REITs, lease certs, sector funds, foreign vehicles
  T: 'other',
  KKS: 'other',
  KKSD: 'other',
  KKSTL: 'other',
  KKSYD: 'other',
  BYF: 'other',
  GA: 'other',
  VİNT: 'other',
  OSKS: 'other',
  ÖKSYD: 'other',
  YYF: 'other',
  YBYF: 'other',
  YMK: 'other',
  YBKB: 'other',
  YBA: 'other',
  KBA: 'other',
  VDM: 'other',
};

function normalize(row: AllocRow): NormalizedAllocation {
  const result: NormalizedAllocation = {
    stock: 0,
    government_bond: 0,
    treasury_bill: 0,
    corporate_bond: 0,
    eurobond: 0,
    gold: 0,
    cash: 0,
    other: 0,
  };

  for (const [key, value] of Object.entries(row)) {
    if (key === 'TARIH' || key === 'FONKODU' || key === 'BilFiyat') continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value === 0) continue;
    const bucket = FIELD_MAP[key];
    if (bucket) {
      result[bucket] += value;
    } else {
      // Unknown field — keep the sum correct by dumping in `other`
      result.other += value;
    }
  }

  return result;
}

function ddmmyyyy(iso: string): string {
  return iso.split('-').reverse().join('.');
}

function isoFromTimestamp(raw: number | string | undefined): string | null {
  if (raw === undefined) return null;
  if (typeof raw === 'number') {
    const d = new Date(raw);
    return d.toISOString().slice(0, 10);
  }
  const s = String(raw);
  const m = /\/Date\((-?\d+)/.exec(s);
  if (m) return new Date(Number(m[1])).toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (Number.isFinite(Number(s)) && Number(s) > 1_000_000_000_000) {
    return new Date(Number(s)).toISOString().slice(0, 10);
  }
  return null;
}

interface Options {
  days: number;
  limit: number | null;
  fundCodes: string[] | null;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  let days = 30;
  let limit: number | null = null;
  let fundCodes: string[] | null = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a.startsWith('--days=')) days = Number(a.slice(7));
    else if (a === '--days' && args[i + 1]) days = Number(args[++i]);
    else if (a.startsWith('--limit=')) limit = Number(a.slice(8));
    else if (a === '--limit' && args[i + 1]) limit = Number(args[++i]);
    else if (a.startsWith('--codes=')) fundCodes = a.slice(8).split(',');
    else if (a === '--codes' && args[i + 1]) fundCodes = args[++i]!.split(',');
  }
  return { days, limit, fundCodes };
}

export async function runPortfolioIngest(overrides?: { days?: number; limit?: number | null; fundCodes?: string[] | null }): Promise<{ processed: number; inserted: number; skipped: number }> {
  return _ingest(overrides ?? parseArgs());
}

async function _ingest(opts: { days?: number; limit?: number | null; fundCodes?: string[] | null }): Promise<{ processed: number; inserted: number; skipped: number }> {
  const { days = 30, limit = null, fundCodes = null } = opts;
  const db = getDb();
  const client = getTefasClient();

  const skipRecent = process.env.FONOLOJI_PORTFOLIO_SKIP_RECENT !== '0';
  const onlyMissing = process.env.FONOLOJI_PORTFOLIO_ONLY_MISSING === '1';

  const codes: Array<{ code: string; type: string }> = fundCodes
    ? fundCodes.map((c) => ({ code: c, type: 'YAT' }))
    : onlyMissing
    ? (db
        .prepare(
          `SELECT f.code, f.type FROM funds f
           WHERE f.type IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM portfolio_snapshots ps WHERE ps.code = f.code)
           ORDER BY f.code`,
        )
        .all() as Array<{ code: string; type: string }>)
    : skipRecent
    ? (db
        .prepare(
          `SELECT f.code, f.type FROM funds f
           WHERE f.type IS NOT NULL
             AND NOT EXISTS (
               SELECT 1 FROM portfolio_snapshots ps
               WHERE ps.code = f.code AND ps.date >= date('now', '-2 day')
             )
           ORDER BY f.code`,
        )
        .all() as Array<{ code: string; type: string }>)
    : (db.prepare(`SELECT code, type FROM funds WHERE type IS NOT NULL ORDER BY code`).all() as Array<{ code: string; type: string }>);

  const targetCodes = limit ? codes.slice(0, limit) : codes;
  const today = new Date();
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - days);
  const startISO = start.toISOString().slice(0, 10);
  const endISO = today.toISOString().slice(0, 10);

  console.log(
    `[portfolio] ${targetCodes.length} fon × son ${days} gün (${startISO} → ${endISO})`,
  );

  const insertStmt = db.prepare(
    `INSERT INTO portfolio_snapshots
       (code, date, stock, government_bond, treasury_bill, corporate_bond, eurobond, gold, cash, other)
     VALUES (@code, @date, @stock, @government_bond, @treasury_bill, @corporate_bond, @eurobond, @gold, @cash, @other)
     ON CONFLICT(code, date) DO UPDATE SET
       stock = excluded.stock,
       government_bond = excluded.government_bond,
       treasury_bill = excluded.treasury_bill,
       corporate_bond = excluded.corporate_bond,
       eurobond = excluded.eurobond,
       gold = excluded.gold,
       cash = excluded.cash,
       other = excluded.other`,
  );

  const startedAt = Date.now();
  let snapshotsInserted = 0;
  let processed = 0;
  let skipped = 0;

  for (const { code, type } of targetCodes) {
    processed++;
    try {
      const body = await client.postDirect(
        ALLOC_API_URL,
        {
          fontip: type,
          sfontur: '',
          fonkod: code,
          fongrup: '',
          bastarih: ddmmyyyy(startISO),
          bittarih: ddmmyyyy(endISO),
          fonturkod: '',
          fonunvantip: '',
        },
        { referer: REFERER, acceptJson: true },
      );

      let parsed: { data?: AllocRow[] };
      try {
        parsed = JSON.parse(body) as { data?: AllocRow[] };
      } catch {
        skipped++;
        continue;
      }
      const rows = parsed.data ?? [];

      const txn = db.transaction(() => {
        for (const row of rows) {
          const date = isoFromTimestamp(row.TARIH);
          if (!date) continue;
          const alloc = normalize(row);
          insertStmt.run({ code, date, ...alloc });
          snapshotsInserted++;
        }
      });
      txn();
    } catch (err) {
      console.warn(`[portfolio] ${code} hata: ${(err as Error).message}`);
      skipped++;
    }

    if (processed % 50 === 0) {
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
      console.log(
        `  ${processed}/${targetCodes.length} fon işlendi (${snapshotsInserted} snapshot, ${elapsed}s, skip=${skipped})`,
      );
    }
  }

  console.log(
    `\n[portfolio] Tamamlandı: ${processed} fon, ${snapshotsInserted} snapshot, ${skipped} skip, ${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
  );

  return { processed, inserted: snapshotsInserted, skipped };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  _ingest(parseArgs())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[portfolio] hata:', err);
      process.exit(1);
    });
}
