/**
 * Fixture-inspired mapping regressions.
 * Drive real parseCsv + postProcess (and normalize helpers) — no re-implemented rules.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseCsv } from "@/lib/csv/parse";
import {
  postProcess,
  normalizeCrmStatus,
  normalizeDataSource,
  splitMultipleEmails,
  splitMultipleMobiles,
} from "./post-process";
import type { CrmRecord as SchemaCrmRecord } from "@/lib/schema/crm";

const FIXTURES_DIR = path.resolve(__dirname, "../../../docs/samples");

const FIXTURE_FILES = [
  "sample-crm.csv",
  "facebook-leads.csv",
  "google-ads.csv",
  "messy-re.csv",
  "no-contact.csv",
] as const;

function emptyRecord(): SchemaCrmRecord {
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

/**
 * Weak "LLM-shaped" mapper: dumps obvious columns without cleaning multi-values
 * or enums — postProcess must fix the rest. Mirrors messy free-model output.
 */
function weakLlmShape(row: Record<string, string>): SchemaCrmRecord {
  const r = emptyRecord();
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
  r.name =
    find("full name", "client name", "name") ||
    [first, last].filter(Boolean).join(" ").trim();
  r.email = find("email address", "contact email", "email");
  r.mobile_without_country_code = find(
    "phone number",
    "mobile no",
    "mobile",
    "phone",
  );
  r.city = find("location city", "user location", "city");
  r.company = find("company / org", "company", "org");
  // Informal enum/date strings are intentional — postProcess normalizes them.
  (r as { crm_status: string }).crm_status = find(
    "status (internal)",
    "crm_status",
    "status",
  );
  (r as { data_source: string }).data_source = find(
    "project interest",
    "data_source",
    "project",
    "campaign",
  );
  r.created_at = find(
    "created_at",
    "lead date",
    "created_time",
    "conversion time",
    "submitted",
  );
  r.crm_note = find("remarks", "crm_note", "notes");
  r.description = find("extra info", "description", "job_title");
  r.lead_owner = find("assigned to", "lead_owner");
  r.possession_time = find("possession_time", "possession");
  r.country_code = find("country_code");
  r.state = find("state/ut", "state");
  r.country = find("country");
  // Prefer explicit CRM columns when present (sample-crm)
  if (row.email) r.email = row.email;
  if (row.mobile_without_country_code) {
    r.mobile_without_country_code = row.mobile_without_country_code;
  }
  if (row.crm_status) {
    (r as { crm_status: string }).crm_status = row.crm_status;
  }
  if (row.data_source) {
    (r as { data_source: string }).data_source = row.data_source;
  }
  if (row.name) r.name = row.name;
  if (row.created_at) r.created_at = row.created_at;
  return r;
}

describe("fixture inventory — parse all five", () => {
  for (const name of FIXTURE_FILES) {
    it(`parses ${name} to ≥1 data row via shipped parseCsv`, () => {
      const text = fs.readFileSync(path.join(FIXTURES_DIR, name), "utf8");
      const rows = parseCsv(text);
      expect(rows.length).toBeGreaterThanOrEqual(1);
      expect(Object.keys(rows[0]!).length).toBeGreaterThan(0);
    });
  }
});

describe("fixture no-contact — postProcess skip rule", () => {
  it("skips every no-contact row with reason missing_contact", () => {
    const text = fs.readFileSync(
      path.join(FIXTURES_DIR, "no-contact.csv"),
      "utf8",
    );
    const rows = parseCsv(text);
    expect(rows.length).toBeGreaterThanOrEqual(1);

    // Even if a "model" invents blank contact fields only
    const shaped = rows.map((row) => {
      const rec = weakLlmShape(row);
      // Force contact empty (model might leave junk elsewhere)
      rec.email = "";
      rec.mobile_without_country_code = "";
      return rec;
    });

    const { imported, skipped } = postProcess(shaped);
    expect(imported).toHaveLength(0);
    expect(skipped).toHaveLength(rows.length);
    for (const s of skipped) {
      expect(s.reason).toBe("missing_contact");
    }
  });

  it("still skips when model leaves whitespace-only contacts from no-contact rows", () => {
    const text = fs.readFileSync(
      path.join(FIXTURES_DIR, "no-contact.csv"),
      "utf8",
    );
    const rows = parseCsv(text);
    const shaped = rows.map((row) => {
      const rec = weakLlmShape(row);
      rec.email = "  ";
      rec.mobile_without_country_code = "\t";
      return rec;
    });
    const { imported, skipped } = postProcess(shaped);
    expect(imported).toHaveLength(0);
    expect(skipped.every((s) => s.reason === "missing_contact")).toBe(true);
  });
});

