"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownAZ,
  ArrowUpDown,
  ChevronDown,
  Filter,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { Table } from "@/components/table";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { AuditPopover } from "@/components/ui/audit-popover";
import { CampaignModal } from "@/components/modals/entity-modals";
import { DeleteConfirmModal } from "@/components/modals/delete-confirm-modal";
import { createCampaign, deleteCampaign } from "@/lib/api";
import { formatDate, inputClass, statusColorMap } from "@/lib/utils";
import type { Campaign, CampaignStatus, Lead } from "@/lib/types";
import type { CampaignDetailTab } from "@/lib/types";

// ─── Campaign deletion guards ─────────────────────────────────────────────────

function canDeleteCampaign(campaign: Campaign, leads: Lead[]): boolean {
  const hasLinked =
    (campaign.clients?.length ?? 0) > 0 ||
    (campaign.affiliates?.length ?? 0) > 0;
  const hasLeads = leads.some((l) => l.campaign_id === campaign.id);
  const validStatus = campaign.status === "DRAFT" || campaign.status === "TEST";
  return !hasLinked && !hasLeads && validStatus;
}

function canHardDeleteCampaign(campaign: Campaign): boolean {
  // Hard delete only if campaign has never had participants or received leads
  return !campaign.ever_linked_participants && !campaign.has_received_leads;
}

// ─── CampaignsView ────────────────────────────────────────────────────────────

interface CampaignsViewProps {
  campaigns: Campaign[];
  leads: Lead[];
  isLoading: boolean;
  onDataChanged: () => void;
  onOpenCampaign: (campaignId: string, section?: CampaignDetailTab) => void;
}

type SortKey = "name" | "status" | "clients" | "affiliates" | "created_at";
type SortDir = "asc" | "desc";
interface SortRule {
  key: SortKey;
  dir: SortDir;
}

const STATUSES: CampaignStatus[] = ["DRAFT", "TEST", "ACTIVE", "INACTIVE"];
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "status", label: "Status" },
  { value: "clients", label: "Clients" },
  { value: "affiliates", label: "Sources" },
  { value: "created_at", label: "Created" },
];

