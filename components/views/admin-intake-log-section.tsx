"use client";

import { Dispatch, SetStateAction } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  BadgeCheck,
  Building2,
  CalendarDays,
  ChevronDown,
  Clock3,
  Hash,
  Mail,
  Phone,
  RefreshCw,
  ScrollText,
  Search,
  SlidersHorizontal,
  User,
} from "lucide-react";
import { Badge } from "@/components/badge";
import { PaginationControls } from "@/components/pagination-controls";
import {
  formatLocalTime,
  isRejectedIntake,
} from "@/components/views/admin-intake-helpers";
import { IntakeLogItem, CampaignDetailTab } from "@/lib/types";

type AdminIntakeLogSectionProps = {
  showIntakeLogsLoading: boolean;
  intakeLogsRaw: IntakeLogItem[];
  refreshIntakeLogs: () => void;
  inputClass: string;
  intakeSearch: string;
  setIntakeSearch: Dispatch<SetStateAction<string>>;
  intakeFiltersOpen: boolean;
  setIntakeFiltersOpen: Dispatch<SetStateAction<boolean>>;
  setIntakeStatusFilter: Dispatch<
    SetStateAction<"all" | "accepted" | "rejected" | "test">
  >;
  setIntakeSort: Dispatch<SetStateAction<"newest" | "oldest">>;
  intakeSort: "newest" | "oldest";
  intakeStatusFilter: "all" | "accepted" | "rejected" | "test";
  intakeStatusCounts: {
    all: number;
    accepted: number;
    rejected: number;
    test: number;
  };
  filteredIntakeLogs: IntakeLogItem[];
  paginatedIntakeLogs: IntakeLogItem[];
  setSelectedIntakeLog: Dispatch<SetStateAction<IntakeLogItem | null>>;
  onOpenCampaign?: (
    campaignId: string,
    section?: CampaignDetailTab,
    affiliateId?: string,
    subSection?: "base-criteria" | "logic",
  ) => void;
  intakePage: number;
  intakeTotalPages: number;
  setIntakePage: Dispatch<SetStateAction<number>>;
  intakePageSize: number;
  setIntakePageSize: Dispatch<SetStateAction<number>>;
  intakeShowingFrom: number;
  intakeShowingTo: number;
};

