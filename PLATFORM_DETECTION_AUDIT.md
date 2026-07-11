# GigLens Platform Detection Audit

## v4.2.0 conservative visual evidence and learning isolation

The v4.1.2 scan path retained text fingerprints but no longer passed screenshot-pixel evidence into OCR parsing. Version 4.2 restores lower-screen accent sampling in parallel with both Quick Scan and full scan, with stricter gates than a color-only classifier:

- green may support Uber Eats, red DoorDash, and orange Grubhub only when OCR also contains an offer workflow plus a pay/distance/time signal;
- blue never selects Spark or Amazon Flex by itself and only reinforces one of those apps after distinctive text identifies it;
- a strong app-specific text fingerprint is not overridden by a conflicting accent;
- weak, non-offer, or non-dominant color evidence is ignored;
- all output remains editable and no screenshot is saved automatically.

The local correction engine was also audited. Similar records previously could transfer a corrected platform from generic shared terms. Version 4.2 requires at least one shared platform-distinctive token, while exact reviewed screenshot signatures continue to reuse the driver's saved correction.

Executable cases cover green-assisted weak Uber text, strong DoorDash text versus conflicting green, ambiguous blue remaining `Other`, generic correction non-transfer, and distinctive Uber correction reuse.

## v4.0.0 visual + workflow evidence audit

The supplied screenshots were used as concrete layout references. The lower 55% pixel sampler measured the marked Uber Eats image at `9.92%` qualifying green pixels with no competing qualifying red/orange/blue pixels, and the marked DoorDash image at `9.58%` qualifying red pixels with no competing qualifying green/orange/blue pixels.

GigLens now combines that visual evidence with OCR workflow evidence:

- Uber Eats: green offer accent, `Exclusive`, and the `20 min (3.2 mi) total`-style line.
- DoorDash: red offer accent, `Deliver by`, and `Customer dropoff`.
- Grubhub: orange offer accent plus Grubhub-specific brand/workflow text.
- Amazon Flex / Spark: blue is intentionally ambiguous and only supports distinguishing OCR evidence such as `Amazon Flex`, `delivery block`, `Spark Driver`, or `Round Robin`.

Color by itself never passes the qualification gate. Generic text plus a dominant color remains `Other`; conflicting direct brands remain `Other`; and every populated field stays editable before saving. Merchant cases explicitly verify Burger King and Chick-fil-A as restaurants and Walmart/Schnucks/Best Buy as stores.

Automated smoke coverage includes the two marked layouts, all supported platform fingerprints, color-only negative cases, ambiguous-blue negative cases, direct-brand conflicts, and restaurant/store typing.

## v3.9.0 app-specific evidence audit

Build audited: GigLens v3.9.0

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

GigLens has no remote screenshot classifier. It reads local OCR text, so image-only logos, highly cropped captures, new app layouts, or poor OCR may intentionally fall back to `Other` until the driver reviews the field.

---

Build audited: GigLens v3.7.5

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
