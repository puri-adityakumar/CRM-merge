import { describe, it, expect, vi } from "vitest";
import {
  runImport,
  type ExtractFn,
  type RunImportSuccess,
  type RunImportFailure,
} from "./run-import";
import type { ExtractionResult } from "@/lib/ai/extract";
import { MAX_UPLOAD_BYTES } from "@/config/constants";

const stubStats = {
  totalRows: 2,
  totalImported: 2,
  totalSkipped: 0,
  batchesProcessed: 1,
  batchesFailed: 0,
};

function stubResult(overrides?: Partial<ExtractionResult>): ExtractionResult {
  return {
    imported: [
      {
        created_at: "2024-01-01",
        name: "Ada",
        email: "ada@example.com",
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
      },
    ],
    skipped: [],
    stats: stubStats,
    ...overrides,
  };
}

describe("runImport", () => {
  it("returns 200 success shape with imported, skipped, stats", async () => {
    const extractFn = vi.fn<ExtractFn>(async () => stubResult());
    const csv = Buffer.from("name,email\nAda,ada@example.com\nBob,bob@example.com\n", "utf8");

    const result = await runImport({ fileBytes: csv, extractFn });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const success: RunImportSuccess = result;
    expect(success.status).toBe(200);
    expect(success.data).toHaveProperty("imported");
    expect(success.data).toHaveProperty("skipped");
    expect(success.data).toHaveProperty("stats");
    expect(Array.isArray(success.data.imported)).toBe(true);
    expect(Array.isArray(success.data.skipped)).toBe(true);
    expect(success.data.stats).toMatchObject({
      totalRows: expect.any(Number),
      totalImported: expect.any(Number),
      totalSkipped: expect.any(Number),
      batchesProcessed: expect.any(Number),
      batchesFailed: expect.any(Number),
    });
    expect(extractFn).toHaveBeenCalledOnce();
    expect(extractFn.mock.calls[0]?.[0]).toHaveLength(2);
  });

  it("returns 400 MISSING_FILE when fileBytes is null/undefined", async () => {
    const extractFn = vi.fn(async () => stubResult());

    for (const fileBytes of [null, undefined] as const) {
      const result = await runImport({ fileBytes, extractFn });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      const failure: RunImportFailure = result;
      expect(failure.status).toBe(400);
      expect(failure.code).toBe("MISSING_FILE");
      expect(failure.error).toMatch(/file|missing/i);
    }
    expect(extractFn).not.toHaveBeenCalled();
  });

  it("returns 413 FILE_TOO_LARGE when payload exceeds max bytes", async () => {
    const extractFn = vi.fn(async () => stubResult());
    const maxBytes = 100;
    const fileBytes = Buffer.alloc(maxBytes + 1, 0x61);

    const result = await runImport({ fileBytes, maxBytes, extractFn });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(413);
    expect(result.code).toBe("FILE_TOO_LARGE");
    expect(result.error).toMatch(/large|size|limit/i);
    expect(extractFn).not.toHaveBeenCalled();
  });

  it("uses MAX_UPLOAD_BYTES by default for size checks", async () => {
    const extractFn = vi.fn(async () => stubResult());
    const fileBytes = Buffer.alloc(MAX_UPLOAD_BYTES + 1, 0x61);

    const result = await runImport({ fileBytes, extractFn });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(413);
    expect(result.code).toBe("FILE_TOO_LARGE");
  });

  it("returns 400 INVALID_CSV for unusable / empty string payload", async () => {
    const extractFn = vi.fn(async () => stubResult());
    const result = await runImport({
      fileBytes: Buffer.from("", "utf8"),
      extractFn,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
    expect(result.code).toBe("INVALID_CSV");
    expect(result.error).toMatch(/invalid|empty|csv/i);
    expect(extractFn).not.toHaveBeenCalled();
  });

  it("returns 400 INVALID_CSV for garbage that cannot parse", async () => {
    const extractFn = vi.fn(async () => stubResult());
    const result = await runImport({
      fileBytes: Buffer.from("\u0000\u0000", "utf8"),
      extractFn,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
    expect(result.code).toBe("INVALID_CSV");
    expect(extractFn).not.toHaveBeenCalled();
  });

  it("returns 422 EMPTY_CSV for headers-only CSV (zero data rows)", async () => {
    const extractFn = vi.fn(async () => stubResult());
    const result = await runImport({
      fileBytes: Buffer.from("name,email\n", "utf8"),
      extractFn,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(422);
    expect(result.code).toBe("EMPTY_CSV");
    expect(result.error).toMatch(/empty|no.*row|zero/i);
    expect(extractFn).not.toHaveBeenCalled();
  });

  it("returns 502 EXTRACT_FAILED when extractFn throws", async () => {
    const extractFn = vi.fn(async () => {
      throw new Error("LLM unavailable");
    });
    const result = await runImport({
      fileBytes: Buffer.from("name,email\nAda,ada@example.com\n", "utf8"),
      extractFn,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(502);
    expect(result.code).toBe("EXTRACT_FAILED");
    expect(result.error).toMatch(/extract|llm|fail/i);
    expect(extractFn).toHaveBeenCalledOnce();
  });
});
