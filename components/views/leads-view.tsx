"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  ArrowDownAZ,
  ArrowUpAZ,
  Check,
  ChevronDown,
  Filter,
  MinusCircle,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Table } from "@/components/table";
import { PaginationControls } from "@/components/pagination-controls";
import { Badge } from "@/components/badge";
import { inputClass } from "@/lib/utils";
import type { Affiliate, Campaign, Lead } from "@/lib/types";
import type { CampaignDetailTab } from "@/lib/types";
import type React from "react";

// ─── Helpers (local) ──────────────────────────────────────────────────────────

function formatCompactDateTimeFallback(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).formatToParts(date);
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  const month = byType.get("month") || "--";
  const day = byType.get("day") || "--";
  const year = byType.get("year") || "----";
  const hour = byType.get("hour") || "--";
  const minute = byType.get("minute") || "--";
  const dayPeriod = byType.get("dayPeriod") || "";
  const abbr = byType.get("timeZoneName") || "";
  return `${month}/${day}/${year} ${hour}:${minute}${dayPeriod ? ` ${dayPeriod}` : ""} ${abbr}`.trim();
}

function getLeadIpTz(lead: Lead): string | null {
  try {
    const ipqs = lead.payload?.ipqs_response as
      | Record<string, unknown>
      | undefined;
    const tz = ipqs?.timezone;
    if (typeof tz === "string" && tz.length > 0) {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return tz;
    }
  } catch {
    // invalid tz
  }
  return null;
}

function formatInTz(
  value: string,
  timeZone: string,
): { time: string; abbr: string } {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone,
    timeZoneName: "short",
  }).formatToParts(date);
  const byType = new Map(parts.map((p) => [p.type, p.value]));
  const month = byType.get("month") || "--";
  const day = byType.get("day") || "--";
  const year = byType.get("year") || "----";
  const hour = byType.get("hour") || "--";
  const minute = byType.get("minute") || "--";
  const dayPeriod = byType.get("dayPeriod") || "";
  const abbr = byType.get("timeZoneName") || timeZone;
  return {
    time: `${month}/${day}/${year} ${hour}:${minute}${dayPeriod ? ` ${dayPeriod}` : ""}`,
    abbr,
  };
}

// ─── LeadsView ────────────────────────────────────────────────────────────────

interface LeadsViewProps {
  leads: Lead[];
  campaigns: Campaign[];
  affiliates: Affiliate[];
  isLoading: boolean;
  /** Open campaign detail modal */
  onOpenCampaign: (
    campaignId: string,
    section?: CampaignDetailTab,
    affiliateId?: string,
  ) => void;
  /** PayloadPreview component injected — since it depends on router hooks */
  renderPayloadPreview: (lead: Lead, allLeads: Lead[]) => React.ReactNode;
  initialFilters?: Partial<LeadViewFilters>;
  onFiltersChange?: (filters: LeadViewFilters) => void;
}

export type LeadSortKey =
  | "created_at"
  | "campaign"
  | "affiliate"
  | "mode"
  | "status"
  | "duplicate"
  | "trusted_form"
  | "ipqs"
  | "id";

export interface LeadViewFilters {
  search: string;
  campaignId: string;
  affiliateId: string;
  mode: "all" | "test" | "live";
  status: "all" | "accepted" | "rejected";
  sortBy: LeadSortKey;
  sortDir: "asc" | "desc";
  sorts?: Array<{ key: LeadSortKey; dir: "asc" | "desc" }>;
}

const DEFAULT_FILTERS: LeadViewFilters = {
  search: "",
  campaignId: "all",
  affiliateId: "all",
  mode: "all",
  status: "all",
  sortBy: "created_at",
  sortDir: "desc",
};

