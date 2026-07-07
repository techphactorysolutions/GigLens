## 3.7.5 platform detection audit repair
Claude's v3.7.4 package passed syntax and startup smoke, but the full Python suite failed because release metadata tests still expected v3.7.3. The service-worker cache also remained on the older Claude package repair cache. This build repairs those issues, adds platform-detection smoke coverage, and keeps the secret scan clean.

## 3.7.3 Claude ZIP audit
Reviewed the uploaded Claude ZIP. It did not contain functional runtime changes compared with v3.7.2, but it removed required support files: `tests/`, `tools/`, and `_redirects`. This broke smoke/unit test commands. This package restores those files, keeps the public security audit, and passes all tests.

## 3.7.2 public exposure / secret audit
No API keys, passwords, private keys, bearer tokens, GitHub tokens, OpenAI keys, AWS keys, Google API keys, Stripe keys, SendGrid keys, Slack tokens, Discord webhooks, JWT-like tokens, or `.env` files were found. Added `SECURITY_AUDIT.md` and regression coverage for future secret scans.

## 3.7.1 audit and bug fix
Audit found one real UI regression introduced by the 3.7.0 visual refresh: a broad CSS layering rule could make fixed UI layers behave like normal relative elements. Fixed components include toast, Quick Add sheet, bottom tabs, mobile action dock, and skip link. Regression tests were added and all test suites pass.

## UI refresh addendum
This pass focused on visual refinement only. Core logic, storage, OCR, analytics, and exports were preserved. Styles were modernized to give the app a more premium and interesting feel while keeping the simplified surface layout.

# DriveLedger Audit Report

## 3.6.4 Subtle Tech Phactory Design Credit Audit

Scope: targeted repair after the user reported the in-app credit was not visible enough and requested subtle wording: “Designed by Tech Phactory Solutions”. The app remains a static local-first PWA with no backend, framework, build step, database server, or account system.

Findings and fixes:

- Finding: GitHub Pages deployments can fail or serve incorrectly when a static PWA package is uploaded as a ZIP, uploaded one folder too deep, processed by Jekyll, or pointed at the wrong branch/root.
  - Fix: Added `.nojekyll`, added a lightweight `404.html` fallback, and expanded `DEPLOYMENT.md` with GitHub Pages root-upload and failed-deployment troubleshooting.
- Finding: The prior credit could be missed in the app and used the wrong wording.
  - Fix: Changed the visible in-app credit to **Designed by Tech Phactory Solutions** and tuned the styling to be subtle but readable in the header/footer and 404 fallback.
- Finding: GitHub Pages project URLs require relative paths.
  - Fix: Re-verified manifest, icons, stylesheet, app script, and service worker cache paths remain relative.

Tests run:

```bash
npm run syntax
npm run smoke
python -m unittest discover -s tests -v
```

Result: all tests passed.

Remaining risks:

- The screenshot does not include the GitHub Pages build log, so the package includes common static-site fixes and deployment instructions, but the exact GitHub failure reason should still be checked in the red failed deployment log if it happens again.
- Real GitHub Pages deployment testing is still recommended after uploading the unzipped package contents to the repository root.
- Data remains localStorage-based; users should export JSON backups regularly.

## 3.6.2 Screenshot-First Quick Add Audit

Scope: targeted repair after user testing showed the main Quick Add flow still treated screenshots as secondary. The app was audited, changed, and tested so Quick Add now supports direct screenshot OCR without leaving Today.

Findings and fixes:

- Finding: Quick Add was primarily manual-entry oriented.
  - Fix: Added screenshot upload, scan state, preview, raw OCR text, and clear-scan controls inside the Quick Add bottom sheet.
- Finding: Screenshot OCR saves from Quick Add needed to preserve OCR provenance.
  - Fix: Quick Add now saves scanned deliveries as `source: "ocr"` with `ocrText`, `ocrConfidence`, and `merchant`.
- Finding: The mobile dock still communicated generic “Quick Add.”
  - Fix: Updated the primary dock action to “Scan Add” so the fastest screenshot workflow is visually obvious.
- Finding: The mobile action dock had a stray closing button tag.
  - Fix: Removed the stray tag during the markup cleanup.

Tests run:

```bash
npm run syntax
npm run smoke
python -m unittest discover -s tests -v
```

Result: all tests passed.


# Audit Report

## 3.6.1 OCR Merchant Detection Repair Audit

### Scope

Used `DriveLedger_v3_6_0_Luxury_OCR_Refinement.zip` as the base. The user reported that screenshot OCR still had trouble identifying the restaurant/store. This pass focused only on OCR merchant parsing, tests, docs, package metadata, and cache versioning. No backend, framework, GPS, account system, or UI redesign was added.

### Findings / implementation

- Confirmed the existing OCR parser relied too heavily on known chain patterns and simple `Pickup from ...` lines.
- Added semantic OCR line splitting so jumbled screenshot text is broken around pickup, restaurant, store, merchant, go-to, delivery, distance, and payout labels.
- Added stronger merchant cleanup for trailing addresses, phone numbers, item counts, money, distance, and status text.
- Added candidate scoring for local restaurant names, merchant labels, standalone pickup blocks, nearby pickup context, restaurant-category words, and known chains.
- Added rejection filters for platform names, payout terms, addresses, customer/drop-off labels, navigation terms, item counts, and numeric-only lines.
- Expanded known restaurant matching with additional chain and St. Louis-relevant patterns while still allowing local restaurant detection without a fixed list.
- Expanded smoke tests with Uber Eats, DoorDash, and Grubhub-like OCR samples, including local merchants and merchant lines with trailing street addresses.

### Tests run

```bash
npm run syntax
npm run smoke
python -m unittest discover -s tests -v
```

Result: `npm run syntax` passed, `npm run smoke` passed, and Python unittest passed.

### Remaining risks

- Restaurant detection is still heuristic because OCR text quality varies by screenshot crop, app layout, font, background, and image clarity.
- The OCR review card remains intentionally editable; users should correct the restaurant before saving when the screenshot is ambiguous.
- Real iPhone/iPad Safari testing with actual DoorDash/Uber/Grubhub screenshots is still recommended.


## Phase 21 Luxury Simplification + OCR Restaurant Detection Audit

### Scope

Used the latest DriveLedger Phase 20 Netlify Release Package ZIP as the base. The goal was to respond to testing feedback that the app felt cluttered and that screenshot OCR did not detect the restaurant/store name reliably enough. The app remains a static local-first PWA with no backend, framework, build step, account system, GPS dependency, or cloud data store.

### Findings / implementation

- Confirmed baseline syntax, smoke, and Python test coverage before changes.
- Reduced first-view clutter on Today by keeping the hero, Quick Add, and last-delivery impact visible while moving detailed metric cards, daily recap, and breakdowns behind an Advanced insights disclosure.
- Moved secondary Today actions into a More tools disclosure so Quick Add remains the main one-hand action.
- Simplified the mobile action dock by keeping Quick Add prominent and hiding secondary dock shortcuts.
- Moved export/backup tools, custom-zone management, and privacy/data controls behind disclosure panels to reduce button-heavy screens without removing functionality.
- Added OCR merchant/restaurant detection using a local heuristic parser, known restaurant chain patterns, pickup/merchant labels, and rejection filters for platform/payment/address text.
- Added editable Restaurant / store field in the OCR review card and optional manual Restaurant / store field under More details.
- Saved restaurant data locally on delivery records as `merchant` and `restaurant` for compatibility.
- Displayed saved restaurant names in History and included a `restaurant` column in standard CSV export.
- Updated backup schema metadata, data schema version, service-worker cache version, package metadata, README, changelog, and tests.

### Tests run

```bash
npm run syntax
npm run smoke
python -m unittest discover -s tests -v
```

Result after refinement: `npm run syntax` passed, `npm run smoke` passed, and Python unittest passed.

### Remaining risks

