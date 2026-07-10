/**
 * Shared multipart helpers for import route handlers.
 */

/**
 * Read multipart field `file` into a Buffer, or null if missing/unusable.
 */
export async function readFileField(
  formData: FormData,
): Promise<Buffer | null> {
  const entry = formData.get("file");
  if (entry == null) {
    return null;
  }

  if (typeof File !== "undefined" && entry instanceof File) {
    const ab = await entry.arrayBuffer();
    return Buffer.from(ab);
  }

  if (typeof Blob !== "undefined" && entry instanceof Blob) {
    const ab = await entry.arrayBuffer();
    return Buffer.from(ab);
  }

  if (typeof entry === "string") {
    return null;
  }

  return null;
}
