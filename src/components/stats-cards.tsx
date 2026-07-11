"use client";

import {
  LayersIcon,
  CheckCircle2Icon,
  SkipForwardIcon,
  FileStackIcon,
} from "lucide-react";
import type { ExtractionStats } from "@/lib/ai/extract";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type StatsCardsProps = {
  stats: ExtractionStats;
};

const ICONS = {
  "Total rows": LayersIcon,
  Imported: CheckCircle2Icon,
  Skipped: SkipForwardIcon,
  Batches: FileStackIcon,
} as const;

export function StatsCards({ stats }: StatsCardsProps) {
  const items = [
    {
      label: "Total rows",
      icon: "Total rows" as const,
      value: stats.totalRows,
      hint: "Parsed from CSV",
    },
    {
      label: "Imported",
      icon: "Imported" as const,
      value: stats.totalImported,
      hint: "Successfully mapped",
    },
    {
      label: "Skipped",
      icon: "Skipped" as const,
      value: stats.totalSkipped,
      hint: "Missing contact or failed",
    },
    {
      label: "Batches",
      icon: "Batches" as const,
      value: `${stats.batchesProcessed}${stats.batchesFailed ? ` (${stats.batchesFailed} failed)` : ""}`,
      hint: "AI extraction batches",
    },
  ];

  return (
    <div
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      data-testid="stats-cards"
    >
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        return (
          <Card key={item.label} size="sm">
            <CardHeader className="pb-0">
              <CardTitle className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Icon className="size-3.5 shrink-0" />
                {item.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tracking-tight tabular-nums">
                {item.value}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {item.hint}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
