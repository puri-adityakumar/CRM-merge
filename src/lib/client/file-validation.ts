import { DEFAULT_MAX_UPLOAD_BYTES } from "@/config/constants";

/**
 * Client-side max CSV upload size — mirrors the server default (5 MiB).
 */
export const CLIENT_MAX_UPLOAD_BYTES = DEFAULT_MAX_UPLOAD_BYTES;

/** Successful client-side upload validation. */
export type ValidateUploadSuccess = { ok: true };

/** Failed client-side upload validation. */
export type ValidateUploadFailure = {
  ok: false;
  code: "NOT_CSV" | "FILE_TOO_LARGE";
  message: string;
};

export type ValidateUploadResult = ValidateUploadSuccess | ValidateUploadFailure;

/**
 * True when the file looks like CSV by extension (case-insensitive `.csv`)
 * and/or `text/csv` MIME type.
 */
export function isCsvFile(file: { name: string; type?: string }): boolean {
  const name = file.name ?? "";
  const lower = name.toLowerCase();
  if (lower.endsWith(".csv")) {
    return true;
  }
  if (file.type != null && file.type.toLowerCase() === "text/csv") {
    return true;
  }
  return false;
}

/**
 * Validate a browser File (or file-like) for CSV upload UI.
 *
 * - Rejects non-CSV (extension + MIME).
 * - Rejects size strictly greater than `maxBytes` (default
 *   {@link CLIENT_MAX_UPLOAD_BYTES}); equal size is allowed.
 * - Prefer NOT_CSV when both checks would fail.
 */
export function validateUploadFile(
  file: { name: string; size: number; type?: string },
  maxBytes: number = CLIENT_MAX_UPLOAD_BYTES,
): ValidateUploadResult {
  if (!isCsvFile(file)) {
    return {
      ok: false,
      code: "NOT_CSV",
      message: "Only CSV files are supported. Please upload a .csv file.",
    };
  }

  if (file.size > maxBytes) {
    return {
      ok: false,
      code: "FILE_TOO_LARGE",
      message: `File is too large: exceeds the limit of ${maxBytes} bytes.`,
    };
  }

  return { ok: true };
}
