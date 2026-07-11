import { chunk } from "@/lib/csv/batch";
import { parseLlmCrmRecord, type CrmRecord } from "@/lib/schema/crm";
import { buildSystemPrompt, buildUserMessage } from "./prompt";
import { postProcess, type SkippedRecord } from "./post-process";
import { callLlm, LlmHttpError } from "./client";

/** Aggregate stats for a single {@link extractLeads} run. */
export interface ExtractionStats {
  totalRows: number;
  totalImported: number;
  totalSkipped: number;
  batchesProcessed: number;
  batchesFailed: number;
}

/** The final result of extracting leads from a CSV. */
export interface ExtractionResult {
  imported: CrmRecord[];
  skipped: SkippedRecord[];
  stats: ExtractionStats;
}

/** Progress payload emitted once per completed batch. */
export interface BatchProgress {
  /** Zero-based index of the batch that just finished. */
  batchIndex: number;
  /** Total number of batches the run was split into. */
  totalBatches: number;
  /** Number of batches finished so far (including this one). */
  processed: number;
}

/**
 * Per-entry metadata collected alongside each CrmRecord candidate. Only
 * skip candidates carry a `reason`; valid records leave it undefined so
 * that {@link postProcess} can decide (and assign "missing_contact").
 */
interface CandidateMeta {
  reason?: string;
  /** Global row index across the whole CSV (for display in skipped list). */
  originalRowIndex?: number;
}

/** Builds a CrmRecord with every field blanked out (the skip placeholder). */
function emptyRecord(): CrmRecord {
  return {
    created_at: "",
    name: "",
    email: "",
    country_code: "",
    mobile_without_country_code: "",
    company: "",
    city: "",
    state: "",
    country: "",
    lead_owner: "",
    crm_status: "",
    crm_note: "",
    data_source: "",
    possession_time: "",
    description: "",
  };
}

/**
 * Reads a comma-separated env var (`LLM_FALLBACK_MODELS`) into a clean,
 * deduplicated list. The primary model is excluded from fallbacks to
 * avoid double-counting against rate limits.
 */
function readModelList(): string[] {
  const primary = (process.env.LLM_MODEL || "").trim();
  const fallbacks = (process.env.LLM_FALLBACK_MODELS || "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const models: string[] = [];
  for (const m of [primary, ...fallbacks]) {
    if (m && !seen.has(m)) {
      seen.add(m);
      models.push(m);
    }
  }
  if (models.length === 0) {
    return ["meta-llama/llama-3.3-70b-instruct:free"];
  }
  return models;
}

/**
 * Parses the LLM's raw text response into the `records` array. Tolerates
 * markdown fences and leading/trailing prose by extracting the outermost
 * JSON object. Returns `null` if the response is not valid JSON or has no
 * `records` array — the caller treats that as a model failure.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseRecordsResponse(raw: string): any[] | null {
  let text = raw.trim();

  // Strip ```json ... ``` / ``` ... ``` fences if present.
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  // If there's still surrounding prose, zoom in on the outermost {...} block.
  if (text.startsWith("{") === false) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      text = text.slice(start, end + 1);
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  if (
    parsed &&
    typeof parsed === "object" &&
    Array.isArray((parsed as { records?: unknown }).records)
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (parsed as { records: any[] }).records;
  }
  return null;
}

/** Promise-based sleep used for exponential backoff. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calls `callLlm` for a single model, retrying ONLY non-rate-limit transient
 * errors (5xx/network) up to `maxRetries` extra times with exponential
 * backoff. 429 responses are NOT retried at this layer — they bubble up
 * immediately so the fallback chain can try a different model instead.
 *
 * When the error carries a `retryAfterMs` hint (from a 429), it is
 * preserved in the thrown error so the caller can wait before the next
 * model attempt.
 */
async function callWithRetries(
  model: string,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  maxRetries: number,
): Promise<string> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await callLlm({
        model,
        messages,
        temperature: 0,
        responseFormat: "json_object",
      });
    } catch (err) {
      lastError = err;
      const isLlmError = err instanceof LlmHttpError;
      const isRateLimited = isLlmError && err.status === 429;
      const retryable =
        isLlmError &&
        !isRateLimited && // 429s bubble up to fallback, not retried here
        err.retryable === true;

      if (!retryable || attempt === maxRetries) {
        throw err;
      }
      await sleep(1000 * 2 ** attempt);
    }
  }
  throw lastError;
}

