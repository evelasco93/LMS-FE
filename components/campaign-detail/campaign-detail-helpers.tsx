import { useState } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import { normalizeFieldLabel } from "@/lib/utils";
import type {
  AffiliateSoldPixelConfig,
  AuditLogItem,
  CampaignParticipantStatus,
  ClientDeliveryConfig,
  LogicRule,
} from "@/lib/types";

export const CONFIG_AUDIT_ACTIONS = new Set([
  "criteria_field_added",
  "criteria_field_updated",
  "criteria_field_deleted",
  "logic_rule_added",
  "logic_rule_updated",
  "logic_rule_deleted",
  "plugins_updated",
  "mappings_updated",
]);

function auditActionLabel(action: string): string {
  const labels: Record<string, string> = {
    created: "Created",
    updated: "Updated",
    deleted: "Deleted",
    soft_deleted: "Deactivated",
    restored: "Restored",
    status_changed: "Status Changed",
    delivery_config_updated: "Delivery Config Updated",
    distribution_updated: "Distribution Updated",
    lead_delivered: "Lead Delivered",
    delivery_skipped: "Delivery Skipped",
    weight_updated: "End User Weight Updated",
    mappings_updated: "Mappings Updated",
    plugins_updated: "Plugins Updated",
  };
  return (
    labels[action] ??
    action
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
  );
}

function isComplexValue(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === "object") return true;
  if (typeof val === "string" && (val === "[previous]" || val === "[updated]"))
    return true;
  return false;
}

function formatAuditVal(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "true" : "false";
  return String(val);
}

function stableAuditValue(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[object]";
    }
  }
  return String(value);
}

export function getMeaningfulAuditChanges(item: AuditLogItem) {
  return item.changes.filter(
    (change) => stableAuditValue(change.from) !== stableAuditValue(change.to),
  );
}

function formatDistributionValue(value: unknown): string {
  if (!value || typeof value !== "object") return formatAuditVal(value);
  const distribution = value as Record<string, unknown>;
  const mode =
    distribution.mode === "round_robin"
      ? "Round Robin"
      : distribution.mode === "weighted"
        ? "Weighted"
        : "Unknown";
  const enabled =
    typeof distribution.enabled === "boolean"
      ? distribution.enabled
        ? "Enabled"
        : "Disabled"
      : undefined;
  return enabled ? `${mode} · ${enabled}` : mode;
}

function formatAuditFieldLabel(
  field: string,
  clientNameById: Map<string, string>,
  affiliateNameById: Map<string, string>,
): string {
  if (field === "distribution") return "Distribution";

  const clientMatch = field.match(/^clients\.([^.]+)\.(.+)$/);
  if (clientMatch) {
    const [, clientId, suffix] = clientMatch;
    const clientName = clientNameById.get(clientId) ?? clientId;
    const baseLabel =
      suffix === "client_id"
        ? "Linked End User"
        : suffix === "status"
          ? "End User Status"
          : suffix === "delivery_config"
            ? "End User Delivery Config"
            : suffix === "weight"
              ? "End User Weight"
              : `End User ${normalizeFieldLabel(suffix)}`;
    return `${baseLabel} · ${clientName}`;
  }

  const affiliateMatch = field.match(/^affiliates\.([^.]+)\.(.+)$/);
  if (affiliateMatch) {
    const [, affiliateId, suffix] = affiliateMatch;
    const affiliateName = affiliateNameById.get(affiliateId) ?? affiliateId;
    const baseLabel =
      suffix === "affiliate_id"
        ? "Linked Source"
        : suffix === "status"
          ? "Source Status"
          : suffix === "campaign_key"
            ? "Source Campaign Key"
            : suffix === "sold_pixel_config"
              ? "Source Sold Webhook Config"
              : suffix === "lead_cap"
                ? "Source Lead Cap"
                : `Source ${normalizeFieldLabel(suffix)}`;
    return `${baseLabel} · ${affiliateName}`;
  }

  return normalizeFieldLabel(field.replace(/^payload\./, ""));
}

function formatAuditChangeValue(
  value: unknown,
  field: string,
  clientNameById: Map<string, string>,
  affiliateNameById: Map<string, string>,
): string {
  if (field === "distribution") return formatDistributionValue(value);

  if (field.endsWith(".client_id") && typeof value === "string") {
    return clientNameById.get(value) ?? value;
  }

  if (field.endsWith(".affiliate_id") && typeof value === "string") {
    return affiliateNameById.get(value) ?? value;
  }

  if (isComplexValue(value)) {
    try {
      return JSON.stringify(value);
    } catch {
      return "[complex value]";
    }
  }

  return formatAuditVal(value);
}

