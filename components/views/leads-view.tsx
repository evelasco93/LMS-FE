"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpDown,
  ArrowDownAZ,
  ArrowUpAZ,
  Check,
  Cherry,
  ChevronDown,
  Columns2,
  ExternalLink,
  FileDown,
  Filter,
  MinusCircle,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/button";
import { Table } from "@/components/table";
import type { Column } from "@/components/table";
import { PaginationControls } from "@/components/pagination-controls";
import { Badge } from "@/components/badge";
import { Modal } from "@/components/modal";
import {
  formatRejectionDisplayText,
  inputClass,
  normalizeFieldLabel,
} from "@/lib/utils";
import {
  deleteUserTablePreference,
  getUserTablePreference,
  setUserTablePreference,
} from "@/lib/api";
import type { Affiliate, Campaign, Lead, TableColumnConfig } from "@/lib/types";
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

const LEADS_TABLE_ID = "leads";

const STATIC_COLUMN_KEYS = [
  "id",
  "campaign_id",
  "campaign_key",
  "test",
  "qa_duplicate",
  "qa_trusted_form",
  "qa_ipqs",
  "created_at",
  "intake_status",
  "sold_status",
  "payload",
] as const;

type StaticColumnKey = (typeof STATIC_COLUMN_KEYS)[number];

const DEFAULT_VISIBLE_COLUMN_KEYS: ReadonlySet<string> = new Set(
  STATIC_COLUMN_KEYS as unknown as string[],
);

type PhoneDisplayMode = "raw" | "formatted" | "callable";

type ColumnUiPrefs = {
  phoneDisplayMode: PhoneDisplayMode;
  ipqsLinkPhone: boolean;
  ipqsLinkEmail: boolean;
  ipqsLinkIp: boolean;
  trustedFormMode: "link" | "id";
};

const DEFAULT_COLUMN_UI_PREFS: ColumnUiPrefs = {
  phoneDisplayMode: "formatted",
  ipqsLinkPhone: true,
  ipqsLinkEmail: true,
  ipqsLinkIp: true,
  trustedFormMode: "link",
};

