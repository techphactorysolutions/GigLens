# GigLens

GigLens is a private, local-first command center for drivers who run several gig apps at once. Its fastest workflow is: take an offer or completed-delivery screenshot, scan it, review the detected app/merchant/pay/miles/time, and save it while the day is still moving. Saved deliveries then power earnings, estimated profit, mileage deduction, hourly pace, platform, zone, shift, and accept/decline analytics.

Current release: `4.0.1`.

## 4.0.1 icon and OCR recovery repair

This release fixes missing iPhone Home Screen artwork and screenshot scans that could remain in a loading state. GigLens now ships opaque 180/192/512/1024 PNG icons plus a root Apple touch icon, uses cache-busting icon filenames, and updates the PWA cache. OCR now uses the documented Tesseract.js v5 core directory, includes WebAssembly CSP permission, displays progress, times out safely, terminates its worker, and returns the user to editable manual fields when OCR cannot finish.

After deploying this release on iPhone, delete the old Home Screen shortcut, reload the hosted site in Safari, then use Share → Add to Home Screen again because iOS caches shortcut artwork.

## 4.0.0 — GigLens rebrand, visual screenshot intelligence, modern UI, and security hardening

- Renamed the live product, PWA manifest, browser title, package, exports, cache namespace, local-storage namespace, icon assets, fallback page, and release archive from the previous brand to **GigLens**.
- Added a non-destructive startup migration from legacy `driveledger.*` browser keys to `giglens.*`. Existing values are copied only when the new key is absent; old keys are retained as a recovery source.
- Added a new multi-color lens/route icon in 180, 192, 512, and 1024px PNG sizes. The explicit 180px `apple-touch-icon` fixes the missing iPhone Home Screen icon.
- Modernized the live UI with the icon brand lockup, clearer screenshot-first action, richer command-card hierarchy, improved mobile spacing, and refined cyan/mint/coral/orange/blue visual accents. All visible controls remain wired to existing or new logic.
- Added lower-offer-card pixel analysis. A dominant green accent supports Uber Eats, red supports DoorDash, orange supports Grubhub, and blue supports Amazon Flex or Spark. Color is supporting evidence only and can never label a screenshot by itself.
- Added Uber Eats `Exclusive` / total-time layout signals, DoorDash `Deliver by` / `Customer dropoff` signals, Amazon Flex fingerprints, and restaurant/store regression cases based on the supplied Burger King and Chick-fil-A screenshots.
- Pinned Tesseract.js to `5.1.1`, verified its SHA-384 integrity hash, added a Content Security Policy and no-referrer policy, restricted service-worker caching, added static-host security headers, and documented GitHub branch/account controls in `SECURITY.md`.

Standard static entry-point filenames such as `index.html`, `app.js`, `styles.css`, `manifest.json`, and `service-worker.js` intentionally remain standard so GitHub Pages, iOS installation, and the existing no-build architecture continue to work. Brand-bearing assets and namespaces now use `GigLens` / `giglens`.

Release verification: JavaScript syntax checks, the executable browser-mock smoke suite, `41/41` Python regression tests, and desktop/mobile browser QA passed.

## 3.9.0 app-specific OCR and paused shifts

This release fixes two real driver-workflow gaps without changing GigLens's static, local-first architecture. Screenshot classification now requires direct app branding or a distinctive app workflow before it fills in a company. Ordinary delivery words such as `trip`, `gig`, `offer`, `catering`, or `Walmart` no longer silently guess Uber Eats, DoorDash, Roadie, Spark, or Catering. When evidence conflicts or is too weak, the editable review card intentionally leaves Company as `Other` and explains that it needs review.

The OCR merchant parser now distinguishes restaurants from stores. It recognizes common grocery, retail, pharmacy, warehouse, and hardware chains alongside restaurant patterns, applies `Restaurant:` versus `Store:` context, and preserves a normalized `merchantType` (`restaurant`, `store`, or `merchant`) on saved delivery records. Existing deliveries migrate safely by inferring a type where possible; their legacy `merchant` and `restaurant` fields remain intact for compatibility.

Today now has a real **Pause** / **Resume** control. Pausing keeps the day open, freezes active work time, and excludes the break from gross/hour, profit/hour, projected pace, and end-shift recap hours. Completed breaks are saved in the local shift record and included in JSON backup/import/rollback normalization. Ending a paused shift closes its current break before saving the recap.

Release checks cover syntax, visible button wiring, legacy data migration, strict platform evidence, app conflict review, restaurant/store parsing, and paused-break active-hour calculations. No backend, account, cloud service, framework, or build step was added.