describe("fixture-inspired multi-contact delimiters", () => {
  it("splits phones separated by slash (facebook / messy-re pattern)", () => {
    const [first, rest] = splitMultipleMobiles("080-41112233 / 9988776655");
    expect(first).toBe("080-41112233");
    expect(rest).toEqual(["9988776655"]);
    expect(rest).not.toContain("/");
  });

  it("does not split facebook-style spaced phone on bare spaces", () => {
    const [first, rest] = splitMultipleMobiles("+91 98111 22334, 9811122335");
    expect(first).toBe("+91 98111 22334");
    expect(first).not.toBe("+91");
    expect(rest).toEqual(["9811122335"]);
  });

  it("splits emails on semicolon (messy-re pattern)", () => {
    const [first, rest] = splitMultipleEmails(
      "fatima.begum@mail.com; fatima.work@corp.in",
    );
    expect(first).toBe("fatima.begum@mail.com");
    expect(rest).toEqual(["fatima.work@corp.in"]);
  });

  it("postProcess merges slash multi-phone into crm_note without slash tokens", () => {
    const record = {
      ...emptyRecord(),
      name: "Vikram",
      email: "vikram@example.com",
      mobile_without_country_code: "080-41112233 / 9988776655",
    } as SchemaCrmRecord;
    const { imported, skipped } = postProcess([record]);
    expect(skipped).toHaveLength(0);
    expect(imported[0]!.mobile_without_country_code).toBe("080-41112233");
    expect(imported[0]!.mobile_without_country_code).not.toBe("/");
    expect(imported[0]!.crm_note).toContain("9988776655");
    expect(imported[0]!.crm_note).not.toMatch(/(^|[^a-zA-Z0-9])\/([^a-zA-Z0-9]|$)/);
  });
});

describe("fixture-inspired informal enum normalization", () => {
  it.each([
    ["follow up soon", "GOOD_LEAD_FOLLOW_UP"],
    ["hot lead / good", "GOOD_LEAD_FOLLOW_UP"],
    ["did not connect", "DID_NOT_CONNECT"],
    ["not connected", "DID_NOT_CONNECT"],
    ["closed won", "SALE_DONE"],
    ["Sale Done", "SALE_DONE"],
    ["bad lead", "BAD_LEAD"],
    ["GOOD_LEAD_FOLLOW_UP", "GOOD_LEAD_FOLLOW_UP"],
    ["totally invented", ""],
  ] as const)("normalizeCrmStatus(%j) → %j", (input, expected) => {
    expect(normalizeCrmStatus(input)).toBe(expected);
  });

  it.each([
    ["Meridian Tower - 3BHK", "meridian_tower"],
    ["Meridian Tower Search", "meridian_tower"],
    ["Eden Park Villa", "eden_park"],
    ["Varah Swamy Residency", "varah_swamy"],
    ["Sarjapur Plots Phase 2", "sarjapur_plots"],
    ["leads_on_demand", "leads_on_demand"],
    ["random campaign", ""],
  ] as const)("normalizeDataSource(%j) → %j", (input, expected) => {
    expect(normalizeDataSource(input)).toBe(expected);
  });

  it("postProcess applies informal status/source from messy-re style LLM output", () => {
    const record = {
      ...emptyRecord(),
      name: "Ravi",
      email: "ravi@example.com",
      mobile_without_country_code: "9876543210",
      crm_status: "follow up soon",
      data_source: "Meridian Tower - 3BHK",
    } as unknown as SchemaCrmRecord;
    const { imported } = postProcess([record]);
    expect(imported[0]!.crm_status).toBe("GOOD_LEAD_FOLLOW_UP");
    expect(imported[0]!.data_source).toBe("meridian_tower");
  });

  it("invalid enums become blank (never invent)", () => {
    const record = {
      ...emptyRecord(),
      email: "a@b.com",
      crm_status: "TOTALLY_FAKE_STATUS",
      data_source: "made_up_source",
    } as unknown as SchemaCrmRecord;
    const { imported } = postProcess([record]);
    expect(imported[0]!.crm_status).toBe("");
    expect(imported[0]!.data_source).toBe("");
  });
});

