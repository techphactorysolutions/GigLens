#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appCode = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const idMatches = [...html.matchAll(/\sid=["']([^"']+)["']/g)].map((m) => m[1]);
const tabNames = [...html.matchAll(/data-tab=["']([^"']+)["']/g)].map((m) => m[1]);
const openAddModes = [...html.matchAll(/data-open-add=["']([^"']+)["']/g)].map((m) => m[1]);
const tabJumpNames = [...html.matchAll(/data-tab-jump=["']([^"']+)["']/g)].map((m) => m[1]);
const quickAddOpenIds = [...html.matchAll(/id=["']([^"']+)["'][^>]*data-quick-add-open/g)].map((m) => m[1]);
const quickAddCancelIds = [...html.matchAll(/id=["']([^"']+)["'][^>]*data-quick-add-cancel/g)].map((m) => m[1]);

class MockClassList {
  constructor() { this.values = new Set(); }
  add(...items) { items.forEach((item) => this.values.add(item)); }
  remove(...items) { items.forEach((item) => this.values.delete(item)); }
  contains(item) { return this.values.has(item); }
}

function createElement(id = '') {
  return {
    id,
    value: '',
    textContent: '',
    innerHTML: '',
    dataset: {},
    style: {},
    files: [],
    classList: new MockClassList(),
    listeners: {},
    addEventListener(type, handler) {
      this.listeners[type] ||= [];
      this.listeners[type].push(handler);
    },
    appendChild() {},
    remove() {},
    click() {},
    focus() { document.activeElement = this; },
    blur() { if (document.activeElement === this) document.activeElement = null; },
    setAttribute(name, value) { this[name] = value; },
    removeAttribute(name) { delete this[name]; },
    closest(selector) {
      if (selector === '[data-toast-action]' && this.dataset.toastAction !== undefined) return this;
      return null;
    }
  };
}

function createHarness(seedStorage = {}, options = {}) {
  const downloads = [];
  const elements = new Map();
  for (const id of idMatches) elements.set(id, createElement(id));

  const trendCard = createElement('trend-card');
  const tabButtons = [...new Set(tabNames)].map((tab) => {
    const el = createElement(`tab-btn-${tab}`);
    el.dataset.tab = tab;
    return el;
  });
  const addButtons = [...new Set(openAddModes)].map((mode) => {
    const el = createElement(`open-add-${mode}`);
    el.dataset.openAdd = mode;
    return el;
  });
  const jumpButtons = [...new Set(tabJumpNames)].map((tab) => {
    const el = createElement(`jump-${tab}`);
    el.dataset.tabJump = tab;
    return el;
  });
  const quickOpenButtons = [...new Set(quickAddOpenIds)].map((id) => elements.get(id)).filter(Boolean);
  const quickCancelButtons = [...new Set(quickAddCancelIds)].map((id) => elements.get(id)).filter(Boolean);
  quickCancelButtons.forEach((el) => { el.dataset.quickAddCancel = ''; });
  const screens = [...new Set(tabNames)].map((tab) => elements.get(`tab-${tab}`)).filter(Boolean);

  const storage = new Map(Object.entries(seedStorage));
  global.document = {
    activeElement: null,
    hidden: false,
    body: createElement('body'),
    getElementById(id) { return elements.get(id) || null; },
    querySelector(selector) {
      if (selector === '.trend-card') return trendCard;
      if (selector === 'link[rel="manifest"]') return createElement('manifest-link');
      const tabMatch = selector.match(/^\.tab-btn\[data-tab="(.+)"\]$/);
      if (tabMatch) return tabButtons.find((button) => button.dataset.tab === tabMatch[1]) || null;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '.tab-btn') return tabButtons;
      if (selector === '[data-open-add]') return addButtons;
      if (selector === '[data-tab-jump]') return jumpButtons;
      if (selector === '[data-quick-add-open]') return quickOpenButtons;
      if (selector === '[data-quick-add-cancel]') return quickCancelButtons;
      if (selector === '.tab-screen') return screens;
      return [];
    },
    createElement(tag) { return createElement(tag); },
    addEventListener() {}
  };
  const document = global.document;

  const context = {
    console: options.console || console,
    document,
    window: { addEventListener() {} },
    navigator: options.navigator || { clipboard: { writeText: async () => {} } },
    prompt: options.prompt || (() => ""),
    location: { protocol: 'http:', hostname: 'localhost' },
    localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, String(value)); }
    },
    confirm: () => true,
    crypto: webcrypto,
    setInterval: () => 1,
    clearInterval: () => {},
    setTimeout: () => 1,
    clearTimeout: () => {},
    URL: {
      createObjectURL: (blob) => { downloads.push(blob); return 'blob:mock'; },
      revokeObjectURL: () => {}
    },
    Blob,
    File: typeof File === 'function' ? File : class File extends Blob { constructor(parts, name, opts) { super(parts, opts); this.name = name; } },
    Intl,
    Date,
    Math,
    Number,
    String,
    RegExp,
    Map,
    Set,
    Array,
    Object,
    JSON,
    Promise,
    Uint8Array,
    Tesseract: options.Tesseract,
    globalThis: null
  };
  context.globalThis = context;
  return { context, elements, storage, downloads };
}

function callFirst(element, type, event = {}) {
  if (!element.listeners[type] || !element.listeners[type].length) throw new Error(`${element.id} has no ${type} listener`);
  return element.listeners[type][0](event);
}

function runStartup(seedStorage) {
  const harness = createHarness(seedStorage);
  vm.runInNewContext(appCode, harness.context, { filename: 'app.js' });

  const form = harness.elements.get('deliveryForm');
  harness.elements.get('companyInput').value = 'DoorDash';
  harness.elements.get('earningsInput').value = '18.75';
  harness.elements.get('milesInput').value = '5.4';
  harness.elements.get('minutesInput').value = '24';
  harness.elements.get('zoneInput').value = 'South City';
  callFirst(form, 'submit', { preventDefault() {} });

  const saved = harness.storage.get('giglens.deliveries.v1');
  if (!saved || !saved.includes('18.75') || !saved.includes('South City')) {
    throw new Error('manual delivery save did not persist full delivery details to localStorage');
  }
  const firstDelivery = JSON.parse(saved)[0];
  if (firstDelivery.source !== 'manual' || !firstDelivery.updatedAt || !firstDelivery.version) {
    throw new Error('manual delivery did not persist normalized metadata');
  }
  for (const key of ['date', 'note', 'notes', 'tags', 'deleted', 'createdAt', 'updatedAt', 'version']) {
    if (!(key in firstDelivery)) throw new Error(`manual delivery missing normalized ${key} field`);
  }
  if (!harness.elements.get('profitLine').textContent.includes('$17.35')) {
    throw new Error(`central profit engine did not render expected first-delivery profit: ${harness.elements.get('profitLine').textContent}`);
  }
  if (!harness.elements.get('taxDeduction').textContent.includes('$3.62')) {
    throw new Error(`central profit engine did not render expected mileage deduction: ${harness.elements.get('taxDeduction').textContent}`);
  }

  const quickOpen = harness.elements.get('quickAddOpenBtn');
  if (!quickOpen.listeners.click?.length) throw new Error('quick add open button is not wired');
  callFirst(quickOpen, 'click', {});
  if (harness.elements.get('quickAddSheet').classList.contains('hidden')) {
    throw new Error('quick add sheet did not open');
  }
  if (!harness.elements.get('quickScreenshotInput').listeners.change?.length) {
    throw new Error('quick screenshot input is not wired');
  }
  if (!harness.elements.get('quickClearScanBtn').listeners.click?.length) {
    throw new Error('quick clear scan button is not wired');
  }
  harness.elements.get('quickEarningsInput').value = '15.25';
  harness.elements.get('quickMilesInput').value = '0';
  harness.elements.get('quickMinutesInput').value = '20';
  harness.elements.get('quickZoneInput').value = 'South City';
  callFirst(harness.elements.get('quickAddForm'), 'submit', { preventDefault() {} });
  const savedAfterQuick = JSON.parse(harness.storage.get('giglens.deliveries.v1'));
  if (!savedAfterQuick.some((d) => d.earnings === 15.25 && d.miles === 0 && d.zone === 'South City' && d.source === 'manual')) {
    throw new Error('quick add did not persist a zero-mile delivery with metadata');
  }
  if (!harness.elements.get('quickAddSheet').classList.contains('hidden')) {
    throw new Error('quick add sheet did not close after save');
  }
  if (!harness.elements.get('todayEarned').textContent.includes('34.00')) {
    throw new Error('dashboard did not update after quick add save');
  }

  callFirst(quickOpen, 'click', {});
  harness.elements.get('quickEarningsInput').value = '0';
  harness.elements.get('quickMilesInput').value = '2';
  const beforeInvalidQuick = JSON.parse(harness.storage.get('giglens.deliveries.v1')).length;
  callFirst(harness.elements.get('quickAddForm'), 'submit', { preventDefault() {} });
  const afterInvalidQuick = JSON.parse(harness.storage.get('giglens.deliveries.v1')).length;
  if (afterInvalidQuick !== beforeInvalidQuick || !harness.elements.get('toast').textContent.includes('earnings')) {
    throw new Error('quick add invalid earnings should be rejected without saving');
  }
  callFirst(harness.elements.get('quickCancelBtn'), 'click', {});

  harness.elements.get('companyInput').value = 'Uber Eats';
  harness.elements.get('earningsInput').value = '11.50';
  harness.elements.get('milesInput').value = '3.1';
  harness.elements.get('minutesInput').value = '18';
  harness.elements.get('zoneInput').value = 'Tower Grove';
  callFirst(harness.elements.get('saveAddAnotherBtn'), 'click', {});
  const afterAddAnother = JSON.parse(harness.storage.get('giglens.deliveries.v1'));
  if (afterAddAnother.length < 2 || !afterAddAnother.some((d) => d.zone === 'Tower Grove')) {
    throw new Error('save + add another did not persist a second delivery');
  }

  harness.elements.get('offerPayInput').value = '9.75';
  harness.elements.get('offerMilesInput').value = '4.2';
  harness.elements.get('offerMinutesInput').value = '22';
  harness.elements.get('offerZoneInput').value = 'Kirkwood';
  callFirst(harness.elements.get('offerPayInput'), 'input', {});
  if (!harness.elements.get('decisionResult').innerHTML.includes('ACCEPT')) {
    throw new Error('accept calculator did not render an ACCEPT decision for a strong offer');
  }
  callFirst(harness.elements.get('saveOfferAsDeliveryBtn'), 'click', {});
  const savedAfterOffer = JSON.parse(harness.storage.get('giglens.deliveries.v1'));
  if (savedAfterOffer.length < 3) throw new Error('save offer as delivery did not persist');
  if (!savedAfterOffer.some((d) => d.source === 'calculator' && d.zone === 'Kirkwood')) {
    throw new Error('calculator delivery did not persist source and zone metadata');
  }

  if (!harness.elements.get('heroShiftBtn').listeners.click?.length) {
    throw new Error('hero shift action is not wired');
  }
  callFirst(harness.elements.get('shiftBtn'), 'click', {});
  if (!harness.storage.get('giglens.shift.v1')?.includes('startedAt')) {
    throw new Error('shift toggle did not persist shift state');
  }
  callFirst(harness.elements.get('shiftBtn'), 'click', {});
  const completedShift = JSON.parse(harness.storage.get('giglens.shift.v1'));
  if (!Array.isArray(completedShift.shiftHistory) || !completedShift.shiftHistory.length || !completedShift.lastSummary) {
    throw new Error('ending a shift did not persist lastSummary and shiftHistory');
  }

  for (const id of ['projectedTotal', 'goalEta', 'avgDeliveryValue', 'taxMiles', 'vehicleCostToday', 'bestCompanyToday', 'worstCompanyToday', 'bestZoneToday', 'worstZoneToday', 'performanceRecommendation', 'analyticsBestCompany', 'analyticsWorstCompany', 'analyticsBestZone', 'analyticsWorstZone', 'analyticsBestHourToday', 'analyticsWeeklyBestHour', 'analyticsCompanyBreakdown', 'analyticsZoneBreakdown', 'analyticsHourlyBreakdown']) {
    const el = harness.elements.get(id);
    if (!el) throw new Error(`phase 9 command/analytics element missing in smoke harness: ${id}`);
    const rendered = `${el.textContent || ''} ${el.innerHTML || ''}`;
    if (/NaN|Infinity|undefined|null/.test(rendered)) {
      throw new Error(`phase 9 analytics rendered unsafe value in ${id}: ${rendered}`);
    }
  }

  if (!harness.elements.get('bestCompanyToday').textContent || harness.elements.get('bestCompanyToday').textContent === '—') {
    throw new Error('best company command metric did not update after saved deliveries');
  }
  if (!harness.elements.get('bestZoneToday').textContent || harness.elements.get('bestZoneToday').textContent === '—') {
    throw new Error('best zone command metric did not update after saved deliveries');
  }
  if (harness.elements.get('analyticsCompanyBreakdown').className.includes('empty') || !harness.elements.get('analyticsCompanyBreakdown').innerHTML.includes('DoorDash') || !harness.elements.get('analyticsCompanyBreakdown').innerHTML.includes('Uber Eats')) {
    throw new Error('platform analytics should aggregate multiple saved companies');
  }
  if (harness.elements.get('analyticsZoneBreakdown').className.includes('empty') || !harness.elements.get('analyticsZoneBreakdown').innerHTML.includes('South City') || !harness.elements.get('analyticsZoneBreakdown').innerHTML.includes('Kirkwood')) {
    throw new Error('zone analytics should aggregate multiple saved zones');
  }
  if (harness.elements.get('analyticsHourlyBreakdown').className.includes('empty') || !harness.elements.get('analyticsHourlyBreakdown').innerHTML.includes('gross/hr')) {
    throw new Error('hourly analytics should render real saved delivery hour metrics');
  }
}

