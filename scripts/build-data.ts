import fs from "fs";
import os from "os";
import path from "path";
import https from "https";
import readline from "readline";
import { spawn } from "child_process";
import { STATE_FIPS } from "../lib/fips";

// A ZIP goes in a district's default copy list only if at least this share of
// the ZIP's 2020 residents live in the district. Everything else the Census
// relationship file lists for the district (including ZIPs with no residents)
// goes in the district's spillover list.
const ZIP_SHARE_THRESHOLD = 0.05;

const REL_BASE = "https://www2.census.gov/geo/docs/maps-data/data/rel2020";
const SLDL_URL = `${REL_BASE}/cd-sld/tab20_sldl202420_zcta520_natl.txt`;
const SLDU_URL = `${REL_BASE}/cd-sld/tab20_sldu202420_zcta520_natl.txt`;
const ZCTA_BLOCK_URL = `${REL_BASE}/zcta520/tab20_zcta520_tabblock20_natl.txt`;
const BEF_BASE =
  "https://www2.census.gov/programs-surveys/decennial/rdo/mapping-files/2025/2024-state-legislative-bef";
const SLDL_BEF_URL = `${BEF_BASE}/sldl24.zip`;
const SLDU_BEF_URL = `${BEF_BASE}/sldu24.zip`;
const PL_BASE =
  "https://www2.census.gov/programs-surveys/decennial/2020/data/01-Redistricting_File--PL_94-171";

// DC isn't on the site, but some ZIPs straddle the DC line, so its blocks are
// needed for those ZIPs' population totals.
const POP_STATES: Record<string, { name: string; abbreviation: string }> = {
  ...STATE_FIPS,
  "11": { name: "District of Columbia", abbreviation: "DC" },
};

// The Census downloads total ~2.5 GB, so they're cached outside the repo
// (which lives in iCloud). Override with CENSUS_DIR.
const RAW_DIR =
  process.env.CENSUS_DIR ||
  path.join(os.homedir(), ".cache", "state-leg-zips", "census");
const OUTPUT_DIR = path.join(__dirname, "..", "public", "data");

function download(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            file.close();
            fs.unlinkSync(dest);
            return download(redirectUrl, dest).then(resolve).catch(reject);
          }
        }
        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(dest);
          reject(new Error(`HTTP ${response.statusCode} for ${url}`));
          return;
        }
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", (err) => {
        file.close();
        fs.unlinkSync(dest);
        reject(err);
      });
  });
}

// Download to a .part file first so an interrupted download isn't mistaken
// for a cached one on the next run.
async function cached(url: string): Promise<string> {
  const dest = path.join(RAW_DIR, path.basename(url));
  if (fs.existsSync(dest)) return dest;
  console.log(`Downloading ${path.basename(url)}...`);
  await download(url, dest + ".part");
  fs.renameSync(dest + ".part", dest);
  return dest;
}

function lines(filePath: string): readline.Interface {
  return readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });
}

function zipEntryLines(zipPath: string, entry: string): readline.Interface {
  const proc = spawn("unzip", ["-p", zipPath, entry]);
  proc.on("error", (err) => {
    throw new Error(`unzip failed for ${zipPath}: ${err.message}`);
  });
  proc.stdout.setEncoding("latin1");
  return readline.createInterface({ input: proc.stdout, crlfDelay: Infinity });
}

function normalizeDistrict(code: string): string {
  return code.replace(/^0+/, "") || "0";
}

interface RawRow {
  stateFips: string;
  districtNum: string;
  zcta: string;
  districtName: string;
}

function parseFile(
  filePath: string,
  chamber: "upper" | "lower"
): RawRow[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.trim().split("\n");

  // First line is the header — find column indices
  const header = lines[0].split("|");

  const geoidCol = header.findIndex((h) =>
    chamber === "lower"
      ? h.startsWith("GEOID_SLDL")
      : h.startsWith("GEOID_SLDU")
  );
  const nameCol = header.findIndex((h) =>
    chamber === "lower"
      ? h.startsWith("NAMELSAD_SLDL")
      : h.startsWith("NAMELSAD_SLDU")
  );
  const zctaCol = header.findIndex((h) => h.startsWith("GEOID_ZCTA5"));

  if (geoidCol === -1 || nameCol === -1 || zctaCol === -1) {
    throw new Error(
      `Could not find required columns in ${filePath}. Header: ${header.join(", ")}`
    );
  }

  const rows: RawRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("|");
    if (cols.length < Math.max(geoidCol, nameCol, zctaCol) + 1) continue;

    const geoid = cols[geoidCol].trim();
    const name = cols[nameCol].trim();
    const zcta = cols[zctaCol].trim();

    if (!geoid || !zcta || geoid.length < 3) continue;

    // GEOID format: 2-digit state FIPS + district number (variable length)
    const stateFips = geoid.substring(0, 2);
    const districtNum = normalizeDistrict(geoid.substring(2));

    // Skip territories and DC (only keep 50 states)
    if (!STATE_FIPS[stateFips]) continue;

    // Skip "ZZ" districts (unassigned/at-large placeholders with all Z's)
    if (districtNum.match(/^Z+$/i)) continue;

    rows.push({ stateFips, districtNum, zcta, districtName: name });
  }

  return rows;
}

