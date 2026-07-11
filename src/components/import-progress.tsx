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
  percent: number | null;
  batchLog: BatchLogEntry[];
  startedAt: number | null;
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
  const done = batchLog.filter((e) => e.status === "done").length;

  return (
    <div
      className={cn("flex flex-col items-center gap-6", className)}
      data-testid="import-progress"
    >
      {/* Hero progress ring + label */}
      <div className="flex flex-col items-center gap-4">
        {/* Big circular progress indicator */}
        <div className="relative flex size-24 items-center justify-center sm:size-28">
          <svg className="size-full -rotate-90" viewBox="0 0 100 100" aria-hidden>
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="5"
              className="text-border"
            />
            {percent != null && (
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${(percent / 100) * 283} 283`}
                className="text-primary transition-[stroke-dasharray] duration-500"
              />
            )}
          </svg>
          <span className="absolute text-lg font-bold tabular-nums sm:text-xl">
            {percent != null ? `${percent}%` : "..."}
          </span>
        </div>

        <div className="text-center">
          <p className="text-base font-semibold sm:text-lg">
            {percent != null
              ? `Batch ${done} of ${batchLog.length}`
              : "Starting AI extraction…"}
          </p>
          {fileName && startedAt && (
            <p className="mt-1 text-sm text-muted-foreground">
              Processing{" "}
              <span className="font-medium text-foreground">{fileName}</span>
              {" · "}
              <span className="tabular-nums">{formatElapsed(startedAt)}</span>
              {" elapsed"}
            </p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <Progress value={percent} className="w-full max-w-md flex-col gap-2">
        <div className="flex w-full items-center justify-between gap-2">
          <ProgressLabel>
            {percent != null ? `${done} / ${batchLog.length} batches` : "Preparing…"}
          </ProgressLabel>
          <div className="flex items-center gap-2">
            {estimatedMs != null && percent != null && (
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <ClockIcon className="size-3.5" />
                {formatEstimated(estimatedMs)}
              </span>
            )}
          </div>
        </div>

        <ProgressTrack className="h-2">
          {percent != null ? (
            <ProgressIndicator />
          ) : (
            <ProgressIndicator className="relative w-1/3 overflow-hidden">
              <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
            </ProgressIndicator>
          )}
        </ProgressTrack>
      </Progress>

      {/* Activity log */}
      {batchLog.length > 0 && (
        <div className="w-full max-w-md rounded-lg border border-border">
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
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onCancel}
        >
          Cancel
        </Button>
      )}
    </div>
  );
}
