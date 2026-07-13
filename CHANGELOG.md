## 4.5.0 — Calendar monthly analytics

- Added a full monthly analysis section to the bottom of the Calendar tab.
- Added monthly earnings, estimated profit, orders, miles, work time, active days, gross/hour, profit/hour, average per active day, and mileage-deduction KPIs.
- Added month-over-month earnings, profit, and order trends.
- Added monthly best platform, best zone, strongest hour, and top earning day.
- Added daily earnings bars for every active day in the selected month.
- Added expandable platform and zone breakdowns using the selected month's saved data only.
- Monthly work time uses saved shift data when available and screenshot-session estimates otherwise.
- Bumped package version to `4.5.0` and service-worker cache to `giglens-v45-calendar-month-analytics`.

## 4.4.0 — Functional minimalist UI redesign
- Rebuilt the interface around the supplied mobile reference and strict functional-minimalism rules.
- Removed redundant mobile Add navigation while preserving manual entry through More tools and Calendar.
- Added meaningful SVG navigation icons and a five-destination mobile navigation hierarchy.
- Kept Analytics accessible through More tools while retaining the full desktop tab set.
- Reworked the header, earnings hero, scan action, forms, disclosures, Calendar, History, Analytics, Settings, and bottom sheet into one coherent design system.
- Removed decorative visual noise and reserved accent colors for real actions or data states.
- Added `UI_REDESIGN_AUDIT.md`, bumped package to 4.4.0, and cache to `giglens-v44-functional-minimalist-ui`.

## 4.3.0 — Calendar history and screenshot timestamp intelligence

- Added a dedicated Calendar tab for browsing earnings, miles, estimated profit, and work time by day.
- Added previous/next month navigation, selected-day summaries, historical add, edit, duplicate, and delete workflows.
- Added OCR date/time parsing for iPhone status-bar layouts, numeric dates, named months, Today, and Yesterday.
- Screenshot scans now use image file time as a reviewable fallback when OCR cannot read a complete timestamp.
- Added editable date/time fields to full OCR review, Quick Add, and manual delivery entry.
- Historical saves route to the matching Calendar day instead of appearing as if they were added today.
- Added timestamp provenance (`ocr`, `file`, `manual`, `saved`, or `import`) and confidence metadata to delivery records and backups.
- Added screenshot-session work-time estimation with a 75-minute gap threshold, while saved shift/break data remains authoritative when available.
- Bumped data schema to 16, backup schema to 17, package to 4.3.0, and cache to `giglens-v43-giglens-calendar-timestamps`.

## 4.2.0 — Full audit, safer detection, date-aware tax estimates, and UI/performance polish

- Restricted similar-screenshot platform learning to shared app-specific evidence so generic delivery words cannot spread a wrong label.
- Restored conservative lower-screen accent analysis in both scan flows: green supports Uber Eats, red DoorDash, orange Grubhub, and blue remains ambiguous between Spark/Amazon without text evidence.
- Expanded store recognition and stopped replacing arbitrary taqueria names with a generic restaurant label.
- Repaired imported pause state and merged duplicate/overlapping breaks before active-hour calculations.
- Added automatic date-aware mileage estimates: 72.5¢/mi for Jan–Jun 2026 and 76¢/mi for Jul–Dec 2026, with per-row Tax CSV rates and preserved custom-rate mode.
- Added progressive 30-day History rendering and single-pass custom-zone delivery counts.
- Added platform-color History cards, clearer tax settings, refined surfaces/navigation, responsive hover treatment, mobile polish, and off-screen rendering hints.
- Removed hidden duplicate mobile-dock markup and redundant versioned/legacy icon copies; switched HTML, manifest, and service worker to the canonical icon set.
- Bumped data schema to `15`, backup schema to `16`, package to `4.2.0`, and cache to `giglens-v42-giglens-audit-performance`.
- Expanded executable regressions for OCR learning isolation, visual evidence conflicts, pause migration, break union, date-aware tax export, progressive History, canonical PWA assets, and visible action wiring.

## 4.1.2 — Stability, shift timing, and GitHub release repair

