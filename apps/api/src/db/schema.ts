import type { Database } from 'better-sqlite3';

export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS funds (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT,
    category TEXT,
    management_company TEXT,
    isin TEXT,
    risk_score INTEGER,
    kap_url TEXT,
    trading_status TEXT,
    trading_start TEXT,
    trading_end TEXT,
    buy_valor INTEGER,
    sell_valor INTEGER,
    profile_updated_at INTEGER,
    first_seen TEXT,
    last_seen TEXT,
    updated_at INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS idx_funds_type ON funds(type)`,
  `CREATE INDEX IF NOT EXISTS idx_funds_category ON funds(category)`,
  `CREATE INDEX IF NOT EXISTS idx_funds_risk ON funds(risk_score)`,

  `CREATE TABLE IF NOT EXISTS prices (
    code TEXT NOT NULL,
    date TEXT NOT NULL,
    price REAL NOT NULL,
    shares_outstanding REAL,
    investor_count INTEGER,
    total_value REAL,
    PRIMARY KEY (code, date)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_prices_date ON prices(date DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_prices_code_date ON prices(code, date DESC)`,

  `CREATE TABLE IF NOT EXISTS portfolio_snapshots (
    code TEXT NOT NULL,
    date TEXT NOT NULL,
    stock REAL DEFAULT 0,
    government_bond REAL DEFAULT 0,
    treasury_bill REAL DEFAULT 0,
    corporate_bond REAL DEFAULT 0,
    eurobond REAL DEFAULT 0,
    gold REAL DEFAULT 0,
    cash REAL DEFAULT 0,
    other REAL DEFAULT 0,
    PRIMARY KEY (code, date)
  )`,

  `CREATE TABLE IF NOT EXISTS metrics (
    code TEXT PRIMARY KEY,
    updated_at INTEGER,
    current_price REAL,
    current_date TEXT,
    return_1d REAL,
    return_1w REAL,
    return_1m REAL,
    return_3m REAL,
    return_6m REAL,
    return_1y REAL,
    return_ytd REAL,
    return_all REAL,
    volatility_30 REAL,
    volatility_90 REAL,
    sharpe_90 REAL,
    max_drawdown_1y REAL,
    ma_30 REAL,
    ma_90 REAL,
    ma_200 REAL,
    aum REAL,
    investor_count INTEGER,
    flow_1w REAL,
    flow_1m REAL,
    flow_3m REAL
  )`,

  `CREATE TABLE IF NOT EXISTS category_stats (
    category TEXT NOT NULL,
    period TEXT NOT NULL,
    fund_count INTEGER,
    total_aum REAL,
    avg_return REAL,
    median_return REAL,
    top_fund_code TEXT,
    top_fund_return REAL,
    updated_at INTEGER,
    PRIMARY KEY (category, period)
  )`,

  `CREATE TABLE IF NOT EXISTS correlations (
    code_a TEXT NOT NULL,
    code_b TEXT NOT NULL,
    correlation REAL,
    window_days INTEGER,
    updated_at INTEGER,
    PRIMARY KEY (code_a, code_b, window_days)
  )`,

  `CREATE TABLE IF NOT EXISTS daily_summary (
    date TEXT PRIMARY KEY,
    top_gainers TEXT,
    top_losers TEXT,
    category_stats TEXT,
    total_funds INTEGER,
    total_aum REAL,
    total_investors INTEGER,
    updated_at INTEGER
  )`,

  `CREATE TABLE IF NOT EXISTS cpi_tr (
    date TEXT PRIMARY KEY,
    index_value REAL,
    yoy_change REAL,
    mom_change REAL,
    source TEXT,
    updated_at INTEGER
  )`,

  `CREATE TABLE IF NOT EXISTS cpi_announcements (
    period TEXT PRIMARY KEY,
    scheduled_date TEXT,
    scheduled_time TEXT,
    actual_datetime TEXT,
    published INTEGER DEFAULT 0,
    source TEXT,
    updated_at INTEGER
  )`,

  `CREATE TABLE IF NOT EXISTS weekly_reports (
    week_ending TEXT PRIMARY KEY,
    slug TEXT UNIQUE,
    title TEXT,
    content_json TEXT,
    published_at INTEGER
  )`,

  `CREATE TABLE IF NOT EXISTS ingest_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at INTEGER,
    finished_at INTEGER,
    kind TEXT,
    status TEXT,
    rows_inserted INTEGER,
    error TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    plan TEXT NOT NULL DEFAULT 'free',
    role TEXT NOT NULL DEFAULT 'user',
    email_verified_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,

  `CREATE TABLE IF NOT EXISTS email_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    used_at INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON email_verifications(user_id)`,

  `CREATE TABLE IF NOT EXISTS contact_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    replied_at INTEGER,
    reply_subject TEXT,
    reply_body TEXT,
    ip TEXT,
    user_agent TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_contact_messages_created ON contact_messages(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_contact_messages_unread ON contact_messages(is_read)`,

  `CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    key_hash TEXT UNIQUE NOT NULL,
    key_prefix TEXT NOT NULL,
    name TEXT,
    last_used_at INTEGER,
    revoked_at INTEGER,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id)`,

  `CREATE TABLE IF NOT EXISTS usage_counters (
    key_id INTEGER NOT NULL,
    period TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (key_id, period),
    FOREIGN KEY (key_id) REFERENCES api_keys(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_usage_counters_period ON usage_counters(period)`,

  // Virtual portfolio (user-owned fund holdings for tracking)
  `CREATE TABLE IF NOT EXISTS virtual_portfolios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL DEFAULT 'Portföyüm',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_portfolios_user ON virtual_portfolios(user_id)`,

  `CREATE TABLE IF NOT EXISTS portfolio_holdings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    portfolio_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    units REAL NOT NULL,
    cost_basis_try REAL NOT NULL,
    purchased_at TEXT,
    note TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (portfolio_id) REFERENCES virtual_portfolios(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_holdings_portfolio ON portfolio_holdings(portfolio_id)`,

  // Price alerts
  `CREATE TABLE IF NOT EXISTS price_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    kind TEXT NOT NULL,
    threshold REAL NOT NULL,
    triggered_at INTEGER,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_alerts_user ON price_alerts(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_alerts_enabled ON price_alerts(enabled)`,

  // Fund change audit log
  `CREATE TABLE IF NOT EXISTS fund_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL,
    field TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    detected_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_fund_changes_code ON fund_changes(code, detected_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_fund_changes_at ON fund_changes(detected_at DESC)`,

  // AI-generated fund summaries (cached)
  `CREATE TABLE IF NOT EXISTS ai_summaries (
    code TEXT PRIMARY KEY,
    summary TEXT NOT NULL,
    model TEXT,
    generated_at INTEGER NOT NULL,
    prompt_hash TEXT
  )`,

  // Weekly digest subscriptions
  `CREATE TABLE IF NOT EXISTS weekly_subs (
    user_id INTEGER PRIMARY KEY,
    enabled INTEGER NOT NULL DEFAULT 1,
    last_sent_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,

  // Live market tickers (FX, gold) — updated hourly from TCMB + sources
  `CREATE TABLE IF NOT EXISTS live_market (
    symbol TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    value REAL NOT NULL,
    change_pct REAL,
    previous REAL,
    source TEXT,
    fetched_at INTEGER NOT NULL
  )`,

  // X (Twitter) post queue — admin drafts + auto-generated tweets awaiting send
  `CREATE TABLE IF NOT EXISTS x_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'manual',
    status TEXT NOT NULL DEFAULT 'draft',
    scheduled_at INTEGER,
    posted_at INTEGER,
    tweet_id TEXT,
    error TEXT,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_x_posts_status ON x_posts(status)`,
  `CREATE INDEX IF NOT EXISTS idx_x_posts_scheduled ON x_posts(scheduled_at)`,

  `CREATE TABLE IF NOT EXISTS fund_holdings (
    code TEXT NOT NULL,
    report_date TEXT NOT NULL,
    asset_name TEXT NOT NULL,
    asset_code TEXT,
    asset_type TEXT,
    isin TEXT,
    weight REAL NOT NULL DEFAULT 0,
    market_value REAL,
    nominal_value REAL,
    kap_disclosure_id INTEGER,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (code, report_date, asset_name)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_fund_holdings_code ON fund_holdings(code)`,
  `CREATE INDEX IF NOT EXISTS idx_fund_holdings_date ON fund_holdings(report_date)`,

  // İş Yatırım parametrik hisse tarayıcı verisi — günlük snapshot.
  // Fon portföyündeki hisseler için ağırlıklı analist konsensüsü (hedef fiyat,
  // getiri potansiyeli %, AL/SAT/TUT) hesaplamasında kullanılır.
  `CREATE TABLE IF NOT EXISTS isyatirim_stocks (
    ticker TEXT PRIMARY KEY,
    name TEXT,
    close_price REAL,
    target_price REAL,
    potential_pct REAL,
    pe_ratio REAL,
    market_cap_mn_tl REAL,
    recommendation TEXT,
    as_of_date TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_isyatirim_stocks_date ON isyatirim_stocks(as_of_date)`,
  `CREATE INDEX IF NOT EXISTS idx_isyatirim_stocks_recommendation ON isyatirim_stocks(recommendation)`,

  // Her ingest çağrısının özeti. Admin panelinde "Analist" sekmesinde listelenir.
  // trigger: 'cron' | 'manual' — kim başlattı.
  `CREATE TABLE IF NOT EXISTS isyatirim_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at INTEGER NOT NULL,
    finished_at INTEGER,
    duration_ms INTEGER,
    total INTEGER,
    tagged INTEGER,
    errors INTEGER,
    trigger TEXT,
    error_message TEXT,
    status TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_isyatirim_runs_started ON isyatirim_runs(started_at DESC)`,

  // Generic aracı kurum analist tavsiyeleri — İş Yatırım tek kaynağın genişletilmiş
  // hali. broker kolonu: 'isyatirim' | 'ykyatirim' | (ileride) 'ziraatyatirim' vb.
  // Fon portföylerindeki hisselerin multi-broker konsensüsünü hesaplamak için.
  // İş Yatırım tüm BIST'i tararken YKY sadece kendi model portföyünü verir —
  // bu yüzden "kapsam" broker başına değişir; consensus hesabında görünür.
  `CREATE TABLE IF NOT EXISTS broker_recommendations (
    broker TEXT NOT NULL,
    ticker TEXT NOT NULL,
    name TEXT,
    close_price REAL,
    target_price REAL,
    potential_pct REAL,
    recommendation TEXT,
    pe_ratio REAL,
    market_cap_mn_tl REAL,
    weight_pct REAL,
    entry_date TEXT,
    report_title TEXT,
    report_url TEXT,
    as_of_date TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (broker, ticker)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_broker_recs_ticker ON broker_recommendations(ticker)`,
  `CREATE INDEX IF NOT EXISTS idx_broker_recs_broker_date ON broker_recommendations(broker, as_of_date)`,
  `CREATE INDEX IF NOT EXISTS idx_broker_recs_recommendation ON broker_recommendations(recommendation)`,

  // Ingest çalıştırma logu, broker boyutlu. isyatirim_runs'ın multi-broker muadili.
  `CREATE TABLE IF NOT EXISTS broker_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    broker TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    finished_at INTEGER,
    duration_ms INTEGER,
    total INTEGER,
    tagged INTEGER,
    errors INTEGER,
    trigger TEXT,
    error_message TEXT,
    status TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_broker_runs_broker_started ON broker_runs(broker, started_at DESC)`,

  `CREATE TABLE IF NOT EXISTS nav_estimates (
    code TEXT NOT NULL,
    estimate_date TEXT NOT NULL,
    estimated_change_pct REAL NOT NULL,
    confidence REAL NOT NULL,
    stock_coverage_pct REAL,
    holdings_date TEXT,
    actual_change_pct REAL,
    accuracy_error REAL,
    estimated_at INTEGER NOT NULL,
    verified_at INTEGER,
    PRIMARY KEY (code, estimate_date)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_nav_estimates_date ON nav_estimates(estimate_date)`,

  // KAP disclosures — fund-scoped only (KVH member type). Fed by disclosure/funds/byCriteria.
  `CREATE TABLE IF NOT EXISTS kap_disclosures (
    disclosure_index INTEGER PRIMARY KEY,
    fund_code TEXT,
    publish_date INTEGER NOT NULL,
    subject TEXT,
    kap_title TEXT,
    rule_type TEXT,
    period INTEGER,
    year INTEGER,
    attachment_count INTEGER DEFAULT 0,
    summary TEXT,
    fetched_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_kap_disclosures_fund ON kap_disclosures(fund_code, publish_date DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_kap_disclosures_recent ON kap_disclosures(publish_date DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_kap_disclosures_subject ON kap_disclosures(subject)`,

  // Watchlist — kullanıcı sahiplenmeden "izliyorum" listesi. Alarmlardan ayrı,
  // portföyden ayrı. Sosyal kanıt + AI briefing + öneri motoru kullanır.
  `CREATE TABLE IF NOT EXISTS watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    fund_code TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(user_id, fund_code),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_watchlist_fund ON watchlist(fund_code)`,

  // Per-fund KAP alerts — user opts in for a single fund; email sent on new disclosure.
  `CREATE TABLE IF NOT EXISTS kap_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    fund_code TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    last_notified_at INTEGER,
    created_at INTEGER NOT NULL,
    UNIQUE(user_id, fund_code),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_kap_alerts_user ON kap_alerts(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_kap_alerts_fund ON kap_alerts(fund_code, enabled)`,

  // Observability: sayfa ziyaretleri (client beacon'dan gelir). 30 gün tutulur.
  `CREATE TABLE IF NOT EXISTS page_visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    path TEXT NOT NULL,
    ip TEXT NOT NULL,
    user_id INTEGER,
    user_agent TEXT,
    referer TEXT,
    session_id TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_page_visits_ts ON page_visits(ts DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_page_visits_ip_ts ON page_visits(ip, ts DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_page_visits_session ON page_visits(session_id, ts DESC)`,

  // Observability: /api/*, /v1/* çağrıları. Hangi endpoint, hangi fon kodu,
  // hangi kullanıcı/IP, status, süre. 30 gün tutulur.
  `CREATE TABLE IF NOT EXISTS api_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    path TEXT NOT NULL,
    method TEXT NOT NULL,
    fund_code TEXT,
    ip TEXT,
    user_id INTEGER,
    api_key_id INTEGER,
    status INTEGER,
    duration_ms INTEGER,
    user_agent TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE SET NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_api_requests_ts ON api_requests(ts DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_api_requests_fund_ts ON api_requests(fund_code, ts DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_api_requests_path_ts ON api_requests(path, ts DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_api_requests_ip_ts ON api_requests(ip, ts DESC)`,

  // Observability: giden mail'lerin kopyası. Admin paneline düşer.
  `CREATE TABLE IF NOT EXISTS outgoing_emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    template TEXT,
    body_preview TEXT,
    body_html TEXT,
    status TEXT NOT NULL,
    error TEXT,
    user_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_outgoing_emails_ts ON outgoing_emails(ts DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_outgoing_emails_to ON outgoing_emails(to_email, ts DESC)`,

  // AdSense yerleşimleri — admin panelden yönetilir.
  // placement = sabit kod (home-hero, fon-top, ...); slot_id = AdSense data-ad-slot.
  `CREATE TABLE IF NOT EXISTS ad_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    placement TEXT NOT NULL UNIQUE,
    label TEXT,
    slot_id TEXT,
    format TEXT NOT NULL DEFAULT 'auto',
    enabled INTEGER NOT NULL DEFAULT 0,
    impressions INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ad_slots_placement ON ad_slots(placement)`,
];

const ADDITIONAL_COLUMNS: Array<{ table: string; column: string; type: string }> = [
  { table: 'funds', column: 'isin', type: 'TEXT' },
  { table: 'funds', column: 'risk_score', type: 'INTEGER' },
  { table: 'funds', column: 'kap_url', type: 'TEXT' },
  { table: 'funds', column: 'trading_status', type: 'TEXT' },
  { table: 'funds', column: 'trading_start', type: 'TEXT' },
  { table: 'funds', column: 'trading_end', type: 'TEXT' },
  { table: 'funds', column: 'buy_valor', type: 'INTEGER' },
  { table: 'funds', column: 'sell_valor', type: 'INTEGER' },
  { table: 'funds', column: 'profile_updated_at', type: 'INTEGER' },
  // Faz C: extended risk-adjusted metrics
  { table: 'metrics', column: 'sortino_90', type: 'REAL' },
  { table: 'metrics', column: 'calmar_1y', type: 'REAL' },
  { table: 'metrics', column: 'beta_1y', type: 'REAL' },
  { table: 'metrics', column: 'real_return_1y', type: 'REAL' },
  // TÜFE enrichment
  { table: 'cpi_tr', column: 'mom_change', type: 'REAL' },
  { table: 'cpi_tr', column: 'source', type: 'TEXT' },
  // Email verification
  { table: 'users', column: 'email_verified_at', type: 'INTEGER' },
  // Admin: manually disable a user
  { table: 'users', column: 'disabled_at', type: 'INTEGER' },
  // Per-user custom limit overrides (NULL = fall back to plan default)
  { table: 'users', column: 'custom_monthly_quota', type: 'INTEGER' },
  { table: 'users', column: 'custom_daily_quota', type: 'INTEGER' },
  { table: 'users', column: 'custom_rpm', type: 'INTEGER' },
  { table: 'users', column: 'limit_note', type: 'TEXT' },
  // KAP bildirimleri: fon bazında son "derin backfill" zamanı (null = henüz backfill edilmemiş)
  { table: 'funds', column: 'kap_backfilled_at', type: 'INTEGER' },
  // Watchlist klasör/grup — null = "Genel"
  { table: 'watchlist', column: 'folder', type: 'TEXT' },
  // Geo: Cloudflare cf-ipcountry header'ından okunur ('TR','US','DE'...). '-' veya NULL = bilinmiyor.
  { table: 'page_visits', column: 'country', type: 'TEXT' },
  { table: 'api_requests', column: 'country', type: 'TEXT' },
  // API çağrısının nereden geldiği: Origin (CORS'ta dönen domain) ve Referer (tam URL).
  // Örn: Origin="https://acme.com" → API'yi hangi siteden çağırıyorlar.
  { table: 'api_requests', column: 'origin', type: 'TEXT' },
  { table: 'api_requests', column: 'referer', type: 'TEXT' },
  // Mail → contact_message eşlemesi: thread görünümü için
  { table: 'outgoing_emails', column: 'contact_message_id', type: 'INTEGER' },
];

export function applySchema(db: Database): void {
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  for (const stmt of SCHEMA_STATEMENTS) {
    db.exec(stmt);
  }
  // Idempotent ALTER for older databases — guarded by checking pragma table_info
  for (const { table, column, type } of ADDITIONAL_COLUMNS) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    }
  }
}
