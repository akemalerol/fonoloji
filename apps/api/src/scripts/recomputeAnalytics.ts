import { getDb } from '../db/index.js';
import {
  recomputeAllMetrics,
  recomputeCategoryStats,
  recomputeDailySummary,
} from '../analytics/recompute.js';

function main(): void {
  const db = getDb();
  const start = Date.now();
  console.log('[analytics] Metrics hesaplanıyor…');
  const { updated } = recomputeAllMetrics(db);
  console.log(`[analytics] ${updated} fon için metrics güncellendi.`);

  console.log('[analytics] Günlük özet güncelleniyor…');
  recomputeDailySummary(db);

  console.log('[analytics] Kategori istatistikleri hesaplanıyor…');
  recomputeCategoryStats(db);

  console.log(`[analytics] Tamamlandı (${((Date.now() - start) / 1000).toFixed(1)}s).`);
}

main();
