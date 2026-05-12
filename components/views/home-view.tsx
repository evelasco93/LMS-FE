"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import useSWR from "swr";
import {
  Activity,
  AlertTriangle,
  CalendarRange,
  RefreshCcw,
} from "lucide-react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/button";
import {
  getMetricsCampaignBySource,
  getMetricsContracts,
  getMetricsSummary,
  getMetricsTimeseries,
} from "@/lib/api";
import { inputClass } from "@/lib/utils";
import {
  Affiliate,
  Campaign,
  MetricsBreakdownEntry,
  MetricsContractEntry,
  MetricsCounters,
  MetricsQueryParams,
} from "@/lib/types";

const ZERO_COUNTERS: MetricsCounters = {
  received: 0,
  accepted: 0,
  sold: 0,
  accepted_not_sold: 0,
  rejected: 0,
};

const PIE_COLORS = ["#2550a2", "#1e73b1", "#81cff0", "#2e7d32", "#c9934d"];

const numberFormatter = new Intl.NumberFormat("en-US");

type HomeViewProps = {
  campaigns: Campaign[];
  affiliates: Affiliate[];
};

type PieDatum = {
  key: string;
  name: string;
  value: number;
};

function toInputDateValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
}

function formatAxisDate(value: string) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function toPieData(
  items: MetricsBreakdownEntry[],
  labelMap?: Map<string, string>,
) {
  const withCounts = items
    .map((item) => {
      const key = item.key?.trim();
      if (!key) return null;
      return {
        key,
        name: labelMap?.get(key) || key,
        value: item.counters.received,
      };
    })
    .filter((item): item is PieDatum => Boolean(item))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  return withCounts;
}

function sumCounters(rows: MetricsContractEntry[]) {
  return rows.reduce((acc, row) => acc + row.counters.received, 0);
}