runStartup({});

function runMigrationSmoke() {
  const legacyDate = new Date().toISOString();
  const legacyDeliveries = [{
    id: 'legacy-1',
    company: 'NotAPlatform',
    earnings: '$22.40',
    miles: '0',
    minutes: 'bad',
    zone: '  South City  ',
    note: 'legacy note',
    createdAt: legacyDate,
    tags: ['Lunch', ' lunch ', '<script>']
  }];
  const legacySettings = {
    dailyGoal: '250',
    defaultCompany: 'BadApp',
    gasPrice: '3.25',
    mpg: '28',
    maintenancePerMile: '0.15',
    taxMileageRate: '0.70',
    minPerMile: '1.75',
    minPerHour: '24',
    minPayout: '8',
    maxMiles: '10',
    theme: 'neon'
  };
  const legacyShift = {
    active: true,
    startedAt: legacyDate,
    lastSummary: 123,
    shiftHistory: [{ startedAt: legacyDate, endedAt: legacyDate, summary: 'old shift' }]
  };
  const harness = createHarness({
    'driveledger.deliveries.v1': JSON.stringify(legacyDeliveries),
    'driveledger.settings.v1': JSON.stringify(legacySettings),
    'driveledger.shift.v1': JSON.stringify(legacyShift)
  });
  vm.runInNewContext(appCode, harness.context, { filename: 'app.js' });
  const migratedDeliveries = JSON.parse(harness.storage.get('giglens.deliveries.v1'));
  const migratedSettings = JSON.parse(harness.storage.get('giglens.settings.v1'));
  const migratedShift = JSON.parse(harness.storage.get('giglens.shift.v1'));

  if (migratedDeliveries.length !== 1) throw new Error('legacy delivery was not preserved during migration');
  const d = migratedDeliveries[0];
  if (d.company !== 'Other' || d.miles !== 0 || d.note !== 'legacy note' || d.notes !== 'legacy note') {
    throw new Error('legacy delivery fields were not normalized safely');
  }
  for (const key of ['date', 'merchant', 'restaurant', 'source', 'ocrText', 'ocrConfidence', 'tags', 'deleted', 'version']) {
    if (!(key in d)) throw new Error(`migrated delivery missing ${key}`);
  }
  if (migratedSettings.vehicleMpg !== 28 || migratedSettings.mpg !== 28) {
    throw new Error('settings MPG alias migration failed');
  }
  if (migratedSettings.maintenanceCostPerMile !== 0.15 || migratedSettings.maintenancePerMile !== 0.15) {
    throw new Error('settings maintenance alias migration failed');
  }
  if (migratedSettings.mileageDeductionRate !== 0.7 || migratedSettings.taxMileageRate !== 0.7) {
    throw new Error('settings mileage deduction alias migration failed');
  }
  if (migratedSettings.defaultCompany !== 'DoorDash' || migratedSettings.theme !== 'system' || migratedSettings.appDataVersion !== 12) {
    throw new Error('invalid settings were not defaulted during migration');
  }
  if (!Array.isArray(migratedShift.shiftHistory) || migratedShift.shiftHistory.length !== 1 || migratedShift.appDataVersion !== 12) {
    throw new Error('shift history migration failed');
  }
}


