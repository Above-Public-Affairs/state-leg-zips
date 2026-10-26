"""Audit State Leg ZIPs districts.json against Census 2020 block-level data.

Usage: python3 -I audit.py <districts.json> <census_dir> <out_dir> [--thin 0.05]

Population basis: 2020 Census PL 94-171 block population (P0010001), joined to
  - ZCTA via tab20_zcta520_tabblock20_natl.txt (every 2020 block is in <=1 ZCTA)
  - 2024 SLDs via the Census RDO 2024 block equivalency files (NationalSLDL24/SLDU24)
Land-area basis: tab20_sld{l,u}202420_zcta520_natl.txt and tab20_zcta520_county20_natl.txt.
"""
import csv, io, json, os, re, sys, zipfile
from collections import defaultdict

args = sys.argv[1:]
THIN = 0.05
if "--thin" in args:
    i = args.index("--thin"); THIN = float(args[i + 1]); del args[i:i + 2]
DJSON, CEN, OUT = args
os.makedirs(OUT, exist_ok=True)

FIPS_ABBR = {}
for line in open(os.path.join(CEN, "fips_abbr.txt")):
    f, a = line.split(); FIPS_ABBR[f] = a

def norm_district(code):
    # same transform as scripts/build-data.ts
    return code.lstrip("0") or "0"

def log(*a): print(*a, file=sys.stderr, flush=True)

# ---- 1. Block population from PL 94-171 -------------------------------------
block = {}  # int(geoid15) -> pop   (pop>0 only, later becomes (zcta, pop))
for fn in sorted(os.listdir(CEN)):
    if not fn.endswith("2020.pl.zip"): continue
    st = fn[:2]
    z = zipfile.ZipFile(os.path.join(CEN, fn))
    log_to_geo = {}
    with z.open(f"{st}geo2020.pl") as fh:
        for line in io.TextIOWrapper(fh, encoding="latin-1"):
            c = line.split("|", 10)
            if c[2] == "750": log_to_geo[c[7]] = int(c[9])
    with z.open(f"{st}000012020.pl") as fh:
        for line in io.TextIOWrapper(fh, encoding="latin-1"):
            c = line.split("|", 6)
            g = log_to_geo.get(c[4])
            if g is not None:
                p = int(c[5])
                if p: block[g] = p
    log(f"PL {st}: blocks so far {len(block)}")

# ---- 2. Block -> ZCTA; ZCTA population totals by state ----------------------
zcta_state_pop = defaultdict(int)      # (zcta, stfips) -> pop
zcta_pop = defaultdict(int)
valid_zcta = set()
blk_zcta = {}                          # int(geoid) -> zcta (pop>0 blocks only)
with open(os.path.join(CEN, "tab20_zcta520_tabblock20_natl.txt"), encoding="utf-8-sig") as fh:
    next(fh)
    for line in fh:
        c = line.split("|")
        zc = c[1]
        if not zc: continue
        valid_zcta.add(zc)
        g = int(c[9]); p = block.get(g)
        if p:
            blk_zcta[g] = zc
            zcta_state_pop[(zc, c[9][:2])] += p
            zcta_pop[zc] += p
log("block->zcta done", len(blk_zcta))

# land area by ZCTA x state (from ZCTA-county file)
zcta_state_land = defaultdict(int); zcta_land = {}
with open(os.path.join(CEN, "tab20_zcta520_county20_natl.txt"), encoding="utf-8-sig") as fh:
    r = csv.DictReader(fh, delimiter="|")
    for row in r:
        zc = row["GEOID_ZCTA5_20"]
        if not zc or not row["GEOID_COUNTY_20"]: continue
        valid_zcta.add(zc)
        zcta_land[zc] = int(row["AREALAND_ZCTA5_20"])
        zcta_state_land[(zc, row["GEOID_COUNTY_20"][:2])] += int(row["AREALAND_PART"])

def primary_state(zc):
    pops = {s: p for (z, s), p in zcta_state_pop.items() if z == zc}
    return pops

# index state shares per ZCTA once
zcta_states_pop = defaultdict(dict)
for (zc, s), p in zcta_state_pop.items(): zcta_states_pop[zc][s] = p
zcta_states_land = defaultdict(dict)
for (zc, s), a in zcta_state_land.items(): zcta_states_land[zc][s] = a

def zinfo(zc):
    tp = zcta_pop.get(zc, 0)
    if tp:
        sp = zcta_states_pop[zc]; prim = max(sp, key=sp.get); basis = "population"
    else:
        sl = zcta_states_land.get(zc) or {}
        prim = max(sl, key=sl.get) if sl else ""; basis = "land_area"
    return tp, prim, basis

# ---- 3. Block -> 2024 SLD; ZCTA x district population ------------------------
sld_zcta_pop = {"upper": defaultdict(int), "lower": defaultdict(int)}
for ch, fn in (("lower", "bef_sldl24/NationalSLDL24.txt"), ("upper", "bef_sldu24/NationalSLDU24.txt")):
    with open(os.path.join(CEN, fn)) as fh:
        next(fh)
        for line in fh:
            g, d = line.rstrip("\n").split(",")
            gi = int(g); zc = blk_zcta.get(gi)
            if zc: sld_zcta_pop[ch][(g[:2], norm_district(d), zc)] += block[gi]
