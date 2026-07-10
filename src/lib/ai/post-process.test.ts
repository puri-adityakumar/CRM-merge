import { describe, it, expect } from "vitest";
import type { CrmRecord } from "@/lib/schema/crm";
import {
  postProcess,
  clampEnum,
  splitMultipleEmails,
  splitMultipleMobiles,
  normalizeDate,
  type PostProcessResult,
  type SkippedRecord,
} from "./post-process";

/**
 * Build a fully-populated, valid baseline record so individual tests only
 * need to override the field(s) under test.
 *
 * `overrides` is typed loosely (any string per field) on purpose: these
 * fixtures simulate raw LLM output, which can violate the strict enum unions
 * on `crm_status` / `data_source`. That is exactly what postProcess is meant
 * to clean up, so we must be able to construct "invalid" records here.
 */
function baseRecord(
  overrides: Partial<{ [K in keyof CrmRecord]: string }> = {},
): CrmRecord {
  return {
    created_at: "2026-05-13T14:20:48.000Z",
    name: "Jane Doe",
    email: "jane@example.com",
    country_code: "+91",
    mobile_without_country_code: "9876543210",
    company: "Acme Inc",
    city: "Bengaluru",
    state: "Karnataka",
    country: "India",
    lead_owner: "Alice",
    crm_status: "GOOD_LEAD_FOLLOW_UP",
    crm_note: "Call back next week",
    data_source: "leads_on_demand",
    possession_time: "Immediate",
    description: "Hot lead from website",
    ...overrides,
  } as CrmRecord;
}

describe("postProcess - partitioning", () => {
  it("returns { imported: [], skipped: [] } for an empty input array", () => {
    const result = postProcess([]);
    expect(result).toEqual({ imported: [], skipped: [] });
  });

  it("imports a fully valid record unchanged (except being passed through)", () => {
    const record = baseRecord();
    const { imported, skipped } = postProcess([record]);
    expect(skipped).toEqual([]);
    expect(imported).toHaveLength(1);
    expect(imported[0]).toEqual(record);
  });

  it("imports a record with email but no mobile", () => {
    const record = baseRecord({ mobile_without_country_code: "" });
    const { imported, skipped } = postProcess([record]);
    expect(imported).toHaveLength(1);
    expect(skipped).toEqual([]);
  });

  it("imports a record with mobile but no email", () => {
    const record = baseRecord({ email: "" });
    const { imported, skipped } = postProcess([record]);
    expect(imported).toHaveLength(1);
    expect(skipped).toEqual([]);
  });

  it("skips a record that has neither email nor mobile", () => {
    const record = baseRecord({ email: "", mobile_without_country_code: "" });
    const { imported, skipped } = postProcess([record]);
    expect(imported).toEqual([]);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].reason).toBe("missing_contact");
    expect(skipped[0].record).toEqual(record);
  });

  it("treats whitespace-only email/mobile as missing (skipped)", () => {
    const record = baseRecord({ email: "   ", mobile_without_country_code: "\t" });
    const { imported, skipped } = postProcess([record]);
    expect(imported).toEqual([]);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].reason).toBe("missing_contact");
  });

  it("correctly partitions a mixed batch", () => {
    const valid = baseRecord({ name: "Valid" });
    const skipMe = baseRecord({
      name: "No Contact",
      email: "",
      mobile_without_country_code: "",
    });
    const badEnum = baseRecord({
      name: "Bad Enum",
      crm_status: "RANDOM",
      data_source: "unknown",
    });
    const { imported, skipped } = postProcess([valid, skipMe, badEnum]);

    expect(imported).toHaveLength(2);
    expect(imported.map((r) => r.name)).toEqual(["Valid", "Bad Enum"]);
    expect(imported[1].crm_status).toBe("");
    expect(imported[1].data_source).toBe("");

    expect(skipped).toHaveLength(1);
    expect(skipped[0].record.name).toBe("No Contact");
  });
});

describe("postProcess - enum clamping", () => {
  it("clamps an invalid crm_status to empty string", () => {
    const record = baseRecord({ crm_status: "RANDOM" });
    const { imported } = postProcess([record]);
    expect(imported[0].crm_status).toBe("");
  });

  it("clamps an invalid data_source to empty string", () => {
    const record = baseRecord({ data_source: "unknown" });
    const { imported } = postProcess([record]);
    expect(imported[0].data_source).toBe("");
  });

  it("preserves valid crm_status values", () => {
    const record = baseRecord({ crm_status: "SALE_DONE" });
    const { imported } = postProcess([record]);
    expect(imported[0].crm_status).toBe("SALE_DONE");
  });

  it("preserves valid data_source values", () => {
    const record = baseRecord({ data_source: "eden_park" });
    const { imported } = postProcess([record]);
    expect(imported[0].data_source).toBe("eden_park");
  });
});