async function runOCRReviewSmoke() {
  const sampleText = 'DoorDash\nPickup from Chipotle\nTotal $14.25\nDistance 6.8 miles\nEstimated time 31 min';
  const harness = createHarness({}, {
    Tesseract: { recognize: async () => ({ data: { text: sampleText } }) }
  });
  vm.runInNewContext(appCode, harness.context, { filename: 'app.js' });

  await callFirst(harness.elements.get('screenshotInput'), 'change', { target: { files: [{ name: 'doordash.png' }] } });
  if (harness.elements.get('ocrReview').classList.contains('hidden')) {
    throw new Error('OCR review card should be visible after successful scan');
  }
  if (!harness.elements.get('ocrCompanyInput').value.includes('DoorDash')) {
    throw new Error('OCR did not parse sample DoorDash company');
  }
  if (harness.elements.get('ocrEarningsInput').value !== '14.25') {
    throw new Error(`OCR did not parse sample earnings: ${harness.elements.get('ocrEarningsInput').value}`);
  }
  if (harness.elements.get('ocrMilesInput').value !== '6.8') {
    throw new Error(`OCR did not parse sample miles: ${harness.elements.get('ocrMilesInput').value}`);
  }
  if (harness.elements.get('ocrMinutesInput').value !== '31') {
    throw new Error(`OCR did not parse sample minutes: ${harness.elements.get('ocrMinutesInput').value}`);
  }
  if (!harness.elements.get('ocrMerchantInput').value.includes('Chipotle')) {
    throw new Error(`OCR did not parse sample restaurant: ${harness.elements.get('ocrMerchantInput').value}`);
  }
  if (!harness.elements.get('ocrConfidenceLabel').textContent.includes('High confidence')) {
    throw new Error('OCR confidence label should show High confidence for complete sample text');
  }

  const merchantCases = [
    {
      label: 'Uber local go-to merchant',
      text: 'Uber Eats\nGo to The Local Kitchen\n123 Main St\n$11.50 estimated payout\n4.2 mi\n22 min',
      expected: 'The Local Kitchen'
    },
    {
      label: 'DoorDash pickup label next line',
      text: 'DoorDash\nPickup\nSeoul Taco\n6665 Delmar Blvd\nTotal $9.75\nDistance 3.1 miles\n18 min',
      expected: 'Seoul Taco'
    },
    {
      label: 'Grubhub restaurant field',
      text: 'Grubhub\nRestaurant: Sauce on the Side\nOrder #1234\nPay $12.00\n6.4 miles\n35 min',
      expected: 'Sauce on the Side'
    },
    {
      label: 'merchant with trailing address',
      text: 'DoorDash\nPick up from Kingside Diner 4651 Maryland Ave\nSubtotal $24.80\nGuaranteed $13.25\n5.8 miles\n28 minutes',
      expected: 'Kingside Diner'
    }
  ];

  for (const sample of merchantCases) {
    const merchantHarness = createHarness({}, {
      Tesseract: { recognize: async () => ({ data: { text: sample.text } }) }
    });
    vm.runInNewContext(appCode, merchantHarness.context, { filename: 'app.js' });
    await callFirst(merchantHarness.elements.get('screenshotInput'), 'change', { target: { files: [{ name: `${sample.label}.png` }] } });
    const detected = merchantHarness.elements.get('ocrMerchantInput').value;
    if (detected !== sample.expected) {
      throw new Error(`OCR restaurant detection failed for ${sample.label}: expected ${sample.expected}, got ${detected}`);
    }
  }


  const platformCases = [
    {
      label: 'DoorDash Dasher signal',
      text: 'Dasher\nNew order\nGuaranteed $9.50\n4.1 mi\n21 min\nPickup from Taco Bell',
      expected: 'DoorDash'
    },
    {
      label: 'Uber Trip Radar signal',
      text: 'Trip Radar\nIncludes trip supplement\n$12.34\n5.6 mi\n28 min\nGo to Sushi Ai',
      expected: 'Uber Eats'
    },
    {
      label: 'Grubhub diner signal',
      text: 'Grubhub\nDiner requested contactless\nAccept offer\nPay $10.75\n3.2 miles\n19 min\nRestaurant: Seoul Taco',
      expected: 'Grubhub'
    },
    {
      label: 'Instacart batch signal',
      text: 'Instacart\nFull-service batch\n12 items to shop\n$18.40\n6.0 mi\n45 min\nStore: Schnucks',
      expected: 'Instacart'
    },
    {
      label: 'Spark Walmart signal',
      text: 'Spark Driver\nWalmart curbside\nRound Robin offer\n$16.00\n8.1 miles\n35 min',
      expected: 'Spark'
    },
    {
      label: 'Roadie gig signal',
      text: 'Roadie\nNew gig\nPickup at Best Buy\n$21.50\n12.3 miles\n40 min',
      expected: 'Roadie'
    },
    {
      label: 'Catering ezCater signal',
      text: 'ezCater\nCatering order\n$42.00\n14 miles\n55 min\nPickup from Panera',
      expected: 'Catering'
    }
  ];

  for (const sample of platformCases) {
    const platformHarness = createHarness({}, {
      Tesseract: { recognize: async () => ({ data: { text: sample.text } }) }
    });
    vm.runInNewContext(appCode, platformHarness.context, { filename: 'app.js' });
    await callFirst(platformHarness.elements.get('screenshotInput'), 'change', { target: { files: [{ name: `${sample.label}.png` }] } });
    const detectedPlatform = platformHarness.elements.get('ocrCompanyInput').value;
    if (detectedPlatform !== sample.expected) {
      throw new Error(`OCR platform detection failed for ${sample.label}: expected ${sample.expected}, got ${detectedPlatform}`);
    }
  }

  const beforeSave = JSON.parse(harness.storage.get('giglens.deliveries.v1') || '[]').length;
  await callFirst(harness.elements.get('saveOcrBtn'), 'click', {});
  const saved = JSON.parse(harness.storage.get('giglens.deliveries.v1') || '[]');
  if (saved.length !== beforeSave + 1) throw new Error('saving reviewed OCR did not persist a delivery');
  const ocrDelivery = saved.find((d) => d.source === 'ocr');
  if (!ocrDelivery || ocrDelivery.company !== 'DoorDash' || ocrDelivery.earnings !== 14.25 || ocrDelivery.miles !== 6.8 || ocrDelivery.minutes !== 31 || !ocrDelivery.ocrText || ocrDelivery.merchant !== 'Chipotle') {
    throw new Error('reviewed OCR delivery was not normalized with OCR metadata');
  }

  const lowHarness = createHarness({}, {
    Tesseract: { recognize: async () => ({ data: { text: 'parking garage receipt no pay or miles here' } }) }
  });
  vm.runInNewContext(appCode, lowHarness.context, { filename: 'app.js' });
  await callFirst(lowHarness.elements.get('screenshotInput'), 'change', { target: { files: [{ name: 'low.png' }] } });
  const lowSaved = JSON.parse(lowHarness.storage.get('giglens.deliveries.v1') || '[]');
  if (lowSaved.length) throw new Error('low-confidence OCR should not autosave');
  if (!lowHarness.elements.get('ocrConfidenceLabel').textContent.includes('Needs review')) {
    throw new Error('low-confidence OCR should be labeled Needs review');
  }
  await callFirst(lowHarness.elements.get('saveOcrBtn'), 'click', {});
  const lowAfterSaveAttempt = JSON.parse(lowHarness.storage.get('giglens.deliveries.v1') || '[]');
  if (lowAfterSaveAttempt.length) throw new Error('invalid low-confidence OCR fields should be rejected when saving');


  let workerTerminated = false;
  const workerOnlyHarness = createHarness({}, {
    Tesseract: {
      createWorker: async () => ({
        recognize: async () => ({ data: { text: 'Uber Eats\nExclusive\nPickup from Burger King\n$9.98\n20 min (3.2 mi) total' } }),
        terminate: async () => { workerTerminated = true; }
      })
    }
  });
  vm.runInNewContext(appCode, workerOnlyHarness.context, { filename: 'app.js' });
  await callFirst(workerOnlyHarness.elements.get('screenshotInput'), 'change', { target: { files: [{ name: 'worker-only.png' }] } });
  if (workerOnlyHarness.elements.get('ocrCompanyInput').value !== 'Uber Eats') {
    throw new Error('createWorker-only OCR path did not complete or detect Uber Eats');
  }
  if (!workerTerminated) throw new Error('createWorker-only OCR path did not terminate its worker');

  const failHarness = createHarness({}, {
    console: { ...console, error() {} },
    Tesseract: { recognize: async () => { throw new Error('OCR unavailable'); } }
  });
  vm.runInNewContext(appCode, failHarness.context, { filename: 'app.js' });
  await callFirst(failHarness.elements.get('screenshotInput'), 'change', { target: { files: [{ name: 'fail.png' }] } });
  if (!failHarness.elements.get('scanStatus').textContent.includes('Could not scan')) {
    throw new Error('OCR failure should show failed status instead of crashing');
  }
}

function runClipboardUnavailableSmoke() {
  const harness = createHarness({}, { navigator: {} });
  vm.runInNewContext(appCode, harness.context, { filename: 'app.js' });

  const form = harness.elements.get('deliveryForm');
  harness.elements.get('companyInput').value = 'DoorDash';
  harness.elements.get('earningsInput').value = '10.00';
  harness.elements.get('milesInput').value = '2.0';
  callFirst(form, 'submit', { preventDefault() {} });

  callFirst(harness.elements.get('copySummaryBtn'), 'click', {});
  if (!harness.elements.get('toast').textContent.includes('Copy is not available')) {
    throw new Error('copy summary should not claim success when Clipboard API is unavailable');
  }
}


function setOffer(harness, { pay, miles, minutes, company = 'DoorDash', zone = 'South City', note = '' }) {
  harness.elements.get('offerPayInput').value = String(pay ?? '');
  harness.elements.get('offerMilesInput').value = String(miles ?? '');
  harness.elements.get('offerMinutesInput').value = String(minutes ?? '');
  harness.elements.get('offerCompanyInput').value = company;
  harness.elements.get('offerZoneInput').value = zone;
  harness.elements.get('offerNoteInput').value = note;
}

async function runDecisionAssistantSmoke() {
  let copiedDecision = '';
  const harness = createHarness({}, {
    navigator: { clipboard: { writeText: async (text) => { copiedDecision = text; } } }
  });
  vm.runInNewContext(appCode, harness.context, { filename: 'app.js' });

  for (const id of ['calculateOfferBtn', 'clearOfferBtn', 'copyDecisionBtn', 'saveOfferAsDeliveryBtn', 'offerNoteInput']) {
    if (!harness.elements.get(id)) throw new Error(`phase 6 element missing in smoke harness: ${id}`);
  }

  setOffer(harness, { pay: 12, miles: 4, minutes: 20, note: 'Fast restaurant' });
  callFirst(harness.elements.get('calculateOfferBtn'), 'click', {});
  let html = harness.elements.get('decisionResult').innerHTML;
  if (!html.includes('ACCEPT') || !html.includes('Gross $/mile') || !html.includes('Estimated profit') || !html.includes('Pass')) {
    throw new Error('accept calculator did not render transparent ACCEPT decision with threshold rows');
  }
  if (/NaN|Infinity|undefined|null/.test(html)) throw new Error(`accept decision rendered unsafe value: ${html}`);

  await callFirst(harness.elements.get('copyDecisionBtn'), 'click', {});
  if (!copiedDecision.includes('GigLens order decision: ACCEPT') || !copiedDecision.includes('Fast restaurant')) {
    throw new Error('copy decision did not include decision summary and note');
  }

  setOffer(harness, { pay: 7.5, miles: 5.2, minutes: 20 });
  callFirst(harness.elements.get('calculateOfferBtn'), 'click', {});
  html = harness.elements.get('decisionResult').innerHTML;
  if (!html.includes('BORDERLINE') || !html.includes('Fail')) {
    throw new Error('borderline calculator case did not render BORDERLINE with a failed rule');
  }
  if (/NaN|Infinity|undefined|null/.test(html)) throw new Error(`borderline decision rendered unsafe value: ${html}`);

  setOffer(harness, { pay: 5, miles: 10, minutes: 45 });
  callFirst(harness.elements.get('calculateOfferBtn'), 'click', {});
  html = harness.elements.get('decisionResult').innerHTML;
  if (!html.includes('DECLINE') || !html.includes('Too weak')) {
    throw new Error('decline calculator case did not render DECLINE with reasons');
  }
  if (/NaN|Infinity|undefined|null/.test(html)) throw new Error(`decline decision rendered unsafe value: ${html}`);

  setOffer(harness, { pay: 0, miles: 0, minutes: 0 });
  const beforeInvalid = JSON.parse(harness.storage.get('giglens.deliveries.v1') || '[]').length;
  callFirst(harness.elements.get('saveOfferAsDeliveryBtn'), 'click', {});
  const afterInvalid = JSON.parse(harness.storage.get('giglens.deliveries.v1') || '[]').length;
  html = harness.elements.get('decisionResult').innerHTML;
  if (afterInvalid !== beforeInvalid || !html.includes('Enter a valid offer') || !harness.elements.get('toast').textContent.includes('Enter valid pay')) {
    throw new Error('invalid offer should be rejected without saving');
  }
  if (/NaN|Infinity|undefined|null/.test(html)) throw new Error(`invalid decision rendered unsafe value: ${html}`);

  setOffer(harness, { pay: 13, miles: 4, minutes: 22, company: 'Uber Eats', zone: 'Kirkwood', note: 'Good stack' });
  callFirst(harness.elements.get('saveOfferAsDeliveryBtn'), 'click', {});
  const saved = JSON.parse(harness.storage.get('giglens.deliveries.v1') || '[]');
  const calculatorDelivery = saved.find((d) => d.source === 'calculator' && d.company === 'Uber Eats' && d.zone === 'Kirkwood');
  if (!calculatorDelivery || calculatorDelivery.notes !== 'Good stack' || !calculatorDelivery.tags.includes('accept')) {
    throw new Error('save offer did not persist calculator source, note, zone, and decision tag');
  }
  if (harness.elements.get('offerPayInput').value || harness.elements.get('offerMilesInput').value || harness.elements.get('offerMinutesInput').value || harness.elements.get('offerNoteInput').value) {
    throw new Error('save offer should clear calculator fields after saving');
  }

  setOffer(harness, { pay: 11, miles: 3, minutes: 18 });
  callFirst(harness.elements.get('clearOfferBtn'), 'click', {});
  if (harness.elements.get('offerPayInput').value || !harness.elements.get('decisionResult').innerHTML.includes('Enter a valid offer')) {
    throw new Error('clear calculator did not reset fields and decision card');
  }

  const strictHarness = createHarness({
    'giglens.settings.v1': JSON.stringify({ minPerMile: 5, minPerHour: 60, minPayout: 20, maxMiles: 3 })
  });
  vm.runInNewContext(appCode, strictHarness.context, { filename: 'app.js' });
  setOffer(strictHarness, { pay: 12, miles: 4, minutes: 20 });
  callFirst(strictHarness.elements.get('calculateOfferBtn'), 'click', {});
  if (!strictHarness.elements.get('decisionResult').innerHTML.includes('DECLINE')) {
    throw new Error('calculator thresholds from settings did not affect decision result');
  }

  console.log('phase 6 accept calculator cases passed');
}