- OCR restaurant detection is heuristic and may still require manual correction for unusual screenshots, local restaurants with stylized names, cropped screenshots, or poor image quality.
- Real iPhone/iPad Safari testing is still recommended for the new disclosure layout and mobile action dock.
- Data remains stored in browser `localStorage`; users should keep JSON backups.
- Screenshot OCR still depends on the remote Tesseract CDN if the library has not already loaded.

## Phase 20 Netlify Release Package Audit

### Scope

Used the latest DriveLedger Phase 19 Privacy and Data Control Center ZIP as the base and prepared the static PWA package for simple Netlify Drop deployment. No backend, framework, build step, environment variable, database server, account system, or runtime localhost dependency was added.

### Findings / implementation

- Confirmed runtime files are at the package root or correctly referenced from the root.
- Added Netlify `_redirects` with static fallback to `index.html`.
- Added `DEPLOYMENT.md` with Netlify Drop deployment steps.
- Added iPhone Safari install checklist.
- Added iPad Safari install checklist.
- Added offline reload checklist.
- Added localStorage persistence checklist.
- Added troubleshooting guidance for stale service workers, offline loading, OCR CDN failures, local data loss, and incorrect folder uploads.
- Verified runtime files do not depend on absolute localhost-only paths.
- Preserved the local-first static PWA architecture.
- Bumped package version to `3.5.0`.
- Bumped PWA service-worker cache to `driveledger-v24-phase20-netlify-release`.
- Added static tests for `_redirects`, `DEPLOYMENT.md`, root package structure, and no localhost-only runtime references.
- Added smoke coverage marker for Phase 20 release-package checks.

### Tests run

```bash
npm run syntax
npm run smoke
python -m unittest discover -s tests -v
```

Result after Phase 20 implementation: `npm run syntax` passed, `npm run smoke` passed, and Python unittest passed.

## Phase 19 Privacy and Data Control Center Audit

### Scope

Used the latest DriveLedger Phase 18 Zone Heatmap ZIP as the base and added a privacy/data control center while preserving the static local-first PWA architecture. No backend, account system, cloud storage, GPS upload, analytics service, framework, or build step was added.

### Findings / implementation

- Added a Privacy and Data Control Center card in Settings.
- Added plain-language explanation that DriveLedger stores data locally in browser `localStorage` under namespaced `driveledger.*` keys.
- Added localStorage usage estimation for DriveLedger keys.
- Added Export All Data, reusing the existing JSON backup pipeline.
- Added Import Backup entry point that reuses the existing validated preview, merge/replace, and rollback-safe import workflow.
- Added double-confirmed Reset Settings Only.
- Added double-confirmed Reset Deliveries Only.
- Added double-confirmed Clear All Local Data.
- Added emergency restore from the latest safety backup/export/import rollback snapshot.
- Added `driveledger.lastBackup.v1` as a local safety snapshot key.
- Preserved existing delivery history, backup import validation, and rollback behavior.
- Bumped data schema to `7`, backup schema to `8`, package to `3.4.0`, and service-worker cache to `driveledger-v23-phase19-privacy-center`.

### Tests run

```bash
npm run syntax
npm run smoke
python -m unittest discover -s tests -v
```

Result after Phase 19 implementation: `npm run syntax` passed, `npm run smoke` passed, and Python unittest passed.

## Phase 18 Manual Zone Heatmap Audit

### Scope

Used the latest DriveLedger Phase 17 Best Time to Drive ZIP as the base and added a simple GPS-free zone heatmap. The app remains a static local-first PWA. No backend, GPS permission, mapping API, external chart library, framework, or fake data source was added.

### Findings / implementation

- Added a Manual Zone Heatmap card in the Analytics tab.
- Added map-style roles for Best Zone, Reliable Zone, Weak Zone, and Avoid Zone.
- Zone rankings use real saved delivery zone labels and centralized Profit Engine metrics.
- Added custom-zone settings storage through `settings.customZones`.
- Added safe zone normalization, deduplication, and autocomplete from custom zones, default zone, and existing saved delivery zones.
- Added a Settings custom-zone manager with Add Zone plus dynamic Rename/Delete actions.
- Rename can update matching saved deliveries after confirmation.
- Delete removes the custom-zone shortcut only; saved deliveries keep their existing zone labels.
- Existing old delivery zone names continue to render in analytics and do not need to be in the custom-zone list.
- Added responsive CSS for zone manager rows and heatmap cards.
- Bumped data schema to `6`, backup schema to `7`, package to `3.3.0`, and service-worker cache to `driveledger-v22-phase18-zone-heatmap`.

### Tests run

```bash
npm run syntax
npm run smoke
python -m unittest discover -s tests -v
```

Result after Phase 18 implementation: `npm run syntax` passed, `npm run smoke` passed, and Python unittest ran 30 tests successfully.

## Phase 17 Best Time to Drive Insights Audit

### Scope

Used the latest DriveLedger Phase 16 Smart Goal ZIP as the base and added Best Time to Drive insights without changing the static PWA architecture. No backend, framework, external chart library, AI API, or fake data source was added.

### Findings / implementation

- Added a Best Time to Drive card in the Analytics tab.
- Added Today, Historical, and Weak-hour insight panels.
- Added local hourly grouping by delivery timestamp.
- Added average gross/hour and average estimated profit/hour calculations for hourly buckets.
- Added average earned, average profit, tracked miles, and tracked time metrics per hour card.
- Historical best and weak-hour panels require at least two completed past driving days before showing ranked insights.
- Added clear empty states for no-data and insufficient-history states.
- Added mobile-friendly CSS cards/bars and reused existing local Profit Engine calculations.
- Updated smoke/static tests for hourly insight UI, local calculations, historical gating, weak-hour rendering, and unsafe output checks.

### Tests run

```bash
npm run syntax
npm run smoke
python -m unittest discover -s tests -v
```

Result after Phase 17 implementation: `npm run syntax` passed, `npm run smoke` passed, and Python unittest ran 29 tests successfully.


## Phase 16 Smart Goal System Audit

### Scope

Used the latest DriveLedger v3 Release Candidate ZIP as the base and added the Smart Goal System without changing the static PWA architecture. No backend, framework, cloud service, or fake data source was added.

### Findings / implementation

- Added a Settings smart-goal card with suggested daily goal, explanation, weekday average breakdown, Apply Suggested Goal, and Keep Current Goal actions.
- Added local historical calculations for average earnings, estimated profit, and hours by day of week.
- Today’s partial data is excluded from recommendations so the current day cannot inflate the suggested goal.
- Weekday-specific history is preferred when at least two matching past weekdays exist. Broader saved driving history is used as a fallback when the current weekday has insufficient data.
- Insufficient history shows a safe empty state and disables the apply action.
- Updated smoke/static tests for smart-goal UI, historical calculations, apply/ignore wiring, insufficient-history behavior, and today-data exclusion.

### Tests run

```bash
npm run syntax
npm run smoke
python -m unittest discover -s tests -v
```

Result after Phase 16 implementation: `npm run syntax` passed, `npm run smoke` passed, and Python unittest ran 28 tests successfully.

## Final Release Audit — v3 Release Candidate

### Scope

Used the Phase 14 PWA Offline ZIP as the base and performed the final release audit/bug bash. This phase did not add major product features. The app remains a static, local-first PWA using plain HTML, CSS, JavaScript, `manifest.json`, and `service-worker.js`.

Audited flows:

```text
app startup
Today dashboard
Quick Add
manual Add
OCR review
Accept Calculator
edit / duplicate / delete / undo delete
history grouping
platform analytics
zone analytics
tax estimate
standard CSV export
tax CSV export
daily summary CSV export
JSON backup export
JSON backup import
settings save/load
shift start/end
daily recap
PWA manifest
service worker
README / changelog / audit report
```

### Findings

