"use client";

import type { CsvPreviewResult } from "@/lib/client/preview-parse";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export type PreviewTableProps = {
  preview: CsvPreviewResult;
  fileName?: string;
  /** Cap displayed rows for very large previews (still show full counts). */
  maxRows?: number;
};

export function PreviewTable({
  preview,
  fileName,
  maxRows = 100,
}: PreviewTableProps) {
  const visible = preview.rows.slice(0, maxRows);
  const truncated = preview.rowCount > visible.length;

  return (
    <div className="space-y-3" data-testid="preview-table">
      <div className="flex flex-wrap items-center gap-2">
        {fileName ? (
          <p className="text-sm font-medium truncate max-w-[min(100%,20rem)]">
            {fileName}
          </p>
        ) : null}
        <Badge variant="secondary">
          {preview.rowCount} row{preview.rowCount === 1 ? "" : "s"}
        </Badge>
        <Badge variant="outline">
          {preview.columnCount} column{preview.columnCount === 1 ? "" : "s"}
        </Badge>
        {truncated ? (
          <span className="text-xs text-muted-foreground">
            Showing first {visible.length} rows
          </span>
        ) : null}
      </div>

      <div className="max-h-[min(24rem,50vh)] overflow-auto rounded-lg border border-border">
        <table className="w-full caption-bottom text-sm">
          <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
            <TableRow>
              <TableHead className="w-12 text-muted-foreground">#</TableHead>
              {preview.headers.map((h) => (
                <TableHead key={h || "(empty)"} title={h}>
                  {h || "(empty)"}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={preview.headers.length + 1}
                  className="h-20 text-center text-muted-foreground"
                >
                  No data rows (headers only). You can still try import after
                  confirm, but the API may reject empty CSVs.
                </TableCell>
              </TableRow>
            ) : (
              visible.map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {i + 1}
                  </TableCell>
                  {preview.headers.map((h) => (
                    <TableCell key={h || `col-${h}`} title={row[h] ?? ""}>
                      {row[h] || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </table>
      </div>
    </div>
  );
}
