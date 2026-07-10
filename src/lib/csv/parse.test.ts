import { describe, it, expect } from "vitest";
import { parseCsv, parseCsvSafe, CsvParseError } from "./parse";

describe("parseCsv", () => {
  it("maps arbitrary headers to object keys", () => {
    const csv = ["Full Name,Email Address,Phone", "Ada Lovelace,ada@example.com,555"].join(
      "\n",
    );

    expect(parseCsv(csv)).toEqual([
      {
        "Full Name": "Ada Lovelace",
        "Email Address": "ada@example.com",
        Phone: "555",
      },
    ]);
  });

  it("preserves row order for multi-row CSVs", () => {
    const csv = ["id,name", "1,Ada", "2,Linus", "3,Grace"].join("\n");

    expect(parseCsv(csv)).toEqual([
      { id: "1", name: "Ada" },
      { id: "2", name: "Linus" },
      { id: "3", name: "Grace" },
    ]);
  });

  it("handles quoted fields that contain commas", () => {
    const csv = ['name,city', '"Lovelace, Ada","London, UK"'].join("\n");

    expect(parseCsv(csv)).toEqual([
      { name: "Lovelace, Ada", city: "London, UK" },
    ]);
  });

  it("accepts a Buffer the same way as a string", () => {
    const csv = Buffer.from("a,b\n1,2\n", "utf8");
    expect(parseCsv(csv)).toEqual([{ a: "1", b: "2" }]);
  });

  it("returns [] for headers-only CSV (valid CSV, zero data rows)", () => {
    expect(parseCsv("name,email\n")).toEqual([]);
    expect(parseCsv("name,email")).toEqual([]);
  });

  it("rejects an empty string with CsvParseError", () => {
    expect(() => parseCsv("")).toThrow(CsvParseError);
    expect(() => parseCsv("")).toThrow(/empty|invalid/i);
  });

  it("rejects whitespace-only input with CsvParseError", () => {
    expect(() => parseCsv("   \n\t  \n  ")).toThrow(CsvParseError);
    expect(() => parseCsv("   \n\t  \n  ")).toThrow(/empty|invalid|whitespace/i);
  });

  it("coerces all cell values to strings", () => {
    // Papa may infer numbers; we still want string values for downstream AI mapping.
    const csv = "count,flag\n42,true\n";
    const rows = parseCsv(csv);
    expect(rows).toEqual([{ count: "42", flag: "true" }]);
    expect(typeof rows[0].count).toBe("string");
    expect(typeof rows[0].flag).toBe("string");
  });

  it("documents behavior for unusable garbage input (must fail loudly)", () => {
    // Completely unusable input (no header line that yields a usable CSV shape)
    // must not silently succeed as [].
    expect(() => parseCsv("\u0000\u0000")).toThrow(CsvParseError);
  });
});

describe("parseCsvSafe", () => {
  it("returns { ok: true, data } on success", () => {
    const result = parseCsvSafe("a,b\nx,y\n");
    expect(result).toEqual({
      ok: true,
      data: [{ a: "x", b: "y" }],
    });
  });

  it("returns { ok: false, error } instead of throwing on invalid input", () => {
    const result = parseCsvSafe("");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(CsvParseError);
      expect(result.error.message).toMatch(/empty|invalid/i);
    }
  });
});