- Existing Phase 14 syntax, smoke, and Python unittest coverage passed before final packaging.
- Static DOM references were valid and there were no duplicate HTML IDs.
- Existing smoke coverage already verified corrupted `localStorage` does not crash startup.
- Existing smoke coverage already verified normal dashboard/calculator/OCR/export/analytics states avoid unsafe `NaN`, `Infinity`, `undefined`, and `null` output in tested flows.
- No missing backend/API calls were found; the app remains local-first.
- No release-blocking runtime bug was found during the final audit.

### Release fixes / stabilization changes

- Bumped app package version to `3.0.0`.
- Bumped service-worker cache version to `driveledger-v19-v3-release-candidate` to avoid stale Phase 14 cache collisions.
- Added final static test coverage for visible button wiring so release UI controls must be directly or delegatedly connected to real logic.
- Added release-candidate metadata/docs coverage in the Python unittest suite.
- Updated README with v3 Release Candidate notes, known limitations, and final manual QA checklist.
- Updated CHANGELOG with the v3 release-candidate entry.

### Tests run

```bash
npm run syntax
npm run smoke
python -m unittest discover -s tests -v
```

Result:

```text
npm run syntax: passed
npm run smoke: passed
python unittest: Ran 27 tests — OK
```

### Acceptance criteria status

- App startup: passed.
- Today dashboard: passed by smoke/static coverage.
- Quick Add: passed by smoke/static coverage.
- Manual Add: passed by smoke/static coverage.
- OCR review: passed by smoke/static coverage.
- Accept Calculator: passed by smoke/static coverage.
- Edit / duplicate / delete / undo delete: passed by smoke/static coverage.
- History grouping: passed by smoke/static coverage.
- Platform and zone analytics: passed by smoke/static coverage.
- Tax estimate and exports: passed by smoke/static coverage.
- JSON backup export/import: passed by smoke/static coverage.
- Settings save/load and shift start/end: passed by smoke/static coverage.
- Daily recap: passed by smoke/static coverage.
- PWA manifest and service worker: passed.
- No visible orphan buttons: passed by static coverage.
- Corrupted `localStorage` does not crash the app: passed by smoke coverage.
- Tests pass: passed.

### Known limitations / remaining risks

- Real iPhone/iPad Safari testing is still required before public release.
- Data is stored in browser `localStorage`; users should export JSON backups regularly and before clearing browser/site data.
- Screenshot OCR depends on the remote Tesseract.js CDN if the library has not loaded already.
- Profit, tax, vehicle cost, and coaching values are estimates based on Settings and are not tax/accounting advice.
- The smoke test uses a mocked browser environment and cannot fully verify Safari-specific PWA install behavior.
- Service-worker updates may require a reload cycle before the latest app shell is active.

### Manual QA checklist

1. Deploy the unzipped folder to Netlify over HTTPS.
2. Open in iPhone Safari and add to Home Screen.
3. Launch from the Home Screen icon.
4. Start a shift and verify shift status updates in the header and hero card.
5. Add a Quick Add delivery and confirm Today updates.
6. Add a manual delivery from the Add tab.
7. Use OCR review; verify the app shows a review card and does not autosave.
8. Use Accept Calculator; test ACCEPT, BORDERLINE, and DECLINE offers.
9. Save a calculator offer as completed.
10. Edit, duplicate, delete, and undo-delete deliveries.
11. Confirm History groups deliveries by day.
12. Confirm Analytics platform, zone, and hourly sections show real saved data.
13. Export Standard CSV, Tax CSV, Daily Summary CSV, and JSON Backup.
14. Import a JSON backup with Merge.
15. Import a JSON backup with Replace, then Restore Rollback.
16. Change Settings, reload, and confirm settings persist.
17. End the shift and confirm the recap saves to shift history.
18. Reload online, then turn on Airplane Mode and confirm the cached app shell opens.
19. Confirm OCR offline dependency messaging is safe.
20. Repeat key layout checks on iPad Safari.

## Phase 14 PWA Install, Offline, and Release Polish Audit

### Scope

Used the Phase 13 Mobile Polish ZIP as the base and kept DriveLedger as a plain static local-first PWA. No backend, framework, build system, account system, or cloud database was added.

### Findings

- `manifest.json` already existed and referenced valid icons, but it lacked richer install/release metadata.
- `service-worker.js` already cached the core app shell, but Phase 14 needed a clearer versioned cache name and explicit offline fallback helpers.
- Core app functions already survived Tesseract being unavailable, but the offline/OCR explanation could be clearer for installed PWA users.
- Existing tests covered manifest parsing and service-worker cached assets; Phase 14 needed deeper PWA/offline checks.

### Fixes implemented

- Updated manifest metadata: long app name, short name, description, standalone display, display override, categories, language, start URL, scope, theme color, background color, and maskable icon purposes.
- Verified existing 192px and 512px icon files remain present and referenced.
- Replaced the service worker cache with `driveledger-v18-phase14`.
- Added explicit service-worker helpers for core asset caching, old-cache cleanup, safe cache writes, network-first document navigation, cached offline fallback, and stale-while-revalidate static assets.
- Added an app-level offline banner that appears when `navigator.onLine === false`.
- Improved OCR-unavailable messaging to explain that screenshot OCR may need internet when the Tesseract library has not loaded.
- Added Phase 14 smoke/static tests for manifest readiness, cached paths, service-worker offline strategy markers, and offline banner behavior.

### Tests run

```bash
npm run syntax
npm run smoke
python -m unittest discover -s tests -v
```

Result:

```text
npm run syntax: passed
npm run smoke: passed
python unittest: Ran 25 tests — OK
```

### Acceptance criteria status

- Manifest parses: passed.
- Service worker syntax passes: passed.
- Cached file paths exist: passed.
- Static references are valid: passed.
- Smoke test passes: passed.
- App remains installable as a static PWA: passed.
- App shell works offline after first online load/cache: passed by service-worker strategy and mocked offline state checks.
- OCR CDN dependency is handled without crashing: passed.

### Remaining risks

- Real iPhone/iPad Safari install and offline reload behavior still requires manual device testing.
- Screenshot OCR depends on the remote Tesseract CDN if it has not loaded already.
- Service-worker updates can require a reload cycle before the newest cached shell is fully active.
- Data is still stored in browser `localStorage`; users should export JSON backups before clearing site data.

### Manual QA checklist

1. Deploy to Netlify over HTTPS.
2. Open in iPhone Safari.
3. Add to Home Screen.
4. Launch from Home Screen.
5. Add a test delivery and confirm it persists after reload.
6. Reload once online to let the service worker cache the shell.
7. Turn on Airplane Mode and reopen the app.
8. Confirm Today, Quick Add, History, Analytics, Export, and Settings render offline.
9. Try Screenshot OCR while offline and confirm the app shows the OCR dependency message without crashing.
10. Repeat layout check on iPad Safari.



## 2.13.0 — Phase 13 Mobile Polish and One-Hand UX

Phase 13 was implemented on top of the Phase 12 Driver Coaching ZIP while preserving the static, local-first PWA architecture. No backend, framework, build system, or heavy UI library was added. Existing delivery, profit, OCR, analytics, backup, and recap logic was preserved.

## Findings and fixes

### `index.html`

- Added a skip link for keyboard and assistive technology navigation.
- Added a mobile-only sticky primary action dock with Quick Add, Scan, and Decide actions wired through the existing `data-*` handlers.
- Added stronger Quick Add dialog semantics with `role="dialog"`, `aria-modal="true"`, `aria-describedby`, and helper text.
- Added aria labels to shift buttons, primary actions, and bottom navigation.
- Converted the Today company/zone breakdowns into a collapsible secondary panel to reduce dashboard clutter.
- Improved static empty-state copy for History and Analytics.
- Switched minute inputs to numeric input mode where appropriate.
- Added `aria-atomic="true"` to the toast region.

### `styles.css`