describe("postProcess - merging extra emails/mobiles into crm_note", () => {
  it("keeps the first email and appends the rest to crm_note", () => {
    const record = baseRecord({
      email: "a@x.com, b@y.com",
      crm_note: "",
    });
    const { imported } = postProcess([record]);
    expect(imported[0].email).toBe("a@x.com");
    expect(imported[0].crm_note).toContain("Additional emails");
    expect(imported[0].crm_note).toContain("b@y.com");
  });

  it("splits emails on space, comma, and semicolon", () => {
    const record = baseRecord({
      email: "a@x.com b@y.com;c@z.com, d@w.com",
      crm_note: "",
    });
    const { imported } = postProcess([record]);
    expect(imported[0].email).toBe("a@x.com");
    expect(imported[0].crm_note).toContain("b@y.com");
    expect(imported[0].crm_note).toContain("c@z.com");
    expect(imported[0].crm_note).toContain("d@w.com");
  });

  it("keeps the first mobile and appends the rest to crm_note", () => {
    const record = baseRecord({
      mobile_without_country_code: "1111111111, 2222222222",
      crm_note: "",
    });
    const { imported } = postProcess([record]);
    expect(imported[0].mobile_without_country_code).toBe("1111111111");
    expect(imported[0].crm_note).toContain("Additional numbers");
    expect(imported[0].crm_note).toContain("2222222222");
  });

  it("appends to existing crm_note instead of replacing it", () => {
    const record = baseRecord({
      email: "a@x.com, b@y.com",
      crm_note: "Original note",
    });
    const { imported } = postProcess([record]);
    expect(imported[0].crm_note).toContain("Original note");
    expect(imported[0].crm_note).toContain("b@y.com");
  });

  it("does not touch crm_note when there is only one email and one mobile", () => {
    const record = baseRecord({ crm_note: "Keep me" });
    const { imported } = postProcess([record]);
    expect(imported[0].crm_note).toBe("Keep me");
  });

  it("formats both extras together when both present", () => {
    const record = baseRecord({
      email: "a@x.com, b@y.com",
      mobile_without_country_code: "111, 222",
      crm_note: "",
    });
    const { imported } = postProcess([record]);
    expect(imported[0].crm_note).toContain("Additional emails");
    expect(imported[0].crm_note).toContain("Additional numbers");
  });
});

describe("postProcess - whitespace trimming", () => {
  it("trims whitespace from all string fields", () => {
    const record = baseRecord({
      name: "  Jane Doe  ",
      email: "  jane@example.com  ",
      city: "  Bengaluru  ",
      company: "\tAcme Inc\n",
      description: "  Hot lead  ",
    });
    const { imported } = postProcess([record]);
    expect(imported[0].name).toBe("Jane Doe");
    expect(imported[0].email).toBe("jane@example.com");
    expect(imported[0].city).toBe("Bengaluru");
    expect(imported[0].company).toBe("Acme Inc");
    expect(imported[0].description).toBe("Hot lead");
  });
});

describe("postProcess - created_at normalization", () => {
  it("sets created_at to '' when it cannot be parsed", () => {
    const record = baseRecord({ created_at: "not-a-date" });
    const { imported } = postProcess([record]);
    expect(imported[0].created_at).toBe("");
  });

  it("normalizes a parseable non-ISO date to ISO format", () => {
    // "2026-05-13 14:20:48" is JS-parseable but not ISO 8601.
    const record = baseRecord({ created_at: "2026-05-13 14:20:48" });
    const { imported } = postProcess([record]);
    const normalized = imported[0].created_at;
    expect(normalized).not.toBe("");
    // Round-trip: it must be a valid, re-parseable ISO timestamp.
    const parsed = new Date(normalized);
    expect(parsed.toString()).not.toBe("Invalid Date");
    // And the date portion must match the original.
    expect(parsed.getUTCFullYear()).toBe(2026);
    expect(parsed.getUTCMonth()).toBe(4); // May
    expect(parsed.getUTCDate()).toBe(13);
  });

  it("leaves a valid ISO date intact (as a re-parseable ISO string)", () => {
    const record = baseRecord({ created_at: "2026-05-13T14:20:48Z" });
    const { imported } = postProcess([record]);
    expect(imported[0].created_at).not.toBe("");
    expect(new Date(imported[0].created_at).toString()).not.toBe(
      "Invalid Date",
    );
  });
});

