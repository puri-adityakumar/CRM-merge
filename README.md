# CRMerge

Upload any valid CSV (Facebook leads, Google Ads, messy real-estate exports, etc.), preview rows client-side, then confirm to transform them into clean, structured output using AI (OpenRouter).


---

## Tech stack

| Layer | Choice |
|-------|--------|
| App | Next.js (App Router) + TypeScript + Tailwind + shadcn/ui |
| API | Next.js Route Handlers (Node runtime) |
| AI | OpenRouter chat completions (multi-model chain with fallback) |
| CSV | Papa Parse (client preview + server parse) |

---

## Quick start

```bash
# From repo root
cd CRMerge
pnpm install

# Env
cp .env.example .env.local
# Edit .env.local — set OPENROUTER_API_KEY from https://openrouter.ai/keys

pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Dev server |
| `pnpm build` / `pnpm start` | Production build & start |
| `pnpm test` | Vitest unit/integration suite |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |

---

## Environment variables

Copy [`.env.example`](./.env.example):

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | Yes (for AI import) | OpenRouter API key |
| `OPENROUTER_BASE_URL` | No | Default `https://openrouter.ai/api/v1` |
| `LLM_MODEL` | No | Primary model id |
| `LLM_FALLBACK_MODELS` | No | Comma-separated fallback model ids |
| `BATCH_SIZE` | No | Rows per LLM batch (default `25`) |
| `MAX_RETRIES` | No | Retries per model on 429/5xx (default `2`) |
| `BATCH_INTERVAL_MS` | No | Cooldown between batches (default `3000`) |
| `MAX_UPLOAD_BYTES` | No | Max upload size (default 5 MiB) |

---

## API

### `GET /api/health`

```json
{ "ok": true, "status": "healthy", "llmConfigured": true }
```

Does **not** expose secret values.

### `POST /api/import`

Multipart form field **`file`** (CSV).

**200**

```json
{
  "imported": [ /* CrmRecord */ ],
  "skipped": [ /* { record, reason, rowIndex? } */ ],
  "stats": {
    "totalRows": 4,
    "totalImported": 3,
    "totalSkipped": 1,
    "batchesProcessed": 1,
    "batchesFailed": 0
  }
}
```

| Status | Code | When |
|--------|------|------|
| 400 | `MISSING_FILE` / `INVALID_CSV` | No file or unusable CSV |
| 413 | `FILE_TOO_LARGE` | Over max bytes |
| 422 | `EMPTY_CSV` | Headers only, zero data rows |
| 502 | `EXTRACT_FAILED` | LLM / extract threw |

### `POST /api/import/stream`

Same multipart `file`, responds with **SSE** (`text/event-stream`):

| Event | Payload |
|-------|---------|
| `progress` | `{ batchIndex, totalBatches, processed }` |
| `complete` | `{ imported, skipped, stats }` |
| `error` | `{ error, code, status }` |

The UI uses the stream endpoint for confirm → results.

---

## Demo fixtures

Under [`public/samples/`](./public/samples/):

| File | Description |
|------|-------------|
| `sample-crm.csv` | Structured CRM rows |
| `facebook-leads.csv` | FB-style headers + multi-phone |
| `google-ads.csv` | Ads export shape |
| `messy-re.csv` | Messy real-estate CRM |
| `no-contact.csv` | Rows without email/mobile (should skip) |

Example:

```bash
curl -sS -X POST http://localhost:3000/api/import \
  -F "file=@public/samples/sample-crm.csv;type=text/csv" | jq .
```

---

## Architecture

Full architecture diagram and flow: [ARCHITECTURE.md](./ARCHITECTURE.md)

Key modules:

- `src/lib/csv/parse.ts` — server CSV parse  
- `src/lib/ai/extract.ts` — batch LLM + retries/fallback  
- `src/lib/ai/post-process.ts` — hard business rules + guardrails
- `src/lib/guardrails/detect.ts` — violation detection engine  
- `src/lib/import/run-import.ts` — orchestration  
- `src/app/api/import/*` — HTTP + SSE  

Samples: [`public/samples/`](./public/samples/) — 5 CSV fixtures for testing.

## Guardrails

The `postProcess` step applies hard business rules the LLM may violate:

- **Formula injection stripped** — Leading `=`, `@`, `+`, `-` prefixes on text fields are removed (e.g. `=cmd|/c calc.exe` → `cmd|/c calc.exe`). `+91` phone numbers are preserved.
- **Invalid enums clamped** — Unknown `crm_status` / `data_source` values are forced to `""` (empty). No invented values leak through.
- **XSS passed through** — `<script>`, `onerror=`, and similar strings are stored as-is but never executed; React auto-escapes on render.
- **Violation detection** — Results table shows `xss`, `sql`, or `formula` badges on rows containing suspicious patterns.

---

## CRM fields (15)

`created_at`, `name`, `email`, `country_code`, `mobile_without_country_code`, `company`, `city`, `state`, `country`, `lead_owner`, `crm_status`, `crm_note`, `data_source`, `possession_time`, `description`

**Status enum:** `GOOD_LEAD_FOLLOW_UP` | `DID_NOT_CONNECT` | `BAD_LEAD` | `SALE_DONE`  
**Source enum:** `leads_on_demand` | `meridian_tower` | `eden_park` | `varah_swamy` | `sarjapur_plots`

