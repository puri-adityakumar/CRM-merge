# CRMerge — End‑to‑End Architecture

```mermaid
flowchart TB
    %% ── Client ──────────────────────────────────────────────
    subgraph Client["Browser"]
        Upload["📤 Drag & Drop CSV"]
        Parse["Papa Parse<br/><i>client‑side preview</i>"]
        Preview[("Preview Table<br/><i>rows · columns</i>")]
        Confirm["✅ Confirm Import"]
        Results["📊 Results<br/><i>charts · filters · violation badges</i>"]
    end

    Upload --> Parse --> Preview --> Confirm

    Confirm -->|"POST multipart"| API

    %% ── API Layer ───────────────────────────────────────────
    subgraph API["Next.js Route Handlers"]
        Stream["/api/import/stream<br/><i>SSE endpoint</i>"]
    end

    API --> Orchestrator

    %% ── Import Pipeline ─────────────────────────────────────
    subgraph Core["Import Pipeline"]
        Orchestrator["runImport<br/><i>orchestration</i>"]
        CsvParse["parseCsv<br/><i>server‑side parse</i>"]
        Batching["Batch Split<br/><i>25 rows / batch</i>"]

        subgraph AI["LLM Extraction"]
            Primary["Primary Model<br/><i>gemini-2.5-flash-lite</i>"]
            Fallback["Fallback Chain<br/><i>gpt-4.1-nano → llama-3.3-70b</i>"]
            Prompt["System Prompt<br/><i>15‑field CRM schema</i>"]
        end

        subgraph Guardrails["Post Processing"]
            EnumClamp["Enum Clamping<br/><i>invalid status → ''</i>"]
            FormulaStrip["Formula Stripping<br/><i>=cmd  @SUM  +COMMAND</i>"]
            MultiSplit["Multi‑Contact Split<br/><i>emails · phones → notes</i>"]
            DateNorm["Date Normalization<br/><i>DD/MM/YYYY → ISO</i>"]
            ContactCheck["Contact Check<br/><i>skip if no email / mobile</i>"]
        end

        Detect["Guardrail Detection<br/><i>xss · sql · formula badges</i>"]
    end

    %% ── Data Flow ───────────────────────────────────────────
    Orchestrator --> CsvParse --> Batching --> AI
    AI --> Primary
    Primary -.->|"429 / error"| Fallback
    AI --> Guardrails
    Guardrails --> EnumClamp
    Guardrails --> FormulaStrip
    Guardrails --> MultiSplit
    Guardrails --> DateNorm
    Guardrails --> ContactCheck
    Guardrails --> Detect

    API -.->|"SSE: progress · complete · error"| Confirm
    Detect --> Results
```

## Technology Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| AI Provider | OpenRouter (OpenAI‑compatible chat completions) |
| Primary Model | google/gemini-2.5-flash-lite |
| Fallback Models | openai/gpt-4.1-nano, meta-llama/llama-3.3-70b |
| CSV Parsing | Papa Parse (client + server) |
| Streaming | Server‑Sent Events (SSE) |
| Testing | Vitest |
