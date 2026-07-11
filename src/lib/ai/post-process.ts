import {
  CRM_STATUS_VALUES,
  DATA_SOURCE_VALUES,
  type CrmRecord,
} from "@/lib/schema/crm";

/**
 * Strip CSV formula injection prefixes from a value.
 * Excel/Docs execute cells starting with =, +, -, or @ as formulas.
 * We strip the prefix so the value becomes inert text.
 */
function stripFormulaPrefix(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  // Formula injection prefixes
  if (/^[=+\-@]/.test(trimmed)) {
    // Strip leading '=' (and whitespace) — the most dangerous one
    if (trimmed.startsWith("=")) return trimmed.slice(1).trim();
    // Strip '@' prefix (e.g. @SUM)
    if (trimmed.startsWith("@") && /^@\w/.test(trimmed)) return trimmed.slice(1).trim();
    // Strip '+' prefix only if followed by a letter (not a phone number)
    if (trimmed.startsWith("+") && /^\+[A-Za-z]/.test(trimmed)) return trimmed.slice(1).trim();
    // Strip '-' prefix only if followed by a letter
    if (trimmed.startsWith("-") && /^\-[A-Za-z]/.test(trimmed)) return trimmed.slice(1).trim();
  }
  return trimmed;
}

/** Fields that should have formula injection stripped. */
const STRIP_FIELDS: readonly (keyof CrmRecord)[] = [
  "name",
  "email",
  "mobile_without_country_code",
  "company",
  "city",
  "state",
  "country",
  "lead_owner",
  "crm_note",
  "description",
] as const;

/**
 * A record that was rejected by post-processing (e.g. it had no contact info),
 * kept for display to the user so they can see what got dropped and why.
 */
export interface SkippedRecord {
  /** The record that was skipped, as it came in (for display). */
  record: CrmRecord;
  /** Machine-stable, human-readable reason key, e.g. "missing_contact". */
  reason: string;
  /** Original row index if available (helps the user locate it in the CSV). */
  rowIndex?: number;
}

/** The output of {@link postProcess}: records split into imported vs skipped. */
export interface PostProcessResult {
  imported: CrmRecord[];
  skipped: SkippedRecord[];
}

/**
 * Delimiters for multi-email cells: comma, semicolon, slash, pipe, or whitespace.
 * Emails rarely contain spaces, so bare space is a safe separator.
 */
const EMAIL_MULTI_DELIMITER = /[\s,;|/]+/;

/**
 * Delimiters for multi-mobile cells: comma, semicolon, slash, pipe only
 * (optional surrounding whitespace). Bare spaces must NOT split — a single
 * phone often looks like `+91 98111 22334`.
 */
const MOBILE_MULTI_DELIMITER = /\s*[,;|/]\s*/;

/**
 * Returns `value` if it is one of the `allowed` enum values (or the allowed
 * empty string), otherwise returns `""`. Case-insensitive exact match is
 * accepted and returned as the canonical allowed member.
 *
 * The return type is `string` (not `T`) because the function can legitimately
 * produce `""`, which is only a member of the CRM record's wider field union,
 * not of `allowed` itself. Callers assigning back into a `CrmRecord` field
 * (whose type already includes `""`) perform the validating assignment.
 */
export function clampEnum<T extends string>(
  value: string,
  allowed: readonly T[],
): string {
  if (value === "") return "";
  if ((allowed as readonly string[]).includes(value)) return value;
  const lower = value.toLowerCase();
  const match = (allowed as readonly string[]).find(
    (a) => a.toLowerCase() === lower,
  );
  return match ?? "";
}

/**
 * Map informal / free-text CRM status labels (from messy CSVs or weak models)
 * onto the hard enum. Unknown labels become `""` (never invent a default status).
 */
