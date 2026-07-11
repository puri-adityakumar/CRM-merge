# Design Review — CRMerge

**Surface:** Full frontend (import wizard: upload → preview → processing → results)
**Register:** Product (app UI / tool)
**Date:** 2026-07-11

---

## First Impression

The page opens with a frosted-glass sticky header carrying an inline SVG cloud-mark logo, a clear heading "Import CSV to CRM", and a numbered badge step indicator. The green-tinted palette whispers GrowEasy brand intent without shouting. The first viewport promises a structured import tool — and delivers one.

The card-by-card step flow is clean and competent. It lacks a memorable point of view — the composition is pure shadcn defaults stacked in sequence — but for a product tool where speed and clarity matter more than personality, this is defensible. The green hue (oklch 155°) is an intentional choice tied to growth, not the generic SaaS blue-violet.

**What a user remembers after 2 seconds:** Step badges, green accents, an import tool that looks trustworthy.

| Lens | Score | Notes |
|------|-------|-------|
| First impression | 6/10 | Clean and competent. Lacks a distinctive voice — reads as default shadcn with green tint. |
| Hierarchy | 8/10 | Clear three-tier flow. Stats cards with icons scan well. Footer text is a lost signal. |
| Color voice | 7/10 | Good chromatic discipline, green is intentional. Hardcoded emerald breaks token consistency. |
| Type voice | 7/10 | Geist is appropriate. Card title/body hierarchy is subtle. Footer is barely legible. |
| Interaction feel | 7/10 | Strong state coverage, good error recovery. Skeleton components are dead code. No keyboard shortcuts. |
| **Total** | **35/50** | A solid product tool. Ready for shipment with minor polish. |

---

## Walkthrough

### Arrival → Upload

The user lands on the upload step. Heading + description set context. The upload zone is spacious (`py-14`), has a dashed border, hover state, focus-visible ring, drag-active feedback, and a parsing spinner. Three visual states (idle/drag/parsing) with distinct icon and copy. This is well done.

**Observations:**
- The parsing state shows `Loader2Icon` spinning + "Parsing CSV…" — the user knows work is happening. Good.
- The upload zone does not show the file name after selection. Once parsing completes, the preview step replaces the upload card entirely. This works but means the user can't see *which* file they uploaded from the preview step. The preview table shows the file name, restoring context. Acceptable.

### Preview → Confirm

The preview step shows file name, row/column counts as badges, and a responsive table with sticky headers. The 100-row cap with truncation notice is thoughtful and prevents render jank.

**Observations:**
- Empty cells show `—` (em dash), consistent with the results table. Good.
- The "Confirm import" button is disabled when `rowCount === 0` — correct guard.
- The "Choose another file" button uses `ArrowLeftIcon` but resets to upload, not back from preview. The label says "Choose another file" which is accurate — no false promise of "back". Good copy.
- No keyboard shortcut (Enter) to confirm import. The user must click.

### Processing → Results / Error

The processing step shows a progress bar with batch count and percentage. When the import fails, the card transforms inline: the spinner becomes a red `!` indicator, the description changes to an error message, and retry/start-over buttons appear. The user stays on the "Import" step — they don't get bounced to a separate error screen. This is a strong interaction pattern.

**Observations:**
- The error indicator is a raw `<span>` with `rounded-full bg-destructive/20 text-destructive` showing `!`. Using `AlertCircleIcon` from lucide would be visually stronger and semantically clearer.
- The progress bar uses `ProgressIndicator` with `w-1/3 animate-pulse` for indeterminate state. This works but the pulse width is a fixed fraction; a stripe animation would feel more polished.
- When the import succeeds, the step moves to "Results" with a check icon and stats cards. The stats cards now include lucide icons per card — a nice touch.

### Results

The results step shows stats cards (with icons) and a split imported/skipped table. Both sections have empty states. The sticky headers match the preview table pattern. The "Import another" button resets to upload.

**Observations:**
- The `CheckCircle2Icon` uses hardcoded `text-emerald-600 dark:text-emerald-400` instead of `text-primary`. This means the success icon color is disconnected from the brand green palette. If someone changes the primary hue, the success icon stays teal/emerald.
- The skipped records table shows `rowIndex + 1` for human-readable row numbers — good detail.
- Stats cards at 4-column grid collapse responsively to 2-col then 1-col. Correct.

