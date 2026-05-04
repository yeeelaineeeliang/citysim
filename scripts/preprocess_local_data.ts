/**
 * One-time preprocessing script. Run with: npm run preprocess
 *
 * Streams the three large CSVs in CityData/, filters to Hyde Park (community area 41)
 * and year 2024, and saves small JSON files to CityData/filtered/.
 *
 * Uses Transform streams (not readline) to avoid V8 heap limits on multi-GB files.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";

const DATA_DIR = path.join(process.cwd(), "CityData");
const OUT_DIR = path.join(DATA_DIR, "filtered");

type CTARow = { date: string; rides: number };
type CrimeRow = { date: string; primaryType: string };
type Row311 = { createdDate: string; closedDate: string | null; srType: string };

// ── CSV parser ────────────────────────────────────────────────────────────────

function readQuotedField(line: string, startPos: number): { field: string; endPos: number } {
  let pos = startPos + 1; // skip opening quote
  let field = "";
  while (pos < line.length) {
    if (line[pos] === '"' && line[pos + 1] === '"') {
      field += '"';
      pos += 2;
    } else if (line[pos] === '"') {
      pos++; // skip closing quote
      break;
    } else {
      field += line[pos++];
    }
  }
  return { field, endPos: pos };
}

function readUnquotedField(line: string, startPos: number): { field: string; endPos: number } {
  let pos = startPos;
  let field = "";
  while (pos < line.length && line[pos] !== ",") field += line[pos++];
  return { field, endPos: pos };
}

function parseRow(line: string): string[] {
  const result: string[] = [];
  let pos = 0;

  while (pos < line.length) {
    const { field, endPos } =
      line[pos] === '"' ? readQuotedField(line, pos) : readUnquotedField(line, pos);
    result.push(field);
    pos = endPos;
    if (line[pos] === ",") pos++;
  }

  return result;
}

const DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})/;

// MM/DD/YYYY [time] → "YYYY-MM-DD" | null
function toISODate(raw: string): string | null {
  const m = DATE_RE.exec(raw);
  if (!m) return null;
  return `${m[3]}-${m[1]}-${m[2]}`;
}

// ── Streaming file processor ──────────────────────────────────────────────────
// Uses Transform streams instead of readline to avoid V8 heap limits on large files.

async function processFile(
  filePath: string,
  onLine: (fields: string[], lineIndex: number) => void,
): Promise<void> {
  let remainder = "";
  let lineIndex = 0;

  const transform = new Transform({
    transform(chunk: Buffer, _enc, done) {
      // Split handles \r\n, \r, and \n — never lets remainder grow to file size
      const parts = (remainder + chunk.toString("utf-8")).split(/\r\n|\r|\n/);
      remainder = parts.pop() ?? "";

      for (const line of parts) {
        if (line.trim()) {
          onLine(fields(line), lineIndex++);
          if (lineIndex % 500_000 === 0) {
            process.stdout.write(`  ${(lineIndex / 1_000_000).toFixed(1)}M rows...\r`);
          }
        }
      }

      done();
    },
    flush(done) {
      if (remainder.trim()) onLine(fields(remainder), lineIndex++);
      done();
    },
  });

  await pipeline(fs.createReadStream(filePath), transform);
  process.stdout.write("\n");
}

function fields(line: string): string[] {
  return parseRow(line);
}

// ── CTA ───────────────────────────────────────────────────────────────────────

async function processCTA(): Promise<CTARow[]> {
  const file = path.join(DATA_DIR, "CTA_-_Ridership_-_Bus_Routes_-_Daily_Totals_by_Route_20260502.csv");
  const out: CTARow[] = [];
  let isHeader = true;

  // Columns: route, date, daytype, rides
  await processFile(file, (f) => {
    if (isHeader) { isHeader = false; return; }
    const [route, date, daytype, ridesRaw] = f;
    if (route !== "6" || daytype !== "W" || !date.includes("2024")) return;
    const iso = toISODate(date);
    if (!iso) return;
    const rides = Number.parseInt(ridesRaw.replaceAll(",", ""), 10);
    if (!Number.isNaN(rides)) out.push({ date: iso, rides });
  });

  return out;
}

// ── Crime ─────────────────────────────────────────────────────────────────────

async function processCrime(): Promise<CrimeRow[]> {
  const file = path.join(DATA_DIR, "Crimes_-_2001_to_Present_20260502.csv");
  const out: CrimeRow[] = [];
  let dateIdx = -1, primaryTypeIdx = -1, communityAreaIdx = -1;
  let isHeader = true;

  // Header: ID, Case Number, Date, Block, IUCR, Primary Type, ..., Community Area, ...
  await processFile(file, (f, lineIdx) => {
    if (lineIdx === 0) {
      dateIdx = f.indexOf("Date");
      primaryTypeIdx = f.indexOf("Primary Type");
      communityAreaIdx = f.indexOf("Community Area");
      isHeader = false;
      return;
    }
    if (isHeader) return;
    if (f[communityAreaIdx] !== "41") return;
    const dateRaw = f[dateIdx] ?? "";
    if (!dateRaw.includes("2024")) return;
    const iso = toISODate(dateRaw);
    if (!iso) return;
    out.push({ date: iso, primaryType: f[primaryTypeIdx] ?? "UNKNOWN" });
  });

  return out;
}

// ── 311 ───────────────────────────────────────────────────────────────────────

async function process311(): Promise<Row311[]> {
  const file = path.join(DATA_DIR, "311_Service_Requests_20260502.csv");
  const out: Row311[] = [];
  let srTypeIdx = -1, createdIdx = -1, closedIdx = -1, communityAreaIdx = -1;
  let isHeader = true;

  // Header: SR_NUMBER, SR_TYPE, ..., CREATED_DATE, ..., CLOSED_DATE, ..., COMMUNITY_AREA, ...
  await processFile(file, (f, lineIdx) => {
    if (lineIdx === 0) {
      srTypeIdx = f.indexOf("SR_TYPE");
      createdIdx = f.indexOf("CREATED_DATE");
      closedIdx = f.indexOf("CLOSED_DATE");
      communityAreaIdx = f.indexOf("COMMUNITY_AREA");
      isHeader = false;
      return;
    }
    if (isHeader) return;
    if (f[communityAreaIdx] !== "41") return;
    const createdRaw = f[createdIdx] ?? "";
    if (!createdRaw.includes("2024")) return;
    const createdDate = toISODate(createdRaw);
    if (!createdDate) return;
    const closedRaw = f[closedIdx] ?? "";
    const closedDate = closedRaw ? (toISODate(closedRaw) ?? null) : null;
    out.push({ createdDate, closedDate, srType: f[srTypeIdx] ?? "" });
  });

  return out;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log("Processing CTA bus ridership (32 MB)...");
  const cta = await processCTA();
  fs.writeFileSync(path.join(OUT_DIR, "cta_route6_2024.json"), JSON.stringify(cta));
  console.log(`  → ${cta.length} Route 6 weekday rows saved.`);

  console.log("Processing crime incidents (2.2 GB — takes ~1 min)...");
  const crime = await processCrime();
  fs.writeFileSync(path.join(OUT_DIR, "crime_hyde_park_2024.json"), JSON.stringify(crime));
  console.log(`  → ${crime.length} crime rows saved.`);

  console.log("Processing 311 service requests (5.6 GB — takes ~3 min)...");
  const s311 = await process311();
  fs.writeFileSync(path.join(OUT_DIR, "311_hyde_park_2024.json"), JSON.stringify(s311));
  console.log(`  → ${s311.length} 311 rows saved.`);

  console.log("Done. Run npm run dev and visit /v2");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
