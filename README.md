# CRMerge

AI-powered CSV → GrowEasy CRM importer for the [GrowEasy](https://groweasy.ai) SDE assignment.

Upload any valid CSV (Facebook leads, Google Ads, messy real-estate exports, etc.), preview rows client-side, then confirm to map fields into the fixed 15-field GrowEasy CRM schema using an LLM (OpenRouter).

**Position applied for:** Full-Time

---

## Features

- **Upload** — drag & drop or file picker (`.csv` only, max 5 MiB)
- **Preview** — client-side Papa Parse; no AI until you confirm
- **Import** — multipart upload → server parse → batched LLM extraction → post-process
- **SSE progress** — live batch progress via `POST /api/import/stream`
- **Hard rules in code** — enum clamp, skip without contact, multi email/phone → `crm_note`, date normalize
- **Stateless** — no database, no auth
- **Dark mode**

---

## Tech stack

| Layer | Choice |
|-------|--------|
| App | Next.js (App Router) + TypeScript + Tailwind + shadcn/ui |
| API | Next.js Route Handlers (Node runtime) |
| AI | OpenRouter free models (OpenAI-compatible chat completions) |
| CSV | Papa Parse (client preview + server parse) |
| Deploy target | Vercel |

### Express deviation (assignment note)

The PDF lists **Node.js + Express** for the backend. This project uses **Next.js Route Handlers** on the same Node runtime so the app is a single deployable unit on Vercel.

- Pipeline is still: accept CSV → parse → batch AI → structured JSON  
- Orchestration lives in framework-agnostic modules under `src/lib/` (`runImport`, `extractLeads`, `postProcess`) so an Express adapter could wrap the same functions later  
- See [`docs/DECISIONS.md`](./docs/DECISIONS.md) (D2a)

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

Under [`fixtures/`](./fixtures/):

| File | Description |
|------|-------------|
| `sample-crm.csv` | Clean GrowEasy-shaped rows |
| `facebook-leads.csv` | FB-style headers + multi-phone |
| `google-ads.csv` | Ads export shape |
| `messy-re.csv` | Messy real-estate CRM |
| `no-contact.csv` | Rows without email/mobile (should skip) |

Example:

```bash
curl -sS -X POST http://localhost:3000/api/import \
  -F "file=@fixtures/sample-crm.csv;type=text/csv" | jq .
```

---

## Architecture

```
Client                         Server
─────                          ──────
Upload (react-dropzone)
  → preview parse (Papa)       (no AI)
Confirm
  → POST /api/import/stream    multipart file
       → parseCsv
       → extractLeads (batches → OpenRouter)
       → postProcess (skip / enums / multi-contact / dates)
       → SSE progress + complete
Results table + stats
```

Key modules:

- `src/lib/csv/parse.ts` — server CSV parse  
- `src/lib/ai/extract.ts` — batch LLM + retries/fallback  
- `src/lib/ai/post-process.ts` — hard business rules  
- `src/lib/import/run-import.ts` — orchestration  
- `src/app/api/import/*` — HTTP + SSE  

Docs: [`docs/SPEC.md`](./docs/SPEC.md) (PRD extract), [`docs/PLAN.md`](./docs/PLAN.md), [`docs/DECISIONS.md`](./docs/DECISIONS.md).

---

## CRM fields (15)

`created_at`, `name`, `email`, `country_code`, `mobile_without_country_code`, `company`, `city`, `state`, `country`, `lead_owner`, `crm_status`, `crm_note`, `data_source`, `possession_time`, `description`

**Status enum:** `GOOD_LEAD_FOLLOW_UP` | `DID_NOT_CONNECT` | `BAD_LEAD` | `SALE_DONE`  
**Source enum:** `leads_on_demand` | `meridian_tower` | `eden_park` | `varah_swamy` | `sarjapur_plots`

---

## Deploy (Vercel)

1. Push this repo to public GitHub  
2. Import the project in [Vercel](https://vercel.com) (root directory: `CRMerge` if monorepo)  
3. Set env vars: `OPENROUTER_API_KEY`, `LLM_MODEL`, optional fallbacks / batch size  
4. Deploy and smoke-test with `fixtures/sample-crm.csv`

---

## License

Assignment submission — not for production use without review.
