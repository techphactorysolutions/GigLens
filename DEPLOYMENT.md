# GigLens GitHub Pages Deployment

GigLens 4.2.0 is a static, local-first PWA. It does not require a backend, database server, API key, password, environment variable, or build command.

## Publish from an iPhone or iPad

1. Extract the GigLens release ZIP in the Files app.
2. Open the GitHub repository in Safari or the GitHub app.
3. Upload the **contents** of the extracted folder to the repository root. `index.html` must be visible at the top level; do not upload only the ZIP and do not leave the files inside another folder.
4. Confirm the repository root contains at least:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `manifest.json`
   - `service-worker.js`
   - `.nojekyll`
   - `404.html`
   - `404.js`
   - `icons/`
5. Commit the files to the `main` branch.
6. Open **Repository Settings → Pages**.
7. Under **Build and deployment**, choose **Deploy from a branch**.
8. Select `main`, choose `/root`, and save.
9. Wait for the Pages deployment to finish, then open the published HTTPS address.

For a project repository, the address normally follows this shape:

```text
https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/
```

All runtime paths are relative, so GigLens works from a GitHub Pages project subdirectory.

## Upgrade an existing GigLens deployment

1. Replace the old repository files with all files from the new release.
2. Keep `index.html`, `app.js`, `styles.css`, `manifest.json`, `service-worker.js`, and the icon files from the same release together.
3. Wait for GitHub Pages to finish deploying the commit.
4. Open the site in Safari and reload it once.
5. Close and reopen the installed Home Screen app.

Updating hosted files does not intentionally erase local GigLens data. The records remain in that browser's site storage, but exporting a JSON backup before every upgrade is still recommended.

## Install on an iPhone

1. Open the published GigLens URL in Safari, not an in-app browser.
2. Tap **Share**.
3. Tap **Add to Home Screen**.
4. Confirm the name **GigLens** and tap **Add**.
5. Launch GigLens from the new Home Screen icon.

iOS caches Home Screen artwork aggressively. If an older shortcut still shows the wrong or blank icon, remove that shortcut, reload the published site in Safari, and add it to the Home Screen again.

## Release verification checklist

- GigLens opens from the GitHub Pages URL without a blank screen.
- The lens icon appears in Safari and on a newly added Home Screen shortcut.
- A manual delivery saves and remains after reload.
- Quick Add accepts an explicit `0` when mileage is not available yet.
- Starting, pausing, resuming, and ending a shift produces break-adjusted active time.
- Tax Settings defaults to Automatic and explains the Jan–Jun / Jul–Dec 2026 rate split.
- History shows older records through the working Show Older History action when more than 30 days exist.
- Screenshot scanning completes, fails with an editable fallback, or times out clearly; it never remains indefinitely in a loading state.
- The first OCR scan is tested while online because the pinned OCR components are loaded on demand.
- History, Analytics, CSV export, JSON backup, import preview, and restore work.
- After the shell has loaded online once, the core app opens in Airplane Mode. OCR may still need internet unless its remote components are already available to the browser.

## Troubleshooting

### GitHub Pages reports a failed deployment

- Confirm `index.html` is at the repository root.
- Confirm Pages is configured for `main` and `/root`.
- Confirm `.nojekyll` is committed.
- Upload extracted files, not only the release ZIP.
- Open the failed Pages deployment under **Actions** for the exact error.

### The app shows an old version

Wait for the current Pages deployment to finish, reload the Safari page, and close/reopen the Home Screen app. GigLens 4.2.0 uses the `giglens-v42-giglens-audit-performance` service-worker cache and deletes older GigLens/DriveLedger caches during activation.

### Screenshot OCR cannot load

Check the internet connection and retry. GigLens loads the pinned OCR library only when scanning begins so a slow third-party script cannot delay normal app startup. Manual entry, tracking, analytics, and exports remain available when OCR is unavailable.

### Local records are missing

GigLens data belongs to the exact site origin and browser profile. Private browsing, clearing Safari website data, changing the GitHub Pages URL, or switching devices can create a separate empty store. Restore a previously exported GigLens JSON backup when needed.

## Optional local verification

```bash
npm run syntax
npm run smoke
npm test
```
