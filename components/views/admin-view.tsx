"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  CalendarDays,
  Clock3,
  ArrowDownNarrowWide,
  ArrowRight,
  ArrowUpNarrowWide,
  BadgeCheck,
  Building2,
  ChevronDown,
  Hash,
  KeyRound,
  LayoutTemplate,
  Megaphone,
  Plug,
  PlusCircle,
  RefreshCw,
  Mail,
  Phone,
  ScrollText,
  User,
  Search,
  Settings2,
  SlidersHorizontal,
  Target,
  UserCog,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import useSWR from "swr";
import { Table } from "@/components/table";
import { PaginationControls } from "@/components/pagination-controls";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import {
  CreateUserModal,
  UserDetailModal,
} from "@/components/modals/user-modals";
import {
  AddCredentialModal,
  CredentialDetailModal,
  AddCredentialSchemaModal,
  CredentialSchemaDetailModal,
  PluginSettingDetailModal,
} from "@/components/modals/integrations-modals";
import {
  createUser,
  listUsers,
  listCredentials,
  listCredentialSchemas,
  listPluginSettings,
  getFullAuditLog,
  getIntakeLogs,
} from "@/lib/api";
import { formatDate, inputClass, normalizeFieldLabel } from "@/lib/utils";
import { AuditPopover, HoverTooltip } from "@/components/shared-ui";
import { getCurrentUser } from "@/lib/auth";
import type {
  Campaign,
  CampaignDetailTab,
  CognitoUser,
  CredentialRecord,
  CredentialSchemaRecord,
  PluginView,
  AuditLogItem,
  AuditActor,
  IntakeLogItem,
} from "@/lib/types";

// ─── Helpers (shared with activity log) ──────────────────────────────────────

function isComplexValue(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === "object") return true;
  if (typeof val === "string" && (val === "[previous]" || val === "[updated]"))
    return true;
  return false;
}

function formatAuditValue(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "object") return "...";
  return String(val);
}

function resolveAuditActor(actor?: AuditActor | null): string {
  if (!actor) return "System";
  return actor.full_name || actor.email || actor.username || "Unknown";
}

function auditActionLabel(action: string): string {
  return action
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function auditActionTone(
  action: string,
): "success" | "danger" | "info" | "warning" | "neutral" {
  if (
    action === "created" ||
    action === "restored" ||
    action === "credential_enabled" ||
    action === "plugin_setting_enabled"
  )
    return "success";
  if (
    action === "deleted" ||
    action === "soft_deleted" ||
    action === "credential_disabled" ||
    action === "plugin_setting_disabled"
  )
    return "danger";
  if (
    action === "status_changed" ||
    action === "key_rotated" ||
    action === "password_reset"
  )
    return "warning";
  if (
    action === "updated" ||
    action.endsWith("_added") ||
    action.endsWith("_updated") ||
    action === "mappings_updated" ||
    action === "plugins_updated"
  )
    return "info";
  return "neutral";
}

function getEntityTypeMeta(type: string) {
  const s = 11;
  switch (type) {
    case "lead":
      return {
        icon: <Target size={s} />,
        label: "Lead",
        color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      };
    case "campaign":
      return {
        icon: <Megaphone size={s} />,
        label: "Campaign",
        color: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
      };
    case "client":
      return {
        icon: <Building2 size={s} />,
        label: "Client",
        color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      };
    case "affiliate":
      return {
        icon: <Users size={s} />,
        label: "Affiliate",
        color: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
      };
    case "credential":
      return {
        icon: <KeyRound size={s} />,
        label: "Credential",
        color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      };
    case "credential_schema":
      return {
        icon: <LayoutTemplate size={s} />,
        label: "Schema",
        color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
      };
    case "plugin_setting":
      return {
        icon: <Plug size={s} />,
        label: "Integration",
        color: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
      };
    case "user":
      return {
        icon: <UserCog size={s} />,
        label: "User",
        color: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
      };
    default:
      return {
        icon: <Activity size={s} />,
        label: type || "Unknown",
        color: "bg-[--color-bg-muted] text-[--color-text-muted]",
      };
  }
}

function formatLogDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  const d = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
  const t = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
  return `${d} · ${t}`;
}

// ─── Intake log timezone helpers ──────────────────────────────────────────────

/** Returns the browser's local timezone identifier (e.g. "America/Chicago"). */
function getBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Format a UTC ISO string as local time with abbreviated timezone name.
 * Example output: "2026-03-15 10:32 AM CST"
 */
function formatLocalTime(utcString?: string): string {
  if (!utcString) return "—";
  const date = new Date(utcString);
  if (Number.isNaN(date.getTime())) return "—";
  const tz = getBrowserTimezone();
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: tz,
    timeZoneName: "short",
  }).formatToParts(date);
  const byType = new Map(parts.map((p) => [p.type, p.value]));
  const month = byType.get("month") ?? "--";
  const day = byType.get("day") ?? "--";
  const year = byType.get("year") ?? "----";
  const hour = byType.get("hour") ?? "--";
  const minute = byType.get("minute") ?? "--";
  const period = byType.get("dayPeriod") ?? "";
  const abbr = byType.get("timeZoneName") ?? tz;
  return `${year}-${month}-${day} ${hour}:${minute}${period ? ` ${period}` : ""} ${abbr}`;
}

/**
 * Format a UTC ISO string as a UTC timestamp string.
 * Example output: "2026-03-15 16:32 UTC"
 */
function formatUtcTime(utcString?: string): string {
  if (!utcString) return "—";
  const date = new Date(utcString);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
    timeZoneName: "short",
  }).formatToParts(date);
  const byType = new Map(parts.map((p) => [p.type, p.value]));
  const month = byType.get("month") ?? "--";
  const day = byType.get("day") ?? "--";
  const year = byType.get("year") ?? "----";
  const hour = byType.get("hour") ?? "--";
  const minute = byType.get("minute") ?? "--";
  const period = byType.get("dayPeriod") ?? "";
  return `${year}-${month}-${day} ${hour}:${minute}${period ? ` ${period}` : ""} UTC`;
}

// ─── Intake log helpers ───────────────────────────────────────────────────────

function intakeStatusTone(
  status: string,
): "success" | "danger" | "warning" | "neutral" {
  if (status === "accepted") return "success";
  if (status === "rejected") return "danger";
  if (status === "test") return "warning";
  return "neutral";
}

function buildSynthesizedResponse(
  item: IntakeLogItem,
): Record<string, unknown> {
  if (item.status === "rejected") {
    return {
      result: "failed",
      lead_id: item.id,
      msg: item.rejection_reason || "Lead rejected",
      errors: item.rejection_errors || [],
    };
  }
  if (item.status === "test") {
    return {
      id: item.id,
      test: true,
      duplicate: false,
      rejected: false,
      message: "Test lead received",
    };
  }
  return {
    id: item.id,
    test: false,
    duplicate: false,
    rejected: false,
    message: "Lead accepted",
  };
}

function buildDisplayedResponse(item: IntakeLogItem): unknown {
  // Preferred: render the exact response captured by intake logs.
  if (item.response_body !== undefined) {
    return item.response_body;
  }

  // Fallback for older log records without persisted response fields.
  return buildSynthesizedResponse(item);
}

function isRejectedIntake(item: IntakeLogItem): boolean {
  if (item.status === "rejected") return true;

  const response = buildDisplayedResponse(item);
  if (!response || typeof response !== "object") return false;

  const record = response as Record<string, unknown>;
  const result = String(record.result ?? "").toLowerCase();
  if (result === "failed" || result === "rejected") return true;

  if (record.rejected === true) return true;

  const errors = record.errors;
  if (Array.isArray(errors) && errors.length > 0) return true;

  const message = String(record.message ?? record.msg ?? "").toLowerCase();
  if (message.includes("rejected") || message.includes("failed")) return true;

  return false;
}

// ─── Intake Log Detail Modal ──────────────────────────────────────────────────

