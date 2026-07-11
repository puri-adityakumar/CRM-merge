"use client";

import { CheckIcon, Loader2Icon, ClockIcon } from "lucide-react";
import type { BatchLogEntry } from "@/hooks/use-import";
import { cn } from "@/lib/utils";
import {
  Progress,
  ProgressTrack,
  ProgressIndicator,
  ProgressLabel,
} from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

export type ImportProgressProps = {
  fileName?: string;
  /** 0–100, null for indeterminate */
  percent: number | null;
  /** Batch log ordered by batchIndex (0 → totalBatches-1) */
  batchLog: BatchLogEntry[];
  /** When import was started (ms epoch) */
  startedAt: number | null;
  /** Estimated remaining ms, null when unknown */
  estimatedMs: number | null;
  onCancel?: () => void;
  className?: string;
};

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  const rs = Math.round(s % 60);
  return rs > 0 ? `${m}m ${rs}s` : `${m}m`;
}

function formatElapsed(startedAt: number | null): string {
  if (!startedAt) return "";
  return formatMs(Date.now() - startedAt);
}

function formatEstimated(ms: number): string {
  return `~${formatMs(ms)} remaining`;
}

export function ImportProgress({
  fileName,
  percent,
  batchLog,
  startedAt,
  estimatedMs,
  onCancel,
  className,
}: ImportProgressProps) {
  return (
    <div
      className={cn("flex flex-col gap-4", className)}
      data-testid="import-progress"
    >
      <Progress value={percent} className="flex-col gap-3">
        <div className="flex w-full items-center justify-between gap-2">
          <ProgressLabel>
            {percent != null
              ? `Batch ${batchLog.filter((e) => e.status === "done").length} / ${batchLog.length}`
              : "Starting AI extraction…"}
          </ProgressLabel>
          <div className="flex items-center gap-3">
            {estimatedMs != null && percent != null && (
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <ClockIcon className="size-3.5" />
                {formatEstimated(estimatedMs)}
              </span>
            )}
            {percent != null && (
              <span className="text-sm text-muted-foreground tabular-nums">
                {percent}%
              </span>
            )}
          </div>
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
      </Progress>

      {fileName && startedAt && (
        <p className="text-sm text-muted-foreground">
          Processing{" "}
          <span className="font-medium text-foreground">{fileName}</span>
          {" · "}
          <span className="tabular-nums">{formatElapsed(startedAt)}</span>
          {" elapsed"}
          {estimatedMs != null && (
            <>
              {", "}
              <span className="tabular-nums">{formatEstimated(estimatedMs)}</span>
            </>
          )}
          {" · "}
          <span className="tabular-nums">
            {batchLog.filter((e) => e.status === "done").length}/{batchLog.length} batches
          </span>
        </p>
      )}

      {batchLog.length > 0 && (
        <div className="rounded-lg border border-border">
          <div className="border-b border-border px-3 py-1.5">
            <p className="text-xs font-medium text-muted-foreground">Activity</p>
          </div>
          <div className="max-h-48 space-y-px overflow-y-auto px-1 py-1">
            {batchLog.map((entry) => {
              const icon =
                entry.status === "done" ? (
                  <CheckIcon className="size-3.5 text-primary" />
                ) : entry.status === "active" ? (
                  <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />
                ) : (
                  <span className="block size-3.5 rounded-full border border-border" />
                );

              const label =
                entry.status === "done"
                  ? `Batch ${entry.batchIndex + 1} · ${entry.durationMs != null ? formatMs(entry.durationMs) : "—"}`
                  : entry.status === "active"
                    ? `Batch ${entry.batchIndex + 1} · sending…`
                    : `Batch ${entry.batchIndex + 1}`;

              return (
                <div
                  key={entry.batchIndex}
                  className={cn(
                    "flex items-center gap-2 rounded px-2 py-1.5 text-xs",
                    entry.status === "active" && "bg-muted/50",
                  )}
                >
                  {icon}
                  <span
                    className={cn(
                      "tabular-nums",
                      entry.status === "done" && "text-foreground",
                      entry.status === "pending" && "text-muted-foreground/50",
                    )}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {onCancel && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