- Added Phase 13 mobile polish styles for iPhone-sized screens.
- Added sticky mobile action dock styling above the bottom tab bar.
- Added sticky mobile topbar treatment, stronger card hierarchy, larger mobile form controls, and safer iOS safe-area spacing.
- Added accessible skip-link styling.
- Added improved empty-state styling.
- Added loading/success/error state utility styling.
- Added reduced-motion coverage for the new motion effects.

### `app.js`

- Improved empty-state text for company, zone, hourly analytics, and History output.
- No new backend/API calls were added.
- Existing Quick Add, Scan Screenshot, and Decide logic remains reused by the mobile action dock.

### `tools/smoke-startup.js`

- Added Phase 13 smoke coverage for the mobile action dock, accessibility markers, quick-add dock wiring, scan/decide dock action representation, and mobile CSS markers.

### `tests/test_static_app.py`

- Added Phase 13 static coverage for mobile dock DOM IDs, accessibility attributes, reduced-motion support, mobile form-control sizing, and smoke coverage markers.

### `service-worker.js`

- Bumped cache version to `driveledger-v17`.

### `package.json`

- Bumped app version to `2.13.0`.

## Tests run

```bash
npm run syntax
npm run smoke
python -m unittest discover -s tests -v
```

Results after implementation:

```text
npm run syntax: passed
npm run smoke: passed
python unittest: Ran 24 tests — OK
```

## Acceptance criteria status

- Responsive iPhone layout improved: passed.
- Primary actions are larger and thumb-friendly: passed.
- Today screen clutter reduced with collapsible secondary breakdowns: passed.
- Empty states improved: passed.
- Consistent spacing/card hierarchy improved: passed.
- Sticky mobile primary action area added: passed.
- Forms use larger controls and numeric keyboard hints where appropriate: passed.
- Toast/accessibility region retained and improved: passed.
- Loading/success/error state styling added: passed.
- Accessibility improved with labels, focus states, skip link, dialog semantics, and reduced-motion support: passed.
- Important DOM elements still exist: passed.
- Buttons remain wired: passed.
- Startup smoke test passes: passed.

## Remaining risks

- Real iPhone/iPad Safari testing is still recommended because automated tests use a mocked browser.
- Sticky mobile action dock uses duplicate entry points for existing actions; this is intentional, but should be manually checked for visual overlap on very small devices.
- Data is still stored in browser `localStorage`; users should keep JSON backups.
- OCR still depends on the remote Tesseract.js CDN on first load.
- Tax/profit and coaching numbers remain estimates based on Settings.

## Manual QA checklist

1. Open the app on iPhone Safari.
2. Confirm the mobile action dock appears above the tab bar.
3. Tap Quick Add from the dock and confirm the bottom sheet opens.
4. Save a delivery from the sheet and confirm Today updates.
5. Tap Scan from the dock and confirm the Add/OCR flow opens.
6. Tap Decide from the dock and confirm the Accept Calculator opens.
7. Confirm the bottom navigation remains usable and not overlapped.
8. Confirm the topbar remains readable while scrolling on mobile.
9. Confirm minute fields show a numeric keyboard.
10. Confirm Today breakdowns can expand/collapse.
11. Confirm focus rings appear with keyboard navigation.
12. Confirm reduced-motion settings do not create awkward animations.
13. Test iPad Safari layout and confirm the app does not feel cramped.
14. Reload and confirm data persists.

## 2.12.0 — Phase 12 Driver Coaching and Daily Recaps

Phase 12 was implemented on top of the Phase 11 Backup Safety ZIP while preserving the static, local-first PWA architecture. No backend, framework, build step, account system, or AI API was added. All coaching text is generated locally from saved delivery records, Settings, shift state, and the centralized Profit Engine.

## Findings and fixes

### `index.html`

- Replaced the thin Shift Recap panel with a richer Daily Recap coaching card.
- Added recap status, recap metric grid, recommendation area, and saved shift history list.
- Renamed the copy action to Copy Recap.
- Fixed an extra closing `div` in the quick-add sheet markup while preserving the existing bottom-sheet flow.

### `app.js`

- Added `buildDriverRecap()` to centralize local recap generation.
- Added `buildDriverRecommendations()` for goal, low $/mile, platform, zone, and next-shift coaching.
- Added `buildDriverRecapText()` for complete plain-text recap copy/save output.
- Added `renderRecapCard()` and `renderShiftHistory()` for the Today coaching UI.
- Upgraded `toggleShift()` so ending a shift saves the recap, recommendation, and metrics into `shiftHistory`.
- Upgraded `copySummary()` into a complete recap-copy flow.
- Expanded shift-history normalization to preserve saved recap recommendation and metrics.
- Bumped data schema version to `5` and backup version to `6`.

### `styles.css`

- Added responsive Daily Recap, recap metrics, recommendation, and shift-history styling.

### `tools/smoke-startup.js`

- Added Phase 12 smoke coverage for no-data recap rendering, one-delivery recap rendering, multi-platform/multi-zone coaching, copy recap content, and end-shift recap persistence.

### `tests/test_static_app.py`

- Added Phase 12 static coverage for Daily Recap DOM IDs, helper functions, saved shift-history behavior, and smoke-test coverage markers.
- Updated schema-version assertions for data version `5` and backup version `6`.

### `service-worker.js`

- Bumped cache version to `driveledger-v16`.

### `package.json`

- Bumped app version to `2.12.0`.

## Tests run

```bash
npm run syntax
npm run smoke
python -m unittest discover -s tests -v
```

Results after implementation:

```text
npm run syntax: passed
npm run smoke: passed
python unittest: Ran 23 tests — OK
```

## Acceptance criteria status

- End shift summary includes gross earnings: passed.
- End shift summary includes estimated profit: passed.
- End shift summary includes hours worked: passed.
- End shift summary includes miles and deliveries: passed.
- End shift summary includes gross/hour and profit/hour: passed.
- End shift summary includes gross $/mile and profit $/mile: passed.
- End shift summary includes best company and best zone: passed.
- End shift summary includes best delivery and weakest delivery: passed.
- Recommendation text includes goal status, low $/mile guidance, platform suggestion, zone suggestion, and next-shift advice where data supports it: passed.
- Daily recap card exists: passed.
- Copy Recap button exists and is wired: passed.
- End shift saves recap to shift history: passed.
- No AI API/backend usage added: passed.
- Tests pass: passed.

## Remaining risks

- Coaching quality depends on accurate earnings, miles, minutes, zones, and platform labels.
- Recaps are rule-based local summaries, not predictive AI advice.
- Profit and tax numbers remain estimates based on user-maintained Settings.
- Data is still stored in browser `localStorage`; users should keep JSON backups outside the browser.
- Smoke tests use a mocked browser, not real iPhone/iPad Safari automation.
- OCR still depends on the remote Tesseract.js CDN on first load.

## Manual QA checklist

1. Open the app fresh and confirm Daily Recap shows a safe empty state.
2. Add one delivery and confirm the recap handles a one-delivery day.
3. Add deliveries across at least two companies and two zones.
4. Confirm the recap shows gross, profit, hours, miles, gross/hour, profit/hour, gross $/mile, and profit $/mile.
5. Confirm best company and best zone appear.
6. Confirm best delivery and weakest delivery appear.
7. Confirm recommendation text changes based on goal progress and $/mile quality.
8. Tap Copy Recap and paste into Notes to verify the full text.
9. Start a shift, add deliveries, then end the shift.
10. Confirm the saved shift recap appears under Saved shift history.
11. Export JSON backup and confirm shift history is included.
12. Reload and confirm recap data persists.

## 2.11.0 — Phase 11 Backup, Restore, and Data Safety

Phase 11 was implemented on top of the Phase 10 Export Center ZIP while preserving the static, local-first PWA architecture. No backend, framework, build step, cloud storage, or account system was added.

## Findings and fixes

### `index.html`

