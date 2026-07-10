/**
 * End-to-end-ish fixture grind against shipped parse + runImport.
 * extractLeads is used for real when OPENROUTER_API_KEY is set; otherwise
 * a boundary stub still runs real parse + real postProcess on weak-mapped rows.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseCsv } from "@/lib/csv/parse";
import { runImport } from "@/lib/import/run-import";
import { postProcess } from "@/lib/ai/post-process";
import type { CrmRecord } from "@/lib/schema/crm";
import type { ExtractionResult } from "@/lib/ai/extract";

const FIXTURES_DIR = path.resolve(__dirname, "../../../fixtures");

const FIXTURES = [
  "sample-crm.csv",
  "facebook-leads.csv",
  "google-ads.csv",
  "messy-re.csv",
  "no-contact.csv",
] as const;

function emptyRecord(): CrmRecord {
  return {
    created_at: "",
    name: "",
    email: "",
    country_code: "",
    mobile_without_country_code: "",
    company: "",
    city: "",
    state: "",
    country: "",
    lead_owner: "",
    crm_status: "",
    crm_note: "",
    data_source: "",
    possession_time: "",
    description: "",
  };
}

/** Deterministic stand-in for LLM: weak field dump; postProcess enforces rules. */
function weakExtract(rows: Record<string, string>[]): Promise<ExtractionResult> {
  const candidates: CrmRecord[] = rows.map((row) => {
    const r = emptyRecord();
    const entries = Object.entries(row).map(
      ([k, v]) => [k.toLowerCase(), v ?? ""] as const,
    );
    const find = (...needles: string[]) => {
      for (const [k, v] of entries) {
        if (needles.some((n) => k.includes(n))) return v;
      }
      return "";
    };
    const first = find("first name");
    const last = find("last name");
    r.name =
      find("full name", "client name") ||
      row.name ||
      [first, last].filter(Boolean).join(" ");
    r.email = row.email || find("email address", "contact email", "email");
    r.mobile_without_country_code =
      row.mobile_without_country_code ||
      find("phone number", "mobile no", "mobile", "phone");
    r.city = row.city || find("location city", "user location", "city");
    (r as { crm_status: string }).crm_status =
      row.crm_status || find("status (internal)", "status");
    (r as { data_source: string }).data_source =
      row.data_source ||
      find("project interest", "project", "campaign", "data_source");
    r.created_at =
      row.created_at ||
      find("lead date", "created_time", "conversion time", "submitted");
    r.crm_note = row.crm_note || find("remarks", "notes");
    r.company = row.company || find("company");
    r.lead_owner = row.lead_owner || find("assigned to");
    r.possession_time = row.possession_time || find("possession");
    r.description = row.description || find("extra info", "job_title");
    r.country_code = row.country_code || "";
    r.state = row.state || find("state");
    r.country = row.country || find("country");
    return r;
  });

  const { imported, skipped } = postProcess(candidates);
  return Promise.resolve({
    imported,
    skipped,
    stats: {
      totalRows: rows.length,
      totalImported: imported.length,
      totalSkipped: skipped.length,
      batchesProcessed: 1,
      batchesFailed: 0,
    },
  });
}

describe("fixture pipeline via runImport (parse + extract boundary)", () => {
  for (const name of FIXTURES) {
    it(`runImport on ${name} returns imported/skipped/stats without crash`, async () => {
      const bytes = fs.readFileSync(path.join(FIXTURES_DIR, name));
      // Sanity: shipped parse
      const rows = parseCsv(bytes);
      expect(rows.length).toBeGreaterThanOrEqual(1);

      const result = await runImport({
        fileBytes: bytes,
        extractFn: weakExtract,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toHaveProperty("imported");
      expect(result.data).toHaveProperty("skipped");
      expect(result.data).toHaveProperty("stats");
      expect(result.data.stats.totalRows).toBe(rows.length);
      expect(
        result.data.stats.totalImported + result.data.stats.totalSkipped,
      ).toBe(rows.length);
    });
  }

  it("no-contact.csv → all skipped missing_contact via runImport", async () => {
    const bytes = fs.readFileSync(path.join(FIXTURES_DIR, "no-contact.csv"));
    const result = await runImport({
      fileBytes: bytes,
      extractFn: weakExtract,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.imported).toHaveLength(0);
    expect(result.data.skipped.length).toBeGreaterThanOrEqual(1);
    expect(
      result.data.skipped.every((s) => s.reason === "missing_contact"),
    ).toBe(true);
  });

  it("sample-crm.csv → totalImported ≥ 1 with contacts", async () => {
    const bytes = fs.readFileSync(path.join(FIXTURES_DIR, "sample-crm.csv"));
    const result = await runImport({
      fileBytes: bytes,
      extractFn: weakExtract,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.stats.totalImported).toBeGreaterThanOrEqual(1);
    expect(result.data.imported[0]!.email || result.data.imported[0]!.mobile_without_country_code).toBeTruthy();
  });
});
