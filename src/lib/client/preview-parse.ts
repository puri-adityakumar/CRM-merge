import Papa from "papaparse";

/**
 * Thrown when preview CSV input is empty, whitespace-only, or otherwise unusable.
 * Client UI can map this to a toast / inline error.
 */
export class PreviewParseError extends Error {
  readonly name = "PreviewParseError";

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Client-side CSV preview result (headers + sample rows, no AI). */
export type CsvPreviewResult = {
  headers: string[];
  rows: Record<string, string>[];
  rowCount: number;
  columnCount: number;
};

/**
 * Parse CSV text (or ArrayBuffer) for upload preview.
 *
 * - Keys are header names from the first row.
 * - Values are always strings.
 * - Headers-only → headers filled, rows `[]`, rowCount 0.
 * - Empty / whitespace-only → throws {@link PreviewParseError}.
 */
export function parseCsvForPreview(
  input: string | ArrayBuffer,
): CsvPreviewResult {
  const text = normalizeInput(input);
  assertUsableCsvText(text);

  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
  });

  if (hasFatalParseError(parsed.errors)) {
    const first = parsed.errors[0];
    throw new PreviewParseError(
      first?.message
        ? `Invalid CSV: ${first.message}`
        : "Invalid CSV: could not parse input",
    );
  }

  if (!parsed.meta.fields || parsed.meta.fields.length === 0) {
    throw new PreviewParseError("Invalid CSV: no header row detected");
  }

  const usableHeaders = parsed.meta.fields.filter(
    (h) => h != null && String(h).trim() !== "",
  );
  if (usableHeaders.length === 0) {
    throw new PreviewParseError(
      "Invalid CSV: header row has no usable column names",
    );
  }

  const headers = parsed.meta.fields.map((h) => String(h));
  const rows = parsed.data.map(rowToStringRecord);

  return {
    headers,
    rows,
    rowCount: rows.length,
    columnCount: headers.length,
  };
}

function normalizeInput(input: string | ArrayBuffer): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof ArrayBuffer) {
    return new TextDecoder("utf-8").decode(input);
  }
  throw new PreviewParseError(
    "Invalid CSV: input must be a string or ArrayBuffer",
  );
}

function assertUsableCsvText(text: string): void {
  if (text.length === 0) {
    throw new PreviewParseError("Invalid CSV: input is empty");
  }
  if (text.trim().length === 0) {
    throw new PreviewParseError("Invalid CSV: input is whitespace-only");
  }
}

function hasFatalParseError(errors: Papa.ParseError[]): boolean {
  const fatalTypes = new Set(["UndetectableDelimiter", "MissingQuotes"]);
  return errors.some(
    (e) =>
      e.type === "Quotes" || fatalTypes.has(e.code) || e.type === "Delimiter",
  );
}

function rowToStringRecord(
  row: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value == null) {
      out[key] = "";
    } else {
      out[key] = String(value);
    }
  }
  return out;
}