## 3.8.0 persistent order decision ledger

This release completes the command-center loop for order quality. The Accept Calculator can now log every valid ACCEPT, BORDERLINE, or DECLINE recommendation to a separate local-only decision ledger, while **Save as Completed** automatically records the calculator decision alongside the delivery. Today shows the decision count, Decide shows recent decision history and live totals, and the ledger can be exported as CSV.

Decision records are migration-safe and stored under `driveledger.decisions.v1`. Existing delivery, settings, and shift data are preserved. JSON backups include decisions; validated merge/replace imports, rollback restore, emergency restore, and Clear All Local Data handle the new store. No backend, account system, GPS service, framework, or build system was added.

Release checks for this upgrade include static DOM/button binding checks, JavaScript syntax, the mocked-browser startup smoke suite, decision migration, non-delivery decision logging, automatic calculator decision capture, decision CSV export, and PWA cache-version checks.

## Platform detection audit note
GigLens v3.7.5 repairs Claude's v3.7.4 package metadata mismatch and validates expanded OCR platform detection for DoorDash, Uber Eats, Grubhub, Instacart, Spark, Roadie, and Catering. See `PLATFORM_DETECTION_AUDIT.md`.

## 3.7.3 Claude package repair
The uploaded Claude ZIP was inspected. The main runtime files matched v3.7.2, but the package was missing `tests/`, `tools/`, and `_redirects`, which broke the test/smoke workflow. This release restores those files and keeps the security-audited runtime intact.

## Public security note
GigLens v3.7.2 was scanned for exposed API keys, passwords, private keys, tokens, webhooks, and `.env` files. No exposed secrets were found. See `SECURITY_AUDIT.md` for details.

## 3.7.1 audit fix
This build repairs a fixed-layer CSS regression from the modern UI refresh. Quick Add, toast notifications, mobile action dock, bottom tabs, and skip link now retain fixed positioning.

## Visual refresh
GigLens 3.7.0 includes a presentation refresh aimed at a more modern, premium iPhone-style look while keeping the simplified, screenshot-first workflow intact.

## Product overview

GigLens is a local-first Progressive Web App for gig delivery drivers. It tracks daily earnings, mileage, estimated profit, tax mileage deduction, platform performance, zone performance, shift pace, screenshot OCR-assisted entry, and accept/decline order decisions.

## Current release

Version: `4.0.0`, built on the v3.9.0 app-specific OCR and paused-shift release.

This release preserves the static PWA architecture. There is no backend, database server, framework, build step, or account system. The app runs from plain static files and stores user data locally in the browser.

## Included features