function clickHistoryAction(harness, dataset) {
  return callFirst(harness.elements.get('historyList'), 'click', {
    target: {
      closest(selector) {
        if (selector === '[data-delete],[data-edit],[data-duplicate],[data-open-add]') return { dataset };
        return null;
      }
    }
  });
}

function runHistoryEditingSmoke() {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  today.setHours(12, 0, 0, 0);
  yesterday.setHours(18, 0, 0, 0);
  const seedDeliveries = [
    {
      id: 'today-1',
      company: 'DoorDash',
      earnings: 18,
      miles: 6,
      minutes: 30,
      zone: 'South City',
      notes: 'Lunch rush',
      source: 'manual',
      createdAt: today.toISOString(),
      updatedAt: today.toISOString(),
      version: 4
    },
    {
      id: 'yesterday-1',
      company: 'Uber Eats',
      earnings: 22,
      miles: 8,
      minutes: 45,
      zone: 'Kirkwood',
      source: 'ocr',
      ocrText: 'sample',
      ocrConfidence: 88,
      createdAt: yesterday.toISOString(),
      updatedAt: yesterday.toISOString(),
      version: 4
    }
  ];
  const harness = createHarness({
    'giglens.deliveries.v1': JSON.stringify(seedDeliveries)
  });
  vm.runInNewContext(appCode, harness.context, { filename: 'app.js' });

  let historyHtml = harness.elements.get('historyList').innerHTML;
  if (!historyHtml.includes('data-history-day') || !historyHtml.includes('avg $/mile') || !historyHtml.includes('gross/hour')) {
    throw new Error('history should render grouped day summaries with avg $/mile and gross/hour metrics');
  }
  if (!historyHtml.includes('South City') || !historyHtml.includes('30m') || !historyHtml.includes('Manual') || !historyHtml.includes('OCR')) {
    throw new Error('history cards should show zone, minutes, and source labels');
  }

  clickHistoryAction(harness, { edit: 'today-1' });
  if (harness.elements.get('editDeliveryId').value !== 'today-1') {
    throw new Error('edit action did not load selected delivery into the form');
  }
  harness.elements.get('earningsInput').value = '25.50';
  harness.elements.get('milesInput').value = '5.0';
  harness.elements.get('minutesInput').value = '25';
  harness.elements.get('zoneInput').value = 'Downtown';
  callFirst(harness.elements.get('deliveryForm'), 'submit', { preventDefault() {} });
  let saved = JSON.parse(harness.storage.get('giglens.deliveries.v1'));
  const edited = saved.find((d) => d.id === 'today-1');
  if (!edited || edited.earnings !== 25.5 || edited.miles !== 5 || edited.minutes !== 25 || edited.zone !== 'Downtown') {
    throw new Error('edit action did not update the saved delivery in localStorage');
  }
  if (!harness.elements.get('todayEarned').textContent.includes('25.50')) {
    throw new Error('dashboard did not recalculate after delivery edit');
  }

  clickHistoryAction(harness, { duplicate: 'today-1' });
  saved = JSON.parse(harness.storage.get('giglens.deliveries.v1'));
  const copies = saved.filter((d) => d.company === 'DoorDash' && d.earnings === 25.5);
  if (copies.length < 2 || new Set(copies.map((d) => d.id)).size !== copies.length) {
    throw new Error('duplicate action should create a separate delivery with a new ID');
  }
  const duplicate = copies.find((d) => d.id !== 'today-1');
  if (!duplicate || duplicate.createdAt === edited.createdAt) {
    throw new Error('duplicate action should use a new current timestamp');
  }

  clickHistoryAction(harness, { delete: 'today-1' });
  saved = JSON.parse(harness.storage.get('giglens.deliveries.v1'));
  if (saved.some((d) => d.id === 'today-1')) {
    throw new Error('delete action did not remove the selected delivery');
  }
  if (harness.elements.get('todayEarned').textContent.includes('51.00')) {
    throw new Error('dashboard did not recalculate after delete');
  }
  callFirst(harness.elements.get('toast'), 'click', {
    target: { closest: (selector) => selector === '[data-toast-action]' ? {} : null }
  });
  saved = JSON.parse(harness.storage.get('giglens.deliveries.v1'));
  if (!saved.some((d) => d.id === 'today-1')) {
    throw new Error('undo delete did not restore the selected delivery');
  }
}

function runAnalyticsEmptySmoke() {
  const harness = createHarness({});
  vm.runInNewContext(appCode, harness.context, { filename: 'app.js' });
  for (const id of ['analyticsCompanyBreakdown', 'analyticsZoneBreakdown', 'analyticsHourlyBreakdown']) {
    const el = harness.elements.get(id);
    if (!el.className.includes('empty')) throw new Error(`${id} should render an empty state without crashing`);
    if (/NaN|Infinity|undefined|null/.test(`${el.textContent} ${el.innerHTML}`)) {
      throw new Error(`${id} empty state rendered unsafe text`);
    }
  }
}

async function runExportCenterSmoke() {
  const first = new Date();
  first.setHours(10, 15, 0, 0);
  const second = new Date(first.getTime() - 86400000);
  const seedDeliveries = [
    {
      id: 'export-1',
      company: 'DoorDash',
      earnings: 18.5,
      miles: 6.2,
      minutes: 30,
      zone: 'South City',
      notes: 'Apartment, gate code "1234"\nCustomer tipped after dropoff',
      source: 'manual',
      createdAt: first.toISOString(),
      updatedAt: first.toISOString(),
      version: 4
    },
    {
      id: 'export-2',
      company: 'Uber Eats',
      earnings: 22,
      miles: 8,
      minutes: 42,
      zone: 'Kirkwood',
      notes: 'Lunch order',
      source: 'ocr',
      createdAt: second.toISOString(),
      updatedAt: second.toISOString(),
      version: 4
    }
  ];
  const harness = createHarness({
    'giglens.deliveries.v1': JSON.stringify(seedDeliveries)
  });
  vm.runInNewContext(appCode, harness.context, { filename: 'app.js' });

  for (const id of ['exportBtn', 'exportTaxBtn', 'exportDailyBtn', 'backupBtn']) {
    if (!harness.elements.get(id).listeners.click?.length) throw new Error(`${id} is not wired in the export center`);
  }

  await callFirst(harness.elements.get('exportBtn'), 'click', {});
  let text = await harness.downloads.at(-1).text();
  if (!text.includes('"date","company","restaurant","earnings","miles","minutes","zone","note","source"')) {
    throw new Error('standard CSV did not include the expected bookkeeping headers');
  }
  if (!text.includes('"Apartment, gate code ""1234""')) {
    throw new Error('standard CSV did not escape commas and quotes in notes');
  }
  if (!text.includes('Customer tipped after dropoff')) {
    throw new Error('standard CSV did not preserve multiline note content');
  }

  await callFirst(harness.elements.get('exportTaxBtn'), 'click', {});
  text = await harness.downloads.at(-1).text();
  if (!text.includes('"date","company","gross_earnings","business_miles","mileage_deduction_rate","estimated_mileage_deduction","fuel_cost_estimate","maintenance_cost_estimate","estimated_profit"')) {
    throw new Error('tax CSV did not include required tax/export headers');
  }
  if (!text.includes('"0.67"')) throw new Error('tax CSV did not include mileage deduction rate');

  await callFirst(harness.elements.get('exportDailyBtn'), 'click', {});
  text = await harness.downloads.at(-1).text();
  if (!text.includes('"date","total_earnings","estimated_profit","miles","deliveries","average_dollars_per_mile","gross_hour","profit_hour"')) {
    throw new Error('daily summary CSV did not include required summary headers');
  }
  if ((text.match(/\d{4}-\d{2}-\d{2}/g) || []).length < 2) {
    throw new Error('daily summary CSV should group saved deliveries by date');
  }

  await callFirst(harness.elements.get('backupBtn'), 'click', {});
  text = await harness.downloads.at(-1).text();
  const backup = JSON.parse(text);
  if (backup.app !== 'GigLens' || !backup.exportedAt || !backup.appDataVersion || !Array.isArray(backup.deliveries) || !backup.settings || !backup.shift) {
    throw new Error('backup JSON did not include required metadata, settings, shift, and deliveries');
  }

  const emptyHarness = createHarness({});
  vm.runInNewContext(appCode, emptyHarness.context, { filename: 'app.js' });
  await callFirst(emptyHarness.elements.get('exportDailyBtn'), 'click', {});
  const emptyText = await emptyHarness.downloads.at(-1).text();
  if (!emptyText.includes('"date","total_earnings"') || !emptyHarness.elements.get('toast').textContent.includes('Header-only')) {
    throw new Error('empty daily CSV export should create a header-only file and explain it');
  }

  console.log('phase 10 export center cases passed');
}