// ---- Block-level population join ------------------------------------------
//
// Every 2020 block is in at most one ZCTA and, in the 2024 block equivalency
// files, exactly one legislative district. Summing block populations gives
// exact ZCTA, ZCTA x state, and ZCTA x district resident counts.
//
// Blocks are keyed by their 15-digit GEOID as a number (exact in a double).
// The value packs population and ZCTA: pop * 1e5 + zcta, where zcta 0 means
// the block isn't in any ZCTA. Only populated blocks are stored.

const ZCTA_SLOT = 1e5;

async function loadBlockPopulation(): Promise<Map<number, number>> {
  const blocks = new Map<number, number>();
  for (const info of Object.values(POP_STATES)) {
    const st = info.abbreviation.toLowerCase();
    const zipPath = await cached(
      `${PL_BASE}/${info.name.replace(/ /g, "_")}/${st}2020.pl.zip`
    );

    // Geo header: SUMLEV 750 rows are blocks; LOGRECNO links to segment 1.
    const logrecToGeoid = new Map<string, number>();
    for await (const line of zipEntryLines(zipPath, `${st}geo2020.pl`)) {
      const c = line.split("|", 10);
      if (c[2] === "750") logrecToGeoid.set(c[7], Number(c[9]));
    }

    // Segment 1: P0010001 (total population) is the 6th field.
    for await (const line of zipEntryLines(zipPath, `${st}000012020.pl`)) {
      const c = line.split("|", 6);
      const geoid = logrecToGeoid.get(c[4]);
      if (geoid === undefined) continue;
      const pop = Number(c[5]);
      if (pop > 0) blocks.set(geoid, pop * ZCTA_SLOT);
    }
    if (logrecToGeoid.size === 0) {
      throw new Error(`No block records read from ${zipPath}`);
    }
    console.log(`  ${info.abbreviation}: ${blocks.size} populated blocks so far`);
  }
  return blocks;
}

interface ZctaPopulation {
  total: Map<string, number>;
  byState: Map<string, Map<string, number>>;
}

async function assignBlocksToZctas(
  blocks: Map<number, number>,
  zctaBlockPath: string
): Promise<ZctaPopulation> {
  const total = new Map<string, number>();
  const byState = new Map<string, Map<string, number>>();
  let first = true;
  for await (const line of lines(zctaBlockPath)) {
    if (first) {
      first = false;
      continue;
    }
    const c = line.split("|", 10);
    const zcta = c[1];
    if (!zcta) continue;
    const geoid = Number(c[9]);
    const packed = blocks.get(geoid);
    if (packed === undefined) continue;
    blocks.set(geoid, packed + Number(zcta));

    const pop = Math.floor(packed / ZCTA_SLOT);
    const stateFips = c[9].substring(0, 2);
    total.set(zcta, (total.get(zcta) || 0) + pop);
    let states = byState.get(zcta);
    if (!states) byState.set(zcta, (states = new Map()));
    states.set(stateFips, (states.get(stateFips) || 0) + pop);
  }
  return { total, byState };
}

interface DistrictPopulation {
  // `${stateFips}|${district}` -> residents
  district: Map<string, number>;
  // `${stateFips}|${district}|${zcta}` -> residents
  districtZcta: Map<string, number>;
}

async function joinBlocksToDistricts(
  blocks: Map<number, number>,
  befZip: string,
  befEntry: string
): Promise<DistrictPopulation> {
  const district = new Map<string, number>();
  const districtZcta = new Map<string, number>();
  let first = true;
  for await (const line of zipEntryLines(befZip, befEntry)) {
    if (first) {
      first = false;
      continue;
    }
    const [geoid, code] = line.split(",");
    if (!code) continue;
    const packed = blocks.get(Number(geoid));
    if (packed === undefined) continue;

    const pop = Math.floor(packed / ZCTA_SLOT);
    const zctaNum = packed % ZCTA_SLOT;
    const key = `${geoid.substring(0, 2)}|${normalizeDistrict(code.trim())}`;
    district.set(key, (district.get(key) || 0) + pop);
    if (zctaNum) {
      const zkey = `${key}|${String(zctaNum).padStart(5, "0")}`;
      districtZcta.set(zkey, (districtZcta.get(zkey) || 0) + pop);
    }
  }
  if (district.size === 0) {
    throw new Error(`No block assignments read from ${befZip}`);
  }
  return { district, districtZcta };
}

