# GigLens Calendar and Screenshot Timestamp Audit

Build: 4.3.0

## Added

- Calendar month navigation and selected-day history.
- Historical add/edit/delete/duplicate workflow.
- OCR date and time extraction from common screenshot/status-bar layouts.
- Image file timestamp fallback when OCR does not provide a complete date/time.
- Editable date/time fields in OCR review, Quick Add, and manual entry.
- Timestamp source, confidence, and evidence metadata in normalized deliveries and backups.
- Shift-first work-time calculation with screenshot-session estimation as the fallback.

## Work-time rule

Saved shift and break records are authoritative when available. Otherwise, delivery timestamps are grouped into sessions. Consecutive orders separated by no more than 75 minutes are treated as one work session; longer gaps start a new session. Delivery duration extends each timestamp when minutes are available. The result is labeled as a screenshot estimate.

## Limitations

OCR may confuse status-bar time with an in-app deadline. GigLens prioritizes early status-bar-like lines and penalizes `Deliver by`, `Pickup by`, ETA, and duration context, but every date/time remains editable before saving. File timestamps can reflect download or transfer time rather than original capture time, so fallback results are lower confidence.

## Verification

```text
npm run syntax: passed
npm run smoke: passed
python -m unittest discover -s tests -v: 43 tests passed
public secret scan: no exposed keys, passwords, private keys, tokens, or .env files found
```
