"use client";

import { useCallback } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { FileSpreadsheetIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import {
  CLIENT_MAX_UPLOAD_BYTES,
  validateUploadFile,
} from "@/lib/client/file-validation";
import { cn } from "@/lib/utils";

export type UploadZoneProps = {
  onFileAccepted: (file: File) => void;
  disabled?: boolean;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadZone({ onFileAccepted, disabled }: UploadZoneProps) {
  const onDrop = useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      if (rejected.length > 0) {
        const first = rejected[0];
        const codes = first.errors.map((e) => e.code);
        if (codes.includes("file-invalid-type")) {
          toast.error("Only CSV files are supported. Please upload a .csv file.");
        } else if (codes.includes("file-too-large")) {
          toast.error(
            `File is too large: exceeds the limit of ${formatBytes(CLIENT_MAX_UPLOAD_BYTES)}.`,
          );
        } else {
          toast.error("Could not accept that file.");
        }
        return;
      }

      const file = accepted[0];
      if (!file) return;

      const result = validateUploadFile(file);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      onFileAccepted(file);
    },
    [onFileAccepted],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled,
    multiple: false,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".csv"],
    },
    maxSize: CLIENT_MAX_UPLOAD_BYTES,
  });

  return (
    <div
      {...getRootProps()}
      data-testid="upload-zone"
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-6 py-14 text-center transition-colors",
        "hover:border-foreground/30 hover:bg-muted/50",
        isDragActive && "border-primary bg-primary/5",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <input {...getInputProps()} aria-label="Upload CSV file" />
      <div className="flex size-12 items-center justify-center rounded-full bg-background ring-1 ring-border">
        {isDragActive ? (
          <FileSpreadsheetIcon className="size-5 text-primary" />
        ) : (
          <UploadIcon className="size-5 text-muted-foreground" />
        )}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">
          {isDragActive ? "Drop your CSV here" : "Drag & drop a CSV file"}
        </p>
        <p className="text-xs text-muted-foreground">
          or click to browse · .csv only · max{" "}
          {formatBytes(CLIENT_MAX_UPLOAD_BYTES)}
        </p>
      </div>
    </div>
  );
}
