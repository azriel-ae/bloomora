// Browser tests for the Next.js template catalog. Build the app first (`pnpm build`).
// Optional sandbox override: PLAYWRIGHT_PATH=<global playwright entry or package directory>.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const req = createRequire(import.meta.url);
const { chromium } = req(process.env.PLAYWRIGHT_PATH ?? 'playwright');
const nextBin = path.join(root, 'node_modules/next/dist/bin/next');
const port = Number(process.env.BLOOMORA_CATALOG_PORT ?? 3187);
const base = `http://127.0.0.1:${port}`;

let child;
let browser;
let output = '';
const problems = [];

try {
  child = spawn(process.execPath, [nextBin, 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: root,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.setEncoding('utf8').on('data', (chunk) => { output = `${output}${chunk}`.slice(-6000); });
  child.stderr.setEncoding('utf8').on('data', (chunk) => { output = `${output}${chunk}`.slice(-6000); });

  let ready = false;
  for (let attempt = 0; attempt < 180; attempt++) {
    if (child.exitCode !== null) throw new Error(`Next.js server exited early (code ${child.exitCode}).\n${output}`);
    try {
      const response = await fetch(`${base}/id/templates`);
      if (response.status === 200) { ready = true; break; }
    } catch { /* Next is still starting. */ }
    await delay(250);
  }
  assert.ok(ready, `Next.js did not become ready at ${base}. Run pnpm build first.\n${output}`);

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') problems.push(message.text()); });

  await page.goto(`${base}/id/templates`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('[data-template-card]').count(), 4, 'catalog lists all active engine templates');
  const layouts = await page.locator('[data-template-art]').evaluateAll((elements) => [...new Set(elements.map((element) => element.getAttribute('data-layout')))]);
  assert.equal(layouts.length, 4, 'every catalog template has a distinct data-driven art composition');

  const search = page.getByRole('searchbox', { name: 'Cari template' });
  await search.fill('minimalis');
  assert.deepEqual(await page.locator('[data-template-card]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-template-card'))), ['just-a-letter'], 'search matches localized template content');

  await search.fill('');
  await page.locator('[data-category-filter="friendship"]').click();
  assert.deepEqual(await page.locator('[data-template-card]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-template-card'))), ['our-little-archive'], 'category filtering uses the engine category');

  await page.locator('[data-category-filter="wedding"]').click();
  assert.equal(await page.locator('[data-template-card]').count(), 0, 'categories without active templates return a real empty state');
  assert.equal(await page.locator('[data-empty-catalog]').isVisible(), true);
  await page.getByRole('button', { name: 'Hapus filter' }).click();
  assert.equal(await page.locator('[data-template-card]').count(), 4, 'clear filters restores the active catalog');

  assert.equal(await page.locator('[data-template-card] [data-demo-link]').count(), 1, 'only the real demo template exposes a card demo link');
  const chapterCard = page.locator('[data-template-card="chapter-of-us"]');
  assert.equal(await chapterCard.getByText('Unggulan').count(), 1, 'featured flag renders a localized badge');
  assert.equal(await chapterCard.locator('a[href="/create?template=chapter-of-us"]').count(), 1, 'use-template CTA retains selected template');

  await page.goto(`${base}/id/templates/our-little-archive`, { waitUntil: 'networkidle' });
  assert.equal(await page.getByRole('heading', { name: 'Arsip Kecil Kita' }).count(), 1, 'detail route resolves the localized engine name');
  assert.equal(await page.locator('[data-template-art][data-layout="scrapbook"]').count(), 1, 'detail page preview reflects its own layout data');
  assert.deepEqual(await page.locator('[data-eligible-package]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-eligible-package'))), ['plus', 'premium'], 'extended template lists only packages whose active rules permit its tier');
  assert.equal(await page.getByRole('link', { name: 'Jelajahi demo langsung' }).count(), 0, 'template without demo has no demo CTA');

  await page.goto(`${base}/id/templates/chapter-of-us`, { waitUntil: 'networkidle' });
  assert.equal(await page.getByRole('heading', { name: 'Bab Tentang Kita' }).count(), 1);
  assert.equal(await page.getByRole('link', { name: 'Jelajahi demo langsung' }).getAttribute('href'), '/demo/chapter-of-us');

  await page.goto(`${base}/create?template=chapter-of-us`, { waitUntil: 'networkidle' });
  assert.equal(await page.getByText('Bab Tentang Kita', { exact: true }).count() >= 1, true, 'create page keeps the selected template from its query string');

  await page.goto(`${base}/id`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('[data-template-art][data-template-id="chapter-of-us"]').count() >= 1, true, 'homepage preview uses an active featured engine template');
  assert.equal(await page.locator('a[href="/templates/chapter-of-us"]').count() >= 1, true, 'homepage collection links to engine template ids');

  await page.goto(`${base}/id/g/demo`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('[data-template-art][data-template-id="pressed-garden"]').count(), 1, 'gift demo fallback keeps its matching template artwork');

  await page.goto(`${base}/id/editor/demo`, { waitUntil: 'networkidle' });
  assert.match(page.url(), /\/demo\/chapter-of-us$/, 'legacy mock-editor demo exits to the real recipient demo');
  assert.equal(await page.locator('.bl-root[data-mode="demo"]').count(), 1, 'legacy editor demo alias never presents fake editing controls');

  await page.goto(`${base}/en/templates/pressed-garden`, { waitUntil: 'networkidle' });
  assert.equal(await page.getByRole('heading', { name: 'Pressed Garden' }).count(), 1, 'English detail copy is localized');
  assert.equal(await page.getByRole('heading', { name: 'Eligible packages' }).count(), 1, 'package eligibility is localized in English');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/id/templates`, { waitUntil: 'networkidle' });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `mobile catalog has no horizontal overflow (got ${overflow}px)`);
  assert.equal(problems.length, 0, `browser has no page/console errors: ${problems.join('; ')}`);

  console.log('PASS catalog browser tests: search, category filter, empty/reset, badges/demo, detail/package eligibility, locale, create selection, mobile layout.');
} finally {
  if (browser) await browser.close();
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await Promise.race([new Promise((resolve) => child.once('exit', resolve)), delay(2500)]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
}
