# GigLens 4.6.0 Safari repair notes

This branch implements the repository audit for iPhone and iPad Safari. It does not deploy or merge the website.

| Audit finding | Repair | Files |
| --- | --- | --- |
| Missing install assets and broken test paths | Restore canonical icon paths and executable test/tool folders; remove obsolete duplicate icons and Netlify files. | `icons/`, `tests/`, `tools/`, `package.json` |
| Failed storage writes still clear drafts | One atomic versioned envelope covers deliveries, decisions, settings, shifts, OCR learning and staged recovery snapshots. Only successful writes clear forms or report success. | `app.js`: `persistNormalizedState`, `mutate` |
| Corrupt data silently overwritten | Startup is read-only; preserve raw legacy/canonical data, block destructive writes, and export original contents for recovery. | `app.js`: `readCanonical`, `exportRecoveryData`, `refreshForExport`; `index.html`: storage banner, recovery export |
| Competing tabs lose deliveries | Exclusive Web Locks with reread inside the lock; revision checks; storage/pageshow refresh; reject stale record edits. Browsers without safe locking are read-only with exports available. | `app.js`: `mutate`, `refreshStoredState`, `saveDelivery` |
| Old OCR fields saved under a new screenshot | Clear previous scan values and provenance; disable and guard pending saves; preserve edits made during recognition; reset file inputs to permit same-file retry. | `app.js`: scan functions, `preserveEditedFields`, save handlers |
| Scanner cancellation leaves workers consuming memory | Shared worker queue, prompt cancellation/termination, late-initialization cleanup and a barrier before another worker can start. A worker that fails to terminate blocks additional OCR until reload; manual entry remains available. | `app.js`: `runScreenshotScan`, `recognizeScreenshot`, `cancelScan` |
| Image decode/color analysis unbounded | Validate PNG/JPEG headers and cap source pixels before decoding. Resize prepared images, bound decode/analysis/OCR times, release canvas/bitmap/object URLs. | `app.js`: `screenshotDimensions`, `prepareScreenshot`, `analyzeScreenshotAccent` |
| OCR/offline messaging overpromises | Network-dependent OCR is explicit; no placeholder earnings are saved. Manual entry and review stay available. OCR engine/language binaries are not bundled for offline use. | `index.html`, `app.js`: status messages |
| Canceled or failed share says export succeeded | Explicit shared/canceled/download-started/failed outcomes. Share failure offers a fresh-gesture download link, kept until replaced/dismissed. | `app.js`: `shareOrDownload`, `prepareDownload`; `index.html`: export panel |
| CSV encoding and timestamps ambiguous | BOM for all CSV exports, CRLF/quoted escaping, formula-safe text, explicit local date and original timestamp columns in delivery CSV. | `app.js`: CSV builders |
| Focus zoom, clipped keyboard sheet, notch spacing | 16px fields, visual viewport sizing, dynamic viewport fallback, safe-area spacing on both sides, scrollable sheet. | `styles.css`, `app.js`: `updateSheetViewport` |
| Touch/dialog controls inaccessible | Visible file picker buttons, modal background inert, focus trap, opener restoration, 44px undo action, compact calendar labels. | `index.html`, `styles.css`, `app.js`: sheet and event bindings |
| CSP prevents charts from sizing | Render validated widths with CSSOM instead of injected inline styles; replace undefined chart accent variable. | `app.js`: `updateChartWidths`; `styles.css` |
| PWA mixes releases, reloads drafts, or treats quota as network failure | Precache complete shell; serve one release from its own scoped cache; explicit update acceptance; block activation with other open windows; bounded network fallback; return successful network responses independently of cache storage. | `service-worker.js`, `app.js`: `registerServiceWorker` |

## Storage and recovery contract

- `giglens.state.v2` is authoritative after the first successful user mutation. Legacy GigLens/DriveLedger keys remain untouched as recovery sources. No automatic write happens at startup.
- Every app mutation uses the same origin-wide Web Lock. LocalStorage's single-key replacement is the commit boundary. Destructive operations stage a snapshot inside that same write; insufficient quota cancels the entire operation.
- A JSON export does not consume more localStorage space. A raw recovery export preserves damaged text but is not a normal importable ledger backup; repair it outside the app before importing valid data.
- Close old-version tabs before migrating. Older releases do not read the envelope. Export a backup before downgrading. Local data can still be removed by the user/browser; keep external backups.

## Validation

- `npm run syntax`: syntax checks for the app, service worker and 404 handler.
- `npm test`: 45 static, packaging and executable mock-browser regressions, including the existing parser, history, shift, calendar, analytics, import/export and privacy workflows.
- `npm run safari`: executable tests for quota failures, corrupt/blocked storage, atomic compound writes, concurrent tabs, stale edits, recovery snapshots, share cancellation/fallback, CSV encoding, serialized/canceled workers, retry, image pixel limits, and service-worker release/update behavior.
- `npm run browser`: Playwright WebKit at six iPhone/iPad viewport sizes, real PNG preparation with stubbed OCR results, touch saves, input sizes, sheet layout/focus, scan edits/cancellation, CSP chart sizing, installed offline reload and waiting update behavior. OpenSSL is used to create a temporary local HTTPS certificate. The browser context trusts that test certificate; the app's CSP is unchanged.

## Physical-device acceptance checks

Playwright WebKit is not a physical iPhone/iPad Safari session. Before production release, check the software keyboard and landscape safe areas on real devices; Photos/Files picker cancel and HEIC-to-JPEG behavior; native Share/Save to Files; Home Screen installation and relaunch offline; VoiceOver/external-keyboard focus; actual Tesseract CDN/language downloads and recognition using representative screenshots. The automated scanner cases stub OCR output to test the application's lifecycle and review behavior deterministically.

Supported upload limits: PNG/JPEG, up to 20 MB compressed, up to 16 million source pixels and 16000 pixels on either source side. Processing is limited to 4 million pixels and 2560 pixels on the longest side. Unsupported/oversized files show a manual-entry/retry path.

## Recorded results for this branch

On 2026-09-29: syntax passed; all 45 existing tests passed; all four groups in the new Safari regression suite passed; WebKit 26.5 passed all six viewport cases and the offline/update case. The iPhone portrait case includes viewport shrink/restore; all viewport cases include dialog Tab wrapping. Update tests verify that declining a reload preserves an unsaved draft.

The WebKit offline navigation test disconnects the local HTTPS origin. A separate protocol offline toggle verifies the offline banner; Playwright's WebKit protocol can reject navigations before dispatching to the service worker when toggled offline. Real-device airplane-mode/Home Screen behavior remains on the acceptance checklist.