async function runBackupSafetySmoke() {
  const previous = {
    id: 'keep-1',
    company: 'DoorDash',
    earnings: 10,
    miles: 4,
    minutes: 20,
    zone: 'South City',
    source: 'manual',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 4
  };
  const duplicate = { ...previous, earnings: 99 };
  const imported = {
    id: 'new-import-1',
    company: 'Uber Eats',
    earnings: 24.5,
    miles: 8.5,
    minutes: 35,
    zone: 'Kirkwood',
    source: 'manual',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 4
  };
  const backupPayload = {
    app: 'DriveLedger',
    appDataVersion: 5,
    exportedAt: '2026-07-03T12:00:00.000Z',
    deliveries: [duplicate, imported],
    settings: { dailyGoal: 250, defaultCompany: 'Uber Eats', gasPrice: 4.25, vehicleMpg: 20 },
    shift: { active: false, startedAt: null, endedAt: null, lastSummary: 'backup summary', shiftHistory: [] }
  };

  const harness = createHarness({
    'giglens.deliveries.v1': JSON.stringify([previous]),
    'giglens.settings.v1': JSON.stringify({ dailyGoal: 175, defaultCompany: 'DoorDash' })
  });
  vm.runInNewContext(appCode, harness.context, { filename: 'app.js' });
  for (const id of ['importInput', 'importPreview', 'importPreviewMeta', 'importModeInput', 'confirmImportBtn', 'cancelImportBtn', 'restoreRollbackBtn']) {
    if (!harness.elements.get(id)) throw new Error(`${id} missing from backup safety UI`);
  }
  await callFirst(harness.elements.get('importInput'), 'change', { target: { files: [{ text: async () => JSON.stringify(backupPayload) }] } });
  if (harness.elements.get('importPreview').classList.contains('hidden')) {
    throw new Error('valid backup import did not render preview');
  }
  if (!harness.elements.get('importPreviewMeta').innerHTML.includes('2') || !harness.elements.get('importPreviewMeta').innerHTML.includes('Included')) {
    throw new Error('import preview did not show delivery/settings/shift metadata');
  }
  harness.elements.get('importModeInput').value = 'merge';
  await callFirst(harness.elements.get('confirmImportBtn'), 'click', {});
  const afterMerge = JSON.parse(harness.storage.get('giglens.deliveries.v1'));
  if (afterMerge.length !== 2 || !afterMerge.some((d) => d.id === 'new-import-1') || !afterMerge.some((d) => d.id === 'keep-1' && d.earnings === 10)) {
    throw new Error('merge import should add new deliveries and keep existing duplicate IDs');
  }
  if (!harness.elements.get('toast').textContent.includes('skipped 1 duplicates')) {
    throw new Error('merge import should skip duplicate delivery IDs and report it');
  }

  await callFirst(harness.elements.get('importInput'), 'change', { target: { files: [{ text: async () => JSON.stringify(backupPayload) }] } });
  harness.elements.get('importModeInput').value = 'replace';
  await callFirst(harness.elements.get('confirmImportBtn'), 'click', {});
  const afterReplace = JSON.parse(harness.storage.get('giglens.deliveries.v1'));
  if (afterReplace.length !== 2 || !afterReplace.some((d) => d.id === 'keep-1' && d.earnings === 99)) {
    throw new Error('replace import did not replace current deliveries with backup records');
  }
  if (!harness.storage.get('giglens.rollback.v1')) {
    throw new Error('replace import did not store rollback');
  }
  await callFirst(harness.elements.get('restoreRollbackBtn'), 'click', {});
  const afterRollback = JSON.parse(harness.storage.get('giglens.deliveries.v1'));
  if (afterRollback.length !== 2 || !afterRollback.some((d) => d.id === 'new-import-1')) {
    throw new Error('rollback restore did not restore previous data');
  }

  const invalidHarness = createHarness({}, { console: { ...console, error() {} } });
  vm.runInNewContext(appCode, invalidHarness.context, { filename: 'app.js' });
  await callFirst(invalidHarness.elements.get('importInput'), 'change', { target: { files: [{ text: async () => '{not json' }] } });
  if (!invalidHarness.elements.get('toast').textContent.includes('Could not import backup')) {
    throw new Error('invalid backup should be rejected without crashing');
  }
  if (!invalidHarness.elements.get('importPreview').classList.contains('hidden')) {
    throw new Error('invalid backup should not leave import preview open');
  }

  console.log('phase 11 backup safety cases passed');
}


async function runDriverRecapSmoke() {
  const emptyHarness = createHarness({});
  vm.runInNewContext(appCode, emptyHarness.context, { filename: 'app.js' });
  if (!emptyHarness.elements.get('dailySummary').textContent.includes('No shift data yet')) {
    throw new Error('driver recap should render a safe no-data empty state');
  }
  if (!emptyHarness.elements.get('recapStatus').textContent.includes('No data')) {
    throw new Error('driver recap status should show no-data state');
  }

  const first = new Date();
  first.setHours(11, 0, 0, 0);
  const second = new Date();
  second.setHours(13, 30, 0, 0);
  const deliveries = [
    {
      id: 'recap-1',
      company: 'DoorDash',
      earnings: 18,
      miles: 5,
      minutes: 25,
      zone: 'South City',
      source: 'manual',
      createdAt: first.toISOString(),
      updatedAt: first.toISOString(),
      version: 4
    },
    {
      id: 'recap-2',
      company: 'Uber Eats',
      earnings: 7,
      miles: 9,
      minutes: 35,
      zone: 'Downtown',
      source: 'manual',
      createdAt: second.toISOString(),
      updatedAt: second.toISOString(),
      version: 4
    }
  ];
  let copiedText = '';
  const harness = createHarness({
    'giglens.deliveries.v1': JSON.stringify(deliveries),
    'giglens.settings.v1': JSON.stringify({ dailyGoal: 40, minPerMile: 1.5, minPerHour: 20 }),
    'giglens.shift.v1': JSON.stringify({ active: true, startedAt: first.toISOString(), endedAt: null, shiftHistory: [] })
  }, {
    navigator: { clipboard: { writeText: async (text) => { copiedText = text; } } }
  });
  vm.runInNewContext(appCode, harness.context, { filename: 'app.js' });

  const recapHtml = `${harness.elements.get('dailySummary').innerHTML} ${harness.elements.get('recapRecommendation').innerHTML}`;
  for (const token of ['estimated profit', 'Best company', 'Best zone', 'Best delivery', 'Weakest delivery']) {
    if (!recapHtml.includes(token)) throw new Error(`driver recap did not render ${token}`);
  }
  for (const id of ['recapMetrics', 'shiftHistoryList', 'dailyRecapCard']) {
    if (!harness.elements.get(id)) throw new Error(`${id} missing from driver recap UI`);
  }
  if (!harness.elements.get('recapMetrics').innerHTML.includes('gross/hr') || !harness.elements.get('recapMetrics').innerHTML.includes('profit/mi')) {
    throw new Error('recap metrics should include hourly and per-mile metrics');
  }
  if (!harness.elements.get('recapRecommendation').innerHTML.includes('Best platform suggestion') || !harness.elements.get('recapRecommendation').innerHTML.includes('Best zone suggestion')) {
    throw new Error('driver coaching should include platform and zone recommendations');
  }
  if (!harness.elements.get('copySummaryBtn').listeners.click?.length) {
    throw new Error('copy recap button is not wired');
  }
  await callFirst(harness.elements.get('copySummaryBtn'), 'click', {});
  for (const token of ['Gross earnings', 'Estimated profit', 'Hours worked', 'Gross $/mile', 'Profit $/mile', 'Best delivery', 'Weakest delivery', 'Recommendation']) {
    if (!copiedText.includes(token)) throw new Error(`copied daily recap missing ${token}`);
  }

  callFirst(harness.elements.get('shiftBtn'), 'click', {});
  const completedShift = JSON.parse(harness.storage.get('giglens.shift.v1'));
  const savedRecap = completedShift.shiftHistory.at(-1);
  if (!savedRecap || !savedRecap.summary.includes('Weakest delivery') || !savedRecap.recommendation || !savedRecap.metrics || savedRecap.metrics.orders !== 2) {
    throw new Error('end shift did not generate and save a full driver recap with metrics');
  }
  if (!harness.elements.get('shiftHistoryList').innerHTML.includes('deliveries')) {
    throw new Error('saved shift recap did not render in shift history');
  }

  const oneDeliveryHarness = createHarness({
    'giglens.deliveries.v1': JSON.stringify([deliveries[0]])
  });
  vm.runInNewContext(appCode, oneDeliveryHarness.context, { filename: 'app.js' });
  if (!oneDeliveryHarness.elements.get('dailySummary').innerHTML.includes('1</strong> delivery')) {
    throw new Error('driver recap should handle exactly one delivery');
  }

  console.log('phase 12 driver coaching recap cases passed');
}


function runMobilePolishSmoke() {
  for (const id of ['mobileActionDock', 'dockQuickAddBtn', 'dockScanBtn', 'dockDecideBtn', 'todayBreakdownsDetails', 'quickAddHint']) {
    if (!idMatches.includes(id)) throw new Error(`${id} missing from phase 13 mobile polish UI`);
  }
  if (!html.includes('class="skip-link"') || !html.includes('aria-modal="true"') || !html.includes('aria-atomic="true"')) {
    throw new Error('phase 13 accessibility landmarks are missing');
  }
  if (!html.includes('id="dockScanBtn"') || !openAddModes.includes('scan')) {
    throw new Error('mobile scan dock action is not represented in data-open-add wiring');
  }
  if (!html.includes('id="dockDecideBtn"') || !tabJumpNames.includes('decide')) {
    throw new Error('mobile decide dock action is not represented in data-tab-jump wiring');
  }
  const harness = createHarness({});
  vm.runInNewContext(appCode, harness.context, { filename: 'app.js' });
  const dockQuick = harness.elements.get('dockQuickAddBtn');
  if (!dockQuick.listeners.click?.length) throw new Error('mobile action dock quick add button is not wired');
  callFirst(dockQuick, 'click', {});
  if (harness.elements.get('quickAddSheet').classList.contains('hidden')) {
    throw new Error('mobile action dock quick add button did not open quick add');
  }
  if (harness.elements.get('quickAddSheet').ariaHidden !== 'false' && harness.elements.get('quickAddSheet')['aria-hidden'] !== 'false') {
    throw new Error('quick add dialog did not update aria-hidden when opened');
  }
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  for (const token of ['mobile-action-dock', 'safe-area-inset-bottom', 'prefers-reduced-motion', 'min-height: 58px', 'loading-state', 'success-state', 'error-state']) {
    if (!css.includes(token)) throw new Error(`phase 13 CSS missing ${token}`);
  }
  console.log('phase 13 mobile polish cases passed');
}

