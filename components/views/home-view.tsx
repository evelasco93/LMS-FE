"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import useSWR from "swr";
import {
  Activity,
  AlertTriangle,
  CalendarRange,
  ChevronDown,
  ChevronUp,
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

const CAMPAIGN_COLORS = ["#2550a2", "#1e73b1", "#81cff0", "#2e7d32", "#c9934d"];
const SOURCE_COLORS = ["#0f766e", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444"];
const OUTCOME_COLORS = ["#1d4ed8", "#0f766e", "#b45309"];

const numberFormatter = new Intl.NumberFormat("en-US");

type HomeViewProps = {
  campaigns: Campaign[];
  affiliates: Affiliate[];
  onOpenLeads?: (options: {
    status?: "accepted" | "rejected" | "sold";
    sourceKey?: string;
    campaignId?: string;
    affiliateId?: string;
  }) => void;
  onOpenCampaign?: (campaignId?: string) => void;
};

type PieDatum = {
  key: string;
  name: string;
  value: number;
};

type SourceTableRow = {
  key: string;
  name: string;
  received: number;
  accepted: number;
  sold: number;
};

type TimePreset =
  | "year_to_date"
  | "this_month"
  | "last_30_days"
  | "last_7_days"
  | "custom";

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

function getPresetDateRange(preset: TimePreset, now: Date) {
  const to = toInputDateValue(now);
  if (preset === "year_to_date") {
    const from = new Date(now.getFullYear(), 0, 1);
    return { from: toInputDateValue(from), to };
  }
  if (preset === "this_month") {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: toInputDateValue(from), to };
  }
  if (preset === "last_7_days") {
    const from = new Date(now);
    from.setDate(from.getDate() - 6);
    return { from: toInputDateValue(from), to };
  }
  const from = new Date(now);
  from.setDate(from.getDate() - 29);
  return { from: toInputDateValue(from), to };
}

function getRateBand(rate: number) {
  if (rate <= 30) return "red";
  if (rate >= 81) return "green";
  return "yellow";
}

function getRateTextColor(rate: number) {
  const band = getRateBand(rate);
  if (band === "red") return "text-[--color-danger]";
  if (band === "green") return "text-[--color-success]";
  return "text-[#b28707]";
}

export function HomeView({
  campaigns,
  affiliates,
  onOpenLeads,
  onOpenCampaign,
}: HomeViewProps) {
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
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [activePreset, setActivePreset] = useState<TimePreset>("last_30_days");
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

  const sourceAffiliateByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const campaign of campaigns) {
      for (const affiliate of campaign.affiliates || []) {
        const key = affiliate.campaign_key?.trim();
        const affiliateId = affiliate.affiliate_id?.trim();
        if (key && affiliateId && !map.has(key)) {
          map.set(key, affiliateId);
        }
      }
    }
    return map;
  }, [campaigns]);

  const sourceCampaignByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const campaign of campaigns) {
      for (const affiliate of campaign.affiliates || []) {
        const key = affiliate.campaign_key?.trim();
        if (key && !map.has(key)) {
          map.set(key, campaign.id);
        }
      }
    }
    return map;
  }, [campaigns]);

  const campaignBreakdown = useMemo(() => {
    const rows = breakdown?.data?.campaigns || [];
    return toPieData(rows, campaignLabelById);
  }, [breakdown, campaignLabelById]);

  const sourceBreakdown = useMemo(() => {
    const rows = breakdown?.data?.sources || [];
    return toPieData(rows, sourceLabelByKey);
  }, [breakdown, sourceLabelByKey]);

  const sourceTableRows = useMemo(() => {
    return (breakdown?.data?.sources || [])
      .map((item) => {
        const key = item.key?.trim();
        if (!key) return null;
        return {
          key,
          name: sourceLabelByKey.get(key) || key,
          received: item.counters.received,
          accepted: item.counters.accepted,
          sold: item.counters.sold,
        };
      })
      .filter((item): item is SourceTableRow => Boolean(item))
      .filter((item) => item.received > 0)
      .sort((a, b) => b.received - a.received);
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
  const sourceTableTotal = useMemo(
    () => sourceTableRows.reduce((acc, row) => acc + row.received, 0),
    [sourceTableRows],
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
    setActivePreset("custom");
  };

  const applyPreset = (preset: TimePreset) => {
    if (preset === "custom") {
      setActivePreset("custom");
      return;
    }

    const { from, to } = getPresetDateRange(preset, today);
    setFilterError(null);
    setActivePreset(preset);
    setDraftFilters((prev) => ({
      ...prev,
      from_date: from,
      to_date: to,
    }));
    setAppliedFilters((prev) => ({
      ...prev,
      from_date: from,
      to_date: to,
    }));
  };

  const resetOptionalFilters = () => {
    setDraftFilters((prev) => ({ ...prev, campaign_id: "" }));
    setAppliedFilters((prev) => ({
      from_date: prev.from_date,
      to_date: prev.to_date,
    }));
    setFilterError(null);
  };

  const openLeadsBySource = (sourceKey: string) => {
    onOpenLeads?.({
      sourceKey,
      campaignId:
        appliedFilters.campaign_id || sourceCampaignByKey.get(sourceKey),
      affiliateId: sourceAffiliateByKey.get(sourceKey),
    });
  };

  const openLeadsByStatus = (status: "rejected" | "sold") => {
    onOpenLeads?.({ status, campaignId: appliedFilters.campaign_id });
  };

  const acceptedRate =
    totals.received > 0
      ? Math.round((totals.accepted / totals.received) * 100)
      : 0;
  const soldRate =
    totals.accepted > 0 ? Math.round((totals.sold / totals.accepted) * 100) : 0;

  type KpiCard = {
    label: string;
    value: number | string;
    onClick?: () => void;
    valueClassName?: string;
    help?: string;
  };

  const kpiCards: KpiCard[] = [
    { label: "Received", value: totals.received },
    { label: "Accepted", value: totals.accepted },
    {
      label: "Sold",
      value: totals.sold,
      onClick: () => openLeadsByStatus("sold"),
    },
    {
      label: "Rejected",
      value: totals.rejected,
      onClick: () => openLeadsByStatus("rejected"),
    },
    {
      label: "Accepted Rate",
      value: `${acceptedRate}%`,
      valueClassName: getRateTextColor(acceptedRate),
    },
    {
      label: "Sold Rate",
      value: `${soldRate}%`,
      valueClassName: getRateTextColor(soldRate),
    },
  ];

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

        <div className="mt-4 rounded-[--radius-sm] border border-[--color-border] bg-[--color-bg-muted] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
              Filters
            </p>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-[--radius-pill] border border-[--color-border] bg-[--color-panel] px-2.5 py-1 text-xs font-semibold text-[--color-text-muted] transition hover:text-[--color-text-strong]"
              onClick={() => setFiltersOpen((prev) => !prev)}
            >
              {filtersOpen ? "Hide" : "Show"}
              {filtersOpen ? (
                <ChevronUp size={14} />
              ) : (
                <ChevronDown size={14} />
              )}
            </button>
          </div>

          {filtersOpen && (
            <>
              <div className="mt-3 flex flex-wrap gap-2">
                {(
                  [
                    { key: "year_to_date", label: "Year to date" },
                    { key: "this_month", label: "This month" },
                    { key: "last_30_days", label: "Last 30 days" },
                    { key: "last_7_days", label: "Last 7 days" },
                    { key: "custom", label: "Custom" },
                  ] as const
                ).map((preset) => {
                  const isActive = activePreset === preset.key;
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => applyPreset(preset.key)}
                      className={`rounded-[--radius-pill] border px-3 py-1 text-xs font-semibold transition ${
                        isActive
                          ? "border-[--color-border-alt] bg-[color-mix(in_srgb,var(--color-primary)_16%,var(--color-panel))] text-[--color-primary]"
                          : "border-[--color-border] bg-[--color-panel] text-[--color-text-muted] hover:text-[--color-text]"
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                {activePreset === "custom" && (
                  <>
                    <label className="text-sm">
                      <span className="mb-1 block text-xs font-semibold text-[--color-text-muted]">
                        From date
                      </span>
                      <input
                        type="date"
                        className={inputClass}
                        value={draftFilters.from_date}
                        onChange={(event) => {
                          setActivePreset("custom");
                          setDraftFilters((prev) => ({
                            ...prev,
                            from_date: event.target.value,
                          }));
                        }}
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
                        onChange={(event) => {
                          setActivePreset("custom");
                          setDraftFilters((prev) => ({
                            ...prev,
                            to_date: event.target.value,
                          }));
                        }}
                      />
                    </label>
                  </>
                )}

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
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={resetOptionalFilters}
                >
                  Clear optional filters
                </Button>
                {filterError && (
                  <span className="text-xs font-medium text-[--color-danger]">
                    {filterError}
                  </span>
                )}
              </div>
            </>
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {kpiCards.map((kpi) => (
          <div
            key={kpi.label}
            className={`panel p-3 sm:p-4 ${kpi.onClick ? "cursor-pointer transition hover:brightness-[1.02]" : ""}`}
            onClick={kpi.onClick}
            role={kpi.onClick ? "button" : undefined}
            tabIndex={kpi.onClick ? 0 : undefined}
            onKeyDown={(event) => {
              if (!kpi.onClick) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                kpi.onClick();
              }
            }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
              {kpi.label}
            </p>
            <p
              className={`mt-2 text-xl font-bold sm:text-2xl ${
                kpi.valueClassName || "text-[--color-text-strong]"
              }`}
            >
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
                      onClick={(_, index) => {
                        const row = campaignBreakdown[index];
                        if (row?.key) onOpenCampaign?.(row.key);
                      }}
                    >
                      {campaignBreakdown.map((entry, index) => (
                        <Cell
                          key={`${entry.name}-${index}`}
                          fill={CAMPAIGN_COLORS[index % CAMPAIGN_COLORS.length]}
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
                    <button
                      key={`${entry.name}-legend`}
                      type="button"
                      className="flex w-full items-center gap-2 text-left transition hover:text-[--color-primary]"
                      onClick={() => onOpenCampaign?.(entry.key)}
                    >
                      <span
                        className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            CAMPAIGN_COLORS[index % CAMPAIGN_COLORS.length],
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
                    </button>
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
                      onClick={(_, index) => {
                        const row = sourceBreakdown[index];
                        if (row?.key) openLeadsBySource(row.key);
                      }}
                    >
                      {sourceBreakdown.map((entry, index) => (
                        <Cell
                          key={`${entry.name}-${index}`}
                          fill={SOURCE_COLORS[index % SOURCE_COLORS.length]}
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
                    <button
                      key={`${entry.name}-legend`}
                      type="button"
                      className="flex w-full items-center gap-2 text-left transition hover:text-[--color-primary]"
                      onClick={() => openLeadsBySource(entry.key)}
                    >
                      <span
                        className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            SOURCE_COLORS[index % SOURCE_COLORS.length],
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
                    </button>
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
                      onClick={(_, index) => {
                        const row = outcomeMixData[index];
                        if (row?.name === "Sold") openLeadsByStatus("sold");
                        if (row?.name === "Rejected")
                          openLeadsByStatus("rejected");
                      }}
                    >
                      {outcomeMixData.map((entry, index) => (
                        <Cell
                          key={`${entry.name}-${index}`}
                          fill={OUTCOME_COLORS[index % OUTCOME_COLORS.length]}
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
                    <button
                      key={`${entry.name}-legend`}
                      type="button"
                      className={`flex w-full items-center gap-2 text-left ${
                        entry.name === "Sold" || entry.name === "Rejected"
                          ? "transition hover:text-[--color-primary]"
                          : ""
                      }`}
                      onClick={() => {
                        if (entry.name === "Sold") openLeadsByStatus("sold");
                        if (entry.name === "Rejected") {
                          openLeadsByStatus("rejected");
                        }
                      }}
                    >
                      <span
                        className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            OUTCOME_COLORS[index % OUTCOME_COLORS.length],
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
                    </button>
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
            Top Sources
          </h3>
          <span className="inline-flex items-center gap-1 text-xs text-[--color-text-muted]">
            <Activity size={14} />
            Total received: {numberFormatter.format(sourceTableTotal)}
          </span>
        </div>

        {breakdownLoading && sourceTableRows.length === 0 ? (
          <div className="h-36 animate-pulse rounded-[--radius-sm] bg-[--color-bg-subtle]" />
        ) : sourceTableRows.length === 0 ? (
          <div className="rounded-[--radius-sm] border border-dashed border-[--color-border] p-6 text-center text-sm text-[--color-text-muted]">
            No sources available for this filter scope.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-[--color-text-muted]">
                  <th className="px-3 py-1">Source</th>
                  <th className="px-3 py-1">Received</th>
                  <th className="px-3 py-1">Accepted</th>
                  <th className="px-3 py-1">Sold</th>
                  <th className="px-3 py-1">Share</th>
                </tr>
              </thead>
              <tbody>
                {sourceTableRows.slice(0, 12).map((row) => {
                  const ratio =
                    sourceTableTotal > 0
                      ? Math.round((row.received / sourceTableTotal) * 100)
                      : 0;

                  return (
                    <tr
                      key={`source-row-${row.key}`}
                      className="rounded-[--radius-sm] bg-[--color-bg-muted] text-[--color-text]"
                    >
                      <td className="px-3 py-2 font-medium text-[--color-text-strong]">
                        <button
                          type="button"
                          className="truncate text-left transition hover:text-[--color-primary]"
                          title={row.name}
                          onClick={() => openLeadsBySource(row.key)}
                        >
                          {row.name}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        {numberFormatter.format(row.received)}
                      </td>
                      <td className="px-3 py-2">
                        {numberFormatter.format(row.accepted)}
                      </td>
                      <td className="px-3 py-2">
                        {numberFormatter.format(row.sold)}
                      </td>
                      <td className="px-3 py-2">{ratio}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
