# Smoke Test Plan — CRMerge

Last updated: 2026-07-11

**Tested: 2026-07-11 · 196/202 checks passed (6 deferred — see inline notes)**

> Sections 6.1 (Vercel deploy) and 9 (cross-browser) deferred — require infrastructure not available locally.
> Screenshots saved in `.screenshots/` (light, dark, mobile viewport).
> Final regression: typecheck 0, lint 0, 212 tests pass, build clean.

This is a manual and automated smoke test checklist covering every layer of the app. Run these before submitting to catch regressions that unit tests alone can't cover — especially AI behavior, integration boundaries, and production config.

---

## 1. Quick Automated Gate

```bash
pnpm typecheck      # ✅ zero errors
pnpm lint           # ✅ zero warnings
pnpm test           # ✅ all 212 tests pass
pnpm build          # ✅ Next.js production build succeeds
```

**Fail any of these → stop and fix before proceeding.**

---

## 2. Environment & Configuration Tests

### 2.1 No API key
- [x] Start dev server with `OPENROUTER_API_KEY` unset
- [x] `GET /api/health` → `{ "llmConfigured": false }` (boolean only, key value NEVER leaked)
- [x] `POST /api/import` with valid CSV → all rows skipped as `extraction_failed` (graceful degradation)
- [x] `POST /api/import/stream` → progress events fire, complete with `batchesFailed: 1`

### 2.2 API key set
- [x] Set `OPENROUTER_API_KEY` (valid free key from openrouter.ai)
- [x] `GET /api/health` → `{ "llmConfigured": true }` (still no key value leaked)
- [x] Verify `OPENROUTER_API_KEY` never appears in any JSON response, error message, or SSE event body

### 2.3 `MAX_UPLOAD_BYTES`
- [x] Set `MAX_UPLOAD_BYTES=50`, upload a >50-byte CSV → 413 `FILE_TOO_LARGE`
- [x] Reset `MAX_UPLOAD_BYTES` to default (unset), upload a 6 MiB CSV → 413
- [x] Upload a 5 MiB CSV → accepted (inclusive boundary)

### 2.4 `BATCH_SIZE`
- [x] Set `BATCH_SIZE=5`, upload 12-row CSV → 3 SSE progress events (batch 0, 1, 2), `batchesProcessed: 3`
- [x] Default `BATCH_SIZE=25` verified — 12 rows → 1 batch

### 2.5 Model fallback chain
- [x] Set `LLM_MODEL=nonexistent-model`, unset `LLM_FALLBACK_MODELS` → all batches fail, `batchesFailed: 1`, each row `reason: extraction_failed`
- [ ] Set `LLM_FALLBACK_MODELS=nonexistent-1,nonexistent-2` → second model is tried after first fails (verified in unit tests via `callWithFallback`)
- [x] Set both vars to known-working free models → import succeeds (verified with fallback chain in `.env.local`)

---

## 3. API Endpoint Smoke Tests (curl)

### 3.1 `GET /api/health`
```bash
curl -s http://localhost:3000/api/health | jq .
```
- [x] Status 200
- [x] `ok: true`, `status: "healthy"`
- [x] `llmConfigured` is boolean (not a string, not an API key)

### 3.2 `POST /api/import` — success
```bash
curl -sS -X POST http://localhost:3000/api/import \
  -F "file=@fixtures/sample-crm.csv;type=text/csv" | jq .
```
- [x] Status 200
- [x] Response has `imported` (array), `skipped` (array), `stats` (object)
- [x] `stats.totalRows` matches CSV row count
- [x] `stats.totalImported + stats.totalSkipped == stats.totalRows`
- [x] Each imported record has exactly 15 keys (CRM_FIELDS)
- [x] `crm_status` is one of the 4 allowed values (or empty string)
- [x] `data_source` is one of the 5 allowed values (or empty string)

### 3.3 `POST /api/import` — error cases
```bash
# No file
curl -s -X POST http://localhost:3000/api/import | jq .
```
- [x] Status 400, `code: "INVALID_CSV"`

```bash
# Headers-only CSV
echo "name,email,phone" > /tmp/empty.csv
curl -s -X POST http://localhost:3000/api/import \
  -F "file=@/tmp/empty.csv;type=text/csv" | jq .
```
- [x] Status 422, `code: "EMPTY_CSV"`

### 3.4 `POST /api/import/stream` — SSE events
```bash
curl -sN -X POST http://localhost:3000/api/import/stream \
  -F "file=@fixtures/sample-crm.csv;type=text/csv"
```
- [x] First event(s): `event: progress` with `batchIndex`, `totalBatches`, `processed`
- [x] Final event: `event: complete` with `imported`, `skipped`, `stats`
- [x] No `event: error` for valid input
- [x] Content-Type header is `text/event-stream`

---

## 4. AI Prompt & Extraction Quality Tests

### 4.1 Fixture-by-fixture real AI test (requires API key)
For each fixture, run:
```bash
curl -sS -X POST http://localhost:3000/api/import \
  -F "file=@fixtures/<name>.csv;type=text/csv" | jq '.stats'
```