// ---------------------------------------------------------------------------
// Helper unit tests
// ---------------------------------------------------------------------------

describe("clampEnum", () => {
  it("returns the value when it is in the allowed set", () => {
    expect(clampEnum("GOOD_LEAD_FOLLOW_UP", [
      "GOOD_LEAD_FOLLOW_UP",
      "DID_NOT_CONNECT",
    ] as const)).toBe("GOOD_LEAD_FOLLOW_UP");
  });

  it("returns '' when the value is not in the allowed set", () => {
    expect(clampEnum("NOPE", ["GOOD_LEAD_FOLLOW_UP"] as const)).toBe("");
  });

  it("treats '' as valid (allowed missing value)", () => {
    expect(clampEnum("", ["GOOD_LEAD_FOLLOW_UP"] as const)).toBe("");
  });
});

describe("splitMultipleEmails", () => {
  it("returns [first, rest] splitting on mixed delimiters", () => {
    const [first, rest] = splitMultipleEmails("a@x.com b@y.com;c@z.com, d@w.com");
    expect(first).toBe("a@x.com");
    expect(rest).toEqual(["b@y.com", "c@z.com", "d@w.com"]);
  });

  it("returns [value, []] for a single email", () => {
    const [first, rest] = splitMultipleEmails("only@x.com");
    expect(first).toBe("only@x.com");
    expect(rest).toEqual([]);
  });
});

describe("splitMultipleMobiles", () => {
  it("returns [first, rest] splitting on comma/semicolon/slash (not bare spaces)", () => {
    const [first, rest] = splitMultipleMobiles("111-222;333, 444");
    expect(first).toBe("111-222");
    expect(rest).toEqual(["333", "444"]);
  });

  it("keeps spaces inside a single phone number (country code + local)", () => {
    const [first, rest] = splitMultipleMobiles("+91 98111 22334, 9811122335");
    expect(first).toBe("+91 98111 22334");
    expect(rest).toEqual(["9811122335"]);
    expect(first).not.toBe("+91");
  });

  it("splits on slash with surrounding spaces without fragmenting digits", () => {
    const [first, rest] = splitMultipleMobiles("080-41112233 / 9988776655");
    expect(first).toBe("080-41112233");
    expect(rest).toEqual(["9988776655"]);
  });

  it("returns [value, []] for a single mobile", () => {
    const [first, rest] = splitMultipleMobiles("999");
    expect(first).toBe("999");
    expect(rest).toEqual([]);
  });

  it("does not treat space-only multi tokens as separate mobiles", () => {
    // Bare spaces are formatting inside one number, not multi-value separators.
    const [first, rest] = splitMultipleMobiles("+91 98765 43210");
    expect(first).toBe("+91 98765 43210");
    expect(rest).toEqual([]);
  });
});

describe("normalizeDate", () => {
  it("returns '' for an unparseable string", () => {
    expect(normalizeDate("not-a-date")).toBe("");
  });

  it("returns '' for the empty string", () => {
    expect(normalizeDate("")).toBe("");
  });

  it("returns an ISO string for a parseable non-ISO date", () => {
    const out = normalizeDate("2026-05-13 14:20:48");
    expect(out).not.toBe("");
    expect(new Date(out).toString()).not.toBe("Invalid Date");
  });
});

// ---------------------------------------------------------------------------
// Type-level guards (ensures the exported shapes are what callers expect)
// ---------------------------------------------------------------------------

describe("exported types", () => {
  it("PostProcessResult has imported and skipped arrays", () => {
    const result: PostProcessResult = postProcess([]);
    expect(Array.isArray(result.imported)).toBe(true);
    expect(Array.isArray(result.skipped)).toBe(true);
  });

  it("SkippedRecord carries record, reason and optional rowIndex", () => {
    const skipped: SkippedRecord = {
      record: baseRecord(),
      reason: "missing_contact",
      rowIndex: 3,
    };
    expect(skipped.reason).toBe("missing_contact");
    expect(skipped.rowIndex).toBe(3);
  });
});
