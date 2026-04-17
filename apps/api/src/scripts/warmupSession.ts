import { writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-ignore - installed on server only
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = process.env.FONOLOJI_COOKIE_FILE ?? `${__dirname}/../../../../tefas-cookies.json`;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function main(): Promise<void> {
  const started = Date.now();
  console.log('[warmup] Launching chromium…');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: UA,
    viewport: { width: 1280, height: 800 },
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
  });
  const page = await context.newPage();

  console.log('[warmup] Navigating to tefas.gov.tr …');
  await page.goto('https://www.tefas.gov.tr/TarihselVeriler.aspx', {
    waitUntil: 'networkidle',
    timeout: 45_000,
  });
  // Allow JS challenge to set cookies; a second navigation often finalizes the TSPD cookie.
  await page.waitForTimeout(3_500);
  await page.goto('https://www.tefas.gov.tr/TarihselVeriler.aspx', {
    waitUntil: 'networkidle',
    timeout: 45_000,
  });
  await page.waitForTimeout(2_000);

  const cookies: Array<{ name: string; value: string }> = await context.cookies();
  const cookieHeader = cookies.map((c: { name: string; value: string }) => `${c.name}=${c.value}`).join('; ');
  await browser.close();

  writeFileSync(
    OUTPUT,
    JSON.stringify(
      { cookieHeader, userAgent: UA, capturedAt: Date.now(), cookies },
      null,
      2,
    ),
  );
  console.log(
    `[warmup] ${cookies.length} cookies captured in ${((Date.now() - started) / 1000).toFixed(1)}s → ${OUTPUT}`,
  );
  console.log(`[warmup] header: ${cookieHeader.slice(0, 200)}${cookieHeader.length > 200 ? '…' : ''}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[warmup] error:', err);
    process.exit(1);
  });
