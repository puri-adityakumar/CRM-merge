import type { ExtractionStats } from "@/lib/ai/extract";
import type { SkippedRecord } from "@/lib/ai/post-process";
import type { CrmRecord } from "@/lib/schema/crm";

export type ImportSuccess = {
  ok: true;
  imported: CrmRecord[];
  skipped: SkippedRecord[];
  stats: ExtractionStats;
};

export type ImportFailure = {
  ok: false;
  status: number;
  error: string;
  code?: string;
};

export type ImportResult = ImportSuccess | ImportFailure;

export type ImportCsvFileOptions = {
  /** Injectable fetch for tests (default: global fetch). */
  fetchImpl?: typeof fetch;
  /** Default: `/api/import`. */
  endpoint?: string;
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

function errorMessageFromUnknown(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return fallback;
}

/**
 * POST multipart form field `file` to `/api/import`.
 *
 * @param file - Browser File or Blob (+ optional filename via File.name)
 * @param options.fetchImpl - injectable fetch for tests (default global fetch)
 * @param options.endpoint - default "/api/import"
 */
export async function importCsvFile(
  file: File | Blob,
  options?: ImportCsvFileOptions,
): Promise<ImportResult> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const endpoint = options?.endpoint ?? "/api/import";

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
    });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: errorMessageFromUnknown(err, "Network error"),
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (err) {
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: errorMessageFromUnknown(
          err,
          `Import failed with status ${response.status}`,
        ),
      };
    }
    return {
      ok: false,
      status: response.status,
      error: errorMessageFromUnknown(err, "Malformed import response"),
    };
  }

  if (!response.ok) {
    const error =
      isRecord(body) && typeof body.error === "string"
        ? body.error
        : `Import failed with status ${response.status}`;
    const code =
      isRecord(body) && typeof body.code === "string" ? body.code : undefined;
    return {
      ok: false,
      status: response.status,
      error,
      ...(code !== undefined ? { code } : {}),
    };
  }

  if (!isSuccessBody(body)) {
    return {
      ok: false,
      status: response.status,
      error: "Malformed import response: expected imported, skipped, and stats",
    };
  }

  return {
    ok: true,
    imported: body.imported,
    skipped: body.skipped,
    stats: body.stats,
  };
}