- Decoupled normal app startup from the remote OCR script. The pinned Tesseract.js loader now starts on demand when the user selects a screenshot.
- Added bounded OCR worker cleanup so an unresponsive `terminate()` call cannot leave the scanner loading indefinitely.
- Added stale-scan generation guards so an older, slower OCR result cannot overwrite a newer selected screenshot.
- Added clear image-type and 20 MB size validation before OCR begins.
- Fixed the Profit Engine to subtract persisted break time from active hours and hourly metrics.
- Added accurate accumulation for multiple same-day shifts and stored per-shift breaks/active hours in shift history.
- Changed end-shift recaps to use only deliveries completed within that shift instead of cumulative unrelated records.
- Allowed an explicit zero-mile value in Manual Add, matching Quick Add and OCR review behavior.
- Repaired Decision CSV export, which referenced a removed `downloadFile()` helper and crashed when tapped; the export now uses the shared Share Sheet/download path.
- Updated the new-install U.S. business-mileage default to the 2026 rate of `0.725` per mile and migrated the exact prior `0.67` default while preserving other custom rates.
- Updated mileage-rate display precision and added a tax-method warning.
- Removed obsolete Netlify-only files and rewrote deployment documentation for GitHub Pages.
- Bumped data schema to `14`, backup schema to `15`, package to `4.1.2`, and cache to `giglens-v41-giglens-stability-repair`.
- Added executable regressions for break-adjusted timing, multiple shifts, explicit zero mileage, bounded OCR cleanup, and concurrent scan ordering.

## 4.1.1 — Merchant type audit repair
- Fixed a data-normalization regression that dropped `merchantType` from saved OCR and imported delivery records.
- Repaired known-store OCR detection, including Walmart when it also appears as Spark platform evidence.
- History now labels saved pickups as Restaurant, Store, or Merchant instead of hardcoding every pickup as Restaurant.
- OCR review now displays the detected merchant type.
- Added store regression cases for Schnucks, Walmart, and Best Buy.
- Updated the service-worker cache to `giglens-v40-giglens-merchant-type-audit-fix`.

# Changelog

## 4.1.0 — OCR correction learning and mobile UI repair

- Replaced the in-app header image dependency with an embedded GigLens SVG mark so the brand icon cannot render as a broken image when a stale cache or incomplete deployment misses the PNG path.
- Added cache-busted v4.1 icon filenames for Apple Touch Icon, manifest icons, favicon, and service-worker assets.
- Added local OCR correction learning under `giglens.ocrLearning.v1`. Corrected platform, merchant, earnings, miles, and minutes are remembered on this device without storing the screenshot image.
- Added exact-screenshot correction recall, similar-workflow platform learning, merchant alias correction, and learned numeric-context boosts.
- Added scanner-learning status, reset control, backup/import/rollback coverage, and local privacy messaging.
- Simplified the iPhone layout by removing the redundant floating Scan Add dock, reducing header and hero height, hiding the duplicate Add tab on mobile, and using a five-item bottom navigation.
- Bumped data schema to `13`, backup schema to `14`, package to `4.1.0`, and cache to `giglens-v39-giglens-learning-ui-repair`.

## 4.0.1 — Home Screen icon and OCR recovery repair

- Rebuilt the missing GigLens icon set as opaque, exact-size PNG files and added cache-busting 180/192/512/1024 filenames.
- Added root `apple-touch-icon.png` and `favicon.png` fallbacks for iPhone/Safari.
- Updated the manifest, HTML icon metadata, and service-worker cache so installed shortcuts receive the real GigLens icon.
- Fixed the OCR core dependency path from the nonexistent `tesseract.js-core@5.1.1` directory to the documented v5 core path `tesseract.js-core@v5.0.0`.
- Added WebAssembly CSP permission, OCR initialization/recognition timeouts, progress messages, worker cleanup, and clear failure recovery instead of an endless loading state.
- Fixed OCR capability detection so either `createWorker` or `recognize` can power a scan.
- Bumped the package to `4.0.1` and cache to `giglens-v38-giglens-icon-ocr-repair`.

## 4.0.0 — GigLens

