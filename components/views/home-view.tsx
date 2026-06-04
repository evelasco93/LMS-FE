"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
import { getMetricsDashboard } from "@/lib/api";
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
import {
  CampaignSummaryCardItem,
  CampaignSummaryCardGrid,
} from "@/components/views/campaign-summary-cards";
import { MetricsMarketingSourcesTable } from "@/components/views/metrics-marketing-sources-table";
import { MetricsStatusDonut } from "@/components/views/metrics-status-donut";
import { MetricsTimeBreakdown } from "@/components/views/metrics-time-breakdown";
import { CampaignDashboardWidgets } from "@/components/views/campaign-dashboard-widgets";
import {
  Affiliate,
  Campaign,
  MetricsCounters,
  MetricsDashboardData,
  MetricsBreakdownData,
  MetricsBySourceData,
  MetricsQueryParams,
  MetricsSummaryData,
  MetricsTimeseriesData,
  MetricsHourlyData,
} from "@/lib/types";

const ZERO_COUNTERS: MetricsCounters = {
  received: 0,
  accepted: 0,
  sold: 0,
  accepted_not_sold: 0,
  rejected: 0,
};

const numberFormatter = new Intl.NumberFormat("en-US");
const ALL_TIME_FROM_DATE = "1970-01-01";

function safePercent(numerator: number, denominator: number): number {
  if (!denominator || denominator <= 0) return 0;
  return (numerator / denominator) * 100;
}

function getDashboardSlice<T>(
  dashboardData: MetricsDashboardData | undefined,
  keys: string[],
): T | undefined {
  if (!dashboardData) return undefined;
  const root = dashboardData as Record<string, unknown>;
  const sections =
    (root.sections as Record<string, unknown> | undefined) || undefined;

  for (const key of keys) {
    const fromSections = sections?.[key];
    if (fromSections && typeof fromSections === "object") {
      return fromSections as T;
    }

    const fromRoot = root[key];
    if (fromRoot && typeof fromRoot === "object") {
      return fromRoot as T;
    }
  }

  return undefined;
}

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
  | "all_time"
  | "custom";

type DashboardCampaignScope = "all" | "campaign";
type DashboardRouteMode = "chooser" | "scoped";

const TIME_PRESETS: TimePreset[] = [
  "year_to_date",
  "this_month",
  "last_30_days",
  "last_7_days",
  "yesterday",
  "today",
  "all_time",
  "custom",
];

function isIsoInputDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function parseTimePreset(value: string | null): TimePreset | null {
  if (!value) return null;
  return TIME_PRESETS.includes(value as TimePreset)
    ? (value as TimePreset)
    : null;
}

function parseCampaignScope(
  value: string | null,
): DashboardCampaignScope | null {
  if (!value) return null;
  return value === "all" || value === "campaign"
    ? (value as DashboardCampaignScope)
    : null;
}