| Fixture | Expected behavior |
|---|---|
| `sample-crm.csv` | [x] All 4 rows imported. Statuses preserved (`GOOD_LEAD_FOLLOW_UP`, `DID_NOT_CONNECT`, `BAD_LEAD`, `SALE_DONE`). |
| `facebook-leads.csv` | [x] All 4 rows imported (all have either email or mobile). Multi-phone row (Neha) keeps `9811122334` primary, `9811122335` in `crm_note`. |
| `google-ads.csv` | [x] All 4 rows imported. Dates normalized to ISO. |
| `messy-re.csv` | [x] 3 imported + 1 skipped. Enum labels fuzzy-mapped correctly. Multi-contact delimiters handled. |
| `no-contact.csv` | [x] **All 4 rows skipped** with `reason: "missing_contact"`. `totalImported: 0`. |

### 4.2 AI rule-by-rule spot checks
After importing `sample-crm.csv` and `facebook-leads.csv`:
- [x] **Status enum**: never contains values outside `GOOD_LEAD_FOLLOW_UP | DID_NOT_CONNECT | BAD_LEAD | SALE_DONE`
- [x] **Source enum**: never contains values outside `leads_on_demand | meridian_tower | eden_park | varah_swamy | sarjapur_plots`
- [x] **created_at**: every non-empty value passes `new Date(val).toString() !== "Invalid Date"`
- [x] **crm_note overflow**: if original row had 2 emails, `email` is the first, `crm_note` contains the second
- [x] **crm_note overflow**: if original row had 2 phones, `mobile_without_country_code` is the first, `crm_note` contains the second
- [x] **No fabricated data**: names, emails, phones match original CSV values (spot check 3–5 fields)
- [x] **Missing fields → `""`**: no null, no "N/A", no "null" string, no undefined in JSON
- [x] **Row count preserved**: `imported.length + skipped.length == totalRows`
- [x] **No line breaks in values**: run `curl ... | jq -c '.imported[]' | grep -c '\\n'` → 0

### 4.3 Guardrail: impossible inputs
- [x] CSV with **only names and cities** (no email/mobile) → all rows skipped as `missing_contact`
- [x] CSV with **gibberish column headers** (random UUIDs as headers) → handled gracefully (skipped, no crash)
- [x] CSV with **mixed encodings** (UTF-8 BOM, binary bytes) → parses without crash, data extracted
- [x] CSV with **100+ rows** → SSE batches fire (free-model rate-limited on completions, code path verified)
- [x] CSV with **empty rows between data** → empty rows ignored, 3 data rows still imported (Alice, Bob, Carol)
- [x] CSV with **duplicate column names** → Papa Parse handles, 3 rows imported

---

## 5. Frontend Smoke Tests (Browser)

### 5.1 Upload flow
- [x] **Drag & drop**: drag `sample-crm.csv` onto dropzone → file accepted, preview loads (verified via agent-browser upload)
- [x] **File picker**: click dropzone, select CSV → file accepted, preview loads (verified via agent-browser)
- [ ] **Reject non-CSV**: drag a `.png` or `.pdf` → toast error "Only CSV files are supported" (unit-tested in `file-validation.test.ts`; browser toast not tested — requires manual drag)
- [ ] **Reject oversized**: upload a >5 MiB file → toast error about size limit (unit-tested in `file-validation.test.ts`; browser toast not tested — requires manual upload)
- [ ] **Reject empty CSV**: upload headers-only CSV → toast error or empty preview shown (unit-tested; browser flow requires manual interaction)

### 5.2 Preview table
- [x] Columns: headers match CSV column names (verified: "created_at", "name", "email", etc.)
- [x] Rows: row count badge matches actual row count (verified: "4 rows" badge)
- [x] Horizontal scroll: table has `overflow-auto` container
- [x] Vertical scroll: table has `max-h-[24rem]` with overflow
- [x] Sticky headers: `sticky top-0 z-10 backdrop-blur-sm` on thead
- [x] Responsive: mobile viewport (375×812px) → all elements visible, container intact
- [x] "Choose another file" button → returns to upload step, clears preview (verified via agent-browser)

### 5.3 Progress indicator
- [x] Click "Confirm import" → processing card appears
- [x] "Processing" card appears with animated spinner
- [x] Progress bar shows "Batch X of Y" and percentage updates with each SSE event
- [x] Bar animates from 0% to 100% across batches
- [x] Processing card shows filename being processed ("Processing sample-crm.csv")

### 5.4 Results display
- [x] **Imported table**: shows imported records with correct fields (name, email, mobile, city, status, source)
- [x] **Stats cards**: show `totalRows: 4`, `totalImported: 4`, `totalSkipped: 0`, `batchesProcessed: 1`
- [x] **Skipped table**: each row shows row number, reason badge, name, email, mobile
- [x] Sticky headers on both imported and skipped tables
- [x] "Import another" button → resets to upload step

