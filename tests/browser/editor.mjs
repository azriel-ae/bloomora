// Browser integration test for the authenticated editor using the explicit process-memory dev sandbox.
// Run with `pnpm test:editor`; PLAYWRIGHT_PATH may point to an external Playwright installation.
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
const port = Number(process.env.BLOOMORA_EDITOR_PORT ?? 3188);
const base = `http://127.0.0.1:${port}`;
let child;
let browser;
let output = '';
const problems = [];

try {
  child = spawn(process.execPath, [nextBin, 'dev', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: root,
    env: { ...process.env, BLOOMORA_DEV_EDITOR: 'true', NEXT_TELEMETRY_DISABLED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.setEncoding('utf8').on('data', (chunk) => { output = `${output}${chunk}`.slice(-8000); });
  child.stderr.setEncoding('utf8').on('data', (chunk) => { output = `${output}${chunk}`.slice(-8000); });

  let ready = false;
  for (let attempt = 0; attempt < 240; attempt++) {
    if (child.exitCode !== null) throw new Error(`Next.js dev server exited early (code ${child.exitCode}).\n${output}`);
    try {
      const response = await fetch(`${base}/id/editor/new?template=chapter-of-us`);
      if (response.status === 200) { ready = true; break; }
    } catch { /* Next is compiling the route. */ }
    await delay(250);
  }
  assert.ok(ready, `Next.js dev server did not become ready at ${base}.\n${output}`);

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    const text = message.text();
    const expectedRejectedSave = /Failed to load resource: the server responded with a status of (?:409|403)/.test(text);
    if (message.type() === 'error' && !expectedRejectedSave) problems.push(text);
  });

  const landing = await page.goto(`${base}/id/editor/new?template=chapter-of-us`, { waitUntil: 'networkidle' });
  const warningVisible = await page.locator('[data-dev-warning]').isVisible();
  assert.equal(warningVisible, true, `volatile development storage is clearly disclosed (status=${landing?.status()}, url=${page.url()}, body=${(await page.locator('body').innerText()).slice(0, 300)})`);
  assert.equal(await page.locator('[data-editor-section="opening"]').count(), 1, 'form sections come from the selected template');
  assert.equal(await page.locator('[data-editor-section="music"] input[type="checkbox"]').count(), 0, 'media-required section cannot be toggled on without media');
  assert.equal(await page.locator('[data-editor-list="chapters"]').count(), 1, 'template list fields are rendered');
  assert.equal(await page.locator('button:disabled').filter({ hasText: 'Foto' }).count(), 1, 'photo upload is not presented as available');

  await page.locator('label[data-field-key="title"] input').fill('Cerita yang tumbuh bersama');
  await page.locator('label[data-field-key="letterBody"] textarea').fill('Setiap hari menyimpan satu cerita kecil.');
  const appreciationToggle = page.locator('[data-editor-section="appreciation"] input[type="checkbox"]');
  await appreciationToggle.uncheck();
  assert.equal(await page.locator('[data-editor-preview] [data-bl-section="appreciation"]').count(), 0, 'optional section toggle changes the live preview');
  await appreciationToggle.check();
  await page.locator('[data-create-draft]').click();
  await page.waitForURL(/\/editor\/g\//, { timeout: 15000 });
  await page.locator('[data-editor-gift-id]').waitFor({ state: 'visible' });
  const giftId = await page.locator('[data-editor-gift-id]').getAttribute('data-editor-gift-id');
  assert.ok(giftId, 'server returns a separate persisted gift ID');

  await page.locator('label[data-field-key="title"] input').fill('Judul yang autosave');
  await page.waitForFunction(() => {
    const status = document.querySelector('[data-save-status]');
    return status?.getAttribute('data-save-status') === 'saved' && status.textContent?.includes('v2');
  }, null, { timeout: 10000 });
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('label[data-field-key="title"] input').inputValue(), 'Judul yang autosave', 'autosaved content survives a page reload through the server API');

  const externalWrite = await page.evaluate(async (id) => {
    const current = await (await fetch(`/api/gifts/${id}`)).json();
    const content = current.draft.content;
    content.fields.title = 'Suntingan dari tab lain';
    const response = await fetch(`/api/gifts/${id}`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expectedVersion: current.draft.version, content }),
    });
    return { status: response.status, body: await response.json() };
  }, giftId);
  assert.equal(externalWrite.status, 200, 'second writer saves a newer server version');
  await page.locator('label[data-field-key="title"] input').fill('Suntingan lokal yang usang');
  await page.locator('[data-editor-status="conflict"]').waitFor({ state: 'visible', timeout: 10000 });
  assert.equal(await page.locator('[data-reload-server]').count(), 1, '409 conflict offers explicit reconciliation, not blind retry');
  await page.locator('[data-reload-server]').click();
  await page.waitForFunction(() => document.querySelector('[data-editor-status]')?.getAttribute('data-editor-status') === 'saved');
  assert.equal(await page.locator('label[data-field-key="title"] input').inputValue(), 'Suntingan dari tab lain', 'reconciliation loads the latest server draft');

  await page.route(`**/api/gifts/${giftId}`, async (route) => {
    if (route.request().method() === 'PUT') {
      await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ ok: false, code: 'subscription_expired' }) });
    } else await route.continue();
  });
  await page.locator('label[data-field-key="title"] input').fill('Perubahan lokal tetap dijaga');
  await page.locator('[data-readonly-reason="subscription_expired"]').waitFor({ state: 'visible', timeout: 10000 });
  assert.equal(await page.locator('label[data-field-key="title"] input').inputValue(), 'Perubahan lokal tetap dijaga', 'expired save rejection does not discard local edits');
  assert.equal(await page.locator('label[data-field-key="title"] input').isDisabled(), true, 'controls become read-only after expiry');

  const englishPage = await context.newPage();
  await englishPage.goto(`${base}/en/editor/new?template=pressed-garden`, { waitUntil: 'networkidle' });
  assert.equal(await englishPage.locator('[data-create-draft]').isVisible(), true, 'editor controls are localized in English');
  assert.equal(await englishPage.locator('[data-dev-warning]').textContent().then((text) => text?.includes('Local development sandbox')), true);
  assert.equal(problems.length, 0, `browser has no page/console errors: ${problems.join('; ')}\n${output}`);
  console.log('PASS editor browser tests: dynamic schema, GiftView preview, optional sections, media disabled, create, autosave/reload, 409 reconciliation, expired entitlement, en/id copy.');
} finally {
  if (browser) await browser.close();
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await Promise.race([new Promise((resolve) => child.once('exit', resolve)), delay(2500)]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
}
