/**
 * Shared server-side configuration constants for CRMerge APIs.
 */

/** Default max CSV upload size: 5 MiB. */
export const DEFAULT_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Maximum allowed upload size in bytes.
 * Override via `MAX_UPLOAD_BYTES` env (positive integer); falls back to 5 MiB.
 */
export function getMaxUploadBytes(): number {
  const raw = process.env.MAX_UPLOAD_BYTES;
  if (raw != null && raw.trim() !== "") {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) {
      return n;
    }
  }
  return DEFAULT_MAX_UPLOAD_BYTES;
}

/** Alias used by routes and orchestration (resolved at call time via getter when needed). */
export const MAX_UPLOAD_BYTES = DEFAULT_MAX_UPLOAD_BYTES;
