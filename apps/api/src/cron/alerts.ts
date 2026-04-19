import type { Database } from 'better-sqlite3';
import { Resend } from 'resend';
import { getDb } from '../db/index.js';

const FROM = process.env.FONOLOJI_MAIL_FROM ?? 'Fonoloji <no-reply@fonoloji.com>';
const SITE = process.env.FONOLOJI_SITE_URL ?? 'https://fonoloji.com';

let _resend: Resend | null = null;
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_resend) _resend = new Resend(key);
  return _resend;
}

interface AlertRow {
  id: number;
  user_id: number;
  code: string;
  kind: 'price_above' | 'price_below' | 'return_above' | 'return_below';
  threshold: number;
  triggered_at: number | null;
  user_email: string;
  user_name: string | null;
}

function shouldFire(
  kind: AlertRow['kind'],
  threshold: number,
  price: number | null,
  return_1m: number | null,
): boolean {
  if (kind === 'price_above' && price !== null) return price >= threshold;
  if (kind === 'price_below' && price !== null) return price <= threshold;
  if (kind === 'return_above' && return_1m !== null) return return_1m * 100 >= threshold;
  if (kind === 'return_below' && return_1m !== null) return return_1m * 100 <= threshold;
  return false;
}

function alertSubject(a: AlertRow, price: number | null): string {
  const formatted = price ? price.toFixed(4) : '—';
  switch (a.kind) {
    case 'price_above':
      return `🚨 ${a.code} ${a.threshold} üstüne çıktı (${formatted})`;
    case 'price_below':
      return `🚨 ${a.code} ${a.threshold} altına düştü (${formatted})`;
    case 'return_above':
      return `📈 ${a.code} 1A getirisi %${a.threshold} üstüne çıktı`;
    case 'return_below':
      return `📉 ${a.code} 1A getirisi %${a.threshold} altına düştü`;
  }
}

