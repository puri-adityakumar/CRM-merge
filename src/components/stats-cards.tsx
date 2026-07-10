"use client";

import type { ExtractionStats } from "@/lib/ai/extract";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type StatsCardsProps = {
  stats: ExtractionStats;
};

export function StatsCards({ stats }: StatsCardsProps) {
  const items = [
    {
      label: "Total rows",
      value: stats.totalRows,
      hint: "Parsed from CSV",
    },
    {
      label: "Imported",
      value: stats.totalImported,
      hint: "Successfully mapped",
    },
    {
      label: "Skipped",
      value: stats.totalSkipped,
      hint: "Missing contact or failed",
    },
    {
      label: "Batches",
      value: `${stats.batchesProcessed}${stats.batchesFailed ? ` (${stats.batchesFailed} failed)` : ""}`,
      hint: "AI extraction batches",
    },
  ];

  return (
    <div
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      data-testid="stats-cards"
    >
      {items.map((item) => (
        <Card key={item.label} size="sm">
          <CardHeader className="pb-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {item.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight tabular-nums">
              {item.value}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{item.hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
