# GigLens 4.2.0 Public Exposure Audit

## Result

The release contains no detected API keys, passwords, private keys, bearer tokens, GitHub tokens, payment secrets, webhooks, `.env` files, backend endpoints, analytics trackers, or account credentials.

GigLens is safe to publish as a static GitHub Pages repository from a secrets-exposure standpoint.

The 4.2 audit also removed redundant icon copies and dead rendered mobile-dock markup, re-ran the public-secret scan across runtime/package documents, and preserved the existing CSP, SRI-pinned OCR loader, no-referrer policy, same-origin cache boundary, escaped dynamic text, and normalized import path. No code audit can guarantee that a future malicious commit or compromised GitHub account cannot alter a public static site; repository access controls remain part of the security boundary.

## Runtime network use

The screenshot scanner loads pinned browser-side OCR components from these public locations when the user starts a scan:

- `https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/`
- `https://cdn.jsdelivr.net/npm/tesseract.js-core@v5.0.0/`
- `https://tessdata.projectnaptha.com/4.0.0/`

The main Tesseract.js loader uses a fixed version and SHA-384 Subresource Integrity value. No private credential is attached to these requests. Normal app startup, manual tracking, history, analytics, and exports do not depend on the OCR download.

## Local data boundary

- Deliveries, settings, shifts, decision records, backups, and scanner corrections are stored in browser `localStorage` under `giglens.*` keys.
- Uploaded screenshot pixels are not stored in the scanner-learning profile.
- OCR text can be retained with a saved scanned delivery and included in a user-created JSON backup.
- Visitors to the public GitHub Pages URL cannot see another user's browser-local records.
- Someone with access to the unlocked device or browser profile may be able to view local GigLens data.

## Browser protections

- The main page includes a restrictive Content Security Policy and no-referrer policy.
- The OCR loader and worker sources are limited to the documented pinned hosts.
- Dynamic HTML that contains saved user text is escaped before rendering.
- Imported records are normalized and bounded before use.
- Service-worker caching is restricted to same-origin app assets.

## Operational guidance

- Keep GitHub two-factor authentication enabled.
- Protect the publishing branch and review dependency or workflow changes.
- Never place private API keys in `app.js`, `index.html`, repository settings files, or any other public static asset.
- Remove names, addresses, and order details before sharing screenshots in public issues.
- Export JSON backups regularly because browser data can be cleared locally.
