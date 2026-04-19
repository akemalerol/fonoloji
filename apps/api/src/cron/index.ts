import cron from 'node-cron';
import {
  recomputeAllMetrics,
  recomputeCategoryStats,
  recomputeDailySummary,
} from '../analytics/recompute.js';
import { getDb } from '../db/index.js';
import { runDailyIngest } from '../scripts/ingest.js';
import { runCpiIngest, seedUpcomingAnnouncements } from '../scripts/ingestCpi.js';
import { runLiveMarketIngest } from '../scripts/ingestLiveMarket.js';
import { postTweet } from '../services/x.js';
import { runKapHoldingsIngest } from '../scripts/ingestKapHoldings.js';
import { runKapDisclosuresIngest } from '../scripts/ingestKapDisclosures.js';
import { runEstimates, verifyEstimates } from '../scripts/navEstimateDaily.js';
import { runPortfolioIngest } from '../scripts/ingestPortfolio.js';
import { runAlertChecker, runFundChangeDetector, runPeriodSummary, runWatchlistDigest, runWeeklyDigest } from './alerts.js';

export function registerCron(log: { info: (msg: string) => void; error: (...args: unknown[]) => void }): void {
  if (process.env.FONOLOJI_DISABLE_CRON === '1') {
    log.info('[cron] Disabled via env');
    return;
  }

  const run = async (label: string) => {
    log.info(`[cron] ${label} ingest başlıyor`);
    try {
      await runDailyIngest();
      const db = getDb();
      log.info(`[cron] ${label} analytics yenileniyor`);
      recomputeAllMetrics(db);
      recomputeDailySummary(db);
      recomputeCategoryStats(db);
      log.info(`[cron] ${label} tamamlandı`);
    } catch (err) {
      log.error(`[cron] ${label} hata:`, err);
    }
  };

  // TEFAS ingest — weekdays only (Pzt-Cum). Weekend'de yeni fiyat yayınlanmıyor.
  const schedule: Array<{ expr: string; label: string }> = [
    { expr: '0 7 * * 1-5',  label: '07:00' },
    { expr: '0 8 * * 1-5',  label: '08:00' },
    { expr: '30 8 * * 1-5', label: '08:30' },
    { expr: '0 9 * * 1-5',  label: '09:00' },
    { expr: '30 9 * * 1-5', label: '09:30' },
    { expr: '0 10 * * 1-5', label: '10:00' },
    { expr: '0 11 * * 1-5', label: '11:00' },
    { expr: '0 12 * * 1-5', label: '12:00' },
  ];

  for (const { expr, label } of schedule) {
    cron.schedule(expr, () => run(label), { timezone: 'Europe/Istanbul' });
  }

  // Seed upcoming TÜFE announcements on boot so UI can show next date
  try {
    seedUpcomingAnnouncements();
  } catch (err) {
    log.error('[cron] CPI seed hata:', err);
  }

  // TÜFE: TÜİK publishes ~3rd of each month @ 10:00 TR time.
  // Scrape at 10:05 and again at 10:30 as fallback; one-shot daily at 11:00 to catch slips.
  const cpiJob = async (label: string) => {
    log.info(`[cron] CPI ${label}`);
    try {
      const result = await runCpiIngest();
      log.info(`[cron] CPI ${label} → ${result.inserted ? `OK ${result.period}` : 'SKIP'}`);
      if (result.inserted) {
        const db = getDb();
        log.info('[cron] CPI sonrası metrikler yeniden hesaplanıyor');
        recomputeAllMetrics(db);
      }
    } catch (err) {
      log.error(`[cron] CPI ${label} hata:`, err);
    }
  };
  cron.schedule('5 10 3 * *',  () => cpiJob('3 10:05'), { timezone: 'Europe/Istanbul' });
  cron.schedule('30 10 3 * *', () => cpiJob('3 10:30'), { timezone: 'Europe/Istanbul' });
  cron.schedule('0 11 3 * *',  () => cpiJob('3 11:00'), { timezone: 'Europe/Istanbul' });
  cron.schedule('0 12 4 * *',  () => cpiJob('4 12:00 fallback'), { timezone: 'Europe/Istanbul' });

  // Alert checker — every 30min during TR market hours (08:00-18:00)
  cron.schedule('*/30 8-18 * * *', async () => {
    try {
      const r = await runAlertChecker();
      if (r.fired > 0) log.info(`[cron] alerts: ${r.fired}/${r.checked} fired`);
    } catch (err) {
      log.error('[cron] alerts error:', err);
    }
  }, { timezone: 'Europe/Istanbul' });

  // Live market tickers — 24/7. İngest içinde her asset kendi piyasa saatine
  // göre gate'liyor (BTC/ETH her zaman, FX hafta içi, borsalar yerel saatlerine göre).
  let liveMarketRunning = false;
  const liveMarketTick = async () => {
    if (liveMarketRunning) return;
    liveMarketRunning = true;
    try {
      await runLiveMarketIngest();
    } catch (err) {
      log.error('[cron] live market error:', err);
    } finally {
      liveMarketRunning = false;
    }
  };
  let liveMarketTimer: NodeJS.Timeout | null = null;
  const scheduleNextTick = () => {
    liveMarketTimer = setTimeout(async () => {
      await liveMarketTick();
      scheduleNextTick();
    }, 5_000);
  };
  setTimeout(() => {
    liveMarketTick().finally(() => scheduleNextTick());
  }, 3000);

  // Portfolio allocation — weekdays at 13:00 TR (after last fund ingest)
  cron.schedule('0 13 * * 1-5', async () => {
    log.info('[cron] portfolio ingest başlıyor');
    try {
      const r = await runPortfolioIngest({ days: 7 });
      log.info(`[cron] portfolio: ${r.processed} fon, ${r.inserted} snapshot, ${r.skipped} skip`);
    } catch (err) {
      log.error('[cron] portfolio hata:', err);
    }
  }, { timezone: 'Europe/Istanbul' });

  // KAP holdings — 1st-5th of each month at 14:00 TR (aylık portföy raporları genelde ay başında yayınlanır)
  cron.schedule('0 14 1-5 * *', async () => {
    log.info('[cron] KAP holdings ingest başlıyor');
    try {
      const r = await runKapHoldingsIngest({ months: 2 });
      log.info(`[cron] KAP holdings: ${r.disclosures} bildirim, ${r.holdings} holding, ${r.failed} başarısız`);
    } catch (err) {
      log.error('[cron] KAP holdings hata:', err);
    }
  }, { timezone: 'Europe/Istanbul' });

  // KAP holdings retry — every 3 hours, retries until equity funds are covered
  cron.schedule('0 */3 * * *', async () => {
    try {
      const db = getDb();
      // Count equity funds (TEFAS active, ≥50% stock) that still have no holdings
      const missing = (db.prepare(`
        SELECT COUNT(*) as c FROM (
          SELECT ps.code FROM portfolio_snapshots ps
          JOIN funds f ON f.code = ps.code
          JOIN (SELECT code, MAX(date) as d FROM portfolio_snapshots GROUP BY code) latest
            ON latest.code = ps.code AND latest.d = ps.date
          WHERE ps.stock >= 50 AND f.type IS NOT NULL
            AND (f.trading_status LIKE '%TEFAS%işlem görüyor%' OR f.trading_status LIKE '%BEFAS%işlem görüyor%')
            AND NOT EXISTS (SELECT 1 FROM fund_holdings fh WHERE fh.code = ps.code)
        )
      `).get() as { c: number }).c;
      if (missing > 0) {
        log.info(`[cron] KAP retry — ${missing} eksik fon, tekrar deneniyor`);
        const r = await runKapHoldingsIngest({ months: 6 });
        if (r.holdings > 0) log.info(`[cron] KAP retry: +${r.holdings} yeni holding (${r.failed} başarısız)`);
      }
    } catch (err) {
      log.error('[cron] KAP retry hata:', err);
    }
  }, { timezone: 'Europe/Istanbul' });

  // KAP fon bildirimleri — 15 dk'da bir. Sadece fon bildirimleri (disclosure/funds/byCriteria).
  // 24/7 açık; KAP hafta sonu da zaman zaman yayınlıyor. Pencere son 3 gün, idempotent.
  cron.schedule('*/15 * * * *', async () => {
    try {
      const r = await runKapDisclosuresIngest({ days: 3 });
      if (r.inserted > 0) log.info(`[cron] KAP disclosures: +${r.inserted} yeni (${r.fetched} toplam)`);
    } catch (err) {
      log.error('[cron] KAP disclosures hata:', err);
    }
  }, { timezone: 'Europe/Istanbul' });

  // NAV estimates — save after market close + 15min delay (borsa 18:10 kapanır, veriler 18:30'da netleşir)
  cron.schedule('30 18 * * 1-5', async () => {
    log.info('[cron] NAV tahminleri kaydediliyor');
    try {
      const r = await runEstimates();
      log.info(`[cron] NAV estimates: ${r.estimated} saved, ${r.failed} failed`);
    } catch (err) {
      log.error('[cron] NAV estimates hata:', err);
    }
  }, { timezone: 'Europe/Istanbul' });

  cron.schedule('30 9 * * 1-5', () => {
    try {
      const r = verifyEstimates();
      if (r.verified > 0) log.info(`[cron] NAV verify: ${r.verified} checked, avg error %${r.avgError.toFixed(3)}`);
    } catch (err) {
      log.error('[cron] NAV verify hata:', err);
    }
  }, { timezone: 'Europe/Istanbul' });

  // Haftalık özet mail — her Pazartesi 09:00 TR
  // Hem sanal portföy (runWeeklyDigest) hem watchlist (runWatchlistDigest)
  cron.schedule('0 9 * * 1', async () => {
    log.info('[cron] haftalık özet gönderimi başlıyor');
    try {
      const p = await runWeeklyDigest();
      const w = await runWatchlistDigest();
      log.info(`[cron] haftalık: portföy ${p.sent} sent / ${p.skipped} skip; watchlist ${w.sent} sent / ${w.skipped} skip`);
    } catch (err) {
      log.error('[cron] haftalık özet hata:', err);
    }
  }, { timezone: 'Europe/Istanbul' });

  // Dönemsel özet (çeyreklik + yıllık). Altyapı hazır, aşağıdaki iki cron
  // ihtiyaca göre açılır. Şimdilik DISABLED — runPeriodSummary manuel tetiklenebilir:
  //   npx tsx -e "import('./src/cron/alerts.js').then(m => m.runPeriodSummary('2026 1. Çeyrek', Date.parse('2026-01-01'), Date.parse('2026-03-31')))"
  //
  // Çeyreklik (her Mar 31, Haz 30, Eyl 30, Ara 31 @ 10:00):
  //   cron.schedule('0 10 31 3,12 *', () => runPeriodSummary('Bu çeyrek', ...))
  //   cron.schedule('0 10 30 6,9 *', () => runPeriodSummary('Bu çeyrek', ...))
  //
  // Yıllık (31 Aralık 18:00):
  //   cron.schedule('0 18 31 12 *', async () => {
  //     const year = new Date().getFullYear();
  //     const from = Date.parse(`${year}-01-01`);
  //     const to = Date.parse(`${year}-12-31T23:59:59`);
  //     const r = await runPeriodSummary(`${year}`, from, to);
  //     log.info(`[cron] yıl sonu özeti: ${r.sent} sent / ${r.skipped} skip`);
  //   }, { timezone: 'Europe/Istanbul' });

  // Fund change detector — once daily at 12:30 TR (after last ingest)
  cron.schedule('30 12 * * *', async () => {
    try {
      const r = await runFundChangeDetector();
      if (r.changed > 0) log.info(`[cron] fund changes detected: ${r.changed}`);
    } catch (err) {
      log.error('[cron] fund change error:', err);
    }
  }, { timezone: 'Europe/Istanbul' });

  // Scheduled tweet sender — every 5 min, sends tweets whose time has come
  cron.schedule('*/5 * * * *', async () => {
    const db = getDb();
    const now = Date.now();
    const due = db
      .prepare(
        `SELECT id, content FROM x_posts
         WHERE status = 'scheduled' AND scheduled_at <= ?
         ORDER BY scheduled_at ASC LIMIT 3`,
      )
      .all(now) as Array<{ id: number; content: string }>;
    if (due.length === 0) return;
    for (const row of due) {
      try {
        const r = await postTweet(row.content);
        if (r.ok) {
          db.prepare(`UPDATE x_posts SET status='sent', posted_at=?, tweet_id=? WHERE id=?`).run(
            Date.now(), r.tweetId ?? null, row.id,
          );
          log.info(`[cron] tweet #${row.id} gönderildi: ${r.tweetId}`);
        } else {
          db.prepare(`UPDATE x_posts SET status='failed', error=? WHERE id=?`).run(r.error ?? 'unknown', row.id);
          log.error(`[cron] tweet #${row.id} başarısız: ${r.error}`);
        }
      } catch (err) {
        log.error(`[cron] tweet #${row.id} hata:`, err);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }, { timezone: 'Europe/Istanbul' });

  log.info(`[cron] ${schedule.map((s) => s.label).join(', ')} + CPI + portfolio + alerts + fund-changes + KAP-disclosures + tweet-scheduler kaydedildi`);
}
