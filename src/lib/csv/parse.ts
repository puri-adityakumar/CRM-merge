import Papa from "papaparse";

/**
 * Thrown when CSV input is empty, whitespace-only, or otherwise unusable.
 * API routes can map this to HTTP 400/422.
 */
export class CsvParseError extends Error {
  readonly name = "CsvParseError";

  constructor(message: string) {
    super(message);
    // Maintain correct prototype chain when targeting ES5 runtimes.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Successful parse result for {@link parseCsvSafe}. */
export type CsvParseSuccess = {
  ok: true;
  data: Record<string, string>[];
};

/** Failed parse result for {@link parseCsvSafe}. */
export type CsvParseFailure = {
  ok: false;
  error: CsvParseError;
};

export type CsvParseResult = CsvParseSuccess | CsvParseFailure;

/**
 * Parse CSV text or a UTF-8 Buffer into row objects.
 *
 * - Keys are the header names from the first row (arbitrary; not CRM-mapped).
 * - Values are always strings.
 * - Valid header with zero data rows → `[]` (empty import is an API concern).
 * - Empty / whitespace-only / unusable input → throws {@link CsvParseError}.
 *
 * Handles quoted fields and commas inside quotes via papaparse.
 */
export function parseCsv(input: string | Buffer): Record<string, string>[] {
  const text = normalizeInput(input);
  assertUsableCsvText(text);

  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    // Keep everything as strings for the AI mapping layer.
    dynamicTyping: false,
  });

  // Papa reports field-count mismatches etc. as non-fatal errors; treat hard
  // failures (e.g. UndetectableDelimiter on garbage) as unusable input.
  if (hasFatalParseError(parsed.errors)) {
    const first = parsed.errors[0];
    throw new CsvParseError(
      first?.message
        ? `Invalid CSV: ${first.message}`
        : "Invalid CSV: could not parse input",
    );
  }

  // No fields detected means there was no usable header row.
  if (!parsed.meta.fields || parsed.meta.fields.length === 0) {
    throw new CsvParseError(
      "Invalid CSV: no header row detected",
    );
  }

  // All empty header names (e.g. pure null bytes that parse oddly) are unusable.
  const usableHeaders = parsed.meta.fields.filter(
    (h) => h != null && String(h).trim() !== "",
  );
  if (usableHeaders.length === 0) {
    throw new CsvParseError(
      "Invalid CSV: header row has no usable column names",
    );
  }

  return parsed.data.map(rowToStringRecord);
}

/**
 * Non-throwing variant of {@link parseCsv}. Prefer this when callers want a
 * Result they can map to HTTP status codes without try/catch.
 */
export function parseCsvSafe(input: string | Buffer): CsvParseResult {
  try {
    return { ok: true, data: parseCsv(input) };
  } catch (err) {
    if (err instanceof CsvParseError) {
      return { ok: false, error: err };
    }
    return {
      ok: false,
      error: new CsvParseError(
        err instanceof Error ? err.message : "Invalid CSV: unknown parse error",
      ),
    };
  }
}

function normalizeInput(input: string | Buffer): string {
  if (Buffer.isBuffer(input)) {
    return input.toString("utf8");
  }
  if (typeof input !== "string") {
    throw new CsvParseError("Invalid CSV: input must be a string or Buffer");
  }
  return input;
}

/**
 * Reject completely empty / whitespace-only payloads before Papa sees them,
 * so we never return a silent empty success for unusable input.
 */
function assertUsableCsvText(text: string): void {
  if (text.length === 0) {
    throw new CsvParseError("Invalid CSV: input is empty");
  }
  if (text.trim().length === 0) {
    throw new CsvParseError("Invalid CSV: input is whitespace-only");
  }
}

function hasFatalParseError(
  errors: Papa.ParseError[],
): boolean {
  // Papa's "UndetectableDelimiter" fires on garbage with no delimiter.
  // "MissingQuotes" can appear on malformed quoted fields — also fatal here.
  const fatalTypes = new Set(["UndetectableDelimiter", "MissingQuotes"]);
  return errors.some(
    (e) => e.type === "Quotes" || fatalTypes.has(e.code) || e.type === "Delimiter",
  );
}

/**
 * Ensure every cell is a string. Papa with dynamicTyping:false already returns
 * strings for present fields; missing fields may be undefined — normalize to "".
 */
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
