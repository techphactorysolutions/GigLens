# DriveLedger Platform Detection Audit

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
