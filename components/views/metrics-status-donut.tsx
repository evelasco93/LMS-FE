"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { MetricsCounters, QualityRollup } from "@/lib/types";
import { buildStatusBreakdown } from "@/lib/metrics-derive";

const SLICE_TOKENS: Record<string, string> = {
  sold: "var(--color-success)",
  accepted_not_sold: "var(--color-primary)",
  dnq: "var(--color-warning)",
  duplicate: "var(--color-secondary)",
  spam: "var(--color-danger)",
};

const numberFormatter = new Intl.NumberFormat("en-US");

type MetricsStatusDonutProps = {
  totals: MetricsCounters;
  quality?: QualityRollup | null;
  loading?: boolean;
};

export function MetricsStatusDonut({
  totals,
  quality,
  loading,
}: MetricsStatusDonutProps) {
  const data = buildStatusBreakdown(totals, quality ?? null);
  const grandTotal = data.reduce((acc, d) => acc + d.value, 0);

  return (
    <div className="panel p-3 sm:p-4">
      <h3 className="mb-3 text-sm font-semibold text-[--color-text-strong]">
        Status Breakdown
      </h3>
      {loading && data.length === 0 ? (
        <div className="h-[220px] animate-pulse rounded-[--radius-sm] bg-[--color-bg-subtle]" />
      ) : data.length === 0 ? (
        <div className="flex h-[220px] items-center justify-center rounded-[--radius-sm] border border-dashed border-[--color-border] text-sm text-[--color-text-muted]">
          No outcome data for the selected filters.
        </div>
      ) : (
        <>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={54}
                  outerRadius={82}
                  paddingAngle={2}
                >
                  {data.map((entry) => (
                    <Cell
                      key={entry.key}
                      fill={SLICE_TOKENS[entry.key] || "var(--color-primary)"}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => numberFormatter.format(Number(value))}
                  contentStyle={{
                    borderRadius: "10px",
                    border: "1px solid var(--color-border)",
                    background: "var(--color-panel)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1 text-xs text-[--color-text]">
            {data.map((entry) => {
              const pct =
                grandTotal > 0
                  ? Math.round((entry.value / grandTotal) * 100)
                  : 0;
              return (
                <div key={entry.key} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        SLICE_TOKENS[entry.key] || "var(--color-primary)",
                    }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                  <span className="text-[--color-text-muted]">
                    {numberFormatter.format(entry.value)} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
