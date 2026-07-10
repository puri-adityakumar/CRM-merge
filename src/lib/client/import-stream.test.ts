import { describe, it, expect, vi } from "vitest";
import { importCsvFileStream } from "./import-stream";
import { formatSseEvent } from "@/lib/import/sse";

function sseResponse(body: string, init?: ResponseInit): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
}

describe("importCsvFileStream", () => {
  it("POSTs multipart file to /api/import/stream and maps complete event", async () => {
    const progressSpy = vi.fn();
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe("/api/import/stream");
      expect(init?.method).toBe("POST");
      expect(init?.body).toBeInstanceOf(FormData);
      const form = init!.body as FormData;
      expect(form.get("file")).toBeTruthy();

      const body =
        formatSseEvent("progress", {
          batchIndex: 0,
          totalBatches: 1,
          processed: 1,
        }) +
        formatSseEvent("complete", {
          imported: [{ name: "Ada", email: "a@b.com" }],
          skipped: [],
          stats: {
            totalRows: 1,
            totalImported: 1,
            totalSkipped: 0,
            batchesProcessed: 1,
            batchesFailed: 0,
          },
        });
      return sseResponse(body);
    });

    const blob = new Blob(["name,email\nAda,a@b.com"], { type: "text/csv" });
    const result = await importCsvFileStream(blob, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      onProgress: progressSpy,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.imported).toHaveLength(1);
    expect(result.stats.totalImported).toBe(1);
    expect(progressSpy).toHaveBeenCalledWith({
      batchIndex: 0,
      totalBatches: 1,
      processed: 1,
    });
  });

  it("maps error SSE events to ImportFailure", async () => {
    const fetchImpl = vi.fn(async () =>
      sseResponse(
        formatSseEvent("error", {
          error: "Empty CSV: no data rows (headers only)",
          code: "EMPTY_CSV",
          status: 422,
        }),
      ),
    );

    const result = await importCsvFileStream(new Blob(["x"]), {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(422);
    expect(result.code).toBe("EMPTY_CSV");
    expect(result.error).toMatch(/Empty CSV/);
  });

  it("returns network failure on fetch throw", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    });
    const result = await importCsvFileStream(new Blob(["x"]), {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(0);
    expect(result.error).toBe("offline");
  });
});