export function AdminIntakeLogSection({
  showIntakeLogsLoading,
  intakeLogsRaw,
  refreshIntakeLogs,
  inputClass,
  intakeSearch,
  setIntakeSearch,
  intakeFiltersOpen,
  setIntakeFiltersOpen,
  setIntakeStatusFilter,
  setIntakeSort,
  intakeSort,
  intakeStatusFilter,
  intakeStatusCounts,
  filteredIntakeLogs,
  paginatedIntakeLogs,
  setSelectedIntakeLog,
  onOpenCampaign,
  intakePage,
  intakeTotalPages,
  setIntakePage,
  intakePageSize,
  setIntakePageSize,
  intakeShowingFrom,
  intakeShowingTo,
}: AdminIntakeLogSectionProps) {
  return (
    <motion.div
      key="intake-logs"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <ScrollText
              size={16}
              strokeWidth={2.5}
              className="text-[--color-primary]"
            />
            <span className="font-semibold text-[--color-text-strong]">
              Intake Logs
            </span>
          </div>
          {!showIntakeLogsLoading && intakeLogsRaw.length > 0 && (
            <span className="rounded-full bg-[--color-bg-muted] px-2.5 py-0.5 text-xs font-medium text-[--color-text-muted]">
              {intakeLogsRaw.length} records
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => refreshIntakeLogs()}
          title="Refresh intake logs"
          className="flex items-center justify-center rounded-lg border border-[--color-border] bg-[--color-panel] p-1.5 text-[--color-text-muted] transition hover:text-[--color-text]"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      <div className="rounded-xl border border-[--color-border] bg-[--color-panel] p-3 space-y-3">
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[--color-text-muted]"
          />
          <input
            className={`${inputClass} pl-9`}
            placeholder="Search by lead ID or body content..."
            value={intakeSearch}
            onChange={(e) => setIntakeSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setIntakeFiltersOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg border border-[--color-border] bg-[--color-bg-muted] px-3 py-1.5 text-sm font-medium text-[--color-text] transition hover:bg-[--color-bg]"
          >
            <SlidersHorizontal size={14} />
            Filter and sort
            <ChevronDown
              size={14}
              className={`transition-transform ${intakeFiltersOpen ? "rotate-180" : ""}`}
            />
          </button>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setIntakeSearch("");
                setIntakeStatusFilter("all");
                setIntakeSort("newest");
              }}
              className="rounded-lg border border-[--color-border] px-2.5 py-1.5 text-xs font-medium text-[--color-text-muted] transition hover:text-[--color-text] hover:bg-[--color-bg-muted]"
            >
              Clear all
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {intakeFiltersOpen && (
            <motion.div
              key="intake-filters"
              initial={{ opacity: 0, height: 0, y: -6 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -6 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="space-y-3 min-h-[90px]">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
                      Sort
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setIntakeSort((prev) =>
                          prev === "newest" ? "oldest" : "newest",
                        )
                      }
                      className="flex items-center gap-1.5 rounded-lg border border-[--color-border] bg-[--color-panel] px-2.5 py-1.5 text-sm text-[--color-text] transition hover:bg-[--color-bg-muted] w-24 justify-start"
                    >
                      {intakeSort === "newest" ? (
                        <ArrowDownNarrowWide
                          size={13}
                          className="text-[--color-text-muted]"
                        />
                      ) : (
                        <ArrowUpNarrowWide
                          size={13}
                          className="text-[--color-text-muted]"
                        />
                      )}
                      {intakeSort === "newest" ? "Newest" : "Oldest"}
                    </button>
                  </label>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { key: "all", label: "All" },
                      { key: "accepted", label: "Accepted" },
                      { key: "test", label: "Test" },
                      { key: "rejected", label: "Rejected" },
                    ] as const
                  ).map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setIntakeStatusFilter(key)}
                      className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        intakeStatusFilter === key
                          ? "bg-[--color-primary] text-[--color-bg]"
                          : "border border-[--color-border] bg-[--color-panel] text-[--color-text-muted] hover:bg-[--color-bg-muted] hover:text-[--color-text]"
                      }`}
                    >
                      {label}
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                          intakeStatusFilter === key
                            ? "bg-white/20 text-white"
                            : "bg-[--color-bg-muted] text-[--color-text-muted]"
                        }`}
                      >
                        {intakeStatusCounts[key]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {showIntakeLogsLoading ? (
        <div className="rounded-xl border border-[--color-border] bg-[--color-panel] py-12 text-center">
          <p className="text-sm text-[--color-text-muted]">
            Loading intake logs...
          </p>
        </div>
      ) : filteredIntakeLogs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[--color-border] bg-[--color-panel] py-12 text-center">
          <p className="text-sm font-medium text-[--color-text-muted]">
            No intake logs found
          </p>
          <p className="mt-1 text-xs text-[--color-text-muted]">
            {intakeSearch || intakeStatusFilter !== "all"
              ? "Try adjusting your filters."
              : "Lead submission attempts will appear here."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[--color-border] bg-[--color-panel] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-[--color-border] bg-[--color-bg-muted]/60">
                  {[
                    { label: "Lead ID", icon: <Hash size={11} /> },
                    {
                      label: "Received",
                      icon: <CalendarDays size={11} />,
                    },
                    {
                      label: "Status",
                      icon: <BadgeCheck size={11} />,
                    },
                    { label: "Mode", icon: <Clock3 size={11} /> },
                    {
                      label: "Campaign",
                      icon: <Building2 size={11} />,
                    },
                    {
                      label: "Campaign Key",
                      icon: <Hash size={11} />,
                    },
                    {
                      label: "First Name",
                      icon: <User size={11} />,
                    },
                    {
                      label: "Last Name",
                      icon: <User size={11} />,
                    },
                    { label: "Email", icon: <Mail size={11} /> },
                    { label: "Phone", icon: <Phone size={11} /> },
                  ].map((col) => (
                    <th
                      key={col.label}
                      className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest text-[--color-text-muted] whitespace-nowrap"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {col.icon}
                        {col.label}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[--color-border]">
                {paginatedIntakeLogs.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-[--color-bg-muted] cursor-pointer transition-colors"
                    onClick={() => setSelectedIntakeLog(item)}
                  >
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-xs font-medium text-[--color-primary]">
                        {item.id}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-[--color-text-muted]">
                      {formatLocalTime(item.received_at)}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge
                        tone={isRejectedIntake(item) ? "danger" : "success"}
                      >
                        {isRejectedIntake(item) ? "Rejected" : "Accepted"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge
                        tone={
                          item.status === "test" || item.is_test
                            ? "info"
                            : "success"
                        }
                      >
                        {item.status === "test" || item.is_test
                          ? "Test"
                          : "Live"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      {item.campaign_id && onOpenCampaign ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenCampaign(item.campaign_id!, "overview");
                          }}
                          className="font-mono text-xs text-[--color-primary] hover:underline max-w-[120px] truncate block"
                          title={item.campaign_id}
                        >
                          {item.campaign_id}
                        </button>
                      ) : (
                        <span className="text-xs text-[--color-text-muted]">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-xs text-[--color-text-muted] max-w-[120px] truncate block">
                        {item.campaign_key || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-sm text-[--color-text]">
                      {item.first_name || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-[--color-text]">
                      {item.last_name || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-[--color-text]">
                      {item.email || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-[--color-text]">
                      {item.phone || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PaginationControls
        page={intakePage}
        totalPages={intakeTotalPages}
        onPageChange={setIntakePage}
        pageSize={intakePageSize}
        onPageSizeChange={setIntakePageSize}
        totalItems={filteredIntakeLogs.length}
        showingFrom={intakeShowingFrom}
        showingTo={intakeShowingTo}
        itemLabel="intake logs"
      />
    </motion.div>
  );
}