- Renamed the product and brand-bearing namespaces/assets to GigLens, with non-destructive migration from legacy local-storage keys.
- Added real 180/192/512/1024px GigLens icons and explicit iPhone Home Screen icon metadata.
- Added color-assisted platform detection using lower-card pixels: green Uber Eats, red DoorDash, orange Grubhub, and ambiguous blue support for Amazon Flex/Spark. Color cannot qualify a platform alone.
- Added supplied-layout OCR fingerprints, Amazon Flex support, and stronger restaurant/store parsing coverage.
- Refreshed the screenshot-first command-center UI while preserving every existing working feature and static architecture.
- Pinned Tesseract.js 5.1.1 with verified SRI, added CSP/security headers, restricted service-worker caching, and added `SECURITY.md`.
- Bumped data schema to `11`, backup schema to `12`, package to `4.0.0`, and cache to `giglens-v37-giglens-visual-security`.

## 3.7.5 — Platform detection audit repair
- Reviewed Claude's v3.7.4 platform-detection package.
- Fixed release metadata/test mismatch where tests still expected v3.7.3.
- Updated stale service-worker cache from the Claude package repair cache to `driveledger-v34-platform-detection-audit-fix`.
- Added OCR platform-detection smoke coverage for DoorDash, Uber Eats, Grubhub, Instacart, Spark, Roadie, and Catering.
- Added `PLATFORM_DETECTION_AUDIT.md`.

## 3.7.3 — Claude package review repair
- Reviewed uploaded `driveledger-fixed.zip` from Claude.
- Confirmed core runtime files matched v3.7.2, but Claude's ZIP was missing `tests/`, `tools/`, and `_redirects`.
- Restored missing release/test/deployment files so `npm run smoke` and Python tests work again.
- Added `CLAUDE_REVIEW_AUDIT.md`.

## 3.7.2 — Public security audit
- Added `SECURITY_AUDIT.md`.
- Scanned release package for exposed API keys, passwords, private keys, tokens, webhooks, and `.env` files.
- No exposed secrets were found.
- Added automated secret-scan regression coverage for public runtime/package files.

## 3.7.1 — Audit fix for modern UI refresh
- Fixed a CSS regression where the visual refresh could override fixed-position overlays/navigation.
- Restored fixed positioning for toast, Quick Add sheet, bottom tabs, mobile action dock, and skip link.
- Added regression tests to prevent future UI refreshes from demoting fixed overlays.

## 3.7.0 — Modern UI refresh
- Refined the visual design to feel more modern, premium, and interesting without adding clutter.
- Improved glassmorphism, gradients, card hierarchy, input styling, top bar, tab bar, and action button polish.
- Preserved all existing functionality while focusing this pass on presentation.

## Historical release history

## 3.9.0 — App-specific OCR and paused shifts

- Replaced generic OCR platform guessing with strict app-specific evidence for DoorDash, Uber Eats, Grubhub, Instacart, Spark, Roadie, and supported Catering services.
- Generic words such as `trip`, `gig`, `offer`, `catering`, and `Walmart` no longer auto-label a screenshot; weak or conflicting evidence remains `Other` for review.
- Added restaurant/store/merchant classification, known retail and grocery patterns, typed pickup labels, normalized `merchantType`, and Store/Restaurant labels in OCR review and History.
- Added real Pause/Resume shift controls. Break time is persisted locally and excluded from active time, hourly performance, pace, projections, and end-shift recap metrics.
- Extended delivery/shift migrations and backup schemas for `merchantType`, `paused`, `pausedAt`, and `breaks`.
- Bumped data schema to `10`, backup schema to `11`, package version to `3.9.0`, and service-worker cache to `driveledger-v36-platform-ocr-pause`.

## 3.8.0 — Persistent order decision ledger

- Added a local-only `driveledger.decisions.v1` ledger for ACCEPT, BORDERLINE, and DECLINE calculator recommendations.
- Added **Log Decision** so reviewed offers can be tracked without creating a completed delivery.
- Saving a calculator offer as completed now records its decision automatically.
- Added Today decision count, recent decision history/totals on Decide, and Decision CSV export.
- Extended JSON backup/import/merge/replace/rollback/emergency restore and storage controls to preserve decision records.
- Bumped data schema to `9`, backup schema to `10`, package version to `3.8.0`, and service-worker cache to `driveledger-v35-decision-ledger-command-center`.

## 3.6.4

