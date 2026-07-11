"use client";

import { useCallback, useRef, useState } from "react";
import type { BatchProgress } from "@/lib/ai/extract";
import {
  type ImportFailure,
  type ImportSuccess,
} from "@/lib/client/import-api";
import { importCsvFileStream } from "@/lib/client/import-stream";

export interface BatchLogEntry {
  batchIndex: number;
  status: "done" | "active" | "pending";
  timestamp: number;
  durationMs?: number;
}

export type UseImportState = {
  importing: boolean;
  result: ImportSuccess | null;
  error: ImportFailure | null;
  progress: BatchProgress | null;
  batchLog: BatchLogEntry[];
  startedAt: number | null;
  estimatedMs: number | null;
  runImport: (file: File) => Promise<ImportSuccess | ImportFailure>;
  cancel: () => void;
  reset: () => void;
};

function defaultBatchIntervalMs(): number {
  const v = parseInt(process.env.NEXT_PUBLIC_BATCH_INTERVAL_MS ?? "", 10);
  return Number.isFinite(v) && v > 0 ? v : 3000;
}

export function useImport(): UseImportState {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportSuccess | null>(null);
  const [error, setError] = useState<ImportFailure | null>(null);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [batchLog, setBatchLog] = useState<BatchLogEntry[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [estimatedMs, setEstimatedMs] = useState<number | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const lastProgressRef = useRef<number>(0);
  const durationsRef = useRef<number[]>([]);

  const reset = useCallback(() => {
    setImporting(false);
    setResult(null);
    setError(null);
    setProgress(null);
    setBatchLog([]);
    setStartedAt(null);
    setEstimatedMs(null);
    abortRef.current = null;
    lastProgressRef.current = 0;
    durationsRef.current = [];
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const runImport = useCallback(async (file: File) => {
    const controller = new AbortController();
    abortRef.current = controller;
    const start = Date.now();
    lastProgressRef.current = 0;
    durationsRef.current = [];

    setImporting(true);
    setError(null);
    setResult(null);
    setProgress(null);
    setBatchLog([]);
    setStartedAt(start);
    setEstimatedMs(null);

    try {
      const outcome = await importCsvFileStream(file, {
        signal: controller.signal,
        onProgress: (p) => {
          setProgress(p);
          const now = Date.now();
          const batchDuration = now - lastProgressRef.current;
          if (p.batchIndex > 0) {
            durationsRef.current.push(batchDuration);
          }
          lastProgressRef.current = now;

          setBatchLog((prev) => {
            const next: BatchLogEntry[] = [];
            for (let i = 0; i < p.totalBatches; i++) {
              const existing = prev.find((e) => e.batchIndex === i);
              if (existing) {
                next.push(existing);
              } else if (i < p.processed) {
                next.push({
                  batchIndex: i,
                  status: "done",
                  timestamp: now,
                  durationMs: i === p.batchIndex ? batchDuration : undefined,
                });
              } else if (i === p.batchIndex && p.processed > 0) {
                next.push({
                  batchIndex: i,
                  status: "active",
                  timestamp: now,
                });
              } else {
                next.push({
                  batchIndex: i,
                  status: "pending",
                  timestamp: 0,
                });
              }
            }
            return next;
          });

          // Estimate remaining time
          const avg = durationsRef.current.length > 0
            ? durationsRef.current.reduce((s, d) => s + d, 0) / durationsRef.current.length
            : defaultBatchIntervalMs() + 5000; // fallback: interval + typical LLM latency
          const remaining = (p.totalBatches - p.processed) * avg;
          setEstimatedMs(Math.round(remaining));
        },
      });

      if (controller.signal.aborted) {
        return { ok: false, status: 0, error: "Import cancelled" } as ImportFailure;
      }

      if (outcome.ok) {
        setResult(outcome);
      } else {
        setError(outcome);
      }
      return outcome;
    } catch (err) {
      if (controller.signal.aborted) {
        const cancelled: ImportFailure = { ok: false, status: 0, error: "Import cancelled" };
        setError(cancelled);
        return cancelled;
      }
      throw err;
    } finally {
      if (!controller.signal.aborted) {
        setImporting(false);
      }
      abortRef.current = null;
    }
  }, []);

  return { importing, result, error, progress, batchLog, startedAt, estimatedMs, runImport, cancel, reset };
}