/**
 * Tries every model in `models` in order, each with its own retry budget
 * (for 5xx/network). 429 responses skip retries at the model level and
 * move to the next fallback immediately. When a 429 carries a
 * `retryAfterMs` hint, we wait for that duration before trying the next
 * model rather than burning requests into a rate-limit wall. Throws the
 * last error if all models fail.
 */
async function callWithFallback(
  models: string[],
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  maxRetries: number,
): Promise<string> {
  let lastError: unknown;
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      return await callWithRetries(model, messages, maxRetries);
    } catch (err) {
      lastError = err;
      // Honor the provider's rate-limit cooldown before trying the next model.
      // Skip the sleep on the last model — there's no next attempt, so waiting
      // just adds dead time before the batch is recorded as failed.
      if (
        err instanceof LlmHttpError &&
        err.status === 429 &&
        err.retryAfterMs &&
        i < models.length - 1
      ) {
        await sleep(err.retryAfterMs);
      }
    }
  }
  throw lastError;
}

/**
 * Extracts CRM leads from parsed CSV rows by batching them through an LLM
 * (OpenRouter) and post-processing the result.
 *
 * Robustness features:
 * - Rows are chunked by `BATCH_SIZE` (default 25).
 * - Each batch is sent to the primary model, then fallback models in order.
 * - Each model is retried up to `MAX_RETRIES` times on 429/5xx with backoff.
 * - A batch that fails every model is logged and its rows are recorded as
 *   skipped (reason "extraction_failed"); processing continues.
 * - All surviving candidates are run through {@link postProcess} once at the
 *   end to enforce enum clamping, the skip rule, and multi-value splitting.
 *
 * `onProgress` is invoked after each batch completes (success or failure).
 */