- Changed visible branding from **Made by Tech Phactory Solutions** to the requested subtle wording: **Designed by Tech Phactory Solutions**.
- Tuned header/footer credit styling so it is understated but easier to notice in the app.
- Bumped package version to `3.6.4` and service-worker cache to `driveledger-v29-subtle-tech-phactory-credit`.

## 3.6.3

- Added visible app credit: **Made by Tech Phactory Solutions**.
- Added `.nojekyll` for GitHub Pages static deploy safety.
- Added `404.html` fallback page for GitHub Pages/static hosting.
- Updated deployment docs with GitHub Pages upload/root-folder instructions and failed-deployment troubleshooting.
- Verified runtime paths remain relative for GitHub Pages project URLs.
- Bumped package version to `3.6.3` and service-worker cache to `driveledger-v28-github-pages-branding`.

## 3.6.2

- Made Quick Add screenshot-first instead of manual-first.
- Added screenshot upload, scan status, image preview, raw OCR text, and clear scan inside the Quick Add sheet.
- Added quick OCR field population for company, restaurant/store, earnings, miles, and minutes.
- Quick Add screenshot saves now persist `source: "ocr"`, `ocrText`, `ocrConfidence`, and merchant metadata.
- Updated primary mobile dock label to `Scan Add`.
- Fixed a stray closing button tag in the mobile dock markup.
- Added smoke/static tests for screenshot-first Quick Add and OCR unavailable fallback.
- Bumped package version to `3.6.2` and service-worker cache to `driveledger-v27-screenshot-first-quick-add`.


## 3.6.1

- Repaired screenshot OCR restaurant/store detection after real testing showed it was still missing merchants.
- Added stronger merchant parsing for local restaurants, standalone pickup labels, `Go to` / `Head to` / `Arrive at` text, explicit Restaurant/Merchant/Store labels, and merchant names followed by street addresses.
- Added candidate scoring and rejection filters to avoid selecting app names, payout text, addresses, item counts, customer/drop-off labels, or navigation text as the restaurant.
- Expanded smoke tests with DoorDash, Uber Eats, and Grubhub-style OCR samples, including local restaurants and trailing-address merchant lines.
- Bumped package version to `3.6.1` and service-worker cache to `driveledger-v26-ocr-merchant-repair`.


## 3.6.0

- Added luxury simplification pass after hands-on testing feedback.
- Moved Today command-center detail cards, daily recap, and Today breakdowns behind an Advanced insights disclosure.
- Moved Scan Screenshot and Accept Calculator under a More tools disclosure on Today while keeping Quick Add as the primary action.
- Simplified the mobile action dock by keeping Quick Add prominent and hiding secondary dock actions.
- Moved export/backup tools, manual zone management, and privacy/data controls behind cleaner disclosure panels.
- Added OCR restaurant/store detection with known restaurant patterns and pickup/merchant-line heuristics.
- Added editable Restaurant / store field to the OCR review card.
- Added optional Restaurant / store field to manual editing under More details.
- Saved OCR-detected restaurants into delivery records as `merchant`/`restaurant`.
- Added restaurant display in History rows and `restaurant` column in standard CSV export.
- Bumped app data schema to `8`, backup schema to `9`, package version to `3.6.0`, and PWA service-worker cache to `driveledger-v25-luxury-ocr-refinement`.
- Expanded smoke/static tests for OCR restaurant detection and simplified UI surfaces.

## 3.5.0

- Completed Phase 20 Netlify Release Package.
- Added Netlify `_redirects` file for static fallback to `index.html`.
- Added `DEPLOYMENT.md` with Netlify Drop, iPhone install, iPad install, offline reload, localStorage persistence, and troubleshooting instructions.
- Verified runtime files stay at the package root or are correctly referenced from root-relative paths.
- Added static tests for deployment docs, `_redirects`, root package structure, and no localhost-only runtime paths.
- Added smoke coverage for Phase 20 release-package checks.
- Bumped package version to `3.5.0`.
- Bumped PWA service-worker cache to `driveledger-v24-phase20-netlify-release`.

## 3.4.0

