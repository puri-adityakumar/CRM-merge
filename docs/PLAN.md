# CRMerge — Implementation Plan & Task Breakdown

> **PRD (single source of truth):** [`SDE-assingment.pdf`](../../SDE-assingment.pdf) → extract in [`SPEC.md`](./SPEC.md)  
> **How we build (non-PRD):** [`DECISIONS.md`](./DECISIONS.md)  
> Greenfield Next.js fullstack. No csv-importer. No Express (see DECISIONS D2a).  
> **Strategy:** P0 core → P1 bonuses → P2 polish. Ship deployable MVP ASAP.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  NEXT.JS 15 (App Router) — single app on Vercel              │
│                                                              │
│  Client                                                      │
│    Step machine: upload → preview → processing → results     │
│    Papa Parse (preview only)                                 │
│    Confirm → multipart POST + SSE reader                     │
│    shadcn tables, dark mode, progress                        │
│                                                              │
│  Server (Route Handlers)                                     │
│    POST /api/import                                          │
│    POST /api/import/stream   (SSE)                           │
│    GET  /api/health                                          │
│         ↓                                                    │
│    parseCsv(file) → chunk(rows) → extractBatch() × N         │
│         ↓              ↑                                     │
│    postProcess()   Vercel AI SDK → OpenRouter                │
│         ↓                                                    │
│    { imported, skipped, stats }                              │
└──────────────────────────────────────────────────────────────┘
```

### Folder structure (target)

```
CRMerge/
├── README.md
├── package.json
├── .env.example
├── docs/
│   ├── SPEC.md
│   ├── PLAN.md
│   └── PROMPT.md                 # full system prompt (write before AI wire-up)
├── fixtures/                     # demo CSVs
├── public/
└── src/
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx              # step orchestration
    │   ├── globals.css
    │   └── api/
    │       ├── health/route.ts
    │       ├── import/route.ts
    │       └── import/stream/route.ts
    ├── components/
    │   ├── ui/                   # shadcn
    │   ├── upload-zone.tsx
    │   ├── preview-table.tsx
    │   ├── results-table.tsx
    │   ├── import-progress.tsx
    │   ├── stats-cards.tsx
    │   ├── site-header.tsx
    │   └── theme-toggle.tsx
    ├── hooks/
    │   ├── use-parse-csv.ts
    │   └── use-import.ts         # multipart + SSE
    ├── lib/
    │   ├── utils.ts
    │   ├── csv/
    │   │   ├── parse.ts          # server parse
    │   │   └── batch.ts
    │   ├── ai/
    │   │   ├── client.ts         # OpenRouter via AI SDK
    │   │   ├── prompt.ts
    │   │   ├── extract.ts
    │   │   └── post-process.ts
    │   └── schema/
    │       └── crm.ts            # Zod + types
    └── config/
        ├── site.ts
        └── constants.ts          # batch size, max bytes, enums
