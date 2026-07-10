# DriveLedger Deployment Guide

DriveLedger is a static, local-first PWA. It does not need a backend, database server, build step, or environment variables. You can deploy it with Netlify Drop by dragging the unzipped project folder into the Netlify Drop upload area.

## GitHub Pages deployment

DriveLedger can run from GitHub Pages as a plain static site. This package includes `.nojekyll` so GitHub Pages does not process the app with Jekyll, and `404.html` as a simple fallback page.

1. Download the latest DriveLedger release ZIP.
2. Unzip it.
3. Upload the **contents** of the unzipped folder to the root of your GitHub repository. Do not upload only the ZIP file. Do not leave the app inside a nested folder.
4. Confirm these files are visible at the repository root:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `manifest.json`
   - `service-worker.js`
   - `.nojekyll`
   - `404.html`
   - `icons/icon-192.png`
   - `icons/icon-512.png`
5. Open **Settings → Pages**.
6. Choose **Deploy from a branch**.
7. Select branch `main` and folder `/root`.
8. Save and wait for the Pages deployment.
9. Open the published URL. For a project repo it will look like `https://YOUR-USERNAME.github.io/REPO-NAME/`.
10. Add a test delivery, reload, and confirm localStorage persistence.

If GitHub says the deployment failed, click the red failed deployment or open the Actions/Pages build log. The most common fixes are: move `index.html` to the repo root, change Pages to `main /root`, commit `.nojekyll`, or unzip the package before uploading.

## Netlify Drop deployment

1. Download the latest DriveLedger release ZIP.
2. Unzip the file on your computer.
3. Confirm these files are at the root of the unzipped folder:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `manifest.json`
   - `service-worker.js`
   - `_redirects`
   - `icons/icon-192.png`
   - `icons/icon-512.png`
4. Open Netlify Drop in your browser.
5. Drag the unzipped DriveLedger folder into the upload area.
6. Wait for Netlify to publish the site.
7. Open the generated HTTPS URL.
8. Add one test delivery, reload, and confirm the delivery persists.

## Why `_redirects` is included

DriveLedger is a single-page static app. The `_redirects` file contains:

```text
/*    /index.html   200
```

This lets Netlify return the app shell for unknown routes while still serving real static assets directly.

## iPhone install checklist

1. Open the Netlify HTTPS URL in Safari.
2. Tap the Share button.
3. Tap **Add to Home Screen**.
4. Confirm the name **DriveLedger**.
5. Launch DriveLedger from the Home Screen icon.
6. Add a test delivery.
7. Close and reopen the Home Screen app.
8. Confirm the delivery persists.

## iPad install checklist

1. Open the Netlify HTTPS URL in iPad Safari.
2. Tap Share.
3. Tap **Add to Home Screen**.
4. Launch from the Home Screen icon.
5. Test Today, Quick Add, Decide, Analytics, History, and Settings.
6. Rotate if needed and confirm the layout remains usable.

## Offline reload checklist

1. Open the deployed app while online.
2. Reload once to allow the service worker to cache the app shell.
3. Add a test delivery.
4. Turn on Airplane Mode.
5. Reopen or reload DriveLedger.
6. Confirm the app shell loads offline.
7. Confirm Today, Quick Add, History, Analytics, Export, and Settings still render.
8. Screenshot OCR may require internet if Tesseract.js has not already loaded.

## Local data persistence checklist

DriveLedger stores data locally in browser `localStorage` under `driveledger.*` keys. Netlify does not store user deliveries.

1. Add a test delivery.
2. Reload the page.
3. Confirm the delivery remains.
4. Export a JSON backup from the Data Control Center.
5. Store the backup somewhere outside Safari/browser storage.
6. Import the backup in a separate test browser/profile to confirm restore works.

## Troubleshooting

### GitHub Pages deployment failed

Open the failed deployment log from the red deployment entry. Check these first:

- `index.html` must be at the repository root.
- GitHub Pages should point to branch `main`, folder `/root`.
- The release ZIP must be unzipped before uploading.
- `.nojekyll` should be present at the root to disable Jekyll processing.
- Runtime files should not be inside a nested folder such as `DriveLedger_v3_6_3/index.html`.


### The app shows an old version

Service workers can keep an older app shell until the next reload cycle. Reload the page once or twice, then close and reopen the installed Home Screen app.

### The app does not open offline

Open the app once while online and reload it after deployment. The service worker must install and cache the core shell before offline reload can work.

### Screenshot OCR fails

OCR uses Tesseract.js from a CDN. If the device is offline, the CDN is blocked, or the library has not loaded yet, OCR may fail safely. Use Quick Add or manual Add as the fallback.

### My data disappeared

The app is local-first. Browser data clearing, Safari website-data removal, private browsing, or switching devices can remove local data. Use **Export All Data** regularly and keep JSON backups outside the browser.

### Netlify deploy shows a blank page

Make sure you uploaded the folder contents with `index.html` at the deployment root. Do not upload a parent folder that contains the app folder one level deeper.

## Release verification commands

These commands are optional but useful before deployment:

```bash
npm run syntax
npm run smoke
python -m unittest discover -s tests -v
```
