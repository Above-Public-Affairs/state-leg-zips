# State Leg ZIPs — Project Status

**Last Updated:** October 26, 2026

## Current Status

**Phase:** Deployed — Live

Site is fully deployed and live at statelegzips.com. All core functionality working.

### What's Working
- Data pipeline processes Census files (50 states, 1,942 senate districts, 4,833 house districts, 33,585 ZCTAs, 104,146 ZIP-district rows)
- Each ZIP's share of residents in each district, from 2020 block populations (PL 94-171) joined to 2024 block equivalency files
- Homepage displays 50 state pills
- District view shows House/Senate districts as clickable pills
- Click-to-copy copies ZIPs in CSV format to clipboard. Default list: ZIPs with at least 5% of their residents in the district (99.4% of district residents reached, 60.9% of people reached live in the district)
- "Include spillover ZIPs" switch copies every ZIP that touches the district (remembered per browser)
- Amber dot + copy message flag ZIPs mostly in another state; copy message shows spillover left out and coverage
- Request Update form sends email via SendGrid
- Nebraska handled as unicameral (Legislature only)
- Deployed on Railway with custom domain
- Google Analytics (GA4) with custom event tracking for state clicks, district clicks, and ZIP copies

## Completed
- [x] Data pipeline and build script
- [x] Full UI with state and district navigation
- [x] Click-to-copy ZIP codes in CSV format
- [x] Request Update email via SendGrid
- [x] Railway deployment with custom domain
- [x] Google Analytics (GA4) integration
- [x] All 50 states + DC verified
- [x] ZIP audit of every district (`audit/REPORT.md`, 2026-10-26)
- [x] 5% population-share default with spillover switch and cross-state tags (2026-10-26)

## To Do
- [ ] NH floterial districts aren't Census SLDs and aren't on the site (Census publishes `NH_Floterial_2022.csv`)
- [ ] Watch the `zip_copy` GA event's `mode` field to see how often people turn spillover on