log("bef done")

# validation: district pop from our join vs Census published 2024 SLD block pop
validation = {"total_block_pop_pl": sum(block.values()),
              "pop_in_blocks_without_zcta": sum(p for g, p in block.items() if g not in blk_zcta)}
for ch, fn in (("lower", "SLDL2024_UR_POPAREA.txt"), ("upper", "SLDU2024_UR_POPAREA.txt")):
    ours = defaultdict(int)
    with open(os.path.join(CEN, "bef_sld%s24/NationalSLD%s24.txt" % (ch[0] if ch == "upper" else "l", "U" if ch == "upper" else "L"))) as fh:
        next(fh)
        for line in fh:
            g, d = line.rstrip("\n").split(",")
            p = block.get(int(g))
            if p: ours[(g[:2], norm_district(d))] += p
    mism = n = 0
    with open(os.path.join(CEN, fn), encoding="utf-8-sig") as fh:
        r = csv.reader(fh); next(r)
        for row in r:
            st, d = row[0][:2], norm_district(row[0][2:])
            if st not in FIPS_ABBR or re.fullmatch(r"Z+", d, re.I): continue
            n += 1
            if ours.get((st, d), 0) != int(row[1]): mism += 1
    validation[f"{ch}_districts_pop_mismatch_vs_census_poparea"] = f"{mism}/{n}"
log("validation", validation)

# land-area overlap from SLD x ZCTA relationship files (what the site was built from)
sld_zcta_land = {"upper": {}, "lower": {}}
census_lists = {"upper": defaultdict(set), "lower": defaultdict(set)}
census_districts = {"upper": defaultdict(set), "lower": defaultdict(set)}
for ch, fn, k in (("lower", "tab20_sldl202420_zcta520_natl.txt", "SLDL2024_20"),
                  ("upper", "tab20_sldu202420_zcta520_natl.txt", "SLDU2024_20")):
    with open(os.path.join(CEN, fn), encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh, delimiter="|"):
            geoid = row[f"GEOID_{k}"]; zc = row["GEOID_ZCTA5_20"]
            if not geoid or len(geoid) < 3: continue
            st, d = geoid[:2], norm_district(geoid[2:])
            if re.fullmatch(r"Z+", d, re.I): continue
            census_districts[ch][st].add(d)
            if not zc: continue
            census_lists[ch][(st, d)].add(zc)
            sld_zcta_land[ch][(st, d, zc)] = int(row["AREALAND_PART"])

# ---- 4. Seat counts (NCSL) ----------------------------------------------------
ncsl = {}
for row in csv.DictReader(open(os.path.join(CEN, "ncsl_seats.csv"))):
    ncsl[row["abbr"]] = {"upper": row["senate"], "lower": row["house"]}

# ---- 5. Audit ------------------------------------------------------------------
data = json.load(open(DJSON))
allrows = []
# district population (all of it, including parts in ZCTAs not listed)
district_pop = {"upper": defaultdict(int), "lower": defaultdict(int)}
for ch in ("upper", "lower"):
    for (st, d, zc), p in sld_zcta_pop[ch].items(): district_pop[ch][(st, d)] += p
flags = []; counts = defaultdict(int); total = 0; rows_checked = 0
cross_by_state = defaultdict(int); cross_unique = defaultdict(set)
thin_by_state = defaultdict(int)
COLS = ["state", "state_fips", "chamber", "district", "zip", "issue_type", "zcta_primary_state",
        "in_district_overlap_pct", "in_state_overlap_pct", "basis", "zcta_pop_2020",
        "in_district_land_pct", "in_state_land_pct", "detail"]

def pct(x): return "" if x is None else f"{100 * x:.2f}"

def add(**kw):
    flags.append({c: kw.get(c, "") for c in COLS}); counts[kw["issue_type"]] += 1

