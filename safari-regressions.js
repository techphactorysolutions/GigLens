#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createHarness, callFirst, flushTasks, appCode, stored } = require('./smoke-startup');
const KEY = 'giglens.state.v2';
const STORE = 'giglens.deliveries.v1';
const quiet = { ...console, error() {}, warn() {} };
function start(seed = {}, options = {}) {
  const h = createHarness(seed, { console: quiet, ...options });
  const exposed = appCode.replace('  init();', '  globalThis.testing = { shareOrDownload, screenshotDimensions, buildCSV, refreshStoredState, editDelivery };\n  init();');
  vm.runInNewContext(exposed, h.context, { filename: 'app.js' });
  return h;
}
function fill(h, amount = '12.50') {
  for (const [id, value] of Object.entries({ companyInput: 'DoorDash', earningsInput: amount, milesInput: '3.2', minutesInput: '18' })) h.elements.get(id).value = value;
}
async function save(h) { await callFirst(h.elements.get('deliveryForm'), 'submit', { preventDefault() {} }); }
const rows = h => JSON.parse(stored(h, STORE) || '[]');
async function storageCases() {
  const h = start();
  fill(h); await save(h);
  const before = h.storage.get(KEY);
  fill(h, '25.50');
  h.context.localStorage.setItem = () => { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; };
  await save(h);
  assert.equal(h.storage.get(KEY), before, 'quota failure must preserve the entire saved envelope');
  assert.equal(h.elements.get('earningsInput').value, '25.50', 'quota failure must preserve the draft');
  assert.match(h.elements.get('storageBanner').textContent, /Not saved: storage is full/);
  // One failed write cannot save the decision without its completed delivery.
  for (const [id, value] of Object.entries({ offerPayInput: '20', offerMilesInput: '5', offerMinutesInput: '20', offerCompanyInput: 'DoorDash' })) h.elements.get(id).value = value;
  await callFirst(h.elements.get('saveOfferAsDeliveryBtn'), 'click');
  assert.equal(h.storage.get(KEY), before);
  for (const broken of ['{bad-json', '{"not":"an array"}', '[{"id":"bad"}]']) {
    const damaged = start({ [STORE]: broken });
    assert.equal(damaged.storage.get(STORE), broken);
    assert.equal(damaged.storage.has(KEY), false, 'startup must never overwrite damaged data');
    fill(damaged); await save(damaged);
    assert.equal(damaged.storage.has(KEY), false);
    await callFirst(damaged.elements.get('backupBtn'), 'click');
    const recovery = await damaged.downloads.at(-1).text();
    assert.equal(JSON.parse(recovery).raw[STORE], broken);
  }
  const blocked = createHarness({}, { console: quiet });
  blocked.context.localStorage.getItem = () => { throw new Error('Storage denied'); };
  vm.runInNewContext(appCode, blocked.context);
  assert.match(blocked.elements.get('storageBanner').textContent, /could not be read/);
  const readonly = start({}, { navigator: { locks: null } }); fill(readonly); await save(readonly);
  assert.equal(readonly.storage.has(KEY), false);
  assert.match(readonly.elements.get('storageBanner').textContent, /Viewing only/);
  // Realistic asynchronous exclusive lock shared by two stale browser windows.
  const storage = new Map(); let tail = Promise.resolve();
  const locks = { request(_name, _options, action) { const task = tail.then(action); tail = task.catch(() => {}); return task; } };
  const a = start({}, { storage, navigator: { locks } });
  const b = start({}, { storage, navigator: { locks } });
  fill(a, '11'); fill(b, '22'); await Promise.all([save(a), save(b)]);
  assert.equal(rows(a).length, 2, 'two concurrent adds must survive');
  assert.equal(JSON.parse(storage.get(KEY)).revision, 2);
  a.context.testing.refreshStoredState();
  const id = rows(a)[0].id;
  a.context.testing.editDelivery(id); b.context.testing.editDelivery(id);
  a.elements.get('earningsInput').value = '33'; await save(a);
  b.elements.get('earningsInput').value = '44'; await save(b);
  assert.equal(rows(a).find(x => x.id === id).earnings, 33, 'stale editor must not overwrite another edit');
  assert.equal(b.elements.get('earningsInput').value, '44');
  // Failed destructive snapshot must leave original data and backup unchanged.
  const destructive = start({ [KEY]: before }, { prompt: () => 'RESET' });
  destructive.context.localStorage.setItem = h.context.localStorage.setItem;
  await callFirst(destructive.elements.get('resetDeliveriesBtn'), 'click');
  assert.equal(destructive.storage.get(KEY), before);
  console.log('PASS atomic storage, quota, corruption, blocked storage, multi-tab saves, stale edits, recovery snapshots');
}
async function exportCases() {
  const canceled = start({}, { navigator: { canShare: () => true, share: async () => { const e = new Error('canceled'); e.name = 'AbortError'; throw e; } } });
  assert.equal(await canceled.context.testing.shareOrDownload('csv', 'test.csv', 'text/csv'), 'canceled');
  assert.equal(canceled.downloads.length, 0);
  const failed = start({}, { navigator: { canShare: () => true, share: async () => { throw new Error('unavailable'); } } });
  let clicks = 0; failed.elements.get('exportDownloadLink').click = () => clicks++;
  assert.equal(await failed.context.testing.shareOrDownload('csv', 'test.csv', 'text/csv'), 'failed');
  assert.equal(clicks, 0, 'failed asynchronous share needs a fresh user gesture');
  assert.equal(failed.elements.get('exportDownloadPanel').classList.contains('hidden'), false);
  const h = start(); fill(h); h.elements.get('merchantInput').value = '=CMD()'; await save(h);
  await callFirst(h.elements.get('exportBtn'), 'click');
  const bytes = new Uint8Array(await h.downloads.at(-1).arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 3)], [239, 187, 191]);
  const csv = await h.downloads.at(-1).text();
  assert.match(csv, /"local_date","created_at","captured_at"/);
  assert.match(csv, /'=CMD\(\)/);
  console.log('PASS share cancellation, explicit download fallback, CSV BOM, timestamp columns, formula escaping');
}
async function scannerCases() {
  const pending = []; let live = 0, peak = 0, terminated = 0;
  const h = start({}, { Tesseract: { createWorker: async () => {
    live++; peak = Math.max(peak, live);
    return { recognize: () => new Promise(resolve => pending.push(resolve)), terminate: async () => { live--; terminated++; } };
  } } });
  callFirst(h.elements.get('quickAddOpenBtn'), 'click');
  h.elements.get('quickEarningsInput').value = '99.00';
  const input = h.elements.get('quickScreenshotInput');
  const event = { target: { value: 'same.png', files: [{ name: 'same.png', type: 'image/png', size: 100 }] } };
  const first = callFirst(input, 'change', event);
  await flushTasks();
  assert.equal(event.target.value, '', 'same file must be selectable again');
  assert.equal(h.elements.get('quickEarningsInput').value, '', 'new scan must clear old pay');
  assert.equal(h.elements.get('quickSaveBtn').disabled, true);
  h.elements.get('quickEarningsInput').value = '88'; h.elements.get('quickMilesInput').value = '2';
  await callFirst(h.elements.get('quickAddForm'), 'submit', { preventDefault() {} });
  assert.equal(rows(h).length, 0, 'pending scan cannot save');
  const second = callFirst(input, 'change', event); await flushTasks();
  assert.equal(peak, 1, 'only one OCR worker may exist at once');
  assert.equal(terminated, 1, 'new scan must terminate the previous worker');
  pending[1]({ data: { text: 'Uber Eats\nPickup Starbucks\n$18.00\n4.0 miles\n20 min' } }); await second;
  pending[0]({ data: { text: 'DoorDash\n$99.00\n2.0 miles' } }); await first;
  assert.equal(h.elements.get('quickEarningsInput').value, '18.00');
  assert.equal(h.elements.get('quickSaveBtn').disabled, false);
  const third = callFirst(input, 'change', event); await flushTasks();
  callFirst(h.elements.get('quickContinueManualBtn'), 'click'); await third;
  assert.equal(live, 0); assert.equal(h.elements.get('quickSaveBtn').disabled, false);
  const huge = new Uint8Array(24); huge.set([137, 80, 78, 71]); const view = new DataView(huge.buffer); view.setUint32(16, 10000); view.setUint32(20, 10000);
  await callFirst(input, 'change', { target: { files: [{ name: 'huge.png', type: 'image/png', size: 24, arrayBuffer: async () => huge.buffer }] } });
  assert.match(h.elements.get('quickScanStatus').textContent, /too large to decode safely/);
  assert.equal(live, 0);
  console.log('PASS stale scan protection, serialized workers, same-file retry, pending-save guard, manual cancel, pixel limit');
}
async function serviceWorkerCases() {
  const listeners = {}; const scope = 'https://example.test/GigLens/'; let skip = 0, network = 0;
  let clients = [{ id: 'one', url: scope }]; let cached = new Response('release 4.6');
  const cache = { addAll: async requests => { for (const r of requests) assert.ok(fs.existsSync(new URL(r.url).pathname.replace('/GigLens/', '') || '.')); }, match: async () => cached };
  const context = { console: quiet, Request, Response, URL, AbortController, setTimeout, clearTimeout,
    caches: { open: async () => cache, keys: async () => ['unrelated-cache'], delete: async () => { throw new Error('unrelated cache deleted'); } },
    fetch: async () => { network++; return new Response('online'); },
    self: { registration: { scope }, location: { origin: 'https://example.test' }, clients: { matchAll: async () => clients, claim: async () => {} }, skipWaiting: async () => skip++, addEventListener: (name, fn) => { listeners[name] = fn; } } };
  vm.runInNewContext(fs.readFileSync('service-worker.js', 'utf8'), context);
  let work; listeners.install({ waitUntil: task => { work = task; } }); await work; assert.equal(skip, 0);
  listeners.activate({ waitUntil: task => { work = task; } }); await work;
  const response = await vm.runInNewContext('releaseAsset(new Request("https://example.test/GigLens/app.js"), false)', context);
  assert.equal(await response.text(), 'release 4.6'); assert.equal(network, 0, 'cached release must not mix new network assets');
  cached = null;
  const online = await vm.runInNewContext('releaseAsset(new Request("https://example.test/GigLens/"), true)', context);
  assert.equal(await online.text(), 'online');
  context.caches.open = async () => { throw new Error('Cache storage unavailable'); };
  const uncached = await vm.runInNewContext('releaseAsset(new Request("https://example.test/GigLens/app.js"), false)', context);
  assert.equal(await uncached.text(), 'online', 'cache failure must not discard successful network responses');
  context.fetch = async () => { throw new Error('Offline'); };
  const unavailable = await vm.runInNewContext('releaseAsset(new Request("https://example.test/GigLens/"), true)', context);
  assert.equal(unavailable.type, 'error');
  const notices = []; clients.push({ id: 'two', url: scope });
  const event = { data: { type: 'APPLY_UPDATE' }, source: { id: 'one', postMessage: x => notices.push(x) }, waitUntil: task => { work = task; } };
  listeners.message(event); await work; assert.equal(skip, 0); assert.equal(notices[0].type, 'UPDATE_BLOCKED');
  clients.pop(); listeners.message(event); await work; assert.equal(skip, 1);
  console.log('PASS precache paths, release coherence, network success without cache storage, safe multi-window update');
}
(async () => { await storageCases(); await exportCases(); await scannerCases(); await serviceWorkerCases(); })().catch(error => { console.error(error); process.exitCode = 1; });