- Added a hidden import preview card inside the Tax & Export Center.
- Added preview fields for delivery count, settings presence, shift presence, and exported date.
- Added an import mode selector with Merge and Replace options.
- Added Confirm Import and Cancel Import buttons.
- Removed duplicate `analyticsBestZone` DOM ID from the Analytics KPI row.
- Removed a duplicate Uber Eats option from the Quick Add company selector.

### `app.js`

- Added `pendingImport` state so parsed backup data is staged before it changes localStorage.
- Added `buildBackupPayload()` so full backups and rollback snapshots share one consistent schema.
- Added `validateBackupPayload()` for shape validation and safe normalization before import.
- Added `renderImportPreview()`, `updateImportModeHelp()`, and `clearPendingImport()` for the two-step import flow.
- Added `saveImportRollback()` so imports store an emergency rollback copy before applying.
- Added `mergeImportedDeliveries()` to merge imported deliveries while deduplicating by delivery ID.
- Added `confirmImportBackup()` to apply either merge or replace mode only after user confirmation.
- Hardened rollback restore by validating rollback payloads before applying them.

### `styles.css`

- Added responsive import preview styling.

### `tools/smoke-startup.js`

- Added Phase 11 smoke coverage for valid backup preview, merge import, duplicate-ID deduplication, replace import, rollback storage, rollback restore, and invalid/malformed backup rejection.

### `tests/test_static_app.py`

- Added duplicate HTML ID coverage.
- Added Phase 11 static coverage for import preview controls, helper functions, and smoke-test coverage markers.

### `service-worker.js`

- Bumped cache version to `driveledger-v15`.

### `package.json`

- Bumped app version to `2.11.0`.

## Tests run

```bash
npm run syntax
npm run smoke
python -m unittest discover -s tests -v
```

Results after implementation:

```text
npm run syntax: passed
npm run smoke: passed
python unittest: Ran 22 tests — OK
```

## Acceptance criteria status

- Full backup JSON export exists: passed.
- Full backup JSON import exists: passed.
- Imported backups are validated before applying: passed.
- Import preview shows delivery count, settings included, shift included, and exported date: passed.
- User confirms import before data changes: passed.
- Malformed import files do not crash the app: passed.
- Replace and merge import modes exist: passed.
- Merge deduplicates by delivery ID: passed.
- Replace stores emergency rollback before applying: passed.
- Restore rollback exists and validates payload before applying: passed.
- Tests pass: passed.

## Remaining risks

- Data is still stored in browser `localStorage`; users should keep JSON backups outside the browser.
- Merge mode intentionally keeps current settings and shift state; it only merges deliveries.
- Replace mode uses backup settings/shift only when those sections are included.
- Smoke tests use a mocked browser, not real iPhone/iPad Safari automation.
- OCR still depends on the remote Tesseract.js CDN on first load.

## Manual QA checklist

1. Open History.
2. Export JSON Backup.
3. Import the JSON Backup.
4. Confirm the import preview appears before data changes.
5. Confirm delivery count, settings included, shift included, and exported date display correctly.
6. Choose Merge and confirm.
7. Confirm duplicate delivery IDs are skipped and new deliveries are added.
8. Import again, choose Replace, and confirm.
9. Confirm an emergency rollback is saved.
10. Tap Restore Import Rollback and confirm previous data returns.
11. Try importing malformed JSON and confirm the app rejects it without crashing.
12. Reload and confirm data persists.

---

## 2.10.0 — Phase 10 Tax and Export Center

Phase 10 was implemented on top of the Phase 9 Analytics ZIP while preserving the static, local-first PWA architecture. No backend, framework, build step, external CSV library, or account system was added.

## Findings and fixes

### `index.html`

- Replaced the compact History export controls with a dedicated **Tax & Export Center** panel.
- Added clear explanations for Standard CSV, Tax CSV, Daily Summary CSV, and JSON Backup.
- Added a visible reminder that tax/profit numbers are estimates and not tax advice.
- Added the `exportDailyBtn` control for Daily Summary CSV export.
- Kept Backup Import and Restore Import Rollback in the export center.

### `app.js`

- Added export helpers:
  - `exportDateValue()`
  - `exportDayKey()`
  - `csvEscape()`
  - `csvRowsToText()`
  - `activeDeliveriesSorted()`
  - `fuelCostEstimate()`
  - `maintenanceCostEstimate()`
  - `buildDailySummaryRows()`
- Updated `buildCSV()` to support three export kinds: `standard`, `tax`, and `daily`.
- Updated Standard CSV to include the required bookkeeping fields only: date, company, earnings, miles, minutes, zone, note, source.
- Updated Tax CSV to include mileage deduction rate plus separate fuel and maintenance estimates.
- Added Daily Summary CSV grouped by date.
- Updated CSV export behavior so an empty ledger exports a header-only file rather than failing.
- Added `appDataVersion` to JSON backups while preserving existing backup metadata.

### `styles.css`

- Added mobile-friendly Tax & Export Center cards.
- Added responsive export safety action styling.

### `tools/smoke-startup.js`

- Added Phase 10 smoke coverage for:
  - Standard CSV headers
  - Tax CSV headers
  - Daily Summary CSV headers
  - CSV escaping for commas, quotes, and multiline notes
  - Daily summary grouping by saved delivery date
  - JSON backup parsing and required metadata
  - Empty export header-only behavior

### `tests/test_static_app.py`

- Added static coverage for Phase 10 export DOM surfaces.
- Added checks for export helper functions, required headers, backup app data version, and smoke-test coverage markers.

### `service-worker.js`

- Bumped cache version to `driveledger-v14`.

### `package.json`

- Bumped app version to `2.10.0`.

## Tests run

```bash
npm run syntax
npm run smoke
python -m unittest discover -s tests -v
```

Results after implementation:

```text
npm run syntax: passed
npm run smoke: passed
python unittest: Ran 20 tests — OK
```

## Acceptance criteria status

- Standard CSV export includes required fields: passed.
- Tax CSV export includes required fields: passed.
- Daily summary CSV export exists and groups by date: passed.
- JSON backup includes deliveries, settings, shift, app data version, and exportedAt: passed.
- Export center section exists with clear explanations: passed.
- Tax estimate disclaimer is present: passed.
- CSV escaping handles commas, quotes, and multiline notes: passed.
- Empty exports do not crash: passed.
- Tests pass: passed.

## Remaining risks

- Tax, deduction, fuel, maintenance, and profit values are estimates based on user-maintained Settings.
- This is not tax advice; users should verify reports with a tax professional or accounting software.
- Data is still stored in browser `localStorage`; users should export JSON backups before clearing site data.
- Smoke tests use a mocked browser, not real iPhone/iPad Safari automation.
- Backup import still supports replace + rollback. Merge/deduplicate import mode remains a future phase.

## Manual QA checklist

1. Open History.
2. Confirm the Tax & Export Center appears above History.
3. Add deliveries with notes containing commas, quotes, and line breaks.
4. Export Standard CSV and confirm required columns are present.
5. Export Tax CSV and confirm mileage rate, deduction, fuel, maintenance, and profit columns are present.
6. Export Daily Summary CSV and confirm deliveries are grouped by day.
7. Export JSON Backup and confirm it parses as JSON.
8. Confirm backup includes deliveries, settings, shift, appDataVersion, and exportedAt.
9. Clear data in a test browser and confirm empty CSV exports still download header-only files.
10. Import backup and confirm data restores.
11. Restore import rollback and confirm previous data returns.
12. Reload and confirm data persists.

---

## 2.9.0 — Phase 9 Platform and Zone Analytics

Phase 9 was implemented on top of the Phase 8 History ZIP while preserving the static, local-first PWA architecture. No backend, framework, build step, chart library, or account system was added.

## Findings and fixes

### `index.html`

- Added an Analytics tab to the bottom navigation.
- Added Analytics highlight cards for best/worst company, best/worst zone, best hour today, and best saved hour.
- Added dedicated Platform performance, Zone performance, and Earnings by hour sections.
- Added worst company and worst zone rows to the Today Performance card.

