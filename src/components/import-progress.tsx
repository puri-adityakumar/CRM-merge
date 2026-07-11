"use client";

import type { BatchProgress } from "@/lib/ai/extract";
import { cn } from "@/lib/utils";
import {
  Progress,
  ProgressTrack,
  ProgressIndicator,
  ProgressLabel,
} from "@/components/ui/progress";

export type ImportProgressProps = {
  fileName?: string;
  progress: BatchProgress | null;
  className?: string;
};

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
    <Progress
      value={percent}
      className={cn("flex-col gap-3", className)}
      data-testid="import-progress"
    >
      <div className="flex w-full items-center justify-between gap-2">
        <ProgressLabel>
          {percent != null
            ? `Batch ${processed} of ${total}`
            : "Starting AI extraction…"}
        </ProgressLabel>
        {percent != null && (
          <span className="text-sm text-muted-foreground tabular-nums">
            {percent}%
          </span>
        )}
      </div>

      <ProgressTrack>
        {percent != null ? (
          <ProgressIndicator />
        ) : (
          <ProgressIndicator className="relative w-1/3 overflow-hidden">
            <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
          </ProgressIndicator>
        )}
      </ProgressTrack>

      {fileName && (
        <p className="text-sm text-muted-foreground">
          Processing{" "}
          <span className="font-medium text-foreground">{fileName}</span>
          {percent != null
            ? ` — ${processed}/${total} batches complete`
            : ". Please keep this tab open."}
        </p>
      )}
    </Progress>
  );
}