- Completed Phase 19 Privacy and Data Control Center.
- Added a local privacy/data control card in Settings.
- Added clear explanation that GigLens data is stored locally in browser `localStorage` under `driveledger.*` keys.
- Added localStorage usage estimate and per-key size details.
- Added Export All Data using the existing JSON backup format.
- Added Import Backup access from the privacy center, reusing the existing validated import preview.
- Added double-confirmed Reset Settings Only.
- Added double-confirmed Reset Deliveries Only.
- Added double-confirmed Clear All Local Data.
- Added emergency restore from the latest backup/export/import rollback snapshot.
- Added `driveledger.lastBackup.v1` safety snapshot storage.
- Expanded smoke and static tests for privacy controls, safety snapshots, destructive-action confirmation, and restore behavior.
- Bumped package version to `3.4.0`.
- Bumped data schema version to `7` and backup version to `8`.
- Bumped PWA service-worker cache to `driveledger-v23-phase19-privacy-center`.

## 3.3.0

- Completed Phase 18 Simple Zone Heatmap Without Real GPS.
- Added a GPS-free Manual Zone Heatmap section in Analytics.
- Added map-style cards for Best Zone, Reliable Zone, Weak Zone, and Avoid Zone.
- Added a Settings custom-zone manager for defining manual driving areas.
- Added custom zone add, rename, and delete flows.
- Zone autocomplete now uses custom zones, the default zone, and existing saved delivery zone labels.
- Existing deliveries with old zone names remain valid and continue to appear in analytics.
- Deleting a custom zone does not delete or corrupt saved delivery records.
- Renaming a custom zone can update matching saved deliveries after confirmation.
- Added mobile-friendly zone heatmap and zone manager styling without GPS permissions or external map libraries.
- Expanded smoke and Python static tests for zone heatmap rendering, custom-zone persistence, rename/delete actions, and old-zone safety.
- Bumped package version to `3.3.0`.
- Bumped data schema version to `6` and backup version to `7`.
- Bumped PWA service-worker cache to `driveledger-v22-phase18-zone-heatmap`.

## 3.1.0

- Completed Phase 16 Smart Goal System.
- Added a local-only Smart Goal card in Settings.
- Calculates average earnings, estimated profit, and hours by day of week from saved past driving days.
- Excludes today’s partial delivery data from recommendations.
- Prefers current-weekday history when enough matching days exist and falls back to broader saved history when needed.
- Added Apply Suggested Goal and Keep Current Goal actions.
- Added helpful insufficient-history empty state with disabled apply action.
- Expanded smoke and Python static tests for smart-goal UI, apply/ignore wiring, current-weekday recommendation, insufficient-history behavior, and today-data exclusion.
- Bumped package version to `3.1.0`.
- Bumped PWA service-worker cache to `driveledger-v20-phase16-smart-goals`.

## 3.0.0

- Completed the final release audit and bug bash for `GigLens_v3_Release_Candidate.zip`.
- Confirmed app startup, Today dashboard, Quick Add, manual Add, OCR review, Accept Calculator, History, Analytics, exports, backup/import, settings, shifts, daily recaps, PWA manifest, and service worker test paths.
- Added final release-candidate static tests for package metadata, docs, service-worker cache version, and visible button wiring.
- Bumped package version to `3.0.0`.
- Bumped PWA service-worker cache to `driveledger-v19-v3-release-candidate`.
- Updated README with v3 Release Candidate notes, known limitations, and final manual QA checklist.
- Updated AUDIT_REPORT.md with final release audit scope, results, risks, and manual QA checklist.

## 2.14.0

- Completed Phase 14 PWA Install, Offline, and Release Polish.
- Improved `manifest.json` with install-ready long name, short name, description, display override, categories, language, scope, start URL, theme/background colors, and maskable icon purposes.
- Verified icon paths and retained 192px/512px PNG app icons.
- Reworked `service-worker.js` with explicit `driveledger-v18-phase14` cache naming, core app-shell caching, network-first navigation, cached offline fallback, stale-while-revalidate static assets, old-cache cleanup, and skip-waiting message support.
- Added an in-app offline banner explaining that tracking remains available offline while screenshot OCR may require internet if Tesseract has not loaded.
- Hardened OCR-unavailable messaging for offline/Tesseract CDN failure scenarios.
- Added Phase 14 static and smoke tests for manifest metadata, cached file paths, service-worker offline strategy markers, and offline banner behavior.
- Updated README install, Netlify, offline reload, and localStorage persistence checklists.
- Bumped package version to `2.14.0`.

