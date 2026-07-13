(() => {
  const STORE_KEY = "giglens.deliveries.v1";
  const DECISIONS_KEY = "giglens.decisions.v1";
  const SETTINGS_KEY = "giglens.settings.v1";
  const SHIFT_KEY = "giglens.shift.v1";
  const ROLLBACK_KEY = "giglens.rollback.v1";
  const LAST_BACKUP_KEY = "giglens.lastBackup.v1";
  const OCR_LEARNING_KEY = "giglens.ocrLearning.v1";
  const LEGACY_KEYS = {
    [STORE_KEY]: "driveledger.deliveries.v1",
    [DECISIONS_KEY]: "driveledger.decisions.v1",
    [SETTINGS_KEY]: "driveledger.settings.v1",
    [SHIFT_KEY]: "driveledger.shift.v1",
    [ROLLBACK_KEY]: "driveledger.rollback.v1",
    [LAST_BACKUP_KEY]: "driveledger.lastBackup.v1"
  };
  const DATA_VERSION = 16;
  const BACKUP_VERSION = 17;
  const OCR_LEARNING_VERSION = 1;
  const OCR_LEARNING_LIMIT = 120;
  const OCR_INIT_TIMEOUT_MS = 20000;
  const OCR_RECOGNIZE_TIMEOUT_MS = 45000;
  const OCR_TERMINATE_TIMEOUT_MS = 3000;
  const OCR_LIBRARY_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
  const OCR_LIBRARY_INTEGRITY = "sha384-GJqSu7vueQ9qN0E9yLPb3Wtpd7OrgK8KmYzC8T1IysG1bcvxvIO4qtYR/D3A991F";
  const MAX_SCREENSHOT_BYTES = 20 * 1024 * 1024;
  const HISTORY_PAGE_DAYS = 30;
  const STANDARD_MILEAGE_RATES = Object.freeze([
    { start: "2026-07-01", end: "2026-12-31", rate: 0.76 },
    { start: "2026-01-01", end: "2026-06-30", rate: 0.725 },
    { start: "2025-01-01", end: "2025-12-31", rate: 0.70 },
    { start: "2024-01-01", end: "2024-12-31", rate: 0.67 }
  ]);

  function migrateLegacyStorage() {
    for (const [nextKey, legacyKey] of Object.entries(LEGACY_KEYS)) {
      try {
        if (localStorage.getItem(nextKey) == null && localStorage.getItem(legacyKey) != null) {
          localStorage.setItem(nextKey, localStorage.getItem(legacyKey));
        }
      } catch (error) {
        console.warn("GigLens storage migration skipped", error);
      }
    }
  }

  migrateLegacyStorage();

  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  const $ = (id) => document.getElementById(id);

  const allowedCompanies = new Set([
    "DoorDash",
    "Uber Eats",
    "Grubhub",
    "Catering",
    "Instacart",
    "Amazon Flex",
    "Spark",
    "Roadie",
    "Other"
  ]);

  const validSources = new Set(["manual", "ocr", "calculator", "import"]);
  const validTimestampSources = new Set(["ocr", "file", "manual", "saved", "import"]);
  const OCR_LEARNING_TOKEN_ALLOWLIST = new Set([
    "doordash", "dasher", "dash", "uber", "eats", "trip", "radar", "exclusive", "grubhub", "diner",
    "instacart", "shopper", "batch", "spark", "walmart", "roadie", "gig", "amazon", "flex", "block",
    "catering", "ezcater", "offer", "accept", "decline", "guaranteed", "deliver", "delivery", "pickup",
    "dropoff", "customer", "total", "estimated", "miles", "mile", "minutes", "minute", "mins", "min",
    "pay", "payout", "earnings", "restaurant", "store", "merchant", "items", "route", "curbside", "round",
    "robin", "red", "card", "peak", "request", "supplement", "partner", "shop", "replacement", "same", "day"
  ]);
  const OCR_PLATFORM_DISTINCTIVE_TOKENS = Object.freeze({
    "DoorDash": new Set(["doordash", "dasher", "dash", "red", "card", "peak"]),
    "Uber Eats": new Set(["uber", "eats", "trip", "radar", "exclusive", "supplement", "partner"]),
    "Grubhub": new Set(["grubhub", "diner"]),
    "Instacart": new Set(["instacart", "shopper", "batch", "replacement"]),
    "Amazon Flex": new Set(["amazon", "flex"]),
    "Spark": new Set(["spark", "walmart", "curbside", "robin"]),
    "Roadie": new Set(["roadie"]),
    "Catering": new Set(["ezcater", "catering"])
  });
  const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const defaultSettings = {
    dailyGoal: 200,
    defaultCompany: "DoorDash",
    defaultZone: "",
    customZones: [],
    gasPrice: 3.5,
    vehicleMpg: 25,
    maintenanceCostPerMile: 0.12,
    mileageDeductionMode: "automatic",
    mileageDeductionRate: 0.76,
    minimumDollarPerMile: 1.5,
    minimumDollarPerHour: 20,
    minimumPayout: 7,
    maxMiles: 12,
    theme: "system",
    appDataVersion: DATA_VERSION
  };

  let deliveries = normalizeDeliveries(readJSON(STORE_KEY, []));
  let decisions = normalizeDecisions(readJSON(DECISIONS_KEY, []));
  let settings = normalizeSettings(readJSON(SETTINGS_KEY, {}));
  let shift = normalizeShift(readJSON(SHIFT_KEY, { active: false, startedAt: null, endedAt: null }));
  let ocrLearning = normalizeOCRLearning(readJSON(OCR_LEARNING_KEY, null));
  let lastOCRText = "";
  let lastOCRParsed = null;
  let quickOCRText = "";
  let quickOCRParsed = null;
  let lastDayKey = todayKey();
  let toastTimer = null;
  let lastDeleted = null;
  let pendingImport = null;
  let toastAction = null;
  let ocrLibraryPromise = null;
  let quickScanGeneration = 0;
  let fullScanGeneration = 0;
  let historyDayLimit = HISTORY_PAGE_DAYS;
  let calendarCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let selectedCalendarDay = todayKey();

  const els = {
    todayHero: $("todayHero"),
    todayEarned: $("todayEarned"),
    profitLine: $("profitLine"),
    goalPercent: $("goalPercent"),
    goalBar: $("goalBar"),
    goalText: $("goalText"),
    goalRemaining: $("goalRemaining"),
    shiftStatus: $("shiftStatus"),
    heroStatusLabel: $("heroStatusLabel"),
    heroShiftBtn: $("heroShiftBtn"),
    paceCard: $("paceCard"),
    paceStatus: $("paceStatus"),
    paceRecommendation: $("paceRecommendation"),
    projectedTotal: $("projectedTotal"),
    goalEta: $("goalEta"),
    efficiencyCard: $("efficiencyCard"),
    efficiencyStatus: $("efficiencyStatus"),
    efficiencyRecommendation: $("efficiencyRecommendation"),
    profitToday: $("profitToday"),
    profitHour: $("profitHour"),
    avgHour: $("avgHour"),
    avgMile: $("avgMile"),
    profitMile: $("profitMile"),
    avgDeliveryValue: $("avgDeliveryValue"),
    taxCard: $("taxCard"),
    taxDeduction: $("taxDeduction"),
    taxRateLabel: $("taxRateLabel"),
    taxMiles: $("taxMiles"),
    vehicleCostToday: $("vehicleCostToday"),
    taxRecommendation: $("taxRecommendation"),
    ordersCount: $("ordersCount"),
    milesToday: $("milesToday"),
    performanceCard: $("performanceCard"),
    bestCompanyToday: $("bestCompanyToday"),
    worstCompanyToday: $("worstCompanyToday"),
    bestZoneToday: $("bestZoneToday"),
    worstZoneToday: $("worstZoneToday"),
    performanceRecommendation: $("performanceRecommendation"),
    decisionsToday: $("decisionsToday"),
    timeWorking: $("timeWorking"),
    driverScore: $("driverScore"),
    driverScoreTitle: $("driverScoreTitle"),
    driverScoreDetail: $("driverScoreDetail"),
    trendTitle: $("trendTitle"),
    trendDetail: $("trendDetail"),
    trendCard: document.querySelector(".trend-card"),
    dailyRecapCard: $("dailyRecapCard"),
    recapStatus: $("recapStatus"),
    recapMetrics: $("recapMetrics"),
    dailySummary: $("dailySummary"),
    recapRecommendation: $("recapRecommendation"),
    shiftHistoryList: $("shiftHistoryList"),
    companyBreakdown: $("companyBreakdown"),
    zoneBreakdown: $("zoneBreakdown"),
    analyticsBestCompany: $("analyticsBestCompany"),
    analyticsWorstCompany: $("analyticsWorstCompany"),
    analyticsBestZone: $("analyticsBestZone"),
    analyticsWorstZone: $("analyticsWorstZone"),
    analyticsBestHourToday: $("analyticsBestHourToday"),
    analyticsWeeklyBestHour: $("analyticsWeeklyBestHour"),
    bestTimeCard: $("bestTimeCard"),
    bestTimeStatus: $("bestTimeStatus"),
    bestTimeExplanation: $("bestTimeExplanation"),
    bestHoursToday: $("bestHoursToday"),
    bestHistoricalHours: $("bestHistoricalHours"),
    weakHoursList: $("weakHoursList"),
    analyticsCompanyBreakdown: $("analyticsCompanyBreakdown"),
    analyticsZoneBreakdown: $("analyticsZoneBreakdown"),
    analyticsHourlyBreakdown: $("analyticsHourlyBreakdown"),
    historyList: $("historyList"),
    calendarGrid: $("calendarGrid"),
    calendarMonthLabel: $("calendarMonthLabel"),
    calendarSelectedLabel: $("calendarSelectedLabel"),
    calendarDaySummary: $("calendarDaySummary"),
    calendarDayList: $("calendarDayList"),
    calendarWorkNote: $("calendarWorkNote"),
    calendarPrevBtn: $("calendarPrevBtn"),
    calendarNextBtn: $("calendarNextBtn"),
    calendarTodayBtn: $("calendarTodayBtn"),
    calendarAddBtn: $("calendarAddBtn"),
    smartGoalCard: $("smartGoalCard"),
    smartGoalStatus: $("smartGoalStatus"),
    smartGoalSuggestion: $("smartGoalSuggestion"),
    smartGoalStats: $("smartGoalStats"),
    smartGoalExplanation: $("smartGoalExplanation"),
    applySmartGoalBtn: $("applySmartGoalBtn"),
    ignoreSmartGoalBtn: $("ignoreSmartGoalBtn"),
    goalInput: $("goalInput"),
    defaultCompanyInput: $("defaultCompanyInput"),
    gasPriceInput: $("gasPriceInput"),
    mpgInput: $("mpgInput"),
    maintenanceInput: $("maintenanceInput"),
    taxRateModeInput: $("taxRateModeInput"),
    taxRateInput: $("taxRateInput"),
    taxRateHelp: $("taxRateHelp"),
    minPerMileInput: $("minPerMileInput"),
    minPerHourInput: $("minPerHourInput"),
    minPayoutInput: $("minPayoutInput"),
    maxMilesInput: $("maxMilesInput"),
    defaultZoneInput: $("defaultZoneInput"),
    zoneOptions: $("zoneOptions"),
    customZoneInput: $("customZoneInput"),
    addCustomZoneBtn: $("addCustomZoneBtn"),
    customZoneList: $("customZoneList"),
    zoneHeatmapCard: $("zoneHeatmapCard"),
    zoneHeatmapStatus: $("zoneHeatmapStatus"),
    zoneHeatmapExplanation: $("zoneHeatmapExplanation"),
    zoneHeatmapGrid: $("zoneHeatmapGrid"),
    editDeliveryId: $("editDeliveryId"),
    companyInput: $("companyInput"),
    earningsInput: $("earningsInput"),
    milesInput: $("milesInput"),
    minutesInput: $("minutesInput"),
    zoneInput: $("zoneInput"),
    merchantInput: $("merchantInput"),
    notesInput: $("notesInput"),
    deliveryDateInput: $("deliveryDateInput"),
    deliveryTimeInput: $("deliveryTimeInput"),
    quickAddOpenBtn: $("quickAddOpenBtn"),
    quickAddSheet: $("quickAddSheet"),
    quickAddForm: $("quickAddForm"),
    quickCancelBtn: $("quickCancelBtn"),
    quickScreenshotInput: $("quickScreenshotInput"),
    quickScanStatus: $("quickScanStatus"),
    quickPreviewImage: $("quickPreviewImage"),
    quickOcrDetails: $("quickOcrDetails"),
    quickOcrText: $("quickOcrText"),
    quickLearningHint: $("quickLearningHint"),
    quickClearScanBtn: $("quickClearScanBtn"),
    quickManualDetails: $("quickManualDetails"),
    quickCompanyInput: $("quickCompanyInput"),
    quickMerchantInput: $("quickMerchantInput"),
    quickEarningsInput: $("quickEarningsInput"),
    quickMilesInput: $("quickMilesInput"),
    quickMinutesInput: $("quickMinutesInput"),
    quickZoneInput: $("quickZoneInput"),
    quickDateInput: $("quickDateInput"),
    quickTimeInput: $("quickTimeInput"),
    quickNotesDetails: $("quickNotesDetails"),
    quickNotesInput: $("quickNotesInput"),
    quickDeliveryPreview: $("quickDeliveryPreview"),
    quickSaveBtn: $("quickSaveBtn"),
    quickSaveAnotherBtn: $("quickSaveAnotherBtn"),
    deliveryPreview: $("deliveryPreview"),
    saveDeliveryBtn: $("saveDeliveryBtn"),
    saveAddAnotherBtn: $("saveAddAnotherBtn"),
    cancelEditBtn: $("cancelEditBtn"),
    screenshotInput: $("screenshotInput"),
    previewImage: $("previewImage"),
    scanStatus: $("scanStatus"),
    ocrReview: $("ocrReview"),
    ocrCompany: $("ocrCompany"),
    ocrMerchant: $("ocrMerchant"),
    ocrMerchantLabel: $("ocrMerchantLabel"),
    ocrEarnings: $("ocrEarnings"),
    ocrMiles: $("ocrMiles"),
    ocrMinutes: $("ocrMinutes"),
    ocrTimestamp: $("ocrTimestamp"),
    ocrConfidence: $("ocrConfidence"),
    ocrConfidenceLabel: $("ocrConfidenceLabel"),
    ocrCompanyInput: $("ocrCompanyInput"),
    ocrMerchantInput: $("ocrMerchantInput"),
    ocrEarningsInput: $("ocrEarningsInput"),
    ocrMilesInput: $("ocrMilesInput"),
    ocrMinutesInput: $("ocrMinutesInput"),
    ocrDateInput: $("ocrDateInput"),
    ocrTimeInput: $("ocrTimeInput"),
    ocrSavePreview: $("ocrSavePreview"),
    saveOcrBtn: $("saveOcrBtn"),
    applyOcrBtn: $("applyOcrBtn"),
    cancelOcrBtn: $("cancelOcrBtn"),
    clearOcrBtn: $("clearOcrBtn"),
    ocrDetails: $("ocrDetails"),
    ocrText: $("ocrText"),
    ocrLearningHint: $("ocrLearningHint"),
    offerPayInput: $("offerPayInput"),
    offerMilesInput: $("offerMilesInput"),
    offerMinutesInput: $("offerMinutesInput"),
    offerCompanyInput: $("offerCompanyInput"),
    offerZoneInput: $("offerZoneInput"),
    offerNoteInput: $("offerNoteInput"),
    decisionResult: $("decisionResult"),
    calculateOfferBtn: $("calculateOfferBtn"),
    logDecisionBtn: $("logDecisionBtn"),
    clearOfferBtn: $("clearOfferBtn"),
    copyDecisionBtn: $("copyDecisionBtn"),
    saveOfferAsDeliveryBtn: $("saveOfferAsDeliveryBtn"),
    decisionLogStatus: $("decisionLogStatus"),
    decisionLogSummary: $("decisionLogSummary"),
    decisionLogMetrics: $("decisionLogMetrics"),
    decisionLogList: $("decisionLogList"),
    exportDecisionsBtn: $("exportDecisionsBtn"),
    shiftBtn: $("shiftBtn"),
    pauseShiftBtn: $("pauseShiftBtn"),
    exportBtn: $("exportBtn"),
    exportTaxBtn: $("exportTaxBtn"),
    exportDailyBtn: $("exportDailyBtn"),
    backupBtn: $("backupBtn"),
    restoreRollbackBtn: $("restoreRollbackBtn"),
    importInput: $("importInput"),
    importPreview: $("importPreview"),
    importPreviewStatus: $("importPreviewStatus"),
    importPreviewMeta: $("importPreviewMeta"),
    importModeInput: $("importModeInput"),
    importModeHelp: $("importModeHelp"),
    confirmImportBtn: $("confirmImportBtn"),
    cancelImportBtn: $("cancelImportBtn"),
    privacyCenter: $("privacyCenter"),
    privacyStorageStatus: $("privacyStorageStatus"),
    privacyDataLocation: $("privacyDataLocation"),
    storageUsageEstimate: $("storageUsageEstimate"),
    storageUsageDetails: $("storageUsageDetails"),
    privacyExportAllBtn: $("privacyExportAllBtn"),
    privacyRestoreSafetyBtn: $("privacyRestoreSafetyBtn"),
    ocrLearningStatus: $("ocrLearningStatus"),
    resetOcrLearningBtn: $("resetOcrLearningBtn"),
    resetSettingsBtn: $("resetSettingsBtn"),
    resetDeliveriesBtn: $("resetDeliveriesBtn"),
    clearAllDataBtn: $("clearAllDataBtn"),
    copySummaryBtn: $("copySummaryBtn"),
    saveSettingsBtn: $("saveSettingsBtn"),
    clearTodayBtn: $("clearTodayBtn"),
    toast: $("toast"),
    offlineBanner: $("offlineBanner")
  };

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      toast("Could not save. Device storage may be full or blocked.");
    }
  }

  function persistNormalizedState() {
    writeJSON(STORE_KEY, deliveries);
    writeJSON(DECISIONS_KEY, decisions);
    writeJSON(SETTINGS_KEY, settings);
    writeJSON(SHIFT_KEY, shift);
    writeJSON(OCR_LEARNING_KEY, ocrLearning);
  }

  function normalizeComparableText(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function ocrTextSignature(text) {
    const normalized = normalizeComparableText(text);
    let hash = 2166136261;
    for (let i = 0; i < normalized.length; i += 1) {
      hash ^= normalized.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function learningFingerprintTokens(text) {
    const tokens = normalizeComparableText(text).split(" ").filter(Boolean);
    return [...new Set(tokens.filter((token) => OCR_LEARNING_TOKEN_ALLOWLIST.has(token)))].sort().slice(0, 48);
  }

  function sharedTokenCount(left, right) {
    const b = new Set(right || []);
    return (left || []).reduce((count, token) => count + (b.has(token) ? 1 : 0), 0);
  }

  function tokenSimilarity(left, right) {
    const a = new Set(left || []);
    const b = new Set(right || []);
    if (!a.size || !b.size) return 0;
    let shared = 0;
    a.forEach((token) => { if (b.has(token)) shared += 1; });
    return shared / (a.size + b.size - shared);
  }

  function hasSharedPlatformEvidence(left, right, platform) {
    const distinctive = OCR_PLATFORM_DISTINCTIVE_TOKENS[platform];
    if (!distinctive) return false;
    const rightTokens = new Set(right || []);
    return (left || []).some((token) => distinctive.has(token) && rightTokens.has(token));
  }

  function normalizeCorrectionSide(value = {}) {
    const platform = allowedCompanies.has(value.platform || value.company) ? (value.platform || value.company) : "Other";
    return {
      platform,
      merchant: cleanText(value.merchant || value.restaurant || "", 120),
      merchantType: ["restaurant", "store", "merchant"].includes(value.merchantType) ? value.merchantType : "merchant",
      earnings: bounded(value.earnings, 0, 10000, 0, 2),
      miles: bounded(value.miles, 0, 1000, 0, 1),
      minutes: bounded(value.minutes, 0, 600, 0, 0)
    };
  }

  function normalizeOCRLearning(value) {
    const rawCorrections = Array.isArray(value?.corrections) ? value.corrections : [];
    const corrections = rawCorrections.map((item) => {
      if (!item || typeof item !== "object") return null;
      const fingerprint = Array.isArray(item.fingerprint)
        ? [...new Set(item.fingerprint.map((token) => normalizeComparableText(token)).filter(Boolean))].slice(0, 48)
        : [];
      const numericHints = {};
      for (const kind of ["earnings", "miles", "minutes"]) {
        numericHints[kind] = Array.isArray(item.numericHints?.[kind])
          ? [...new Set(item.numericHints[kind].map((token) => normalizeComparableText(token)).filter(Boolean))].slice(0, 20)
          : [];
      }
      return {
        id: cleanText(item.id || `learn-${Math.random().toString(36).slice(2)}`, 80),
        createdAt: Number.isNaN(new Date(item.createdAt).getTime()) ? new Date().toISOString() : new Date(item.createdAt).toISOString(),
        source: item.source === "quick" ? "quick" : "review",
        signature: cleanText(item.signature || "", 32),
        fingerprint,
        original: normalizeCorrectionSide(item.original),
        corrected: normalizeCorrectionSide(item.corrected),
        changedFields: Array.isArray(item.changedFields) ? item.changedFields.filter((field) => ["platform", "merchant", "earnings", "miles", "minutes"].includes(field)) : [],
        numericHints,
        confirmations: Math.max(1, Math.min(25, Math.round(num(item.confirmations) || 1)))
      };
    }).filter(Boolean).slice(-OCR_LEARNING_LIMIT);
    return { version: OCR_LEARNING_VERSION, corrections };
  }

  function buildNumericLearningHint(text, value, kind) {
    if (!Number.isFinite(Number(value)) || Number(value) <= 0) return [];
    const source = String(text || "");
    const variants = kind === "earnings"
      ? [Number(value).toFixed(2), Number(value).toFixed(2).replace(".", ",")]
      : kind === "miles"
        ? [String(round1(value)), Number(value).toFixed(1)]
        : [String(Math.round(value))];
    let index = -1;
    for (const variant of variants) {
      index = source.toLowerCase().indexOf(variant.toLowerCase());
      if (index >= 0) break;
    }
    if (index < 0) return [];
    const context = source.slice(Math.max(0, index - 90), Math.min(source.length, index + 110));
    return learningFingerprintTokens(context);
  }

  function learnedNumericContextBoost(kind, context) {
    const current = learningFingerprintTokens(context);
    if (!current.length) return 0;
    let best = 0;
    for (const correction of ocrLearning.corrections.slice(-80)) {
      const hint = correction.numericHints?.[kind] || [];
      if (!hint.length) continue;
      const similarity = tokenSimilarity(current, hint);
      if (similarity >= 0.3) best = Math.max(best, similarity * 4.5);
    }
    return best;
  }

  function correctionChangedFields(original, corrected) {
    const fields = [];
    if (original.platform !== corrected.platform) fields.push("platform");
    if (normalizeComparableText(original.merchant) !== normalizeComparableText(corrected.merchant)) fields.push("merchant");
    if (Math.abs(original.earnings - corrected.earnings) >= 0.01) fields.push("earnings");
    if (Math.abs(original.miles - corrected.miles) >= 0.05) fields.push("miles");
    if (Math.abs(original.minutes - corrected.minutes) >= 1) fields.push("minutes");
    return fields;
  }

  function recordOCRCorrection(parsed, reviewed, rawText, source = "review") {
    if (!parsed || !reviewed || !String(rawText || "").trim()) return { saved: false, changedFields: [] };
    const original = normalizeCorrectionSide({
      platform: parsed.platform || "Other",
      merchant: parsed.merchant,
      merchantType: parsed.merchantType,
      earnings: parsed.earnings,
      miles: parsed.miles,
      minutes: parsed.minutes
    });
    const corrected = normalizeCorrectionSide({
      platform: reviewed.company || reviewed.platform,
      merchant: reviewed.merchant,
      merchantType: reviewed.merchantType || inferMerchantType(reviewed.merchant, rawText),
      earnings: reviewed.earnings,
      miles: reviewed.miles,
      minutes: reviewed.minutes
    });
    const signature = ocrTextSignature(rawText);
    const changedFields = correctionChangedFields(original, corrected);
    const previousIndex = ocrLearning.corrections.findIndex((item) => item.signature === signature);
    const previous = previousIndex >= 0 ? ocrLearning.corrections[previousIndex] : null;
    const correction = {
      id: previous?.id || makeId(),
      createdAt: new Date().toISOString(),
      source: source === "quick" ? "quick" : "review",
      signature,
      fingerprint: learningFingerprintTokens(rawText),
      original,
      corrected,
      changedFields,
      numericHints: {
        earnings: buildNumericLearningHint(rawText, corrected.earnings, "earnings"),
        miles: buildNumericLearningHint(rawText, corrected.miles, "miles"),
        minutes: buildNumericLearningHint(rawText, corrected.minutes, "minutes")
      },
      confirmations: Math.min(25, (previous?.confirmations || 0) + 1)
    };
    if (previousIndex >= 0) ocrLearning.corrections.splice(previousIndex, 1);
    ocrLearning.corrections.push(correction);
    ocrLearning.corrections = ocrLearning.corrections.slice(-OCR_LEARNING_LIMIT);
    writeJSON(OCR_LEARNING_KEY, ocrLearning);
    renderOCRLearningStatus();
    return { saved: true, changedFields };
  }

  function applyOCRLearning(parsed, rawText) {
    const result = { ...parsed, learningApplied: [] };
    const signature = ocrTextSignature(rawText);
    const fingerprint = learningFingerprintTokens(rawText);
    const exact = [...ocrLearning.corrections].reverse().find((item) => item.signature === signature);
    if (exact) {
      result.platform = exact.corrected.platform === "Other" ? "" : exact.corrected.platform;
      result.merchant = exact.corrected.merchant || result.merchant;
      result.restaurant = result.merchant;
      result.merchantType = exact.corrected.merchantType || result.merchantType;
      if (exact.corrected.earnings > 0) result.earnings = exact.corrected.earnings;
      if (exact.corrected.miles >= 0) result.miles = exact.corrected.miles;
      if (exact.corrected.minutes >= 0) result.minutes = exact.corrected.minutes;
      result.platformConfidence = Math.max(result.platformConfidence || 0, 96);
      result.confidence = Math.max(result.confidence || 0, 94);
      result.learningApplied.push("exact correction");
      return result;
    }

    const votes = new Map();
    for (const correction of ocrLearning.corrections.slice(-80)) {
      const similarity = tokenSimilarity(fingerprint, correction.fingerprint);
      const shared = sharedTokenCount(fingerprint, correction.fingerprint);
      const platform = correction.corrected.platform;
      if (!platform || platform === "Other") continue;
      // Never transfer a platform correction from generic words such as
      // "delivery", "pickup", or "accept". At least one app-specific token
      // must be present in both screenshots; exact screenshots are handled above.
      if (similarity < 0.42 || shared < 2 || !hasSharedPlatformEvidence(fingerprint, correction.fingerprint, platform)) continue;
      const correctedPlatformBefore = correction.changedFields.includes("platform");
      const weight = similarity * (1 + Math.min(correction.confirmations, 5) * 0.12) + (correctedPlatformBefore ? 0.35 : 0);
      const current = votes.get(platform) || { score: 0, supporters: 0, bestSimilarity: 0, correctedPlatformBefore: false };
      current.score += weight;
      current.supporters += 1;
      current.bestSimilarity = Math.max(current.bestSimilarity, similarity);
      current.correctedPlatformBefore ||= correctedPlatformBefore;
      votes.set(platform, current);
    }
    const ranked = [...votes.entries()].sort((a, b) => b[1].score - a[1].score);
    if (ranked.length) {
      const [learnedPlatform, learnedVote] = ranked[0];
      const runnerScore = ranked[1]?.[1]?.score || 0;
      const currentWeak = !result.platform || (result.platformConfidence || 0) < 72;
      const strongCorrection = learnedVote.correctedPlatformBefore && learnedVote.bestSimilarity >= 0.72;
      const consensus = learnedVote.supporters >= 2 && learnedVote.score - runnerScore >= 0.3;
      if (learnedPlatform !== result.platform && (currentWeak || strongCorrection || consensus)) {
        result.platform = learnedPlatform;
        result.platformConfidence = Math.max(result.platformConfidence || 0, Math.round(72 + learnedVote.bestSimilarity * 24));
        result.learningApplied.push("learned platform pattern");
      }
    }

    const rawComparable = normalizeComparableText(rawText);
    for (const correction of [...ocrLearning.corrections].reverse()) {
      const originalMerchant = normalizeComparableText(correction.original.merchant);
      const correctedMerchant = correction.corrected.merchant;
      const correctedComparable = normalizeComparableText(correctedMerchant);
      if (!correctedMerchant) continue;
      const currentMerchant = normalizeComparableText(result.merchant);
      const aliasMatch = originalMerchant && currentMerchant === originalMerchant;
      const textMatch = correctedComparable.length >= 4 && rawComparable.includes(correctedComparable);
      if (aliasMatch || textMatch) {
        if (result.merchant !== correctedMerchant) result.learningApplied.push("learned merchant name");
        result.merchant = correctedMerchant;
        result.restaurant = correctedMerchant;
        result.merchantType = correction.corrected.merchantType || result.merchantType;
        break;
      }
    }

    if (result.learningApplied.length) result.confidence = Math.min(98, Math.max(result.confidence || 0, 82));
    return result;
  }

  function mergeOCRLearning(currentValue, importedValue) {
    const current = normalizeOCRLearning(currentValue);
    const imported = normalizeOCRLearning(importedValue);
    const bySignature = new Map();
    [...current.corrections, ...imported.corrections].forEach((item) => {
      const key = item.signature || item.id;
      const previous = bySignature.get(key);
      if (!previous || new Date(item.createdAt) >= new Date(previous.createdAt)) bySignature.set(key, item);
    });
    return normalizeOCRLearning({ version: OCR_LEARNING_VERSION, corrections: [...bySignature.values()].slice(-OCR_LEARNING_LIMIT) });
  }

  function renderOCRLearningStatus() {
    const count = ocrLearning.corrections.length;
    if (els.ocrLearningStatus) {
      els.ocrLearningStatus.textContent = count
        ? `${count} local correction${count === 1 ? "" : "s"} available to improve future scans.`
        : "No corrections learned yet.";
    }
  }

  function resetOCRLearning() {
    if (!ocrLearning.corrections.length) return toast("Scanner learning is already empty.");
    if (!confirm("Reset all locally learned screenshot corrections? Saved deliveries will not be affected.")) return;
    ocrLearning = normalizeOCRLearning(null);
    writeJSON(OCR_LEARNING_KEY, ocrLearning);
    renderOCRLearningStatus();
    toast("Scanner learning reset. Saved deliveries were kept.");
  }

  function normalizeMerchantTypeValue(value, merchant = "", context = "") {
    if (["restaurant", "store", "merchant"].includes(value)) return value;
    const source = `${merchant || ""} ${context || ""}`;
    if (/\b(?:walmart|sam'?s\s*club|schnucks|target|best\s*buy|costco|walgreens|cvs|home\s*depot|lowe'?s|aldi|kroger|publix|meijer|dollar\s*(?:general|tree)|petsmart|petco|sephora|ups\s*store|instacart|spark|amazon\s*flex|store|grocery|market|pharmacy|retail|curbside|items?\s+to\s+shop)\b/i.test(source)) return "store";
    if (/\b(?:mcdonald'?s|taco\s*bell|chick[-\s]*fil[-\s]*a|chipotle|starbucks|subway|panera|wendy'?s|burger\s*king|popeyes|restaurant|cafe|café|grill|kitchen|diner|pizza|taco|burger|chicken|sushi|bakery)\b/i.test(source)) return "restaurant";
    return "merchant";
  }

  function normalizeDeliveries(value) {
    if (!Array.isArray(value)) return [];
    return value.map((item) => normalizeDelivery(item)).filter(Boolean);
  }

  function normalizeDelivery(item) {
    if (!item || typeof item !== "object") return null;
    const earnings = round2(num(item.earnings));
    const miles = round1(num(item.miles));
    const createdRaw = item.createdAt || item.capturedAt || item.screenshotTimestamp || item.date || item.timestamp || new Date().toISOString();
    const createdAt = new Date(createdRaw);
    const capturedRaw = item.capturedAt || item.screenshotTimestamp || createdRaw;
    const capturedAt = validDateValue(capturedRaw) ? new Date(capturedRaw) : createdAt;
    const updatedAt = item.updatedAt && !Number.isNaN(new Date(item.updatedAt).getTime())
      ? new Date(item.updatedAt)
      : createdAt;
    if (!earnings || earnings <= 0 || earnings > 10000) return null;
    if (!Number.isFinite(miles) || miles < 0 || miles > 1000) return null;
    if (Number.isNaN(createdAt.getTime())) return null;
    const company = allowedCompanies.has(item.company) ? item.company : "Other";
    const minutesRaw = num(item.minutes);
    const merchant = cleanText(item.merchant ?? item.restaurant ?? item.store ?? "", 120);
    const notes = cleanText(item.notes ?? item.note ?? "", 500);
    const merchantType = normalizeMerchantTypeValue(item.merchantType, merchant, `${company} ${item.ocrText || ""} ${notes}`);
    const inferredSource = item.ocrText ? "ocr" : "manual";
    const source = validSources.has(item.source) ? item.source : inferredSource;
    const timestampSource = validTimestampSources.has(item.timestampSource)
      ? item.timestampSource
      : source === "ocr" ? "ocr" : source === "import" ? "import" : "manual";
    const timestampConfidence = bounded(item.timestampConfidence, 0, 100, timestampSource === "ocr" ? 60 : 100, 0);
    const timestampEvidence = Array.isArray(item.timestampEvidence)
      ? item.timestampEvidence.map((value) => cleanText(value, 120)).filter(Boolean).slice(0, 6)
      : [];
    const normalized = {
      id: String(item.id || makeId()),
      date: todayKey(createdAt),
      company,
      earnings,
      miles,
      minutes: minutesRaw > 0 && minutesRaw <= 1440 ? round1(minutesRaw) : 0,
      zone: cleanText(item.zone || "", 80),
      merchant,
      restaurant: merchant,
      merchantType,
      note: notes,
      notes,
      source,
      ocrText: cleanText(item.ocrText || "", 20000),
      ocrConfidence: bounded(item.ocrConfidence, 0, 100, 0, 1),
      tags: normalizeTags(item.tags),
      deleted: Boolean(item.deleted),
      createdAt: createdAt.toISOString(),
      capturedAt: capturedAt.toISOString(),
      timestampSource,
      timestampConfidence,
      timestampEvidence,
      updatedAt: updatedAt.toISOString(),
      version: DATA_VERSION
    };
    return normalized;
  }

  function normalizeSettings(value) {
    const raw = value && typeof value === "object" ? value : {};
    const vehicleMpg = bounded(raw.vehicleMpg ?? raw.mpg, 1, 200, defaultSettings.vehicleMpg, 1);
    const maintenanceCostPerMile = bounded(raw.maintenanceCostPerMile ?? raw.maintenancePerMile, 0, 10, defaultSettings.maintenanceCostPerMile, 2);
    const rawMileageRate = raw.mileageDeductionRate ?? raw.taxMileageRate;
    const previousVersion = Number(raw.appDataVersion || 0);
    const previousRate = num(rawMileageRate);
    const wasKnownAppDefault = rawMileageRate === undefined || rawMileageRate === null
      || (previousVersion <= 14 && Math.abs(previousRate - 0.725) < 0.0001)
      || (previousVersion < 14 && Math.abs(previousRate - 0.67) < 0.0001);
    const mileageDeductionMode = ["automatic", "custom"].includes(raw.mileageDeductionMode)
      ? raw.mileageDeductionMode
      : (wasKnownAppDefault ? "automatic" : "custom");
    const mileageDeductionRate = mileageDeductionMode === "automatic"
      ? defaultSettings.mileageDeductionRate
      : bounded(rawMileageRate, 0, 10, defaultSettings.mileageDeductionRate, 3);
    const minimumDollarPerMile = bounded(raw.minimumDollarPerMile ?? raw.minPerMile, 0, 50, defaultSettings.minimumDollarPerMile, 2);
    const minimumDollarPerHour = bounded(raw.minimumDollarPerHour ?? raw.minPerHour, 0, 500, defaultSettings.minimumDollarPerHour, 2);
    const normalized = {
      dailyGoal: bounded(raw.dailyGoal, 1, 100000, defaultSettings.dailyGoal, 2),
      defaultCompany: allowedCompanies.has(raw.defaultCompany) ? raw.defaultCompany : defaultSettings.defaultCompany,
      defaultZone: cleanText(raw.defaultZone || "", 80),
      customZones: normalizeCustomZones(raw.customZones || raw.zones || []),
      gasPrice: bounded(raw.gasPrice, 0, 20, defaultSettings.gasPrice, 2),
      vehicleMpg,
      maintenanceCostPerMile,
      mileageDeductionMode,
      mileageDeductionRate,
      minimumDollarPerMile,
      minimumDollarPerHour,
      minimumPayout: bounded(raw.minimumPayout ?? raw.minPayout, 0, 500, defaultSettings.minimumPayout, 2),
      maxMiles: bounded(raw.maxMiles, 0, 1000, defaultSettings.maxMiles, 1),
      theme: ["system", "light", "dark"].includes(raw.theme) ? raw.theme : defaultSettings.theme,
      appDataVersion: DATA_VERSION
    };

    // Backward-compatible aliases used by existing UI/calculation code.
    normalized.mpg = normalized.vehicleMpg;
    normalized.maintenancePerMile = normalized.maintenanceCostPerMile;
    normalized.taxMileageRate = normalized.mileageDeductionRate;
    normalized.minPerMile = normalized.minimumDollarPerMile;
    normalized.minPerHour = normalized.minimumDollarPerHour;
    normalized.minPayout = normalized.minimumPayout;
    return normalized;
  }

  function normalizeCustomZones(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    const zones = [];
    for (const item of value) {
      const zone = cleanText(item, 80);
      if (!zone) continue;
      const key = zone.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      zones.push(zone);
    }
    return zones.slice(0, 50);
  }

  function zoneKey(value) {
    return cleanText(value || "", 80).toLowerCase();
  }

  function zoneName(value) {
    return cleanText(value || "", 80);
  }

  function knownZones() {
    const zones = [];
    const add = (value) => {
      const zone = zoneName(value);
      if (!zone) return;
      if (!zones.some((item) => zoneKey(item) === zoneKey(zone))) zones.push(zone);
    };
    add(settings.defaultZone);
    (settings.customZones || []).forEach(add);
    deliveries.forEach((delivery) => { if (!delivery.deleted) add(delivery.zone); });
    return zones.sort((a, b) => a.localeCompare(b));
  }

  function normalizeDecision(value) {
    if (!value || typeof value !== "object") return null;
    const outcome = ["ACCEPT", "BORDERLINE", "DECLINE"].includes(String(value.outcome || "").toUpperCase())
      ? String(value.outcome).toUpperCase() : "BORDERLINE";
    const createdAt = value.createdAt && !Number.isNaN(new Date(value.createdAt).getTime())
      ? new Date(value.createdAt).toISOString() : new Date().toISOString();
    return {
      id: String(value.id || makeId()),
      outcome,
      company: allowedCompanies.has(value.company) ? value.company : "Other",
      pay: round2(Math.max(0, num(value.pay ?? value.earnings))),
      miles: round1(Math.max(0, num(value.miles))),
      minutes: Math.max(0, Math.round(num(value.minutes))),
      zone: cleanText(value.zone || "", 80),
      note: cleanText(value.note || "", 300),
      source: cleanText(value.source || "calculator", 30),
      createdAt,
      version: DATA_VERSION
    };
  }

  function normalizeDecisions(value) {
    return Array.isArray(value) ? value.map(normalizeDecision).filter(Boolean).slice(-2000) : [];
  }

  function normalizeBreaks(value) {
    if (!Array.isArray(value)) return [];
    const parsed = value.map((item) => {
      if (!item || typeof item !== "object") return null;
      const start = item.startedAt && !Number.isNaN(new Date(item.startedAt).getTime()) ? new Date(item.startedAt).toISOString() : null;
      const end = item.endedAt && !Number.isNaN(new Date(item.endedAt).getTime()) ? new Date(item.endedAt).toISOString() : null;
      if (!start || (end && new Date(end) <= new Date(start))) return null;
      return { startedAt: start, endedAt: end };
    }).filter(Boolean).sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));

    const merged = [];
    for (const current of parsed) {
      const previous = merged[merged.length - 1];
      if (!previous) {
        merged.push(current);
        continue;
      }
      const previousEnd = previous.endedAt ? new Date(previous.endedAt).getTime() : Number.POSITIVE_INFINITY;
      const currentStart = new Date(current.startedAt).getTime();
      if (currentStart <= previousEnd) {
        previous.endedAt = !previous.endedAt || !current.endedAt
          ? null
          : new Date(Math.max(new Date(previous.endedAt).getTime(), new Date(current.endedAt).getTime())).toISOString();
      } else {
        merged.push(current);
      }
    }
    return merged.slice(-100);
  }

  function normalizeShift(value) {
    const raw = value && typeof value === "object" ? value : {};
    const startedAt = raw.startedAt && !Number.isNaN(new Date(raw.startedAt).getTime()) ? new Date(raw.startedAt).toISOString() : null;
    const endedAt = raw.endedAt && !Number.isNaN(new Date(raw.endedAt).getTime()) ? new Date(raw.endedAt).toISOString() : null;
    let pausedAt = raw.pausedAt && !Number.isNaN(new Date(raw.pausedAt).getTime()) ? new Date(raw.pausedAt).toISOString() : null;
    let breaks = normalizeBreaks(raw.breaks);
    const active = Boolean(raw.active && startedAt);
    const openBreak = breaks.find((item) => !item.endedAt);
    const paused = Boolean(active && (raw.paused || pausedAt || openBreak));
    if (paused) {
      pausedAt = openBreak?.startedAt || pausedAt || new Date().toISOString();
      if (new Date(pausedAt) < new Date(startedAt)) pausedAt = startedAt;
      if (!openBreak) breaks = normalizeBreaks([...breaks, { startedAt: pausedAt, endedAt: null }]);
    }
    const shiftHistory = Array.isArray(raw.shiftHistory)
      ? raw.shiftHistory.map((item) => normalizeShiftHistoryItem(item)).filter(Boolean).slice(-100)
      : [];
    return {
      active,
      paused,
      pausedAt: paused ? pausedAt : null,
      breaks,
      startedAt,
      endedAt: active ? null : endedAt,
      lastSummary: cleanText(raw.lastSummary || "", 1000),
      shiftHistory,
      appDataVersion: DATA_VERSION
    };
  }

  function normalizeShiftHistoryItem(item) {
    if (!item || typeof item !== "object") return null;
    const startedAt = item.startedAt && !Number.isNaN(new Date(item.startedAt).getTime()) ? new Date(item.startedAt).toISOString() : null;
    const endedAt = item.endedAt && !Number.isNaN(new Date(item.endedAt).getTime()) ? new Date(item.endedAt).toISOString() : null;
    if (!startedAt || !endedAt) return null;
    const metrics = item.metrics && typeof item.metrics === "object" && !Array.isArray(item.metrics)
      ? {
          earnings: round2(num(item.metrics.earnings)),
          profit: round2(num(item.metrics.profit)),
          miles: round1(num(item.metrics.miles)),
          orders: Math.max(0, Math.round(num(item.metrics.orders))),
          hours: round2(num(item.metrics.hours)),
          avgMile: round2(num(item.metrics.avgMile)),
          profitMile: round2(num(item.metrics.profitMile)),
          avgHour: round2(num(item.metrics.avgHour)),
          profitHour: round2(num(item.metrics.profitHour))
        }
      : null;
    return {
      id: String(item.id || makeId()),
      startedAt,
      endedAt,
      breaks: normalizeBreaks(item.breaks),
      activeHours: bounded(item.activeHours, 0, 48, 0, 3),
      summary: cleanText(item.summary || "", 2000),
      recommendation: cleanText(item.recommendation || "", 500),
      metrics,
      createdAt: item.createdAt && !Number.isNaN(new Date(item.createdAt).getTime()) ? new Date(item.createdAt).toISOString() : endedAt,
      version: DATA_VERSION
    };
  }

  function normalizeTags(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value
      .map((tag) => cleanText(tag, 40).toLowerCase())
      .filter((tag) => tag && !seen.has(tag) && seen.add(tag))
      .slice(0, 12);
  }

  function cleanText(value, maxLength) {
    return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maxLength);
  }

  function bounded(value, min, max, fallback, decimals = 2) {
    if (value === undefined || value === null) return fallback;
    const raw = String(value).trim();
    if (!raw || !/[0-9]/.test(raw)) return fallback;
    const parsed = num(raw);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) return fallback;
    const precision = Math.max(0, Math.min(6, Math.round(decimals)));
    const factor = 10 ** precision;
    return Math.round((parsed + Number.EPSILON) * factor) / factor;
  }

  function todayKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function isToday(value) {
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && todayKey(date) === todayKey();
  }

  function validDateValue(value) {
    const date = value instanceof Date ? value : new Date(value);
    return !Number.isNaN(date.getTime());
  }

  function localDateInputValue(value = new Date()) {
    const date = validDateValue(value) ? new Date(value) : new Date();
    return todayKey(date);
  }

  function localTimeInputValue(value = new Date()) {
    const date = validDateValue(value) ? new Date(value) : new Date();
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }

  function combineLocalDateTime(dateValue, timeValue, fallback = new Date()) {
    const dateMatch = String(dateValue || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const timeMatch = String(timeValue || "").match(/^(\d{1,2}):(\d{2})$/);
    const safeFallback = validDateValue(fallback) ? new Date(fallback) : new Date();
    if (!dateMatch) return safeFallback;
    const hours = timeMatch ? Number(timeMatch[1]) : safeFallback.getHours();
    const minutes = timeMatch ? Number(timeMatch[2]) : safeFallback.getMinutes();
    const date = new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]), hours, minutes, 0, 0);
    if (Number.isNaN(date.getTime())) return safeFallback;
    if (date.getFullYear() !== Number(dateMatch[1]) || date.getMonth() !== Number(dateMatch[2]) - 1 || date.getDate() !== Number(dateMatch[3])) return safeFallback;
    return date;
  }

  const OCR_MONTH_INDEX = Object.freeze({
    jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
    may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
    sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
    dec: 11, december: 11
  });

  function inferredYearDate(month, day, reference = new Date()) {
    const ref = validDateValue(reference) ? new Date(reference) : new Date();
    const candidates = [ref.getFullYear() - 1, ref.getFullYear(), ref.getFullYear() + 1]
      .map((year) => new Date(year, month, day, ref.getHours(), ref.getMinutes(), 0, 0))
      .filter((date) => date.getMonth() === month && date.getDate() === day);
    const futureLimit = ref.getTime() + 45 * 864e5;
    const preferred = candidates.filter((date) => date.getTime() <= futureLimit);
    return (preferred.length ? preferred : candidates)
      .sort((a, b) => Math.abs(a - ref) - Math.abs(b - ref))[0] || ref;
  }

  function detectScreenshotTimestamp(text, fallbackDate = new Date()) {
    const raw = String(text || "");
    const lines = raw.replace(/\r/g, "\n").split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const fallback = validDateValue(fallbackDate) ? new Date(fallbackDate) : new Date();
    const dateCandidates = [];
    const timeCandidates = [];
    const pushDate = (date, score, evidence, lineIndex) => {
      if (!validDateValue(date)) return;
      const candidate = new Date(date);
      if (candidate.getFullYear() < 2015 || candidate.getFullYear() > new Date().getFullYear() + 1) return;
      dateCandidates.push({ date: candidate, score, evidence, lineIndex });
    };
    const pushTime = (hours, minutes, score, evidence, lineIndex, inferredMeridiem = false) => {
      if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return;
      timeCandidates.push({ hours, minutes, score, evidence, lineIndex, inferredMeridiem });
    };

    lines.forEach((line, lineIndex) => {
      const topBoost = lineIndex <= 2 ? 5 : lineIndex <= 5 ? 2 : 0;
      const lower = line.toLowerCase();
      let match;

      const iso = /\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/g;
      while ((match = iso.exec(line)) !== null) {
        pushDate(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), fallback.getHours(), fallback.getMinutes()), 10 + topBoost, match[0], lineIndex);
      }

      const numeric = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/g;
      while ((match = numeric.exec(line)) !== null) {
        let year = Number(match[3]);
        if (year < 100) year += year >= 70 ? 1900 : 2000;
        pushDate(new Date(year, Number(match[1]) - 1, Number(match[2]), fallback.getHours(), fallback.getMinutes()), 10 + topBoost, match[0], lineIndex);
      }

      const monthName = /\b(?:sun(?:day)?|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?)?\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(20\d{2}))?\b/gi;
      while ((match = monthName.exec(line)) !== null) {
        const month = OCR_MONTH_INDEX[match[1].toLowerCase()];
        const day = Number(match[2]);
        const date = match[3]
          ? new Date(Number(match[3]), month, day, fallback.getHours(), fallback.getMinutes())
          : inferredYearDate(month, day, fallback);
        pushDate(date, 8 + topBoost + (match[3] ? 2 : 0) + (/\b(?:sun|mon|tue|wed|thu|fri|sat)/i.test(match[0]) ? 2 : 0), match[0], lineIndex);
      }

      const dayMonth = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:,?\s+(20\d{2}))?\b/gi;
      while ((match = dayMonth.exec(line)) !== null) {
        const month = OCR_MONTH_INDEX[match[2].toLowerCase()];
        const day = Number(match[1]);
        const date = match[3]
          ? new Date(Number(match[3]), month, day, fallback.getHours(), fallback.getMinutes())
          : inferredYearDate(month, day, fallback);
        pushDate(date, 7 + topBoost + (match[3] ? 2 : 0), match[0], lineIndex);
      }

      if (/\byesterday\b/i.test(line)) {
        const date = new Date(fallback);
        date.setDate(date.getDate() - 1);
        pushDate(date, 7 + topBoost, "Yesterday", lineIndex);
      } else if (/\btoday\b/i.test(line) && lineIndex <= 5) {
        pushDate(fallback, 5 + topBoost, "Today", lineIndex);
      }

      const timeRegex = /\b([01]?\d|2[0-3]):([0-5]\d)\s*(a\.?m\.?|p\.?m\.?)?\b/gi;
      while ((match = timeRegex.exec(line)) !== null) {
        let hours = Number(match[1]);
        const minutes = Number(match[2]);
        const suffix = String(match[3] || "").toLowerCase().replace(/\./g, "");
        if (suffix === "pm" && hours < 12) hours += 12;
        if (suffix === "am" && hours === 12) hours = 0;
        let inferredMeridiem = false;
        if (!suffix && hours <= 12 && fallback.getHours() % 12 === hours % 12) {
          hours = fallback.getHours();
          inferredMeridiem = true;
        }
        const near = lower.slice(Math.max(0, match.index - 24), Math.min(lower.length, match.index + match[0].length + 30));
        let score = 5 + topBoost + (suffix ? 4 : 0);
        if (/^(?:\s|[^a-z0-9])*\d{1,2}:\d{2}\s*(?:a\.?m\.?|p\.?m\.?)?(?:\s|[^a-z0-9])*$/i.test(line)) score += 3;
        if (/\b(?:deliver by|pickup by|ready by|arrive by|dropoff by|estimated|duration|total time|eta)\b/i.test(near)) score -= 7;
        if (/\b(?:safari|iphone|ipad|lte|5g|wifi|sun|mon|tue|wed|thu|fri|sat|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(lower)) score += 3;
        pushTime(hours, minutes, score, match[0], lineIndex, inferredMeridiem);
      }
    });

    dateCandidates.sort((a, b) => b.score - a.score || a.lineIndex - b.lineIndex);
    timeCandidates.sort((a, b) => b.score - a.score || a.lineIndex - b.lineIndex);
    const dateChoice = dateCandidates[0] || null;
    const timeChoice = timeCandidates[0] && timeCandidates[0].score >= 5 ? timeCandidates[0] : null;
    const combined = new Date(dateChoice?.date || fallback);
    if (timeChoice) combined.setHours(timeChoice.hours, timeChoice.minutes, 0, 0);
    else combined.setSeconds(0, 0);

    const hasOCRDate = Boolean(dateChoice);
    const hasOCRTime = Boolean(timeChoice);
    const source = hasOCRDate || hasOCRTime ? "ocr" : "file";
    const confidence = hasOCRDate && hasOCRTime
      ? (timeChoice?.inferredMeridiem ? 84 : 92)
      : hasOCRDate || hasOCRTime ? 68 : 35;
    const evidence = [];
    if (dateChoice) evidence.push(`date ${dateChoice.evidence}`);
    if (timeChoice) evidence.push(`time ${timeChoice.evidence}`);
    if (timeChoice?.inferredMeridiem) evidence.push("AM/PM inferred from image file time");
    if (!evidence.length) evidence.push("image file date");
    else if (!dateChoice || !timeChoice) evidence.push("image file fallback");
    return {
      capturedAt: combined.toISOString(),
      timestampSource: source,
      timestampConfidence: confidence,
      timestampEvidence: evidence
    };
  }

  function num(value) {
    let s = String(value ?? "").trim().replace(/[^0-9.,-]/g, "");
    if (!s || s === "-" || s === "." || s === ",") return 0;
    const isNegative = s.startsWith("-");
    s = s.replace(/-/g, "");
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    if (lastComma > -1 && lastDot > -1) {
      if (lastComma > lastDot) s = s.replace(/\./g, "").replace(/,/g, ".");
      else s = s.replace(/,/g, "");
    } else if (lastComma > -1) {
      const parts = s.split(",");
      s = parts.length === 2 && parts[1].length !== 3 ? s.replace(",", ".") : s.replace(/,/g, "");
    }
    const parsed = Number.parseFloat(s);
    return Number.isFinite(parsed) ? (isNegative ? -parsed : parsed) : 0;
  }

  function todayDeliveries() {
    return deliveries
      .filter((d) => !d.deleted && isToday(d.createdAt))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }

  function localDayBounds(date = new Date()) {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  function intervalOverlapMilliseconds(start, end, rangeStart, rangeEnd) {
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    const rangeStartMs = new Date(rangeStart).getTime();
    const rangeEndMs = new Date(rangeEnd).getTime();
    if (![startMs, endMs, rangeStartMs, rangeEndMs].every(Number.isFinite)) return 0;
    return Math.max(0, Math.min(endMs, rangeEndMs) - Math.max(startMs, rangeStartMs));
  }

  function breakMilliseconds(start, end, breaks = shift?.breaks || [], openBreakEnd = new Date()) {
    if (!Array.isArray(breaks) || !breaks.length) return 0;
    return breaks.reduce((total, item) => {
      if (!item?.startedAt) return total;
      const breakEnd = item.endedAt || openBreakEnd;
      return total + intervalOverlapMilliseconds(item.startedAt, breakEnd, start, end);
    }, 0);
  }

  function activeShiftMilliseconds(start, end, breaks = [], rangeStart = start, rangeEnd = end) {
    const elapsed = intervalOverlapMilliseconds(start, end, rangeStart, rangeEnd);
    if (!elapsed) return 0;
    const overlapStart = new Date(Math.max(new Date(start).getTime(), new Date(rangeStart).getTime()));
    const overlapEnd = new Date(Math.min(new Date(end).getTime(), new Date(rangeEnd).getTime()));
    return Math.max(0, elapsed - breakMilliseconds(overlapStart, overlapEnd, breaks, end));
  }

  function historyActiveMillisecondsForDay(item, dayStart, dayEnd) {
    if (!item?.startedAt || !item?.endedAt) return 0;
    const startsAndEndsToday = todayKey(new Date(item.startedAt)) === todayKey(dayStart)
      && todayKey(new Date(item.endedAt)) === todayKey(dayStart);
    if (startsAndEndsToday && num(item.activeHours) > 0) return num(item.activeHours) * 36e5;
    return activeShiftMilliseconds(item.startedAt, item.endedAt, item.breaks || [], dayStart, dayEnd);
  }

  function getWorkWindow(todays) {
    const now = new Date();
    const { start: dayStart, end: nextDay } = localDayBounds(now);
    const dayEnd = now < nextDay ? now : nextDay;
    const history = Array.isArray(shift.shiftHistory) ? shift.shiftHistory : [];
    let activeMilliseconds = history.reduce(
      (total, item) => total + historyActiveMillisecondsForDay(item, dayStart, dayEnd),
      0
    );

    if (shift.active && shift.startedAt) {
      activeMilliseconds += activeShiftMilliseconds(
        shift.startedAt,
        now,
        shift.breaks || [],
        dayStart,
        dayEnd
      );
    } else if (shift.startedAt && shift.endedAt) {
      const alreadyInHistory = history.some((item) => item.startedAt === shift.startedAt && item.endedAt === shift.endedAt);
      if (!alreadyInHistory) {
        activeMilliseconds += activeShiftMilliseconds(
          shift.startedAt,
          shift.endedAt,
          shift.breaks || [],
          dayStart,
          dayEnd
        );
      }
    }

    if (activeMilliseconds > 0) {
      return { start: dayStart, end: dayEnd, activeMilliseconds, breakMilliseconds: 0 };
    }

    const screenshotWork = estimateScreenshotWork(todays);
    if (screenshotWork.milliseconds > 0) {
      return {
        start: screenshotWork.start,
        end: screenshotWork.end,
        activeMilliseconds: screenshotWork.milliseconds,
        breakMilliseconds: 0
      };
    }
    const trackedMinutes = todays.reduce((total, delivery) => total + Math.max(0, num(delivery.minutes)), 0);
    if (trackedMinutes > 0) return null;
    return null;
  }

  const ProfitEngine = {
    number(value, fallback = 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    },
    positive(value, fallback = 0) {
      return Math.max(0, this.number(value, fallback));
    },
    fuelCostPerMile(config = settings) {
      const gasPrice = this.positive(config.gasPrice, defaultSettings.gasPrice);
      const mpg = this.positive(config.vehicleMpg ?? config.mpg, defaultSettings.vehicleMpg);
      return mpg > 0 ? round2(gasPrice / mpg) : 0;
    },
    maintenanceCost(miles = 0, config = settings) {
      const distance = this.positive(miles, 0);
      const maintenancePerMile = this.positive(config.maintenanceCostPerMile ?? config.maintenancePerMile, defaultSettings.maintenanceCostPerMile);
      return round2(distance * maintenancePerMile);
    },
    vehicleCostPerMile(config = settings) {
      const maintenancePerMile = this.positive(config.maintenanceCostPerMile ?? config.maintenancePerMile, defaultSettings.maintenanceCostPerMile);
      return round2(this.fuelCostPerMile(config) + maintenancePerMile);
    },
    vehicleCost(miles = 0, config = settings) {
      return round2(this.positive(miles, 0) * this.vehicleCostPerMile(config));
    },
    estimatedDeliveryProfit(delivery, config = settings) {
      const earnings = this.positive(delivery?.earnings, 0);
      const miles = this.positive(delivery?.miles, 0);
      return round2(earnings - this.vehicleCost(miles, config));
    },
    estimatedProfitPerMile(profitOrDelivery, miles, config = settings) {
      if (profitOrDelivery && typeof profitOrDelivery === "object") {
        const profit = this.estimatedDeliveryProfit(profitOrDelivery, config);
        return this.grossDollarPerMile(profit, profitOrDelivery.miles);
      }
      return this.grossDollarPerMile(this.number(profitOrDelivery, 0), miles);
    },
    grossDollarPerMile(earnings, miles) {
      const distance = this.positive(miles, 0);
      return distance > 0 ? round2(this.number(earnings, 0) / distance) : 0;
    },
    grossHourlyRate(earnings, minutes) {
      const mins = this.positive(minutes, 0);
      return mins > 0 ? round2(this.number(earnings, 0) / (mins / 60)) : 0;
    },
    profitHourlyRate(profit, minutes) {
      return this.grossHourlyRate(profit, minutes);
    },
    mileageRateForDate(value = new Date(), config = settings) {
      const configuredRate = this.positive(config.mileageDeductionRate ?? config.taxMileageRate, defaultSettings.mileageDeductionRate);
      if (config.mileageDeductionMode !== "automatic") return configuredRate;
      const rawDate = value && typeof value === "object" && !(value instanceof Date)
        ? (value.date || value.createdAt || value.updatedAt)
        : value;
      const directKey = typeof rawDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawDate.trim())
        ? rawDate.trim()
        : "";
      const parsedDate = directKey ? null : new Date(rawDate || new Date());
      const dateKey = directKey || (!Number.isNaN(parsedDate.getTime()) ? todayKey(parsedDate) : todayKey());
      return STANDARD_MILEAGE_RATES.find((entry) => dateKey >= entry.start && dateKey <= entry.end)?.rate
        ?? configuredRate;
    },
    mileageDeduction(miles, config = settings, date = new Date()) {
      const rate = this.mileageRateForDate(date, config);
      return round2(this.positive(miles, 0) * rate);
    },
    mileageDeductionForRows(rows = [], config = settings) {
      const safeRows = Array.isArray(rows) ? rows : [];
      if (config.mileageDeductionMode !== "automatic") {
        const miles = safeRows.reduce((sum, row) => sum + this.positive(row?.miles, 0), 0);
        return this.mileageDeduction(miles, config);
      }
      return round2(safeRows.reduce((sum, row) => sum + this.mileageDeduction(row?.miles, config, row), 0));
    },
    projectedDailyEarnings(earnings, grossHourly, hours, active = shift.active) {
      const current = this.positive(earnings, 0);
      const hourly = this.positive(grossHourly, 0);
      const worked = this.positive(hours, 0);
      if (!current || !hourly) return current;
      const projectedHours = active ? Math.max(worked, 8) : worked;
      return round2(Math.max(current, hourly * projectedHours));
    },
    goalETA(summary, goal, remaining, now = new Date()) {
      const target = this.positive(goal, 0);
      const left = this.positive(remaining, 0);
      if (!target) return { label: "No goal set", date: null, hoursNeeded: 0 };
      if (!summary?.orders) return { label: "Add delivery", date: null, hoursNeeded: 0 };
      if (left <= 0) return { label: "Goal hit", date: null, hoursNeeded: 0 };
      if (!summary.avgHour) return { label: "Need pace", date: null, hoursNeeded: 0 };
      const hoursNeeded = left / summary.avgHour;
      if (!Number.isFinite(hoursNeeded) || hoursNeeded > 24) return { label: "Over 24h", date: null, hoursNeeded };
      const date = new Date(now.getTime() + hoursNeeded * 36e5);
      return {
        label: date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        date,
        hoursNeeded
      };
    },
    driverScore(summary, config = settings) {
      const c = summary || {};
      if (!c.orders) return { value: 0, title: "No score yet", detail: "Start a shift and save deliveries to get live feedback." };
      const minPerMile = this.positive(config.minimumDollarPerMile ?? config.minPerMile, defaultSettings.minimumDollarPerMile);
      const minPerHour = this.positive(config.minimumDollarPerHour ?? config.minPerHour, defaultSettings.minimumDollarPerHour);
      let score = 50;
      if (minPerMile) score += clamp(((c.avgMile / minPerMile) - 1) * 25, -20, 25);
      if (minPerHour) score += clamp(((c.avgHour / minPerHour) - 1) * 25, -20, 25);
      if (c.profit > 0) score += 10;
      if (c.profitMile >= 1) score += 8;
      if (c.orders >= 3) score += 5;
      score = Math.round(clamp(score, 0, 100));

      let title = "Solid shift";
      let detail = `${money.format(c.avgMile)}/mile gross and ${money.format(c.profitHour)}/hour estimated profit.`;
      if (score >= 85) {
        title = "Excellent pace";
        detail = `Strong efficiency: ${money.format(c.avgMile)}/mile gross, ${money.format(c.profitMile)}/mile profit.`;
      } else if (score >= 70) {
        title = "Good money day";
        detail = "You are above most minimums. Keep avoiding low-mileage-profit orders.";
      } else if (score >= 45) {
        title = "Watch the order quality";
        detail = "You are close, but some orders may be pulling down hourly pace or $/mile.";
      } else {
        title = "Needs improvement";
        detail = "Current pace is below your targets. Use the Accept calculator before taking similar orders.";
      }
      return { value: score, title, detail };
    },
    summarizeRows(rows = [], { config = settings, workWindow = null, activeShift = shift.active } = {}) {
      const safeRows = Array.isArray(rows) ? rows : [];
      const earnings = round2(safeRows.reduce((sum, d) => sum + this.positive(d.earnings, 0), 0));
      const miles = round2(safeRows.reduce((sum, d) => sum + this.positive(d.miles, 0), 0));
      const minutes = round1(safeRows.reduce((sum, d) => sum + this.positive(d.minutes, 0), 0));
      const orders = safeRows.length;
      const expenses = this.vehicleCost(miles, config);
      const profit = round2(earnings - expenses);
      const taxDeduction = this.mileageDeductionForRows(safeRows, config);
      const avgOrder = orders ? round2(earnings / orders) : 0;
      const avgMile = this.grossDollarPerMile(earnings, miles);
      const profitMile = this.estimatedProfitPerMile(profit, miles, config);
      const workMilliseconds = workWindow
        ? Math.max(0, Number.isFinite(workWindow.activeMilliseconds)
          ? workWindow.activeMilliseconds
          : (workWindow.end - workWindow.start) - this.positive(workWindow.breakMilliseconds, 0))
        : 0;
      const hours = workWindow
        ? (workMilliseconds > 0 ? Math.max(workMilliseconds / 36e5, 1 / 60) : 0)
        : (minutes ? minutes / 60 : 0);
      const avgHour = hours ? round2(earnings / hours) : 0;
      const profitHour = hours ? round2(profit / hours) : 0;
      const projectedTotal = this.projectedDailyEarnings(earnings, avgHour, hours, activeShift);
      return { earnings, miles, orders, avgOrder, avgMile, profitMile, avgHour, profitHour, hours, profit, expenses, taxDeduction, minutes, projectedTotal };
    }
  };

  function fuelCostPerMile(config = settings) {
    return ProfitEngine.fuelCostPerMile(config);
  }

  function maintenanceCost(miles = 0, config = settings) {
    return ProfitEngine.maintenanceCost(miles, config);
  }

  function vehicleCostPerMile(config = settings) {
    return ProfitEngine.vehicleCostPerMile(config);
  }

  function costPerMile() {
    return vehicleCostPerMile(settings);
  }

  function deliveryProfit(delivery) {
    return estimatedDeliveryProfit(delivery, settings);
  }

  function estimatedDeliveryProfit(delivery, config = settings) {
    return ProfitEngine.estimatedDeliveryProfit(delivery, config);
  }

  function estimatedProfitPerMile(profitOrDelivery, miles, config = settings) {
    return ProfitEngine.estimatedProfitPerMile(profitOrDelivery, miles, config);
  }

  function grossDollarPerMile(earnings, miles) {
    return ProfitEngine.grossDollarPerMile(earnings, miles);
  }

  function safeRate(value, divisor) {
    return grossDollarPerMile(value, divisor);
  }

  function grossPerMile(delivery) {
    return grossDollarPerMile(delivery?.earnings, delivery?.miles);
  }

  function grossHourlyRate(earnings, minutes) {
    return ProfitEngine.grossHourlyRate(earnings, minutes);
  }

  function hourlyRate(value, minutes) {
    return grossHourlyRate(value, minutes);
  }

  function profitHourlyRate(profit, minutes) {
    return ProfitEngine.profitHourlyRate(profit, minutes);
  }

  function mileageDeduction(miles, config = settings, date = new Date()) {
    return ProfitEngine.mileageDeduction(miles, config, date);
  }

  function projectedDailyEarnings(earnings, grossHourly, hours) {
    return ProfitEngine.projectedDailyEarnings(earnings, grossHourly, hours, shift.active);
  }

  function projectedDailyTotal(earnings, avgHour, hours) {
    return projectedDailyEarnings(earnings, avgHour, hours);
  }

  function goalETA(c, goal, remaining) {
    return ProfitEngine.goalETA(c, goal, remaining);
  }

  function calculate(rows) {
    return ProfitEngine.summarizeRows(rows, {
      config: settings,
      workWindow: getWorkWindow(rows),
      activeShift: shift.active
    });
  }

  function render() {
    const todays = todayDeliveries();
    const c = calculate(todays);
    const goal = Number(settings.dailyGoal || 0);
    const pct = goal ? Math.min((c.earnings / goal) * 100, 999) : 0;
    const remaining = Math.max(goal - c.earnings, 0);
    const score = driverScore(c);

    els.todayEarned.textContent = money.format(c.earnings);
    els.profitLine.textContent = `Estimated profit ${money.format(c.profit)}`;
    els.goalPercent.textContent = `${Math.round(Math.min(pct, 100))}%`;
    els.goalBar.style.width = `${Math.min(pct, 100)}%`;
    els.goalText.textContent = money.format(goal);
    els.shiftStatus.textContent = shiftStatusText(c.hours);
    els.goalRemaining.textContent = buildGoalInsight(c, goal, remaining);

    const bestCompany = bestGroup(todays, "company");
    const worstCompany = worstGroup(todays, "company");
    const bestZone = bestGroup(todays, "zone");
    const worstZone = worstGroup(todays, "zone");

    renderCommandMetrics(todays, c, goal, remaining, score, bestCompany, bestZone, worstCompany, worstZone);

    els.driverScore.textContent = String(score.value);
    els.driverScoreTitle.textContent = score.title;
    els.driverScoreDetail.textContent = score.detail;
    renderHeroStatus(score.value, pct);
    renderTrend(todays);
    renderDailySummary(todays, c);
    renderBreakdown(els.companyBreakdown, todays, "company");
    renderBreakdown(els.zoneBreakdown, todays, "zone");
    renderAnalytics();
    renderHistory();
    renderCalendar();
    renderSettings();
    renderPrivacyCenter();
    renderOCRLearningStatus();
    renderZoneControls();
    renderSmartGoal();
    renderShiftButton();
    renderDecisionLog();
    renderDeliveryPreview();
    renderDecision();
  }

  function renderLive() {
    const todays = todayDeliveries();
    const c = calculate(todays);
    const goal = Number(settings.dailyGoal || 0);
    const remaining = Math.max(goal - c.earnings, 0);
    const score = driverScore(c);
    const bestCompany = bestGroup(todays, "company");
    const worstCompany = worstGroup(todays, "company");
    const bestZone = bestGroup(todays, "zone");
    const worstZone = worstGroup(todays, "zone");
    renderCommandMetrics(todays, c, goal, remaining, score, bestCompany, bestZone, worstCompany, worstZone);
    els.shiftStatus.textContent = shiftStatusText(c.hours);
    els.goalRemaining.textContent = buildGoalInsight(c, goal, remaining);
    const calendarScreen = $("tab-calendar");
    if (calendarScreen?.classList.contains("active")) renderCalendar();
  }

  function renderCommandMetrics(todays, c, goal, remaining, score, bestCompany, bestZone, worstCompany = null, worstZone = null) {
    const goalEta = buildGoalEta(c, goal, remaining);
    const paceStatus = paceStatusLabel(c);
    const efficiencyStatus = efficiencyStatusLabel(c);
    const taxRate = ProfitEngine.mileageRateForDate(new Date(), settings);

    els.profitToday.textContent = money.format(c.profit);
    els.profitHour.textContent = money.format(c.profitHour);
    els.avgHour.textContent = money.format(c.avgHour);
    els.projectedTotal.textContent = money.format(c.projectedTotal);
    els.goalEta.textContent = goalEta;
    els.paceStatus.textContent = paceStatus.label;
    els.paceRecommendation.textContent = paceRecommendation(c, goal, remaining);
    setStatusClass(els.paceCard, paceStatus.kind);

    els.avgMile.textContent = money.format(c.avgMile);
    els.profitMile.textContent = money.format(c.profitMile);
    els.milesToday.textContent = c.miles.toFixed(1);
    els.avgDeliveryValue.textContent = money.format(c.avgOrder);
    els.efficiencyStatus.textContent = efficiencyStatus.label;
    els.efficiencyRecommendation.textContent = efficiencyRecommendation(c);
    setStatusClass(els.efficiencyCard, efficiencyStatus.kind);

    els.taxDeduction.textContent = money.format(c.taxDeduction);
    els.taxRateLabel.textContent = `${formatMileageRate(taxRate)} · ${settings.mileageDeductionMode === "automatic" ? "Auto" : "Custom"}`;
    els.taxMiles.textContent = `${c.miles.toFixed(1)} mi`;
    els.vehicleCostToday.textContent = money.format(c.expenses);
    els.ordersCount.textContent = String(c.orders);
    els.taxRecommendation.textContent = c.miles
      ? `${money.format(c.taxDeduction)} estimated deduction on ${c.miles.toFixed(1)} tracked business miles.`
      : "Save miles with each delivery to build a cleaner tax log.";
    setStatusClass(els.taxCard, c.miles ? "good" : "neutral");

    els.bestCompanyToday.textContent = bestCompany ? bestCompany.name : "—";
    els.worstCompanyToday.textContent = worstCompany ? worstCompany.name : (bestCompany ? "Need 2+" : "—");
    els.bestZoneToday.textContent = bestZone ? bestZone.name : "—";
    els.worstZoneToday.textContent = worstZone ? worstZone.name : (bestZone ? "Need 2+" : "—");
    els.timeWorking.textContent = formatHours(c.hours);
    if (els.decisionsToday) els.decisionsToday.textContent = String(decisions.filter((d) => isToday(d.createdAt)).length);
    els.performanceRecommendation.textContent = performanceRecommendation(c, bestCompany, bestZone);
    els.heroStatusLabel.textContent = heroStatusLabel(c, score.value, goal);
    setStatusClass(els.performanceCard, scoreKind(score.value, c.orders));
  }

  function buildGoalEta(c, goal, remaining) {
    return goalETA(c, goal, remaining).label;
  }

  function paceStatusLabel(c) {
    if (!c.orders) return { kind: "neutral", label: "Waiting for data" };
    if (c.avgHour >= settings.minPerHour * 1.15) return { kind: "good", label: "Ahead of pace" };
    if (c.avgHour >= settings.minPerHour * 0.9) return { kind: "warning", label: "Close to target" };
    return { kind: "danger", label: "Behind pace" };
  }

  function efficiencyStatusLabel(c) {
    if (!c.orders || !c.miles) return { kind: "neutral", label: "No miles yet" };
    if (c.avgMile >= settings.minPerMile * 1.15) return { kind: "good", label: "Efficient" };
    if (c.avgMile >= settings.minPerMile * 0.9) return { kind: "warning", label: "Borderline" };
    return { kind: "danger", label: "Low $/mile" };
  }

  function paceRecommendation(c, goal, remaining) {
    if (!c.orders) return "Start a shift and save a delivery to calculate live pace.";
    if (remaining <= 0) return `Goal reached with ${money.format(c.earnings - goal)} over target.`;
    if (c.avgHour >= settings.minPerHour) return `${money.format(remaining)} left. Current pace beats your ${money.format(settings.minPerHour)}/hr target.`;
    return `Current gross pace is below your ${money.format(settings.minPerHour)}/hr target. Use Decide before accepting similar orders.`;
  }

  function efficiencyRecommendation(c) {
    if (!c.orders) return "Use miles on every delivery to keep profit accurate.";
    if (!c.miles) return "Zero tracked miles makes $/mile impossible. Add mileage for tax and profit accuracy.";
    if (c.avgMile >= settings.minPerMile) return `Good order quality: ${money.format(c.avgMile)}/mile beats your ${money.format(settings.minPerMile)}/mile floor.`;
    return `Order quality is low. Try to avoid offers below ${money.format(settings.minPerMile)}/mile.`;
  }

  function performanceRecommendation(c, bestCompany, bestZone) {
    if (!c.orders) return "Add your first delivery to unlock platform and zone coaching.";
    const company = bestCompany ? bestCompany.name : "your best platform";
    const zone = bestZone ? bestZone.name : "your best zone";
    if (c.avgMile < settings.minPerMile) return `Prioritize shorter, higher-pay offers. ${company} is currently strongest, but $/mile needs attention.`;
    if (c.avgHour < settings.minPerHour) return `Efficiency is okay; hourly pace needs help. Watch wait time and favor ${zone}.`;
    return `Keep prioritizing ${company}${zone !== "Unassigned" ? ` in ${zone}` : ""}; it is producing your strongest mix today.`;
  }

  function heroStatusLabel(c, score, goal) {
    if (!c.orders) return "No data yet";
    if (goal && c.earnings >= goal) return "Goal reached";
    if (score >= 75) return "Strong day";
    if (score >= 50) return "Watch pace";
    return "Needs attention";
  }

  function scoreKind(score, orders) {
    if (!orders) return "neutral";
    if (score >= 75) return "good";
    if (score >= 50) return "warning";
    return "danger";
  }

  function setStatusClass(el, kind) {
    if (!el) return;
    el.classList.remove("status-good", "status-warning", "status-danger", "status-neutral");
    el.classList.add(`status-${kind || "neutral"}`);
  }

  function renderHeroStatus(score, pct) {
    if (!todayDeliveries().length) setStatusClass(els.todayHero, "neutral");
    else if (pct >= 100 || score >= 75) setStatusClass(els.todayHero, "good");
    else if (score >= 50) setStatusClass(els.todayHero, "warning");
    else setStatusClass(els.todayHero, "danger");
  }

  function buildGoalInsight(c, goal, remaining) {
    if (!goal) return "Set a daily goal in Settings.";
    if (!c.orders) return "Add your first delivery to start tracking pay, miles, profit, and pace.";
    if (remaining <= 0) return `Goal hit. You're ${money.format(c.earnings - goal)} over target.`;
    if (c.avgHour > 0) {
      const eta = goalETA(c, goal, remaining);
      return `${money.format(remaining)} left. At this pace, you hit goal around ${eta.label}.`;
    }
    return `${money.format(remaining)} left to hit today's goal.`;
  }

  function shiftStatusText(hours) {
    if (shift.active && shift.paused && shift.startedAt) return `On break · ${formatHours(hours)} active today`;
    if (shift.active && shift.startedAt) return `Shift active · ${formatHours(hours)} today`;
    if (shift.endedAt && isToday(shift.endedAt)) return `Shift ended · ${formatHours(hours)}`;
    return "No active shift";
  }

  function driverScore(c) {
    return ProfitEngine.driverScore(c, settings);
  }

  function formatHours(hours) {
    if (!hours) return "0h 00m";
    const totalMinutes = Math.max(0, Math.round(hours * 60));
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}h ${String(m).padStart(2, "0")}m`;
  }

  function formatMileageRate(rate) {
    const cents = Math.round(Math.max(0, num(rate)) * 1000) / 10;
    return `${Number.isInteger(cents) ? cents.toFixed(0) : cents.toFixed(1)}¢/mi`;
  }

  function renderTrend(todays) {
    els.trendCard.classList.remove("trend-up", "trend-down");
    if (todays.length === 0) {
      els.trendTitle.textContent = "No deliveries yet";
      els.trendDetail.textContent = "After each delivery, GigLens shows whether that delivery helped or hurt your average.";
      return;
    }
    const last = todays[todays.length - 1];
    const lastEarnings = Number(last.earnings || 0);
    const lastMiles = Number(last.miles || 0);
    const perMile = grossDollarPerMile(lastEarnings, lastMiles);
    const profit = estimatedDeliveryProfit(last);
    const before = todays.slice(0, -1);
    if (!before.length) {
      els.trendTitle.textContent = `${money.format(lastEarnings)} first delivery`;
      els.trendDetail.textContent = `${last.company} · ${lastMiles.toFixed(1)} mi · ${money.format(perMile)}/mi gross · ${money.format(profit)} profit.`;
      return;
    }
    const beforeAvg = before.reduce((s, d) => s + Number(d.earnings || 0), 0) / before.length;
    const afterAvg = todays.reduce((s, d) => s + Number(d.earnings || 0), 0) / todays.length;
    const diff = afterAvg - beforeAvg;
    const helped = diff >= 0 && perMile >= settings.minPerMile;
    els.trendCard.classList.add(helped ? "trend-up" : "trend-down");
    els.trendTitle.textContent = helped ? "Last delivery helped your day" : "Last delivery hurt your average";
    els.trendDetail.textContent = `${last.company}: ${money.format(lastEarnings)}, ${lastMiles.toFixed(1)} mi, ${money.format(perMile)}/mi, ${money.format(profit)} estimated profit. Average delivery changed by ${money.format(diff)}.`;
  }

  function renderDailySummary(todays, c) {
    const recap = buildDriverRecap(todays, c);
    renderRecapCard(recap);
    renderShiftHistory();
  }

  function buildDriverRecap(rows = [], c = calculate(rows), options = {}) {
    const safeRows = Array.isArray(rows) ? rows.filter(Boolean) : [];
    const goal = Number(settings.dailyGoal || 0);
    const bestCompany = bestGroup(safeRows, "company");
    const bestZone = bestGroup(safeRows, "zone");
    const best = bestDelivery(safeRows);
    const weak = weakestDelivery(safeRows);
    const goalDelta = round2(c.earnings - goal);
    const goalStatus = !goal
      ? "No daily goal set"
      : goalDelta >= 0
        ? `Ahead of goal by ${money.format(goalDelta)}`
        : `Behind goal by ${money.format(Math.abs(goalDelta))}`;
    const recommendations = buildDriverRecommendations(safeRows, c, { bestCompany, bestZone, weak, goal, goalDelta });
    const recap = {
      date: options.date || todayKey(),
      startedAt: options.startedAt || shift.startedAt || null,
      endedAt: options.endedAt || shift.endedAt || null,
      rows: safeRows,
      metrics: {
        earnings: c.earnings,
        profit: c.profit,
        hours: round2(c.hours),
        miles: c.miles,
        orders: c.orders,
        avgHour: c.avgHour,
        profitHour: c.profitHour,
        avgMile: c.avgMile,
        profitMile: c.profitMile
      },
      bestCompany,
      bestZone,
      bestDelivery: best,
      weakestDelivery: weak,
      goalStatus,
      recommendations
    };
    recap.text = buildDriverRecapText(recap);
    recap.recommendation = recommendations[0] || "Add deliveries to unlock local coaching.";
    return recap;
  }

  function buildDriverRecommendations(rows, c, context) {
    if (!rows.length) return ["Add your first delivery to unlock local coaching."];
    const recs = [];
    if (context.goal && context.goalDelta >= 0) {
      recs.push(`You are ahead of goal. Protect the day by rejecting orders below ${money.format(settings.minPerMile)}/mile unless they are very quick.`);
    } else if (context.goal) {
      recs.push(`You are behind goal by ${money.format(Math.abs(context.goalDelta))}. Use the Accept Calculator and prioritize offers above ${money.format(settings.minPerMile)}/mile.`);
    }
    if (c.avgMile < settings.minPerMile) {
      recs.push(`Avoid low-distance-quality orders: today is ${money.format(c.avgMile)}/mile gross versus your ${money.format(settings.minPerMile)}/mile floor.`);
    } else {
      recs.push(`Order quality is healthy at ${money.format(c.avgMile)}/mile gross. Keep using that as your floor.`);
    }
    if (context.bestCompany) recs.push(`Best platform suggestion: favor ${context.bestCompany.name} when offers are similar.`);
    if (context.bestZone && context.bestZone.name !== "Unassigned") recs.push(`Best zone suggestion: ${context.bestZone.name} is currently your strongest area.`);
    if (context.weak) {
      const weakRate = grossPerMile(context.weak);
      if (weakRate < settings.minPerMile) recs.push(`Next shift: avoid orders like ${context.weak.company} at ${money.format(weakRate)}/mile unless wait time is almost zero.`);
    }
    if (c.profitHour && c.profitHour < settings.minPerHour) {
      recs.push(`Profit/hour is under target. Watch restaurant wait time, long drives, and dead miles.`);
    }
    return [...new Set(recs)].slice(0, 5);
  }

  function buildDriverRecapText(recap) {
    const m = recap.metrics;
    if (!m.orders) return `No deliveries saved for ${recap.date}.`;
    const bestCompany = recap.bestCompany ? recap.bestCompany.name : "Not enough data";
    const bestZone = recap.bestZone ? recap.bestZone.name : "Not enough data";
    const best = recap.bestDelivery ? `${recap.bestDelivery.company} ${money.format(recap.bestDelivery.earnings)} for ${Number(recap.bestDelivery.miles || 0).toFixed(1)} mi` : "Not enough data";
    const weak = recap.weakestDelivery ? `${recap.weakestDelivery.company} ${money.format(recap.weakestDelivery.earnings)} for ${Number(recap.weakestDelivery.miles || 0).toFixed(1)} mi` : "Not enough data";
    return [
      `GigLens recap for ${recap.date}`,
      `Gross earnings: ${money.format(m.earnings)}`,
      `Estimated profit: ${money.format(m.profit)}`,
      `Hours worked: ${formatHours(m.hours)}`,
      `Deliveries: ${m.orders}`,
      `Miles: ${Number(m.miles || 0).toFixed(1)}`,
      `Gross/hour: ${money.format(m.avgHour)}`,
      `Profit/hour: ${money.format(m.profitHour)}`,
      `Gross $/mile: ${money.format(m.avgMile)}`,
      `Profit $/mile: ${money.format(m.profitMile)}`,
      `Best company: ${bestCompany}`,
      `Best zone: ${bestZone}`,
      `Best delivery: ${best}`,
      `Weakest delivery: ${weak}`,
      `Goal status: ${recap.goalStatus}`,
      `Recommendation: ${recap.recommendations.join(" ")}`
    ].join("\n");
  }

  function renderRecapCard(recap) {
    if (!els.dailySummary) return;
    if (!recap.metrics.orders) {
      if (els.recapStatus) els.recapStatus.textContent = "No data yet";
      if (els.recapMetrics) els.recapMetrics.innerHTML = "";
      els.dailySummary.textContent = "No shift data yet.";
      if (els.recapRecommendation) els.recapRecommendation.textContent = "Add your first delivery to unlock local coaching.";
      setStatusClass(els.dailyRecapCard, "neutral");
      return;
    }
    const m = recap.metrics;
    if (els.recapStatus) els.recapStatus.textContent = recap.goalStatus;
    if (els.recapMetrics) {
      els.recapMetrics.innerHTML = `
        <span><strong>${money.format(m.earnings)}</strong><small>gross</small></span>
        <span><strong>${money.format(m.profit)}</strong><small>profit</small></span>
        <span><strong>${formatHours(m.hours)}</strong><small>worked</small></span>
        <span><strong>${money.format(m.avgHour)}</strong><small>gross/hr</small></span>
        <span><strong>${money.format(m.profitHour)}</strong><small>profit/hr</small></span>
        <span><strong>${money.format(m.avgMile)}</strong><small>gross/mi</small></span>
        <span><strong>${money.format(m.profitMile)}</strong><small>profit/mi</small></span>
        <span><strong>${Number(m.miles || 0).toFixed(1)}</strong><small>miles</small></span>
      `;
    }
    const best = recap.bestDelivery;
    const weak = recap.weakestDelivery;
    els.dailySummary.innerHTML = `
      <p>You earned <strong>${money.format(m.earnings)}</strong> today with <strong>${money.format(m.profit)}</strong> estimated profit across <strong>${m.orders}</strong> ${m.orders === 1 ? "delivery" : "deliveries"}.</p>
      <p>${formatHours(m.hours)} worked · ${Number(m.miles || 0).toFixed(1)} miles · ${money.format(m.avgHour)}/hr gross · ${money.format(m.profitHour)}/hr profit · ${money.format(m.avgMile)}/mi gross.</p>
      <p>Best company: <strong>${escapeHTML(recap.bestCompany?.name || "Not enough data")}</strong>. Best zone: <strong>${escapeHTML(recap.bestZone?.name || "Not enough data")}</strong>.</p>
      <p>Best delivery: <strong>${best ? `${escapeHTML(best.company)} ${money.format(best.earnings)} for ${Number(best.miles || 0).toFixed(1)} mi` : "—"}</strong>. Weakest delivery: <strong>${weak ? `${escapeHTML(weak.company)} ${money.format(weak.earnings)} for ${Number(weak.miles || 0).toFixed(1)} mi` : "—"}</strong>.</p>
    `;
    if (els.recapRecommendation) {
      els.recapRecommendation.innerHTML = recap.recommendations.map((item) => `<p>${escapeHTML(item)}</p>`).join("");
    }
    setStatusClass(els.dailyRecapCard, m.profitHour >= settings.minPerHour && m.avgMile >= settings.minPerMile ? "good" : m.avgMile >= settings.minPerMile * 0.8 ? "warning" : "danger");
  }

  function renderShiftHistory() {
    if (!els.shiftHistoryList) return;
    const history = Array.isArray(shift.shiftHistory) ? [...shift.shiftHistory].slice(-5).reverse() : [];
    if (!history.length) {
      els.shiftHistoryList.className = "shift-history-list empty";
      els.shiftHistoryList.textContent = "No saved shift recaps yet.";
      return;
    }
    els.shiftHistoryList.className = "shift-history-list";
    els.shiftHistoryList.innerHTML = history.map((item) => {
      const metrics = item.metrics || {};
      const ended = new Date(item.endedAt);
      const label = Number.isNaN(ended.getTime()) ? "Saved recap" : ended.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      return `
        <article class="shift-history-item">
          <div><strong>${escapeHTML(label)}</strong><span>${money.format(metrics.earnings || 0)} gross · ${money.format(metrics.profit || 0)} profit · ${metrics.orders || 0} deliveries</span></div>
          <p>${escapeHTML(item.recommendation || item.summary || "No recommendation saved.")}</p>
        </article>
      `;
    }).join("");
  }

  function bestDelivery(rows) {
    return [...rows].sort((a, b) => {
      return estimatedProfitPerMile(b) - estimatedProfitPerMile(a)
        || deliveryProfit(b) - deliveryProfit(a)
        || Number(b.earnings || 0) - Number(a.earnings || 0);
    })[0] || null;
  }

  function weakestDelivery(rows) {
    return [...rows].sort((a, b) => {
      return estimatedProfitPerMile(a) - estimatedProfitPerMile(b)
        || deliveryProfit(a) - deliveryProfit(b)
        || Number(a.earnings || 0) - Number(b.earnings || 0);
    })[0] || null;
  }

  function activeDeliveries() {
    return deliveries
      .filter((d) => !d.deleted)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function aggregateGroups(rows, key) {
    const buckets = new Map();
    for (const d of Array.isArray(rows) ? rows : []) {
      const name = key === "zone" ? (cleanText(d.zone || "", 80) || "Unassigned") : (allowedCompanies.has(d.company) ? d.company : "Other");
      if (!buckets.has(name)) buckets.set(name, []);
      buckets.get(name).push(d);
    }
    return [...buckets.entries()].map(([name, groupRows]) => {
      const summary = ProfitEngine.summarizeRows(groupRows, { config: settings, activeShift: false });
      return {
        name,
        rows: groupRows,
        count: summary.orders,
        earnings: summary.earnings,
        profit: summary.profit,
        miles: summary.miles,
        minutes: summary.minutes,
        avgGrossPerMile: summary.avgMile,
        avgProfitPerMile: summary.profitMile,
        avgGrossHour: summary.avgHour,
        avgProfitHour: summary.profitHour
      };
    });
  }

  function compareAnalyticsGroups(a, b) {
    return b.avgProfitPerMile - a.avgProfitPerMile
      || b.avgProfitHour - a.avgProfitHour
      || b.profit - a.profit
      || b.earnings - a.earnings
      || a.name.localeCompare(b.name);
  }

  function rankedGroups(rows, key) {
    return aggregateGroups(rows, key).sort(compareAnalyticsGroups);
  }

  function bestGroup(rows, key) {
    return rankedGroups(rows, key)[0] || null;
  }

  function worstGroup(rows, key) {
    const ranked = rankedGroups(rows, key);
    if (ranked.length < 2) return null;
    return ranked[ranked.length - 1] || null;
  }

  function groupRows(rows, key) {
    const grouped = new Map();
    for (const group of aggregateGroups(rows, key)) grouped.set(group.name, group);
    return grouped;
  }

  function analyticsLabel(group) {
    if (!group) return "—";
    return `${group.name} · ${money.format(group.avgProfitPerMile)}/mi profit`;
  }

  function renderBreakdown(target, rows, key) {
    if (!target) return;
    if (!rows.length) {
      target.className = "breakdown empty";
      target.textContent = key === "zone" ? "No zone data yet. Add a zone to compare where you earn best." : "No company data yet. Add a delivery to compare platforms.";
      return;
    }
    target.className = "breakdown";
    const groups = rankedGroups(rows, key);
    target.innerHTML = groups
      .map((row) => `
        <div class="breakdown-item">
          <div class="breakdown-top"><span>${escapeHTML(row.name)}</span><strong>${money.format(row.earnings)}</strong></div>
          <div class="breakdown-meta">${row.count} ${row.count === 1 ? "delivery" : "deliveries"} · ${row.miles.toFixed(1)} mi · ${money.format(row.avgGrossPerMile)}/mi gross · ${money.format(row.avgProfitPerMile)}/mi profit · ${money.format(row.avgGrossHour)}/hr gross · ${money.format(row.avgProfitHour)}/hr profit</div>
        </div>
      `).join("");
  }

  function renderAnalytics() {
    if (!els.analyticsCompanyBreakdown) return;
    const active = activeDeliveries();
    const todays = todayDeliveries();
    const bestCompany = bestGroup(todays, "company");
    const worstCompany = worstGroup(todays, "company");
    const bestZone = bestGroup(todays, "zone");
    const worstZone = worstGroup(todays, "zone");
    const todayHours = rankedHourGroups(todays);
    const recentRows = deliveriesWithinDays(active, 7);
    const savedHours = rankedHourGroups(recentRows.length ? recentRows : active);
    const timeInsights = buildBestTimeInsights(active, todays);

    els.analyticsBestCompany.textContent = analyticsLabel(bestCompany);
    els.analyticsWorstCompany.textContent = worstCompany ? analyticsLabel(worstCompany) : (bestCompany ? "Need 2+ platforms" : "—");
    els.analyticsBestZone.textContent = analyticsLabel(bestZone);
    els.analyticsWorstZone.textContent = worstZone ? analyticsLabel(worstZone) : (bestZone ? "Need 2+ zones" : "—");
    els.analyticsBestHourToday.textContent = timeInsights.todayBest[0] ? hourlyInsightLabel(timeInsights.todayBest[0]) : "—";
    els.analyticsWeeklyBestHour.textContent = timeInsights.historicalBest[0] ? hourlyInsightLabel(timeInsights.historicalBest[0]) : "Need history";

    renderBestTimeInsights(timeInsights);
    renderZoneHeatmap(active);
    renderAnalyticsList(els.analyticsCompanyBreakdown, rankedGroups(active, "company"), "No platform data yet. Save deliveries to compare apps.");
    renderAnalyticsList(els.analyticsZoneBreakdown, rankedGroups(active, "zone"), "No zone data yet. Add zones to compare where you earn best.");
    renderAnalyticsList(els.analyticsHourlyBreakdown, savedHours, "No hourly data yet. Save deliveries with timestamps to reveal your best hours.", { hourly: true });
  }

  function renderAnalyticsList(target, groups, emptyText, options = {}) {
    if (!target) return;
    if (!groups.length) {
      target.className = "analytics-list empty";
      target.textContent = emptyText;
      return;
    }
    target.className = "analytics-list";
    const max = Math.max(...groups.map((group) => Math.max(group.profit, group.earnings, 0)), 1);
    target.innerHTML = groups.map((group) => {
      const width = clamp((Math.max(group.profit, group.earnings, 0) / max) * 100, 4, 100);
      const titleMetric = options.hourly ? `${money.format(group.avgGrossHour)}/hr gross` : `${money.format(group.avgProfitPerMile)}/mi profit`;
      return `
        <article class="analytics-card">
          <div class="analytics-card-top">
            <div><strong>${escapeHTML(group.name)}</strong><span>${group.count} ${group.count === 1 ? "delivery" : "deliveries"} · ${group.miles.toFixed(1)} mi</span></div>
            <strong>${escapeHTML(titleMetric)}</strong>
          </div>
          <div class="analytics-bar" aria-hidden="true"><span style="width:${width.toFixed(1)}%"></span></div>
          <div class="analytics-metrics">
            <span><strong>${money.format(group.earnings)}</strong><small>earnings</small></span>
            <span><strong>${money.format(group.profit)}</strong><small>profit</small></span>
            <span><strong>${money.format(group.avgGrossPerMile)}</strong><small>gross/mi</small></span>
            <span><strong>${money.format(group.avgProfitPerMile)}</strong><small>profit/mi</small></span>
            <span><strong>${money.format(group.avgGrossHour)}</strong><small>gross/hr</small></span>
            <span><strong>${money.format(group.avgProfitHour)}</strong><small>profit/hr</small></span>
          </div>
        </article>
      `;
    }).join("");
  }

  function deliveriesWithinDays(rows, days) {
    const cutoff = Date.now() - Math.max(1, days) * 86400000;
    return rows.filter((d) => {
      const time = new Date(d.createdAt).getTime();
      return Number.isFinite(time) && time >= cutoff;
    });
  }

  function rankedHourGroups(rows) {
    const buckets = new Map();
    for (const d of Array.isArray(rows) ? rows : []) {
      const date = new Date(d.createdAt);
      if (Number.isNaN(date.getTime())) continue;
      const hour = date.getHours();
      const name = hourRangeLabel(hour);
      if (!buckets.has(hour)) buckets.set(hour, { name, rows: [] });
      buckets.get(hour).rows.push(d);
    }
    return [...buckets.values()].map((bucket) => {
      const summary = ProfitEngine.summarizeRows(bucket.rows, { config: settings, activeShift: false });
      return {
        name: bucket.name,
        rows: bucket.rows,
        count: summary.orders,
        earnings: summary.earnings,
        profit: summary.profit,
        miles: summary.miles,
        minutes: summary.minutes,
        avgGrossPerMile: summary.avgMile,
        avgProfitPerMile: summary.profitMile,
        avgGrossHour: summary.avgHour,
        avgProfitHour: summary.profitHour
      };
    }).sort(compareAnalyticsGroups);
  }

  function distinctDeliveryDays(rows) {
    const days = new Set();
    for (const d of Array.isArray(rows) ? rows : []) {
      const date = new Date(d.createdAt);
      if (!Number.isNaN(date.getTime())) days.add(todayKey(date));
    }
    return days.size;
  }

  function pastDeliveries(rows, now = new Date()) {
    const today = todayKey(now);
    return (Array.isArray(rows) ? rows : []).filter((d) => {
      const date = new Date(d.createdAt);
      if (Number.isNaN(date.getTime())) return false;
      return todayKey(date) < today;
    });
  }

  function scoreHourBucket(bucket) {
    if (!bucket) return 0;
    return round2((Number(bucket.avgProfitHour || 0) * 0.55) + (Number(bucket.avgGrossHour || 0) * 0.25) + (Number(bucket.avgProfitPerMile || 0) * 6) + (Number(bucket.avgEarningsPerDay || 0) * 0.05));
  }

  function enrichHourBucket(bucket) {
    const rows = Array.isArray(bucket?.rows) ? bucket.rows : [];
    const dayBuckets = new Map();
    for (const d of rows) {
      const date = new Date(d.createdAt);
      if (Number.isNaN(date.getTime())) continue;
      const key = todayKey(date);
      if (!dayBuckets.has(key)) dayBuckets.set(key, []);
      dayBuckets.get(key).push(d);
    }
    const daySummaries = [...dayBuckets.values()].map((items) => ProfitEngine.summarizeRows(items, { config: settings, activeShift: false }));
    const enriched = {
      ...bucket,
      days: dayBuckets.size,
      avgEarningsPerDay: round2(average(daySummaries.map((item) => item.earnings))),
      avgProfitPerDay: round2(average(daySummaries.map((item) => item.profit))),
      score: 0
    };
    enriched.score = scoreHourBucket(enriched);
    return enriched;
  }

  function rankedHourInsightGroups(rows) {
    return rankedHourGroups(rows).map(enrichHourBucket).sort((a, b) => {
      return b.score - a.score
        || b.avgProfitHour - a.avgProfitHour
        || b.avgGrossHour - a.avgGrossHour
        || b.profit - a.profit
        || a.name.localeCompare(b.name);
    });
  }

  function buildBestTimeInsights(activeRows, todayRows, now = new Date()) {
    const todays = rankedHourInsightGroups(todayRows);
    const pastRows = pastDeliveries(activeRows, now);
    const pastDayCount = distinctDeliveryDays(pastRows);
    const historical = pastDayCount >= 2 ? rankedHourInsightGroups(pastRows) : [];
    const weak = historical.length > 1
      ? [...historical].sort((a, b) => {
          return a.score - b.score
            || a.avgProfitHour - b.avgProfitHour
            || a.avgGrossHour - b.avgGrossHour
            || a.name.localeCompare(b.name);
        })
      : [];
    return {
      todayBest: todays.slice(0, 3),
      historicalBest: historical.slice(0, 3),
      weakHours: weak.slice(0, 3),
      historicalDayCount: pastDayCount,
      hasToday: todays.length > 0,
      hasHistorical: historical.length > 0
    };
  }

  function hourlyInsightLabel(group) {
    if (!group) return "—";
    return `${group.name} · ${money.format(group.avgGrossHour)}/hr gross`;
  }

  function renderBestTimeInsights(insights) {
    if (!els.bestTimeCard) return;
    const enoughHistory = insights.historicalDayCount >= 2;
    els.bestTimeStatus.textContent = enoughHistory ? `${insights.historicalDayCount} past days` : "Needs history";
    setStatusClass(els.bestTimeCard, insights.hasToday || enoughHistory ? "good" : "neutral");
    els.bestTimeExplanation.textContent = enoughHistory
      ? `Historical best hours use ${insights.historicalDayCount} completed past driving days. Today’s hours update live from saved deliveries.`
      : "Save deliveries across at least two completed past driving days to unlock historical best and weak-hour insights. Today’s saved deliveries can still show today’s best hours.";

    renderHourInsightList(els.bestHoursToday, insights.todayBest, "No hourly data for today yet. Save deliveries to see today’s strongest windows.", { mode: "today" });
    renderHourInsightList(els.bestHistoricalHours, insights.historicalBest, "Save at least two past driving days to unlock historical best-hour insights.", { mode: "best" });
    renderHourInsightList(els.weakHoursList, insights.weakHours, "Weak-hour insights appear after enough past hourly history is saved.", { mode: "weak" });
  }

  function renderHourInsightList(target, groups, emptyText, options = {}) {
    if (!target) return;
    if (!groups.length) {
      target.className = "analytics-list empty";
      target.textContent = emptyText;
      return;
    }
    target.className = "analytics-list hour-insight-list";
    const maxScore = Math.max(...groups.map((group) => Math.max(group.score, group.avgGrossHour, group.avgProfitHour, 0)), 1);
    target.innerHTML = groups.map((group) => {
      const width = clamp((Math.max(group.score, group.avgGrossHour, group.avgProfitHour, 0) / maxScore) * 100, 8, 100);
      const label = options.mode === "weak" ? "weak window" : options.mode === "today" ? "today" : "historical";
      return `
        <article class="analytics-card hour-insight-card ${escapeHTML(label.replace(/\s+/g, "-"))}">
          <div class="analytics-card-top">
            <div><strong>${escapeHTML(group.name)}</strong><span>${group.count} ${group.count === 1 ? "delivery" : "deliveries"}${group.days ? ` · ${group.days} ${group.days === 1 ? "day" : "days"}` : ""}</span></div>
            <strong>${money.format(group.avgProfitHour)}/hr profit</strong>
          </div>
          <div class="analytics-bar" aria-hidden="true"><span style="width:${width.toFixed(1)}%"></span></div>
          <div class="analytics-metrics">
            <span><strong>${money.format(group.avgGrossHour)}</strong><small>avg gross/hr</small></span>
            <span><strong>${money.format(group.avgProfitHour)}</strong><small>avg profit/hr</small></span>
            <span><strong>${money.format(group.avgEarningsPerDay)}</strong><small>avg earned</small></span>
            <span><strong>${money.format(group.avgProfitPerDay)}</strong><small>avg profit</small></span>
            <span><strong>${group.miles.toFixed(1)} mi</strong><small>tracked miles</small></span>
            <span><strong>${formatHours(group.minutes / 60)}</strong><small>tracked time</small></span>
          </div>
        </article>
      `;
    }).join("");
  }

  function hourRangeLabel(hour) {
    const start = new Date(2000, 0, 1, hour);
    const end = new Date(2000, 0, 1, (hour + 1) % 24);
    return `${start.toLocaleTimeString([], { hour: "numeric" })}–${end.toLocaleTimeString([], { hour: "numeric" })}`;
  }


  function historicalDailySummaries(now = new Date()) {
    const today = todayKey(now);
    const buckets = new Map();
    for (const d of activeDeliveries()) {
      const dateKeyValue = todayKey(new Date(d.createdAt));
      if (!dateKeyValue || dateKeyValue >= today) continue;
      if (!buckets.has(dateKeyValue)) buckets.set(dateKeyValue, []);
      buckets.get(dateKeyValue).push(d);
    }
    return [...buckets.entries()].map(([dateKeyValue, rows]) => {
      const summary = ProfitEngine.summarizeRows(rows, { config: settings, activeShift: false });
      const date = dateFromKey(dateKeyValue);
      const dayIndex = Number.isNaN(date.getTime()) ? 0 : date.getDay();
      return {
        dateKey: dateKeyValue,
        dayIndex,
        dayName: weekdayNames[dayIndex],
        rows,
        earnings: summary.earnings,
        profit: summary.profit,
        hours: summary.hours,
        miles: summary.miles,
        deliveries: summary.orders
      };
    }).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }

  function dateFromKey(dateKeyValue) {
    const [year, month, day] = String(dateKeyValue || "").split("-").map(Number);
    if (!year || !month || !day) return new Date("invalid");
    return new Date(year, month - 1, day, 12, 0, 0);
  }

  function average(values) {
    const safe = values.filter((value) => Number.isFinite(value));
    return safe.length ? safe.reduce((sum, value) => sum + value, 0) / safe.length : 0;
  }

  function roundGoal(value) {
    const safe = Math.max(0, Number(value) || 0);
    if (!safe) return 0;
    return Math.max(1, Math.round(safe / 5) * 5);
  }

  function buildSmartGoalModel(now = new Date()) {
    const summaries = historicalDailySummaries(now);
    const buckets = weekdayNames.map((name, index) => ({
      name,
      index,
      days: 0,
      avgEarnings: 0,
      avgProfit: 0,
      avgHours: 0,
      avgDeliveries: 0,
      summaries: []
    }));

    for (const summary of summaries) {
      const bucket = buckets[summary.dayIndex] || buckets[0];
      bucket.summaries.push(summary);
      bucket.days += 1;
    }

    for (const bucket of buckets) {
      bucket.avgEarnings = round2(average(bucket.summaries.map((item) => item.earnings)));
      bucket.avgProfit = round2(average(bucket.summaries.map((item) => item.profit)));
      bucket.avgHours = round2(average(bucket.summaries.map((item) => item.hours)));
      bucket.avgDeliveries = round2(average(bucket.summaries.map((item) => item.deliveries)));
    }

    const totalDays = summaries.length;
    const currentBucket = buckets[now.getDay()] || buckets[0];
    const overall = {
      name: "all saved driving days",
      days: totalDays,
      avgEarnings: round2(average(summaries.map((item) => item.earnings))),
      avgProfit: round2(average(summaries.map((item) => item.profit))),
      avgHours: round2(average(summaries.map((item) => item.hours))),
      avgDeliveries: round2(average(summaries.map((item) => item.deliveries)))
    };

    if (totalDays < 2) {
      return {
        canSuggest: false,
        suggestedGoal: 0,
        basis: null,
        status: totalDays ? "Needs more history" : "Needs history",
        explanation: totalDays
          ? "Save at least one more past driving day to generate a local goal recommendation. Today’s partial earnings are ignored."
          : "Save at least two completed driving days to unlock a local goal recommendation. Today’s partial earnings are ignored.",
        buckets,
        currentBucket,
        totalDays
      };
    }

    const usesWeekday = currentBucket.days >= 2;
    const basis = usesWeekday ? currentBucket : overall;
    const suggestedGoal = roundGoal(basis.avgEarnings);
    const currentGoal = Number(settings.dailyGoal || 0);
    const difference = round2(suggestedGoal - currentGoal);
    const comparison = Math.abs(difference) < 1
      ? "That is about the same as your current goal."
      : difference > 0
        ? `That is ${money.format(difference)} above your current goal.`
        : `That is ${money.format(Math.abs(difference))} below your current goal.`;
    const explanation = usesWeekday
      ? `Based on ${basis.days} past ${basis.name}s, you average ${money.format(basis.avgEarnings)} gross, ${money.format(basis.avgProfit)} estimated profit, and ${formatHours(basis.avgHours)} working. ${comparison}`
      : `You do not have enough ${currentBucket.name} history yet, so this uses ${basis.days} past driving days. Your average is ${money.format(basis.avgEarnings)} gross, ${money.format(basis.avgProfit)} estimated profit, and ${formatHours(basis.avgHours)} working. ${comparison}`;

    return {
      canSuggest: suggestedGoal > 0,
      suggestedGoal,
      basis,
      status: usesWeekday ? `${basis.days} ${basis.name}s` : `${basis.days} saved days`,
      explanation,
      buckets,
      currentBucket,
      totalDays
    };
  }

  function renderSmartGoal() {
    if (!els.smartGoalCard) return;
    const model = buildSmartGoalModel();
    els.smartGoalStatus.textContent = model.status;
    els.smartGoalSuggestion.textContent = model.canSuggest
      ? `Suggested goal: ${money.format(model.suggestedGoal)}`
      : "Not enough saved history for a smart goal yet.";
    els.smartGoalExplanation.textContent = model.explanation;
    els.applySmartGoalBtn.disabled = !model.canSuggest;
    els.applySmartGoalBtn.dataset.goal = model.canSuggest ? String(model.suggestedGoal) : "";
    setStatusClass(els.smartGoalCard, model.canSuggest ? "good" : "neutral");

    const visibleBuckets = model.buckets.filter((bucket) => bucket.days > 0);
    if (!visibleBuckets.length) {
      els.smartGoalStats.className = "smart-goal-stats empty";
      els.smartGoalStats.textContent = "No historical driving days yet.";
      return;
    }

    els.smartGoalStats.className = "smart-goal-stats";
    els.smartGoalStats.innerHTML = visibleBuckets.map((bucket) => `
      <article class="smart-goal-stat${bucket.index === new Date().getDay() ? " current" : ""}">
        <div><strong>${escapeHTML(bucket.name)}</strong><span>${bucket.days} ${bucket.days === 1 ? "day" : "days"}</span></div>
        <div class="smart-goal-stat-grid">
          <span><strong>${money.format(bucket.avgEarnings)}</strong><small>avg gross</small></span>
          <span><strong>${money.format(bucket.avgProfit)}</strong><small>avg profit</small></span>
          <span><strong>${formatHours(bucket.avgHours)}</strong><small>avg hours</small></span>
        </div>
      </article>
    `).join("");
  }

  function applySmartGoal() {
    const model = buildSmartGoalModel();
    if (!model.canSuggest) return toast("Save more past driving days before applying a smart goal.");
    settings = normalizeSettings({ ...settings, dailyGoal: model.suggestedGoal });
    writeJSON(SETTINGS_KEY, settings);
    render();
    toast(`Daily goal updated to ${money.format(model.suggestedGoal)}.`);
  }

  function ignoreSmartGoal() {
    const model = buildSmartGoalModel();
    if (model.canSuggest) toast(`Kept current goal of ${money.format(settings.dailyGoal)}.`);
    else toast("Smart goal ignored. Save more history whenever you are ready.");
  }


  function dateFromDayKey(dateKey) {
    const match = String(dateKey || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return new Date();
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }

  function deliveriesForDay(dateKey) {
    return deliveries
      .filter((delivery) => !delivery.deleted && todayKey(new Date(delivery.createdAt)) === dateKey)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }

  function shiftMillisecondsForDay(dateKey) {
    const dayDate = dateFromDayKey(dateKey);
    const { start: dayStart, end: dayEnd } = localDayBounds(dayDate);
    const history = Array.isArray(shift.shiftHistory) ? shift.shiftHistory : [];
    let total = history.reduce((sum, item) => sum + historyActiveMillisecondsForDay(item, dayStart, dayEnd), 0);
    const now = new Date();
    if (shift.active && shift.startedAt) {
      total += activeShiftMilliseconds(shift.startedAt, now, shift.breaks || [], dayStart, dayEnd);
    } else if (shift.startedAt && shift.endedAt) {
      const alreadySaved = history.some((item) => item.startedAt === shift.startedAt && item.endedAt === shift.endedAt);
      if (!alreadySaved) total += activeShiftMilliseconds(shift.startedAt, shift.endedAt, shift.breaks || [], dayStart, dayEnd);
    }
    return Math.max(0, total);
  }

  function estimateScreenshotWork(rows, idleGapMinutes = 75) {
    const points = (rows || [])
      .filter((row) => validDateValue(row.createdAt))
      .slice()
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    if (!points.length) return { milliseconds: 0, sessions: 0, start: null, end: null };
    const gapLimit = Math.max(15, idleGapMinutes) * 60000;
    const sessions = [];
    let currentStart = new Date(points[0].createdAt).getTime();
    let currentEnd = currentStart + Math.max(0, num(points[0].minutes)) * 60000;
    for (let index = 1; index < points.length; index += 1) {
      const start = new Date(points[index].createdAt).getTime();
      const end = start + Math.max(0, num(points[index].minutes)) * 60000;
      if (start - currentEnd <= gapLimit) {
        currentEnd = Math.max(currentEnd, end, start);
      } else {
        sessions.push({ start: currentStart, end: currentEnd });
        currentStart = start;
        currentEnd = end;
      }
    }
    sessions.push({ start: currentStart, end: currentEnd });
    const milliseconds = sessions.reduce((sum, session) => sum + Math.max(0, session.end - session.start), 0);
    return {
      milliseconds,
      sessions: sessions.length,
      start: new Date(sessions[0].start),
      end: new Date(sessions[sessions.length - 1].end)
    };
  }

  function workSummaryForDay(dateKey, rows = deliveriesForDay(dateKey)) {
    const shiftMilliseconds = shiftMillisecondsForDay(dateKey);
    if (shiftMilliseconds > 0) {
      return { milliseconds: shiftMilliseconds, source: "shift", sessions: 1 };
    }
    const screenshot = estimateScreenshotWork(rows);
    return { ...screenshot, source: "screenshots" };
  }

  function compactDuration(milliseconds) {
    const minutes = Math.max(0, Math.round(Number(milliseconds || 0) / 60000));
    if (!minutes) return "—";
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return hours ? `${hours}h ${String(remainder).padStart(2, "0")}m` : `${remainder}m`;
  }

  function calendarCellHTML(date, currentMonth) {
    const key = todayKey(date);
    const rows = deliveriesForDay(key);
    const summary = calculateForDay(rows);
    const work = workSummaryForDay(key, rows);
    const classes = ["calendar-day"];
    if (date.getMonth() !== currentMonth) classes.push("outside-month");
    if (key === todayKey()) classes.push("today");
    if (key === selectedCalendarDay) classes.push("selected");
    return `
      <button class="${classes.join(" ")}" data-calendar-day="${escapeHTML(key)}" type="button" role="gridcell" aria-label="${escapeHTML(date.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" }))}">
        <span class="calendar-day-number">${date.getDate()}</span>
        ${rows.length ? `<span class="calendar-day-indicator" aria-hidden="true"></span>` : ""}
        ${rows.length ? `<span class="calendar-day-earnings">${money.format(summary.earnings)}</span>` : ""}
        ${rows.length ? `<span class="calendar-day-meta">${rows.length} ${rows.length === 1 ? "order" : "orders"}</span>` : ""}
        ${work.milliseconds ? `<span class="calendar-day-meta work-meta">${compactDuration(work.milliseconds)}</span>` : ""}
      </button>`;
  }

  function renderCalendar() {
    if (!els.calendarGrid) return;
    const year = calendarCursor.getFullYear();
    const month = calendarCursor.getMonth();
    const first = new Date(year, month, 1, 12, 0, 0, 0);
    const gridStart = new Date(first);
    gridStart.setDate(1 - first.getDay());
    els.calendarMonthLabel.textContent = first.toLocaleDateString([], { month: "long", year: "numeric" });
    const cells = [];
    for (let index = 0; index < 42; index += 1) {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      cells.push(calendarCellHTML(date, month));
    }
    els.calendarGrid.innerHTML = cells.join("");
    renderSelectedCalendarDay();
  }

  function renderSelectedCalendarDay() {
    if (!els.calendarDayList) return;
    const rows = deliveriesForDay(selectedCalendarDay);
    const summary = calculateForDay(rows);
    const work = workSummaryForDay(selectedCalendarDay, rows);
    const selectedDate = dateFromDayKey(selectedCalendarDay);
    els.calendarSelectedLabel.textContent = selectedDate.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    if (!rows.length) {
      els.calendarDaySummary.className = "calendar-day-summary empty";
      els.calendarDaySummary.textContent = "No deliveries saved for this day.";
      els.calendarDayList.className = "history-list empty";
      els.calendarDayList.textContent = "Use Add to day to create a historical entry or scan a screenshot with a readable timestamp.";
    } else {
      els.calendarDaySummary.className = "calendar-day-summary";
      els.calendarDaySummary.innerHTML = `
        <span><strong>${money.format(summary.earnings)}</strong><small>earnings</small></span>
        <span><strong>${money.format(summary.profit)}</strong><small>estimated profit</small></span>
        <span><strong>${summary.miles.toFixed(1)} mi</strong><small>business miles</small></span>
        <span><strong>${compactDuration(work.milliseconds)}</strong><small>${work.source === "shift" ? "shift time" : "screenshot estimate"}</small></span>`;
      els.calendarDayList.className = "history-list";
      els.calendarDayList.innerHTML = rows.slice().reverse().map((row) => renderHistoryItem(row)).join("");
    }
    if (els.calendarWorkNote) {
      els.calendarWorkNote.innerHTML = work.source === "shift"
        ? `<span class="calendar-work-source">Work time comes from saved Start/Pause/Resume/End shift data.</span>`
        : rows.length > 1
          ? `<span class="calendar-work-source">Estimated from ${rows.length} delivery timestamps using a 75-minute session-gap rule.</span> Review dates and times for accuracy.`
          : "Add another timestamp or enter delivery minutes to improve the work-time estimate.";
    }
  }

  function selectCalendarDay(dateKey) {
    selectedCalendarDay = dateKey;
    const selected = dateFromDayKey(dateKey);
    if (selected.getMonth() !== calendarCursor.getMonth() || selected.getFullYear() !== calendarCursor.getFullYear()) {
      calendarCursor = new Date(selected.getFullYear(), selected.getMonth(), 1);
    }
    renderCalendar();
  }

  function moveCalendarMonth(offset) {
    calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + offset, 1);
    renderCalendar();
  }

  function showSavedDeliveryDay(delivery) {
    const key = todayKey(new Date(delivery.createdAt));
    if (key === todayKey()) {
      showTab("today");
      return;
    }
    selectedCalendarDay = key;
    const date = dateFromDayKey(key);
    calendarCursor = new Date(date.getFullYear(), date.getMonth(), 1);
    renderCalendar();
    showTab("calendar");
  }

  function addDeliveryToCalendarDay() {
    const selected = dateFromDayKey(selectedCalendarDay);
    const now = new Date();
    els.editDeliveryId.value = "";
    els.companyInput.value = settings.defaultCompany || "DoorDash";
    els.zoneInput.value = settings.defaultZone || "";
    els.deliveryDateInput.value = localDateInputValue(selected);
    els.deliveryTimeInput.value = selectedCalendarDay === todayKey() ? localTimeInputValue(now) : "12:00";
    els.earningsInput.value = "";
    els.milesInput.value = "";
    els.minutesInput.value = "";
    if (els.merchantInput) els.merchantInput.value = "";
    els.notesInput.value = "";
    showTab("add");
    renderDeliveryPreview();
  }

  function renderHistory() {
    const activeDeliveries = deliveries.filter((item) => !item.deleted);
    if (!activeDeliveries.length) {
      els.historyList.className = "history-list empty";
      els.historyList.innerHTML = `No deliveries yet. Use Quick Add or manual entry to start tracking pay, miles, profit, and tax records.<br><button class="primary-btn compact empty-action" data-open-add="manual" type="button" aria-label="Add your first delivery manually">Add your first delivery</button>`;
      return;
    }
    els.historyList.className = "history-list";
    const grouped = new Map();
    for (const d of activeDeliveries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))) {
      const key = todayKey(new Date(d.createdAt));
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(d);
    }
    const entries = [...grouped.entries()];
    const visibleEntries = entries.slice(0, historyDayLimit);
    const remainingDays = Math.max(0, entries.length - visibleEntries.length);
    const loadMore = remainingDays
      ? `<div class="history-load-more"><button class="secondary-btn full" data-history-more type="button">Show older history (${remainingDays} ${remainingDays === 1 ? "day" : "days"} remaining)</button></div>`
      : "";
    els.historyList.innerHTML = visibleEntries.map(([dateKey, rows]) => renderHistoryDay(dateKey, rows)).join("") + loadMore;
  }

  function renderHistoryDay(dateKey, rows) {
    const c = calculateForDay(rows);
    const work = workSummaryForDay(dateKey, rows);
    const title = dateLabel(dateKey);
    return `
      <section class="history-day" data-history-day="${escapeHTML(dateKey)}">
        <div class="day-summary">
          <div>
            <strong>${escapeHTML(title)}</strong>
            <span>${rows.length} ${rows.length === 1 ? "delivery" : "deliveries"} · ${c.miles.toFixed(1)} mi</span>
          </div>
          <div>
            <strong>${money.format(c.earnings)}</strong>
            <span>${money.format(c.profit)} profit</span>
          </div>
        </div>
        <div class="day-metrics" aria-label="${escapeHTML(title)} day metrics">
          <span><strong>${money.format(c.avgMile)}</strong><small>avg $/mile</small></span>
          <span><strong>${c.avgHour ? `${money.format(c.avgHour)}/hr` : "—"}</strong><small>gross/hour</small></span>
          <span><strong>${compactDuration(work.milliseconds)}</strong><small>${work.source === "shift" ? "shift time" : "screenshot time"}</small></span>
        </div>
        ${rows.map((d) => renderHistoryItem(d)).join("")}
      </section>
    `;
  }

  function calculateForDay(rows) {
    return ProfitEngine.summarizeRows(rows, { config: settings, activeShift: false });
  }

  function merchantTypeLabel(value) {
    if (value === "store") return "Store";
    if (value === "restaurant") return "Restaurant";
    return "Merchant";
  }

  function timestampSourceLabel(value) {
    if (value === "ocr") return "OCR time";
    if (value === "file") return "Photo time";
    if (value === "import") return "Imported time";
    if (value === "manual") return "Manual time";
    return "Saved time";
  }

  function renderHistoryItem(d) {
    const earnings = Number(d.earnings || 0);
    const miles = Number(d.miles || 0);
    const minutes = Number(d.minutes || 0);
    const perMile = grossDollarPerMile(earnings, miles);
    const profit = estimatedDeliveryProfit(d);
    const date = new Date(d.createdAt).toLocaleString([], { hour: "numeric", minute: "2-digit" });
    const zoneLabel = d.zone || "Unassigned";
    return `
      <article class="history-item platform-card ${platformClassName(d.company)}" data-delivery-id="${escapeHTML(d.id)}">
        <div class="history-top"><span class="platform-pill">${escapeHTML(d.company)}</span><strong>${money.format(earnings)}</strong></div>
        <div class="history-detail-grid" aria-label="Delivery details">
          <span><strong>${miles.toFixed(1)}</strong><small>miles</small></span>
          <span><strong>${minutes ? `${minutes}m` : "—"}</strong><small>minutes</small></span>
          <span><strong>${money.format(perMile)}</strong><small>$/mile</small></span>
          <span><strong>${money.format(profit)}</strong><small>profit</small></span>
        </div>
        <div class="history-meta">${date} · Zone: ${escapeHTML(zoneLabel)} · <span class="source-pill">${escapeHTML(sourceLabel(d.source))}</span><span class="timestamp-source-pill">${escapeHTML(timestampSourceLabel(d.timestampSource))}</span></div>
        ${d.merchant ? `<div class="history-meta merchant-meta">${merchantTypeLabel(d.merchantType)}: ${escapeHTML(d.merchant)}</div>` : ""}
        ${d.notes ? `<div class="history-meta">${escapeHTML(d.notes)}</div>` : ""}
        <div class="history-actions" aria-label="Delivery actions">
          <button class="mini-btn" data-edit="${escapeHTML(d.id)}" type="button">Edit</button>
          <button class="mini-btn" data-duplicate="${escapeHTML(d.id)}" type="button">Duplicate</button>
          <button class="delete-mini" data-delete="${escapeHTML(d.id)}" type="button">Delete</button>
        </div>
      </article>
    `;
  }

  function renderZoneControls() {
    renderZoneOptions();
    renderCustomZoneList();
  }

  function renderZoneOptions() {
    if (!els.zoneOptions) return;
    const zones = knownZones();
    els.zoneOptions.innerHTML = zones.map((zone) => `<option value="${escapeHTML(zone)}"></option>`).join("");
  }

  function renderCustomZoneList() {
    if (!els.customZoneList) return;
    const zones = normalizeCustomZones(settings.customZones || []);
    if (!zones.length) {
      els.customZoneList.className = "zone-list empty";
      els.customZoneList.textContent = "No custom zones yet. Add the areas you actually drive, like South City, Kirkwood, Downtown, or Clayton.";
      return;
    }
    els.customZoneList.className = "zone-list";
    const deliveryCounts = new Map();
    deliveries.forEach((delivery) => {
      if (delivery.deleted) return;
      const key = zoneKey(delivery.zone);
      if (key) deliveryCounts.set(key, (deliveryCounts.get(key) || 0) + 1);
    });
    els.customZoneList.innerHTML = zones.map((zone) => {
      const matching = deliveryCounts.get(zoneKey(zone)) || 0;
      return `
        <article class="zone-row">
          <div>
            <strong>${escapeHTML(zone)}</strong>
            <span>${matching} saved ${matching === 1 ? "delivery" : "deliveries"}</span>
          </div>
          <div class="zone-row-actions">
            <button class="secondary-btn compact" type="button" data-zone-rename="${escapeHTML(zone)}">Rename</button>
            <button class="danger-btn compact" type="button" data-zone-delete="${escapeHTML(zone)}">Delete</button>
          </div>
        </article>
      `;
    }).join("");
  }

  function addCustomZone() {
    const zone = zoneName(els.customZoneInput.value);
    if (!zone) {
      toast("Enter a zone name first.");
      flagInvalid(els.customZoneInput);
      return;
    }
    const zones = normalizeCustomZones(settings.customZones || []);
    if (zones.some((item) => zoneKey(item) === zoneKey(zone))) {
      toast(`${zone} is already in your custom zones.`);
      els.customZoneInput.value = "";
      return;
    }
    settings = normalizeSettings({ ...settings, customZones: [...zones, zone], defaultZone: settings.defaultZone || zone });
    writeJSON(SETTINGS_KEY, settings);
    els.customZoneInput.value = "";
    render();
    toast(`Added ${zone} to custom zones.`);
  }

  function handleCustomZoneAction(event) {
    const renameButton = event.target.closest("[data-zone-rename]");
    const deleteButton = event.target.closest("[data-zone-delete]");
    if (renameButton) {
      renameCustomZone(renameButton.dataset.zoneRename);
      return;
    }
    if (deleteButton) deleteCustomZone(deleteButton.dataset.zoneDelete);
  }

  function renameCustomZone(oldZone) {
    const oldName = zoneName(oldZone);
    if (!oldName) return;
    const nextName = zoneName(prompt(`Rename ${oldName} to:`, oldName));
    if (!nextName || zoneKey(nextName) === zoneKey(oldName)) return;
    const zones = normalizeCustomZones(settings.customZones || []);
    if (zones.some((zone) => zoneKey(zone) === zoneKey(nextName))) {
      toast(`${nextName} already exists.`);
      return;
    }
    const shouldUpdateDeliveries = activeDeliveries().some((delivery) => zoneKey(delivery.zone) === zoneKey(oldName))
      ? confirm(`Update saved deliveries from ${oldName} to ${nextName}?`)
      : false;
    settings = normalizeSettings({
      ...settings,
      defaultZone: zoneKey(settings.defaultZone) === zoneKey(oldName) ? nextName : settings.defaultZone,
      customZones: zones.map((zone) => zoneKey(zone) === zoneKey(oldName) ? nextName : zone)
    });
    if (shouldUpdateDeliveries) {
      deliveries = deliveries.map((delivery) => {
        if (zoneKey(delivery.zone) !== zoneKey(oldName)) return delivery;
        return normalizeDelivery({ ...delivery, zone: nextName, updatedAt: new Date().toISOString() }) || delivery;
      });
      writeJSON(STORE_KEY, deliveries);
    }
    writeJSON(SETTINGS_KEY, settings);
    render();
    toast(shouldUpdateDeliveries ? `Renamed ${oldName} and updated matching deliveries.` : `Renamed custom zone to ${nextName}.`);
  }

  function deleteCustomZone(zone) {
    const name = zoneName(zone);
    if (!name) return;
    if (!confirm(`Delete ${name} from custom zones? Saved deliveries keep their existing zone labels.`)) return;
    const zones = normalizeCustomZones(settings.customZones || []).filter((item) => zoneKey(item) !== zoneKey(name));
    settings = normalizeSettings({
      ...settings,
      defaultZone: zoneKey(settings.defaultZone) === zoneKey(name) ? "" : settings.defaultZone,
      customZones: zones
    });
    writeJSON(SETTINGS_KEY, settings);
    render();
    toast(`${name} removed from custom zones. Saved deliveries were not deleted.`);
  }

  function buildZoneHeatmapModel(rows) {
    const groups = rankedGroups(rows, "zone").filter((group) => group.name !== "Unassigned");
    const used = new Set();
    const pick = (candidates) => {
      const found = candidates.find((group) => group && !used.has(group.name));
      if (found) used.add(found.name);
      return found || null;
    };
    const best = pick(groups);
    const reliable = pick(groups.filter((group) => group.count >= 2 && (group.avgProfitHour >= settings.minPerHour || group.avgProfitPerMile >= settings.minPerMile)));
    const lowRanked = [...groups].reverse();
    const avoid = pick(lowRanked.filter((group) => group.avgProfitPerMile < settings.minPerMile || group.avgProfitHour < settings.minPerHour));
    const weak = pick(lowRanked);
    return {
      groups,
      roles: [
        { key: "best", title: "Best Zone", status: "good", group: best, hint: "Highest current mix of profit pace, $/mile, and total value." },
        { key: "reliable", title: "Reliable Zone", status: "neutral", group: reliable, hint: "Strong repeat performer with enough saved deliveries to trust more." },
        { key: "weak", title: "Weak Zone", status: "warning", group: weak, hint: "Lower performer. Watch wait time, distance, or order quality here." },
        { key: "avoid", title: "Avoid Zone", status: "danger", group: avoid, hint: "Lowest performer versus your saved zone history and thresholds." }
      ]
    };
  }

  function renderZoneHeatmap(rows) {
    if (!els.zoneHeatmapGrid) return;
    const model = buildZoneHeatmapModel(rows);
    const count = model.groups.length;
    if (els.zoneHeatmapStatus) els.zoneHeatmapStatus.textContent = count ? `${count} zones` : "Needs zones";
    if (els.zoneHeatmapExplanation) {
      els.zoneHeatmapExplanation.textContent = count
        ? "This GPS-free map ranks the manual zones saved on your deliveries. Rename/delete custom zones in Settings without needing location permissions."
        : "Add zone names to deliveries or create custom zones in Settings to build a manual heatmap without GPS.";
    }
    if (!count) {
      els.zoneHeatmapGrid.className = "zone-heatmap-grid empty";
      els.zoneHeatmapGrid.textContent = "No zone performance yet. Add zones like South City, Downtown, Kirkwood, or Clayton to your deliveries.";
      return;
    }
    els.zoneHeatmapGrid.className = "zone-heatmap-grid";
    els.zoneHeatmapGrid.innerHTML = model.roles.map((role) => renderZoneHeatmapCard(role)).join("");
  }

  function renderZoneHeatmapCard(role) {
    const group = role.group;
    if (!group) {
      return `
        <article class="zone-heat-card status-neutral">
          <span class="zone-map-label">${escapeHTML(role.title)}</span>
          <strong>Need more data</strong>
          <p>${escapeHTML(role.hint)}</p>
        </article>
      `;
    }
    return `
      <article class="zone-heat-card status-${escapeHTML(role.status)}">
        <span class="zone-map-label">${escapeHTML(role.title)}</span>
        <strong>${escapeHTML(group.name)}</strong>
        <p>${escapeHTML(role.hint)}</p>
        <div class="analytics-metrics compact-metrics">
          <span><strong>${money.format(group.profit)}</strong><small>profit</small></span>
          <span><strong>${money.format(group.avgProfitPerMile)}</strong><small>profit/mi</small></span>
          <span><strong>${money.format(group.avgProfitHour)}</strong><small>profit/hr</small></span>
          <span><strong>${group.count}</strong><small>orders</small></span>
        </div>
      </article>
    `;
  }

  function sourceLabel(source) {
    if (source === "ocr") return "OCR";
    if (source === "calculator") return "Calculator";
    if (source === "import") return "Import";
    return "Manual";
  }

  function platformClassName(company) {
    return `platform-${String(company || "other").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  }

  function dateLabel(dateKey) {
    if (dateKey === todayKey()) return "Today";
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (dateKey === todayKey(yesterday)) return "Yesterday";
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  }

  function renderSettings() {
    const pairs = [
      [els.goalInput, settings.dailyGoal],
      [els.defaultCompanyInput, settings.defaultCompany],
      [els.gasPriceInput, settings.gasPrice],
      [els.mpgInput, settings.mpg],
      [els.maintenanceInput, settings.maintenancePerMile],
      [els.taxRateInput, settings.taxMileageRate],
      [els.minPerMileInput, settings.minPerMile],
      [els.minPerHourInput, settings.minPerHour],
      [els.minPayoutInput, settings.minPayout],
      [els.maxMilesInput, settings.maxMiles],
      [els.defaultZoneInput, settings.defaultZone]
    ];
    for (const [input, value] of pairs) {
      if (document.activeElement !== input) input.value = value ?? "";
    }
    if (els.taxRateModeInput && document.activeElement !== els.taxRateModeInput) {
      els.taxRateModeInput.value = settings.mileageDeductionMode;
    }
    renderTaxRateMode();
  }

  function renderTaxRateMode() {
    if (!els.taxRateInput || !els.taxRateModeInput) return;
    const automatic = els.taxRateModeInput.value === "automatic";
    els.taxRateInput.disabled = automatic;
    els.taxRateInput.setAttribute("aria-disabled", String(automatic));
    if (els.taxRateHelp) {
      els.taxRateHelp.textContent = automatic
        ? "Automatic uses 72.5¢/mi for Jan–Jun 2026 and 76¢/mi for Jul–Dec 2026, while preserving the saved date on each delivery."
        : "Custom applies this fixed rate to every saved delivery. Verify tax treatment with a qualified professional.";
    }
  }

  function driveLedgerStorageKeys() {
    const known = [STORE_KEY, DECISIONS_KEY, SETTINGS_KEY, SHIFT_KEY, ROLLBACK_KEY, LAST_BACKUP_KEY, OCR_LEARNING_KEY];
    const found = new Set(known);
    try {
      if (typeof localStorage.length === "number" && typeof localStorage.key === "function") {
        for (let i = 0; i < localStorage.length; i += 1) {
          const key = localStorage.key(i);
          if (key && (key.startsWith("giglens.") || key.startsWith("driveledger."))) found.add(key);
        }
      }
    } catch {
      // Some privacy modes can block key iteration; known app keys still provide a useful estimate.
    }
    return [...found].sort();
  }

  function storageUsageEstimate() {
    const rows = driveLedgerStorageKeys().map((key) => {
      const raw = localStorage.getItem(key) || "";
      return { key, bytes: raw.length * 2, present: raw.length > 0 };
    });
    const totalBytes = rows.reduce((sum, row) => sum + row.bytes, 0);
    return { rows, totalBytes };
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
    if (bytes < 1024) return `${Math.round(bytes)} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function renderPrivacyCenter() {
    if (!els.storageUsageEstimate || !els.storageUsageDetails) return;
    const usage = storageUsageEstimate();
    const activeCount = usage.rows.filter((row) => row.present).length;
    if (els.privacyStorageStatus) els.privacyStorageStatus.textContent = activeCount ? `${formatBytes(usage.totalBytes)} local` : "Local only";
    els.storageUsageEstimate.innerHTML = `
      <strong>${formatBytes(usage.totalBytes)}</strong> estimated GigLens localStorage usage
      <span>${activeCount} active local key${activeCount === 1 ? "" : "s"}</span>
    `;
    const presentRows = usage.rows.filter((row) => row.present);
    if (!presentRows.length) {
      els.storageUsageDetails.className = "privacy-key-list empty";
      els.storageUsageDetails.textContent = "No saved GigLens data yet. Add deliveries or save settings to create local records.";
      return;
    }
    els.storageUsageDetails.className = "privacy-key-list";
    els.storageUsageDetails.innerHTML = presentRows.map((row) => `
      <div><span>${escapeHTML(row.key)}</span><strong>${formatBytes(row.bytes)}</strong></div>
    `).join("");
  }

  function renderShiftButton() {
    const running = Boolean(shift.active && shift.startedAt);
    const label = running ? "End Day" : "Start Day";
    els.shiftBtn.textContent = label;
    if (els.heroShiftBtn) els.heroShiftBtn.textContent = label;
    if (els.pauseShiftBtn) {
      els.pauseShiftBtn.disabled = !running;
      els.pauseShiftBtn.textContent = shift.paused ? "Resume" : "Pause";
      els.pauseShiftBtn.setAttribute("aria-label", shift.paused ? "Resume the driving shift" : "Pause the driving shift for a break");
    }
  }

  function renderDeliveryPreview() {
    if (!els.deliveryPreview) return;
    const earnings = num(els.earningsInput.value);
    const milesRaw = String(els.milesInput.value || "").trim();
    const miles = num(els.milesInput.value);
    const minutes = num(els.minutesInput.value);
    if (!earnings || milesRaw === "" || miles < 0) {
      els.deliveryPreview.textContent = "Enter earnings and miles to preview profit.";
      els.deliveryPreview.className = "delivery-preview";
      return;
    }
    const profit = estimatedDeliveryProfit({ earnings, miles });
    const perMile = grossDollarPerMile(earnings, miles);
    const profitMile = estimatedProfitPerMile(profit, miles);
    const hourly = grossHourlyRate(earnings, minutes);
    const good = miles === 0
      ? earnings >= settings.minPayout
      : perMile >= settings.minPerMile && (!minutes || hourly >= settings.minPerHour);
    els.deliveryPreview.className = `delivery-preview ${good ? "good" : "bad"}`;
    els.deliveryPreview.textContent = miles === 0
      ? `${money.format(profit)} estimated profit · mileage not tracked yet${minutes ? ` · ${money.format(hourly)}/hr` : ""}`
      : `${money.format(profit)} estimated profit · ${money.format(perMile)}/mi gross · ${money.format(profitMile)}/mi profit${minutes ? ` · ${money.format(hourly)}/hr` : ""}`;
  }

  function renderDecision({ announce = false } = {}) {
    const pay = num(els.offerPayInput.value);
    const miles = num(els.offerMilesInput.value);
    const minutes = num(els.offerMinutesInput.value);
    const decision = evaluateOffer(pay, miles, minutes);
    els.decisionResult.className = `decision-card ${decision.kind}`;
    els.decisionResult.innerHTML = `
      <p class="label">Decision</p>
      <h2>${escapeHTML(decision.title)}</h2>
      <p>${escapeHTML(decision.detail)}</p>
      ${decision.metrics?.length ? `<div class="decision-metrics">${decision.metrics.map((m) => `<span>${escapeHTML(m)}</span>`).join("")}</div>` : ""}
      ${decision.thresholds?.length ? `<div class="threshold-list">${decision.thresholds.map((item) => `
        <div class="threshold-row ${item.passed ? "passed" : "failed"}">
          <span>${escapeHTML(item.label)}</span>
          <strong>${item.passed ? "Pass" : "Fail"}</strong>
          <small>${escapeHTML(item.actual)} vs ${escapeHTML(item.target)}</small>
        </div>
      `).join("")}</div>` : ""}
    `;
    if (announce) toast(`${decision.title}: ${decision.detail}`);
    return decision;
  }

  function evaluateOffer(pay, miles, minutes) {
    const validation = [];
    if (!(pay > 0)) validation.push("pay must be greater than $0");
    if (!(miles > 0)) validation.push("miles must be greater than 0");
    if (!(minutes > 0)) validation.push("estimated minutes must be greater than 0");
    if (validation.length) {
      return {
        kind: "neutral",
        title: "Enter a valid offer",
        detail: `Fix input: ${validation.join(", ")}.`,
        metrics: ["No decision yet"],
        thresholds: []
      };
    }

    const grossPerMile = grossDollarPerMile(pay, miles);
    const grossHourly = grossHourlyRate(pay, minutes);
    const profit = estimatedDeliveryProfit({ earnings: pay, miles });
    const profitPerMile = estimatedProfitPerMile(profit, miles);
    const profitHourly = profitHourlyRate(profit, minutes);
    const thresholdRows = buildOfferThresholds({ pay, miles, grossPerMile, grossHourly, profit });
    const failed = thresholdRows.filter((row) => !row.passed);
    const severeFailures = thresholdRows.filter((row) => !row.passed && row.severe);
    const metrics = [
      `${money.format(grossPerMile)}/mile gross`,
      `${money.format(grossHourly)}/hr gross`,
      `${money.format(profit)} profit`,
      `${money.format(profitPerMile)}/mile profit`,
      `${money.format(profitHourly)}/hr profit`
    ];

    if (!failed.length) {
      return {
        kind: "accept",
        title: "ACCEPT",
        detail: `Above your minimums. Estimated profit is ${money.format(profit)} after vehicle costs.`,
        metrics,
        thresholds: thresholdRows
      };
    }

    if (!severeFailures.length && failed.length <= 2) {
      return {
        kind: "borderline",
        title: "BORDERLINE",
        detail: `Close call: ${failed.map((row) => row.reason).join("; ")}. Consider wait time, restaurant speed, and drop-off difficulty.`,
        metrics,
        thresholds: thresholdRows
      };
    }

    return {
      kind: "decline",
      title: "DECLINE",
      detail: `Too weak: ${failed.map((row) => row.reason).join("; ")}. Estimated profit is ${money.format(profit)} after vehicle costs.`,
      metrics,
      thresholds: thresholdRows
    };
  }

  function buildOfferThresholds({ pay, miles, grossPerMile, grossHourly, profit }) {
    const rows = [];
    if (settings.minPayout > 0) {
      rows.push(makeThreshold({
        label: "Minimum payout",
        actualValue: pay,
        targetValue: settings.minPayout,
        passed: pay >= settings.minPayout,
        actual: money.format(pay),
        target: `${money.format(settings.minPayout)}+`,
        reason: `${money.format(pay)} payout is below your ${money.format(settings.minPayout)} minimum`,
        severe: pay < settings.minPayout * 0.8
      }));
    }
    if (settings.minPerMile > 0) {
      rows.push(makeThreshold({
        label: "Gross $/mile",
        actualValue: grossPerMile,
        targetValue: settings.minPerMile,
        passed: grossPerMile >= settings.minPerMile,
        actual: `${money.format(grossPerMile)}/mile`,
        target: `${money.format(settings.minPerMile)}/mile+`,
        reason: `${money.format(grossPerMile)}/mile is below your ${money.format(settings.minPerMile)}/mile minimum`,
        severe: grossPerMile < settings.minPerMile * 0.8
      }));
    }
    if (settings.minPerHour > 0) {
      rows.push(makeThreshold({
        label: "Gross hourly pace",
        actualValue: grossHourly,
        targetValue: settings.minPerHour,
        passed: grossHourly >= settings.minPerHour,
        actual: `${money.format(grossHourly)}/hr`,
        target: `${money.format(settings.minPerHour)}/hr+`,
        reason: `${money.format(grossHourly)}/hr is below your ${money.format(settings.minPerHour)}/hr minimum`,
        severe: grossHourly < settings.minPerHour * 0.8
      }));
    }
    if (settings.maxMiles > 0) {
      rows.push(makeThreshold({
        label: "Maximum distance",
        actualValue: miles,
        targetValue: settings.maxMiles,
        passed: miles <= settings.maxMiles,
        actual: `${round1(miles)} miles`,
        target: `${round1(settings.maxMiles)} miles or less`,
        reason: `${round1(miles)} miles is over your ${round1(settings.maxMiles)} mile maximum`,
        severe: miles > settings.maxMiles * 1.2
      }));
    }
    rows.push(makeThreshold({
      label: "Estimated profit",
      actualValue: profit,
      targetValue: 0,
      passed: profit > 0,
      actual: money.format(profit),
      target: "positive after vehicle costs",
      reason: "estimated profit is not positive after gas and maintenance",
      severe: profit <= 0
    }));
    return rows;
  }

  function makeThreshold(row) {
    return {
      label: row.label,
      actual: row.actual,
      target: row.target,
      passed: Boolean(row.passed),
      reason: row.reason,
      severe: Boolean(row.severe)
    };
  }

  function buildDecisionSummaryText(decision = renderDecision()) {
    const company = allowedCompanies.has(els.offerCompanyInput.value) ? els.offerCompanyInput.value : settings.defaultCompany;
    const zone = cleanText(els.offerZoneInput.value || settings.defaultZone || "", 80) || "Unspecified zone";
    const note = cleanText(els.offerNoteInput.value || "", 200);
    const lines = [
      `GigLens order decision: ${decision.title}`,
      `Company: ${company}`,
      `Zone: ${zone}`,
      `Pay: ${money.format(num(els.offerPayInput.value))}`,
      `Miles: ${round1(num(els.offerMilesInput.value))}`,
      `Minutes: ${round1(num(els.offerMinutesInput.value))}`,
      `Reason: ${decision.detail}`
    ];
    if (decision.metrics?.length) lines.push(`Metrics: ${decision.metrics.join(" | ")}`);
    if (decision.thresholds?.length) lines.push(`Rules: ${decision.thresholds.map((row) => `${row.label} ${row.passed ? "PASS" : "FAIL"} (${row.actual} vs ${row.target})`).join(" | ")}`);
    if (note) lines.push(`Note: ${note}`);
    return lines.join("\n");
  }

  async function copyDecisionSummary() {
    const decision = renderDecision();
    if (decision.kind === "neutral") return toast("Enter a valid offer before copying a decision.");
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") return toast("Copy is not available in this browser.");
    try {
      await navigator.clipboard.writeText(buildDecisionSummaryText(decision));
      toast("Decision copied.");
    } catch {
      toast("Copy is not available in this browser.");
    }
  }

  function clearOfferCalculator({ keepCompany = true } = {}) {
    els.offerPayInput.value = "";
    els.offerMilesInput.value = "";
    els.offerMinutesInput.value = "";
    els.offerZoneInput.value = settings.defaultZone || "";
    els.offerNoteInput.value = "";
    if (!keepCompany) els.offerCompanyInput.value = settings.defaultCompany;
    renderDecision();
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;"
    }[ch]));
  }

  function makeId() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") return globalThis.crypto.randomUUID();
    if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      globalThis.crypto.getRandomValues(bytes);
      return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function round2(v) { return Math.round(Number(v || 0) * 100) / 100; }
  function round1(v) { return Math.round(Number(v || 0) * 10) / 10; }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

  function showTab(tab) {
    const screen = $(`tab-${tab}`);
    const button = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
    if (!screen || !button) {
      console.warn(`Unknown tab requested: ${tab}`);
      return;
    }
    document.querySelectorAll(".tab-screen").forEach((el) => el.classList.remove("active"));
    document.querySelectorAll(".tab-btn").forEach((el) => el.classList.remove("active"));
    screen.classList.add("active");
    button.classList.add("active");
  }

  function openAdd(mode = "manual") {
    showTab("add");
    if (!els.editDeliveryId.value) {
      els.companyInput.value = settings.defaultCompany || "DoorDash";
      els.zoneInput.value = settings.defaultZone || "";
      const now = new Date();
      if (els.deliveryDateInput) els.deliveryDateInput.value = localDateInputValue(now);
      if (els.deliveryTimeInput) els.deliveryTimeInput.value = localTimeInputValue(now);
    }
    if (mode === "scan") {
      setTimeout(() => {
        if (els.screenshotInput && typeof els.screenshotInput.click === "function") els.screenshotInput.click();
      }, 80);
    } else if (els.earningsInput && typeof els.earningsInput.focus === "function") {
      els.earningsInput.focus();
    }
  }

  function latestDelivery() {
    return deliveries
      .filter((d) => !d.deleted)
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
  }

  function quickDefaultCompany() {
    const last = latestDelivery();
    return allowedCompanies.has(last?.company) ? last.company : (settings.defaultCompany || "DoorDash");
  }

  function quickDefaultZone() {
    const last = latestDelivery();
    return cleanText(last?.zone || settings.defaultZone || "", 80);
  }

  function setQuickAddDefaults(clearValues = true) {
    if (!els.quickAddForm) return;
    els.quickCompanyInput.value = quickDefaultCompany();
    els.quickZoneInput.value = quickDefaultZone();
    const quickNow = new Date();
    if (els.quickDateInput) els.quickDateInput.value = localDateInputValue(quickNow);
    if (els.quickTimeInput) els.quickTimeInput.value = localTimeInputValue(quickNow);
    if (clearValues) {
      [els.quickEarningsInput, els.quickMilesInput, els.quickMinutesInput, els.quickNotesInput, els.quickMerchantInput].forEach((input) => {
        input.value = "";
        input.classList.remove("invalid");
      });
      const nextQuickTime = new Date();
      if (els.quickDateInput) els.quickDateInput.value = localDateInputValue(nextQuickTime);
      if (els.quickTimeInput) els.quickTimeInput.value = localTimeInputValue(nextQuickTime);
      els.quickNotesDetails.open = false;
      if (els.quickManualDetails) els.quickManualDetails.open = true;
      clearQuickScan(true);
    }
    renderQuickAddPreview();
  }

  function openQuickAdd() {
    setQuickAddDefaults(true);
    els.quickAddSheet.classList.remove("hidden");
    els.quickAddSheet.setAttribute("aria-hidden", "false");
    document.body.classList.add("sheet-open");
    setTimeout(() => {
      if (els.quickScreenshotInput && typeof els.quickScreenshotInput.focus === "function") els.quickScreenshotInput.focus();
    }, 40);
  }

  function closeQuickAdd() {
    quickScanGeneration += 1;
    els.quickAddSheet.classList.add("hidden");
    els.quickAddSheet.setAttribute("aria-hidden", "true");
    document.body.classList.remove("sheet-open");
  }

  function renderQuickAddPreview() {
    if (!els.quickDeliveryPreview) return;
    const earnings = num(els.quickEarningsInput.value);
    const milesRaw = String(els.quickMilesInput.value || "").trim();
    const miles = num(milesRaw);
    const minutes = num(els.quickMinutesInput.value);
    if (!earnings || milesRaw === "") {
      els.quickDeliveryPreview.textContent = "Enter earnings and miles to preview profit.";
      els.quickDeliveryPreview.className = "delivery-preview";
      return;
    }
    const profit = estimatedDeliveryProfit({ earnings, miles });
    const hourly = grossHourlyRate(earnings, minutes);
    const perMile = grossDollarPerMile(earnings, miles);
    const profitMile = estimatedProfitPerMile(profit, miles);
    const merchant = cleanText(els.quickMerchantInput?.value || "", 120);
    const merchantPrefix = merchant ? `${merchant} · ` : "";
    const sourceSuffix = quickOCRText ? " · scanned" : "";
    const quickTimestamp = combineLocalDateTime(els.quickDateInput?.value, els.quickTimeInput?.value, quickOCRParsed?.capturedAt || new Date());
    const timestampSuffix = ` · ${quickTimestamp.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
    const good = miles === 0 ? earnings >= settings.minPayout : perMile >= settings.minPerMile && (!minutes || hourly >= settings.minPerHour);
    els.quickDeliveryPreview.className = `delivery-preview ${good ? "good" : "bad"}`;
    if (miles === 0) {
      els.quickDeliveryPreview.textContent = `${merchantPrefix}${money.format(profit)} estimated profit · mileage not tracked yet${minutes ? ` · ${money.format(hourly)}/hr` : ""}${timestampSuffix}${sourceSuffix}`;
      return;
    }
    els.quickDeliveryPreview.textContent = `${merchantPrefix}${money.format(profit)} estimated profit · ${money.format(perMile)}/mi gross · ${money.format(profitMile)}/mi profit${minutes ? ` · ${money.format(hourly)}/hr` : ""}${timestampSuffix}${sourceSuffix}`;
  }

  function readQuickNumber(input, label, { required = false, allowZero = true } = {}) {
    const raw = String(input.value || "").trim();
    if (required && raw === "") {
      toast(`Enter ${label}.`);
      flagInvalid(input);
      return null;
    }
    const value = num(raw);
    if ((!allowZero && value <= 0) || (allowZero && value < 0)) {
      toast(`${label} must be ${allowZero ? "0 or more" : "greater than 0"}.`);
      flagInvalid(input);
      return null;
    }
    return value;
  }

  function setQuickScanState(state, message) {
    if (!els.quickScanStatus) return;
    els.quickScanStatus.classList.remove("hidden", "loading", "success", "failed");
    els.quickScanStatus.classList.add(state);
    els.quickScanStatus.textContent = message;
  }

  function populateQuickFromOCR(parsed) {
    if (!parsed) return;
    const platform = allowedCompanies.has(parsed.platform) ? parsed.platform : "Other";
    els.quickCompanyInput.value = platform;
    if (els.quickMerchantInput) els.quickMerchantInput.value = parsed.merchant || "";
    els.quickEarningsInput.value = parsed.earnings ? parsed.earnings.toFixed(2) : "";
    els.quickMilesInput.value = parsed.miles ? parsed.miles.toFixed(1) : "";
    els.quickMinutesInput.value = parsed.minutes ? String(parsed.minutes) : "";
    if (parsed.capturedAt && validDateValue(parsed.capturedAt)) {
      if (els.quickDateInput) els.quickDateInput.value = localDateInputValue(parsed.capturedAt);
      if (els.quickTimeInput) els.quickTimeInput.value = localTimeInputValue(parsed.capturedAt);
    }
    if (els.quickManualDetails) els.quickManualDetails.open = true;
    if (els.quickLearningHint) {
      const learned = Array.isArray(parsed.learningApplied) && parsed.learningApplied.length;
      const timestampNote = parsed.timestampSource === "file"
        ? " Date/time uses the image file and needs review."
        : ` Date/time confidence: ${parsed.timestampConfidence || 0}%.`;
      els.quickLearningHint.textContent = (learned
        ? `Local learning helped this scan: ${parsed.learningApplied.join(", ")}. Review before saving.`
        : "Correct any field before saving. GigLens remembers the correction locally for similar future screenshots.") + timestampNote;
    }
    renderQuickAddPreview();
  }

  function clearQuickScan(clearFile = true) {
    quickScanGeneration += 1;
    quickOCRText = "";
    quickOCRParsed = null;
    if (!els.quickScanStatus) return;
    els.quickScanStatus.classList.add("hidden");
    els.quickScanStatus.classList.remove("loading", "success", "failed");
    els.quickScanStatus.textContent = "Ready to scan a screenshot.";
    if (els.quickOcrDetails) els.quickOcrDetails.classList.add("hidden");
    if (els.quickOcrText) els.quickOcrText.textContent = "";
    if (els.quickClearScanBtn) els.quickClearScanBtn.classList.add("hidden");
    if (els.quickLearningHint) els.quickLearningHint.textContent = "Correct any field before saving. GigLens remembers the correction locally for similar future screenshots.";
    if (clearFile && els.quickScreenshotInput) els.quickScreenshotInput.value = "";
    if (clearFile && els.quickPreviewImage) {
      if (els.quickPreviewImage.dataset.url) {
        URL.revokeObjectURL(els.quickPreviewImage.dataset.url);
        delete els.quickPreviewImage.dataset.url;
      }
      els.quickPreviewImage.removeAttribute("src");
      els.quickPreviewImage.classList.add("hidden");
    }
    renderQuickAddPreview();
  }

  function withTimeout(promise, timeoutMs, message) {
    let timeoutId;
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
  }

  function formatOCRProgress(progress) {
    if (!progress || typeof progress !== "object") return "Preparing OCR…";
    const status = String(progress.status || "Processing").replace(/_/g, " ");
    const percent = Number.isFinite(progress.progress) ? ` ${Math.round(progress.progress * 100)}%` : "";
    return `${status.charAt(0).toUpperCase()}${status.slice(1)}${percent}`;
  }

  function hasOCRAPI(api = globalThis.Tesseract) {
    return Boolean(api && (typeof api.createWorker === "function" || typeof api.recognize === "function"));
  }

  function validateScreenshotFile(file) {
    if (!file || typeof file !== "object") return "Choose an image screenshot first.";
    if (file.type && !String(file.type).toLowerCase().startsWith("image/")) return "Choose a browser-supported image such as PNG or JPEG.";
    if (Number(file.size) > MAX_SCREENSHOT_BYTES) return "This image is over 20 MB. Crop it or choose a smaller screenshot.";
    return "";
  }

  function classifyAccentPixel(red, green, blue) {
    if (red >= 170 && green >= 65 && green <= 190 && blue <= 120 && red >= green * 1.15 && green >= blue * 1.2) return "orange";
    if (red >= 155 && green <= 140 && blue <= 145 && red >= green * 1.35 && red >= blue * 1.25) return "red";
    if (green >= 105 && red <= 145 && blue <= 165 && green >= red * 1.2 && green >= blue * 1.04) return "green";
    if (blue >= 130 && red <= 150 && blue >= red * 1.2 && blue >= green * 1.08) return "blue";
    return "";
  }

  async function analyzeScreenshotAccent(file) {
    if (typeof globalThis.createImageBitmap !== "function" || !document?.createElement) return null;
    let bitmap = null;
    try {
      bitmap = await globalThis.createImageBitmap(file);
      if (!bitmap?.width || !bitmap?.height) return null;
      const canvas = document.createElement("canvas");
      const context = typeof canvas.getContext === "function" ? canvas.getContext("2d", { willReadFrequently: true }) : null;
      if (!context || typeof context.getImageData !== "function") return null;
      const width = 160;
      const sourceY = Math.floor(bitmap.height * 0.34);
      const sourceHeight = Math.max(1, bitmap.height - sourceY);
      const height = Math.max(80, Math.round(width * sourceHeight / bitmap.width));
      canvas.width = width;
      canvas.height = height;
      context.drawImage(bitmap, 0, sourceY, bitmap.width, sourceHeight, 0, 0, width, height);
      const pixels = context.getImageData(0, 0, width, height).data;
      const counts = { red: 0, green: 0, orange: 0, blue: 0 };
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3] < 180) continue;
        const color = classifyAccentPixel(pixels[index], pixels[index + 1], pixels[index + 2]);
        if (color) counts[color] += 1;
      }
      const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      const [color, count] = ranked[0];
      const runnerUp = ranked[1]?.[1] || 0;
      const pixelCount = pixels.length / 4;
      const ratio = pixelCount ? count / pixelCount : 0;
      if (ratio < 0.008 || count < runnerUp * 1.35) return null;
      const platformMap = { red: "DoorDash", green: "Uber Eats", orange: "Grubhub" };
      return {
        color,
        platform: platformMap[color] || "",
        candidates: color === "blue" ? ["Spark", "Amazon Flex"] : [],
        confidence: Math.min(90, Math.round(58 + Math.min(ratio, 0.08) * 300))
      };
    } catch (error) {
      console.warn("GigLens skipped optional screenshot color analysis", error);
      return null;
    } finally {
      if (bitmap && typeof bitmap.close === "function") bitmap.close();
    }
  }

  function mergeVisualPlatformEvidence(platformResult, visualEvidence, allowVisualSelection = false) {
    const result = {
      ...platformResult,
      evidence: Array.isArray(platformResult?.evidence) ? [...platformResult.evidence] : []
    };
    if (!visualEvidence) return result;
    const accentLabel = `${visualEvidence.color} interface accent`;
    if (visualEvidence.platform) {
      if (result.platform === visualEvidence.platform) {
        result.platformConfidence = Math.min(99, Math.max(result.platformConfidence || 0, visualEvidence.confidence) + 6);
        result.evidence.push(accentLabel);
      } else if (allowVisualSelection && (!result.platform || (result.platformConfidence || 0) < 58)) {
        result.platform = visualEvidence.platform;
        result.platformConfidence = Math.min(76, visualEvidence.confidence);
        result.evidence = [accentLabel];
      }
    } else if (visualEvidence.color === "blue" && visualEvidence.candidates.includes(result.platform)) {
      result.platformConfidence = Math.min(99, Math.max(result.platformConfidence || 0, visualEvidence.confidence) + 4);
      result.evidence.push(accentLabel);
    }
    return result;
  }

  async function ensureOCRLibraryLoaded(onProgress) {
    if (hasOCRAPI()) return globalThis.Tesseract;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      throw new Error("OCR library is not loaded yet. You appear to be offline, so type the delivery manually or reconnect and retry.");
    }
    if (!document.head || typeof document.createElement !== "function") {
      throw new Error("OCR library is not available in this browser. Type the delivery manually.");
    }

    onProgress?.("Loading the secure OCR library…");
    if (!ocrLibraryPromise) {
      const previous = document.querySelector('script[data-giglens-ocr-library="true"]');
      if (previous) previous.remove();
      ocrLibraryPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = OCR_LIBRARY_URL;
        script.async = true;
        script.integrity = OCR_LIBRARY_INTEGRITY;
        script.crossOrigin = "anonymous";
        script.referrerPolicy = "no-referrer";
        script.dataset.giglensOcrLibrary = "true";
        script.onload = () => hasOCRAPI()
          ? resolve(globalThis.Tesseract)
          : reject(new Error("OCR library loaded without a recognition API."));
        script.onerror = () => reject(new Error("OCR library could not be downloaded. Check the connection and try again."));
        document.head.appendChild(script);
      });
    }

    try {
      return await withTimeout(
        ocrLibraryPromise,
        OCR_INIT_TIMEOUT_MS,
        "OCR library took too long to load. Check the connection and try again."
      );
    } catch (error) {
      ocrLibraryPromise = null;
      const failed = document.querySelector('script[data-giglens-ocr-library="true"]');
      if (failed && !hasOCRAPI()) failed.remove();
      throw error;
    }
  }

  async function terminateOCRWorker(worker) {
    if (!worker || typeof worker.terminate !== "function") return;
    try {
      await withTimeout(
        Promise.resolve().then(() => worker.terminate()),
        OCR_TERMINATE_TIMEOUT_MS,
        "OCR worker cleanup timed out."
      );
    } catch (error) {
      console.warn("GigLens OCR worker cleanup stopped safely", error);
    }
  }

  async function recognizeScreenshot(file, onProgress) {
    const api = await ensureOCRLibraryLoaded(onProgress);
    let worker = null;
    let workerPromise = null;
    try {
      if (typeof api.createWorker === "function") {
        workerPromise = Promise.resolve(api.createWorker("eng", 1, {
          workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@v5.1.1/dist/worker.min.js",
          corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@v5.0.0",
          langPath: "https://tessdata.projectnaptha.com/4.0.0",
          logger: (message) => onProgress?.(formatOCRProgress(message)),
          errorHandler: (error) => console.error("GigLens OCR worker error", error)
        }));
        try {
          worker = await withTimeout(workerPromise, OCR_INIT_TIMEOUT_MS, "OCR engine took too long to start. Check your connection and try again.");
        } catch (error) {
          void workerPromise.then((lateWorker) => terminateOCRWorker(lateWorker)).catch(() => {});
          throw error;
        }
        return await withTimeout(worker.recognize(file), OCR_RECOGNIZE_TIMEOUT_MS, "OCR took too long. Try a smaller or clearer screenshot.");
      }
      if (typeof api.recognize === "function") {
        return await withTimeout(api.recognize(file, "eng", { logger: (message) => onProgress?.(formatOCRProgress(message)) }), OCR_RECOGNIZE_TIMEOUT_MS, "OCR took too long. Try a smaller or clearer screenshot.");
      }
      throw new Error("OCR library loaded without a recognition API.");
    } finally {
      await terminateOCRWorker(worker);
    }
  }

  async function scanQuickScreenshot(file) {
    if (!file) return;
    clearQuickScan(false);
    const scanGeneration = quickScanGeneration;
    const validationError = validateScreenshotFile(file);
    if (validationError) {
      setQuickScanState("failed", validationError);
      return;
    }
    if (els.quickPreviewImage) {
      if (els.quickPreviewImage.dataset.url) URL.revokeObjectURL(els.quickPreviewImage.dataset.url);
      const url = URL.createObjectURL(file);
      els.quickPreviewImage.dataset.url = url;
      els.quickPreviewImage.src = url;
      els.quickPreviewImage.classList.remove("hidden");
    }
    setQuickScanState("loading", "Scanning screenshot for restaurant, pay, miles, and time…");
    try {
      const [result, visualEvidence] = await Promise.all([
        recognizeScreenshot(file, (progress) => {
          if (scanGeneration === quickScanGeneration) setQuickScanState("loading", progress);
        }),
        analyzeScreenshotAccent(file)
      ]);
      if (scanGeneration !== quickScanGeneration) return;
      quickOCRText = result?.data?.text || "";
      quickOCRParsed = parseOCR(quickOCRText, visualEvidence, { fallbackDate: file.lastModified ? new Date(file.lastModified) : new Date() });
      quickOCRParsed.merchantType = inferMerchantType(quickOCRParsed.merchant, quickOCRText);
      populateQuickFromOCR(quickOCRParsed);
      if (els.quickOcrText) els.quickOcrText.textContent = quickOCRText || "No readable text detected.";
      if (els.quickOcrDetails) els.quickOcrDetails.classList.remove("hidden");
      if (els.quickClearScanBtn) els.quickClearScanBtn.classList.remove("hidden");
      const label = confidenceLabel(quickOCRParsed.confidence);
      const merchantText = quickOCRParsed.merchant ? ` Found ${quickOCRParsed.merchant}.` : " Restaurant needs review.";
      const message = label === "Needs review"
        ? `Scan complete, but confidence is low.${merchantText} Review the fields before saving.`
        : `Scan complete.${merchantText} Review and save.`;
      setQuickScanState(label === "Needs review" ? "failed" : "success", message);
    } catch (err) {
      if (scanGeneration !== quickScanGeneration) return;
      console.error(err);
      quickOCRParsed = null;
      setQuickScanState("failed", `Could not scan this screenshot. ${err?.message || "Type the delivery below or try another image."}`);
    }
  }

  function saveQuickDelivery(event, options = {}) {
    event.preventDefault();
    const company = allowedCompanies.has(els.quickCompanyInput.value) ? els.quickCompanyInput.value : null;
    if (!company) {
      toast("Choose a valid company.");
      flagInvalid(els.quickCompanyInput);
      return;
    }
    const earnings = readQuickNumber(els.quickEarningsInput, "earnings", { required: true, allowZero: false });
    if (earnings === null) return;
    const miles = readQuickNumber(els.quickMilesInput, "miles", { required: true, allowZero: true });
    if (miles === null) return;
    const minutes = readQuickNumber(els.quickMinutesInput, "minutes", { required: false, allowZero: true });
    if (minutes === null) return;

    const savedAt = new Date();
    const deliveryTimestamp = combineLocalDateTime(els.quickDateInput?.value, els.quickTimeInput?.value, quickOCRParsed?.capturedAt || savedAt);
    const quickOriginalTimestamp = quickOCRParsed?.capturedAt && validDateValue(quickOCRParsed.capturedAt)
      ? new Date(quickOCRParsed.capturedAt)
      : null;
    const quickTimestampCorrected = quickOriginalTimestamp && Math.abs(deliveryTimestamp - quickOriginalTimestamp) >= 60000;
    const now = savedAt.toISOString();
    const delivery = normalizeDelivery({
      id: makeId(),
      company,
      earnings,
      miles,
      minutes,
      zone: els.quickZoneInput.value || settings.defaultZone || "",
      merchant: els.quickMerchantInput?.value || "",
      notes: els.quickNotesInput.value,
      source: quickOCRText ? "ocr" : "manual",
      ocrText: quickOCRText,
      ocrConfidence: quickOCRParsed?.confidence || 0,
      createdAt: deliveryTimestamp.toISOString(),
      capturedAt: deliveryTimestamp.toISOString(),
      timestampSource: quickOCRText ? (quickTimestampCorrected ? "manual" : (quickOCRParsed?.timestampSource || "ocr")) : "manual",
      timestampConfidence: quickOCRText ? (quickTimestampCorrected ? 100 : (quickOCRParsed?.timestampConfidence || 50)) : 100,
      timestampEvidence: quickTimestampCorrected ? ["user corrected screenshot date/time"] : (quickOCRParsed?.timestampEvidence || []),
      updatedAt: now,
      version: DATA_VERSION
    });
    if (!delivery) {
      toast("Could not save this delivery. Check the quick-add fields.");
      return;
    }
    if (quickOCRText && quickOCRParsed) {
      recordOCRCorrection(quickOCRParsed, { company, earnings, miles, minutes, merchant: delivery.merchant, merchantType: delivery.merchantType }, quickOCRText, "quick");
    }
    deliveries.push(delivery);
    writeJSON(STORE_KEY, deliveries);
    render();
    toast(`Saved ${money.format(delivery.earnings)} from ${delivery.company}.`);
    if (options.addAnother) {
      els.quickCompanyInput.value = delivery.company;
      els.quickZoneInput.value = delivery.zone || settings.defaultZone || "";
      [els.quickEarningsInput, els.quickMilesInput, els.quickMinutesInput, els.quickNotesInput, els.quickMerchantInput].forEach((input) => {
        input.value = "";
        input.classList.remove("invalid");
      });
      clearQuickScan(true);
      els.quickNotesDetails.open = false;
      renderQuickAddPreview();
      if (typeof els.quickScreenshotInput.focus === "function") els.quickScreenshotInput.focus();
      return;
    }
    closeQuickAdd();
    showSavedDeliveryDay(delivery);
  }

  async function scanScreenshot(file) {
    if (!file) return;
    clearOCR(false);
    const scanGeneration = fullScanGeneration;
    const validationError = validateScreenshotFile(file);
    if (validationError) {
      setScanState("failed", validationError);
      return;
    }
    if (els.previewImage.dataset.url) URL.revokeObjectURL(els.previewImage.dataset.url);
    const url = URL.createObjectURL(file);
    els.previewImage.dataset.url = url;
    els.previewImage.src = url;
    els.previewImage.classList.remove("hidden");
    setScanState("loading", "Scanning screenshot…");

    try {
      const [result, visualEvidence] = await Promise.all([
        recognizeScreenshot(file, (progress) => {
          if (scanGeneration === fullScanGeneration) setScanState("loading", progress);
        }),
        analyzeScreenshotAccent(file)
      ]);
      if (scanGeneration !== fullScanGeneration) return;
      lastOCRText = result?.data?.text || "";
      lastOCRParsed = parseOCR(lastOCRText, visualEvidence, { fallbackDate: file.lastModified ? new Date(file.lastModified) : new Date() });
      lastOCRParsed.merchantType = inferMerchantType(lastOCRParsed.merchant, lastOCRText);
      els.ocrText.textContent = lastOCRText || "No readable text detected.";
      els.ocrDetails.classList.remove("hidden");
      renderOCRReview(lastOCRParsed);
      const label = confidenceLabel(lastOCRParsed.confidence);
      const message = label === "Needs review"
        ? "Scan complete, but confidence is low. Review and correct the fields before saving."
        : "Scan complete. Review before saving.";
      setScanState("success", message);
    } catch (err) {
      if (scanGeneration !== fullScanGeneration) return;
      console.error(err);
      lastOCRParsed = null;
      setScanState("failed", `Could not scan this screenshot. ${err?.message || "Enter the delivery manually or try another image."}`);
    }
  }

  function setScanState(state, message) {
    els.scanStatus.classList.remove("hidden", "loading", "success", "failed");
    els.scanStatus.classList.add(state);
    els.scanStatus.textContent = message;
  }

  function confidenceLabel(score) {
    if (score >= 80) return "High confidence";
    if (score >= 60) return "Medium confidence";
    return "Needs review";
  }

  function renderOCRReview(parsed) {
    if (!parsed) return;
    const label = confidenceLabel(parsed.confidence);
    const platform = allowedCompanies.has(parsed.platform) ? parsed.platform : "Other";
    if (parsed.platform) {
      const evidence = Array.isArray(parsed.platformEvidence) ? parsed.platformEvidence.slice(0, 3) : [];
      els.ocrCompany.textContent = evidence.length
        ? `${parsed.platform} (matched ${evidence.join(", ")})`
        : parsed.platform;
    } else {
      els.ocrCompany.textContent = "Needs review";
    }
    if (els.ocrMerchantLabel) els.ocrMerchantLabel.textContent = merchantTypeLabel(parsed.merchantType);
    if (els.ocrMerchant) els.ocrMerchant.textContent = parsed.merchant || "Needs review";
    els.ocrEarnings.textContent = parsed.earnings ? money.format(parsed.earnings) : "Needs review";
    els.ocrMiles.textContent = parsed.miles ? `${parsed.miles.toFixed(1)} mi` : "Needs review";
    els.ocrMinutes.textContent = parsed.minutes ? `${parsed.minutes} min` : "Optional";
    if (els.ocrTimestamp) {
      els.ocrTimestamp.textContent = parsed.capturedAt && validDateValue(parsed.capturedAt)
        ? new Date(parsed.capturedAt).toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
        : "Needs review";
    }
    els.ocrConfidence.textContent = `${parsed.confidence}%`;
    els.ocrConfidenceLabel.textContent = label;
    els.ocrConfidenceLabel.className = `status-chip ${label === "High confidence" ? "good" : label === "Medium confidence" ? "warning" : "bad"}`;
    els.ocrCompanyInput.value = platform;
    if (els.ocrMerchantInput) els.ocrMerchantInput.value = parsed.merchant || "";
    els.ocrEarningsInput.value = parsed.earnings ? parsed.earnings.toFixed(2) : "";
    els.ocrMilesInput.value = parsed.miles ? parsed.miles.toFixed(1) : "";
    els.ocrMinutesInput.value = parsed.minutes ? String(parsed.minutes) : "";
    if (parsed.capturedAt && validDateValue(parsed.capturedAt)) {
      if (els.ocrDateInput) els.ocrDateInput.value = localDateInputValue(parsed.capturedAt);
      if (els.ocrTimeInput) els.ocrTimeInput.value = localTimeInputValue(parsed.capturedAt);
    }
    if (els.ocrLearningHint) {
      const learned = Array.isArray(parsed.learningApplied) && parsed.learningApplied.length;
      const timestampNote = parsed.timestampSource === "file"
        ? " Date/time came from the image file and should be reviewed."
        : ` Date/time confidence: ${parsed.timestampConfidence || 0}%.`;
      els.ocrLearningHint.textContent = (learned
        ? `Local learning helped this scan: ${parsed.learningApplied.join(", ")}. Your edits will refine it again.`
        : "Corrections improve future scans on this device. Screenshots are never stored in the learning profile.") + timestampNote;
    }
    renderOCRSavePreview();
    els.ocrReview.classList.remove("hidden");
  }

  function renderOCRSavePreview() {
    const earnings = num(els.ocrEarningsInput.value);
    const milesRaw = String(els.ocrMilesInput.value || "").trim();
    const miles = num(milesRaw);
    const minutes = num(els.ocrMinutesInput.value);
    const merchant = cleanText(els.ocrMerchantInput?.value || "", 120);
    if (!earnings || earnings <= 0 || milesRaw === "" || miles < 0 || minutes < 0) {
      els.ocrSavePreview.className = "delivery-preview warning";
      els.ocrSavePreview.textContent = "Review company, earnings, miles, and optional minutes before saving.";
      return;
    }
    const profit = estimatedDeliveryProfit({ earnings, miles });
    const perMile = grossDollarPerMile(earnings, miles);
    const perMileText = miles > 0 ? `${money.format(perMile)}/mi gross` : "No miles entered";
    const hourlyText = minutes > 0 ? ` · ${money.format(grossHourlyRate(earnings, minutes))}/hr` : "";
    const merchantText = cleanText(els.ocrMerchantInput?.value || "", 120);
    const merchantPrefix = merchantText ? `${merchantText} · ` : "";
    const previewTimestamp = combineLocalDateTime(els.ocrDateInput?.value, els.ocrTimeInput?.value, lastOCRParsed?.capturedAt || new Date());
    const timestampText = previewTimestamp.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    els.ocrSavePreview.className = `delivery-preview ${miles > 0 && perMile >= settings.minPerMile ? "good" : "warning"}`;
    els.ocrSavePreview.textContent = `${merchantPrefix}${money.format(profit)} estimated profit · ${perMileText}${hourlyText} · ${timestampText}`;
  }

  function applyParsedResult(parsed) {
    if (!parsed) return;
    const reviewed = readOCRReviewFields();
    if (!reviewed) return;
    els.companyInput.value = reviewed.company;
    els.earningsInput.value = reviewed.earnings.toFixed(2);
    els.milesInput.value = reviewed.miles.toFixed(1);
    els.minutesInput.value = reviewed.minutes ? String(reviewed.minutes) : "";
    if (els.deliveryDateInput) els.deliveryDateInput.value = localDateInputValue(reviewed.capturedAt);
    if (els.deliveryTimeInput) els.deliveryTimeInput.value = localTimeInputValue(reviewed.capturedAt);
    if (els.merchantInput) els.merchantInput.value = reviewed.merchant || "";
    recordOCRCorrection(parsed, { ...reviewed, merchantType: inferMerchantType(reviewed.merchant, lastOCRText) }, lastOCRText, "review");
    renderDeliveryPreview();
    toast("Reviewed OCR fields moved into the manual form. Corrections were learned locally.");
  }

  function readOCRReviewFields() {
    const company = allowedCompanies.has(els.ocrCompanyInput.value) ? els.ocrCompanyInput.value : "Other";
    const earnings = num(els.ocrEarningsInput.value);
    const milesRaw = String(els.ocrMilesInput.value || "").trim();
    const miles = num(milesRaw);
    const minutes = num(els.ocrMinutesInput.value);
    const merchant = cleanText(els.ocrMerchantInput?.value || "", 120);
    const capturedAt = combineLocalDateTime(els.ocrDateInput?.value, els.ocrTimeInput?.value, lastOCRParsed?.capturedAt || new Date());
    if (!earnings || earnings <= 0) {
      toast("Review OCR earnings before saving.");
      flagInvalid(els.ocrEarningsInput);
      return null;
    }
    if (milesRaw === "" || miles < 0) {
      toast("Review OCR miles before saving.");
      flagInvalid(els.ocrMilesInput);
      return null;
    }
    if (minutes < 0) {
      toast("Minutes cannot be negative.");
      flagInvalid(els.ocrMinutesInput);
      return null;
    }
    const originalTimestamp = lastOCRParsed?.capturedAt && validDateValue(lastOCRParsed.capturedAt)
      ? new Date(lastOCRParsed.capturedAt)
      : null;
    const timestampCorrected = originalTimestamp && Math.abs(capturedAt - originalTimestamp) >= 60000;
    return {
      company,
      earnings,
      miles,
      minutes,
      merchant,
      capturedAt,
      timestampSource: timestampCorrected ? "manual" : (lastOCRParsed?.timestampSource || "ocr"),
      timestampConfidence: timestampCorrected ? 100 : (lastOCRParsed?.timestampConfidence || 50),
      timestampEvidence: timestampCorrected ? ["user corrected screenshot date/time"] : (lastOCRParsed?.timestampEvidence || [])
    };
  }

  function saveReviewedOCR() {
    if (!lastOCRParsed) return toast("Scan a screenshot before saving OCR results.");
    const reviewed = readOCRReviewFields();
    if (!reviewed) return;
    const now = new Date().toISOString();
    const delivery = normalizeDelivery({
      id: makeId(),
      company: reviewed.company,
      earnings: reviewed.earnings,
      miles: reviewed.miles,
      minutes: reviewed.minutes,
      zone: els.zoneInput.value || settings.defaultZone || "",
      merchant: reviewed.merchant,
      notes: els.notesInput.value || reviewed.merchant,
      source: "ocr",
      ocrText: lastOCRText,
      ocrConfidence: lastOCRParsed.confidence,
      createdAt: reviewed.capturedAt.toISOString(),
      capturedAt: reviewed.capturedAt.toISOString(),
      timestampSource: reviewed.timestampSource,
      timestampConfidence: reviewed.timestampConfidence,
      timestampEvidence: reviewed.timestampEvidence,
      updatedAt: now,
      version: DATA_VERSION
    });
    if (!delivery) return toast("Could not save the reviewed OCR delivery.");
    const learned = recordOCRCorrection(lastOCRParsed, { ...reviewed, merchantType: delivery.merchantType }, lastOCRText, "review");
    deliveries.push(delivery);
    writeJSON(STORE_KEY, deliveries);
    clearForm(false);
    render();
    showSavedDeliveryDay(delivery);
    toast(`Saved reviewed OCR delivery: ${money.format(delivery.earnings)} from ${delivery.company}.${learned.changedFields.length ? " Scanner correction learned." : " Scan pattern confirmed."}`);
  }

  function clearOCR(clearFile = true) {
    fullScanGeneration += 1;
    lastOCRText = "";
    lastOCRParsed = null;
    els.ocrReview.classList.add("hidden");
    els.ocrDetails.classList.add("hidden");
    els.ocrText.textContent = "";
    els.ocrCompany.textContent = "—";
    if (els.ocrMerchant) els.ocrMerchant.textContent = "—";
    els.ocrEarnings.textContent = "—";
    els.ocrMiles.textContent = "—";
    els.ocrMinutes.textContent = "—";
    if (els.ocrTimestamp) els.ocrTimestamp.textContent = "Needs review";
    els.ocrConfidence.textContent = "—";
    els.ocrConfidenceLabel.textContent = "Needs review";
    els.ocrConfidenceLabel.className = "status-chip";
    els.ocrCompanyInput.value = settings.defaultCompany || "DoorDash";
    if (els.ocrMerchantInput) els.ocrMerchantInput.value = "";
    els.ocrEarningsInput.value = "";
    els.ocrMilesInput.value = "";
    els.ocrMinutesInput.value = "";
    const ocrNow = new Date();
    if (els.ocrDateInput) els.ocrDateInput.value = localDateInputValue(ocrNow);
    if (els.ocrTimeInput) els.ocrTimeInput.value = localTimeInputValue(ocrNow);
    els.ocrSavePreview.textContent = "Review the detected fields before saving.";
    els.ocrSavePreview.className = "delivery-preview";
    if (els.ocrLearningHint) els.ocrLearningHint.textContent = "Corrections improve future scans on this device. Screenshots are never stored in the learning profile.";
    els.scanStatus.classList.add("hidden");
    els.scanStatus.classList.remove("loading", "success", "failed");
    if (clearFile) {
      els.screenshotInput.value = "";
      if (els.previewImage.dataset.url) {
        URL.revokeObjectURL(els.previewImage.dataset.url);
        delete els.previewImage.dataset.url;
      }
      els.previewImage.removeAttribute("src");
      els.previewImage.classList.add("hidden");
    }
  }

  function parseOCR(text, visualEvidence = null, scanContext = {}) {
    const rawText = String(text || "");
    const lines = ocrLines(rawText);
    const normalized = rawText.replace(/\s+/g, " ").trim();
    const hasOfferWorkflow = /\b(?:accept|decline|pickup|pick\s*up|drop[ -]?off|deliver(?:y)?|offer)\b/i.test(normalized)
      && /(?:\$\s*\d|\b\d+(?:[.,]\d+)?\s*(?:mi|miles?|mins?|minutes?)\b|guaranteed)/i.test(normalized);
    const platformResult = mergeVisualPlatformEvidence(detectPlatformDetailed(normalized), visualEvidence, hasOfferWorkflow);
    const platform = platformResult.platform;
    const earnings = detectEarnings(normalized);
    const miles = detectMiles(normalized);
    const minutes = detectMinutes(normalized);
    const merchant = detectMerchant(lines, normalized, platform);
    const timestamp = detectScreenshotTimestamp(rawText, scanContext.fallbackDate || new Date());
    // Weight the platform's contribution to overall confidence by how sure the
    // fingerprint match was, so a strong brand hit boosts more than a weak guess.
    let confidence = 15;
    if (platform) confidence += Math.round(8 + (platformResult.platformConfidence / 100) * 16);
    if (merchant) confidence += 18;
    if (earnings) confidence += 28;
    if (miles) confidence += 22;
    if (minutes) confidence += 8;
    if (timestamp.timestampSource === "ocr") confidence += timestamp.timestampConfidence >= 85 ? 8 : 4;
    return applyOCRLearning({
      platform,
      platformConfidence: platformResult.platformConfidence,
      platformEvidence: platformResult.evidence,
      merchant,
      restaurant: merchant,
      merchantType: inferMerchantType(merchant, rawText),
      earnings,
      miles,
      minutes,
      capturedAt: timestamp.capturedAt,
      timestampSource: timestamp.timestampSource,
      timestampConfidence: timestamp.timestampConfidence,
      timestampEvidence: timestamp.timestampEvidence,
      confidence: Math.min(confidence, 98)
    }, rawText);
  }

  function ocrLines(text) {
    const raw = String(text || "").replace(/\r/g, "\n");
    const semantic = raw
      .replace(/\s{3,}/g, "\n")
      .replace(/\s+(?=(?:Pickup|Pick up|Pick-up|Restaurant|Merchant|Store|Shop|Go to|Head to|Arrive at|Navigate to|From|Order from|Total|Distance|Miles|Estimated|Deliver|Drop[ -]?off|Customer|Items?|Accept|Decline)\b)/gi, "\n");
    return semantic
      .split(/\n+/)
      .map((line) => cleanText(line, 180))
      .filter(Boolean);
  }

  function normalizeMerchantWhitespace(value) {
    return cleanText(String(value || "")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[•|]+/g, " ")
      .replace(/\s+/g, " ")
      .trim(), 140);
  }

  function stripMerchantNoise(value) {
    let cleaned = normalizeMerchantWhitespace(value)
      .replace(/^(?:pickup|pick up|pick-up|restaurant|merchant|store|shop|from|at|order from|pick up from|pickup from|deliver from|go to|head to|arrive at|navigate to)[:\-\s]+/i, "")
      .replace(/^(?:new order|offer|delivery offer|order)[:\-\s]+/i, "")
      .replace(/\b(?:pickup|pick up|pick-up|restaurant|merchant|store|shop)\b$/i, "")
      .replace(/\b(?:open|closed|directions|navigate|start|arrived|confirm pickup|picked up)\b.*$/i, "")
      .replace(/\b(?:\d+\s*(?:items?|orders?)|ready by|est\.?|estimated|subtotal|total|distance|miles?|mins?|minutes?)\b.*$/i, "")
      .replace(/\s+\$\d+(?:[.,]\d{2})?.*$/i, "")
      .trim();

    // Drop trailing addresses when OCR puts merchant and street address on one line.
    cleaned = cleaned
      .replace(/\s+\d{1,6}\s+[A-Za-z0-9.'\-\s]+\b(?:st|street|ave|avenue|rd|road|dr|drive|blvd|boulevard|ln|lane|ct|court|pl|place|pkwy|parkway|way|hwy|highway)\b.*$/i, "")
      .replace(/\s+\b(?:suite|ste|unit|apt|#)\s*[A-Za-z0-9-]+.*$/i, "")
      .replace(/\s+\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b.*$/i, "")
      .replace(/\s+\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}.*$/i, "")
      .replace(/[.,;:\-\s]+$/g, "")
      .trim();

    return cleanText(cleaned, 120);
  }

  const knownStorePatterns = [
    [/\bwalmart\b/i, "Walmart"], [/\bschnucks\b/i, "Schnucks"], [/\btarget\b/i, "Target"],
    [/\bbest\s*buy\b/i, "Best Buy"], [/\bcostco\b/i, "Costco"], [/\bwalgreens\b/i, "Walgreens"],
    [/\bcvs\b/i, "CVS"], [/\bhome\s*depot\b/i, "Home Depot"], [/\blowe'?s\b/i, "Lowe's"],
    [/\bsam'?s\s*club\b/i, "Sam's Club"], [/\baldi\b/i, "ALDI"], [/\bkroger\b/i, "Kroger"],
    [/\bpublix\b/i, "Publix"], [/\bmeijer\b/i, "Meijer"], [/\bdollar\s*general\b/i, "Dollar General"],
    [/\bdollar\s*tree\b/i, "Dollar Tree"], [/\bpetsmart\b/i, "PetSmart"], [/\bpetco\b/i, "Petco"],
    [/\bsephora\b/i, "Sephora"], [/\bthe\s*ups\s*store\b|\bups\s*store\b/i, "The UPS Store"]
  ];

  function detectKnownStore(text) {
    const source = String(text || "");
    for (const [pattern, label] of knownStorePatterns) {
      if (pattern.test(source)) return label;
    }
    return "";
  }

  function inferMerchantType(merchant, context = "") {
    return normalizeMerchantTypeValue(null, merchant, context);
  }

  function cleanMerchantName(value) {
    return stripMerchantNoise(value);
  }

  const knownRestaurantPatterns = [
    [/mcdonald'?s|mc\s*donald'?s|mcdonalds/i, "McDonald's"], [/taco\s*bell/i, "Taco Bell"], [/chick[-\s]*fil[-\s]*a|chickfila/i, "Chick-fil-A"],
    [/chipotle/i, "Chipotle"], [/starbucks/i, "Starbucks"], [/subway/i, "Subway"], [/panera/i, "Panera Bread"],
    [/wendy'?s/i, "Wendy's"], [/burger\s*king/i, "Burger King"], [/popeyes/i, "Popeyes"], [/\bkfc\b|kentucky\s*fried/i, "KFC"],
    [/pizza\s*hut/i, "Pizza Hut"], [/domino'?s/i, "Domino's"], [/little\s*caesars/i, "Little Caesars"],
    [/papa\s*john'?s/i, "Papa John's"], [/papa\s*murphy'?s/i, "Papa Murphy's"], [/im[o0]'?s/i, "Imo's Pizza"],
    [/panda\s*express/i, "Panda Express"], [/qdoba/i, "Qdoba"], [/five\s*guys/i, "Five Guys"],
    [/shake\s*shack/i, "Shake Shack"], [/wingstop/i, "Wingstop"], [/raising\s*cane'?s|canes/i, "Raising Cane's"],
    [/jersey\s*mike'?s/i, "Jersey Mike's"], [/jimmy\s*john'?s/i, "Jimmy John's"], [/arby'?s/i, "Arby's"],
    [/sonic/i, "Sonic"], [/dairy\s*queen/i, "Dairy Queen"], [/dunkin/i, "Dunkin'"], [/krispy\s*kreme/i, "Krispy Kreme"],
    [/buffalo\s*wild\s*wings|\bbww\b/i, "Buffalo Wild Wings"], [/applebee'?s/i, "Applebee's"], [/chili'?s/i, "Chili's"],
    [/ihop/i, "IHOP"], [/denny'?s/i, "Denny's"], [/waffle\s*house/i, "Waffle House"], [/olive\s*garden/i, "Olive Garden"],
    [/outback/i, "Outback Steakhouse"], [/longhorn/i, "LongHorn Steakhouse"], [/red\s*lobster/i, "Red Lobster"],
    [/cheesecake\s*factory/i, "The Cheesecake Factory"], [/cracker\s*barrel/i, "Cracker Barrel"], [/culver'?s/i, "Culver's"],
    [/firehouse\s*subs/i, "Firehouse Subs"], [/potbelly/i, "Potbelly"], [/mod\s*pizza/i, "MOD Pizza"], [/noodles\s*&?\s*company/i, "Noodles & Company"],
    [/first\s*watch/i, "First Watch"], [/bob\s*evans/i, "Bob Evans"], [/texas\s*roadhouse/i, "Texas Roadhouse"], [/red\s*robin/i, "Red Robin"],
    [/p\.\s*f\.\s*chang'?s|pf\s*chang'?s/i, "P.F. Chang's"], [/penn\s*station/i, "Penn Station"], [/charleys?\s*cheesesteaks?/i, "Charleys Cheesesteaks"],
    [/white\s*castle/i, "White Castle"], [/jack\s*in\s*the\s*box/i, "Jack in the Box"], [/hardee'?s/i, "Hardee's"], [/carl'?s\s*jr/i, "Carl's Jr."],
    [/\bel\s*potro\b/i, "El Potro"], [/\bel\s*maguey\b/i, "El Maguey"], [/\bel\s*mezcal\b/i, "El Mezcal"], [/\bla\s*fiesta\b/i, "La Fiesta"]
  ];

  function detectKnownRestaurant(text) {
    const source = String(text || "");
    for (const [pattern, label] of knownRestaurantPatterns) {
      if (pattern.test(source)) return label;
    }
    return "";
  }

  function looksLikeAddress(value) {
    const text = String(value || "").trim();
    return /\b\d{1,6}\s+[A-Za-z0-9.'\-\s]+\b(?:st|street|ave|avenue|rd|road|dr|drive|blvd|boulevard|ln|lane|ct|court|pl|place|pkwy|parkway|way|hwy|highway)\b/i.test(text)
      || /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/i.test(text)
      || /^\d{3,}$/.test(text);
  }

  function merchantRejectRegex() {
    return /(accept|decline|total|subtotal|earnings?|payout|guarantee|offer|tip|fare|base pay|promo|bonus|miles?|minutes?|mins?|\bmi\b|order\s*id|order\s*#|customer|deliver(?:y)?|drop[ -]?off|address|directions?|navigation|arriv|eta|cash\s*out|balance|rating|schedule|dash\s*now|start\s*delivery|complete\s*delivery|leave\s*at|hand\s*it|apartment|suite|unit|items?|qty|quantity|receipt|subtotal|tax|fees?)/i;
  }

  function platformRegex() {
    return /(doordash|door\s*dash|dashpass|uber\s*eats|ubereats|grubhub|grub\s*hub|instacart|spark|walmart|roadie|ezcater)/i;
  }

  function isMerchantCandidate(value) {
    const cleaned = cleanMerchantName(value);
    if (!cleaned || cleaned.length < 3 || cleaned.length > 80) return false;
    const knownStore = detectKnownStore(cleaned);
    if ((platformRegex().test(cleaned) && !knownStore) || merchantRejectRegex().test(cleaned)) return false;
    if (/\$|\b\d+(?:\.\d+)?\s*(?:mi|mile|min|minutes?)\b/i.test(cleaned)) return false;
    if (/^[0-9#\-.,\s]+$/.test(cleaned)) return false;
    if (looksLikeAddress(cleaned)) return false;
    if (!/[A-Za-z]/.test(cleaned)) return false;
    return true;
  }

  function addMerchantCandidate(candidates, value, score, reason, index = 999) {
    const cleaned = cleanMerchantName(value);
    if (!isMerchantCandidate(cleaned)) return;
    const knownRestaurant = detectKnownRestaurant(cleaned);
    const knownStore = detectKnownStore(cleaned);
    const known = knownRestaurant || knownStore;
    const finalValue = known || cleaned;
    const existing = candidates.find((candidate) => candidate.value.toLowerCase() === finalValue.toLowerCase());
    const candidate = { value: finalValue, score: score + (known ? 6 : 0), reason, index };
    if (existing) {
      if (candidate.score > existing.score) Object.assign(existing, candidate);
      return;
    }
    candidates.push(candidate);
  }

  function extractMerchantFromLabeledText(normalizedText, candidates) {
    const stopWords = "(?:\\$|total|subtotal|distance|miles?|mi\\b|minutes?|mins?|estimated|guarantee|offer|accept|decline|drop[ -]?off|deliver(?:y)?|customer|order\\s*(?:id|#)|items?|directions?|navigate|address|pickup|pick up|restaurant|merchant|store|shop)";
    const patterns = [
      new RegExp("(?:pickup|pick up|pick-up)\\s*(?:from|at|@|:)\\s*([A-Za-z0-9&'’.,()\\-\\s]{3,90}?)(?=\\s+" + stopWords + "|$)", "gi"),
      new RegExp("(?:go to|head to|arrive at|navigate to)\\s*([A-Za-z0-9&'’.,()\\-\\s]{3,90}?)(?=\\s+" + stopWords + "|$)", "gi"),
      new RegExp("(?:restaurant|merchant|store|shop)\\s*(?:name)?\\s*[:\\-]?\\s*([A-Za-z0-9&'’.,()\\-\\s]{3,90}?)(?=\\s+" + stopWords + "|$)", "gi"),
      new RegExp("(?:order from|from)\\s+([A-Za-z0-9&'’.,()\\-\\s]{3,90}?)(?=\\s+" + stopWords + "|$)", "gi")
    ];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(normalizedText)) !== null) {
        addMerchantCandidate(candidates, match[1], 13, "labeled text", match.index);
      }
    }
  }

  function detectMerchant(lines, normalizedText, platform = "") {
    const knownRestaurant = detectKnownRestaurant(normalizedText);
    const knownStore = detectKnownStore(normalizedText);
    const candidates = [];
    if (knownRestaurant) addMerchantCandidate(candidates, knownRestaurant, 18, "known restaurant", 0);
    if (knownStore) addMerchantCandidate(candidates, knownStore, 18, "known store", 0);

    extractMerchantFromLabeledText(normalizedText, candidates);

    lines.forEach((line, index) => {
      const cleaned = cleanMerchantName(line);
      const previous = lines[index - 1] || "";
      const next = lines[index + 1] || "";
      const context = `${previous} ${line} ${next}`.toLowerCase();
      if (!isMerchantCandidate(cleaned)) return;
      let score = 2;
      if (/pickup|pick up|pick-up|restaurant|merchant|store|shop|from|order from|go to|head to|arrive at|navigate to/.test(line.toLowerCase())) score += 9;
      if (/pickup|pick up|pick-up|restaurant|merchant|store|shop|from|order from|go to|head to|arrive at|navigate to/.test(context)) score += 5;
      if (/cafe|café|coffee|pizza|taco|burger|grill|kitchen|deli|wings|bbq|barbecue|sushi|thai|mexican|chicken|subs?|sandwich|noodle|ramen|bakery|bistro|restaurant|steak|seafood|gyro|pasta|pub|bar\b|taqueria|cantina|smokehouse|market|diner|waffle|pancake|donut|doughnut/i.test(cleaned)) score += 5;
      if (/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/.test(cleaned)) score += 2;
      if (/['&]/.test(cleaned)) score += 1;
      if (index <= 8) score += Math.max(0, 4 - Math.floor(index / 2));
      if (platform && new RegExp(platform.replace(/\s+/g, "\\s*"), "i").test(cleaned)) score -= 10;
      addMerchantCandidate(candidates, cleaned, score, "line/context", index);

      // If a pickup label is on its own line, the next clean non-address line is often the restaurant.
      if (/^(?:pickup|pick up|pick-up|restaurant|merchant|store|shop|go to|head to|arrive at|navigate to)\b/i.test(line)) {
        for (let offset = 1; offset <= 3; offset += 1) {
          const nearby = lines[index + offset];
          if (!nearby) continue;
          if (looksLikeAddress(nearby)) continue;
          addMerchantCandidate(candidates, nearby, 12 - offset, "near pickup label", index + offset);
          break;
        }
      }
    });

    if (!candidates.length) return "";
    candidates.sort((a, b) => b.score - a.score || a.index - b.index || a.value.length - b.value.length);
    return candidates[0].value;
  }

  // Each app's driver interface has a distinctive vocabulary, not just a logo.
  // We identify the platform by matching that fingerprint (brand tokens PLUS the
  // UI terminology unique to each app) and scoring the evidence, so a stray
  // competitor word or a mis-OCR'd logo can't misclassify the whole screenshot.
  // Signal format: [regex, weight, humanLabel].
  const platformFingerprints = {
    "DoorDash": [
      [/\bdoordash\b/i, 10, "DoorDash"],
      [/\bdoor\s*dash\b/i, 9, "Door Dash"],
      [/\bdasher\b/i, 8, "Dasher"],
      [/\bred\s*card\b/i, 7, "Red Card"],
      [/\bdasher\s*direct\b/i, 7, "DasherDirect"],
      [/\bpeak\s*pay\b/i, 6, "Peak Pay"],
      [/\bearn\s*by\s*time\b/i, 6, "Earn by Time"],
      [/\bearn\s*per\s*offer\b/i, 6, "Earn per Offer"],
      [/\bdash\s*now\b/i, 6, "Dash Now"],
      [/\bshop\s*(?:&|and)\s*deliver\b/i, 5, "Shop & Deliver"],
      [/\bfast\s*pay\b/i, 4, "Fast Pay"],
      [/\bhotspot/i, 3, "hotspots"],
      [/\bdash\b/i, 3, "Dash"],
      [/\bguaranteed\b/i, 2, "Guaranteed"],
      [/\bdecline\b/i, 2, "Decline"]
    ],
    "Uber Eats": [
      [/\buber\s*eats\b/i, 10, "Uber Eats"],
      [/\bubereats\b/i, 10, "UberEats"],
      [/\buber\s*eats\s*pro\b/i, 8, "Uber Eats Pro"],
      [/\btrip\s*radar\b/i, 8, "Trip Radar"],
      [/\baccept\s*request\b/i, 7, "Accept request"],
      [/\btrip\s*request\b/i, 7, "trip request"],
      [/\btrip\s*supplement\b/i, 7, "trip supplement"],
      [/\buber\s*one\b/i, 6, "Uber One"],
      [/\bdelivery\s*partner\b/i, 5, "delivery partner"],
      [/\buber\b/i, 5, "Uber"],
      [/\bincludes?\s*(?:a\s*)?trip\b/i, 4, "included trip"],
      [/\bgo\s*offline\b/i, 2, "go offline"],
      [/\btrip\b/i, 2, "Trip"]
    ],
    "Grubhub": [
      [/\bgrubhub\b/i, 10, "Grubhub"],
      [/\bgrub\s*hub\b/i, 9, "Grub Hub"],
      [/\baccept\s*offer\b/i, 7, "Accept offer"],
      [/\bdiner\b/i, 7, "diner"],
      [/\bgrubhub\s*\+/i, 5, "Grubhub+"],
      [/\bscheduled?\s*block/i, 4, "scheduled block"],
      [/\btoolkit\b/i, 3, "toolkit"],
      [/\bblock\b/i, 3, "block scheduling"],
      [/\bcatering\b/i, 3, "Catering"],
      [/\bcare\b/i, 2, "Grubhub Care"]
    ],
    "Instacart": [
      [/\binstacart\b/i, 10, "Instacart"],
      [/\bfull[-\s]*service\s*(?:shop|batch)/i, 6, "full-service batch"],
      [/\bshopper\b/i, 5, "shopper"],
      [/\bbatch\b/i, 5, "batch"],
      [/\bitems?\s*to\s*shop\b/i, 4, "items to shop"],
      [/\breplacement/i, 3, "replacements"],
      [/\bpick\s*&?\s*pack/i, 3, "pick & pack"]
    ],
    "Amazon Flex": [
      [/\bamazon\s*flex\b/i, 12, "Amazon Flex"],
      [/\bdelivery\s*block\b/i, 8, "delivery block"],
      [/\bflex\s*app\b/i, 7, "Flex app"],
      [/\bsub[-\s]*same[-\s]*day\b/i, 5, "Sub Same-Day"]
    ],
    "Spark": [
      [/\bspark\s*driver\b/i, 10, "Spark Driver"],
      [/\bwalmart\b/i, 7, "Walmart"],
      [/\bspark\b/i, 6, "Spark"],
      [/\bround\s*robin\b/i, 4, "Round Robin"],
      [/\bcurbside\b/i, 3, "curbside"]
    ],
    "Roadie": [
      [/\broadie\b/i, 10, "Roadie"],
      [/\bgig\b/i, 2, "gig"]
    ],
    "Catering": [
      [/\bezcater\b/i, 9, "ezCater"],
      [/\bcater\s*valley\b/i, 8, "CaterValley"],
      [/\bcatering\s*order\b/i, 6, "catering order"],
      [/\bcatering\b/i, 6, "Catering"]
    ]
  };

  // When a competitor hallmark appears, actively argue against the other apps so
  // a close, low-evidence call doesn't tip the wrong way.
  const platformCrossPenalties = [
    [/\bdiner\b/i, { "Uber Eats": -3, "DoorDash": -3 }],
    [/\bdasher\b/i, { "Uber Eats": -4, "Grubhub": -4 }],
    [/\btrip\s*(?:request|radar)\b/i, { "DoorDash": -3, "Grubhub": -3 }]
  ];

  function detectPlatformDetailed(text) {
    const source = String(text || "");
    if (!source.trim()) return { platform: "", platformConfidence: 0, evidence: [], scores: {} };

    const scores = {};
    const evidenceByPlatform = {};
    for (const [platform, signals] of Object.entries(platformFingerprints)) {
      let score = 0;
      const hits = [];
      const seen = new Set();
      for (const [regex, weight, labelText] of signals) {
        if (!regex.test(source) || seen.has(labelText)) continue;
        seen.add(labelText);
        score += weight;
        hits.push({ label: labelText, weight });
      }
      if (score > 0) { scores[platform] = score; evidenceByPlatform[platform] = hits; }
    }

    for (const [regex, penalties] of platformCrossPenalties) {
      if (!regex.test(source)) continue;
      for (const [platform, penalty] of Object.entries(penalties)) {
        if (scores[platform] !== undefined) scores[platform] = Math.max(0, scores[platform] + penalty);
      }
    }

    const ranked = Object.entries(scores).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]);
    if (!ranked.length) return { platform: "", platformConfidence: 0, evidence: [], scores };

    const [topPlatform, topScore] = ranked[0];
    const runnerUp = ranked[1] ? ranked[1][1] : 0;
    const margin = topScore - runnerUp;
    let confidence = Math.min(99, Math.round(
      Math.min(topScore, 12) / 12 * 65 + Math.min(margin, 10) / 10 * 34
    ));
    const hasBrandHit = (evidenceByPlatform[topPlatform] || []).some((h) => h.weight >= 9);
    if (hasBrandHit) confidence = Math.max(confidence, 88);

    const evidence = (evidenceByPlatform[topPlatform] || [])
      .sort((a, b) => b.weight - a.weight)
      .map((h) => h.label);
    return { platform: topPlatform, platformConfidence: confidence, evidence, scores };
  }

  function detectPlatform(text) {
    return detectPlatformDetailed(text).platform;
  }

  function parseMoneyToken(token) {
    if (/^\d{1,3}(,\d{3})+(\.\d{2})?$/.test(token)) return Number.parseFloat(token.replace(/,/g, ""));
    return Number.parseFloat(token.replace(/,/g, "."));
  }

  function detectEarnings(text) {
    const matches = [];
    const push = (raw, index, bonus) => {
      const value = parseMoneyToken(raw);
      if (!Number.isFinite(value) || value <= 0 || value > 1000) return;
      const context = text.slice(Math.max(0, index - 70), Math.min(text.length, index + 90)).toLowerCase();
      let score = 1 + bonus;
      if (/total|earn|earning|payout|pay|paid|estimate|offer|guarantee|including|tip|fare|base/.test(context)) score += 3;
      if (/balance|cash\s*out|weekly|month|year|tax|fee|subscription|debt|per\s*hour|\/\s*hr/.test(context)) score -= 2;
      if (value >= 2 && value <= 80) score += 1;
      score += learnedNumericContextBoost("earnings", context);
      matches.push({ value, score, index });
    };
    const dollarRegex = /(?:\$|usd\s*)\s*([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{2})?|[0-9]{1,4}(?:[.,][0-9]{2})?)/gi;
    let m;
    while ((m = dollarRegex.exec(text)) !== null) push(m[1], m.index, 0);
    const keywordRegex = /(?:total|earnings?|payout|paid|guarantee|fare|offer)[^0-9$\n]{0,14}([0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2})/gi;
    while ((m = keywordRegex.exec(text)) !== null) push(m[1], m.index, 2);
    if (!matches.length) return 0;
    matches.sort((a, b) => b.score - a.score || b.value - a.value || a.index - b.index);
    return round2(matches[0].value);
  }

  function detectMiles(text) {
    const matches = [];
    const mileRegex = /([0-9]{1,3}(?:[.,][0-9]{1,2})?)\s*(?:miles|mile|mi)(?![a-z])/gi;
    let m;
    while ((m = mileRegex.exec(text)) !== null) {
      const value = Number.parseFloat(m[1].replace(",", "."));
      if (!Number.isFinite(value) || value <= 0 || value > 300) continue;
      const context = text.slice(Math.max(0, m.index - 60), Math.min(text.length, m.index + 60)).toLowerCase();
      let score = 1;
      if (/total|trip|delivery|distance|route/.test(context)) score += 2;
      if (/mph|minutes|minute|away|radius/.test(context)) score -= 1;
      score += learnedNumericContextBoost("miles", context);
      matches.push({ value, score, index: m.index });
    }
    if (!matches.length) return 0;
    matches.sort((a, b) => b.score - a.score || a.value - b.value);
    return round1(matches[0].value);
  }

  function detectMinutes(text) {
    const matches = [];
    const minuteRegex = /([0-9]{1,3})\s*(?:minutes|minute|mins|min)(?![a-z])/gi;
    let m;
    while ((m = minuteRegex.exec(text)) !== null) {
      const value = Number.parseInt(m[1], 10);
      if (!Number.isFinite(value) || value <= 0 || value > 600) continue;
      const context = text.slice(Math.max(0, m.index - 60), Math.min(text.length, m.index + 60)).toLowerCase();
      let score = 1;
      if (/estimate|estimated|time|duration|trip|delivery|total/.test(context)) score += 2;
      if (/away|pickup|arrive|eta|radius/.test(context)) score -= 1;
      score += learnedNumericContextBoost("minutes", context);
      matches.push({ value, score, index: m.index });
    }
    if (!matches.length) return 0;
    matches.sort((a, b) => b.score - a.score || a.value - b.value);
    return matches[0].value;
  }

  function saveDelivery(event, options = {}) {
    event.preventDefault();
    const earnings = num(els.earningsInput.value);
    const milesRaw = String(els.milesInput.value || "").trim();
    const miles = num(els.milesInput.value);
    const minutes = num(els.minutesInput.value);
    const selectedCompany = els.companyInput.value || settings.defaultCompany || "Other";
    const company = allowedCompanies.has(selectedCompany) ? selectedCompany : "Other";

    if (!earnings || earnings <= 0) {
      toast("Enter the delivery earnings first.");
      flagInvalid(els.earningsInput);
      return;
    }
    if (milesRaw === "" || miles < 0) {
      toast("Enter delivery miles, or 0 if mileage is not available yet.");
      flagInvalid(els.milesInput);
      return;
    }

    const existingId = els.editDeliveryId.value;
    const existing = existingId ? deliveries.find((d) => d.id === existingId) : null;
    const savedAt = new Date();
    const deliveryTimestamp = combineLocalDateTime(
      els.deliveryDateInput?.value,
      els.deliveryTimeInput?.value,
      existing?.createdAt || lastOCRParsed?.capturedAt || savedAt
    );
    const originalDeliveryTimestamp = existing?.createdAt && validDateValue(existing.createdAt)
      ? new Date(existing.createdAt)
      : lastOCRParsed?.capturedAt && validDateValue(lastOCRParsed.capturedAt)
        ? new Date(lastOCRParsed.capturedAt)
        : null;
    const deliveryTimestampCorrected = originalDeliveryTimestamp && Math.abs(deliveryTimestamp - originalDeliveryTimestamp) >= 60000;
    const now = savedAt.toISOString();
    const delivery = normalizeDelivery({
      id: existingId || makeId(),
      company,
      earnings,
      miles,
      minutes,
      zone: els.zoneInput.value || settings.defaultZone || "",
      merchant: els.merchantInput?.value || existing?.merchant || "",
      notes: els.notesInput.value,
      source: existing ? existing.source : (lastOCRText ? "ocr" : "manual"),
      ocrText: lastOCRText || existing?.ocrText || "",
      ocrConfidence: lastOCRParsed?.confidence || existing?.ocrConfidence || 0,
      createdAt: deliveryTimestamp.toISOString(),
      capturedAt: deliveryTimestamp.toISOString(),
      timestampSource: deliveryTimestampCorrected
        ? "manual"
        : (existing?.timestampSource || (lastOCRText ? (lastOCRParsed?.timestampSource || "ocr") : "manual")),
      timestampConfidence: deliveryTimestampCorrected
        ? 100
        : (existing?.timestampConfidence || (lastOCRText ? (lastOCRParsed?.timestampConfidence || 50) : 100)),
      timestampEvidence: deliveryTimestampCorrected
        ? ["user corrected delivery date/time"]
        : (existing?.timestampEvidence || lastOCRParsed?.timestampEvidence || []),
      updatedAt: now,
      version: DATA_VERSION
    });
    if (!delivery) return toast("Could not save this delivery. Check the fields and try again.");

    if (existingId) deliveries = deliveries.map((d) => d.id === existingId ? delivery : d);
    else deliveries.push(delivery);
    writeJSON(STORE_KEY, deliveries);
    clearForm(!options.stayOnForm);
    render();
    if (!options.stayOnForm) showSavedDeliveryDay(delivery);
    toast(`${existingId ? "Updated" : "Saved"} ${money.format(delivery.earnings)} from ${company}.`);
  }

  function clearForm(keepCompany = true) {
    els.editDeliveryId.value = "";
    if (!keepCompany) els.companyInput.value = settings.defaultCompany || "DoorDash";
    els.earningsInput.value = "";
    els.milesInput.value = "";
    els.minutesInput.value = "";
    els.zoneInput.value = settings.defaultZone || "";
    const formNow = new Date();
    if (els.deliveryDateInput) els.deliveryDateInput.value = localDateInputValue(formNow);
    if (els.deliveryTimeInput) els.deliveryTimeInput.value = localTimeInputValue(formNow);
    if (els.merchantInput) els.merchantInput.value = "";
    els.notesInput.value = "";
    els.saveDeliveryBtn.textContent = "Save Delivery";
    els.cancelEditBtn.classList.add("hidden");
    clearOCR(true);
    renderDeliveryPreview();
  }

  function editDelivery(id) {
    const d = deliveries.find((item) => item.id === id);
    if (!d) return;
    els.editDeliveryId.value = d.id;
    els.companyInput.value = d.company;
    els.earningsInput.value = Number(d.earnings).toFixed(2);
    els.milesInput.value = Number(d.miles).toFixed(1);
    els.minutesInput.value = d.minutes ? String(d.minutes) : "";
    els.zoneInput.value = d.zone || "";
    if (els.deliveryDateInput) els.deliveryDateInput.value = localDateInputValue(d.createdAt);
    if (els.deliveryTimeInput) els.deliveryTimeInput.value = localTimeInputValue(d.createdAt);
    if (els.merchantInput) els.merchantInput.value = d.merchant || d.restaurant || "";
    els.notesInput.value = d.notes || "";
    els.saveDeliveryBtn.textContent = "Update Delivery";
    els.cancelEditBtn.classList.remove("hidden");
    showTab("add");
    renderDeliveryPreview();
  }

  function duplicateDelivery(id) {
    const d = deliveries.find((item) => item.id === id);
    if (!d) return;
    const copy = normalizeDelivery({ ...d, id: makeId(), source: "manual", ocrText: "", ocrConfidence: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), notes: d.notes ? `${d.notes} duplicate` : "" });
    if (!copy) return;
    deliveries.push(copy);
    writeJSON(STORE_KEY, deliveries);
    render();
    toast("Delivery duplicated for today.");
  }

  function deleteDelivery(id) {
    const item = deliveries.find((d) => d.id === id);
    if (!item) return;
    if (!confirm(`Delete ${money.format(Number(item.earnings || 0))} ${item.company} delivery?`)) return;
    lastDeleted = item;
    deliveries = deliveries.filter((d) => d.id !== id);
    writeJSON(STORE_KEY, deliveries);
    render();
    toast("Delivery deleted.", { label: "Undo", handler: undoDelete });
  }

  function undoDelete() {
    if (!lastDeleted) return;
    if (!deliveries.some((d) => d.id === lastDeleted.id)) {
      deliveries.push(lastDeleted);
      deliveries = normalizeDeliveries(deliveries);
      writeJSON(STORE_KEY, deliveries);
      render();
      toast("Delivery restored.");
    }
    lastDeleted = null;
  }

  function clearToday() {
    const todays = todayDeliveries();
    if (!todays.length) return toast("There are no deliveries saved for today.");
    if (!confirm(`Delete ${todays.length} ${todays.length === 1 ? "delivery" : "deliveries"} from today?`)) return;
    const today = todayKey();
    deliveries = deliveries.filter((d) => todayKey(new Date(d.createdAt)) !== today);
    writeJSON(STORE_KEY, deliveries);
    render();
    showTab("today");
    toast("Today's deliveries deleted.");
  }

  function saveSettings() {
    settings = normalizeSettings({
      dailyGoal: els.goalInput.value,
      defaultCompany: els.defaultCompanyInput.value,
      gasPrice: els.gasPriceInput.value,
      mpg: els.mpgInput.value,
      maintenancePerMile: els.maintenanceInput.value,
      mileageDeductionMode: els.taxRateModeInput.value,
      taxMileageRate: els.taxRateInput.value,
      minPerMile: els.minPerMileInput.value,
      minPerHour: els.minPerHourInput.value,
      minPayout: els.minPayoutInput.value,
      maxMiles: els.maxMilesInput.value,
      defaultZone: els.defaultZoneInput.value,
      customZones: settings.customZones || []
    });
    writeJSON(SETTINGS_KEY, settings);
    els.companyInput.value = settings.defaultCompany;
    els.offerCompanyInput.value = settings.defaultCompany;
    els.offerZoneInput.value = settings.defaultZone || "";
    if (els.offerNoteInput) els.offerNoteInput.value = "";
    els.zoneInput.value = settings.defaultZone || "";
    render();
    showTab("today");
    toast("Settings saved.");
  }

  function decisionFromCurrentOffer() {
    const pay = num(els.offerPayInput.value);
    const miles = num(els.offerMilesInput.value);
    const minutes = num(els.offerMinutesInput.value);
    const evaluation = evaluateOffer(pay, miles, minutes);
    if (evaluation.kind === "neutral" || pay <= 0 || miles < 0 || minutes <= 0) return null;
    return normalizeDecision({
      id: makeId(),
      outcome: String(evaluation.label || evaluation.title || evaluation.kind).toUpperCase().includes("DECLINE") ? "DECLINE" : String(evaluation.label || evaluation.title || evaluation.kind).toUpperCase().includes("BORDER") ? "BORDERLINE" : "ACCEPT",
      company: els.offerCompanyInput.value,
      pay,
      miles,
      minutes,
      zone: els.offerZoneInput.value,
      note: els.offerNoteInput.value,
      source: "calculator",
      createdAt: new Date().toISOString()
    });
  }

  function logCurrentDecision(options = {}) {
    const decision = decisionFromCurrentOffer();
    if (!decision) return options.silent ? null : toast("Enter a valid offer and calculate it before logging.");
    decisions.push(decision);
    writeJSON(DECISIONS_KEY, decisions);
    renderDecisionLog();
    if (!options.silent) toast(`${decision.outcome} decision logged.`);
    return decision;
  }

  function renderDecisionLog() {
    if (!els.decisionLogList) return;
    const today = decisions.filter((d) => isToday(d.createdAt));
    const counts = { ACCEPT: 0, BORDERLINE: 0, DECLINE: 0 };
    today.forEach((d) => counts[d.outcome] = (counts[d.outcome] || 0) + 1);
    if (els.decisionLogStatus) els.decisionLogStatus.textContent = today.length ? `${today.length} today` : "No decisions yet";
    if (els.decisionLogSummary) els.decisionLogSummary.textContent = today.length
      ? `${counts.ACCEPT} accept · ${counts.BORDERLINE} borderline · ${counts.DECLINE} decline`
      : "Log a recommendation to remember what you accepted, passed on, or treated as borderline. Decisions stay in this browser.";
    if (els.decisionLogMetrics) els.decisionLogMetrics.innerHTML = ["ACCEPT", "BORDERLINE", "DECLINE"].map((key) => `<span><strong>${counts[key]}</strong><small>${key.toLowerCase()}</small></span>`).join("");
    const rows = decisions.slice(-20).reverse();
    if (!rows.length) {
      els.decisionLogList.className = "decision-log-list empty";
      els.decisionLogList.textContent = "No order decisions logged yet.";
      return;
    }
    els.decisionLogList.className = "decision-log-list";
    els.decisionLogList.innerHTML = rows.map((d) => `<article class="history-item"><div class="history-top"><strong>${escapeHTML(d.outcome)} · ${escapeHTML(d.company)}</strong><strong>${money.format(d.pay)}</strong></div><div class="history-meta">${d.miles.toFixed(1)} mi · ${d.minutes} min${d.zone ? ` · ${escapeHTML(d.zone)}` : ""}</div></article>`).join("");
  }

  async function exportDecisionCSV() {
    const rows = [["createdAt", "outcome", "company", "pay", "miles", "minutes", "zone", "note"]];
    decisions.forEach((d) => rows.push([d.createdAt, d.outcome, d.company, d.pay.toFixed(2), d.miles.toFixed(1), d.minutes, d.zone, d.note]));
    await shareOrDownload(csvRowsToText(rows), `giglens-decisions-${todayKey()}.csv`, "text/csv;charset=utf-8");
    toast(decisions.length ? "Decision CSV exported." : "Decision CSV exported with headers only.");
  }

  function togglePauseShift() {
    if (!shift.active || !shift.startedAt) return toast("Start the day before taking a break.");
    const now = new Date().toISOString();
    const breaks = [...(shift.breaks || [])];
    if (shift.paused) {
      const openIndex = breaks.map((item) => item.endedAt).lastIndexOf(null);
      if (openIndex >= 0) breaks[openIndex] = { ...breaks[openIndex], endedAt: now };
      shift = normalizeShift({ ...shift, paused: false, pausedAt: null, breaks });
      toast("Shift resumed. Active time is running again.");
    } else {
      breaks.push({ startedAt: now, endedAt: null });
      shift = normalizeShift({ ...shift, paused: true, pausedAt: now, breaks });
      toast("Shift paused. Break time will not count toward hourly pace.");
    }
    writeJSON(SHIFT_KEY, shift);
    render();
  }

  function toggleShift() {
    if (shift.active && shift.startedAt) {
      const now = new Date().toISOString();
      if (shift.paused) {
        const breaks = [...(shift.breaks || [])];
        const openIndex = breaks.map((item) => item.endedAt).lastIndexOf(null);
        if (openIndex >= 0) breaks[openIndex] = { ...breaks[openIndex], endedAt: now };
        shift = normalizeShift({ ...shift, paused: false, pausedAt: null, breaks });
      }
      const shiftStartMs = new Date(shift.startedAt).getTime();
      const shiftEndMs = new Date(now).getTime();
      const shiftRows = activeDeliveries().filter((delivery) => {
        const createdMs = new Date(delivery.createdAt).getTime();
        return Number.isFinite(createdMs) && createdMs >= shiftStartMs && createdMs <= shiftEndMs;
      });
      const activeMilliseconds = activeShiftMilliseconds(shift.startedAt, now, shift.breaks || []);
      const activeHours = Math.round((activeMilliseconds / 36e5) * 1000) / 1000;
      const shiftSummary = ProfitEngine.summarizeRows(shiftRows, {
        config: settings,
        workWindow: { activeMilliseconds },
        activeShift: false
      });
      const recap = buildDriverRecap(shiftRows, shiftSummary, { startedAt: shift.startedAt, endedAt: now });
      shift = normalizeShift({
        ...shift,
        active: false,
        startedAt: shift.startedAt,
        endedAt: now,
        lastSummary: recap.text,
        shiftHistory: [
          ...(shift.shiftHistory || []),
          {
            id: makeId(),
            startedAt: shift.startedAt,
            endedAt: now,
            breaks: shift.breaks || [],
            activeHours,
            summary: recap.text,
            recommendation: recap.recommendation,
            metrics: recap.metrics,
            createdAt: now,
            version: DATA_VERSION
          }
        ]
      });
      toast("Day ended. Recap saved to shift history.");
    } else {
      shift = normalizeShift({ ...shift, active: true, paused: false, pausedAt: null, breaks: [], startedAt: new Date().toISOString(), endedAt: null });
      toast("Day started. The clock is running.");
    }
    writeJSON(SHIFT_KEY, shift);
    render();
  }

  function buildShiftSummaryText(rows, c = calculate(rows)) {
    return buildDriverRecap(rows, c).text;
  }

  function exportDateValue(delivery) {
    const value = delivery?.date || delivery?.createdAt || new Date().toISOString();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? todayKey() : parsed.toISOString();
  }

  function exportDayKey(delivery) {
    return exportDateValue(delivery).slice(0, 10);
  }

  function csvEscape(cell) {
    const value = cell === null || cell === undefined ? "" : String(cell);
    return `"${value.replace(/"/g, '""')}"`;
  }

  function csvRowsToText(rows) {
    return rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
  }

  function activeDeliveriesSorted() {
    return deliveries
      .filter((item) => !item.deleted)
      .sort((a, b) => new Date(exportDateValue(a)) - new Date(exportDateValue(b)));
  }

  function fuelCostEstimate(miles) {
    return round2(ProfitEngine.positive(miles, 0) * ProfitEngine.fuelCostPerMile(settings));
  }

  function maintenanceCostEstimate(miles) {
    return ProfitEngine.maintenanceCost(miles, settings);
  }

  function buildDailySummaryRows() {
    const grouped = new Map();
    activeDeliveriesSorted().forEach((delivery) => {
      const key = exportDayKey(delivery);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(delivery);
    });
    return [...grouped.entries()].map(([date, rows]) => {
      const summary = ProfitEngine.summarizeRows(rows, { config: settings, activeShift: false });
      return [
        date,
        summary.earnings,
        summary.profit,
        summary.miles,
        summary.orders,
        summary.avgMile,
        summary.avgHour,
        summary.profitHour
      ];
    });
  }

  function buildCSV(kind = "standard") {
    const activeRows = activeDeliveriesSorted();
    if (kind === "tax") {
      const header = ["date", "company", "gross_earnings", "business_miles", "mileage_deduction_rate", "estimated_mileage_deduction", "fuel_cost_estimate", "maintenance_cost_estimate", "estimated_profit"];
      const rows = activeRows.map((d) => [
        exportDateValue(d),
        d.company,
        d.earnings,
        d.miles,
        ProfitEngine.mileageRateForDate(d, settings),
        mileageDeduction(d.miles, settings, d),
        fuelCostEstimate(d.miles),
        maintenanceCostEstimate(d.miles),
        deliveryProfit(d)
      ]);
      return csvRowsToText([header, ...rows]);
    }
    if (kind === "daily") {
      const header = ["date", "total_earnings", "estimated_profit", "miles", "deliveries", "average_dollars_per_mile", "gross_hour", "profit_hour"];
      return csvRowsToText([header, ...buildDailySummaryRows()]);
    }
    const header = ["date", "company", "restaurant", "earnings", "miles", "minutes", "zone", "note", "source"];
    const rows = activeRows.map((d) => [
      exportDateValue(d),
      d.company,
      d.merchant || "",
      d.earnings,
      d.miles,
      d.minutes || "",
      d.zone || "",
      d.notes || d.note || "",
      d.source || "manual"
    ]);
    return csvRowsToText([header, ...rows]);
  }

  async function shareOrDownload(content, filename, type) {
    if (navigator.canShare && typeof File === "function") {
      try {
        const file = new File([content], filename, { type });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: filename });
          return;
        }
      } catch (err) {
        if (err && err.name === "AbortError") return;
      }
    }
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function exportCSV(kind = "standard") {
    const csv = "﻿" + buildCSV(kind);
    const suffixMap = { tax: "tax", daily: "daily-summary", standard: "deliveries" };
    const labelMap = { tax: "Tax CSV exported.", daily: "Daily summary CSV exported.", standard: "CSV exported." };
    await shareOrDownload(csv, `giglens-${suffixMap[kind] || "deliveries"}-${todayKey()}.csv`, "text/csv;charset=utf-8");
    const activeCount = activeDeliveriesSorted().length;
    toast(activeCount ? (labelMap[kind] || "CSV exported.") : `${labelMap[kind] || "CSV exported."} Header-only file because no deliveries are saved yet.`);
  }

  function buildBackupPayload(reason = "manual export") {
    return {
      app: "GigLens",
      version: BACKUP_VERSION,
      dataVersion: DATA_VERSION,
      appDataVersion: DATA_VERSION,
      exportedAt: new Date().toISOString(),
      savedAt: new Date().toISOString(),
      reason,
      schema: {
        delivery: ["id", "date", "createdAt", "capturedAt", "timestampSource", "timestampConfidence", "timestampEvidence", "updatedAt", "company", "merchant", "restaurant", "merchantType", "earnings", "miles", "minutes", "zone", "note", "notes", "source", "ocrText", "ocrConfidence", "tags", "deleted", "version"],
        settings: ["dailyGoal", "defaultCompany", "defaultZone", "gasPrice", "vehicleMpg", "maintenanceCostPerMile", "mileageDeductionMode", "mileageDeductionRate", "minimumDollarPerMile", "minimumDollarPerHour", "minimumPayout", "maxMiles", "customZones", "theme", "appDataVersion"],
        shift: ["active", "paused", "pausedAt", "breaks", "startedAt", "endedAt", "lastSummary", "shiftHistory", "activeHours", "recommendation", "metrics", "appDataVersion"],
        decision: ["id", "outcome", "company", "pay", "miles", "minutes", "zone", "note", "source", "createdAt", "version"],
        ocrLearning: ["version", "corrections"]
      },
      settings,
      shift,
      deliveries,
      decisions,
      ocrLearning
    };
  }

  async function exportBackup() {
    const backup = buildBackupPayload("manual export");
    await shareOrDownload(JSON.stringify(backup, null, 2), `giglens-backup-${todayKey()}.json`, "application/json;charset=utf-8");
    toast("Backup exported.");
  }

  function parseBackupDate(value) {
    if (!value) return "Unknown";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
  }

  function validateBackupPayload(parsed) {
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { valid: false, message: "Backup file must be a JSON object." };
    }
    const hasDeliveries = Array.isArray(parsed.deliveries);
    const rawDecisions = Array.isArray(parsed.decisions) ? parsed.decisions : [];
    const importedDecisions = normalizeDecisions(rawDecisions);
    const ocrLearningIncluded = Boolean(parsed.ocrLearning && typeof parsed.ocrLearning === "object" && !Array.isArray(parsed.ocrLearning));
    const importedOCRLearning = normalizeOCRLearning(parsed.ocrLearning);
    const settingsIncluded = Boolean(parsed.settings && typeof parsed.settings === "object" && !Array.isArray(parsed.settings));
    const shiftIncluded = Boolean(parsed.shift && typeof parsed.shift === "object" && !Array.isArray(parsed.shift));
    if (!hasDeliveries && !settingsIncluded && !shiftIncluded) {
      return { valid: false, message: "Backup must include deliveries, settings, or shift data." };
    }
    const rawDeliveries = hasDeliveries ? parsed.deliveries : [];
    const importedDeliveries = rawDeliveries
      .map((d) => normalizeDelivery({ ...d, source: validSources.has(d?.source) ? d.source : "import" }))
      .filter(Boolean);
    if (rawDeliveries.length && !importedDeliveries.length) {
      return { valid: false, message: "Backup contains deliveries, but none are valid GigLens records." };
    }
    return {
      valid: true,
      app: cleanText(parsed.app || "Unknown app", 80),
      exportedAt: parsed.exportedAt || parsed.savedAt || null,
      appDataVersion: parsed.appDataVersion || parsed.dataVersion || parsed.version || "unknown",
      deliveries: importedDeliveries,
      decisions: importedDecisions,
      decisionCount: importedDecisions.length,
      ocrLearning: importedOCRLearning,
      ocrLearningIncluded,
      correctionCount: importedOCRLearning.corrections.length,
      deliveryCount: importedDeliveries.length,
      settingsIncluded,
      shiftIncluded,
      settings: settingsIncluded ? normalizeSettings(parsed.settings) : null,
      shift: shiftIncluded ? normalizeShift(parsed.shift) : null
    };
  }

  function renderImportPreview() {
    if (!els.importPreview) return;
    if (!pendingImport) {
      els.importPreview.classList.add("hidden");
      els.importPreview.setAttribute("aria-hidden", "true");
      return;
    }
    els.importPreview.classList.remove("hidden");
    els.importPreview.removeAttribute("aria-hidden");
    if (els.importPreviewStatus) els.importPreviewStatus.textContent = "Validated";
    if (els.importPreviewMeta) {
      els.importPreviewMeta.innerHTML = `
        <div><span>Deliveries</span><strong>${pendingImport.deliveryCount}</strong></div>
        <div><span>Decisions</span><strong>${pendingImport.decisionCount || 0}</strong></div>
        <div><span>Scanner learning</span><strong>${pendingImport.ocrLearningIncluded ? `${pendingImport.correctionCount || 0} included` : "Not included"}</strong></div>
        <div><span>Settings</span><strong>${pendingImport.settingsIncluded ? "Included" : "Not included"}</strong></div>
        <div><span>Shift</span><strong>${pendingImport.shiftIncluded ? "Included" : "Not included"}</strong></div>
        <div><span>Exported</span><strong>${escapeHTML(parseBackupDate(pendingImport.exportedAt))}</strong></div>
      `;
    }
    updateImportModeHelp();
  }

  function updateImportModeHelp() {
    if (!els.importModeHelp || !els.importModeInput) return;
    if (els.importModeInput.value === "replace") {
      els.importModeHelp.textContent = "Replace stores an emergency rollback first, then replaces deliveries and uses backup settings/shift when included.";
    } else {
      els.importModeHelp.textContent = "Merge keeps your current settings and shift state, adds new deliveries, and skips duplicate delivery IDs.";
    }
  }

  function clearPendingImport(resetInput = true) {
    pendingImport = null;
    renderImportPreview();
    if (resetInput && els.importInput) els.importInput.value = "";
  }

  async function importBackup(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const validation = validateBackupPayload(parsed);
      if (!validation.valid) {
        clearPendingImport(false);
        toast(validation.message || "Invalid GigLens backup file.");
        return;
      }
      pendingImport = validation;
      renderImportPreview();
      toast(`Backup validated: ${validation.deliveryCount} deliveries ready to import.`);
    } catch (err) {
      console.error(err);
      clearPendingImport(false);
      toast("Could not import backup. Check the JSON file.");
    } finally {
      if (els.importInput) els.importInput.value = "";
    }
  }

  function saveImportRollback(reason = "pre-import rollback") {
    const rollback = {
      ...buildBackupPayload(reason),
      savedAt: new Date().toISOString(),
      reason
    };
    writeJSON(ROLLBACK_KEY, rollback);
    writeJSON(LAST_BACKUP_KEY, rollback);
  }

  function mergeImportedDeliveries(currentDeliveries, importedDeliveries) {
    const seen = new Set();
    const merged = [];
    currentDeliveries.forEach((delivery) => {
      const normalized = normalizeDelivery(delivery);
      if (normalized && !seen.has(normalized.id)) {
        seen.add(normalized.id);
        merged.push(normalized);
      }
    });
    let added = 0;
    let skipped = 0;
    importedDeliveries.forEach((delivery) => {
      const normalized = normalizeDelivery(delivery);
      if (!normalized) return;
      if (seen.has(normalized.id)) {
        skipped += 1;
        return;
      }
      normalized.source = validSources.has(normalized.source) ? normalized.source : "import";
      seen.add(normalized.id);
      merged.push(normalized);
      added += 1;
    });
    return { deliveries: merged, added, skipped };
  }

  function confirmImportBackup() {
    if (!pendingImport) return toast("Choose a backup file first.");
    const mode = els.importModeInput?.value === "replace" ? "replace" : "merge";
    const verb = mode === "replace" ? "replace current local data" : "merge deliveries into current data";
    if (!confirm(`Confirm import and ${verb}? A rollback copy will be saved first.`)) return;
    saveImportRollback(`pre-${mode} import rollback`);
    if (mode === "replace") {
      deliveries = normalizeDeliveries(pendingImport.deliveries);
      decisions = normalizeDecisions(pendingImport.decisions || []);
      if (pendingImport.ocrLearningIncluded) ocrLearning = normalizeOCRLearning(pendingImport.ocrLearning);
      if (pendingImport.settingsIncluded) settings = normalizeSettings(pendingImport.settings);
      if (pendingImport.shiftIncluded) shift = normalizeShift(pendingImport.shift);
      persistNormalizedState();
      render();
      const count = deliveries.filter((d) => !d.deleted).length;
      clearPendingImport();
      toast(`Backup imported. Replaced local data with ${count} deliveries.`);
      return;
    }
    const result = mergeImportedDeliveries(deliveries, pendingImport.deliveries);
    deliveries = result.deliveries;
    const existingDecisionIds = new Set(decisions.map((item) => item.id));
    for (const item of normalizeDecisions(pendingImport.decisions || [])) {
      if (!existingDecisionIds.has(item.id)) { decisions.push(item); existingDecisionIds.add(item.id); }
    }
    ocrLearning = mergeOCRLearning(ocrLearning, pendingImport.ocrLearning);
    writeJSON(STORE_KEY, deliveries);
    writeJSON(DECISIONS_KEY, decisions);
    writeJSON(OCR_LEARNING_KEY, ocrLearning);
    render();
    clearPendingImport();
    toast(`Backup merged. Added ${result.added} deliveries; skipped ${result.skipped} duplicates.`);
  }

  function restoreRollback() {
    const rollback = readJSON(ROLLBACK_KEY, null);
    const validation = validateBackupPayload(rollback);
    if (!rollback || !validation.valid) return toast("No valid import rollback backup found.");
    if (!confirm(`Restore rollback from ${parseBackupDate(rollback.savedAt || rollback.exportedAt)}? This replaces current local data.`)) return;
    deliveries = normalizeDeliveries(validation.deliveries);
    decisions = normalizeDecisions(validation.decisions || []);
    if (validation.ocrLearningIncluded) ocrLearning = normalizeOCRLearning(validation.ocrLearning);
    settings = validation.settingsIncluded ? normalizeSettings(validation.settings) : settings;
    shift = validation.shiftIncluded ? normalizeShift(validation.shift) : shift;
    persistNormalizedState();
    render();
    toast("Rollback restored.");
  }

  function saveSafetySnapshot(reason = "privacy safety snapshot") {
    const snapshot = {
      ...buildBackupPayload(reason),
      savedAt: new Date().toISOString(),
      reason
    };
    writeJSON(LAST_BACKUP_KEY, snapshot);
    return snapshot;
  }

  function doubleConfirmDanger(title, typedPhrase = "DELETE") {
    if (!confirm(`${title}? Export a backup first. This action changes local browser data.`)) return false;
    const response = prompt(`Type ${typedPhrase} to confirm:`, "");
    return String(response || "").trim().toUpperCase() === typedPhrase;
  }

  function exportAllData() {
    saveSafetySnapshot("manual privacy export snapshot");
    exportBackup();
  }

  function restoreSafetyBackup() {
    const backup = readJSON(LAST_BACKUP_KEY, null) || readJSON(ROLLBACK_KEY, null);
    const validation = validateBackupPayload(backup);
    if (!backup || !validation.valid) return toast("No valid emergency backup or import rollback found.");
    if (!confirm(`Restore emergency backup from ${parseBackupDate(backup.savedAt || backup.exportedAt)}? This replaces current local data.`)) return;
    writeJSON(ROLLBACK_KEY, {
      ...buildBackupPayload("pre-emergency-restore rollback"),
      savedAt: new Date().toISOString(),
      reason: "pre-emergency-restore rollback"
    });
    deliveries = normalizeDeliveries(validation.deliveries);
    decisions = normalizeDecisions(validation.decisions || []);
    if (validation.ocrLearningIncluded) ocrLearning = normalizeOCRLearning(validation.ocrLearning);
    settings = validation.settingsIncluded ? normalizeSettings(validation.settings) : settings;
    shift = validation.shiftIncluded ? normalizeShift(validation.shift) : shift;
    persistNormalizedState();
    render();
    toast("Emergency backup restored.");
  }

  function resetSettingsOnly() {
    if (!doubleConfirmDanger("Reset settings only", "RESET")) return toast("Settings reset canceled.");
    saveSafetySnapshot("pre-settings-reset snapshot");
    settings = normalizeSettings({});
    writeJSON(SETTINGS_KEY, settings);
    render();
    toast("Settings reset to defaults. Deliveries were kept.");
  }

  function resetDeliveriesOnly() {
    if (!doubleConfirmDanger("Reset deliveries only", "RESET")) return toast("Delivery reset canceled.");
    saveSafetySnapshot("pre-deliveries-reset snapshot");
    deliveries = [];
    writeJSON(STORE_KEY, deliveries);
    render();
    toast("Deliveries reset. Settings and shift data were kept.");
  }

  function clearAllLocalData() {
    if (!doubleConfirmDanger("Clear all GigLens local data", "DELETE")) return toast("Clear all data canceled.");
    saveSafetySnapshot("pre-clear-all-data snapshot");
    deliveries = [];
    decisions = [];
    ocrLearning = normalizeOCRLearning(null);
    settings = normalizeSettings({});
    shift = normalizeShift({ active: false, startedAt: null, endedAt: null, shiftHistory: [] });
    persistNormalizedState();
    render();
    toast("All active GigLens data cleared. Emergency restore remains available on this browser.");
  }

  async function copySummary() {
    const todays = todayDeliveries();
    if (!todays.length) return toast("No recap to copy yet.");
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
      toast("Copy is not available in this browser.");
      return;
    }
    const recap = buildDriverRecap(todays, calculate(todays));
    try {
      await navigator.clipboard.writeText(recap.text);
      toast("Daily recap copied.");
    } catch {
      toast("Copy is not available in this browser.");
    }
  }

  function saveOfferAsDelivery() {
    const pay = num(els.offerPayInput.value);
    const miles = num(els.offerMilesInput.value);
    const minutes = num(els.offerMinutesInput.value);
    const decision = evaluateOffer(pay, miles, minutes);
    if (decision.kind === "neutral") {
      renderDecision();
      if (!(pay > 0)) flagInvalid(els.offerPayInput);
      else if (!(miles > 0)) flagInvalid(els.offerMilesInput);
      else if (!(minutes > 0)) flagInvalid(els.offerMinutesInput);
      return toast("Enter valid pay, miles, and minutes before saving.");
    }
    const company = allowedCompanies.has(els.offerCompanyInput.value) ? els.offerCompanyInput.value : settings.defaultCompany;
    const note = cleanText(els.offerNoteInput.value || "Saved from accept calculator", 400);
    logCurrentDecision({ silent: true });
    const now = new Date().toISOString();
    const delivery = normalizeDelivery({
      id: makeId(),
      company,
      earnings: pay,
      miles,
      minutes,
      zone: els.offerZoneInput.value || settings.defaultZone,
      notes: note,
      source: "calculator",
      tags: [decision.title.toLowerCase()],
      createdAt: now,
      updatedAt: now,
      version: DATA_VERSION
    });
    if (!delivery) return toast("Could not save this offer.");
    deliveries.push(delivery);
    writeJSON(STORE_KEY, deliveries);
    clearOfferCalculator();
    render();
    showTab("today");
    toast(`${decision.title} offer saved as a completed delivery.`);
  }

  function flagInvalid(input) {
    input.classList.add("invalid");
    input.focus();
    setTimeout(() => input.classList.remove("invalid"), 1200);
  }

  function toast(message, action = null) {
    if (!els.toast) return;
    toastAction = action && typeof action.handler === "function" ? action.handler : null;
    if (toastAction) {
      els.toast.innerHTML = `<span>${escapeHTML(message)}</span><button type="button" data-toast-action>${escapeHTML(action.label || "Undo")}</button>`;
    } else {
      els.toast.textContent = message;
    }
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.classList.remove("show");
      toastAction = null;
    }, 4200);
  }

  function bindEvents() {
    document.querySelectorAll(".tab-btn").forEach((btn) => btn.addEventListener("click", () => {
      if (btn.dataset.tab === "add") openAdd("manual");
      else showTab(btn.dataset.tab);
    }));
    if (els.calendarPrevBtn) els.calendarPrevBtn.addEventListener("click", () => moveCalendarMonth(-1));
    if (els.calendarNextBtn) els.calendarNextBtn.addEventListener("click", () => moveCalendarMonth(1));
    if (els.calendarTodayBtn) els.calendarTodayBtn.addEventListener("click", () => {
      calendarCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      selectCalendarDay(todayKey());
    });
    if (els.calendarAddBtn) els.calendarAddBtn.addEventListener("click", addDeliveryToCalendarDay);
    if (els.calendarGrid) els.calendarGrid.addEventListener("click", (event) => {
      const day = event.target.closest("[data-calendar-day]");
      if (day?.dataset.calendarDay) selectCalendarDay(day.dataset.calendarDay);
    });
    document.querySelectorAll("[data-tab-jump]").forEach((btn) => btn.addEventListener("click", () => showTab(btn.dataset.tabJump)));
    document.querySelectorAll("[data-open-add]").forEach((btn) => btn.addEventListener("click", () => openAdd(btn.dataset.openAdd)));
    document.querySelectorAll("[data-quick-add-open]").forEach((btn) => btn.addEventListener("click", openQuickAdd));
    document.querySelectorAll("[data-quick-add-cancel]").forEach((btn) => btn.addEventListener("click", closeQuickAdd));
    $("deliveryForm").addEventListener("submit", saveDelivery);
    els.quickAddForm.addEventListener("submit", saveQuickDelivery);
    els.saveSettingsBtn.addEventListener("click", saveSettings);
    if (els.taxRateModeInput) els.taxRateModeInput.addEventListener("change", renderTaxRateMode);
    els.addCustomZoneBtn.addEventListener("click", addCustomZone);
    els.customZoneInput.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); addCustomZone(); } });
    els.customZoneList.addEventListener("click", handleCustomZoneAction);
    els.applySmartGoalBtn.addEventListener("click", applySmartGoal);
    els.ignoreSmartGoalBtn.addEventListener("click", ignoreSmartGoal);
    els.clearTodayBtn.addEventListener("click", clearToday);
    els.exportBtn.addEventListener("click", () => exportCSV("standard"));
    els.exportTaxBtn.addEventListener("click", () => exportCSV("tax"));
    els.exportDailyBtn.addEventListener("click", () => exportCSV("daily"));
    els.backupBtn.addEventListener("click", exportBackup);
    els.privacyExportAllBtn.addEventListener("click", exportAllData);
    els.privacyRestoreSafetyBtn.addEventListener("click", restoreSafetyBackup);
    if (els.resetOcrLearningBtn) els.resetOcrLearningBtn.addEventListener("click", resetOCRLearning);
    els.resetSettingsBtn.addEventListener("click", resetSettingsOnly);
    els.resetDeliveriesBtn.addEventListener("click", resetDeliveriesOnly);
    els.clearAllDataBtn.addEventListener("click", clearAllLocalData);
    els.restoreRollbackBtn.addEventListener("click", restoreRollback);
    els.importInput.addEventListener("change", (event) => importBackup(event.target.files?.[0]));
    els.confirmImportBtn.addEventListener("click", confirmImportBackup);
    els.cancelImportBtn.addEventListener("click", () => { clearPendingImport(); toast("Import canceled."); });
    els.importModeInput.addEventListener("change", updateImportModeHelp);
    els.copySummaryBtn.addEventListener("click", copySummary);
    els.shiftBtn.addEventListener("click", toggleShift);
    if (els.heroShiftBtn) els.heroShiftBtn.addEventListener("click", toggleShift);
    if (els.pauseShiftBtn) els.pauseShiftBtn.addEventListener("click", togglePauseShift);
    els.toast.addEventListener("click", (event) => {
      if (event.target.closest("[data-toast-action]") && toastAction) {
        const action = toastAction;
        toastAction = null;
        action();
      }
    });
    els.screenshotInput.addEventListener("change", (event) => scanScreenshot(event.target.files?.[0]));
    els.saveOcrBtn.addEventListener("click", saveReviewedOCR);
    els.applyOcrBtn.addEventListener("click", () => applyParsedResult(lastOCRParsed));
    els.cancelOcrBtn.addEventListener("click", () => clearOCR(true));
    els.clearOcrBtn.addEventListener("click", () => clearOCR(true));
    [els.ocrCompanyInput, els.ocrMerchantInput, els.ocrEarningsInput, els.ocrMilesInput, els.ocrMinutesInput, els.ocrDateInput, els.ocrTimeInput].filter(Boolean).forEach((input) => {
      input.addEventListener("input", renderOCRSavePreview);
      input.addEventListener("change", renderOCRSavePreview);
    });
    els.quickSaveAnotherBtn.addEventListener("click", () => saveQuickDelivery({ preventDefault() {} }, { addAnother: true }));
    els.quickScreenshotInput.addEventListener("change", (event) => scanQuickScreenshot(event.target.files?.[0]));
    els.quickClearScanBtn.addEventListener("click", () => clearQuickScan(true));
    [els.quickEarningsInput, els.quickMilesInput, els.quickMinutesInput, els.quickMerchantInput, els.quickDateInput, els.quickTimeInput].filter(Boolean).forEach((input) => input.addEventListener("input", renderQuickAddPreview));
    els.quickCompanyInput.addEventListener("change", renderQuickAddPreview);
    els.saveAddAnotherBtn.addEventListener("click", () => saveDelivery({ preventDefault() {} }, { stayOnForm: true }));
    els.cancelEditBtn.addEventListener("click", () => { clearForm(false); render(); });
    [els.earningsInput, els.milesInput, els.minutesInput].forEach((input) => input.addEventListener("input", renderDeliveryPreview));
    [els.offerPayInput, els.offerMilesInput, els.offerMinutesInput, els.offerCompanyInput, els.offerZoneInput, els.offerNoteInput].forEach((input) => input.addEventListener("input", renderDecision));
    els.calculateOfferBtn.addEventListener("click", () => renderDecision({ announce: true }));
    if (els.logDecisionBtn) els.logDecisionBtn.addEventListener("click", () => logCurrentDecision());
    if (els.exportDecisionsBtn) els.exportDecisionsBtn.addEventListener("click", exportDecisionCSV);
    els.clearOfferBtn.addEventListener("click", () => { clearOfferCalculator(); toast("Calculator cleared."); });
    els.copyDecisionBtn.addEventListener("click", copyDecisionSummary);
    els.saveOfferAsDeliveryBtn.addEventListener("click", saveOfferAsDelivery);
    els.historyList.addEventListener("click", (event) => {
      const action = event.target.closest("[data-delete],[data-edit],[data-duplicate],[data-open-add],[data-history-more]");
      if (!action) return;
      if (action.dataset.historyMore !== undefined) {
        historyDayLimit += HISTORY_PAGE_DAYS;
        renderHistory();
      } else if (action.dataset.delete) deleteDelivery(action.dataset.delete);
      else if (action.dataset.edit) editDelivery(action.dataset.edit);
      else if (action.dataset.duplicate) duplicateDelivery(action.dataset.duplicate);
      else if (action.dataset.openAdd) openAdd(action.dataset.openAdd);
    });
    if (els.calendarDayList) els.calendarDayList.addEventListener("click", (event) => {
      const action = event.target.closest("[data-delete],[data-edit],[data-duplicate]");
      if (!action) return;
      if (action.dataset.delete) deleteDelivery(action.dataset.delete);
      else if (action.dataset.edit) editDelivery(action.dataset.edit);
      else if (action.dataset.duplicate) duplicateDelivery(action.dataset.duplicate);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !els.quickAddSheet.classList.contains("hidden")) closeQuickAdd();
    });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) checkDayAndRender(true);
    });
    window.addEventListener("pageshow", () => checkDayAndRender(true));
    window.addEventListener("online", updateNetworkStatus);
    window.addEventListener("offline", updateNetworkStatus);
  }

  function checkDayAndRender(full = false) {
    const key = todayKey();
    if (key !== lastDayKey) {
      lastDayKey = key;
      render();
      return;
    }
    if (full) render();
    else renderLive();
  }

  function updateNetworkStatus() {
    if (!els.offlineBanner || !("onLine" in navigator)) return;
    const offline = navigator.onLine === false;
    if (offline) els.offlineBanner.classList.remove("hidden");
    else els.offlineBanner.classList.add("hidden");
    if (offline) els.offlineBanner.textContent = "Offline mode is active. Tracking, history, analytics, and exports still work; screenshot OCR may need internet if the OCR library has not loaded yet.";
  }

  function registerServiceWorker() {
    if (!document.querySelector('link[rel="manifest"]')) return;
    if ("serviceWorker" in navigator && ["http:", "https:"].includes(location.protocol)) {
      navigator.serviceWorker.register("service-worker.js").catch((err) => console.warn("Service worker registration failed", err));
    }
  }

  function init() {
    persistNormalizedState();
    els.companyInput.value = settings.defaultCompany;
    els.offerCompanyInput.value = settings.defaultCompany;
    els.offerZoneInput.value = settings.defaultZone || "";
    if (els.offerNoteInput) els.offerNoteInput.value = "";
    els.zoneInput.value = settings.defaultZone || "";
    const initialTimestamp = new Date();
    if (els.deliveryDateInput) els.deliveryDateInput.value = localDateInputValue(initialTimestamp);
    if (els.deliveryTimeInput) els.deliveryTimeInput.value = localTimeInputValue(initialTimestamp);
    if (els.ocrDateInput) els.ocrDateInput.value = localDateInputValue(initialTimestamp);
    if (els.ocrTimeInput) els.ocrTimeInput.value = localTimeInputValue(initialTimestamp);
    renderZoneControls();
    setQuickAddDefaults(true);
    bindEvents();
    render();
    updateNetworkStatus();
    registerServiceWorker();
    setInterval(() => checkDayAndRender(false), 30000);
  }

  init();
})();
