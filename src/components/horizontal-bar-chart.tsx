"use client";

import { cn } from "@/lib/utils";

export type BarItem = {
  label: string;
  value: number;
  total?: number;
};

export type HorizontalBarChartProps = {
  data: BarItem[];
  title: string;
  className?: string;
};

export function HorizontalBarChart({
  data,
  title,
  className,
}: HorizontalBarChartProps) {
  if (data.length === 0) return null;

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className={cn("space-y-3", className)}>
      <h4 className="text-sm font-semibold text-muted-foreground">{title}</h4>
      <div className="space-y-2.5">
        {data.map((item) => {
          const pct = Math.round((item.value / max) * 100);
          const label = item.label.replace(/_/g, " ").toLowerCase();
          return (
            <div key={item.label} className="flex items-center gap-3">
              <span className="w-24 shrink-0 truncate text-xs capitalize text-muted-foreground sm:w-32">
                {label}
              </span>
              <div className="flex flex-1 items-center gap-2">
                <div className="h-4 flex-1 overflow-hidden rounded-sm bg-muted">
                  <div
                    className="h-full rounded-sm bg-primary transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                  {item.value}
                  {item.total != null && (
                    <span className="opacity-50">/{item.total}</span>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