## 2.13.0

- Completed Phase 13 Mobile Polish and One-Hand UX.
- Added a mobile-only sticky action dock for Quick Add, Scan, and Decide.
- Added a skip link for keyboard/accessibility navigation.
- Added stronger Quick Add dialog semantics with `role="dialog"`, `aria-modal`, and descriptive helper text.
- Added aria labels to primary driver actions, shift buttons, and bottom navigation buttons.
- Converted Today company/zone secondary reports into a collapsible breakdown panel to reduce dashboard clutter.
- Improved empty-state text for Today breakdowns, History, and Analytics.
- Increased mobile form/button touch targets and adjusted iPhone safe-area spacing.
- Switched minute fields to numeric input mode where appropriate.
- Added mobile polish CSS for sticky topbar, one-hand dock, better cards, loading/success/error states, and reduced-motion support.
- Expanded smoke tests and Python static tests for Phase 13 mobile surfaces, wiring, and accessibility markers.
- Bumped package version to `2.13.0`.
- Bumped PWA service worker cache to `driveledger-v17`.

## 2.12.0

- Completed Phase 12 Driver Coaching and Daily Recaps.
- Added a richer Daily Recap coaching card on Today.
- Added local-only recap generation with no AI APIs or backend calls.
- Added recap metrics for gross earnings, estimated profit, hours worked, miles, deliveries, gross/hour, profit/hour, gross $/mile, and profit $/mile.
- Added best company, best zone, best delivery, and weakest delivery analysis.
- Added local recommendation text for goal status, low $/mile avoidance, best platform, best zone, and next-shift advice.
- Upgraded Copy Summary into Copy Recap with complete plain-text recap output.
- Ending a shift now saves the full recap, recommendation, and metrics into shift history.
- Added saved shift history rendering inside the Daily Recap card.
- Bumped data schema version to `5` and backup version to `6` for recap metric/history metadata.
- Expanded smoke tests for no-data, one-delivery, multi-platform/multi-zone, copy recap, and end-shift recap persistence cases.
- Expanded Python static tests for Phase 12 UI, functions, wiring, and smoke coverage markers.
- Bumped package version to `2.12.0`.
- Bumped PWA service worker cache to `driveledger-v16`.

## 2.11.0

- Completed Phase 11 Backup, Restore, and Data Safety.
- Added validated backup import preview before localStorage changes.
- Added import preview metadata for delivery count, settings included, shift included, and exported date.
- Added Merge and Replace import modes.
- Merge mode keeps current settings/shift, adds new deliveries, and skips duplicate delivery IDs.
- Replace mode stores an emergency rollback first, then replaces deliveries and applies backup settings/shift when present.
- Added `buildBackupPayload()`, `validateBackupPayload()`, `renderImportPreview()`, `saveImportRollback()`, `mergeImportedDeliveries()`, and `confirmImportBackup()`.
- Hardened Restore Import Rollback with validation before applying saved rollback data.
- Rejected malformed/invalid backup files without changing saved data.
- Added duplicate HTML ID coverage and fixed a duplicate Analytics DOM ID.
- Removed a duplicate Quick Add company option.
- Expanded smoke tests for valid import, invalid import, merge deduplication, replace rollback, and rollback restore.
- Expanded Python static tests for Phase 11 backup safety surfaces.
- Bumped package version to `2.11.0`.
- Bumped PWA service worker cache to `driveledger-v15`.

## 2.10.0

- Completed Phase 10 Tax and Export Center.
- Replaced the small History export button cluster with a dedicated Tax & Export Center section.
- Added Daily Summary CSV export.
- Updated Standard CSV headers to date, company, earnings, miles, minutes, zone, note, and source.
- Updated Tax CSV headers to include gross earnings, business miles, mileage deduction rate, estimated mileage deduction, fuel cost estimate, maintenance cost estimate, and estimated profit.
- Added reusable CSV escaping helpers so commas, quotes, and multiline notes remain valid.
- Changed empty CSV exports to produce header-only files instead of refusing to export.
- Added `appDataVersion` to JSON backups.
- Expanded smoke tests for CSV headers, CSV escaping, daily grouping, JSON backup parsing, and empty export behavior.
- Expanded Python static tests for Phase 10 export surfaces and helper functions.
- Bumped package version to `2.10.0`.
- Bumped PWA service worker cache to `driveledger-v14`.

