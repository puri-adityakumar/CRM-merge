# CRMerge — Product Requirements (PRD)

> **Single source of truth for product requirements:** [`SDE-assingment.pdf`](../../SDE-assingment.pdf) (GrowEasy SDE Assignment).
>
> This document is a structured extract of that PDF only. If anything here conflicts with the PDF, **the PDF wins**.
>
> Implementation choices (stack deviations, UI library, deploy target, model provider, folder layout, API shapes beyond “structured JSON”) live in [`DECISIONS.md`](./DECISIONS.md) and [`PLAN.md`](./PLAN.md). Those are **not** PRD.

---

## Meta (from assignment)

| Item | Value |
|------|--------|
| Company | GrowEasy ([groweasy.ai](https://groweasy.ai)) |
| Role | Software Developer Intern **or** Full-Time |
| Work mode | WFH · Joining immediate |
| Submit to | varun@groweasy.ai |
| Deadline | **12 July 2026** |
| Email must include | Hosted app URL · GitHub repo URL · Position applied for |

---

## 1. Assignment Overview

Build an **AI-powered CSV Importer** that intelligently extracts CRM lead information from **any valid CSV format**.

- The challenge is **not** parsing CSV files.
- The challenge is supporting CSVs with **different column names, layouts, and structures**, while accurately mapping and extracting required CRM fields **using AI**.

Examples that should all work:

- Facebook Lead Export
- Google Ads Export
- Excel sheets
- Real Estate CRM exports
- Sales reports
- Marketing agency CSVs
- Manually created spreadsheets

The application should identify the appropriate fields and convert them into **GrowEasy CRM format**.

The project consists of both a **Frontend** and a **Backend**.

---

## 2. Frontend Requirements

Create a **responsive** web application.

### Step 1 — Upload CSV

- Allow users to upload a valid CSV file.
- Examples:
  - Drag & Drop upload
  - File Picker

### Step 2 — Preview

After upload:

- Parse the CSV
- Show a preview of uploaded rows
- Display data inside a beautiful responsive table
- Table should support:
  - Horizontal scrolling
  - Vertical scrolling
  - Sticky headers (**preferred**)
  - Responsive design

**No AI processing should happen yet.**

### Step 3 — Confirm Import

- Provide a **Confirm** button.
- **Only after confirmation** should the frontend call the backend API.

### Step 4 — Display Parsed Result

- Backend returns AI-extracted CRM records.
- Display the parsed result in another responsive table.
- Show:
  - Successfully parsed records
  - Skipped records (if any)
  - Total imported
  - Total skipped

---

## 3. Backend Requirements

Create APIs that:

### 1. Accept CSV Upload

- Accept any valid CSV file.
- Do **not** assume column names are fixed.

### 2. Parse CSV

- Convert the CSV into records.

### 3. AI Extraction

- Send records to an AI model **in batches**.
- The AI should intelligently map available fields into GrowEasy CRM format.
- Allowed: OpenAI, Gemini, Claude, or **any equivalent LLM**.

### 4. Return Structured JSON

- Return extracted CRM records in JSON format.

---

## 4. CRM Fields

The AI should extract **as many of the following fields as possible**:

| Field | Description |
|-------|-------------|
| `created_at` | Lead creation date |
| `name` | Lead name |
| `email` | Primary email |
| `country_code` | Country code |
| `mobile_without_country_code` | Mobile number |
| `company` | Company name |
| `city` | City |
| `state` | State |
| `country` | Country |
| `lead_owner` | Lead owner |
| `crm_status` | Lead status |
| `crm_note` | Notes/remarks |
| `data_source` | Source |
| `possession_time` | Property possession time |
| `description` | Additional description |

### Sample CRM Records (from assignment)

Header:

```text
created_at,name,email,country_code,mobile_without_country_code,company,city,state,country,lead_owner,crm_status,crm_note,data_source,possession_time,description
```

Example rows (illustrative of target shape / status enums):

- John Doe — `GOOD_LEAD_FOLLOW_UP`
- Sarah Johnson — `DID_NOT_CONNECT`
- Rajesh Patel — `BAD_LEAD`
- Priya Singh — `SALE_DONE`

(See PDF for full sample CSV lines.)

---

## 5. AI Instructions

The AI should follow these rules while extracting records.

### 5.1 Allowed CRM Status Values

Only use one of:

- `GOOD_LEAD_FOLLOW_UP`
- `DID_NOT_CONNECT`
- `BAD_LEAD`
- `SALE_DONE`

### 5.2 Allowed Data Source Values

Only use one of:

- `leads_on_demand`
- `meridian_tower`
- `eden_park`
- `varah_swamy`
- `sarjapur_plots`

If none match confidently, **leave it blank**.

### 5.3 Date Format

`created_at` must be convertible using JavaScript:

```js
new Date(created_at)
```

### 5.4 CRM Notes

Use `crm_note` for:

- Remarks
- Follow-up notes
- Additional comments
- Extra phone numbers
- Extra email addresses
- Any useful information that doesn’t fit another field

### 5.5 Multiple Emails or Mobile Numbers

If multiple email addresses exist:

- Use the first email.
- Append remaining emails into `crm_note`.

If multiple mobile numbers exist:

- Use the first mobile.
- Append remaining numbers into `crm_note`.

### 5.6 CSV Compatibility

- Each record must remain a single CSV row.
- Avoid introducing unintended line breaks.
- If line breaks are necessary, escape them appropriately (e.g. `\n`) so the CSV remains valid.

### 5.7 Skip Invalid Records

If a record contains **neither**:

- email  
  **nor**
- mobile number  

then **skip** that record.

---

## 6. Evaluation Criteria

Candidates will primarily be evaluated on:

### AI Prompt Engineering

- Ability to extract fields accurately
- Intelligent field mapping
- Handling messy datasets
- Handling ambiguous columns

### Backend Quality

- API design
- Clean architecture
- Error handling
- Batch processing
- Maintainable code

### Frontend Quality

- Modern UI
- Responsive layout
- Clean UX
- CSV preview experience
- Loading states
- Error handling

### Code Quality

- Readability
- Type safety
- Folder structure
- Reusability
- Best practices

### Overall Engineering

- Performance
- Edge case handling
- Production readiness

---

## 7. Bonus Points

Additional credit for:

- Drag & Drop upload
- Progress indicators during AI processing
- Streaming or incremental parsing
- Retry mechanism for failed AI batches
- Virtualized table for large CSVs
- Dark mode
- Unit tests
- Docker setup
- Deployment using Vercel, Railway, Render, or similar
- Well-written README with setup instructions

---

## 8. Tech Stack (as specified)

| Layer | Specified |
|-------|-----------|
| Frontend | Next.js |
| Backend | Node.js, Express |
| AI | OpenAI, Gemini, Claude, or any equivalent LLM |
| Database | Optional — any DB if required, **or keep project stateless** |

---

## 9. Final Submission Checklist

Before submitting, include:

- [ ] Publicly hosted application
- [ ] Public GitHub repository
- [ ] README containing setup instructions
- [ ] Position applied for (Intern / Full-Time)

Email everything to: **varun@groweasy.ai**

---

## 10. Screenshots for Reference

The PDF includes GrowEasy product screenshots (CSV import modal, preview table, manage leads). These are **visual reference only**, not extra functional requirements beyond §§2–5.

---

## Document map

| Doc | Role |
|-----|------|
| `SDE-assingment.pdf` | **PRD source of truth** |
| `docs/SPEC.md` | Structured PRD extract (this file) |
| `docs/DECISIONS.md` | Our implementation choices (non-PRD) |
| `docs/PLAN.md` | Task breakdown / phases |
| `docs/PROMPT.md` | LLM prompt draft (implementation) |
