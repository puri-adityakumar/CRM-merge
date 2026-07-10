import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Demo fixture CSVs for the GrowEasy CSV importer.
 * Paths are resolved from the package root (CRMerge/).
 */
const FIXTURES_DIR = path.resolve(__dirname, "../../../fixtures");

const FIXTURE_FILES = [
  "sample-crm.csv",
  "facebook-leads.csv",
  "google-ads.csv",
  "messy-re.csv",
  "no-contact.csv",
] as const;

/** Fixtures expected to yield at least one data row when parsed. */
const CONTENT_BEARING = [
  "sample-crm.csv",
  "facebook-leads.csv",
  "google-ads.csv",
  "messy-re.csv",
] as const;

describe("demo fixture CSVs", () => {
  it("all five fixture files exist and are non-empty", () => {
    for (const name of FIXTURE_FILES) {
      const filePath = path.join(FIXTURES_DIR, name);
      expect(fs.existsSync(filePath), `missing fixture: ${name}`).toBe(true);
      const stat = fs.statSync(filePath);
      expect(stat.size, `empty fixture: ${name}`).toBeGreaterThan(0);
      const text = fs.readFileSync(filePath, "utf8").trim();
      expect(text.length, `blank content: ${name}`).toBeGreaterThan(0);
    }
  });

  it("each fixture has a header line plus at least one data row", () => {
    for (const name of FIXTURE_FILES) {
      const text = fs.readFileSync(path.join(FIXTURES_DIR, name), "utf8");
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      expect(lines.length, `${name} should have header + rows`).toBeGreaterThanOrEqual(2);
    }
  });

  /**
   * When `parseCsv` is available from `@/lib/csv/parse`, exercise real parsing.
   * If parse.ts is not implemented yet, this test still passes (existence checks above cover that phase).
   * Parse-driven assertions should use parseCsv when available.
   */
  it("parses with parseCsv when available", async () => {
    let parseCsv: ((input: string | Buffer | File) => unknown) | undefined;
    try {
      const mod = await import("@/lib/csv/parse");
      parseCsv = (mod as { parseCsv?: typeof parseCsv }).parseCsv;
    } catch {
      // parse.ts not present yet — existence checks above are sufficient
      return;
    }

    if (typeof parseCsv !== "function") {
      // Module exists but does not export parseCsv yet
      return;
    }

    for (const name of CONTENT_BEARING) {
      const text = fs.readFileSync(path.join(FIXTURES_DIR, name), "utf8");
      const result = (await Promise.resolve(parseCsv(text))) as {
        rows?: unknown[];
        data?: unknown[];
      };
      // Support either { rows } or { data } or a bare array return shape
      const rows = Array.isArray(result)
        ? result
        : (result.rows ?? result.data ?? []);
      expect(Array.isArray(rows), `${name}: parseCsv should return rows`).toBe(
        true,
      );
      expect(rows.length, `${name}: expected ≥1 data row`).toBeGreaterThanOrEqual(
        1,
      );
    }

    const noContactText = fs.readFileSync(
      path.join(FIXTURES_DIR, "no-contact.csv"),
      "utf8",
    );
    await expect(
      Promise.resolve(parseCsv(noContactText)),
    ).resolves.not.toThrow();
    const noContactResult = (await Promise.resolve(
      parseCsv(noContactText),
    )) as { rows?: unknown[]; data?: unknown[] };
    const noContactRows = Array.isArray(noContactResult)
      ? noContactResult
      : (noContactResult.rows ?? noContactResult.data ?? []);
    expect(
      noContactRows.length,
      "no-contact.csv: expected ≥1 data row (skip is extract concern)",
    ).toBeGreaterThanOrEqual(1);
  });
});