## 2.9.0

- Completed Phase 9 Platform and Zone Analytics.
- Added a dedicated Analytics tab with platform, zone, and hourly performance sections.
- Added Today best/worst labels for company and zone performance.
- Upgraded Today company/zone breakdowns with estimated profit, gross $/mile, profit $/mile, gross/hour, and profit/hour.
- Added aggregation helpers for platform, zone, and hour groups using the centralized Profit Engine.
- Added plain HTML/CSS performance bars without external chart libraries.
- Added empty-state handling for analytics when no saved delivery data exists.
- Expanded smoke tests for company aggregation, zone aggregation, hourly analytics, empty analytics state, and unsafe output checks.
- Expanded Python static tests for Phase 9 Analytics surfaces and helper functions.
- Bumped package version to `2.9.0`.
- Bumped PWA service worker cache to `driveledger-v13`.

## 2.8.0

- Completed Phase 8 History, Editing, Undo, and Daily Groups.
- Added explicit day metric rows to grouped History: average $/mile, gross/hour when available, and tracked time.
- Upgraded delivery history cards with a compact detail grid for miles, minutes, $/mile, and estimated profit.
- History cards now always show zone state, including `Unassigned`, plus source badges.
- Preserved edit, duplicate, delete, and undo-delete behavior and expanded smoke coverage for each flow.
- Fixed the History empty-state edge case where only deleted records existed.
- Expanded Python static tests for Phase 8 History surfaces.
- Bumped PWA service worker cache to `driveledger-v12`.

## 2.7.0

- Completed Phase 7 Centralized Profit Engine.
- Added a reusable `ProfitEngine` section in `app.js` for fuel cost per mile, maintenance cost, vehicle cost per mile, estimated delivery profit, profit $/mile, gross $/mile, gross hourly, profit hourly, mileage deduction, projected daily earnings, goal ETA, driver score, and row summaries.
- Routed dashboard, calculator, manual add preview, quick-add preview, OCR preview, history rows, day summaries, shift summaries, and CSV exports through centralized math helpers.
- Preserved compatibility wrappers such as `costPerMile()`, `deliveryProfit()`, `safeRate()`, and `hourlyRate()` so existing Phase 6 logic remains stable.
- Hardened numeric setting normalization so malformed values such as `NaN` fall back to defaults while valid zero settings remain supported.
- Added smoke checks for expected profit and mileage deduction output.
- Added Python static coverage confirming the Profit Engine exists and old scattered vehicle-cost formulas were removed.
- Bumped package version to `2.7.0`.
- Bumped PWA service worker cache to `driveledger-v11`.

## 2.6.0

- Completed Phase 6 Accept / Decline Calculator v2.
- Added optional note capture to the Decide tab.
- Added Calculate Only, Clear, Copy Decision, and Save as Completed actions.
- Added transparent decision metrics for gross $/mile, gross hourly pace, estimated profit, profit $/mile, and profit hourly pace.
- Added pass/fail threshold rows for minimum payout, minimum $/mile, minimum $/hour, max miles, and positive estimated profit.
- Hardened invalid calculator input so zero/missing pay, miles, or minutes cannot save a calculator delivery.
- Updated saved calculator deliveries to persist optional notes and decision tags.
- Added copyable decision summaries.
- Fixed missing numeric settings normalization so defaults such as gas price, maintenance, tax rate, and thresholds are preserved correctly.
- Expanded mocked smoke tests for ACCEPT, BORDERLINE, DECLINE, invalid input, save, clear, copy, and settings-driven decisions.
- Expanded Python static tests for Phase 6 DOM surfaces and helper functions.
- Bumped PWA service worker cache to `driveledger-v10`.

## 2.5.0