- Premium Today Command Center with dedicated Pace, Efficiency, Tax, Performance, and Last Delivery Impact cards.
- Centralized Profit Engine used across dashboard, calculator, history, recaps, and exports for consistent vehicle cost, profit, hourly, $/mile, tax, projection, ETA, and driver score math.
- **Fast Quick Add bottom sheet from Today** so drivers can add a delivery without switching tabs.
- Quick Add fields for company, earnings, miles, minutes, zone, and optional collapsible notes.
- Quick Add validation for valid company, earnings greater than 0, miles 0 or greater, and minutes 0 or greater.
- Quick Add smart defaults using the last saved company/zone, falling back to Settings defaults.
- Quick Add **Save** and **Save + Add Another** actions with immediate dashboard updates and toast confirmation.
- Main hero card with gross earnings, estimated profit, daily goal percentage, progress bar, shift status, real Start/End Day actions, and a real Pause/Resume break control.
- Pace card with gross/hour, profit/hour, projected today total, goal ETA, and a live pace recommendation.
- Efficiency card with gross $/mile, profit $/mile, business miles, average delivery value, and order-quality coaching.
- Tax card with mileage deduction estimate, mileage deduction rate, tracked business miles, estimated vehicle cost, and delivery count.
- Performance card with driver score, best company today, best zone today, time working, and simple recommendation text.
- Profit Mode using editable gas price, MPG, maintenance cost per mile, and mileage deduction rate.
- Accept Calculator v2 that recommends **ACCEPT**, **BORDERLINE**, or **DECLINE** using user-defined minimum payout, $/mile, $/hour, max-mile, gas, MPG, and maintenance rules.
- Accept Calculator v2 shows gross $/mile, gross hourly pace, estimated profit, profit $/mile, profit hourly pace, and pass/fail threshold rows.
- Accept Calculator supports Calculate Only, Save as Completed, Clear, Copy Decision, zone capture, and optional note capture.
- Screenshot OCR review-first workflow with strict app-specific and visual supporting evidence for DoorDash, Uber Eats, Grubhub, Instacart, Amazon Flex, Spark, Roadie, and supported catering services; weak or conflicting evidence stays editable instead of guessing.
- OCR merchant parsing distinguishes restaurants, grocery/retail/pharmacy stores, and unknown merchants; the review card, history, backups, and normalized delivery records retain the merchant type.
- Existing Add tab manual delivery entry with optional minutes, zone, notes, and **Save + Add Another** support.
- Delivery edit, duplicate, delete, and undo-delete support.
- Grouped History by day with daily totals, estimated profit, total miles, average $/mile, gross/hour where available, tracked time, per-delivery profit details, minutes, zone, source labels, edit, duplicate, delete, and undo-delete actions.
- Company and zone performance breakdowns on Today with earnings, profit, miles, delivery count, gross $/mile, profit $/mile, gross/hour, and profit/hour.
- Dedicated Analytics tab with platform performance, zone performance, best/worst labels, hourly earnings insights, and plain CSS performance bars.
- Local driver coaching with a Daily Recap card, copyable recap text, best/weakest delivery analysis, platform/zone suggestions, and saved end-shift recap history.
- Tax & Export Center with standard CSV, tax CSV, daily summary CSV, JSON backup, validated backup import preview, merge/replace import modes, duplicate-ID merge safety, and emergency rollback restore.
- Local-first storage using browser `localStorage` under `giglens.*` keys, with non-destructive migration from legacy `driveledger.*` keys.
- Phase 13 mobile polish with a sticky one-hand action dock on iPhone-sized screens.
- Phase 14 installable PWA polish with stronger manifest metadata, cache-versioned offline app shell, offline status messaging, and install/deploy QA guidance.
- Smart Goal System in Settings that recommends a daily goal from local historical average earnings, profit, and hours by day of week, with Apply or Keep Current Goal actions.
- Best Time to Drive insights in Analytics that group saved deliveries by hour, show today’s strongest windows, historical best hours, weak hours, average gross/hour, average profit/hour, and mobile-friendly CSS bars.
- Manual GPS-free Zone Heatmap in Analytics with Best Zone, Reliable Zone, Weak Zone, and Avoid Zone cards calculated from saved delivery zones.
- Custom zone manager in Settings for adding, renaming, and deleting manual zones without corrupting older saved delivery zone labels.
- Privacy and Data Control Center in Settings explaining local-only storage, showing localStorage usage, exporting/importing data, resetting settings or deliveries, clearing all active local data with double confirmation, and restoring the latest safety backup/import rollback.
- Netlify release package with `_redirects`, `DEPLOYMENT.md`, root-file verification, static-hosting checklist, install instructions, and troubleshooting guidance.
- Subtle visible app credit: **Designed by Tech Phactory Solutions** in the app header/footer and fallback page.
- GitHub Pages release support with `.nojekyll`, `404.html`, root-file checks, and GitHub deployment troubleshooting guidance.
- Simplified luxury Today layout: advanced insight cards, recap details, breakdowns, export tools, zones, and privacy controls are tucked behind clean disclosure panels instead of crowding the first view.
- OCR restaurant/store detection: screenshot review now uses expanded local merchant parsing for chain and local restaurants, pickup labels, standalone pickup blocks, go-to/head-to text, and merchant names mixed with addresses. The detected name is editable, saved with OCR deliveries, displayed in History, and included in standard CSV exports.
- Accessibility improvements including a skip link, stronger focus states, dialog semantics, aria labels, and reduced-motion support.
- Improved empty states, larger mobile form controls, numeric keyboards for minute fields, and safer mobile spacing around iOS safe areas.





## 3.6.4 Subtle design credit repair notes

This release adds visible app branding and improves GitHub Pages deploy readiness after a failed Pages deployment. GigLens now includes a small premium credit line that says **Designed by Tech Phactory Solutions**, plus GitHub Pages support files: `.nojekyll` to disable Jekyll processing and `404.html` as a static fallback. Runtime files still use relative paths so the app can run from a project URL such as `https://techphactorysolutions.github.io/Driver-Ledger/`.

GitHub Pages quick deploy:

1. Unzip the release package.
2. Upload the **contents** of the unzipped folder to the repository root, not the ZIP file itself and not a nested parent folder.
3. Confirm `index.html`, `styles.css`, `app.js`, `manifest.json`, `service-worker.js`, `.nojekyll`, and `icons/` are visible at the repo root.
4. In GitHub, open **Settings → Pages**.
5. Set Source to **Deploy from a branch**, branch `main`, folder `/root`, then save.
6. Open **Actions** or the red deployment entry if it fails and read the build log. Common causes are `index.html` being inside a subfolder, uploading only the ZIP, or Pages pointing to the wrong branch/folder.

