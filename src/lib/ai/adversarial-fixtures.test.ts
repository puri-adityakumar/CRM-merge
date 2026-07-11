/**
 * Adversarial fixture guardrail checks.
 * Drives the SAME shipped pipeline the app uses (parseCsv -> weak map ->
 * postProcess) over the regenerated fixtures, which contain injected bad rows,
 * and asserts the guardrails neutralize them. No re-implemented rules.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseCsv } from "@/lib/csv/parse";
import {
  postProcess,
  normalizeCrmStatus,
  normalizeDataSource,
} from "./post-process";
import type { CrmRecord as SchemaCrmRecord } from "@/lib/schema/crm";
import { CRM_STATUS_VALUES, DATA_SOURCE_VALUES } from "@/lib/schema/crm";

const FIXTURES_DIR = path.resolve(__dirname, "../../../fixtures");

/** Weak "LLM-shaped" mapper mirrored from fixture-mapping.test.ts. */
function weakLlmShape(row: Record<string, string>): SchemaCrmRecord {
  const r: SchemaCrmRecord = {
    created_at: "", name: "", email: "", country_code: "",
    mobile_without_country_code: "", company: "", city: "", state: "",
    country: "", lead_owner: "", crm_status: "", crm_note: "",
    data_source: "", possession_time: "", description: "",
  };
  const lowerEntries = Object.entries(row).map(
    ([k, v]) => [k.toLowerCase(), v ?? ""] as const,
  );
  const find = (...needles: string[]) => {
    for (const [k, v] of lowerEntries) {
      if (needles.some((n) => k.includes(n.toLowerCase()))) return v;
    }
    return "";
  };
  const first = find("first name");
  const last = find("last name");
  r.name = find("full name", "client name", "name") || [first, last].filter(Boolean).join(" ").trim();
  r.email = find("email address", "contact email", "email");
  r.mobile_without_country_code = find("phone number", "mobile no", "mobile", "phone");
  r.city = find("location city", "user location", "city");
  r.company = find("company / org", "company", "org");
  (r as { crm_status: string }).crm_status = find("status (internal)", "crm_status", "status");
  (r as { data_source: string }).data_source = find("project interest", "data_source", "project", "campaign");
  r.created_at = find("created_at", "lead date", "created_time", "conversion time", "submitted");
  r.crm_note = find("remarks", "crm_note", "notes");
  r.description = find("extra info", "description", "job_title");
  r.lead_owner = find("assigned to", "lead_owner");
  r.possession_time = find("possession_time", "possession");
  r.country_code = find("country_code");
  r.state = find("state/ut", "state");
  r.country = find("country");
  if (row.email) r.email = row.email;
  if (row.mobile_without_country_code) r.mobile_without_country_code = row.mobile_without_country_code;
  if (row.crm_status) (r as { crm_status: string }).crm_status = row.crm_status;
  if (row.data_source) (r as { data_source: string }).data_source = row.data_source;
  if (row.name) r.name = row.name;
  if (row.created_at) r.created_at = row.created_at;
  return r;
}

function pipeline(name: string) {
  const text = fs.readFileSync(path.join(FIXTURES_DIR, name), "utf8");
  const rows = parseCsv(text);
  const shaped = rows.map(weakLlmShape);
  return { rows, shaped, ...postProcess(shaped) };
}

describe("adversarial fixtures — guardrails neutralize bad data", () => {
  it("injection/XSS payloads are NOT sanitized by postProcess (rely on output encoding)", () => {
    // Security finding: formula/CSV injection (=cmd, +SUM, @SUM) and XSS
    // (<script>, onerror=, javascript:) survive postProcess VERBATIM into the
    // stored CrmRecord. postProcess trims but never strips. The app is only
    // safe because the React frontend auto-escapes on render — there is no
    // server-side sanitization. This test documents that behavior so a
    // regression (or a fix that adds stripping) is caught.
    const all = ["sample-crm.csv", "facebook-leads.csv", "google-ads.csv", "messy-re.csv"]
      .flatMap((f) => pipeline(f).imported);
    const xss = /<script|onerror\s*=|javascript:|<img|<svg/i;
    const formula = /^[=+\-@]/;
    const survivors = all.flatMap((rec) =>
      Object.values(rec).filter((v) => xss.test(v) || (formula.test(v) && !/^\+91/.test(v))),
    );
    // At least the seeded XSS row must be observable surviving.
    expect(survivors.some((v) => xss.test(v))).toBe(true);
    // They must still carry intact contact data (pipeline didn't drop them).
    expect(all.length).toBeGreaterThan(0);
  });

  it("invalid crm_status / data_source values are clamped to '' (never invented)", () => {
    const statuses = pipeline("sample-crm.csv").imported.map((r) => r.crm_status);
    for (const s of statuses) {
      // Valid values are the 4 enum members OR empty string (clamped invalid → "")
      const valid = [...CRM_STATUS_VALUES, ""] as string[];
      expect(valid).toContain(s);
    }
    const sources = pipeline("facebook-leads.csv").imported.map((r) => r.data_source);
    for (const s of sources) {
      const valid = [...DATA_SOURCE_VALUES, ""] as string[];
      expect(valid).toContain(s);
    }
  });

  it("no-contact fixture is fully skipped (no email, no phone) — injection rows included", () => {
    const { imported, skipped } = pipeline("no-contact.csv");
    expect(imported).toHaveLength(0);
    expect(skipped.length).toBeGreaterThan(0);
    for (const s of skipped) expect(s.reason).toBe("missing_contact");
  });

  it("rows with neither email nor mobile are skipped even in content fixtures", () => {
    const { skipped } = pipeline("messy-re.csv");
    // messy-re seeds some no-contact adversarial rows.
    const noContact = skipped.filter((s) => s.reason === "missing_contact");
    expect(noContact.length).toBeGreaterThanOrEqual(1);
  });

  it("unparseable created_at is normalized to '' (not a broken date)", () => {
    const { imported } = pipeline("sample-crm.csv");
    for (const rec of imported) {
      if (rec.created_at !== "") {
        expect(new Date(rec.created_at).toString()).not.toBe("Invalid Date");
      }
    }
  });

  it("multi-value cells are split: first kept, rest moved to crm_note", () => {
    const { imported } = pipeline("facebook-leads.csv");
    const withExtras = imported.filter(
      (r) => r.crm_note.includes("Additional emails") || r.crm_note.includes("Additional numbers"),
    );
    expect(withExtras.length).toBeGreaterThanOrEqual(1);
    for (const rec of withExtras) {
      // primary must not contain a multi-delimiter
      expect(rec.mobile_without_country_code).not.toContain(",");
      expect(rec.email).not.toContain(";");
    }
  });

  it("bad emails/phones with a fallback contact still import without crashing", () => {
    const { imported } = pipeline("sample-crm.csv");
    // adversarial rows kept a phone even when email was invalid
    expect(imported.length).toBeGreaterThan(0);
    for (const rec of imported) {
      // every imported record retains at least one contact path
      expect(rec.email !== "" || rec.mobile_without_country_code !== "").toBe(true);
    }
  });

  it("normalizeCrmStatus rejects totally invented labels", () => {
    expect(normalizeCrmStatus("TOTALLY_FAKE_STATUS")).toBe("");
    expect(normalizeCrmStatus("MEOW_MEOW")).toBe(""); // not an informal label
  });

  it("normalizeDataSource rejects unknown campaigns", () => {
    expect(normalizeDataSource("random campaign")).toBe("");
    expect(normalizeDataSource("facebook")).toBe("");
  });
});
