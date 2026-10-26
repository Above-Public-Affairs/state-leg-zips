# State Leg ZIPs — ZIP audit (2026-10-26)

Audit of `public/data/districts.json` as generated 2026-02-14. The audit itself was read-only; the fix below was built afterwards, on approval.

- **Flagged rows:** [`flagged_zips.csv`](flagged_zips.csv) (16,857 rows; one row per ZIP × district × issue, so a ZIP can appear under more than one issue)
- **Machine summary:** [`summary.json`](summary.json)
- **Reproduce:** [`audit.py`](audit.py) (`python3 -I audit.py <districts.json> <census_dir> <out_dir> --thin 0.05`; the threshold is a parameter)

## Method

Overlaps are measured in **2020 residents, not land area**. Every 2020 Census block belongs to at most one ZCTA and (for tabulation) exactly one 2024 legislative district, so block populations add up exactly to ZCTA ∩ state and ZCTA ∩ district totals.

- *In-district overlap %* = the ZCTA's residents living inside that district ÷ all of the ZCTA's residents.
- *In-state overlap %* = the ZCTA's residents living in the district's state ÷ all of the ZCTA's residents.
- *Primary state* = the state holding most of the ZCTA's residents. For ZCTAs with zero residents it falls back to the state with the most land area, marked `basis=land_area` in the CSV.

**Validation:** block populations total 334,735,155 (the 2020 count for the US plus PR). Summed by district, they match the Census's published 2024 district populations for 1,958/1,958 senate districts and 4,873/4,875 house districts. Census splits 56 house-district blocks and 38 senate-district blocks across a boundary and tabulates each in one district. That's negligible.

## Results

**104,146 ZIP-district rows checked** (33,585 unique ZIPs, 6,775 districts, 99 chambers).

| Issue | Rows | Notes |
|---|---:|---|
| `cross_state` | 291 | ZIP's primary state is not the district's state. 177 of them are also thin. |
| `thin_overlap` (<5% of ZIP residents in district) | 16,095 | 15.5% of all rows. 2,641 have **zero** residents in the district. |
| `zero_population_zcta` | 254 | No 2020 residents, so population share is undefined. Not judged by the thin check. |
| `zero_land_overlap` | 206 | Census row touches the district only by water or along an edge. All 206 are also thin. |
| `invalid_format` / `not_a_2020_zcta` | 0 | Every value is a 5-digit string and a real 2020 ZCTA. |
| `empty_district` / `duplicate_zip` | 0 | |
| District set ≠ Census 2024 districts | 0 | Every chamber matches the Census 2024 district list exactly. Every ZIP matches the source relationship file. |
| `district_count_ne_seat_count` | 11 | All are multi-member legislatures, not data errors (see below). |

**Most cross-state rows:** SD 54 (24 unique ZIPs), ND 32 (13), NM 17 (8), ID 16 (8), then CA, KS, MN at 12 each. Most cross-state ZIPs are nearly all out-of-state: across the 291 rows, only 3.4% of the residents being targeted live in the district's state.

**NM examples caught**

| District | ZIP | Primary state | In-district | In-state | Also flagged thin? |
|---|---|---|---:|---:|---|
| NM House 3 | 81137 (Ignacio) | CO | 4.26% | 4.26% | yes |
| NM House 54 | 79837 (Dell City) | TX | 9.51% | 9.51% | no |

**Seat count vs district count.** These chambers have fewer districts than seats because they use multi-member districts: AZ House (30 / 60), ID House (35 / 70), MD House (71 / 141), NH House (164 / 400), NJ Assembly (40 / 80), ND House (48 / 94), SD House (37 / 70), VT House (109 / 150), VT Senate (16 / 30), WA House (49 / 98), WV Senate (17 / 34). In each case the site's district count equals the Census 2024 district count. One real gap: NH's **floterial** districts aren't Census SLDs, so they aren't on the site. Census publishes them separately (`NH_Floterial_2022.csv`).

## What can't be checked reliably

- **Thin check for zero-population ZCTAs (254 rows):** with no residents there's no population share. They're flagged separately, not approximated with land area.
- **Current residents / ad-platform users:** all shares use the 2020 count. Population change since 2020 and how each platform maps users to ZIPs aren't measured.
- **USPS ZIP vs ZCTA:** the site lists ZCTAs. Ad platforms target USPS ZIPs, which differ from ZCTAs at the edges. No public file reconciles the two.

## Recommended fix (approved 2026-10-26 and built)