export function LeadsView({
  leads,
  campaigns,
  affiliates,
  isLoading,
  onOpenCampaign,
  renderPayloadPreview,
  initialFilters,
  onFiltersChange,
}: LeadsViewProps) {
  const mergedInitial = useMemo(
    () => ({ ...DEFAULT_FILTERS, ...(initialFilters ?? {}) }),
    [initialFilters],
  );

  const [search, setSearch] = useState(mergedInitial.search);
  const [campaignFilter, setCampaignFilter] = useState(
    mergedInitial.campaignId,
  );
  const [affiliateFilter, setAffiliateFilter] = useState(
    mergedInitial.affiliateId,
  );
  const [modeFilter, setModeFilter] = useState<LeadViewFilters["mode"]>(
    mergedInitial.mode,
  );
  const [statusFilter, setStatusFilter] = useState<LeadViewFilters["status"]>(
    mergedInitial.status,
  );
  const [sortRules, setSortRules] = useState<
    Array<{ key: LeadSortKey; dir: "asc" | "desc" }>
  >(
    mergedInitial.sorts?.length
      ? mergedInitial.sorts
      : [{ key: mergedInitial.sortBy, dir: mergedInitial.sortDir }],
  );
  const [controlsOpen, setControlsOpen] = useState(false);
  const [controlsTab, setControlsTab] = useState<"filters" | "sorting">(
    "filters",
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    setSearch(mergedInitial.search);
    setCampaignFilter(mergedInitial.campaignId);
    setAffiliateFilter(mergedInitial.affiliateId);
    setModeFilter(mergedInitial.mode);
    setStatusFilter(mergedInitial.status);
    setSortRules(
      mergedInitial.sorts?.length
        ? mergedInitial.sorts
        : [{ key: mergedInitial.sortBy, dir: mergedInitial.sortDir }],
    );
  }, [mergedInitial]);

  useEffect(() => {
    onFiltersChange?.({
      search,
      campaignId: campaignFilter,
      affiliateId: affiliateFilter,
      mode: modeFilter,
      status: statusFilter,
      sortBy: sortRules[0]?.key ?? "created_at",
      sortDir: sortRules[0]?.dir ?? "desc",
      sorts: sortRules,
    });
  }, [
    search,
    campaignFilter,
    affiliateFilter,
    modeFilter,
    statusFilter,
    sortRules,
    onFiltersChange,
  ]);

  const campaignIdMap = useMemo(() => {
    const map = new Map<string, Campaign>();
    campaigns.forEach((c) => map.set(c.id, c));
    return map;
  }, [campaigns]);

  const campaignKeyMap = useMemo(() => {
    const map = new Map<string, { campaign: Campaign; affiliateId?: string }>();
    campaigns.forEach((c) => {
      (c.affiliates || []).forEach((a) => {
        if (a.campaign_key) {
          map.set(a.campaign_key, { campaign: c, affiliateId: a.affiliate_id });
        }
      });
    });
    return map;
  }, [campaigns]);

  const affiliateIdMap = useMemo(() => {
    const map = new Map<string, Affiliate>();
    affiliates.forEach((a) => map.set(a.id, a));
    return map;
  }, [affiliates]);

  const enrichedLeads = useMemo(() => {
    return leads.map((lead) => {
      const mapping = campaignKeyMap.get(lead.campaign_key || "");
      const campaign = campaignIdMap.get(lead.campaign_id);
      const affiliateName = mapping?.affiliateId
        ? affiliateIdMap.get(mapping.affiliateId)?.name || null
        : null;
      return {
        lead,
        campaignName: campaign?.name || lead.campaign_id,
        affiliateName: affiliateName || lead.campaign_key || "",
        affiliateId: mapping?.affiliateId || "",
      };
    });
  }, [leads, campaignKeyMap, campaignIdMap, affiliateIdMap]);

  const filteredAndSortedLeads = useMemo(() => {
    let items = enrichedLeads;

    if (campaignFilter !== "all") {
      items = items.filter(({ lead }) => lead.campaign_id === campaignFilter);
    }

    if (affiliateFilter !== "all") {
      items = items.filter(
        ({ affiliateId }) => affiliateId === affiliateFilter,
      );
    }

    if (modeFilter !== "all") {
      items = items.filter(({ lead }) =>
        modeFilter === "test" ? lead.test : !lead.test,
      );
    }

    if (statusFilter !== "all") {
      items = items.filter(({ lead }) =>
        statusFilter === "rejected" ? !!lead.rejected : !lead.rejected,
      );
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(({ lead, campaignName, affiliateName }) => {
        return (
          lead.id.toLowerCase().includes(q) ||
          campaignName.toLowerCase().includes(q) ||
          affiliateName.toLowerCase().includes(q) ||
          String(lead.payload?.email || "")
            .toLowerCase()
            .includes(q) ||
          String(lead.payload?.phone || "")
            .toLowerCase()
            .includes(q)
        );
      });
    }

    const getSortValue = (
      item: (typeof items)[number],
      key: LeadSortKey,
    ): string | number => {
      const { lead, campaignName, affiliateName } = item;
      switch (key) {
        case "id":
          return lead.id.toLowerCase();
        case "campaign":
          return campaignName.toLowerCase();
        case "affiliate":
          return affiliateName.toLowerCase();
        case "mode":
          return lead.test ? "test" : "live";
        case "status":
          return lead.rejected ? "rejected" : "accepted";
        case "duplicate":
          return lead.duplicate ? 1 : 0;
        case "trusted_form":
          return lead.trusted_form_result == null
            ? -1
            : lead.trusted_form_result.success
              ? 1
              : 0;
        case "ipqs":
          return lead.ipqs_result == null
            ? -1
            : lead.ipqs_result.success
              ? 1
              : 0;
        case "created_at":
        default:
          return lead.created_at ? new Date(lead.created_at).getTime() : 0;
      }
    };

    const sorted = [...items].sort((a, b) => {
      for (const rule of sortRules) {
        const av = getSortValue(a, rule.key);
        const bv = getSortValue(b, rule.key);
        if (typeof av === "number" && typeof bv === "number") {
          if (av === bv) continue;
          return rule.dir === "asc" ? av - bv : bv - av;
        }
        const cmp = String(av).localeCompare(String(bv));
        if (cmp === 0) continue;
        return rule.dir === "asc" ? cmp : -cmp;
      }
      return 0;
    });

    return sorted.map((item) => item.lead);
  }, [
    enrichedLeads,
    campaignFilter,
    affiliateFilter,
    modeFilter,
    statusFilter,
    search,
    sortRules,
  ]);

  const affiliateFilterOptions = useMemo(() => {
    const byCampaign = new Map<string, { id: string; name: string }[]>();
    campaigns.forEach((c) => {
      const options = (c.affiliates || [])
        .map((a) => {
          const aff = affiliateIdMap.get(a.affiliate_id);
          if (!aff) return null;
          return { id: a.affiliate_id, name: aff.name };
        })
        .filter((v): v is { id: string; name: string } => !!v);
      byCampaign.set(c.id, options);
    });

    if (campaignFilter !== "all") return byCampaign.get(campaignFilter) || [];

    const seen = new Map<string, string>();
    byCampaign.forEach((opts) =>
      opts.forEach((o) => {
        if (!seen.has(o.id)) seen.set(o.id, o.name);
      }),
    );
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [campaigns, affiliateIdMap, campaignFilter]);

  useEffect(() => {
    if (
      affiliateFilter !== "all" &&
      !affiliateFilterOptions.some((a) => a.id === affiliateFilter)
    ) {
      setAffiliateFilter("all");
    }
  }, [affiliateFilter, affiliateFilterOptions]);

  const clearFilters = () => {
    setCampaignFilter("all");
    setAffiliateFilter("all");
    setModeFilter("all");
    setStatusFilter("all");
  };

  const clearSorting = () => {
    setSortRules([
      { key: DEFAULT_FILTERS.sortBy, dir: DEFAULT_FILTERS.sortDir },
    ]);
  };

  const clearAllControls = () => {
    setSearch(DEFAULT_FILTERS.search);
    clearFilters();
    clearSorting();
  };

  const totalFilteredLeads = filteredAndSortedLeads.length;
  const totalLeadPages = Math.max(1, Math.ceil(totalFilteredLeads / pageSize));

  const activeFilterCount =
    (search.trim() ? 1 : 0) +
    (campaignFilter !== "all" ? 1 : 0) +
    (affiliateFilter !== "all" ? 1 : 0) +
    (modeFilter !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0);

  const activeSortCount =
    sortRules.length === 1 &&
    sortRules[0]?.key === DEFAULT_FILTERS.sortBy &&
    sortRules[0]?.dir === DEFAULT_FILTERS.sortDir
      ? 0
      : sortRules.length;

  useEffect(() => {
    setPage(1);
  }, [
    search,
    campaignFilter,
    affiliateFilter,
    modeFilter,
    statusFilter,
    sortRules,
    pageSize,
  ]);

  useEffect(() => {
    if (page > totalLeadPages) {
      setPage(totalLeadPages);
    }
  }, [page, totalLeadPages]);

  const paginatedLeads = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filteredAndSortedLeads.slice(start, end);
  }, [filteredAndSortedLeads, page, pageSize]);

  const showingFrom = totalFilteredLeads === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, totalFilteredLeads);

  return (
    <motion.section
      key="leads"
      className="space-y-4"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <div className="rounded-xl border border-[--color-border] bg-[--color-panel] p-3">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[--color-text-muted]"
            />
            <input
              className={`${inputClass} pl-9`}
              placeholder="Search ID, campaign, affiliate, email, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setControlsOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-lg border border-[--color-border] bg-[--color-bg-muted] px-3 py-1.5 text-sm font-medium text-[--color-text] transition hover:bg-[--color-bg]"
            >
              <SlidersHorizontal size={14} />
              Filter and sort
              <ChevronDown
                size={14}
                className={`transition-transform ${controlsOpen ? "rotate-180" : ""}`}
              />
            </button>

            <div className="rounded-xl border border-[--color-border] bg-[--color-panel] p-1">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[--color-border] px-2.5 py-1.5 text-xs font-medium text-[--color-text-muted] transition hover:text-[--color-text] hover:bg-[--color-bg-muted]"
                >
                  <Filter size={12} />
                  Filters
                  <span className="rounded-full bg-[--color-bg-muted] px-1.5 py-0.5 text-[10px] font-semibold">
                    {activeFilterCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={clearSorting}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[--color-border] px-2.5 py-1.5 text-xs font-medium text-[--color-text-muted] transition hover:text-[--color-text] hover:bg-[--color-bg-muted]"
                >
                  <ArrowUpDown size={12} />
                  Sorting
                  <span className="rounded-full bg-[--color-bg-muted] px-1.5 py-0.5 text-[10px] font-semibold">
                    {activeSortCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={clearAllControls}
                  className="inline-flex items-center gap-1 rounded-lg border border-[--color-border] px-2.5 py-1.5 text-xs font-medium text-[--color-text-muted] transition hover:text-[--color-text] hover:bg-[--color-bg-muted]"
                >
                  <RotateCcw size={12} />
                  All
                  <span className="rounded-full bg-[--color-bg-muted] px-1.5 py-0.5 text-[10px] font-semibold">
                    {activeFilterCount + activeSortCount}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {controlsOpen && (
              <motion.div
                key="controls-panel"
                initial={{ opacity: 0, height: 0, y: -6 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: -6 }}
                transition={{ duration: 0.24, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="rounded-lg border border-[--color-border] bg-[--color-bg-muted]/40 p-3">
                  <div className="mb-3 flex items-center gap-1.5">
                    {(
                      [
                        {
                          key: "filters" as const,
                          label: "Filters",
                          icon: <Filter size={13} />,
                        },
                        {
                          key: "sorting" as const,
                          label: "Sorting",
                          icon: <ArrowDownAZ size={13} />,
                        },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setControlsTab(tab.key)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                          controlsTab === tab.key
                            ? "bg-[--color-primary] text-white"
                            : "border border-[--color-border] bg-[--color-panel] text-[--color-text-muted] hover:text-[--color-text]"
                        }`}
                      >
                        {tab.icon}
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <AnimatePresence mode="wait" initial={false}>
                    {controlsTab === "filters" ? (
                      <motion.div
                        key="filters-tab"
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="grid gap-3 md:grid-cols-2 min-h-[175px]"
                      >
                        <select
                          className={inputClass}
                          value={campaignFilter}
                          onChange={(e) => setCampaignFilter(e.target.value)}
                        >
                          <option value="all">All campaigns</option>
                          {campaigns.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <select
                          className={inputClass}
                          value={affiliateFilter}
                          onChange={(e) => setAffiliateFilter(e.target.value)}
                        >
                          <option value="all">All affiliates</option>
                          {affiliateFilterOptions.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>

                        <div className="space-y-1.5 md:col-span-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-[--color-text-muted]">
                            Mode
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {(
                              [
                                { value: "all", label: "All" },
                                { value: "test", label: "Test" },
                                { value: "live", label: "Live" },
                              ] as const
                            ).map((option) => {
                              const isActive = modeFilter === option.value;
                              const colorClass =
                                option.value === "test"
                                  ? "border-sky-300/70 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                                  : option.value === "live"
                                    ? "border-emerald-300/70 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                    : "border-[--color-border] bg-[--color-panel] text-[--color-text-muted]";

                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() => setModeFilter(option.value)}
                                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                                    isActive
                                      ? "ring-2 ring-[--color-primary]/20 " +
                                        colorClass
                                      : "text-[--color-text-muted] hover:text-[--color-text] border-[--color-border] bg-[--color-panel]"
                                  }`}
                                >
                                  {option.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-1.5 md:col-span-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-[--color-text-muted]">
                            Status
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {(
                              [
                                { value: "all", label: "All" },
                                { value: "accepted", label: "Accepted" },
                                { value: "rejected", label: "Rejected" },
                              ] as const
                            ).map((option) => {
                              const isActive = statusFilter === option.value;
                              const colorClass =
                                option.value === "accepted"
                                  ? "border-emerald-300/70 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                  : option.value === "rejected"
                                    ? "border-rose-300/70 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                                    : "border-[--color-border] bg-[--color-panel] text-[--color-text-muted]";

                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() => setStatusFilter(option.value)}
                                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                                    isActive
                                      ? "ring-2 ring-[--color-primary]/20 " +
                                        colorClass
                                      : "text-[--color-text-muted] hover:text-[--color-text] border-[--color-border] bg-[--color-panel]"
                                  }`}
                                >
                                  {option.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="sorting-tab"
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center min-h-[175px]"
                      >
                        <div className="space-y-2 md:col-span-2">
                          {sortRules.map((rule, idx) => (
                            <div
                              key={`sort-rule-${idx}`}
                              className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center"
                            >
                              <select
                                className={inputClass}
                                value={rule.key}
                                onChange={(e) => {
                                  const key = e.target.value as LeadSortKey;
                                  setSortRules((prev) =>
                                    prev.map((r, i) =>
                                      i === idx ? { ...r, key } : r,
                                    ),
                                  );
                                }}
                              >
                                <option value="created_at">
                                  Sort by: Created
                                </option>
                                <option value="campaign">
                                  Sort by: Campaign
                                </option>
                                <option value="affiliate">
                                  Sort by: Affiliate
                                </option>
                                <option value="mode">Sort by: Mode</option>
                                <option value="status">Sort by: Status</option>
                                <option value="duplicate">
                                  Sort by: Duplicate
                                </option>
                                <option value="trusted_form">
                                  Sort by: TrustedForm
                                </option>
                                <option value="ipqs">Sort by: IPQS</option>
                                <option value="id">Sort by: ID</option>
                              </select>
                              <button
                                type="button"
                                title={
                                  rule.dir === "asc"
                                    ? "Switch to descending"
                                    : "Switch to ascending"
                                }
                                className="p-1.5 text-[--color-text-muted] transition hover:text-[--color-text]"
                                onClick={() => {
                                  setSortRules((prev) =>
                                    prev.map((r, i) =>
                                      i === idx
                                        ? {
                                            ...r,
                                            dir:
                                              r.dir === "asc" ? "desc" : "asc",
                                          }
                                        : r,
                                    ),
                                  );
                                }}
                              >
                                {rule.dir === "asc" ? (
                                  <ArrowUpAZ size={15} />
                                ) : (
                                  <ArrowDownAZ size={15} />
                                )}
                              </button>
                              <button
                                type="button"
                                disabled={sortRules.length === 1}
                                onClick={() => {
                                  if (sortRules.length === 1) return;
                                  setSortRules((prev) =>
                                    prev.filter((_, i) => i !== idx),
                                  );
                                }}
                                title="Remove sort rule"
                                className="p-1.5 text-[--color-text-muted] transition enabled:hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                <X size={15} />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() =>
                              setSortRules((prev) => [
                                ...prev,
                                { key: "campaign", dir: "asc" },
                              ])
                            }
                            title="Add sort rule"
                            className="p-1.5 text-[--color-text-muted] transition hover:text-emerald-500"
                          >
                            <Plus size={15} />
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <Table
        rowAnimation="subtle"
        columns={[
          {
            key: "id",
            label: "ID",
            width: "120px",
            render: (lead) => <span className="font-medium">{lead.id}</span>,
          },
          {
            key: "campaign_id",
            label: "Campaign",
            width: "180px",
            render: (lead) => (
              <button
                type="button"
                className="text-[--color-primary] underline underline-offset-2"
                onClick={() => onOpenCampaign(lead.campaign_id)}
              >
                {campaignIdMap.get(lead.campaign_id)?.name || lead.campaign_id}
              </button>
            ),
          },
          {
            key: "campaign_key",
            label: "Affiliate",
            width: "180px",
            render: (lead) => {
              const mapping = campaignKeyMap.get(lead.campaign_key || "");
              if (!mapping) return lead.campaign_key || "";
              const affiliateName = mapping.affiliateId
                ? affiliateIdMap.get(mapping.affiliateId)?.name
                : null;
              return (
                <button
                  type="button"
                  className="text-[--color-primary] underline underline-offset-2"
                  onClick={() =>
                    onOpenCampaign(
                      mapping.campaign.id,
                      "affiliates",
                      mapping.affiliateId,
                    )
                  }
                >
                  {affiliateName || lead.campaign_key || ""}
                </button>
              );
            },
          },
          {
            key: "test",
            label: "Mode",
            width: "96px",
            render: (lead) => (
              <Badge tone={lead.test ? "warning" : "neutral"}>
                {lead.test ? "Test" : "Live"}
              </Badge>
            ),
          },
          {
            key: "qa_duplicate",
            label: "Duplicate",
            width: "96px",
            render: (lead) => (
              <div className="mx-auto flex w-fit items-center justify-center">
                {lead.duplicate ? (
                  <X size={18} className="text-[--color-danger]" />
                ) : (
                  <Check size={18} className="text-[--color-success]" />
                )}
              </div>
            ),
          },
          {
            key: "qa_trusted_form",
            label: "TrustedForm",
            width: "126px",
            render: (lead) => {
              const tf = lead.trusted_form_result;
              if (tf == null) {
                const campaign = campaignIdMap.get(lead.campaign_id);
                const disabled =
                  campaign?.plugins?.trusted_form?.enabled === false;
                return (
                  <div className="mx-auto flex w-fit items-center justify-center">
                    {disabled ? (
                      <span className="flex items-center gap-1 text-xs text-[--color-text-muted]">
                        <MinusCircle size={13} />
                        Disabled
                      </span>
                    ) : (
                      <span className="text-[--color-text-muted]">—</span>
                    )}
                  </div>
                );
              }

              if (tf.success && tf.cert_id) {
                return (
                  <a
                    href={`https://cert.trustedform.com/${tf.cert_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mx-auto block w-fit text-xs font-medium text-[--color-primary] underline underline-offset-2"
                  >
                    View cert
                  </a>
                );
              }

              return (
                <div className="mx-auto flex w-fit items-center justify-center">
                  {tf.success ? (
                    <Check size={18} className="text-[--color-success]" />
                  ) : (
                    <X size={18} className="text-[--color-danger]" />
                  )}
                </div>
              );
            },
          },
          {
            key: "qa_ipqs",
            label: "IPQS",
            width: "96px",
            render: (lead) => {
              const iq = lead.ipqs_result;
              if (iq == null) {
                const campaign = campaignIdMap.get(lead.campaign_id);
                const disabled = campaign?.plugins?.ipqs?.enabled === false;
                return (
                  <div className="mx-auto flex w-fit items-center justify-center">
                    {disabled ? (
                      <span className="flex items-center gap-1 text-xs text-[--color-text-muted]">
                        <MinusCircle size={13} />
                        Disabled
                      </span>
                    ) : (
                      <span className="text-[--color-text-muted]">—</span>
                    )}
                  </div>
                );
              }
              return (
                <div className="mx-auto flex w-fit items-center justify-center">
                  {iq.success ? (
                    <Check size={18} className="text-[--color-success]" />
                  ) : (
                    <X size={18} className="text-[--color-danger]" />
                  )}
                </div>
              );
            },
          },
          {
            key: "created_at",
            label: "Created",
            width: "190px",
            render: (lead) => {
              const ipTz = lead.created_at ? getLeadIpTz(lead) : null;
              if (lead.created_at && ipTz) {
                const { time, abbr } = formatInTz(lead.created_at, ipTz);
                return (
                  <div>
                    <span>{time}</span>
                    <span className="ml-1.5 text-xs text-[--color-text-muted]">
                      {abbr}
                    </span>
                  </div>
                );
              }
              return (
                <span>{formatCompactDateTimeFallback(lead.created_at)}</span>
              );
            },
          },
          {
            key: "intake_status",
            label: "Status",
            width: "112px",
            render: (lead) => (
              <Badge tone={lead.rejected ? "danger" : "success"}>
                {lead.rejected ? "Rejected" : "Accepted"}
              </Badge>
            ),
          },
          {
            key: "sold_status",
            label: "Client Delivery",
            width: "120px",
            render: (lead) => {
              if (lead.test)
                return (
                  <span className="flex items-center gap-1 text-xs text-[--color-text-muted]">
                    <MinusCircle size={13} />
                    Disabled
                  </span>
                );
              const s = lead.sold_status;
              if (!s || s === "not_delivered")
                return <Badge tone="neutral">Not Delivered</Badge>;
              return (
                <Badge tone={s === "sold" ? "info" : "warning"}>
                  {s === "sold" ? "Sold" : "Not Sold"}
                </Badge>
              );
            },
          },
          {
            key: "payload",
            label: "Details",
            render: (lead) =>
              renderPayloadPreview(lead, filteredAndSortedLeads),
          },
        ]}
        data={paginatedLeads}
        emptyLabel={isLoading ? "Loading leads…" : "No leads available."}
      />

      <PaginationControls
        page={page}
        totalPages={totalLeadPages}
        onPageChange={setPage}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        totalItems={totalFilteredLeads}
        showingFrom={showingFrom}
        showingTo={showingTo}
        itemLabel="leads"
      />
    </motion.section>
  );
}
