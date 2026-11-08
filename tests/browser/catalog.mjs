// Browser tests for the Next.js template catalog. Build the app first (`pnpm build`).
// Optional sandbox override: PLAYWRIGHT_PATH=<global playwright entry or package directory>.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import ZXing from '@zxing/library';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const req = createRequire(import.meta.url);
const { chromium } = req(process.env.PLAYWRIGHT_PATH ?? 'playwright');
const { BarcodeFormat, EncodeHintType, QRCodeWriter } = ZXing;
const nextBin = path.join(root, 'node_modules/next/dist/bin/next');
const port = Number(process.env.BLOOMORA_CATALOG_PORT ?? 3187);
const base = `http://localhost:${port}`;

let child;
let browser;
let output = '';
const problems = [];

async function qrisFixturePng() {
  const matrix = new QRCodeWriter().encode('BLOOMORA QRIS CUSTOMER CARD TEST', BarcodeFormat.QR_CODE, 280, 280, new Map([[EncodeHintType.MARGIN, 4]]));
  const width = matrix.getWidth(); const height = matrix.getHeight(); const pixels = Buffer.alloc(width * height * 4, 255);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    if (!matrix.get(x, y)) continue;
    const offset = (y * width + x) * 4; pixels[offset] = 0; pixels[offset + 1] = 0; pixels[offset + 2] = 0; pixels[offset + 3] = 255;
  }
  return sharp(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

try {
  child = spawn(process.execPath, [nextBin, 'start', '--hostname', 'localhost', '--port', String(port)], {
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
      const response = await fetch(`${base}/robots.txt`);
      if (response.status === 200) { ready = true; break; }
    } catch { /* Next is still starting. */ }
    await delay(250);
  }
  assert.ok(ready, `Next.js did not become ready at ${base}. Run pnpm build first.\n${output}`);

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const location = message.location();
    // The test deliberately returns 502 for one chat request to verify silent failure handling.
    if (location.url.endsWith('/api/chat') && message.text().includes('502')) return;
    problems.push(`${message.text()} (${location.url}:${location.lineNumber})`);
  });
  await page.addInitScript(() => {
    window.__bloomoraSoundCount = 0;
    class MockAudioContext {
      state = 'running'; currentTime = 0; destination = {};
      createOscillator() { return { type: 'sine', frequency: { setValueAtTime() {} }, connect() {}, start() { window.__bloomoraSoundCount++; }, stop() {} }; }
      createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
      resume() { return Promise.resolve(); }
    }
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: MockAudioContext });
  });
  await page.route('**/api/chat', async (route) => {
    const body = route.request().postDataJSON();
    const latest = body?.messages?.at(-1)?.text;
    if (latest === 'uji gagal') return route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'Panduan sedang istirahat sebentar.' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: 'Balasan uji selesai.' }) });
  });

  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  const homepageCreateLinks = page.getByRole('link', { name: 'Buat hadiah' });
  assert.equal(await homepageCreateLinks.count(), 1, 'desktop header has one Buat hadiah CTA');
  assert.equal(await homepageCreateLinks.first().getAttribute('href'), 'https://bloomora.my.id/templates', 'desktop Buat hadiah CTA goes to the requested apex templates URL');
  const templateStartLinks = page.getByRole('link', { name: 'Mulai dari template' });
  assert.equal(await templateStartLinks.count(), 2, 'hero and lower homepage template CTAs are present');
  assert.deepEqual(await templateStartLinks.evaluateAll((links) => links.map((link) => link.getAttribute('href'))), [
    'https://bloomora.my.id/templates', 'https://bloomora.my.id/templates',
  ], 'homepage template CTAs go to the requested apex templates URL');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Buka menu' }).click();
  assert.equal(await page.getByRole('link', { name: 'Buat hadiah' }).getAttribute('href'), 'https://bloomora.my.id/templates', 'mobile menu Buat hadiah CTA uses the requested URL');
  await page.setViewportSize({ width: 1280, height: 850 });

  await page.goto(`${base}/id/templates`, { waitUntil: 'networkidle' });
  const initialTemplateIds = await page.locator('[data-template-card]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-template-card')));
  assert.equal(initialTemplateIds.length, 37, 'catalog count reflects the curated active collection');
  assert.equal(new Set(initialTemplateIds).size, initialTemplateIds.length, 'catalog lists each active engine template exactly once');
  const filterGroup = page.locator('fieldset [role="group"]');
  const categoryIds = await page.locator('[data-category-filter]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-category-filter')));
  assert.deepEqual(categoryIds, ['romantic-anniversary', 'birthday-celebration', 'family-friendship', 'appreciation-thanks', 'graduation-achievement', 'special-moments'], 'catalog exposes exactly the six requested categories');
  const layouts = await page.locator('[data-template-art]').evaluateAll((elements) => [...new Set(elements.map((element) => element.getAttribute('data-layout')))]);
  assert.equal(layouts.length, 4, 'catalog includes each implemented data-driven art composition');

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileFilterLayout = await filterGroup.evaluate((element) => ({
    overflowX: getComputedStyle(element).overflowX,
    scrolls: element.scrollWidth > element.clientWidth,
    buttonTops: [...element.querySelectorAll('button')].map((button) => Math.round(button.getBoundingClientRect().top)),
  }));
  assert.equal(mobileFilterLayout.overflowX, 'auto', 'mobile category controls scroll horizontally');
  assert.equal(mobileFilterLayout.scrolls, true, 'mobile category controls stay in one compact scroll row');
  assert.equal(new Set(mobileFilterLayout.buttonTops).size, 1, 'mobile category chips do not wrap into multiple rows');
  for (const id of categoryIds) {
    await page.locator(`[data-category-filter="${id}"]`).click();
    const shownCategories = await page.locator('[data-template-card]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-template-category')));
    assert.ok(shownCategories.length > 0, `${id} has catalog results`);
    assert.ok(shownCategories.every((category) => category === id), `${id} filter shows only its assigned templates`);
  }
  await page.getByRole('button', { name: 'Semua' }).click();

  const search = page.getByRole('searchbox', { name: 'Cari template' });
  await search.fill('minimalis');
  assert.deepEqual(await page.locator('[data-template-card]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-template-card'))), ['just-a-letter', 'wedding-quiet-ivory'], 'search matches localized template content');

  await search.fill('');
  await search.fill('not-a-real-template');
  assert.equal(await page.locator('[data-template-card]').count(), 0, 'unmatched search returns a real empty state');
  assert.equal(await page.locator('[data-empty-catalog]').isVisible(), true);
  await page.getByRole('button', { name: 'Hapus filter' }).click();
  assert.equal(await page.locator('[data-template-card]').count(), initialTemplateIds.length, 'clear filters restores the active catalog');

  assert.equal(await page.locator('[data-template-card] [data-demo-link]').count(), 3, 'all interactive demo templates expose their dynamic demo links');
  for (const id of ['chapter-of-us', 'for-you-scrapbook', 'interactive-flower-adventure']) {
    const demoLink = page.locator(`[data-template-card="${id}"] [data-demo-link]`);
    assert.equal(await demoLink.getAttribute('href'), `/demo/${id}`, `${id} links to its dynamic demo route`);
  }
  for (const id of initialTemplateIds) {
    const response = await page.request.get(`${base}/templates/${id}`);
    assert.equal(response.status(), 200, `${id} detail route is accessible`);
  }
  const archivedDetail = await page.request.get(`${base}/templates/wedding-garden-vows`);
  assert.equal(archivedDetail.status(), 404, 'archived templates are no longer available as new catalog details');

  await page.setViewportSize({ width: 1280, height: 850 });
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

  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Panduan Bloomora' }).click();
  assert.equal(await page.evaluate(() => window.__bloomoraSoundCount), 0, 'opening chat does not autoplay sound');
  assert.equal(await page.getByRole('button', { name: /suara balasan/i }).count(), 0, 'mandatory notification has no speaker on/off control');
  await page.getByPlaceholder('Tulis pesan…').fill('uji sukses');
  await page.getByRole('button', { name: 'Kirim' }).click();
  await page.getByText('Balasan uji selesai.', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.__bloomoraSoundCount), 2, 'one completed reply always produces the two-note notification');
  await page.getByPlaceholder('Tulis pesan…').fill('uji gagal');
  await page.getByRole('button', { name: 'Kirim' }).click();
  await page.getByText('Panduan sedang istirahat sebentar.', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.__bloomoraSoundCount), 2, 'failed replies do not produce a notification');
  await page.getByPlaceholder('Tulis pesan…').fill('uji wajib kedua');
  await page.getByRole('button', { name: 'Kirim' }).click();
  await page.getByText('Balasan uji selesai.', { exact: true }).last().waitFor();
  assert.equal(await page.evaluate(() => window.__bloomoraSoundCount), 4, 'notification stays mandatory on every successful reply');

  await page.goto(`${base}/id`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('[data-template-art][data-template-id="chapter-of-us"]').count() >= 1, true, 'homepage preview uses an active featured engine template');
  assert.equal(await page.locator('.bl-root[data-mode="demo"]').count(), 0, 'homepage remains the Bloomora landing page, not a full-screen recipient demo');
  assert.equal(await page.getByRole('link', { name: 'Lihat demo pilihan: Bab Tentang Kita' }).getAttribute('href'), '/demo/chapter-of-us', 'homepage demo link targets the selected Featured Demo');
  await page.waitForFunction(() => [...document.querySelectorAll('a')].some((link) => link.textContent?.trim() === 'Demo' && link.getAttribute('href') === '/demo/chapter-of-us'));
  const publicDemoResponse = await page.request.get(`${base}/api/featured-demo`);
  assert.equal(publicDemoResponse.status(), 200, 'public demo selection is available without login');
  assert.equal((await publicDemoResponse.json()).templateId, 'chapter-of-us', 'public demo endpoint returns the active template ID');
  assert.equal(await page.getByRole('link', { name: 'Demo', exact: true }).getAttribute('href'), '/demo/chapter-of-us', 'header Demo link points directly to the selected template');
  assert.equal(await page.locator('a[href="/templates/chapter-of-us"]').count() >= 1, true, 'homepage collection links to engine template ids');

  await page.route('**/api/featured-demo', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ templateId: 'pressed-garden' }) }));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => [...document.querySelectorAll('a')].some((link) => link.textContent?.trim() === 'Demo' && link.getAttribute('href') === '/demo/pressed-garden'));
  assert.equal(await page.getByRole('link', { name: 'Demo', exact: true }).getAttribute('href'), '/demo/pressed-garden', 'desktop navbar follows a newly selected demo');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Buka menu' }).click();
  assert.equal(await page.getByRole('link', { name: 'Demo', exact: true }).getAttribute('href'), '/demo/pressed-garden', 'mobile navbar follows the same newly selected demo');
  await page.unroute('**/api/featured-demo');
  await page.setViewportSize({ width: 1280, height: 850 });
  await page.goto(`${base}/demo`, { waitUntil: 'networkidle' });
  assert.match(page.url(), /\/demo\/chapter-of-us$/, 'public /demo alias redirects to the active renderer');

  await page.goto(`${base}/id/g/demo`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('[data-template-art][data-template-id="pressed-garden"]').count(), 1, 'gift demo fallback keeps its matching template artwork');

  await page.goto(`${base}/id/editor/demo`, { waitUntil: 'networkidle' });
  assert.match(page.url(), /\/demo\/chapter-of-us$/, 'legacy mock-editor demo exits to the real recipient demo');
  assert.equal(await page.locator('.bl-root[data-mode="demo"]').count(), 1, 'legacy editor demo alias never presents fake editing controls');

  await page.goto(`${base}/en/templates/pressed-garden`, { waitUntil: 'networkidle' });
  assert.equal(new URL(page.url()).pathname, '/templates/pressed-garden', 'legacy English-prefixed links redirect to the canonical unprefixed route');
  assert.equal(await page.locator('html').getAttribute('lang'), 'id', 'all routes declare Indonesian as their language');
  assert.equal(await page.getByRole('button', { name: /bahasa|language/i }).count(), 0, 'no language selector remains');
  const cookies = await page.context().cookies(base);
  assert.equal(cookies.some((cookie) => cookie.name === 'bloomora_locale'), false, 'the app does not set a language-preference cookie');

  const robots = await (await page.request.get(`${base}/robots.txt`)).text();
  const sitemap = await (await page.request.get(`${base}/sitemap.xml`)).text();
  assert.ok(robots.includes('https://bloomora.my.id/sitemap.xml'), 'robots references the official sitemap');
  assert.ok(sitemap.includes('https://bloomora.my.id/templates'), 'sitemap URLs use the official domain');

  await page.addInitScript(() => sessionStorage.setItem('bloomora_order_access:qr-test', 'fixture-order-token'));
  await page.route('**/api/guest/orders/qr-test', async (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, order: {
      orderId: 'qr-test', giftId: null, giftSlug: null, packageId: 'basic', packageName: 'Basic', originalAmountIdr: 39000,
      discountIdr: 0, amountIdr: 39000, voucherCode: null,
      paymentMethod: { name: 'QRIS Demo', instructions: 'Pindai kode untuk membayar.', paymentType: 'qris', providerName: null,
        accountNumber: null, accountHolder: null, imageUrl: 'https://storage.example/verified-crop.png', qrisDetectionStatus: 'confirmed',
        qrisDisplay: { title: 'Bayar dengan tenang', description: 'Pindai kode QRIS asli.', backgroundColor: '#fffaf3', accentColor: '#66745d', borderColor: '#d9d1c5', footer: 'Bloomora · pembayaran aman', logoUrl: '/favicon.svg', frameStyle: 'card', decoration: 'petals' } },
      status: 'awaiting_payment', createdAtMs: 1_800_000_000_000, updatedAtMs: 1_800_000_000_000,
    } }),
  }));
  const qrisFixture = await qrisFixturePng();
  await page.route('**/api/guest/orders/qr-test/qris-image', async (route) => route.fulfill({ status: 200, contentType: 'image/png', body: qrisFixture }));
  await page.goto(`${base}/payment/orders/qr-test`, { waitUntil: 'networkidle' });
  const paymentCard = page.locator('[data-qris-payment-card="true"]');
  await paymentCard.waitFor({ state: 'visible' });
  assert.equal(await paymentCard.getByRole('heading', { name: 'Bayar dengan tenang' }).count(), 1, 'customer QR card uses the saved admin title');
  assert.equal(await paymentCard.getByText('Bloomora · pembayaran aman', { exact: true }).count(), 1, 'customer QR card preserves the configured footer');
  const qrBox = await paymentCard.locator('img[alt="QRIS Demo QRIS"]').boundingBox();
  const cardBox = await paymentCard.boundingBox();
  assert.ok(qrBox && cardBox && qrBox.x >= cardBox.x && qrBox.y > cardBox.y, 'QR remains inside its dedicated white area and below the header decorations');
  const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });
  await page.getByRole('button', { name: 'Unduh gambar QRIS' }).click();
  const qrisDownload = await downloadPromise.catch(async (error) => {
    const alerts = await page.getByRole('alert').allTextContents();
    const disabled = await page.getByRole('button', { name: 'Unduh gambar QRIS' }).isDisabled();
    const images = await paymentCard.locator('img').evaluateAll((elements) => elements.map((image) => ({ src: image.getAttribute('src'), currentSrc: image.currentSrc, width: image.naturalWidth, height: image.naturalHeight })));
    throw new Error(`QRIS card download did not start (button disabled: ${disabled}; alerts: ${alerts.join(' | ')}; images: ${JSON.stringify(images)}; console: ${problems.join(' | ')}): ${error.message}`);
  });
  assert.equal(qrisDownload.suggestedFilename(), 'bloomora-qris-qr-test.png', 'download exports the final Bloomora card as PNG');
  const downloadedPath = await qrisDownload.path();
  assert.ok(downloadedPath, 'browser produced a downloadable PNG file');
  const downloadedMetadata = await sharp(await readFile(downloadedPath)).metadata();
  assert.ok(downloadedMetadata.format === 'png' && (downloadedMetadata.width ?? 0) >= 500, 'download is a high-resolution raster of the final styled card');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/id/templates`, { waitUntil: 'networkidle' });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `mobile catalog has no horizontal overflow (got ${overflow}px)`);
  assert.equal(problems.length, 0, `browser has no page/console errors: ${problems.join('; ')}`);

  console.log('PASS catalog browser tests: homepage apex CTAs, search/category/empty/reset, badges/demo, detail/package eligibility, Indonesian-only routing, canonical domain, customer QRIS card and PNG download, create selection, mobile layout.');
} finally {
  if (browser) await browser.close();
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await Promise.race([new Promise((resolve) => child.once('exit', resolve)), delay(2500)]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
}