- Completed Phase 5 Screenshot OCR Review System.
- Rebuilt OCR as a review-first workflow so scanned screenshots never silently save deliveries.
- Added editable OCR review fields for company, earnings, miles, and minutes.
- Added detected minutes parsing and display.
- Added confidence labels: High confidence, Medium confidence, and Needs review.
- Added direct Save Reviewed action that writes deliveries with `source: "ocr"`, OCR text, and OCR confidence metadata.
- Added Use in Form, Cancel, and Clear Scan actions for OCR review.
- Added OCR save preview using estimated profit, gross $/mile, and hourly pace when minutes are present.
- Hardened Tesseract unavailable and scan-failure behavior so OCR issues do not crash the app.
- Expanded mocked smoke tests for OCR parsing, reviewed save, low-confidence no-autosave behavior, and OCR failure handling.
- Expanded Python static tests for Phase 5 OCR review surfaces and helper functions.
- Bumped PWA service worker cache to `driveledger-v9`.

## 2.4.0

- Completed Phase 4 Fast Quick-Add Flow.
- Added a prominent Today-screen Quick Add button that opens a bottom-sheet entry flow instead of switching tabs.
- Added quick-add fields for company, earnings, miles, minutes, zone, and collapsible optional notes.
- Added quick-add validation for valid company, earnings greater than 0, miles 0 or greater, and minutes 0 or greater.
- Added smart quick-add defaults from the most recent saved company/zone, with Settings fallback.
- Added Quick Add Save and Save + Add Another actions with immediate localStorage persistence, dashboard updates, and toast feedback.
- Added quick-add preview support, including safe zero-mile handling without unsafe Infinity math.
- Expanded mocked startup smoke tests for quick-add open/save/invalid-save behavior and dashboard refresh after quick save.
- Expanded Python static tests for Phase 4 bottom-sheet surfaces and helper functions.
- Bumped PWA service worker cache to `driveledger-v8`.

## 2.3.0

- Completed Phase 3 Premium Today Command Center.
- Reworked Today into dedicated Pace, Efficiency, Tax, Performance, and Last Delivery Impact cards.
- Added projected today total and explicit goal ETA metrics.
- Added best company and best zone command metrics.
- Added in-hero Start/End Day action wired to the existing shift toggle.
- Added live pace, efficiency, and performance recommendation text based on real local data.
- Added safe $/mile ranking helper to avoid unsafe Infinity math with zero-mile legacy records.
- Expanded smoke tests for Phase 3 command center rendering and hero shift wiring.
- Expanded Python static tests for Phase 3 Today screen surfaces and helper functions.
- Bumped PWA service worker cache to `driveledger-v7`.

## 2.2.0

- Completed Phase 2 data model and storage upgrade.
- Added full normalized delivery schema fields: date, note/notes, OCR text, tags, deleted flag, and current data version.
- Added long-form settings keys with backward-compatible aliases for existing UI logic.
- Added shift `lastSummary`, `shiftHistory`, and shift-history normalization.
- Added startup persistence for normalized migrated localStorage state.
- Added backup schema metadata to JSON exports.
- Improved backup import source normalization for unknown-source records.
- Expanded smoke tests for legacy data migration and shift-history persistence.
- Expanded Python static tests for Phase 2 schema and migration hooks.
- Bumped PWA service worker cache to `driveledger-v6`.

## 2.1.1

- Completed Phase 1 full audit/stabilization pass on the v2.1 baseline.
- Fixed summary copy feedback so the app no longer claims a summary was copied when the Clipboard API is unavailable.
- Expanded the mocked startup smoke test to cover unavailable Clipboard API behavior.
- Expanded Python static tests to verify service-worker cached assets exist.
- Expanded event-binding checks for Save + Add Another and Cancel Edit.
- Bumped PWA service worker cache to `driveledger-v5`.

## 2.1.0

- Added calculator zone capture.
- Added delivery source metadata normalization.
- Added OCR confidence, updatedAt, and version metadata on normalized delivery records.
- Added source labels in History.
- Added Save + Add Another for faster repeated manual entry.
- Added pre-import rollback snapshots.
- Added Restore Import Rollback control.
- Added source and OCR confidence columns to standard and tax CSV exports.
- Expanded mocked startup smoke coverage.
- Bumped PWA service worker cache to `driveledger-v4`.
