# Session Handoff — State Leg ZIPs

## Where we are (2026-10-26)

Live at statelegzips.com on Railway. Clicking a district now copies only ZIPs with at least 5% of their 2020 residents in the district; an "Include spillover ZIPs" switch restores the full any-overlap list. This came out of a full ZIP audit (`audit/REPORT.md`, flagged rows in `audit/flagged_zips.csv`).

## What's built

- `scripts/build-data.ts` (`npm run build:data`) builds `public/data/districts.json`:
  - ZIP lists from the Census SLD × ZCTA relationship files (any overlap), as before.
  - Population shares from 2020 PL 94-171 block populations, the ZCTA × block file, and the 2024 SLD block equivalency files.
  - Per district: `zips` (default, share ≥ `ZIP_SHARE_THRESHOLD` = 0.05), `spillover` (below it, or no residents), `crossState` (ZIP → state where most residents live), `coverage` (share of district residents in `zips`).
- UI: `DistrictView` (switch + legend), `DistrictPill` (copy logic, amber dot, toast text, `zip_copy` GA event with `mode` and `spillover_count`), `CopyToast` (two-line message).
- `audit/audit.py` reproduces the audit independently in Python (`python3 -I audit.py <districts.json> <census_dir> <out_dir> --thin 0.05`).

## Next steps

- NH floterial districts are not on the site.
- Check GA for how often `mode=with_spillover` is used.

## Gotchas

- **Census downloads are ~2.5 GB** and cache in `~/.cache/state-leg-zips/census` (override with `CENSUS_DIR`). Keep them out of the repo: it lives in iCloud. A rebuild takes ~40s and ~0.9 GB RAM, and needs `unzip` on the PATH.
- Rebuilding sets every state's "Updated" date in `state-updates.json` to today.
- The block equivalency zips also contain per-state files for only the states that changed; the script reads the `NationalSLDL24.txt` / `NationalSLDU24.txt` files, which cover every state.
- The Census API now needs a key; the build uses bulk files instead.
- District count ≠ seat count in 11 chambers because of multi-member districts. That's expected, not a data error.
- Dev preview: `.claude/launch.json` runs `next dev` on port 3417.
