import { describe, it, expect, expectTypeOf } from "vitest";
import {
  crmRecordSchema,
  crmStatusEnum,
  dataSourceEnum,
  CRM_STATUS_VALUES,
  DATA_SOURCE_VALUES,
  CRM_FIELDS,
  parseLlmCrmRecord,
  type CrmRecord,
} from "./crm";

describe("crmStatusEnum", () => {
  it("exposes the 4 expected status values", () => {
    expect(CRM_STATUS_VALUES).toEqual([
      "GOOD_LEAD_FOLLOW_UP",
      "DID_NOT_CONNECT",
      "BAD_LEAD",
      "SALE_DONE",
    ]);
    expect(crmStatusEnum.options).toEqual(CRM_STATUS_VALUES);
  });
});

describe("dataSourceEnum", () => {
  it("exposes the 5 expected source values", () => {
    expect(DATA_SOURCE_VALUES).toEqual([
      "leads_on_demand",
      "meridian_tower",
      "eden_park",
      "varah_swamy",
      "sarjapur_plots",
    ]);
    expect(dataSourceEnum.options).toEqual(DATA_SOURCE_VALUES);
  });
});

describe("CRM_FIELDS", () => {
  it("lists all 15 field names", () => {
    expect(CRM_FIELDS).toHaveLength(15);
    expect(CRM_FIELDS).toEqual(
      expect.arrayContaining([
        "created_at",
        "name",
        "email",
        "country_code",
        "mobile_without_country_code",
        "company",
        "city",
        "state",
        "country",
        "lead_owner",
        "crm_status",
        "crm_note",
        "data_source",
        "possession_time",
        "description",
      ]),
    );
  });
});

describe("crmRecordSchema", () => {
  it("parses a fully valid record with all 15 fields", () => {
    const input = {
      created_at: "2024-01-15T10:30:00Z",
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
    };

    const result = crmRecordSchema.parse(input);
    expect(result).toEqual(input);
  });

  it("allows empty strings for all string fields", () => {
    const input = {
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

    // Empty strings are NOT valid enum values, so they should be coerced
    // to "" via the nullish transform. Enums should accept "" too because
    // missing data -> blank. We assert the whole thing parses to blanks.
    const result = crmRecordSchema.parse(input);
    expect(Object.values(result).every((v) => v === "")).toBe(true);
  });

  it("rejects an invalid crm_status value", () => {
    const input = { name: "John", crm_status: "SOMETHING_RANDOM" };
    const result = crmRecordSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.path.join(".") === "crm_status"),
      ).toBe(true);
    }
  });

  it("rejects an invalid data_source value", () => {
    const input = { name: "John", data_source: "unknown_source" };
    const result = crmRecordSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.path.join(".") === "data_source"),
      ).toBe(true);
    }
  });

  it.each(CRM_STATUS_VALUES)("accepts crm_status %s", (status) => {
    const result = crmRecordSchema.safeParse({ name: "X", crm_status: status });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.crm_status).toBe(status);
  });

  it.each(DATA_SOURCE_VALUES)("accepts data_source %s", (source) => {
    const result = crmRecordSchema.safeParse({
      name: "X",
      data_source: source,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.data_source).toBe(source);
  });

  it("parses a record missing every field except name (defaults to '')", () => {
    const result = crmRecordSchema.parse({ name: "John" });
    const expected: CrmRecord = {
      created_at: "",
      name: "John",
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
    expect(result).toEqual(expected);
  });

  it("strips extra/unknown fields", () => {
    const input = {
      name: "John",
      extra_field: "should be removed",
      another_one: 123,
    };
    const result = crmRecordSchema.parse(input);
    expect(result).not.toHaveProperty("extra_field");
    expect(result).not.toHaveProperty("another_one");
    expect(Object.keys(result).sort()).toEqual(CRM_FIELDS.slice().sort());
  });

  it("coerces null values to empty string", () => {
    const input = {
      name: null,
      email: null,
      country_code: null,
      mobile_without_country_code: null,
      company: null,
      city: null,
      state: null,
      country: null,
      lead_owner: null,
      crm_status: null,
      crm_note: null,
      data_source: null,
      possession_time: null,
      description: null,
      created_at: null,
    };
    const result = crmRecordSchema.parse(input);
    expect(Object.values(result).every((v) => v === "")).toBe(true);
  });

  it("accepts a created_at that is a JS-parseable date string", () => {
    const result = crmRecordSchema.safeParse({
      name: "X",
      created_at: "2024-03-01",
    });
    expect(result.success).toBe(true);
    expect(new Date(result.success ? result.data.created_at : 0).toString()).not.toBe(
      "Invalid Date",
    );
  });

  it("rejects a created_at that is NOT parseable as a date", () => {
    const result = crmRecordSchema.safeParse({
      name: "X",
      created_at: "not-a-date-xyz",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.path.join(".") === "created_at"),
      ).toBe(true);
    }
  });

  it("produces a record whose keys are exactly the 15 CRM fields", () => {
    const result = crmRecordSchema.parse({ name: "x" });
    expect(Object.keys(result).sort()).toEqual(CRM_FIELDS.slice().sort());
  });
});

describe("parseLlmCrmRecord (loose LLM coercion)", () => {
  it("accepts informal enums and unparseable dates for postProcess to fix", () => {
    const rec = parseLlmCrmRecord({
      name: "Neha",
      email: "neha@x.com",
      crm_status: "follow up soon",
      data_source: "Meridian Tower Interest",
      created_at: "not-quite-a-date",
      mobile_without_country_code: "98111 22334 / 9811122335",
    });
    expect(rec).not.toBeNull();
    expect(rec!.name).toBe("Neha");
    expect(rec!.crm_status).toBe("follow up soon");
    expect(rec!.data_source).toBe("Meridian Tower Interest");
    expect(rec!.created_at).toBe("not-quite-a-date");
  });

  it("coerces numbers to strings and fills missing keys with ''", () => {
    const rec = parseLlmCrmRecord({ name: 42, email: null });
    expect(rec).not.toBeNull();
    expect(rec!.name).toBe("42");
    expect(rec!.email).toBe("");
    for (const f of CRM_FIELDS) {
      expect(rec).toHaveProperty(f);
    }
  });
});

describe("CrmRecord type", () => {
  it("is inferable and has the 15 string-valued fields", () => {
    expectTypeOf<CrmRecord>().toMatchTypeOf<{
      created_at: string;
      name: string;
      email: string;
      country_code: string;
      mobile_without_country_code: string;
      company: string;
      city: string;
      state: string;
      country: string;
      lead_owner: string;
      crm_status: string;
      crm_note: string;
      data_source: string;
      possession_time: string;
      description: string;
    }>();
  });
});
