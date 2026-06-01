"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MetricsHourlyPoint, MetricsTimeseriesPoint } from "@/lib/types";

const SLICE_TOKENS: Record<string, string> = {
  weekday: "var(--color-primary)",
  weekend: "var(--color-secondary)",
};

const HOUR_BAR_COLOR = "var(--color-primary)";

const numberFormatter = new Intl.NumberFormat("en-US");

type MetricsTimeBreakdownProps = {
  points: MetricsTimeseriesPoint[];
  hourlyPoints?: MetricsHourlyPoint[];
  loading?: boolean;
  hourlyLoading?: boolean;
};

type Slice = { key: string; name: string; value: number };

function buildWeekdaySlices(points: MetricsTimeseriesPoint[]): Slice[] {
  let weekday = 0;
  let weekend = 0;
  for (const point of points) {
    const bucket = point.bucket_start;
    if (!bucket) continue;
    const date = new Date(`${bucket}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) continue;
    const dow = date.getUTCDay();
    const received = point.counters?.received ?? 0;
    if (dow === 0 || dow === 6) weekend += received;
    else weekday += received;
  }
  const out: Slice[] = [];
  if (weekday > 0)
    out.push({ key: "weekday", name: "Weekday", value: weekday });
  if (weekend > 0)
    out.push({ key: "weekend", name: "Weekend", value: weekend });
  return out;
}

function buildHourlyBuckets(points: MetricsHourlyPoint[]) {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${hour.toString().padStart(2, "0")}:00`,
    received: 0,
  }));
  for (const p of points) {
    if (p.hour < 0 || p.hour > 23) continue;
    buckets[p.hour].received += p.counters?.received ?? 0;
  }
  return buckets;
}

export function MetricsTimeBreakdown({
  points,
  hourlyPoints = [],
  loading,
  hourlyLoading,
}: MetricsTimeBreakdownProps) {
  const weekdayData = buildWeekdaySlices(points);
  const weekdayTotal = weekdayData.reduce((acc, d) => acc + d.value, 0);
  const hourlyData = buildHourlyBuckets(hourlyPoints);
  const hourlyTotal = hourlyData.reduce((acc, b) => acc + b.received, 0);

  return (
    <div className="panel p-3 sm:p-4">
      <h3 className="mb-3 text-sm font-semibold text-[--color-text-strong]">
        Time Breakdown
      </h3>

      {loading && weekdayData.length === 0 ? (
        <div className="h-[180px] animate-pulse rounded-[--radius-sm] bg-[--color-bg-subtle]" />
      ) : weekdayData.length === 0 ? (
        <div className="flex h-[180px] items-center justify-center rounded-[--radius-sm] border border-dashed border-[--color-border] text-sm text-[--color-text-muted]">
          No timeseries data for the selected filters.
        </div>
      ) : (
        <>
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={weekdayData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={44}
                  outerRadius={70}
                  paddingAngle={2}
                >
                  {weekdayData.map((entry) => (
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
            {weekdayData.map((entry) => {
              const pct =
                weekdayTotal > 0
                  ? Math.round((entry.value / weekdayTotal) * 100)
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

      <div className="mt-4 border-t border-[--color-border] pt-3">
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
          Hour of day (UTC)
        </h4>
        {hourlyLoading && hourlyTotal === 0 ? (
          <div className="h-[140px] animate-pulse rounded-[--radius-sm] bg-[--color-bg-subtle]" />
        ) : hourlyTotal === 0 ? (
          <div className="flex h-[140px] items-center justify-center rounded-[--radius-sm] border border-dashed border-[--color-border] text-sm text-[--color-text-muted]">
            No hourly data for the selected filters.
          </div>
        ) : (
          <div className="h-[140px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={hourlyData}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="hour"
                  stroke="var(--color-text-muted)"
                  tick={{ fontSize: 10 }}
                  interval={1}
                />
                <YAxis
                  stroke="var(--color-text-muted)"
                  tick={{ fontSize: 10 }}
                  allowDecimals={false}
                />
                <Tooltip
                  labelFormatter={(label) =>
                    `${String(label).padStart(2, "0")}:00 UTC`
                  }
                  formatter={(value) => numberFormatter.format(Number(value))}
                  contentStyle={{
                    borderRadius: "10px",
                    border: "1px solid var(--color-border)",
                    background: "var(--color-panel)",
                  }}
                />
                <Bar
                  dataKey="received"
                  fill={HOUR_BAR_COLOR}
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
