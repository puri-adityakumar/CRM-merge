"use client";

import { useCallback, useState } from "react";
import {
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
import { Badge } from "@/components/ui/badge";
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
  const { preview, parseFile, reset: resetParse } = useParseCsv();
  const {
    importing,
    result,
    error: importError,
    progress,
    runImport,
    reset: resetImport,
  } = useImport();

  const resetAll = useCallback(() => {
    setStep("upload");
    setFile(null);
    resetParse();
    resetImport();
  }, [resetParse, resetImport]);

  const handleFileAccepted = useCallback(
    async (accepted: File) => {
      setFile(accepted);
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
    setStep("processing");
    const outcome = await runImport(file);
    if (outcome.ok) {
      toast.success(
        `Imported ${outcome.stats.totalImported}, skipped ${outcome.stats.totalSkipped}`,
      );
      setStep("results");
    } else {
      toast.error(outcome.error || "Import failed");
      // Stay on processing with error UI; allow retry / back
      setStep("results");
    }
  }, [file, runImport]);

  const current = stepIndex(step);

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

      <nav aria-label="Import steps" className="flex flex-wrap gap-2">
        {STEPS.map((s, i) => {
          const active = s.id === step;
          const done = i < current;
          return (
            <Badge
              key={s.id}
              variant={active ? "default" : done ? "secondary" : "outline"}
              className={cn("px-2.5 py-1", active && "ring-2 ring-ring/30")}
            >
              <span className="tabular-nums opacity-70">{i + 1}.</span> {s.label}
            </Badge>
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
            <UploadZone onFileAccepted={handleFileAccepted} />
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
              <Loader2Icon className="size-4 animate-spin" />
              Processing import
            </CardTitle>
            <CardDescription>
              Streaming AI extraction progress from the server. This may take a
              moment for larger files or free-tier models.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ImportProgress
              fileName={file?.name}
              progress={progress}
            />
          </CardContent>
        </Card>
      )}

      {step === "results" && (
        <div className="space-y-4">
          {result?.ok ? (
            <>
              <Card>
                <CardHeader className="flex-row items-start justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2Icon className="size-4 text-emerald-600 dark:text-emerald-400" />
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
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Import failed</CardTitle>
                <CardDescription>
                  {importError?.error ??
                    "The import request failed. You can retry or choose another file."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {importError?.status ? (
                  <p>
                    <span className="text-muted-foreground">Status:</span>{" "}
                    <span className="font-mono tabular-nums">
                      {importError.status}
                    </span>
                  </p>
                ) : null}
                {importError?.code ? (
                  <p>
                    <span className="text-muted-foreground">Code:</span>{" "}
                    <span className="font-mono">{importError.code}</span>
                  </p>
                ) : null}
              </CardContent>
              <CardFooter className="gap-2">
                <Button type="button" variant="outline" onClick={resetAll}>
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
              </CardFooter>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