function runPwaOfflinePolishSmoke() {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  const serviceWorker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  if (!manifest.name.includes('Driver Command Center') || manifest.short_name !== 'GigLens') {
    throw new Error('manifest should be install-ready with strong name and GigLens short name');
  }
  if (manifest.display !== 'standalone' || manifest.start_url !== './' || manifest.scope !== './') {
    throw new Error('manifest install fields are not configured for standalone static hosting');
  }
  for (const icon of manifest.icons || []) {
    if (!fs.existsSync(path.join(root, icon.src))) throw new Error(`manifest icon path missing: ${icon.src}`);
    if (!String(icon.purpose || '').includes('maskable')) throw new Error('manifest icons should include maskable purpose');
  }
  for (const asset of ['./index.html', './styles.css', './app.js', './manifest.json', './icons/giglens-icon-192-v401.png', './icons/giglens-icon-512-v401.png', './apple-touch-icon.png']) {
    if (!serviceWorker.includes(`"${asset}"`)) throw new Error(`service worker should cache core app shell assets: ${asset}`);
  }
  for (const token of ['CACHE_VERSION = "v38-giglens-icon-ocr-repair"', 'OFFLINE_FALLBACK', 'networkFirst', 'staleWhileRevalidate', 'Tesseract CDN']) {
    if (!serviceWorker.includes(token)) throw new Error(`service worker missing PWA offline token: ${token}`);
  }
  if (!html.includes('id="offlineBanner"') || !css.includes('offline-banner')) {
    throw new Error('offline banner UI/style missing');
  }
  const harness = createHarness({}, { navigator: { clipboard: { writeText: async () => {} }, onLine: false } });
  vm.runInNewContext(appCode, harness.context, { filename: 'app.js' });
  if (harness.elements.get('offlineBanner').classList.contains('hidden')) {
    throw new Error('offline banner should appear when navigator.onLine is false');
  }
  if (!harness.elements.get('offlineBanner').textContent.includes('OCR may need internet')) {
    throw new Error('offline banner should explain OCR online dependency');
  }
  console.log('phase 14 PWA install and offline polish cases passed');
}


function isoDaysAgo(days, hour = 12) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function runSmartGoalSmoke() {
  for (const id of ['smartGoalCard', 'smartGoalStatus', 'smartGoalSuggestion', 'smartGoalStats', 'smartGoalExplanation', 'applySmartGoalBtn', 'ignoreSmartGoalBtn']) {
    if (!idMatches.includes(id)) throw new Error(`${id} missing from phase 16 smart goal UI`);
  }

  const currentWeekdayDeliveries = [
    { id: 'goal-1', company: 'DoorDash', earnings: 205, miles: 52, minutes: 360, zone: 'South City', source: 'manual', createdAt: isoDaysAgo(7), updatedAt: isoDaysAgo(7), version: 5 },
    { id: 'goal-2', company: 'Uber Eats', earnings: 215, miles: 50, minutes: 390, zone: 'Kirkwood', source: 'manual', createdAt: isoDaysAgo(14), updatedAt: isoDaysAgo(14), version: 5 },
    { id: 'goal-3', company: 'Grubhub', earnings: 110, miles: 31, minutes: 210, zone: 'Clayton', source: 'manual', createdAt: isoDaysAgo(1), updatedAt: isoDaysAgo(1), version: 5 }
  ];
  const harness = createHarness({
    'giglens.deliveries.v1': JSON.stringify(currentWeekdayDeliveries),
    'giglens.settings.v1': JSON.stringify({ dailyGoal: 150 })
  });
  vm.runInNewContext(appCode, harness.context, { filename: 'app.js' });

  if (!harness.elements.get('smartGoalSuggestion').textContent.includes('$210.00')) {
    throw new Error(`smart goal should recommend the average current weekday earnings rounded to nearest $5: ${harness.elements.get('smartGoalSuggestion').textContent}`);
  }
  if (!harness.elements.get('smartGoalExplanation').textContent.includes('past') || !harness.elements.get('smartGoalExplanation').textContent.includes('average')) {
    throw new Error('smart goal explanation should describe the historical basis');
  }
  if (!harness.elements.get('smartGoalStats').innerHTML.includes('avg gross') || !harness.elements.get('smartGoalStats').innerHTML.includes('avg profit') || !harness.elements.get('smartGoalStats').innerHTML.includes('avg hours')) {
    throw new Error('smart goal stats should show average earnings, profit, and hours by day of week');
  }
  if (!harness.elements.get('applySmartGoalBtn').listeners.click?.length || !harness.elements.get('ignoreSmartGoalBtn').listeners.click?.length) {
    throw new Error('smart goal apply/ignore buttons are not wired');
  }
  callFirst(harness.elements.get('applySmartGoalBtn'), 'click', {});
  const updatedSettings = JSON.parse(harness.storage.get('giglens.settings.v1'));
  if (updatedSettings.dailyGoal !== 210) {
    throw new Error(`apply smart goal should update dailyGoal to 210, got ${updatedSettings.dailyGoal}`);
  }
  callFirst(harness.elements.get('ignoreSmartGoalBtn'), 'click', {});
  if (!harness.elements.get('toast').textContent.includes('Kept current goal')) {
    throw new Error('ignore smart goal should keep current goal and show feedback');
  }

  const insufficientHarness = createHarness({
    'giglens.deliveries.v1': JSON.stringify([
      { id: 'goal-single', company: 'DoorDash', earnings: 180, miles: 42, minutes: 310, zone: 'South City', source: 'manual', createdAt: isoDaysAgo(7), updatedAt: isoDaysAgo(7), version: 5 }
    ])
  });
  vm.runInNewContext(appCode, insufficientHarness.context, { filename: 'app.js' });
  if (!insufficientHarness.elements.get('applySmartGoalBtn').disabled || !insufficientHarness.elements.get('smartGoalSuggestion').textContent.includes('Not enough')) {
    throw new Error('smart goal should show a helpful insufficient-history state with disabled apply');
  }

  const todayHarness = createHarness({
    'giglens.deliveries.v1': JSON.stringify([
      { id: 'goal-today', company: 'DoorDash', earnings: 999, miles: 1, minutes: 5, zone: 'Today', source: 'manual', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 5 }
    ])
  });
  vm.runInNewContext(appCode, todayHarness.context, { filename: 'app.js' });
  if (!todayHarness.elements.get('applySmartGoalBtn').disabled || todayHarness.elements.get('smartGoalSuggestion').textContent.includes('$999')) {
    throw new Error('smart goal should ignore today’s partial data when recommending goals');
  }

  console.log('phase 16 smart goal cases passed');
}


function runBestTimeInsightsSmoke() {
  for (const id of ['bestTimeCard', 'bestTimeStatus', 'bestTimeExplanation', 'bestHoursToday', 'bestHistoricalHours', 'weakHoursList']) {
    if (!idMatches.includes(id)) throw new Error(`${id} missing from phase 17 best-time UI`);
  }

  const todayHot = new Date();
  todayHot.setHours(18, 10, 0, 0);
  const todayWeak = new Date();
  todayWeak.setHours(14, 15, 0, 0);
  const seed = [
    { id: 'time-today-1', company: 'DoorDash', earnings: 24, miles: 5, minutes: 28, zone: 'South City', source: 'manual', createdAt: todayHot.toISOString(), updatedAt: todayHot.toISOString(), version: 5 },
    { id: 'time-today-2', company: 'Uber Eats', earnings: 8, miles: 7, minutes: 36, zone: 'Downtown', source: 'manual', createdAt: todayWeak.toISOString(), updatedAt: todayWeak.toISOString(), version: 5 },
    { id: 'time-hist-1', company: 'DoorDash', earnings: 32, miles: 7, minutes: 35, zone: 'South City', source: 'manual', createdAt: isoDaysAgo(2, 18), updatedAt: isoDaysAgo(2, 18), version: 5 },
    { id: 'time-hist-2', company: 'Uber Eats', earnings: 34, miles: 8, minutes: 40, zone: 'South City', source: 'manual', createdAt: isoDaysAgo(3, 18), updatedAt: isoDaysAgo(3, 18), version: 5 },
    { id: 'time-hist-weak-1', company: 'Grubhub', earnings: 6, miles: 8, minutes: 42, zone: 'Downtown', source: 'manual', createdAt: isoDaysAgo(2, 9), updatedAt: isoDaysAgo(2, 9), version: 5 },
    { id: 'time-hist-weak-2', company: 'Spark', earnings: 7, miles: 9, minutes: 45, zone: 'Downtown', source: 'manual', createdAt: isoDaysAgo(3, 9), updatedAt: isoDaysAgo(3, 9), version: 5 }
  ];
  const harness = createHarness({
    'giglens.deliveries.v1': JSON.stringify(seed)
  });
  vm.runInNewContext(appCode, harness.context, { filename: 'app.js' });

  const todayHtml = harness.elements.get('bestHoursToday').innerHTML;
  const historicalHtml = harness.elements.get('bestHistoricalHours').innerHTML;
  const weakHtml = harness.elements.get('weakHoursList').innerHTML;
  if (!todayHtml.includes('avg gross/hr') || !todayHtml.includes('avg profit/hr')) {
    throw new Error('best hours today should render average gross/hour and profit/hour metrics');
  }
  if (!historicalHtml.includes('avg earned') || !historicalHtml.includes('2 days')) {
    throw new Error('historical best hours should use completed past days and show average earnings');
  }
  if (!weakHtml.includes('weak-window') || !weakHtml.includes('tracked time')) {
    throw new Error('weak hours should render low-performing historical hour cards');
  }
  if (!harness.elements.get('analyticsBestHourToday').textContent.includes('/hr gross')) {
    throw new Error('analytics KPI should show today best hour gross/hour pace');
  }
  if (!harness.elements.get('analyticsWeeklyBestHour').textContent.includes('/hr gross')) {
    throw new Error('analytics KPI should show historical best hour gross/hour pace');
  }
  for (const id of ['bestHoursToday', 'bestHistoricalHours', 'weakHoursList']) {
    const output = `${harness.elements.get(id).innerHTML} ${harness.elements.get(id).textContent}`;
    if (/NaN|Infinity|undefined|null/.test(output)) throw new Error(`${id} rendered unsafe best-time output: ${output}`);
  }

  const insufficientHarness = createHarness({
    'giglens.deliveries.v1': JSON.stringify([
      { id: 'time-single', company: 'DoorDash', earnings: 20, miles: 5, minutes: 30, zone: 'South City', source: 'manual', createdAt: isoDaysAgo(1, 18), updatedAt: isoDaysAgo(1, 18), version: 5 }
    ])
  });
  vm.runInNewContext(appCode, insufficientHarness.context, { filename: 'app.js' });
  if (!insufficientHarness.elements.get('bestHistoricalHours').className.includes('empty') || !insufficientHarness.elements.get('bestHistoricalHours').textContent.includes('two past driving days')) {
    throw new Error('best-time historical insight should show a clear insufficient-history empty state');
  }

  const emptyHarness = createHarness({});
  vm.runInNewContext(appCode, emptyHarness.context, { filename: 'app.js' });
  if (!emptyHarness.elements.get('bestHoursToday').className.includes('empty') || !emptyHarness.elements.get('weakHoursList').className.includes('empty')) {
    throw new Error('best-time insights should render clear empty states with no data');
  }

  console.log('phase 17 best time insights cases passed');
}