function primaryState(states: Map<string, number> | undefined): string | null {
  if (!states) return null;
  let best: string | null = null;
  let bestPop = 0;
  for (const [fips, pop] of states) {
    if (pop > bestPop) {
      best = fips;
      bestPop = pop;
    }
  }
  return best;
}

interface DistrictInfo {
  name: string;
  zips: Set<string>;
}

interface StateEntry {
  name: string;
  abbreviation: string;
  upper: Map<string, DistrictInfo>;
  lower: Map<string, DistrictInfo>;
}

interface DistrictOutput {
  name: string;
  zips: string[];
  spillover: string[];
  crossState?: Record<string, string>;
  coverage: number;
}

async function main() {
  // Ensure directories exist
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`Census cache: ${RAW_DIR}`);

  const sldlPath = await cached(SLDL_URL);
  const slduPath = await cached(SLDU_URL);
  const zctaBlockPath = await cached(ZCTA_BLOCK_URL);
  const sldlBefPath = await cached(SLDL_BEF_URL);
  const slduBefPath = await cached(SLDU_BEF_URL);

  // Parse both files
  console.log("\nParsing SLDL (House) data...");
  const lowerRows = parseFile(sldlPath, "lower");
  console.log(`  ${lowerRows.length} rows parsed.`);

  console.log("Parsing SLDU (Senate) data...");
  const upperRows = parseFile(slduPath, "upper");
  console.log(`  ${upperRows.length} rows parsed.`);

  console.log("\nLoading 2020 block populations (PL 94-171)...");
  const blocks = await loadBlockPopulation();

  console.log("Assigning blocks to ZCTAs...");
  const zctaPop = await assignBlocksToZctas(blocks, zctaBlockPath);

  console.log("Assigning blocks to 2024 districts...");
  const districtPop = {
    lower: await joinBlocksToDistricts(blocks, sldlBefPath, "NationalSLDL24.txt"),
    upper: await joinBlocksToDistricts(blocks, slduBefPath, "NationalSLDU24.txt"),
  };

  // Build state map
  const stateMap = new Map<string, StateEntry>();

  for (const [fips, info] of Object.entries(STATE_FIPS)) {
    stateMap.set(fips, {
      name: info.name,
      abbreviation: info.abbreviation,
      upper: new Map(),
      lower: new Map(),
    });
  }

  // Process lower chamber (House) rows
  for (const row of lowerRows) {
    const state = stateMap.get(row.stateFips);
    if (!state) continue;

    if (!state.lower.has(row.districtNum)) {
      state.lower.set(row.districtNum, {
        name: row.districtName,
        zips: new Set(),
      });
    }
    state.lower.get(row.districtNum)!.zips.add(row.zcta);
  }

  // Process upper chamber (Senate) rows
  for (const row of upperRows) {
    const state = stateMap.get(row.stateFips);
    if (!state) continue;

    if (!state.upper.has(row.districtNum)) {
      state.upper.set(row.districtNum, {
        name: row.districtName,
        zips: new Set(),
      });
    }
    state.upper.get(row.districtNum)!.zips.add(row.zcta);
  }

  // Split each district's ZIPs into the default list and spillover
  const totals = {
    rows: 0,
    defaultRows: 0,
    crossStateDefault: 0,
    zeroPopulation: 0,
    copiedResidents: 0,
    copiedInDistrict: 0,
    districtsUnder95: 0,
    emptyDefault: 0,
  };

  function splitDistrict(
    fips: string,
    chamber: "upper" | "lower",
    num: string,
    info: DistrictInfo
  ): DistrictOutput {
    const pops = districtPop[chamber];
    const key = `${fips}|${num}`;
    const zips: string[] = [];
    const spillover: string[] = [];
    const crossState: Record<string, string> = {};
    let reached = 0;

    for (const zip of Array.from(info.zips).sort()) {
      totals.rows++;
      const zipTotal = zctaPop.total.get(zip) || 0;
      const inDistrict = pops.districtZcta.get(`${key}|${zip}`) || 0;

      const primary = primaryState(zctaPop.byState.get(zip));
      if (primary && primary !== fips) {
        crossState[zip] = POP_STATES[primary]?.abbreviation || primary;
      }

      if (zipTotal > 0 && inDistrict / zipTotal >= ZIP_SHARE_THRESHOLD) {
        zips.push(zip);
        reached += inDistrict;
        totals.defaultRows++;
        totals.copiedResidents += zipTotal;
        totals.copiedInDistrict += inDistrict;
        if (crossState[zip]) totals.crossStateDefault++;
      } else {
        spillover.push(zip);
        if (zipTotal === 0) totals.zeroPopulation++;
      }
    }

    const residents = pops.district.get(key) || 0;
    const coverage = residents > 0 ? reached / residents : 1;
    if (coverage < 0.95) totals.districtsUnder95++;
    if (zips.length === 0) totals.emptyDefault++;

    const out: DistrictOutput = {
      name: info.name,
      zips,
      spillover,
      coverage: Math.round(coverage * 10000) / 10000,
    };
    if (Object.keys(crossState).length > 0) out.crossState = crossState;
    return out;
  }

  // Convert to JSON-serializable structure
  const output: Record<string, unknown> = {
    states: {} as Record<string, unknown>,
    metadata: {
      generatedAt: new Date().toISOString(),
      source: "US Census Bureau 2024 SLD Relationship Files",
      zcta_vintage: "2020",
      legislative_session: "2024",
      population_source:
        "2020 Census PL 94-171 block populations, 2024 SLD block equivalency files",
      zip_share_threshold: ZIP_SHARE_THRESHOLD,
    },
  };

  const states = output.states as Record<string, unknown>;
  const stateUpdates: Record<string, string> = {};
  const today = new Date().toISOString().split("T")[0];

  let totalUpperDistricts = 0;
  let totalLowerDistricts = 0;
  const totalUniqueZctas = new Set<string>();

  for (const [fips, state] of stateMap) {
    const stateEntry: Record<string, unknown> = {
      name: state.name,
      abbreviation: state.abbreviation,
      chambers: {} as Record<string, unknown>,
    };

    const chambers = stateEntry.chambers as Record<string, unknown>;

    if (state.upper.size > 0) {
      const districts: Record<string, DistrictOutput> = {};
      for (const [num, info] of state.upper) {
        districts[num] = splitDistrict(fips, "upper", num, info);
        info.zips.forEach((z) => totalUniqueZctas.add(z));
      }
      chambers.upper = { districts };
      totalUpperDistricts += state.upper.size;
    }

    if (state.lower.size > 0) {
      const districts: Record<string, DistrictOutput> = {};
      for (const [num, info] of state.lower) {
        districts[num] = splitDistrict(fips, "lower", num, info);
        info.zips.forEach((z) => totalUniqueZctas.add(z));
      }
      chambers.lower = { districts };
      totalLowerDistricts += state.lower.size;
    }

    states[fips] = stateEntry;
    stateUpdates[state.abbreviation] = today;
  }

  // Write districts.json
  const outputPath = path.join(OUTPUT_DIR, "districts.json");
  fs.writeFileSync(outputPath, JSON.stringify(output));
  const fileSizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);
  console.log(`\nWrote ${outputPath} (${fileSizeMB} MB)`);

  // Write state-updates.json
  const updatesPath = path.join(OUTPUT_DIR, "state-updates.json");
  fs.writeFileSync(updatesPath, JSON.stringify(stateUpdates, null, 2));
  console.log(`Wrote ${updatesPath}`);

  // Summary
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  console.log("\n--- Summary ---");
  console.log(`States: ${stateMap.size}`);
  console.log(`Upper (Senate) districts: ${totalUpperDistricts}`);
  console.log(`Lower (House) districts: ${totalLowerDistricts}`);
  console.log(`Unique ZCTAs: ${totalUniqueZctas.size}`);
  console.log(`ZIP-district rows: ${totals.rows}`);
  console.log(
    `  Default list (>= ${pct(ZIP_SHARE_THRESHOLD)} share): ${totals.defaultRows}`
  );
  console.log(`  Spillover: ${totals.rows - totals.defaultRows}`);
  console.log(`  Spillover with no residents: ${totals.zeroPopulation}`);
  console.log(`  Default ZIPs mostly in another state: ${totals.crossStateDefault}`);
  console.log(
    `Default list precision: ${pct(totals.copiedInDistrict / totals.copiedResidents)}`
  );
  console.log(`Districts under 95% coverage: ${totals.districtsUnder95}`);

  // Validate: check for states with no districts
  for (const [fips, state] of stateMap) {
    if (state.upper.size === 0 && state.lower.size === 0) {
      console.warn(`WARNING: ${state.name} (${fips}) has no districts at all`);
    }
    // Nebraska should only have upper (unicameral)
    if (state.abbreviation === "NE" && state.lower.size > 0) {
      console.warn("WARNING: Nebraska has lower chamber data (unexpected)");
    }
    if (state.abbreviation === "NE" && state.upper.size === 0) {
      console.warn("WARNING: Nebraska has no upper chamber data (unexpected)");
    }
  }
  if (totals.emptyDefault > 0) {
    console.warn(
      `WARNING: ${totals.emptyDefault} districts have no ZIPs above the threshold`
    );
  }
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