describe("fixture weak-LLM pipeline — parse + postProcess", () => {
  it("content-bearing fixtures yield imported/skipped partitions without crash", () => {
    const content = [
      "sample-crm.csv",
      "facebook-leads.csv",
      "google-ads.csv",
      "messy-re.csv",
    ] as const;

    for (const name of content) {
      const rows = parseCsv(
        fs.readFileSync(path.join(FIXTURES_DIR, name), "utf8"),
      );
      const shaped = rows.map(weakLlmShape);
      const result = postProcess(shaped);
      expect(result).toHaveProperty("imported");
      expect(result).toHaveProperty("skipped");
      // At least some rows should import when contacts exist
      const withContact = shaped.filter(
        (r) =>
          r.email.trim() !== "" || r.mobile_without_country_code.trim() !== "",
      );
      if (withContact.length > 0) {
        expect(result.imported.length + result.skipped.length).toBe(
          shaped.length,
        );
        expect(result.imported.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("sample-crm weak map preserves valid enums via postProcess", () => {
    const rows = parseCsv(
      fs.readFileSync(path.join(FIXTURES_DIR, "sample-crm.csv"), "utf8"),
    );
    const shaped = rows.map(weakLlmShape);
    const { imported } = postProcess(shaped);
    // Realistic fixtures include some no-contact rows (correctly skipped).
    // Assert that the MAJORITY imported and carry valid enum values.
    expect(imported.length).toBeGreaterThan(0);
    expect(imported.length).toBeGreaterThanOrEqual(rows.length * 0.92);
    const statuses = imported.map((r) => r.crm_status);
    expect(statuses).toContain("GOOD_LEAD_FOLLOW_UP");
    expect(statuses).toContain("SALE_DONE");
  });

  it("facebook multi-phone row keeps full primary phone; secondary goes to note", () => {
    const rows = parseCsv(
      fs.readFileSync(path.join(FIXTURES_DIR, "facebook-leads.csv"), "utf8"),
    );
    // Row with comma multi-phone (Neha): "+91 98111 22334, 9811122335"
    const neha = rows.find((r) =>
      (r["Full Name"] || r["full name"] || "").includes("Neha"),
    );
    expect(neha).toBeTruthy();
    const shaped = weakLlmShape(neha!);
    // Ensure phone field has multi value from fixture
    expect(shaped.mobile_without_country_code).toMatch(/,/);
    expect(shaped.mobile_without_country_code).toMatch(/98111/);

    const { imported } = postProcess([shaped]);
    expect(imported).toHaveLength(1);

    const primary = imported[0]!.mobile_without_country_code;
    // Must keep a usable primary number — not just the country code token.
    expect(primary).not.toBe("+91");
    expect(primary).not.toBe("91");
    expect(primary).toMatch(/98111/);
    expect(primary).not.toContain(",");
    // Spaces inside the first phone are formatting, not extra mobiles.
    expect(primary).toBe("+91 98111 22334");

    // True secondary number lands in crm_note.
    expect(imported[0]!.crm_note).toContain("9811122335");
    expect(imported[0]!.crm_note).toMatch(/Additional numbers/);
  });
});

// Type export smoke — CrmRecord re-export if used
describe("types", () => {
  it("accepts SchemaCrmRecord in postProcess", () => {
    const r: SchemaCrmRecord = emptyRecord();
    r.email = "x@y.com";
    const out = postProcess([r]);
    expect(out.imported).toHaveLength(1);
  });
});
