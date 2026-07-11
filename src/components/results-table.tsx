"use client";

import { CRM_FIELDS, type CrmRecord } from "@/lib/schema/crm";
import type { SkippedRecord } from "@/lib/ai/post-process";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { scanRecord } from "@/lib/guardrails/detect";

export type ResultsTableProps = {
  imported: CrmRecord[];
  skipped: SkippedRecord[];
};

const PREVIEW_FIELDS = [
  "name",
  "email",
  "mobile_without_country_code",
  "city",
  "crm_status",
  "data_source",
] as const satisfies readonly (typeof CRM_FIELDS)[number][];

export function ResultsTable({ imported, skipped }: ResultsTableProps) {
  return (
    <div className="space-y-8" data-testid="results-table">
      {imported.length === 0 ? (
        <p className="text-sm text-muted-foreground px-2 py-4">
          No records were imported.
        </p>
      ) : (
        <div className="max-h-[calc(100dvh-18rem)] overflow-auto rounded-lg border border-border">
          <table className="w-full caption-bottom text-sm">
            <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
              <TableRow>
                <TableHead className="w-10 text-muted-foreground">#</TableHead>
                <TableHead className="w-12 text-muted-foreground">⚠</TableHead>
                {PREVIEW_FIELDS.map((f) => (
                  <TableHead key={f}>{f}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {imported.map((row, i) => {
                const violations = scanRecord(row as Record<string, string>);
                const types = [...new Set(violations.map((v) => v.type))];
                return (
                <TableRow key={i}>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {i + 1}
                  </TableCell>
                  <TableCell>
                    {types.length > 0 ? (
                      <div className="flex gap-1">
                        {types.map((t) => (
                          <Badge
                            key={t}
                            variant="outline"
                            className="px-1 py-0 text-[9px] leading-tight text-destructive border-destructive/30"
                          >
                            {t === "xss" ? "xss" : t === "sql_injection" ? "sql" : "formula"}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">·</span>
                    )}
                  </TableCell>
                  {PREVIEW_FIELDS.map((f) => (
                    <TableCell key={f} title={String(row[f] ?? "")}>
                      {row[f] || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
                );
              })}
            </TableBody>
          </table>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">Skipped records</h3>
          <Badge variant="secondary">{skipped.length}</Badge>
        </div>
        {skipped.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No records were skipped.
          </p>
        ) : (
          <div className="max-h-[calc(100dvh-18rem)] overflow-auto rounded-lg border border-border">
            <table className="w-full caption-bottom text-sm">
              <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
                <TableRow>
                  <TableHead className="w-12">Row</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Mobile</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {skipped.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {s.rowIndex != null ? s.rowIndex + 1 : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{s.reason}</Badge>
                    </TableCell>
                    <TableCell>{s.record.name || "—"}</TableCell>
                    <TableCell>{s.record.email || "—"}</TableCell>
                    <TableCell>
                      {s.record.mobile_without_country_code || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
