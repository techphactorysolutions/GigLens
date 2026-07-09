# DriveLedger Platform Detection Audit

## v3.9.0 app-specific evidence audit

Build audited: DriveLedger v3.9.0

### Finding

The prior detector treated broad delivery terms as evidence. That allowed text such as `trip`, `gig`, `Walmart`, `catering`, or `offer` to push an OCR screenshot toward Uber Eats, Roadie, Spark, Catering, or DoorDash even when the app itself was not verified.

### Fix

- Direct app/header evidence and distinctive driver-workflow phrases now qualify a platform match.
- Generic delivery terms alone cannot select a company; the editable review card uses `Other` instead.
- When two direct app identities conflict, the app avoids a silent guess and asks for review.
- A direct DoorDash or Uber Eats identity wins over stray competitor workflow text, which is common in OCR noise or copied/stacked content.

### Coverage

Mocked OCR cases verify positive recognition for DoorDash, Uber Eats, Grubhub, Instacart, Spark, Roadie, and supported Catering services; DoorDash/Uber mixed-workflow cases; generic `trip`/`gig` non-guess cases; and a direct-brand conflict that must remain reviewable.

### Limitation

DriveLedger has no remote screenshot classifier. It reads local OCR text, so image-only logos, highly cropped captures, new app layouts, or poor OCR may intentionally fall back to `Other` until the driver reviews the field.

---

Build audited: DriveLedger v3.7.5

## Result

Claude's v3.7.4 package added expanded OCR platform detection, but the package was not fully release-consistent:

- `package.json` was bumped to `3.7.4`.
- release tests still expected `3.7.3`.
- service-worker cache still used `driveledger-v33-claude-package-repair`.

That caused the full Python test suite to fail and could also cause stale cached assets after deployment.

## Fixes applied

- Bumped release to `3.7.5`.
- Updated service-worker cache to `driveledger-v34-platform-detection-audit-fix`.
- Updated release metadata tests.
- Added smoke coverage for expanded OCR platform detection.

## Platform detection smoke coverage

The test suite now checks OCR platform detection for:

- DoorDash
- Uber Eats
- Grubhub
- Instacart
- Spark
- Roadie
- Catering

## Security

Secret-scan coverage remains active. No exposed API keys, passwords, private keys, tokens, or `.env` files were found.