function parseDashboardRouteMode(
  value: string | null,
): DashboardRouteMode | null {
  if (!value) return null;
  return value === "chooser" || value === "scoped"
    ? (value as DashboardRouteMode)
    : null;
}

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

  const { getParam, setQueryParams } = useQueryState();

  const resolveCampaignScope = useMemo(
    () =>
      (campaignId?: string): DashboardCampaignScope =>
        campaignId ? "campaign" : "all",
    [],
  );

  const resolvePresetRange = useMemo(
    () => (preset: TimePreset) => {
      if (preset === "custom") {
        return { from: defaultFromDate, to: defaultToDate };
      }
      if (preset === "all_time") {
        return { from: ALL_TIME_FROM_DATE, to: defaultToDate };
      }
      return getPresetDateRange(preset, today);
    },
    [defaultFromDate, defaultToDate, today],
  );

  const buildDashboardQuery = useMemo(
    () =>
      (filters: MetricsQueryParams, preset: TimePreset): MetricsQueryParams => {
        const resolvedRange =
          preset === "custom"
            ? { from: filters.from_date, to: filters.to_date }
            : resolvePresetRange(preset);
        const baseFilters = {
          campaign_id: filters.campaign_id || undefined,
          campaign_key: filters.campaign_key || undefined,
          affiliate_id: filters.affiliate_id || undefined,
        };
        return {
          ...baseFilters,
          from_date: resolvedRange.from,
          to_date: resolvedRange.to,
        };
      },
    [resolvePresetRange],
  );

  const buildDashboardUrlParams = useMemo(
    () =>
      (
        filters: MetricsQueryParams,
        preset: TimePreset,
        mode: DashboardRouteMode = "scoped",
      ) => {
        const resolvedRange =
          preset === "custom"
            ? { from: filters.from_date, to: filters.to_date }
            : resolvePresetRange(preset);
        const campaignScope =
          mode === "scoped"
            ? resolveCampaignScope(filters.campaign_id)
            : undefined;
        const params: Record<string, string | undefined> = {
          view: "dashboard",
          dashboard_mode: mode,
          campaign_scope: campaignScope,
          campaign_id:
            mode === "scoped" ? filters.campaign_id || undefined : undefined,
          campaign_key:
            mode === "scoped" ? filters.campaign_key || undefined : undefined,
          affiliate_id:
            mode === "scoped" ? filters.affiliate_id || undefined : undefined,
          from_date: resolvedRange.from,
          to_date: resolvedRange.to,
          time_preset: preset,
        };
        return params;
      },
    [resolveCampaignScope, resolvePresetRange],
  );

  const initialUrlFilters = useMemo(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const parsedPreset = parseTimePreset(params.get("time_preset"));
    const initialPreset: TimePreset =
      parsedPreset && parsedPreset !== "custom" ? parsedPreset : "custom";

    let fromDate = isIsoInputDate(params.get("from_date"))
      ? (params.get("from_date") as string)
      : defaultFromDate;
    let toDate = isIsoInputDate(params.get("to_date"))
      ? (params.get("to_date") as string)
      : defaultToDate;
    if (fromDate > toDate) {
      fromDate = defaultFromDate;
      toDate = defaultToDate;
    }

    if (initialPreset !== "custom") {
      const presetRange =
        initialPreset === "all_time"
          ? { from: ALL_TIME_FROM_DATE, to: defaultToDate }
          : getPresetDateRange(initialPreset, today);
      fromDate = presetRange.from;
      toDate = presetRange.to;
    }

    const campaignId = params.get("campaign_id") || "";
    const campaignKey = params.get("campaign_key") || "";
    const affiliateId = params.get("affiliate_id") || "";
    const preset =
      initialPreset !== "custom"
        ? initialPreset
        : fromDate === defaultFromDate && toDate === defaultToDate
          ? "last_30_days"
          : "custom";

    return {
      fromDate,
      toDate,
      campaignId,
      campaignKey,
      affiliateId,
      preset,
    } as const;
  }, [defaultFromDate, defaultToDate, today]);

  const [draftFilters, setDraftFilters] = useState<MetricsQueryParams>(() => ({
    from_date: initialUrlFilters?.fromDate || defaultFromDate,
    to_date: initialUrlFilters?.toDate || defaultToDate,
    campaign_id: initialUrlFilters?.campaignId || "",
    campaign_key: initialUrlFilters?.campaignKey || "",
    affiliate_id: initialUrlFilters?.affiliateId || "",
  }));
  const [appliedFilters, setAppliedFilters] = useState<MetricsQueryParams>(
    () => ({
      from_date: initialUrlFilters?.fromDate || defaultFromDate,
      to_date: initialUrlFilters?.toDate || defaultToDate,
      campaign_id: initialUrlFilters?.campaignId || undefined,
      campaign_key: initialUrlFilters?.campaignKey || undefined,
      affiliate_id: initialUrlFilters?.affiliateId || undefined,
    }),
  );
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [activePreset, setActivePreset] = useState<TimePreset>(
    initialUrlFilters?.preset || "last_30_days",
  );
  const [campaignSearch, setCampaignSearch] = useState("");
  const [filterError, setFilterError] = useState<string | null>(null);
  const [dashboardMode, setDashboardMode] = useState(false);
  const [campaignFilterLocked, setCampaignFilterLocked] = useState(false);

  const urlFromDate = getParam("from_date");
  const urlToDate = getParam("to_date");
  const urlCampaignId = getParam("campaign_id");
  const urlCampaignKey = getParam("campaign_key");
  const urlAffiliateId = getParam("affiliate_id");
  const urlTimePreset = getParam("time_preset");
  const urlView = getParam("view");
  const urlDashboardMode = getParam("dashboard_mode");
  const urlCampaignScope = getParam("campaign_scope");

  useEffect(() => {
    const parsedPreset = parseTimePreset(urlTimePreset);
    const nextPreset: TimePreset =
      parsedPreset && parsedPreset !== "custom" ? parsedPreset : "custom";

    let nextFromDate = isIsoInputDate(urlFromDate)
      ? urlFromDate
      : defaultFromDate;
    let nextToDate = isIsoInputDate(urlToDate) ? urlToDate : defaultToDate;
    if (nextFromDate > nextToDate) {
      nextFromDate = defaultFromDate;
      nextToDate = defaultToDate;
    }

    if (nextPreset !== "custom") {
      const presetRange = resolvePresetRange(nextPreset);
      nextFromDate = presetRange.from;
      nextToDate = presetRange.to;
    }

    const nextCampaignId = urlCampaignId || undefined;
    const nextCampaignKey = urlCampaignKey || undefined;
    const nextAffiliateId = urlAffiliateId || undefined;

    const effectivePreset =
      nextPreset !== "custom"
        ? nextPreset
        : nextFromDate === defaultFromDate && nextToDate === defaultToDate
          ? "last_30_days"
          : "custom";

    setAppliedFilters((prev) => {
      if (
        prev.from_date === nextFromDate &&
        prev.to_date === nextToDate &&
        (prev.campaign_id || undefined) === nextCampaignId &&
        (prev.campaign_key || undefined) === nextCampaignKey &&
        (prev.affiliate_id || undefined) === nextAffiliateId
      ) {
        return prev;
      }
      return {
        from_date: nextFromDate,
        to_date: nextToDate,
        campaign_id: nextCampaignId,
        campaign_key: nextCampaignKey,
        affiliate_id: nextAffiliateId,
      };
    });

    setDraftFilters((prev) => {
      const nextCampaignDraft = nextCampaignId || "";
      const nextCampaignKeyDraft = nextCampaignKey || "";
      const nextAffiliateDraft = nextAffiliateId || "";
      if (
        prev.from_date === nextFromDate &&
        prev.to_date === nextToDate &&
        (prev.campaign_id || "") === nextCampaignDraft &&
        (prev.campaign_key || "") === nextCampaignKeyDraft &&
        (prev.affiliate_id || "") === nextAffiliateDraft
      ) {
        return prev;
      }
      return {
        from_date: nextFromDate,
        to_date: nextToDate,
        campaign_id: nextCampaignDraft,
        campaign_key: nextCampaignKeyDraft,
        affiliate_id: nextAffiliateDraft,
      };
    });

    setActivePreset((prev) =>
      prev === effectivePreset ? prev : effectivePreset,
    );
  }, [
    defaultFromDate,
    defaultToDate,
    resolvePresetRange,
    urlAffiliateId,
    urlCampaignId,
    urlCampaignKey,
    urlFromDate,
    urlTimePreset,
    urlToDate,
  ]);

  useEffect(() => {
    const normalizedCampaignId = (urlCampaignId || "").trim() || undefined;
    const parsedScope = parseCampaignScope(urlCampaignScope);
    const parsedDashboardMode = parseDashboardRouteMode(urlDashboardMode);
    const isLegacyDashboardMode = urlView === "home";
    const isDashboardRoute =
      urlView === "dashboard" || isLegacyDashboardMode || !urlView;
    const shouldOpenDashboard = !isDashboardRoute
      ? false
      : parsedDashboardMode === "chooser"
        ? false
        : parsedDashboardMode === "scoped"
          ? true
          : Boolean(normalizedCampaignId) ||
            parsedScope === "all" ||
            parsedScope === "campaign" ||
            isLegacyDashboardMode;

    setDashboardMode((prev) =>
      prev === shouldOpenDashboard ? prev : shouldOpenDashboard,
    );
    setCampaignFilterLocked((prev) => {
      const nextLocked = shouldOpenDashboard && Boolean(normalizedCampaignId);
      return prev === nextLocked ? prev : nextLocked;
    });

    if (isLegacyDashboardMode || !urlView || !parsedDashboardMode) {
      setQueryParams({
        view: "dashboard",
        dashboard_mode: shouldOpenDashboard ? "scoped" : "chooser",
        campaign_scope: shouldOpenDashboard
          ? resolveCampaignScope(normalizedCampaignId)
          : undefined,
      });
    }
  }, [
    urlDashboardMode,
    resolveCampaignScope,
    setQueryParams,
    urlCampaignId,
    urlCampaignScope,
    urlView,
  ]);

  const liveCampaigns = useMemo(
    () => campaigns.filter((campaign) => campaign.status === "ACTIVE"),
    [campaigns],
  );

  const allCampaigns = useMemo(() => campaigns, [campaigns]);

  const campaignLabelById = useMemo(() => {
    return new Map(
      liveCampaigns.map((campaign) => [campaign.id, campaign.name]),
    );
  }, [liveCampaigns]);

  const dashboardKey = useMemo(
    () =>
      dashboardMode
        ? [
            "metrics-dashboard",
            activePreset,
            appliedFilters.from_date || "",
            appliedFilters.to_date || "",
            appliedFilters.campaign_id || "",
            appliedFilters.campaign_key || "",
            appliedFilters.affiliate_id || "",
          ]
        : null,
    [activePreset, appliedFilters, dashboardMode],
  );

  const cardCatalogFilters = useMemo<MetricsQueryParams>(() => {
    const startOfYear = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
    return {
      from_date: toInputDateValue(startOfYear),
      to_date: defaultToDate,
    };
  }, [defaultToDate, today]);

  const allTimeDashboardKey = useMemo(
    () => [
      "metrics-dashboard",
      "card-catalog-ytd",
      cardCatalogFilters.from_date || "",
      cardCatalogFilters.to_date || "",
    ],
    [cardCatalogFilters.from_date, cardCatalogFilters.to_date],
  );

  const dashboardRequestFilters = useMemo(
    () => buildDashboardQuery(appliedFilters, activePreset),
    [activePreset, appliedFilters, buildDashboardQuery],
  );

  const {
    data: allTimeDashboard,
    error: allTimeDashboardError,
    isLoading: allTimeDashboardLoading,
  } = useSWR(
    allTimeDashboardKey,
    () => getMetricsDashboard(cardCatalogFilters),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      refreshInterval: 15_000,
    },
  );

  const {
    data: dashboard,
    error: dashboardError,
    isLoading: dashboardLoading,
  } = useSWR(dashboardKey, () => getMetricsDashboard(dashboardRequestFilters), {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    refreshInterval: 15_000,
  });

  const dashboardData = dashboard?.data;
  const allTimeDashboardData = allTimeDashboard?.data;

  const allTimeSummary = useMemo(
    () =>
      getDashboardSlice<MetricsSummaryData>(allTimeDashboardData, [
        "summary",
        "totals_summary",
      ]),
    [allTimeDashboardData],
  );

  const allTimeBreakdown = useMemo(
    () =>
      getDashboardSlice<MetricsBreakdownData>(allTimeDashboardData, [
        "campaign_by_source",
        "breakdown",
      ]),
    [allTimeDashboardData],
  );

  const summary = useMemo(
    () =>
      getDashboardSlice<MetricsSummaryData>(dashboardData, [
        "summary",
        "totals_summary",
      ]),
    [dashboardData],
  );

  const timeseries = useMemo(
    () =>
      getDashboardSlice<MetricsTimeseriesData>(dashboardData, [
        "timeseries",
        "all_leads_timeseries",
      ]),
    [dashboardData],
  );

  const bySource = useMemo(
    () =>
      getDashboardSlice<MetricsBySourceData>(dashboardData, [
        "timeseries_by_source",
        "by_source",
      ]),
    [dashboardData],
  );

  const hourly = useMemo(
    () =>
      getDashboardSlice<MetricsHourlyData>(dashboardData, [
        "timeseries_hourly",
        "hourly",
      ]),
    [dashboardData],
  );

  const breakdown = useMemo(
    () =>
      getDashboardSlice<MetricsBreakdownData>(dashboardData, [
        "campaign_by_source",
        "breakdown",
      ]),
    [dashboardData],
  );

  const byCampaignAffiliates = useMemo(
    () =>
      getDashboardSlice<MetricsBreakdownData>(dashboardData, [
        "by_campaign_affiliates",
        "campaign_affiliates",
      ]),
    [dashboardData],
  );

  const byAffiliateCampaigns = useMemo(
    () =>
      getDashboardSlice<MetricsBreakdownData>(dashboardData, [
        "by_affiliate_campaigns",
        "affiliate_campaigns",
      ]),
    [dashboardData],
  );

  const lineData = useMemo(() => {
    return (timeseries?.points || []).map((point) => ({
      day: point.bucket_start,
      received: point.counters.received,
      accepted: point.counters.accepted,
      sold: point.counters.sold,
      rejected: point.counters.rejected,
    }));
  }, [timeseries]);

  const totals = summary?.totals || ZERO_COUNTERS;

  const selectedCampaign = useMemo(
    () =>
      allCampaigns.find(
        (campaign) => campaign.id === appliedFilters.campaign_id,
      ),
    [allCampaigns, appliedFilters.campaign_id],
  );

  const campaignBreakdownById = useMemo(() => {
    return new Map(
      (allTimeBreakdown?.campaigns || []).map((entry) => [entry.key, entry]),
    );
  }, [allTimeBreakdown]);

  const allTimeTotals = allTimeSummary?.totals || ZERO_COUNTERS;

  const campaignCards = useMemo<CampaignSummaryCardItem[]>(() => {
    const allCard: CampaignSummaryCardItem = {
      id: "all",
      title: "All Campaigns",
      metrics: {
        totalLeads: allTimeTotals.received,
        trustedScorePct: allTimeSummary?.ipqs?.trusted_score_pct ?? null,
        accepted: allTimeTotals.accepted,
        acceptedPct: safePercent(
          allTimeTotals.accepted,
          allTimeTotals.received,
        ),
        rejected: allTimeTotals.rejected,
        rejectedPct: safePercent(
          allTimeTotals.rejected,
          allTimeTotals.received,
        ),
      },
    };

    const cards = liveCampaigns.map((campaign) => {
      const campaignMetrics = campaignBreakdownById.get(campaign.id);
      return {
        id: campaign.id,
        title: campaign.name,
        metrics: {
          totalLeads: campaignMetrics?.counters.received || 0,
          trustedScorePct: campaignMetrics?.ipqs?.trusted_score_pct ?? null,
          accepted: campaignMetrics?.counters.accepted || 0,
          acceptedPct: safePercent(
            campaignMetrics?.counters.accepted || 0,
            campaignMetrics?.counters.received || 0,
          ),
          rejected: campaignMetrics?.counters.rejected || 0,
          rejectedPct: safePercent(
            campaignMetrics?.counters.rejected || 0,
            campaignMetrics?.counters.received || 0,
          ),
        },
      } satisfies CampaignSummaryCardItem;
    });

    return [allCard, ...cards];
  }, [
    allTimeSummary?.ipqs?.trusted_score_pct,
    allTimeTotals,
    campaignBreakdownById,
    liveCampaigns,
  ]);

  const showDashboardPanelsLoading =
    dashboardMode && dashboardLoading && !dashboardData;

  const dashboardTransitionKey = useMemo(
    () =>
      [
        activePreset,
        appliedFilters.from_date || "",
        appliedFilters.to_date || "",
        appliedFilters.campaign_id || "",
        appliedFilters.campaign_key || "",
        appliedFilters.affiliate_id || "",
      ].join("|"),
    [
      activePreset,
      appliedFilters.affiliate_id,
      appliedFilters.campaign_id,
      appliedFilters.campaign_key,
      appliedFilters.from_date,
      appliedFilters.to_date,
    ],
  );

  const visibleCampaignCards = useMemo<CampaignSummaryCardItem[]>(() => {
    const query = campaignSearch.trim().toLowerCase();
    if (!query) return campaignCards;

    return campaignCards.filter((card) => {
      return card.title.toLowerCase().includes(query);
    });
  }, [campaignCards, campaignSearch]);

  const handleCampaignCardSelect = (cardId: string) => {
    const nextCampaignId = cardId === "all" ? undefined : cardId;
    const shouldLockCampaignFilter = cardId !== "all";
    setDraftFilters((prev) => ({
      ...prev,
      campaign_id: nextCampaignId || "",
      campaign_key: "",
      affiliate_id: "",
    }));
    setAppliedFilters((prev) => ({
      ...prev,
      campaign_id: nextCampaignId,
      campaign_key: undefined,
      affiliate_id: undefined,
    }));
    setCampaignFilterLocked(shouldLockCampaignFilter);
    setDashboardMode(true);
    setFiltersOpen(true);
    setQueryParams(
      buildDashboardUrlParams(
        {
          ...appliedFilters,
          campaign_id: nextCampaignId,
          campaign_key: undefined,
          affiliate_id: undefined,
        },
        activePreset,
      ),
    );
  };

  const backToCardsView = () => {
    setDashboardMode(false);
    setCampaignFilterLocked(false);
    setDraftFilters((prev) => ({
      ...prev,
      campaign_id: "",
      campaign_key: "",
      affiliate_id: "",
    }));
    setAppliedFilters((prev) => ({
      ...prev,
      campaign_id: undefined,
      campaign_key: undefined,
      affiliate_id: undefined,
    }));
    setQueryParams(
      buildDashboardUrlParams(
        {
          ...appliedFilters,
          campaign_id: undefined,
          campaign_key: undefined,
          affiliate_id: undefined,
        },
        activePreset,
        "chooser",
      ),
    );
  };

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

  const sourceKeyByCampaignAndAffiliate = useMemo(() => {
    const map = new Map<string, string>();
    for (const campaign of campaigns) {
      for (const affiliate of campaign.affiliates || []) {
        const affiliateId = affiliate.affiliate_id?.trim();
        const campaignKey = affiliate.campaign_key?.trim();
        if (!campaign.id || !affiliateId || !campaignKey) continue;
        map.set(`${campaign.id}:${affiliateId}`, campaignKey);
      }
    }
    return map;
  }, [campaigns]);

  const sourceKeyByAffiliateId = useMemo(() => {
    const map = new Map<string, string>();
    for (const campaign of campaigns) {
      for (const affiliate of campaign.affiliates || []) {
        const affiliateId = affiliate.affiliate_id?.trim();
        const campaignKey = affiliate.campaign_key?.trim();
        if (affiliateId && campaignKey && !map.has(affiliateId)) {
          map.set(affiliateId, campaignKey);
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

  const resolveSourceLabel = useMemo(
    () => (key: string) =>
      affiliateNameById.get(key) || sourceLabelByKey.get(key) || key,
    [affiliateNameById, sourceLabelByKey],
  );

  const sourceScopeKeys = useMemo(() => {
    const keys = new Set<string>();
    const affiliateId = appliedFilters.affiliate_id?.trim();
    const campaignId = appliedFilters.campaign_id?.trim();
    const campaignKey = appliedFilters.campaign_key?.trim();

    if (affiliateId) {
      keys.add(affiliateId);
      const campaignScopedKey = campaignId
        ? sourceKeyByCampaignAndAffiliate.get(`${campaignId}:${affiliateId}`)
        : undefined;
      if (campaignScopedKey) keys.add(campaignScopedKey);

      const affiliateScopedKey = sourceKeyByAffiliateId.get(affiliateId);
      if (affiliateScopedKey) keys.add(affiliateScopedKey);
    }

    if (campaignKey) {
      keys.add(campaignKey);
      const relatedAffiliateId = sourceAffiliateByKey.get(campaignKey);
      if (relatedAffiliateId) keys.add(relatedAffiliateId);
    }

    return keys;
  }, [
    appliedFilters.affiliate_id,
    appliedFilters.campaign_id,
    appliedFilters.campaign_key,
    sourceAffiliateByKey,
    sourceKeyByAffiliateId,
    sourceKeyByCampaignAndAffiliate,
  ]);

  const sourceScopedCampaignIds = useMemo(() => {
    const campaignIds = new Set<string>();
    const affiliateId = appliedFilters.affiliate_id?.trim();
    const campaignKey = appliedFilters.campaign_key?.trim();

    for (const campaign of campaigns) {
      const affiliatesForCampaign = campaign.affiliates || [];
      const matchesAffiliate =
        Boolean(affiliateId) &&
        affiliatesForCampaign.some(
          (affiliate) => affiliate.affiliate_id?.trim() === affiliateId,
        );
      const matchesCampaignKey =
        Boolean(campaignKey) &&
        affiliatesForCampaign.some(
          (affiliate) => affiliate.campaign_key?.trim() === campaignKey,
        );

      if (matchesAffiliate || matchesCampaignKey) {
        campaignIds.add(campaign.id);
      }
    }

    return campaignIds;
  }, [appliedFilters.affiliate_id, appliedFilters.campaign_key, campaigns]);

  const inSourceScope = Boolean(
    appliedFilters.affiliate_id || appliedFilters.campaign_key,
  );

  const showsCampaignParticipationRows =
    !appliedFilters.campaign_id && inSourceScope;

  const marketingSourceRows = useMemo<MarketingSourceRow[]>(() => {
    const toRows = (
      entries:
        | MetricsBreakdownData["sources"]
        | MetricsBreakdownData["campaigns"],
      labelResolver: (key: string) => string,
    ) =>
      buildMarketingSourceRows(entries, labelResolver).sort(
        (a, b) => b.leads - a.leads,
      );

    // Deterministic scope matrix:
    // 1) campaign + source scope => source row(s) for that campaign/source.
    // 2) source scope without campaign => campaigns this source participates in.
    // 3) campaign only => source rows for selected campaign.
    // 4) no campaign/source scope => source rows for all campaigns.
    if (appliedFilters.campaign_id && inSourceScope) {
      const sourceEntries = byCampaignAffiliates?.sources?.length
        ? byCampaignAffiliates.sources
        : breakdown?.sources || [];
      return toRows(
        sourceEntries.filter((entry) => sourceScopeKeys.has(entry.key)),
        resolveSourceLabel,
      );
    }

    if (!appliedFilters.campaign_id && inSourceScope) {
      const campaignEntries = byAffiliateCampaigns?.campaigns?.length
        ? byAffiliateCampaigns.campaigns
        : breakdown?.campaigns || [];

      const scopedCampaignEntries =
        sourceScopedCampaignIds.size > 0
          ? campaignEntries.filter((entry) =>
              sourceScopedCampaignIds.has(entry.key),
            )
          : campaignEntries;

      if (sourceScopedCampaignIds.size === 1 && summary) {
        const singleCampaignId = Array.from(sourceScopedCampaignIds)[0];
        const [singleCampaignRow] = toRows(
          [
            {
              key: singleCampaignId,
              counters: totals,
              ipqs: summary.ipqs,
              quality: summary.quality,
            },
          ],
          (key) => campaignLabelById.get(key) || key,
        );

        if (singleCampaignRow) {
          return [singleCampaignRow];
        }
      }

      return toRows(
        scopedCampaignEntries,
        (key) => campaignLabelById.get(key) || key,
      );
    }

    if (appliedFilters.campaign_id) {
      const sourceEntries = byCampaignAffiliates?.sources?.length
        ? byCampaignAffiliates.sources
        : breakdown?.sources || [];
      return toRows(sourceEntries, resolveSourceLabel);
    }

    return toRows(breakdown?.sources || [], resolveSourceLabel);
  }, [
    appliedFilters.affiliate_id,
    appliedFilters.campaign_key,
    appliedFilters.campaign_id,
    inSourceScope,
    byAffiliateCampaigns,
    byCampaignAffiliates,
    breakdown,
    campaigns,
    campaignLabelById,
    resolveSourceLabel,
    sourceScopedCampaignIds,
    summary,
    sourceScopeKeys,
    totals,
  ]);

  const scopedAffiliateLabel = appliedFilters.affiliate_id
    ? affiliateNameById.get(appliedFilters.affiliate_id) ||
      appliedFilters.affiliate_id
    : null;

  const scopedSourceLabelByKey = appliedFilters.campaign_key
    ? sourceLabelByKey.get(appliedFilters.campaign_key) ||
      appliedFilters.campaign_key
    : null;

  const marketingSourcesScopeLabel = appliedFilters.affiliate_id
    ? appliedFilters.campaign_id
      ? `Source scoped: ${scopedAffiliateLabel} · campaign ${selectedCampaign?.name || appliedFilters.campaign_id}`
      : `Campaigns this source participates in: ${scopedAffiliateLabel}`
    : appliedFilters.campaign_key
      ? appliedFilters.campaign_id
        ? `Source scoped: ${scopedSourceLabelByKey} · campaign ${selectedCampaign?.name || appliedFilters.campaign_id}`
        : `Campaigns this source participates in: ${scopedSourceLabelByKey}`
      : appliedFilters.campaign_id
        ? `Source = affiliate · scoped to ${selectedCampaign?.name || appliedFilters.campaign_id}`
        : "All campaigns";

  const handleMarketingRowOpen = (row: MarketingSourceRow) => {
    if (appliedFilters.campaign_id && appliedFilters.affiliate_id) {
      onOpenLeads?.({
        sourceKey: appliedFilters.campaign_key,
        campaignId: appliedFilters.campaign_id,
        affiliateId: appliedFilters.affiliate_id,
      });
      return;
    }

    if (appliedFilters.affiliate_id) {
      onOpenLeads?.({
        sourceKey: appliedFilters.campaign_key,
        campaignId: row.key,
        affiliateId: appliedFilters.affiliate_id,
      });
      return;
    }
    if (appliedFilters.campaign_id) {
      const affiliateId = affiliateNameById.has(row.key)
        ? row.key
        : sourceAffiliateByKey.get(row.key) || row.key;
      setDraftFilters((prev) => ({
        ...prev,
        campaign_key: "",
        affiliate_id: affiliateId,
      }));
      setAppliedFilters((prev) => ({
        ...prev,
        campaign_key: undefined,
        affiliate_id: affiliateId,
      }));
      setQueryParams(
        buildDashboardUrlParams(
          {
            ...appliedFilters,
            campaign_key: undefined,
            affiliate_id: affiliateId,
          },
          activePreset,
        ),
      );
      return;
    }

    const sourceKey = row.key;
    const affiliateId = affiliateNameById.has(sourceKey)
      ? sourceKey
      : sourceAffiliateByKey.get(sourceKey);
    setDraftFilters((prev) => ({
      ...prev,
      campaign_key: affiliateId ? "" : sourceKey,
      affiliate_id: affiliateId || "",
    }));
    setAppliedFilters((prev) => ({
      ...prev,
      campaign_key: affiliateId ? undefined : sourceKey,
      affiliate_id: affiliateId,
    }));
    setQueryParams(
      buildDashboardUrlParams(
        {
          ...appliedFilters,
          campaign_key: affiliateId ? undefined : sourceKey,
          affiliate_id: affiliateId,
        },
        activePreset,
      ),
    );
    return;
  };

  const exitAffiliateScope = () => {
    setDraftFilters((prev) => ({
      ...prev,
      campaign_key: "",
      affiliate_id: "",
    }));
    setAppliedFilters((prev) => ({
      ...prev,
      campaign_key: undefined,
      affiliate_id: undefined,
    }));
    setQueryParams(
      buildDashboardUrlParams(
        {
          ...appliedFilters,
          campaign_key: undefined,
          affiliate_id: undefined,
        },
        activePreset,
      ),
    );
  };

  const activeError = dashboardError;

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
    const nextCampaignId = draftFilters.campaign_id || undefined;
    const nextCampaignKey = draftFilters.campaign_key || undefined;
    setAppliedFilters({
      from_date: draftFilters.from_date,
      to_date: draftFilters.to_date,
      campaign_id: nextCampaignId,
      campaign_key: nextCampaignKey,
      affiliate_id: nextAffiliateId,
    });
    const presetForApply = activePreset;
    setQueryParams(
      buildDashboardUrlParams(
        {
          from_date: draftFilters.from_date,
          to_date: draftFilters.to_date,
          campaign_id: nextCampaignId,
          campaign_key: nextCampaignKey,
          affiliate_id: nextAffiliateId,
        },
        presetForApply,
      ),
    );
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
    const nextApplied = {
      ...appliedFilters,
      from_date: from,
      to_date: to,
    };
    setAppliedFilters(nextApplied);
    setQueryParams(buildDashboardUrlParams(nextApplied, preset));
  };

  const resetOptionalFilters = () => {
    setDraftFilters((prev) => ({
      ...prev,
      campaign_id: campaignFilterLocked ? prev.campaign_id : "",
      campaign_key: "",
      affiliate_id: "",
    }));
    setAppliedFilters((prev) => ({
      from_date: prev.from_date,
      to_date: prev.to_date,
      campaign_id: campaignFilterLocked ? prev.campaign_id : undefined,
      campaign_key: undefined,
    }));
    setQueryParams(
      buildDashboardUrlParams(
        {
          ...appliedFilters,
          campaign_id: campaignFilterLocked
            ? appliedFilters.campaign_id
            : undefined,
          campaign_key: undefined,
          affiliate_id: undefined,
        },
        activePreset,
      ),
    );
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
      {allTimeDashboardError && (
        <div className="panel border-[color-mix(in_srgb,var(--color-danger)_45%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-danger)_8%,var(--color-panel))] p-3 text-sm text-[--color-text-strong]">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 text-[--color-danger]" />
            <span>
              Unable to load campaign cards.{" "}
              {(allTimeDashboardError as Error)?.message || "Please retry."}
            </span>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {!dashboardMode && (
          <motion.div
            key="campaign-card-grid"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <CampaignSummaryCardGrid
              items={visibleCampaignCards}
              selectedId={undefined}
              searchValue={campaignSearch}
              onSearchValueChange={setCampaignSearch}
              onSelect={handleCampaignCardSelect}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {!dashboardMode &&
        allTimeDashboardLoading &&
        campaignCards.length === 0 && (
          <div className="panel h-[220px] animate-pulse" />
        )}

      <AnimatePresence mode="wait" initial={false}>
        {dashboardMode && (
          <motion.div
            key="dashboard-mode"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="space-y-4"
          >
            <div className="panel p-4 sm:p-5">
              <div className="mb-3">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={backToCardsView}
                  iconLeft={<ArrowLeft size={14} />}
                >
                  Back
                </Button>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[--color-text-strong]">
                    Metrics Dashboard
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-[--radius-pill] border border-[--color-border] bg-[--color-bg-muted] px-3 py-1.5 text-xs text-[--color-text-muted]">
                    <CalendarRange size={14} />
                    {appliedFilters.from_date} to {appliedFilters.to_date}
                  </div>
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
                          Campaign{" "}
                          {campaignFilterLocked ? "(locked)" : "(optional)"}
                        </span>
                        <select
                          className={inputClass}
                          value={draftFilters.campaign_id || ""}
                          disabled={campaignFilterLocked}
                          onChange={(event) =>
                            setDraftFilters((prev) => ({
                              ...prev,
                              campaign_id: event.target.value,
                              campaign_key: "",
                            }))
                          }
                        >
                          <option value="">All campaigns</option>
                          {allCampaigns.map((campaign) => (
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
                              campaign_key: "",
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
                  <AlertTriangle
                    size={16}
                    className="mt-0.5 text-[--color-danger]"
                  />
                  <span>
                    Unable to load one or more metrics panels.{" "}
                    {(activeError as Error)?.message || "Please retry."}
                  </span>
                </div>
              </div>
            )}

            {(appliedFilters.affiliate_id || appliedFilters.campaign_key) && (
              <div className="panel flex flex-wrap items-center justify-between gap-2 border-[color-mix(in_srgb,var(--color-primary)_36%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-primary)_8%,var(--color-panel))] p-3">
                <div className="flex flex-col text-sm">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                    Scoped to source
                  </span>
                  <span className="font-semibold text-[--color-text-strong]">
                    {scopedAffiliateLabel || scopedSourceLabelByKey}
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

            <AnimatePresence mode="wait" initial={false}>
              {showDashboardPanelsLoading ? (
                <motion.div
                  key="dashboard-panels-loading"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="space-y-3"
                  aria-live="polite"
                  aria-busy="true"
                >
                  <div className="panel h-[260px] animate-pulse bg-[--color-bg-muted]" />
                  <div className="panel h-[280px] animate-pulse bg-[--color-bg-muted]" />
                  <div className="panel h-[120px] animate-pulse bg-[--color-bg-muted]" />
                  <div className="panel h-[220px] animate-pulse bg-[--color-bg-muted]" />
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <div className="panel h-[260px] animate-pulse bg-[--color-bg-muted]" />
                    <div className="panel h-[260px] animate-pulse bg-[--color-bg-muted]" />
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key={`dashboard-panels-${dashboardTransitionKey}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.24, ease: "easeOut" }}
                  className="space-y-3"
                >
                  <AllInquiriesChart
                    lineData={lineData}
                    loading={dashboardLoading && lineData.length === 0}
                    scopeLabel={
                      selectedCampaign
                        ? `Campaign: ${selectedCampaign.name}`
                        : "All campaigns"
                    }
                  />

                  <MetricsBySourceChart
                    series={bySource?.series || []}
                    loading={
                      dashboardLoading && (bySource?.series || []).length === 0
                    }
                    resolveName={(id) => affiliateNameById.get(id) || id}
                  />

                  <SectionTitle>Volume</SectionTitle>
                  <OverallTotalsChips
                    totals={totals}
                    quality={summary?.quality}
                    loading={dashboardLoading && !summary}
                  />

                  <SectionTitle>Conversion</SectionTitle>
                  <OverallMetricsTiles
                    totals={totals}
                    quality={summary?.quality}
                    loading={dashboardLoading && !summary}
                  />

                  <MetricsMarketingSourcesTable
                    rows={marketingSourceRows}
                    loading={
                      dashboardLoading && marketingSourceRows.length === 0
                    }
                    overallTotals={totals}
                    overallQuality={summary?.quality}
                    scopeLabel={marketingSourcesScopeLabel}
                    headingLabel={
                      showsCampaignParticipationRows
                        ? "Campaigns"
                        : "Marketing Sources"
                    }
                    firstColumnLabel={
                      showsCampaignParticipationRows ? "Campaign" : "Source"
                    }
                    onRowOpen={handleMarketingRowOpen}
                  />

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <MetricsStatusDonut
                        totals={totals}
                        quality={summary?.quality}
                        loading={dashboardLoading && !summary}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <MetricsTimeBreakdown
                        points={timeseries?.points || []}
                        hourlyPoints={hourly?.points || []}
                        loading={dashboardLoading && lineData.length === 0}
                        hourlyLoading={
                          dashboardLoading &&
                          (hourly?.points || []).length === 0
                        }
                      />
                    </div>
                  </div>

                  {selectedCampaign && (
                    <CampaignDashboardWidgets
                      campaign={selectedCampaign}
                      affiliates={affiliates}
                      filters={{
                        from_date: dashboardRequestFilters.from_date,
                        to_date: dashboardRequestFilters.to_date,
                      }}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
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
