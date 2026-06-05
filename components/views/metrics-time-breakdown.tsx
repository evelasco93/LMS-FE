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
import {
  bucketHourlyByLocalHour,
  bucketWeekdayByLocal,
} from "@/lib/metrics-derive";

const SLICE_TOKENS: Record<string, string> = {
  weekday: "var(--color-primary)",
  weekend: "var(--color-secondary)",
};

const HOUR_BAR_COLOR = "var(--color-primary)";

const numberFormatter = new Intl.NumberFormat("en-US");

function getShortTimeZoneAbbreviation(): string {
  if (typeof Intl === "undefined") return "local";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZoneName: "short",
    }).formatToParts(new Date());
    const abbr = parts.find((p) => p.type === "timeZoneName")?.value;
    return abbr || "local";
  } catch {
    return "local";
  }
}

type MetricsTimeBreakdownProps = {
  points: MetricsTimeseriesPoint[];
  hourlyPoints?: MetricsHourlyPoint[];
  loading?: boolean;
  hourlyLoading?: boolean;
};

export function MetricsTimeBreakdown({
  points,
  hourlyPoints = [],
  loading,
  hourlyLoading,
}: MetricsTimeBreakdownProps) {
  // Weekday slices derive from hourly points so the local-timezone re-bucketing
  // matches the Hour-of-Day chart below. `points` (daily-grain) is retained for
  // backwards-compatible callers but no longer used for derivation.
  void points;
  const weekdayData = bucketWeekdayByLocal(hourlyPoints);
  const weekdayTotal = weekdayData.reduce((acc, d) => acc + d.value, 0);
  const hourlyData = bucketHourlyByLocalHour(hourlyPoints);
  const hourlyTotal = hourlyData.reduce((acc, b) => acc + b.received, 0);

  return (
    <div className="panel h-full p-3 sm:p-4">
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
                  innerRadius={36}
                  outerRadius={76}
                  paddingAngle={2}
                  label={({
                    value,
                    cx,
                    cy,
                    midAngle,
                    innerRadius,
                    outerRadius,
                  }) => {
                    if (!weekdayTotal) return null;
                    const pct = Math.round(
                      (Number(value) / weekdayTotal) * 100,
                    );
                    if (pct < 5) return null;
                    const RAD = Math.PI / 180;
                    const r = (Number(innerRadius) + Number(outerRadius)) / 2;
                    const x =
                      Number(cx) + r * Math.cos(-Number(midAngle) * RAD);
                    const y =
                      Number(cy) + r * Math.sin(-Number(midAngle) * RAD);
                    return (
                      <text
                        x={x}
                        y={y}
                        fill="#ffffff"
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={11}
                        fontWeight={600}
                      >
                        {`${pct}%`}
                      </text>
                    );
                  }}
                  labelLine={false}
                  isAnimationActive={false}
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
          {`Hour of day (${getShortTimeZoneAbbreviation()})`}
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
                    `${String(label).padStart(2, "0")}:00`
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