export function normalizeCrmStatus(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "") return "";

  // Exact / case-insensitive enum first
  const exact = clampEnum(trimmed, CRM_STATUS_VALUES);
  if (exact !== "") return exact;

  const s = trimmed.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");

  // SALE_DONE
  if (
    /\bsale\s*done\b/.test(s) ||
    /\bclosed\s*won\b/.test(s) ||
    /\bbooking\s*confirm/.test(s) ||
    s === "won" ||
    s === "closed"
  ) {
    return "SALE_DONE";
  }

  // DID_NOT_CONNECT
  if (
    /\bdid\s*not\s*connect\b/.test(s) ||
    /\bnot\s*connected\b/.test(s) ||
    /\bno\s*answer\b/.test(s) ||
    /\bcould\s*not\s*connect\b/.test(s) ||
    s === "dnc"
  ) {
    return "DID_NOT_CONNECT";
  }

  // BAD_LEAD
  if (
    /\bbad\s*lead\b/.test(s) ||
    /\bspam\b/.test(s) ||
    /\binvalid\s*lead\b/.test(s) ||
    s === "junk"
  ) {
    return "BAD_LEAD";
  }

  // GOOD_LEAD_FOLLOW_UP (hot / follow up / good)
  if (
    /\bfollow\s*up\b/.test(s) ||
    /\bgood\s*lead\b/.test(s) ||
    /\bhot\s*lead\b/.test(s) ||
    /\bhot\b/.test(s) ||
    s === "good" ||
    s === "followup"
  ) {
    return "GOOD_LEAD_FOLLOW_UP";
  }

  return "";
}

/**
 * Map informal project / campaign labels onto allowed `data_source` values.
 * Prefer blank when no confident match (never invent).
 */
export function normalizeDataSource(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "") return "";

  const exact = clampEnum(trimmed, DATA_SOURCE_VALUES);
  if (exact !== "") return exact;

  // Normalize separators for fuzzy contains checks
  const s = trimmed.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");

  // Order: more specific multi-word project names first
  if (s.includes("leads on demand") || s.includes("leadsondemand")) {
    return "leads_on_demand";
  }
  if (s.includes("meridian")) {
    return "meridian_tower";
  }
  if (s.includes("eden park") || s.includes("edenpark")) {
    return "eden_park";
  }
  if (s.includes("varah") || s.includes("swamy")) {
    return "varah_swamy";
  }
  if (s.includes("sarjapur")) {
    return "sarjapur_plots";
  }

  return "";
}

/**
 * Splits a cell that may contain multiple email addresses into the first one
 * (kept in place) and the rest (to be merged into crm_note).
 * Returns `[first, rest[]]`. For a single email, `rest` is `[]`.
 */
export function splitMultipleEmails(value: string): [string, string[]] {
  const parts = value
    .split(EMAIL_MULTI_DELIMITER)
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && p !== "/" && p !== "|" && p.includes("@"));
  if (parts.length === 0) {
    // Fallback: original single token if it looked like one email without @ split
    const single = value.trim();
    if (single === "" || single === "/" || single === "|") return ["", []];
    // If delimiters ate a valid single email without @ (unlikely), keep raw
    if (!single.includes("@") && /[\s,;|/]/.test(single)) return ["", []];
    if (single.includes("@")) return [single, []];
    return [single, []];
  }
  return [parts[0], parts.slice(1)];
}

/**
 * Splits a cell that may contain multiple mobile numbers into the first one
 * (kept in place) and the rest (to be merged into crm_note).
 * Returns `[first, rest[]]`. For a single number, `rest` is `[]`.
 *
 * Splits only on `,` `;` `/` `|` (with optional surrounding whitespace).
 * Does **not** split on bare spaces so `+91 98111 22334` stays one phone.
 */
export function splitMultipleMobiles(value: string): [string, string[]] {
  const trimmed = value.trim();
  if (trimmed === "") return ["", []];

  const parts = trimmed
    .split(MOBILE_MULTI_DELIMITER)
    .map((p) => p.trim())
    .filter((p) => {
      if (p.length === 0 || p === "/" || p === "|") return false;
      // Keep tokens that contain at least one digit (phone-like)
      return /\d/.test(p);
    });
  if (parts.length === 0) return ["", []];
  return [parts[0], parts.slice(1)];
}

/**
 * Normalizes a date string to ISO 8601 (`Date.toISOString()`). Returns `""`
 * when the value is empty or cannot be parsed by `Date.parse()`. This lets the
 * LLM return friendly formats like "2026-05-13 14:20:48" and have us canonicalize
 * them rather than discarding them.
 *
 * Also handles common DD/MM/YYYY (and DD-MM-YYYY) when JS `Date.parse` would
 * otherwise mis-handle or fail on locale-ambiguous forms.
 */
export function normalizeDate(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "") return "";

  // DD/MM/YYYY or DD-MM-YYYY (optional time suffix)
  const dmy = trimmed.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T].*)?$/,
  );
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    // Prefer DMY when day > 12 (unambiguous). When both ≤12, still treat as DMY
    // for Indian RE CSVs (assignment domain).
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const iso = new Date(Date.UTC(year, month - 1, day));
      if (!Number.isNaN(iso.getTime())) {
        return iso.toISOString();
      }
    }
  }

  // "02-Apr-2026" style — Date.parse usually works
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return "";
  return new Date(parsed).toISOString();
}

