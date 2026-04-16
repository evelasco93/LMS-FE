"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  ChevronRight,
  GitBranch,
  Hash,
  KeyRound,
  LayoutTemplate,
  ListOrdered,
  Megaphone,
  Plug,
  PlusCircle,
  Pencil,
  RefreshCw,
  Mail,
  Phone,
  ScrollText,
  Tag,
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
  listCriteriaCatalog,
  getCriteriaCatalogSet,
  createCriteriaCatalogSet,
  updateCriteriaCatalogSet,
  deleteCriteriaCatalogSet,
  deleteCriteriaCatalogVersion,
  listLogicCatalog,
  getLogicCatalogSet,
  createLogicCatalogSet,
  updateLogicCatalogSet,
  deleteLogicCatalogSet,
  deleteLogicCatalogVersion,
  getFullAuditLog,
  getIntakeLogs,
  listClients,
  listAffiliates,
  listTagDefinitions,
  createTagDefinition,
  updateTagDefinition,
  deleteTagDefinition,
  listPlatformPresets,
  listTenantPresets,
  createPlatformPreset,
  updatePlatformPreset,
  getPlatformPreset,
  createTenantPreset,
  updateTenantPreset,
  getTenantPreset,
} from "@/lib/api";
import { formatDate, inputClass, normalizeFieldLabel } from "@/lib/utils";
import { AuditPopover } from "@/components/ui/audit-popover";
import { HoverTooltip } from "@/components/ui/hover-tooltip";
import { getCurrentUser } from "@/lib/auth";
import type {
  AuditChange,
  Campaign,
  CampaignDetailTab,
  Client,
  Affiliate,
  CognitoUser,
  CredentialRecord,
  CredentialSchemaRecord,
  PluginView,
  CriteriaCatalogSet,
  CriteriaCatalogVersion,
  LogicCatalogSet,
  LogicCatalogVersion,
  AuditLogItem,
  AuditActor,
  IntakeLogItem,
  TagDefinitionRecord,
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
        label: "End User",
        color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      };
    case "affiliate":
      return {
        icon: <Users size={s} />,
        label: "Source",
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
    case "user_table_preference":
      return {
        icon: <SlidersHorizontal size={s} />,
        label: "Table Pref",
        color: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
      };
    case "user":
      return {
        icon: <UserCog size={s} />,
        label: "User",
        color: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
      };
    case "criteria_catalog":
      return {
        icon: <LayoutTemplate size={s} />,
        label: "Fields Preset",
        color: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
      };
    case "logic_catalog":
      return {
        icon: <GitBranch size={s} />,
        label: "Rules Preset",
        color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function formatAuditDetailValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    const maybeDate = new Date(value);
    if (!Number.isNaN(maybeDate.getTime()) && value.includes("T")) {
      return formatLogDate(value);
    }
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatActorLike(value: unknown): string {
  const actor = asRecord(value);
  if (!actor) return "System";
  return (
    (typeof actor.full_name === "string" && actor.full_name) ||
    (typeof actor.email === "string" && actor.email) ||
    (typeof actor.username === "string" && actor.username) ||
    "Unknown"
  );
}

function summarizeTablePreferenceConfig(value: unknown): string | null {
  const cfg = asRecord(value);
  if (!cfg) return null;

  const columns = Array.isArray(cfg.columns)
    ? (cfg.columns as Array<{ visible?: boolean }>).filter(
        (c) => c && typeof c === "object",
      )
    : [];
  const visibleCount = columns.filter((c) => c.visible !== false).length;

  const sortCount = Array.isArray(cfg.sort) ? cfg.sort.length : 0;
  const filterCount = Array.isArray(cfg.filters) ? cfg.filters.length : 0;

  return `${visibleCount}/${columns.length} columns visible, ${sortCount} sort rule${sortCount === 1 ? "" : "s"}, ${filterCount} filter setting${filterCount === 1 ? "" : "s"}`;
}

function renderAuditDetailRows(
  rows: Array<{
    label: string;
    value: unknown;
    tone?: "default" | "success" | "danger" | "warning";
  }>,
  keyPrefix: string,
): React.ReactNode {
  return rows
    .filter(
      (row) =>
        row.value !== undefined && row.value !== null && row.value !== "",
    )
    .map((row, idx) => (
      <div
        key={`${keyPrefix}-row-${idx}`}
        className="grid grid-cols-[9rem_1fr] items-start gap-2 text-[11px]"
      >
        <span className="truncate font-medium text-[--color-text]">
          {row.label}
        </span>
        <span
          className={
            row.tone === "success"
              ? "text-[--color-success]"
              : row.tone === "danger"
                ? "text-[--color-danger]"
                : row.tone === "warning"
                  ? "text-[--color-warning]"
                  : "text-[--color-text-muted]"
          }
        >
          {formatAuditDetailValue(row.value)}
        </span>
      </div>
    ));
}

function renderAuditPayloadBlock(
  label: string,
  value: unknown,
  key: string,
): React.ReactNode | null {
  if (value === undefined || value === null) return null;
  return (
    <div key={key} className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
        {label}
      </p>
      <pre className="max-h-40 overflow-auto rounded-md border border-[--color-border] bg-[--color-bg] p-2 text-[10px] leading-relaxed text-[--color-text]">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function renderLeadStructuredAuditChange(
  change: AuditChange,
  key: string,
): React.ReactNode | null {
  const field = change.field.replace(/^payload\./, "").toLowerCase();
  const root = asRecord(change.to) ?? asRecord(change.from);
  if (!root) return null;

  if (field === "affiliate_pixel_result") {
    const success = root.success === true;
    const errorMessage =
      typeof root.error === "string" ? root.error.toLowerCase() : "";
    const status = success
      ? "Fired"
      : errorMessage.includes("not fired") || errorMessage.includes("disabled")
        ? "Not fired"
        : "Failed";

    return (
      <div
        key={key}
        className="space-y-2 rounded-md border border-[--color-border] bg-[--color-panel] p-2.5"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
          Affiliate Pixel Result
        </p>
        <div className="space-y-1.5">
          {renderAuditDetailRows(
            [
              {
                label: "Status",
                value: status,
                tone: success
                  ? "success"
                  : status === "Not fired"
                    ? "warning"
                    : "danger",
              },
              { label: "Affiliate ID", value: root.affiliate_id },
              { label: "Campaign ID", value: root.campaign_id },
              { label: "Fired At", value: root.fired_at },
              { label: "Method", value: root.webhook_method },
              { label: "Configured URL", value: root.webhook_url },
              { label: "Final URL", value: root.final_webhook_url },
              { label: "HTTP Status", value: root.webhook_response_status },
              { label: "Error", value: root.error, tone: "danger" },
            ],
            key,
          )}
        </div>
        {renderAuditPayloadBlock(
          "Query Params Sent",
          root.sent_query_params,
          `${key}-query`,
        )}
        {renderAuditPayloadBlock(
          "Body Payload Sent",
          root.sent_body_payload,
          `${key}-body`,
        )}
        {renderAuditPayloadBlock(
          "Request Snapshot",
          root.sent_payload_snapshot,
          `${key}-request-snapshot`,
        )}
        {renderAuditPayloadBlock(
          "Webhook Response",
          root.webhook_response_body,
          `${key}-response`,
        )}
      </div>
    );
  }

  if (field === "delivery_result") {
    const accepted = root.accepted === true;
    return (
      <div
        key={key}
        className="space-y-2 rounded-md border border-[--color-border] bg-[--color-panel] p-2.5"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
          Delivery Result
        </p>
        <div className="space-y-1.5">
          {renderAuditDetailRows(
            [
              {
                label: "Accepted",
                value: accepted ? "Yes" : "No",
                tone: accepted ? "success" : "danger",
              },
              { label: "Client ID", value: root.client_id },
              { label: "Delivered At", value: root.delivered_at },
              { label: "Attempts", value: root.attempts },
              { label: "Method", value: root.webhook_method },
              { label: "Configured URL", value: root.webhook_url },
              { label: "Final URL", value: root.final_webhook_url },
              { label: "HTTP Status", value: root.webhook_response_status },
              { label: "Acceptance Match", value: root.acceptance_match },
              { label: "Error", value: root.error, tone: "danger" },
            ],
            key,
          )}
        </div>
        {renderAuditPayloadBlock(
          "Query Params Sent",
          root.sent_query_params,
          `${key}-query`,
        )}
        {renderAuditPayloadBlock(
          "Body Payload Sent",
          root.sent_body_payload,
          `${key}-body`,
        )}
        {renderAuditPayloadBlock(
          "Webhook Response",
          root.webhook_response_body,
          `${key}-response`,
        )}
      </div>
    );
  }

  if (field === "cherry_pick_meta") {
    const nestedDelivery = asRecord(root.delivery_result);
    return (
      <div
        key={key}
        className="space-y-2 rounded-md border border-[--color-border] bg-[--color-panel] p-2.5"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
          Cherry-Pick Details
        </p>
        <div className="space-y-1.5">
          {renderAuditDetailRows(
            [
              { label: "Target Client", value: root.target_client_id },
              { label: "Source Campaign", value: root.source_campaign_id },
              { label: "Executed At", value: root.executed_at },
              {
                label: "Executed By",
                value: formatActorLike(root.executed_by),
              },
              {
                label: "Delivery Accepted",
                value: nestedDelivery?.accepted === true ? "Yes" : "No",
                tone: nestedDelivery?.accepted === true ? "success" : "danger",
              },
              { label: "Delivery Client", value: nestedDelivery?.client_id },
              {
                label: "Delivery Method",
                value: nestedDelivery?.webhook_method,
              },
              {
                label: "Delivery URL",
                value:
                  asRecord(nestedDelivery?.sent_payload_snapshot)
                    ?.final_webhook_url ??
                  nestedDelivery?.final_webhook_url ??
                  nestedDelivery?.webhook_url,
              },
              {
                label: "Delivery Error",
                value: nestedDelivery?.error,
                tone: "danger",
              },
            ],
            key,
          )}
        </div>
        {renderAuditPayloadBlock(
          "Delivery Query Params",
          nestedDelivery?.sent_query_params,
          `${key}-query`,
        )}
        {renderAuditPayloadBlock(
          "Delivery Body Payload",
          nestedDelivery?.sent_body_payload,
          `${key}-body`,
        )}
        {renderAuditPayloadBlock(
          "Delivery Request Snapshot",
          nestedDelivery?.sent_payload_snapshot,
          `${key}-request-snapshot`,
        )}
      </div>
    );
  }

  return null;
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
type CatalogTabKey = "criteria" | "logic" | "lists";

type ListPreset = {
  id: string;
  name: string;
  scope: "platform" | "tenant";
  optionCount: number;
  options: { value: string; label: string }[];
};
type FieldPreset = {
  id: string;
  name: string;
  description?: string;
  locked?: boolean;
  fields: {
    field_label: string;
    field_name: string;
    data_type: string;
    required: boolean;
  }[];
};
type SettingsSectionKey =
  | "saved-credentials"
  | "schemas"
  | "plugin-settings"
  | "catalogs"
  | "tags"
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
  campaigns = [],
  onOpenCampaign,
  onOpenLead,
}: AdminViewProps) {
  const currentUserEmail = getCurrentUser()?.email;

  const router = useRouter();
  const pathname = usePathname();

  // Read initial URL params without useSearchParams (avoids Next.js router overhead)
  const initParams =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();

  // ── URL-derived state ──────────────────────────────────────────────────────
  const VALID_SETTINGS_SECTIONS: SettingsSectionKey[] = [
    "saved-credentials",
    "schemas",
    "plugin-settings",
    "catalogs",
    "tags",
    "users",
  ];
  const VALID_LOGS_SECTIONS: LogsSectionKey[] = ["activity", "intake"];

  const rawAdminTab = initParams.get("admin_tab");
  const initialAdminTab: AdminPrimaryTab =
    rawAdminTab === "logs" ? "logs" : "settings";

  const rawSection = initParams.get("settings_section");
  const initialActiveSection: SettingsSectionKey = (
    VALID_SETTINGS_SECTIONS.includes(rawSection as SettingsSectionKey)
      ? rawSection
      : "saved-credentials"
  ) as SettingsSectionKey;

  const rawLogsSection = initParams.get("logs_section");
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
    initParams.get("logs_entity") ?? "",
  );
  const [logsActorSub, setLogsActorSubState] = useState(
    initParams.get("logs_actor") ?? "",
  );
  const [logsSort, setLogsSortState] = useState<"newest" | "oldest">(
    (initParams.get("logs_sort") ?? "newest") as "newest" | "oldest",
  );

  // Sync admin state on browser back / forward
  useEffect(() => {
    const onPop = () => {
      const p = new URLSearchParams(window.location.search);
      const nextRawAdminTab = p.get("admin_tab");
      const nextAdminTab: AdminPrimaryTab =
        nextRawAdminTab === "logs" ? "logs" : "settings";
      const nextRawSection = p.get("settings_section");
      const nextActiveSection: SettingsSectionKey = (
        VALID_SETTINGS_SECTIONS.includes(nextRawSection as SettingsSectionKey)
          ? nextRawSection
          : "saved-credentials"
      ) as SettingsSectionKey;
      const nextRawLogsSection = p.get("logs_section");
      const nextLogsSection: LogsSectionKey = (
        VALID_LOGS_SECTIONS.includes(nextRawLogsSection as LogsSectionKey)
          ? nextRawLogsSection
          : "activity"
      ) as LogsSectionKey;
      setAdminTabState(nextAdminTab);
      setActiveSectionState(nextActiveSection);
      setLogsSectionState(nextLogsSection);
      setLogsEntityTypeState(p.get("logs_entity") ?? "");
      setLogsActorSubState(p.get("logs_actor") ?? "");
      setLogsSortState((p.get("logs_sort") ?? "newest") as "newest" | "oldest");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      case "criteria_catalog":
      case "logic_catalog":
        return `?view=admin&admin_tab=settings&settings_section=catalogs`;
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

  // Catalogs state
  const [catalogTab, setCatalogTab] = useState<CatalogTabKey>("criteria");
  const [listPresets, setListPresets] = useState<ListPreset[]>([]);
  const [listPresetsLoading, setListPresetsLoading] = useState(false);
  const [expandedListPresetIds, setExpandedListPresetIds] = useState<
    Set<string>
  >(new Set());
  const toggleListPreset = (id: string) => {
    setExpandedListPresetIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const [fieldPresets, setFieldPresets] = useState<FieldPreset[]>([]);
  const [fieldPresetsLoading, setFieldPresetsLoading] = useState(false);

  // List preset editor state
  const [listEditorOpen, setListEditorOpen] = useState(false);
  const [listEditorMode, setListEditorMode] = useState<"create" | "edit">(
    "create",
  );
  const [listEditorScope, setListEditorScope] = useState<"platform" | "tenant">(
    "platform",
  );
  const [listEditorId, setListEditorId] = useState<string | null>(null);
  const [listEditorName, setListEditorName] = useState("");
  const [listEditorDescription, setListEditorDescription] = useState("");
  const [listEditorOptions, setListEditorOptions] = useState<
    { value: string; label: string }[]
  >([]);
  const [listEditorSaving, setListEditorSaving] = useState(false);
  const [listEditorNewValue, setListEditorNewValue] = useState("");
  const [listEditorNewLabel, setListEditorNewLabel] = useState("");
  const [selectedCriteriaSetId, setSelectedCriteriaSetId] = useState<
    string | null
  >(null);
  const [selectedLogicSetId, setSelectedLogicSetId] = useState<string | null>(
    null,
  );
  const [catalogEditorOpen, setCatalogEditorOpen] = useState(false);
  const [catalogEditorMode, setCatalogEditorMode] = useState<
    "create" | "new-version"
  >("create");
  const [catalogEditorKind, setCatalogEditorKind] =
    useState<CatalogTabKey>("criteria");
  const [catalogEditorTargetId, setCatalogEditorTargetId] = useState<
    string | null
  >(null);
  const [catalogEditorName, setCatalogEditorName] = useState("");
  const [catalogEditorDescription, setCatalogEditorDescription] = useState("");
  const [catalogEditorTags, setCatalogEditorTags] = useState<string[]>([]);
  const [catalogEditorJson, setCatalogEditorJson] = useState("[]");
  const [catalogEditorSaving, setCatalogEditorSaving] = useState(false);
  const [catalogDeleteBusyKey, setCatalogDeleteBusyKey] = useState<
    string | null
  >(null);
  const [catalogDeleteVersionBusyKey, setCatalogDeleteVersionBusyKey] =
    useState<string | null>(null);
  const [expandedCatalogVersions, setExpandedCatalogVersions] = useState<
    Set<string>
  >(new Set());

  // Tag editor state
  const [tagEditorOpen, setTagEditorOpen] = useState(false);
  const [tagEditorMode, setTagEditorMode] = useState<"create" | "edit">(
    "create",
  );
  const [tagEditorTarget, setTagEditorTarget] =
    useState<TagDefinitionRecord | null>(null);
  const [tagEditorLabel, setTagEditorLabel] = useState("");
  const [tagEditorColor, setTagEditorColor] = useState("");
  const [tagEditorSaving, setTagEditorSaving] = useState(false);
  const [tagDeleteBusyKey, setTagDeleteBusyKey] = useState<string | null>(null);

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

  const shouldLoadCatalogs =
    adminTab === "settings" && activeSection === "catalogs";

  const {
    data: criteriaCatalogSets = [],
    isLoading: criteriaCatalogLoading,
    mutate: refreshCriteriaCatalog,
  } = useSWR<CriteriaCatalogSet[]>(
    shouldLoadCatalogs ? "admin:criteria-catalog" : null,
    async () => {
      try {
        const res = await listCriteriaCatalog();
        return res?.data?.items ?? [];
      } catch (err) {
        console.warn("Criteria catalog not available", err);
        return [] as CriteriaCatalogSet[];
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
    data: logicCatalogSets = [],
    isLoading: logicCatalogLoading,
    mutate: refreshLogicCatalog,
  } = useSWR<LogicCatalogSet[]>(
    shouldLoadCatalogs ? "admin:logic-catalog" : null,
    async () => {
      try {
        const res = await listLogicCatalog();
        return res?.data?.items ?? [];
      } catch (err) {
        console.warn("Logic catalog not available", err);
        return [] as LogicCatalogSet[];
      }
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      keepPreviousData: true,
    },
  );

  const shouldLoadTags =
    adminTab === "settings" &&
    (activeSection === "tags" || activeSection === "catalogs");

  const {
    data: tagDefinitions = [],
    isLoading: tagDefinitionsLoading,
    mutate: refreshTagDefinitions,
  } = useSWR<TagDefinitionRecord[]>(
    shouldLoadTags ? "admin:tag-definitions" : null,
    async () => {
      try {
        const res = await listTagDefinitions();
        return res?.data?.items ?? [];
      } catch (err) {
        console.warn("Tag definitions not available", err);
        return [] as TagDefinitionRecord[];
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
    data: criteriaCatalogDetail,
    isLoading: criteriaCatalogDetailLoading,
    mutate: refreshCriteriaCatalogDetail,
  } = useSWR<
    { set: CriteriaCatalogSet; versions: CriteriaCatalogVersion[] } | undefined
  >(
    shouldLoadCatalogs && selectedCriteriaSetId
      ? `admin:criteria-catalog:${selectedCriteriaSetId}`
      : null,
    async () => {
      const res = await getCriteriaCatalogSet(selectedCriteriaSetId!);
      return res?.data;
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      keepPreviousData: true,
    },
  );

  const {
    data: logicCatalogDetail,
    isLoading: logicCatalogDetailLoading,
    mutate: refreshLogicCatalogDetail,
  } = useSWR<
    { set: LogicCatalogSet; versions: LogicCatalogVersion[] } | undefined
  >(
    shouldLoadCatalogs && selectedLogicSetId
      ? `admin:logic-catalog:${selectedLogicSetId}`
      : null,
    async () => {
      const res = await getLogicCatalogSet(selectedLogicSetId!);
      return res?.data;
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

  // Clients SWR — for name lookup in activity log
  const { data: allClients = [] } = useSWR<Client[]>(
    "admin:all-clients",
    async () => {
      try {
        const res = await listClients({ includeDeleted: true });
        return res?.data?.items ?? [];
      } catch {
        return [] as Client[];
      }
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      keepPreviousData: true,
    },
  );

  // Affiliates SWR — for name lookup in activity log
  const { data: allAffiliates = [] } = useSWR<Affiliate[]>(
    "admin:all-affiliates",
    async () => {
      try {
        const res = await listAffiliates({ includeDeleted: true });
        return res?.data?.items ?? [];
      } catch {
        return [] as Affiliate[];
      }
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      keepPreviousData: true,
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

  const campaignNameMap = useMemo(() => {
    const map = new Map<string, string>();
    campaigns.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [campaigns]);

  const clientNameMap = useMemo(() => {
    const map = new Map<string, string>();
    allClients.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [allClients]);

  const affiliateNameMap = useMemo(() => {
    const map = new Map<string, string>();
    allAffiliates.forEach((a) => map.set(a.id, a.name));
    return map;
  }, [allAffiliates]);

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

  const criteriaCatalogVersions = useMemo(() => {
    return [...(criteriaCatalogDetail?.versions ?? [])].sort(
      (a, b) => b.version - a.version,
    );
  }, [criteriaCatalogDetail]);

  const logicCatalogVersions = useMemo(() => {
    return [...(logicCatalogDetail?.versions ?? [])].sort(
      (a, b) => b.version - a.version,
    );
  }, [logicCatalogDetail]);

  const showCriteriaCatalogLoading =
    criteriaCatalogLoading && criteriaCatalogSets.length === 0;
  const showLogicCatalogLoading =
    logicCatalogLoading && logicCatalogSets.length === 0;

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

  useEffect(() => {
    if (!shouldLoadCatalogs) return;
    if (criteriaCatalogSets.length === 0) {
      setSelectedCriteriaSetId(null);
      return;
    }
    if (
      !selectedCriteriaSetId ||
      !criteriaCatalogSets.some((set) => set.id === selectedCriteriaSetId)
    ) {
      setSelectedCriteriaSetId(criteriaCatalogSets[0].id);
    }
  }, [shouldLoadCatalogs, criteriaCatalogSets, selectedCriteriaSetId]);

  useEffect(() => {
    if (!shouldLoadCatalogs) return;
    if (logicCatalogSets.length === 0) {
      setSelectedLogicSetId(null);
      return;
    }
    if (
      !selectedLogicSetId ||
      !logicCatalogSets.some((set) => set.id === selectedLogicSetId)
    ) {
      setSelectedLogicSetId(logicCatalogSets[0].id);
    }
  }, [shouldLoadCatalogs, logicCatalogSets, selectedLogicSetId]);

  // ── Fetch list presets for the Lists tab ─────────────────────────────────────
  useEffect(() => {
    if (!shouldLoadCatalogs || catalogTab !== "lists") return;
    let cancelled = false;
    setListPresetsLoading(true);
    (async () => {
      try {
        const [platResult, tenResult] = await Promise.allSettled([
          listPlatformPresets(),
          listTenantPresets(),
        ]);
        if (cancelled) return;
        const toArray = (d: unknown): unknown[] =>
          Array.isArray(d) ? d : ((d as any)?.items ?? []);
        const merged: ListPreset[] = [];
        if (platResult.status === "fulfilled") {
          for (const r of toArray(platResult.value.data) as Record<
            string,
            unknown
          >[]) {
            if (r.data_type === "FieldSet") continue;
            const opts = (r.options ?? []) as {
              value: string;
              label: string;
            }[];
            merged.push({
              id: r.id as string,
              name: r.name as string,
              scope: "platform",
              optionCount: opts.length,
              options: opts,
            });
          }
        }
        if (tenResult.status === "fulfilled") {
          for (const r of toArray(tenResult.value.data) as Record<
            string,
            unknown
          >[]) {
            if (r.data_type === "FieldSet") continue;
            const opts = (r.options ?? []) as {
              value: string;
              label: string;
            }[];
            merged.push({
              id: r.id as string,
              name: r.name as string,
              scope: "tenant",
              optionCount: opts.length,
              options: opts,
            });
          }
        }
        setListPresets(merged);
      } catch {
        /* non-critical */
      } finally {
        if (!cancelled) setListPresetsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shouldLoadCatalogs, catalogTab]);

  // ── Fetch field-set presets for the Fields tab ───────────────────────────────
  useEffect(() => {
    if (!shouldLoadCatalogs || catalogTab !== "criteria") return;
    let cancelled = false;
    setFieldPresetsLoading(true);
    (async () => {
      try {
        const platRes = await listPlatformPresets();
        if (cancelled) return;
        const toArray = (d: unknown): unknown[] =>
          Array.isArray(d) ? d : ((d as any)?.items ?? []);
        const presets: FieldPreset[] = [];
        for (const r of toArray(platRes.data) as Record<string, unknown>[]) {
          if (r.data_type !== "FieldSet") continue;
          const fields = (r.fields ?? []) as FieldPreset["fields"];
          presets.push({
            id: r.id as string,
            name: r.name as string,
            description: r.description as string | undefined,
            locked: r.locked as boolean | undefined,
            fields,
          });
        }
        setFieldPresets(presets);
      } catch {
        /* non-critical */
      } finally {
        if (!cancelled) setFieldPresetsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shouldLoadCatalogs, catalogTab]);

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

  const closeCatalogEditor = () => {
    if (catalogEditorSaving) return;
    setCatalogEditorOpen(false);
    setCatalogEditorMode("create");
    setCatalogEditorKind("criteria");
    setCatalogEditorTargetId(null);
    setCatalogEditorName("");
    setCatalogEditorDescription("");
    setCatalogEditorTags([]);
    setCatalogEditorJson("[]");
  };

  const openCatalogCreate = (kind: CatalogTabKey) => {
    setCatalogEditorKind(kind);
    setCatalogEditorMode("create");
    setCatalogEditorTargetId(null);
    setCatalogEditorName("");
    setCatalogEditorDescription("");
    setCatalogEditorTags([]);
    setCatalogEditorJson("[]");
    setCatalogEditorOpen(true);
  };

  const openCatalogNewVersion = (kind: CatalogTabKey) => {
    if (kind === "criteria") {
      if (!criteriaCatalogDetail?.set) {
        toast.error("Select a fields preset first");
        return;
      }
      const latestVersion = criteriaCatalogVersions[0];
      setCatalogEditorKind("criteria");
      setCatalogEditorMode("new-version");
      setCatalogEditorTargetId(criteriaCatalogDetail.set.id);
      setCatalogEditorName(criteriaCatalogDetail.set.name);
      setCatalogEditorDescription(criteriaCatalogDetail.set.description ?? "");
      setCatalogEditorJson(
        JSON.stringify(latestVersion?.fields ?? [], null, 2),
      );
      setCatalogEditorOpen(true);
      return;
    }

    if (!logicCatalogDetail?.set) {
      toast.error("Select a rules preset first");
      return;
    }
    const latestVersion = logicCatalogVersions[0];
    setCatalogEditorKind("logic");
    setCatalogEditorMode("new-version");
    setCatalogEditorTargetId(logicCatalogDetail.set.id);
    setCatalogEditorName(logicCatalogDetail.set.name);
    setCatalogEditorDescription(logicCatalogDetail.set.description ?? "");
    setCatalogEditorJson(JSON.stringify(latestVersion?.rules ?? [], null, 2));
    setCatalogEditorOpen(true);
  };

  const toggleCatalogVersion = (versionId: string) => {
    setExpandedCatalogVersions((prev) => {
      const next = new Set(prev);
      if (next.has(versionId)) next.delete(versionId);
      else next.add(versionId);
      return next;
    });
  };

  const openCatalogEditVersion = (
    kind: CatalogTabKey,
    setId: string,
    setName: string,
    setDescription: string,
    versionData: unknown[],
  ) => {
    setCatalogEditorKind(kind);
    setCatalogEditorMode("new-version");
    setCatalogEditorTargetId(setId);
    setCatalogEditorName(setName);
    setCatalogEditorDescription(setDescription);
    setCatalogEditorJson(JSON.stringify(versionData, null, 2));
    setCatalogEditorOpen(true);
  };

  const saveCatalogEditor = async () => {
    const trimmedName = catalogEditorName.trim();
    if (!trimmedName) {
      toast.error("Name is required");
      return;
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(catalogEditorJson || "[]");
    } catch {
      toast.error("JSON body is invalid");
      return;
    }

    if (!Array.isArray(parsedJson)) {
      toast.error("JSON body must be an array");
      return;
    }

    const description = catalogEditorDescription.trim();

    setCatalogEditorSaving(true);
    try {
      if (catalogEditorKind === "criteria") {
        if (catalogEditorMode === "create") {
          const res = await createCriteriaCatalogSet({
            name: trimmedName,
            ...(description ? { description } : {}),
            ...(catalogEditorTags.length > 0
              ? { tags: catalogEditorTags as any }
              : {}),
            fields: parsedJson as any,
          });
          if (!(res as any)?.success) {
            throw new Error((res as any)?.message || "Failed to create set");
          }
          const createdId = (res as any)?.data?.set?.id as string | undefined;
          await refreshCriteriaCatalog();
          if (createdId) {
            setSelectedCriteriaSetId(createdId);
          }
          toast.success("Fields preset created");
        } else {
          if (!catalogEditorTargetId) {
            throw new Error("Missing criteria preset set id");
          }
          const res = await updateCriteriaCatalogSet(catalogEditorTargetId, {
            name: trimmedName,
            ...(description ? { description } : {}),
            fields: parsedJson as any,
          });
          if (!(res as any)?.success) {
            throw new Error(
              (res as any)?.message || "Failed to create new version",
            );
          }
          await Promise.all([
            refreshCriteriaCatalog(),
            refreshCriteriaCatalogDetail(),
          ]);
          toast.success("Fields preset version created");
        }
      } else {
        if (catalogEditorMode === "create") {
          const res = await createLogicCatalogSet({
            name: trimmedName,
            ...(description ? { description } : {}),
            ...(catalogEditorTags.length > 0
              ? { tags: catalogEditorTags as any }
              : {}),
            rules: parsedJson as any,
          });
          if (!(res as any)?.success) {
            throw new Error((res as any)?.message || "Failed to create set");
          }
          const createdId = (res as any)?.data?.set?.id as string | undefined;
          await refreshLogicCatalog();
          if (createdId) {
            setSelectedLogicSetId(createdId);
          }
          toast.success("Rules preset created");
        } else {
          if (!catalogEditorTargetId) {
            throw new Error("Missing logic preset set id");
          }
          const res = await updateLogicCatalogSet(catalogEditorTargetId, {
            name: trimmedName,
            ...(description ? { description } : {}),
            rules: parsedJson as any,
          });
          if (!(res as any)?.success) {
            throw new Error(
              (res as any)?.message || "Failed to create new version",
            );
          }
          await Promise.all([
            refreshLogicCatalog(),
            refreshLogicCatalogDetail(),
          ]);
          toast.success("Rules preset version created");
        }
      }

      closeCatalogEditor();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save preset");
    } finally {
      setCatalogEditorSaving(false);
    }
  };

  const removeCatalogSet = async (kind: CatalogTabKey, setId: string) => {
    const confirmed = window.confirm(
      "Delete this preset and all of its versions?",
    );
    if (!confirmed) return;

    const busyKey = `${kind}:set:${setId}`;
    setCatalogDeleteBusyKey(busyKey);
    try {
      if (kind === "criteria") {
        const res = await deleteCriteriaCatalogSet(setId);
        if (!(res as any)?.success) {
          throw new Error((res as any)?.message || "Failed to delete set");
        }
        await refreshCriteriaCatalog();
        if (selectedCriteriaSetId === setId) {
          setSelectedCriteriaSetId(null);
        }
        toast.success("Fields preset deleted");
      } else {
        const res = await deleteLogicCatalogSet(setId);
        if (!(res as any)?.success) {
          throw new Error((res as any)?.message || "Failed to delete set");
        }
        await refreshLogicCatalog();
        if (selectedLogicSetId === setId) {
          setSelectedLogicSetId(null);
        }
        toast.success("Rules preset deleted");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete preset");
    } finally {
      setCatalogDeleteBusyKey(null);
    }
  };

  const removeCatalogVersion = async (
    kind: CatalogTabKey,
    setId: string,
    version: number,
  ) => {
    const confirmed = window.confirm(
      `Delete version ${version} from this catalog set?`,
    );
    if (!confirmed) return;

    const busyKey = `${kind}:version:${setId}:${version}`;
    setCatalogDeleteVersionBusyKey(busyKey);
    try {
      if (kind === "criteria") {
        const res = await deleteCriteriaCatalogVersion(setId, version);
        if (!(res as any)?.success) {
          throw new Error((res as any)?.message || "Failed to delete version");
        }
        await Promise.all([
          refreshCriteriaCatalog(),
          refreshCriteriaCatalogDetail(),
        ]);
        toast.success(`Criteria version ${version} deleted`);
      } else {
        const res = await deleteLogicCatalogVersion(setId, version);
        if (!(res as any)?.success) {
          throw new Error((res as any)?.message || "Failed to delete version");
        }
        await Promise.all([refreshLogicCatalog(), refreshLogicCatalogDetail()]);
        toast.success(`Logic version ${version} deleted`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete preset version");
    } finally {
      setCatalogDeleteVersionBusyKey(null);
    }
  };

  // ── List preset editor handlers ──────────────────────────────────────────────

  const closeListEditor = () => {
    if (listEditorSaving) return;
    setListEditorOpen(false);
    setListEditorMode("create");
    setListEditorScope("platform");
    setListEditorId(null);
    setListEditorName("");
    setListEditorDescription("");
    setListEditorOptions([]);
    setListEditorNewValue("");
    setListEditorNewLabel("");
  };

  const openListCreate = (scope: "platform" | "tenant") => {
    setListEditorMode("create");
    setListEditorScope(scope);
    setListEditorId(null);
    setListEditorName("");
    setListEditorDescription("");
    setListEditorOptions([]);
    setListEditorNewValue("");
    setListEditorNewLabel("");
    setListEditorOpen(true);
  };

  const openListEdit = async (preset: ListPreset) => {
    setListEditorMode("edit");
    setListEditorScope(preset.scope);
    setListEditorId(preset.id);
    setListEditorName(preset.name);
    setListEditorDescription("");
    setListEditorOptions([]);
    setListEditorNewValue("");
    setListEditorNewLabel("");
    setListEditorOpen(true);
    try {
      const fn =
        preset.scope === "platform" ? getPlatformPreset : getTenantPreset;
      const res = await fn(preset.id);
      const data = (res as any)?.data as Record<string, unknown> | undefined;
      if (data) {
        setListEditorDescription((data.description as string) ?? "");
        setListEditorOptions(
          (data.options as { value: string; label: string }[]) ?? [],
        );
      }
    } catch {
      /* ignore, user can still edit */
    }
  };

  const addListOption = () => {
    const v = listEditorNewValue.trim();
    const l = listEditorNewLabel.trim();
    if (!v) return;
    setListEditorOptions((prev) => [...prev, { value: v, label: l || v }]);
    setListEditorNewValue("");
    setListEditorNewLabel("");
  };

  const removeListOption = (idx: number) => {
    setListEditorOptions((prev) => prev.filter((_, i) => i !== idx));
  };

  const saveListEditor = async () => {
    const name = listEditorName.trim();
    if (!name) {
      toast.error("Preset name is required");
      return;
    }
    setListEditorSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name,
        description: listEditorDescription.trim() || undefined,
        data_type: "List",
        options: listEditorOptions,
      };
      if (listEditorMode === "create") {
        const fn =
          listEditorScope === "platform"
            ? createPlatformPreset
            : createTenantPreset;
        const res = await fn(payload);
        if (!(res as any)?.success)
          throw new Error((res as any)?.message || "Failed to create preset");
        toast.success(`List preset "${name}" created`);
      } else if (listEditorId) {
        const fn =
          listEditorScope === "platform"
            ? updatePlatformPreset
            : updateTenantPreset;
        const res = await fn(listEditorId, {
          name,
          description: payload.description,
          options: listEditorOptions,
        });
        if (!(res as any)?.success)
          throw new Error((res as any)?.message || "Failed to update preset");
        toast.success(`List preset "${name}" updated`);
      }
      closeListEditor();
      // Refresh list presets
      try {
        const [platResult, tenResult] = await Promise.allSettled([
          listPlatformPresets(),
          listTenantPresets(),
        ]);
        const toArr = (d: unknown): unknown[] =>
          Array.isArray(d) ? d : ((d as any)?.items ?? []);
        const merged: ListPreset[] = [];
        if (platResult.status === "fulfilled") {
          for (const r of toArr(platResult.value.data) as Record<
            string,
            unknown
          >[]) {
            if (r.data_type === "FieldSet") continue;
            const opts = (r.options ?? []) as {
              value: string;
              label: string;
            }[];
            merged.push({
              id: r.id as string,
              name: r.name as string,
              scope: "platform",
              optionCount: opts.length,
              options: opts,
            });
          }
        }
        if (tenResult.status === "fulfilled") {
          for (const r of toArr(tenResult.value.data) as Record<
            string,
            unknown
          >[]) {
            if (r.data_type === "FieldSet") continue;
            const opts = (r.options ?? []) as {
              value: string;
              label: string;
            }[];
            merged.push({
              id: r.id as string,
              name: r.name as string,
              scope: "tenant",
              optionCount: opts.length,
              options: opts,
            });
          }
        }
        setListPresets(merged);
      } catch {
        /* ignore refresh error */
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to save list preset");
    } finally {
      setListEditorSaving(false);
    }
  };

  // ── Tag CRUD handlers ────────────────────────────────────────────────────────

  const closeTagEditor = () => {
    if (tagEditorSaving) return;
    setTagEditorOpen(false);
    setTagEditorMode("create");
    setTagEditorTarget(null);
    setTagEditorLabel("");
    setTagEditorColor("");
  };

  const openTagCreate = () => {
    setTagEditorMode("create");
    setTagEditorTarget(null);
    setTagEditorLabel("");
    setTagEditorColor("");
    setTagEditorOpen(true);
  };

  const openTagEdit = (def: TagDefinitionRecord) => {
    setTagEditorMode("edit");
    setTagEditorTarget(def);
    setTagEditorLabel(def.label);
    setTagEditorColor(def.color ?? "");
    setTagEditorOpen(true);
  };

  const saveTagEditor = async () => {
    const trimmedLabel = tagEditorLabel.trim();
    if (!trimmedLabel) {
      toast.error("Tag label is required");
      return;
    }

    setTagEditorSaving(true);
    try {
      if (tagEditorMode === "create") {
        const res = await createTagDefinition({
          label: trimmedLabel,
          ...(tagEditorColor && { color: tagEditorColor }),
        });
        if (!(res as any)?.success) {
          throw new Error((res as any)?.message || "Failed to create tag");
        }
        toast.success(`Tag "${trimmedLabel}" created`);
      } else if (tagEditorTarget) {
        const res = await updateTagDefinition(tagEditorTarget.id, {
          label: trimmedLabel,
          color: tagEditorColor || undefined,
        });
        if (!(res as any)?.success) {
          throw new Error((res as any)?.message || "Failed to update tag");
        }
        toast.success(`Tag "${trimmedLabel}" updated`);
      }
      await refreshTagDefinitions();
      closeTagEditor();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save tag");
    } finally {
      setTagEditorSaving(false);
    }
  };

  const removeTagDefinition = async (def: TagDefinitionRecord) => {
    const confirmed = window.confirm(
      `Delete tag definition "${def.label}"? This cannot be undone.`,
    );
    if (!confirmed) return;

    setTagDeleteBusyKey(def.id);
    try {
      const res = await deleteTagDefinition(def.id, true);
      if (!(res as any)?.success) {
        throw new Error(
          (res as any)?.message || "Failed to delete tag definition",
        );
      }
      await refreshTagDefinitions();
      toast.success(`Tag "${def.label}" deleted`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete tag definition");
    } finally {
      setTagDeleteBusyKey(null);
    }
  };

  const showTagsLoading = tagDefinitionsLoading && tagDefinitions.length === 0;

  // ── Render helpers ───────────────────────────────────────────────────────────

  const settingsNavItems: {
    key: SettingsSectionKey;
    label: string;
    group: "integrations" | "global" | "users";
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
      key: "catalogs",
      label: "Presets",
      group: "global",
      icon: <GitBranch size={14} />,
    },
    {
      key: "tags",
      label: "Tags",
      group: "global",
      icon: <Tag size={14} />,
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
  const globalItems = settingsNavItems.filter((i) => i.group === "global");
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
                {globalItems.length > 0 && (
                  <>
                    <div className="mx-1 my-1.5 border-t border-[--color-border]" />
                    <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[--color-text-muted]">
                      Global
                    </p>
                    {globalItems.map((item) => (
                      <SettingsNavBtn key={item.key} item={item} />
                    ))}
                  </>
                )}
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

            {/* ── Catalogs ── */}
            {adminTab === "settings" && activeSection === "catalogs" && (
              <motion.div
                key="catalogs"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-[--color-text-muted]">
                    Manage reusable fields and rules catalog sets and their
                    versions.
                  </p>
                  <div className="flex items-center gap-2">
                    {catalogTab !== "lists" && (
                      <>
                        <Button
                          variant="outline"
                          disabled={
                            catalogTab === "criteria"
                              ? !criteriaCatalogDetail?.set
                              : !logicCatalogDetail?.set
                          }
                          onClick={() => openCatalogNewVersion(catalogTab)}
                        >
                          New Version
                        </Button>
                        <Button
                          iconLeft={<PlusCircle size={16} />}
                          onClick={() => openCatalogCreate(catalogTab)}
                        >
                          Create Set
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 p-1 rounded-xl border border-[--color-border] bg-[--color-panel] w-fit">
                  <button
                    type="button"
                    onClick={() => setCatalogTab("criteria")}
                    className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                      catalogTab === "criteria"
                        ? "bg-[--color-primary] text-white shadow-sm"
                        : "text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-bg-muted]"
                    }`}
                  >
                    <LayoutTemplate size={14} />
                    Fields
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatalogTab("logic")}
                    className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                      catalogTab === "logic"
                        ? "bg-[--color-primary] text-white shadow-sm"
                        : "text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-bg-muted]"
                    }`}
                  >
                    <GitBranch size={14} />
                    Rules
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatalogTab("lists")}
                    className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                      catalogTab === "lists"
                        ? "bg-[--color-primary] text-white shadow-sm"
                        : "text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-bg-muted]"
                    }`}
                  >
                    <ListOrdered size={14} />
                    Lists
                  </button>
                </div>

                {catalogTab === "lists" ? (
                  /* ── Lists (Presets) tab ── */
                  <div className="space-y-4">
                    <p className="text-sm text-[--color-text-muted]">
                      Manage reusable list presets (e.g. US States, Yes/No) that
                      can be applied to any List field.
                    </p>
                    {listPresetsLoading && listPresets.length === 0 ? (
                      <p className="text-sm text-[--color-text-muted] py-8 text-center">
                        Loading presets…
                      </p>
                    ) : (
                      <div className="grid gap-4 lg:grid-cols-2">
                        {/* Platform presets */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                              System Presets
                            </p>
                            <Button
                              size="sm"
                              onClick={() => openListCreate("platform")}
                            >
                              <PlusCircle size={14} className="mr-1" />
                              New
                            </Button>
                          </div>
                          <div className="rounded-lg border border-[--color-border] divide-y divide-[--color-border]">
                            {listPresets
                              .filter((p) => p.scope === "platform")
                              .map((preset) => (
                                <div key={preset.id}>
                                  <div
                                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[--color-bg-muted] transition-colors"
                                    onClick={() => toggleListPreset(preset.id)}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-[--color-text-muted]">
                                        {expandedListPresetIds.has(
                                          preset.id,
                                        ) ? (
                                          <ChevronDown size={14} />
                                        ) : (
                                          <ChevronRight size={14} />
                                        )}
                                      </span>
                                      <div>
                                        <p className="text-sm font-medium text-[--color-text-strong]">
                                          {preset.name}
                                        </p>
                                        <p className="text-xs text-[--color-text-muted]">
                                          {preset.optionCount} options
                                        </p>
                                      </div>
                                    </div>
                                    <div
                                      className="flex items-center gap-2"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => openListEdit(preset)}
                                      >
                                        <Pencil
                                          size={13}
                                          className="mr-1 inline-block"
                                        />
                                        Edit
                                      </Button>
                                      <Badge tone="info">Platform</Badge>
                                    </div>
                                  </div>
                                  <AnimatePresence initial={false}>
                                    {expandedListPresetIds.has(preset.id) && (
                                      <motion.div
                                        key={`opts-${preset.id}`}
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{
                                          duration: 0.18,
                                          ease: "easeOut",
                                        }}
                                        className="overflow-hidden"
                                      >
                                        <div className="px-4 pb-3 pt-1">
                                          <div className="flex flex-wrap gap-1.5">
                                            {preset.options.map((o, i) => (
                                              <span
                                                key={i}
                                                className="inline-flex items-center gap-1 rounded-md border border-[--color-border] bg-[--color-bg-muted] px-2 py-0.5 text-[11px]"
                                              >
                                                <span className="font-mono text-[--color-text-muted]">
                                                  {o.value}
                                                </span>
                                                <span className="text-[--color-text]">
                                                  {o.label}
                                                </span>
                                              </span>
                                            ))}
                                            {preset.options.length === 0 && (
                                              <span className="text-xs text-[--color-text-muted] italic">
                                                No options
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              ))}
                            {listPresets.filter((p) => p.scope === "platform")
                              .length === 0 && (
                              <p className="px-4 py-6 text-sm text-center text-[--color-text-muted]">
                                No system presets found.
                              </p>
                            )}
                          </div>
                        </div>
                        {/* Tenant presets */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                              Custom Presets
                            </p>
                            <Button
                              size="sm"
                              onClick={() => openListCreate("tenant")}
                            >
                              <PlusCircle size={14} className="mr-1" />
                              New
                            </Button>
                          </div>
                          <div className="rounded-lg border border-[--color-border] divide-y divide-[--color-border]">
                            {listPresets
                              .filter((p) => p.scope === "tenant")
                              .map((preset) => (
                                <div key={preset.id}>
                                  <div
                                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[--color-bg-muted] transition-colors"
                                    onClick={() => toggleListPreset(preset.id)}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-[--color-text-muted]">
                                        {expandedListPresetIds.has(
                                          preset.id,
                                        ) ? (
                                          <ChevronDown size={14} />
                                        ) : (
                                          <ChevronRight size={14} />
                                        )}
                                      </span>
                                      <div>
                                        <p className="text-sm font-medium text-[--color-text-strong]">
                                          {preset.name}
                                        </p>
                                        <p className="text-xs text-[--color-text-muted]">
                                          {preset.optionCount} options
                                        </p>
                                      </div>
                                    </div>
                                    <div
                                      className="flex items-center gap-2"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => openListEdit(preset)}
                                      >
                                        <Pencil
                                          size={13}
                                          className="mr-1 inline-block"
                                        />
                                        Edit
                                      </Button>
                                    </div>
                                  </div>
                                  <AnimatePresence initial={false}>
                                    {expandedListPresetIds.has(preset.id) && (
                                      <motion.div
                                        key={`opts-${preset.id}`}
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{
                                          duration: 0.18,
                                          ease: "easeOut",
                                        }}
                                        className="overflow-hidden"
                                      >
                                        <div className="px-4 pb-3 pt-1">
                                          <div className="flex flex-wrap gap-1.5">
                                            {preset.options.map((o, i) => (
                                              <span
                                                key={i}
                                                className="inline-flex items-center gap-1 rounded-md border border-[--color-border] bg-[--color-bg-muted] px-2 py-0.5 text-[11px]"
                                              >
                                                <span className="font-mono text-[--color-text-muted]">
                                                  {o.value}
                                                </span>
                                                <span className="text-[--color-text]">
                                                  {o.label}
                                                </span>
                                              </span>
                                            ))}
                                            {preset.options.length === 0 && (
                                              <span className="text-xs text-[--color-text-muted] italic">
                                                No options
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              ))}
                            {listPresets.filter((p) => p.scope === "tenant")
                              .length === 0 && (
                              <p className="px-4 py-6 text-sm text-center text-[--color-text-muted]">
                                No custom presets yet. Save a list field as a
                                preset from any campaign.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : catalogTab === "criteria" ? (
                  <div className="space-y-6">
                    {/* ── System Field Presets ── */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                        System Presets
                      </p>
                      {fieldPresetsLoading && fieldPresets.length === 0 ? (
                        <p className="text-sm text-[--color-text-muted] py-4 text-center">
                          Loading…
                        </p>
                      ) : fieldPresets.length === 0 ? (
                        <div className="rounded-lg border border-[--color-border] px-4 py-6 text-sm text-center text-[--color-text-muted]">
                          No system field presets found.
                        </div>
                      ) : (
                        <div className="grid gap-3 lg:grid-cols-2">
                          {fieldPresets.map((fp) => (
                            <div
                              key={fp.id}
                              className="rounded-lg border border-[--color-border] bg-[--color-panel] p-4 space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-[--color-text-strong]">
                                    {fp.name}
                                  </p>
                                  {fp.description && (
                                    <p className="text-xs text-[--color-text-muted] mt-0.5">
                                      {fp.description}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {fp.locked && (
                                    <Badge tone="warning">Locked</Badge>
                                  )}
                                  <Badge tone="info">Platform</Badge>
                                </div>
                              </div>
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-[--color-text-muted] text-left">
                                    <th className="pb-1 pr-2 font-medium">
                                      Field
                                    </th>
                                    <th className="pb-1 pr-2 font-medium">
                                      Key
                                    </th>
                                    <th className="pb-1 pr-2 font-medium">
                                      Type
                                    </th>
                                    <th className="pb-1 font-medium">Req</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {fp.fields.map((f, i) => (
                                    <tr
                                      key={f.field_name ?? i}
                                      className="text-[--color-text]"
                                    >
                                      <td className="py-0.5 pr-2">
                                        {f.field_label}
                                      </td>
                                      <td className="py-0.5 pr-2 font-mono text-[--color-text-muted]">
                                        {f.field_name}
                                      </td>
                                      <td className="py-0.5 pr-2">
                                        {f.data_type}
                                      </td>
                                      <td className="py-0.5">
                                        {f.required ? "✓" : "—"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* ── Custom Field Presets (Catalog Sets) ── */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                        Custom Presets
                      </p>
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-start">
                        <div className="space-y-3">
                          <Table
                            columns={[
                              {
                                key: "name",
                                label: "Set",
                                render: (set) => (
                                  <span className="font-medium text-[--color-text-strong]">
                                    {set.name}
                                  </span>
                                ),
                              },
                              {
                                key: "latest_version",
                                label: "Latest",
                                render: (set) => (
                                  <Badge tone="info">
                                    v{set.latest_version}
                                  </Badge>
                                ),
                              },
                              {
                                key: "updated_at",
                                label: "Updated",
                                render: (set) =>
                                  set.updated_at
                                    ? formatDate(set.updated_at)
                                    : "—",
                              },
                              {
                                key: "actions",
                                label: "Actions",
                                render: (set) => {
                                  const isSelected =
                                    selectedCriteriaSetId === set.id;
                                  return (
                                    <div className="flex items-center gap-2">
                                      <Button
                                        size="sm"
                                        variant={
                                          isSelected ? "primary" : "outline"
                                        }
                                        onClick={() =>
                                          setSelectedCriteriaSetId(set.id)
                                        }
                                      >
                                        {isSelected ? "Selected" : "Open"}
                                      </Button>
                                    </div>
                                  );
                                },
                              },
                            ]}
                            data={criteriaCatalogSets}
                            emptyLabel={
                              showCriteriaCatalogLoading
                                ? "Loading fields presets…"
                                : "No custom presets yet. Save fields from any campaign."
                            }
                          />
                        </div>

                        <div className="rounded-xl border border-[--color-border] bg-[--color-panel] p-4 space-y-3">
                          {criteriaCatalogDetailLoading &&
                          selectedCriteriaSetId ? (
                            <p className="text-sm text-[--color-text-muted]">
                              Loading fields set details…
                            </p>
                          ) : !criteriaCatalogDetail?.set ? (
                            <p className="text-sm text-[--color-text-muted]">
                              Select a fields preset to view versions.
                            </p>
                          ) : (
                            <>
                              <div>
                                <p className="text-xs uppercase tracking-wider text-[--color-text-muted]">
                                  Fields Set
                                </p>
                                <p className="font-semibold text-[--color-text-strong]">
                                  {criteriaCatalogDetail.set.name}
                                </p>
                                <p className="text-xs text-[--color-text-muted] mt-1">
                                  {criteriaCatalogDetail.set.description ||
                                    "No description"}
                                </p>
                              </div>
                              <div className="space-y-2">
                                <p className="text-xs uppercase tracking-wider text-[--color-text-muted]">
                                  Versions
                                </p>
                                {criteriaCatalogVersions.length === 0 ? (
                                  <p className="text-sm text-[--color-text-muted]">
                                    No versions found.
                                  </p>
                                ) : (
                                  <div className="space-y-2 max-h-[460px] overflow-auto pr-1">
                                    {criteriaCatalogVersions.map((version) => {
                                      const deleteKey = `criteria:version:${criteriaCatalogDetail.set.id}:${version.version}`;
                                      const isBusy =
                                        catalogDeleteVersionBusyKey ===
                                        deleteKey;
                                      const isExpanded =
                                        expandedCatalogVersions.has(version.id);
                                      const inUse =
                                        version.campaigns_using.length > 0;
                                      return (
                                        <div
                                          key={version.id}
                                          className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] overflow-hidden"
                                        >
                                          <button
                                            type="button"
                                            className="flex w-full items-center justify-between gap-2 p-3 text-left hover:bg-[--color-bg-subtle] transition-colors"
                                            onClick={() =>
                                              toggleCatalogVersion(version.id)
                                            }
                                          >
                                            <div className="flex items-center gap-2">
                                              <ChevronRight
                                                size={14}
                                                className={`text-[--color-text-muted] transition-transform ${isExpanded ? "rotate-90" : ""}`}
                                              />
                                              <div>
                                                <p className="font-medium text-[--color-text-strong]">
                                                  v{version.version}
                                                </p>
                                                <p className="text-xs text-[--color-text-muted]">
                                                  {version.fields.length} fields
                                                  •{" "}
                                                  {
                                                    version.campaigns_using
                                                      .length
                                                  }{" "}
                                                  campaigns
                                                </p>
                                              </div>
                                            </div>
                                            <div
                                              className="flex items-center gap-1.5"
                                              onClick={(e) =>
                                                e.stopPropagation()
                                              }
                                            >
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                  openCatalogEditVersion(
                                                    "criteria",
                                                    criteriaCatalogDetail.set
                                                      .id,
                                                    criteriaCatalogDetail.set
                                                      .name,
                                                    criteriaCatalogDetail.set
                                                      .description ?? "",
                                                    version.fields,
                                                  )
                                                }
                                              >
                                                <Pencil
                                                  size={13}
                                                  className="mr-1 inline-block"
                                                />
                                                Edit
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="danger"
                                                disabled={isBusy || inUse}
                                                title={
                                                  inUse
                                                    ? "Cannot delete a version in use by campaigns"
                                                    : undefined
                                                }
                                                onClick={() =>
                                                  removeCatalogVersion(
                                                    "criteria",
                                                    criteriaCatalogDetail.set
                                                      .id,
                                                    version.version,
                                                  )
                                                }
                                              >
                                                {isBusy
                                                  ? "Deleting…"
                                                  : "Delete"}
                                              </Button>
                                            </div>
                                          </button>

                                          <AnimatePresence initial={false}>
                                            {isExpanded && (
                                              <motion.div
                                                initial={{
                                                  height: 0,
                                                  opacity: 0,
                                                }}
                                                animate={{
                                                  height: "auto",
                                                  opacity: 1,
                                                }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="overflow-hidden"
                                              >
                                                <div className="border-t border-[--color-border] px-3 pb-3 pt-2">
                                                  {version.fields.length ===
                                                  0 ? (
                                                    <p className="text-xs text-[--color-text-muted]">
                                                      No fields.
                                                    </p>
                                                  ) : (
                                                    <table className="w-full text-xs">
                                                      <thead>
                                                        <tr className="text-[--color-text-muted] text-left">
                                                          <th className="pb-1 pr-2 font-medium">
                                                            Field
                                                          </th>
                                                          <th className="pb-1 pr-2 font-medium">
                                                            Name
                                                          </th>
                                                          <th className="pb-1 pr-2 font-medium">
                                                            Type
                                                          </th>
                                                          <th className="pb-1 font-medium">
                                                            Req
                                                          </th>
                                                        </tr>
                                                      </thead>
                                                      <tbody>
                                                        {version.fields.map(
                                                          (f, i) => (
                                                            <tr
                                                              key={
                                                                f.field_name ??
                                                                i
                                                              }
                                                              className="border-t border-[--color-border]/50"
                                                            >
                                                              <td className="py-1 pr-2 text-[--color-text-strong]">
                                                                {f.field_label}
                                                              </td>
                                                              <td className="py-1 pr-2 font-mono text-[--color-text-muted]">
                                                                {f.field_name}
                                                              </td>
                                                              <td className="py-1 pr-2">
                                                                {f.data_type}
                                                              </td>
                                                              <td className="py-1">
                                                                {f.required
                                                                  ? "Yes"
                                                                  : "No"}
                                                              </td>
                                                            </tr>
                                                          ),
                                                        )}
                                                      </tbody>
                                                    </table>
                                                  )}
                                                  {inUse && (
                                                    <p className="mt-2 text-xs text-amber-500">
                                                      In use by{" "}
                                                      {
                                                        version.campaigns_using
                                                          .length
                                                      }{" "}
                                                      campaign
                                                      {version.campaigns_using
                                                        .length === 1
                                                        ? ""
                                                        : "s"}
                                                    </p>
                                                  )}
                                                </div>
                                              </motion.div>
                                            )}
                                          </AnimatePresence>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-start">
                    <div className="space-y-3">
                      <Table
                        columns={[
                          {
                            key: "name",
                            label: "Set",
                            render: (set) => (
                              <span className="font-medium text-[--color-text-strong]">
                                {set.name}
                              </span>
                            ),
                          },
                          {
                            key: "latest_version",
                            label: "Latest",
                            render: (set) => (
                              <Badge tone="info">v{set.latest_version}</Badge>
                            ),
                          },
                          {
                            key: "updated_at",
                            label: "Updated",
                            render: (set) =>
                              set.updated_at ? formatDate(set.updated_at) : "—",
                          },
                          {
                            key: "actions",
                            label: "Actions",
                            render: (set) => {
                              const isSelected = selectedLogicSetId === set.id;
                              return (
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant={isSelected ? "primary" : "outline"}
                                    onClick={() =>
                                      setSelectedLogicSetId(set.id)
                                    }
                                  >
                                    {isSelected ? "Selected" : "Open"}
                                  </Button>
                                </div>
                              );
                            },
                          },
                        ]}
                        data={logicCatalogSets}
                        emptyLabel={
                          showLogicCatalogLoading
                            ? "Loading rules presets…"
                            : "No rules presets yet."
                        }
                      />
                    </div>

                    <div className="rounded-xl border border-[--color-border] bg-[--color-panel] p-4 space-y-3">
                      {logicCatalogDetailLoading && selectedLogicSetId ? (
                        <p className="text-sm text-[--color-text-muted]">
                          Loading rules set details…
                        </p>
                      ) : !logicCatalogDetail?.set ? (
                        <p className="text-sm text-[--color-text-muted]">
                          Select a rules catalog set to view versions.
                        </p>
                      ) : (
                        <>
                          <div>
                            <p className="text-xs uppercase tracking-wider text-[--color-text-muted]">
                              Rules Set
                            </p>
                            <p className="font-semibold text-[--color-text-strong]">
                              {logicCatalogDetail.set.name}
                            </p>
                            <p className="text-xs text-[--color-text-muted] mt-1">
                              {logicCatalogDetail.set.description ||
                                "No description"}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs uppercase tracking-wider text-[--color-text-muted]">
                              Versions
                            </p>
                            {logicCatalogVersions.length === 0 ? (
                              <p className="text-sm text-[--color-text-muted]">
                                No versions found.
                              </p>
                            ) : (
                              <div className="space-y-2 max-h-[460px] overflow-auto pr-1">
                                {logicCatalogVersions.map((version) => {
                                  const deleteKey = `logic:version:${logicCatalogDetail.set.id}:${version.version}`;
                                  const isBusy =
                                    catalogDeleteVersionBusyKey === deleteKey;
                                  const isExpanded =
                                    expandedCatalogVersions.has(version.id);
                                  const inUse =
                                    version.campaigns_using.length > 0;
                                  return (
                                    <div
                                      key={version.id}
                                      className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] overflow-hidden"
                                    >
                                      <button
                                        type="button"
                                        className="flex w-full items-center justify-between gap-2 p-3 text-left hover:bg-[--color-bg-subtle] transition-colors"
                                        onClick={() =>
                                          toggleCatalogVersion(version.id)
                                        }
                                      >
                                        <div className="flex items-center gap-2">
                                          <ChevronRight
                                            size={14}
                                            className={`text-[--color-text-muted] transition-transform ${isExpanded ? "rotate-90" : ""}`}
                                          />
                                          <div>
                                            <p className="font-medium text-[--color-text-strong]">
                                              v{version.version}
                                            </p>
                                            <p className="text-xs text-[--color-text-muted]">
                                              {version.rules.length} rules •{" "}
                                              {version.campaigns_using.length}{" "}
                                              campaigns
                                            </p>
                                          </div>
                                        </div>
                                        <div
                                          className="flex items-center gap-1.5"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() =>
                                              openCatalogEditVersion(
                                                "logic",
                                                logicCatalogDetail.set.id,
                                                logicCatalogDetail.set.name,
                                                logicCatalogDetail.set
                                                  .description ?? "",
                                                version.rules,
                                              )
                                            }
                                          >
                                            <Pencil
                                              size={13}
                                              className="mr-1 inline-block"
                                            />
                                            Edit
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="danger"
                                            disabled={isBusy || inUse}
                                            title={
                                              inUse
                                                ? "Cannot delete a version in use by campaigns"
                                                : undefined
                                            }
                                            onClick={() =>
                                              removeCatalogVersion(
                                                "logic",
                                                logicCatalogDetail.set.id,
                                                version.version,
                                              )
                                            }
                                          >
                                            {isBusy ? "Deleting…" : "Delete"}
                                          </Button>
                                        </div>
                                      </button>

                                      <AnimatePresence initial={false}>
                                        {isExpanded && (
                                          <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{
                                              height: "auto",
                                              opacity: 1,
                                            }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="overflow-hidden"
                                          >
                                            <div className="border-t border-[--color-border] px-3 pb-3 pt-2">
                                              {version.rules.length === 0 ? (
                                                <p className="text-xs text-[--color-text-muted]">
                                                  No rules.
                                                </p>
                                              ) : (
                                                <table className="w-full text-xs">
                                                  <thead>
                                                    <tr className="text-[--color-text-muted] text-left">
                                                      <th className="pb-1 pr-2 font-medium">
                                                        Rule
                                                      </th>
                                                      <th className="pb-1 pr-2 font-medium">
                                                        Conditions
                                                      </th>
                                                      <th className="pb-1 font-medium">
                                                        Enabled
                                                      </th>
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {version.rules.map((r) => (
                                                      <tr
                                                        key={r.id}
                                                        className="border-t border-[--color-border]/50"
                                                      >
                                                        <td className="py-1 pr-2 text-[--color-text-strong]">
                                                          {r.name}
                                                        </td>
                                                        <td className="py-1 pr-2">
                                                          {r.conditions.length}
                                                        </td>
                                                        <td className="py-1">
                                                          {r.enabled
                                                            ? "Yes"
                                                            : "No"}
                                                        </td>
                                                      </tr>
                                                    ))}
                                                  </tbody>
                                                </table>
                                              )}
                                              {inUse && (
                                                <p className="mt-2 text-xs text-amber-500">
                                                  In use by{" "}
                                                  {
                                                    version.campaigns_using
                                                      .length
                                                  }{" "}
                                                  campaign
                                                  {version.campaigns_using
                                                    .length === 1
                                                    ? ""
                                                    : "s"}
                                                </p>
                                              )}
                                            </div>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Tags ── */}
            {adminTab === "settings" && activeSection === "tags" && (
              <motion.div
                key="tags"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-[--color-text-muted]">
                    Keyword tags for campaigns and catalogs. Add tags like
                    &quot;rideshare&quot;, &quot;legal&quot;, etc.
                  </p>
                  <Button size="sm" onClick={openTagCreate}>
                    <PlusCircle size={14} className="mr-1.5" />
                    New Tag
                  </Button>
                </div>
                {showTagsLoading ? (
                  <p className="text-sm text-[--color-text-muted]">Loading…</p>
                ) : tagDefinitions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[--color-border] bg-[--color-panel] p-12 text-center text-[--color-text-muted]">
                    <p className="text-3xl mb-3">🏷️</p>
                    <p className="font-medium text-[--color-text-strong]">
                      No tags yet
                    </p>
                    <p className="mt-1 text-sm">
                      Create keyword tags to categorize campaigns and catalogs.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {tagDefinitions
                      .filter((d) => !d.is_deleted)
                      .map((def) => {
                        const deleting = tagDeleteBusyKey === def.id;
                        return (
                          <div
                            key={def.id}
                            className={`group inline-flex items-center gap-2 rounded-full border pl-3 pr-1.5 py-1.5 ${
                              def.color
                                ? ""
                                : "border-[--color-border] bg-[--color-panel]"
                            }`}
                            style={
                              def.color
                                ? {
                                    borderColor: def.color + "40",
                                    backgroundColor: def.color + "15",
                                  }
                                : undefined
                            }
                          >
                            <Tag
                              size={12}
                              style={
                                def.color ? { color: def.color } : undefined
                              }
                              className={
                                def.color ? "" : "text-[--color-text-muted]"
                              }
                            />
                            <span className="text-sm font-medium text-[--color-text-strong]">
                              {def.label}
                            </span>
                            <button
                              type="button"
                              className="rounded-full p-0.5 text-[--color-text-muted] opacity-0 group-hover:opacity-100 hover:bg-[--color-bg-muted] hover:text-[--color-text] transition-all"
                              onClick={() => openTagEdit(def)}
                              title="Edit"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              type="button"
                              className="rounded-full p-0.5 text-[--color-text-muted] opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 transition-all"
                              disabled={deleting}
                              onClick={() => removeTagDefinition(def)}
                              title="Delete"
                            >
                              <X size={12} />
                            </button>
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
                              { value: "client", label: "End User" },
                              { value: "affiliate", label: "Source" },
                              { value: "credential", label: "Credential" },
                              { value: "credential_schema", label: "Schema" },
                              { value: "plugin_setting", label: "Integration" },
                              {
                                value: "criteria_catalog",
                                label: "Fields Preset",
                              },
                              {
                                value: "logic_catalog",
                                label: "Rules Preset",
                              },
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
                          const entityName = (() => {
                            switch (item.entity_type) {
                              case "campaign":
                                return campaignNameMap.get(item.entity_id);
                              case "client":
                                return clientNameMap.get(item.entity_id);
                              case "affiliate":
                                return affiliateNameMap.get(item.entity_id);
                              case "credential":
                                return credentialIdMap.get(item.entity_id);
                              default:
                                return undefined;
                            }
                          })();
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
                                        ({item.entity_id}
                                        {entityName ? ` — ${entityName}` : ""})
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
                                      ({item.entity_id}
                                      {entityName ? ` — ${entityName}` : ""})
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
                                          if (
                                            item.entity_type ===
                                            "user_table_preference"
                                          ) {
                                            return true;
                                          }
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
                                        if (
                                          item.entity_type ===
                                            "user_table_preference" &&
                                          change.field === "config"
                                        ) {
                                          const fromSummary =
                                            summarizeTablePreferenceConfig(
                                              change.from,
                                            );
                                          const toSummary =
                                            summarizeTablePreferenceConfig(
                                              change.to,
                                            );
                                          return (
                                            <div
                                              key={`${item.log_id}-${i}`}
                                              className="grid grid-cols-[11rem_1fr] items-start gap-2 text-[11px]"
                                            >
                                              <span className="truncate font-medium text-[--color-text]">
                                                Config
                                              </span>
                                              <div className="space-y-1 text-[--color-text-muted]">
                                                {fromSummary && (
                                                  <div className="flex items-center gap-1.5">
                                                    <span className="max-w-[180px] truncate line-through">
                                                      {fromSummary}
                                                    </span>
                                                    <ArrowRight
                                                      size={9}
                                                      className="shrink-0"
                                                    />
                                                  </div>
                                                )}
                                                <span className="font-medium text-[--color-text]">
                                                  {toSummary ??
                                                    "Layout, sorting, or filters updated"}
                                                </span>
                                              </div>
                                            </div>
                                          );
                                        }

                                        const fieldLower =
                                          change.field.toLowerCase();
                                        const structuredLeadChange =
                                          item.entity_type === "lead"
                                            ? renderLeadStructuredAuditChange(
                                                change,
                                                `${item.log_id}-${i}`,
                                              )
                                            : null;

                                        if (structuredLeadChange) {
                                          return structuredLeadChange;
                                        }

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

      {/* ── Catalog editor modal ───────────────────────────────────────────── */}
      <AnimatePresence>
        {catalogEditorOpen && (
          <>
            <motion.div
              key="catalog-editor-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
              onClick={closeCatalogEditor}
            />
            <motion.div
              key="catalog-editor-modal"
              initial={{ opacity: 0, scale: 0.97, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div
                className="pointer-events-auto relative w-full max-w-3xl rounded-2xl border border-[--color-border] bg-[--color-panel] shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 border-b border-[--color-border] px-5 py-4">
                  <Badge tone="info">
                    {catalogEditorKind === "criteria" ? "Fields" : "Rules"}
                  </Badge>
                  <span className="text-base font-semibold text-[--color-text-strong]">
                    {catalogEditorMode === "create"
                      ? "Create Preset"
                      : "Create New Version"}
                  </span>
                  <button
                    type="button"
                    onClick={closeCatalogEditor}
                    className="ml-auto shrink-0 rounded-lg p-1.5 text-[--color-text-muted] hover:bg-[--color-bg-muted] hover:text-[--color-text] transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[--color-text-muted]">
                        Set Name
                      </span>
                      <input
                        className={inputClass}
                        value={catalogEditorName}
                        onChange={(e) => setCatalogEditorName(e.target.value)}
                        placeholder="Enter preset name"
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[--color-text-muted]">
                        Description
                      </span>
                      <input
                        className={inputClass}
                        value={catalogEditorDescription}
                        onChange={(e) =>
                          setCatalogEditorDescription(e.target.value)
                        }
                        placeholder="Optional description"
                      />
                    </label>
                  </div>

                  {catalogEditorMode === "create" &&
                    tagDefinitions.filter((d) => !d.is_deleted).length > 0 && (
                      <div className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-[--color-text-muted]">
                          Tags
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {tagDefinitions
                            .filter((d) => !d.is_deleted)
                            .map((def) => {
                              const active = catalogEditorTags.includes(
                                def.label,
                              );
                              return (
                                <button
                                  key={def.id}
                                  type="button"
                                  onClick={() =>
                                    setCatalogEditorTags((prev) =>
                                      active
                                        ? prev.filter((t) => t !== def.label)
                                        : [...prev, def.label],
                                    )
                                  }
                                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                                    active
                                      ? def.color
                                        ? ""
                                        : "border-blue-500 bg-blue-500/10 text-blue-400"
                                      : "border-[--color-border] text-[--color-text-muted] hover:border-[--color-text-muted]"
                                  }`}
                                  style={
                                    active && def.color
                                      ? {
                                          borderColor: def.color,
                                          backgroundColor: def.color + "18",
                                          color: def.color,
                                        }
                                      : undefined
                                  }
                                >
                                  <Tag size={12} />
                                  {def.label}
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    )}

                  <label className="space-y-1.5 block">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[--color-text-muted]">
                      {catalogEditorKind === "criteria"
                        ? "Fields JSON"
                        : "Rules JSON"}
                    </span>
                    <textarea
                      className={`${inputClass} min-h-[240px] font-mono text-xs leading-relaxed`}
                      value={catalogEditorJson}
                      onChange={(e) => setCatalogEditorJson(e.target.value)}
                      spellCheck={false}
                    />
                    <p className="text-xs text-[--color-text-muted]">
                      Provide a JSON array for
                      {catalogEditorKind === "criteria"
                        ? " lead fields"
                        : " logic rules"}
                      .
                    </p>
                  </label>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button
                      variant="outline"
                      disabled={catalogEditorSaving}
                      onClick={closeCatalogEditor}
                    >
                      Cancel
                    </Button>
                    <Button
                      disabled={catalogEditorSaving}
                      onClick={saveCatalogEditor}
                    >
                      {catalogEditorSaving ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── List preset editor modal ──────────────────────────────────────── */}
      <AnimatePresence>
        {listEditorOpen && (
          <>
            <motion.div
              key="list-editor-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
              onClick={closeListEditor}
            />
            <motion.div
              key="list-editor-modal"
              initial={{ opacity: 0, scale: 0.97, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div
                className="pointer-events-auto relative w-full max-w-lg rounded-2xl border border-[--color-border] bg-[--color-panel] shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 border-b border-[--color-border] px-5 py-4">
                  <ListOrdered
                    size={16}
                    className="text-[--color-text-muted]"
                  />
                  <span className="text-base font-semibold text-[--color-text-strong]">
                    {listEditorMode === "create" ? "New" : "Edit"}{" "}
                    {listEditorScope === "platform" ? "System" : "Custom"} List
                    Preset
                  </span>
                  <button
                    type="button"
                    onClick={closeListEditor}
                    className="ml-auto p-1 rounded-md hover:bg-[--color-bg-muted]"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-4 p-5 max-h-[70vh] overflow-auto">
                  <div>
                    <label className="block text-xs font-medium text-[--color-text-muted] mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      className={inputClass}
                      placeholder="e.g. US States"
                      value={listEditorName}
                      onChange={(e) => setListEditorName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[--color-text-muted] mb-1">
                      Description (optional)
                    </label>
                    <input
                      type="text"
                      className={inputClass}
                      placeholder="Brief description"
                      value={listEditorDescription}
                      onChange={(e) => setListEditorDescription(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[--color-text-muted] mb-2">
                      Options ({listEditorOptions.length})
                    </label>
                    {listEditorOptions.length > 0 && (
                      <div className="rounded-lg border border-[--color-border] divide-y divide-[--color-border] mb-3 max-h-52 overflow-auto">
                        {listEditorOptions.map((opt, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between px-3 py-2 text-sm"
                          >
                            <span>
                              <span className="font-mono text-xs text-[--color-text-muted]">
                                {opt.value}
                              </span>
                              {opt.label !== opt.value && (
                                <span className="ml-2 text-[--color-text]">
                                  {opt.label}
                                </span>
                              )}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeListOption(idx)}
                              className="p-0.5 rounded hover:bg-[--color-bg-muted] text-[--color-text-muted] hover:text-red-500"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className={inputClass}
                        placeholder="Value"
                        value={listEditorNewValue}
                        onChange={(e) => setListEditorNewValue(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" &&
                          (e.preventDefault(), addListOption())
                        }
                      />
                      <input
                        type="text"
                        className={inputClass}
                        placeholder="Label (optional)"
                        value={listEditorNewLabel}
                        onChange={(e) => setListEditorNewLabel(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" &&
                          (e.preventDefault(), addListOption())
                        }
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={addListOption}
                        disabled={!listEditorNewValue.trim()}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-[--color-border] px-5 py-3">
                  <Button
                    variant="outline"
                    onClick={closeListEditor}
                    disabled={listEditorSaving}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={saveListEditor}
                    disabled={listEditorSaving || !listEditorName.trim()}
                  >
                    {listEditorSaving
                      ? "Saving…"
                      : listEditorMode === "create"
                        ? "Create"
                        : "Save"}
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Tag editor modal ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {tagEditorOpen && (
          <>
            <motion.div
              key="tag-editor-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
              onClick={closeTagEditor}
            />
            <motion.div
              key="tag-editor-modal"
              initial={{ opacity: 0, scale: 0.97, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div
                className="pointer-events-auto relative w-full max-w-lg rounded-2xl border border-[--color-border] bg-[--color-panel] shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 border-b border-[--color-border] px-5 py-4">
                  <Tag size={16} className="text-[--color-text-muted]" />
                  <span className="text-base font-semibold text-[--color-text-strong]">
                    {tagEditorMode === "create" ? "New Tag" : "Edit Tag"}
                  </span>
                  <button
                    type="button"
                    onClick={closeTagEditor}
                    className="ml-auto p-1 rounded-md hover:bg-[--color-bg-muted]"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-4 p-5">
                  <div>
                    <label className="block text-xs font-medium text-[--color-text-muted] mb-1">
                      Label
                    </label>
                    <input
                      type="text"
                      className={inputClass}
                      placeholder="e.g. rideshare"
                      value={tagEditorLabel}
                      onChange={(e) => setTagEditorLabel(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[--color-text-muted] mb-2">
                      Color
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      {[
                        "#ef4444",
                        "#f97316",
                        "#eab308",
                        "#22c55e",
                        "#06b6d4",
                        "#3b82f6",
                        "#8b5cf6",
                        "#ec4899",
                        "#6b7280",
                      ].map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() =>
                            setTagEditorColor(tagEditorColor === hex ? "" : hex)
                          }
                          className={`h-7 w-7 rounded-full border-2 transition-all ${
                            tagEditorColor === hex
                              ? "border-white scale-110 ring-2 ring-offset-1 ring-offset-[--color-panel]"
                              : "border-transparent hover:scale-110"
                          }`}
                          style={{
                            backgroundColor: hex,
                            ...(tagEditorColor === hex
                              ? { ringColor: hex }
                              : {}),
                          }}
                          title={hex}
                        />
                      ))}
                      <label
                        className={`relative h-7 w-7 rounded-full border-2 cursor-pointer transition-all overflow-hidden ${
                          tagEditorColor &&
                          ![
                            "#ef4444",
                            "#f97316",
                            "#eab308",
                            "#22c55e",
                            "#06b6d4",
                            "#3b82f6",
                            "#8b5cf6",
                            "#ec4899",
                            "#6b7280",
                          ].includes(tagEditorColor)
                            ? "border-white scale-110 ring-2 ring-offset-1 ring-offset-[--color-panel]"
                            : "border-[--color-border] hover:scale-110"
                        }`}
                        style={{
                          background:
                            tagEditorColor &&
                            ![
                              "#ef4444",
                              "#f97316",
                              "#eab308",
                              "#22c55e",
                              "#06b6d4",
                              "#3b82f6",
                              "#8b5cf6",
                              "#ec4899",
                              "#6b7280",
                            ].includes(tagEditorColor)
                              ? tagEditorColor
                              : "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)",
                        }}
                        title="Custom color"
                      >
                        <input
                          type="color"
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                          value={tagEditorColor || "#3b82f6"}
                          onChange={(e) => setTagEditorColor(e.target.value)}
                        />
                      </label>
                    </div>
                    {tagEditorColor && (
                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className="inline-block h-4 w-4 rounded-full border border-[--color-border]"
                          style={{ backgroundColor: tagEditorColor }}
                        />
                        <span className="text-xs text-[--color-text-muted]">
                          <span
                            style={{ color: tagEditorColor }}
                            className="font-semibold"
                          >
                            {tagEditorColor}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setTagEditorColor("")}
                          className="ml-auto text-[10px] text-[--color-text-muted] hover:text-[--color-text] transition-colors"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button
                      variant="outline"
                      disabled={tagEditorSaving}
                      onClick={closeTagEditor}
                    >
                      Cancel
                    </Button>
                    <Button disabled={tagEditorSaving} onClick={saveTagEditor}>
                      {tagEditorSaving ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Intake log detail modal ───────────────────────────────────────────── */}
      <IntakeLogDetailModal
        item={selectedIntakeLog}
        onClose={() => setSelectedIntakeLog(null)}
        onOpenLead={onOpenLead}
      />
    </div>
  );
}
