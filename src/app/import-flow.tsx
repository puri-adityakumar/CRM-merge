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
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        CSV to structured output
      </h1>

      {/* Horizontal stepper — mobile only */}
      <nav aria-label="Import steps" className="flex items-center gap-0 sm:hidden">
        {STEPS.map((s, i) => {
          const active = s.id === step;
          const done = i < current;
          const last = i === STEPS.length - 1;
          return (
            <div key={s.id} className="flex items-center gap-0">
              <div
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-[10px] font-bold transition-colors",
                  active && "bg-primary text-primary-foreground",
                  done && "bg-primary text-primary-foreground",
                  !active && !done && "border border-border bg-background text-muted-foreground",
                )}
              >
                {done ? (
                  <CheckCircle2Icon className="size-3" />
                ) : active && s.id === "processing" ? (
                  <Loader2Icon className="size-3 animate-spin" />
                ) : (
                  i + 1
                )}
              </div>
              {!last && (
                <div className="w-4 sm:w-6">
                  <div
                    className={cn(
                      "h-px w-full",
                      i < current ? "bg-primary" : "bg-border",
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="flex gap-6">
        {/* Vertical stepper sidebar */}
        <nav aria-label="Import steps" className="hidden w-32 shrink-0 flex-col sm:flex">
          {STEPS.map((s, i) => {
            const active = s.id === step;
            const done = i < current;
            const last = i === STEPS.length - 1;
            return (
              <div key={s.id} className="flex items-stretch gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
                      active && "bg-primary text-primary-foreground ring-2 ring-ring/30",
                      done && "bg-primary text-primary-foreground",
                      !active && !done && "border-2 border-border bg-background text-muted-foreground",
                    )}
                  >
                    {done ? (
                      <CheckCircle2Icon className="size-3.5" />
                    ) : active && s.id === "processing" ? (
                      <Loader2Icon className="size-3.5 animate-spin" />
                    ) : (
                      i + 1
                    )}
                  </div>
                  {!last && (
                    <div
                      className={cn(
                        "mt-1.5 w-0.5 flex-1 rounded",
                        i < current ? "bg-primary" : "bg-border",
                      )}
                    />
                  )}
                </div>
                <div className={cn("flex flex-col pb-5", last && "pb-0")}>
                  <span
                    className={cn(
                      "pt-1 text-sm font-medium",
                      active && "text-foreground",
                      done && "text-foreground",
                      !active && !done && "text-muted-foreground",
                    )}
                  >
                    {s.label}
                  </span>
                </div>
              </div>
            );
          })}
        </nav>

        {/* Content area */}
        <div className="min-w-0 flex-1">
          {step === "upload" && (
            <Card>
              <CardHeader>
                <CardTitle>Upload CSV</CardTitle>
                <CardDescription>
                  Upload any valid CSV, preview the rows, then confirm to map
                  fields into structured output with AI. No processing runs
                  until you confirm.
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
                  Review parsed rows. Confirm import only when you are ready —
                  that sends the file to the server for AI extraction.
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
                    : "Streaming AI extraction from the server. This may take a moment for larger files."}
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
              <CardHeader className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2Icon className="size-4 text-primary" />
                    Import complete
                  </CardTitle>
                  <Button type="button" variant="outline" onClick={resetAll}>
                    <RotateCcwIcon />
                    Import another
                  </Button>
                </div>
                <CardDescription>
                  AI-mapped CRM records from your CSV.
                </CardDescription>
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
      </div>
    </div>
  );
}

