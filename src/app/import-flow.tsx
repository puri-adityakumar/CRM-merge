"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  CheckCircle2Icon,
  Loader2Icon,
  RotateCcwIcon,
} from "lucide-react";
import { toast } from "sonner";
import { UploadZone } from "@/components/upload-zone";
import { PreviewTable } from "@/components/preview-table";
import { ResultsTable } from "@/components/results-table";
import { StatsCards } from "@/components/stats-cards";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ImportProgress } from "@/components/import-progress";
import { useParseCsv } from "@/hooks/use-parse-csv";
import { useImport } from "@/hooks/use-import";
import { cn } from "@/lib/utils";

export type FlowStep = "upload" | "preview" | "processing" | "results";

const STEPS: { id: FlowStep; label: string }[] = [
  { id: "upload", label: "Upload" },
  { id: "preview", label: "Preview" },
  { id: "processing", label: "Import" },
  { id: "results", label: "Results" },
];

function stepIndex(step: FlowStep): number {
  return STEPS.findIndex((s) => s.id === step);
}

export function ImportFlow() {
  const [step, setStep] = useState<FlowStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [importFailed, setImportFailed] = useState<boolean>(false);
  const { preview, parsing, parseFile, reset: resetParse } = useParseCsv();
  const {
    importing,
    result,
    error: importError,
    progress,
    batchLog,
    startedAt,
    estimatedMs,
    runImport,
    cancel,
    reset: resetImport,
  } = useImport();

  const resetAll = useCallback(() => {
    setStep("upload");
    setFile(null);
    setImportFailed(false);
    resetParse();
    resetImport();
  }, [resetParse, resetImport]);

  const handleFileAccepted = useCallback(
    async (accepted: File) => {
      setFile(accepted);
      setImportFailed(false);
      const parsed = await parseFile(accepted);
      if (!parsed) {
        toast.error("Could not parse CSV for preview.");
        setFile(null);
        return;
      }
      toast.success(`Loaded ${parsed.rowCount} rows for preview`);
      setStep("preview");
    },
    [parseFile],
  );

  const handleConfirm = useCallback(async () => {
    if (!file) {
      toast.error("No file selected.");
      return;
    }
    setImportFailed(false);
    setStep("processing");
    const outcome = await runImport(file);
    if (outcome.ok) {
      toast.success(
        `Imported ${outcome.stats.totalImported}, skipped ${outcome.stats.totalSkipped}`,
      );
      setStep("results");
    } else {
      toast.error(outcome.error || "Import failed");
      setImportFailed(true);
    }
  }, [file, runImport]);

  const handleCancel = useCallback(() => {
    cancel();
    toast.info("Import cancelled");
    resetAll();
  }, [cancel, resetAll]);

  const current = stepIndex(step);

  // Enter key confirms import from preview step
  useEffect(() => {
    if (step !== "preview" || importing) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.repeat) {
        e.preventDefault();
        handleConfirm();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [step, importing, handleConfirm]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Import CSV to CRM
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
          Upload any valid CSV, preview the rows, then confirm to map fields into
          GrowEasy CRM format with AI. No processing runs until you confirm.
        </p>
      </div>

      <nav aria-label="Import steps" className="flex items-center justify-center gap-0">
        {STEPS.map((s, i) => {
          const active = s.id === step;
          const done = i < current;
          const last = i === STEPS.length - 1;
          return (
            <div key={s.id} className="flex items-center gap-0">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full text-xs font-bold transition-colors",
                    active && "bg-primary text-primary-foreground ring-2 ring-ring/30",
                    done && "bg-primary text-primary-foreground",
                    !active && !done && "border-2 border-border bg-background text-muted-foreground",
                  )}
                >
                  {done ? (
                    <CheckCircle2Icon className="size-3.5" />
                  ) : active ? (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    active && "text-foreground",
                    done && "text-foreground",
                    !active && !done && "text-muted-foreground",
                  )}
                >
                  {s.label}
                </span>
              </div>
              {!last && (
                <div className="mb-5 w-8 sm:w-12">
                  <div
                    className={cn(
                      "h-0.5 w-full rounded",
                      i < current ? "bg-primary" : "bg-border",
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>Upload CSV</CardTitle>
            <CardDescription>
              Drag and drop or pick a CSV file. Preview is client-side only — the
              import API is not called yet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UploadZone
              onFileAccepted={handleFileAccepted}
              parsing={parsing}
            />
          </CardContent>
        </Card>
      )}

      {step === "preview" && preview && file && (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              Review parsed rows. Confirm import only when you are ready — that
              sends the file to the server for AI extraction.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PreviewTable preview={preview} fileName={file.name} />
          </CardContent>
          <CardFooter className="justify-between gap-2">
            <Button type="button" variant="outline" onClick={resetAll}>
              <ArrowLeftIcon />
              Choose another file
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={importing || preview.rowCount === 0}
            >
              Confirm import
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === "processing" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {importFailed ? (
                <>
                  <AlertCircleIcon className="size-4 text-destructive" />
                  Import failed
                </>
              ) : (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Processing import
                </>
              )}
            </CardTitle>
            <CardDescription>
              {importFailed
                ? "The import request could not be completed. You can retry or choose another file."
                : "Streaming AI extraction progress from the server. This may take a moment for larger files or free-tier models."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {importFailed ? (
              <div className="space-y-3">
                {importError?.status && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Status:</span>{" "}
                    <span className="font-mono tabular-nums">
                      {importError.status}
                    </span>
                  </p>
                )}
                {importError?.code && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Code:</span>{" "}
                    <span className="font-mono">{importError.code}</span>
                  </p>
                )}
                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetAll}
                  >
                    Start over
                  </Button>
                  <Button
                    type="button"
                    onClick={handleConfirm}
                    disabled={!file || importing}
                  >
                    {importing ? (
                      <>
                        <Loader2Icon className="animate-spin" />
                        Retrying…
                      </>
                    ) : (
                      "Retry import"
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <ImportProgress
                fileName={file?.name}
                percent={
                  progress?.totalBatches
                    ? Math.min(100, Math.round((progress.processed / progress.totalBatches) * 100))
                    : null
                }
                batchLog={batchLog}
                startedAt={startedAt}
                estimatedMs={estimatedMs}
                onCancel={handleCancel}
              />
            )}
          </CardContent>
        </Card>
      )}

      {step === "results" && result?.ok && (
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2Icon className="size-4 text-primary" />
                Import complete
              </CardTitle>
              <CardDescription>
                AI-mapped CRM records from your CSV.
              </CardDescription>
            </div>
            <Button type="button" variant="outline" onClick={resetAll}>
              <RotateCcwIcon />
              Import another
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            <StatsCards stats={result.stats} />
            <ResultsTable
              imported={result.imported}
              skipped={result.skipped}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
