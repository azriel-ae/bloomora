// Real-browser tests for the gift experience (Chromium via Playwright), run against the esbuild bundle.
// Usage: node tests/browser/build.mjs && node tests/browser/run.mjs
// Sandbox: PLAYWRIGHT_PATH=<global playwright dir>. Screenshots go to tests/browser/shots/.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const req = createRequire(import.meta.url);
const { chromium } = req(process.env.PLAYWRIGHT_PATH ?? 'playwright');
const shots = path.join(here, 'shots'); mkdirSync(shots, { recursive: true });
const base = pathToFileURL(path.join(here, 'dist/index.html')).href;

const results = []; let current = '';
const check = (name, ok, detail = '') => results.push({ group: current, name, ok: !!ok, detail: ok ? '' : String(detail) });
const group = (g) => { current = g; };
const EMOJI = /[\u2600-\u27BF\u{1F000}-\u{1FAFF}\uFE0F\u200D]/u;

const browser = await chromium.launch();
const DESKTOP = { viewport: { width: 1280, height: 800 } };
const MOBILE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

async function page(ctxOpts, query) {
  const ctx = await browser.newContext(ctxOpts);
  const p = await ctx.newPage();
  const problems = []; const failedRequests = [];
  p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) problems.push(`${m.type()}: ${m.text()}`); });
  p.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  p.on('requestfailed', (r) => failedRequests.push(r.url().slice(0, 80)));
  await p.goto(`${base}?${query}`);
  await p.waitForSelector('.bl-root');
  return { p, ctx, problems, failedRequests };
}
const shot = (p, n) => p.screenshot({ path: path.join(shots, `${n}.png`) });
async function open(p, label = 'Buka surat') {
  await p.getByRole('button', { name: label }).click();
  await p.waitForSelector('.bl-opening', { state: 'detached', timeout: 5000 });
  await p.waitForTimeout(150);
}
const goTo = async (p, sel, wait = 900) => { await p.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'start', behavior: 'instant' }), sel); await p.waitForTimeout(wait); };
const text = (p, sel) => p.locator(sel).first().evaluate((el) => (el instanceof HTMLElement ? el.innerText : el.textContent ?? '').trim());
const overflowX = (p) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const inViewport = (p, sel) => p.locator(sel).first().evaluate((el) => { const r = el.getBoundingClientRect(); return r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; });