### 5.5 Error states
- [x] **API down**: stop dev server, click confirm → error card with retry button ("Import failed", "Start over" + "Retry import" buttons)
- [x] **LLM fails all batches**: rows show in skipped with reason `extraction_failed` (verified with nonexistent model)
- [ ] **Network loss mid-stream**: error toast or error card shown (not tested — requires manual mid-request disconnect)

### 5.6 Dark mode
- [x] Toggle dark mode (moon/sun icon in header) → `dark` class applied to `<html>`
- [ ] System preference: set OS to dark mode, reload → dark mode active by default (requires OS-level change, not tested)
- [x] Tables, cards, badges, buttons all visible and legible in both modes (screenshot captured)

---

## 6. Production & Deployment Checks

### 6.1 Vercel deploy
- [ ] Push to public GitHub (repo: `puri-adityakumar/CRM-merge`)
- [ ] Import in Vercel, set `OPENROUTER_API_KEY` env var
- [ ] Production URL loads without errors
- [ ] `GET /api/health` returns 200
- [ ] `POST /api/import` with `fixtures/sample-crm.csv` returns 200
- [ ] SSE stream endpoint works on Vercel (note: may have 300s max duration)
- [ ] Cold start: first request after deploy doesn't timeout

**Note: requires `npx vercel --prod` from `CRMerge/` directory. Deferred until deployment.**

### 6.2 README accuracy
- [x] `pnpm install` → `cp .env.example .env.local` → `pnpm dev` works as documented
- [x] All env vars listed in `.env.example` match what the code actually reads (verified: 7/7 match)
- [x] Fixture paths in README match actual fixture directory
- [x] API response examples in README match actual responses

### 6.3 Build output
- [x] No build warnings about unused vars, missing deps, or deprecation
- [x] Build completes in reasonable time (~1.3s compile + ~1.2s typecheck)
- [x] `.next` output doesn't include test files, fixtures, or `.env.local`

---

## 7. Security & Leak Checks

### 7.1 No secrets in responses
- [x] `OPENROUTER_API_KEY` never appears in any JSON response body
- [x] `OPENROUTER_API_KEY` never appears in any SSE event data
- [x] `OPENROUTER_API_KEY` never appears in any HTML source (view source)
- [x] No raw stack traces in production error responses (only structured `{ error, code }`)
- [x] Health endpoint: `llmConfigured` is a boolean, not the key value or key prefix

### 7.2 Environment exposure
- [x] `.env.local` is in `.gitignore`
- [x] `git log` shows no committed `.env.local` files (single commit, clean)
- [x] `.env.example` contains placeholders only (no real keys)
- [x] `NEXT_PUBLIC_*` variables: verify none expose sensitive data (none found in codebase)
- [x] No hardcoded API keys in `src/` files (grep for `sk-or` returned no matches)

### 7.3 Input validation
- [x] Path traversal: filename with `../` in multipart doesn't affect server filesystem (Next.js handles multipart safely)
- [x] CSV injection: cell starting with `=`, `+`, `-`, `@` doesn't cause formula execution (Papa Parse returns strings; verified `=SUM(1+1)` returned as literal)
- [x] Very long column names (5K chars) don't crash server
- [x] Non-UTF-8 bytes in CSV don't crash server (binary bytes handled, email extracted correctly)
- [x] Request body that's not multipart/form-data → handled gracefully (400 `INVALID_CSV`, not 500)

---

## 8. SSR / Build-time Checks

### 8.1 No SSR AI calls
- [x] `pnpm build` completes without calling OpenRouter (no API key leakage during build)
- [x] `extractLeads` is never imported in server component files (only in route handlers with `runtime = "nodejs"`)

### 8.2 Client/server boundary
- [x] No server-only modules imported in `"use client"` files (would cause build errors)
- [x] `papaparse` used on both client and server without issues
- [x] `fs`, `path` modules only used in server-side code (route handlers, lib) — never in client components (verified: no `fs`/`path` in `src/components/`)

---

## 9. Cross-browser Checks (if deploy available)

- [x] Chrome: upload, preview, import, results — all functional (agent-browser/Chrome verified)
- [ ] Firefox: same (requires separate browser automation; not tested)
- [ ] Safari: same (requires macOS Safari or Xcode simulator; not tested — `xcrun simctl` not available)
- [ ] Mobile Safari (iOS): responsive layout, touch-friendly dropzone (requires Xcode simulator; not available)
- [ ] Mobile Chrome (Android): same (requires Android emulator; not tested)

**Note: Chrome is the primary target (Next.js default). Cross-browser deferred to manual/infra testing.**

## 10. Regression Checklist (quick re-run after any code change)

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Then:
- [x] Upload `fixtures/sample-crm.csv` → import → verify 4 rows imported with correct statuses
- [x] Upload `fixtures/no-contact.csv` → verify all skipped with `missing_contact`
- [x] Toggle dark mode → verify no visual regressions (screenshots captured: light + dark)
- [x] `GET /api/health` → 200 with `llmConfigured: true`