```

---

## Priority Legend

| Priority | Meaning |
|----------|---------|
| **P0** | Must ship for a valid assignment submission |
| **P1** | High-value bonuses / UX; do immediately after P0 |
| **P2** | Polish if time remains |

---

## Phase 0 — Docs & prompt (before heavy coding)

| ID | Task | Priority | Notes |
|----|------|----------|-------|
| 0.1 | Finalize SPEC + PLAN (this revision) | P0 | Done when decisions locked |
| 0.2 | Write `docs/PROMPT.md` system prompt | P0 | Highest leverage artifact |
| 0.3 | Draft sample CRM record JSON examples for prompt | P0 | From PDF samples |
| 0.4 | Create 5 fixture CSVs under `fixtures/` | P1 | Can parallel with FE scaffold |

**Exit:** Prompt draft exists; schema enums documented once.

---

## Phase 1 — Project scaffold

| ID | Task | Priority | Est. |
|----|------|----------|------|
| 1.1 | `create-next-app` (TS, App Router, Tailwind, ESLint) in `CRMerge/` | P0 | 15m |
| 1.2 | Init shadcn/ui + base components (button, table, card, toast, progress, tabs, badge, sonner) | P0 | 20m |
| 1.3 | Apply Vercel-inspired theme tokens + dark mode (`next-themes`) | P1 | 30m |
| 1.4 | Site header + layout shell (CRMerge branding, not full GrowEasy clone) | P0 | 20m |
| 1.5 | `.env.example`, `config/constants.ts`, `config/site.ts` | P0 | 15m |
| 1.6 | `GET /api/health` | P0 | 10m |
| 1.7 | Zod CRM schema + TS types (`lib/schema/crm.ts`) | P0 | 30m |

**Exit:** `pnpm dev` runs; blank branded page; health OK; theme toggles (if P1 done).

---

## Phase 2 — Frontend flow (mock API)

| ID | Task | Priority | Est. |
|----|------|----------|------|
| 2.1 | Step state machine on `page.tsx`: `upload \| preview \| processing \| results` | P0 | 30m |
| 2.2 | `upload-zone.tsx` — drag/drop + picker, `.csv` only, 5MB check | P0 | 45m |
| 2.3 | `use-parse-csv.ts` — Papa Parse → rows + headers | P0 | 30m |
| 2.4 | `preview-table.tsx` — sticky header, H/V scroll, row/col counts | P0 | 45m |
| 2.5 | Confirm button → processing state | P0 | 15m |
| 2.6 | `results-table.tsx` + `stats-cards.tsx` (imported / skipped) | P0 | 45m |
| 2.7 | Mock `use-import.ts` returning fake imported/skipped | P0 | 20m |
| 2.8 | Empty / error / loading states + toasts | P0 | 30m |
| 2.9 | Responsive pass (375 / 768 / 1280) | P1 | 20m |

**Exit:** Full UI walkthrough works offline against mock data.

---

## Phase 3 — Server CSV + AI pipeline (core)

| ID | Task | Priority | Est. |
|----|------|----------|------|
| 3.1 | Server CSV parse (`lib/csv/parse.ts`) — any headers | P0 | 30m |
| 3.2 | `chunk(rows, batchSize)` | P0 | 15m |
| 3.3 | OpenRouter client via Vercel AI SDK (`lib/ai/client.ts`) | P0 | 30m |
| 3.4 | Encode `PROMPT.md` into `lib/ai/prompt.ts` | P0 | 45m |
| 3.5 | `extractBatch(rows)` — generateObject / JSON parse + Zod | P0 | 1h |
| 3.6 | `post-process.ts` — enums, skip rule, multi email/phone, dates | P0 | 1h |
| 3.7 | `POST /api/import` multipart handler, wire full pipeline | P0 | 45m |
| 3.8 | Server retry with backoff per failed batch | P1 | 30m |
| 3.9 | Error mapping (400/413/422/502) | P0 | 20m |
| 3.10 | Manual test with `fixtures/sample-crm.csv` + one messy file | P0 | 30m |

**Exit:** curl/multipart import returns correct-shaped JSON for clean + messy CSV.

---

## Phase 4 — Wire FE ↔ BE + SSE

| ID | Task | Priority | Est. |
|----|------|----------|------|
| 4.1 | Real `use-import.ts` multipart fetch to `/api/import` | P0 | 30m |
| 4.2 | `POST /api/import/stream` SSE implementation | P1 | 1h |
| 4.3 | Progress UI (`import-progress.tsx`) consuming SSE | P1 | 45m |
| 4.4 | Client retry button on failure | P1 | 20m |
| 4.5 | End-to-end test all 5 fixtures | P0 | 45m |
| 4.6 | Prompt iteration from real fixture failures | P0 | 1h+ |

**Exit:** Live import with progress; messy fixtures map reasonably well.

---

## Phase 5 — Bonuses & quality

| ID | Task | Priority | Est. |
|----|------|----------|------|
| 5.1 | Virtualized preview/results (`@tanstack/react-virtual`) | P2 | 1h |
| 5.2 | Unit tests: post-process, batch, skip, enum clamp | P1 | 1h |
| 5.3 | Docker (optional Dockerfile for local parity) | P2 | 30m |
| 5.4 | README: setup, env, architecture, Express note, fixtures | P0 | 45m |
| 5.5 | Lint + typecheck clean | P0 | 20m |
| 5.6 | Sample download link for fixtures in UI (optional) | P2 | 15m |

**Exit:** P1 bonuses done; P2 if time.

---

## Phase 6 — Deploy & submit

| ID | Task | Priority | Est. |
|----|------|----------|------|
| 6.1 | Push public GitHub repo | P0 | 15m |
| 6.2 | Deploy Vercel; set env vars | P0 | 20m |
| 6.3 | Smoke test production with fixture | P0 | 20m |
| 6.4 | Email varun@groweasy.ai (URL + repo + Full-Time) | P0 | 10m |

**Exit:** Submission complete.

---

## Sub-task dependency graph (critical path)

```
PROMPT.md ──┐
Schema/Zod ─┼→ extractBatch → postProcess → POST /api/import ──┐
CSV parse ──┘                                                   │
                                                                ├→ wire FE → fixtures E2E → prompt tune → deploy