/* ============ A. Desktop, Indonesian, full sample content ============ */
group('Desktop / id / full content');
{
  const { p, ctx, problems, failedRequests } = await page(DESKTOP, 'locale=id');
  check('sealed on load: opening visible, story hidden', await p.locator('.bl-opening').isVisible() && await p.locator('.bl-story').evaluate((e) => e.hidden));
  check('opening shows recipient and sender', (await text(p, '.bl-open-recipient')) === 'Maya' && (await text(p, '.bl-open-from')) === 'Dari Arga');
  check('seal monogram uses both initials', (await text(p, '.bl-seal text')) === 'AM');
  check('page cannot scroll while sealed', (await p.evaluate(() => document.documentElement.scrollHeight - innerHeight)) <= 1);
  await p.getByRole('button', { name: 'Buka surat' }).click();
  await p.waitForSelector('.bl-phase-opening', { timeout: 1000 });
  check('opening animation starts and button locks to avoid double trigger', await p.getByRole('button', { name: 'Buka surat' }).isDisabled());
  await p.waitForSelector('.bl-opening', { state: 'detached', timeout: 5000 });
  check('opening finishes and unmounts', true);
  check('story visible and receives focus after opening', await p.locator('.bl-story').isVisible() && await p.evaluate(() => document.activeElement?.classList.contains('bl-story')));
  const sections = await p.$$eval('[data-bl-section]', (els) => els.map((e) => e.dataset.blSection));
  check('sections render in template order, no music without audio', JSON.stringify(sections) === JSON.stringify(['hero', 'letter', 'timeline', 'gallery', 'message', 'appreciation', 'closing']), sections);
  check('exactly one h1 after opening', (await p.locator('h1').count()) === 1 && (await text(p, 'h1')) === 'Tiga Tahun, Satu Cerita');
  check('hero shows subtitle, date line and for/from', (await text(p, '.bl-hero-sub')).includes('Buku kecil') && (await text(p, '.bl-hero-date')).includes('2026') && (await text(p, '.bl-hero-for')).includes('Untuk Maya'));
  await shot(p, 'desktop-id-hero');

  await goTo(p, '#bl-letter');
  check('letter: greeting + 4 paragraphs + sign-off', (await text(p, '.bl-letter-greeting')) === 'Untuk Maya,' && (await p.locator('.bl-letter-body p').count()) === 4 && (await text(p, '.bl-letter-signoff')) === 'Selalu milikmu,');
  check('chapter numbering I..IV for letter/timeline/gallery/reasons', JSON.stringify(await p.$$eval('.bl-eyebrow', (e) => e.map((x) => x.textContent).filter((t) => t.startsWith('Bab')))) === JSON.stringify(['Bab I', 'Bab II', 'Bab III', 'Bab IV', 'Bab V']));

  await goTo(p, '#bl-timeline');
  check('timeline: 5 chapters, in order', (await p.locator('.bl-chapter').count()) === 5 && (await text(p, '.bl-chapter:first-child .bl-h3')) === 'Payung pinjaman' && (await text(p, '.bl-chapter:last-child .bl-h3')) === 'Hari ini');
  for (let i = 0; i < 5; i++) await p.locator('.bl-chapter').nth(i).scrollIntoViewIfNeeded();
  await p.waitForTimeout(1000);
  check('timeline: every chapter revealed after scrolling (opacity 1)', (await p.$$eval('.bl-chapter', (e) => e.map((x) => getComputedStyle(x).opacity))).every((o) => o === '1'));
  await goTo(p, '#bl-timeline'); await shot(p, 'desktop-id-timeline');

  await goTo(p, '#bl-gallery');
  check('gallery: 6 plates as SVG, zero <img> elements (no broken images possible)', (await p.locator('.bl-plate svg').count()) === 6 && (await p.locator('img').count()) === 0);
  await shot(p, 'desktop-id-gallery');
  const opener = p.locator('.bl-plate').nth(2);
  await opener.click();
  const dlg = p.getByRole('dialog', { name: 'Tampilan galeri' });
  check('lightbox opens as modal dialog on the clicked plate', await dlg.isVisible() && (await dlg.getAttribute('aria-modal')) === 'true' && (await text(p, '.bl-lb-count')) === '3 dari 6' && (await text(p, '.bl-lb-caption')).includes('Hujan lagi'));
  check('lightbox: focus moves to close button', await p.evaluate(() => document.activeElement?.getAttribute('aria-label')) === 'Tutup galeri');
  check('lightbox locks page scroll', (await p.evaluate(() => document.documentElement.style.overflow)) === 'hidden');
  await shot(p, 'desktop-id-lightbox');
  await p.keyboard.press('ArrowRight'); check('lightbox: ArrowRight -> 4 dari 6', (await text(p, '.bl-lb-count')) === '4 dari 6');
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft'); check('lightbox: ArrowLeft x2 -> 2 dari 6', (await text(p, '.bl-lb-count')) === '2 dari 6');
  await p.getByRole('button', { name: 'Gambar berikutnya' }).click(); check('lightbox: next button', (await text(p, '.bl-lb-count')) === '3 dari 6');
  await p.getByRole('button', { name: 'Gambar sebelumnya' }).click(); await p.getByRole('button', { name: 'Gambar sebelumnya' }).click(); await p.getByRole('button', { name: 'Gambar sebelumnya' }).click();
  check('lightbox: wraps from first to last', (await text(p, '.bl-lb-count')) === '6 dari 6');
  const fig = await p.locator('.bl-lb-fig').boundingBox();
  await p.mouse.move(fig.x + fig.width * 0.8, fig.y + 80); await p.mouse.down(); await p.mouse.move(fig.x + fig.width * 0.2, fig.y + 84, { steps: 6 }); await p.mouse.up();
  check('lightbox: horizontal swipe advances', (await text(p, '.bl-lb-count')) === '1 dari 6');
  const trapped = [];
  for (let i = 0; i < 6; i++) { await p.keyboard.press('Tab'); trapped.push(await p.evaluate(() => !!document.activeElement?.closest('.bl-lightbox'))); }
  check('lightbox: Tab focus stays trapped inside', trapped.every(Boolean));
  await p.keyboard.press('Escape'); await p.waitForTimeout(150); // focus is restored on the next frame
  check('lightbox: Escape closes, scroll unlocked, focus returns to the plate', !(await dlg.isVisible().catch(() => false)) && (await p.evaluate(() => document.documentElement.style.overflow)) !== 'hidden' && await p.evaluate(() => document.activeElement?.classList.contains('bl-plate')));
  await p.locator('.bl-plate').nth(0).click(); await p.mouse.click(8, 400);
  check('lightbox: clicking the backdrop closes', !(await p.locator('.bl-lightbox').count()));

  await goTo(p, '#bl-message');
  const cards = p.locator('.bl-card');
  check('reasons: 6 cards, all closed, status 0 dari 6', (await cards.count()) === 6 && (await p.$$eval('.bl-card', (e) => e.every((x) => x.getAttribute('aria-expanded') === 'false'))) && (await text(p, '.bl-deck-status')) === '0 dari 6 terbuka');
  check('reasons: "close all" disabled when nothing is open', await p.getByRole('button', { name: 'Tutup semua' }).isDisabled());
  await cards.nth(1).click();
  check('reasons: clicking a card opens it', (await cards.nth(1).getAttribute('aria-expanded')) === 'true' && (await cards.nth(1).getAttribute('aria-label')).startsWith('Tutup alasan 2') && (await text(p, '.bl-deck-status')) === '1 dari 6 terbuka');
  await p.waitForTimeout(800); await shot(p, 'desktop-id-reasons');
  await p.getByRole('button', { name: 'Buka berikutnya' }).click();
  check('reasons: "open next" opens the first closed card', (await cards.nth(0).getAttribute('aria-expanded')) === 'true' && (await text(p, '.bl-deck-status')) === '2 dari 6 terbuka');
  await cards.nth(1).click();
  check('reasons: an open card can be closed again', (await cards.nth(1).getAttribute('aria-expanded')) === 'false' && (await text(p, '.bl-deck-status')) === '1 dari 6 terbuka');
  for (let i = 0; i < 5; i++) await p.getByRole('button', { name: 'Buka berikutnya' }).click();
  check('reasons: all open -> "open next" disabled', await p.getByRole('button', { name: 'Buka berikutnya' }).isDisabled() && (await text(p, '.bl-deck-status')) === '6 dari 6 terbuka');
  await p.waitForTimeout(900);
  const fits = await p.$$eval('.bl-card', (cs) => cs.map((c) => { const f = c.querySelector('.bl-face-open').getBoundingClientRect(); const t = c.querySelector('.bl-card-text').getBoundingClientRect(); return t.top >= f.top - 1 && t.bottom <= f.bottom + 1 && t.left >= f.left - 1 && t.right <= f.right + 1; }));
  check('reasons: every reason text fits inside its card', fits.every(Boolean), fits);
  await p.getByRole('button', { name: 'Tutup semua' }).click();
  check('reasons: "close all" resets the deck', (await text(p, '.bl-deck-status')) === '0 dari 6 terbuka');

  await goTo(p, '#bl-appreciation'); check('appreciation note renders', (await text(p, '.bl-quiet')).includes('kesabaranmu')); await shot(p, 'desktop-id-appreciation');

  await goTo(p, '#bl-hero', 300);
  const menuBtn = p.getByRole('button', { name: 'Isi cerita' });
  await menuBtn.click();
  check('menu: opens with 7 chapters, expanded state exposed', (await menuBtn.getAttribute('aria-expanded')) === 'true' && (await p.locator('.bl-menu li').count()) === 7);
  check('menu: current chapter marked', (await p.locator('.bl-menu [aria-current="true"]').innerText()).includes('Sampul'));
  await p.keyboard.press('Escape');
  check('menu: Escape closes and returns focus to its button', !(await p.locator('.bl-menu').count()) && await p.evaluate(() => document.activeElement?.textContent?.includes('Isi cerita')));
  await menuBtn.click(); await p.locator('.bl-menu button', { hasText: 'Galeri' }).click(); await p.waitForTimeout(1500);
  const gTop = await p.locator('#bl-gallery').evaluate((e) => e.getBoundingClientRect().top);
  check('menu: choosing a chapter scrolls to it and closes the menu', gTop < 140 && gTop > -40 && !(await p.locator('.bl-menu').count()), gTop);
  const prog = Number(await p.locator('.bl-progress').getAttribute('aria-valuenow'));
  check('progress bar reflects scroll position', prog > 10 && prog < 90, prog);
  await menuBtn.click(); await p.evaluate(() => document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
  check('menu: clicking outside closes it', !(await p.locator('.bl-menu').count()));

  await goTo(p, '#bl-closing');
  check('closing: line, signature and the demo call to action in the footer slot', (await text(p, '.bl-closing-line')).includes('bab berikutnya') && (await text(p, '.bl-signature')) === 'Arga' && await p.locator('.bl-demo-footer a').isVisible());
  check('nav action slot (Gunakan Template) stays visible', await p.locator('.bl-nav-link').isVisible());
  await p.getByRole('button', { name: 'Baca dari awal' }).click(); await p.waitForTimeout(1800);
  check('closing: "Baca dari awal" scrolls back to the top', (await p.evaluate(() => scrollY)) < 5);

  const all = await p.evaluate(() => document.body.textContent);
  check('no emoji or emoji-like glyphs anywhere in rendered text', !EMOJI.test(all), all.match(EMOJI));
  check('no horizontal overflow', (await overflowX(p)) <= 0);
  check('no network requests failed (no external assets)', failedRequests.length === 0, failedRequests);
  check('no console errors or warnings', problems.length === 0, problems);
  await ctx.close();
}

group('Desktop: clicking the envelope itself opens it');
{
  const { p, ctx, problems } = await page(DESKTOP, 'locale=id');
  await p.locator('.bl-envelope').click(); await p.waitForSelector('.bl-opening', { state: 'detached', timeout: 5000 });
  check('envelope click opens the letter', await p.locator('.bl-story').isVisible());
  check('no console errors', problems.length === 0, problems); await ctx.close();
}

group('Desktop: keyboard only');
{
  const { p, ctx } = await page(DESKTOP, 'locale=id');
  await p.keyboard.press('Tab');
  check('first Tab lands on the open button', (await p.evaluate(() => document.activeElement?.textContent)) === 'Buka surat');
  await p.keyboard.press('Enter'); await p.waitForSelector('.bl-opening', { state: 'detached', timeout: 5000 });
  check('Enter opens the letter', await p.locator('.bl-story').isVisible());
  let reached = false;
  for (let i = 0; i < 8 && !reached; i++) { await p.keyboard.press('Tab'); reached = await p.evaluate(() => document.activeElement?.getAttribute('aria-controls') === 'bl-menu'); }
  check('Tab order reaches the chapter menu button within a few stops', reached);
  await p.keyboard.press('Enter');
  check('Tab to chapter menu and Enter opens it, first item focused', await p.locator('.bl-menu').isVisible() && await p.evaluate(() => !!document.activeElement?.closest('.bl-menu')));
  await p.keyboard.press('Tab'); await p.keyboard.press('Enter'); await p.waitForTimeout(1500);
  check('keyboard can jump to a chapter', (await p.evaluate(() => scrollY)) > 200);
  await p.locator('#bl-gallery').scrollIntoViewIfNeeded();
  await p.locator('.bl-plate').first().focus(); await p.keyboard.press('Enter');
  check('keyboard can open the lightbox', await p.locator('.bl-lightbox').isVisible());
  await p.keyboard.press('Escape'); await p.waitForTimeout(150); // focus is restored to the plate on the next frame
  await p.locator('.bl-card').first().focus(); await p.keyboard.press('Space');
  check('Space toggles a reason card', (await p.locator('.bl-card').first().getAttribute('aria-expanded')) === 'true');
  await ctx.close();
}

/* ============ B. Mobile ============ */
group('Mobile 390x844 / id');
{
  const { p, ctx, problems } = await page(MOBILE, 'locale=id');
  await shot(p, 'mobile-id-sealed');
  check('sealed screen fits the viewport without scrolling', (await p.evaluate(() => document.documentElement.scrollHeight - innerHeight)) <= 1);
  await p.getByRole('button', { name: 'Buka surat' }).tap(); await p.waitForSelector('.bl-opening', { state: 'detached', timeout: 5000 });
  check('tap opens the letter', await p.locator('.bl-story').isVisible());
  await shot(p, 'mobile-id-hero');
  check('mobile: every top-bar control is fully inside the viewport', await p.$$eval('.bl-nav-row button, .bl-nav-row a', (els) => els.every((e) => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.width > 0; })));
  check('mobile: language toggle visible and exposes pressed state', await p.getByRole('button', { name: 'ID' }).isVisible() && (await p.getByRole('button', { name: 'ID' }).getAttribute('aria-pressed')) === 'true' && (await p.getByRole('button', { name: 'EN', exact: true }).getAttribute('aria-pressed')) === 'false');
  check('mobile: icon-only menu button keeps an accessible name', (await p.locator('.bl-nav-btn[aria-controls="bl-menu"]').getAttribute('aria-label')) === 'Isi cerita');
  check('hero title fits width', await inViewport(p, '.bl-hero-title') || (await p.locator('.bl-hero-title').evaluate((e) => e.getBoundingClientRect().right <= innerWidth)));
  await goTo(p, '#bl-timeline'); await p.waitForTimeout(600); await shot(p, 'mobile-id-timeline');
  await goTo(p, '#bl-gallery'); await p.waitForTimeout(600); await shot(p, 'mobile-id-gallery');
  const tops = await p.$$eval('.bl-plate-li', (e) => e.slice(0, 3).map((x) => Math.round(x.getBoundingClientRect().top)));
  check('gallery uses 2 columns on mobile', tops[0] === tops[1] && tops[2] > tops[0], tops);
  await p.locator('.bl-plate').nth(1).tap();
  check('lightbox opens by tap and fits the viewport', await p.locator('.bl-lightbox').isVisible() && await inViewport(p, '.bl-lb-plate') && await inViewport(p, '.bl-lb-bar') && await inViewport(p, '.bl-lb-close'));
  await shot(p, 'mobile-id-lightbox');
  await p.getByRole('button', { name: 'Gambar berikutnya' }).tap(); check('lightbox next by tap', (await text(p, '.bl-lb-count')) === '3 dari 6');
  await p.getByRole('button', { name: 'Tutup galeri' }).tap(); check('lightbox closes by tap', !(await p.locator('.bl-lightbox').count()));
  await goTo(p, '#bl-message'); await p.waitForTimeout(500);
  for (let i = 0; i < 6; i++) await p.getByRole('button', { name: 'Buka berikutnya' }).tap();
  await p.waitForTimeout(1000); await shot(p, 'mobile-id-reasons');
  const fits = await p.$$eval('.bl-card', (cs) => cs.map((c) => { const f = c.querySelector('.bl-face-open').getBoundingClientRect(); const t = c.querySelector('.bl-card-text').getBoundingClientRect(); return t.top >= f.top - 1 && t.bottom <= f.bottom + 1; }));
  check('mobile: every reason text fits its card (6 of 6 open)', fits.every(Boolean), fits);
  await p.locator('.bl-nav-btn[aria-controls="bl-menu"]').tap();
  check('mobile: chapter menu fits the viewport', await inViewport(p, '.bl-menu'));
  await shot(p, 'mobile-id-menu');
  await p.locator('.bl-menu button', { hasText: 'Penutup' }).tap(); await p.waitForTimeout(1500);
  await shot(p, 'mobile-id-closing');
  check('mobile: no horizontal overflow', (await overflowX(p)) <= 0);
  check('mobile: no console errors', problems.length === 0, problems);
  await ctx.close();
}