for st, sd in sorted(data["states"].items()):
    ab = sd["abbreviation"]
    for ch in ("lower", "upper"):
        cd = sd["chambers"].get(ch)
        json_d = set(cd["districts"]) if cd else set()
        cen_d = census_districts[ch].get(st, set())
        seats = ncsl.get(ab, {}).get(ch, "NA")
        # structure: district counts
        if json_d != cen_d:
            add(state=ab, state_fips=st, chamber=ch, issue_type="district_set_mismatch_vs_census",
                detail=f"json={len(json_d)} census2024={len(cen_d)} missing={sorted(cen_d - json_d)[:20]} extra={sorted(json_d - cen_d)[:20]}")
        if (seats not in ("NA", "") and int(seats) != len(json_d)) or (seats in ("NA", "") and json_d):
            add(state=ab, state_fips=st, chamber=ch, issue_type="district_count_ne_seat_count",
                detail=f"json_districts={len(json_d)} census2024_districts={len(cen_d)} ncsl_seats={seats}")
        if not cd: continue
        for d, info in cd["districts"].items():
            zips = info["zips"]
            if not zips:
                add(state=ab, state_fips=st, chamber=ch, district=d, issue_type="empty_district")
            seen = set()
            for z in zips:
                if z in seen:
                    add(state=ab, state_fips=st, chamber=ch, district=d, zip=z, issue_type="duplicate_zip")
                seen.add(z)
            # completeness vs census relationship file
            cl = census_lists[ch].get((st, d), set())
            for z in sorted(set(zips) - cl):
                add(state=ab, state_fips=st, chamber=ch, district=d, zip=z, issue_type="not_in_census_relationship")
            for z in sorted(cl - set(zips)):
                add(state=ab, state_fips=st, chamber=ch, district=d, zip=z, issue_type="missing_from_json")
            for z in zips:
                total += 1
                base = dict(state=ab, state_fips=st, chamber=ch, district=d, zip=z)
                if not (isinstance(z, str) and re.fullmatch(r"\d{5}", z)):
                    add(**base, issue_type="invalid_format", detail=repr(z)); continue
                if z not in valid_zcta:
                    add(**base, issue_type="not_a_2020_zcta"); continue
                tp, prim, basis = zinfo(z)
                land = zcta_land.get(z) or 0
                dl = sld_zcta_land[ch].get((st, d, z))
                sl = zcta_states_land.get(z, {}).get(st, 0)
                m = dict(zcta_primary_state=FIPS_ABBR.get(prim, prim), basis=basis, zcta_pop_2020=tp,
                         in_district_land_pct=pct(dl / land) if land and dl is not None else "",
                         in_state_land_pct=pct(sl / land) if land else "")
                allrows.append((ab, ch, d, z, tp, sld_zcta_pop[ch].get((st, d, z), 0),
                                zcta_states_pop[z].get(st, 0) if tp else 0, FIPS_ABBR.get(prim, prim)))
                if tp:
                    dp = sld_zcta_pop[ch].get((st, d, z), 0) / tp
                    sp = zcta_states_pop[z].get(st, 0) / tp
                    m.update(in_district_overlap_pct=pct(dp), in_state_overlap_pct=pct(sp))
                else:
                    dp = sp = None
                    m.update(in_district_overlap_pct="", in_state_overlap_pct=m["in_state_land_pct"])
                if prim != st:
                    add(**base, **m, issue_type="cross_state")
                    cross_by_state[ab] += 1; cross_unique[ab].add(z)
                if tp == 0:
                    add(**base, **m, issue_type="zero_population_zcta",
                        detail="no 2020 residents; population overlap undefined")
                elif dp < THIN:
                    add(**base, **m, issue_type="thin_overlap")
                    thin_by_state[ab] += 1
                if dl == 0:
                    add(**base, **m, issue_type="zero_land_overlap",
                        detail="Census relationship row has AREALAND_PART=0 (water/edge only)")

with open(os.path.join(OUT, "flagged_zips.csv"), "w", newline="") as fh:
    w = csv.DictWriter(fh, fieldnames=COLS); w.writeheader(); w.writerows(flags)

inv = {v: k for k, v in FIPS_ABBR.items()}
with open(os.path.join(OUT, "all_rows.csv"), "w", newline="") as fh:
    w = csv.writer(fh)
    w.writerow(["state", "chamber", "district", "zip", "zcta_pop", "in_district_pop", "in_state_pop", "primary_state", "district_pop"])
    for r in allrows:
        w.writerow(list(r) + [district_pop[r[1]].get((inv[r[0]], r[2]), 0)])

# NM spot checks
def find(ab, ch, d, z, it):
    return [f for f in flags if f["state"] == ab and f["chamber"] == ch and f["district"] == d and f["zip"] == z and f["issue_type"] == it]

summary = {
    "validation": validation,
    "thin_threshold": THIN, "zip_rows_checked": total,
    "unique_zips_checked": len({z for s in data["states"].values() for c in s["chambers"].values() for dd in c["districts"].values() for z in dd["zips"]}),
    "districts_checked": sum(len(c["districts"]) for s in data["states"].values() for c in s["chambers"].values()),
    "counts_by_issue": dict(sorted(counts.items())),
    "cross_state_rows_by_state": dict(sorted(cross_by_state.items(), key=lambda x: -x[1])),
    "cross_state_unique_zips_by_state": {k: len(v) for k, v in sorted(cross_unique.items(), key=lambda x: -len(x[1]))},
    "thin_rows_by_state": dict(sorted(thin_by_state.items(), key=lambda x: -x[1])),
    "nm_lower3_81137": find("NM", "lower", "3", "81137", "cross_state"),
    "nm_lower54_79837": find("NM", "lower", "54", "79837", "cross_state"),
    "zip_rows_with_any_zip_issue": len({(f["state"], f["chamber"], f["district"], f["zip"]) for f in flags if f["zip"] and f["issue_type"] in ("cross_state", "thin_overlap", "zero_population_zcta", "invalid_format", "not_a_2020_zcta", "duplicate_zip")}),
}
json.dump(summary, open(os.path.join(OUT, "summary.json"), "w"), indent=1)
print(json.dumps(summary, indent=1))