### `app.js`

- Added reusable analytics helpers:
  - `activeDeliveries()`
  - `aggregateGroups()`
  - `rankedGroups()`
  - `bestGroup()`
  - `worstGroup()`
  - `renderAnalytics()`
  - `renderAnalyticsList()`
  - `deliveriesWithinDays()`
  - `rankedHourGroups()`
  - `hourRangeLabel()`
- Updated Today command metrics to render worst company and worst zone labels safely.
- Upgraded company and zone breakdowns to show earnings, profit, delivery count, miles, gross $/mile, profit $/mile, gross/hour, and profit/hour.
- Added hourly grouping by local delivery hour.
- Added stable tie handling and safe missing-data behavior for best/worst rankings.
- Confirmed analytics empty states do not render `NaN`, `Infinity`, `undefined`, or `null`.

### `styles.css`

- Added mobile-friendly Analytics tab cards.
- Added plain CSS analytics bars.
- Adjusted bottom navigation to support the new Analytics tab.

### `tools/smoke-startup.js`

- Added Phase 9 smoke coverage for:
  - platform aggregation across multiple companies
  - zone aggregation across multiple zones
  - hourly analytics rendering
  - empty analytics state safety
  - best/worst analytics IDs
  - no unsafe text output in analytics surfaces

### `tests/test_static_app.py`

- Added static checks for Phase 9 Analytics DOM surfaces, helper functions, navigation tab, CSS analytics bars, and smoke-test coverage.

### `service-worker.js`

- Bumped cache version to `driveledger-v13`.

### `package.json`

- Bumped app version to `2.9.0`.

## Tests run

```bash
npm run syntax
npm run smoke
python -m unittest discover -s tests -v
```

Results after implementation:

```text
npm run syntax: passed
npm run smoke: passed
python unittest: Ran 19 tests — OK
```

## Acceptance criteria status

- Company/platform breakdown with earnings, profit, count, miles, gross $/mile, profit $/mile, gross/hour, and profit/hour: passed.
- Zone breakdown with the same metrics: passed.
- Best/worst company today and best/worst zone today: passed.
- Time-based hourly insight: passed.
- Simple visual bars without external chart libraries: passed.
- Empty analytics state does not crash: passed.
- Best/worst calculations handle missing data and one-group cases safely: passed.
- Tests pass: passed.

## Remaining risks

- Analytics quality depends on users entering accurate miles, minutes, zones, and platform names.
- Hourly analytics group by delivery save time, not actual offer acceptance or drop-off completion time.
- Best/worst ranking is an estimate based on local saved data and vehicle-cost settings.
- Data is still stored in browser `localStorage`; users should export JSON backups before clearing site data.
- Smoke tests use a mocked browser, not real iPhone/iPad Safari automation.
- OCR still depends on the remote Tesseract.js CDN on first load.

## Manual QA checklist

Use this checklist on iPhone/iPad Safari or a hosted Netlify build:

1. Open the app with no deliveries and confirm Analytics shows empty states.
2. Add deliveries for at least two companies.
3. Add deliveries for at least two zones.
4. Open Today and confirm best/worst company and zone labels update.
5. Open Analytics and confirm Platform performance cards show earnings, profit, miles, count, gross $/mile, profit $/mile, gross/hour, and profit/hour.
6. Confirm Zone performance cards show the same metric set.
7. Confirm Earnings by hour renders cards based on saved delivery times.
8. Edit a delivery and confirm Analytics recalculates.
9. Delete a delivery and confirm Analytics recalculates.
10. Undo delete and confirm Analytics recalculates again.
11. Reload and confirm analytics persist from localStorage.

## 2.8.0 — Phase 8 History, Editing, Undo, and Daily Groups

Phase 8 was implemented on top of the Phase 7 Profit Engine ZIP while preserving the static, local-first PWA architecture. No backend, framework, build step, or account system was added.

## Findings and fixes

### `app.js`

- Reworked History rendering to use active non-deleted records for the empty state, preventing stale/deleted-only localStorage records from hiding the helpful empty state.
- Added `renderHistoryDay()` for clearer grouped daily history rendering.
- Added explicit day-level metrics for:
  - average gross $/mile
  - gross/hour when delivery minutes are available
  - tracked time
- Upgraded each delivery card to show a compact detail grid with:
  - miles
  - minutes
  - gross $/mile
  - estimated profit
- History rows now always show zone status, falling back to `Unassigned` when no zone was saved.
- Preserved existing edit, duplicate, delete, and undo-delete actions.
- Confirmed edit updates localStorage and dashboard state.
- Confirmed duplicate creates a new ID and current timestamp.
- Confirmed delete removes the item and undo restores it.

### `styles.css`

- Added `day-metrics` and `history-detail-grid` styling.
- Added mobile responsive layout for history detail grids.

### `tools/smoke-startup.js`

- Added Phase 8 smoke coverage for:
  - grouped day rendering
  - day summary metrics
  - delivery card zone/minutes/source rendering
  - edit persistence
  - duplicate new-ID behavior
  - delete removal
  - undo restore
  - dashboard recalculation after edit/delete
- Adjusted the mock `setTimeout` behavior so toast undo actions remain testable in the mocked browser harness.

### `tests/test_static_app.py`

- Added Phase 8 static checks for new History surfaces and action logic.

### `service-worker.js`

- Bumped cache version to `driveledger-v12`.

### `package.json`

- Bumped app version to `2.8.0`.

## Tests run

```bash
npm run syntax
npm run smoke
python -m unittest discover -s tests -v
```

Results after implementation:

```text
npm run syntax: passed
npm run smoke: passed
python unittest: Ran 18 tests — OK
```

## Acceptance criteria status

- History groups deliveries by day: passed.
- Day groups show date, earnings, profit, miles, count, gross/hour where available, and average $/mile: passed.
- Delivery cards show company, payout, miles, minutes, zone, profit, $/mile, and source: passed.
- Edit action updates localStorage, Today dashboard, History, and analytics via full render: passed.
- Duplicate creates a new ID and current timestamp: passed.
- Delete removes the item and gives clear undo: passed.
- Undo restores the delivery: passed.
- Tests pass: passed.

## Remaining risks

- Delete still relies on a browser confirmation dialog plus toast undo; real iPhone Safari behavior should be manually verified.
- Gross/hour for historical days depends on saved delivery minutes. Records without minutes show no hourly rate.
- Data is still stored in browser `localStorage`; users should export JSON backups before clearing site data.
- Smoke tests use a mocked browser, not real iPhone/iPad Safari automation.
- OCR still depends on the remote Tesseract.js CDN on first load.

## Manual QA checklist

Use this checklist on iPhone/iPad Safari or a hosted Netlify build:

1. Open History with no deliveries and confirm the empty state appears.
2. Add deliveries for today using Quick Add and manual Add.
3. Confirm today appears as one grouped day.
4. Confirm the day summary shows earnings, profit, miles, count, average $/mile, gross/hour, and tracked time.
5. Confirm each delivery card shows company, payout, miles, minutes, $/mile, profit, zone, and source.
6. Edit a delivery and confirm Today, History, and breakdown totals update.
7. Duplicate a delivery and confirm a separate new row appears.
8. Delete a delivery and confirm totals update.
9. Tap Undo and confirm the delivery returns.
10. Reload and confirm data persists.

## 2.7.0 — Phase 7 Centralized Profit Engine

Phase 7 was implemented on top of the Phase 6 Accept / Decline Calculator ZIP while preserving the static, local-first PWA architecture. No backend, framework, build step, or account system was added.

## Findings and fixes

### `app.js`