/* ============ C. English ============ */
group('Desktop / en');
{
  const { p, ctx, problems } = await page(DESKTOP, 'locale=en');
  check('English opening labels', (await text(p, '.bl-open-from')) === 'From Arga' && await p.getByRole('button', { name: 'Open the letter' }).isVisible() && (await text(p, '.bl-eyebrow')) === 'FOR');
  await open(p, 'Open the letter');
  check('English cover content', (await text(p, 'h1')) === 'Three Years, One Story' && (await text(p, '.bl-nav-title')) === 'Chapter of Us');
  await goTo(p, '#bl-letter'); check('English chapter label and letter', (await text(p, '.bl-eyebrow >> nth=1')).toLowerCase().includes('chapter i') && (await text(p, '.bl-letter-greeting')) === 'Dear Maya,');
  await goTo(p, '#bl-gallery'); await p.locator('.bl-plate').first().click();
  check('English lightbox labels', (await text(p, '.bl-lb-count')) === '1 of 6' && await p.getByRole('button', { name: 'Close gallery' }).isVisible()); await shot(p, 'desktop-en-lightbox'); await p.keyboard.press('Escape');
  await goTo(p, '#bl-message'); check('English deck status', (await text(p, '.bl-deck-status')) === '0 of 6 open');
  check('English: no console errors', problems.length === 0, problems); await ctx.close();
}