export async function extractLeads(
  rows: Record<string, unknown>[],
  onProgress?: (p: BatchProgress) => void,
): Promise<ExtractionResult> {
  const batchSize = Number.parseInt(process.env.BATCH_SIZE || "", 10) || 25;
  const maxRetries =
    Number.parseInt(process.env.MAX_RETRIES || "", 10) || 2;

  const stats: ExtractionStats = {
    totalRows: rows.length,
    totalImported: 0,
    totalSkipped: 0,
    batchesProcessed: 0,
    batchesFailed: 0,
  };

  if (rows.length === 0) {
    return { imported: [], skipped: [], stats };
  }

  const batches = chunk(rows, batchSize);
  const models = readModelList();
  const systemPrompt = buildSystemPrompt();

  // Minimum interval between batch starts (ms). Keeps us under free-tier
  // RPM limits by serializing batches with a cooldown gap.
  const batchIntervalMs =
    Number.parseInt(process.env.BATCH_INTERVAL_MS || "", 10) || 3000;

  let lastBatchEnd = 0;

  // Collected across all batches, then handed to postProcess in one shot.
  const collected: CrmRecord[] = [];
  const meta: CandidateMeta[] = [];
  // Skipped records from fully-failed batches (bypass postProcess).
  const failedSkipped: SkippedRecord[] = [];

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    const batchStartIndex = batches
      .slice(0, batchIndex)
      .reduce((sum, b) => sum + b.length, 0);

    // Ensure minimum gap between batches to stay under RPM limits.
    const elapsed = Date.now() - lastBatchEnd;
    if (elapsed < batchIntervalMs && batchIndex > 0) {
      await sleep(batchIntervalMs - elapsed);
    }

    const messages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: buildUserMessage(batch) },
    ];

    let rawResponse: string;
    try {
      rawResponse = await callWithFallback(models, messages, maxRetries);
    } catch (err) {
      // Entire batch failed every model + retry. Log and record rows as
      // skipped with reason "extraction_failed"; keep going.
      stats.batchesFailed += 1;
      console.error(
        `[extractLeads] batch ${batchIndex} failed for all models:`,
        err,
      );
      for (let i = 0; i < batch.length; i++) {
        failedSkipped.push({
          record: emptyRecord(),
          reason: "extraction_failed",
          rowIndex: batchStartIndex + i,
        });
      }
      stats.batchesProcessed += 1;
      lastBatchEnd = Date.now();
      onProgress?.({
        batchIndex,
        totalBatches: batches.length,
        processed: stats.batchesProcessed,
      });
      continue;
    }

    const entries = parseRecordsResponse(rawResponse);
    if (entries === null) {
      // Model returned non-JSON / no records array — treat like a failed batch.
      stats.batchesFailed += 1;
      console.error(
        `[extractLeads] batch ${batchIndex}: unparseable LLM response`,
      );
      for (let i = 0; i < batch.length; i++) {
        failedSkipped.push({
          record: emptyRecord(),
          reason: "extraction_failed",
          rowIndex: batchStartIndex + i,
        });
      }
      stats.batchesProcessed += 1;
      lastBatchEnd = Date.now();
      onProgress?.({
        batchIndex,
        totalBatches: batches.length,
        processed: stats.batchesProcessed,
      });
      continue;
    }

    for (const entry of entries) {
      const localRowIndex =
        entry && typeof entry.rowIndex === "number"
          ? entry.rowIndex
          : undefined;
      const globalRowIndex =
        localRowIndex !== undefined
          ? batchStartIndex + localRowIndex
          : undefined;

      const shouldSkip =
        entry?.skip === true || entry?.data == null;

      if (shouldSkip) {
        // LLM-flagged skip (missing_contact) or null data → blank record.
        const reason =
          typeof entry?.reason === "string" && entry.reason.trim() !== ""
            ? entry.reason
            : "missing_contact";
        collected.push(emptyRecord());
        meta.push({ reason, originalRowIndex: globalRowIndex });
        continue;
      }

      // skip: false → loose-coerce LLM data (enums/dates fixed in postProcess).
      // Strict crmRecordSchema would drop whole rows on informal status/source.
      const coerced = parseLlmCrmRecord(entry?.data);
      if (coerced) {
        collected.push(coerced);
        meta.push({ originalRowIndex: globalRowIndex });
      } else {
        collected.push(emptyRecord());
        meta.push({ reason: "parse_error", originalRowIndex: globalRowIndex });
      }
    }

    stats.batchesProcessed += 1;
    onProgress?.({
      batchIndex,
      totalBatches: batches.length,
      processed: stats.batchesProcessed,
    });
  }

  // Enforce business rules across the full collected set in one pass.
  const { imported, skipped } = postProcess(collected);

  // Reconcile per-candidate reasons with postProcess's partitioning.
  // postProcess assigns skipped.rowIndex = index in the `collected` array,
  // which lets us look up the original tracked reason / row index.
  const reconciledSkipped: SkippedRecord[] = skipped.map((s) => {
    const idx = typeof s.rowIndex === "number" ? s.rowIndex : undefined;
    const m = idx !== undefined ? meta[idx] : undefined;
    return {
      record: s.record,
      reason: m?.reason ?? s.reason,
      rowIndex: m?.originalRowIndex ?? s.rowIndex,
    };
  });

  const finalSkipped = [...reconciledSkipped, ...failedSkipped];

  stats.totalImported = imported.length;
  stats.totalSkipped = finalSkipped.length;

  return { imported, skipped: finalSkipped, stats };
}
