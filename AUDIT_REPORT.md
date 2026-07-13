## 4.5.0 Calendar monthly analytics audit

The Calendar tab now renders analysis for the month currently being viewed. All metrics are derived from local saved deliveries, shift records, screenshot timestamps, settings, and the centralized Profit Engine. Empty months show safe empty states, previous-month comparisons avoid divide-by-zero output, and no external analytics service or backend was added.

Coverage includes monthly KPIs, month-over-month trend labels, best platform/zone/hour/day, daily earnings bars, platform and zone rankings, work-time aggregation, DOM wiring, syntax, smoke behavior, PWA cache versioning, and public secret scanning.

## 4.4.0 functional minimalist UI redesign audit
The full GigLens interface was restyled to match the supplied mobile reference while preserving every real workflow. Mobile navigation now prioritizes Today, Calendar, Decide, History, and Settings; Manual Entry and Analytics remain accessible through More tools. No decorative status dots, fake indicators, or nonfunctional widgets were added. See `UI_REDESIGN_AUDIT.md`.

## 4.3.0 calendar and timestamp audit

Scope: add a real Calendar workflow and date/time-aware screenshot history without introducing a backend or changing the local-first architecture. The Calendar reads normalized local deliveries, allows historical corrections through the existing edit flow, and uses saved shift breaks when available. When shift records are unavailable, GigLens estimates work sessions from screenshot timestamps and delivery durations using a conservative 75-minute session-gap rule. OCR timestamp results remain editable because status bars, app deadlines, and compressed screenshots can be ambiguous.

Verification: JavaScript syntax passed, the executable browser-mock smoke suite passed, all 43 Python regression tests passed, icon/manifest references passed, and the public secret scan found no exposed credentials.

## GigLens 4.2.0 full audit, repair, and UI/performance pass

Source of truth: `GigLens_v4_1_2_Stability_Repair_GitHub.zip`. The archive was traversal-checked and extracted into an isolated workspace before any changes. Its baseline JavaScript syntax, executable smoke suite, and all 41 existing Python tests passed, so this release preserves the working architecture and applies targeted repairs rather than replacing the app.

### Confirmed findings and repairs

