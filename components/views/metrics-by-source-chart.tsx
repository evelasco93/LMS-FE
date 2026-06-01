"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MetricsBySourceSeries } from "@/lib/types";

const numberFormatter = new Intl.NumberFormat("en-US");

// Stable, theme-aware palette. Recharts can't subscribe to CSS variables for
// strokes, so we use a curated token-flavored hex palette that holds up in both
// light and dark modes.
const SERIES_COLORS = [
  "#2563eb", // blue-600
  "#16a34a", // green-600
  "#f59e0b", // amber-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#0ea5e9", // sky-500
  "#ec4899", // pink-500
  "#14b8a6", // teal-500
  "#a855f7", // purple-500
  "#f97316", // orange-500
];

function formatAxisDate(value: string) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type MetricsBySourceChartProps = {
  series: MetricsBySourceSeries[];
  loading?: boolean;
  resolveName?: (affiliateId: string) => string;
};

type RowMap = Map<string, Record<string, number | string>>;

function buildChartData(series: MetricsBySourceSeries[]) {
  const rows: RowMap = new Map();
  for (const s of series) {
    for (const p of s.points) {
      const existing = rows.get(p.bucket_start) || { day: p.bucket_start };
      existing[s.affiliate_id] = p.received;
      rows.set(p.bucket_start, existing);
    }
  }
  return Array.from(rows.values()).sort((a, b) =>
    String(a.day) < String(b.day) ? -1 : 1,
  );
}

export function MetricsBySourceChart({
  series,
  loading,
  resolveName,
}: MetricsBySourceChartProps) {
  const data = useMemo(() => buildChartData(series), [series]);
  const labelFor = (s: MetricsBySourceSeries) => {
    const resolved = resolveName?.(s.affiliate_id);
    if (resolved && resolved !== s.affiliate_id) return resolved;
    if (s.affiliate_name && s.affiliate_name !== s.affiliate_id) {
      return s.affiliate_name;
    }
    return resolved || s.affiliate_name || s.affiliate_id;
  };
  const palette = useMemo(() => {
    const map = new Map<string, string>();
    series.forEach((s, idx) => {
      map.set(s.affiliate_id, SERIES_COLORS[idx % SERIES_COLORS.length]);
    });
    return map;
  }, [series]);

  return (
    <div className="panel p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[--color-text-strong]">
          By Source
        </h3>
      </div>
      {loading && data.length === 0 ? (
        <div className="h-[260px] animate-pulse rounded-[--radius-sm] bg-[--color-bg-subtle]" />
      ) : data.length === 0 || series.length === 0 ? (
        <div className="flex h-[260px] items-center justify-center rounded-[--radius-sm] border border-dashed border-[--color-border] text-sm text-[--color-text-muted]">
          No per-source timeseries data for the selected filters.
        </div>
      ) : (
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
              />
              <XAxis
                dataKey="day"
                tickFormatter={formatAxisDate}
                stroke="var(--color-text-muted)"
                tick={{ fontSize: 11 }}
              />
              <YAxis stroke="var(--color-text-muted)" tick={{ fontSize: 11 }} />
              <Tooltip
                labelFormatter={(label) => formatAxisDate(String(label))}
                formatter={(value) => numberFormatter.format(Number(value))}
                contentStyle={{
                  borderRadius: "10px",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-panel)",
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                iconType="plainline"
              />
              {series.map((s) => (
                <Line
                  key={s.affiliate_id}
                  type="monotone"
                  dataKey={s.affiliate_id}
                  name={labelFor(s)}
                  stroke={palette.get(s.affiliate_id) || "var(--color-primary)"}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
