import { describe, it, expect } from "vitest";
import { parseCsvForPreview, PreviewParseError } from "./preview-parse";

describe("parseCsvForPreview", () => {
  it("parses multi-column CSV text into headers, rows, and counts", () => {
    const csv = [
      "Full Name,Email Address,Phone",
      "Ada Lovelace,ada@example.com,555",
      "Grace Hopper,grace@example.com,777",
    ].join("\n");

    const result = parseCsvForPreview(csv);

    expect(result.headers).toEqual([
      "Full Name",
      "Email Address",
      "Phone",
    ]);
    expect(result.rows).toEqual([
      {
        "Full Name": "Ada Lovelace",
        "Email Address": "ada@example.com",
        Phone: "555",
      },
      {
        "Full Name": "Grace Hopper",
        "Email Address": "grace@example.com",
        Phone: "777",
      },
    ]);
    expect(result.rowCount).toBe(2);
    expect(result.columnCount).toBe(3);
  });

  it("returns headers with empty rows for headers-only CSV", () => {
    const result = parseCsvForPreview("name,email\n");
    expect(result.headers).toEqual(["name", "email"]);
    expect(result.rows).toEqual([]);
    expect(result.rowCount).toBe(0);
    expect(result.columnCount).toBe(2);
  });

  it("handles headers-only without trailing newline", () => {
    const result = parseCsvForPreview("name,email");
    expect(result.headers).toEqual(["name", "email"]);
    expect(result.rows).toEqual([]);
    expect(result.rowCount).toBe(0);
    expect(result.columnCount).toBe(2);
  });

  it("coerces all cell values to strings", () => {
    const result = parseCsvForPreview("count,flag\n42,true\n");
    expect(result.rows).toEqual([{ count: "42", flag: "true" }]);
    expect(typeof result.rows[0].count).toBe("string");
    expect(typeof result.rows[0].flag).toBe("string");
  });

  it("handles quoted fields that contain commas", () => {
    const csv = ['name,city', '"Lovelace, Ada","London, UK"'].join("\n");
    const result = parseCsvForPreview(csv);
    expect(result.rows).toEqual([
      { name: "Lovelace, Ada", city: "London, UK" },
    ]);
    expect(result.rowCount).toBe(1);
    expect(result.columnCount).toBe(2);
  });

  it("rejects empty string with PreviewParseError", () => {
    expect(() => parseCsvForPreview("")).toThrow(PreviewParseError);
    expect(() => parseCsvForPreview("")).toThrow(/empty|invalid/i);
  });

  it("rejects whitespace-only input with PreviewParseError", () => {
    expect(() => parseCsvForPreview("   \n\t  \n  ")).toThrow(
      PreviewParseError,
    );
    expect(() => parseCsvForPreview("   \n\t  \n  ")).toThrow(
      /empty|invalid|whitespace/i,
    );
  });

  it("accepts ArrayBuffer input when provided", () => {
    const text = "a,b\n1,2\n";
    const buf = new TextEncoder().encode(text).buffer;
    const result = parseCsvForPreview(buf);
    expect(result.headers).toEqual(["a", "b"]);
    expect(result.rows).toEqual([{ a: "1", b: "2" }]);
    expect(result.rowCount).toBe(1);
    expect(result.columnCount).toBe(2);
  });
});
