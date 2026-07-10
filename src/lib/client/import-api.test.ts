import { describe, it, expect, vi, type Mock } from "vitest";
import { importCsvFile } from "./import-api";
import type { CrmRecord } from "@/lib/schema/crm";
import type { SkippedRecord } from "@/lib/ai/post-process";
import type { ExtractionStats } from "@/lib/ai/extract";

function jsonResponse(
  status: number,
  body: unknown,
  ok = status >= 200 && status < 300,
): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

function emptyRecord(overrides: Partial<CrmRecord> = {}): CrmRecord {
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
    ...overrides,
  };
}

function sampleSuccessBody(): {
  imported: CrmRecord[];
  skipped: SkippedRecord[];
  stats: ExtractionStats;
} {
  return {
    imported: [emptyRecord({ name: "Ada", email: "ada@example.com" })],
    skipped: [
      {
        record: emptyRecord({ name: "No Contact" }),
        reason: "missing_contact",
        rowIndex: 1,
      },
    ],
    stats: {
      totalRows: 2,
      totalImported: 1,
      totalSkipped: 1,
      batchesProcessed: 1,
      batchesFailed: 0,
    },
  };
}

function lastFetchCall(fetchImpl: Mock): [string, RequestInit] {
  const call = fetchImpl.mock.calls.at(-1);
  if (!call || call.length < 2) {
    throw new Error("expected fetch to have been called with url + init");
  }
  return [call[0] as string, call[1] as RequestInit];
}

describe("importCsvFile", () => {
  it("POSTs multipart FormData with field 'file' to /api/import and maps success", async () => {
    const body = sampleSuccessBody();
    const fetchImpl = vi.fn(async () => jsonResponse(200, body));

    const file = new File(["name,email\nAda,ada@example.com\n"], "leads.csv", {
      type: "text/csv",
    });

    const result = await importCsvFile(file, { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = lastFetchCall(fetchImpl);
    expect(url).toBe("/api/import");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);

    const form = init.body as FormData;
    const entry = form.get("file");
    expect(entry).not.toBeNull();
    // undici/Node turns Blob+filename into File
    expect(entry).toBeInstanceOf(Blob);

    expect(result).toEqual({
      ok: true,
      imported: body.imported,
      skipped: body.skipped,
      stats: body.stats,
    });
  });

  it("accepts Blob and still appends as field 'file'", async () => {
    const body = sampleSuccessBody();
    const fetchImpl = vi.fn(async () => jsonResponse(200, body));
    const blob = new Blob(["name,email\nAda,a@b.com\n"], { type: "text/csv" });

    const result = await importCsvFile(blob, { fetchImpl });

    expect(result.ok).toBe(true);
    const [, init] = lastFetchCall(fetchImpl);
    const form = init.body as FormData;
    expect(form.get("file")).toBeInstanceOf(Blob);
  });

  it("uses options.endpoint when provided", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, sampleSuccessBody()),
    );
    const file = new File(["a"], "a.csv");

    await importCsvFile(file, {
      fetchImpl,
      endpoint: "https://example.test/custom-import",
    });

    const [url] = lastFetchCall(fetchImpl);
    expect(url).toBe("https://example.test/custom-import");
  });

  it.each([
    {
      status: 400,
      body: {
        error: "Missing file: multipart field 'file' is required",
        code: "MISSING_FILE",
      },
    },
    {
      status: 413,
      body: {
        error: "File too large: exceeds limit of 50 bytes",
        code: "FILE_TOO_LARGE",
      },
    },
    {
      status: 422,
      body: { error: "CSV has no data rows", code: "EMPTY_CSV" },
    },
  ])(
    "maps HTTP $status error body to ImportFailure",
    async ({ status, body }) => {
      const fetchImpl = vi.fn(async () => jsonResponse(status, body));
      const file = new File(["x"], "x.csv");

      const result = await importCsvFile(file, { fetchImpl });

      expect(result).toEqual({
        ok: false,
        status,
        error: body.error,
        code: body.code,
      });
    },
  );

  it("returns failure when non-OK response has non-JSON body", async () => {
    const fetchImpl = vi.fn(async () =>
      ({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error("not json");
        },
      }) as unknown as Response,
    );

    const result = await importCsvFile(new File(["x"], "x.csv"), {
      fetchImpl,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error).toBeTruthy();
    }
  });

  it("returns failure with status 0 on network rejection", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });

    const result = await importCsvFile(new File(["x"], "x.csv"), {
      fetchImpl,
    });

    expect(result).toEqual({
      ok: false,
      status: 0,
      error: "Failed to fetch",
    });
  });

  it("returns failure when network error is non-Error", async () => {
    const fetchImpl = vi.fn(async () => {
      throw "boom";
    });

    const result = await importCsvFile(new File(["x"], "x.csv"), {
      fetchImpl,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(0);
      expect(result.error).toBeTruthy();
    }
  });

  it("returns failure on 200 with malformed body (missing fields)", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { imported: [], stats: {} }),
    );

    const result = await importCsvFile(new File(["x"], "x.csv"), {
      fetchImpl,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(200);
      expect(result.error).toMatch(/malformed|invalid|unexpected/i);
    }
  });

  it("returns failure on 200 when JSON parse throws", async () => {
    const fetchImpl = vi.fn(async () =>
      ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("Unexpected token");
        },
      }) as unknown as Response,
    );

    const result = await importCsvFile(new File(["x"], "x.csv"), {
      fetchImpl,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(200);
      expect(result.error).toBeTruthy();
    }
  });
});