/* ============ D. Reduced motion ============ */
group('Reduced motion (prefers-reduced-motion: reduce)');
{
  const { p, ctx, problems } = await page({ ...DESKTOP, reducedMotion: 'reduce' }, 'locale=id');
  await p.waitForTimeout(100);
  check('root switches to data-motion="none"', (await p.locator('.bl-root').getAttribute('data-motion')) === 'none');
  await p.getByRole('button', { name: 'Buka surat' }).click(); await p.waitForTimeout(80);
  check('opening is instant: no animation phase, story shown immediately', !(await p.locator('.bl-opening').count()) && await p.locator('.bl-story').isVisible());
  const motionLeft = await p.$$eval('.bl-root *', (els) => els.filter((e) => { const s = getComputedStyle(e); return parseFloat(s.transitionDuration) > 0 || (s.animationName !== 'none' && parseFloat(s.animationDuration) > 0); }).length);
  check('no CSS transitions or animations remain active', motionLeft === 0, motionLeft);
  await goTo(p, '#bl-timeline', 100);
  check('content is visible without scroll-triggered reveals', (await p.$$eval('.bl-reveal', (e) => e.every((x) => getComputedStyle(x).opacity === '1'))));
  await goTo(p, '#bl-message', 100);
  await p.locator('.bl-card').nth(2).click();
  const faces = await p.locator('.bl-card').nth(2).evaluate((c) => ({ open: getComputedStyle(c.querySelector('.bl-face-open')).display, closed: getComputedStyle(c.querySelector('.bl-face-closed')).display, tf: getComputedStyle(c.querySelector('.bl-card-inner')).transform }));
  check('cards still open without any flip animation (face swap)', faces.open === 'flex' && faces.closed === 'none' && (faces.tf === 'none' || faces.tf.startsWith('matrix(1, 0, 0, 1')), faces);
  await goTo(p, '#bl-gallery', 100); await p.locator('.bl-plate').first().click();
  check('lightbox still works', await p.locator('.bl-lightbox').isVisible()); await p.keyboard.press('Escape');
  check('reduced motion: no console errors', problems.length === 0, problems); await ctx.close();
}

