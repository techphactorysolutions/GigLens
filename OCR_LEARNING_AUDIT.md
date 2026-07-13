# GigLens OCR Learning Audit

Release: 4.2.0

GigLens learns only from fields the driver reviews and saves. The local learning profile is stored under `giglens.ocrLearning.v1` and is capped at 120 records.

Stored learning data includes:

- a one-way signature of normalized OCR text;
- a small set of stable delivery-app workflow tokens;
- original and corrected platform/merchant/numeric fields;
- numeric context hints when the corrected value appears in OCR text;
- confirmation count and timestamp.

The screenshot file and screenshot pixels are not stored in the learning profile. Exact OCR matches can restore all reviewed fields. Similar workflow matches can transfer a platform only when both screenshots share a token distinctive to that platform; generic words such as `delivery`, `pickup`, `accept`, `offer`, `miles`, or `minutes` cannot qualify the transfer. Merchant alias corrections and numeric-context hints still improve candidate selection. The review screen remains editable and never silently saves a delivery.

Users can reset scanner learning under Settings without deleting deliveries. Learning data is included in JSON backup/import, rollback, emergency restore, storage measurement, and Clear All Local Data.

The 4.2 accent sampler processes a downscaled lower region in memory and does not persist pixel data. OCR still loads on demand, rejects oversized/non-image inputs, bounds worker cleanup, and ignores stale concurrent results; none of those controls persist additional screenshot content.