- Added a centralized `ProfitEngine` section for the app's core financial calculations.
- Added reusable calculation helpers for:
  - fuel cost per mile
  - maintenance cost
  - vehicle cost per mile
  - estimated delivery profit
  - estimated profit per mile
  - gross dollar per mile
  - gross hourly rate
  - profit hourly rate
  - mileage deduction
  - projected daily earnings
  - goal ETA
  - driver score
  - row/day summaries
- Updated dashboard summaries, command-center cards, delivery previews, quick-add preview, OCR preview, Accept Calculator, History rows, shift recap, and CSV exports to use centralized helpers.
- Preserved compatibility wrappers including `costPerMile()`, `deliveryProfit()`, `safeRate()`, and `hourlyRate()` so earlier Phase 6 logic remains stable.
- Replaced scattered formulas such as direct `earnings / miles` and `earnings - miles * costPerMile()` with safe Profit Engine calls where they affected app surfaces.
- Hardened `bounded()` so malformed strings such as `"NaN"` or nonnumeric values fall back to defaults instead of being interpreted as `0`. Valid zero settings still remain valid where allowed.

### `tools/smoke-startup.js`

- Added smoke checks for expected first-delivery estimated profit and mileage deduction output using the centralized math path.
- Existing smoke coverage still verifies manual save, quick add, calculator decisions, OCR review, shift persistence, migration safety, and unsafe-output prevention.

### `tests/test_static_app.py`

- Added Phase 7 static tests confirming the Profit Engine exists.
- Added checks for the reusable calculation helper names.
- Added checks that old direct vehicle-cost formulas were removed from app surfaces.

### `service-worker.js`

- Bumped cache version to `driveledger-v11`.

### `package.json`

- Bumped app version to `2.7.0`.

### `README.md` and `CHANGELOG.md`

- Documented the centralized Profit Engine and Phase 7 behavior.

## Tests run

```bash
npm run syntax
npm run smoke
python -m unittest discover -s tests -v
```

Results after implementation:

```text
npm run syntax: passed
npm run smoke: passed
python unittest: Ran 17 tests — OK
```

## Acceptance criteria status

- Fuel cost per mile helper: passed.
- Maintenance cost helper: passed.
- Vehicle cost per mile helper: passed.
- Estimated delivery profit helper: passed.
- Estimated profit per mile helper: passed.
- Gross dollar per mile helper: passed.
- Gross hourly helper: passed.
- Profit hourly helper: passed.
- Mileage deduction helper: passed.
- Projected daily earnings helper: passed.
- Goal ETA helper: passed.
- Driver score helper: passed.
- Dashboard uses centralized summary math: passed.
- Calculator uses centralized math: passed.
- History/export surfaces use centralized math: passed.
- No unsafe NaN/Infinity output in tested states: passed.
- Tests pass: passed.

## Remaining risks

- Profit, deduction, and driver score values remain estimates based on user-maintained settings.
- Real-world variables such as restaurant wait time, parking, traffic, hidden tips, and drop-off difficulty are not automatically detected.
- Smoke tests use a mocked browser, not real iPhone/iPad Safari automation.
- Data is still stored in browser `localStorage`; users should export JSON backups before clearing site data.
- OCR still depends on the remote Tesseract.js CDN on first load.

## Manual QA checklist

Use this checklist on iPhone/iPad Safari or a hosted Netlify build:

1. Open the Today screen fresh.
2. Add a manual delivery with earnings, miles, and minutes.
3. Confirm estimated profit, tax deduction, gross $/mile, profit $/mile, and hourly pace update.
4. Open Quick Add and save another delivery.
5. Confirm Today, History, and company/zone breakdowns use matching totals.
6. Open Decide, calculate a strong offer, and confirm ACCEPT metrics match the expected profit math.
7. Save the offer as completed and confirm History shows calculator source.
8. Use OCR review and confirm preview profit uses the same vehicle-cost assumptions.
9. Export standard CSV and tax CSV.
10. Confirm export profit/deduction values match the app surfaces.
11. Change gas price, MPG, maintenance, and mileage deduction settings.
12. Confirm dashboard, calculator, and previews update consistently.
13. Reload and confirm data persists.

## 2.6.0 — Phase 6 Accept / Decline Calculator v2

Phase 6 was implemented on top of the Phase 5 OCR Review ZIP while preserving the static, local-first PWA architecture. No backend, framework, build step, or account system was added.

## Findings and fixes

### `app.js`

- Upgraded the Decide tab decision logic into a transparent order decision assistant.
- Added `safeRate()` and `hourlyRate()` helpers to avoid unsafe division output.
- Added `buildOfferThresholds()` and `makeThreshold()` so each offer shows pass/fail rows for active rules.
- Added gross $/mile, gross hourly pace, estimated profit, profit $/mile, and profit hourly metrics.
- Added settings-based decisions using minimum payout, minimum $/mile, minimum $/hour, max miles, gas price, MPG, and maintenance cost per mile.
- Added explicit invalid-input handling so zero/missing pay, miles, or minutes do not save a calculator delivery.
- Added `buildDecisionSummaryText()` and `copyDecisionSummary()` for copyable order recommendations.
- Added `clearOfferCalculator()` for a real Clear action.
- Updated calculator saves to persist selected company, zone, optional note, `source: "calculator"`, and a decision tag.
- Fixed a data-normalization issue in `bounded()` where missing numeric settings with a minimum of `0` could normalize to `0` instead of the intended default. This affected defaults such as gas price, maintenance cost, tax rate, and order thresholds.

### `index.html`

- Added optional calculator note input.
- Added Calculate Only, Clear, Copy Decision, and Save as Completed actions.
- Preserved the existing Decide tab and static PWA structure.

### `styles.css`

- Added mobile-friendly action layout for the calculator.
- Added pass/fail threshold row styling.

### `tools/smoke-startup.js`

- Added Phase 6 calculator smoke coverage for:
  - ACCEPT case
  - BORDERLINE case
  - DECLINE case
  - invalid zero-input rejection
  - Save as completed delivery with `source: "calculator"`
  - calculator note persistence
  - copy decision summary
  - clear action
  - settings thresholds affecting decision results
  - no unsafe `NaN`, `Infinity`, `undefined`, or `null` calculator output

### `tests/test_static_app.py`

- Added static checks for Phase 6 DOM surfaces.
- Added event-binding checks for Calculate Only, Clear, Copy Decision, and Save as Completed.
- Added helper-function checks for the upgraded decision logic.

### `service-worker.js`

- Bumped cache version to `driveledger-v10`.

### `package.json`

- Bumped app version to `2.6.0`.

### `README.md`

- Documented Phase 6 calculator behavior, inputs, outputs, actions, and persistence.

### `CHANGELOG.md`

- Added the `2.6.0` Phase 6 release entry.

## Tests run

```bash
npm run syntax
npm run smoke
python -m unittest discover -s tests -v
```

Results after implementation:

```text
npm run syntax: passed
npm run smoke: passed
python unittest: Ran 16 tests — OK
```

## Acceptance criteria status

- Input fields for company, payout, miles, estimated minutes, zone, and optional note: passed.
- Settings used for minimum $/mile, minimum $/hour, minimum payout, max miles, gas price, MPG, and maintenance cost per mile: passed.
- ACCEPT output: passed.
- BORDERLINE output: passed.
- DECLINE output: passed.
- Gross $/mile shown: passed.
- Estimated gross hourly shown: passed.
- Estimated profit shown: passed.
- Estimated profit $/mile shown: passed.
- Estimated profit hourly shown: passed.
- Threshold pass/fail rows shown: passed.
- Calculate Only action: passed.
- Save as completed delivery action: passed.
- Clear calculator action: passed.
- Copy decision summary action: passed.
- Invalid/zero inputs rejected safely: passed.
- Save offer creates delivery with `source: "calculator"`: passed.
- No unsafe NaN/Infinity output in tested calculator states: passed.
- Tests pass: passed.

## Remaining risks