**1. Filter by population share, not by state.** The default copy should keep ZIPs where at least 5% of the ZIP's residents live in the district. This removes 16,095 rows, including 177 of the 291 cross-state rows. Precision rises from **47.4% to 60.9%**: that's the share of residents in the copied ZIPs who actually live in the district, so less ad spend goes outside it. Coverage of district residents falls from 100% to **99.44%** (median district 99.78%).

**2. Don't blanket-drop cross-state ZIPs.** Dropping all of them barely moves precision (47.4% → 47.5%). It would also cut real voters: TN House 75 would lose 10% of its residents, because Fort Campbell's 42223 is mostly in KY but 36% in-district. NM House 9 would lose 6% (86515). The 114 cross-state rows that pass the 5% rule should stay in the copy but carry a UI tag ("mostly in KY").

**3. Add a "Include spillover ZIPs" toggle.** When it's on, the copy restores today's full any-overlap list. Remember the choice per viewer.

**4. Copy-to-clipboard output.** The format stays the same comma-separated 5-digit list, so pasting into Meta, Google Ads, and StackAdapt works exactly as before. Only the default list gets shorter. The toast should say what was left out ("Copied 23 ZIPs · 4 spillover ZIPs left out"). Add the mode to the `zip_copy` GA event.

**5. Build-time data.** Have `scripts/build-data.ts` join the same block files and store each ZIP's in-district share and other-state tag next to it. The threshold becomes a build constant. This needs the same Census files this audit used.

**6. Show coverage.** Show each district's coverage, e.g. "reaches 99.4% of district residents". 168 districts fall under 95% at the 5% threshold, worst VT House OR-1 at 78%.

**Decided:** zero-population ZCTAs go in the spillover bucket, since they have no residents to reach. That leaves 87,797 rows in the default lists; precision and coverage are unchanged.

Shipping this also means updating the methodology page, which currently says any overlap counts, and the in-site `CHANGELOG` in `components/Footer.tsx`.

### Effect of other thresholds

| Default rule | Rows kept | Precision | District residents reached | Districts left empty |
|---|---:|---:|---:|---:|
| Today (any overlap) | 104,146 | 47.4% | 100.00% | 0 |
| Drop cross-state only | 103,855 | 47.5% | 99.99% | 0 |
| Share ≥ 1% | 95,412 | 54.9% | 99.94% | 0 |
| **Share ≥ 5%** | **88,051** | **60.9%** | **99.44%** | **0** |
| Share ≥ 10% | 82,857 | 65.7% | 98.44% | 1 |
| Share ≥ 25% | 74,025 | 76.2% | 94.01% | 89 |

## Sources

- SLD × ZCTA relationship files, 2024 SLDs / 2020 ZCTAs. These are the site's own source; the audit uses them for land-area columns and as the consistency check.
  - https://www2.census.gov/geo/docs/maps-data/data/rel2020/cd-sld/tab20_sldl202420_zcta520_natl.txt
  - https://www2.census.gov/geo/docs/maps-data/data/rel2020/cd-sld/tab20_sldu202420_zcta520_natl.txt
- ZCTA × block relationship file. Used for block → ZCTA and as the list of valid 2020 ZCTAs: https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_tabblock20_natl.txt
- ZCTA × county relationship file. Used for state land-area shares and as the primary-state fallback: https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_county20_natl.txt
- 2024 state legislative block equivalency files. Used for block → district:
  - https://www2.census.gov/programs-surveys/decennial/rdo/mapping-files/2025/2024-state-legislative-bef/sldl24.zip
  - https://www2.census.gov/programs-surveys/decennial/rdo/mapping-files/2025/2024-state-legislative-bef/sldu24.zip
  - Split-block lists: `2024_SLDL_BlockSplits.pdf` and `2024_SLDU_BlockSplits.pdf` in the same folder
- 2020 PL 94-171 redistricting files, block total population `P0010001`, all 50 states plus DC and PR: https://www2.census.gov/programs-surveys/decennial/2020/data/01-Redistricting_File--PL_94-171/ (`<State>/<st>2020.pl.zip`)
- 2024 SLD population/area files. Used for validation and the official district list:
  - https://www2.census.gov/geo/docs/maps-data/data/rel2020/cd-sld/SLDL2024_UR_POPAREA.txt
  - https://www2.census.gov/geo/docs/maps-data/data/rel2020/cd-sld/SLDU2024_UR_POPAREA.txt
- Seat counts: NCSL, *Number of Legislators and Length of Terms*, https://www.ncsl.org/resources/details/number-of-legislators-and-length-of-terms-in-years. The 50-state totals (1,973 senate + 5,413 house = 7,386) were cross-checked.

The Census API was not used: it now requires a key. The bulk files above hold the same block counts.
