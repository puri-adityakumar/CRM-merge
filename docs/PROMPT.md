# LLM System Prompt — Draft Outline

> Full prompt string will live in `src/lib/ai/prompt.ts`.  
> **Rules content must match the PRD:** [`SDE-assingment.pdf`](../../SDE-assingment.pdf) / [`SPEC.md`](./SPEC.md) §§4–5.  
> This file is an implementation draft, not a second PRD.

**Status:** Outline only — flesh out during Phase 0.2 / 3.4.

---

## Goals

1. Map arbitrary CSV row objects (unknown keys) → 15 CRM fields.
2. Obey hard enums and skip semantics.
3. Prefer leaving fields blank over hallucinating.
4. Return strict JSON only.

---

## System prompt sections (in order)

### Role
You are a CRM data extraction engine for GrowEasy (real-estate / lead CRM). You convert messy lead CSV rows into a fixed schema.

### Target schema
List all 15 fields with short descriptions (copy from SPEC §4).

### Hard rules
1. `crm_status` ∈ {GOOD_LEAD_FOLLOW_UP, DID_NOT_CONNECT, BAD_LEAD, SALE_DONE} or empty
2. `data_source` ∈ {leads_on_demand, meridian_tower, eden_park, varah_swamy, sarjapur_plots} or empty
3. `created_at` must be JS `new Date()`-parseable when present
4. Multiple emails/mobiles → first to primary field, rest to `crm_note`
5. Overflow text → `crm_note`
6. Do not invent emails, phones, or project names
7. Fuzzy-map informal status labels (e.g. "Sale Done" → SALE_DONE)
8. If neither email nor mobile can be found → mark record `skip: true` with reason `missing_contact`

### Output format
```json
{
  "records": [
    {
      "rowIndex": 0,
      "skip": false,
      "data": { /* 15 fields */ }
    },
    {
      "rowIndex": 1,
      "skip": true,
      "reason": "missing_contact",
      "data": null
    }
  ]
}
```

### Input format (user message)
```json
{
  "columns": ["Col A", "Col B", ...],
  "rows": [
    { "rowIndex": 0, "values": { "Col A": "...", "Col B": "..." } }
  ]
}
```

### Few-shot examples
Include 2–3 examples:
1. Clean GrowEasy-shaped row
2. Facebook-style headers + multi phone
3. Missing contact → skip

---

## Post-process (code, not prompt)

Even with a perfect prompt, always:
- Zod validate
- Whitelist enums
- Re-apply skip rule
- Normalize dates when safe
- Merge residual multi-contacts into `crm_note`

---

## Model notes

- Model id from `OPENROUTER_MODEL` only
- Prefer models that support structured outputs when available on OpenRouter
- Free-tier: smaller batches, sequential calls, retries
