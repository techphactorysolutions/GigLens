import json
import re
import subprocess
import unittest
from html.parser import HTMLParser
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]


class AssetParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.id_list = []
        self.assets = []
        self.scripts = []
        self.classes = set()
        self.buttons = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'button':
            self.buttons.append(attrs)
        if 'id' in attrs:
            self.ids.add(attrs['id'])
            self.id_list.append(attrs['id'])
        for class_name in attrs.get('class', '').split():
            self.classes.add(class_name)
        if tag == 'link' and attrs.get('rel') in {'stylesheet', 'manifest', 'apple-touch-icon', 'icon'}:
            href = attrs.get('href')
            if href and not href.startswith(('http://', 'https://', 'data:')):
                self.assets.append(href)
        if tag == 'script':
            src = attrs.get('src')
            if src:
                self.scripts.append(src)
                if not src.startswith(('http://', 'https://')):
                    self.assets.append(src)


class DriveLedgerStaticAppTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = (PROJECT_ROOT / 'index.html').read_text(encoding='utf-8')
        cls.app_js = (PROJECT_ROOT / 'app.js').read_text(encoding='utf-8')
        cls.css = (PROJECT_ROOT / 'styles.css').read_text(encoding='utf-8')
        cls.service_worker = (PROJECT_ROOT / 'service-worker.js').read_text(encoding='utf-8')
        cls.parser = AssetParser()
        cls.parser.feed(cls.html)

    def test_required_package_files_exist(self):
        for rel in ['index.html', 'styles.css', 'app.js', 'manifest.json', 'service-worker.js', 'icons/giglens-icon-180.png', 'icons/giglens-icon-180-v401.png', 'icons/giglens-icon-192-v401.png', 'icons/giglens-icon-512-v401.png', 'icons/giglens-icon-1024-v401.png', 'apple-touch-icon.png', 'favicon.png', '.nojekyll', '404.html', 'CLAUDE_REVIEW_AUDIT.md']:
            self.assertTrue((PROJECT_ROOT / rel).is_file(), f'missing {rel}')

    def test_html_referenced_local_assets_exist(self):
        for rel in self.parser.assets:
            self.assertTrue((PROJECT_ROOT / rel).is_file(), f'HTML references missing asset {rel}')

    def test_manifest_is_valid_and_icon_paths_exist(self):
        manifest = json.loads((PROJECT_ROOT / 'manifest.json').read_text(encoding='utf-8'))
        self.assertEqual(manifest.get('short_name'), 'GigLens')
        self.assertIn('Driver Command Center', manifest.get('name', ''))
        self.assertEqual(manifest.get('display'), 'standalone')
        self.assertIn('standalone', manifest.get('display_override', []))
        self.assertEqual(manifest.get('start_url'), './')
        self.assertEqual(manifest.get('scope'), './')
        self.assertEqual(manifest.get('theme_color'), '#07111f')
        self.assertEqual(manifest.get('background_color'), '#07111f')
        self.assertIn('finance', manifest.get('categories', []))
        self.assertFalse(manifest.get('prefer_related_applications'))
        for icon in manifest.get('icons', []):
            self.assertTrue((PROJECT_ROOT / icon['src']).is_file(), f"manifest references missing icon {icon['src']}")
            self.assertIn('maskable', icon.get('purpose', ''))


    def test_service_worker_cached_assets_exist(self):
        match = re.search(r'const\s+CORE_ASSETS\s*=\s*\[(.*?)\];', self.service_worker, re.S)
        self.assertIsNotNone(match, 'service worker CORE_ASSETS list not found')
        cached_assets = re.findall(r'["\']([^"\']+)["\']', match.group(1))
        self.assertIn('./index.html', cached_assets)
        self.assertIn('./styles.css', cached_assets)
        self.assertIn('./app.js', cached_assets)
        self.assertIn('./manifest.json', cached_assets)
        self.assertIn('./icons/giglens-icon-192-v401.png', cached_assets)
        self.assertIn('./icons/giglens-icon-512-v401.png', cached_assets)
        self.assertIn('CACHE_VERSION = "v38-giglens-icon-ocr-repair"', self.service_worker)
        self.assertIn('OFFLINE_FALLBACK = "./index.html"', self.service_worker)
        self.assertIn('networkFirst(request)', self.service_worker)
        self.assertIn('staleWhileRevalidate(request)', self.service_worker)
        self.assertIn('Tesseract CDN', self.service_worker)
        for rel in cached_assets:
            if rel == './':
                continue
            self.assertTrue((PROJECT_ROOT / rel.replace('./', '', 1)).is_file(), f'service worker references missing cached asset {rel}')

    def test_javascript_syntax_is_valid(self):
        for rel in ['app.js', 'service-worker.js']:
            result = subprocess.run(['node', '--check', rel], cwd=PROJECT_ROOT, text=True, capture_output=True)
            self.assertEqual(result.returncode, 0, result.stderr or result.stdout)

    def test_dom_ids_referenced_by_app_exist(self):
        referenced = set(re.findall(r'\$\("([A-Za-z0-9_-]+)"\)', self.app_js))
        missing = sorted(referenced - self.parser.ids)
        self.assertEqual(missing, [], f'app.js references missing DOM IDs: {missing}')
        self.assertIn('trend-card', self.parser.classes)


    def test_html_ids_are_unique(self):
        duplicates = sorted({item for item in self.parser.id_list if self.parser.id_list.count(item) > 1})
        self.assertEqual(duplicates, [], f'duplicate HTML IDs found: {duplicates}')

    def test_ui_controls_are_bound_to_real_logic(self):
        expected_bindings = [
            'deliveryForm',
            'saveSettingsBtn',
            'applySmartGoalBtn',
            'ignoreSmartGoalBtn',
            'clearTodayBtn',
            'exportBtn',
            'exportTaxBtn',
            'exportDailyBtn',
            'backupBtn',
            'restoreRollbackBtn',
            'importInput',
            'confirmImportBtn',
            'cancelImportBtn',
            'privacyExportAllBtn',
            'privacyRestoreSafetyBtn',
            'resetSettingsBtn',
            'resetDeliveriesBtn',
            'clearAllDataBtn',
            'importModeInput',
            'saveAddAnotherBtn',
            'quickAddForm',
            'quickSaveAnotherBtn',
            'quickScreenshotInput',
            'quickClearScanBtn',
            'cancelEditBtn',
            'copySummaryBtn',
            'shiftBtn',
            'screenshotInput',
            'applyOcrBtn',
            'saveOcrBtn',
            'cancelOcrBtn',
            'clearOcrBtn',
            'calculateOfferBtn',
            'clearOfferBtn',
            'copyDecisionBtn',
            'saveOfferAsDeliveryBtn',
            'historyList',
        ]
        for element_id in expected_bindings:
            self.assertIn(element_id, self.parser.ids)
            self.assertRegex(self.app_js, rf'(\$\("{element_id}"\)|els\.{element_id})\.addEventListener')
        self.assertIn('scanScreenshot', self.app_js)
        self.assertIn('evaluateOffer', self.app_js)
        self.assertIn('exportBackup', self.app_js)
        self.assertIn('importBackup', self.app_js)
        self.assertIn('undoDelete', self.app_js)
        self.assertIn('Copy is not available in this browser', self.app_js)
        self.assertNotIn('/api/', self.app_js, 'static UI should not call missing backend API routes')


    def test_no_visible_buttons_are_orphaned(self):
        delegated_attrs = {'data-tab', 'data-open-add', 'data-tab-jump', 'data-quick-add-open', 'data-quick-add-cancel'}
        form_submit_ids = {'saveDeliveryBtn', 'quickSaveBtn'}
        for attrs in self.parser.buttons:
            if any(name in attrs for name in delegated_attrs):
                continue
            button_id = attrs.get('id')
            self.assertTrue(button_id, f'button without id or delegated data action: {attrs}')
            if attrs.get('type') == 'submit' or button_id in form_submit_ids:
                continue
            self.assertRegex(
                self.app_js,
                rf'(\$\("{button_id}"\)|els\.{button_id})\.addEventListener',
                f'button #{button_id} appears visible but has no direct/delegated listener'
            )

    def test_storage_is_local_and_namespaced(self):
        self.assertIn('giglens.deliveries.v1', self.app_js)
        self.assertIn('giglens.settings.v1', self.app_js)
        self.assertIn('giglens.shift.v1', self.app_js)
        self.assertIn('giglens.rollback.v1', self.app_js)
        self.assertIn('DATA_VERSION', self.app_js)
        self.assertNotRegex(self.app_js, r'indexedDB\.open\([^)]*[^a-zA-Z]')
        self.assertNotRegex(self.app_js, r'fetch\(["\']/(api|backend)')


    def test_upgraded_ui_surfaces_are_present(self):
        required_ids = {
            'profitToday', 'profitHour', 'profitMile', 'taxDeduction', 'driverScore',
            'dailySummary', 'zoneBreakdown', 'ocrReview', 'decisionResult',
            'offerPayInput', 'offerMilesInput', 'offerMinutesInput', 'offerNoteInput',
            'calculateOfferBtn', 'clearOfferBtn', 'copyDecisionBtn', 'gasPriceInput',
            'smartGoalCard', 'smartGoalStatus', 'smartGoalSuggestion', 'smartGoalStats',
            'smartGoalExplanation', 'applySmartGoalBtn', 'ignoreSmartGoalBtn',
            'mpgInput', 'maintenanceInput', 'taxRateInput', 'minPerMileInput',
            'minPerHourInput', 'minPayoutInput', 'maxMilesInput', 'backupBtn',
            'importInput', 'exportTaxBtn', 'exportDailyBtn', 'restoreRollbackBtn', 'saveAddAnotherBtn',
            'offerZoneInput', 'heroShiftBtn', 'heroStatusLabel', 'paceCard',
            'projectedTotal', 'goalEta', 'paceRecommendation', 'efficiencyCard',
            'avgDeliveryValue', 'taxCard', 'taxRateLabel', 'taxMiles',
            'vehicleCostToday', 'performanceCard', 'bestCompanyToday', 'worstCompanyToday',
            'bestZoneToday', 'worstZoneToday', 'performanceRecommendation', 'quickAddSheet',
            'quickAddForm', 'quickCompanyInput', 'quickEarningsInput',
            'quickMilesInput', 'quickMinutesInput', 'quickZoneInput',
            'quickNotesDetails', 'quickNotesInput', 'quickMerchantInput', 'quickScreenshotInput',
            'quickScanStatus', 'quickPreviewImage', 'quickOcrDetails', 'quickOcrText',
            'quickClearScanBtn', 'quickManualDetails', 'quickDeliveryPreview',
            'quickSaveBtn', 'quickSaveAnotherBtn', 'quickCancelBtn',
            'quickAddOpenBtn', 'analyticsBestCompany', 'analyticsWorstCompany',
            'analyticsBestZone', 'analyticsWorstZone', 'analyticsBestHourToday',
            'analyticsWeeklyBestHour', 'analyticsCompanyBreakdown',
            'analyticsZoneBreakdown', 'analyticsHourlyBreakdown', 'ocrCompanyInput', 'ocrMerchantInput', 'ocrEarningsInput',
            'ocrMilesInput', 'ocrMinutesInput', 'ocrMerchant', 'merchantInput', 'ocrMinutes',
            'ocrConfidenceLabel', 'ocrSavePreview', 'saveOcrBtn',
            'cancelOcrBtn', 'importPreview', 'importPreviewStatus', 'importPreviewMeta',
            'importModeInput', 'importModeHelp', 'confirmImportBtn', 'cancelImportBtn',
            'dailyRecapCard', 'recapStatus', 'recapMetrics', 'recapRecommendation', 'shiftHistoryList',
            'privacyCenter', 'privacyStorageStatus', 'privacyDataLocation', 'storageUsageEstimate',
            'storageUsageDetails', 'privacyExportAllBtn', 'privacyRestoreSafetyBtn',
            'resetSettingsBtn', 'resetDeliveriesBtn', 'clearAllDataBtn'
        }
        missing = sorted(required_ids - self.parser.ids)
        self.assertEqual(missing, [], f'upgraded UI IDs missing from index.html: {missing}')
        self.assertIn('data-tab="decide"', self.html)
        self.assertIn('Accept calculator', self.html)

    def test_phase7_profit_engine_is_centralized(self):
        self.assertIn('const ProfitEngine', self.app_js)
        for method in [
            'fuelCostPerMile', 'maintenanceCost', 'vehicleCostPerMile',
            'estimatedDeliveryProfit', 'estimatedProfitPerMile', 'grossDollarPerMile',
            'grossHourlyRate', 'profitHourlyRate', 'mileageDeduction',
            'projectedDailyEarnings', 'goalETA', 'driverScore', 'summarizeRows'
        ]:
            self.assertIn(method, self.app_js)
        self.assertIn('return ProfitEngine.summarizeRows(rows', self.app_js)
        self.assertIn('return ProfitEngine.driverScore(c, settings)', self.app_js)
        self.assertNotIn('earnings - miles * costPerMile()', self.app_js)
        self.assertNotIn('pay - miles * costPerMile()', self.app_js)
        self.assertNotIn('Number(d.miles || 0) * costPerMile()', self.app_js)

    def test_profit_tax_backup_and_decision_logic_exist(self):
        expected_functions = [
            'costPerMile', 'deliveryProfit', 'driverScore', 'evaluateOffer',
            'renderDailySummary', 'renderBreakdown', 'exportBackup', 'importBackup',
            'restoreRollback', 'sourceLabel', 'buildCSV', 'saveOfferAsDelivery', 'normalizeTags', 'normalizeShiftHistoryItem', 'persistNormalizedState',
            'renderCommandMetrics', 'projectedDailyTotal', 'buildGoalEta', 'paceRecommendation', 'efficiencyRecommendation', 'performanceRecommendation', 'setStatusClass',
            'openQuickAdd', 'closeQuickAdd', 'setQuickAddDefaults', 'renderQuickAddPreview', 'saveQuickDelivery', 'readQuickNumber',
            'scanQuickScreenshot', 'populateQuickFromOCR', 'clearQuickScan', 'setQuickScanState',
            'buildOfferThresholds', 'makeThreshold', 'buildDecisionSummaryText', 'copyDecisionSummary', 'clearOfferCalculator',
            'fuelCostPerMile', 'maintenanceCost', 'vehicleCostPerMile', 'estimatedDeliveryProfit',
            'estimatedProfitPerMile', 'grossDollarPerMile', 'grossHourlyRate', 'profitHourlyRate',
            'mileageDeduction', 'projectedDailyEarnings', 'goalETA'
        ]
        for name in expected_functions:
            self.assertRegex(self.app_js, rf'function\s+{name}\s*\(')
        for metadata_key in ['date', 'merchant', 'restaurant', 'source', 'ocrText', 'ocrConfidence', 'tags', 'deleted', 'createdAt', 'updatedAt', 'version']:
            self.assertIn(metadata_key, self.app_js)
        for setting_key in ['gasPrice', 'vehicleMpg', 'maintenanceCostPerMile', 'mileageDeductionRate', 'minimumDollarPerMile', 'minimumDollarPerHour', 'appDataVersion']:
            self.assertIn(setting_key, self.app_js)
        for compatibility_key in ['mpg', 'maintenancePerMile', 'taxMileageRate', 'minPerMile', 'minPerHour']:
            self.assertIn(compatibility_key, self.app_js)
        self.assertIn('const ProfitEngine', self.app_js)
        self.assertIn('summarizeRows(rows', self.app_js)
        self.assertIn('vehicleCostPerMile(config = settings)', self.app_js)


    def test_phase2_storage_schema_and_migration_hooks_exist(self):
        self.assertIn('const DATA_VERSION = 12', self.app_js)
        self.assertIn('const BACKUP_VERSION = 13', self.app_js)
        required_delivery_fields = [
            'date:', 'merchant,', 'restaurant:', 'note:', 'notes,', 'tags:', 'deleted:', 'ocrText:', 'ocrConfidence:'
        ]
        for field in required_delivery_fields:
            self.assertIn(field, self.app_js)
        required_shift_fields = ['lastSummary', 'shiftHistory', 'normalizeShiftHistoryItem']
        for field in required_shift_fields:
            self.assertIn(field, self.app_js)
        self.assertIn('raw.vehicleMpg ?? raw.mpg', self.app_js)
        self.assertIn('raw.maintenanceCostPerMile ?? raw.maintenancePerMile', self.app_js)
        self.assertIn('raw.mileageDeductionRate ?? raw.taxMileageRate', self.app_js)
        self.assertIn('raw.minimumDollarPerMile ?? raw.minPerMile', self.app_js)
        self.assertIn('persistNormalizedState();', self.app_js)
        self.assertIn('schema:', self.app_js)

    def test_phase3_command_center_surfaces_are_present(self):
        required_today_labels = [
            'Pace', 'Projected today', 'Goal ETA', 'Efficiency', 'Avg delivery',
            'Tax estimate', 'Mileage deduction', 'Vehicle cost',
            'Performance', 'Best company', 'Best zone', 'Last delivery impact'
        ]
        for label in required_today_labels:
            self.assertIn(label, self.html)
        for token in ['status-good', 'status-warning', 'status-danger', 'status-neutral']:
            self.assertIn(token, self.app_js + self.html + (PROJECT_ROOT / 'styles.css').read_text(encoding='utf-8'))
        self.assertIn('if (els.heroShiftBtn) els.heroShiftBtn.addEventListener("click", toggleShift);', self.app_js)
        self.assertIn('grossPerMile', self.app_js)

    def test_phase4_quick_add_bottom_sheet_surfaces_are_present(self):
        required_labels = [
            'Quick Add Delivery', 'One-hand entry', 'Save + Add Another', 'Add note'
        ]
        for label in required_labels:
            self.assertIn(label, self.html)
        self.assertIn('data-quick-add-open', self.html)
        self.assertIn('data-quick-add-cancel', self.html)
        self.assertIn('quick-add-sheet', self.html)
        self.assertIn('sheet-panel', self.html)
        self.assertIn('quick-field-grid', self.html)
        self.assertIn('miles === 0', self.app_js)
        self.assertIn('quickDefaultCompany', self.app_js)
        self.assertIn('quickDefaultZone', self.app_js)
        self.assertIn('document.querySelectorAll("[data-quick-add-open]")', self.app_js)
        self.assertIn('els.quickAddForm.addEventListener("submit", saveQuickDelivery)', self.app_js)
        self.assertIn('els.quickSaveAnotherBtn.addEventListener("click"', self.app_js)


    def test_phase5_ocr_review_system_surfaces_are_present(self):
        required_labels = [
            'Review before saving', 'Save Reviewed', 'Use in Form',
            'Clear Scan', 'View scanned text', 'High confidence',
            'Medium confidence', 'Needs review'
        ]
        combined = self.html + self.app_js
        for label in required_labels:
            self.assertIn(label, combined)
        required_functions = [
            'scanScreenshot', 'setScanState', 'confidenceLabel', 'renderOCRReview',
            'renderOCRSavePreview', 'readOCRReviewFields', 'saveReviewedOCR',
            'parseOCR', 'detectPlatform', 'detectMerchant', 'detectKnownRestaurant', 'detectEarnings', 'detectMiles', 'detectMinutes'
        ]
        for name in required_functions:
            self.assertRegex(self.app_js, rf'function\s+{name}\s*\(')
        self.assertIn('source: "ocr"', self.app_js)
        self.assertIn('Tesseract.recognize', self.app_js)
        self.assertIn('OCR library is not loaded yet', self.app_js)
        self.assertIn('Could not scan this screenshot', self.app_js)
        self.assertIn('low-confidence OCR should not autosave', (PROJECT_ROOT / 'tools/smoke-startup.js').read_text(encoding='utf-8'))
        self.assertIn('reviewed OCR delivery was not normalized with OCR metadata', (PROJECT_ROOT / 'tools/smoke-startup.js').read_text(encoding='utf-8'))


    def test_phase6_decision_assistant_surfaces_are_present(self):
        combined = self.html + self.app_js + (PROJECT_ROOT / 'styles.css').read_text(encoding='utf-8')
        required_labels = [
            'Calculate Only', 'Copy Decision', 'Save as Completed', 'Note optional',
            'Gross $/mile', 'Gross hourly pace', 'Estimated profit',
            'Minimum payout', 'Maximum distance'
        ]
        for label in required_labels:
            self.assertIn(label, combined)
        required_functions = [
            'evaluateOffer', 'buildOfferThresholds', 'buildDecisionSummaryText',
            'copyDecisionSummary', 'clearOfferCalculator', 'safeRate', 'hourlyRate'
        ]
        for name in required_functions:
            self.assertRegex(self.app_js, rf'function\s+{name}\s*\(')
        self.assertIn('source: "calculator"', self.app_js)
        self.assertIn('threshold-row', combined)
        self.assertIn('Estimated profit is', self.app_js)
        self.assertIn('Enter valid pay, miles, and minutes before saving', self.app_js)
        self.assertIn('phase 6 accept calculator cases passed', (PROJECT_ROOT / 'tools/smoke-startup.js').read_text(encoding='utf-8'))



    def test_phase8_history_editing_and_daily_groups_exist(self):
        combined = self.html + self.app_js + (PROJECT_ROOT / 'styles.css').read_text(encoding='utf-8')
        for token in [
            'renderHistoryDay', 'data-history-day', 'day-metrics', 'history-detail-grid',
            'avg $/mile', 'gross/hour', 'tracked time', 'data-edit', 'data-duplicate',
            'data-delete', 'undoDelete', 'Delivery duplicated for today', 'Delivery deleted.'
        ]:
            self.assertIn(token, combined)
        self.assertRegex(self.app_js, r'function\s+editDelivery\s*\(')
        self.assertRegex(self.app_js, r'function\s+duplicateDelivery\s*\(')
        self.assertRegex(self.app_js, r'function\s+deleteDelivery\s*\(')
        self.assertIn('new Date().toISOString()', self.app_js)
        self.assertIn('history should render grouped day summaries', (PROJECT_ROOT / 'tools/smoke-startup.js').read_text(encoding='utf-8'))
        self.assertIn('undo delete did not restore', (PROJECT_ROOT / 'tools/smoke-startup.js').read_text(encoding='utf-8'))

    def test_phase9_platform_zone_and_hour_analytics_exist(self):
        combined = self.html + self.app_js + (PROJECT_ROOT / 'styles.css').read_text(encoding='utf-8')
        required_labels = [
            'Analytics', 'Platform performance', 'Zone performance', 'Earnings by hour',
            'Best company today', 'Worst company today', 'Best zone today',
            'Worst zone today', 'Best hour today', 'Best saved hour'
        ]
        for label in required_labels:
            self.assertIn(label, combined)
        required_ids = {
            'tab-analytics', 'analyticsBestCompany', 'analyticsWorstCompany',
            'analyticsBestZone', 'analyticsWorstZone', 'analyticsBestHourToday',
            'analyticsWeeklyBestHour', 'analyticsCompanyBreakdown',
            'analyticsZoneBreakdown', 'analyticsHourlyBreakdown',
            'worstCompanyToday', 'worstZoneToday'
        }
        self.assertEqual(sorted(required_ids - self.parser.ids), [])
        required_functions = [
            'activeDeliveries', 'aggregateGroups', 'rankedGroups', 'bestGroup',
            'worstGroup', 'renderAnalytics', 'renderAnalyticsList',
            'deliveriesWithinDays', 'rankedHourGroups', 'hourRangeLabel'
        ]
        for name in required_functions:
            self.assertRegex(self.app_js, rf'function\s+{name}\s*\(')
        self.assertIn('data-tab="analytics"', self.html)
        self.assertIn('analytics-bar', combined)
        smoke = (PROJECT_ROOT / 'tools/smoke-startup.js').read_text(encoding='utf-8')
        self.assertIn('platform analytics should aggregate multiple saved companies', smoke)
        self.assertIn('zone analytics should aggregate multiple saved zones', smoke)
        self.assertIn('hourly analytics should render real saved delivery hour metrics', smoke)
        self.assertIn('runAnalyticsEmptySmoke', smoke)

    def test_phase10_tax_and_export_center_exists(self):
        combined = self.html + self.app_js + (PROJECT_ROOT / 'styles.css').read_text(encoding='utf-8')
        required_labels = [
            'Tax & Export Center', 'Standard CSV', 'Tax CSV', 'Daily Summary CSV',
            'JSON Backup', 'not tax advice', 'Export Standard CSV',
            'Export Tax CSV', 'Export Daily Summary', 'Export Backup JSON'
        ]
        for label in required_labels:
            self.assertIn(label, combined)
        required_ids = {'exportCenter', 'exportBtn', 'exportTaxBtn', 'exportDailyBtn', 'backupBtn', 'importInput', 'restoreRollbackBtn'}
        self.assertEqual(sorted(required_ids - self.parser.ids), [])
        required_functions = [
            'csvEscape', 'csvRowsToText', 'activeDeliveriesSorted', 'buildDailySummaryRows',
            'fuelCostEstimate', 'maintenanceCostEstimate', 'buildCSV', 'exportCSV', 'exportBackup'
        ]
        for name in required_functions:
            self.assertRegex(self.app_js, rf'function\s+{name}\s*\(')
        self.assertIn('"date", "company", "restaurant", "earnings", "miles", "minutes", "zone", "note", "source"', self.app_js)
        self.assertIn('"gross_earnings", "business_miles", "mileage_deduction_rate"', self.app_js)
        self.assertIn('"fuel_cost_estimate", "maintenance_cost_estimate", "estimated_profit"', self.app_js)
        self.assertIn('"date", "total_earnings", "estimated_profit", "miles", "deliveries", "average_dollars_per_mile", "gross_hour", "profit_hour"', self.app_js)
        self.assertIn('appDataVersion: DATA_VERSION', self.app_js)
        smoke = (PROJECT_ROOT / 'tools/smoke-startup.js').read_text(encoding='utf-8')
        self.assertIn('phase 10 export center cases passed', smoke)
        self.assertIn('standard CSV did not escape commas and quotes', smoke)
        self.assertIn('empty daily CSV export should create a header-only file', smoke)



    def test_phase11_backup_restore_safety_exists(self):
        combined = self.html + self.app_js + (PROJECT_ROOT / 'styles.css').read_text(encoding='utf-8')
        required_labels = [
            'Backup preview', 'Review before importing', 'Import mode',
            'Merge deliveries with current data', 'Replace current local data',
            'Confirm Import', 'Cancel Import'
        ]
        for label in required_labels:
            self.assertIn(label, combined)
        required_ids = {
            'importPreview', 'importPreviewStatus', 'importPreviewMeta',
            'importModeInput', 'importModeHelp', 'confirmImportBtn', 'cancelImportBtn',
            'dailyRecapCard', 'recapStatus', 'recapMetrics', 'recapRecommendation', 'shiftHistoryList',
            'privacyCenter', 'privacyStorageStatus', 'privacyDataLocation', 'storageUsageEstimate',
            'storageUsageDetails', 'privacyExportAllBtn', 'privacyRestoreSafetyBtn',
            'resetSettingsBtn', 'resetDeliveriesBtn', 'clearAllDataBtn'
        }
        self.assertEqual(sorted(required_ids - self.parser.ids), [])
        required_functions = [
            'buildBackupPayload', 'validateBackupPayload', 'renderImportPreview',
            'updateImportModeHelp', 'clearPendingImport', 'saveImportRollback',
            'mergeImportedDeliveries', 'confirmImportBackup', 'restoreRollback'
        ]
        for name in required_functions:
            self.assertRegex(self.app_js, rf'function\s+{name}\s*\(')
        smoke = (PROJECT_ROOT / 'tools/smoke-startup.js').read_text(encoding='utf-8')
        for token in [
            'phase 11 backup safety cases passed',
            'valid backup import did not render preview',
            'merge import should skip duplicate delivery IDs',
            'replace import did not store rollback',
            'rollback restore did not restore previous data',
            'invalid backup should be rejected'
        ]:
            self.assertIn(token, smoke)

    def test_phase12_driver_coaching_and_daily_recaps_exist(self):
        combined = self.html + self.app_js + (PROJECT_ROOT / 'styles.css').read_text(encoding='utf-8')
        required_labels = [
            'Driver coaching', 'Daily recap', 'Copy Recap', 'Saved shift history',
            'Best delivery', 'Weakest delivery', 'Gross $/mile', 'Profit $/mile',
            'Best platform suggestion', 'Best zone suggestion'
        ]
        for label in required_labels:
            self.assertIn(label, combined)
        required_ids = {'dailyRecapCard', 'recapStatus', 'recapMetrics', 'dailySummary', 'recapRecommendation', 'shiftHistoryList', 'copySummaryBtn'}
        self.assertEqual(sorted(required_ids - self.parser.ids), [])
        required_functions = [
            'buildDriverRecap', 'buildDriverRecommendations', 'buildDriverRecapText',
            'renderRecapCard', 'renderShiftHistory', 'buildShiftSummaryText',
            'copySummary', 'toggleShift'
        ]
        for name in required_functions:
            self.assertRegex(self.app_js, rf'function\s+{name}\s*\(')
        self.assertIn('Day ended. Recap saved to shift history.', self.app_js)
        self.assertIn('recommendation: recap.recommendation', self.app_js)
        self.assertIn('metrics: recap.metrics', self.app_js)
        smoke = (PROJECT_ROOT / 'tools/smoke-startup.js').read_text(encoding='utf-8')
        for token in [
            'phase 12 driver coaching recap cases passed',
            'driver recap should render a safe no-data empty state',
            'copied daily recap missing',
            'end shift did not generate and save a full driver recap with metrics',
            'driver coaching should include platform and zone recommendations'
        ]:
            self.assertIn(token, smoke)



    def test_phase13_mobile_polish_and_accessibility_exist(self):
        css = (PROJECT_ROOT / 'styles.css').read_text(encoding='utf-8')
        combined = self.html + self.app_js + css
        required_ids = {
            'mobileActionDock', 'dockQuickAddBtn', 'dockScanBtn', 'dockDecideBtn',
            'todayBreakdownsDetails', 'quickAddHint', 'toast'
        }
        self.assertEqual(sorted(required_ids - self.parser.ids), [])
        for token in [
            'skip-link', 'mobile-action-dock', 'dock-action', 'aria-modal="true"',
            'aria-atomic="true"', 'prefers-reduced-motion', 'safe-area-inset-bottom',
            'inputmode="numeric"', 'aria-label="Quick add from a delivery screenshot"',
            'Company and zone performance', 'Save a completed order without leaving Today.'
        ]:
            self.assertIn(token, combined)
        self.assertIn('loading-state', css)
        self.assertIn('success-state', css)
        self.assertIn('error-state', css)
        self.assertRegex(css, r'@media\s*\(max-width:\s*620px\)')
        self.assertRegex(css, r'min-height:\s*58px')
        smoke = (PROJECT_ROOT / 'tools/smoke-startup.js').read_text(encoding='utf-8')
        for token in [
            'phase 13 mobile polish cases passed',
            'mobile action dock quick add button is not wired',
            'mobile scan dock action is not represented in data-open-add wiring',
            'mobile decide dock action is not represented in data-tab-jump wiring'
        ]:
            self.assertIn(token, smoke)


    def test_phase14_pwa_install_offline_release_polish_exists(self):
        manifest = json.loads((PROJECT_ROOT / 'manifest.json').read_text(encoding='utf-8'))
        combined = self.html + self.app_js + self.service_worker + (PROJECT_ROOT / 'styles.css').read_text(encoding='utf-8')
        self.assertIn('GigLens Driver Command Center', manifest.get('name', ''))
        self.assertIn('local-first gig-driver profit tracker', manifest.get('description', ''))
        self.assertIn('offlineBanner', self.parser.ids)
        for token in [
            'apple-mobile-web-app-capable', 'application-name', 'color-scheme',
            'offline-banner', 'Offline mode is active', 'updateNetworkStatus',
            'serviceWorker', 'giglens-v38-giglens-icon-ocr-repair', 'OFFLINE_FALLBACK',
            'cacheCoreAssets', 'deleteOldCaches', 'staleWhileRevalidate',
            'screenshot OCR may need internet', 'OCR library is not loaded yet'
        ]:
            self.assertIn(token, combined)
        for icon in manifest.get('icons', []):
            self.assertTrue((PROJECT_ROOT / icon['src']).is_file())
            self.assertIn('maskable', icon.get('purpose', ''))
        smoke = (PROJECT_ROOT / 'tools/smoke-startup.js').read_text(encoding='utf-8')
        for token in [
            'phase 14 PWA install and offline polish cases passed',
            'offline banner should appear when navigator.onLine is false',
            'service worker should cache core app shell assets',
            'manifest should be install-ready'
        ]:
            self.assertIn(token, smoke)



    def test_phase16_smart_goal_system_exists(self):
        combined = self.html + self.app_js + (PROJECT_ROOT / 'styles.css').read_text(encoding='utf-8')
        required_ids = {
            'smartGoalCard', 'smartGoalStatus', 'smartGoalSuggestion', 'smartGoalStats',
            'smartGoalExplanation', 'applySmartGoalBtn', 'ignoreSmartGoalBtn'
        }
        self.assertEqual(sorted(required_ids - self.parser.ids), [])
        for token in [
            'Smart goal', 'Suggested daily goal', 'Apply Suggested Goal', 'Keep Current Goal',
            'buildSmartGoalModel', 'historicalDailySummaries', 'average earnings',
            'avg gross', 'avg profit', 'avg hours', 'Today’s partial earnings are ignored'
        ]:
            self.assertIn(token, combined)
        for name in ['historicalDailySummaries', 'buildSmartGoalModel', 'renderSmartGoal', 'applySmartGoal', 'ignoreSmartGoal']:
            self.assertRegex(self.app_js, rf'function\s+{name}\s*\(')
        smoke = (PROJECT_ROOT / 'tools/smoke-startup.js').read_text(encoding='utf-8')
        for token in [
            'phase 16 smart goal cases passed',
            'smart goal should recommend the average current weekday earnings',
            'smart goal stats should show average earnings, profit, and hours by day of week',
            'apply smart goal should update dailyGoal',
            'smart goal should ignore today’s partial data'
        ]:
            self.assertIn(token, smoke)


    def test_phase17_best_time_drive_insights_exist(self):
        combined = self.html + self.app_js + (PROJECT_ROOT / 'styles.css').read_text(encoding='utf-8')
        required_ids = {
            'bestTimeCard', 'bestTimeStatus', 'bestTimeExplanation',
            'bestHoursToday', 'bestHistoricalHours', 'weakHoursList'
        }
        self.assertEqual(sorted(required_ids - self.parser.ids), [])
        for token in [
            'Best time to drive', 'Hourly insights', 'Best hours today',
            'Best historical hours', 'Weak hours', 'avg gross/hr', 'avg profit/hr',
            'buildBestTimeInsights', 'rankedHourInsightGroups', 'renderBestTimeInsights',
            'renderHourInsightList', 'pastDeliveries', 'distinctDeliveryDays'
        ]:
            self.assertIn(token, combined)
        for name in [
            'buildBestTimeInsights', 'rankedHourInsightGroups', 'renderBestTimeInsights',
            'renderHourInsightList', 'pastDeliveries', 'distinctDeliveryDays'
        ]:
            self.assertRegex(self.app_js, rf'function\s+{name}\s*\(')
        smoke = (PROJECT_ROOT / 'tools/smoke-startup.js').read_text(encoding='utf-8')
        for token in [
            'phase 17 best time insights cases passed',
            'best hours today should render average gross/hour and profit/hour metrics',
            'historical best hours should use completed past days',
            'weak hours should render low-performing historical hour cards',
            'best-time historical insight should show a clear insufficient-history empty state'
        ]:
            self.assertIn(token, smoke)



    def test_phase18_manual_zone_heatmap_exists(self):
        combined = self.html + self.app_js + (PROJECT_ROOT / 'styles.css').read_text(encoding='utf-8')
        required_ids = {
            'zoneHeatmapCard', 'zoneHeatmapStatus', 'zoneHeatmapExplanation', 'zoneHeatmapGrid',
            'zoneOptions', 'customZoneInput', 'addCustomZoneBtn', 'customZoneList'
        }
        self.assertEqual(sorted(required_ids - self.parser.ids), [])
        for token in [
            'Manual zone heatmap', 'Zone map without GPS', 'Custom zone list',
            'Best Zone', 'Reliable Zone', 'Weak Zone', 'Avoid Zone',
            'customZones', 'normalizeCustomZones', 'knownZones', 'renderZoneControls',
            'addCustomZone', 'renameCustomZone', 'deleteCustomZone',
            'buildZoneHeatmapModel', 'renderZoneHeatmap', 'zone-heatmap-grid'
        ]:
            self.assertIn(token, combined)
        for name in [
            'normalizeCustomZones', 'knownZones', 'renderZoneControls',
            'addCustomZone', 'handleCustomZoneAction', 'renameCustomZone',
            'deleteCustomZone', 'buildZoneHeatmapModel', 'renderZoneHeatmap'
        ]:
            self.assertRegex(self.app_js, rf'function\s+{name}\s*\(')
        smoke = (PROJECT_ROOT / 'tools/smoke-startup.js').read_text(encoding='utf-8')
        for token in [
            'phase 18 manual zone heatmap cases passed',
            'manual zone heatmap should render all map-style zone roles',
            'adding a custom zone should persist to settings',
            'deleting a custom zone should not corrupt saved delivery zone labels'
        ]:
            self.assertIn(token, smoke)


    def test_phase19_privacy_data_control_center_exists(self):
        combined = self.html + self.app_js + (PROJECT_ROOT / 'styles.css').read_text(encoding='utf-8')
        required_ids = {
            'privacyCenter', 'privacyStorageStatus', 'privacyDataLocation',
            'storageUsageEstimate', 'storageUsageDetails', 'privacyExportAllBtn',
            'privacyRestoreSafetyBtn', 'resetSettingsBtn', 'resetDeliveriesBtn', 'clearAllDataBtn'
        }
        self.assertEqual(sorted(required_ids - self.parser.ids), [])
        for token in [
            'Data Control Center', 'localStorage',
            'Export All Data', 'Emergency Restore Last Backup', 'Clear All Local Data',
            'doubleConfirmDanger', 'storageUsageEstimate', 'saveSafetySnapshot',
            'restoreSafetyBackup', 'resetSettingsOnly', 'resetDeliveriesOnly', 'clearAllLocalData',
            'giglens.lastBackup.v1', 'privacy-action-grid'
        ]:
            self.assertIn(token, combined)
        for name in [
            'driveLedgerStorageKeys', 'storageUsageEstimate', 'renderPrivacyCenter',
            'saveSafetySnapshot', 'doubleConfirmDanger', 'exportAllData',
            'restoreSafetyBackup', 'resetSettingsOnly', 'resetDeliveriesOnly', 'clearAllLocalData'
        ]:
            self.assertRegex(self.app_js, rf'function\s+{name}\s*\(')
        smoke = (PROJECT_ROOT / 'tools/smoke-startup.js').read_text(encoding='utf-8')
        for token in [
            'phase 19 privacy and data control cases passed',
            'Export All Data should save a last-backup snapshot and download JSON',
            'Reset Deliveries Only should clear deliveries, keep settings, and store an emergency backup',
            'dangerous privacy actions should require the second typed confirmation'
        ]:
            self.assertIn(token, smoke)



    def test_phase20_netlify_release_package_exists(self):
        redirects_path = PROJECT_ROOT / '_redirects'
        deployment_path = PROJECT_ROOT / 'DEPLOYMENT.md'
        self.assertTrue(redirects_path.is_file(), 'Netlify _redirects file is missing')
        self.assertTrue(deployment_path.is_file(), 'DEPLOYMENT.md is missing')

        redirects = redirects_path.read_text(encoding='utf-8')
        self.assertIn('/*', redirects)
        self.assertIn('/index.html', redirects)
        self.assertIn('200', redirects)

        deployment = deployment_path.read_text(encoding='utf-8')
        readme = (PROJECT_ROOT / 'README.md').read_text(encoding='utf-8')
        for token in [
            'Netlify Drop deployment', 'GitHub Pages deployment', 'iPhone install checklist', 'iPad install checklist',
            'Offline reload checklist', 'Local data persistence checklist', 'Troubleshooting',
            'index.html', 'service-worker.js', '_redirects', '.nojekyll', '404.html'
        ]:
            self.assertIn(token, deployment)
        self.assertIn('Phase 20 Netlify Release Package', readme)
        self.assertIn('DEPLOYMENT.md', readme)
        self.assertIn('Netlify Drop', readme)

        for rel in ['index.html', 'styles.css', 'app.js', 'manifest.json', 'service-worker.js', '_redirects', '.nojekyll', '404.html', 'DEPLOYMENT.md']:
            self.assertTrue((PROJECT_ROOT / rel).is_file(), f'Netlify release package missing root file {rel}')

        runtime_files = ['index.html', 'styles.css', 'app.js', 'manifest.json', 'service-worker.js', '_redirects', '404.html']
        runtime_text = '\n'.join((PROJECT_ROOT / rel).read_text(encoding='utf-8') for rel in runtime_files)
        self.assertNotRegex(runtime_text, r'https?://(localhost|127\.0\.0\.1)')
        self.assertNotRegex(runtime_text, r'/(api|backend)/')

        smoke = (PROJECT_ROOT / 'tools/smoke-startup.js').read_text(encoding='utf-8')
        self.assertIn('phase 20 Netlify release package cases passed', smoke)




    def test_platform_detection_audit_coverage_exists(self):
        self.assertTrue((PROJECT_ROOT / 'PLATFORM_DETECTION_AUDIT.md').is_file())
        for token in [
            'platformFingerprints',
            'detectPlatformDetailed',
            'DoorDash',
            'Uber Eats',
            'Grubhub',
            'Instacart',
            'Spark',
            'Roadie',
            'Catering',
        ]:
            self.assertIn(token, self.app_js)
        smoke = (PROJECT_ROOT / 'tools' / 'smoke-startup.js').read_text(encoding='utf-8')
        for token in [
            'DoorDash Dasher signal',
            'Uber Trip Radar signal',
            'Grubhub diner signal',
            'Instacart batch signal',
            'Spark Walmart signal',
            'Roadie gig signal',
            'Catering ezCater signal',
        ]:
            self.assertIn(token, smoke)

    def test_public_package_has_no_obvious_exposed_secrets(self):
        secret_patterns = [
            r'sk-[A-Za-z0-9_\-]{20,}',
            r'(ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{20,}',
            r'AKIA[0-9A-Z]{16}',
            r'AIza[0-9A-Za-z_\-]{20,}',
            r'sk_live_[0-9A-Za-z]{20,}',
            r'SG\.[A-Za-z0-9_\-]{16,}\.[A-Za-z0-9_\-]{16,}',
            r'xox[baprs]-[A-Za-z0-9\-]{20,}',
            r'https://discord(?:app)?\.com/api/webhooks/[0-9]+/[A-Za-z0-9_\-]+',
            r'-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----',
            r'eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}',
        ]
        scanned = [
            'index.html',
            'app.js',
            'styles.css',
            'manifest.json',
            'service-worker.js',
            '404.html',
            'package.json',
            'README.md',
            'AUDIT_REPORT.md',
            'CHANGELOG.md',
            'DEPLOYMENT.md',
            'SECURITY_AUDIT.md',
            'CLAUDE_REVIEW_AUDIT.md',
            '_redirects',
        ]
        for rel in scanned:
            path = PROJECT_ROOT / rel
            self.assertTrue(path.exists(), f'missing scanned file {rel}')
            text = path.read_text(encoding='utf-8')
            for pattern in secret_patterns:
                self.assertIsNone(re.search(pattern, text), f'possible exposed secret in {rel}: {pattern}')

    def test_fixed_overlay_components_keep_fixed_position(self):
        """Modern visual refreshes must not demote overlays/navigation from fixed positioning."""
        css = self.css
        required_tokens = [
            ".toast { position: fixed",
            ".quick-add-sheet { position: fixed",
            ".bottom-tabs { position: fixed",
            ".skip-link { position: fixed",
            ".mobile-action-dock { position: fixed",
        ]
        for token in required_tokens:
            self.assertIn(token, css)

        unsafe_override = ".app-shell,\n.toast,\n.quick-add-sheet,\n.bottom-tabs,\n.mobile-action-dock,\n.skip-link { position: relative"
        self.assertNotIn(unsafe_override, css)


    def test_giglens_home_screen_icons_are_real_pngs(self):
        import struct
        expected = {
            'apple-touch-icon.png': (180, 180),
            'icons/giglens-icon-180-v401.png': (180, 180),
            'icons/giglens-icon-192-v401.png': (192, 192),
            'icons/giglens-icon-512-v401.png': (512, 512),
            'icons/giglens-icon-1024-v401.png': (1024, 1024),
        }
        for rel, size in expected.items():
            data = (PROJECT_ROOT / rel).read_bytes()
            self.assertEqual(data[:8], b'\x89PNG\r\n\x1a\n', f'{rel} is not a PNG')
            width, height = struct.unpack('>II', data[16:24])
            self.assertEqual((width, height), size, f'{rel} has wrong dimensions')
            color_type = data[25]
            self.assertEqual(color_type, 2, f'{rel} should be an opaque RGB PNG for iOS')
        self.assertIn('rel="apple-touch-icon" href="./apple-touch-icon.png"', self.html)
        self.assertIn('giglens-icon-180-v401.png', self.html)

    def test_ocr_worker_has_timeout_progress_and_valid_v5_core_path(self):
        for token in [
            'OCR_INIT_TIMEOUT_MS = 20000',
            'OCR_RECOGNIZE_TIMEOUT_MS = 45000',
            'function withTimeout',
            'function formatOCRProgress',
            'function recognizeScreenshot',
            'tesseract.js-core@v5.0.0',
            'worker.terminate()',
            'Could not scan this screenshot.',
        ]:
            self.assertIn(token, self.app_js)
        self.assertNotIn('tesseract.js-core@5.1.1', self.app_js)
        self.assertIn("'wasm-unsafe-eval'", self.html)
        self.assertIn("'wasm-unsafe-eval'", (PROJECT_ROOT / '_headers').read_text(encoding='utf-8'))

    def test_v3_release_candidate_metadata_and_docs_exist(self):
        package = json.loads((PROJECT_ROOT / 'package.json').read_text(encoding='utf-8'))
        self.assertEqual(package.get('version'), '4.0.1')
        self.assertIn('v38-giglens-icon-ocr-repair', self.service_worker)
        self.assertIn('Designed by Tech Phactory Solutions', self.html)
        self.assertIn('app-credit', self.html)
        self.assertIn('maker-line', self.html)
        self.assertTrue((PROJECT_ROOT / '.nojekyll').is_file())
        self.assertIn('Designed by Tech Phactory Solutions', (PROJECT_ROOT / '404.html').read_text(encoding='utf-8'))
        readme = (PROJECT_ROOT / 'README.md').read_text(encoding='utf-8')
        audit = (PROJECT_ROOT / 'AUDIT_REPORT.md').read_text(encoding='utf-8')
        changelog = (PROJECT_ROOT / 'CHANGELOG.md').read_text(encoding='utf-8')
        for token in ['v3 Release Candidate', 'Manual QA checklist', 'Known limitations', 'GitHub Pages']:
            self.assertIn(token, readme)
        self.assertIn('Final Release Audit', audit)
        self.assertIn('4.0.1', changelog)


    def test_luxury_refinement_and_restaurant_ocr_exist(self):
        combined = self.html + self.app_js + (PROJECT_ROOT / 'styles.css').read_text(encoding='utf-8')
        for token in [
            'todayInsightsDrawer', 'Advanced insights', 'More tools',
            'luxury-disclosure', 'tool-disclosure', 'form-extra-details',
            'Restaurant / store', 'ocrMerchantInput', 'detectMerchant',
            'knownRestaurantPatterns', 'Privacy and data controls', 'extractMerchantFromLabeledText', 'isMerchantCandidate', 'stripMerchantNoise'
        ]:
            self.assertIn(token, combined)
        self.assertIn('merchant:', self.app_js)
        self.assertIn('restaurant:', self.app_js)
        self.assertIn('Chipotle', self.app_js)
        self.assertIn('McDonald', self.app_js)
        self.assertIn('Seoul Taco', (PROJECT_ROOT / 'tools/smoke-startup.js').read_text(encoding='utf-8'))
        self.assertIn('Kingside Diner', (PROJECT_ROOT / 'tools/smoke-startup.js').read_text(encoding='utf-8'))

    def test_startup_smoke_test_with_mock_browser(self):
        result = subprocess.run(['node', 'tools/smoke-startup.js'], cwd=PROJECT_ROOT, text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr or result.stdout)
        self.assertIn('passed', result.stdout)

    def test_3_6_2_screenshot_first_quick_add_exists(self):
        combined = self.html + self.app_js + (PROJECT_ROOT / 'styles.css').read_text(encoding='utf-8')
        for token in [
            'Scan order screenshot', 'Fastest path: upload the screenshot',
            'Review detected details or type manually', 'scanQuickScreenshot',
            'quickOCRText', 'source: quickOCRText ? "ocr" : "manual"'
        ]:
            self.assertIn(token, combined)
        required_ids = {
            'quickScreenshotInput', 'quickScanStatus', 'quickPreviewImage',
            'quickOcrDetails', 'quickOcrText', 'quickClearScanBtn',
            'quickManualDetails', 'quickMerchantInput'
        }
        self.assertEqual(sorted(required_ids - self.parser.ids), [])
        smoke = (PROJECT_ROOT / 'tools/smoke-startup.js').read_text(encoding='utf-8')
        self.assertIn('quick screenshot flow did not persist an OCR delivery', smoke)
        self.assertIn('quick screenshot unavailable OCR should not crash', smoke)


if __name__ == '__main__':
    unittest.main()
