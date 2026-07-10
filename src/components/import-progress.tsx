"use client";

import type { BatchProgress } from "@/lib/ai/extract";
import { cn } from "@/lib/utils";

export type ImportProgressProps = {
  fileName?: string;
  progress: BatchProgress | null;
  className?: string;
};

/**
 * Batch progress bar for SSE import stream.
 * When `progress` is null, shows an indeterminate busy state.
 */
export function ImportProgress({
  fileName,
  progress,
  className,
}: ImportProgressProps) {
  const total = progress?.totalBatches ?? 0;
  const processed = progress?.processed ?? 0;
  const percent =
    total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : null;

  return (
    <div className={cn("space-y-3", className)} data-testid="import-progress">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium">
          {percent != null
            ? `Batch ${processed} of ${total}`
            : "Starting AI extraction…"}
        </span>
        {percent != null ? (
          <span className="tabular-nums text-muted-foreground">{percent}%</span>
        ) : null}
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        aria-label="AI extraction progress"
        aria-busy={percent == null}
      >
        {percent != null ? (
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        ) : (
          <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
        )}
      </div>
      {fileName ? (
        <p className="text-sm text-muted-foreground">
          Processing{" "}
          <span className="font-medium text-foreground">{fileName}</span>
          {percent != null
            ? ` — ${processed}/${total} batches complete`
            : ". Please keep this tab open."}
        </p>
      ) : null}
    </div>
  );
}