Upload/Preview UI ─→ mock flow ─────────────────────────────────┘
```

**Longest pole:** AI prompt quality + fixture tuning (Phase 3.10 + 4.6). Everything else is scaffolding.

---

## AI design notes (for implementer)

1. **Never trust free models.** Always Zod-parse; clamp enums; apply skip in code.
2. **Batch size ~15–20** for free models (rate limits + output tokens). Env-tunable.
3. **Send columns + rows as JSON** in the user message; system message holds schema + rules.
4. **Ask model to return array aligned by `rowIndex`** so skip/fail can map back.
5. **Post-process is mandatory** for: missing contact skip, enum whitelist, multi-contact split.
6. **If model omits `crm_status` / `data_source`:** leave blank — do not default to `GOOD_LEAD_FOLLOW_UP`.
7. **OpenRouter structured outputs:** use when model supports it; else JSON mode / fenced JSON + robust parse.
8. **Rate limits:** sequential batches with small delay if free tier throttles; surface friendly error.

---

## Explicit non-reuse list

Do **not** pull from previous csv-importer experiments:

- UploadThing / Upstash
- Manual mapping comboboxes
- Demo “tricks” data
- Auth stubs
- Dual Express+Next monorepo from old PLAN

---

## Risk register

| Risk | Mitigation |
|------|------------|
| Free OpenRouter model flaky JSON | Zod + retry + post-process; pick model with structured_outputs if possible |
| Free tier rate limits | Smaller batches, sequential calls, clear UI error |
| No Express = assignment nit | README deviation + clean service layer |
| Deadline (12 Jul 2026) | P0 only first; freeze P2 early |
| Large CSV timeouts on Vercel | Cap file size 5MB; batch; consider streaming response |
| Phone parsing edge cases | AI + simple heuristic; extras → `crm_note` |

---

## Definition of done (per priority)

### P0 done
- [ ] 4-step UI works
- [ ] Multipart import API works
- [ ] AI maps messy CSV → 15 fields with rules
- [ ] Skip + enum enforcement
- [ ] Vercel deploy + README + GitHub
- [ ] Fixtures demoable

### P1 done
- [ ] SSE progress
- [ ] Server batch retry
- [ ] Dark mode
- [ ] Unit tests on post-process/batch
- [ ] Client error retry

### P2 done (optional)
- [ ] Virtualized tables
- [ ] Docker
- [ ] Fixture download from UI

---

## Suggested execution order (single developer)

1. Phase 1 scaffold + schema  
2. Phase 0.2 prompt draft (can start day 1 evening)  
3. Phase 2 UI with mock  
4. Phase 3 AI pipeline  
5. Phase 4 wire + SSE + fixture grind  
6. Phase 5 tests + README  
7. Phase 6 deploy + email  

Rough total for P0+P1: **~12–16 focused hours** if AI behaves; budget extra for prompt iteration.
