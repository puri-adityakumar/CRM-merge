import type { ExtractionStats, BatchProgress } from "@/lib/ai/extract";
import type { SkippedRecord } from "@/lib/ai/post-process";
import type { CrmRecord } from "@/lib/schema/crm";
import { parseSseChunk } from "@/lib/import/sse";
import type { ImportFailure, ImportResult, ImportSuccess } from "./import-api";

export type ImportStreamOptions = {
  fetchImpl?: typeof fetch;
  endpoint?: string;
  signal?: AbortSignal;
  /** Called for each server `progress` SSE event. */
  onProgress?: (p: BatchProgress) => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isExtractionStats(value: unknown): value is ExtractionStats {
  if (!isRecord(value)) return false;
  return (
    typeof value.totalRows === "number" &&
    typeof value.totalImported === "number" &&
    typeof value.totalSkipped === "number" &&
    typeof value.batchesProcessed === "number" &&
    typeof value.batchesFailed === "number"
  );
}

function isSuccessBody(value: unknown): value is {
  imported: CrmRecord[];
  skipped: SkippedRecord[];
  stats: ExtractionStats;
} {
  if (!isRecord(value)) return false;
  return (
    Array.isArray(value.imported) &&
    Array.isArray(value.skipped) &&
    isExtractionStats(value.stats)
  );
}

function isBatchProgress(value: unknown): value is BatchProgress {
  if (!isRecord(value)) return false;
  return (
    typeof value.batchIndex === "number" &&
    typeof value.totalBatches === "number" &&
    typeof value.processed === "number"
  );
}

/**
 * POST multipart `file` to `/api/import/stream` and consume SSE events.
 * Returns the same {@link ImportResult} shape as the non-streaming client.
 */
export async function importCsvFileStream(
  file: File | Blob,
  options?: ImportStreamOptions,
): Promise<ImportResult> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const endpoint = options?.endpoint ?? "/api/import/stream";

  const form = new FormData();
  if (typeof File !== "undefined" && file instanceof File) {
    form.append("file", file, file.name || "upload.csv");
  } else {
    form.append("file", file, "upload.csv");
  }

  let response: Response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      body: form,
      signal: options?.signal,
    });
  } catch (err) {
    if (options?.signal?.aborted) {
      return { ok: false, status: 0, error: "Import cancelled" };
    }
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : "Network error",
    };
  }

  // Non-SSE HTTP error path (unlikely for stream route, but safe)
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream") && !response.ok) {
    try {
      const body: unknown = await response.json();
      return {
        ok: false,
        status: response.status,
        error:
          isRecord(body) && typeof body.error === "string"
            ? body.error
            : `Import failed with status ${response.status}`,
        ...(isRecord(body) && typeof body.code === "string"
          ? { code: body.code }
          : {}),
      };
    } catch {
      return {
        ok: false,
        status: response.status,
        error: `Import failed with status ${response.status}`,
      };
    }
  }

  if (!response.body) {
    return {
      ok: false,
      status: response.status || 0,
      error: "Empty stream response body",
    };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastResult: ImportResult | null = null;

  try {
    while (true) {
      if (options?.signal?.aborted) {
        return { ok: false, status: 0, error: "Import cancelled" };
      }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parsed = parseSseChunk(buffer);
      buffer = parsed.rest;

      for (const ev of parsed.events) {
        let data: unknown;
        try {
          data = JSON.parse(ev.data);
        } catch {
          continue;
        }

        if (ev.event === "progress" && isBatchProgress(data)) {
          options?.onProgress?.(data);
          continue;
        }

        if (ev.event === "complete" && isSuccessBody(data)) {
          const success: ImportSuccess = {
            ok: true,
            imported: data.imported,
            skipped: data.skipped,
            stats: data.stats,
          };
          lastResult = success;
          continue;
        }

        if (ev.event === "error" && isRecord(data)) {
          const failure: ImportFailure = {
            ok: false,
            status: typeof data.status === "number" ? data.status : 502,
            error:
              typeof data.error === "string"
                ? data.error
                : "Import stream error",
            ...(typeof data.code === "string" ? { code: data.code } : {}),
          };
          lastResult = failure;
        }
      }
    }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : "Stream read failed",
    };
  }

  if (lastResult) return lastResult;

  return {
    ok: false,
    status: 0,
    error: "Stream ended without complete or error event",
  };
}