## 3.6.2 Screenshot-First Quick Add notes

Quick Add is now screenshot-first because the fastest real workflow is: upload an order screenshot, let GigLens detect company/restaurant/pay/miles/minutes, review the fields, and save. Manual quick entry still exists inside the same sheet as the fallback.

Changes:

- Quick Add primary action now opens a screenshot-first bottom sheet.
- Added screenshot upload directly inside Quick Add.
- Quick OCR fills company, restaurant/store, earnings, miles, and minutes.
- Quick saves from scanned screenshots persist as `source: "ocr"` with OCR text/confidence metadata.
- Manual entry remains available under “Review detected details or type manually.”

## 3.6.1 OCR Merchant Detection Repair notes

This repair targets restaurant/store recognition after screenshot testing showed the first restaurant detector was still too brittle. The OCR parser now handles more real-world screenshot patterns, including standalone pickup labels followed by a merchant name, `Go to` / `Head to` / `Arrive at` phrasing, explicit `Restaurant:` / `Store:` labels, local restaurant names, and merchant lines that include a trailing street address. It also applies stronger rejection filters so platform text, payout text, addresses, item counts, and drop-off/customer labels are less likely to be mistaken for the restaurant. The result is still editable in the OCR review card because screenshot OCR remains heuristic.

## Phase 21 Luxury Simplification + OCR Restaurant Detection notes

This refinement responds to real app testing feedback that the app had become too cluttered. The Today screen now keeps the premium hero, Quick Add, and last-delivery feedback upfront while moving advanced insights behind a clean disclosure. Secondary tools, export controls, zones, and privacy controls are still available, but they no longer dominate the first view. Screenshot OCR now includes a local heuristic restaurant/store detector with common restaurant pattern matching and pickup/merchant-line detection. The detected restaurant is editable before saving and stored locally with the delivery.

## Phase 20 Netlify Release Package notes

Phase 20 prepares GigLens for simple Netlify Drop deployment. The package keeps all runtime files at the root or correctly referenced from the root, adds a Netlify `_redirects` static fallback, adds `DEPLOYMENT.md`, documents Netlify Drop deployment, iPhone/iPad installation, offline reload, localStorage persistence, and troubleshooting. No backend, build step, framework, localhost-only runtime path, environment variable, or cloud database was added.

### Netlify Drop quick deploy

1. Download and unzip the release ZIP.
2. Confirm `index.html` is at the root of the unzipped folder.
3. Drag the unzipped folder into Netlify Drop.
4. Open the generated HTTPS URL.
5. Add a test delivery, reload, and confirm it persists.
6. Open the site in Safari and use **Add to Home Screen** for iPhone/iPad installation.

For the full deployment checklist, see `DEPLOYMENT.md`.

## Phase 19 Privacy and Data Control Center notes

Phase 19 adds a clear local privacy and data control center in Settings. It explains that GigLens data stays in browser `localStorage`, estimates local GigLens storage usage, exposes Export All Data and Import Backup entry points, adds double-confirmed Reset Settings Only, Reset Deliveries Only, and Clear All Local Data actions, and provides emergency restore from the latest backup/export/import rollback snapshot available on the device. No account system, backend, cloud sync, GPS upload, analytics service, or dark-pattern destructive flow was added.

## Phase 18 Manual Zone Heatmap notes

Phase 18 adds a GPS-free zone system. Users can define custom zones in Settings, use zone autocomplete while adding deliveries, and compare zones in a map-style Analytics card with Best Zone, Reliable Zone, Weak Zone, and Avoid Zone roles. The feature uses saved local delivery zone labels only; it does not request GPS permissions. Renaming a custom zone can optionally update matching saved deliveries, while deleting a custom zone never deletes or corrupts existing delivery records.

## Phase 17 Best Time to Drive notes

Phase 17 adds local-only Best Time to Drive insights in the Analytics tab. GigLens groups saved deliveries by hour of day, calculates average gross/hour and estimated profit/hour for each bucket, highlights today’s best hours, shows historical best hours when at least two completed past driving days exist, and surfaces weak hours that may need caution. No external chart library, backend, AI API, or fake data is used.

## Phase 16 Smart Goal notes