function runZoneHeatmapSmoke() {
  const now = new Date();
  const seed = [
    { id: 'zone-best-1', company: 'DoorDash', earnings: 30, miles: 6, minutes: 30, zone: 'South City', source: 'manual', createdAt: now.toISOString(), updatedAt: now.toISOString(), version: 6 },
    { id: 'zone-best-2', company: 'Uber Eats', earnings: 28, miles: 5, minutes: 28, zone: 'South City', source: 'manual', createdAt: now.toISOString(), updatedAt: now.toISOString(), version: 6 },
    { id: 'zone-reliable-1', company: 'DoorDash', earnings: 22, miles: 7, minutes: 32, zone: 'Kirkwood', source: 'manual', createdAt: now.toISOString(), updatedAt: now.toISOString(), version: 6 },
    { id: 'zone-reliable-2', company: 'Grubhub', earnings: 21, miles: 6, minutes: 34, zone: 'Kirkwood', source: 'manual', createdAt: now.toISOString(), updatedAt: now.toISOString(), version: 6 },
    { id: 'zone-weak-1', company: 'Spark', earnings: 8, miles: 9, minutes: 40, zone: 'Downtown', source: 'manual', createdAt: now.toISOString(), updatedAt: now.toISOString(), version: 6 },
    { id: 'zone-old-1', company: 'Roadie', earnings: 12, miles: 5, minutes: 30, zone: 'Old Saved Zone', source: 'manual', createdAt: now.toISOString(), updatedAt: now.toISOString(), version: 6 }
  ];
  const harness = createHarness({
    'giglens.deliveries.v1': JSON.stringify(seed),
    'giglens.settings.v1': JSON.stringify({ customZones: ['South City', 'Downtown'], defaultZone: 'South City' })
  }, { prompt: () => 'Clayton Core' });
  vm.runInNewContext(appCode, harness.context, { filename: 'app.js' });

  const heatmap = harness.elements.get('zoneHeatmapGrid').innerHTML;
  if (!heatmap.includes('Best Zone') || !heatmap.includes('Reliable Zone') || !heatmap.includes('Weak Zone') || !heatmap.includes('Avoid Zone')) {
    throw new Error('manual zone heatmap should render all map-style zone roles');
  }
  if (!heatmap.includes('South City') || !heatmap.includes('Downtown')) {
    throw new Error('manual zone heatmap should use real saved delivery zones');
  }
  if (!harness.elements.get('zoneHeatmapExplanation').textContent.includes('GPS-free')) {
    throw new Error('zone heatmap should clearly explain that it does not use GPS');
  }
  if (!harness.elements.get('customZoneList').innerHTML.includes('data-zone-rename') || !harness.elements.get('customZoneList').innerHTML.includes('data-zone-delete')) {
    throw new Error('custom zone list should expose rename and delete actions');
  }

  harness.elements.get('customZoneInput').value = 'Clayton';
  callFirst(harness.elements.get('addCustomZoneBtn'), 'click', {});
  let savedSettings = JSON.parse(harness.storage.get('giglens.settings.v1'));
  if (!savedSettings.customZones.includes('Clayton')) {
    throw new Error('adding a custom zone should persist to settings');
  }

  callFirst(harness.elements.get('customZoneList'), 'click', {
    target: { closest: (selector) => selector === '[data-zone-rename]' ? { dataset: { zoneRename: 'Clayton' } } : null }
  });
  savedSettings = JSON.parse(harness.storage.get('giglens.settings.v1'));
  if (!savedSettings.customZones.includes('Clayton Core')) {
    throw new Error('renaming a custom zone should persist the renamed zone');
  }

  callFirst(harness.elements.get('customZoneList'), 'click', {
    target: { closest: (selector) => selector === '[data-zone-delete]' ? { dataset: { zoneDelete: 'Downtown' } } : null }
  });
  savedSettings = JSON.parse(harness.storage.get('giglens.settings.v1'));
  if (savedSettings.customZones.includes('Downtown')) {
    throw new Error('deleting a custom zone should remove it from settings');
  }
  const savedDeliveries = JSON.parse(harness.storage.get('giglens.deliveries.v1'));
  if (!savedDeliveries.some((delivery) => delivery.zone === 'Downtown')) {
    throw new Error('deleting a custom zone should not corrupt saved delivery zone labels');
  }

  const emptyHarness = createHarness({});
  vm.runInNewContext(appCode, emptyHarness.context, { filename: 'app.js' });
  if (!emptyHarness.elements.get('zoneHeatmapGrid').className.includes('empty')) {
    throw new Error('manual zone heatmap should render a clear empty state without zone data');
  }

  console.log('phase 18 manual zone heatmap cases passed');
}



function runPrivacyDataControlSmoke() {
  const seedDeliveries = [
    { id: 'privacy-1', company: 'DoorDash', earnings: 20, miles: 5, minutes: 30, zone: 'South City', source: 'manual', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 7 }
  ];
  const baseStorage = {
    'giglens.deliveries.v1': JSON.stringify(seedDeliveries),
    'giglens.settings.v1': JSON.stringify({ dailyGoal: 225, defaultCompany: 'Uber Eats', customZones: ['South City'] }),
    'giglens.shift.v1': JSON.stringify({ active: false, startedAt: null, endedAt: null, shiftHistory: [] })
  };

  const exportHarness = createHarness(baseStorage);
  vm.runInNewContext(appCode, exportHarness.context, { filename: 'app.js' });
  for (const id of ['privacyCenter', 'privacyDataLocation', 'storageUsageEstimate', 'storageUsageDetails', 'privacyExportAllBtn', 'privacyRestoreSafetyBtn', 'resetSettingsBtn', 'resetDeliveriesBtn', 'clearAllDataBtn']) {
    if (!exportHarness.elements.get(id)) throw new Error(`privacy center element missing: ${id}`);
  }
  if (!html.includes('localStorage') || !html.includes('There is no account')) {
    throw new Error('privacy center should explain that GigLens data is local-only');
  }
  if (!exportHarness.elements.get('storageUsageEstimate').innerHTML.includes('estimated GigLens localStorage usage')) {
    throw new Error('privacy center should show a localStorage usage estimate');
  }
  callFirst(exportHarness.elements.get('privacyExportAllBtn'), 'click', {});
  if (!exportHarness.storage.get('giglens.lastBackup.v1') || exportHarness.downloads.length < 1) {
    throw new Error('Export All Data should save a last-backup snapshot and download JSON');
  }

  const resetDeliveriesHarness = createHarness(baseStorage, { prompt: () => 'RESET' });
  vm.runInNewContext(appCode, resetDeliveriesHarness.context, { filename: 'app.js' });
  callFirst(resetDeliveriesHarness.elements.get('resetDeliveriesBtn'), 'click', {});
  const resetDeliveries = JSON.parse(resetDeliveriesHarness.storage.get('giglens.deliveries.v1'));
  const keptSettings = JSON.parse(resetDeliveriesHarness.storage.get('giglens.settings.v1'));
  if (resetDeliveries.length !== 0 || keptSettings.dailyGoal !== 225 || !resetDeliveriesHarness.storage.get('giglens.lastBackup.v1')) {
    throw new Error('Reset Deliveries Only should clear deliveries, keep settings, and store an emergency backup');
  }

  const resetSettingsHarness = createHarness(baseStorage, { prompt: () => 'RESET' });
  vm.runInNewContext(appCode, resetSettingsHarness.context, { filename: 'app.js' });
  callFirst(resetSettingsHarness.elements.get('resetSettingsBtn'), 'click', {});
  const resetSettings = JSON.parse(resetSettingsHarness.storage.get('giglens.settings.v1'));
  const keptDeliveries = JSON.parse(resetSettingsHarness.storage.get('giglens.deliveries.v1'));
  if (resetSettings.dailyGoal !== 200 || resetSettings.defaultCompany !== 'DoorDash' || keptDeliveries.length !== 1) {
    throw new Error('Reset Settings Only should restore defaults while keeping deliveries');
  }

  const clearHarness = createHarness(baseStorage, { prompt: () => 'DELETE' });
  vm.runInNewContext(appCode, clearHarness.context, { filename: 'app.js' });
  callFirst(clearHarness.elements.get('clearAllDataBtn'), 'click', {});
  const clearedDeliveries = JSON.parse(clearHarness.storage.get('giglens.deliveries.v1'));
  const clearedSettings = JSON.parse(clearHarness.storage.get('giglens.settings.v1'));
  const clearedShift = JSON.parse(clearHarness.storage.get('giglens.shift.v1'));
  if (clearedDeliveries.length !== 0 || clearedSettings.dailyGoal !== 200 || clearedShift.active) {
    throw new Error('Clear All Local Data should reset deliveries, settings, and shift state');
  }
  callFirst(clearHarness.elements.get('privacyRestoreSafetyBtn'), 'click', {});
  const restoredDeliveries = JSON.parse(clearHarness.storage.get('giglens.deliveries.v1'));
  if (restoredDeliveries.length !== 1 || restoredDeliveries[0].id !== 'privacy-1') {
    throw new Error('Emergency Restore Last Backup should restore the pre-clear snapshot');
  }

  const canceledHarness = createHarness(baseStorage, { prompt: () => 'WRONG' });
  vm.runInNewContext(appCode, canceledHarness.context, { filename: 'app.js' });
  callFirst(canceledHarness.elements.get('clearAllDataBtn'), 'click', {});
  const canceledDeliveries = JSON.parse(canceledHarness.storage.get('giglens.deliveries.v1'));
  if (canceledDeliveries.length !== 1 || !canceledHarness.elements.get('toast').textContent.includes('canceled')) {
    throw new Error('dangerous privacy actions should require the second typed confirmation');
  }

  console.log('phase 19 privacy and data control cases passed');
}

