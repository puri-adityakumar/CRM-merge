import { describe, it, expect } from "vitest";
import { buildSystemPrompt, buildUserMessage } from "./prompt";
import {
  CRM_FIELDS,
  CRM_STATUS_VALUES,
  DATA_SOURCE_VALUES,
} from "@/lib/schema/crm";

describe("buildSystemPrompt", () => {
  it("returns a string", () => {
    const prompt = buildSystemPrompt();
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
  });

  it("is deterministic (same call → same output)", () => {
    expect(buildSystemPrompt()).toBe(buildSystemPrompt());
  });

  describe("schema coverage", () => {
    it("mentions all 15 CRM field names", () => {
      const prompt = buildSystemPrompt();
      for (const field of CRM_FIELDS) {
        expect(prompt).toContain(field);
      }
    });

    it("mentions all 4 crm_status enum values", () => {
      const prompt = buildSystemPrompt();
      for (const status of CRM_STATUS_VALUES) {
        expect(prompt).toContain(status);
      }
    });

    it("mentions all 5 data_source enum values", () => {
      const prompt = buildSystemPrompt();
      for (const source of DATA_SOURCE_VALUES) {
        expect(prompt).toContain(source);
      }
    });
  });

  describe("missing-data handling", () => {
    it("instructs to use empty string for missing data (not null, not omit)", () => {
      const prompt = buildSystemPrompt();
      expect(prompt.toLowerCase()).toContain("empty string");
      // Discourage emitting null/undefined/omitted fields in the data object.
      expect(prompt.toLowerCase()).not.toMatch(
        /do not use.*empty string|never use empty string/,
      );
    });
  });

  describe("date rule", () => {
    it("mentions the new Date / JS date parseable requirement for created_at", () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toMatch(/new Date/i);
      expect(prompt.toLowerCase()).toContain("created_at");
    });
  });

  describe("skip rule", () => {
    it("mentions the skip rule: no email AND no mobile → skip", () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toMatch(/skip/i);
      expect(prompt).toMatch(/missing_contact/);
      expect(prompt.toLowerCase()).toContain("email");
      expect(prompt.toLowerCase()).toContain("mobile");
    });
  });

  describe("multi-contact rule", () => {
    it("mentions multiple emails/mobiles → first into field, rest into crm_note", () => {
      const prompt = buildSystemPrompt();
      const lower = prompt.toLowerCase();
      expect(lower).toContain("crm_note");
      expect(lower).toMatch(/multiple/);
      expect(lower).toMatch(/first/);
      // Either "email" or "mobile" plural mentions of overflow.
      expect(lower).toContain("email");
      expect(lower).toContain("mobile");
    });
  });

  describe("crm_note overflow semantics", () => {
    it("mentions crm_note is for overflow / extra info", () => {
      const prompt = buildSystemPrompt();
      const lower = prompt.toLowerCase();
      expect(lower).toContain("crm_note");
      // Overflow language: remarks, follow-up, extra, etc.
      expect(lower).toMatch(/remark|follow|extra|overflow|comment/);
    });
  });

  describe("output format contract", () => {
    const prompt = () => buildSystemPrompt();

    it("specifies the JSON output format", () => {
      const p = prompt();
      expect(p).toContain("records");
      expect(p).toContain("rowIndex");
      expect(p).toContain("skip");
      expect(p).toContain("data");
    });

    it("tells the LLM to return ONLY JSON (no prose, no markdown)", () => {
      const p = prompt();
      expect(p).toMatch(/only json|json only|strictly json/i);
    });

    it("mentions the skip reason field", () => {
      const promptText = prompt();
      // The output contract should expose a reason field for skipped rows.
      expect(promptText).toContain("reason");
    });
  });

  describe("input flexibility", () => {
    it("mentions the example CSV sources OR states the input can have any column names", () => {
      const p = buildSystemPrompt().toLowerCase();
      const ok =
        p.includes("facebook") ||
        p.includes("google ads") ||
        p.includes("any column") ||
        p.includes("any column names") ||
        p.includes("arbitrary column");
      expect(ok).toBe(true);
    });
  });

  describe("few-shot examples", () => {
    it("includes at least one example output record (JSON snippet)", () => {
      const p = buildSystemPrompt();
      // The prompt should contain a JSON example block with rowIndex.
      expect(p).toMatch(/"rowIndex"/);
    });
  });
});

describe("buildUserMessage", () => {
  it("returns a string", () => {
    const msg = buildUserMessage([{ name: "Ada" }]);
    expect(typeof msg).toBe("string");
    expect(msg.length).toBeGreaterThan(0);
  });

  it("includes the original column headers/names from the rows", () => {
    const rows = [
      { "Full Name": "Ada Lovelace", Email: "ada@example.com" },
      { "Full Name": "Linus", Email: "linus@example.com" },
    ];
    const msg = buildUserMessage(rows);
    expect(msg).toContain("Full Name");
    expect(msg).toContain("Email");
  });

  it("serializes the row values so the LLM can see them", () => {
    const rows = [{ name: "Ada", email: "ada@example.com", age: 36 }];
    const msg = buildUserMessage(rows);
    expect(msg).toContain("Ada");
    expect(msg).toContain("ada@example.com");
    expect(msg).toContain("36");
  });

  it("produces valid JSON (parseable) so it is structured for the model", () => {
    const rows = [
      { name: "Ada", email: "ada@example.com" },
      { name: "Linus", email: "linus@example.com" },
    ];
    const msg = buildUserMessage(rows);
    const parsed = JSON.parse(msg);
    expect(parsed).toHaveProperty("rows");
    expect(Array.isArray(parsed.rows)).toBe(true);
    expect(parsed.rows).toHaveLength(2);
  });

  it("preserves rowIndex/ordering aligned with the input array", () => {
    const rows = [
      { name: "Ada" },
      { name: "Linus" },
      { name: "Grace" },
    ];
    const msg = buildUserMessage(rows);
    const parsed = JSON.parse(msg);
    expect(parsed.rows.map((r: { rowIndex: number }) => r.rowIndex)).toEqual([
      0, 1, 2,
    ]);
    expect(parsed.rows[0].values).toEqual({ name: "Ada" });
  });

  it("includes a list of columns (the union of keys across rows)", () => {
    const rows = [
      { name: "Ada", email: "ada@example.com" },
      { name: "Linus", phone: "123" },
    ];
    const msg = buildUserMessage(rows);
    const parsed = JSON.parse(msg);
    expect(parsed).toHaveProperty("columns");
    expect(Array.isArray(parsed.columns)).toBe(true);
    expect(parsed.columns).toEqual(expect.arrayContaining(["name", "email", "phone"]));
  });

  it("handles an empty array of rows", () => {
    const msg = buildUserMessage([]);
    expect(() => JSON.parse(msg)).not.toThrow();
    const parsed = JSON.parse(msg);
    expect(parsed.rows).toEqual([]);
    expect(parsed.columns).toEqual([]);
  });
});
