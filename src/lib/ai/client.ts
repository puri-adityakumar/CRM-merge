/**
 * Thin OpenRouter (OpenAI-compatible) chat-completions client.
 *
 * The extractor (`extract.ts`) is the only caller; this module intentionally
 * knows nothing about CRM schemas, batching, or retries. It just turns a
 * `{ model, messages }` request into the assistant's content string, and tags
 * HTTP errors with a `.retryable` flag so the caller can decide whether to
 * retry / fall back to another model.
 */

/** OpenAI-style chat message. */
export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Options accepted by {@link callLlm}. */
export interface LlmCallOptions {
  model: string;
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "json_object" | "text";
}

/**
 * Error thrown by {@link callLlm} for non-2xx HTTP responses. Carries a
 * `retryable` flag so the orchestrator can distinguish transient failures
 * (429 rate-limit, 5xx) from permanent ones (401/403/400/etc.).
 */
export class LlmHttpError extends Error {
  readonly status: number;
  readonly retryable: boolean;

  constructor(message: string, status: number, retryable: boolean) {
    super(message);
    this.name = "LlmHttpError";
    this.status = status;
    this.retryable = retryable;
  }
}

/**
 * Calls OpenRouter's `/chat/completions` endpoint and returns the assistant
 * message content for the first choice.
 *
 * @throws {Error}        if `OPENROUTER_API_KEY` is missing or unset.
 * @throws {LlmHttpError} for non-2xx responses, with `.retryable` set true
 *                        for 429 and 5xx, false for other 4xx.
 */
export async function callLlm(opts: LlmCallOptions): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const baseUrl =
    process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";

  if (!apiKey) {
    throw new Error(
      "callLlm: OPENROUTER_API_KEY is not set. Configure it in your environment.",
    );
  }

  // Build the OpenAI-compatible request body. `response_format` is only sent
  // when the caller asks for JSON mode (some models reject the field entirely).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: Record<string, any> = {
    model: opts.model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0,
  };
  if (opts.maxTokens !== undefined) {
    body.max_tokens = opts.maxTokens;
  }
  if (opts.responseFormat === "json_object") {
    body.response_format = { type: "json_object" };
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // HTTP-Referer / X-Title are optional OpenRouter rankings hints; safe
        // to omit but harmless to include.
        "HTTP-Referer": "https://crmerge.app",
        "X-Title": "CRMerge",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    // Network failure (DNS, connection reset, timeout) — treat as retryable;
    // the caller's backoff + fallback chain can ride out a transient blip.
    const e = new LlmHttpError(
      `callLlm: network error: ${(err as Error).message}`,
      0,
      true,
    );
    throw e;
  }

  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500;
    let detail = "";
    try {
      detail = await response.text();
    } catch {
      detail = "";
    }
    throw new LlmHttpError(
      `callLlm: HTTP ${response.status} ${response.statusText}${
        detail ? ` — ${detail}` : ""
      }`,
      response.status,
      retryable,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await response.json();
  const content: string | undefined = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new LlmHttpError(
      "callLlm: malformed response — choices[0].message.content missing",
      response.status,
      false,
    );
  }
  return content;
}