export function CampaignsView({
  campaigns,
  leads,
  isLoading,
  onDataChanged,
  onOpenCampaign,
}: CampaignsViewProps) {
  const [campaignModal, setCampaignModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null);

  // ── Search / filter / sort state ──────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "all">(
    "all",
  );
  const [tagFilter, setTagFilter] = useState<string | "all">("all");
  const [sortRules, setSortRules] = useState<SortRule[]>([]);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [controlsTab, setControlsTab] = useState<"filters" | "sorting">(
    "filters",
  );

  // ── Derived data ──────────────────────────────────────────────────────────
  const allTags = useMemo(() => {
    const set = new Set<string>();
    campaigns.forEach((c) => c.tags?.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [campaigns]);

  const filteredAndSorted = useMemo(() => {
    let list = campaigns;

    // Status filter
    if (statusFilter !== "all") {
      list = list.filter((c) => c.status === statusFilter);
    }

    // Tag filter
    if (tagFilter !== "all") {
      list = list.filter((c) => c.tags?.includes(tagFilter));
    }

    // Search (name, id, tags)
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((c) => {
        const haystack = [c.name, c.id, ...(c.tags ?? [])]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }

    // Multi-field sort
    if (sortRules.length > 0) {
      list = [...list].sort((a, b) => {
        for (const rule of sortRules) {
          let cmp = 0;
          switch (rule.key) {
            case "name":
              cmp = (a.name || "").localeCompare(b.name || "");
              break;
            case "status":
              cmp = (a.status || "").localeCompare(b.status || "");
              break;
            case "clients":
              cmp = (a.clients?.length ?? 0) - (b.clients?.length ?? 0);
              break;
            case "affiliates":
              cmp = (a.affiliates?.length ?? 0) - (b.affiliates?.length ?? 0);
              break;
            case "created_at":
              cmp =
                new Date(a.created_at ?? 0).getTime() -
                new Date(b.created_at ?? 0).getTime();
              break;
          }
          if (cmp !== 0) return rule.dir === "asc" ? cmp : -cmp;
        }
        return 0;
      });
    }

    return list;
  }, [campaigns, statusFilter, tagFilter, search, sortRules]);

  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) +
    (tagFilter !== "all" ? 1 : 0) +
    (search.trim() ? 1 : 0);
  const activeSortCount = sortRules.length;

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setTagFilter("all");
  };
  const clearSorting = () => setSortRules([]);
  const clearAll = () => {
    clearFilters();
    clearSorting();
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const onCreateCampaign = async (payload: {
    name: string;
    tags?: string[];
  }) => {
    await toast.promise(
      createCampaign(payload).then(() => onDataChanged()),
      {
        loading: "Creating campaign…",
        success: "Campaign created (DRAFT)",
        error: (err) => err?.message || "Unable to create campaign",
      },
    );
    setCampaignModal(false);
  };

  const onDeleteCampaign = async (permanent: boolean) => {
    if (!deleteTarget) return;
    await toast.promise(
      (async () => {
        const res = await deleteCampaign(deleteTarget.id, permanent);
        if (!(res as any)?.success)
          throw new Error((res as any)?.message || "Unable to delete campaign");
        await onDataChanged();
        setDeleteTarget(null);
      })(),
      {
        loading: permanent
          ? "Permanently deleting campaign…"
          : "Deleting campaign…",
        success: permanent
          ? "Campaign permanently deleted"
          : "Campaign deleted",
        error: (err) => err?.message || "Unable to delete campaign",
      },
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <motion.section
      key="campaigns"
      className="space-y-6"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[--color-text-muted]"
          />
          <input
            type="text"
            placeholder="Search campaigns…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputClass} pl-9 w-full`}
          />
        </div>

        {/* Filter & Sort toggle */}
        <button
          onClick={() => setControlsOpen((o) => !o)}
          className="flex items-center gap-1.5 rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] hover:bg-[--color-bg-subtle] transition-colors"
        >
          <SlidersHorizontal size={14} />
          Filter and sort
          <ChevronDown
            size={14}
            className={`transition-transform ${controlsOpen ? "rotate-180" : ""}`}
          />
        </button>

        {/* Badge buttons */}
        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 rounded-full bg-[--color-primary]/10 px-2.5 py-1 text-xs font-medium text-[--color-primary]"
          >
            <Filter size={12} />
            {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
            <X size={12} />
          </button>
        )}
        {activeSortCount > 0 && (
          <button
            onClick={clearSorting}
            className="flex items-center gap-1 rounded-full bg-[--color-primary]/10 px-2.5 py-1 text-xs font-medium text-[--color-primary]"
          >
            <ArrowUpDown size={12} />
            {activeSortCount} sort{activeSortCount > 1 ? "s" : ""}
            <X size={12} />
          </button>
        )}
        {activeFilterCount + activeSortCount > 1 && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 rounded-full border border-[--color-border] px-2.5 py-1 text-xs text-[--color-text-muted] hover:text-[--color-text]"
          >
            <RotateCcw size={12} />
            Clear all
          </button>
        )}

        {/* Spacer + New Campaign */}
        <div className="ml-auto">
          <Button
            iconLeft={<Plus size={16} />}
            onClick={() => setCampaignModal(true)}
            data-tour="btn-new-campaign"
          >
            New Campaign
          </Button>
        </div>
      </div>

      {/* ── Collapsible filter / sort panel ──────────────────────────────── */}
      <AnimatePresence>
        {controlsOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="rounded-lg border border-[--color-border] bg-[--color-bg-subtle] p-4 space-y-4">
              {/* Tab bar */}
              <div className="flex gap-2 border-b border-[--color-border] pb-2">
                {(["filters", "sorting"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setControlsTab(tab)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      controlsTab === tab
                        ? "bg-[--color-primary] text-white"
                        : "text-[--color-text-muted] hover:text-[--color-text]"
                    }`}
                  >
                    {tab === "filters" ? "Filters" : "Sorting"}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {controlsTab === "filters" ? (
                  <motion.div
                    key="filters"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.12 }}
                    className="space-y-4"
                  >
                    {/* Status pills */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[--color-text-muted] uppercase tracking-wide">
                        Status
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setStatusFilter("all")}
                          className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                            statusFilter === "all"
                              ? "bg-[--color-primary] text-white border-[--color-primary]"
                              : "border-[--color-border] text-[--color-text-muted] hover:text-[--color-text]"
                          }`}
                        >
                          All
                        </button>
                        {STATUSES.map((s) => (
                          <button
                            key={s}
                            onClick={() =>
                              setStatusFilter(statusFilter === s ? "all" : s)
                            }
                            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                              statusFilter === s
                                ? "bg-[--color-primary] text-white border-[--color-primary]"
                                : "border-[--color-border] text-[--color-text-muted] hover:text-[--color-text]"
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Tag pills (only if tags exist) */}
                    {allTags.length > 0 && (
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-[--color-text-muted] uppercase tracking-wide">
                          Tag
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => setTagFilter("all")}
                            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                              tagFilter === "all"
                                ? "bg-[--color-primary] text-white border-[--color-primary]"
                                : "border-[--color-border] text-[--color-text-muted] hover:text-[--color-text]"
                            }`}
                          >
                            All
                          </button>
                          {allTags.map((t) => (
                            <button
                              key={t}
                              onClick={() =>
                                setTagFilter(tagFilter === t ? "all" : t)
                              }
                              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                                tagFilter === t
                                  ? "bg-[--color-primary] text-white border-[--color-primary]"
                                  : "border-[--color-border] text-[--color-text-muted] hover:text-[--color-text]"
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="sorting"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.12 }}
                    className="space-y-3"
                  >
                    {sortRules.map((rule, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <select
                          value={rule.key}
                          onChange={(e) => {
                            const next = [...sortRules];
                            next[idx] = {
                              ...rule,
                              key: e.target.value as SortKey,
                            };
                            setSortRules(next);
                          }}
                          className={`${inputClass} w-40`}
                        >
                          {SORT_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            const next = [...sortRules];
                            next[idx] = {
                              ...rule,
                              dir: rule.dir === "asc" ? "desc" : "asc",
                            };
                            setSortRules(next);
                          }}
                          className="flex items-center gap-1 rounded-md border border-[--color-border] px-2 py-1.5 text-xs text-[--color-text-muted] hover:text-[--color-text] transition-colors"
                        >
                          <ArrowDownAZ size={14} />
                          {rule.dir === "asc" ? "A → Z" : "Z → A"}
                        </button>
                        <button
                          onClick={() =>
                            setSortRules(sortRules.filter((_, i) => i !== idx))
                          }
                          className="text-[--color-text-muted] hover:text-red-500 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    {sortRules.length < SORT_OPTIONS.length && (
                      <button
                        onClick={() =>
                          setSortRules([
                            ...sortRules,
                            {
                              key:
                                SORT_OPTIONS.find(
                                  (o) =>
                                    !sortRules.some((r) => r.key === o.value),
                                )?.value ?? "name",
                              dir: "asc",
                            },
                          ])
                        }
                        className="text-sm text-[--color-primary] hover:underline"
                      >
                        + Add sort rule
                      </button>
                    )}
                    {sortRules.length === 0 && (
                      <p className="text-sm text-[--color-text-muted]">
                        No sort rules. Click &quot;+ Add sort rule&quot; to
                        begin.
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <Table
        columns={[
          {
            key: "name",
            label: "Name",
            render: (c) => (
              <span className="font-medium text-[--color-text-strong]">
                {c.name}
              </span>
            ),
          },
          {
            key: "status",
            label: "Status",
            render: (c) => (
              <Badge tone={statusColorMap[c.status] || "neutral"}>
                {c.status}
              </Badge>
            ),
          },
          {
            key: "clients",
            label: "End Users",
            render: (c) => c.clients?.length || 0,
          },
          {
            key: "affiliates",
            label: "Sources",
            render: (c) => c.affiliates?.length || 0,
          },
          {
            key: "created_at",
            label: "Created",
            render: (c) => (
              <div className="flex items-center">
                <span>{formatDate(c.created_at)}</span>
                <AuditPopover
                  createdBy={c.created_by}
                  updatedBy={c.updated_by}
                  updatedAt={c.updated_at}
                  createdAt={c.created_at}
                  entityId={c.id}
                />
              </div>
            ),
          },
          {
            key: "actions",
            label: "Actions",
            render: (c) => {
              const deletable = canDeleteCampaign(c, leads);
              return (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onOpenCampaign(c.id, "overview")}
                  >
                    View
                  </Button>
                  {deletable && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setDeleteTarget(c)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              );
            },
          },
        ]}
        data={filteredAndSorted}
        firstRowDataTour="campaign-row-first"
        emptyLabel={
          isLoading
            ? "Loading campaigns…"
            : activeFilterCount > 0 || activeSortCount > 0
              ? "No campaigns match the current filters."
              : "No campaigns yet. Add one."
        }
      />

      <CampaignModal
        isOpen={campaignModal}
        onClose={() => setCampaignModal(false)}
        onSubmit={onCreateCampaign}
      />

      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={onDeleteCampaign}
        entityType="campaign"
        entityName={deleteTarget?.name || ""}
        canHardDelete={
          deleteTarget ? canHardDeleteCampaign(deleteTarget) : false
        }
      />
    </motion.section>
  );
}
