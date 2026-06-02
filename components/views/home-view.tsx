"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import useSWR from "swr";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarRange,
  ChevronDown,
  ChevronUp,
  RefreshCcw,
} from "lucide-react";
import { useQueryState } from "@/hooks/use-query-state";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/button";
import {
  getMetricsByAffiliateCampaigns,
  getMetricsByCampaignAffiliates,
  getMetricsCampaignBySource,
  getMetricsSummary,
  getMetricsTimeseries,
  getMetricsTimeseriesBySource,
  getMetricsTimeseriesHourly,
} from "@/lib/api";
import { inputClass } from "@/lib/utils";
import { HoverTooltip } from "@/components/ui/hover-tooltip";
import {
  type MarketingSourceRow,
  buildMarketingSourceRows,
  acceptedRate,
  cherryPickedRate,
  deriveVolumeCounts,
  dnqRate,
  duplicateRate,
  rejectedRate,
  soldRate,
} from "@/lib/metrics-derive";
import { MetricsBySourceChart } from "@/components/views/metrics-by-source-chart";
import { MetricsMarketingSourcesTable } from "@/components/views/metrics-marketing-sources-table";
import { MetricsStatusDonut } from "@/components/views/metrics-status-donut";
import { MetricsTimeBreakdown } from "@/components/views/metrics-time-breakdown";
import {
  Affiliate,
  Campaign,
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

type TimePreset =
  | "year_to_date"
  | "this_month"
  | "last_30_days"
  | "last_7_days"
  | "yesterday"
  | "today"
  | "custom";

function toInputDateValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatAxisDate(value: string) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getPresetDateRange(preset: TimePreset, now: Date) {
  const to = toInputDateValue(now);
  if (preset === "year_to_date") {
    const from = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    return { from: toInputDateValue(from), to };
  }
  if (preset === "this_month") {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return { from: toInputDateValue(from), to };
  }
  if (preset === "last_7_days") {
    const from = new Date(now);
    from.setUTCDate(from.getUTCDate() - 6);
    return { from: toInputDateValue(from), to };
  }
  if (preset === "today") {
    return { from: to, to };
  }
  if (preset === "yesterday") {
    const from = new Date(now);
    from.setUTCDate(from.getUTCDate() - 1);
    const yesterday = toInputDateValue(from);
    return { from: yesterday, to: yesterday };
  }
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - 29);
  return { from: toInputDateValue(from), to };
}

