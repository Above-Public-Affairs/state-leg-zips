# Changelog

All notable changes to State Leg ZIPs will be documented in this file.

## [2026-10-26]

### Changed
- Clicking a district now copies only ZIPs with at least 5% of their 2020 residents in the district. Across all districts, this keeps 99.4% of district residents and raises the share of people reached who live in the district from 47.4% to 60.9%.
- The build script joins 2020 block populations (PL 94-171) to ZCTAs and 2024 districts (block equivalency files) to compute each ZIP's in-district share. The threshold is `ZIP_SHARE_THRESHOLD`. Census downloads are now cached in `~/.cache/state-leg-zips/census` (override with `CENSUS_DIR`).
- The copy confirmation shows how many spillover ZIPs were left out and the share of district residents reached. The `zip_copy` analytics event now includes `mode` and `spillover_count`.
- The methodology page explains the 5% rule and lists the new source files.

### Added
- "Include spillover ZIPs" switch, remembered per browser, that copies every ZIP touching the district (the previous behavior). ZIPs with no 2020 residents are always spillover.
- An amber dot on districts whose copied ZIPs include one mostly in another state, such as 42223 (Fort Campbell, mostly KY) in TN House 75.
- `districts.json` fields per district: `spillover`, `crossState`, `coverage`, plus `zip_share_threshold` in metadata.
- `audit/`: the ZIP audit behind this change (report, flagged rows CSV, script).

## [2026-02-15]

### Added
- Error reporting to centralized Error Reporter API for daily error reports

## [2026-02-14]

### Added
- Changelog modal in footer with recent update history

### Changed
- Renamed project title in project plan to "State Leg ZIPs"
