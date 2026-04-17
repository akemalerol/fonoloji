# Changelog

## [1.0.0] - 2026-04-15

### Added
- Initial release with five scraping modes: `daily`, `historical`, `fund_list`, `fund_detail`, `comparison`.
- `TefasClient` with ViewState / EventValidation management, cookie jar via `tough-cookie`,
  exponential backoff retry, and configurable rate limiting.
- Automatic 3-month window splitting for historical date ranges.
- HTML table parser for `TarihselVeriler.aspx` response.
- Inline chart data parser (`FonAnaliz.aspx` → Highcharts payload).
- Portfolio allocation parser with Turkish → normalized asset class mapping.
- Comparison table parser for `FonKarsilastirma.aspx`.
- Returns calculator (daily / weekly / monthly / 3m / 6m / 1y / YTD).
- Input validator with warnings for unsupported features (currency conversion, etc.).
- Apify Actor scaffolding: `.actor/actor.json`, `input_schema.json`, PPE charge events.
- Vitest test suite covering parsers, utilities, and HTTP client behavior.
