"use client";

import { useCallback, useState } from "react";
import {
  parseCsvForPreview,
  PreviewParseError,
  type CsvPreviewResult,
} from "@/lib/client/preview-parse";

export type UseParseCsvState = {
  preview: CsvPreviewResult | null;
  error: string | null;
  parsing: boolean;
  parseFile: (file: File) => Promise<CsvPreviewResult | null>;
  reset: () => void;
};

/**
 * Client-side CSV preview parse (Papa Parse). No network / no AI.
 */
export function useParseCsv(): UseParseCsvState {
  const [preview, setPreview] = useState<CsvPreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);

  const reset = useCallback(() => {
    setPreview(null);
    setError(null);
    setParsing(false);
  }, []);

  const parseFile = useCallback(async (file: File) => {
    setParsing(true);
    setError(null);
    try {
      const text = await file.text();
      const result = parseCsvForPreview(text);
      setPreview(result);
      return result;
    } catch (err) {
      const message =
        err instanceof PreviewParseError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to parse CSV";
      setPreview(null);
      setError(message);
      return null;
    } finally {
      setParsing(false);
    }
  }, []);

  return { preview, error, parsing, parseFile, reset };
}