function runNetlifyReleasePackageSmoke() {
  const redirectsPath = path.join(root, '_redirects');
  const deploymentPath = path.join(root, 'DEPLOYMENT.md');
  if (!fs.existsSync(redirectsPath)) throw new Error('Netlify _redirects file is missing');
  if (!fs.existsSync(deploymentPath)) throw new Error('DEPLOYMENT.md is missing');
  const redirects = fs.readFileSync(redirectsPath, 'utf8');
  if (!redirects.includes('/*') || !redirects.includes('/index.html') || !redirects.includes('200')) {
    throw new Error('Netlify _redirects should provide a static fallback to index.html');
  }
  const deployment = fs.readFileSync(deploymentPath, 'utf8');
  for (const token of ['Netlify Drop deployment', 'GitHub Pages deployment', 'iPhone install checklist', 'iPad install checklist', 'Offline reload checklist', 'Local data persistence checklist', 'Troubleshooting']) {
    if (!deployment.includes(token)) throw new Error(`DEPLOYMENT.md missing ${token}`);
  }
  for (const rel of ['index.html', 'styles.css', 'app.js', 'manifest.json', 'service-worker.js', '_redirects', '.nojekyll', '404.html', 'DEPLOYMENT.md', 'icons/giglens-icon-180.png', 'icons/giglens-icon-180-v401.png', 'icons/giglens-icon-192-v401.png', 'icons/giglens-icon-512-v401.png', 'icons/giglens-icon-1024-v401.png', 'apple-touch-icon.png', 'favicon.png']) {
    if (!fs.existsSync(path.join(root, rel))) throw new Error(`Netlify release package missing root asset ${rel}`);
  }
  const runtimeText = ['index.html', 'styles.css', 'app.js', 'manifest.json', 'service-worker.js', '_redirects', '404.html']
    .map((rel) => fs.readFileSync(path.join(root, rel), 'utf8'))
    .join('\n');
  if (/https?:\/\/(localhost|127\.0\.0\.1)/.test(runtimeText)) {
    throw new Error('runtime package should not contain absolute localhost-only paths');
  }
  if (!fs.readFileSync(path.join(root, 'README.md'), 'utf8').includes('DEPLOYMENT.md')) {
    throw new Error('README should point users to DEPLOYMENT.md');
  }
  if (!fs.readFileSync(path.join(root, 'index.html'), 'utf8').includes('Designed by Tech Phactory Solutions')) {
    throw new Error('visible Tech Phactory Solutions branding is missing');
  }
  if (!fs.readFileSync(path.join(root, '404.html'), 'utf8').includes('Designed by Tech Phactory Solutions')) {
    throw new Error('GitHub Pages fallback should include app branding');
  }
  console.log('phase 20 Netlify release package cases passed; GitHub Pages package cases passed');
}

async function runQuickScreenshotAddSmoke() {
  const sampleText = 'DoorDash\nPickup\nSeoul Taco\n6665 Delmar Blvd\nGuaranteed $9.75\nDistance 3.1 miles\n18 min';
  const harness = createHarness({}, {
    Tesseract: { recognize: async () => ({ data: { text: sampleText } }) }
  });
  vm.runInNewContext(appCode, harness.context, { filename: 'app.js' });

  callFirst(harness.elements.get('quickAddOpenBtn'), 'click', {});
  await callFirst(harness.elements.get('quickScreenshotInput'), 'change', { target: { files: [{ name: 'quick-doordash.png' }] } });
  if (!harness.elements.get('quickScanStatus').textContent.includes('Seoul Taco')) {
    throw new Error(`quick screenshot scan should report detected merchant: ${harness.elements.get('quickScanStatus').textContent}`);
  }
  if (harness.elements.get('quickCompanyInput').value !== 'DoorDash') throw new Error('quick screenshot did not populate platform');
  if (harness.elements.get('quickMerchantInput').value !== 'Seoul Taco') throw new Error('quick screenshot did not populate restaurant/store');
  if (harness.elements.get('quickEarningsInput').value !== '9.75') throw new Error('quick screenshot did not populate earnings');
  if (harness.elements.get('quickMilesInput').value !== '3.1') throw new Error('quick screenshot did not populate miles');
  if (harness.elements.get('quickMinutesInput').value !== '18') throw new Error('quick screenshot did not populate minutes');
  if (!harness.elements.get('quickDeliveryPreview').textContent.includes('Seoul Taco') || !harness.elements.get('quickDeliveryPreview').textContent.includes('scanned')) {
    throw new Error('quick screenshot preview should include merchant and scanned source');
  }
  callFirst(harness.elements.get('quickAddForm'), 'submit', { preventDefault() {} });
  const saved = JSON.parse(harness.storage.get('giglens.deliveries.v1') || '[]');
  const ocrDelivery = saved.find((d) => d.source === 'ocr' && d.merchant === 'Seoul Taco');
  if (!ocrDelivery || !ocrDelivery.ocrText.includes('Seoul Taco') || ocrDelivery.ocrConfidence <= 0) {
    throw new Error('quick screenshot flow did not persist an OCR delivery with restaurant and OCR metadata');
  }

  const offlineHarness = createHarness({}, { navigator: { onLine: false } });
  vm.runInNewContext(appCode, offlineHarness.context, { filename: 'app.js' });
  callFirst(offlineHarness.elements.get('quickAddOpenBtn'), 'click', {});
  await callFirst(offlineHarness.elements.get('quickScreenshotInput'), 'change', { target: { files: [{ name: 'offline.png' }] } });
  if (!offlineHarness.elements.get('quickScanStatus').textContent.includes('OCR library is not loaded yet')) {
    throw new Error('quick screenshot unavailable OCR should not crash and should show a clear message');
  }
  console.log('4.0.1 GigLens repair cases passed');
}


function runFixedOverlayPositionSmoke() {
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  for (const token of ['.toast { position: fixed', '.quick-add-sheet { position: fixed', '.bottom-tabs { position: fixed', '.skip-link { position: fixed', '.mobile-action-dock { position: fixed']) {
    if (!css.includes(token)) throw new Error(`fixed overlay safety token missing: ${token}`);
  }
  if (css.includes('.app-shell,\n.toast,\n.quick-add-sheet,\n.bottom-tabs,\n.mobile-action-dock,\n.skip-link { position: relative')) {
    throw new Error('modern UI refresh demoted fixed overlays to relative positioning');
  }
  console.log('fixed overlay position safety cases passed');
}



function runPublicSecretScanSmoke() {
  const patterns = [
    /sk-[A-Za-z0-9_\-]{20,}/,
    /(ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{20,}/,
    /AKIA[0-9A-Z]{16}/,
    /AIza[0-9A-Za-z_\-]{20,}/,
    /sk_live_[0-9A-Za-z]{20,}/,
    /SG\.[A-Za-z0-9_\-]{16,}\.[A-Za-z0-9_\-]{16,}/,
    /xox[baprs]-[A-Za-z0-9\-]{20,}/,
    /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
  ];
  for (const rel of ['index.html', 'app.js', 'styles.css', 'manifest.json', 'service-worker.js', '404.html', 'package.json', 'README.md', 'AUDIT_REPORT.md', 'CHANGELOG.md', 'DEPLOYMENT.md', 'SECURITY_AUDIT.md', 'CLAUDE_REVIEW_AUDIT.md']) {
    const text = fs.readFileSync(path.join(root, rel), 'utf8');
    for (const pattern of patterns) {
      if (pattern.test(text)) throw new Error(`possible exposed secret in ${rel}`);
    }
  }
  console.log('public secret scan cases passed');
}


async function main() {
  runStartup({
    'giglens.deliveries.v1': '{"not":"an array"}',
    'giglens.settings.v1': '{"dailyGoal":"bad","defaultCompany":"Unknown","gasPrice":"NaN"}',
    'giglens.shift.v1': '{"active":true,"startedAt":"not a date"}'
  });
  runClipboardUnavailableSmoke();
  runMigrationSmoke();
  runHistoryEditingSmoke();
  runAnalyticsEmptySmoke();
  await runExportCenterSmoke();
  await runBackupSafetySmoke();
  await runDecisionAssistantSmoke();
  await runOCRReviewSmoke();
  await runQuickScreenshotAddSmoke();
  await runDriverRecapSmoke();
  runMobilePolishSmoke();
  runPwaOfflinePolishSmoke();
  runSmartGoalSmoke();
  runBestTimeInsightsSmoke();
  runZoneHeatmapSmoke();
  runPrivacyDataControlSmoke();
  runNetlifyReleasePackageSmoke();
  runFixedOverlayPositionSmoke();
  runPublicSecretScanSmoke();
  console.log('GigLens startup smoke test passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