- **Unsafe learned platform transfer:** similar OCR records could reuse a manually corrected platform using only generic tokens such as `delivery`, `pickup`, `offer`, or `miles`. Cross-screenshot platform learning now requires a shared token distinctive to the corrected platform. Exact reviewed screenshot signatures still reuse the driver's correction.
- **Visual platform evidence had regressed out of the scan path:** both Quick Scan and full OCR now sample the lower screenshot region in parallel with OCR. A dominant green/red/orange interface accent may support Uber Eats/DoorDash/Grubhub only when the text also contains an offer workflow and numeric offer evidence. Blue never chooses Spark versus Amazon Flex by itself. Strong app text is not overridden by conflicting color.
- **Merchant normalization could erase a real business name:** the broad `taqueria` rule returned “Mexican Restaurant” instead of the actual merchant. It was replaced with specific chain normalization, expanded retail/grocery patterns, and stronger company context for store classification.
- **Imported pause records could disagree with their breaks:** an open break with `paused: false` looked resumed, while `pausedAt` without a break failed to subtract time. Shift migration now derives a consistent paused state, creates a missing open break, rejects reversed break intervals, and merges duplicate/overlapping intervals so time is not subtracted twice.
- **The 2026 mileage estimate became stale midyear:** the previous global `0.725` default was no longer correct for all 2026 dates. Automatic mode now uses 72.5¢ per mile for Jan 1–Jun 30 and 76¢ per mile for Jul 1–Dec 31, summing deductions per delivery date and exporting the actual row rate. Existing non-default rates migrate to custom mode. The July rate is based on [IRS Announcement 2026-11](https://www.irs.gov/irb/2026-29_IRB); all tax figures remain estimates and users should verify their eligibility.
- **History DOM growth was unbounded:** History now renders 30 days initially and exposes a wired Show Older History action. Exports and analytics still process the complete local dataset. Custom-zone counts were changed from repeated filter/sort passes to one count map.
- **Redundant app-shell and icon assets remained:** hidden duplicate mobile-dock HTML was removed. Icon references now use the canonical opaque PNG set and duplicate `-v401`, `-v410`, and generic legacy icons were removed. The service-worker cache was bumped to `giglens-v42-giglens-audit-performance`.
- **UI hierarchy needed a release-level pass:** the command center now has a deeper but quieter surface system, clearer active navigation, platform-color rails and pills in History, explicit automatic/custom tax controls, responsive hover treatment, mobile refinements, and `content-visibility` hints for long History/Analytics pages.

### Security review

- No backend, framework, build system, account service, analytics tracker, or new remote endpoint was added.
- Runtime files were scanned for common API keys, GitHub tokens, cloud credentials, payment secrets, webhooks, private-key blocks, and `.env` material; none were detected.
- The existing restrictive CSP, no-referrer policy, pinned Tesseract.js loader with SRI, same-origin service-worker cache rules, escaped dynamic text, normalized imports, and local-only storage model remain in place.
- A public static repository cannot prevent a compromised GitHub maintainer account or malicious repository change. Branch protection, two-factor authentication, least-privilege Pages permissions, and pull-request review remain required operational controls.

### Data migration and compatibility

- Data schema: `15`; backup schema: `16`.
- Existing `giglens.*` and legacy `driveledger.*` local storage migration remains non-destructive.
- Existing custom mileage rates are preserved as custom. The exact old app defaults migrate to automatic date-aware mode.
- Delivery, decision, OCR-learning, shift-history, import/merge/replace, rollback, emergency restore, CSV, and JSON backup paths remain supported.

### Files changed

`index.html`, `styles.css`, `app.js`, `manifest.json`, `service-worker.js`, `package.json`, `tests/test_static_app.py`, `tools/smoke-startup.js`, `README.md`, `AUDIT_REPORT.md`, `CHANGELOG.md`, `DEPLOYMENT.md`, `SECURITY_AUDIT.md`, `OCR_LEARNING_AUDIT.md`, and `PLATFORM_DETECTION_AUDIT.md`.

Removed duplicate icon files: versioned `-v401`/`-v410` copies, old `icons/icon-192.png` / `icons/icon-512.png`, `apple-touch-icon-v410.png`, and `favicon-v410.png`. Canonical icon files remain unchanged.

### Automated verification

- `node --check app.js`, `service-worker.js`, and `404.js`: passed.
- `node tools/smoke-startup.js`: passed, including OCR lifecycle, conservative color evidence, generic-learning isolation, merchant/store cases, date-aware tax CSV, pause migration, overlapping-break union, history pagination, imports/exports, PWA caching, and secret scanning.
- `python -m unittest discover -s tests -v`: `42/42` passed, including static asset, visible-button wiring, CSP/PWA, migration, icon, release metadata, and executable smoke coverage.
- Supplied screenshot calibration: Uber image `10.22%` qualifying green with effectively no competing accent; DoorDash image `8.84%` qualifying red with negligible competition.
- In-app browser QA: desktop and 390×844 responsive layouts passed; no horizontal overflow; five visible mobile nav items; no mobile dock; Quick Add open/close passed; Start/Pause/Resume/End passed; automatic/custom tax control state passed; canonical manifest/icon metadata passed; browser console errors: none.
- Local HTTP verification: `10/10` requested shell, manifest, service-worker, script, stylesheet, and canonical icon paths returned `200`.

### Remaining risks

- OCR is heuristic and gig apps can change their layouts. A cropped, compressed, dark-mode, or low-text screenshot may intentionally remain `Other`; every detected field must still be reviewed before saving.
- Accent colors are supporting evidence, not logos. Red/green/orange selection requires offer-like OCR text, but unusual app themes can still reduce confidence.
- `localStorage` is origin- and browser-specific and can be cleared by the user or OS. Regular JSON backups remain essential.
- Tesseract worker/core/language files are public pinned remote dependencies and require a network connection on first use; ordinary tracking remains available offline.
- Automatic mileage rates cover the bundled 2024–2026 schedule. Future-year rates require a release update or custom mode, and eligibility is outside the app's scope.
- Real iPhone Home Screen installation, Safari Share Sheet export, camera/file-picker behavior, WebAssembly OCR speed, and GitHub Pages cache activation still require device-level confirmation after deployment.

### Manual QA checklist

1. Export a JSON backup, deploy all release files together, reload once, then close/reopen the installed PWA.
2. Confirm the GigLens icon appears in Safari and on a newly added iPhone Home Screen shortcut. Remove/re-add an old shortcut if iOS retains cached artwork.
3. Start Day, Pause, wait briefly, Resume, and End Day; confirm paused time is excluded and the recap is saved.
4. Scan clear DoorDash, Uber Eats, Grubhub, Spark, Amazon Flex, Instacart, and Roadie examples. Confirm strong text wins conflicts, blue does not guess Spark/Amazon, and all fields remain editable.
5. Correct a platform once, then scan a similar screenshot from that app and an unrelated generic offer. Confirm only the distinctive app workflow receives the learned label.
6. Scan restaurant and retail orders, including an unfamiliar taqueria and grocery store; confirm the real merchant name remains editable and History uses Restaurant/Store/Merchant appropriately.
7. Save deliveries dated in both halves of 2026 through import, export Tax CSV, and verify 0.725/0.76 rates appear on the correct rows.
8. Create more than 30 delivery days or import a test backup; confirm Show Older History expands the list and analytics/exports still include all records.
9. Test manual entry, Quick Add, calculator decision logging, edit, duplicate, delete/undo, CSV exports, backup import merge/replace, and emergency rollback.
10. Load once online, switch to Airplane Mode, and confirm the app shell and local features reopen. OCR may need connectivity if its remote files were not already available.

## 4.1.1 merchant/store data-path audit
The baseline v4.1.0 syntax, smoke, and 40-test suite passed. A deeper code audit found that `merchantType` was calculated during OCR but omitted by `normalizeDelivery()`, so saved/imported records lost their restaurant/store classification. History also hardcoded all merchants as restaurants, and Walmart could be rejected as a merchant because the same word supports Spark platform detection. These issues are repaired and covered by new executable regression cases.

### Verification

- `npm run syntax`: passed.
- `npm run smoke`: passed, including Schnucks, Walmart, and Best Buy store OCR cases.
- `python -m unittest discover -s tests -v`: 41 tests passed.
- Local static-server asset checks returned HTTP 200 for the app shell, manifest, service worker, icons, and fallback script.
- Secret scan found no API keys, passwords, private keys, authentication tokens, or `.env` credentials.

## 4.1.0 OCR learning, embedded icon, and mobile layout audit

User testing showed three concrete defects: the in-app brand icon rendered as a broken image, the screenshot correction process did not improve future recognition, and the mobile Today screen was cramped by duplicate fixed actions and six bottom tabs.

### Repairs

- Replaced the header `<img>` with an inline SVG representation of the GigLens lens/route mark. The installed PWA still includes opaque PNG Apple/manifest icons, but the visible in-app mark no longer depends on a separate network path.
- Added cache-busted v4.1 icon assets and service-worker references.
- Added `giglens.ocrLearning.v1`, capped at 120 normalized local correction records.
- Learning records store a hashed OCR text signature, stable workflow tokens, original/corrected fields, safe numeric-context hints, and confirmation counts. Screenshot image data is not stored.
- Exact OCR matches reuse all reviewed fields. Similar workflow matches can improve platform selection, learned merchant aliases normalize future names, and numeric-context hints influence candidate ranking.
- Learning is included in export, validated import, merge/replace, rollback, emergency restore, storage usage, reset, and clear-all flows.
- Removed the redundant mobile Scan Add dock, hid the duplicate Add navigation item on small screens, reduced header/hero height, and restored unobstructed scrolling above the five-item bottom bar.

### Verification

The executable browser-mock suite covers correction capture, similar-screenshot reuse, learning status, and reset. Static tests cover the embedded logo, storage key, learning functions, mobile dock removal, five-item navigation, icon files, PWA metadata, and existing feature wiring.

## GigLens 4.1.2 Stability Audit and Repair

Scope: full review of the uploaded `GigLens_v4_1_1_Audit_Merchant_Type_Repair(1).zip` as the source of truth. The audit covered JavaScript syntax, executable smoke behavior, Python static/regression tests, OCR lifecycle handling, shift/break calculations, profit and tax defaults, PWA assets, GitHub Pages paths, local-data migrations, import/export safety, public-secret exposure, mobile layout rules, and release documentation.

### Confirmed defects repaired

- **Paused time was not actually excluded from hourly calculations.** `getWorkWindow()` calculated break milliseconds, but `ProfitEngine.summarizeRows()` used the raw start/end duration and ignored the break value. The Profit Engine now consumes explicit active milliseconds after subtracting overlapping breaks.
- **Multiple shifts on the same day produced misleading hourly averages.** Starting a later shift replaced the top-level start time while Today still included all daily earnings. Shift history now stores per-shift breaks and active hours, and Today combines each same-day active interval without double counting.
- **End-shift recaps could include deliveries outside that shift.** Recaps now select records between that shift's start and end and use the shift's own active duration.
- **OCR cleanup could defeat the visible timeout.** Recognition had a timeout, but the `finally` block awaited `worker.terminate()` without a bound. Cleanup now has its own three-second ceiling.
- **Older OCR results could overwrite newer screenshots.** Full and Quick scanners now use generation guards and ignore stale progress/results after another image is selected or a scan is cleared.
- **Normal app startup waited on a third-party OCR script.** Tesseract.js is now loaded on demand with pinned version, integrity metadata, progress, retry, and timeout handling. Manual tracking remains available when OCR cannot load.
- **Screenshot inputs had no practical size guard.** Non-image files and images over 20 MB now fail clearly before OCR work begins.
- **Manual Add rejected zero miles while Quick Add and OCR review accepted it.** All entry paths now consistently accept an explicit `0` to represent mileage not yet available while still rejecting a blank or negative value.
- **Decision CSV export called a nonexistent helper.** Tapping the export button raised a `ReferenceError` because `downloadFile()` was no longer defined. It now uses the tested Share Sheet/download helper and reports empty-ledger exports clearly.
- **The default mileage deduction rate was stale.** The default moved from the 2024 value of `0.67` to the 2026 U.S. business rate of `0.725`; the exact old default migrates while other custom values remain unchanged. Three-decimal rate precision is preserved.
- **Deployment documentation contradicted the GitHub-only project direction.** Obsolete Netlify files and instructions were removed, and `DEPLOYMENT.md` now covers GitHub Pages root publishing and iPhone/iPad installation.

### Preserved behavior

- Existing `giglens.*` and legacy `driveledger.*` local-storage migration paths remain intact.
- OCR correction learning still stores compact local patterns rather than screenshot pixels.
- Restaurant/store/merchant classification, strict platform evidence, manual entry, Quick Add, history editing, calculator decisions, analytics, zones, backups, rollback restore, PWA icons, and offline app-shell behavior remain present.
- The project remains a static GitHub Pages PWA with no backend, account, API secret, framework, or build dependency.

### Verification

Run before packaging:

```text
npm run syntax
npm run smoke
npm test
```

The smoke suite now includes executable cases for break-adjusted active time, multiple same-day shifts, zero-mile manual entry, bounded OCR cleanup, stale concurrent scan ordering, merchant/store detection, local correction learning, import/rollback, exports, decision logic, mobile/PWA behavior, and secret scanning.

Final result:

```text
npm run syntax: passed
npm run smoke: passed
npm test: 41 tests passed
ESLint no-undef / unreachable / duplicate-key checks: passed for app.js, service-worker.js, and 404.js
Local HTTP asset verification: 9/9 requested app-shell/icon paths returned 200
Tesseract.js 5.1.1 loader SHA-384: matched the pinned integrity value
Public secret scan: passed
```

### Remaining device-level checks

- A real iPhone/iPad Safari session is still required to confirm the hosted GitHub Pages deployment, Home Screen artwork refresh, iOS file picker behavior, WebAssembly OCR performance, Share Sheet export, safe-area layout, and offline reopening.
- iOS may retain an old Home Screen icon until the old shortcut is removed and GigLens is added again from Safari.
- OCR accuracy remains dependent on screenshot quality and changing delivery-app layouts; the editable review and local correction-memory paths remain required safeguards.
- Browser-local data can be removed by clearing site data or changing the hosted origin, so JSON backups remain important.

# GigLens Audit Report

## 4.0.1 Home Screen icon and screenshot OCR repair

Audit reproduced two release-level problems. The uploaded GigLens HTML and manifest references expected GigLens icon files, but the supplied release set did not include those icon assets. The OCR worker configuration also pointed at `tesseract.js-core@5.1.1`; Tesseract.js v5 documents its core directory as `tesseract.js-core@v5.0.0`. The OCR flow had no bounded recovery when worker initialization or recognition stalled.

Fixes: generated exact opaque icons, added root and versioned Safari/PWA icon paths, updated the service-worker cache, corrected the core dependency path, permitted WebAssembly under CSP, added progress reporting, 20-second engine initialization timeout, 45-second recognition timeout, worker termination, and clear manual-entry fallback.

## 4.0.0 rebrand, visual classifier, UI, icon, and publishing-security audit

Scope: incrementally upgrade the existing static/local-first PWA without a backend, framework, build system, or destructive data rewrite.

### Implemented

- Renamed the live app to **GigLens** across HTML metadata, manifest, package/export/cache/storage namespaces, fallback page, documentation, and brand-bearing icon filenames.
- Added `migrateLegacyStorage()` so existing `driveledger.*` values copy to `giglens.*` only when a destination is absent. Legacy keys are retained and all records still pass the existing normalization pipeline.
- Generated and installed a purpose-built lens/route icon at 180, 192, 512, and 1024px. Added the exact 180px Apple touch icon required by iPhone Home Screen installation.
- Added real lower-card pixel sampling and HSV accent classification. Green supports Uber Eats, red DoorDash, orange Grubhub, and blue Amazon Flex/Spark; visual evidence never qualifies a platform by itself.
- Added layout evidence from the supplied screenshots, Amazon Flex normalization/select options, and Burger King / Chick-fil-A restaurant regression cases. Existing known-store parsing remains active.
- Modernized the command-center presentation and screenshot CTA without removing or orphaning controls.
- Pinned Tesseract.js `5.1.1`, verified SHA-384 SRI, added CSP/referrer controls, `_headers`, `SECURITY.md`, externalized the fallback script, and restricted service-worker caching to known same-origin asset destinations.
- Kept standard web entry files unchanged because GitHub Pages and the no-build PWA depend on them. Brand-bearing files use `giglens-*`.

### Files changed

`index.html`, `styles.css`, `app.js`, `manifest.json`, `service-worker.js`, `package.json`, `404.html`, `404.js`, `_redirects`, `_headers`, `SECURITY.md`, `README.md`, `AUDIT_REPORT.md`, `CHANGELOG.md`, `DEPLOYMENT.md`, `SECURITY_AUDIT.md`, `PLATFORM_DETECTION_AUDIT.md`, `tests/test_static_app.py`, `tools/smoke-startup.js`, and `icons/giglens-icon-{180,192,512,1024}.png`.

### Verification

```text
node --check app.js
node --check service-worker.js
node --check 404.js
node tools/smoke-startup.js
python -m unittest discover -s tests -v
```

Release result: JavaScript syntax checks passed, the executable startup/workflow smoke suite passed, and all `41/41` Python static/regression tests passed.

Browser QA covered desktop and 375×844 mobile rendering, horizontal overflow, live Quick Add opening, Amazon Flex selector presence, Start/Pause/Resume/End shift logic, Home Screen icon metadata, and browser console/security-policy warnings. The supplied image pixel check produced a clear green result for Uber Eats and clear red result for DoorDash.

### Remaining risks

- OCR is probabilistic. Crops, compression, overlays, future app redesigns, accessibility themes, or unusual colors can reduce evidence; ambiguous results deliberately remain editable or `Other`.
- Blue is shared by multiple apps and is never enough to choose Amazon Flex versus Spark without text evidence.
- Tesseract worker/core/language assets are pinned third-party CDN resources. SRI protects the entry script; fully vendoring OCR assets would further reduce CDN availability risk.
- Data is device/browser-local. Users should export backups before clearing Safari data or changing devices.
- No static app can prevent a compromised GitHub administrator or device from replacing files; repository protection and maintainer account security remain operational requirements.

### Manual QA checklist

- Publish only the v4 ZIP contents at the GitHub repository root and confirm `.nojekyll` is present.
- In iPhone Safari, remove any old shortcut, reload the HTTPS site, use Add to Home Screen, and confirm the GigLens icon/name appear.
- Scan the supplied Uber Eats screenshot; confirm Uber Eats, Burger King, restaurant type, `$9.98`, `3.2 mi`, and `20 min`, then review before saving.
- Scan the supplied DoorDash screenshot; confirm DoorDash, Chick-fil-A, restaurant type, `$7.40`, and `2.6 mi`, then review before saving.
- Test at least one Grubhub, Spark, Amazon Flex, Instacart, Roadie, catering, and unknown screenshot; confirm unknown/ambiguous captures remain `Other`.
- Start a day, pause for a break, resume, add a delivery, and end the day; confirm break time is excluded from active hourly pace.
- Reload online once, then test offline shell loading. Confirm OCR fails safely when its CDN is unavailable.
- Export JSON, import it in a separate test profile, and verify deliveries, decisions, settings, and shifts survive.
- Enable GitHub branch protection, required reviews/checks, least-privilege Pages deployment, and maintainer two-factor authentication.

## 3.9.0 app-specific OCR and paused-shift audit

Scope: targeted upgrade of the existing static/local-first PWA after driver feedback that screenshot OCR was confusing DoorDash and Uber Eats, forcing stores into restaurant labels, and offering no way to take a break without ending the day.

Findings and fixes:

- Finding: broad terms including `dash`, `trip`, `gig`, `catering`, `offer`, and `Walmart` could act as enough platform evidence to choose the wrong company.
  - Fix: replaced that behavior with a qualification gate. A company is filled only when OCR finds a direct brand/header or a distinctive app workflow; generic terms alone produce `Other`. Conflicting direct evidence remains reviewable instead of being guessed.
- Finding: the merchant scorer treated retail and grocery pickups as restaurants, and `Walmart` was rejected as an app-related word rather than retained as a store.
  - Fix: added normalized `merchantType` support, separate known-store patterns, typed `Restaurant:` / `Store:` labels, retail-aware candidate scoring, and Store/Restaurant display labels in the OCR review and History.
- Finding: shift state only supported active versus ended, so breaks inflated active work time and hourly metrics.
  - Fix: added `paused`, `pausedAt`, and normalized, de-duplicated `breaks` to `driveledger.shift.v1`. Pause/Resume is wired to the dashboard, active-hours calculations subtract overlapping breaks, and ending while paused closes the open break before recap persistence.
- Data compatibility: existing delivery, decision, settings, shift, backup/import, rollback, and emergency restore paths are preserved. Delivery migration adds `merchantType` and shift migration adds safe pause defaults. Data schema is now `10`; backup schema is `11`.
- Static/PWA compatibility: no backend, framework, build step, remote data store, or fake UI was added. The service-worker cache changed to `driveledger-v36-platform-ocr-pause` so deployed clients receive the updated app shell.

Tests run:

```text
node --check app.js
node --check service-worker.js
node tools/smoke-startup.js
python -m unittest discover -s tests -v
```

Automated coverage now includes strict platform evidence for DoorDash, Uber Eats, Grubhub, Instacart, Spark, Roadie, and Catering; mixed-identifier and generic-word non-guess cases; restaurant/store OCR examples; legacy type migration; pause/resume wiring; excluded-break active hours; and ending a paused shift.

Remaining risks:

- OCR remains dependent on screenshot quality and Tesseract text extraction. The review card is intentionally editable, and ambiguous screenshots should be corrected before saving.
- The local classifier recognizes common app vocabulary and known merchant patterns; new layouts, unfamiliar delivery services, stylized local names, and image-only logos may correctly fall back to `Other` rather than infer a risky label.
- Browser-local data should still be protected with JSON backups. Real iPhone/iPad Safari testing remains recommended for OCR crop quality, pause/resume ergonomics, and share/download behavior.

## 3.8.0 persistent order decision ledger audit

Scope: incremental upgrade of the uploaded v3.7.5 static PWA to close the core requirement that drivers can track order accept/decline decisions, not only calculate them.

Findings and fixes:

- The existing calculator produced real ACCEPT, BORDERLINE, and DECLINE recommendations, but only completed orders were retained through delivery history.
- Added normalized local decision records under `driveledger.decisions.v1`, with outcome, company, zone, pay, miles, minutes, note, timestamp, source, and schema version.
- Added a real **Log Decision** action for offers that are reviewed but not completed. Saving an offer as completed also records the calculator decision automatically.
- Added Today decision count, Decide decision totals/recent history, and Decision CSV export.
- Added JSON backup schema coverage, validated import preview, merge/replace handling, rollback restore, emergency restore, storage measurement, and clear-all handling for decisions.
- Preserved the static PWA/local-first architecture and existing delivery/settings/shift data. Missing decision storage from older installations migrates to a safe empty array.

Tests run:

```text
node --check app.js
node --check service-worker.js
node tools/smoke-startup.js
python -m unittest discover -s tests -v
```

The mocked-browser smoke suite now covers decision migration, logging without creating a delivery, automatic logging when saving a completed calculator offer, decision CSV output, and command-center rendering.

Remaining risks:

- Decision outcomes describe the calculator recommendation; the app does not know whether a driver actually accepted or declined an offer unless the driver logs it.
- Profit, tax, and threshold values remain estimates based on user-maintained Settings.
- Storage remains browser-local; users should export JSON backups before clearing browser data or switching devices.
- Real iPhone/iPad Safari testing is still recommended for share/download behavior and safe-area layout.

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

# GigLens Audit Report

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

Used `GigLens_v3_6_0_Luxury_OCR_Refinement.zip` as the base. The user reported that screenshot OCR still had trouble identifying the restaurant/store. This pass focused only on OCR merchant parsing, tests, docs, package metadata, and cache versioning. No backend, framework, GPS, account system, or UI redesign was added.

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

Used the latest GigLens Phase 20 Netlify Release Package ZIP as the base. The goal was to respond to testing feedback that the app felt cluttered and that screenshot OCR did not detect the restaurant/store name reliably enough. The app remains a static local-first PWA with no backend, framework, build step, account system, GPS dependency, or cloud data store.

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

Used the latest GigLens Phase 19 Privacy and Data Control Center ZIP as the base and prepared the static PWA package for simple Netlify Drop deployment. No backend, framework, build step, environment variable, database server, account system, or runtime localhost dependency was added.

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

Used the latest GigLens Phase 18 Zone Heatmap ZIP as the base and added a privacy/data control center while preserving the static local-first PWA architecture. No backend, account system, cloud storage, GPS upload, analytics service, framework, or build step was added.

### Findings / implementation

- Added a Privacy and Data Control Center card in Settings.
- Added plain-language explanation that GigLens stores data locally in browser `localStorage` under namespaced `driveledger.*` keys.
- Added localStorage usage estimation for GigLens keys.
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

Used the latest GigLens Phase 17 Best Time to Drive ZIP as the base and added a simple GPS-free zone heatmap. The app remains a static local-first PWA. No backend, GPS permission, mapping API, external chart library, framework, or fake data source was added.

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

Used the latest GigLens Phase 16 Smart Goal ZIP as the base and added Best Time to Drive insights without changing the static PWA architecture. No backend, framework, external chart library, AI API, or fake data source was added.

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

Used the latest GigLens v3 Release Candidate ZIP as the base and added the Smart Goal System without changing the static PWA architecture. No backend, framework, cloud service, or fake data source was added.

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

Used the Phase 13 Mobile Polish ZIP as the base and kept GigLens as a plain static local-first PWA. No backend, framework, build system, account system, or cloud database was added.

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

# GigLens Phase 5 Audit Report

## Phase

Phase 5 — Screenshot OCR Review System

## Base ZIP

`GigLens_v2_4_0_Phase4_Quick_Add.zip`

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
