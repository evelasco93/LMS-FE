import React from "react";
import {
  Activity,
  Building2,
  GitBranch,
  KeyRound,
  LayoutTemplate,
  Megaphone,
  Plug,
  SlidersHorizontal,
  Target,
  UserCog,
  Users,
} from "lucide-react";
import { normalizeFieldLabel } from "@/lib/utils";
import { AuditActor, AuditChange } from "@/lib/types";

export function isComplexValue(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === "object") return true;
  if (typeof val === "string" && (val === "[previous]" || val === "[updated]"))
    return true;
  return false;
}

export function formatAuditValue(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "object") return "...";
  return String(val);
}

export function resolveAuditActor(actor?: AuditActor | null): string {
  if (!actor) return "System";
  return actor.full_name || actor.email || actor.username || "Unknown";
}

export function auditActionLabel(action: string): string {
  return action
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function auditActionTone(
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

export function getEntityTypeMeta(type: string) {
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

export function formatLogDate(value?: string): string {
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

export function summarizeTablePreferenceConfig(value: unknown): string | null {
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

export function renderLeadStructuredAuditChange(
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

export function humanizeAuditValue(raw: unknown): string {
  if (raw === null || raw === undefined || raw === "") return "—";

  if (Array.isArray(raw)) {
    const compact = raw
      .map((entry) => {
        if (entry && typeof entry === "object") {
          const asObj = entry as Record<string, unknown>;
          if (typeof asObj.name === "string" && asObj.name.trim().length > 0) {
            return asObj.name;
          }
          if (typeof asObj.id === "string") return asObj.id;
        }
        return String(entry);
      })
      .filter(Boolean);
    return compact.length > 0 ? compact.join(", ") : "—";
  }

  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;

    if (typeof obj.name === "string" && obj.name.trim().length > 0) {
      return obj.name;
    }

    if (typeof obj.label === "string" && obj.label.trim().length > 0) {
      return obj.label;
    }

    if (typeof obj.field_name === "string") {
      const required = obj.required === true ? " (required)" : "";
      return `${normalizeFieldLabel(obj.field_name)}${required}`;
    }

    if (typeof obj.id === "string") {
      return obj.id;
    }

    if (typeof obj.full_name === "string") {
      return obj.full_name;
    }

    if (typeof obj.email === "string") {
      return obj.email;
    }

    try {
      return JSON.stringify(obj);
    } catch {
      return String(raw);
    }
  }

  return String(raw);
}