function IntakeLogDetailModal({
  item,
  onClose,
  onOpenLead,
}: {
  item: IntakeLogItem | null;
  onClose: () => void;
  onOpenLead?: (leadId: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<"request" | "response">("request");
  const [overviewOpen, setOverviewOpen] = useState(true);

  useEffect(() => {
    if (!item) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [item, onClose]);

  if (!item) return null;

  const displayedResponse = buildDisplayedResponse(item);
  const isRejected = isRejectedIntake(item);

  return (
    <AnimatePresence>
      {item && (
        <>
          {/* Backdrop */}
          <motion.div
            key="intake-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
            onClick={onClose}
          />
          {/* Modal */}
          <motion.div
            key="intake-modal"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="pointer-events-auto relative w-full max-w-4xl h-[80vh] max-h-[760px] min-h-[620px] flex flex-col rounded-2xl border border-[--color-border] bg-[--color-panel] shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex shrink-0 items-center gap-3 border-b border-[--color-border] px-5 py-4">
                <Badge tone={isRejected ? "danger" : "success"}>
                  {isRejected ? "Rejected" : "Accepted"}
                </Badge>
                <Badge
                  tone={
                    item.status === "test" || item.is_test ? "info" : "success"
                  }
                >
                  {item.status === "test" || item.is_test ? "Test" : "Live"}
                </Badge>
                <span className="text-base font-semibold text-[--color-text-strong]">
                  Intake Log Details
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  className="ml-auto shrink-0 rounded-lg p-1.5 text-[--color-text-muted] hover:bg-[--color-bg-muted] hover:text-[--color-text] transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal body — scrollable */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Overview */}
                <div className="rounded-xl border border-[--color-border] bg-[--color-bg-muted]/50 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOverviewOpen((v) => !v)}
                    className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-[--color-text-strong] hover:bg-[--color-bg-muted] transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <ScrollText
                        size={14}
                        className="text-[--color-text-muted]"
                      />
                      Overview
                    </span>
                    <ChevronDown
                      size={14}
                      className={`text-[--color-text-muted] transition-transform duration-150 ${overviewOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {overviewOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="px-4 pb-4 pt-1 grid grid-cols-2 gap-x-8 gap-y-3"
                    >
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-[--color-text-muted] mb-0.5">
                          Lead ID
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            onOpenLead?.(item.id);
                            onClose();
                          }}
                          className="font-mono text-sm font-medium text-[--color-primary] hover:underline"
                          title="Open lead details"
                        >
                          {item.id}
                        </button>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-[--color-text-muted] mb-0.5">
                          Campaign Key
                        </p>
                        <p className="font-mono text-sm text-[--color-text] truncate max-w-[200px]">
                          {item.campaign_key || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-[--color-text-muted] mb-0.5">
                          Received At
                        </p>
                        <p className="text-sm text-[--color-text]">
                          {formatLocalTime(item.received_at)}
                        </p>
                        <p className="text-xs text-[--color-text-muted] mt-0.5">
                          {formatUtcTime(item.received_at)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-[--color-text-muted] mb-0.5">
                          Method
                        </p>
                        <p className="text-sm font-medium text-[--color-text]">
                          POST
                        </p>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Rejection reason */}
                {isRejected && (
                  <div className="rounded-xl border border-[--color-danger] bg-[--color-panel] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.03)]">
                    <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-[--color-danger]">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[--color-danger] bg-[--color-bg-muted]">
                        <X size={12} />
                      </span>
                      Rejection Reason
                    </p>
                    {item.rejection_errors &&
                    item.rejection_errors.length > 0 ? (
                      <ul className="space-y-1.5">
                        {item.rejection_errors.map((err, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm text-[--color-text-strong]"
                          >
                            <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[--color-danger]" />
                            {err}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-[--color-text-strong]">
                        {item.rejection_reason || "Unknown rejection reason"}
                      </p>
                    )}
                  </div>
                )}

                {/* Request / Response tabs */}
                <div className="rounded-xl border border-[--color-border] overflow-hidden">
                  {/* Tab bar */}
                  <div className="flex border-b border-[--color-border] bg-[--color-bg-muted]/60">
                    {(["request", "response"] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2.5 text-sm font-medium transition-colors capitalize ${
                          activeTab === tab
                            ? "border-b-2 border-[--color-primary] text-[--color-primary]"
                            : "text-[--color-text-muted] hover:text-[--color-text]"
                        }`}
                      >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      </button>
                    ))}
                  </div>
                  {/* Content */}
                  <div className="h-[360px] overflow-hidden bg-[--color-bg]">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.pre
                        key={activeTab}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className="h-full overflow-y-auto p-4 text-xs text-[--color-text] font-mono leading-relaxed whitespace-pre-wrap break-all"
                      >
                        {activeTab === "request"
                          ? item.raw_body
                            ? JSON.stringify(item.raw_body, null, 2)
                            : "No request body available."
                          : JSON.stringify(displayedResponse, null, 2)}
                      </motion.pre>
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Admin types ──────────────────────────────────────────────────────────────

type AdminPrimaryTab = "settings" | "logs";
type SettingsSectionKey =
  | "saved-credentials"
  | "schemas"
  | "plugin-settings"
  | "users";
type LogsSectionKey = "activity" | "intake";

interface AdminViewProps {
  role?: string;
  campaigns?: Campaign[];
  onOpenCampaign?: (
    campaignId: string,
    section?: CampaignDetailTab,
    affiliateId?: string,
    subSection?: "base-criteria" | "logic",
  ) => void;
  onOpenLead?: (leadId: string) => void;
}

// ─── AdminView ────────────────────────────────────────────────────────────────

export function AdminView({
  role,
  onOpenCampaign,
  onOpenLead,
}: AdminViewProps) {
  const currentUserEmail = getCurrentUser()?.email;

  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // ── URL-derived state ──────────────────────────────────────────────────────
  const VALID_SETTINGS_SECTIONS: SettingsSectionKey[] = [
    "saved-credentials",
    "schemas",
    "plugin-settings",
    "users",
  ];
  const VALID_LOGS_SECTIONS: LogsSectionKey[] = ["activity", "intake"];

  const rawAdminTab = searchParams?.get("admin_tab");
  const initialAdminTab: AdminPrimaryTab =
    rawAdminTab === "logs" ? "logs" : "settings";

  const rawSection = searchParams?.get("settings_section");
  const initialActiveSection: SettingsSectionKey = (
    VALID_SETTINGS_SECTIONS.includes(rawSection as SettingsSectionKey)
      ? rawSection
      : "saved-credentials"
  ) as SettingsSectionKey;

  const rawLogsSection = searchParams?.get("logs_section");
  const initialLogsSection: LogsSectionKey = (
    VALID_LOGS_SECTIONS.includes(rawLogsSection as LogsSectionKey)
      ? rawLogsSection
      : "activity"
  ) as LogsSectionKey;

  const [adminTab, setAdminTabState] =
    useState<AdminPrimaryTab>(initialAdminTab);
  const [activeSection, setActiveSectionState] =
    useState<SettingsSectionKey>(initialActiveSection);
  const [logsSection, setLogsSectionState] =
    useState<LogsSectionKey>(initialLogsSection);
  const [logsEntityType, setLogsEntityTypeState] = useState(
    searchParams?.get("logs_entity") ?? "",
  );
  const [logsActorSub, setLogsActorSubState] = useState(
    searchParams?.get("logs_actor") ?? "",
  );
  const [logsSort, setLogsSortState] = useState<"newest" | "oldest">(
    (searchParams?.get("logs_sort") ?? "newest") as "newest" | "oldest",
  );

  useEffect(() => {
    const nextRawAdminTab = searchParams?.get("admin_tab");
    const nextAdminTab: AdminPrimaryTab =
      nextRawAdminTab === "logs" ? "logs" : "settings";
    const nextRawSection = searchParams?.get("settings_section");
    const nextActiveSection: SettingsSectionKey = (
      VALID_SETTINGS_SECTIONS.includes(nextRawSection as SettingsSectionKey)
        ? nextRawSection
        : "saved-credentials"
    ) as SettingsSectionKey;
    const nextRawLogsSection = searchParams?.get("logs_section");
    const nextLogsSection: LogsSectionKey = (
      VALID_LOGS_SECTIONS.includes(nextRawLogsSection as LogsSectionKey)
        ? nextRawLogsSection
        : "activity"
    ) as LogsSectionKey;
    setAdminTabState(nextAdminTab);
    setActiveSectionState(nextActiveSection);
    setLogsSectionState(nextLogsSection);
    setLogsEntityTypeState(searchParams?.get("logs_entity") ?? "");
    setLogsActorSubState(searchParams?.get("logs_actor") ?? "");
    setLogsSortState(
      (searchParams?.get("logs_sort") ?? "newest") as "newest" | "oldest",
    );
  }, [searchParams]);

  const setSettingsParams = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams(
      typeof window === "undefined" ? "" : window.location.search,
    );
    Object.entries(next).forEach(([key, value]) => {
      if (value === undefined || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    const qs = params.toString();
    if (typeof window !== "undefined") {
      window.history.replaceState(
        window.history.state,
        "",
        qs ? `${pathname}?${qs}` : pathname,
      );
    }
  };

  const setAdminTab = (tab: AdminPrimaryTab) => {
    setAdminTabState(tab);
    if (tab === "settings") {
      setLogsEntityTypeState("");
      setLogsActorSubState("");
    }
    setSettingsParams({
      admin_tab: tab === "settings" ? undefined : tab,
      // Clear the opposing tab's params
      settings_section: tab === "logs" ? undefined : activeSection,
      logs_section: tab === "settings" ? undefined : logsSection,
      logs_entity: tab === "settings" ? undefined : logsEntityType || undefined,
      logs_actor: tab === "settings" ? undefined : logsActorSub || undefined,
    });
  };

  const setActiveSection = (key: SettingsSectionKey) => {
    setActiveSectionState(key);
    setSettingsParams({ settings_section: key });
  };

  const setLogsSection = (key: LogsSectionKey) => {
    setLogsSectionState(key);
    setSettingsParams({ logs_section: key });
  };

  /** Returns a sharable ?view=... URL for any log entity. */
  const CRITERIA_AUDIT_ACTIONS = new Set([
    "criteria_field_added",
    "criteria_field_updated",
    "criteria_field_deleted",
  ]);
  const LOGIC_AUDIT_ACTIONS = new Set([
    "logic_rule_added",
    "logic_rule_updated",
    "logic_rule_deleted",
  ]);
  const getEntityUrl = (
    entityType: string,
    entityId: string,
    action?: string,
  ): string => {
    switch (entityType) {
      case "lead":
        return `?view=leads&lead=${encodeURIComponent(entityId)}`;
      case "campaign": {
        if (action && CRITERIA_AUDIT_ACTIONS.has(action))
          return `?view=campaigns&campaign=${encodeURIComponent(entityId)}&section=settings&subsection=criteria`;
        if (action && LOGIC_AUDIT_ACTIONS.has(action))
          return `?view=campaigns&campaign=${encodeURIComponent(entityId)}&section=settings&subsection=logic`;
        return `?view=campaigns&campaign=${encodeURIComponent(entityId)}&section=overview`;
      }
      case "client":
        return `?view=clients`;
      case "affiliate":
        return `?view=affiliates`;
      case "user":
        return `?view=admin&admin_tab=settings&settings_section=users`;
      case "credential":
        return `?view=admin&admin_tab=settings&settings_section=saved-credentials`;
      case "credential_schema":
        return `?view=admin&admin_tab=settings&settings_section=schemas`;
      case "plugin_setting":
        return `?view=admin&admin_tab=settings&settings_section=plugin-settings`;
      default:
        return `?view=admin`;
    }
  };

  const openAuditEntity = (
    entityType: string,
    entityId: string,
    action?: string,
  ) => {
    if (entityType === "lead" && onOpenLead) {
      onOpenLead(entityId);
      return;
    }
    if (entityType === "campaign" && onOpenCampaign) {
      if (action && CRITERIA_AUDIT_ACTIONS.has(action)) {
        onOpenCampaign(entityId, "settings", undefined, "base-criteria");
        return;
      }
      if (action && LOGIC_AUDIT_ACTIONS.has(action)) {
        onOpenCampaign(entityId, "settings", undefined, "logic");
        return;
      }
      onOpenCampaign(entityId, "overview");
      return;
    }
    router.push(getEntityUrl(entityType, entityId, action));
  };

  const [userSearch, setUserSearch] = useState("");
  const [showDisabled, setShowDisabled] = useState(false);

  // User modals
  const [userCreateModal, setUserCreateModal] = useState(false);
  const [viewUserTarget, setViewUserTarget] = useState<CognitoUser | null>(
    null,
  );

  // Credential modals
  const [addCredModal, setAddCredModal] = useState(false);
  const [viewCredTarget, setViewCredTarget] = useState<CredentialRecord | null>(
    null,
  );

  // Credential schema modals
  const [addSchemaModal, setAddSchemaModal] = useState(false);
  const [viewSchemaTarget, setViewSchemaTarget] =
    useState<CredentialSchemaRecord | null>(null);
  const [viewPluginTarget, setViewPluginTarget] = useState<PluginView | null>(
    null,
  );

  // Intake logs state
  const [intakeSearch, setIntakeSearch] = useState("");
  const [intakeStatusFilter, setIntakeStatusFilter] = useState<
    "all" | "accepted" | "rejected" | "test"
  >("all");
  const [intakeFiltersOpen, setIntakeFiltersOpen] = useState(false);
  const [intakeSort, setIntakeSort] = useState<"newest" | "oldest">("newest");
  const [logsSearch, setLogsSearch] = useState("");
  const [logsFiltersOpen, setLogsFiltersOpen] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const [logsPageSize, setLogsPageSize] = useState(25);
  const [intakePage, setIntakePage] = useState(1);
  const [intakePageSize, setIntakePageSize] = useState(25);
  const [selectedIntakeLog, setSelectedIntakeLog] =
    useState<IntakeLogItem | null>(null);

  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) => {
    setExpandedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Data fetching (stable SWR keys — never null so cache is preserved
  //    across admin tab switches, no reload flash) ──────────────────────────────

  const {
    data: users = [],
    isLoading: usersLoading,
    mutate: refreshUsers,
  } = useSWR<CognitoUser[]>(
    "admin:users",
    async () => {
      try {
        const res = await listUsers();
        return (res as any)?.data || [];
      } catch (error) {
        console.warn("Users listing not available", error);
        return [] as CognitoUser[];
      }
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      keepPreviousData: true,
    },
  );

  const {
    data: credentials = [],
    isLoading: credsLoading,
    mutate: refreshCreds,
  } = useSWR<CredentialRecord[]>(
    "admin:credentials",
    async () => {
      try {
        const res = await listCredentials();
        return (res as any)?.data?.items || (res as any)?.data || [];
      } catch (err) {
        console.warn("Credentials listing not available", err);
        return [] as CredentialRecord[];
      }
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      keepPreviousData: true,
    },
  );

  const {
    data: schemas = [],
    isLoading: schemasLoading,
    mutate: refreshSchemas,
  } = useSWR<CredentialSchemaRecord[]>(
    "admin:credential-schemas",
    async () => {
      try {
        const res = await listCredentialSchemas();
        return (res as any)?.data?.items || (res as any)?.data || [];
      } catch (err) {
        console.warn("Credential schemas not available", err);
        return [] as CredentialSchemaRecord[];
      }
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      keepPreviousData: true,
    },
  );

  const {
    data: pluginSettings = [],
    isLoading: pluginSettingsLoading,
    mutate: refreshPluginSettings,
  } = useSWR<PluginView[]>(
    "admin:plugin-settings",
    async () => {
      try {
        const res = await listPluginSettings();
        const raw = (res as any)?.data;
        return Array.isArray(raw) ? raw : [];
      } catch (err) {
        console.warn("Plugin settings not available", err);
        return [] as PluginView[];
      }
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      keepPreviousData: true,
    },
  );

  // Activity log SWR — always stable key; entity/actor filtering done client-side
  const {
    data: logsRaw = [],
    isLoading: logsLoading,
    mutate: refreshLogs,
  } = useSWR<AuditLogItem[]>(
    "admin:audit-logs-all",
    async () => {
      try {
        const res = await getFullAuditLog({ limit: 200 });
        return res?.data?.items ?? [];
      } catch (err) {
        console.warn("Audit activity not available", err);
        return [] as AuditLogItem[];
      }
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      keepPreviousData: true,
      refreshInterval: 30_000,
    },
  );

  // Intake logs SWR — stable key
  const {
    data: intakeLogsRaw = [],
    isLoading: intakeLogsLoading,
    mutate: refreshIntakeLogs,
  } = useSWR<IntakeLogItem[]>(
    "admin:intake-logs",
    async () => {
      try {
        const res = await getIntakeLogs({ limit: 100 });
        return res?.data ?? [];
      } catch (err) {
        console.warn("Intake logs not available", err);
        return [] as IntakeLogItem[];
      }
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      keepPreviousData: true,
      refreshInterval: 30_000,
    },
  );

  // Client-side filtering by entity type and actor
  const logsActorFiltered = useMemo(() => {
    let items = logsRaw;
    if (logsEntityType) {
      items = items.filter((item) => item.entity_type === logsEntityType);
    }
    if (logsActorSub) {
      items = items.filter((item) => item.actor?.sub === logsActorSub);
    }
    return items;
  }, [logsRaw, logsEntityType, logsActorSub]);

  const logsSearched = useMemo(() => {
    if (!logsSearch.trim()) return logsActorFiltered;
    const q = logsSearch.toLowerCase();
    return logsActorFiltered.filter((item) => {
      const actor = resolveAuditActor(item.actor).toLowerCase();
      const action = item.action.toLowerCase();
      const entityType = item.entity_type.toLowerCase();
      const entityId = item.entity_id.toLowerCase();
      const changesText = item.changes
        .map((c) => `${c.field} ${String(c.from ?? "")} ${String(c.to ?? "")}`)
        .join(" ")
        .toLowerCase();
      return (
        actor.includes(q) ||
        action.includes(q) ||
        entityType.includes(q) ||
        entityId.includes(q) ||
        changesText.includes(q)
      );
    });
  }, [logsActorFiltered, logsSearch]);

  const logsItems = useMemo(() => {
    const sorted = [...logsSearched].sort((a, b) => {
      const ta = a.changed_at ? new Date(a.changed_at).getTime() : 0;
      const tb = b.changed_at ? new Date(b.changed_at).getTime() : 0;
      return logsSort === "oldest" ? ta - tb : tb - ta;
    });
    return sorted;
  }, [logsSearched, logsSort]);

  const deletedEntityIds = useMemo(() => {
    const lastAction = new Map<string, string>();
    const byTime = [...logsRaw].sort(
      (a, b) =>
        new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime(),
    );
    for (const item of byTime) lastAction.set(item.entity_id, item.action);
    const deleted = new Set<string>();
    lastAction.forEach((action, id) => {
      if (action === "deleted" || action === "soft_deleted") deleted.add(id);
    });
    logsRaw.forEach((item) => {
      if (
        item.entity_type === "credential" &&
        !credentials.find((c) => c.id === item.entity_id)
      )
        deleted.add(item.entity_id);
      if (
        item.entity_type === "credential_schema" &&
        !schemas.find((s) => s.id === item.entity_id)
      )
        deleted.add(item.entity_id);
    });
    return deleted;
  }, [logsRaw, credentials, schemas]);

  const credentialIdMap = useMemo(() => {
    const map = new Map<string, string>();
    credentials.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [credentials]);

  const credentialProviderMap = useMemo(() => {
    const displayByProvider: Record<string, string> = {
      ipqs: "IPQS",
      trusted_form: "TrustedForm",
    };
    const map = new Map<string, string>();
    credentials.forEach((c) => {
      map.set(
        c.id,
        displayByProvider[c.provider] ?? normalizeFieldLabel(c.provider),
      );
    });
    return map;
  }, [credentials]);

  const logsUniqueActors = useMemo(() => {
    const map = new Map<string, { sub: string; name: string }>();
    logsRaw.forEach((item) => {
      if (item.actor?.sub) {
        map.set(item.actor.sub, {
          sub: item.actor.sub,
          name: resolveAuditActor(item.actor),
        });
      }
    });
    return Array.from(map.values());
  }, [logsRaw]);

  const showSchemasLoading = schemasLoading && schemas.length === 0;
  const showPluginSettingsLoading =
    (pluginSettingsLoading && pluginSettings.length === 0) ||
    (credsLoading && credentials.length === 0);
  const showLogsLoading = logsLoading && logsRaw.length === 0;
  const showIntakeLogsLoading = intakeLogsLoading && intakeLogsRaw.length === 0;

  // Intake logs filtering
  const filteredIntakeLogs = useMemo(() => {
    let items = intakeLogsRaw;
    if (intakeStatusFilter !== "all") {
      items = items.filter((item) => item.status === intakeStatusFilter);
    }
    if (intakeSearch.trim()) {
      const q = intakeSearch.toLowerCase();
      items = items.filter((item) => {
        if (item.id?.toLowerCase().includes(q)) return true;
        if (item.raw_body) {
          try {
            return JSON.stringify(item.raw_body).toLowerCase().includes(q);
          } catch {
            return false;
          }
        }
        return false;
      });
    }

    return [...items].sort((a, b) => {
      const ta = a.received_at ? new Date(a.received_at).getTime() : 0;
      const tb = b.received_at ? new Date(b.received_at).getTime() : 0;
      return intakeSort === "oldest" ? ta - tb : tb - ta;
    });
  }, [intakeLogsRaw, intakeStatusFilter, intakeSearch, intakeSort]);

  const intakeStatusCounts = useMemo(() => {
    return {
      all: intakeLogsRaw.length,
      accepted: intakeLogsRaw.filter((i) => i.status === "accepted").length,
      rejected: intakeLogsRaw.filter((i) => i.status === "rejected").length,
      test: intakeLogsRaw.filter((i) => i.status === "test").length,
    };
  }, [intakeLogsRaw]);

  useEffect(() => {
    setLogsPage(1);
  }, [logsSearch, logsEntityType, logsActorSub, logsSort, logsPageSize]);

  useEffect(() => {
    setIntakePage(1);
  }, [intakeSearch, intakeStatusFilter, intakeSort, intakePageSize]);

  const logsTotalPages = Math.max(
    1,
    Math.ceil(logsItems.length / logsPageSize),
  );
  const logsPageStart = (logsPage - 1) * logsPageSize;
  const paginatedLogs = logsItems.slice(
    logsPageStart,
    logsPageStart + logsPageSize,
  );
  const logsShowingFrom = logsItems.length === 0 ? 0 : logsPageStart + 1;
  const logsShowingTo = Math.min(
    logsPageStart + logsPageSize,
    logsItems.length,
  );

  const intakeTotalPages = Math.max(
    1,
    Math.ceil(filteredIntakeLogs.length / intakePageSize),
  );
  const intakePageStart = (intakePage - 1) * intakePageSize;
  const paginatedIntakeLogs = filteredIntakeLogs.slice(
    intakePageStart,
    intakePageStart + intakePageSize,
  );
  const intakeShowingFrom =
    filteredIntakeLogs.length === 0 ? 0 : intakePageStart + 1;
  const intakeShowingTo = Math.min(
    intakePageStart + intakePageSize,
    filteredIntakeLogs.length,
  );

  useEffect(() => {
    if (logsPage > logsTotalPages) {
      setLogsPage(logsTotalPages);
    }
  }, [logsPage, logsTotalPages]);

  useEffect(() => {
    if (intakePage > intakeTotalPages) {
      setIntakePage(intakeTotalPages);
    }
  }, [intakePage, intakeTotalPages]);

  // ── User handlers ────────────────────────────────────────────────────────────

  const filteredUsers = useMemo(() => {
    const list = showDisabled
      ? users
      : users.filter((u) => u.enabled !== false);
    if (!userSearch.trim()) return list;
    const q = userSearch.toLowerCase();
    return list.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.firstName?.toLowerCase().includes(q) ||
        u.lastName?.toLowerCase().includes(q),
    );
  }, [users, userSearch, showDisabled]);

  const onCreateUser = async (payload: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    role: "admin" | "staff";
  }) => {
    await toast.promise(
      (async () => {
        const res = await createUser(payload);
        if (!(res as any)?.success)
          throw new Error((res as any)?.message || "Unable to create user");
        await refreshUsers();
        setUserCreateModal(false);
      })(),
      {
        loading: "Creating user…",
        success: "User created",
        error: (err) => err?.message || "Unable to create user",
      },
    );
  };

  // ── Render helpers ───────────────────────────────────────────────────────────

  const settingsNavItems: {
    key: SettingsSectionKey;
    label: string;
    group: "integrations" | "users";
    indent?: boolean;
    icon?: React.ReactNode;
  }[] = [
    {
      key: "saved-credentials",
      label: "Credentials",
      group: "integrations",
      icon: <KeyRound size={14} />,
    },
    {
      key: "schemas",
      label: "Schemas",
      group: "integrations",
      indent: true,
      icon: <LayoutTemplate size={14} />,
    },
    {
      key: "plugin-settings",
      label: "Integrations",
      group: "integrations",
      icon: <Plug size={14} />,
    },
    {
      key: "users",
      label: "Manage",
      group: "users",
      icon: <UserCog size={14} />,
    },
  ];

  const logsNavItems: {
    key: LogsSectionKey;
    label: string;
    icon: React.ReactNode;
  }[] = [
    { key: "activity", label: "Activity", icon: <Activity size={14} /> },
    { key: "intake", label: "Intake", icon: <ScrollText size={14} /> },
  ];

  const SettingsNavBtn = ({
    item,
  }: {
    item: (typeof settingsNavItems)[number];
  }) => (
    <button
      key={item.key}
      type="button"
      onClick={() => setActiveSection(item.key)}
      className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${item.indent ? "pl-6" : ""} ${
        activeSection === item.key
          ? "bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] text-[--color-primary] font-medium"
          : "text-[--color-text-muted] hover:bg-[--color-bg-muted] hover:text-[--color-text]"
      }`}
    >
      <span className="flex items-center gap-2">
        {item.indent && (
          <span className="text-[--color-text-muted] opacity-50">└</span>
        )}
        {item.icon && <span className="shrink-0 opacity-70">{item.icon}</span>}
        {item.label}
      </span>
    </button>
  );

  const LogsNavBtn = ({ item }: { item: (typeof logsNavItems)[number] }) => (
    <button
      key={item.key}
      type="button"
      onClick={() => setLogsSection(item.key)}
      className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${
        logsSection === item.key
          ? "bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] text-[--color-primary] font-medium"
          : "text-[--color-text-muted] hover:bg-[--color-bg-muted] hover:text-[--color-text]"
      }`}
    >
      <span className="flex items-center gap-2">
        {item.icon && <span className="shrink-0 opacity-70">{item.icon}</span>}
        {item.label}
      </span>
    </button>
  );

  const integrationItems = settingsNavItems.filter(
    (i) => i.group === "integrations",
  );
  const userItems = settingsNavItems.filter((i) => i.group === "users");

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* ── Secondary nav: Settings | Logs ──────────────────────────────────── */}
      <div className="flex items-center gap-1 p-1 rounded-xl border border-[--color-border] bg-[--color-panel] w-fit">
        {(
          [
            {
              key: "settings" as const,
              label: "Settings",
              icon: <Settings2 size={14} />,
            },
            {
              key: "logs" as const,
              label: "Logs",
              icon: <Activity size={14} />,
            },
          ] satisfies {
            key: AdminPrimaryTab;
            label: string;
            icon: React.ReactNode;
          }[]
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setAdminTab(tab.key)}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              adminTab === tab.key
                ? "bg-[--color-primary] text-white shadow-sm"
                : "text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-bg-muted]"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Two-column layout: left sidebar nav + right content ────────────── */}
      <div className="flex gap-6 items-start">
        {/* ── Left sidebar nav ──────────────────────────────────────────────── */}
        <nav className="w-[188px] shrink-0 rounded-xl border border-[--color-border] bg-[--color-panel] p-2 space-y-0.5">
          <AnimatePresence mode="wait" initial={false}>
            {adminTab === "settings" && (
              <motion.div
                key="settings-nav"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="space-y-0.5"
              >
                <p className="px-3 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-widest text-[--color-text-muted]">
                  Integrations
                </p>
                {integrationItems.map((item) => (
                  <SettingsNavBtn key={item.key} item={item} />
                ))}
                {userItems.length > 0 && (
                  <>
                    <div className="mx-1 my-1.5 border-t border-[--color-border]" />
                    <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[--color-text-muted]">
                      Users
                    </p>
                    {userItems.map((item) => (
                      <SettingsNavBtn key={item.key} item={item} />
                    ))}
                  </>
                )}
              </motion.div>
            )}
            {adminTab === "logs" && (
              <motion.div
                key="logs-nav"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="space-y-0.5"
              >
                <p className="px-3 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-widest text-[--color-text-muted]">
                  Logs
                </p>
                {logsNavItems.map((item) => (
                  <LogsNavBtn key={item.key} item={item} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </nav>

        {/* ── Right content ─────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            {/* ── Saved Credentials ── */}
            {adminTab === "settings" &&
              activeSection === "saved-credentials" && (
                <motion.div
                  key="saved-credentials"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-[--color-text-muted]">
                      Saved API credentials used by integrations.
                    </p>
                    <Button
                      iconLeft={<PlusCircle size={16} />}
                      onClick={() => setAddCredModal(true)}
                    >
                      Add Credential
                    </Button>
                  </div>
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
                        key: "provider",
                        label: "Provider",
                        render: (c) => (
                          <span className="font-mono text-xs">
                            {c.provider}
                          </span>
                        ),
                      },
                      {
                        key: "credential_type",
                        label: "Type",
                        render: (c) => (
                          <Badge tone="info">{c.credential_type}</Badge>
                        ),
                      },
                      {
                        key: "enabled",
                        label: "Status",
                        render: (c) => (
                          <Badge tone={c.enabled ? "success" : "neutral"}>
                            {c.enabled ? "Active" : "Disabled"}
                          </Badge>
                        ),
                      },
                      {
                        key: "updated_at",
                        label: "Last Updated",
                        render: (c) => (
                          <div className="flex items-center">
                            <span>
                              {c.updated_at ? formatDate(c.updated_at) : "—"}
                            </span>
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
                        render: (c) => (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setViewCredTarget(c)}
                          >
                            View
                          </Button>
                        ),
                      },
                    ]}
                    data={credentials}
                    emptyLabel={
                      credsLoading
                        ? "Loading credentials…"
                        : "No credentials saved yet."
                    }
                  />
                </motion.div>
              )}

            {/* ── Schemas ── */}
            {adminTab === "settings" && activeSection === "schemas" && (
              <motion.div
                key="schemas"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm text-[--color-text-muted]">
                    Schemas define the fields an integration needs when storing
                    a credential.
                  </p>
                  <Button
                    iconLeft={<Plug size={16} />}
                    onClick={() => setAddSchemaModal(true)}
                  >
                    Add Schema
                  </Button>
                </div>
                {showSchemasLoading ? (
                  <p className="text-sm text-[--color-text-muted]">
                    Loading schemas…
                  </p>
                ) : schemas.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[--color-border] bg-[--color-panel] p-12 text-center text-[--color-text-muted]">
                    <p className="text-3xl mb-3">🔌</p>
                    <p className="font-medium text-[--color-text-strong]">
                      No credential schemas yet
                    </p>
                    <p className="mt-1 text-sm">
                      Create a schema to define which fields a third-party
                      integration needs.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {schemas.map((s) => (
                      <div
                        key={s.id}
                        className="rounded-xl border border-[--color-border] bg-[--color-panel] p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-[--color-text-strong]">
                              {s.name}
                            </p>
                            <p className="text-xs font-mono text-[--color-text-muted]">
                              {s.provider}
                            </p>
                          </div>
                          <Badge tone="info">{s.credential_type}</Badge>
                        </div>
                        {s.fields.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                              Fields ({s.fields.length})
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {s.fields.map((f) => (
                                <span
                                  key={f.name}
                                  className="inline-flex items-center gap-1 rounded-md border border-[--color-border] bg-[--color-bg-muted] px-2 py-0.5 text-xs text-[--color-text]"
                                >
                                  <span className="font-mono">{f.name}</span>
                                  {f.required && (
                                    <span className="text-[--color-danger]">
                                      *
                                    </span>
                                  )}
                                  <span className="text-[--color-text-muted]">
                                    ({f.type})
                                  </span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            {s.updated_at ? (
                              <p className="text-xs text-[--color-text-muted]">
                                Updated {formatDate(s.updated_at)}
                              </p>
                            ) : (
                              <span />
                            )}
                            <AuditPopover
                              createdBy={s.created_by}
                              updatedBy={s.updated_by}
                              updatedAt={s.updated_at}
                              createdAt={s.created_at}
                              entityId={s.id}
                            />
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setViewSchemaTarget(s)}
                          >
                            Actions
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Plugin Settings ── */}
            {adminTab === "settings" && activeSection === "plugin-settings" && (
              <motion.div
                key="plugin-settings"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="space-y-4"
              >
                <p className="text-sm text-[--color-text-muted]">
                  Manage global plugin settings — enable or disable each
                  integration system-wide and assign which saved credential it
                  should use.
                </p>
                {showPluginSettingsLoading ? (
                  <p className="text-sm text-[--color-text-muted]">Loading…</p>
                ) : pluginSettings.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[--color-border] bg-[--color-panel] p-12 text-center text-[--color-text-muted]">
                    <p className="text-3xl mb-3">🔌</p>
                    <p className="font-medium text-[--color-text-strong]">
                      No plugins available
                    </p>
                    <p className="mt-1 text-sm">
                      Plugin registry could not be loaded.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {pluginSettings.map((plugin) => {
                      const wiredCred = plugin.credentials_id
                        ? credentials.find(
                            (c) => c.id === plugin.credentials_id,
                          )
                        : null;
                      return (
                        <div
                          key={plugin.provider}
                          className="rounded-xl border border-[--color-border] bg-[--color-panel] p-4 space-y-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1">
                                <p className="font-semibold text-[--color-text-strong]">
                                  {plugin.name}
                                </p>
                                <AuditPopover
                                  createdBy={plugin.created_by}
                                  updatedBy={plugin.updated_by}
                                  updatedAt={plugin.updated_at}
                                  createdAt={plugin.created_at}
                                  entityId={plugin.id || undefined}
                                />
                              </div>
                              <p className="text-xs font-mono text-[--color-text-muted]">
                                {plugin.provider}
                              </p>
                              {plugin.description && (
                                <p className="mt-0.5 text-xs text-[--color-text-muted]">
                                  {plugin.description}
                                </p>
                              )}
                            </div>
                            <Badge tone="info">{plugin.credential_type}</Badge>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="space-y-0.5">
                              <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                                Credential
                              </p>
                              {wiredCred ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-[--color-border] bg-[--color-bg-muted] px-2.5 py-1 text-xs text-[--color-text]">
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${
                                      plugin.enabled && wiredCred.enabled
                                        ? "bg-green-500"
                                        : plugin.enabled && !wiredCred.enabled
                                          ? "bg-amber-400"
                                          : "bg-red-400"
                                    }`}
                                  />
                                  {wiredCred.name}
                                </span>
                              ) : (
                                <span className="text-xs text-[--color-text-muted] italic">
                                  No credential assigned
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                  plugin.enabled
                                    ? "bg-[--color-surface-raised] border border-[--color-border] text-[--color-text]"
                                    : "bg-[--color-bg-muted] text-[--color-text-muted]"
                                }`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${plugin.enabled ? "bg-teal-500" : "bg-[--color-text-muted]"}`}
                                />
                                {plugin.enabled ? "Enabled" : "Disabled"}
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setViewPluginTarget(plugin)}
                              >
                                Configure
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Users ── */}
            {adminTab === "settings" && activeSection === "users" && (
              <motion.div
                key="users"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-[--color-text-muted]">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[--color-primary]"
                      checked={showDisabled}
                      onChange={(e) => setShowDisabled(e.target.checked)}
                    />
                    Show deactivated users
                  </label>
                  <Button
                    iconLeft={<UserPlus size={16} />}
                    onClick={() => setUserCreateModal(true)}
                  >
                    Add User
                  </Button>
                </div>
                <input
                  className={inputClass}
                  placeholder="Search by name or email…"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
                <Table
                  columns={[
                    {
                      key: "email",
                      label: "Email",
                      render: (u) => (
                        <span
                          className={`font-medium ${u.enabled === false ? "text-[--color-text-muted] line-through" : "text-[--color-text-strong]"}`}
                        >
                          {u.email}
                        </span>
                      ),
                    },
                    {
                      key: "name",
                      label: "Name",
                      render: (u) =>
                        [u.firstName, u.lastName].filter(Boolean).join(" ") ||
                        "—",
                    },
                    {
                      key: "role",
                      label: "Role",
                      render: (u) => (
                        <Badge tone={u.role === "admin" ? "info" : "neutral"}>
                          {u.role}
                        </Badge>
                      ),
                    },
                    {
                      key: "status",
                      label: "Status",
                      render: (u) => (
                        <Badge
                          tone={u.enabled !== false ? "success" : "danger"}
                        >
                          {u.enabled !== false
                            ? u.status || "Confirmed"
                            : "Deactivated"}
                        </Badge>
                      ),
                    },
                    {
                      key: "createdAt",
                      label: "Created",
                      render: (u) =>
                        u.createdAt ? formatDate(u.createdAt) : "—",
                    },
                    {
                      key: "actions",
                      label: "Actions",
                      render: (u) => (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setViewUserTarget(u)}
                        >
                          Manage
                        </Button>
                      ),
                    },
                  ]}
                  data={filteredUsers}
                  emptyLabel={
                    usersLoading ? "Loading users…" : "No users found."
                  }
                />
              </motion.div>
            )}

            {/* ── Activity Log ── */}
            {adminTab === "logs" && logsSection === "activity" && (
              <motion.div
                key="activity-logs"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="space-y-3"
              >
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-1.5">
                      <Activity
                        size={16}
                        strokeWidth={2.5}
                        className="text-[--color-primary]"
                      />
                      <span className="font-semibold text-[--color-text-strong]">
                        Activity Log
                      </span>
                    </div>
                    {!logsLoading && logsItems.length > 0 && (
                      <span className="rounded-full bg-[--color-bg-muted] px-2.5 py-0.5 text-xs font-medium text-[--color-text-muted]">
                        {logsItems.length} events
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => refreshLogs()}
                      title="Refresh logs"
                      className="flex items-center justify-center rounded-lg border border-[--color-border] bg-[--color-panel] p-1.5 text-[--color-text-muted] transition hover:text-[--color-text]"
                    >
                      <RefreshCw size={13} />
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-[--color-border] bg-[--color-panel] p-3 space-y-3">
                  <div className="relative">
                    <Search
                      size={15}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[--color-text-muted]"
                    />
                    <input
                      className={`${inputClass} pl-9`}
                      placeholder="Search user, action, entity id, or changed values…"
                      value={logsSearch}
                      onChange={(e) => setLogsSearch(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setLogsFiltersOpen((v) => !v)}
                      className="inline-flex items-center gap-2 rounded-lg border border-[--color-border] bg-[--color-bg-muted] px-3 py-1.5 text-sm font-medium text-[--color-text] transition hover:bg-[--color-bg]"
                    >
                      <SlidersHorizontal size={14} />
                      Filter and sort
                      <ChevronDown
                        size={14}
                        className={`transition-transform ${logsFiltersOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setLogsSearch("");
                          setExpandedLogIds(new Set());
                          setLogsEntityTypeState("");
                          setLogsActorSubState("");
                          setLogsSortState("newest");
                          setSettingsParams({
                            logs_entity: undefined,
                            logs_actor: undefined,
                            logs_sort: undefined,
                          });
                        }}
                        className="rounded-lg border border-[--color-border] px-2.5 py-1.5 text-xs font-medium text-[--color-text-muted] transition hover:text-[--color-text] hover:bg-[--color-bg-muted]"
                      >
                        Clear all
                      </button>
                    </div>
                  </div>

                  <AnimatePresence initial={false}>
                    {logsFiltersOpen && (
                      <motion.div
                        key="activity-filters"
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
                                User
                              </span>
                              <select
                                className="rounded-lg border border-[--color-border] bg-[--color-panel] px-2.5 py-1.5 text-sm text-[--color-text] outline-none transition focus:border-[--color-primary]"
                                value={logsActorSub}
                                onChange={(e) => {
                                  setLogsActorSubState(e.target.value || "");
                                  setSettingsParams({
                                    logs_actor: e.target.value || undefined,
                                  });
                                }}
                                disabled={logsUniqueActors.length === 0}
                              >
                                <option value="">All</option>
                                {logsUniqueActors.map((a) => (
                                  <option key={a.sub} value={a.sub}>
                                    {a.name}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <label className="flex items-center gap-1.5">
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
                                Sort
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const nextSort =
                                    logsSort === "newest" ? "oldest" : "newest";
                                  setLogsSortState(nextSort);
                                  setSettingsParams({
                                    logs_sort:
                                      nextSort === "newest"
                                        ? undefined
                                        : nextSort,
                                  });
                                }}
                                className="flex items-center gap-1.5 rounded-lg border border-[--color-border] bg-[--color-panel] px-2.5 py-1.5 text-sm text-[--color-text] transition hover:bg-[--color-bg-muted] w-24 justify-start"
                              >
                                {logsSort === "newest" ? (
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
                                {logsSort === "newest" ? "Newest" : "Oldest"}
                              </button>
                            </label>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { value: "", label: "All" },
                              { value: "lead", label: "Lead" },
                              { value: "campaign", label: "Campaign" },
                              { value: "client", label: "Client" },
                              { value: "affiliate", label: "Affiliate" },
                              { value: "credential", label: "Credential" },
                              { value: "credential_schema", label: "Schema" },
                              { value: "plugin_setting", label: "Integration" },
                              { value: "user", label: "User" },
                            ].map(({ value, label }) => {
                              const meta = value
                                ? getEntityTypeMeta(value)
                                : null;
                              const isActive = logsEntityType === value;
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => {
                                    setExpandedLogIds(new Set());
                                    setLogsEntityTypeState(value || "");
                                    setLogsActorSubState("");
                                    setSettingsParams({
                                      logs_entity: value || undefined,
                                      logs_actor: undefined,
                                    });
                                  }}
                                  className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                                    isActive
                                      ? "bg-[--color-primary] text-[--color-bg]"
                                      : "border border-[--color-border] bg-[--color-panel] text-[--color-text-muted] hover:bg-[--color-bg-muted] hover:text-[--color-text]"
                                  }`}
                                >
                                  {meta && (
                                    <span className="opacity-80">
                                      {meta.icon}
                                    </span>
                                  )}
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Activity list */}
                <div className="relative overflow-hidden rounded-xl border border-[--color-border] bg-[--color-panel]">
                  <AnimatePresence mode="wait">
                    {showLogsLoading ? (
                      <motion.div
                        key="logs-loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center justify-center py-12"
                      >
                        <p className="text-sm text-[--color-text-muted]">
                          Loading logs…
                        </p>
                      </motion.div>
                    ) : logsItems.length === 0 ? (
                      <motion.div
                        key="logs-empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="py-12 text-center"
                      >
                        <p className="text-sm font-medium text-[--color-text-muted]">
                          No activity found
                        </p>
                        <p className="mt-1 text-xs text-[--color-text-muted]">
                          Try adjusting your filters.
                        </p>
                      </motion.div>
                    ) : (
                      <motion.div
                        key={`logs-list-${logsEntityType}-${logsActorSub}-${logsSort}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.12 }}
                        className="divide-y divide-[--color-border]"
                      >
                        {paginatedLogs.map((item) => {
                          const meta = getEntityTypeMeta(item.entity_type);
                          const isExpanded = expandedLogIds.has(item.log_id);
                          const hasChanges = item.changes.length > 0;
                          const credentialName =
                            item.entity_type === "credential"
                              ? credentialIdMap.get(item.entity_id)
                              : undefined;
                          const credentialProvider =
                            item.entity_type === "credential"
                              ? credentialProviderMap.get(item.entity_id)
                              : undefined;
                          return (
                            <div key={item.log_id}>
                              <button
                                type="button"
                                onClick={() =>
                                  hasChanges && toggleExpanded(item.log_id)
                                }
                                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                                  hasChanges
                                    ? "cursor-pointer hover:bg-[--color-bg-muted]"
                                    : "cursor-default"
                                } ${isExpanded ? "bg-[--color-bg-muted]" : ""}`}
                              >
                                <span className="w-44 shrink-0 text-[11px] text-[--color-text-muted]">
                                  {formatLogDate(item.changed_at)}
                                </span>
                                <span className="w-24 shrink-0">
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.color}`}
                                  >
                                    {meta.icon}
                                    {meta.label}
                                  </span>
                                </span>
                                <span className="w-36 shrink-0 truncate text-sm font-medium text-[--color-text]">
                                  {resolveAuditActor(item.actor)}
                                </span>
                                <span className="flex flex-1 items-center gap-1.5 truncate text-sm text-[--color-text-muted]">
                                  {item.entity_type === "credential" &&
                                  item.action === "updated"
                                    ? "Updated Credentials"
                                    : auditActionLabel(item.action)}
                                  {deletedEntityIds.has(item.entity_id) ? (
                                    <HoverTooltip message="This record has been deleted and is no longer accessible.">
                                      <span className="shrink-0 cursor-default font-mono text-[11px] text-[--color-text-muted] line-through opacity-50">
                                        ({item.entity_id})
                                      </span>
                                    </HoverTooltip>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openAuditEntity(
                                          item.entity_type,
                                          item.entity_id,
                                          item.action,
                                        );
                                      }}
                                      className="shrink-0 font-mono text-[11px] text-[--color-primary] hover:underline"
                                    >
                                      ({item.entity_id})
                                    </button>
                                  )}
                                </span>
                                {hasChanges && (
                                  <ChevronDown
                                    size={14}
                                    className={`shrink-0 text-[--color-text-muted] transition-transform duration-150 ${
                                      isExpanded ? "rotate-180" : ""
                                    }`}
                                  />
                                )}
                              </button>
                              {isExpanded && hasChanges && (
                                <div className="border-t border-[--color-border] bg-[--color-bg-muted] px-4 py-3">
                                  <div className="space-y-2 pl-2">
                                    {(() => {
                                      const isLogicRuleEvent =
                                        item.action.startsWith("logic_rule");
                                      const isMappingsEvent =
                                        item.action === "mappings_updated";
                                      const isPluginsEvent =
                                        item.action === "plugins_updated";

                                      const filtered = item.changes
                                        .filter(
                                          (c) =>
                                            c.field !== "field_id" &&
                                            c.field !== "rule_id",
                                        )
                                        .filter((change) => {
                                          const fromObj =
                                            change.from !== null &&
                                            change.from !== undefined &&
                                            typeof change.from === "object" &&
                                            !Array.isArray(change.from);
                                          const toObj =
                                            change.to !== null &&
                                            change.to !== undefined &&
                                            typeof change.to === "object" &&
                                            !Array.isArray(change.to);
                                          return !(fromObj && toObj);
                                        });

                                      if (isMappingsEvent) {
                                        const arrayChange = filtered.find(
                                          (c) =>
                                            Array.isArray(c.from) ||
                                            Array.isArray(c.to),
                                        );
                                        const fromLen = Array.isArray(
                                          arrayChange?.from,
                                        )
                                          ? (arrayChange!.from as unknown[])
                                              .length
                                          : 0;
                                        const toLen = Array.isArray(
                                          arrayChange?.to,
                                        )
                                          ? (arrayChange!.to as unknown[])
                                              .length
                                          : 0;
                                        const summary =
                                          toLen > fromLen
                                            ? `${toLen - fromLen} mapping${toLen - fromLen !== 1 ? "s" : ""} added`
                                            : toLen < fromLen
                                              ? `${fromLen - toLen} mapping${fromLen - toLen !== 1 ? "s" : ""} removed`
                                              : `${toLen || filtered.length} mapping${(toLen || filtered.length) !== 1 ? "s" : ""} updated`;
                                        return (
                                          <div className="grid grid-cols-[8rem_1fr] items-start gap-2 text-[11px]">
                                            <span className="truncate font-medium text-[--color-text]">
                                              Value Mapping
                                            </span>
                                            <span className="text-[--color-text-muted]">
                                              {summary}
                                            </span>
                                          </div>
                                        );
                                      }

                                      return filtered.map((change, i) => {
                                        const fieldLower =
                                          change.field.toLowerCase();
                                        const isCondition =
                                          fieldLower.includes("condition");
                                        const isAddedValue =
                                          change.from == null &&
                                          change.to != null;

                                        if (isCondition) {
                                          const isAdded =
                                            fieldLower.endsWith(".added") ||
                                            (change.from == null &&
                                              change.to != null);
                                          const isRemoved =
                                            fieldLower.endsWith(".removed") ||
                                            (change.to == null &&
                                              change.from != null);
                                          const condVal = isAdded
                                            ? formatAuditValue(change.to)
                                            : isRemoved
                                              ? formatAuditValue(change.from)
                                              : null;
                                          return (
                                            <div
                                              key={`${item.log_id}-${i}`}
                                              className="grid grid-cols-[8rem_1fr] items-start gap-2 text-[11px]"
                                            >
                                              <span className="truncate font-medium text-[--color-text]">
                                                {isAdded
                                                  ? "Condition added"
                                                  : isRemoved
                                                    ? "Condition removed"
                                                    : "Condition changed"}
                                              </span>
                                              <span
                                                className={`font-medium ${
                                                  isAdded
                                                    ? "text-[--color-success]"
                                                    : isRemoved
                                                      ? "text-[--color-danger]"
                                                      : "text-[--color-text]"
                                                }`}
                                              >
                                                {condVal ??
                                                  `${formatAuditValue(change.from)} → ${formatAuditValue(change.to)}`}
                                              </span>
                                            </div>
                                          );
                                        }

                                        const complex =
                                          isComplexValue(change.from) ||
                                          isComplexValue(change.to);

                                        const rawField = change.field.replace(
                                          /^payload\./,
                                          "",
                                        );

                                        const pluginDisplayNames: Record<
                                          string,
                                          string
                                        > = {
                                          duplicate_check: "Duplicate Check",
                                          trusted_form: "TrustedForm",
                                          ipqs: "IPQS",
                                        };

                                        let fieldLabel: string;
                                        if (
                                          isPluginsEvent &&
                                          rawField.includes(".")
                                        ) {
                                          const dotIdx = rawField.indexOf(".");
                                          const pluginKey = rawField.slice(
                                            0,
                                            dotIdx,
                                          );
                                          const pluginPath = rawField
                                            .slice(dotIdx + 1)
                                            .split(".")
                                            .map((segment) =>
                                              normalizeFieldLabel(segment),
                                            )
                                            .join(" · ");
                                          const pluginName =
                                            pluginDisplayNames[pluginKey] ??
                                            normalizeFieldLabel(pluginKey);
                                          fieldLabel = `${pluginName} — ${pluginPath}`;
                                        } else {
                                          fieldLabel = normalizeFieldLabel(
                                            rawField.includes(".")
                                              ? rawField.split(".").pop()!
                                              : rawField,
                                          );
                                        }

                                        if (
                                          item.entity_type === "credential" &&
                                          rawField === "credentials"
                                        ) {
                                          fieldLabel = "Credentials";
                                        }

                                        return (
                                          <div
                                            key={`${item.log_id}-${i}`}
                                            className={`grid items-start gap-2 text-[11px] ${isPluginsEvent ? "grid-cols-[11rem_1fr]" : "grid-cols-[8rem_1fr]"}`}
                                          >
                                            <span className="truncate font-medium text-[--color-text]">
                                              {fieldLabel}
                                            </span>
                                            {complex ? (
                                              <span className="italic text-[11px] text-[--color-text-muted]">
                                                {item.entity_type ===
                                                  "credential" &&
                                                rawField === "credentials"
                                                  ? credentialProvider
                                                    ? `${credentialProvider} updated`
                                                    : "Credentials updated"
                                                  : Array.isArray(
                                                        change.from,
                                                      ) &&
                                                      Array.isArray(change.to)
                                                    ? change.to.length >
                                                      change.from.length
                                                      ? `Added ${change.to.length - change.from.length} item${change.to.length - change.from.length !== 1 ? "s" : ""}`
                                                      : change.to.length <
                                                          change.from.length
                                                        ? `Removed ${change.from.length - change.to.length} item${change.from.length - change.to.length !== 1 ? "s" : ""}`
                                                        : "Modified"
                                                    : "Updated"}
                                              </span>
                                            ) : isAddedValue ? (
                                              <span className="font-medium text-[--color-text]">
                                                {formatAuditValue(change.to)}
                                              </span>
                                            ) : (
                                              <span className="flex min-w-0 items-center gap-1.5 text-[--color-text-muted]">
                                                <span className="max-w-[160px] truncate line-through">
                                                  {formatAuditValue(
                                                    change.from,
                                                  )}
                                                </span>
                                                <ArrowRight
                                                  size={9}
                                                  className="shrink-0"
                                                />
                                                <span className="max-w-[160px] truncate font-medium text-[--color-text]">
                                                  {formatAuditValue(change.to)}
                                                </span>
                                              </span>
                                            )}
                                          </div>
                                        );
                                      });
                                    })()}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <PaginationControls
                  page={logsPage}
                  totalPages={logsTotalPages}
                  onPageChange={setLogsPage}
                  pageSize={logsPageSize}
                  onPageSizeChange={setLogsPageSize}
                  totalItems={logsItems.length}
                  showingFrom={logsShowingFrom}
                  showingTo={logsShowingTo}
                  itemLabel="activity events"
                />
              </motion.div>
            )}

            {/* ── Intake Logs ── */}
            {adminTab === "logs" && logsSection === "intake" && (
              <motion.div
                key="intake-logs"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="space-y-3"
              >
                {/* Header */}
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

                {/* Search + filter panel */}
                <div className="rounded-xl border border-[--color-border] bg-[--color-panel] p-3 space-y-3">
                  <div className="relative">
                    <Search
                      size={15}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[--color-text-muted]"
                    />
                    <input
                      className={`${inputClass} pl-9`}
                      placeholder="Search by lead ID or body content…"
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

                {/* Table */}
                {showIntakeLogsLoading ? (
                  <div className="rounded-xl border border-[--color-border] bg-[--color-panel] py-12 text-center">
                    <p className="text-sm text-[--color-text-muted]">
                      Loading intake logs…
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
                                  tone={
                                    isRejectedIntake(item)
                                      ? "danger"
                                      : "success"
                                  }
                                >
                                  {isRejectedIntake(item)
                                    ? "Rejected"
                                    : "Accepted"}
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
                                      onOpenCampaign(
                                        item.campaign_id!,
                                        "overview",
                                      );
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
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── User modals ─────────────────────────────────────────────────────── */}
      <CreateUserModal
        isOpen={userCreateModal}
        onClose={() => setUserCreateModal(false)}
        onSubmit={onCreateUser}
      />
      <UserDetailModal
        key={viewUserTarget?.username ?? "view-user"}
        isOpen={!!viewUserTarget}
        onClose={() => setViewUserTarget(null)}
        user={viewUserTarget}
        currentUserEmail={currentUserEmail}
        onSuccess={() => refreshUsers()}
      />

      {/* ── Credential modals ────────────────────────────────────────────────── */}
      <AddCredentialModal
        isOpen={addCredModal}
        onClose={() => setAddCredModal(false)}
        schemas={schemas}
        onSuccess={() => refreshCreds()}
      />
      <CredentialDetailModal
        key={viewCredTarget?.id ?? "view-cred"}
        isOpen={!!viewCredTarget}
        onClose={() => setViewCredTarget(null)}
        credential={viewCredTarget}
        schemas={schemas}
        pluginSettings={pluginSettings}
        onSuccess={() => refreshCreds()}
      />

      {/* ── Credential schema modals ─────────────────────────────────────────── */}
      <AddCredentialSchemaModal
        isOpen={addSchemaModal}
        onClose={() => setAddSchemaModal(false)}
        existingSchemas={schemas}
        onSuccess={() => refreshSchemas()}
      />
      <CredentialSchemaDetailModal
        key={viewSchemaTarget?.id ?? "view-schema"}
        isOpen={!!viewSchemaTarget}
        onClose={() => setViewSchemaTarget(null)}
        schema={viewSchemaTarget}
        linkedCredentials={credentials.filter(
          (c) =>
            c.provider === viewSchemaTarget?.provider &&
            c.credential_type === viewSchemaTarget?.credential_type,
        )}
        isWiredToPlugin={pluginSettings.some(
          (ps) =>
            ps.provider === viewSchemaTarget?.provider && !!ps.credentials_id,
        )}
        onSuccess={() => {
          refreshSchemas();
          refreshCreds();
        }}
      />
      <PluginSettingDetailModal
        key={viewPluginTarget?.provider ?? "view-plugin"}
        isOpen={!!viewPluginTarget}
        onClose={() => setViewPluginTarget(null)}
        plugin={viewPluginTarget}
        credentials={credentials}
        onSuccess={() => {
          refreshPluginSettings();
          refreshCreds();
        }}
      />

      {/* ── Intake log detail modal ───────────────────────────────────────────── */}
      <IntakeLogDetailModal
        item={selectedIntakeLog}
        onClose={() => setSelectedIntakeLog(null)}
        onOpenLead={onOpenLead}
      />
    </div>
  );
}