/* ============ E. Content conditions ============ */
group('Empty content');
{
  const { p, ctx, problems } = await page(DESKTOP, 'locale=id&scenario=blank&mode=public');
  check('empty gift shows a clear message, not a blank page', (await text(p, '.bl-empty')).includes('belum memiliki isi'));
  check('empty gift: no opening, no sections', !(await p.locator('.bl-opening').count()) && !(await p.locator('[data-bl-section]').count()));
  check('empty: no console errors', problems.length === 0, problems); await ctx.close();
}
group('Partial content, public mode (no sample text may leak in)');
{
  const { p, ctx, problems } = await page(DESKTOP, 'locale=id&scenario=partial&mode=public');
  check('opening reflects the real names', (await text(p, '.bl-open-recipient')) === 'Lina');
  check('occasion line absent (nothing written, nothing invented)', !(await p.locator('.bl-open-occasion').count()));
  await open(p);
  const sections = await p.$$eval('[data-bl-section]', (els) => els.map((e) => e.dataset.blSection));
  check('only sections that have content are rendered', JSON.stringify(sections) === JSON.stringify(['hero', 'letter', 'closing']), sections);
  const all = await p.evaluate(() => document.body.textContent);
  check('no sample text from the template leaks into a real gift', !/Maya|Arga|Tiga Tahun|Payung pinjaman|Jembatan/.test(all), all.slice(0, 200));
  check('menu lists exactly the 3 rendered chapters', (await (async () => { await p.getByRole('button', { name: 'Isi cerita' }).click(); return p.locator('.bl-menu li').count(); })()) === 3);
  await shot(p, 'desktop-id-partial');
  check('partial: no console errors', problems.length === 0, problems); await ctx.close();
}
group('Preview mode (embedded in the editor)');
{
  const { p, ctx, problems } = await page({ viewport: { width: 1280, height: 800 } }, 'locale=id&scenario=blank&mode=preview');
  check('no sealed opening in preview; content visible immediately', !(await p.locator('.bl-opening').count()) && await p.locator('.bl-story').isVisible());
  check('empty fields are filled with sample text so the editor shows a complete preview', (await text(p, 'h1')) === 'Tiga Tahun, Satu Cerita');
  const scroll = await p.locator('.bl-root').evaluate((e) => ({ own: e.scrollHeight > e.clientHeight, win: document.documentElement.scrollHeight <= innerHeight + 2 }));
  check('preview scrolls inside its own container, not the page', scroll.own && scroll.win, scroll);
  await p.locator('.bl-nav-btn[aria-controls="bl-menu"]').click(); await p.locator('.bl-menu button', { hasText: 'Galeri' }).click(); await p.waitForTimeout(1500);
  check('preview: chapter menu scrolls the embedded container', (await p.locator('.bl-root').evaluate((e) => e.scrollTop)) > 300);
  await p.locator('.bl-plate').first().click();
  check('preview: lightbox locks the embedded scroller', (await p.locator('.bl-root').evaluate((e) => e.style.overflow)) === 'hidden');
  await p.keyboard.press('Escape');
  check('preview: scroll lock released', (await p.locator('.bl-root').evaluate((e) => e.style.overflow)) !== 'hidden');
  await shot(p, 'desktop-id-preview');
  check('preview: no console errors', problems.length === 0, problems); await ctx.close();
}
group('Hostile content (HTML/script typed into a gift)');
{
  const { p, ctx, problems } = await page(DESKTOP, 'locale=id&scenario=xss&mode=public');
  await open(p);
  await goTo(p, '#bl-gallery', 300); await p.locator('.bl-plate').first().click(); await p.keyboard.press('Escape');
  await goTo(p, '#bl-message', 300); await p.locator('.bl-card').first().click();
  check('markup in content is shown as text: no injected img/script elements, no script ran', (await p.evaluate(() => ({ x: window.__xss, imgs: document.querySelectorAll('img').length, scripts: [...document.scripts].filter((s) => !s.src).length }))).x === undefined && (await p.locator('img').count()) === 0);
  check('the markup is visible as literal text', (await p.evaluate(() => document.body.textContent)).includes('<img src=x'));
  check('hostile content: no console errors', problems.length === 0, problems); await ctx.close();
}
group('Audio available');
{
  const { p, ctx, problems } = await page(DESKTOP, 'locale=id&scenario=audio');
  await open(p);
  const sections = await p.$$eval('[data-bl-section]', (els) => els.map((e) => e.dataset.blSection));
  check('music section appears before the closing', sections.at(-2) === 'music' && sections.at(-1) === 'closing', sections);
  await goTo(p, '#bl-music');
  check('player shows title, artist and a play control', (await text(p, '.bl-player-title')) === 'Quiet Hours' && (await text(p, '.bl-player-artist')) === 'Test Tone' && await p.getByRole('button', { name: 'Putar musik' }).isVisible());
  check('audio never autoplays', await p.locator('audio').evaluate((a) => a.paused && a.currentTime === 0 && !a.autoplay));
  await p.getByRole('button', { name: 'Putar musik' }).click(); await p.waitForTimeout(300);
  check('play button starts playback and reflects it', (await p.locator('.bl-player-btn').getAttribute('aria-pressed')) === 'true' && await p.locator('audio').evaluate((a) => !a.paused || a.ended));
  await shot(p, 'desktop-id-music');
  await p.waitForTimeout(700);
  check('player returns to idle when the track ends', (await p.locator('.bl-player-btn').getAttribute('aria-pressed')) === 'false');
  check('audio: no console errors', problems.length === 0, problems); await ctx.close();
}
group('Audio recorded but URL unavailable');
{
  const { p, ctx, problems } = await page(DESKTOP, 'locale=id&scenario=audio-nourl');
  await open(p);
  check('music section and player are hidden (never a dead control)', !(await p.locator('.bl-player, audio').count()) && !(await p.$$eval('[data-bl-section]', (e) => e.some((x) => x.dataset.blSection === 'music'))));
  check('no console errors', problems.length === 0, problems); await ctx.close();
}