Phase 16 adds a local-only Smart Goal System. The recommendation excludes today’s partial deliveries, calculates historical average earnings, estimated profit, and hours by day of week, then suggests a daily goal using the current weekday when enough matching history exists. If the current weekday does not have enough history, GigLens falls back to broader saved driving days. If there is not enough history, the app shows a helpful empty state and disables Apply Suggested Goal.

## v3 Release Candidate notes

This release candidate completed the final audit and bug bash after Phase 14. No backend, framework, build step, cloud database, or account system was added. The app remains a plain static PWA that can be deployed to Netlify or another HTTPS static host.

Final release audit coverage included:

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
static asset references
corrupted localStorage handling
visible button wiring
unsafe NaN / Infinity / undefined / null UI output checks
```

### Known limitations

- GigLens stores data in browser `localStorage`; users should export JSON backups regularly.
- Screenshot OCR depends on the remote Tesseract.js CDN if the library has not already loaded.
- OCR is still heuristic: cropped, blurry, stylized, or newly redesigned app screenshots may need a manual Company or merchant correction in the review card.
- Smoke tests use a mocked browser environment, not real iPhone/iPad Safari automation.
- Profit, tax deduction, vehicle cost, and coaching values are estimates based on user-maintained Settings.
- Service-worker updates can require one reload cycle before the newest cached shell is active.
- The app does not provide tax, legal, accounting, or financial advice.

### Manual QA checklist

1. Deploy the unzipped folder to Netlify over HTTPS.
2. Open the app in iPhone Safari.
3. Add to Home Screen and launch from the icon.
4. Start a shift.
5. Add a delivery with Quick Add.
6. Add a delivery with the full Add form.
7. Scan or simulate OCR review and confirm it does not autosave.
8. Use the Accept Calculator and save an accepted offer.
9. Edit, duplicate, delete, and undo-delete a delivery.
10. Check Today, History, Analytics, and Daily Recap totals.
11. Export Standard CSV, Tax CSV, Daily Summary CSV, and JSON Backup.
12. Import a backup with Merge, then test Replace and Restore Rollback in a test browser.
13. Save Settings, reload, and confirm values persist.
14. Turn on Airplane Mode after one online load and confirm the cached app shell opens.
15. Repeat layout checks on iPad Safari.
16. Scan a DoorDash screenshot containing generic words such as `trip` and confirm it remains DoorDash when its brand/header is present.
17. Scan an ambiguous or mixed-brand screenshot and confirm Company stays `Other` for review instead of guessing.
18. Scan a grocery or retail screenshot such as Instacart/Schnucks, Spark/Walmart, or Roadie/Best Buy and confirm the review card says `Store`.
19. Start a shift, pause for a break, confirm the status changes to `On break`, then resume and confirm the active-hours clock excludes the break.
20. End a shift while paused, reload, and confirm the saved recap/history persists without counting the final break as active time.

## Phase 14 PWA Install, Offline, and Release Polish notes

Phase 14 focuses on making GigLens a more polished installable PWA while keeping the app static, local-first, and framework-free.

PWA changes include:

```text
install-ready manifest metadata
GigLens Driver Command Center long app name
GigLens short app name
standalone display mode
finance/productivity/utilities categories
verified 192px and 512px icons
maskable icon purpose
cache-versioned service worker
core app-shell caching
network-first navigation with cached offline fallback
stale-while-revalidate static asset refresh
offline banner inside the app
OCR-unavailable messaging when Tesseract has not loaded
```

Core tracking, quick add, history, analytics, exports, backup/restore, and local coaching continue to work after the PWA shell has been cached. Screenshot OCR still depends on the remote Tesseract.js CDN if the library has not already loaded in the browser.

### iPhone Safari install checklist

1. Deploy the folder to an HTTPS host such as Netlify Drop.
2. Open the hosted site in Safari.
3. Tap **Share**.
4. Tap **Add to Home Screen**.
5. Open GigLens from the Home Screen icon.
6. Add a test delivery and reload to confirm localStorage persistence.
7. Turn on Airplane Mode and reopen the app to confirm the cached shell loads.

### iPad Safari install checklist

1. Open the hosted HTTPS URL in Safari.
2. Use **Share → Add to Home Screen**.
3. Confirm the layout works in portrait and landscape.
4. Confirm the mobile action dock and bottom tabs do not overlap content.
5. Add, edit, export, and reload test data.

### Netlify static deploy checklist

1. Unzip the release.
2. Drag the unzipped folder contents to Netlify Drop.
3. Confirm these files are at the deployed root: `index.html`, `styles.css`, `app.js`, `manifest.json`, `service-worker.js`, and `icons/`.
4. Open the Netlify URL over HTTPS.
5. Check browser dev tools Application/Manifest when available.
6. Reload once to let the service worker cache the app shell.

### Offline reload checklist

1. Load the app once while online.
2. Reload once after the service worker installs.
3. Disable the network or use Airplane Mode.
4. Reopen/reload the app.
5. Confirm the app shell, Today, History, Analytics, Settings, and local saved data load.
6. Confirm Screenshot OCR explains that internet may be needed if the OCR library has not loaded.

### localStorage persistence checklist

1. Add a manual delivery.
2. Add a Quick Add delivery.
3. Export a JSON backup.
4. Reload the app.
5. Confirm deliveries, settings, and shift data remain.
6. Clear only test data when finished.

## Phase 13 Mobile Polish and One-Hand UX notes

Phase 13 focuses on making GigLens feel more like a premium iPhone PWA without adding a framework, backend, or heavy library. The data model and business logic from previous phases remain intact.

Mobile UX improvements include:

```text
sticky one-hand action dock
large Quick Add / Scan / Decide actions
safer iPhone safe-area spacing
sticky topbar on mobile
larger mobile form controls
numeric keyboards for minute fields
collapsible Today breakdowns to reduce clutter
stronger empty states
clear dialog semantics for Quick Add
accessible skip link
aria labels for primary navigation/actions
reduced-motion support
loading/success/error state styling
```

The sticky mobile action dock is visible on small screens and uses the same existing Quick Add, Scan Screenshot, and Accept Calculator logic. No duplicate fake feature path was added.

## Phase 12 Driver Coaching and Daily Recaps notes

Phase 12 makes GigLens feel more intelligent without using any AI APIs. Recaps are generated locally from saved delivery data, current Settings, and the centralized Profit Engine.

The Today screen now includes a **Daily Recap** coaching card with:

```text
gross earnings
estimated profit
hours worked
miles
deliveries
gross/hour
profit/hour
gross $/mile
profit $/mile
best company
best zone
best delivery
weakest delivery
local recommendation text
```

The **Copy Recap** button copies a plain-text summary suitable for notes, texts, or bookkeeping. Ending a shift now saves the generated recap into `shift.shiftHistory` with summary text, recommendation text, and recap metrics. No cloud service or model API is used.

## Phase 11 Backup, Restore, and Data Safety notes

Phase 11 makes local-first backup import safer. Selecting a backup no longer immediately replaces data. GigLens now parses and validates the JSON first, then shows a preview with:

```text
delivery count
settings included / not included
shift included / not included
exported date
```

Import modes:

```text
Merge deliveries with current data: keeps current settings/shift, adds new deliveries, and skips duplicate delivery IDs.
Replace current local data: stores an emergency rollback first, then replaces deliveries and uses backup settings/shift when included.
```

Malformed JSON or invalid backup shapes are rejected without changing localStorage. Restore Import Rollback validates the rollback copy before applying it.


## Phase 10 Tax and Export Center notes

Phase 10 upgrades the History export buttons into a dedicated **Tax & Export Center**. The app remains a static local-first PWA; exports are generated entirely from saved browser data and do not require a backend.

Export types:

```text
Standard CSV: date, company, earnings, miles, minutes, zone, note, source
Tax CSV: date, company, gross earnings, business miles, mileage deduction rate, estimated deduction, fuel estimate, maintenance estimate, estimated profit
Daily Summary CSV: date, total earnings, estimated profit, miles, deliveries, average $/mile, gross/hour, profit/hour
JSON Backup: deliveries, settings, shift, app data version, exportedAt
```

CSV cells are quoted and escaped so commas, quotes, and multiline notes remain valid. Empty ledgers export header-only CSV files instead of failing. JSON backup includes `appDataVersion` and schema metadata for safer future imports.

Tax, deduction, fuel, maintenance, and profit numbers are estimates based on the user's Settings and are not tax advice.


## Phase 9 Platform and Zone Analytics notes

Phase 9 adds a dedicated Analytics tab and upgrades the Today breakdown cards. All analytics are calculated from local saved deliveries; no fake sample data, backend, or chart library was added.

Analytics now include:

```text
company/platform earnings
estimated profit
delivery count
total miles
average gross $/mile
average profit $/mile
average gross/hour
average profit/hour
zone performance using the same metrics
best/worst company today
best/worst zone today
best hour today
best saved hour from recent local data
```

Ranking uses estimated profit per mile first, then profit/hour, total profit, total earnings, and a stable alphabetical tie-break. One-company or one-zone days show a helpful `Need 2+` label instead of pretending there is a meaningful worst performer.

Hourly insights are grouped by the local hour of each saved delivery. The visual bars are plain HTML/CSS and are based on real saved delivery totals.


## Phase 8 History, Editing, Undo, and Daily Groups notes

Phase 8 upgrades History into a more complete bookkeeping surface. Deliveries are grouped by local day, and each day group now includes total earnings, estimated profit, total miles, delivery count, average gross $/mile, gross/hour when minutes are available, and tracked time.

Each delivery card now shows:

```text
company/platform
payout
miles
minutes
zone
estimated profit
gross $/mile
source label: Manual, OCR, Calculator, or Import
```

History actions remain local-first and immediately update the Today dashboard, History, and analytics surfaces:

```text
Edit
Duplicate
Delete
Undo delete
```

Editing preserves the delivery ID and original created timestamp while updating `updatedAt`. Duplicating creates a new delivery ID and current timestamp. Deleting removes the item from localStorage and exposes an undo action in the toast.


## Phase 7 Centralized Profit Engine notes

Phase 7 consolidates GigLens's profit and efficiency math into a single `ProfitEngine` section in `app.js`. The UI still uses plain HTML, CSS, and JavaScript, but repeated formulas are now routed through reusable calculation helpers.

Centralized helpers cover:

```text
fuel cost per mile
maintenance cost
vehicle cost per mile
estimated delivery profit
estimated profit per mile
gross dollar per mile
gross hourly rate
profit hourly rate
mileage deduction
projected daily earnings
goal ETA
driver score
row/day summaries
```

The Today Command Center, Accept Calculator, manual/quick/OCR previews, history rows, shift recap, and CSV exports now use the same calculation layer. This reduces drift between screens and prevents unsafe output such as `NaN`, `Infinity`, `undefined`, or `null`.

Phase 7 also hardened numeric setting migration so malformed values such as `"NaN"` fall back to defaults instead of becoming `0`. Valid zero values remain allowed where the setting intentionally supports zero.

## Phase 6 Accept / Decline Calculator v2 notes

The Decide tab is now a transparent order decision assistant. It uses the user's local settings for minimum payout, minimum gross $/mile, minimum gross $/hour, maximum distance, gas price, MPG, and maintenance cost per mile.

Inputs:

```text
Company/platform
Offer payout
Miles
Estimated minutes
Zone
Optional note
```

Outputs:

```text
ACCEPT, BORDERLINE, or DECLINE
Gross $/mile
Gross hourly pace
Estimated profit after vehicle costs
Profit $/mile
Profit hourly pace
Pass/fail rule rows for each active threshold
```

Actions:

```text
Calculate Only
Save as Completed
Clear
Copy Decision
```

Saving an offer writes a normalized delivery with `source: "calculator"`, selected company, zone, minutes, optional note, and a decision tag. Invalid offers with missing/zero pay, miles, or minutes are rejected without saving. The calculator intentionally avoids `NaN`, `Infinity`, `undefined`, and `null` output.

Phase 6 also fixed a default-settings normalization issue where missing numeric settings with a zero minimum could be normalized to `0` instead of using the intended defaults.

## Phase 5 OCR review notes

Screenshot scanning is now a review-first workflow. OCR never silently saves a delivery. After a screenshot is selected, GigLens shows a processing state and then an editable review card.

The OCR review card includes:

```text
Detected company
Detected earnings
Detected miles
Detected minutes when present
Confidence percentage
Confidence label: High confidence, Medium confidence, or Needs review
Editable company, earnings, miles, and minutes fields
Raw OCR text in an expandable details panel
Save Reviewed
Use in Form
Cancel
Clear Scan
```

If the OCR library is unavailable or Tesseract fails, the app shows a failed scan message and leaves manual entry, Quick Add, and the Accept Calculator usable. Low-confidence scans are labeled clearly and are not saved unless the user corrects the fields and explicitly taps **Save Reviewed**.

## Phase 4 quick-add notes

The Today screen now has a prominent **Quick Add** button that opens a one-hand bottom sheet instead of sending the user to the Add tab. The sheet keeps the command center in context and is optimized for fast delivery entry between orders.

Quick Add supports:

```text
Company
Earnings
Miles
Minutes
Zone
Optional notes
Save
Save + Add Another
Cancel
```

The quick-add flow writes the same normalized delivery records as the full Add tab. A zero-mile value is allowed for quick add when the driver does not yet know mileage, but a blank mileage field is still rejected so accidental saves are avoided.

## Phase 3 command center notes

The Today screen uses real local delivery, shift, and settings data to answer:

```text
How much did I earn today?
What is my estimated profit?
Am I ahead or behind goal?
What is my gross hourly pace?
What is my profit hourly pace?
What is my gross and profit $/mile?
How many business miles and deliveries did I track?
Which company is strongest today?
Which zone is strongest today?
When will I hit my goal at the current pace?
What is my driver score?
```

The command cards intentionally avoid fake charts or fake data. Empty states stay descriptive until real deliveries are saved. All displayed values are guarded against `NaN`, `Infinity`, `undefined`, and `null` in normal startup and smoke-tested flows.

## Phase 2 storage upgrade notes

Delivery records are normalized on app startup and when saved/imported. The current delivery schema includes:

```text
id
date
createdAt
updatedAt
company
earnings
miles
minutes
zone
note
notes
source: manual, ocr, calculator, import
ocrText
ocrConfidence
tags
deleted
version
```

Settings are also normalized and include clearer long-form keys while preserving older aliases used by existing UI code:

```text
dailyGoal
defaultCompany
defaultZone
gasPrice
vehicleMpg / mpg
maintenanceCostPerMile / maintenancePerMile
mileageDeductionRate / taxMileageRate
minimumDollarPerMile / minPerMile
minimumDollarPerHour / minPerHour
minimumPayout / minPayout
maxMiles
theme
appDataVersion
```

Shift data includes:

```text
active
startedAt
endedAt
lastSummary
shiftHistory
appDataVersion
```

On startup, GigLens normalizes and re-saves the local state. This gives older saved data the new fields without requiring a backend migration. Corrupted JSON or impossible values are safely defaulted or discarded instead of crashing the app.

## Local data keys

GigLens currently writes these localStorage keys:

- `giglens.deliveries.v1`
- `giglens.decisions.v1`
- `giglens.settings.v1`
- `giglens.shift.v1`
- `giglens.rollback.v1`
- `giglens.lastBackup.v1`

On the first v4 launch, matching legacy `driveledger.*` values are copied into these names only when no GigLens value exists. The legacy values are not deleted automatically.

## Run locally

Because this is a static PWA, no backend server is required. Open `index.html` directly for simple testing, or serve the folder with any static server:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`. Localhost is only used for optional local testing; runtime files do not depend on localhost-only paths.

