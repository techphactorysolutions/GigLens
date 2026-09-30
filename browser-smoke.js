#!/usr/bin/env node
// Development-only WebKit QA. npm install; npx playwright install --with-deps webkit
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const certificateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'giglens-browser-'));
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(certificateDir, 'key.pem'), '-out', path.join(certificateDir, 'cert.pem'), '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { stdio: 'ignore' });
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || '', 'playwright')); }
const root = path.resolve(__dirname, '..');
let updated = false;
let networkDown = false;
const server = https.createServer({key: fs.readFileSync(path.join(certificateDir, 'key.pem')), cert: fs.readFileSync(path.join(certificateDir, 'cert.pem'))}, (req, res) => {
  if (networkDown) { res.destroy(); return; }
  let pathname = new URL(req.url, 'http://localhost').pathname.replace(/^\/GigLens\//, '');
  if (!pathname || pathname === '/') pathname = 'index.html';
  const file = path.resolve(root, pathname);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end('missing'); }
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-cache');
  let data = fs.readFileSync(file);
  if (updated && pathname === 'service-worker.js') data = Buffer.from(data.toString().replace('v46-safari-reliability', 'v46-browser-update-test'));
  res.end(data);
});
const text = 'Uber Eats\nExclusive\nPickup Starbucks\n$18.00\n4.0 miles\n20 min';
async function scanStub(context) {
  await context.addInitScript(({ text }) => {
    window.scanWorkers = { live: 0, peak: 0, stopped: 0, pending: [] };
    window.Tesseract = { createWorker: async () => {
      const state = window.scanWorkers; state.live++; state.peak = Math.max(state.peak, state.live);
      let stopped = false;
      return { recognize: () => new Promise(resolve => state.pending.push(() => resolve({ data: { text } }))), terminate: async () => { if (!stopped) { stopped = true; state.live--; state.stopped++; } } };
    } };
    window.cspViolations = [];
    document.addEventListener('securitypolicyviolation', event => window.cspViolations.push(event.violatedDirective));
  }, { text });
}
async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `https://localhost:${server.address().port}/GigLens/`;
  const browser = await playwright.webkit.launch({ headless: true, executablePath: process.env.GIGLENS_WEBKIT_EXECUTABLE });
  try {
    for (const [name, width, height] of (process.env.GIGLENS_PWA_ONLY ? [] : [['iPhone SE', 375, 667], ['iPhone portrait', 393, 852], ['iPhone landscape', 852, 393], ['iPad portrait', 768, 1024], ['iPad landscape', 1024, 768], ['iPad split view', 507, 768]])) {
      const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, timezoneId: 'America/Chicago' });
      await scanStub(context);
      const page = await context.newPage(); const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('requestfailed', request => console.log('REQUEST FAILED', request.url(), request.failure()));
      await page.goto(url);
      await page.waitForFunction(() => Boolean(document.getElementById('deliveryDateInput').value));
      for (const tab of ['today', 'calendar', 'history', 'settings', 'analytics', 'add']) {
        await page.locator(`.tab-btn[data-tab="${tab}"]`).evaluate(node => node.click());
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        assert.equal(overflow, false, `${name}: ${tab} must not overflow horizontally`);
      }
      const smallInputs = await page.locator('input:not([type="hidden"]):not([type="file"]),select,textarea').evaluateAll(nodes => nodes.filter(n => n.getClientRects().length && parseFloat(getComputedStyle(n).fontSize) < 16).map(n => n.id));
      assert.deepEqual(smallInputs, [], `${name}: text fields must avoid Safari focus zoom`);
      await page.locator('.tab-btn[data-tab="today"]').tap();
      await page.locator('#quickAddOpenBtn').tap();
      await page.locator('#quickAddSheet').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#quickUploadBtn').evaluate(n => n === document.activeElement), true, JSON.stringify(await page.evaluate(() => ({active: document.activeElement?.outerHTML, errors: window.cspViolations, sheet: document.getElementById('quickAddSheet').className, inert: document.querySelector('main').inert, rect: document.getElementById('quickUploadBtn').getBoundingClientRect().toJSON()}))));
      assert.equal(await page.locator('main').evaluate(n => n.inert), true);
      await page.locator('#quickSaveAnotherBtn').focus();
      await page.keyboard.press('Tab');
      assert.equal(await page.locator('#quickCancelBtn').evaluate(n => n === document.activeElement), true, 'Tab must wrap inside the dialog');
      const panel = await page.locator('.sheet-panel').boundingBox();
      assert.ok(panel.y >= -1 && panel.y + panel.height <= height + 1, `${name}: sheet must fit visual viewport`);
      if (name === 'iPhone portrait') {
        await page.setViewportSize({ width, height: 430 });
        await page.waitForFunction(() => document.getElementById('quickAddSheet').getBoundingClientRect().height <= 431);
      }
      await page.locator('#quickEarningsInput').fill('12.50'); await page.locator('#quickMilesInput').fill('3.2');
      await page.locator('#quickSaveBtn').tap();
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('giglens.state.v2')).values['giglens.deliveries.v1'].length === 1);
      assert.equal(await page.locator('#quickAddSheet').evaluate(n => n.classList.contains('hidden')), true);
      assert.equal(await page.locator('#quickAddOpenBtn').evaluate(n => n === document.activeElement), true);
      if (name === 'iPhone portrait') await page.setViewportSize({ width, height });
      // Decode a real PNG and pass the bounded result into the stubbed OCR worker.
      await page.locator('.tab-btn[data-tab="today"]').tap(); await page.locator('#quickAddOpenBtn').tap();
      await page.locator('#quickScreenshotInput').setInputFiles(path.join(root, 'icons/giglens-icon-192.png'));
      await page.waitForFunction(() => scanWorkers.pending.length === 1);
      assert.equal(await page.locator('#quickSaveBtn').isDisabled(), true);
      await page.locator('#quickEarningsInput').fill('27.75');
      await page.evaluate(() => scanWorkers.pending[0]());
      await page.waitForFunction(() => !document.getElementById('quickSaveBtn').disabled);
      assert.equal(await page.locator('#quickEarningsInput').inputValue(), '27.75', 'OCR must preserve edits made while pending');
      assert.equal(await page.locator('#quickMilesInput').inputValue(), '4.0');
      // Same-file retry and cancellation must release the worker and the preview.
      await page.locator('#quickScreenshotInput').setInputFiles(path.join(root, 'icons/giglens-icon-192.png'));
      await page.waitForFunction(() => scanWorkers.pending.length === 2);
      assert.equal(await page.locator('#quickEarningsInput').inputValue(), '');
      await page.locator('#quickContinueManualBtn').tap();
      await page.waitForFunction(() => scanWorkers.live === 0);
      assert.equal(await page.evaluate(() => scanWorkers.peak), 1);
      assert.equal(await page.locator('#quickPreviewImage').getAttribute('src'), null);
      await page.locator('#quickCancelBtn').tap();
      // CSP keeps the computed charts visible without unsafe style attributes.
      await page.locator('.tab-btn[data-tab="calendar"]').tap();
      await page.waitForFunction(() => document.getElementById('tab-calendar').classList.contains('active'));
      const bars = await page.locator('[data-bar-width]').evaluateAll(nodes => nodes.filter(n => Number(n.dataset.barWidth) > 0).map(n => n.style.width));
      assert.ok(bars.length && bars.every(v => parseFloat(v) > 0));
      assert.deepEqual(await page.evaluate(() => cspViolations), [], `${name}: CSP violations`);
      assert.deepEqual(errors, [], `${name}: JavaScript errors`);
      if (process.env.GIGLENS_SCREENSHOT_DIR) {
        fs.mkdirSync(process.env.GIGLENS_SCREENSHOT_DIR, { recursive: true });
        await page.screenshot({ path: path.join(process.env.GIGLENS_SCREENSHOT_DIR, name.replaceAll(' ', '-') + '.png'), fullPage: false, animations: 'disabled' });
      }
      console.log(`PASS WebKit ${name} (${width}×${height}): layout, touch save, focus, real image preparation, scan edits/cancel, charts/CSP`);
      await context.close();
    }
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage(); await page.goto(url);
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    // WebKit's protocol-wide offline toggle can reject navigation before SW dispatch.
    // Break the HTTPS origin transport instead, then verify a real cached reload.
    networkDown = true;
    await page.reload();
    await page.waitForFunction(() => Boolean(document.getElementById('deliveryDateInput').value));
    await context.setOffline(true);
    await page.waitForFunction(() => !document.getElementById('offlineBanner').classList.contains('hidden'));
    assert.match(await page.locator('#offlineBanner').textContent(), /requires internet/);
    await context.setOffline(false);
    networkDown = false;
    const second = await context.newPage(); await second.goto(url);
    updated = true;
    await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
    await page.locator('#applyUpdateBtn').waitFor({ state: 'visible' });
    await page.locator('#applyUpdateBtn').click();
    await page.waitForFunction(() => document.getElementById('toast').textContent.includes('Close other GigLens'));
    assert.ok(await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).waiting));
    await second.close();
    await page.locator('.tab-btn[data-tab="add"]').click();
    await page.locator('#earningsInput').fill('19.50');
    page.once('dialog', dialog => dialog.dismiss());
    await page.locator('#applyUpdateBtn').click();
    assert.equal(await page.locator('#earningsInput').inputValue(), '19.50', 'declining an update keeps the draft');
    assert.ok(await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).waiting));
    page.once('dialog', dialog => dialog.accept());
    const reload = page.waitForEvent('load'); await page.locator('#applyUpdateBtn').click(); await reload;
    assert.ok(await page.locator('#todayEarned').textContent());
    console.log('PASS WebKit installed offline reload, waiting update, multi-window protection, approved update reload');
    await context.close();
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { server.close(); fs.rmSync(certificateDir, { recursive: true, force: true }); });
