/**
 * Pure validation helpers for the CSV import HTTP path.
 * Kept free of I/O so unit tests need no Next.js or LLM.
 */

/** Result of {@link checkUploadSize}. */
export type UploadSizeResult =
  | { ok: true }
  | { ok: false; reason: "too_large" };

/**
 * Compare payload size against a max limit (inclusive).
 * `byteLength === maxBytes` is allowed; only strictly greater is too large.
 */
export function checkUploadSize(
  byteLength: number,
  maxBytes: number,
): UploadSizeResult {
  if (byteLength > maxBytes) {
    return { ok: false, reason: "too_large" };
  }
  return { ok: true };
}

/** Coarse classification of import input after size has been accepted. */
export type ImportInputKind = "missing_file" | "empty_rows" | "ok";

export interface ClassifyImportInputArgs {
  /** Whether a file field was present and readable as bytes. */
  hasFile: boolean;
  /** Number of data rows after a successful parse (0 = headers only). */
  rowCount: number;
}

/**
 * Classify missing-file vs empty CSV vs ready-to-extract.
 * Size and parse failures are handled separately by the orchestrator.
 */
export function classifyImportInput(
  args: ClassifyImportInputArgs,
): ImportInputKind {
  if (!args.hasFile) {
    return "missing_file";
  }
  if (args.rowCount === 0) {
    return "empty_rows";
  }
  return "ok";
}