group('Server render + hydration (what Next does)');
{
  const fs = await import('node:fs');
  for (const locale of ['id', 'en']) {
    const html = fs.readFileSync(path.join(here, `dist/ssr-${locale}.html`), 'utf8');
    check(`${locale}: server HTML contains the sealed opening, hidden story and no browser-only crash`, html.includes('bl-opening') && /class="bl-story"[^>]*hidden/.test(html) && html.includes(locale === 'id' ? 'Buka surat' : 'Open the letter'));
    check(`${locale}: server HTML has no emoji and no script injection from content`, !EMOJI.test(html) && !/<script(?![^>]*src=)/i.test(html.replace(/<script src="hydrate.js"><\/script>/, '')));
  }
  const ctx = await browser.newContext(DESKTOP); const p = await ctx.newPage(); const problems = [];
  p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) problems.push(`${m.type()}: ${m.text()}`); });
  p.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  await p.goto(pathToFileURL(path.join(here, 'dist/ssr-id.html')).href + '?locale=id');
  await p.waitForSelector('.bl-opening');
  await p.waitForTimeout(400);
  check('hydration completes with no mismatch errors', problems.length === 0, problems);
  await p.getByRole('button', { name: 'Buka surat' }).click(); await p.waitForSelector('.bl-opening', { state: 'detached', timeout: 5000 });
  check('hydrated page is interactive (opening works)', await p.locator('.bl-story').isVisible());
  await p.locator('.bl-plate').nth(0).scrollIntoViewIfNeeded(); await p.locator('.bl-plate').nth(0).click();
  check('hydrated page: lightbox works', await p.locator('.bl-lightbox').isVisible());
  check('hydrated page: still no console errors after interaction', problems.length === 0, problems);
  await ctx.close();
}

await browser.close();
const groups = [...new Set(results.map((r) => r.group))];
let failed = 0;
for (const g of groups) {
  console.log(`\n${g}`);
  for (const r of results.filter((x) => x.group === g)) { console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : `  -> ${r.detail}`}`); if (!r.ok) failed++; }
}
console.log(`\n${results.length - failed}/${results.length} browser checks passed`);
process.exit(failed ? 1 : 0);