export function HomeView({ campaigns, affiliates }: HomeViewProps) {
  const today = useMemo(() => new Date(), []);
  const defaultToDate = useMemo(() => toInputDateValue(today), [today]);
  const defaultFromDate = useMemo(() => {
    const start = new Date(today);
    start.setDate(start.getDate() - 29);
    return toInputDateValue(start);
  }, [today]);

  const [draftFilters, setDraftFilters] = useState<MetricsQueryParams>({
    from_date: defaultFromDate,
    to_date: defaultToDate,
    campaign_id: "",
  });
  const [appliedFilters, setAppliedFilters] = useState<MetricsQueryParams>({
    from_date: defaultFromDate,
    to_date: defaultToDate,
  });
  const [filterError, setFilterError] = useState<string | null>(null);

  const liveCampaigns = useMemo(
    () => campaigns.filter((campaign) => campaign.status === "ACTIVE"),
    [campaigns],
  );

  const campaignLabelById = useMemo(() => {
    return new Map(
      liveCampaigns.map((campaign) => [campaign.id, campaign.name]),
    );
  }, [liveCampaigns]);

  const contractNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const campaign of campaigns) {
      for (const client of campaign.clients || []) {
        const contractId = client.contract_id?.trim();
        const contractName = client.contract_name?.trim();
        if (contractId && contractName && !map.has(contractId)) {
          map.set(contractId, contractName);
        }
      }
    }
    return map;
  }, [campaigns]);

  const summaryKey = useMemo(
    () => [
      "metrics-summary",
      appliedFilters.from_date,
      appliedFilters.to_date,
      appliedFilters.campaign_id || "",
    ],
    [appliedFilters],
  );

  const {
    data: summary,
    error: summaryError,
    isLoading: summaryLoading,
  } = useSWR(summaryKey, () => getMetricsSummary(appliedFilters), {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const {
    data: timeseries,
    error: timeseriesError,
    isLoading: timeseriesLoading,
  } = useSWR(
    ["metrics-timeseries", ...summaryKey.slice(1)],
    () => getMetricsTimeseries(appliedFilters),
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );

  const {
    data: breakdown,
    error: breakdownError,
    isLoading: breakdownLoading,
  } = useSWR(
    ["metrics-breakdown", ...summaryKey.slice(1)],
    () => getMetricsCampaignBySource(appliedFilters),
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );

  const {
    data: contracts,
    error: contractsError,
    isLoading: contractsLoading,
  } = useSWR(
    ["metrics-contracts", ...summaryKey.slice(1, 4)],
    () =>
      getMetricsContracts({
        from_date: appliedFilters.from_date,
        to_date: appliedFilters.to_date,
        campaign_id: appliedFilters.campaign_id,
      }),
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );

  const lineData = useMemo(() => {
    return (timeseries?.data?.points || []).map((point) => ({
      day: point.bucket_start,
      received: point.counters.received,
      accepted: point.counters.accepted,
      sold: point.counters.sold,
      rejected: point.counters.rejected,
    }));
  }, [timeseries]);

  const selectedCampaign = useMemo(
    () =>
      liveCampaigns.find(
        (campaign) => campaign.id === appliedFilters.campaign_id,
      ),
    [liveCampaigns, appliedFilters.campaign_id],
  );

  const sourceLabelByKey = useMemo(() => {
    const affiliateNameById = new Map(
      affiliates
        .map(
          (affiliate) =>
            [affiliate.id?.trim(), affiliate.name?.trim()] as const,
        )
        .filter(([id, name]) => Boolean(id) && Boolean(name))
        .map(([id, name]) => [id as string, name as string]),
    );

    const map = new Map<string, string>();
    for (const campaign of campaigns) {
      for (const affiliate of campaign.affiliates || []) {
        const campaignKey = affiliate.campaign_key?.trim();
        if (!campaignKey || map.has(campaignKey)) continue;

        const affiliateId = affiliate.affiliate_id?.trim();
        const sourceName =
          (affiliateId ? affiliateNameById.get(affiliateId) : undefined) ||
          campaignKey;
        map.set(campaignKey, sourceName);
      }
    }

    return map;
  }, [campaigns, affiliates]);

  const campaignBreakdown = useMemo(() => {
    const rows = breakdown?.data?.campaigns || [];
    return toPieData(rows, campaignLabelById);
  }, [breakdown, campaignLabelById]);

  const sourceBreakdown = useMemo(() => {
    const rows = breakdown?.data?.sources || [];
    return toPieData(rows, sourceLabelByKey);
  }, [breakdown, sourceLabelByKey]);

  const contractRows = useMemo(() => {
    return [...(contracts?.data?.contracts || [])]
      .sort((a, b) => b.counters.received - a.counters.received)
      .slice(0, 8);
  }, [contracts]);

  const totals = summary?.data?.totals || ZERO_COUNTERS;

  const outcomeMixData = useMemo(() => {
    return [
      { name: "Sold", value: totals.sold },
      { name: "Accepted (Not Sold)", value: totals.accepted_not_sold },
      { name: "Rejected", value: totals.rejected },
    ].filter((entry) => entry.value > 0);
  }, [totals]);

  const campaignTotal = useMemo(
    () => campaignBreakdown.reduce((acc, entry) => acc + entry.value, 0),
    [campaignBreakdown],
  );
  const sourceTotal = useMemo(
    () => sourceBreakdown.reduce((acc, entry) => acc + entry.value, 0),
    [sourceBreakdown],
  );
  const outcomeTotal = useMemo(
    () => outcomeMixData.reduce((acc, entry) => acc + entry.value, 0),
    [outcomeMixData],
  );

  const activeError =
    summaryError || timeseriesError || contractsError || breakdownError;

  const applyFilters = () => {
    if (!draftFilters.from_date || !draftFilters.to_date) {
      setFilterError("Both from and to dates are required.");
      return;
    }
    if (draftFilters.from_date > draftFilters.to_date) {
      setFilterError("From date cannot be after to date.");
      return;
    }

    setFilterError(null);
    setAppliedFilters({
      from_date: draftFilters.from_date,
      to_date: draftFilters.to_date,
      campaign_id: draftFilters.campaign_id || undefined,
    });
  };

  const resetOptionalFilters = () => {
    setDraftFilters((prev) => ({ ...prev, campaign_id: "" }));
    setAppliedFilters((prev) => ({
      from_date: prev.from_date,
      to_date: prev.to_date,
    }));
    setFilterError(null);
  };

  const acceptedRate =
    totals.received > 0
      ? Math.round((totals.accepted / totals.received) * 100)
      : 0;
  const soldRate =
    totals.accepted > 0 ? Math.round((totals.sold / totals.accepted) * 100) : 0;

  return (
    <motion.section
      key="home"
      className="space-y-4"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <div className="panel p-4 sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[--color-text-strong]">
              Metrics Dashboard
            </h2>
            <p className="mt-1 text-sm text-[--color-text-muted]">
              Live aggregate views for intake, acceptance, and sales outcomes.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-[--radius-pill] border border-[--color-border] bg-[--color-bg-muted] px-3 py-1.5 text-xs text-[--color-text-muted]">
            <CalendarRange size={14} />
            {appliedFilters.from_date} to {appliedFilters.to_date}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold text-[--color-text-muted]">
              From date
            </span>
            <input
              type="date"
              className={inputClass}
              value={draftFilters.from_date}
              onChange={(event) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  from_date: event.target.value,
                }))
              }
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold text-[--color-text-muted]">
              To date
            </span>
            <input
              type="date"
              className={inputClass}
              value={draftFilters.to_date}
              onChange={(event) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  to_date: event.target.value,
                }))
              }
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold text-[--color-text-muted]">
              Campaign (optional)
            </span>
            <select
              className={inputClass}
              value={draftFilters.campaign_id || ""}
              onChange={(event) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  campaign_id: event.target.value,
                }))
              }
            >
              <option value="">All LIVE campaigns</option>
              {liveCampaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={applyFilters}
            iconLeft={<RefreshCcw size={14} />}
          >
            Apply filters
          </Button>
          <Button size="sm" variant="ghost" onClick={resetOptionalFilters}>
            Clear optional filters
          </Button>
          {filterError && (
            <span className="text-xs font-medium text-[--color-danger]">
              {filterError}
            </span>
          )}
        </div>
      </div>

      {activeError && (
        <div className="panel border-[color-mix(in_srgb,var(--color-danger)_45%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-danger)_8%,var(--color-panel))] p-3 text-sm text-[--color-text-strong]">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 text-[--color-danger]" />
            <span>
              Unable to load one or more metrics panels.{" "}
              {(activeError as Error)?.message || "Please retry."}
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "Received", value: totals.received },
          { label: "Accepted", value: totals.accepted },
          { label: "Sold", value: totals.sold },
          {
            label: "Accepted Rate",
            value: `${acceptedRate}%`,
          },
          {
            label: "Sold Rate",
            value: `${soldRate}%`,
          },
        ].map((kpi) => (
          <div key={kpi.label} className="panel p-3 sm:p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
              {kpi.label}
            </p>
            <p className="mt-2 text-xl font-bold text-[--color-text-strong] sm:text-2xl">
              {typeof kpi.value === "number"
                ? numberFormatter.format(kpi.value)
                : kpi.value}
            </p>
            {kpi.help && (
              <p
                className="mt-1 text-[11px] text-[--color-text-muted]"
                title={kpi.help}
              >
                {kpi.help}
              </p>
            )}
            {summaryLoading && !summary && (
              <div className="mt-2 h-1.5 w-20 animate-pulse rounded-full bg-[--color-bg-tertiary]" />
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <div className="panel p-3 sm:p-4 xl:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[--color-text-strong]">
              Timeseries
            </h3>
            <span className="text-xs text-[--color-text-muted]">
              {selectedCampaign
                ? `Campaign scoped: ${selectedCampaign.name}`
                : "Global scope (all campaigns)"}
            </span>
          </div>

          {timeseriesLoading && lineData.length === 0 ? (
            <div className="h-[300px] animate-pulse rounded-[--radius-sm] bg-[--color-bg-subtle]" />
          ) : lineData.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center rounded-[--radius-sm] border border-dashed border-[--color-border] text-sm text-[--color-text-muted]">
              No timeseries data for the selected filters.
            </div>
          ) : (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={lineData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                  />
                  <XAxis
                    dataKey="day"
                    tickFormatter={formatAxisDate}
                    stroke="var(--color-text-muted)"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    stroke="var(--color-text-muted)"
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    labelFormatter={(label) => formatAxisDate(String(label))}
                    contentStyle={{
                      borderRadius: "10px",
                      border: "1px solid var(--color-border)",
                      background: "var(--color-panel)",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="received"
                    stroke="#2550a2"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="accepted"
                    stroke="#1e73b1"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="sold"
                    stroke="#2e7d32"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="rejected"
                    stroke="#b4534d"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="panel p-3 sm:p-4">
          <h3 className="mb-3 text-sm font-semibold text-[--color-text-strong]">
            Campaign Breakdown
          </h3>
          {breakdownLoading && campaignBreakdown.length === 0 ? (
            <div className="h-[260px] animate-pulse rounded-[--radius-sm] bg-[--color-bg-subtle]" />
          ) : campaignBreakdown.length === 0 ? (
            <div className="flex h-[260px] items-center justify-center rounded-[--radius-sm] border border-dashed border-[--color-border] text-sm text-[--color-text-muted]">
              No campaign breakdown data.
            </div>
          ) : (
            <>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={campaignBreakdown}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={58}
                      outerRadius={86}
                      paddingAngle={2}
                    >
                      {campaignBreakdown.map((entry, index) => (
                        <Cell
                          key={`${entry.name}-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) =>
                        numberFormatter.format(Number(value))
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 space-y-1 text-xs text-[--color-text]">
                {campaignBreakdown.map((entry, index) => {
                  const ratio =
                    campaignTotal > 0
                      ? Math.round((entry.value / campaignTotal) * 100)
                      : 0;
                  return (
                    <div
                      key={`${entry.name}-legend`}
                      className="flex items-center gap-2"
                    >
                      <span
                        className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            PIE_COLORS[index % PIE_COLORS.length],
                        }}
                        aria-hidden
                      />
                      <span
                        className="min-w-0 flex-1 truncate"
                        title={entry.name}
                      >
                        {entry.name}
                      </span>
                      <span className="text-[--color-text-muted]">
                        {ratio}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <div className="panel p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[--color-text-strong]">
              Source Volume
            </h3>
            <span
              className="text-xs text-[--color-text-muted]"
              title="Source labels map campaign keys to source names."
            >
              Source name based
            </span>
          </div>
          {breakdownLoading && sourceBreakdown.length === 0 ? (
            <div className="h-[260px] animate-pulse rounded-[--radius-sm] bg-[--color-bg-subtle]" />
          ) : sourceBreakdown.length === 0 ? (
            <div className="flex h-[260px] items-center justify-center rounded-[--radius-sm] border border-dashed border-[--color-border] px-6 text-center text-sm text-[--color-text-muted]">
              No source volume found for the selected filters.
            </div>
          ) : (
            <>
              {selectedCampaign && (
                <p
                  className="mb-2 text-xs text-[--color-text-muted]"
                  title={selectedCampaign.name}
                >
                  Selected campaign: {selectedCampaign.name}
                </p>
              )}
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sourceBreakdown}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={58}
                      outerRadius={86}
                      paddingAngle={2}
                    >
                      {sourceBreakdown.map((entry, index) => (
                        <Cell
                          key={`${entry.name}-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) =>
                        numberFormatter.format(Number(value))
                      }
                      labelFormatter={(label, payload) => {
                        const key = String(payload?.[0]?.payload?.key || "");
                        const name = String(label);
                        return key && key !== name ? `${name} (${key})` : name;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 space-y-1 text-xs text-[--color-text]">
                {sourceBreakdown.map((entry, index) => {
                  const ratio =
                    sourceTotal > 0
                      ? Math.round((entry.value / sourceTotal) * 100)
                      : 0;
                  return (
                    <div
                      key={`${entry.name}-legend`}
                      className="flex items-center gap-2"
                    >
                      <span
                        className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            PIE_COLORS[index % PIE_COLORS.length],
                        }}
                        aria-hidden
                      />
                      <span
                        className="min-w-0 flex-1 truncate"
                        title={entry.name}
                      >
                        {entry.name}
                      </span>
                      <span className="text-[--color-text-muted]">
                        {numberFormatter.format(entry.value)} ({ratio}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="panel p-3 sm:p-4">
          <h3 className="mb-3 text-sm font-semibold text-[--color-text-strong]">
            Outcome Mix
          </h3>
          {summaryLoading && !summary ? (
            <div className="h-[260px] animate-pulse rounded-[--radius-sm] bg-[--color-bg-subtle]" />
          ) : outcomeMixData.length === 0 ? (
            <div className="flex h-[260px] items-center justify-center rounded-[--radius-sm] border border-dashed border-[--color-border] text-sm text-[--color-text-muted]">
              No outcome mix data for the selected filters.
            </div>
          ) : (
            <>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={outcomeMixData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={58}
                      outerRadius={86}
                      paddingAngle={2}
                    >
                      {outcomeMixData.map((entry, index) => (
                        <Cell
                          key={`${entry.name}-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) =>
                        numberFormatter.format(Number(value))
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 space-y-1 text-xs text-[--color-text]">
                {outcomeMixData.map((entry, index) => {
                  const ratio =
                    outcomeTotal > 0
                      ? Math.round((entry.value / outcomeTotal) * 100)
                      : 0;
                  return (
                    <div
                      key={`${entry.name}-legend`}
                      className="flex items-center gap-2"
                    >
                      <span
                        className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            PIE_COLORS[index % PIE_COLORS.length],
                        }}
                        aria-hidden
                      />
                      <span
                        className="min-w-0 flex-1 truncate"
                        title={entry.name}
                      >
                        {entry.name}
                      </span>
                      <span className="text-[--color-text-muted]">
                        {numberFormatter.format(entry.value)} ({ratio}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="panel p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[--color-text-strong]">
            Top Contracts
          </h3>
          <span className="inline-flex items-center gap-1 text-xs text-[--color-text-muted]">
            <Activity size={14} />
            Total received: {numberFormatter.format(sumCounters(contractRows))}
          </span>
        </div>

        {contractsLoading && contractRows.length === 0 ? (
          <div className="h-36 animate-pulse rounded-[--radius-sm] bg-[--color-bg-subtle]" />
        ) : contractRows.length === 0 ? (
          <div className="rounded-[--radius-sm] border border-dashed border-[--color-border] p-6 text-center text-sm text-[--color-text-muted]">
            No contract metrics found for this range.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-[--color-text-muted]">
                  <th className="px-3 py-1">Contract</th>
                  <th className="px-3 py-1">Received</th>
                  <th className="px-3 py-1">Accepted</th>
                  <th className="px-3 py-1">Sold</th>
                  <th className="px-3 py-1">Rejected</th>
                </tr>
              </thead>
              <tbody>
                {contractRows.map((row) => (
                  <tr
                    key={row.contract_id}
                    className="rounded-[--radius-sm] bg-[--color-bg-muted] text-[--color-text]"
                  >
                    <td className="px-3 py-2 font-medium text-[--color-text-strong]">
                      {contractNameById.get(row.contract_id || "") ||
                        row.contract_id ||
                        "Unknown"}
                    </td>
                    <td className="px-3 py-2">
                      {numberFormatter.format(row.counters.received)}
                    </td>
                    <td className="px-3 py-2">
                      {numberFormatter.format(row.counters.accepted)}
                    </td>
                    <td className="px-3 py-2">
                      {numberFormatter.format(row.counters.sold)}
                    </td>
                    <td className="px-3 py-2">
                      {numberFormatter.format(row.counters.rejected)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.section>
  );
}