function alertHtml(a: AlertRow, fundName: string, price: number | null, return_1m: number | null): string {
  const kindLabel =
    a.kind === 'price_above' ? 'Fiyat yukarı eşiği' :
    a.kind === 'price_below' ? 'Fiyat aşağı eşiği' :
    a.kind === 'return_above' ? '1A getiri yukarı eşiği' : '1A getiri aşağı eşiği';

  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0b0b10;font-family:-apple-system,sans-serif;color:#e8e8ec;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#15151b;border:1px solid #24242b;border-radius:20px;overflow:hidden;">
  <tr><td style="background:linear-gradient(135deg,#8B5CF6 0%,#06B6D4 100%);height:4px;"></td></tr>
  <tr><td style="padding:28px 32px;">
    <div style="font-size:10px;font-weight:700;color:#8B5CF6;text-transform:uppercase;letter-spacing:3px;margin-bottom:8px;">ALARM TETİKLENDİ</div>
    <h2 style="margin:0 0 4px;font-size:20px;color:#f5f5f7;font-family:Georgia,serif;font-weight:400;">${a.code} · ${fundName}</h2>
    <p style="margin:8px 0 16px;font-size:13px;color:#a8a8b3;">Kurduğun <strong style="color:#f5f5f7;">${kindLabel}</strong> şartı gerçekleşti.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f16;border-radius:12px;margin-top:8px;">
      <tr><td style="padding:14px 18px;">
        <div style="font-size:11px;color:#7a7a85;margin-bottom:2px;">GÜNCEL FİYAT</div>
        <div style="font-size:22px;font-family:monospace;color:#f5f5f7;">${price?.toFixed(4) ?? '—'}</div>
        ${return_1m !== null ? `<div style="font-size:11px;color:#7a7a85;margin-top:10px;">1 AY GETİRİ</div><div style="font-size:16px;font-family:monospace;color:${return_1m >= 0 ? '#10B981' : '#F43F5E'};">%${(return_1m * 100).toFixed(2)}</div>` : ''}
      </td></tr>
    </table>
    <p style="margin:22px 0 0;font-size:12px;color:#61616c;">Alarmını yönetmek için <a href="${SITE}/alarmlarim" style="color:#a8a8b3;">alarmlarım</a> sayfasını aç.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export async function runAlertChecker(): Promise<{ fired: number; checked: number }> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT a.id, a.user_id, a.code, a.kind, a.threshold, a.triggered_at,
              u.email as user_email, u.name as user_name
       FROM price_alerts a JOIN users u ON u.id = a.user_id
       WHERE a.enabled = 1 AND u.disabled_at IS NULL`,
    )
    .all() as AlertRow[];

  if (rows.length === 0) return { fired: 0, checked: 0 };

  const resend = getResend();
  let fired = 0;

  for (const a of rows) {
    const m = db
      .prepare(
        `SELECT m.current_price, m.return_1m, f.name FROM metrics m JOIN funds f ON f.code = m.code WHERE m.code = ?`,
      )
      .get(a.code) as { current_price: number | null; return_1m: number | null; name: string } | undefined;
    if (!m) continue;

    if (!shouldFire(a.kind, a.threshold, m.current_price, m.return_1m)) continue;

    // Skip if fired in last 24h
    if (a.triggered_at && Date.now() - a.triggered_at < 24 * 3_600_000) continue;

    const now = Date.now();
    db.prepare(`UPDATE price_alerts SET triggered_at = ? WHERE id = ?`).run(now, a.id);

    if (resend) {
      try {
        await resend.emails.send({
          from: FROM,
          to: a.user_email,
          subject: alertSubject(a, m.current_price),
          html: alertHtml(a, m.name, m.current_price, m.return_1m),
        });
        fired++;
      } catch (err) {
        console.warn(`[alerts] mail failed: ${(err as Error).message}`);
      }
    } else {
      console.log(`[alerts] ${a.code} ${a.kind} tetiklendi, mail servisi yapılandırılmamış`);
    }
  }

  return { fired, checked: rows.length };
}

export async function runFundChangeDetector(): Promise<{ changed: number }> {
  const db = getDb();

  // Compare current funds snapshot to historical. Track: name, category, risk_score, management_company, trading_status
  const current = db
    .prepare(
      `SELECT code, name, category, risk_score, management_company, trading_status FROM funds`,
    )
    .all() as Array<{
    code: string;
    name: string;
    category: string | null;
    risk_score: number | null;
    management_company: string | null;
    trading_status: string | null;
  }>;

  let changed = 0;
  const now = Date.now();
  const insertStmt = db.prepare(
    `INSERT INTO fund_changes (code, field, old_value, new_value, detected_at) VALUES (?, ?, ?, ?, ?)`,
  );

  for (const row of current) {
    const lastChanges = db
      .prepare(
        `SELECT field, new_value FROM fund_changes WHERE code = ? ORDER BY detected_at DESC`,
      )
      .all(row.code) as Array<{ field: string; new_value: string | null }>;

    // Build map of latest known value per field
    const latest = new Map<string, string | null>();
    for (const c of lastChanges) {
      if (!latest.has(c.field)) latest.set(c.field, c.new_value);
    }

    const fields: Array<[string, string | null]> = [
      ['name', row.name],
      ['category', row.category],
      ['risk_score', row.risk_score !== null ? String(row.risk_score) : null],
      ['management_company', row.management_company],
      ['trading_status', row.trading_status],
    ];

    for (const [field, value] of fields) {
      const last = latest.get(field);
      if (last === undefined) {
        // First seen — no change, but seed
        insertStmt.run(row.code, field, null, value, now);
        continue;
      }
      if (last !== value) {
        insertStmt.run(row.code, field, last, value, now);
        changed++;
      }
    }
  }

  return { changed };
}

async function sendWeeklyDigestFor(user: { id: number; email: string; name: string | null }): Promise<boolean> {
  const resend = getResend();
  if (!resend) return false;

  const db = getDb();
  const pf = db
    .prepare(`SELECT id FROM virtual_portfolios WHERE user_id = ?`)
    .get(user.id) as { id: number } | undefined;

  if (!pf) return false;

  const holdings = db
    .prepare(
      `SELECT h.code, h.units, h.cost_basis_try, f.name, m.current_price, m.return_1m, m.return_1y
       FROM portfolio_holdings h
       LEFT JOIN funds f ON f.code = h.code
       LEFT JOIN metrics m ON m.code = h.code
       WHERE h.portfolio_id = ?`,
    )
    .all(pf.id) as Array<{
    code: string;
    units: number;
    cost_basis_try: number;
    name: string | null;
    current_price: number | null;
    return_1m: number | null;
    return_1y: number | null;
  }>;

  if (holdings.length === 0) return false;

  const totalCost = holdings.reduce((a, h) => a + h.cost_basis_try, 0);
  const totalValue = holdings.reduce((a, h) => a + (h.current_price ? h.units * h.current_price : 0), 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? totalPnl / totalCost : 0;

  const rows = holdings
    .map((h) => {
      const val = h.current_price ? h.units * h.current_price : 0;
      const pnlPct = h.cost_basis_try > 0 ? (val - h.cost_basis_try) / h.cost_basis_try : 0;
      return `<tr><td style="padding:10px 12px;border-bottom:1px solid #24242b;"><strong style="color:#f5f5f7;font-family:monospace;">${h.code}</strong><div style="font-size:11px;color:#7a7a85;">${(h.name ?? '').slice(0, 35)}</div></td><td style="padding:10px 12px;text-align:right;border-bottom:1px solid #24242b;color:#a8a8b3;font-family:monospace;">₺${val.toFixed(0)}</td><td style="padding:10px 12px;text-align:right;border-bottom:1px solid #24242b;color:${pnlPct >= 0 ? '#10B981' : '#F43F5E'};font-family:monospace;">${pnlPct >= 0 ? '+' : ''}%${(pnlPct * 100).toFixed(1)}</td></tr>`;
    })
    .join('');

  const firstName = (user.name ?? user.email.split('@')[0] ?? '').split(' ')[0];

  const html = `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0b0b10;font-family:-apple-system,sans-serif;color:#e8e8ec;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;"><tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;background:#15151b;border:1px solid #24242b;border-radius:20px;overflow:hidden;">
<tr><td style="background:linear-gradient(135deg,#8B5CF6 0%,#06B6D4 100%);height:4px;"></td></tr>
<tr><td style="padding:28px 32px;">
  <div style="font-size:10px;font-weight:700;color:#8B5CF6;text-transform:uppercase;letter-spacing:3px;margin-bottom:8px;">HAFTALIK RAPORUNUZ</div>
  <h2 style="margin:0 0 14px;font-size:22px;color:#f5f5f7;font-family:Georgia,serif;font-weight:400;">Merhaba ${firstName},</h2>
  <p style="margin:0 0 20px;font-size:14px;color:#a8a8b3;line-height:1.6;">Sanal portföyünün bu haftaki durumu aşağıda.</p>

  <table width="100%" style="background:#0f0f16;border-radius:14px;margin-bottom:24px;">
    <tr>
      <td style="padding:16px 20px;">
        <div style="font-size:10px;color:#7a7a85;text-transform:uppercase;letter-spacing:2px;">TOPLAM DEĞER</div>
        <div style="font-size:28px;font-family:monospace;color:#f5f5f7;margin-top:4px;">₺${totalValue.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</div>
        <div style="font-size:13px;color:${totalPnl >= 0 ? '#10B981' : '#F43F5E'};margin-top:6px;">
          ${totalPnl >= 0 ? '+' : ''}₺${totalPnl.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
          (${totalPnlPct >= 0 ? '+' : ''}%${(totalPnlPct * 100).toFixed(2)} kar/zarar)
        </div>
      </td>
    </tr>
  </table>

  <div style="font-size:10px;color:#7a7a85;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">FONLARIM</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <thead><tr style="font-size:10px;color:#7a7a85;text-transform:uppercase;letter-spacing:2px;">
      <th style="text-align:left;padding:6px 12px;border-bottom:1px solid #24242b;">Fon</th>
      <th style="text-align:right;padding:6px 12px;border-bottom:1px solid #24242b;">Değer</th>
      <th style="text-align:right;padding:6px 12px;border-bottom:1px solid #24242b;">K/Z</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <p style="margin:24px 0 0;font-size:12px;color:#61616c;">
    <a href="${SITE}/portfoyum" style="color:#a8a8b3;text-decoration:underline;">Portföyümü aç</a> · <a href="${SITE}/panel" style="color:#a8a8b3;">Aboneliği yönet</a>
  </p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;

  try {
    await resend.emails.send({
      from: FROM,
      to: user.email,
      subject: `Fonoloji haftalık rapor · ${totalPnlPct >= 0 ? '+' : ''}%${(totalPnlPct * 100).toFixed(1)}`,
      html,
    });
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// WATCHLIST HAFTALIK ÖZET — izleme listesindeki fonlar için kişisel brifing.
// Fark: portföy holdings yok, sadece fiyat hareketi + KAP bildirim sayısı + AI yorumu.
// ============================================================================

async function sendWatchlistDigestFor(user: { id: number; email: string; name: string | null }): Promise<boolean> {
  const resend = getResend();
  if (!resend) return false;

  const db = getDb();
  const watchRows = db
    .prepare(
      `SELECT w.fund_code, f.name, f.category,
              m.current_price, m.return_1w, m.return_1m, m.return_ytd, m.aum,
              (SELECT COUNT(*) FROM kap_disclosures d
               WHERE d.fund_code = w.fund_code
                 AND d.publish_date >= ?
                 AND d.subject IN ('Portföy Dağılım Raporu','Genel Açıklama','Özel Durum',
                                   'İzahname','İzahname (Değişiklik) ','Fon Sürekli Bilgilendirme Formu',
                                   'Yatırımcı Bilgi Formu','İhraç Belgesi','Sorumluluk Beyanı')) as kap_count_7d
       FROM watchlist w
       LEFT JOIN funds f ON f.code = w.fund_code
       LEFT JOIN metrics m ON m.code = w.fund_code
       WHERE w.user_id = ?`,
    )
    .all(Date.now() - 7 * 86400000, user.id) as Array<{
    fund_code: string;
    name: string | null;
    category: string | null;
    current_price: number | null;
    return_1w: number | null;
    return_1m: number | null;
    return_ytd: number | null;
    aum: number | null;
    kap_count_7d: number;
  }>;

  if (watchRows.length === 0) return false;

  // En iyi/en kötü hafta
  const withWeekly = watchRows.filter((w) => w.return_1w !== null);
  const sorted = [...withWeekly].sort((a, b) => (b.return_1w ?? 0) - (a.return_1w ?? 0));
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const avgWeekly = withWeekly.length > 0
    ? withWeekly.reduce((s, w) => s + (w.return_1w ?? 0), 0) / withWeekly.length
    : 0;

  const totalKap = watchRows.reduce((s, w) => s + w.kap_count_7d, 0);
  const firstName = (user.name ?? user.email.split('@')[0] ?? '').split(' ')[0];

  const rowsHtml = watchRows
    .map((w) => {
      const r1w = w.return_1w ?? null;
      const color = r1w === null ? '#a8a8b3' : r1w >= 0 ? '#10B981' : '#F43F5E';
      const r1wStr = r1w === null ? '—' : `${r1w >= 0 ? '+' : ''}${(r1w * 100).toFixed(2)}%`;
      const kapTag = w.kap_count_7d > 0
        ? `<span style="display:inline-block;margin-left:8px;padding:2px 6px;border-radius:4px;background:#8B5CF6;color:#fff;font-size:9px;font-weight:700;">${w.kap_count_7d} KAP</span>`
        : '';
      return `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #24242b;">
          <strong style="color:#f5f5f7;font-family:monospace;">${w.fund_code}</strong>${kapTag}
          <div style="font-size:11px;color:#7a7a85;">${(w.name ?? '').slice(0, 40)}</div>
        </td>
        <td style="padding:10px 12px;text-align:right;border-bottom:1px solid #24242b;color:${color};font-family:monospace;">
          ${r1wStr}
        </td>
      </tr>`;
    })
    .join('');

  const bestLine = best
    ? `<strong>${best.fund_code}</strong> +${((best.return_1w ?? 0) * 100).toFixed(1)}% ile haftanın yıldızı oldu.`
    : '';
  const worstLine = worst && worst !== best
    ? `<strong>${worst.fund_code}</strong> ${((worst.return_1w ?? 0) * 100).toFixed(1)}% ile en zayıf.`
    : '';
  const kapLine = totalKap > 0
    ? `İzleme listendeki fonlar için ${totalKap} yeni KAP bildirimi yayınlandı.`
    : 'Bu hafta KAP bildirimi sakin.';

  const html = `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0b0b10;font-family:-apple-system,sans-serif;color:#e8e8ec;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;"><tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;background:#15151b;border:1px solid #24242b;border-radius:20px;overflow:hidden;">
  <tr><td style="background:linear-gradient(135deg,#8B5CF6 0%,#06B6D4 100%);height:4px;"></td></tr>
  <tr><td style="padding:28px 32px;">
    <div style="font-size:10px;font-weight:700;color:#8B5CF6;text-transform:uppercase;letter-spacing:3px;margin-bottom:8px;">İZLEME LİSTENİN HAFTASI</div>
    <h2 style="margin:0 0 14px;font-size:22px;color:#f5f5f7;font-family:Georgia,serif;font-weight:400;">Merhaba ${firstName},</h2>

    <p style="margin:0 0 16px;font-size:14px;color:#a8a8b3;line-height:1.6;">
      ${bestLine} ${worstLine ? `Öte yandan ${worstLine}` : ''} İzlediğin ${watchRows.length} fonun bu haftaki ortalama getirisi
      <strong style="color:${avgWeekly >= 0 ? '#10B981' : '#F43F5E'};">${avgWeekly >= 0 ? '+' : ''}${(avgWeekly * 100).toFixed(2)}%</strong>.
      ${kapLine}
    </p>

    <div style="font-size:10px;color:#7a7a85;text-transform:uppercase;letter-spacing:2px;margin:20px 0 8px;">TAKIP ETTIĞIN FONLAR · 1 HAFTA</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#0f0f16;border-radius:10px;overflow:hidden;">
      ${rowsHtml}
    </table>

    <p style="margin:24px 0 0;font-size:12px;color:#61616c;">
      <a href="${SITE}/alarmlarim" style="color:#a8a8b3;text-decoration:underline;">İzleme listemi aç</a>
      · <a href="${SITE}/panel" style="color:#a8a8b3;">Aboneliği yönet</a>
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  try {
    await resend.emails.send({
      from: FROM,
      to: user.email,
      subject: `İzleme listen bu hafta ${avgWeekly >= 0 ? '+' : ''}%${(avgWeekly * 100).toFixed(1)}${totalKap > 0 ? ` · ${totalKap} KAP` : ''}`,
      html,
    });
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// YIL SONU / ÇEYREK ÖZET — "Spotify Wrapped" tarzı dönemsel brifing (#47).
// Altyapı: kullanıcının dönem içindeki aktivitesini aggregate eder, mail hazır.
// Trigger: manuel veya çeyreklik cron (şimdilik DISABLED — aşağıdaki index.ts'e yorum olarak).
// ============================================================================

export interface PeriodSummary {
  userId: number;
  fromMs: number;
  toMs: number;
  newWatchlist: number;
  newAlerts: number;
  newKapAlerts: number;
  alarmsFired: number;
  kapAlertsFired: number;
  portfolioValue: number | null;
  portfolioPnl: number | null;
  portfolioPnlPct: number | null;
  topWatchedFund: { code: string; name: string | null; return_1y: number | null } | null;
  kapHeavyFund: { code: string; name: string | null; count: number } | null;
  totalFundsViewed: number; // placeholder — client tracking yok, 0
}

export function buildPeriodSummary(userId: number, fromMs: number, toMs: number): PeriodSummary {
  const db = getDb();

  const newWatchlist = (db
    .prepare(`SELECT COUNT(*) as c FROM watchlist WHERE user_id = ? AND created_at BETWEEN ? AND ?`)
    .get(userId, fromMs, toMs) as { c: number }).c;

  const newAlerts = (db
    .prepare(`SELECT COUNT(*) as c FROM price_alerts WHERE user_id = ? AND created_at BETWEEN ? AND ?`)
    .get(userId, fromMs, toMs) as { c: number }).c;

  const newKapAlerts = (db
    .prepare(`SELECT COUNT(*) as c FROM kap_alerts WHERE user_id = ? AND created_at BETWEEN ? AND ?`)
    .get(userId, fromMs, toMs) as { c: number }).c;

  const alarmsFired = (db
    .prepare(`SELECT COUNT(*) as c FROM price_alerts WHERE user_id = ? AND triggered_at BETWEEN ? AND ?`)
    .get(userId, fromMs, toMs) as { c: number }).c;

  const kapAlertsFired = (db
    .prepare(`SELECT COUNT(*) as c FROM kap_alerts WHERE user_id = ? AND last_notified_at BETWEEN ? AND ?`)
    .get(userId, fromMs, toMs) as { c: number }).c;

  // En iyi performansta olan (izlenen) fon
  const topWatched = db
    .prepare(
      `SELECT w.fund_code, f.name, m.return_1y
       FROM watchlist w LEFT JOIN funds f ON f.code = w.fund_code
       LEFT JOIN metrics m ON m.code = w.fund_code
       WHERE w.user_id = ? AND m.return_1y IS NOT NULL
       ORDER BY m.return_1y DESC LIMIT 1`,
    )
    .get(userId) as { fund_code: string; name: string | null; return_1y: number } | undefined;

  // İzlenen fon içinde dönem içinde en çok KAP bildirimi alan
  const kapHeavy = db
    .prepare(
      `SELECT w.fund_code, f.name,
              (SELECT COUNT(*) FROM kap_disclosures d
               WHERE d.fund_code = w.fund_code AND d.publish_date BETWEEN ? AND ?) as count
       FROM watchlist w LEFT JOIN funds f ON f.code = w.fund_code
       WHERE w.user_id = ?
       ORDER BY count DESC LIMIT 1`,
    )
    .get(fromMs, toMs, userId) as { fund_code: string; name: string | null; count: number } | undefined;

  // Portföy P&L
  const pf = db
    .prepare(`SELECT id FROM virtual_portfolios WHERE user_id = ?`)
    .get(userId) as { id: number } | undefined;

  let portfolioValue: number | null = null;
  let portfolioPnl: number | null = null;
  let portfolioPnlPct: number | null = null;

  if (pf) {
    const holdings = db
      .prepare(
        `SELECT h.units, h.cost_basis_try, m.current_price
         FROM portfolio_holdings h LEFT JOIN metrics m ON m.code = h.code
         WHERE h.portfolio_id = ?`,
      )
      .all(pf.id) as Array<{ units: number; cost_basis_try: number; current_price: number | null }>;
    if (holdings.length > 0) {
      const cost = holdings.reduce((s, h) => s + h.cost_basis_try, 0);
      const val = holdings.reduce((s, h) => s + (h.current_price ? h.units * h.current_price : 0), 0);
      portfolioValue = val;
      portfolioPnl = val - cost;
      portfolioPnlPct = cost > 0 ? (val - cost) / cost : null;
    }
  }

  return {
    userId,
    fromMs,
    toMs,
    newWatchlist,
    newAlerts,
    newKapAlerts,
    alarmsFired,
    kapAlertsFired,
    portfolioValue,
    portfolioPnl,
    portfolioPnlPct,
    topWatchedFund: topWatched ? { code: topWatched.fund_code, name: topWatched.name, return_1y: topWatched.return_1y } : null,
    kapHeavyFund: kapHeavy ? { code: kapHeavy.fund_code, name: kapHeavy.name, count: kapHeavy.count } : null,
    totalFundsViewed: 0, // client-side tracking yok
  };
}

async function sendPeriodSummaryFor(
  user: { id: number; email: string; name: string | null },
  summary: PeriodSummary,
  label: string,
): Promise<boolean> {
  const resend = getResend();
  if (!resend) return false;

  const firstName = (user.name ?? user.email.split('@')[0] ?? '').split(' ')[0];

  const statsHtml = [
    { label: `${label} içinde izleme listesine eklediğin`, value: summary.newWatchlist, unit: 'fon' },
    { label: 'Kurduğun fiyat alarmı', value: summary.newAlerts, unit: 'adet' },
    { label: 'Tetiklenen alarm', value: summary.alarmsFired, unit: 'kez' },
    { label: 'Gelen KAP uyarısı', value: summary.kapAlertsFired, unit: 'mail' },
  ]
    .filter((s) => s.value > 0)
    .map((s) => `<tr>
      <td style="padding:10px 12px;border-bottom:1px solid #24242b;color:#a8a8b3;font-size:12px;">${s.label}</td>
      <td style="padding:10px 12px;text-align:right;border-bottom:1px solid #24242b;color:#f5f5f7;font-family:monospace;font-weight:600;">${s.value} ${s.unit}</td>
    </tr>`)
    .join('');

  const topLine = summary.topWatchedFund && summary.topWatchedFund.return_1y !== null
    ? `En iyi gidenin <strong style="color:#10B981;font-family:monospace;">${summary.topWatchedFund.code}</strong> oldu — 1Y getirisi <strong style="color:#10B981;">+${(summary.topWatchedFund.return_1y * 100).toFixed(1)}%</strong>.`
    : '';

  const kapLine = summary.kapHeavyFund && summary.kapHeavyFund.count > 0
    ? `<strong style="font-family:monospace;">${summary.kapHeavyFund.code}</strong> ${summary.kapHeavyFund.count} KAP bildirimiyle en hareketli fonundu.`
    : '';

  const pfLine = summary.portfolioPnlPct !== null
    ? `Sanal portföyün ${label} içinde <strong style="color:${summary.portfolioPnlPct >= 0 ? '#10B981' : '#F43F5E'};">${summary.portfolioPnlPct >= 0 ? '+' : ''}${(summary.portfolioPnlPct * 100).toFixed(1)}%</strong> değişti.`
    : '';

  const html = `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0b0b10;font-family:-apple-system,sans-serif;color:#e8e8ec;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;"><tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;background:#15151b;border:1px solid #24242b;border-radius:20px;overflow:hidden;">
<tr><td style="background:linear-gradient(135deg,#F59E0B 0%,#2DD4BF 100%);height:4px;"></td></tr>
<tr><td style="padding:32px;">
  <div style="font-size:10px;font-weight:700;color:#F59E0B;text-transform:uppercase;letter-spacing:3px;margin-bottom:12px;">${label.toUpperCase()} ÖZETİN</div>
  <h2 style="margin:0 0 20px;font-size:26px;color:#f5f5f7;font-family:Georgia,serif;font-weight:400;">${firstName}, ${label.toLowerCase()} senin için şöyle geçti:</h2>

  ${statsHtml ? `<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f16;border-radius:12px;margin-bottom:20px;">${statsHtml}</table>` : ''}

  ${topLine || kapLine || pfLine ? `
    <p style="margin:20px 0;font-size:14px;color:#a8a8b3;line-height:1.7;">
      ${[topLine, kapLine, pfLine].filter(Boolean).join(' ')}
    </p>` : ''}

  <p style="margin:24px 0 0;font-size:12px;color:#61616c;">
    <a href="${SITE}/alarmlarim" style="color:#a8a8b3;">Alarmlarım</a> ·
    <a href="${SITE}/fonlar" style="color:#a8a8b3;">Fonlar</a> ·
    <a href="${SITE}/panel" style="color:#a8a8b3;">Aboneliği yönet</a>
  </p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;

  try {
    await resend.emails.send({
      from: FROM,
      to: user.email,
      subject: `${label} Fonoloji özetin`,
      html,
    });
    return true;
  } catch { return false; }
}

export async function runPeriodSummary(label: string, fromMs: number, toMs: number): Promise<{ sent: number; skipped: number }> {
  const db = getDb();
  const users = db
    .prepare(
      `SELECT u.id, u.email, u.name FROM users u
       WHERE u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM watchlist w WHERE w.user_id = u.id
           UNION SELECT 1 FROM price_alerts a WHERE a.user_id = u.id
           UNION SELECT 1 FROM virtual_portfolios p WHERE p.user_id = u.id
         )`,
    )
    .all() as Array<{ id: number; email: string; name: string | null }>;

  let sent = 0, skipped = 0;
  for (const u of users) {
    const summary = buildPeriodSummary(u.id, fromMs, toMs);
    // Hiç aktivitesi yoksa atla
    if (
      summary.newWatchlist === 0 && summary.newAlerts === 0 && summary.alarmsFired === 0 &&
      summary.kapAlertsFired === 0 && summary.portfolioValue === null
    ) { skipped++; continue; }
    const ok = await sendPeriodSummaryFor(u, summary, label);
    if (ok) sent++; else skipped++;
    await new Promise((r) => setTimeout(r, 800));
  }
  return { sent, skipped };
}

export async function runWatchlistDigest(): Promise<{ sent: number; skipped: number }> {
  const db = getDb();
  const subs = db
    .prepare(
      `SELECT u.id, u.email, u.name FROM weekly_subs s
       JOIN users u ON u.id = s.user_id
       WHERE s.enabled = 1 AND u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL
         AND EXISTS (SELECT 1 FROM watchlist w WHERE w.user_id = u.id)`,
    )
    .all() as Array<{ id: number; email: string; name: string | null }>;

  let sent = 0, skipped = 0;
  for (const u of subs) {
    const ok = await sendWatchlistDigestFor(u);
    if (ok) {
      db.prepare(`UPDATE weekly_subs SET last_sent_at = ? WHERE user_id = ?`).run(Date.now(), u.id);
      sent++;
    } else { skipped++; }
    await new Promise((r) => setTimeout(r, 600));
  }
  return { sent, skipped };
}

export async function runWeeklyDigest(): Promise<{ sent: number; skipped: number }> {
  const db = getDb();
  const subs = db
    .prepare(
      `SELECT u.id, u.email, u.name FROM weekly_subs s
       JOIN users u ON u.id = s.user_id
       WHERE s.enabled = 1 AND u.disabled_at IS NULL AND u.email_verified_at IS NOT NULL`,
    )
    .all() as Array<{ id: number; email: string; name: string | null }>;

  let sent = 0;
  let skipped = 0;

  for (const u of subs) {
    const ok = await sendWeeklyDigestFor(u);
    if (ok) {
      db.prepare(`UPDATE weekly_subs SET last_sent_at = ? WHERE user_id = ?`).run(Date.now(), u.id);
      sent++;
    } else {
      skipped++;
    }
    await new Promise((r) => setTimeout(r, 600)); // throttle
  }

  return { sent, skipped };
}
