"use client";

import { useMemo, useState } from "react";
import { CheckCircle2Icon, RotateCcwIcon, SearchIcon } from "lucide-react";
import type { ImportSuccess } from "@/lib/client/import-api";
import type { CrmRecord } from "@/lib/schema/crm";
import { CRM_STATUS_VALUES, DATA_SOURCE_VALUES } from "@/lib/schema/crm";
import { StatsCards } from "@/components/stats-cards";
import { ResultsTable } from "@/components/results-table";
import { HorizontalBarChart } from "@/components/horizontal-bar-chart";
import { Button } from "@/components/ui/button";

export type ResultsSectionProps = {
  result: ImportSuccess;
  onImportAnother: () => void;
};

function computeStatusDistribution(records: CrmRecord[]) {
  const counts: Record<string, number> = {};
  for (const r of records) {
    const key = r.crm_status || "(unknown)";
    counts[key] = (counts[key] || 0) + 1;
  }
  return CRM_STATUS_VALUES.map((s) => ({
    label: s,
    value: counts[s] || 0,
  })).filter((d) => d.value > 0);
}

function computeSourceDistribution(records: CrmRecord[]) {
  const counts: Record<string, number> = {};
  for (const r of records) {
    const key = r.data_source || "(unknown)";
    counts[key] = (counts[key] || 0) + 1;
  }
  return DATA_SOURCE_VALUES.map((s) => ({
    label: s,
    value: counts[s] || 0,
  })).filter((d) => d.value > 0);
}

export function ResultsSection({ result, onImportAnother }: ResultsSectionProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<string>("");

  const filteredImported = useMemo(() => {
    let records = result.imported;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      records = records.filter(
        (r) =>
          r.name?.toLowerCase().includes(q) ||
          r.email?.toLowerCase().includes(q) ||
          r.mobile_without_country_code?.includes(q) ||
          r.city?.toLowerCase().includes(q),
      );
    }
    if (statusFilter) {
      records = records.filter((r) => r.crm_status === statusFilter);
    }
    if (sourceFilter) {
      records = records.filter((r) => r.data_source === sourceFilter);
    }
    return records;
  }, [result.imported, search, statusFilter, sourceFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <CheckCircle2Icon className="size-4 text-primary" />
            Import complete
          </h2>
          <p className="text-sm text-muted-foreground">
            AI-mapped records from your CSV.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={onImportAnother}>
          <RotateCcwIcon />
          Import another
        </Button>
      </div>

      <StatsCards stats={result.stats} />

      <div className="grid gap-6 sm:grid-cols-2">
        <HorizontalBarChart
          data={computeStatusDistribution(filteredImported)}
          title="Status distribution"
        />
        <HorizontalBarChart
          data={computeSourceDistribution(filteredImported)}
          title="Source breakdown"
        />
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Imported records</h3>
            <span className="text-xs text-muted-foreground tabular-nums">
              {filteredImported.length}
              {filteredImported.length !== result.imported.length && (
                <> / {result.imported.length}</>
              )}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Filter..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-36 rounded-md border border-border bg-background pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:border-ring focus:outline-none"
            >
              <option value="">All statuses</option>
              {CRM_STATUS_VALUES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ").toLowerCase()}
                </option>
              ))}
            </select>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:border-ring focus:outline-none"
            >
              <option value="">All sources</option>
              {DATA_SOURCE_VALUES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ").toLowerCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        <ResultsTable
          imported={filteredImported}
          skipped={result.skipped}
        />
      </section>
    </div>
  );
}
