import { z } from "zod";

/**
 * The 15 fixed CRM lead fields that every imported CSV row maps into.
 * Ordered to match the assignment's canonical schema.
 */
export const CRM_FIELDS = [
  "created_at",
  "name",
  "email",
  "country_code",
  "mobile_without_country_code",
  "company",
  "city",
  "state",
  "country",
  "lead_owner",
  "crm_status",
  "crm_note",
  "data_source",
  "possession_time",
  "description",
] as const;

/** Allowed values for the `crm_status` field. */
export const CRM_STATUS_VALUES = [
  "GOOD_LEAD_FOLLOW_UP",
  "DID_NOT_CONNECT",
  "BAD_LEAD",
  "SALE_DONE",
] as const;

/** Allowed values for the `data_source` field. */
export const DATA_SOURCE_VALUES = [
  "leads_on_demand",
  "meridian_tower",
  "eden_park",
  "varah_swamy",
  "sarjapur_plots",
] as const;

export const crmStatusEnum = z.enum(CRM_STATUS_VALUES);
export const dataSourceEnum = z.enum(DATA_SOURCE_VALUES);

/**
 * A plain string field that accepts null/undefined (missing CSV data)
 * and coerces them to an empty string. This keeps downstream code dealing
 * only with `string`, never null.
 */
const blankableString = z
  .string()
  .nullish()
  .transform((v) => v ?? "");

/**
 * An enum field that accepts a valid enum value OR an empty string,
 * coercing null/undefined to "". Invalid enum values still fail.
 */
const blankableEnum = <T extends z.ZodTypeAny>(enumSchema: T) =>
  z
    .union([enumSchema, z.literal("")])
    .nullish()
    .transform((v) => v ?? "");

/**
 * `created_at` must be a JS-parseable date string when present.
 * Empty string / null / undefined are all coerced to "".
 */
const blankableDate = z
  .string()
  .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), {
    message: "Invalid date string",
  })
  .nullish()
  .transform((v) => v ?? "");

/**
 * The full CRM record schema. All 15 fields are optional on input (missing
 * CSV columns / null cells) and normalize to "" via the transforms. Unknown
 * keys are stripped so messy CSVs can't sneak extra data through.
 */
export const crmRecordSchema = z
  .object({
    created_at: blankableDate,
    name: blankableString,
    email: blankableString,
    country_code: blankableString,
    mobile_without_country_code: blankableString,
    company: blankableString,
    city: blankableString,
    state: blankableString,
    country: blankableString,
    lead_owner: blankableString,
    crm_status: blankableEnum(crmStatusEnum),
    crm_note: blankableString,
    data_source: blankableEnum(dataSourceEnum),
    possession_time: blankableString,
    description: blankableString,
  })
  .strip();

export type CrmRecord = z.infer<typeof crmRecordSchema>;

/**
 * Coerce any scalar-ish LLM cell to a trimmed string (or "").
 * Numbers/bools become String(...); objects → "".
 */
const llmString = z.preprocess((v) => {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean" || typeof v === "bigint") {
    return String(v);
  }
  return "";
}, z.string());

/**
 * Loose schema for raw LLM `data` objects.
 * Accepts invalid enums and unparseable dates as plain strings so
 * {@link postProcess} can clamp / normalize instead of dropping the row.
 */
export const llmCrmRecordSchema = z
  .object({
    created_at: llmString,
    name: llmString,
    email: llmString,
    country_code: llmString,
    mobile_without_country_code: llmString,
    company: llmString,
    city: llmString,
    state: llmString,
    country: llmString,
    lead_owner: llmString,
    crm_status: llmString,
    crm_note: llmString,
    data_source: llmString,
    possession_time: llmString,
    description: llmString,
  })
  .strip();

export type LlmCrmRecord = z.infer<typeof llmCrmRecordSchema>;

/**
 * Parse raw LLM output into a record for post-processing.
 * Missing keys default to "". Does not enforce enum/date hard rules.
 */
export function parseLlmCrmRecord(raw: unknown): CrmRecord | null {
  const parsed = llmCrmRecordSchema.safeParse(raw ?? {});
  if (!parsed.success) return null;
  // Cast: enums may still be informal strings until postProcess runs.
  return parsed.data as CrmRecord;
}