- Calculator decisions are estimates and depend on user-maintained settings.
- Real-world wait time, traffic, restaurant speed, parking, and drop-off difficulty are not automatically detected.
- Smoke tests use a mocked browser, not real iPhone/iPad Safari automation.
- Data is still stored in browser `localStorage`; users should export JSON backups before clearing site data.
- OCR still depends on the remote Tesseract.js CDN on first load.
- Backup import still supports replace + rollback. Merge/deduplicate import mode remains a future phase.

## Manual QA checklist

Use this checklist on iPhone/iPad Safari or a hosted Netlify build:

1. Open the Decide tab.
2. Enter a strong offer and tap Calculate Only. Confirm ACCEPT.
3. Confirm gross $/mile, gross hourly, profit, profit $/mile, and profit hourly show.
4. Confirm all threshold rows show Pass for a strong offer.
5. Enter a close offer and confirm BORDERLINE.
6. Enter a weak offer and confirm DECLINE.
7. Enter zero or blank values and confirm saving is rejected.
8. Add a note and tap Copy Decision. Confirm copied text includes decision and note.
9. Tap Clear and confirm fields reset.
10. Save a valid offer as completed.
11. Confirm Today updates immediately.
12. Confirm History shows the delivery with Calculator source, zone, minutes, and note.
13. Change decision thresholds in Settings and confirm the same offer can change decision result.
14. Reload and confirm saved calculator delivery persists.

---

# DriveLedger Phase 5 Audit Report

## Phase

Phase 5 — Screenshot OCR Review System

## Base ZIP

`DriveLedger_v2_4_0_Phase4_Quick_Add.zip`

## Objective

Upgrade screenshot scanning so OCR results are reviewed, edited, and explicitly saved by the user before any delivery is written to localStorage.

## Architecture status

- Static PWA preserved: passed.
- No backend added: passed.
- No framework/build system added: passed.
- Existing Today Command Center preserved: passed.
- Existing Quick Add bottom sheet preserved: passed.
- Existing Add tab manual flow preserved: passed.
- Existing localStorage data model preserved: passed.
- Existing exports, history, settings, calculator, and rollback features preserved: passed.

## Changes made

### `index.html`

- Rebuilt the OCR review card into a review-first workflow.
- Added editable OCR review fields:
  - `ocrCompanyInput`
  - `ocrEarningsInput`
  - `ocrMilesInput`
  - `ocrMinutesInput`
- Added detected minutes display with `ocrMinutes`.
- Added confidence label display with `ocrConfidenceLabel`.
- Added `ocrSavePreview` for reviewed OCR profit/pace preview.
- Added direct **Save Reviewed** action with `saveOcrBtn`.
- Added explicit **Cancel** action with `cancelOcrBtn`.
- Preserved **Use in Form** and **Clear Scan** actions.
- Preserved expandable raw OCR text display.

### `styles.css`

- Added scan state styling for loading, success, and failed states.
- Added OCR review header layout.
- Added editable OCR grid layout.
- Added responsive OCR action layout for mobile screens.
- Added confidence label status styling for good, warning, and bad confidence states.

### `app.js`

- Added OCR DOM references for editable review fields and direct save actions.
- Added `setScanState()` to centralize loading/success/failed OCR state display.
- Added `confidenceLabel()` with:
  - High confidence
  - Medium confidence
  - Needs review
- Added `detectMinutes()` for OCR minute extraction.
- Updated `parseOCR()` to return company, earnings, miles, minutes, and confidence.
- Changed unknown platform detection to require review instead of automatically boosting confidence as `Other`.
- Updated `renderOCRReview()` to populate editable fields and confidence labels.
- Added `renderOCRSavePreview()` for reviewed OCR delivery preview.
- Added `readOCRReviewFields()` with validation before saving.
- Added `saveReviewedOCR()` so OCR can be saved directly only after explicit user review.
- Updated **Use in Form** to move reviewed values into the manual form rather than raw parsed values.
- Hardened Tesseract unavailable and Tesseract failure states so OCR failure does not crash the app.
- Preserved manual Add tab, Quick Add, Accept Calculator, history, exports, and backup flows.

### `tools/smoke-startup.js`

- Added mocked Tesseract success coverage.
- Added sample DoorDash OCR parsing coverage for company, earnings, miles, and minutes.
- Added reviewed OCR save coverage verifying `source: "ocr"` and OCR metadata.
- Added low-confidence OCR coverage proving scans do not autosave.
- Added invalid low-confidence save rejection coverage.
- Added Tesseract failure coverage proving the app shows a failed scan state instead of crashing.

### `tests/test_static_app.py`

- Added static coverage for Phase 5 OCR review DOM surfaces.
- Added wiring checks for `saveOcrBtn` and `cancelOcrBtn`.
- Added checks for OCR review helper functions and smoke coverage markers.

### `service-worker.js`

- Bumped cache version to `driveledger-v9`.

### `package.json`

- Bumped app version to `2.5.0`.

### `README.md`

- Documented the Phase 5 OCR review-first workflow.
- Updated current release and test coverage notes.

### `CHANGELOG.md`

- Added the `2.5.0` Phase 5 release entry.

## Tests run

```bash
npm run syntax
npm run smoke
python -m unittest discover -s tests -v
```

Results after implementation:

```text
npm run syntax: passed
npm run smoke: passed
python unittest: Ran 15 tests — OK
```

## Acceptance criteria status

- Screenshot upload input: passed.
- OCR loading state: passed.
- OCR success state: passed.
- OCR failed state: passed.
- Parses likely company: passed.
- Parses likely earnings: passed.
- Parses likely miles: passed.
- Parses likely minutes when present: passed.
- Shows OCR review card before saving: passed.
- Shows detected company, earnings, miles, minutes, confidence, and raw text: passed.
- User can edit detected fields: passed.
- User can save reviewed OCR as delivery: passed.
- User can cancel OCR review: passed.
- User can clear OCR result: passed.
- Low confidence shows Needs review: passed.
- OCR failure does not crash the app: passed.
- Low-confidence OCR does not autosave: passed.
- Saving reviewed OCR writes `source: "ocr"`: passed.
- Tests pass: passed.

## Remaining risks

- OCR still depends on the remote Tesseract.js CDN on first load.
- OCR parsing is heuristic and may still misread unusual screenshots; the review-first workflow is designed to catch this.
- Smoke tests use mocked Tesseract/browser behavior, not real iPhone Safari camera/gallery OCR automation.
- Data is still stored in browser `localStorage`; users should export JSON backups before clearing site data.
- Backup import still supports replace + rollback. Merge/deduplicate import mode remains a future phase.
- Expense, profit, and tax calculations are estimates and depend on user-maintained settings.

## Manual QA checklist

Use this checklist on iPhone/iPad Safari or a hosted Netlify build:

1. Open app fresh.
2. Tap Scan Screenshot from Today.
3. Select a DoorDash/Uber-style screenshot.
4. Confirm scanning state appears.
5. Confirm review card appears after scan.
6. Confirm company, earnings, miles, minutes, confidence, and raw text appear.
7. Edit detected earnings, miles, or minutes.
8. Confirm OCR save preview updates.
9. Tap Save Reviewed.
10. Confirm the delivery appears in Today and History with source OCR.
11. Test Use in Form and confirm reviewed values move into the manual form.
12. Test Cancel and confirm no delivery is saved.
13. Test Clear Scan and confirm review/raw text/image reset.
14. Turn off internet or block Tesseract and confirm OCR failure message appears without crashing.
15. Confirm Quick Add still works.
16. Confirm manual Add tab still works.
17. Confirm Accept Calculator still works.
18. Reload and confirm data persists.


## 3.6.4 Subtle Design Credit Audit

- Updated visible in-app credit to: **Designed by Tech Phactory Solutions**.
- Kept the credit intentionally subtle in the header and footer so it does not clutter the driver workflow.
- Verified package version `3.6.4`, service-worker cache `driveledger-v29-subtle-tech-phactory-credit`, and static tests.