---

## Strengths

- **Defense in depth on states.** Every step has empty, loading, error, and success states. The processing step handles both success and failure without jumping steps.
- **Token discipline.** The color palette uses oklch with consistent hue (155°) and controlled chroma. Green is intentional, not decorative.
- **Step indicator.** Badge-based step nav with active ring is simple, clear, and accessible (`nav aria-label`).
- **Copy is factual.** No marketing fluff. Button labels name the action: "Confirm import", "Choose another file", "Retry import", "Start over". Good.
- **Empty cell consistency.** Both tables use `—` for missing values.
- **Accessibility basics.** `aria-label` on upload input and theme toggle, `role` on progress bar, semantic `<nav>` for steps.

---

## Issues (ordered by impact)

### 1. Hardcoded emerald breaks color token consistency (Medium)
**Evidence:** `results-table.tsx` and `import-flow.tsx` use `text-emerald-600 dark:text-emerald-400` for the success checkmark.
**Impact:** If the primary hue changes, the success indicator stays a different green. It doesn't adapt to dark mode through CSS variables.
**Fix:** Replace with `text-primary`.

### 2. Error indicator uses raw text instead of an icon (Low)
**Evidence:** The `!` in the processing failure card is a `<span>` with a colored circle background.
**Impact:** Weaker visual signal than a proper icon. `AlertCircleIcon` from lucide is already imported in the project.
**Fix:** Use `AlertCircleIcon` with appropriate sizing and color.

### 3. Skeleton components exist but are never used (Low)
**Evidence:** `loading-skeletons.tsx` exports `StatsCardsSkeleton` and `ResultsTableSkeleton`. Neither is imported anywhere in the app.
**Impact:** Dead code. The components are well-built but serve no purpose since the import flow renders results immediately (postProcess is synchronous after the LLM responses arrive).
**Fix:** Either delete them or use them if a deferred-loading pattern is added later.

### 4. Footer text is barely legible and carries low signal (Low)
**Evidence:** `page.tsx` line 14: `CRMerge · GrowEasy CSV importer · AI mapping runs only after you confirm` in `text-xs text-muted-foreground`.
**Impact:** The text is hard to read and repeats information already visible in the page header and description. It adds visual noise at the bottom of the viewport.
**Fix:** Shorten to `"CRMerge — AI CSV Importer"` or remove entirely. The confirm-later behavior is stated in the step descriptions.

### 5. No keyboard shortcut to advance steps (Low)
**Evidence:** The "Confirm import" button in the preview step has no keyboard handler. The user must click or tab to it.
**Impact:** Slower for keyboard-heavy users. Enter is the expected key for confirming a form or action in a wizard.
**Fix:** Add `onKeyDown` to the preview card or a global keyboard listener for Enter when on the preview step.

### 6. Indeterminate progress bar uses simple pulse, no stripe animation (Low)
**Evidence:** `import-progress.tsx` uses `w-1/3 animate-pulse` for the indeterminate state.
**Impact:** The pulse is a flat opacity animation. A shimmer/stripe animation (`bg-gradient + animate-[shimmer]`) would feel more polished and signal "work in progress" more clearly.
**Fix:** Add a CSS keyframe for a shimmer stripe or use animate-pulse with a gradient background.

---

## Recommendations

| Priority | Action | Mode |
|----------|--------|------|
| 1 | Replace hardcoded `emerald-600` with `text-primary` on success icons | `/design recolor` |
| 2 | Replace `!` span with `AlertCircleIcon` in failure card | `/design interaction` |
| 3 | Delete or implement skeleton components | `/design refine` |
| 4 | Shorten or remove footer text | `/design refine` |
| 5 | Add Enter key handler for confirm import | `/design interaction` |
| 6 | Add indeterminate stripe animation to progress bar | `/design motion` |

---

## Verdict

CRMerge's frontend is a **solid, ship-ready product tool**. It handles every state the import wizard can enter, recovers from errors gracefully, and maintains visual consistency across components. The green-tinted palette is the right creative decision for a GrowEasy product — it feels authored without being loud.

The issues are minor polish items. None blocks usability or degrades the experience in a meaningful way. The codebase is clean, the states are covered, and the interaction flow is correct.

**Ship it. Apply the top 2-3 fixes before demo, then iterate.**