export function HomeView({
  campaigns,
  affiliates,
  onOpenLeads,
}: HomeViewProps) {
  const today = useMemo(() => new Date(), []);
  const defaultToDate = useMemo(() => toInputDateValue(today), [today]);
  const defaultFromDate = useMemo(() => {
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - 29);
    return toInputDateValue(start);
  }, [today]);

  const [draftFilters, setDraftFilters] = useState<MetricsQueryParams>({
    from_date: defaultFromDate,
    to_date: defaultToDate,
    campaign_id: "",
    affiliate_id: "",
  });
  const [appliedFilters, setAppliedFilters] = useState<MetricsQueryParams>({
    from_date: defaultFromDate,
    to_date: defaultToDate,
  });
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [activePreset, setActivePreset] = useState<TimePreset>("last_30_days");
  const [filterError, setFilterError] = useState<string | null>(null);

  const { getParam, setQueryParams } = useQueryState();
  const urlAffiliateId = getParam("affiliate_id");
  useEffect(() => {
    setAppliedFilters((prev) => {
      const next = urlAffiliateId || undefined;
      if ((prev.affiliate_id || undefined) === next) return prev;
      return { ...prev, affiliate_id: next };
    });
    setDraftFilters((prev) => {
      const next = urlAffiliateId || "";
      if ((prev.affiliate_id || "") === next) return prev;
      return { ...prev, affiliate_id: next };
    });
  }, [urlAffiliateId]);

  const liveCampaigns = useMemo(
    () => campaigns.filter((campaign) => campaign.status === "ACTIVE"),
    [campaigns],
  );

  const campaignLabelById = useMemo(() => {
    return new Map(
      liveCampaigns.map((campaign) => [campaign.id, campaign.name]),
    );
  }, [liveCampaigns]);

  const summaryKey = useMemo(
    () => [
      "metrics-summary",
      appliedFilters.from_date,
      appliedFilters.to_date,
      appliedFilters.campaign_id || "",
      appliedFilters.affiliate_id || "",
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

  const { data: bySource, isLoading: bySourceLoading } = useSWR(
    ["metrics-timeseries-by-source", ...summaryKey.slice(1)],
    () => getMetricsTimeseriesBySource(appliedFilters),
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );

  const { data: hourly, isLoading: hourlyLoading } = useSWR(
    ["metrics-timeseries-hourly", ...summaryKey.slice(1)],
    () => getMetricsTimeseriesHourly(appliedFilters),
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

  const byCampaignAffiliatesKey = useMemo(
    () =>
      appliedFilters.campaign_id
        ? [
            "metrics-by-campaign-affiliates",
            appliedFilters.campaign_id,
            appliedFilters.from_date,
            appliedFilters.to_date,
          ]
        : null,
    [appliedFilters],
  );

  const { data: byCampaignAffiliates, isLoading: byCampaignAffiliatesLoading } =
    useSWR(
      byCampaignAffiliatesKey,
      () =>
        getMetricsByCampaignAffiliates(appliedFilters.campaign_id as string, {
          from_date: appliedFilters.from_date,
          to_date: appliedFilters.to_date,
        }),
      { revalidateOnFocus: false, revalidateOnReconnect: false },
    );

  const byAffiliateCampaignsKey = useMemo(
    () =>
      appliedFilters.affiliate_id
        ? [
            "metrics-by-affiliate-campaigns",
            appliedFilters.affiliate_id,
            appliedFilters.from_date,
            appliedFilters.to_date,
          ]
        : null,
    [appliedFilters],
  );

  const { data: byAffiliateCampaigns, isLoading: byAffiliateCampaignsLoading } =
    useSWR(
      byAffiliateCampaignsKey,
      () =>
        getMetricsByAffiliateCampaigns(appliedFilters.affiliate_id as string, {
          from_date: appliedFilters.from_date,
          to_date: appliedFilters.to_date,
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

  const affiliateNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const affiliate of affiliates) {
      const id = affiliate.id?.trim();
      const name = affiliate.name?.trim();
      if (id && name) map.set(id, name);
    }
    return map;
  }, [affiliates]);

  const marketingSourceRows = useMemo<MarketingSourceRow[]>(() => {
    if (appliedFilters.affiliate_id && byAffiliateCampaigns?.data?.campaigns) {
      return buildMarketingSourceRows(
        byAffiliateCampaigns.data.campaigns,
        (key) => campaignLabelById.get(key) || key,
      ).sort((a, b) => b.leads - a.leads);
    }
    if (appliedFilters.campaign_id && byCampaignAffiliates?.data?.sources) {
      return buildMarketingSourceRows(
        byCampaignAffiliates.data.sources,
        (key) => affiliateNameById.get(key) || key,
      ).sort((a, b) => b.leads - a.leads);
    }
    return buildMarketingSourceRows(
      breakdown?.data?.sources || [],
      (key) => sourceLabelByKey.get(key) || key,
    ).sort((a, b) => b.leads - a.leads);
  }, [
    appliedFilters.affiliate_id,
    appliedFilters.campaign_id,
    byAffiliateCampaigns,
    byCampaignAffiliates,
    breakdown,
    affiliateNameById,
    campaignLabelById,
    sourceLabelByKey,
  ]);

  const scopedAffiliateLabel = appliedFilters.affiliate_id
    ? affiliateNameById.get(appliedFilters.affiliate_id) ||
      appliedFilters.affiliate_id
    : null;

  const marketingSourcesScopeLabel = appliedFilters.affiliate_id
    ? `Campaigns under ${scopedAffiliateLabel}`
    : appliedFilters.campaign_id
      ? `Source = affiliate · scoped to ${selectedCampaign?.name || appliedFilters.campaign_id}`
      : " All live campaigns";

  const handleMarketingRowOpen = (row: MarketingSourceRow) => {
    if (appliedFilters.affiliate_id) {
      onOpenLeads?.({
        campaignId: row.key,
        affiliateId: appliedFilters.affiliate_id,
      });
      return;
    }
    const affiliateId = appliedFilters.campaign_id
      ? row.key
      : sourceAffiliateByKey.get(row.key);
    if (affiliateId) {
      setQueryParams({ affiliate_id: affiliateId });
      return;
    }
    openLeadsBySource(row.key);
  };

  const exitAffiliateScope = () => {
    setQueryParams({ affiliate_id: undefined });
  };

  const totals = summary?.data?.totals || ZERO_COUNTERS;

  const activeError = summaryError || timeseriesError || breakdownError;

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
    const nextAffiliateId = draftFilters.affiliate_id || undefined;
    setAppliedFilters({
      from_date: draftFilters.from_date,
      to_date: draftFilters.to_date,
      campaign_id: draftFilters.campaign_id || undefined,
      affiliate_id: nextAffiliateId,
    });
    if ((urlAffiliateId || undefined) !== nextAffiliateId) {
      setQueryParams({ affiliate_id: nextAffiliateId });
    }
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
    setDraftFilters((prev) => ({ ...prev, campaign_id: "", affiliate_id: "" }));
    setAppliedFilters((prev) => ({
      from_date: prev.from_date,
      to_date: prev.to_date,
    }));
    if (urlAffiliateId) setQueryParams({ affiliate_id: undefined });
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
                    { key: "yesterday", label: "Yesterday" },
                    { key: "today", label: "Today" },
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

                <label className="text-sm">
                  <span className="mb-1 block text-xs font-semibold text-[--color-text-muted]">
                    Source (optional)
                  </span>
                  <select
                    className={inputClass}
                    value={draftFilters.affiliate_id || ""}
                    onChange={(event) =>
                      setDraftFilters((prev) => ({
                        ...prev,
                        affiliate_id: event.target.value,
                      }))
                    }
                  >
                    <option value="">All sources</option>
                    {affiliates.map((affiliate) => (
                      <option key={affiliate.id} value={affiliate.id}>
                        {affiliate.name || affiliate.id}
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

      {appliedFilters.affiliate_id && (
        <div className="panel flex flex-wrap items-center justify-between gap-2 border-[color-mix(in_srgb,var(--color-primary)_36%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-primary)_8%,var(--color-panel))] p-3">
          <div className="flex flex-col text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
              Scoped to source
            </span>
            <span className="font-semibold text-[--color-text-strong]">
              {scopedAffiliateLabel}
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={exitAffiliateScope}
            iconLeft={<ArrowLeft size={14} />}
          >
            Back to all sources
          </Button>
        </div>
      )}

      <AllInquiriesChart
        lineData={lineData}
        loading={timeseriesLoading && lineData.length === 0}
        scopeLabel={
          selectedCampaign
            ? `Campaign: ${selectedCampaign.name}`
            : "All live campaigns"
        }
      />

      <MetricsBySourceChart
        series={bySource?.data?.series || []}
        loading={bySourceLoading && !bySource}
        resolveName={(id) => affiliateNameById.get(id) || id}
      />

      <SectionTitle>Volume</SectionTitle>
      <OverallTotalsChips
        totals={totals}
        quality={summary?.data?.quality}
        loading={summaryLoading && !summary}
      />

      <SectionTitle>Conversion</SectionTitle>
      <OverallMetricsTiles
        totals={totals}
        quality={summary?.data?.quality}
        loading={summaryLoading && !summary}
      />

      <MetricsMarketingSourcesTable
        rows={marketingSourceRows}
        loading={
          appliedFilters.affiliate_id
            ? byAffiliateCampaignsLoading
            : appliedFilters.campaign_id
              ? byCampaignAffiliatesLoading
              : breakdownLoading
        }
        overallTotals={totals}
        overallQuality={summary?.data?.quality}
        scopeLabel={marketingSourcesScopeLabel}
        headingLabel={
          appliedFilters.affiliate_id ? "Campaigns" : "Marketing Sources"
        }
        firstColumnLabel={appliedFilters.affiliate_id ? "Campaign" : "Source"}
        onRowOpen={handleMarketingRowOpen}
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <MetricsStatusDonut
            totals={totals}
            quality={summary?.data?.quality}
            loading={summaryLoading && !summary}
          />
        </div>
        <div className="flex flex-col gap-2">
          <MetricsTimeBreakdown
            points={timeseries?.data?.points || []}
            hourlyPoints={hourly?.data?.points || []}
            loading={timeseriesLoading && lineData.length === 0}
            hourlyLoading={hourlyLoading && !hourly}
          />
        </div>
      </div>
    </motion.section>
  );
}

// ── CR-001 — Screenshot-order helper sub-components ────────────────────────

type LineDatum = {
  day: string;
  received: number;
  accepted: number;
  sold: number;
  rejected: number;
};

function AllInquiriesChart({
  lineData,
  loading,
  scopeLabel,
}: {
  lineData: LineDatum[];
  loading: boolean;
  scopeLabel: string;
}) {
  return (
    <div className="panel p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[--color-text-strong]">
          All Leads
        </h3>
        <span className="text-xs text-[--color-text-muted]">{scopeLabel}</span>
      </div>
      {loading ? (
        <div className="h-[220px] animate-pulse rounded-[--radius-sm] bg-[--color-bg-subtle]" />
      ) : lineData.length === 0 ? (
        <div className="flex h-[220px] items-center justify-center rounded-[--radius-sm] border border-dashed border-[--color-border] text-sm text-[--color-text-muted]">
          No timeseries data for the selected filters.
        </div>
      ) : (
        <div className="h-[220px] w-full">
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
                tick={{ fontSize: 11 }}
              />
              <YAxis stroke="var(--color-text-muted)" tick={{ fontSize: 11 }} />
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
                name="Received"
                stroke="var(--color-primary)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function OverallMetricsTiles({
  totals,
  quality,
  loading,
}: {
  totals: MetricsCounters;
  quality?: import("@/lib/types").QualityRollup;
  loading: boolean;
}) {
  type Tile = { label: string; value: number; tone: string; tip: string };

  const parents: Tile[] = [
    {
      label: "Accepted %",
      value: acceptedRate(totals),
      tone: "text-[--color-success]",
      tip: "accepted ÷ received — accepted is non-overlap and equals Sold + Cherry Picked.",
    },
    {
      label: "Rejected %",
      value: rejectedRate(totals, quality ?? null),
      tone: "text-[--color-danger]",
      tip: "(DNQ + Duplicate) ÷ received — every inbound lead that did not become accepted.",
    },
  ];

  const children: Tile[] = [
    {
      label: "Sold %",
      value: soldRate(totals),
      tone: "text-[--color-success]",
      tip: "sold ÷ received — direct sold only, excluding cherry-picked leads.",
    },
    {
      label: "Cherry Picked %",
      value: cherryPickedRate(totals),
      tone: "text-[--color-cherry]",
      tip: "cherry_picked ÷ received — accepted via the separate cherry-pick rescue flow (not counted in Sold).",
    },
    {
      label: "DNQ %",
      value: dnqRate(totals, quality ?? null),
      tone: "text-[--color-warning]",
      tip: "(rejected − duplicates) ÷ received — leads rejected because they did not qualify (campaign rules, IPQS, missing fields, ineligible).",
    },
    {
      label: "Duplicate %",
      value: duplicateRate(totals, quality ?? null),
      tone: "text-[--color-duplicate]",
      tip: "duplicates ÷ received — leads rejected as duplicates of an existing lead fingerprint.",
    },
  ];

  return (
    <div className="space-y-3">
      {/* Parent tiles (totals) on top — Accepted % / Rejected %. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {parents.map((tile) => (
          <HoverTooltip
            key={tile.label}
            message={tile.tip}
            className="block w-full"
          >
            <div className="panel flex min-h-[102px] w-full cursor-default flex-col items-center justify-center p-2 text-center select-none sm:p-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                {tile.label}
              </span>
              <span
                className={`mt-2 text-xl font-bold tabular-nums sm:text-2xl ${tile.tone}`}
              >
                {loading ? "—" : `${tile.value.toFixed(1)}%`}
              </span>
            </div>
          </HoverTooltip>
        ))}
      </div>
      {/* Child tiles (breakdown) below — Sold/Cherry Picked + DNQ/Duplicate. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {children.map((tile) => (
          <HoverTooltip
            key={tile.label}
            message={tile.tip}
            className="block w-full"
          >
            <div className="panel flex min-h-[84px] w-full cursor-default flex-col items-center justify-center bg-[--color-bg-muted] p-2 text-center select-none sm:p-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
                {tile.label}
              </span>
              <span
                className={`mt-1 text-lg font-semibold tabular-nums sm:text-xl ${tile.tone}`}
              >
                {loading ? "—" : `${tile.value.toFixed(1)}%`}
              </span>
            </div>
          </HoverTooltip>
        ))}
      </div>
    </div>
  );
}

function OverallTotalsChips({
  totals,
  quality,
  loading,
}: {
  totals: MetricsCounters;
  quality?: import("@/lib/types").QualityRollup;
  loading: boolean;
}) {
  const fmt = numberFormatter.format;
  // Keep volume math aligned with dashboard taxonomy:
  //   accepted = backend accepted
  //   rejected = dnq + duplicate
  const v = deriveVolumeCounts(totals, quality ?? null);
  const hasDuplicateData =
    quality !== undefined || totals.rejected_duplicates !== undefined;

  const parents: Array<{
    label: string;
    value: string;
    tone?: string;
    tip: string;
  }> = [
    {
      label: "Received",
      value: fmt(v.received),
      tone: "text-[--color-primary]",
      tip: "Total inbound leads for the selected filters.",
    },
    {
      label: "Accepted",
      value: fmt(v.accepted),
      tone: "text-[--color-success]",
      tip: "Accepted total for the selected filters; non-overlap definition: Accepted = Sold + Cherry Picked.",
    },
    {
      label: "Rejected",
      value: fmt(v.rejected),
      tone: "text-[--color-danger]",
      tip: "Derived parent total: Rejected = DNQ + Duplicate.",
    },
  ];

  const children: Array<{
    label: string;
    value: string;
    tone?: string;
    tip: string;
  }> = [
    {
      label: "Sold",
      value: fmt(v.sold),
      tone: "text-[--color-success]",
      tip: "Direct sold only, excluding cherry-picked leads.",
    },
    {
      label: "Cherry Picked",
      value: fmt(v.cherryPicked),
      tone: "text-[--color-cherry]",
      tip: "Accepted via the separate cherry-pick rescue flow; tracked separately from Sold.",
    },
    {
      label: "DNQ",
      value: fmt(v.dnq),
      tone: "text-[--color-warning]",
      tip: "Did not qualify (non-duplicate rejections).",
    },
    {
      label: "Duplicate",
      value: hasDuplicateData ? fmt(v.duplicate) : "—",
      tone: "text-[--color-duplicate]",
      tip: "Rejected as duplicate lead fingerprints.",
    },
  ];

  return (
    <div className="space-y-3">
      {/* Parent tiles (totals) on top — Received / Accepted / Rejected. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {parents.map((chip) => (
          <HoverTooltip
            key={chip.label}
            message={chip.tip}
            className="block w-full"
          >
            <div className="panel flex min-h-[102px] w-full cursor-default flex-col items-center justify-center p-2 text-center select-none sm:p-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                {chip.label}
              </span>
              <span
                className={`mt-2 text-xl font-bold tabular-nums sm:text-2xl ${chip.tone ?? "text-[--color-text-strong]"}`}
              >
                {loading ? "—" : chip.value}
              </span>
            </div>
          </HoverTooltip>
        ))}
      </div>
      {/* Child tiles (breakdown) below. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {children.map((chip) => (
          <HoverTooltip
            key={chip.label}
            message={chip.tip}
            className="block w-full"
          >
            <div className="panel flex min-h-[84px] w-full cursor-default flex-col items-center justify-center bg-[--color-bg-muted] p-2 text-center select-none sm:p-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
                {chip.label}
              </span>
              <span
                className={`mt-1 text-lg font-semibold tabular-nums sm:text-xl ${chip.tone ?? "text-[--color-text]"}`}
              >
                {loading ? "—" : chip.value}
              </span>
            </div>
          </HoverTooltip>
        ))}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold uppercase tracking-wide text-[--color-text-strong]">
      {children}
    </h3>
  );
}