## Deploy to Netlify Drop

1. Download and unzip the release ZIP.
2. Confirm `index.html`, `app.js`, `styles.css`, `manifest.json`, `service-worker.js`, `_redirects`, and `icons/` are at the root of the unzipped folder.
3. Drag the unzipped folder into Netlify Drop.
4. Open the generated HTTPS URL.
5. Add one test delivery, reload, and confirm it persists.

See `DEPLOYMENT.md` for the full deployment, install, offline, and troubleshooting checklist.

## Install on iPhone/iPad

1. Host the folder with HTTPS, such as Netlify Drop.
2. Open the hosted site in Safari.
3. Tap Share.
4. Tap **Add to Home Screen**.
5. Launch GigLens from the Home Screen icon.
6. Add a test delivery, reload/reopen, and confirm it persists.

## Tests

The ZIP includes a no-dependency smoke test suite. It checks static package structure, manifest/icon paths, JavaScript syntax, UI wiring, local storage namespacing, startup behavior in a mocked browser, manual delivery save, quick-add open/save/invalid-save behavior, save-and-add-another, calculator zone/source persistence, OCR review parsing/save/failure behavior, accept-calculator behavior, shift persistence, shift history persistence, local schema migration, service-worker cached asset references, PWA manifest metadata, offline banner behavior, Clipboard API fallback behavior, command center rendering safety, Netlify `_redirects`, deployment docs, and no localhost-only runtime path checks.

```bash
python -m unittest discover -s tests -v
```

Optional Node scripts:

```bash
npm run syntax
npm run smoke
```

## Architecture notes

- There is no FastAPI/backend layer in this ZIP.
- Data is stored locally in browser `localStorage`.
- Screenshot OCR uses Tesseract.js from jsDelivr on first load. If the CDN is unavailable or OCR fails, the app shows a failed scan state and falls back to manual entry.
- Tax and expense numbers are estimates. The mileage rate, gas price, MPG, and maintenance cost are editable in Settings.
- The smoke test is a mocked browser test, not a substitute for manual iPhone/iPad Safari testing.


## 3.6.4 subtle design credit update

- Updated visible in-app credit to: **Designed by Tech Phactory Solutions**.
- Kept the credit intentionally subtle in the header and footer so it does not clutter the driver workflow.
- Verified package version `3.6.4`, service-worker cache `driveledger-v29-subtle-tech-phactory-credit`, and static tests.
