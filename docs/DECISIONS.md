# CRMerge — Implementation Decisions (Non-PRD)

> These are **our** choices for how to build the assignment.
> They are **not** product requirements.
>
> **PRD source of truth:** [`SDE-assingment.pdf`](../../SDE-assingment.pdf)  
> **PRD extract:** [`SPEC.md`](./SPEC.md)

If a decision conflicts with the PDF, either change the decision or explicitly document the intentional deviation and mitigate it (README + architecture).

---

## Locked decisions

| # | Topic | Decision | Notes vs PDF |
|---|--------|----------|--------------|
| D1 | Codebase | Greenfield (no prior csv-importer reuse) | Not in PRD |
| D2 | App shape | **Next.js fullstack** (App Router + Route Handlers) | PDF lists **Express** as backend — **intentional deviation** (D2a) |
| D3 | Deploy | Vercel only | Allowed under bonus “Vercel / Railway / Render / similar” |
| D4 | LLM access | OpenRouter free models via **Vercel AI SDK** | Fits “any equivalent LLM” |
| D5 | Model id | Env only (`LLM_MODEL` + `LLM_FALLBACK_MODELS`) — no hardcode | Implementation detail |
| D6 | Confirm transport | Multipart **CSV file** to API; server parses | Aligns with PDF “Accept CSV Upload” + “Parse CSV” |
| D7 | Preview parse | Client-side (Papa Parse); **no AI until Confirm** | Aligns with PDF Step 2 |
| D8 | Progress | SSE streaming for batch progress | Bonus: streaming / progress indicators |
| D9 | UI | Next.js 15 + TS + Tailwind + shadcn/ui | Next.js required; rest free |
| D10 | Theme | Vercel-inspired (clean zinc / light + dark) | Bonus: dark mode |
| D11 | Database | None (stateless) | Explicitly allowed by PDF |
| D12 | Auth | None | Not required by PDF |
| D13 | Delivery order | P0 core → P1 bonuses → P2 polish | Process only |
| D14 | Position on submit | Full-Time | Candidate choice |
| D15 | Demo fixtures | FB / Google Ads / RE CRM / handmade messy CSVs | Supports evaluation criteria; not named in PDF |

### D2a — Express deviation

| | |
|--|--|
| PDF says | Backend: Node.js + Express |
| We do | Next.js Route Handlers (same Node runtime, no Express) |
| Why | Single deploy on Vercel; faster path to hosted app |
| Mitigation | README states deviation; service layer kept framework-agnostic so Express can be added later; API still “accept CSV → parse → batch AI → JSON” |

---

## Out of scope (not in PRD; we will not invent as requirements)

- User authentication / multi-tenancy  
- Persisting leads to a database (unless we choose otherwise later)  
- Manual column-mapping UI  
- Full GrowEasy product shell (sidebar, lead CRUD)  
- `.xlsx` support (PDF says valid **CSV**)  
- Requirements only visible in screenshots (e.g. exact 5MB copy) unless we adopt them as optional UX

---

## How to use these docs

1. **What must the product do?** → PDF / `SPEC.md`  
2. **How are we building it?** → `DECISIONS.md` + `PLAN.md`  
3. **What does the model get told?** → `PROMPT.md` (must encode PDF AI rules)  