function normalizePhoneDigits(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

function formatPhoneNumber(value: string): string {
  const digits = normalizePhoneDigits(value);
  if (digits.length !== 10) return value;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function inferPayloadFieldKind(
  fieldKey: string,
): "phone" | "email" | "ip" | null {
  const key = fieldKey.toLowerCase();
  if (key.includes("phone")) return "phone";
  if (key.includes("email")) return "email";
  if (
    key === "ip" ||
    key === "ip_address" ||
    key.endsWith("_ip") ||
    key.includes("ipaddress")
  ) {
    return "ip";
  }
  return null;
}

function parseColumnUiPrefs(
  filters:
    | Array<{ field: string; value: unknown; operator?: string }>
    | undefined,
): ColumnUiPrefs {
  if (!filters?.length) return DEFAULT_COLUMN_UI_PREFS;

  const next: ColumnUiPrefs = { ...DEFAULT_COLUMN_UI_PREFS };
  for (const item of filters) {
    switch (item.field) {
      case "ui.phone_display_mode":
        if (
          item.value === "raw" ||
          item.value === "formatted" ||
          item.value === "callable"
        ) {
          next.phoneDisplayMode = item.value;
        }
        break;
      case "ui.ipqs_link_phone":
        next.ipqsLinkPhone = item.value === true;
        break;
      case "ui.ipqs_link_email":
        next.ipqsLinkEmail = item.value === true;
        break;
      case "ui.ipqs_link_ip":
        next.ipqsLinkIp = item.value === true;
        break;
      case "ui.trusted_form_mode":
        if (item.value === "link" || item.value === "id") {
          next.trustedFormMode = item.value;
        }
        break;
      default:
        break;
    }
  }
  return next;
}

function buildColumnUiPrefFilters(prefs: ColumnUiPrefs) {
  return [
    { field: "ui.phone_display_mode", value: prefs.phoneDisplayMode },
    { field: "ui.ipqs_link_phone", value: prefs.ipqsLinkPhone },
    { field: "ui.ipqs_link_email", value: prefs.ipqsLinkEmail },
    { field: "ui.ipqs_link_ip", value: prefs.ipqsLinkIp },
    { field: "ui.trusted_form_mode", value: prefs.trustedFormMode },
  ];
}

interface LeadsViewProps {
  leads: Lead[];
  campaigns: Campaign[];
  affiliates: Affiliate[];
  isLoading: boolean;
  onOpenCampaign: (
    campaignId: string,
    section?: CampaignDetailTab,
    affiliateId?: string,
  ) => void;
  renderPayloadPreview: (lead: Lead, allLeads: Lead[]) => React.ReactNode;
  onCherryPick?: (lead: Lead) => void;
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

function CherryPickButton({
  lead,
  onClick,
}: {
  lead: Lead;
  onClick: () => void;
}) {
  const isPicked = lead.cherry_picked === true;
  const isExcluded = !isPicked && lead.cherry_pickable === false;
  const isEligible = !isPicked && lead.cherry_pickable !== false;

  const color = isPicked
    ? "text-emerald-500/50 hover:text-emerald-500/70"
    : isExcluded
      ? "text-rose-400 hover:text-rose-500"
      : isEligible
        ? "text-emerald-500 hover:text-emerald-600"
        : "text-[--color-text-muted] hover:text-[--color-text]";

  const title = isPicked
    ? "Already cherry-picked — click to view record"
    : isExcluded
      ? "Not cherry-pickable — click to manage"
      : "Cherry-pick this lead";

  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`inline-flex items-center justify-center rounded p-1 transition-colors ${color}`}
    >
      {isExcluded ? (
        <span className="relative inline-flex items-center justify-center">
          <Cherry size={16} />
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="block h-[2px] w-[20px] rotate-45 rounded-full bg-rose-500" />
          </span>
        </span>
      ) : isPicked ? (
        <span className="relative inline-flex items-center justify-center">
          <Cherry size={16} />
          <span className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-[--color-bg] p-px">
            <Check size={8} strokeWidth={3} className="text-emerald-600" />
          </span>
        </span>
      ) : (
        <Cherry size={16} />
      )}
    </button>
  );
}

export function LeadsView({
  leads,
  campaigns,
  affiliates,
  isLoading,
  onOpenCampaign,
  renderPayloadPreview,
  onCherryPick,
  initialFilters,
  onFiltersChange,
}: LeadsViewProps) {
  const mergedInitial = useMemo(
    () => ({ ...DEFAULT_FILTERS, ...(initialFilters ?? {}) }),
    [initialFilters],
  );

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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
  const [columnsModalOpen, setColumnsModalOpen] = useState(false);
  const [csvExportOpen, setCsvExportOpen] = useState(false);
  const [csvExportKeys, setCsvExportKeys] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [visibleColumnKeys, setVisibleColumnKeys] = useState<Set<string>>(
    () => new Set(DEFAULT_VISIBLE_COLUMN_KEYS),
  );
  const [columnOrder, setColumnOrder] = useState<string[]>(() => [
    ...(STATIC_COLUMN_KEYS as unknown as string[]),
  ]);
  const [columnUiPrefs, setColumnUiPrefs] = useState<ColumnUiPrefs>(
    DEFAULT_COLUMN_UI_PREFS,
  );
  const [prefsLoaded, setPrefsLoaded] = useState(false);

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

  const soldClientNameById = useMemo(() => {
    const map = new Map<string, string>();
    campaigns.forEach((campaign) => {
      (campaign.clients || []).forEach((client) => {
        const raw = client as unknown as {
          client_id?: string;
          client_name?: string;
          name?: string;
        };
        const id = raw.client_id || "";
        if (!id) return;
        const name =
          (typeof raw.client_name === "string" && raw.client_name.trim()) ||
          (typeof raw.name === "string" && raw.name.trim()) ||
          id;
        if (!map.has(id)) map.set(id, name);
      });
    });
    return map;
  }, [campaigns]);

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

  const openIpqsTool = useCallback(
    (prefill: { phone?: string; email?: string; ip?: string }) => {
      const params = new URLSearchParams(searchParams?.toString() || "");
      params.set("view", "tools");
      params.set("tool", "ipqs");

      if (prefill.phone) params.set("ipqs_phone", prefill.phone);
      else params.delete("ipqs_phone");

      if (prefill.email) params.set("ipqs_email", prefill.email);
      else params.delete("ipqs_email");

      if (prefill.ip) params.set("ipqs_ip", prefill.ip);
      else params.delete("ipqs_ip");

      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

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

  /** Scalar payload field keys extracted from the first 200 loaded leads. */
  const payloadFieldKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const lead of leads.slice(0, 200)) {
      if (lead.payload && typeof lead.payload === "object") {
        for (const key of Object.keys(lead.payload)) {
          const val = lead.payload[key];
          if (val !== null && typeof val !== "object") {
            keys.add(key);
          }
        }
      }
    }
    return [...keys].sort();
  }, [leads]);

  const showingFrom = totalFilteredLeads === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, totalFilteredLeads);

  const allAvailableColumnKeys = useMemo(
    () => [
      ...(STATIC_COLUMN_KEYS as unknown as string[]),
      ...payloadFieldKeys.map((key) => `payload.${key}`),
    ],
    [payloadFieldKeys],
  );

  useEffect(() => {
    getUserTablePreference(LEADS_TABLE_ID)
      .then((res) => {
        const prefColumns: TableColumnConfig[] =
          res?.data?.config?.columns ?? res?.data?.columns ?? [];
        const prefFilters = res?.data?.config?.filters;
        setColumnUiPrefs(
          parseColumnUiPrefs(
            Array.isArray(prefFilters)
              ? (prefFilters as Array<{
                  field: string;
                  value: unknown;
                  operator?: string;
                }>)
              : undefined,
          ),
        );

        if (!prefColumns.length) return;

        const sorted = [...prefColumns].sort((a, b) => a.order - b.order);
        setColumnOrder(sorted.map((c) => c.key));
        setVisibleColumnKeys(
          new Set(sorted.filter((c) => c.visible !== false).map((c) => c.key)),
        );
      })
      .catch(() => {
        /* use defaults on error or 404 */
      })
      .finally(() => {
        setPrefsLoaded(true);
      });
  }, []);

  useEffect(() => {
    setColumnOrder((prev) => {
      const next = [...prev];
      for (const key of allAvailableColumnKeys) {
        if (!next.includes(key)) next.push(key);
      }
      return next;
    });
  }, [allAvailableColumnKeys]);

  const persistColumnLayout = useCallback(
    (
      nextVisible: Set<string>,
      nextOrder: string[],
      nextPrefs: ColumnUiPrefs,
    ) => {
      const normalizedOrder = [...nextOrder];
      for (const key of allAvailableColumnKeys) {
        if (!normalizedOrder.includes(key)) normalizedOrder.push(key);
      }

      const columns: TableColumnConfig[] = normalizedOrder.map(
        (key, order) => ({
          key,
          visible: nextVisible.has(key),
          order,
        }),
      );

      setUserTablePreference(LEADS_TABLE_ID, {
        columns,
        filters: buildColumnUiPrefFilters(nextPrefs),
      }).catch(() => {});
    },
    [allAvailableColumnKeys],
  );

  const handleResetLayout = useCallback(async () => {
    await deleteUserTablePreference(LEADS_TABLE_ID).catch(() => {
      // Reset should still apply locally even if delete request fails.
    });

    const defaultOrder = [...(STATIC_COLUMN_KEYS as unknown as string[])];
    const nextVisible = new Set(DEFAULT_VISIBLE_COLUMN_KEYS);
    const nextPrefs = { ...DEFAULT_COLUMN_UI_PREFS };

    setColumnOrder(defaultOrder);
    setVisibleColumnKeys(nextVisible);
    setColumnUiPrefs(nextPrefs);
    persistColumnLayout(nextVisible, defaultOrder, nextPrefs);
  }, [persistColumnLayout]);

  const updateColumnUiPrefs = useCallback(
    (updater: (prev: ColumnUiPrefs) => ColumnUiPrefs) => {
      setColumnUiPrefs((prev) => {
        const next = updater(prev);
        persistColumnLayout(visibleColumnKeys, columnOrder, next);
        return next;
      });
    },
    [columnOrder, persistColumnLayout, visibleColumnKeys],
  );

  const handleToggleColumn = useCallback(
    (key: string) => {
      setVisibleColumnKeys((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        persistColumnLayout(next, columnOrder, columnUiPrefs);
        return next;
      });
    },
    [columnOrder, columnUiPrefs, persistColumnLayout],
  );

  const moveVisibleColumn = useCallback(
    (key: string, direction: "up" | "down") => {
      setColumnOrder((prev) => {
        const visibleOrdered = prev.filter((k) => visibleColumnKeys.has(k));
        const idx = visibleOrdered.indexOf(key);
        if (idx < 0) return prev;

        const targetIdx = direction === "up" ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= visibleOrdered.length) return prev;

        const swapKey = visibleOrdered[targetIdx];
        const first = prev.indexOf(key);
        const second = prev.indexOf(swapKey);
        if (first < 0 || second < 0) return prev;

        const next = [...prev];
        [next[first], next[second]] = [next[second], next[first]];
        persistColumnLayout(visibleColumnKeys, next, columnUiPrefs);
        return next;
      });
    },
    [columnUiPrefs, persistColumnLayout, visibleColumnKeys],
  );

  // ── Column definitions ────────────────────────────────────────────────────
  const allStaticColumns = useMemo(
    (): Column<Lead>[] => [
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
        label: "Source",
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
            const disabled = campaign?.plugins?.trusted_form?.enabled === false;
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
            if (columnUiPrefs.trustedFormMode === "id") {
              return (
                <span className="flex items-center gap-1.5">
                  <span className="font-mono text-xs text-[--color-text]">
                    {tf.cert_id}
                  </span>
                  <a
                    href={`https://cert.trustedform.com/${tf.cert_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open certificate"
                    className="text-[--color-text-muted] transition hover:text-[--color-primary]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink size={11} />
                  </a>
                </span>
              );
            }
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
        width: "210px",
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
          return <span>{formatCompactDateTimeFallback(lead.created_at)}</span>;
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
        width: "156px",
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

          if (lead.cherry_picked) {
            return (
              <span className="inline-flex whitespace-nowrap rounded-full border border-rose-300/70 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:text-rose-300">
                Cherry Picked
              </span>
            );
          }

          if (s === "sold") {
            return <Badge tone="success">Sold</Badge>;
          }

          return <Badge tone="warning">Not Sold</Badge>;
        },
      },
      {
        key: "payload",
        label: "Details",
        render: (lead) => (
          <div className="flex items-center gap-1.5">
            {renderPayloadPreview(lead, filteredAndSortedLeads)}
            {onCherryPick &&
              (lead.cherry_picked === true ||
                (lead.sold !== true && lead.sold_status !== "sold")) && (
                <CherryPickButton
                  lead={lead}
                  onClick={() => onCherryPick(lead)}
                />
              )}
          </div>
        ),
      },
    ],
    [
      campaignIdMap,
      campaignKeyMap,
      affiliateIdMap,
      onOpenCampaign,
      renderPayloadPreview,
      onCherryPick,
      filteredAndSortedLeads,
    ],
  );

  const dynamicPayloadColumns = useMemo(
    (): Column<Lead>[] =>
      payloadFieldKeys.map((key) => ({
        key: `payload.${key}`,
        label: normalizeFieldLabel(key),
        width:
          inferPayloadFieldKind(key) === "phone"
            ? "150px"
            : inferPayloadFieldKind(key) === "email"
              ? "200px"
              : "140px",
        render: (lead: Lead) => {
          const val = lead.payload?.[key];
          if (val == null || val === "")
            return <span className="text-[--color-text-muted]">—</span>;

          const rawValue = String(val);
          const fieldKind = inferPayloadFieldKind(key);

          if (fieldKind === "phone") {
            const formattedPhone = formatPhoneNumber(rawValue);
            const digits = normalizePhoneDigits(rawValue);
            const canCall = digits.length === 10;
            const displayValue =
              columnUiPrefs.phoneDisplayMode === "formatted" ||
              columnUiPrefs.phoneDisplayMode === "callable"
                ? formattedPhone
                : rawValue;

            return (
              <span className="inline-flex items-center gap-1.5">
                {columnUiPrefs.phoneDisplayMode === "callable" && canCall ? (
                  <a
                    href={`tel:${digits}`}
                    className="font-mono text-xs text-[--color-primary] underline underline-offset-2"
                    title="Call number"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {displayValue}
                  </a>
                ) : (
                  <span className="font-mono text-xs">{displayValue}</span>
                )}

                {columnUiPrefs.ipqsLinkPhone && (
                  <button
                    type="button"
                    title="Open IPQS tool with phone"
                    onClick={(e) => {
                      e.stopPropagation();
                      openIpqsTool({ phone: rawValue });
                    }}
                    className="rounded p-0.5 text-[--color-text-muted] transition hover:text-[--color-primary]"
                  >
                    <ExternalLink size={12} />
                  </button>
                )}
              </span>
            );
          }

          if (fieldKind === "email") {
            return (
              <span className="inline-flex items-center gap-1.5">
                <span className="font-mono text-xs">{rawValue}</span>
                {columnUiPrefs.ipqsLinkEmail && (
                  <button
                    type="button"
                    title="Open IPQS tool with email"
                    onClick={(e) => {
                      e.stopPropagation();
                      openIpqsTool({ email: rawValue });
                    }}
                    className="rounded p-0.5 text-[--color-text-muted] transition hover:text-[--color-primary]"
                  >
                    <ExternalLink size={12} />
                  </button>
                )}
              </span>
            );
          }

          if (fieldKind === "ip") {
            return (
              <span className="inline-flex items-center gap-1.5">
                <span className="font-mono text-xs">{rawValue}</span>
                {columnUiPrefs.ipqsLinkIp && (
                  <button
                    type="button"
                    title="Open IPQS tool with IP"
                    onClick={(e) => {
                      e.stopPropagation();
                      openIpqsTool({ ip: rawValue });
                    }}
                    className="rounded p-0.5 text-[--color-text-muted] transition hover:text-[--color-primary]"
                  >
                    <ExternalLink size={12} />
                  </button>
                )}
              </span>
            );
          }

          return <span className="font-mono text-xs">{rawValue}</span>;
        },
      })),
    [columnUiPrefs, openIpqsTool, payloadFieldKeys],
  );

  const allColumnsByKey = useMemo(() => {
    const map = new Map<string, Column<Lead>>();
    [...allStaticColumns, ...dynamicPayloadColumns].forEach((col) => {
      map.set(col.key as string, col);
    });
    return map;
  }, [allStaticColumns, dynamicPayloadColumns]);

  const columnLabelByKey = useMemo(() => {
    const map = new Map<string, string>();
    allStaticColumns.forEach((col) => {
      const key = col.key as string;
      map.set(key, typeof col.label === "string" ? col.label : key);
    });
    payloadFieldKeys.forEach((fieldKey) => {
      map.set(`payload.${fieldKey}`, normalizeFieldLabel(fieldKey));
    });
    return map;
  }, [allStaticColumns, payloadFieldKeys]);

  const handleOpenCsvExport = useCallback(() => {
    setCsvExportKeys(
      new Set(
        columnOrder.filter((k) => visibleColumnKeys.has(k) && k !== "payload"),
      ),
    );
    setCsvExportOpen(true);
  }, [columnOrder, visibleColumnKeys]);

  const handleCsvExport = useCallback(() => {
    const selectedKeys = columnOrder.filter(
      (k) => csvExportKeys.has(k) && k !== "payload",
    );
    if (selectedKeys.length === 0) return;

    const includeRejectionReason = paginatedLeads.some(
      (lead) => lead.rejected === true,
    );
    const includeSoldMeta = paginatedLeads.some(
      (lead) => lead.sold === true || lead.sold_status === "sold",
    );

    const exportKeys = [...selectedKeys];
    if (includeRejectionReason) exportKeys.push("__rejection_reason");
    if (includeSoldMeta) {
      exportKeys.push("__sold_to_client_name");
      exportKeys.push("__sold_to_client_id");
    }

    const escapeCell = (v: string) => `"${v.replace(/"/g, '""')}"`;

    const getVal = (lead: Lead, key: string): string => {
      if (key.startsWith("payload.")) {
        const fieldKey = key.slice("payload.".length);
        const val = lead.payload?.[fieldKey];
        return val == null ? "" : String(val);
      }
      switch (key) {
        case "__rejection_reason":
          return lead.rejected
            ? formatRejectionDisplayText(lead.rejection_reason ?? "")
            : "";
        case "__sold_to_client_id": {
          if (!(lead.sold === true || lead.sold_status === "sold")) return "";
          return (
            lead.sold_to_client_id ||
            lead.delivery_result?.client_id ||
            lead.cherry_pick_meta?.target_client_id ||
            ""
          );
        }
        case "__sold_to_client_name": {
          if (!(lead.sold === true || lead.sold_status === "sold")) return "";
          const clientId =
            lead.sold_to_client_id ||
            lead.delivery_result?.client_id ||
            lead.cherry_pick_meta?.target_client_id ||
            "";
          return clientId ? (soldClientNameById.get(clientId) ?? clientId) : "";
        }
        case "id":
          return lead.id ?? "";
        case "campaign_id":
          return lead.campaign_id || "";
        case "campaign_key": {
          const mapping = campaignKeyMap.get(lead.campaign_key || "");
          return mapping?.affiliateId || lead.campaign_key || "";
        }
        case "test":
          return lead.test ? "Test" : "Live";
        case "qa_duplicate":
          return lead.duplicate === true ? "true" : "false";
        case "qa_trusted_form": {
          const tf = lead.trusted_form_result;
          if (!tf) return "";
          if (tf.cert_id) return tf.cert_id;
          return tf.success ? "Pass" : "Fail";
        }
        case "qa_ipqs": {
          const campaign = campaignIdMap.get(lead.campaign_id);
          if (campaign?.plugins?.ipqs?.enabled === false) return "N/A";
          const iq = lead.ipqs_result;
          if (!iq) return "";
          return iq.success ? "Pass" : "Fail";
        }
        case "created_at":
          return lead.created_at
            ? new Date(lead.created_at).toLocaleString()
            : "";
        case "intake_status":
          return lead.rejected ? "Rejected" : "Accepted";
        case "sold_status": {
          if (lead.cherry_picked) return "Cherry Picked";
          const s = lead.sold_status;
          if (!s || s === "not_delivered") return "Not Delivered";
          if (s === "sold") return "Sold";
          return "Not Sold";
        }
        default:
          return "";
      }
    };

    const getHeaderLabel = (key: string): string => {
      if (key === "__rejection_reason") return "Rejection Reason";
      if (key === "__sold_to_client_name") return "Sold To Client";
      if (key === "__sold_to_client_id") return "Sold To Client ID";
      return String(columnLabelByKey.get(key) ?? key);
    };

    const headerRow = exportKeys
      .map((k) => escapeCell(getHeaderLabel(k)))
      .join(",");
    const dataRows = paginatedLeads.map((lead) =>
      exportKeys.map((k) => escapeCell(getVal(lead, k))).join(","),
    );
    const csv = [headerRow, ...dataRows].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setCsvExportOpen(false);
  }, [
    csvExportKeys,
    columnOrder,
    paginatedLeads,
    campaignIdMap,
    campaignKeyMap,
    soldClientNameById,
    columnLabelByKey,
  ]);

  const orderedVisibleColumnKeys = useMemo(() => {
    const keys = columnOrder.filter((key) => visibleColumnKeys.has(key));
    const withoutPayload = keys.filter((k) => k !== "payload");
    return visibleColumnKeys.has("payload")
      ? [...withoutPayload, "payload"]
      : withoutPayload;
  }, [columnOrder, visibleColumnKeys]);

  const activeColumns = useMemo(
    (): Column<Lead>[] =>
      orderedVisibleColumnKeys
        .map((key) => allColumnsByKey.get(key))
        .filter((col): col is Column<Lead> => !!col),
    [orderedVisibleColumnKeys, allColumnsByKey],
  );

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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setControlsOpen((v) => !v)}
                className="inline-flex items-center gap-2 rounded-lg border border-[--color-border] bg-[--color-panel] px-3 py-1.5 text-sm font-medium text-[--color-text] transition hover:bg-[--color-bg-muted]"
              >
                <SlidersHorizontal size={14} />
                Filter and sort
                <ChevronDown
                  size={14}
                  className={`transition-transform ${controlsOpen ? "rotate-180" : ""}`}
                />
              </button>

              <button
                type="button"
                onClick={() => setColumnsModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-[--color-border] bg-[--color-panel] px-3 py-1.5 text-sm font-medium text-[--color-text] transition hover:bg-[--color-bg-muted]"
              >
                <Columns2 size={14} />
                Edit View
              </button>

              <button
                type="button"
                onClick={handleOpenCsvExport}
                title="Export current page to CSV"
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700"
              >
                <FileDown size={14} />
                Export CSV
              </button>
            </div>

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
                                  Sort by: Source
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
        columns={prefsLoaded ? activeColumns : []}
        data={prefsLoaded ? paginatedLeads : []}
        emptyLabel={
          !prefsLoaded || isLoading ? "Loading leads…" : "No leads available."
        }
      />

      <Modal
        title="Columns and Layout"
        isOpen={columnsModalOpen}
        onClose={() => setColumnsModalOpen(false)}
        width={860}
      >
        <div className="space-y-4 text-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-[--color-text-muted]">
              Manage visible columns, ordering, and display actions. Settings
              are saved per user.
            </p>
            <Button size="sm" variant="outline" onClick={handleResetLayout}>
              Reset Layout
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 rounded-lg border border-[--color-border] bg-[--color-bg-muted]/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[--color-text-muted]">
                Visible Column Order
              </p>
              {orderedVisibleColumnKeys.length === 0 ? (
                <p className="text-xs text-[--color-text-muted]">
                  No visible columns selected.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-auto pr-1">
                  {orderedVisibleColumnKeys.map((key, idx) => {
                    const label = columnLabelByKey.get(key) ?? key;
                    return (
                      <div
                        key={`order-${key}`}
                        className="flex items-center gap-2 rounded-md border border-[--color-border] bg-[--color-panel] px-2 py-1.5"
                      >
                        <span className="min-w-0 flex-1 truncate text-xs font-medium text-[--color-text]">
                          {label}
                        </span>
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveVisibleColumn(key, "up")}
                          title="Move up"
                          className="rounded border border-[--color-border] px-1.5 py-0.5 text-[11px] text-[--color-text-muted] transition enabled:hover:text-[--color-text] enabled:hover:bg-[--color-bg-muted] disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={idx === orderedVisibleColumnKeys.length - 1}
                          onClick={() => moveVisibleColumn(key, "down")}
                          title="Move down"
                          className="rounded border border-[--color-border] px-1.5 py-0.5 text-[11px] text-[--color-text-muted] transition enabled:hover:text-[--color-text] enabled:hover:bg-[--color-bg-muted] disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          ↓
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-3 rounded-lg border border-[--color-border] bg-[--color-bg-muted]/40 p-3">
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[--color-text-muted]">
                  Standard Columns
                </p>
                <div className="flex flex-wrap gap-2">
                  {allStaticColumns.map((col) => {
                    const key = col.key as string;
                    const active = visibleColumnKeys.has(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleToggleColumn(key)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                          active
                            ? "border-[--color-primary]/40 bg-[--color-primary]/10 text-[--color-primary]"
                            : "border-[--color-border] bg-[--color-panel] text-[--color-text-muted] hover:text-[--color-text]"
                        }`}
                      >
                        {active && <Check size={11} />}
                        {String(col.label)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {payloadFieldKeys.length > 0 && (
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[--color-text-muted]">
                    Payload Fields
                  </p>
                  <div className="flex flex-wrap gap-2 max-h-36 overflow-auto pr-1">
                    {payloadFieldKeys.map((fieldKey) => {
                      const colKey = `payload.${fieldKey}`;
                      const active = visibleColumnKeys.has(colKey);
                      return (
                        <button
                          key={colKey}
                          type="button"
                          onClick={() => handleToggleColumn(colKey)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                            active
                              ? "border-[--color-primary]/40 bg-[--color-primary]/10 text-[--color-primary]"
                              : "border-[--color-border] bg-[--color-panel] text-[--color-text-muted] hover:text-[--color-text]"
                          }`}
                        >
                          {active && <Check size={11} />}
                          {normalizeFieldLabel(fieldKey)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-[--color-border] bg-[--color-bg-muted]/40 p-3 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[--color-text-muted]">
              Field Display and Actions
            </p>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-medium text-[--color-text]">
                  Phone Display
                </span>
                <select
                  className={inputClass}
                  value={columnUiPrefs.phoneDisplayMode}
                  onChange={(e) =>
                    updateColumnUiPrefs((prev) => ({
                      ...prev,
                      phoneDisplayMode: e.target.value as PhoneDisplayMode,
                    }))
                  }
                >
                  <option value="raw">Raw</option>
                  <option value="formatted">Formatted (123) 456-7890</option>
                  <option value="callable">Formatted + Click to Call</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-[--color-text]">
                  TrustedForm Display
                </span>
                <select
                  className={inputClass}
                  value={columnUiPrefs.trustedFormMode}
                  onChange={(e) =>
                    updateColumnUiPrefs((prev) => ({
                      ...prev,
                      trustedFormMode: e.target.value as "link" | "id",
                    }))
                  }
                >
                  <option value="link">View cert (link)</option>
                  <option value="id">Cert ID + open icon</option>
                </select>
              </label>

              <div className="space-y-1">
                <span className="text-xs font-medium text-[--color-text]">
                  IPQS Quick Links
                </span>
                <div className="space-y-1.5 rounded-md border border-[--color-border] bg-[--color-panel] p-2.5 text-xs">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={columnUiPrefs.ipqsLinkPhone}
                      onChange={(e) =>
                        updateColumnUiPrefs((prev) => ({
                          ...prev,
                          ipqsLinkPhone: e.target.checked,
                        }))
                      }
                    />
                    Phone → Open IPQS
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={columnUiPrefs.ipqsLinkEmail}
                      onChange={(e) =>
                        updateColumnUiPrefs((prev) => ({
                          ...prev,
                          ipqsLinkEmail: e.target.checked,
                        }))
                      }
                    />
                    Email → Open IPQS
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={columnUiPrefs.ipqsLinkIp}
                      onChange={(e) =>
                        updateColumnUiPrefs((prev) => ({
                          ...prev,
                          ipqsLinkIp: e.target.checked,
                        }))
                      }
                    />
                    IP → Open IPQS
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-[--color-border] bg-[--color-panel] p-3 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[--color-text-muted]">
              Order Preview
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {orderedVisibleColumnKeys.length === 0 ? (
                <span className="text-xs text-[--color-text-muted]">
                  No visible columns selected.
                </span>
              ) : (
                orderedVisibleColumnKeys.map((key, idx) => (
                  <span
                    key={`preview-${key}`}
                    className="inline-flex items-center gap-1"
                  >
                    <span className="rounded-full border border-[--color-border] bg-[--color-bg-muted] px-2 py-0.5 text-xs font-medium text-[--color-text]">
                      {columnLabelByKey.get(key) ?? key}
                    </span>
                    {idx < orderedVisibleColumnKeys.length - 1 && (
                      <span className="text-[--color-text-muted]">→</span>
                    )}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Button size="sm" onClick={() => setColumnsModalOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* CSV Export Modal */}
      <Modal
        isOpen={csvExportOpen}
        onClose={() => setCsvExportOpen(false)}
        title="Export to CSV"
      >
        <div className="space-y-4">
          <p className="text-sm text-[--color-text-muted]">
            Select columns to include in the export. Visible columns are
            preselected by default, and hidden columns can be added. Only the{" "}
            <span className="font-medium text-[--color-text]">
              {paginatedLeads.length}
            </span>{" "}
            leads on the current page will be exported.
          </p>
          <div className="max-h-60 overflow-y-auto rounded-lg border border-[--color-border] bg-[--color-bg-muted]/40 p-3 space-y-1.5">
            {columnOrder
              .filter((k) => k !== "payload")
              .map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={csvExportKeys.has(key)}
                    onChange={(e) =>
                      setCsvExportKeys((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(key);
                        else next.delete(key);
                        return next;
                      })
                    }
                  />
                  <span className="text-[--color-text]">
                    {String(columnLabelByKey.get(key) ?? key)}
                  </span>
                  {!visibleColumnKeys.has(key) && (
                    <span className="rounded-full border border-[--color-border] bg-[--color-panel] px-1.5 py-0.5 text-[10px] text-[--color-text-muted]">
                      hidden
                    </span>
                  )}
                </label>
              ))}
          </div>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              className="text-xs text-[--color-text-muted] hover:text-[--color-text] transition"
              onClick={() =>
                setCsvExportKeys(
                  new Set(columnOrder.filter((k) => k !== "payload")),
                )
              }
            >
              Select all
            </button>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCsvExportOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={csvExportKeys.size === 0}
                onClick={handleCsvExport}
                className="bg-emerald-600 hover:bg-emerald-700 text-white border-0"
              >
                <FileDown size={14} />
                Download CSV
              </Button>
            </div>
          </div>
        </div>
      </Modal>

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