/**
 * Trims a string (null/undefined safe). Generic so it preserves a narrow
 * field type (e.g. the `crm_status` literal union) when trimming a value that
 * is already typed as that field.
 */
function trimField<T extends string>(value: T): T {
  return ((value ?? "") as string).trim() as T;
}

/**
 * Enforces business rules the LLM might violate on a batch of CRM records:
 *
 * 1. Trims whitespace from every string field.
 * 2. Skips records with neither email nor mobile (reason "missing_contact").
 * 3. Fuzzy-normalizes then clamps `crm_status` / `data_source` (invalid -> "").
 * 4. Splits multiple emails / mobiles, keeping the first and appending the
 *    rest to `crm_note` (preserving any existing note content).
 * 5. Normalizes `created_at` to ISO, or "" if unparseable.
 *
 * Records are partitioned into `imported` (kept, cleaned) and `skipped`
 * (dropped with a reason). The input array order is preserved within each.
 */
export function postProcess(records: CrmRecord[]): PostProcessResult {
  const imported: CrmRecord[] = [];
  const skipped: SkippedRecord[] = [];

  records.forEach((record, index) => {
    // 1. Trim everything first so all subsequent checks operate on clean data.
    const trimmed: CrmRecord = {
      created_at: trimField(record.created_at),
      name: trimField(record.name),
      email: trimField(record.email),
      country_code: trimField(record.country_code),
      mobile_without_country_code: trimField(record.mobile_without_country_code),
      company: trimField(record.company),
      city: trimField(record.city),
      state: trimField(record.state),
      country: trimField(record.country),
      lead_owner: trimField(record.lead_owner),
      crm_status: trimField(record.crm_status),
      crm_note: trimField(record.crm_note),
      data_source: trimField(record.data_source),
      possession_time: trimField(record.possession_time),
      description: trimField(record.description),
    };

    // 1a. Strip formula injection prefixes from user-facing text fields.
    for (const field of STRIP_FIELDS) {
      (trimmed as Record<string, string>)[field] = stripFormulaPrefix(
        (trimmed as Record<string, string>)[field],
      );
    }

    // 2. Skip rule: must have at least one way to contact the lead.
    if (trimmed.email === "" && trimmed.mobile_without_country_code === "") {
      skipped.push({
        record: trimmed,
        reason: "missing_contact",
        rowIndex: index,
      });
      return;
    }

    // 3. Fuzzy-normalize informal labels, then clamp to hard enums.
    // Prefer blank over inventing a status/source.
    const statusNorm = normalizeCrmStatus(trimmed.crm_status);
    const sourceNorm = normalizeDataSource(trimmed.data_source);
    trimmed.crm_status = clampEnum(
      statusNorm,
      CRM_STATUS_VALUES,
    ) as CrmRecord["crm_status"];
    trimmed.data_source = clampEnum(
      sourceNorm,
      DATA_SOURCE_VALUES,
    ) as CrmRecord["data_source"];

    // 4. Normalize created_at.
    trimmed.created_at = normalizeDate(trimmed.created_at);

    // 5. Merge extra emails / mobiles into crm_note.
    const noteParts: string[] = [];
    if (trimmed.crm_note !== "") noteParts.push(trimmed.crm_note);

    const [firstEmail, restEmails] = splitMultipleEmails(trimmed.email);
    trimmed.email = firstEmail;
    if (restEmails.length > 0) {
      noteParts.push(`Additional emails: ${restEmails.join(", ")}`);
    }

    const [firstMobile, restMobiles] = splitMultipleMobiles(
      trimmed.mobile_without_country_code,
    );
    trimmed.mobile_without_country_code = firstMobile;
    if (restMobiles.length > 0) {
      noteParts.push(`Additional numbers: ${restMobiles.join(", ")}`);
    }

    // Re-check contact after multi-split (all tokens may have been junk)
    if (trimmed.email === "" && trimmed.mobile_without_country_code === "") {
      skipped.push({
        record: trimmed,
        reason: "missing_contact",
        rowIndex: index,
      });
      return;
    }

    trimmed.crm_note = noteParts.join(" ");

    imported.push(trimmed);
  });

  return { imported, skipped };
}