function formatLogDate(value: string): string {
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

export function CampaignAuditRow({
  item,
  clientNameById,
  affiliateNameById,
}: {
  item: AuditLogItem;
  clientNameById: Map<string, string>;
  affiliateNameById: Map<string, string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const actor = item.actor
    ? item.actor.full_name ||
      item.actor.email ||
      item.actor.username ||
      "Unknown"
    : "System";
  const changes = getMeaningfulAuditChanges(item);
  const hasChanges = changes.length > 0;

  return (
    <div>
      <button
        type="button"
        onClick={() => hasChanges && setExpanded((v) => !v)}
        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
          hasChanges
            ? "cursor-pointer hover:bg-[--color-bg-muted]"
            : "cursor-default"
        } ${expanded ? "bg-[--color-bg-muted]" : ""}`}
      >
        <span className="w-48 shrink-0 text-[11px] text-[--color-text-muted]">
          {item.changed_at ? formatLogDate(item.changed_at) : "—"}
        </span>
        <span className="w-32 shrink-0 truncate text-sm font-medium text-[--color-text]">
          {actor}
        </span>
        <span className="flex flex-1 items-center gap-1.5 truncate text-sm text-[--color-text-muted]">
          {auditActionLabel(item.action)}
        </span>
        {hasChanges && (
          <ChevronDown
            size={14}
            className={`shrink-0 text-[--color-text-muted] transition-transform duration-150 ${
              expanded ? "rotate-180" : ""
            }`}
          />
        )}
      </button>
      {expanded && hasChanges && (
        <div className="border-t border-[--color-border] bg-[--color-bg-muted] px-4 py-3">
          <div className="space-y-2 pl-2">
            {changes.map((ch, i) => {
              const isAddedValue = ch.from == null && ch.to != null;
              return (
                <div
                  key={i}
                  className="grid grid-cols-[10rem_1fr] items-start gap-2 text-[11px]"
                >
                  <span className="truncate font-medium text-[--color-text]">
                    {formatAuditFieldLabel(
                      ch.field,
                      clientNameById,
                      affiliateNameById,
                    )}
                  </span>
                  {isAddedValue ? (
                    <span className="font-medium text-[--color-text]">
                      {formatAuditChangeValue(
                        ch.to,
                        ch.field,
                        clientNameById,
                        affiliateNameById,
                      )}
                    </span>
                  ) : (
                    <span className="flex min-w-0 items-center gap-1.5 text-[--color-text-muted]">
                      <span className="max-w-[140px] truncate line-through">
                        {formatAuditChangeValue(
                          ch.from,
                          ch.field,
                          clientNameById,
                          affiliateNameById,
                        )}
                      </span>
                      <ArrowRight size={9} className="shrink-0" />
                      <span className="max-w-[140px] truncate font-medium text-[--color-text]">
                        {formatAuditChangeValue(
                          ch.to,
                          ch.field,
                          clientNameById,
                          affiliateNameById,
                        )}
                      </span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function leadModeFromAffiliateStatus(
  status?: CampaignParticipantStatus,
): "all" | "test" | "live" {
  if (status === "LIVE") return "live";
  if (status === "TEST") return "test";
  return "all";
}

export function defaultDeliveryConfig(): ClientDeliveryConfig {
  return {
    url: "",
    method: "POST",
    payload_mapping: [],
    acceptance_rules: [],
  };
}

export function defaultAffiliatePixelConfig(): AffiliateSoldPixelConfig {
  return {
    enabled: false,
    url: "",
    method: "POST",
    payload_mapping: [],
  };
}

export function normalizeDeliveryMappingRows(
  rows: ClientDeliveryConfig["payload_mapping"] | undefined,
): ClientDeliveryConfig["payload_mapping"] {
  if (!rows?.length) return [];
  return rows.map((row) => ({
    ...row,
    parameter_target: row.parameter_target ?? "body",
  }));
}

export function normalizePixelMappingRows(
  rows: AffiliateSoldPixelConfig["payload_mapping"] | undefined,
  fallbackMode: "query" | "body" = "query",
): AffiliateSoldPixelConfig["payload_mapping"] {
  if (!rows?.length) return [];
  return rows.map((row) => ({
    ...row,
    parameter_target: row.parameter_target ?? fallbackMode,
  }));
}

export function formatLogicOperatorLabel(operator: string): string {
  return operator
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatLogicConditionValue(value?: string | string[]): string {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "(empty)";
  }
  if (value === undefined || value === null || value === "") return "(empty)";
  return String(value);
}

export function toLogicCatalogRulesPayload(rules: LogicRule[]) {
  return rules.map((rule) => ({
    name: rule.name,
    enabled: rule.enabled,
    conditions: (rule.conditions ?? []).map((condition) => ({
      field_name: condition.field_name,
      operator: condition.operator,
      ...(condition.value !== undefined ? { value: condition.value } : {}),
    })),
  }));
}
