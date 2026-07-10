"use client";

import { useCallback, useState } from "react";
import type { BatchProgress } from "@/lib/ai/extract";
import {
  type ImportFailure,
  type ImportSuccess,
} from "@/lib/client/import-api";
import { importCsvFileStream } from "@/lib/client/import-stream";

export type UseImportState = {
  importing: boolean;
  result: ImportSuccess | null;
  error: ImportFailure | null;
  progress: BatchProgress | null;
  runImport: (file: File) => Promise<ImportSuccess | ImportFailure>;
  reset: () => void;
};

/**
 * Streams CSV import via `POST /api/import/stream` (SSE progress + final result).
 */
export function useImport(): UseImportState {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportSuccess | null>(null);
  const [error, setError] = useState<ImportFailure | null>(null);
  const [progress, setProgress] = useState<BatchProgress | null>(null);

  const reset = useCallback(() => {
    setImporting(false);
    setResult(null);
    setError(null);
    setProgress(null);
  }, []);

  const runImport = useCallback(async (file: File) => {
    setImporting(true);
    setError(null);
    setResult(null);
    setProgress(null);
    try {
      const outcome = await importCsvFileStream(file, {
        onProgress: (p) => setProgress(p),
      });
      if (outcome.ok) {
        setResult(outcome);
      } else {
        setError(outcome);
      }
      return outcome;
    } finally {
      setImporting(false);
    }
  }, []);

  return { importing, result, error, progress, runImport, reset };
}
