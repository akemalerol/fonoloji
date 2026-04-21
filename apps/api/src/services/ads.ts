import type { Database } from 'better-sqlite3';

// Sabit yerleşimler — site kodu bunlara referans veriyor. Admin aktifleştirir,
// slot_id'yi girer; boş olanlar hiçbir şey render etmez.
export const AD_PLACEMENTS: Array<{ placement: string; label: string; note: string }> = [
  { placement: 'home-hero', label: 'Anasayfa — hero altı', note: 'Büyük responsive banner, fold altına yakın.' },
  { placement: 'home-middle', label: 'Anasayfa — orta', note: 'Seksion araları. Daha az dikkat çekici.' },
  { placement: 'home-bottom', label: 'Anasayfa — alt', note: 'Footer öncesi son reklam.' },
  { placement: 'fonlar-top', label: 'Fon listesi — üst', note: '/fonlar sayfasının üst tarafı.' },
  { placement: 'fonlar-inline', label: 'Fon listesi — liste içi', note: '/fonlar listesi ortalarında.' },
  { placement: 'fon-top', label: 'Fon detay — üst', note: '/fon/:kod sayfasında metrik kartları altı.' },
  { placement: 'fon-bottom', label: 'Fon detay — alt', note: '/fon/:kod sayfasının sonunda.' },
  { placement: 'kesif-top', label: 'Keşifler — üst', note: '/kesifler/* sayfaları başı.' },
];

// Boot'ta tüm placement'ları DB'ye seed et (yoksa eklenir, varsa dokunulmaz).
export function seedAdPlacements(db: Database): void {
  const now = Date.now();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO ad_slots (placement, label, slot_id, format, enabled, impressions, created_at, updated_at)
     VALUES (?, ?, '', 'auto', 0, 0, ?, ?)`,
  );
  for (const p of AD_PLACEMENTS) {
    insert.run(p.placement, p.label, now, now);
  }
}

interface AdRow {
  id: number;
  placement: string;
  label: string | null;
  slot_id: string | null;
  format: string;
  enabled: number;
  impressions: number;
  created_at: number;
  updated_at: number;
}

export function listAds(db: Database): AdRow[] {
  return db.prepare(`SELECT * FROM ad_slots ORDER BY placement ASC`).all() as AdRow[];
}

export function getActiveAd(db: Database, placement: string): AdRow | null {
  const row = db
    .prepare(`SELECT * FROM ad_slots WHERE placement = ? AND enabled = 1 AND slot_id IS NOT NULL AND slot_id != ''`)
    .get(placement) as AdRow | undefined;
  return row ?? null;
}

export function updateAd(
  db: Database,
  placement: string,
  patch: Partial<Pick<AdRow, 'slot_id' | 'format' | 'enabled' | 'label'>>,
): AdRow | null {
  const existing = db.prepare(`SELECT * FROM ad_slots WHERE placement = ?`).get(placement) as AdRow | undefined;
  if (!existing) return null;
  const next = {
    slot_id: patch.slot_id ?? existing.slot_id,
    format: patch.format ?? existing.format,
    enabled: patch.enabled ?? existing.enabled,
    label: patch.label ?? existing.label,
  };
  db.prepare(
    `UPDATE ad_slots SET slot_id = ?, format = ?, enabled = ?, label = ?, updated_at = ?
     WHERE placement = ?`,
  ).run(next.slot_id, next.format, next.enabled, next.label, Date.now(), placement);
  return db.prepare(`SELECT * FROM ad_slots WHERE placement = ?`).get(placement) as AdRow;
}

export function incrementImpression(db: Database, placement: string): void {
  try {
    db.prepare(`UPDATE ad_slots SET impressions = impressions + 1 WHERE placement = ?`).run(placement);
  } catch {
    /* noop */
  }
}
