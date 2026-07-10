/**
 * CSV import orchestration: buffer → size check → parse → extract → response.
 *
 * Pure of HTTP frameworks; inject `extractFn` in tests, use `extractLeads` in prod.
 */

import { MAX_UPLOAD_BYTES } from "@/config/constants";
import { parseCsvSafe } from "@/lib/csv/parse";
import {
  extractLeads,
  type BatchProgress,
  type ExtractionResult,
} from "@/lib/ai/extract";
import { checkUploadSize, classifyImportInput } from "./validate";

/** Stable error codes for API clients. */
export type ImportErrorCode =
  | "MISSING_FILE"
  | "INVALID_CSV"
  | "EMPTY_CSV"
  | "FILE_TOO_LARGE"
  | "EXTRACT_FAILED";

export type RunImportSuccess = {
  ok: true;
  status: 200;
  data: ExtractionResult;
};

export type RunImportFailure = {
  ok: false;
  status: 400 | 413 | 422 | 502;
  error: string;
  code: ImportErrorCode;
};

export type RunImportResult = RunImportSuccess | RunImportFailure;

/** Injectable extract boundary (defaults to real {@link extractLeads}). */
export type ExtractFn = (
  rows: Record<string, string>[],
  onProgress?: (p: BatchProgress) => void,
) => Promise<ExtractionResult>;

export interface RunImportOptions {
  /**
   * Raw file bytes. `null` / `undefined` means the multipart field was missing
   * or not a file → 400 MISSING_FILE.
   */
  fileBytes: Buffer | Uint8Array | null | undefined;
  /** Max upload size; defaults to {@link MAX_UPLOAD_BYTES}. */
  maxBytes?: number;
  /** Extraction implementation; defaults to {@link extractLeads}. */
  extractFn?: ExtractFn;
  /** Optional progress callback forwarded to extract. */
  onProgress?: (p: BatchProgress) => void;
}

function toBuffer(bytes: Buffer | Uint8Array): Buffer {
  return Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
}

/**
 * Run the full import pipeline on in-memory file bytes.
 *
 * Status mapping:
 * - 400 MISSING_FILE — no file bytes
 * - 413 FILE_TOO_LARGE — over maxBytes
 * - 400 INVALID_CSV — parse failure / unusable input
 * - 422 EMPTY_CSV — valid CSV, zero data rows
 * - 502 EXTRACT_FAILED — extractFn threw
 * - 200 — success with `{ imported, skipped, stats }`
 */
export async function runImport(
  options: RunImportOptions,
): Promise<RunImportResult> {
  const {
    fileBytes,
    maxBytes = MAX_UPLOAD_BYTES,
    extractFn = extractLeads as ExtractFn,
    onProgress,
  } = options;

  if (fileBytes == null) {
    return {
      ok: false,
      status: 400,
      error: "Missing file: multipart field 'file' is required",
      code: "MISSING_FILE",
    };
  }

  const buffer = toBuffer(fileBytes);
  const sizeCheck = checkUploadSize(buffer.byteLength, maxBytes);
  if (!sizeCheck.ok) {
    return {
      ok: false,
      status: 413,
      error: `File too large: exceeds limit of ${maxBytes} bytes`,
      code: "FILE_TOO_LARGE",
    };
  }

  const parsed = parseCsvSafe(buffer);
  if (!parsed.ok) {
    return {
      ok: false,
      status: 400,
      error: parsed.error.message || "Invalid CSV",
      code: "INVALID_CSV",
    };
  }

  const rows = parsed.data;
  const kind = classifyImportInput({ hasFile: true, rowCount: rows.length });
  if (kind === "empty_rows") {
    return {
      ok: false,
      status: 422,
      error: "Empty CSV: no data rows (headers only)",
      code: "EMPTY_CSV",
    };
  }

  try {
    const data = await extractFn(rows, onProgress);
    return { ok: true, status: 200, data };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Extraction failed";
    return {
      ok: false,
      status: 502,
      error: `Extract failed: ${message}`,
      code: "EXTRACT_FAILED",
    };
  }
}
