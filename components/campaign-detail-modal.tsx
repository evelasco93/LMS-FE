"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FileText,
  Flame,
  Gauge,
  GitBranch,
  HandHeart,
  History,
  Settings2,
  Info,
  KeyRound,
  LayoutGrid,
  Link2,
  Pencil,
  Plug,
  Plus,
  RotateCcw,
  Tag,
  Upload,
  Trash2,
  Users,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/modal";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import {
  SectionLabel,
  InfoItem,
  DisabledTooltip,
  HoverTooltip,
  AuditPopover,
} from "@/components/shared-ui";
import {
  LinkClientModal,
  LinkAffiliateModal,
} from "@/components/modals/entity-modals";
import {
  LogicBuilderModal,
  type LogicRuleDraft,
} from "@/components/modals/logic-builder-modal";
import {
  formatDateTime,
  statusColorMap,
  inputClass,
  normalizeFieldLabel,
} from "@/lib/utils";
import {
  listUsers,
  listPluginSettings,
  listCriteria,
  createCriteriaField,
  updateCriteriaField,
  deleteCriteriaField,
  updateCriteriaValueMappings,
  listLogicRules,
  createLogicRule,
  updateLogicRule,
  deleteLogicRule,
  getEntityAudit,
  listCriteriaCatalog,
  getCriteriaCatalogSet,
  createCriteriaCatalogSet,
  updateCriteriaCatalogSet,
  updateLogicCatalogSet,
  deleteCriteriaCatalogSet,
  applyCriteriaCatalog,
  listLogicCatalog,
  getLogicCatalogSet,
  createLogicCatalogSet,
  applyLogicCatalog,
  listAffiliateLogicRules,
  createAffiliateLogicRule,
  updateAffiliateLogicRule,
  deleteAffiliateLogicRule,
  applyLogicCatalogToAffiliate,
  listClientLogicRules,
  createClientLogicRule,
  updateClientLogicRule,
  deleteClientLogicRule,
  applyLogicCatalogToClient,
  syncClientLogicToCampaign,
  listAffiliatePixelCriteria,
  createAffiliatePixelCriterion,
  updateAffiliatePixelCriterion,
  deleteAffiliatePixelCriterion,
  listAffiliateSoldCriteria,
  createAffiliateSoldCriterion,
  updateAffiliateSoldCriterion,
  deleteAffiliateSoldCriterion,
  updateAffiliateCherryPickOverride,
  updateCampaign,
  listTagDefinitions,
  setCampaignTags,
} from "@/lib/api";
import type {
  Affiliate,
  AffiliateSoldPixelConfig,
  AuditLogItem,
  Campaign,
  ClientDeliveryConfig,
  Client,
  CognitoUser,
  CriteriaField,
  CriteriaFieldOption,
  CriteriaFieldType,
  CriteriaValueMapping,
  CriteriaCatalogSet,
  CriteriaCatalogVersion,
  LogicCatalogSet,
  LogicCatalogVersion,
  DistributionMode,
  Lead,
  LogicRule,
  PluginSettingRecord,
  TagDefinitionRecord,
} from "@/lib/types";
import type {
  CampaignAffiliate,
  CampaignClient,
  CampaignDetailTab,
  CampaignParticipantStatus,
} from "@/lib/types";
import { generatePostingInstructions } from "@/lib/generate-posting-instructions";

// ─── Catalog field draft type (used when creating/editing catalog sets) ──────
type CatalogFieldDraft = {
  field_label: string;
  field_name: string;
  data_type: CriteriaFieldType;
  required: boolean;
  description: string;
  state_mapping: "abbr_to_name" | "name_to_abbr" | null;
};

const CONFIG_AUDIT_ACTIONS = new Set([
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
    weight_updated: "Client Weight Updated",
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

function auditActionTone(
  action: string,
): "success" | "danger" | "warning" | "info" | "neutral" {
  if (
    action === "created" ||
    action === "restored" ||
    action === "lead_delivered"
  )
    return "success";
  if (action === "deleted" || action === "soft_deleted") return "danger";
  if (action === "status_changed" || action === "delivery_skipped")
    return "warning";
  if (
    action === "updated" ||
    action === "delivery_config_updated" ||
    action === "distribution_updated" ||
    action === "weight_updated" ||
    action.endsWith("_added") ||
    action.endsWith("_updated") ||
    action === "mappings_updated" ||
    action === "plugins_updated"
  )
    return "info";
  return "neutral";
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

function getMeaningfulAuditChanges(item: AuditLogItem) {
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
        ? "Linked Client"
        : suffix === "status"
          ? "Client Status"
          : suffix === "delivery_config"
            ? "Client Delivery Config"
            : suffix === "weight"
              ? "Client Weight"
              : `Client ${normalizeFieldLabel(suffix)}`;
    return `${baseLabel} · ${clientName}`;
  }

  const affiliateMatch = field.match(/^affiliates\.([^.]+)\.(.+)$/);
  if (affiliateMatch) {
    const [, affiliateId, suffix] = affiliateMatch;
    const affiliateName = affiliateNameById.get(affiliateId) ?? affiliateId;
    const baseLabel =
      suffix === "affiliate_id"
        ? "Linked Affiliate"
        : suffix === "status"
          ? "Affiliate Status"
          : suffix === "campaign_key"
            ? "Affiliate Campaign Key"
            : suffix === "sold_pixel_config"
              ? "Affiliate Sold Pixel Config"
              : suffix === "lead_cap"
                ? "Affiliate Lead Cap"
                : `Affiliate ${normalizeFieldLabel(suffix)}`;
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
  return `${d} \u00b7 ${t}`;
}

// ── CampaignAuditRow ──────────────────────────────────────────────────────────

function CampaignAuditRow({
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
          {item.changed_at ? formatLogDate(item.changed_at) : "\u2014"}
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

function leadModeFromAffiliateStatus(
  status?: CampaignParticipantStatus,
): "all" | "test" | "live" {
  if (status === "LIVE") return "live";
  if (status === "TEST") return "test";
  return "all";
}

function defaultDeliveryConfig(): ClientDeliveryConfig {
  return {
    url: "",
    method: "POST",
    payload_mapping: [],
    acceptance_rules: [],
  };
}

function defaultAffiliatePixelConfig(): AffiliateSoldPixelConfig {
  return {
    enabled: false,
    url: "",
    method: "POST",
    payload_mapping: [],
  };
}

function normalizeDeliveryMappingRows(
  rows: ClientDeliveryConfig["payload_mapping"] | undefined,
): ClientDeliveryConfig["payload_mapping"] {
  if (!rows?.length) return [];
  return rows.map((row) => ({
    ...row,
    parameter_target: row.parameter_target ?? "body",
  }));
}

function normalizePixelMappingRows(
  rows: AffiliateSoldPixelConfig["payload_mapping"] | undefined,
  fallbackMode: "query" | "body" = "query",
): AffiliateSoldPixelConfig["payload_mapping"] {
  if (!rows?.length) return [];
  return rows.map((row) => ({
    ...row,
    parameter_target: row.parameter_target ?? fallbackMode,
  }));
}

function formatLogicOperatorLabel(operator: string): string {
  return operator
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatLogicConditionValue(value?: string | string[]): string {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "(empty)";
  }
  if (value === undefined || value === null || value === "") return "(empty)";
  return String(value);
}

function toLogicCatalogRulesPayload(rules: LogicRule[]) {
  return rules.map((rule) => ({
    name: rule.name,
    action: rule.action,
    enabled: rule.enabled,
    groups: rule.groups.map((group) => ({
      conditions: group.conditions.map((condition) => ({
        field_name: condition.field_name,
        operator: condition.operator,
        ...(condition.value !== undefined ? { value: condition.value } : {}),
      })),
    })),
  }));
}

export function CampaignDetailModal({
  campaign,
  clients,
  affiliates,
  leads,
  isOpen,
  onClose,
  onStatusChange,
  onLinkClient,
  onLinkAffiliate,
  onUpdateClientStatus,
  onUpdateAffiliateStatus,
  onRemoveClient,
  onRemoveAffiliate,
  onUpdatePlugins,
  onUpdateName,
  onRotateParticipantKey,
  onUpdateAffiliateLeadCap,
  onUpdateAffiliateSoldPixelConfig,
  onUpdateClientDeliveryConfig,
  onUpdateCampaignDistribution,
  onUpdateClientWeight,
  onOpenLeadsForCampaign,
  tab,
  onTabChange,
  focusAffiliateId,
  subTab,
  onSubTabChange,
  onCampaignUpdate,
}: {
  campaign: Campaign | null;
  clients: Client[];
  affiliates: Affiliate[];
  leads: Lead[];
  isOpen: boolean;
  onClose: () => void;
  onStatusChange: (id: string, status: Campaign["status"]) => Promise<boolean>;
  onLinkClient: (campaignId: string, clientId: string) => Promise<void>;
  onLinkAffiliate: (campaignId: string, affiliateId: string) => Promise<void>;
  onUpdateClientStatus: (
    campaignId: string,
    clientId: string,
    status: CampaignParticipantStatus,
  ) => Promise<void>;
  onUpdateAffiliateStatus: (
    campaignId: string,
    affiliateId: string,
    status: CampaignParticipantStatus,
  ) => Promise<void>;
  onRemoveClient: (campaignId: string, clientId: string) => Promise<void>;
  onRemoveAffiliate: (campaignId: string, affiliateId: string) => Promise<void>;
  onUpdatePlugins: (
    campaignId: string,
    payload: {
      duplicate_check?: {
        enabled?: boolean;
        criteria?: Array<"phone" | "email">;
      };
      trusted_form?: {
        enabled?: boolean;
        stage?: number;
        gate?: boolean;
      };
      ipqs?: {
        enabled?: boolean;
        stage?: number;
        gate?: boolean;
        phone?: { enabled?: boolean; criteria?: Record<string, unknown> };
        email?: { enabled?: boolean; criteria?: Record<string, unknown> };
        ip?: { enabled?: boolean; criteria?: Record<string, unknown> };
      };
    },
  ) => Promise<void>;
  onUpdateName: (campaignId: string, name: string) => Promise<void>;
  onRotateParticipantKey: (
    campaignId: string,
    type: "client" | "affiliate",
    participantId: string,
  ) => Promise<void>;
  onUpdateAffiliateLeadCap: (
    campaignId: string,
    affiliateId: string,
    leadCap: number | null,
  ) => Promise<void>;
  onUpdateAffiliateSoldPixelConfig: (
    campaignId: string,
    affiliateId: string,
    payload: AffiliateSoldPixelConfig,
  ) => Promise<void>;
  onUpdateClientDeliveryConfig: (
    campaignId: string,
    clientId: string,
    payload: ClientDeliveryConfig,
  ) => Promise<void>;
  onUpdateCampaignDistribution: (
    campaignId: string,
    payload: {
      mode: DistributionMode;
      enabled: boolean;
    },
  ) => Promise<void>;
  onUpdateClientWeight: (
    campaignId: string,
    clientId: string,
    deliveryConfig: ClientDeliveryConfig,
    weight: number,
  ) => Promise<void>;
  onOpenLeadsForCampaign: (
    campaignId: string,
    options?: { affiliateId?: string; mode?: "all" | "test" | "live" },
  ) => void;
  tab: CampaignDetailTab;
  onTabChange: (
    tab: CampaignDetailTab,
    subTab?: "base-criteria" | "logic" | "routing",
  ) => void;
  focusAffiliateId: string | null;
  subTab?: "base-criteria" | "logic" | "routing";
  onSubTabChange?: (sub: "base-criteria" | "logic" | "routing") => void;
  onCampaignUpdate?: (update: Partial<Campaign>) => void;
}) {
  const [titleEditing, setTitleEditing] = useState(false);
  const [savingTitle, setSavingTitle] = useState(false);
  const [linkClientModalOpen, setLinkClientModalOpen] = useState(false);
  const [linkAffiliateModalOpen, setLinkAffiliateModalOpen] = useState(false);
  const participantStatusOptions: CampaignParticipantStatus[] = [
    "TEST",
    "LIVE",
    "DISABLED",
  ];
  const [participantAction, setParticipantAction] = useState<{
    type: "client" | "affiliate";
    id: string;
    statusDraft: CampaignParticipantStatus;
  } | null>(null);
  const [confirmRotateKey, setConfirmRotateKey] = useState(false);
  const [pixelConfigTab, setPixelConfigTab] = useState<
    "pixel" | "pixel_criteria" | "sold_criteria"
  >("pixel");
  const [generatingPdfForAffiliate, setGeneratingPdfForAffiliate] = useState<
    string | null
  >(null);
  const [openInfoId, setOpenInfoId] = useState<string | null>(null);
  const [openHistoryId, setOpenHistoryId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [configActivityOpen, setConfigActivityOpen] = useState(false);
  const [expandedAuditIds, setExpandedAuditIds] = useState<Set<string>>(
    new Set(),
  );

  const campaignChangeHistory = useMemo(() => {
    type Actor =
      | string
      | {
          username?: string;
          email?: string;
          full_name?: string;
          first_name?: string;
          last_name?: string;
        }
      | null
      | undefined;
    type StatusEntry = {
      kind: "status";
      from?: string;
      to: string;
      changed_at: string;
      changed_by?: Actor;
    };
    type NameEntry = {
      kind: "name";
      previous_value?: unknown;
      new_value?: unknown;
      changed_at: string;
      changed_by?: Actor;
    };
    const entries: Array<StatusEntry | NameEntry> = [
      ...(campaign?.status_history ?? []).map(
        (s): StatusEntry => ({
          kind: "status",
          ...s,
          // API doesn't include per-entry changed_by for status changes; fall back
          // to campaign.updated_by for user-initiated transitions (those with a `from`)
          changed_by:
            (s as { changed_by?: Actor }).changed_by ??
            (s.from != null ? (campaign?.updated_by as Actor) : undefined),
        }),
      ),
      ...(campaign?.edit_history ?? [])
        .filter((e) => e.field === "name")
        .map(
          (e): NameEntry => ({
            kind: "name",
            previous_value: e.previous_value,
            new_value: e.new_value,
            changed_at: e.changed_at,
            changed_by: e.changed_by ?? null,
          }),
        ),
    ];
    return entries.sort(
      (a, b) =>
        new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime(),
    );
  }, [campaign]);
  const [nameDraft, setNameDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState<Campaign["status"]>("DRAFT");
  const [duplicateCheckEnabled, setDuplicateCheckEnabled] = useState(true);
  const [duplicateCheckCriteria, setDuplicateCheckCriteria] = useState<
    Array<"phone" | "email">
  >(["phone", "email"]);
  const [trustedFormEnabled, setTrustedFormEnabled] = useState(true);
  const [trustedFormGate, setTrustedFormGate] = useState(true);
  const [ipqsGate, setIpqsGate] = useState(true);
  const [tfStep, setTfStep] = useState(2);
  const [ipqsStep, setIpqsStep] = useState(3);
  const [tfStepEditing, setTfStepEditing] = useState(false);
  const [ipqsStepEditing, setIpqsStepEditing] = useState(false);

  // ── Settings tab ─────────────────────────────────────────────────────────
  const [settingsSubTab, setSettingsSubTab] = useState<
    "base-criteria" | "logic" | "routing"
  >("base-criteria");

  useEffect(() => {
    if (subTab) setSettingsSubTab(subTab);
  }, [subTab]);

  const handleSubTabChange = (sub: "base-criteria" | "logic" | "routing") => {
    setSettingsSubTab(sub);
    onSubTabChange?.(sub);
  };

  // ── Criteria Catalog states ──────────────────────────────────────────────
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSets, setCatalogSets] = useState<CriteriaCatalogSet[]>([]);
  const [expandedSetId, setExpandedSetId] = useState<string | null>(null);
  const [setVersionsMap, setSetVersionsMap] = useState<
    Record<string, CriteriaCatalogVersion[]>
  >({});
  const [loadingVersionsFor, setLoadingVersionsFor] = useState<string | null>(
    null,
  );
  const [applyingCatalog, setApplyingCatalog] = useState<string | null>(null);
  const [catalogFormMode, setCatalogFormMode] = useState<
    "browse" | "create" | "edit"
  >("browse");
  const [editingCatalogSet, setEditingCatalogSet] =
    useState<CriteriaCatalogSet | null>(null);
  const [catalogFormDraft, setCatalogFormDraft] = useState({
    name: "",
    description: "",
  });
  const [catalogFieldDrafts, setCatalogFieldDrafts] = useState<
    CatalogFieldDraft[]
  >([]);
  const [savingCatalog, setSavingCatalog] = useState(false);
  const [catalogBulkImportOpen, setCatalogBulkImportOpen] = useState(false);
  const [catalogBulkImportText, setCatalogBulkImportText] = useState("");
  const [campaignBulkImportOpen, setCampaignBulkImportOpen] = useState(false);
  const [campaignBulkImportText, setCampaignBulkImportText] = useState("");
  const [campaignBulkImporting, setCampaignBulkImporting] = useState(false);
  const [confirmDeleteSet, setConfirmDeleteSet] =
    useState<CriteriaCatalogSet | null>(null);
  const [deletingSet, setDeletingSet] = useState(false);
  // Set of "{setId}#v{version}" keys whose field list is expanded
  const [expandedVersionFields, setExpandedVersionFields] = useState<
    Set<string>
  >(new Set());
  // Track the applied catalog on this campaign (local mirror of campaign.criteria_set_*)
  const [localCriteriaSetId, setLocalCriteriaSetId] = useState<string | null>(
    campaign?.criteria_set_id ?? null,
  );
  const [localCriteriaSetVersion, setLocalCriteriaSetVersion] = useState<
    number | null
  >(campaign?.criteria_set_version ?? null);
  const [localCriteriaSetName, setLocalCriteriaSetName] = useState<
    string | null
  >(null);

  // ── Logic Catalog states ─────────────────────────────────────────────────
  const [logicCatalogOpen, setLogicCatalogOpen] = useState(false);
  const [logicCatalogLoading, setLogicCatalogLoading] = useState(false);
  const [logicCatalogSets, setLogicCatalogSets] = useState<LogicCatalogSet[]>(
    [],
  );
  const [expandedLogicSetId, setExpandedLogicSetId] = useState<string | null>(
    null,
  );
  const [logicSetVersionsMap, setLogicSetVersionsMap] = useState<
    Record<string, LogicCatalogVersion[]>
  >({});
  const [loadingLogicVersionsFor, setLoadingLogicVersionsFor] = useState<
    string | null
  >(null);
  const [applyingLogicCatalog, setApplyingLogicCatalog] = useState<
    string | null
  >(null);
  const [expandedLogicVersionRules, setExpandedLogicVersionRules] = useState<
    Set<string>
  >(new Set());
  const [expandedLogicRuleDetails, setExpandedLogicRuleDetails] = useState<
    Set<string>
  >(new Set());
  const [saveLogicToSetOpen, setSaveLogicToSetOpen] = useState(false);
  const [saveLogicToSetMode, setSaveLogicToSetMode] = useState<
    "new_version" | "new_set"
  >("new_set");
  const [saveLogicToSetDraft, setSaveLogicToSetDraft] = useState({
    name: "",
    description: "",
  });
  const [savingLogicToSet, setSavingLogicToSet] = useState(false);
  // Campaign tags edit state
  const [editTagsOpen, setEditTagsOpen] = useState(false);
  const [tagDefinitions, setTagDefinitions] = useState<TagDefinitionRecord[]>(
    [],
  );
  const [tagDraft, setTagDraft] = useState<string[]>([]);
  const [savingTags, setSavingTags] = useState(false);
  const [localLogicSetId, setLocalLogicSetId] = useState<string | null>(
    campaign?.logic_set_id ?? null,
  );
  const [localLogicSetVersion, setLocalLogicSetVersion] = useState<
    number | null
  >(campaign?.logic_set_version ?? null);
  const [localLogicSetName, setLocalLogicSetName] = useState<string | null>(
    null,
  );

  // Sync applied-catalog state whenever a different campaign is opened.
  // (useState initializer only runs once on mount, so we need this effect.)
  useEffect(() => {
    setLocalCriteriaSetId(campaign?.criteria_set_id ?? null);
    setLocalCriteriaSetVersion(campaign?.criteria_set_version ?? null);
    setLocalCriteriaSetName(null);
    setLocalLogicSetId(campaign?.logic_set_id ?? null);
    setLocalLogicSetVersion(campaign?.logic_set_version ?? null);
    setLocalLogicSetName(null);
    setSaveLogicToSetMode(campaign?.logic_set_id ? "new_version" : "new_set");
    setTagDraft(campaign?.tags ?? []);
  }, [campaign?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!localCriteriaSetId || localCriteriaSetName) return;
    let cancelled = false;
    getCriteriaCatalogSet(localCriteriaSetId)
      .then((res) => {
        if (!cancelled && res.success) {
          setLocalCriteriaSetName(res.data.set.name);
        }
      })
      .catch(() => {
        /* silent */
      });
    return () => {
      cancelled = true;
    };
  }, [localCriteriaSetId, localCriteriaSetName]);

  useEffect(() => {
    if (!localLogicSetId || localLogicSetName) return;
    let cancelled = false;
    getLogicCatalogSet(localLogicSetId)
      .then((res) => {
        if (!cancelled && res.success) {
          setLocalLogicSetName(res.data.set.name);
        }
      })
      .catch(() => {
        /* silent */
      });
    return () => {
      cancelled = true;
    };
  }, [localLogicSetId, localLogicSetName]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    listTagDefinitions()
      .then((res) => {
        if (cancelled) return;
        const items = res?.data?.items ?? [];
        setTagDefinitions(items.filter((item) => !item.is_deleted));
      })
      .catch(() => {
        if (!cancelled) setTagDefinitions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    setTagDraft(campaign?.tags ?? []);
  }, [campaign?.id, campaign?.tags]);

  const [addFieldOpen, setAddFieldOpen] = useState(false);
  const [editFieldData, setEditFieldData] = useState<CriteriaField | null>(
    null,
  );
  const [listMappingsField, setListMappingsField] =
    useState<CriteriaField | null>(null);
  const [listMappingsDraft, setListMappingsDraft] = useState<
    CriteriaFieldOption[]
  >([]);
  const [listMappingsSaving, setListMappingsSaving] = useState(false);
  // value mappings modal
  const [valueMappingsField, setValueMappingsField] =
    useState<CriteriaField | null>(null);
  const [valueMappingsDraft, setValueMappingsDraft] = useState<
    { fromText: string; to: string }[]
  >([]);
  const [valueMappingsStateDraft, setValueMappingsStateDraft] = useState<
    "abbr_to_name" | "name_to_abbr" | null
  >(null);
  const [valueMappingsSaving, setValueMappingsSaving] = useState(false);
  // options list editor tabs
  const [optionsTab, setOptionsTab] = useState<"manual" | "bulk">("manual");
  const [optionsBulkText, setOptionsBulkText] = useState("");
  const [deleteFieldTarget, setDeleteFieldTarget] =
    useState<CriteriaField | null>(null);
  const [deletingField, setDeletingField] = useState(false);
  const emptyFieldDraft = {
    field_label: "",
    field_name: "",
    data_type: "Text" as CriteriaFieldType,
    required: true,
    description: "",
    state_mapping: null as "abbr_to_name" | "name_to_abbr" | null,
    options: [] as CriteriaFieldOption[],
  };
  const [fieldDraft, setFieldDraft] = useState<{
    field_label: string;
    field_name: string;
    data_type: CriteriaFieldType;
    required: boolean;
    description: string;
    state_mapping: "abbr_to_name" | "name_to_abbr" | null;
    options: CriteriaFieldOption[];
  }>(emptyFieldDraft);
  const [fieldSaving, setFieldSaving] = useState(false);

  const [localClientLinks, setLocalClientLinks] = useState<
    NonNullable<Campaign["clients"]>
  >(campaign?.clients ?? []);
  const [localAffiliateLinks, setLocalAffiliateLinks] = useState<
    NonNullable<Campaign["affiliates"]>
  >(campaign?.affiliates ?? []);
  const [affiliateCapDraft, setAffiliateCapDraft] = useState("");
  const [savingAffiliateCap, setSavingAffiliateCap] = useState(false);
  const [affiliateCapModalId, setAffiliateCapModalId] = useState<string | null>(
    null,
  );

  const [deliveryClientId, setDeliveryClientId] = useState<string | null>(null);
  const [deliveryTab, setDeliveryTab] = useState<"request" | "response">(
    "request",
  );
  const [deliveryDraft, setDeliveryDraft] = useState<ClientDeliveryConfig>(
    defaultDeliveryConfig(),
  );
  const [savingDeliveryConfig, setSavingDeliveryConfig] = useState(false);
  const [deliverySaveAttempted, setDeliverySaveAttempted] = useState(false);
  const deliveryHasUrl = deliveryDraft.url.trim().length > 0;
  const deliveryHasMappings =
    deliveryDraft.payload_mapping.length > 0 &&
    deliveryDraft.payload_mapping.every(
      (m) =>
        m.key.trim().length > 0 &&
        (m.parameter_target === undefined ||
          m.parameter_target === "query" ||
          m.parameter_target === "body") &&
        (m.value_source === "field"
          ? (m.field_name ?? "").trim().length > 0
          : String(m.static_value ?? "").trim().length > 0),
    );
  const deliveryHasValidationRule =
    deliveryDraft.acceptance_rules.length > 0 &&
    deliveryDraft.acceptance_rules.every(
      (r) => r.match_value.trim().length > 0,
    );
  const deliveryInvalidUrl = deliverySaveAttempted && !deliveryHasUrl;
  const deliveryInvalidMappings = deliverySaveAttempted && !deliveryHasMappings;
  const deliveryInvalidRules =
    deliverySaveAttempted && !deliveryHasValidationRule;
  const deliverySaveDisabledReason = !deliveryHasValidationRule
    ? "Add at least one complete response validation rule before saving."
    : !deliveryHasUrl
      ? "Webhook URL is required."
      : !deliveryHasMappings
        ? "Add at least one complete payload mapping before saving."
        : "";

  const [pixelAffiliateId, setPixelAffiliateId] = useState<string | null>(null);
  const [pixelDraft, setPixelDraft] = useState<AffiliateSoldPixelConfig>(
    defaultAffiliatePixelConfig(),
  );
  const [savingPixelConfig, setSavingPixelConfig] = useState(false);
  const [pixelSaveAttempted, setPixelSaveAttempted] = useState(false);
  const pixelHasUrl = pixelDraft.url.trim().length > 0;
  const pixelHasMappings =
    pixelDraft.payload_mapping.length > 0 &&
    pixelDraft.payload_mapping.every(
      (m) =>
        m.key.trim().length > 0 &&
        (m.parameter_target === "query" || m.parameter_target === "body") &&
        (m.value_source === "field"
          ? (m.field_name ?? "").trim().length > 0
          : String(m.static_value ?? "").trim().length > 0),
    );
  const pixelInvalidUrl = pixelSaveAttempted && !pixelHasUrl;
  const pixelInvalidMappings = pixelSaveAttempted && !pixelHasMappings;
  const pixelSaveDisabledReason = !pixelHasUrl
    ? "Pixel URL is required."
    : !pixelHasMappings
      ? "Add at least one complete payload mapping before saving."
      : "";

  const pixelSaveBlockedByEnabledConfig =
    pixelDraft.enabled && (!pixelHasUrl || !pixelHasMappings);
  const pixelFinalSaveDisabledReason = pixelSaveBlockedByEnabledConfig
    ? "Enabled pixels require URL and complete payload mappings."
    : pixelSaveDisabledReason;

  const [deliveryLogicIntroClientId, setDeliveryLogicIntroClientId] = useState<
    string | null
  >(null);
  const [pixelLogicIntroAffiliateId, setPixelLogicIntroAffiliateId] = useState<
    string | null
  >(null);

  // ── Per-affiliate pixel criteria manager ──────────────────────────────────
  const [pixelCriteriaAffiliateId, setPixelCriteriaAffiliateId] = useState<
    string | null
  >(null);
  const [pixelCriteriaRules, setPixelCriteriaRules] = useState<LogicRule[]>([]);
  const [pixelCriteriaLoading, setPixelCriteriaLoading] = useState(false);
  const [pixelCriteriaSaving, setPixelCriteriaSaving] = useState(false);
  const [pixelCriteriaBuilderOpen, setPixelCriteriaBuilderOpen] =
    useState(false);
  const [pixelCriteriaEditingRule, setPixelCriteriaEditingRule] =
    useState<LogicRule | null>(null);
  const [pixelCriteriaDeletingRuleId, setPixelCriteriaDeletingRuleId] =
    useState<string | null>(null);

  // ── Per-affiliate sold criteria manager ───────────────────────────────────
  const [soldCriteriaAffiliateId, setSoldCriteriaAffiliateId] = useState<
    string | null
  >(null);
  const [soldCriteriaRules, setSoldCriteriaRules] = useState<LogicRule[]>([]);
  const [soldCriteriaLoading, setSoldCriteriaLoading] = useState(false);
  const [soldCriteriaSaving, setSoldCriteriaSaving] = useState(false);
  const [soldCriteriaBuilderOpen, setSoldCriteriaBuilderOpen] = useState(false);
  const [soldCriteriaEditingRule, setSoldCriteriaEditingRule] =
    useState<LogicRule | null>(null);
  const [soldCriteriaDeletingRuleId, setSoldCriteriaDeletingRuleId] = useState<
    string | null
  >(null);

  // ── Per-participant logic rule manager ─────────────────────────────────────
  const [participantLogicType, setParticipantLogicType] = useState<
    "affiliate" | "client" | null
  >(null);
  const [participantLogicRules, setParticipantLogicRules] = useState<
    LogicRule[]
  >([]);
  const [participantLogicLoading, setParticipantLogicLoading] = useState(false);
  const [participantLogicSaving, setParticipantLogicSaving] = useState(false);
  const [participantLogicBuilderOpen, setParticipantLogicBuilderOpen] =
    useState(false);
  const [participantLogicEditingRule, setParticipantLogicEditingRule] =
    useState<LogicRule | null>(null);
  const [participantLogicSetId, setParticipantLogicSetId] = useState<
    string | null
  >(null);
  const [participantLogicSetVersion, setParticipantLogicSetVersion] = useState<
    number | null
  >(null);
  const [participantLogicSetName, setParticipantLogicSetName] = useState<
    string | null
  >(null);
  const [participantLogicBaseSetId, setParticipantLogicBaseSetId] = useState<
    string | null
  >(null);
  const [participantLogicBaseSetVersion, setParticipantLogicBaseSetVersion] =
    useState<number | null>(null);
  const [participantLogicBaseSetName, setParticipantLogicBaseSetName] =
    useState<string | null>(null);
  const [participantLogicDeletingRuleId, setParticipantLogicDeletingRuleId] =
    useState<string | null>(null);
  const [participantLogicCatalogOpen, setParticipantLogicCatalogOpen] =
    useState(false);
  const [participantLogicCatalogLoading, setParticipantLogicCatalogLoading] =
    useState(false);
  const [participantLogicCatalogSets, setParticipantLogicCatalogSets] =
    useState<LogicCatalogSet[]>([]);
  const [
    participantLogicApplyingCatalogId,
    setParticipantLogicApplyingCatalogId,
  ] = useState<string | null>(null);
  // Expanded states for participant catalog (version-level browse)
  const [participantExpandedSetId, setParticipantExpandedSetId] = useState<
    string | null
  >(null);
  const [participantSetVersionsMap, setParticipantSetVersionsMap] = useState<
    Record<string, LogicCatalogVersion[]>
  >({});
  const [participantLoadingVersionsFor, setParticipantLoadingVersionsFor] =
    useState<string | null>(null);
  const [participantExpandedVersionRules, setParticipantExpandedVersionRules] =
    useState<Set<string>>(new Set());
  const [participantExpandedRuleDetails, setParticipantExpandedRuleDetails] =
    useState<Set<string>>(new Set());
  // Save-to-catalog states for participant logic
  const [saveParticipantLogicOpen, setSaveParticipantLogicOpen] =
    useState(false);
  const [saveParticipantLogicMode, setSaveParticipantLogicMode] = useState<
    "new_version" | "new_set"
  >("new_set");
  const [saveParticipantLogicDraft, setSaveParticipantLogicDraft] = useState({
    name: "",
    description: "",
  });
  const [savingParticipantLogicToCatalog, setSavingParticipantLogicToCatalog] =
    useState(false);
  const [syncingClientLogicToCampaign, setSyncingClientLogicToCampaign] =
    useState(false);
  const [pinnedBaseLogicViewerOpen, setPinnedBaseLogicViewerOpen] =
    useState(false);
  const [pinnedBaseExpandedRules, setPinnedBaseExpandedRules] = useState<
    Set<string>
  >(new Set());
  // Save-to-catalog states for criteria
  const [saveCriteriaToSetOpen, setSaveCriteriaToSetOpen] = useState(false);
  const [saveCriteriaToSetMode, setSaveCriteriaToSetMode] = useState<
    "new_version" | "new_set"
  >("new_set");
  const [saveCriteriaToSetDraft, setSaveCriteriaToSetDraft] = useState({
    name: "",
    description: "",
  });
  const [savingCriteriaToSet, setSavingCriteriaToSet] = useState(false);
  // ─────────────────────────────────────────────────────────────────────────

  const [routingMode, setRoutingMode] =
    useState<DistributionMode>("round_robin");
  const [routingEnabled, setRoutingEnabled] = useState(false);
  const [routingWeights, setRoutingWeights] = useState<Record<string, number>>(
    {},
  );
  const [savingRouting, setSavingRouting] = useState(false);
  const [confirmModeChange, setConfirmModeChange] =
    useState<DistributionMode | null>(null);

  const [dupCheckOpen, setDupCheckOpen] = useState(false);
  const [trustedFormOpen, setTrustedFormOpen] = useState(false);
  const [ipqsOpen, setIpqsOpen] = useState(false);
  const [integrationsDirty, setIntegrationsDirty] = useState(false);
  const pluginsInitRef = useRef(false);

  // ── IPQS config state ────────────────────────────────────────────────────
  interface IpqsCriterionFraud {
    enabled: boolean;
    operator: "lte" | "gte" | "eq";
    value: number;
  }
  interface IpqsCriterionValid {
    enabled: boolean;
  }
  interface IpqsCriterionCountry {
    enabled: boolean;
    allowed: string;
  } // comma-sep
  interface IpqsCriterionBool {
    enabled: boolean;
    allowed: boolean;
  }
  interface IpqsConfig {
    enabled: boolean;
    phone: {
      enabled: boolean;
      criteria: {
        valid: IpqsCriterionValid;
        fraud_score: IpqsCriterionFraud;
        country: IpqsCriterionCountry;
      };
    };
    email: {
      enabled: boolean;
      criteria: { valid: IpqsCriterionValid; fraud_score: IpqsCriterionFraud };
    };
    ip: {
      enabled: boolean;
      criteria: {
        fraud_score: IpqsCriterionFraud;
        country_code: IpqsCriterionCountry;
        proxy: IpqsCriterionBool;
        vpn: IpqsCriterionBool;
      };
    };
  }
  const defaultIpqsConfig: IpqsConfig = {
    enabled: false,
    phone: {
      enabled: true,
      criteria: {
        valid: { enabled: true },
        fraud_score: { enabled: true, operator: "lte", value: 85 },
        country: { enabled: false, allowed: "" },
      },
    },
    email: {
      enabled: true,
      criteria: {
        valid: { enabled: true },
        fraud_score: { enabled: true, operator: "lte", value: 85 },
      },
    },
    ip: {
      enabled: false,
      criteria: {
        fraud_score: { enabled: true, operator: "lte", value: 85 },
        country_code: { enabled: false, allowed: "" },
        proxy: { enabled: false, allowed: false },
        vpn: { enabled: false, allowed: false },
      },
    },
  };
  const [ipqsConfig, setIpqsConfig] = useState<IpqsConfig>(defaultIpqsConfig);
  const [ipqsPhoneOpen, setIpqsPhoneOpen] = useState(false);
  const [ipqsEmailOpen, setIpqsEmailOpen] = useState(false);
  const [ipqsIpOpen, setIpqsIpOpen] = useState(false);

  const { data: usersData } = useSWR(isOpen ? "users:all" : null, async () => {
    const res = await listUsers();
    return res?.data ?? [];
  });

  const { data: globalPluginSettingsData } = useSWR(
    isOpen ? "plugin-settings:all" : null,
    async () => {
      const res = await listPluginSettings();
      return (res as any)?.data ?? [];
    },
  );
  const globalPluginSettings: PluginSettingRecord[] =
    globalPluginSettingsData ?? [];

  const {
    data: criteriaData,
    mutate: refreshCriteria,
    isLoading: criteriaLoading,
  } = useSWR(
    isOpen &&
      campaign?.id &&
      (tab === "settings" ||
        tab === "affiliates" ||
        tab === "clients" ||
        tab === "overview")
      ? `criteria-${campaign.id}`
      : null,
    () => listCriteria(campaign!.id),
  );
  const criteriaFields: CriteriaField[] = (criteriaData as any)?.data ?? [];

  const {
    data: logicRulesData,
    mutate: refreshLogicRules,
    isLoading: logicRulesLoading,
  } = useSWR(
    isOpen && campaign?.id && (tab === "settings" || tab === "overview")
      ? `logic-rules-${campaign.id}`
      : null,
    () => listLogicRules(campaign!.id),
  );
  const logicRules: LogicRule[] = (logicRulesData as any)?.data ?? [];

  const { data: campaignAuditData } = useSWR(
    isOpen && campaign?.id && (tab === "overview" || tab === "history")
      ? `campaign-audit-${campaign.id}`
      : null,
    () => getEntityAudit(campaign!.id, { limit: 100 }),
    { revalidateOnFocus: true },
  );
  const configAuditItems = useMemo(() => {
    const items = campaignAuditData?.data?.items ?? [];
    return items.filter(
      (item: AuditLogItem) =>
        CONFIG_AUDIT_ACTIONS.has(item.action) &&
        getMeaningfulAuditChanges(item).length > 0,
    );
  }, [campaignAuditData]);
  const allCampaignAuditItems: AuditLogItem[] = useMemo(
    () =>
      [...(campaignAuditData?.data?.items ?? [])]
        .map((item) => ({
          ...item,
          changes: getMeaningfulAuditChanges(item),
        }))
        .filter((item) => item.changes.length > 0 || item.action === "created")
        .sort(
          (a, b) =>
            new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime(),
        ),
    [campaignAuditData],
  );

  // Logic builder state
  const [logicBuilderOpen, setLogicBuilderOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<LogicRule | null>(null);
  const [savingRule, setSavingRule] = useState(false);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);

  const getGlobalPluginDisabled = (provider: string): boolean => {
    const setting = globalPluginSettings.find((ps) => ps.provider === provider);
    return setting ? setting.enabled === false : false;
  };

  const dupCheckGloballyDisabled = getGlobalPluginDisabled("duplicate_check");
  const trustedFormGloballyDisabled = getGlobalPluginDisabled("trusted_form");
  const ipqsGloballyDisabled = getGlobalPluginDisabled("ipqs");

  const userNameMap = useMemo(() => {
    const map = new Map<string, string>();
    (usersData as CognitoUser[] | undefined)?.forEach((u) => {
      const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ");
      const display = fullName || u.email;
      map.set(u.email, display);
      map.set(u.username, display);
    });
    return map;
  }, [usersData]);

  function resolveChangedBy(
    changed_by?:
      | string
      | {
          username?: string;
          email?: string;
          full_name?: string;
          first_name?: string;
          last_name?: string;
        }
      | null,
  ): string {
    if (!changed_by) return "";
    // Plain string — try userNameMap first, then email-local fallback
    if (typeof changed_by === "string") {
      if (userNameMap.has(changed_by)) return userNameMap.get(changed_by)!;
      if (changed_by.includes("@")) {
        const local = changed_by.split("@")[0];
        return local
          .split(/[._\-+]+/)
          .filter(Boolean)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
      }
      return changed_by;
    }
    // Object — prefer embedded full name, then userNameMap lookup, then email-local fallback
    const fullName =
      changed_by.full_name ||
      [changed_by.first_name, changed_by.last_name].filter(Boolean).join(" ");
    if (fullName) return fullName;
    const key = changed_by.email ?? changed_by.username ?? "";
    if (userNameMap.has(key)) return userNameMap.get(key)!;
    if (changed_by.username && userNameMap.has(changed_by.username))
      return userNameMap.get(changed_by.username)!;
    // Email-local fallback
    const email = changed_by.email ?? "";
    if (email.includes("@")) {
      const local = email.split("@")[0];
      return local
        .split(/[._\-+]+/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
    return changed_by.email || changed_by.username || "";
  }

  const handleSaveLogicRule = async (draft: LogicRuleDraft) => {
    if (!campaign?.id) return;
    if (!draft.name.trim()) {
      toast.warning("Rule name is required.");
      return;
    }
    setSavingRule(true);
    try {
      if (editingRule) {
        const res = await updateLogicRule(campaign.id, editingRule.id, draft);
        if ((res as any)?.result === false) {
          toast.error((res as any)?.message || "Failed to update rule.");
          return;
        }
        toast.success("Logic rule updated.");
      } else {
        const res = await createLogicRule(campaign.id, draft);
        if ((res as any)?.result === false) {
          toast.error((res as any)?.message || "Failed to create rule.");
          return;
        }
        toast.success("Logic rule created.");
      }
      await refreshLogicRules();
      // Manual rule edits de-sync the campaign from any applied logic catalog.
      setLocalLogicSetId(null);
      setLocalLogicSetVersion(null);
      setLocalLogicSetName(null);
      onCampaignUpdate?.({ logic_set_id: null, logic_set_version: null });
      setLogicBuilderOpen(false);
      setEditingRule(null);
    } catch (err: any) {
      toast.error(err?.message || "An error occurred.");
    } finally {
      setSavingRule(false);
    }
  };

  const handleDeleteLogicRule = async (ruleId: string) => {
    if (!campaign?.id) return;
    setDeletingRuleId(ruleId);
    try {
      const res = await deleteLogicRule(campaign.id, ruleId);
      if ((res as any)?.result === false) {
        toast.error((res as any)?.message || "Failed to delete rule.");
        return;
      }
      toast.success("Logic rule deleted.");
      await refreshLogicRules();
      setLocalLogicSetId(null);
      setLocalLogicSetVersion(null);
      setLocalLogicSetName(null);
      onCampaignUpdate?.({ logic_set_id: null, logic_set_version: null });
    } catch (err: any) {
      toast.error(err?.message || "An error occurred.");
    } finally {
      setDeletingRuleId(null);
    }
  };

  const handleToggleLogicRule = async (rule: LogicRule) => {
    if (!campaign?.id) return;
    try {
      const res = await updateLogicRule(campaign.id, rule.id, {
        enabled: !rule.enabled,
      });
      if ((res as any)?.result === false) {
        toast.error((res as any)?.message || "Failed to toggle rule.");
        return;
      }
      await refreshLogicRules();
      setLocalLogicSetId(null);
      setLocalLogicSetVersion(null);
      setLocalLogicSetName(null);
      onCampaignUpdate?.({ logic_set_id: null, logic_set_version: null });
    } catch (err: any) {
      toast.error(err?.message || "An error occurred.");
    }
  };

  // ── Pixel criteria handlers ────────────────────────────────────────────────

  // Load pixel / sold criteria data when the pixel config modal opens on a criteria tab
  useEffect(() => {
    if (!pixelAffiliateId || !campaign?.id) return;
    if (pixelConfigTab === "pixel_criteria") {
      setPixelCriteriaAffiliateId(pixelAffiliateId);
      setPixelCriteriaRules([]);
      setPixelCriteriaLoading(true);
      listAffiliatePixelCriteria(campaign.id, pixelAffiliateId)
        .then((res) => setPixelCriteriaRules((res as any)?.data ?? []))
        .catch(() => {})
        .finally(() => setPixelCriteriaLoading(false));
    } else if (pixelConfigTab === "sold_criteria") {
      setSoldCriteriaAffiliateId(pixelAffiliateId);
      setSoldCriteriaRules([]);
      setSoldCriteriaLoading(true);
      listAffiliateSoldCriteria(campaign.id, pixelAffiliateId)
        .then((res) => setSoldCriteriaRules((res as any)?.data ?? []))
        .catch(() => {})
        .finally(() => setSoldCriteriaLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixelAffiliateId, pixelConfigTab]);

  const refreshPixelCriteria = async (affiliateId: string) => {
    if (!campaign?.id) return;
    const res = await listAffiliatePixelCriteria(campaign.id, affiliateId);
    const rules = (res as any)?.data ?? [];
    setPixelCriteriaRules(rules);
    setLocalAffiliateLinks((prev) =>
      prev.map((l) =>
        l.affiliate_id === affiliateId ? { ...l, pixel_criteria: rules } : l,
      ),
    );
  };

  const openPixelCriteriaManager = async (affiliateId: string) => {
    setPixelCriteriaAffiliateId(affiliateId);
    setPixelCriteriaRules([]);
    setPixelCriteriaLoading(true);
    if (!campaign?.id) return;
    try {
      const res = await listAffiliatePixelCriteria(campaign.id, affiliateId);
      setPixelCriteriaRules((res as any)?.data ?? []);
    } catch {
      /* silent */
    } finally {
      setPixelCriteriaLoading(false);
    }
  };

  const handleSavePixelCriteriaRule = async (draft: LogicRuleDraft) => {
    if (!campaign?.id || !pixelCriteriaAffiliateId) return;
    if (!draft.name.trim()) {
      toast.warning("Rule name is required.");
      return;
    }
    setPixelCriteriaSaving(true);
    try {
      if (pixelCriteriaEditingRule) {
        const res = await updateAffiliatePixelCriterion(
          campaign.id,
          pixelCriteriaAffiliateId,
          pixelCriteriaEditingRule.id,
          draft,
        );
        if ((res as any)?.result === false) {
          toast.error((res as any)?.message || "Failed to update rule.");
          return;
        }
        toast.success("Pixel criteria rule updated.");
      } else {
        const res = await createAffiliatePixelCriterion(
          campaign.id,
          pixelCriteriaAffiliateId,
          draft,
        );
        if ((res as any)?.result === false) {
          toast.error((res as any)?.message || "Failed to create rule.");
          return;
        }
        toast.success("Pixel criteria rule created.");
      }
      await refreshPixelCriteria(pixelCriteriaAffiliateId);
      setPixelCriteriaBuilderOpen(false);
      setPixelCriteriaEditingRule(null);
    } catch (err: any) {
      toast.error(err?.message || "An error occurred.");
    } finally {
      setPixelCriteriaSaving(false);
    }
  };

  const handleDeletePixelCriteriaRule = async (ruleId: string) => {
    if (!campaign?.id || !pixelCriteriaAffiliateId) return;
    setPixelCriteriaDeletingRuleId(ruleId);
    try {
      const res = await deleteAffiliatePixelCriterion(
        campaign.id,
        pixelCriteriaAffiliateId,
        ruleId,
      );
      if ((res as any)?.result === false) {
        toast.error((res as any)?.message || "Failed to delete rule.");
        return;
      }
      toast.success("Pixel criteria rule deleted.");
      await refreshPixelCriteria(pixelCriteriaAffiliateId);
    } catch (err: any) {
      toast.error(err?.message || "An error occurred.");
    } finally {
      setPixelCriteriaDeletingRuleId(null);
    }
  };

  const handleTogglePixelCriteriaRule = async (rule: LogicRule) => {
    if (!campaign?.id || !pixelCriteriaAffiliateId) return;
    try {
      const res = await updateAffiliatePixelCriterion(
        campaign.id,
        pixelCriteriaAffiliateId,
        rule.id,
        { enabled: !rule.enabled },
      );
      if ((res as any)?.result === false) {
        toast.error((res as any)?.message || "Failed to toggle rule.");
        return;
      }
      await refreshPixelCriteria(pixelCriteriaAffiliateId);
    } catch (err: any) {
      toast.error(err?.message || "An error occurred.");
    }
  };

  // ── Sold criteria handlers ─────────────────────────────────────────────────

  const refreshSoldCriteria = async (affiliateId: string) => {
    if (!campaign?.id) return;
    const res = await listAffiliateSoldCriteria(campaign.id, affiliateId);
    const rules = (res as any)?.data ?? [];
    setSoldCriteriaRules(rules);
    setLocalAffiliateLinks((prev) =>
      prev.map((l) =>
        l.affiliate_id === affiliateId ? { ...l, sold_criteria: rules } : l,
      ),
    );
  };

  const openSoldCriteriaManager = async (affiliateId: string) => {
    setSoldCriteriaAffiliateId(affiliateId);
    setSoldCriteriaRules([]);
    setSoldCriteriaLoading(true);
    if (!campaign?.id) return;
    try {
      const res = await listAffiliateSoldCriteria(campaign.id, affiliateId);
      setSoldCriteriaRules((res as any)?.data ?? []);
    } catch {
      /* silent */
    } finally {
      setSoldCriteriaLoading(false);
    }
  };

  const handleSaveSoldCriteriaRule = async (draft: LogicRuleDraft) => {
    if (!campaign?.id || !soldCriteriaAffiliateId) return;
    if (!draft.name.trim()) {
      toast.warning("Rule name is required.");
      return;
    }
    setSoldCriteriaSaving(true);
    try {
      if (soldCriteriaEditingRule) {
        const res = await updateAffiliateSoldCriterion(
          campaign.id,
          soldCriteriaAffiliateId,
          soldCriteriaEditingRule.id,
          draft,
        );
        if ((res as any)?.result === false) {
          toast.error((res as any)?.message || "Failed to update rule.");
          return;
        }
        toast.success("Sold criteria rule updated.");
      } else {
        const res = await createAffiliateSoldCriterion(
          campaign.id,
          soldCriteriaAffiliateId,
          draft,
        );
        if ((res as any)?.result === false) {
          toast.error((res as any)?.message || "Failed to create rule.");
          return;
        }
        toast.success("Sold criteria rule created.");
      }
      await refreshSoldCriteria(soldCriteriaAffiliateId);
      setSoldCriteriaBuilderOpen(false);
      setSoldCriteriaEditingRule(null);
    } catch (err: any) {
      toast.error(err?.message || "An error occurred.");
    } finally {
      setSoldCriteriaSaving(false);
    }
  };

  const handleDeleteSoldCriteriaRule = async (ruleId: string) => {
    if (!campaign?.id || !soldCriteriaAffiliateId) return;
    setSoldCriteriaDeletingRuleId(ruleId);
    try {
      const res = await deleteAffiliateSoldCriterion(
        campaign.id,
        soldCriteriaAffiliateId,
        ruleId,
      );
      if ((res as any)?.result === false) {
        toast.error((res as any)?.message || "Failed to delete rule.");
        return;
      }
      toast.success("Sold criteria rule deleted.");
      await refreshSoldCriteria(soldCriteriaAffiliateId);
    } catch (err: any) {
      toast.error(err?.message || "An error occurred.");
    } finally {
      setSoldCriteriaDeletingRuleId(null);
    }
  };

  const handleToggleSoldCriteriaRule = async (rule: LogicRule) => {
    if (!campaign?.id || !soldCriteriaAffiliateId) return;
    try {
      const res = await updateAffiliateSoldCriterion(
        campaign.id,
        soldCriteriaAffiliateId,
        rule.id,
        { enabled: !rule.enabled },
      );
      if ((res as any)?.result === false) {
        toast.error((res as any)?.message || "Failed to toggle rule.");
        return;
      }
      await refreshSoldCriteria(soldCriteriaAffiliateId);
    } catch (err: any) {
      toast.error(err?.message || "An error occurred.");
    }
  };

  // ── Per-participant logic rule handlers ───────────────────────────────────

  const refreshParticipantLogicRules = async (
    type: "affiliate" | "client",
    participantId: string,
  ) => {
    if (!campaign?.id) return;
    const res =
      type === "affiliate"
        ? await listAffiliateLogicRules(campaign.id, participantId)
        : await listClientLogicRules(campaign.id, participantId);
    setParticipantLogicRules((res as any)?.data ?? []);
  };

  const openAffiliateLogicManager = async (affiliateId: string) => {
    setParticipantLogicType("affiliate");
    setParticipantLogicRules([]);
    setParticipantLogicCatalogOpen(false);
    setParticipantLogicLoading(true);
    setPixelLogicIntroAffiliateId(affiliateId);
    setParticipantAction(null);
    if (!campaign?.id) return;
    try {
      const res = await listAffiliateLogicRules(campaign.id, affiliateId);
      setParticipantLogicRules((res as any)?.data ?? []);
      const override = (campaign as any)?.affiliate_overrides?.[affiliateId];
      setParticipantLogicSetId(override?.logic_set_id ?? null);
      setParticipantLogicSetVersion(override?.logic_set_version ?? null);
      setParticipantLogicSetName(null);
      setParticipantLogicBaseSetId(override?.logic_set_id ?? null);
      setParticipantLogicBaseSetVersion(override?.logic_set_version ?? null);
      setParticipantLogicBaseSetName(null);
      setSaveParticipantLogicMode(
        override?.logic_set_id ? "new_version" : "new_set",
      );
      if (override?.logic_set_id && participantLogicCatalogSets.length > 0) {
        const found = participantLogicCatalogSets.find(
          (s) => s.id === override.logic_set_id,
        );
        if (found) {
          setParticipantLogicSetName(found.name);
          setParticipantLogicBaseSetName(found.name);
        }
      } else if (override?.logic_set_id) {
        try {
          const setRes = await getLogicCatalogSet(override.logic_set_id);
          if (setRes.success) {
            setParticipantLogicSetName(setRes.data.set.name);
            setParticipantLogicBaseSetName(setRes.data.set.name);
          }
        } catch {
          /* silent */
        }
      }
    } catch {
      /* silent */
    } finally {
      setParticipantLogicLoading(false);
    }
  };

  const openClientLogicManager = async (clientId: string) => {
    setParticipantLogicType("client");
    setParticipantLogicRules([]);
    setParticipantLogicCatalogOpen(false);
    setParticipantLogicLoading(true);
    setDeliveryLogicIntroClientId(clientId);
    setParticipantAction(null);
    if (!campaign?.id) return;
    try {
      const res = await listClientLogicRules(campaign.id, clientId);
      setParticipantLogicRules((res as any)?.data ?? []);
      const override = (campaign as any)?.client_overrides?.[clientId];
      setParticipantLogicSetId(override?.logic_set_id ?? null);
      setParticipantLogicSetVersion(override?.logic_set_version ?? null);
      setParticipantLogicSetName(null);
      setParticipantLogicBaseSetId(override?.logic_set_id ?? null);
      setParticipantLogicBaseSetVersion(override?.logic_set_version ?? null);
      setParticipantLogicBaseSetName(null);
      setSaveParticipantLogicMode(
        override?.logic_set_id ? "new_version" : "new_set",
      );
      if (override?.logic_set_id && participantLogicCatalogSets.length > 0) {
        const found = participantLogicCatalogSets.find(
          (s) => s.id === override.logic_set_id,
        );
        if (found) {
          setParticipantLogicSetName(found.name);
          setParticipantLogicBaseSetName(found.name);
        }
      } else if (override?.logic_set_id) {
        try {
          const setRes = await getLogicCatalogSet(override.logic_set_id);
          if (setRes.success) {
            setParticipantLogicSetName(setRes.data.set.name);
            setParticipantLogicBaseSetName(setRes.data.set.name);
          }
        } catch {
          /* silent */
        }
      }
    } catch {
      /* silent */
    } finally {
      setParticipantLogicLoading(false);
    }
  };

  const handleSaveParticipantLogicRule = async (draft: LogicRuleDraft) => {
    if (!campaign?.id) return;
    const participantId =
      participantLogicType === "affiliate"
        ? pixelLogicIntroAffiliateId
        : deliveryLogicIntroClientId;
    if (!participantId) return;
    if (!draft.name.trim()) {
      toast.warning("Rule name is required.");
      return;
    }
    setParticipantLogicSaving(true);
    try {
      if (participantLogicEditingRule) {
        const res =
          participantLogicType === "affiliate"
            ? await updateAffiliateLogicRule(
                campaign.id,
                participantId,
                participantLogicEditingRule.id,
                draft,
              )
            : await updateClientLogicRule(
                campaign.id,
                participantId,
                participantLogicEditingRule.id,
                draft,
              );
        if ((res as any)?.result === false) {
          toast.error((res as any)?.message || "Failed to update rule.");
          return;
        }
        toast.success("Logic rule updated.");
      } else {
        const res =
          participantLogicType === "affiliate"
            ? await createAffiliateLogicRule(campaign.id, participantId, draft)
            : await createClientLogicRule(campaign.id, participantId, draft);
        if ((res as any)?.result === false) {
          toast.error((res as any)?.message || "Failed to create rule.");
          return;
        }
        toast.success("Logic rule created.");
      }
      await refreshParticipantLogicRules(participantLogicType!, participantId);
      setParticipantLogicSetId(null);
      setParticipantLogicSetVersion(null);
      setParticipantLogicSetName(null);
      setParticipantLogicBuilderOpen(false);
      setParticipantLogicEditingRule(null);
    } catch (err: any) {
      toast.error(err?.message || "An error occurred.");
    } finally {
      setParticipantLogicSaving(false);
    }
  };

  const handleDeleteParticipantLogicRule = async (ruleId: string) => {
    if (!campaign?.id) return;
    const participantId =
      participantLogicType === "affiliate"
        ? pixelLogicIntroAffiliateId
        : deliveryLogicIntroClientId;
    if (!participantId) return;
    setParticipantLogicDeletingRuleId(ruleId);
    try {
      const res =
        participantLogicType === "affiliate"
          ? await deleteAffiliateLogicRule(campaign.id, participantId, ruleId)
          : await deleteClientLogicRule(campaign.id, participantId, ruleId);
      if ((res as any)?.result === false) {
        toast.error((res as any)?.message || "Failed to delete rule.");
        return;
      }
      toast.success("Logic rule deleted.");
      await refreshParticipantLogicRules(participantLogicType!, participantId);
      setParticipantLogicSetId(null);
      setParticipantLogicSetVersion(null);
      setParticipantLogicSetName(null);
    } catch (err: any) {
      toast.error(err?.message || "An error occurred.");
    } finally {
      setParticipantLogicDeletingRuleId(null);
    }
  };

  const handleToggleParticipantLogicRule = async (rule: LogicRule) => {
    if (!campaign?.id) return;
    const participantId =
      participantLogicType === "affiliate"
        ? pixelLogicIntroAffiliateId
        : deliveryLogicIntroClientId;
    if (!participantId) return;
    try {
      const res =
        participantLogicType === "affiliate"
          ? await updateAffiliateLogicRule(
              campaign.id,
              participantId,
              rule.id,
              { enabled: !rule.enabled },
            )
          : await updateClientLogicRule(campaign.id, participantId, rule.id, {
              enabled: !rule.enabled,
            });
      if ((res as any)?.result === false) {
        toast.error((res as any)?.message || "Failed to toggle rule.");
        return;
      }
      await refreshParticipantLogicRules(participantLogicType!, participantId);
    } catch (err: any) {
      toast.error(err?.message || "An error occurred.");
    }
  };

  const openParticipantLogicCatalog = async () => {
    setParticipantLogicCatalogOpen(true);
    setParticipantExpandedSetId(null);
    setParticipantExpandedVersionRules(new Set());
    setParticipantExpandedRuleDetails(new Set());
    setParticipantLogicCatalogLoading(true);
    try {
      const res = await listLogicCatalog();
      if ((res as any).success) {
        const items = (res as any).data.items ?? [];
        setParticipantLogicCatalogSets(items);
        if (participantLogicBaseSetId && !participantLogicBaseSetName) {
          const current = items.find(
            (item: LogicCatalogSet) => item.id === participantLogicBaseSetId,
          );
          if (current) {
            setParticipantLogicSetName(current.name);
            setParticipantLogicBaseSetName(current.name);
          }
        }
      }
    } catch {
      toast.error("Failed to load logic catalog.");
    } finally {
      setParticipantLogicCatalogLoading(false);
    }
  };

  const handleApplyParticipantLogicCatalog = async (
    set: LogicCatalogSet,
    version = set.latest_version,
  ) => {
    if (!campaign?.id) return;
    const participantId =
      participantLogicType === "affiliate"
        ? pixelLogicIntroAffiliateId
        : deliveryLogicIntroClientId;
    if (!participantId) return;
    const applyKey = `${set.id}#v${version}`;
    setParticipantLogicApplyingCatalogId(applyKey);
    try {
      const res =
        participantLogicType === "affiliate"
          ? await applyLogicCatalogToAffiliate(
              campaign.id,
              participantId,
              set.id,
              version,
            )
          : await applyLogicCatalogToClient(
              campaign.id,
              participantId,
              set.id,
              version,
            );
      if ((res as any)?.result === false) {
        toast.error((res as any)?.message || "Failed to apply catalog.");
        return;
      }
      toast.success(`Applied "${set.name}" v${version}.`);
      await refreshParticipantLogicRules(participantLogicType!, participantId);
      setParticipantLogicSetId(set.id);
      setParticipantLogicSetVersion(version);
      setParticipantLogicSetName(set.name);
      setParticipantLogicBaseSetId(set.id);
      setParticipantLogicBaseSetVersion(version);
      setParticipantLogicBaseSetName(set.name);
      if (participantLogicType === "affiliate") {
        onCampaignUpdate?.({
          affiliate_overrides: {
            ...((campaign as any)?.affiliate_overrides ?? {}),
            [participantId]: {
              ...((campaign as any)?.affiliate_overrides?.[participantId] ??
                {}),
              logic_set_id: set.id,
              logic_set_version: version,
            },
          } as any,
        });
      } else {
        onCampaignUpdate?.({
          client_overrides: {
            ...((campaign as any)?.client_overrides ?? {}),
            [participantId]: {
              ...((campaign as any)?.client_overrides?.[participantId] ?? {}),
              logic_set_id: set.id,
              logic_set_version: version,
            },
          } as any,
        });
      }
      setParticipantLogicCatalogOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to apply catalog.");
    } finally {
      setParticipantLogicApplyingCatalogId(null);
    }
  };

  const handleSyncClientLogicToCampaign = async () => {
    if (!campaign?.id || !deliveryLogicIntroClientId) return;
    setSyncingClientLogicToCampaign(true);
    try {
      const res = await syncClientLogicToCampaign(
        campaign.id,
        deliveryLogicIntroClientId,
      );
      if ((res as any)?.result === false) {
        toast.error((res as any)?.message || "Failed to sync.");
        return;
      }
      const data = (res as any)?.data ?? res?.data;
      const removed = data?.removed_count ?? 0;
      toast.success(
        removed > 0
          ? `Synced to campaign logic. ${removed} redundant extension${removed > 1 ? "s" : ""} removed.`
          : "Synced to campaign logic.",
      );
      await refreshParticipantLogicRules("client", deliveryLogicIntroClientId);
      // Update local override tracking to match campaign
      setParticipantLogicSetId(campaign.logic_set_id ?? null);
      setParticipantLogicSetVersion(campaign.logic_set_version ?? null);
      setParticipantLogicBaseSetId(campaign.logic_set_id ?? null);
      setParticipantLogicBaseSetVersion(campaign.logic_set_version ?? null);
      if (campaign.logic_set_id) {
        const setName =
          logicCatalogSets.find((s) => s.id === campaign.logic_set_id)?.name ??
          localLogicSetName;
        setParticipantLogicSetName(setName ?? null);
        setParticipantLogicBaseSetName(setName ?? null);
      }
      onCampaignUpdate?.({
        client_overrides: {
          ...((campaign as any)?.client_overrides ?? {}),
          [deliveryLogicIntroClientId]: {
            ...((campaign as any)?.client_overrides?.[
              deliveryLogicIntroClientId
            ] ?? {}),
            logic_set_id: campaign.logic_set_id,
            logic_set_version: campaign.logic_set_version,
            logic_rules: data?.kept_rules ?? [],
          },
        } as any,
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to sync.");
    } finally {
      setSyncingClientLogicToCampaign(false);
    }
  };

  const saveParticipantLogicToCatalog = async () => {
    if (!campaign?.id) return;
    const participantId =
      participantLogicType === "affiliate"
        ? pixelLogicIntroAffiliateId
        : deliveryLogicIntroClientId;
    if (!participantId) return;
    if (
      saveParticipantLogicMode === "new_set" &&
      !saveParticipantLogicDraft.name.trim()
    ) {
      toast.warning("Set name is required when creating a new set.");
      return;
    }
    if (
      saveParticipantLogicMode === "new_version" &&
      !participantLogicBaseSetId
    ) {
      toast.warning("No active logic catalog set to version.");
      return;
    }

    setSavingParticipantLogicToCatalog(true);
    try {
      const rules = toLogicCatalogRulesPayload(participantLogicRules);
      let targetSet: LogicCatalogSet;
      let targetVersion = 1;

      if (
        saveParticipantLogicMode === "new_version" &&
        participantLogicBaseSetId
      ) {
        const updateRes = await updateLogicCatalogSet(
          participantLogicBaseSetId,
          {
            ...(saveParticipantLogicDraft.name.trim()
              ? { name: saveParticipantLogicDraft.name.trim() }
              : {}),
            ...(saveParticipantLogicDraft.description.trim()
              ? { description: saveParticipantLogicDraft.description.trim() }
              : {}),
            rules,
          },
        );
        if (!updateRes.success) {
          throw new Error("Failed to create new catalog version");
        }
        targetSet = updateRes.data.set;
        targetVersion = targetSet.latest_version;
      } else {
        const createRes = await createLogicCatalogSet({
          name: saveParticipantLogicDraft.name.trim(),
          ...(saveParticipantLogicDraft.description.trim()
            ? { description: saveParticipantLogicDraft.description.trim() }
            : {}),
          ...(rules.length > 0 ? { rules } : {}),
        });
        if (!createRes.success) {
          throw new Error("Failed to create logic catalog set");
        }
        targetSet = createRes.data.set;
        targetVersion = 1;
      }

      await handleApplyParticipantLogicCatalog(targetSet, targetVersion);
      setSaveParticipantLogicOpen(false);
      setSaveParticipantLogicDraft({ name: "", description: "" });
      setSaveParticipantLogicMode(
        participantLogicBaseSetId ? "new_version" : "new_set",
      );
    } catch (err: any) {
      toast.error(err?.message || "Failed to save logic catalog set.");
    } finally {
      setSavingParticipantLogicToCatalog(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  const openLogicCatalogModal = async () => {
    setLogicCatalogOpen(true);
    setExpandedLogicSetId(null);
    setExpandedLogicVersionRules(new Set());
    setExpandedLogicRuleDetails(new Set());
    setLogicCatalogLoading(true);
    try {
      const res = await listLogicCatalog();
      if (res.success) {
        const items = res.data.items ?? [];
        setLogicCatalogSets(items);
        if (localLogicSetId && !localLogicSetName) {
          const current = items.find((item) => item.id === localLogicSetId);
          if (current) setLocalLogicSetName(current.name);
        }
      }
    } catch {
      toast.error("Failed to load logic catalog.");
    } finally {
      setLogicCatalogLoading(false);
    }
  };

  const saveCurrentLogicToCatalog = async () => {
    if (!campaign?.id) return;
    if (saveLogicToSetMode === "new_set" && !saveLogicToSetDraft.name.trim()) {
      toast.warning("Set name is required when creating a new set.");
      return;
    }
    if (saveLogicToSetMode === "new_version" && !localLogicSetId) {
      toast.warning("No active logic catalog set to version.");
      return;
    }

    setSavingLogicToSet(true);
    try {
      const rules = toLogicCatalogRulesPayload(logicRules);
      let targetSet: LogicCatalogSet;
      let targetVersion = 1;

      if (saveLogicToSetMode === "new_version" && localLogicSetId) {
        const updateRes = await updateLogicCatalogSet(localLogicSetId, {
          ...(saveLogicToSetDraft.name.trim()
            ? { name: saveLogicToSetDraft.name.trim() }
            : {}),
          ...(saveLogicToSetDraft.description.trim()
            ? { description: saveLogicToSetDraft.description.trim() }
            : {}),
          rules,
        });
        if (!updateRes.success) {
          throw new Error("Failed to create new logic catalog version.");
        }
        targetSet = updateRes.data.set;
        targetVersion = targetSet.latest_version;
      } else {
        const createRes = await createLogicCatalogSet({
          name: saveLogicToSetDraft.name.trim(),
          ...(saveLogicToSetDraft.description.trim()
            ? { description: saveLogicToSetDraft.description.trim() }
            : {}),
          ...(rules.length > 0 ? { rules } : {}),
        });
        if (!createRes.success) {
          throw new Error("Failed to create logic catalog set.");
        }
        targetSet = createRes.data.set;
        targetVersion = 1;
      }

      await applyLogicCatalog(campaign.id, targetSet.id, targetVersion);
      await refreshLogicRules();

      setLocalLogicSetId(targetSet.id);
      setLocalLogicSetVersion(targetVersion);
      setLocalLogicSetName(targetSet.name);
      onCampaignUpdate?.({
        logic_set_id: targetSet.id,
        logic_set_version: targetVersion,
      });

      toast.success(
        `Saved to "${targetSet.name}" v${targetVersion} and applied.`,
      );
      setSaveLogicToSetOpen(false);
      setSaveLogicToSetDraft({ name: "", description: "" });
      setSaveLogicToSetMode("new_version");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save logic catalog set.");
    } finally {
      setSavingLogicToSet(false);
    }
  };

  const openTagEditor = () => {
    setTagDraft(campaign?.tags ?? []);
    setEditTagsOpen(true);
  };

  const saveCampaignTagDraft = async () => {
    if (!campaign?.id) return;
    const nextTags = [
      ...new Set(tagDraft.map((t) => t.trim()).filter(Boolean)),
    ];

    setSavingTags(true);
    try {
      const res: any = await setCampaignTags(campaign.id, nextTags);
      if (res?.success === false || res?.result === false) {
        throw new Error(res?.message || "Failed to save campaign tags.");
      }
      onCampaignUpdate?.({ tags: nextTags });
      setEditTagsOpen(false);
      toast.success("Campaign tags updated.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save campaign tags.");
    } finally {
      setSavingTags(false);
    }
  };

  const applyLogicCatalogVersion = async (
    setId: string,
    setName: string,
    version: number,
  ) => {
    if (!campaign?.id) return;
    const applyKey = `${setId}#v${version}`;
    setApplyingLogicCatalog(applyKey);
    try {
      await applyLogicCatalog(campaign.id, setId, version);
      await refreshLogicRules();
      setLocalLogicSetId(setId);
      setLocalLogicSetVersion(version);
      setLocalLogicSetName(setName);
      onCampaignUpdate?.({ logic_set_id: setId, logic_set_version: version });
      toast.success(`Applied "${setName}" v${version}.`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to apply logic catalog version.");
    } finally {
      setApplyingLogicCatalog(null);
    }
  };

  const openCriteriaCatalogModal = async () => {
    setCatalogOpen(true);
    setCatalogFormMode("browse");
    setCatalogLoading(true);
    try {
      const res = await listCriteriaCatalog();
      if (res.success) {
        const items = res.data.items;
        setCatalogSets(items);
        if (localCriteriaSetId && !localCriteriaSetName) {
          const current = items.find((item) => item.id === localCriteriaSetId);
          if (current) setLocalCriteriaSetName(current.name);
        }
      }
    } catch {
      toast.error("Failed to load catalog.");
    } finally {
      setCatalogLoading(false);
    }
  };

  const saveCurrentCriteriaToCatalog = async () => {
    if (!campaign) return;
    if (
      saveCriteriaToSetMode === "new_set" &&
      !saveCriteriaToSetDraft.name.trim()
    ) {
      toast.warning("Set name is required when creating a new set.");
      return;
    }
    if (saveCriteriaToSetMode === "new_version" && !localCriteriaSetId) {
      toast.warning("No active criteria catalog set to version.");
      return;
    }

    const fields = criteriaFields.map((f) => ({
      field_label: f.field_label,
      field_name: f.field_name,
      data_type: f.data_type,
      required: f.required,
      ...(f.description ? { description: f.description } : {}),
      ...(f.options?.length ? { options: f.options } : {}),
      ...(f.value_mappings?.length ? { value_mappings: f.value_mappings } : {}),
      ...(f.state_mapping ? { state_mapping: f.state_mapping } : {}),
    }));

    setSavingCriteriaToSet(true);
    try {
      let targetSet: CriteriaCatalogSet;
      let targetVersion = 1;

      if (saveCriteriaToSetMode === "new_version" && localCriteriaSetId) {
        const updateRes = await updateCriteriaCatalogSet(localCriteriaSetId, {
          ...(saveCriteriaToSetDraft.name.trim()
            ? { name: saveCriteriaToSetDraft.name.trim() }
            : {}),
          ...(saveCriteriaToSetDraft.description.trim()
            ? { description: saveCriteriaToSetDraft.description.trim() }
            : {}),
          fields,
        });
        if (!updateRes.success) {
          throw new Error("Failed to create new catalog version");
        }
        targetSet = updateRes.data.set;
        targetVersion = targetSet.latest_version;
      } else {
        const createRes = await createCriteriaCatalogSet({
          name: saveCriteriaToSetDraft.name.trim(),
          ...(saveCriteriaToSetDraft.description.trim()
            ? { description: saveCriteriaToSetDraft.description.trim() }
            : {}),
          fields,
        });
        if (!createRes.success) throw new Error("Failed to create set");
        targetSet = createRes.data.set;
        targetVersion = 1;
      }

      await applyCriteriaCatalog(campaign.id, targetSet.id, targetVersion);
      setLocalCriteriaSetId(targetSet.id);
      setLocalCriteriaSetVersion(targetVersion);
      setLocalCriteriaSetName(targetSet.name);
      onCampaignUpdate?.({
        criteria_set_id: targetSet.id,
        criteria_set_version: targetVersion,
      });

      toast.success(
        saveCriteriaToSetMode === "new_version"
          ? `Saved "${targetSet.name}" v${targetVersion} and applied.`
          : `Saved as "${targetSet.name}" v1 and applied.`,
      );
      setSaveCriteriaToSetOpen(false);
      setSaveCriteriaToSetDraft({ name: "", description: "" });
      setSaveCriteriaToSetMode(localCriteriaSetId ? "new_version" : "new_set");
      await refreshCriteria();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save criteria catalog.");
    } finally {
      setSavingCriteriaToSet(false);
    }
  };

  useEffect(() => {
    if (campaign) {
      setIntegrationsDirty(false);
      pluginsInitRef.current = false;
      setDupCheckOpen(false);
      setTrustedFormOpen(false);
      setIpqsOpen(false);
      setStatusDraft(campaign.status);
      setNameDraft(campaign.name);
      setTitleEditing(false);
      setDuplicateCheckEnabled(
        dupCheckGloballyDisabled
          ? false
          : (campaign.plugins?.duplicate_check?.enabled ?? true),
      );
      setDuplicateCheckCriteria(
        campaign.plugins?.duplicate_check?.criteria?.length
          ? campaign.plugins.duplicate_check.criteria
          : ["phone", "email"],
      );
      setTrustedFormEnabled(
        trustedFormGloballyDisabled
          ? false
          : (campaign.plugins?.trusted_form?.enabled ?? true),
      );
      setTrustedFormGate(campaign.plugins?.trusted_form?.gate ?? true);
      setIpqsGate(campaign.plugins?.ipqs?.gate ?? true);
      setTfStep(campaign.plugins?.trusted_form?.stage ?? 2);
      setIpqsStep(campaign.plugins?.ipqs?.stage ?? 3);
      setTfStepEditing(false);
      setIpqsStepEditing(false);
      setLocalClientLinks(campaign.clients ?? []);
      setLocalAffiliateLinks(campaign.affiliates ?? []);

      const mode = campaign.distribution?.mode ?? "round_robin";
      setRoutingMode(mode);
      setRoutingEnabled(campaign.distribution?.enabled ?? false);

      const liveClientLinks = (campaign.clients ?? []).filter(
        (link) => link.status === "LIVE",
      );
      if (liveClientLinks.length === 0) {
        setRoutingWeights({});
      } else {
        const hasAnyWeight = liveClientLinks.some(
          (link) => typeof link.weight === "number" && link.weight > 0,
        );
        if (hasAnyWeight) {
          // Normalize raw integer weights to percentages summing to 100
          const totalWeight =
            liveClientLinks.reduce((s, link) => s + (link.weight ?? 0), 0) || 1;
          const next: Record<string, number> = {};
          let remaining = 100;
          liveClientLinks.forEach((link, i) => {
            if (i === liveClientLinks.length - 1) {
              next[link.client_id] = Math.max(0, remaining);
            } else {
              const pct = Math.round(((link.weight ?? 0) / totalWeight) * 100);
              next[link.client_id] = pct;
              remaining -= pct;
            }
          });
          setRoutingWeights(next);
        } else {
          const n = liveClientLinks.length;
          const base = Math.floor(100 / n);
          let remainder = 100 - base * n;
          const next: Record<string, number> = {};
          liveClientLinks.forEach((link) => {
            const add = remainder > 0 ? 1 : 0;
            if (remainder > 0) remainder -= 1;
            next[link.client_id] = base + add;
          });
          setRoutingWeights(next);
        }
      }
      // Init IPQS config
      const qi = campaign.plugins?.ipqs;
      setIpqsConfig({
        enabled: ipqsGloballyDisabled ? false : (qi?.enabled ?? false),
        phone: {
          enabled: qi?.phone?.enabled ?? true,
          criteria: {
            valid: {
              enabled: qi?.phone?.criteria?.valid?.enabled ?? true,
            },
            fraud_score: {
              enabled: qi?.phone?.criteria?.fraud_score?.enabled ?? true,
              operator: qi?.phone?.criteria?.fraud_score?.operator ?? "lte",
              value: qi?.phone?.criteria?.fraud_score?.value ?? 85,
            },
            country: {
              enabled: qi?.phone?.criteria?.country?.enabled ?? false,
              allowed: (qi?.phone?.criteria?.country?.allowed ?? []).join(", "),
            },
          },
        },
        email: {
          enabled: qi?.email?.enabled ?? true,
          criteria: {
            valid: {
              enabled: qi?.email?.criteria?.valid?.enabled ?? true,
            },
            fraud_score: {
              enabled: qi?.email?.criteria?.fraud_score?.enabled ?? true,
              operator: qi?.email?.criteria?.fraud_score?.operator ?? "lte",
              value: qi?.email?.criteria?.fraud_score?.value ?? 85,
            },
          },
        },
        ip: {
          enabled: qi?.ip?.enabled ?? false,
          criteria: {
            fraud_score: {
              enabled: qi?.ip?.criteria?.fraud_score?.enabled ?? true,
              operator: qi?.ip?.criteria?.fraud_score?.operator ?? "lte",
              value: qi?.ip?.criteria?.fraud_score?.value ?? 85,
            },
            country_code: {
              enabled: qi?.ip?.criteria?.country_code?.enabled ?? false,
              allowed: (qi?.ip?.criteria?.country_code?.allowed ?? []).join(
                ", ",
              ),
            },
            proxy: {
              enabled: qi?.ip?.criteria?.proxy?.enabled ?? false,
              allowed: qi?.ip?.criteria?.proxy?.allowed ?? false,
            },
            vpn: {
              enabled: qi?.ip?.criteria?.vpn?.enabled ?? false,
              allowed: qi?.ip?.criteria?.vpn?.allowed ?? false,
            },
          },
        },
      });
    }
  }, [campaign]); // eslint-disable-line react-hooks/exhaustive-deps

  // When a plugin is disabled globally at runtime, force its campaign-level
  // enabled state off so the toggle reflects the correct value and any
  // subsequent save persists the disabled state.
  useEffect(() => {
    if (dupCheckGloballyDisabled) setDuplicateCheckEnabled(false);
  }, [dupCheckGloballyDisabled]);

  useEffect(() => {
    if (trustedFormGloballyDisabled) setTrustedFormEnabled(false);
  }, [trustedFormGloballyDisabled]);

  useEffect(() => {
    if (ipqsGloballyDisabled) setIpqsConfig((p) => ({ ...p, enabled: false }));
  }, [ipqsGloballyDisabled]);

  useEffect(() => {
    if (!participantAction || participantAction.type !== "affiliate") return;
    const link = localAffiliateLinks.find(
      (l) => l.affiliate_id === participantAction.id,
    );
    setAffiliateCapDraft(
      link?.lead_cap === null || link?.lead_cap === undefined
        ? ""
        : String(link.lead_cap),
    );
  }, [participantAction, localAffiliateLinks]);

  useEffect(() => {
    if (!affiliateCapModalId) return;
    const link = localAffiliateLinks.find(
      (l) => l.affiliate_id === affiliateCapModalId,
    );
    setAffiliateCapDraft(
      link?.lead_cap === null || link?.lead_cap === undefined
        ? ""
        : String(link.lead_cap),
    );
  }, [affiliateCapModalId, localAffiliateLinks]);

  // Mark integrations dirty whenever any plugin state changes after initial load.
  useEffect(() => {
    if (!pluginsInitRef.current) {
      pluginsInitRef.current = true;
      return;
    }
    setIntegrationsDirty(true);
  }, [
    duplicateCheckEnabled,
    duplicateCheckCriteria,
    trustedFormEnabled,
    trustedFormGate,
    ipqsGate,
    tfStep,
    ipqsStep,
    ipqsConfig,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // These hooks MUST stay above the early return so hook call order is always
  // stable across renders, regardless of whether campaign is null.
  const leadsForCampaign = useMemo(
    () => leads.filter((l) => campaign?.id && l.campaign_id === campaign.id),
    [leads, campaign],
  );
  const leadsByCampaignKey = useMemo(() => {
    const counts = new Map<string, number>();
    leadsForCampaign.forEach((lead) => {
      const key = lead.campaign_key;
      if (!key) return;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [leadsForCampaign]);

  /** Live-only lead counts per campaign key (excludes test leads). Used for LIVE affiliate cap progress. */
  const liveLeadsByCampaignKey = useMemo(() => {
    const counts = new Map<string, number>();
    leadsForCampaign.forEach((lead) => {
      if (lead.test) return;
      const key = lead.campaign_key;
      if (!key) return;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [leadsForCampaign]);

  const clientNameById = useMemo(
    () => new Map(clients.map((client) => [client.id, client.name])),
    [clients],
  );
  const affiliateNameById = useMemo(
    () =>
      new Map(affiliates.map((affiliate) => [affiliate.id, affiliate.name])),
    [affiliates],
  );

  if (!campaign) return null;

  const CRITERIA_TYPE_LABELS: Record<CriteriaFieldType, string> = {
    Text: "Text",
    Number: "Number",
    Date: "Date",
    List: "List",
    "US State": "US State",
    Boolean: "Boolean",
  };

  const saveTitleEdit = async () => {
    const nameChanged = nameDraft.trim() && nameDraft.trim() !== campaign.name;
    const statusChanged = statusDraft !== campaign.status;
    if (!nameChanged && !statusChanged) {
      setTitleEditing(false);
      return;
    }
    setSavingTitle(true);
    try {
      if (nameChanged) await onUpdateName(campaign.id, nameDraft.trim());
      if (statusChanged) await onStatusChange(campaign.id, statusDraft);
      setTitleEditing(false);
    } finally {
      setSavingTitle(false);
    }
  };

  const clientLinks = localClientLinks;
  const affiliateLinks = localAffiliateLinks;
  const clientLinkMap = new Map(clientLinks.map((cc) => [cc.client_id, cc]));
  const affiliateLinkMap = new Map(
    affiliateLinks.map((ca) => [ca.affiliate_id, ca]),
  );
  const affiliateById = new Map(
    affiliates.map((affiliate) => [affiliate.id, affiliate]),
  );

  const linkedClients = clients.filter((c) => clientLinkMap.has(c.id));
  const linkedAffiliates = affiliateLinks.map(
    (link) =>
      affiliateById.get(link.affiliate_id) ?? {
        id: link.affiliate_id,
        name: `Unknown affiliate (${link.affiliate_id})`,
        email: "",
        phone: "",
        status: "INACTIVE" as const,
      },
  );

  const availableClients = clients.filter(
    (c) => c.status === "ACTIVE" && !clientLinkMap.has(c.id),
  );
  const availableAffiliates = affiliates.filter(
    (a) => a.status === "ACTIVE" && !affiliateLinkMap.has(a.id),
  );

  const getClientLeadMode = (
    link?: CampaignClient,
  ): "all" | "test" | "live" => {
    if (!link) return "all";
    if (link.status === "TEST") return "test";
    if (link.status === "LIVE") return "live";
    const history = [...(link.history ?? [])].reverse();
    const lastActive = history.find(
      (h) => h.to === "TEST" || h.to === "LIVE",
    )?.to;
    if (lastActive === "TEST") return "test";
    if (lastActive === "LIVE") return "live";
    return "all";
  };

  const getClientLeadCount = (link?: CampaignClient) => {
    return link?.leads_delivered_count ?? 0;
  };

  return (
    <>
      <Modal
        title={
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-2.5">
              {campaign.name}
              <Badge tone={statusColorMap[campaign.status] || "neutral"}>
                {campaign.status}
              </Badge>
              <button
                type="button"
                title="Edit name & status"
                onClick={() => {
                  setNameDraft(campaign.name);
                  setStatusDraft(campaign.status);
                  setTitleEditing(true);
                }}
                className="rounded p-0.5 text-[--color-text-muted] hover:text-[--color-primary] transition-colors"
              >
                <Pencil size={13} />
              </button>
            </span>
            <span className="flex items-center gap-1">
              <HoverTooltip message="Campaign ID">
                <span className="font-mono text-sm text-[--color-text-muted] select-all cursor-help">
                  {campaign.id}
                </span>
              </HoverTooltip>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(campaign.id);
                  toast.success("Campaign ID copied to clipboard");
                }}
                className="rounded p-0.5 text-[--color-text-muted] hover:text-[--color-primary] transition-colors"
              >
                <Copy size={12} />
              </button>
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
              {campaign.tags && campaign.tags.length > 0 ? (
                campaign.tags.map((tag) => {
                  const def = tagDefinitions.find((d) => d.label === tag);
                  return (
                    <span
                      key={tag}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                        def?.color
                          ? ""
                          : "border-[--color-border] bg-[--color-accent] text-[--color-text-muted]"
                      }`}
                      style={
                        def?.color
                          ? {
                              borderColor: def.color + "40",
                              backgroundColor: def.color + "15",
                              color: def.color,
                            }
                          : undefined
                      }
                    >
                      <Tag size={10} />
                      {tag}
                    </span>
                  );
                })
              ) : (
                <span className="text-[10px] text-[--color-text-muted]">
                  No tags assigned.
                </span>
              )}
              <button
                type="button"
                onClick={openTagEditor}
                className="inline-flex items-center gap-1 rounded-full border border-[--color-border] bg-[--color-bg-muted] px-2 py-0.5 text-[10px] font-medium text-[--color-text-muted] transition-colors hover:bg-[--color-bg] hover:text-[--color-text]"
              >
                <Pencil size={10} />
                Edit tags
              </button>
            </span>
          </div>
        }
        isOpen={isOpen}
        onClose={() => {
          setTitleEditing(false);
          setStatusDraft(campaign.status);
          onClose();
        }}
        width={1080}
        bodyClassName="px-5 py-4"
      >
        <div className="space-y-4">
          <div className="flex gap-6 h-[65vh]">
            <nav className="w-44 shrink-0 space-y-1">
              {(
                [
                  { key: "overview", label: "Overview", icon: LayoutGrid },
                  { key: "clients", label: "Clients", icon: Users },
                  { key: "affiliates", label: "Affiliates", icon: HandHeart },
                  { key: "integrations", label: "Integrations", icon: Plug },
                  { key: "settings", label: "Configuration", icon: Settings2 },
                  { key: "history", label: "History", icon: History },
                ] as const
              ).map((item) => {
                const Icon = item.icon || Link2;
                const active = tab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onTabChange(item.key)}
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition ${active ? "bg-[--color-panel] text-[--color-text-strong]" : "text-[--color-text-muted] hover:text-[--color-text]"}`}
                  >
                    <Icon size={16} />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div className="flex-1 min-w-0 overflow-y-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="space-y-4"
                >
                  {tab === "overview" && (
                    <>
                      <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
                        <InfoItem
                          label="Created"
                          value={formatDateTime(campaign.created_at)}
                        />
                        <InfoItem
                          label="Updated"
                          value={formatDateTime(campaign.updated_at)}
                        />
                        <InfoItem
                          label="Lead Count"
                          value={leadsForCampaign.length.toString()}
                          onClick={() => onOpenLeadsForCampaign(campaign.id)}
                        />
                        <InfoItem
                          label="Linked Clients"
                          value={linkedClients.length.toString()}
                          onClick={() => onTabChange("clients")}
                        />
                        <InfoItem
                          label="Linked Affiliates"
                          value={linkedAffiliates.length.toString()}
                          onClick={() => onTabChange("affiliates")}
                        />
                      </div>

                      {/* Overview shortcuts → Criteria, Logic, Distribution */}
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {/* Criteria */}
                        <button
                          type="button"
                          onClick={() => {
                            setSettingsSubTab("base-criteria");
                            onTabChange("settings", "base-criteria");
                          }}
                          className="flex items-start gap-3 rounded-lg border border-[--color-border] bg-[--color-panel] px-4 py-3 text-left transition hover:border-[--color-primary] hover:bg-[--color-accent]"
                        >
                          <LayoutGrid
                            size={16}
                            className="mt-0.5 shrink-0 text-[--color-primary]"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-[--color-text-strong]">
                              Criteria
                            </p>
                            <p className="mt-0.5 text-[11px] text-[--color-text-muted]">
                              {criteriaFields.length} field
                              {criteriaFields.length !== 1 ? "s" : ""} defined
                            </p>
                          </div>
                          <ArrowRight
                            size={13}
                            className="ml-auto mt-0.5 shrink-0 text-[--color-text-muted]"
                          />
                        </button>

                        {/* Logic */}
                        <button
                          type="button"
                          onClick={() => {
                            setSettingsSubTab("logic");
                            onTabChange("settings", "logic");
                          }}
                          className="flex items-start gap-3 rounded-lg border border-[--color-border] bg-[--color-panel] px-4 py-3 text-left transition hover:border-[--color-primary] hover:bg-[--color-accent]"
                        >
                          <GitBranch
                            size={16}
                            className="mt-0.5 shrink-0 text-[--color-primary]"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-[--color-text-strong]">
                              Logic
                            </p>
                            <p className="mt-0.5 text-[11px] text-[--color-text-muted]">
                              {logicRules.length} rule
                              {logicRules.length !== 1 ? "s" : ""} defined
                            </p>
                          </div>
                          <ArrowRight
                            size={13}
                            className="ml-auto mt-0.5 shrink-0 text-[--color-text-muted]"
                          />
                        </button>

                        {/* Distribution */}
                        <button
                          type="button"
                          onClick={() => {
                            setSettingsSubTab("routing");
                            onTabChange("settings", "routing");
                          }}
                          className="flex items-start gap-3 rounded-lg border border-[--color-border] bg-[--color-panel] px-4 py-3 text-left transition hover:border-[--color-primary] hover:bg-[--color-accent]"
                        >
                          <Settings2
                            size={16}
                            className="mt-0.5 shrink-0 text-[--color-primary]"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-[--color-text-strong]">
                              Distribution
                            </p>
                            <p className="mt-0.5 text-[11px] text-[--color-text-muted]">
                              {campaign.distribution?.enabled
                                ? `${campaign.distribution.mode === "round_robin" ? "Round Robin" : "Weighted"} · Enabled`
                                : "Distribution disabled"}
                            </p>
                          </div>
                          <ArrowRight
                            size={13}
                            className="ml-auto mt-0.5 shrink-0 text-[--color-text-muted]"
                          />
                        </button>
                      </div>
                    </>
                  )}
                  {tab === "clients" && (
                    <div className="space-y-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <SectionLabel>Linked Clients</SectionLabel>
                        <DisabledTooltip
                          inline
                          message={
                            !campaign
                              ? ""
                              : !campaign.criteria_set_id
                                ? "Campaign needs criteria before linking participants."
                                : !campaign.logic_set_id
                                  ? "Campaign needs logic rules before linking participants."
                                  : availableClients.length === 0
                                    ? clients.filter(
                                        (c) => c.status === "ACTIVE",
                                      ).length === 0
                                      ? "There are no active clients to add to this campaign."
                                      : "All active clients are already linked to this campaign."
                                    : ""
                          }
                        >
                          <Button
                            size="sm"
                            iconLeft={<UserPlus size={14} />}
                            disabled={
                              availableClients.length === 0 ||
                              !campaign?.criteria_set_id ||
                              !campaign?.logic_set_id
                            }
                            onClick={() => setLinkClientModalOpen(true)}
                          >
                            Add Client
                          </Button>
                        </DisabledTooltip>
                      </div>
                      <div className="space-y-2 text-sm">
                        {linkedClients.length === 0 ? (
                          <p className="text-[--color-text-muted]">
                            No linked clients yet.
                          </p>
                        ) : (
                          linkedClients.map((c) => {
                            const link = clientLinkMap.get(c.id);
                            const infoOpen = openInfoId === `client-${c.id}`;
                            return (
                              <div
                                key={c.id}
                                className="rounded-md bg-[--color-panel] overflow-hidden"
                              >
                                <div className="flex items-center justify-between px-3 py-2">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-semibold text-[--color-text-strong]">
                                        {c.name}
                                      </span>
                                      <span
                                        className="text-xs text-[--color-text-muted] font-mono cursor-help"
                                        title="Client ID"
                                      >
                                        ({c.id})
                                      </span>
                                      <Badge
                                        tone={
                                          statusColorMap[
                                            link?.status || "TEST"
                                          ] || "neutral"
                                        }
                                      >
                                        {link?.status || "TEST"}
                                      </Badge>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onOpenLeadsForCampaign(campaign.id, {
                                          mode: getClientLeadMode(link),
                                        })
                                      }
                                      className="mt-1 text-left text-xs text-[--color-text-muted] hover:text-[--color-primary] hover:underline"
                                    >
                                      Leads sold: {getClientLeadCount(link)}
                                    </button>
                                    {(() => {
                                      const clientOverride =
                                        campaign?.client_overrides?.[c.id];
                                      const clientRules =
                                        clientOverride?.logic_rules ?? [];
                                      const ruleCount = clientRules.length;
                                      const campaignFieldNames = new Set(
                                        logicRules.flatMap((r) =>
                                          r.groups.flatMap((g) =>
                                            g.conditions.map(
                                              (cond) => cond.field_name,
                                            ),
                                          ),
                                        ),
                                      );
                                      let hasOverride = false;
                                      let hasExtension = false;
                                      if (campaignFieldNames.size > 0) {
                                        for (const rule of clientRules) {
                                          for (const group of rule.groups) {
                                            for (const cond of group.conditions) {
                                              if (
                                                campaignFieldNames.has(
                                                  cond.field_name,
                                                )
                                              )
                                                hasOverride = true;
                                              else hasExtension = true;
                                            }
                                          }
                                        }
                                      }
                                      return (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openClientLogicManager(c.id)
                                          }
                                          className="mt-1 flex items-center gap-1.5 text-left text-xs text-[--color-text-muted] hover:text-[--color-primary] transition-colors group"
                                          title="Manage logic rules for this client"
                                        >
                                          <GitBranch
                                            size={11}
                                            className="shrink-0 opacity-60 group-hover:opacity-100"
                                          />
                                          <span className="group-hover:underline">
                                            {ruleCount > 0
                                              ? `${ruleCount} logic rule${ruleCount !== 1 ? "s" : ""}`
                                              : "Logic rules"}
                                          </span>
                                          {hasOverride && (
                                            <span className="rounded px-1 py-px text-[10px] font-semibold bg-amber-500/15 text-amber-500 leading-tight">
                                              override
                                            </span>
                                          )}
                                          {hasExtension && (
                                            <span className="rounded px-1 py-px text-[10px] font-semibold bg-blue-500/15 text-blue-400 leading-tight">
                                              extension
                                            </span>
                                          )}
                                          <span
                                            className="rounded px-1 py-px text-[10px] font-semibold leading-tight bg-purple-500/15 text-purple-400"
                                            title="Uses current campaign logic rules"
                                          >
                                            inherits
                                          </span>
                                        </button>
                                      );
                                    })()}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const existing = link?.delivery_config;
                                        setDeliveryDraft(
                                          existing
                                            ? {
                                                url: existing.url ?? "",
                                                method:
                                                  existing.method ?? "POST",
                                                headers: existing.headers,
                                                payload_mapping:
                                                  existing.payload_mapping
                                                    ?.length > 0
                                                    ? existing.payload_mapping
                                                    : [],
                                                acceptance_rules:
                                                  existing.acceptance_rules
                                                    ?.length > 0
                                                    ? existing.acceptance_rules
                                                    : [],
                                              }
                                            : defaultDeliveryConfig(),
                                        );
                                        setDeliveryTab("request");
                                        setDeliveryClientId(c.id);
                                      }}
                                      className="mt-1 flex items-center gap-1 text-left text-xs text-[--color-text-muted] hover:text-[--color-primary] transition-colors group"
                                      title="Configure delivery endpoint"
                                    >
                                      <Settings2
                                        size={11}
                                        className="shrink-0 opacity-60 group-hover:opacity-100"
                                      />
                                      <span className="group-hover:underline">
                                        Configure delivery
                                      </span>
                                    </button>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0 ml-3">
                                    <button
                                      type="button"
                                      title="Details"
                                      onClick={() =>
                                        setOpenInfoId(
                                          infoOpen ? null : `client-${c.id}`,
                                        )
                                      }
                                      className={`rounded p-1 transition-colors ${
                                        infoOpen
                                          ? "text-[--color-primary]"
                                          : "text-[--color-text-muted] hover:text-[--color-primary]"
                                      }`}
                                    >
                                      <Info size={15} />
                                    </button>
                                    <Button
                                      size="sm"
                                      className="bg-amber-500 text-white hover:bg-amber-600"
                                      onClick={() =>
                                        setParticipantAction({
                                          type: "client",
                                          id: c.id,
                                          statusDraft: link?.status || "TEST",
                                        })
                                      }
                                    >
                                      Actions
                                    </Button>
                                  </div>
                                </div>
                                <AnimatePresence>
                                  {infoOpen && (
                                    <motion.div
                                      key="client-info"
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: "auto" }}
                                      exit={{ opacity: 0, height: 0 }}
                                      transition={{
                                        duration: 0.2,
                                        ease: "easeOut",
                                      }}
                                      className="overflow-hidden"
                                    >
                                      <div className="border-t border-[--color-border] bg-[--color-bg-muted] px-3 py-3 text-xs space-y-2">
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                          <div>
                                            <p className="uppercase tracking-wide text-[--color-text-muted] mb-1">
                                              Email
                                            </p>
                                            <p className="font-medium text-[--color-text-strong]">
                                              {c.email || "—"}
                                            </p>
                                          </div>
                                          <div>
                                            <p className="uppercase tracking-wide text-[--color-text-muted] mb-1">
                                              Added
                                            </p>
                                            <p className="font-medium text-[--color-text-strong]">
                                              {link?.added_at
                                                ? formatDateTime(link.added_at)
                                                : "—"}
                                            </p>
                                          </div>
                                          <div className="flex flex-col items-start gap-1">
                                            <HoverTooltip message="Whether this client is currently allowed to receive leads from this campaign (TEST = trial mode, LIVE = active, DISABLED = blocked)">
                                              <p className="uppercase tracking-wide text-[--color-text-muted] inline-flex items-center gap-1">
                                                Client Campaign Status
                                                <Info size={10} />
                                              </p>
                                            </HoverTooltip>
                                            <Badge
                                              tone={
                                                statusColorMap[
                                                  link?.status || "TEST"
                                                ] || "neutral"
                                              }
                                            >
                                              {link?.status || "TEST"}
                                            </Badge>
                                          </div>
                                          <div>
                                            <p className="uppercase tracking-wide text-[--color-text-muted] mb-1">
                                              Client Status
                                            </p>
                                            <Badge
                                              tone={
                                                c.status === "ACTIVE"
                                                  ? "success"
                                                  : "neutral"
                                              }
                                            >
                                              {c.status}
                                            </Badge>
                                          </div>
                                          <div>
                                            <p className="uppercase tracking-wide text-[--color-text-muted] mb-1">
                                              Created By
                                            </p>
                                            <p className="font-medium text-[--color-text-strong]">
                                              {resolveChangedBy(c.created_by) ||
                                                "—"}
                                            </p>
                                          </div>
                                          <div>
                                            <p className="uppercase tracking-wide text-[--color-text-muted] mb-1">
                                              Last Updated
                                            </p>
                                            <p className="font-medium text-[--color-text-strong]">
                                              {c.updated_at
                                                ? formatDateTime(c.updated_at)
                                                : "—"}
                                            </p>
                                          </div>
                                          {resolveChangedBy(c.updated_by) ? (
                                            <div>
                                              <p className="uppercase tracking-wide text-[--color-text-muted] mb-1">
                                                Updated By
                                              </p>
                                              <p className="font-medium text-[--color-text-strong]">
                                                {resolveChangedBy(c.updated_by)}
                                              </p>
                                            </div>
                                          ) : null}
                                        </div>
                                        {link?.history?.length ? (
                                          <div className="mt-2 rounded border border-[--color-border] overflow-hidden">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setOpenHistoryId(
                                                  openHistoryId ===
                                                    `client-hist-${c.id}`
                                                    ? null
                                                    : `client-hist-${c.id}`,
                                                )
                                              }
                                              className="flex w-full items-center justify-between px-2.5 py-1.5 text-left text-xs transition hover:bg-[--color-panel]"
                                            >
                                              <span className="font-semibold text-[--color-text-muted] uppercase tracking-wide">
                                                Participation History
                                                <span className="ml-1 font-normal normal-case">
                                                  ({link.history.length})
                                                </span>
                                              </span>
                                              <ChevronDown
                                                size={12}
                                                className={`text-[--color-text-muted] transition-transform duration-200 ${openHistoryId === `client-hist-${c.id}` ? "rotate-180" : ""}`}
                                              />
                                            </button>
                                            <AnimatePresence>
                                              {openHistoryId ===
                                                `client-hist-${c.id}` && (
                                                <motion.ul
                                                  key="client-hist"
                                                  initial={{
                                                    opacity: 0,
                                                    height: 0,
                                                  }}
                                                  animate={{
                                                    opacity: 1,
                                                    height: "auto",
                                                  }}
                                                  exit={{
                                                    opacity: 0,
                                                    height: 0,
                                                  }}
                                                  transition={{
                                                    duration: 0.18,
                                                    ease: "easeOut",
                                                  }}
                                                  className="overflow-hidden divide-y divide-[--color-border] px-2.5"
                                                >
                                                  {link.history.map(
                                                    (entry, idx) => (
                                                      <li
                                                        key={idx}
                                                        className="py-1.5 space-y-0.5"
                                                      >
                                                        <p className="text-[--color-text]">
                                                          {entry.event ===
                                                            "linked" && (
                                                            <>
                                                              Linked — status
                                                              set to{" "}
                                                              <span className="font-semibold">
                                                                {entry.to}
                                                              </span>
                                                            </>
                                                          )}
                                                          {entry.event ===
                                                            "status_changed" && (
                                                            <>
                                                              Status changed
                                                              from{" "}
                                                              <span className="font-semibold">
                                                                {entry.from}
                                                              </span>{" "}
                                                              to{" "}
                                                              <span className="font-semibold">
                                                                {entry.to}
                                                              </span>
                                                            </>
                                                          )}
                                                          {entry.event ===
                                                            "key_rotated" && (
                                                            <>
                                                              Client key rotated
                                                            </>
                                                          )}
                                                        </p>
                                                        <p className="text-[--color-text-muted]">
                                                          {formatDateTime(
                                                            entry.changed_at,
                                                          )}
                                                          {resolveChangedBy(
                                                            entry.changed_by,
                                                          )
                                                            ? ` · by ${resolveChangedBy(entry.changed_by)}`
                                                            : ""}
                                                        </p>
                                                      </li>
                                                    ),
                                                  )}
                                                </motion.ul>
                                              )}
                                            </AnimatePresence>
                                          </div>
                                        ) : null}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}

                  {tab === "affiliates" && (
                    <div className="space-y-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <SectionLabel>Linked Affiliates</SectionLabel>
                        <DisabledTooltip
                          inline
                          message={
                            !campaign
                              ? ""
                              : !campaign.criteria_set_id
                                ? "Campaign needs criteria before linking participants."
                                : !campaign.logic_set_id
                                  ? "Campaign needs logic rules before linking participants."
                                  : availableAffiliates.length === 0
                                    ? affiliates.filter(
                                        (a) => a.status === "ACTIVE",
                                      ).length === 0
                                      ? "There are no active affiliates to add to this campaign."
                                      : "All active affiliates are already linked to this campaign."
                                    : ""
                          }
                        >
                          <Button
                            size="sm"
                            iconLeft={<UserPlus size={14} />}
                            disabled={
                              availableAffiliates.length === 0 ||
                              !campaign?.criteria_set_id ||
                              !campaign?.logic_set_id
                            }
                            onClick={() => setLinkAffiliateModalOpen(true)}
                          >
                            Add Affiliate
                          </Button>
                        </DisabledTooltip>
                      </div>
                      <div className="space-y-2 text-sm">
                        {linkedAffiliates.length === 0 ? (
                          <p className="text-[--color-text-muted]">
                            No linked affiliates yet.
                          </p>
                        ) : (
                          linkedAffiliates.map((a) => {
                            const link = affiliateLinkMap.get(a.id);
                            const isFocused = focusAffiliateId === a.id;
                            const infoOpen = openInfoId === `affiliate-${a.id}`;
                            const isLiveAffiliate = link?.status === "LIVE";
                            const affiliateLeadCount = link?.campaign_key
                              ? ((isLiveAffiliate
                                  ? liveLeadsByCampaignKey
                                  : leadsByCampaignKey
                                ).get(link.campaign_key) ?? 0)
                              : 0;
                            return (
                              <div
                                key={a.id}
                                className={`rounded-md bg-[--color-panel] overflow-hidden ${
                                  isFocused
                                    ? "ring-2 ring-[--color-primary]"
                                    : ""
                                }`}
                              >
                                <div className="flex items-center justify-between px-3 py-2">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-semibold text-[--color-text-strong]">
                                        {a.name}
                                      </span>
                                      <span
                                        className="text-xs text-[--color-text-muted] font-mono cursor-help"
                                        title="Affiliate ID"
                                      >
                                        ({a.id})
                                      </span>
                                      <Badge
                                        tone={
                                          statusColorMap[
                                            link?.status || "TEST"
                                          ] || "neutral"
                                        }
                                      >
                                        {link?.status || "TEST"}
                                      </Badge>
                                    </div>
                                    {link?.campaign_key ? (
                                      <div className="flex flex-col gap-0.5 mt-1">
                                        <div className="flex items-center gap-1 text-xs text-[--color-text-muted]">
                                          <HoverTooltip message="Affiliate Campaign Key">
                                            <span className="font-mono cursor-help">
                                              {link.campaign_key}
                                            </span>
                                          </HoverTooltip>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              navigator.clipboard.writeText(
                                                link.campaign_key,
                                              );
                                              toast.success(
                                                "Campaign Key copied to clipboard",
                                              );
                                            }}
                                            className="rounded p-0.5 hover:text-[--color-primary] transition-colors"
                                          >
                                            <Copy size={11} />
                                          </button>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            onOpenLeadsForCampaign(
                                              campaign.id,
                                              {
                                                affiliateId: a.id,
                                                mode: leadModeFromAffiliateStatus(
                                                  link?.status,
                                                ),
                                              },
                                            )
                                          }
                                          className="text-left text-xs text-[--color-text-muted] hover:text-[--color-primary] hover:underline w-fit"
                                        >
                                          Total leads: {affiliateLeadCount}
                                        </button>
                                        {link?.status === "LIVE" &&
                                          (() => {
                                            const cap = link?.lead_cap ?? null;
                                            const remaining =
                                              link?.leads_remaining ?? null;
                                            const pct =
                                              link?.quota_completion_percent ??
                                              null;
                                            return (
                                              <>
                                                {cap !== null && (
                                                  <>
                                                    <p className="text-xs text-[--color-text-muted]">
                                                      Remaining:{" "}
                                                      <span
                                                        className={`font-medium ${
                                                          remaining === 0
                                                            ? "text-red-500"
                                                            : pct !== null &&
                                                                pct >= 90
                                                              ? "text-amber-500"
                                                              : "text-[--color-text]"
                                                        }`}
                                                      >
                                                        {remaining}
                                                      </span>
                                                    </p>
                                                    <div className="flex items-center gap-2">
                                                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[--color-border]">
                                                        <div
                                                          className={`h-full rounded-full transition-all ${
                                                            pct !== null &&
                                                            pct >= 100
                                                              ? "bg-red-500"
                                                              : pct !== null &&
                                                                  pct >= 90
                                                                ? "bg-amber-500"
                                                                : "bg-[--color-primary]"
                                                          }`}
                                                          style={{
                                                            width: `${pct ?? 0}%`,
                                                          }}
                                                        />
                                                      </div>
                                                      <span className="shrink-0 text-[11px] text-[--color-text-muted]">
                                                        {pct ?? 0}%
                                                      </span>
                                                    </div>
                                                  </>
                                                )}
                                              </>
                                            );
                                          })()}
                                        {isLiveAffiliate && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setAffiliateCapModalId(a.id)
                                            }
                                            className="flex items-center gap-1.5 text-left text-xs text-[--color-text-muted] hover:text-[--color-primary] transition-colors group w-fit"
                                            title="Configure lead cap"
                                          >
                                            <Gauge
                                              size={11}
                                              className="shrink-0 opacity-60 group-hover:opacity-100"
                                            />
                                            <span className="group-hover:underline">
                                              Lead cap:{" "}
                                              <span className="font-medium text-[--color-text] group-hover:text-[--color-primary]">
                                                {(link?.lead_cap ?? null) ===
                                                null
                                                  ? "Uncapped"
                                                  : link!.lead_cap}
                                              </span>
                                            </span>
                                          </button>
                                        )}
                                        {(() => {
                                          const affiliateOverride =
                                            campaign?.affiliate_overrides?.[
                                              a.id
                                            ];
                                          const affiliateRules =
                                            affiliateOverride?.logic_rules ??
                                            [];
                                          const ruleCount =
                                            affiliateRules.length;
                                          const campaignFieldNames = new Set(
                                            logicRules.flatMap((r) =>
                                              r.groups.flatMap((g) =>
                                                g.conditions.map(
                                                  (cond) => cond.field_name,
                                                ),
                                              ),
                                            ),
                                          );
                                          let hasOverride = false;
                                          let hasExtension = false;
                                          if (campaignFieldNames.size > 0) {
                                            for (const rule of affiliateRules) {
                                              for (const group of rule.groups) {
                                                for (const cond of group.conditions) {
                                                  if (
                                                    campaignFieldNames.has(
                                                      cond.field_name,
                                                    )
                                                  )
                                                    hasOverride = true;
                                                  else hasExtension = true;
                                                }
                                              }
                                            }
                                          }
                                          return (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                openAffiliateLogicManager(a.id)
                                              }
                                              className="flex items-center gap-1.5 text-left text-xs text-[--color-text-muted] hover:text-[--color-primary] transition-colors group w-fit"
                                              title="Manage logic rules for this affiliate"
                                            >
                                              <GitBranch
                                                size={11}
                                                className="shrink-0 opacity-60 group-hover:opacity-100"
                                              />
                                              <span className="group-hover:underline">
                                                {ruleCount > 0
                                                  ? `${ruleCount} logic rule${ruleCount !== 1 ? "s" : ""}`
                                                  : "Logic rules"}
                                              </span>
                                              {hasOverride && (
                                                <span className="rounded px-1 py-px text-[10px] font-semibold bg-amber-500/15 text-amber-500 leading-tight">
                                                  override
                                                </span>
                                              )}
                                              {hasExtension && (
                                                <span className="rounded px-1 py-px text-[10px] font-semibold bg-blue-500/15 text-blue-400 leading-tight">
                                                  extension
                                                </span>
                                              )}
                                              <span
                                                className="rounded px-1 py-px text-[10px] font-semibold leading-tight bg-purple-500/15 text-purple-400"
                                                title="Uses current campaign logic rules"
                                              >
                                                inherits
                                              </span>
                                            </button>
                                          );
                                        })()}
                                        <div className="flex items-center gap-1.5 text-xs text-[--color-text-muted]">
                                          <button
                                            type="button"
                                            title="Configure fire pixel"
                                            onClick={() => {
                                              const existing =
                                                link?.sold_pixel_config;
                                              setPixelDraft(
                                                existing
                                                  ? {
                                                      enabled: Boolean(
                                                        existing.enabled,
                                                      ),
                                                      url: existing.url ?? "",
                                                      method:
                                                        existing.method ??
                                                        "POST",
                                                      headers: existing.headers,
                                                      payload_mapping:
                                                        normalizePixelMappingRows(
                                                          existing.payload_mapping,
                                                          existing.parameter_mode ??
                                                            "query",
                                                        ),
                                                    }
                                                  : defaultAffiliatePixelConfig(),
                                              );
                                              setPixelSaveAttempted(false);
                                              setPixelConfigTab("pixel");
                                              setPixelAffiliateId(a.id);
                                            }}
                                            className="flex items-center gap-1.5 text-left text-xs text-[--color-text-muted] hover:text-[--color-primary] transition-colors group w-fit"
                                          >
                                            <Flame
                                              size={11}
                                              className="shrink-0 opacity-60 group-hover:opacity-100"
                                            />
                                            <span className="group-hover:underline">
                                              Fire pixel:{" "}
                                              <span
                                                className={`font-medium group-hover:no-underline ${
                                                  link?.sold_pixel_config
                                                    ?.enabled
                                                    ? "text-green-600"
                                                    : "text-[--color-text-muted]"
                                                }`}
                                              >
                                                {link?.sold_pixel_config
                                                  ?.enabled
                                                  ? "Enabled"
                                                  : "Disabled"}
                                              </span>
                                            </span>
                                          </button>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const existing =
                                              link?.sold_pixel_config;
                                            setPixelDraft(
                                              existing
                                                ? {
                                                    enabled: Boolean(
                                                      existing.enabled,
                                                    ),
                                                    url: existing.url ?? "",
                                                    method:
                                                      existing.method ?? "POST",
                                                    headers: existing.headers,
                                                    payload_mapping:
                                                      normalizePixelMappingRows(
                                                        existing.payload_mapping,
                                                        existing.parameter_mode ??
                                                          "query",
                                                      ),
                                                  }
                                                : defaultAffiliatePixelConfig(),
                                            );
                                            setPixelSaveAttempted(false);
                                            setPixelConfigTab("pixel_criteria");
                                            setPixelAffiliateId(a.id);
                                          }}
                                          className="flex items-center gap-1.5 text-left text-xs text-[--color-text-muted] hover:text-[--color-primary] transition-colors group w-fit"
                                          title="Manage pixel firing criteria for this affiliate"
                                        >
                                          <Gauge
                                            size={11}
                                            className="shrink-0 opacity-60 group-hover:opacity-100"
                                          />
                                          <span className="group-hover:underline">
                                            Pixel criteria:{" "}
                                            <span className="font-medium">
                                              {link?.pixel_criteria?.length
                                                ? `${link.pixel_criteria.length} rule${link.pixel_criteria.length === 1 ? "" : "s"}`
                                                : "None"}
                                            </span>
                                          </span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const existing =
                                              link?.sold_pixel_config;
                                            setPixelDraft(
                                              existing
                                                ? {
                                                    enabled: Boolean(
                                                      existing.enabled,
                                                    ),
                                                    url: existing.url ?? "",
                                                    method:
                                                      existing.method ?? "POST",
                                                    headers: existing.headers,
                                                    payload_mapping:
                                                      normalizePixelMappingRows(
                                                        existing.payload_mapping,
                                                        existing.parameter_mode ??
                                                          "query",
                                                      ),
                                                  }
                                                : defaultAffiliatePixelConfig(),
                                            );
                                            setPixelSaveAttempted(false);
                                            setPixelConfigTab("sold_criteria");
                                            setPixelAffiliateId(a.id);
                                          }}
                                          className="flex items-center gap-1.5 text-left text-xs text-[--color-text-muted] hover:text-[--color-primary] transition-colors group w-fit"
                                          title="Manage sold definition criteria for this affiliate"
                                        >
                                          <Check
                                            size={11}
                                            className="shrink-0 opacity-60 group-hover:opacity-100"
                                          />
                                          <span className="group-hover:underline">
                                            Sold criteria:{" "}
                                            <span className="font-medium">
                                              {link?.sold_criteria?.length
                                                ? `${link.sold_criteria.length} rule${link.sold_criteria.length === 1 ? "" : "s"}`
                                                : "None"}
                                            </span>
                                          </span>
                                        </button>
                                        {campaign && (
                                          <button
                                            type="button"
                                            disabled={
                                              generatingPdfForAffiliate === a.id
                                            }
                                            onClick={async () => {
                                              setGeneratingPdfForAffiliate(
                                                a.id,
                                              );
                                              try {
                                                await generatePostingInstructions(
                                                  {
                                                    campaignId: campaign.id,
                                                    affiliateId: a.id,
                                                  },
                                                );
                                              } catch (err: any) {
                                                toast.error(
                                                  err?.message ||
                                                    "Failed to generate posting instructions",
                                                );
                                              } finally {
                                                setGeneratingPdfForAffiliate(
                                                  null,
                                                );
                                              }
                                            }}
                                            className="flex items-center gap-1 text-xs text-[--color-primary] hover:underline w-fit disabled:opacity-50 disabled:cursor-not-allowed"
                                          >
                                            <FileText size={11} />
                                            {generatingPdfForAffiliate === a.id
                                              ? "Generating…"
                                              : "Generate Posting Instructions"}
                                          </button>
                                        )}
                                      </div>
                                    ) : null}
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0 ml-3">
                                    <button
                                      type="button"
                                      title="Details"
                                      onClick={() =>
                                        setOpenInfoId(
                                          infoOpen ? null : `affiliate-${a.id}`,
                                        )
                                      }
                                      className={`rounded p-1 transition-colors ${
                                        infoOpen
                                          ? "text-[--color-primary]"
                                          : "text-[--color-text-muted] hover:text-[--color-primary]"
                                      }`}
                                    >
                                      <Info size={15} />
                                    </button>
                                    <Button
                                      size="sm"
                                      className="bg-amber-500 text-white hover:bg-amber-600"
                                      onClick={() =>
                                        setParticipantAction({
                                          type: "affiliate",
                                          id: a.id,
                                          statusDraft: link?.status || "TEST",
                                        })
                                      }
                                    >
                                      Actions
                                    </Button>
                                  </div>
                                </div>
                                <AnimatePresence>
                                  {infoOpen && (
                                    <motion.div
                                      key="affiliate-info"
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: "auto" }}
                                      exit={{ opacity: 0, height: 0 }}
                                      transition={{
                                        duration: 0.2,
                                        ease: "easeOut",
                                      }}
                                      className="overflow-hidden"
                                    >
                                      <div className="border-t border-[--color-border] bg-[--color-bg-muted] px-3 py-3 text-xs space-y-2">
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                          <div>
                                            <p className="uppercase tracking-wide text-[--color-text-muted] mb-1">
                                              Email
                                            </p>
                                            <p className="font-medium text-[--color-text-strong]">
                                              {a.email || "—"}
                                            </p>
                                          </div>
                                          <div>
                                            <p className="uppercase tracking-wide text-[--color-text-muted] mb-1">
                                              Added
                                            </p>
                                            <p className="font-medium text-[--color-text-strong]">
                                              {link?.added_at
                                                ? formatDateTime(link.added_at)
                                                : "—"}
                                            </p>
                                          </div>
                                          <div className="flex flex-col items-start gap-1">
                                            <HoverTooltip message="Whether this affiliate is currently allowed to send leads to this campaign (TEST = trial mode, LIVE = active, DISABLED = blocked)">
                                              <p className="uppercase tracking-wide text-[--color-text-muted] inline-flex items-center gap-1">
                                                Affiliate Campaign Status
                                                <Info size={10} />
                                              </p>
                                            </HoverTooltip>
                                            <Badge
                                              tone={
                                                statusColorMap[
                                                  link?.status || "TEST"
                                                ] || "neutral"
                                              }
                                            >
                                              {link?.status || "TEST"}
                                            </Badge>
                                          </div>
                                          <div>
                                            <p className="uppercase tracking-wide text-[--color-text-muted] mb-1">
                                              Affiliate Status
                                            </p>
                                            <Badge
                                              tone={
                                                a.status === "ACTIVE"
                                                  ? "success"
                                                  : "neutral"
                                              }
                                            >
                                              {a.status}
                                            </Badge>
                                          </div>
                                          <div>
                                            <p className="uppercase tracking-wide text-[--color-text-muted] mb-1">
                                              Created By
                                            </p>
                                            <p className="font-medium text-[--color-text-strong]">
                                              {resolveChangedBy(a.created_by) ||
                                                "—"}
                                            </p>
                                          </div>
                                          <div>
                                            <p className="uppercase tracking-wide text-[--color-text-muted] mb-1">
                                              Last Updated
                                            </p>
                                            <p className="font-medium text-[--color-text-strong]">
                                              {a.updated_at
                                                ? formatDateTime(a.updated_at)
                                                : "—"}
                                            </p>
                                          </div>
                                          {resolveChangedBy(a.updated_by) ? (
                                            <div>
                                              <p className="uppercase tracking-wide text-[--color-text-muted] mb-1">
                                                Updated By
                                              </p>
                                              <p className="font-medium text-[--color-text-strong]">
                                                {resolveChangedBy(a.updated_by)}
                                              </p>
                                            </div>
                                          ) : null}
                                          {a.phone ? (
                                            <div>
                                              <p className="uppercase tracking-wide text-[--color-text-muted] mb-1">
                                                Phone
                                              </p>
                                              <p className="font-medium text-[--color-text-strong]">
                                                {a.phone}
                                              </p>
                                            </div>
                                          ) : null}
                                          {a.affiliate_code ? (
                                            <div>
                                              <p className="uppercase tracking-wide text-[--color-text-muted] mb-1">
                                                Affiliate Code
                                              </p>
                                              <p className="font-medium font-mono text-[--color-text-strong]">
                                                {a.affiliate_code}
                                              </p>
                                            </div>
                                          ) : null}
                                        </div>
                                        {link?.history?.length ? (
                                          <div className="mt-2 rounded border border-[--color-border] overflow-hidden">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setOpenHistoryId(
                                                  openHistoryId ===
                                                    `affiliate-hist-${a.id}`
                                                    ? null
                                                    : `affiliate-hist-${a.id}`,
                                                )
                                              }
                                              className="flex w-full items-center justify-between px-2.5 py-1.5 text-left text-xs transition hover:bg-[--color-panel]"
                                            >
                                              <span className="font-semibold text-[--color-text-muted] uppercase tracking-wide">
                                                Participation History
                                                <span className="ml-1 font-normal normal-case">
                                                  ({link.history.length})
                                                </span>
                                              </span>
                                              <ChevronDown
                                                size={12}
                                                className={`text-[--color-text-muted] transition-transform duration-200 ${openHistoryId === `affiliate-hist-${a.id}` ? "rotate-180" : ""}`}
                                              />
                                            </button>
                                            <AnimatePresence>
                                              {openHistoryId ===
                                                `affiliate-hist-${a.id}` && (
                                                <motion.ul
                                                  key="affiliate-hist"
                                                  initial={{
                                                    opacity: 0,
                                                    height: 0,
                                                  }}
                                                  animate={{
                                                    opacity: 1,
                                                    height: "auto",
                                                  }}
                                                  exit={{
                                                    opacity: 0,
                                                    height: 0,
                                                  }}
                                                  transition={{
                                                    duration: 0.18,
                                                    ease: "easeOut",
                                                  }}
                                                  className="overflow-hidden divide-y divide-[--color-border] px-2.5"
                                                >
                                                  {link.history.map(
                                                    (entry, idx) => (
                                                      <li
                                                        key={idx}
                                                        className="py-1.5 space-y-0.5"
                                                      >
                                                        <p className="text-[--color-text]">
                                                          {entry.event ===
                                                            "linked" && (
                                                            <>
                                                              Linked — status
                                                              set to{" "}
                                                              <span className="font-semibold">
                                                                {entry.to}
                                                              </span>
                                                            </>
                                                          )}
                                                          {entry.event ===
                                                            "status_changed" && (
                                                            <>
                                                              Status changed
                                                              from{" "}
                                                              <span className="font-semibold">
                                                                {entry.from}
                                                              </span>{" "}
                                                              to{" "}
                                                              <span className="font-semibold">
                                                                {entry.to}
                                                              </span>
                                                            </>
                                                          )}
                                                          {entry.event ===
                                                            "key_rotated" && (
                                                            <>
                                                              Campaign key
                                                              rotated
                                                            </>
                                                          )}
                                                        </p>
                                                        <p className="text-[--color-text-muted]">
                                                          {formatDateTime(
                                                            entry.changed_at,
                                                          )}
                                                          {resolveChangedBy(
                                                            entry.changed_by,
                                                          )
                                                            ? ` · by ${resolveChangedBy(entry.changed_by)}`
                                                            : ""}
                                                        </p>
                                                      </li>
                                                    ),
                                                  )}
                                                </motion.ul>
                                              )}
                                            </AnimatePresence>
                                          </div>
                                        ) : null}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}

                  {tab === "integrations" && (
                    <div className="space-y-3">
                      {/* Duplicate Check card */}
                      <div className="rounded-xl border border-[--color-border] bg-[--color-bg-muted] p-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setDupCheckOpen((v) => !v)}
                            className="flex-1 flex items-center gap-2 text-left min-w-0"
                          >
                            <motion.span
                              animate={{ rotate: dupCheckOpen ? 90 : 0 }}
                              transition={{ duration: 0.15 }}
                              className="shrink-0 text-[--color-text-muted]"
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </motion.span>
                            <p className="text-sm font-semibold text-[--color-text-strong]">
                              Duplicate Check
                            </p>
                          </button>
                          <HoverTooltip message="Duplicate check always runs first — it cannot be reordered">
                            <span className="rounded border border-[--color-border] bg-[--color-bg] px-1.5 py-0.5 text-[10px] font-mono text-[--color-text-muted] cursor-help">
                              Step 1
                            </span>
                          </HoverTooltip>
                          <DisabledTooltip
                            message={
                              dupCheckGloballyDisabled
                                ? "Globally disabled by admin"
                                : ""
                            }
                            inline
                          >
                            <button
                              type="button"
                              role="switch"
                              aria-checked={
                                dupCheckGloballyDisabled
                                  ? false
                                  : duplicateCheckEnabled
                              }
                              disabled={dupCheckGloballyDisabled}
                              onClick={() =>
                                !dupCheckGloballyDisabled &&
                                setDuplicateCheckEnabled((prev) => !prev)
                              }
                              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                                dupCheckGloballyDisabled
                                  ? "opacity-40 cursor-not-allowed bg-[--color-border]"
                                  : duplicateCheckEnabled
                                    ? "bg-[--color-primary]"
                                    : "bg-[--color-border]"
                              }`}
                            >
                              <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-[--color-bg] transition ${
                                  !dupCheckGloballyDisabled &&
                                  duplicateCheckEnabled
                                    ? "translate-x-5"
                                    : "translate-x-1"
                                }`}
                              />
                            </button>
                          </DisabledTooltip>
                        </div>

                        <AnimatePresence initial={false}>
                          {dupCheckOpen && (
                            <motion.div
                              key="dupcheck-details"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{
                                duration: 0.18,
                                ease: "easeInOut",
                              }}
                              style={{ overflow: "hidden" }}
                            >
                              <div
                                className={`mt-3 pt-3 border-t border-[--color-border] space-y-2 ${!duplicateCheckEnabled || dupCheckGloballyDisabled ? "opacity-50 pointer-events-none select-none" : ""}`}
                              >
                                <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                                  Matching Criteria
                                </p>
                                <div className="flex flex-wrap gap-4">
                                  {(["phone", "email"] as const).map(
                                    (criterion) => {
                                      const checked =
                                        duplicateCheckCriteria.includes(
                                          criterion,
                                        );
                                      return (
                                        <label
                                          key={criterion}
                                          className="flex items-center gap-2 text-sm text-[--color-text]"
                                        >
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 accent-[--color-primary]"
                                            checked={checked}
                                            onChange={(e) => {
                                              setDuplicateCheckCriteria(
                                                (prev) => {
                                                  if (e.target.checked) {
                                                    return prev.includes(
                                                      criterion,
                                                    )
                                                      ? prev
                                                      : [...prev, criterion];
                                                  }
                                                  return prev.filter(
                                                    (item) =>
                                                      item !== criterion,
                                                  );
                                                },
                                              );
                                            }}
                                          />
                                          <span className="capitalize">
                                            {criterion}
                                          </span>
                                        </label>
                                      );
                                    },
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Non-duplicate plugins */}
                      <div className="flex flex-col gap-3">
                        {/* Plugins — sorted by step number */}
                        {(() => {
                          const tfFirst = tfStep <= ipqsStep;
                          return (
                            <>
                              {/* TrustedForm card */}
                              <div
                                style={{ order: tfFirst ? 1 : 3 }}
                                className="rounded-xl border border-[--color-border] bg-[--color-bg-muted] p-4"
                              >
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setTrustedFormOpen((v) => !v)
                                    }
                                    className="flex-1 flex items-start gap-2 text-left min-w-0"
                                  >
                                    <motion.span
                                      animate={{
                                        rotate: trustedFormOpen ? 90 : 0,
                                      }}
                                      transition={{ duration: 0.15 }}
                                      className="shrink-0 text-[--color-text-muted] mt-0.5"
                                    >
                                      <ChevronDown className="h-3.5 w-3.5" />
                                    </motion.span>
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold text-[--color-text-strong]">
                                        TrustedForm
                                      </p>
                                    </div>
                                  </button>
                                  {tfStepEditing ? (
                                    <input
                                      type="number"
                                      min={2}
                                      max={99}
                                      autoFocus
                                      value={tfStep}
                                      className="w-12 rounded border border-[--color-primary] bg-[--color-bg] px-1 py-0.5 text-[10px] font-mono text-center text-[--color-text]"
                                      onChange={(e) =>
                                        setTfStep(
                                          Math.max(
                                            2,
                                            parseInt(e.target.value, 10) || 2,
                                          ),
                                        )
                                      }
                                      onBlur={() => setTfStepEditing(false)}
                                      onKeyDown={(e) => {
                                        if (
                                          e.key === "Enter" ||
                                          e.key === "Escape"
                                        )
                                          setTfStepEditing(false);
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  ) : (
                                    <HoverTooltip message="Click to manually set the step number">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setTfStepEditing(true);
                                        }}
                                        className="rounded border border-[--color-border] bg-[--color-bg] px-1.5 py-0.5 text-[10px] font-mono text-[--color-text-muted] hover:border-[--color-primary] hover:text-[--color-primary] transition-colors"
                                      >
                                        Step {tfStep}
                                      </button>
                                    </HoverTooltip>
                                  )}
                                  <DisabledTooltip
                                    message={
                                      trustedFormGloballyDisabled
                                        ? "Globally disabled by admin"
                                        : ""
                                    }
                                    inline
                                  >
                                    <button
                                      type="button"
                                      role="switch"
                                      aria-checked={
                                        trustedFormGloballyDisabled
                                          ? false
                                          : trustedFormEnabled
                                      }
                                      disabled={trustedFormGloballyDisabled}
                                      onClick={() =>
                                        !trustedFormGloballyDisabled &&
                                        setTrustedFormEnabled((prev) => !prev)
                                      }
                                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                                        trustedFormGloballyDisabled
                                          ? "opacity-40 cursor-not-allowed bg-[--color-border]"
                                          : trustedFormEnabled
                                            ? "bg-[--color-primary]"
                                            : "bg-[--color-border]"
                                      }`}
                                    >
                                      <span
                                        className={`inline-block h-5 w-5 transform rounded-full bg-[--color-bg] transition ${
                                          !trustedFormGloballyDisabled &&
                                          trustedFormEnabled
                                            ? "translate-x-5"
                                            : "translate-x-1"
                                        }`}
                                      />
                                    </button>
                                  </DisabledTooltip>
                                </div>
                                {/* Reject-on-failure controls — collapsed by default */}
                                <AnimatePresence initial={false}>
                                  {trustedFormOpen && (
                                    <motion.div
                                      key="tf-details"
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{
                                        height: "auto",
                                        opacity: 1,
                                      }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{
                                        duration: 0.18,
                                        ease: "easeInOut",
                                      }}
                                      style={{ overflow: "hidden" }}
                                    >
                                      <div
                                        className={`mt-3 pt-3 border-t border-[--color-border] space-y-3 ${!trustedFormEnabled || trustedFormGloballyDisabled ? "opacity-50 pointer-events-none select-none" : ""}`}
                                      >
                                        <div className="flex items-center gap-1.5 text-xs">
                                          <HoverTooltip message="When on, a TrustedForm failure rejects the lead. When off, failure is recorded but processing continues.">
                                            <span className="cursor-help text-[--color-text-muted]">
                                              Reject on failure
                                            </span>
                                          </HoverTooltip>
                                          <button
                                            type="button"
                                            role="switch"
                                            aria-checked={trustedFormGate}
                                            onClick={() =>
                                              setTrustedFormGate(
                                                (prev) => !prev,
                                              )
                                            }
                                            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
                                              trustedFormGate
                                                ? "bg-[--color-primary]"
                                                : "bg-[--color-border]"
                                            }`}
                                          >
                                            <span
                                              className={`inline-block h-4 w-4 transform rounded-full bg-[--color-bg] transition ${
                                                trustedFormGate
                                                  ? "translate-x-4"
                                                  : "translate-x-0.5"
                                              }`}
                                            />
                                          </button>
                                          <span className="text-[--color-text-muted]">
                                            {trustedFormGate ? "On" : "Off"}
                                          </span>
                                        </div>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                              {/* Divider between cards — only shown when parallel */}
                              {tfStep === ipqsStep && (
                                <div
                                  style={{ order: 2 }}
                                  className="flex w-full items-center gap-2 px-3 text-[10px] text-[--color-text-muted]"
                                >
                                  <div className="h-px flex-1 border-t border-dashed border-[--color-border]" />
                                  <span className="flex items-center gap-1 font-medium">
                                    <LayoutGrid className="h-3 w-3" />
                                    Parallel
                                  </span>
                                  <div className="h-px flex-1 border-t border-dashed border-[--color-border]" />
                                </div>
                              )}
                              {/* IPQS card */}
                              <div
                                style={{ order: tfFirst ? 3 : 1 }}
                                className="rounded-xl border border-[--color-border] bg-[--color-bg-muted] p-4"
                              >
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setIpqsOpen((v) => !v)}
                                    className="flex-1 flex items-start gap-2 text-left min-w-0"
                                  >
                                    <motion.span
                                      animate={{ rotate: ipqsOpen ? 90 : 0 }}
                                      transition={{ duration: 0.15 }}
                                      className="shrink-0 text-[--color-text-muted] mt-0.5"
                                    >
                                      <ChevronDown className="h-3.5 w-3.5" />
                                    </motion.span>
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold text-[--color-text-strong]">
                                        IPQualityScore (IPQS)
                                      </p>
                                    </div>
                                  </button>
                                  {ipqsStepEditing ? (
                                    <input
                                      type="number"
                                      min={2}
                                      max={99}
                                      autoFocus
                                      value={ipqsStep}
                                      className="w-12 rounded border border-[--color-primary] bg-[--color-bg] px-1 py-0.5 text-[10px] font-mono text-center text-[--color-text]"
                                      onChange={(e) =>
                                        setIpqsStep(
                                          Math.max(
                                            2,
                                            parseInt(e.target.value, 10) || 2,
                                          ),
                                        )
                                      }
                                      onBlur={() => setIpqsStepEditing(false)}
                                      onKeyDown={(e) => {
                                        if (
                                          e.key === "Enter" ||
                                          e.key === "Escape"
                                        )
                                          setIpqsStepEditing(false);
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  ) : (
                                    <HoverTooltip message="Click to manually set the step number">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setIpqsStepEditing(true);
                                        }}
                                        className="rounded border border-[--color-border] bg-[--color-bg] px-1.5 py-0.5 text-[10px] font-mono text-[--color-text-muted] hover:border-[--color-primary] hover:text-[--color-primary] transition-colors"
                                      >
                                        Step {ipqsStep}
                                      </button>
                                    </HoverTooltip>
                                  )}
                                  <DisabledTooltip
                                    message={
                                      ipqsGloballyDisabled
                                        ? "Globally disabled by admin"
                                        : ""
                                    }
                                    inline
                                  >
                                    <button
                                      type="button"
                                      role="switch"
                                      aria-checked={
                                        ipqsGloballyDisabled
                                          ? false
                                          : ipqsConfig.enabled
                                      }
                                      disabled={ipqsGloballyDisabled}
                                      onClick={() =>
                                        !ipqsGloballyDisabled &&
                                        setIpqsConfig((p) => ({
                                          ...p,
                                          enabled: !p.enabled,
                                        }))
                                      }
                                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                                        ipqsGloballyDisabled
                                          ? "opacity-40 cursor-not-allowed bg-[--color-border]"
                                          : ipqsConfig.enabled
                                            ? "bg-[--color-primary]"
                                            : "bg-[--color-border]"
                                      }`}
                                    >
                                      <span
                                        className={`inline-block h-5 w-5 transform rounded-full bg-[--color-bg] transition ${
                                          !ipqsGloballyDisabled &&
                                          ipqsConfig.enabled
                                            ? "translate-x-5"
                                            : "translate-x-1"
                                        }`}
                                      />
                                    </button>
                                  </DisabledTooltip>
                                </div>

                                {/* Settings — collapsed by default */}
                                <AnimatePresence initial={false}>
                                  {ipqsOpen && (
                                    <motion.div
                                      key="ipqs-details"
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{
                                        duration: 0.18,
                                        ease: "easeInOut",
                                      }}
                                      style={{ overflow: "hidden" }}
                                    >
                                      <div
                                        className={`mt-3 pt-3 border-t border-[--color-border] space-y-3 ${!ipqsConfig.enabled || ipqsGloballyDisabled ? "opacity-50 pointer-events-none select-none" : ""}`}
                                      >
                                        {/* Reject-on-failure */}
                                        <div className="flex items-center gap-1.5 text-xs">
                                          <HoverTooltip message="When on, an IPQS failure rejects the lead. When off, failure is recorded but processing continues.">
                                            <span className="cursor-help text-[--color-text-muted]">
                                              Reject on failure
                                            </span>
                                          </HoverTooltip>
                                          <button
                                            type="button"
                                            role="switch"
                                            aria-checked={ipqsGate}
                                            onClick={() =>
                                              setIpqsGate((prev) => !prev)
                                            }
                                            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
                                              ipqsGate
                                                ? "bg-[--color-primary]"
                                                : "bg-[--color-border]"
                                            }`}
                                          >
                                            <span
                                              className={`inline-block h-4 w-4 transform rounded-full bg-[--color-bg] transition ${
                                                ipqsGate
                                                  ? "translate-x-4"
                                                  : "translate-x-0.5"
                                              }`}
                                            />
                                          </button>
                                          <span className="text-[--color-text-muted]">
                                            {ipqsGate ? "On" : "Off"}
                                          </span>
                                        </div>

                                        <AnimatePresence initial={false}>
                                          {true && (
                                            <motion.div
                                              key="ipqs-subs"
                                              initial={{
                                                height: 0,
                                                opacity: 0,
                                              }}
                                              animate={{
                                                height: "auto",
                                                opacity: 1,
                                              }}
                                              exit={{
                                                height: 0,
                                                opacity: 0,
                                              }}
                                              transition={{
                                                duration: 0.2,
                                                ease: "easeInOut",
                                              }}
                                              style={{ overflow: "hidden" }}
                                            >
                                              <div className="pt-2 space-y-2 border-t border-[--color-border]">
                                                {/* ── Phone sub-check ── */}
                                                <div className="rounded-lg border border-[--color-border] bg-[--color-bg] overflow-hidden">
                                                  <div className="flex items-center justify-between px-3 py-2 gap-2">
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        setIpqsPhoneOpen(
                                                          (v) => !v,
                                                        )
                                                      }
                                                      className="flex items-center gap-1.5 text-sm font-medium text-[--color-text] hover:text-[--color-primary] transition-colors"
                                                    >
                                                      <motion.span
                                                        animate={{
                                                          rotate: ipqsPhoneOpen
                                                            ? 90
                                                            : 0,
                                                        }}
                                                        transition={{
                                                          duration: 0.15,
                                                        }}
                                                        className="text-[10px] text-[--color-text-muted]"
                                                      >
                                                        ▶
                                                      </motion.span>
                                                      Phone
                                                    </button>
                                                    <button
                                                      type="button"
                                                      role="switch"
                                                      aria-checked={
                                                        ipqsConfig.phone.enabled
                                                      }
                                                      onClick={() =>
                                                        setIpqsConfig((p) => ({
                                                          ...p,
                                                          phone: {
                                                            ...p.phone,
                                                            enabled:
                                                              !p.phone.enabled,
                                                          },
                                                        }))
                                                      }
                                                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${ipqsConfig.phone.enabled ? "bg-[--color-primary]" : "bg-[--color-border]"}`}
                                                    >
                                                      <span
                                                        className={`inline-block h-4 w-4 transform rounded-full bg-[--color-bg] transition ${ipqsConfig.phone.enabled ? "translate-x-4" : "translate-x-0.5"}`}
                                                      />
                                                    </button>
                                                  </div>
                                                  <AnimatePresence
                                                    initial={false}
                                                  >
                                                    {ipqsPhoneOpen &&
                                                      ipqsConfig.phone
                                                        .enabled && (
                                                        <motion.div
                                                          key="phone-criteria"
                                                          initial={{
                                                            height: 0,
                                                          }}
                                                          animate={{
                                                            height: "auto",
                                                          }}
                                                          exit={{ height: 0 }}
                                                          transition={{
                                                            duration: 0.18,
                                                          }}
                                                          style={{
                                                            overflow: "hidden",
                                                          }}
                                                        >
                                                          <div className="px-3 pb-3 space-y-2.5 border-t border-[--color-border] pt-2.5">
                                                            {/* valid */}
                                                            <div className="flex flex-wrap items-center gap-3 text-xs">
                                                              <input
                                                                type="checkbox"
                                                                className="h-3.5 w-3.5 accent-[--color-primary]"
                                                                checked={
                                                                  ipqsConfig
                                                                    .phone
                                                                    .criteria
                                                                    .valid
                                                                    .enabled
                                                                }
                                                                onChange={(e) =>
                                                                  setIpqsConfig(
                                                                    (p) => ({
                                                                      ...p,
                                                                      phone: {
                                                                        ...p.phone,
                                                                        criteria:
                                                                          {
                                                                            ...p
                                                                              .phone
                                                                              .criteria,
                                                                            valid:
                                                                              {
                                                                                ...p
                                                                                  .phone
                                                                                  .criteria
                                                                                  .valid,
                                                                                enabled:
                                                                                  e
                                                                                    .target
                                                                                    .checked,
                                                                              },
                                                                          },
                                                                      },
                                                                    }),
                                                                  )
                                                                }
                                                              />
                                                              <span className="w-20 text-[--color-text-muted]">
                                                                Valid
                                                              </span>
                                                            </div>
                                                            {/* fraud_score */}
                                                            <div className="flex flex-wrap items-center gap-3 text-xs">
                                                              <input
                                                                type="checkbox"
                                                                className="h-3.5 w-3.5 accent-[--color-primary]"
                                                                checked={
                                                                  ipqsConfig
                                                                    .phone
                                                                    .criteria
                                                                    .fraud_score
                                                                    .enabled
                                                                }
                                                                onChange={(e) =>
                                                                  setIpqsConfig(
                                                                    (p) => ({
                                                                      ...p,
                                                                      phone: {
                                                                        ...p.phone,
                                                                        criteria:
                                                                          {
                                                                            ...p
                                                                              .phone
                                                                              .criteria,
                                                                            fraud_score:
                                                                              {
                                                                                ...p
                                                                                  .phone
                                                                                  .criteria
                                                                                  .fraud_score,
                                                                                enabled:
                                                                                  e
                                                                                    .target
                                                                                    .checked,
                                                                              },
                                                                          },
                                                                      },
                                                                    }),
                                                                  )
                                                                }
                                                              />
                                                              <span className="w-20 text-[--color-text-muted]">
                                                                Fraud Score
                                                              </span>
                                                              {ipqsConfig.phone
                                                                .criteria
                                                                .fraud_score
                                                                .enabled && (
                                                                <>
                                                                  <select
                                                                    className="rounded border border-[--color-border] bg-[--color-bg-muted] px-2 py-0.5 text-xs"
                                                                    value={
                                                                      ipqsConfig
                                                                        .phone
                                                                        .criteria
                                                                        .fraud_score
                                                                        .operator
                                                                    }
                                                                    onChange={(
                                                                      e,
                                                                    ) =>
                                                                      setIpqsConfig(
                                                                        (
                                                                          p,
                                                                        ) => ({
                                                                          ...p,
                                                                          phone:
                                                                            {
                                                                              ...p.phone,
                                                                              criteria:
                                                                                {
                                                                                  ...p
                                                                                    .phone
                                                                                    .criteria,
                                                                                  fraud_score:
                                                                                    {
                                                                                      ...p
                                                                                        .phone
                                                                                        .criteria
                                                                                        .fraud_score,
                                                                                      operator:
                                                                                        e
                                                                                          .target
                                                                                          .value as
                                                                                          | "lte"
                                                                                          | "gte"
                                                                                          | "eq",
                                                                                    },
                                                                                },
                                                                            },
                                                                        }),
                                                                      )
                                                                    }
                                                                  >
                                                                    <option value="lte">
                                                                      ≤ (lte)
                                                                    </option>
                                                                    <option value="gte">
                                                                      ≥ (gte)
                                                                    </option>
                                                                    <option value="eq">
                                                                      = (eq)
                                                                    </option>
                                                                  </select>
                                                                  <input
                                                                    type="number"
                                                                    min={0}
                                                                    max={100}
                                                                    className="w-16 rounded border border-[--color-border] bg-[--color-bg-muted] px-2 py-0.5 text-xs"
                                                                    value={
                                                                      ipqsConfig
                                                                        .phone
                                                                        .criteria
                                                                        .fraud_score
                                                                        .value
                                                                    }
                                                                    onChange={(
                                                                      e,
                                                                    ) =>
                                                                      setIpqsConfig(
                                                                        (
                                                                          p,
                                                                        ) => ({
                                                                          ...p,
                                                                          phone:
                                                                            {
                                                                              ...p.phone,
                                                                              criteria:
                                                                                {
                                                                                  ...p
                                                                                    .phone
                                                                                    .criteria,
                                                                                  fraud_score:
                                                                                    {
                                                                                      ...p
                                                                                        .phone
                                                                                        .criteria
                                                                                        .fraud_score,
                                                                                      value:
                                                                                        Number(
                                                                                          e
                                                                                            .target
                                                                                            .value,
                                                                                        ),
                                                                                    },
                                                                                },
                                                                            },
                                                                        }),
                                                                      )
                                                                    }
                                                                  />
                                                                </>
                                                              )}
                                                            </div>
                                                            {/* country */}
                                                            <div className="flex flex-wrap items-center gap-3 text-xs">
                                                              <input
                                                                type="checkbox"
                                                                className="h-3.5 w-3.5 accent-[--color-primary]"
                                                                checked={
                                                                  ipqsConfig
                                                                    .phone
                                                                    .criteria
                                                                    .country
                                                                    .enabled
                                                                }
                                                                onChange={(e) =>
                                                                  setIpqsConfig(
                                                                    (p) => ({
                                                                      ...p,
                                                                      phone: {
                                                                        ...p.phone,
                                                                        criteria:
                                                                          {
                                                                            ...p
                                                                              .phone
                                                                              .criteria,
                                                                            country:
                                                                              {
                                                                                ...p
                                                                                  .phone
                                                                                  .criteria
                                                                                  .country,
                                                                                enabled:
                                                                                  e
                                                                                    .target
                                                                                    .checked,
                                                                              },
                                                                          },
                                                                      },
                                                                    }),
                                                                  )
                                                                }
                                                              />
                                                              <span className="w-20 text-[--color-text-muted]">
                                                                Country
                                                              </span>
                                                              {ipqsConfig.phone
                                                                .criteria
                                                                .country
                                                                .enabled && (
                                                                <input
                                                                  type="text"
                                                                  placeholder="US, CA, GB…"
                                                                  className="flex-1 min-w-0 rounded border border-[--color-border] bg-[--color-bg-muted] px-2 py-0.5 text-xs"
                                                                  value={
                                                                    ipqsConfig
                                                                      .phone
                                                                      .criteria
                                                                      .country
                                                                      .allowed
                                                                  }
                                                                  onChange={(
                                                                    e,
                                                                  ) =>
                                                                    setIpqsConfig(
                                                                      (p) => ({
                                                                        ...p,
                                                                        phone: {
                                                                          ...p.phone,
                                                                          criteria:
                                                                            {
                                                                              ...p
                                                                                .phone
                                                                                .criteria,
                                                                              country:
                                                                                {
                                                                                  ...p
                                                                                    .phone
                                                                                    .criteria
                                                                                    .country,
                                                                                  allowed:
                                                                                    e
                                                                                      .target
                                                                                      .value,
                                                                                },
                                                                            },
                                                                        },
                                                                      }),
                                                                    )
                                                                  }
                                                                />
                                                              )}
                                                            </div>
                                                          </div>
                                                        </motion.div>
                                                      )}
                                                  </AnimatePresence>
                                                </div>

                                                {/* ── Email sub-check ── */}
                                                <div className="rounded-lg border border-[--color-border] bg-[--color-bg] overflow-hidden">
                                                  <div className="flex items-center justify-between px-3 py-2 gap-2">
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        setIpqsEmailOpen(
                                                          (v) => !v,
                                                        )
                                                      }
                                                      className="flex items-center gap-1.5 text-sm font-medium text-[--color-text] hover:text-[--color-primary] transition-colors"
                                                    >
                                                      <motion.span
                                                        animate={{
                                                          rotate: ipqsEmailOpen
                                                            ? 90
                                                            : 0,
                                                        }}
                                                        transition={{
                                                          duration: 0.15,
                                                        }}
                                                        className="text-[10px] text-[--color-text-muted]"
                                                      >
                                                        ▶
                                                      </motion.span>
                                                      Email
                                                    </button>
                                                    <button
                                                      type="button"
                                                      role="switch"
                                                      aria-checked={
                                                        ipqsConfig.email.enabled
                                                      }
                                                      onClick={() =>
                                                        setIpqsConfig((p) => ({
                                                          ...p,
                                                          email: {
                                                            ...p.email,
                                                            enabled:
                                                              !p.email.enabled,
                                                          },
                                                        }))
                                                      }
                                                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${ipqsConfig.email.enabled ? "bg-[--color-primary]" : "bg-[--color-border]"}`}
                                                    >
                                                      <span
                                                        className={`inline-block h-4 w-4 transform rounded-full bg-[--color-bg] transition ${ipqsConfig.email.enabled ? "translate-x-4" : "translate-x-0.5"}`}
                                                      />
                                                    </button>
                                                  </div>
                                                  <AnimatePresence
                                                    initial={false}
                                                  >
                                                    {ipqsEmailOpen &&
                                                      ipqsConfig.email
                                                        .enabled && (
                                                        <motion.div
                                                          key="email-criteria"
                                                          initial={{
                                                            height: 0,
                                                          }}
                                                          animate={{
                                                            height: "auto",
                                                          }}
                                                          exit={{ height: 0 }}
                                                          transition={{
                                                            duration: 0.18,
                                                          }}
                                                          style={{
                                                            overflow: "hidden",
                                                          }}
                                                        >
                                                          <div className="px-3 pb-3 space-y-2.5 border-t border-[--color-border] pt-2.5">
                                                            {/* valid */}
                                                            <div className="flex flex-wrap items-center gap-3 text-xs">
                                                              <input
                                                                type="checkbox"
                                                                className="h-3.5 w-3.5 accent-[--color-primary]"
                                                                checked={
                                                                  ipqsConfig
                                                                    .email
                                                                    .criteria
                                                                    .valid
                                                                    .enabled
                                                                }
                                                                onChange={(e) =>
                                                                  setIpqsConfig(
                                                                    (p) => ({
                                                                      ...p,
                                                                      email: {
                                                                        ...p.email,
                                                                        criteria:
                                                                          {
                                                                            ...p
                                                                              .email
                                                                              .criteria,
                                                                            valid:
                                                                              {
                                                                                ...p
                                                                                  .email
                                                                                  .criteria
                                                                                  .valid,
                                                                                enabled:
                                                                                  e
                                                                                    .target
                                                                                    .checked,
                                                                              },
                                                                          },
                                                                      },
                                                                    }),
                                                                  )
                                                                }
                                                              />
                                                              <span className="w-20 text-[--color-text-muted]">
                                                                Valid
                                                              </span>
                                                            </div>
                                                            {/* fraud_score */}
                                                            <div className="flex flex-wrap items-center gap-3 text-xs">
                                                              <input
                                                                type="checkbox"
                                                                className="h-3.5 w-3.5 accent-[--color-primary]"
                                                                checked={
                                                                  ipqsConfig
                                                                    .email
                                                                    .criteria
                                                                    .fraud_score
                                                                    .enabled
                                                                }
                                                                onChange={(e) =>
                                                                  setIpqsConfig(
                                                                    (p) => ({
                                                                      ...p,
                                                                      email: {
                                                                        ...p.email,
                                                                        criteria:
                                                                          {
                                                                            ...p
                                                                              .email
                                                                              .criteria,
                                                                            fraud_score:
                                                                              {
                                                                                ...p
                                                                                  .email
                                                                                  .criteria
                                                                                  .fraud_score,
                                                                                enabled:
                                                                                  e
                                                                                    .target
                                                                                    .checked,
                                                                              },
                                                                          },
                                                                      },
                                                                    }),
                                                                  )
                                                                }
                                                              />
                                                              <span className="w-20 text-[--color-text-muted]">
                                                                Fraud Score
                                                              </span>
                                                              {ipqsConfig.email
                                                                .criteria
                                                                .fraud_score
                                                                .enabled && (
                                                                <>
                                                                  <select
                                                                    className="rounded border border-[--color-border] bg-[--color-bg-muted] px-2 py-0.5 text-xs"
                                                                    value={
                                                                      ipqsConfig
                                                                        .email
                                                                        .criteria
                                                                        .fraud_score
                                                                        .operator
                                                                    }
                                                                    onChange={(
                                                                      e,
                                                                    ) =>
                                                                      setIpqsConfig(
                                                                        (
                                                                          p,
                                                                        ) => ({
                                                                          ...p,
                                                                          email:
                                                                            {
                                                                              ...p.email,
                                                                              criteria:
                                                                                {
                                                                                  ...p
                                                                                    .email
                                                                                    .criteria,
                                                                                  fraud_score:
                                                                                    {
                                                                                      ...p
                                                                                        .email
                                                                                        .criteria
                                                                                        .fraud_score,
                                                                                      operator:
                                                                                        e
                                                                                          .target
                                                                                          .value as
                                                                                          | "lte"
                                                                                          | "gte"
                                                                                          | "eq",
                                                                                    },
                                                                                },
                                                                            },
                                                                        }),
                                                                      )
                                                                    }
                                                                  >
                                                                    <option value="lte">
                                                                      ≤ (lte)
                                                                    </option>
                                                                    <option value="gte">
                                                                      ≥ (gte)
                                                                    </option>
                                                                    <option value="eq">
                                                                      = (eq)
                                                                    </option>
                                                                  </select>
                                                                  <input
                                                                    type="number"
                                                                    min={0}
                                                                    max={100}
                                                                    className="w-16 rounded border border-[--color-border] bg-[--color-bg-muted] px-2 py-0.5 text-xs"
                                                                    value={
                                                                      ipqsConfig
                                                                        .email
                                                                        .criteria
                                                                        .fraud_score
                                                                        .value
                                                                    }
                                                                    onChange={(
                                                                      e,
                                                                    ) =>
                                                                      setIpqsConfig(
                                                                        (
                                                                          p,
                                                                        ) => ({
                                                                          ...p,
                                                                          email:
                                                                            {
                                                                              ...p.email,
                                                                              criteria:
                                                                                {
                                                                                  ...p
                                                                                    .email
                                                                                    .criteria,
                                                                                  fraud_score:
                                                                                    {
                                                                                      ...p
                                                                                        .email
                                                                                        .criteria
                                                                                        .fraud_score,
                                                                                      value:
                                                                                        Number(
                                                                                          e
                                                                                            .target
                                                                                            .value,
                                                                                        ),
                                                                                    },
                                                                                },
                                                                            },
                                                                        }),
                                                                      )
                                                                    }
                                                                  />
                                                                </>
                                                              )}
                                                            </div>
                                                          </div>
                                                        </motion.div>
                                                      )}
                                                  </AnimatePresence>
                                                </div>

                                                {/* ── IP sub-check ── */}
                                                <div className="rounded-lg border border-[--color-border] bg-[--color-bg] overflow-hidden">
                                                  <div className="flex items-center justify-between px-3 py-2 gap-2">
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        setIpqsIpOpen((v) => !v)
                                                      }
                                                      className="flex items-center gap-1.5 text-sm font-medium text-[--color-text] hover:text-[--color-primary] transition-colors"
                                                    >
                                                      <motion.span
                                                        animate={{
                                                          rotate: ipqsIpOpen
                                                            ? 90
                                                            : 0,
                                                        }}
                                                        transition={{
                                                          duration: 0.15,
                                                        }}
                                                        className="text-[10px] text-[--color-text-muted]"
                                                      >
                                                        ▶
                                                      </motion.span>
                                                      IP Address
                                                    </button>
                                                    <button
                                                      type="button"
                                                      role="switch"
                                                      aria-checked={
                                                        ipqsConfig.ip.enabled
                                                      }
                                                      onClick={() =>
                                                        setIpqsConfig((p) => ({
                                                          ...p,
                                                          ip: {
                                                            ...p.ip,
                                                            enabled:
                                                              !p.ip.enabled,
                                                          },
                                                        }))
                                                      }
                                                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${ipqsConfig.ip.enabled ? "bg-[--color-primary]" : "bg-[--color-border]"}`}
                                                    >
                                                      <span
                                                        className={`inline-block h-4 w-4 transform rounded-full bg-[--color-bg] transition ${ipqsConfig.ip.enabled ? "translate-x-4" : "translate-x-0.5"}`}
                                                      />
                                                    </button>
                                                  </div>
                                                  <AnimatePresence
                                                    initial={false}
                                                  >
                                                    {ipqsIpOpen &&
                                                      ipqsConfig.ip.enabled && (
                                                        <motion.div
                                                          key="ip-criteria"
                                                          initial={{
                                                            height: 0,
                                                          }}
                                                          animate={{
                                                            height: "auto",
                                                          }}
                                                          exit={{ height: 0 }}
                                                          transition={{
                                                            duration: 0.18,
                                                          }}
                                                          style={{
                                                            overflow: "hidden",
                                                          }}
                                                        >
                                                          <div className="px-3 pb-3 space-y-2.5 border-t border-[--color-border] pt-2.5">
                                                            {/* fraud_score */}
                                                            <div className="flex flex-wrap items-center gap-3 text-xs">
                                                              <input
                                                                type="checkbox"
                                                                className="h-3.5 w-3.5 accent-[--color-primary]"
                                                                checked={
                                                                  ipqsConfig.ip
                                                                    .criteria
                                                                    .fraud_score
                                                                    .enabled
                                                                }
                                                                onChange={(e) =>
                                                                  setIpqsConfig(
                                                                    (p) => ({
                                                                      ...p,
                                                                      ip: {
                                                                        ...p.ip,
                                                                        criteria:
                                                                          {
                                                                            ...p
                                                                              .ip
                                                                              .criteria,
                                                                            fraud_score:
                                                                              {
                                                                                ...p
                                                                                  .ip
                                                                                  .criteria
                                                                                  .fraud_score,
                                                                                enabled:
                                                                                  e
                                                                                    .target
                                                                                    .checked,
                                                                              },
                                                                          },
                                                                      },
                                                                    }),
                                                                  )
                                                                }
                                                              />
                                                              <span className="w-20 text-[--color-text-muted]">
                                                                Fraud Score
                                                              </span>
                                                              {ipqsConfig.ip
                                                                .criteria
                                                                .fraud_score
                                                                .enabled && (
                                                                <>
                                                                  <select
                                                                    className="rounded border border-[--color-border] bg-[--color-bg-muted] px-2 py-0.5 text-xs"
                                                                    value={
                                                                      ipqsConfig
                                                                        .ip
                                                                        .criteria
                                                                        .fraud_score
                                                                        .operator
                                                                    }
                                                                    onChange={(
                                                                      e,
                                                                    ) =>
                                                                      setIpqsConfig(
                                                                        (
                                                                          p,
                                                                        ) => ({
                                                                          ...p,
                                                                          ip: {
                                                                            ...p.ip,
                                                                            criteria:
                                                                              {
                                                                                ...p
                                                                                  .ip
                                                                                  .criteria,
                                                                                fraud_score:
                                                                                  {
                                                                                    ...p
                                                                                      .ip
                                                                                      .criteria
                                                                                      .fraud_score,
                                                                                    operator:
                                                                                      e
                                                                                        .target
                                                                                        .value as
                                                                                        | "lte"
                                                                                        | "gte"
                                                                                        | "eq",
                                                                                  },
                                                                              },
                                                                          },
                                                                        }),
                                                                      )
                                                                    }
                                                                  >
                                                                    <option value="lte">
                                                                      ≤ (lte)
                                                                    </option>
                                                                    <option value="gte">
                                                                      ≥ (gte)
                                                                    </option>
                                                                    <option value="eq">
                                                                      = (eq)
                                                                    </option>
                                                                  </select>
                                                                  <input
                                                                    type="number"
                                                                    min={0}
                                                                    max={100}
                                                                    className="w-16 rounded border border-[--color-border] bg-[--color-bg-muted] px-2 py-0.5 text-xs"
                                                                    value={
                                                                      ipqsConfig
                                                                        .ip
                                                                        .criteria
                                                                        .fraud_score
                                                                        .value
                                                                    }
                                                                    onChange={(
                                                                      e,
                                                                    ) =>
                                                                      setIpqsConfig(
                                                                        (
                                                                          p,
                                                                        ) => ({
                                                                          ...p,
                                                                          ip: {
                                                                            ...p.ip,
                                                                            criteria:
                                                                              {
                                                                                ...p
                                                                                  .ip
                                                                                  .criteria,
                                                                                fraud_score:
                                                                                  {
                                                                                    ...p
                                                                                      .ip
                                                                                      .criteria
                                                                                      .fraud_score,
                                                                                    value:
                                                                                      Number(
                                                                                        e
                                                                                          .target
                                                                                          .value,
                                                                                      ),
                                                                                  },
                                                                              },
                                                                          },
                                                                        }),
                                                                      )
                                                                    }
                                                                  />
                                                                </>
                                                              )}
                                                            </div>
                                                            {/* country_code */}
                                                            <div className="flex flex-wrap items-center gap-3 text-xs">
                                                              <input
                                                                type="checkbox"
                                                                className="h-3.5 w-3.5 accent-[--color-primary]"
                                                                checked={
                                                                  ipqsConfig.ip
                                                                    .criteria
                                                                    .country_code
                                                                    .enabled
                                                                }
                                                                onChange={(e) =>
                                                                  setIpqsConfig(
                                                                    (p) => ({
                                                                      ...p,
                                                                      ip: {
                                                                        ...p.ip,
                                                                        criteria:
                                                                          {
                                                                            ...p
                                                                              .ip
                                                                              .criteria,
                                                                            country_code:
                                                                              {
                                                                                ...p
                                                                                  .ip
                                                                                  .criteria
                                                                                  .country_code,
                                                                                enabled:
                                                                                  e
                                                                                    .target
                                                                                    .checked,
                                                                              },
                                                                          },
                                                                      },
                                                                    }),
                                                                  )
                                                                }
                                                              />
                                                              <span className="w-20 text-[--color-text-muted]">
                                                                Country
                                                              </span>
                                                              {ipqsConfig.ip
                                                                .criteria
                                                                .country_code
                                                                .enabled && (
                                                                <input
                                                                  type="text"
                                                                  placeholder="US, CA, GB…"
                                                                  className="flex-1 min-w-0 rounded border border-[--color-border] bg-[--color-bg-muted] px-2 py-0.5 text-xs"
                                                                  value={
                                                                    ipqsConfig
                                                                      .ip
                                                                      .criteria
                                                                      .country_code
                                                                      .allowed
                                                                  }
                                                                  onChange={(
                                                                    e,
                                                                  ) =>
                                                                    setIpqsConfig(
                                                                      (p) => ({
                                                                        ...p,
                                                                        ip: {
                                                                          ...p.ip,
                                                                          criteria:
                                                                            {
                                                                              ...p
                                                                                .ip
                                                                                .criteria,
                                                                              country_code:
                                                                                {
                                                                                  ...p
                                                                                    .ip
                                                                                    .criteria
                                                                                    .country_code,
                                                                                  allowed:
                                                                                    e
                                                                                      .target
                                                                                      .value,
                                                                                },
                                                                            },
                                                                        },
                                                                      }),
                                                                    )
                                                                  }
                                                                />
                                                              )}
                                                            </div>
                                                            {/* proxy */}
                                                            <div className="flex flex-wrap items-center gap-3 text-xs">
                                                              <input
                                                                type="checkbox"
                                                                className="h-3.5 w-3.5 accent-[--color-primary]"
                                                                checked={
                                                                  ipqsConfig.ip
                                                                    .criteria
                                                                    .proxy
                                                                    .enabled
                                                                }
                                                                onChange={(e) =>
                                                                  setIpqsConfig(
                                                                    (p) => ({
                                                                      ...p,
                                                                      ip: {
                                                                        ...p.ip,
                                                                        criteria:
                                                                          {
                                                                            ...p
                                                                              .ip
                                                                              .criteria,
                                                                            proxy:
                                                                              {
                                                                                ...p
                                                                                  .ip
                                                                                  .criteria
                                                                                  .proxy,
                                                                                enabled:
                                                                                  e
                                                                                    .target
                                                                                    .checked,
                                                                              },
                                                                          },
                                                                      },
                                                                    }),
                                                                  )
                                                                }
                                                              />
                                                              <span className="w-20 text-[--color-text-muted]">
                                                                Proxy
                                                              </span>
                                                              {ipqsConfig.ip
                                                                .criteria.proxy
                                                                .enabled && (
                                                                <label className="flex items-center gap-1.5 text-[--color-text-muted]">
                                                                  <input
                                                                    type="checkbox"
                                                                    className="h-3.5 w-3.5 accent-[--color-primary]"
                                                                    checked={
                                                                      ipqsConfig
                                                                        .ip
                                                                        .criteria
                                                                        .proxy
                                                                        .allowed
                                                                    }
                                                                    onChange={(
                                                                      e,
                                                                    ) =>
                                                                      setIpqsConfig(
                                                                        (
                                                                          p,
                                                                        ) => ({
                                                                          ...p,
                                                                          ip: {
                                                                            ...p.ip,
                                                                            criteria:
                                                                              {
                                                                                ...p
                                                                                  .ip
                                                                                  .criteria,
                                                                                proxy:
                                                                                  {
                                                                                    ...p
                                                                                      .ip
                                                                                      .criteria
                                                                                      .proxy,
                                                                                    allowed:
                                                                                      e
                                                                                        .target
                                                                                        .checked,
                                                                                  },
                                                                              },
                                                                          },
                                                                        }),
                                                                      )
                                                                    }
                                                                  />
                                                                  Allow proxies
                                                                </label>
                                                              )}
                                                            </div>
                                                            {/* vpn */}
                                                            <div className="flex flex-wrap items-center gap-3 text-xs">
                                                              <input
                                                                type="checkbox"
                                                                className="h-3.5 w-3.5 accent-[--color-primary]"
                                                                checked={
                                                                  ipqsConfig.ip
                                                                    .criteria
                                                                    .vpn.enabled
                                                                }
                                                                onChange={(e) =>
                                                                  setIpqsConfig(
                                                                    (p) => ({
                                                                      ...p,
                                                                      ip: {
                                                                        ...p.ip,
                                                                        criteria:
                                                                          {
                                                                            ...p
                                                                              .ip
                                                                              .criteria,
                                                                            vpn: {
                                                                              ...p
                                                                                .ip
                                                                                .criteria
                                                                                .vpn,
                                                                              enabled:
                                                                                e
                                                                                  .target
                                                                                  .checked,
                                                                            },
                                                                          },
                                                                      },
                                                                    }),
                                                                  )
                                                                }
                                                              />
                                                              <span className="w-20 text-[--color-text-muted]">
                                                                VPN
                                                              </span>
                                                              {ipqsConfig.ip
                                                                .criteria.vpn
                                                                .enabled && (
                                                                <label className="flex items-center gap-1.5 text-[--color-text-muted]">
                                                                  <input
                                                                    type="checkbox"
                                                                    className="h-3.5 w-3.5 accent-[--color-primary]"
                                                                    checked={
                                                                      ipqsConfig
                                                                        .ip
                                                                        .criteria
                                                                        .vpn
                                                                        .allowed
                                                                    }
                                                                    onChange={(
                                                                      e,
                                                                    ) =>
                                                                      setIpqsConfig(
                                                                        (
                                                                          p,
                                                                        ) => ({
                                                                          ...p,
                                                                          ip: {
                                                                            ...p.ip,
                                                                            criteria:
                                                                              {
                                                                                ...p
                                                                                  .ip
                                                                                  .criteria,
                                                                                vpn: {
                                                                                  ...p
                                                                                    .ip
                                                                                    .criteria
                                                                                    .vpn,
                                                                                  allowed:
                                                                                    e
                                                                                      .target
                                                                                      .checked,
                                                                                },
                                                                              },
                                                                          },
                                                                        }),
                                                                      )
                                                                    }
                                                                  />
                                                                  Allow VPNs
                                                                </label>
                                                              )}
                                                            </div>
                                                          </div>
                                                        </motion.div>
                                                      )}
                                                  </AnimatePresence>
                                                </div>
                                              </div>
                                            </motion.div>
                                          )}
                                        </AnimatePresence>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                      {/* end sorted plugins container */}

                      {/* Save button — only when dirty */}
                      {integrationsDirty && (
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            onClick={async () => {
                              if (
                                !dupCheckGloballyDisabled &&
                                duplicateCheckEnabled &&
                                duplicateCheckCriteria.length === 0
                              ) {
                                toast.warning(
                                  "Select at least one criterion (phone or email) when duplicate check is enabled.",
                                );
                                return;
                              }
                              await onUpdatePlugins(campaign.id, {
                                duplicate_check: {
                                  enabled: dupCheckGloballyDisabled
                                    ? false
                                    : duplicateCheckEnabled,
                                  criteria: duplicateCheckCriteria,
                                },
                                trusted_form: {
                                  enabled: trustedFormGloballyDisabled
                                    ? false
                                    : trustedFormEnabled,
                                  stage: tfStep,
                                  gate: trustedFormGate,
                                },
                                ipqs: {
                                  enabled: ipqsGloballyDisabled
                                    ? false
                                    : ipqsConfig.enabled,
                                  stage: ipqsStep,
                                  gate: ipqsGate,
                                  phone: {
                                    enabled: ipqsConfig.phone.enabled,
                                    criteria: {
                                      valid: ipqsConfig.phone.criteria.valid,
                                      fraud_score:
                                        ipqsConfig.phone.criteria.fraud_score,
                                      country: {
                                        enabled:
                                          ipqsConfig.phone.criteria.country
                                            .enabled,
                                        allowed:
                                          ipqsConfig.phone.criteria.country.allowed
                                            .split(",")
                                            .map((s) => s.trim())
                                            .filter(Boolean),
                                      },
                                    },
                                  },
                                  email: {
                                    enabled: ipqsConfig.email.enabled,
                                    criteria: ipqsConfig.email.criteria,
                                  },
                                  ip: {
                                    enabled: ipqsConfig.ip.enabled,
                                    criteria: {
                                      fraud_score:
                                        ipqsConfig.ip.criteria.fraud_score,
                                      country_code: {
                                        enabled:
                                          ipqsConfig.ip.criteria.country_code
                                            .enabled,
                                        allowed:
                                          ipqsConfig.ip.criteria.country_code.allowed
                                            .split(",")
                                            .map((s) => s.trim())
                                            .filter(Boolean),
                                      },
                                      proxy: ipqsConfig.ip.criteria.proxy,
                                      vpn: ipqsConfig.ip.criteria.vpn,
                                    },
                                  },
                                },
                              });
                              setIntegrationsDirty(false);
                            }}
                          >
                            Save
                          </Button>
                        </div>
                      )}

                      {/* Plugin change history */}
                      {(() => {
                        const pluginHistory = (campaign.edit_history ?? [])
                          .filter((e) => e.field?.startsWith("plugins."))
                          .sort(
                            (a, b) =>
                              new Date(b.changed_at).getTime() -
                              new Date(a.changed_at).getTime(),
                          );
                        if (pluginHistory.length === 0) return null;
                        return (
                          <div>
                            <p className="mb-2 text-xs uppercase tracking-wide text-[--color-text-muted]">
                              Integration Change History
                            </p>
                            <div className="max-h-52 overflow-y-auto rounded-lg border border-[--color-border] divide-y divide-[--color-border]">
                              {pluginHistory.map((entry, i) => {
                                const by = entry.changed_by
                                  ? resolveChangedBy(
                                      entry.changed_by as {
                                        username?: string;
                                        email?: string;
                                      },
                                    )
                                  : null;
                                const prev =
                                  entry.previous_value != null
                                    ? String(entry.previous_value)
                                    : null;
                                const next =
                                  entry.new_value != null
                                    ? String(entry.new_value)
                                    : null;
                                return (
                                  <div
                                    key={i}
                                    className="p-3 text-xs bg-[--color-bg-muted]"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-mono font-medium text-[--color-primary]">
                                        {entry.field}
                                      </span>
                                      <span className="shrink-0 text-[--color-text-muted]">
                                        {formatDateTime(entry.changed_at)}
                                      </span>
                                    </div>
                                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                      <span className="rounded bg-[--color-bg] px-1.5 py-0.5 text-[--color-text-muted] line-through">
                                        {prev ?? "—"}
                                      </span>
                                      <span className="text-[--color-text-muted]">
                                        →
                                      </span>
                                      <span className="rounded bg-[--color-bg] px-1.5 py-0.5 font-medium text-[--color-text-strong]">
                                        {next ?? "—"}
                                      </span>
                                      {by && (
                                        <span className="ml-auto text-[--color-text-muted]">
                                          by {by}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {tab === "settings" && (
                    <div className="space-y-4">
                      {/* Settings sub-tabs */}
                      <div
                        role="tablist"
                        className="flex items-center gap-1 border-b border-[--color-border]"
                      >
                        {(["base-criteria", "logic", "routing"] as const).map(
                          (sub) => (
                            <button
                              key={sub}
                              type="button"
                              role="tab"
                              aria-selected={settingsSubTab === sub}
                              onClick={() => handleSubTabChange(sub)}
                              className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
                                settingsSubTab === sub
                                  ? "border-[--color-primary] text-[--color-text-strong]"
                                  : "border-transparent text-[--color-text-muted] hover:text-[--color-text]"
                              }`}
                            >
                              {sub === "base-criteria"
                                ? "Criteria"
                                : sub === "logic"
                                  ? "Logic"
                                  : "Distribution"}
                            </button>
                          ),
                        )}
                      </div>

                      <AnimatePresence mode="wait" initial={false}>
                        {settingsSubTab === "base-criteria" && (
                          <motion.div
                            key="criteria"
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 8 }}
                            transition={{ duration: 0.15, ease: "easeOut" }}
                            className="space-y-4"
                          >
                            {/* Header */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-h-[28px] flex items-center">
                                {localCriteriaSetId &&
                                localCriteriaSetVersion != null ? (
                                  <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-700">
                                    <Check
                                      size={12}
                                      className="shrink-0 text-emerald-600"
                                    />
                                    <span>
                                      Active catalog:{" "}
                                      <strong>
                                        {localCriteriaSetName ??
                                          catalogSets.find(
                                            (s) => s.id === localCriteriaSetId,
                                          )?.name ??
                                          localCriteriaSetId}
                                      </strong>{" "}
                                      v{localCriteriaSetVersion}
                                    </span>
                                  </div>
                                ) : (
                                  <p className="text-[11px] text-[--color-text-muted]">
                                    No active criteria catalog applied.
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {criteriaFields.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSaveCriteriaToSetMode(
                                        localCriteriaSetId
                                          ? "new_version"
                                          : "new_set",
                                      );
                                      setSaveCriteriaToSetDraft({
                                        name: localCriteriaSetName ?? "",
                                        description: "",
                                      });
                                      setSaveCriteriaToSetOpen(true);
                                    }}
                                    className="shrink-0 rounded-md border border-[--color-border] bg-[--color-bg-muted] px-3 py-1.5 text-[11px] font-medium text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-bg] transition-colors"
                                  >
                                    Save to Catalog
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={openCriteriaCatalogModal}
                                  className="shrink-0 rounded-md border border-[--color-border] bg-[--color-bg-muted] px-3 py-1.5 text-[11px] font-medium text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-bg] transition-colors"
                                >
                                  Criteria Catalog
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCampaignBulkImportOpen((v) => !v);
                                    setCampaignBulkImportText("");
                                  }}
                                  className="shrink-0 rounded-md border border-[--color-border] bg-[--color-bg-muted] px-3 py-1.5 text-[11px] font-medium text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-bg] transition-colors"
                                >
                                  Bulk import
                                </button>
                                <Button
                                  size="sm"
                                  iconLeft={<Plus size={14} />}
                                  onClick={() => {
                                    setFieldDraft(emptyFieldDraft);
                                    setEditFieldData(null);
                                    setAddFieldOpen(true);
                                  }}
                                >
                                  Add Field
                                </Button>
                              </div>
                            </div>

                            <AnimatePresence initial={false}>
                              {campaignBulkImportOpen && (
                                <motion.div
                                  key="campaign-bulk-import"
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{
                                    duration: 0.18,
                                    ease: "easeOut",
                                  }}
                                  className="overflow-hidden"
                                >
                                  <div className="rounded-xl border border-[--color-border] bg-[--color-bg-muted] p-4 space-y-3">
                                    <p className="text-[11px] font-medium text-[--color-text-muted] uppercase tracking-wide">
                                      Bulk import fields — paste a JSON array
                                    </p>
                                    <p className="text-[11px] text-[--color-text-muted]">
                                      Each object must have{" "}
                                      <code className="font-mono">
                                        field_label
                                      </code>{" "}
                                      and{" "}
                                      <code className="font-mono">
                                        field_name
                                      </code>
                                      . Optional:{" "}
                                      <code className="font-mono">
                                        data_type
                                      </code>
                                      ,{" "}
                                      <code className="font-mono">
                                        required
                                      </code>
                                      ,{" "}
                                      <code className="font-mono">
                                        description
                                      </code>
                                      .
                                    </p>
                                    <textarea
                                      rows={5}
                                      className="w-full rounded-lg border border-[--color-border] bg-[--color-bg] px-3 py-2 font-mono text-[11px] text-[--color-text] placeholder:text-[--color-text-muted] focus:outline-none focus:ring-1 focus:ring-[--color-primary] resize-y"
                                      placeholder={
                                        '[\n  { "field_label": "First Name", "field_name": "first_name", "data_type": "Text", "required": true }\n]'
                                      }
                                      value={campaignBulkImportText}
                                      onChange={(e) =>
                                        setCampaignBulkImportText(
                                          e.target.value,
                                        )
                                      }
                                    />
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setCampaignBulkImportOpen(false);
                                          setCampaignBulkImportText("");
                                        }}
                                        className="rounded-md border border-[--color-border] bg-[--color-bg] px-2.5 py-1 text-[11px] font-medium text-[--color-text-muted] hover:text-[--color-text] transition-colors"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        disabled={
                                          campaignBulkImporting ||
                                          !campaignBulkImportText.trim()
                                        }
                                        onClick={async () => {
                                          let parsed: any[];
                                          try {
                                            parsed = JSON.parse(
                                              campaignBulkImportText,
                                            );
                                            if (!Array.isArray(parsed))
                                              throw new Error(
                                                "Expected a JSON array",
                                              );
                                          } catch (err: any) {
                                            toast.error(
                                              `Invalid JSON: ${err.message ?? "parse error"}`,
                                            );
                                            return;
                                          }
                                          const validTypes = [
                                            "Text",
                                            "Number",
                                            "Boolean",
                                            "Date",
                                            "List",
                                            "US State",
                                          ];
                                          const toCreate: Array<{
                                            field_label: string;
                                            field_name: string;
                                            data_type: CriteriaFieldType;
                                            required: boolean;
                                            description?: string;
                                          }> = [];
                                          for (const item of parsed) {
                                            if (
                                              !item.field_label?.trim() ||
                                              !item.field_name?.trim()
                                            ) {
                                              toast.error(
                                                "Each field must have field_label and field_name",
                                              );
                                              return;
                                            }
                                            toCreate.push({
                                              field_label: String(
                                                item.field_label,
                                              ).trim(),
                                              field_name: String(
                                                item.field_name,
                                              )
                                                .trim()
                                                .toLowerCase()
                                                .replace(/\s+/g, "_")
                                                .replace(/[^a-z0-9_]/g, ""),
                                              data_type: (validTypes.includes(
                                                item.data_type,
                                              )
                                                ? item.data_type
                                                : "Text") as CriteriaFieldType,
                                              required: Boolean(item.required),
                                              ...(item.description
                                                ? {
                                                    description: String(
                                                      item.description,
                                                    ),
                                                  }
                                                : {}),
                                            });
                                          }
                                          setCampaignBulkImporting(true);
                                          try {
                                            for (const fieldPayload of toCreate) {
                                              await createCriteriaField(
                                                campaign.id,
                                                fieldPayload,
                                              );
                                            }
                                            await refreshCriteria();
                                            toast.success(
                                              `${toCreate.length} field${
                                                toCreate.length !== 1 ? "s" : ""
                                              } added to campaign.`,
                                            );
                                            setCampaignBulkImportOpen(false);
                                            setCampaignBulkImportText("");
                                          } catch {
                                            toast.error(
                                              "Failed to import some fields.",
                                            );
                                          } finally {
                                            setCampaignBulkImporting(false);
                                          }
                                        }}
                                        className="rounded-md bg-[--color-primary] text-white px-2.5 py-1 text-[11px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                                      >
                                        {campaignBulkImporting
                                          ? "Saving…"
                                          : "Add fields to campaign"}
                                      </button>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {criteriaLoading ? (
                              <p className="text-sm text-[--color-text-muted]">
                                Loading…
                              </p>
                            ) : (
                              <AnimatePresence mode="wait">
                                <motion.div
                                  initial={{ opacity: 0, y: 6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -6 }}
                                  transition={{
                                    duration: 0.15,
                                    ease: "easeOut",
                                  }}
                                >
                                  {criteriaFields.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-[--color-border] px-6 py-10 text-center">
                                      <p className="text-sm text-[--color-text-muted] mb-4">
                                        No criteria fields yet.
                                      </p>
                                      <div className="flex flex-col items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={openCriteriaCatalogModal}
                                          className="rounded-md bg-[--color-primary] px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 transition-opacity"
                                        >
                                          Apply from Criteria Catalog
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setFieldDraft(emptyFieldDraft);
                                            setEditFieldData(null);
                                            setAddFieldOpen(true);
                                          }}
                                          className="text-[12px] text-[--color-text-muted] hover:text-[--color-text] hover:underline transition-colors"
                                        >
                                          or add a custom field
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="overflow-hidden rounded-xl border border-[--color-border]">
                                      <table className="w-full text-sm">
                                        <thead>
                                          <tr className="border-b border-[--color-border] bg-[--color-bg-muted]">
                                            <th className="w-10 px-4 py-2.5 text-center text-[10px] font-medium uppercase tracking-wide text-[--color-text-muted]">
                                              #
                                            </th>
                                            <th className="px-4 py-2.5 text-left text-[10px] font-medium uppercase tracking-wide text-[--color-text-muted]">
                                              Field Label
                                            </th>
                                            <th className="px-4 py-2.5 text-left text-[10px] font-medium uppercase tracking-wide text-[--color-text-muted]">
                                              Field Name
                                            </th>
                                            <th className="w-28 px-4 py-2.5 text-left text-[10px] font-medium uppercase tracking-wide text-[--color-text-muted] whitespace-nowrap">
                                              Data Type
                                            </th>
                                            <th className="w-20 px-4 py-2.5 text-center text-[10px] font-medium uppercase tracking-wide text-[--color-text-muted]">
                                              Required
                                            </th>
                                            <th className="w-20 px-4 py-2.5 text-center text-[10px] font-medium uppercase tracking-wide text-[--color-text-muted]">
                                              Mappings
                                            </th>
                                            <th className="w-20 px-4 py-2.5 text-center text-[10px] font-medium uppercase tracking-wide text-[--color-text-muted]">
                                              Actions
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[--color-border]">
                                          {criteriaFields.map((field, idx) => (
                                            <tr
                                              key={field.id}
                                              className="bg-[--color-bg] transition-colors hover:bg-[--color-bg-muted]"
                                            >
                                              <td className="px-4 py-3 text-center text-xs text-[--color-text-muted]">
                                                {idx + 1}
                                              </td>
                                              <td className="px-4 py-3">
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setFieldDraft({
                                                      field_label:
                                                        field.field_label,
                                                      field_name:
                                                        field.field_name,
                                                      data_type:
                                                        field.data_type,
                                                      required: field.required,
                                                      description:
                                                        field.description ?? "",
                                                      state_mapping:
                                                        field.state_mapping ??
                                                        null,
                                                      options:
                                                        field.options ?? [],
                                                    });
                                                    setEditFieldData(field);
                                                    setAddFieldOpen(true);
                                                  }}
                                                  className="text-left font-medium text-[--color-primary] hover:underline"
                                                >
                                                  {field.field_label}
                                                </button>
                                              </td>
                                              <td className="px-4 py-3 font-mono text-xs text-[--color-text-muted]">
                                                {field.field_name}
                                              </td>
                                              <td className="px-4 py-3">
                                                {field.data_type === "List" ? (
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setFieldDraft({
                                                        field_label:
                                                          field.field_label,
                                                        field_name:
                                                          field.field_name,
                                                        data_type:
                                                          field.data_type,
                                                        required:
                                                          field.required,
                                                        description:
                                                          field.description ??
                                                          "",
                                                        state_mapping:
                                                          field.state_mapping ??
                                                          null,
                                                        options:
                                                          field.options ?? [],
                                                      });
                                                      setEditFieldData(field);
                                                      setAddFieldOpen(true);
                                                    }}
                                                    className="rounded-md border border-[--color-primary]/30 bg-[--color-primary]/10 px-2 py-0.5 text-xs font-medium text-[--color-primary] transition-colors hover:bg-[--color-primary]/20"
                                                  >
                                                    List
                                                  </button>
                                                ) : (
                                                  <span className="rounded-md border border-[--color-border] bg-[--color-bg-muted] px-2 py-0.5 text-xs text-[--color-text-muted] whitespace-nowrap">
                                                    {CRITERIA_TYPE_LABELS[
                                                      field.data_type
                                                    ] ?? field.data_type}
                                                  </span>
                                                )}
                                              </td>
                                              <td className="px-4 py-3 text-center">
                                                <span
                                                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                                                    field.required
                                                      ? "bg-green-500"
                                                      : "bg-[--color-border]"
                                                  }`}
                                                />
                                              </td>
                                              <td className="px-4 py-3 text-center">
                                                <button
                                                  type="button"
                                                  title="Edit value mappings"
                                                  onClick={() => {
                                                    setValueMappingsField(
                                                      field,
                                                    );
                                                    setValueMappingsStateDraft(
                                                      field.state_mapping ??
                                                        null,
                                                    );
                                                    setValueMappingsDraft(
                                                      (
                                                        field.value_mappings ??
                                                        []
                                                      ).map((m) => ({
                                                        fromText:
                                                          m.from.join(", "),
                                                        to: m.to,
                                                      })),
                                                    );
                                                  }}
                                                >
                                                  <span
                                                    className={`inline-block h-2.5 w-2.5 rounded-full transition-colors ${
                                                      (
                                                        field.value_mappings ??
                                                        []
                                                      ).length > 0 ||
                                                      field.state_mapping
                                                        ? "bg-green-500"
                                                        : "bg-[--color-border] hover:bg-[--color-text-muted]"
                                                    }`}
                                                  />
                                                </button>
                                              </td>
                                              <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-3">
                                                  <button
                                                    type="button"
                                                    title="Edit field"
                                                    onClick={() => {
                                                      setFieldDraft({
                                                        field_label:
                                                          field.field_label,
                                                        field_name:
                                                          field.field_name,
                                                        data_type:
                                                          field.data_type,
                                                        required:
                                                          field.required,
                                                        description:
                                                          field.description ??
                                                          "",
                                                        state_mapping:
                                                          field.state_mapping ??
                                                          null,
                                                        options:
                                                          field.options ?? [],
                                                      });
                                                      setEditFieldData(field);
                                                      setAddFieldOpen(true);
                                                    }}
                                                    className="text-[--color-text-muted] transition-colors hover:text-[--color-primary]"
                                                  >
                                                    <Pencil size={13} />
                                                  </button>
                                                  <button
                                                    type="button"
                                                    title="Delete field"
                                                    onClick={() =>
                                                      setDeleteFieldTarget(
                                                        field,
                                                      )
                                                    }
                                                    className="text-[--color-text-muted] transition-colors hover:text-red-500"
                                                  >
                                                    <Trash2 size={13} />
                                                  </button>
                                                </div>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </motion.div>
                              </AnimatePresence>
                            )}
                          </motion.div>
                        )}

                        {settingsSubTab === "routing" && (
                          <motion.div
                            key="routing"
                            initial={{ opacity: 0, x: 8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -8 }}
                            transition={{ duration: 0.15, ease: "easeOut" }}
                            className="space-y-4"
                          >
                            {(() => {
                              const liveClientRows = linkedClients
                                .map((client) => ({
                                  client,
                                  link: clientLinkMap.get(client.id),
                                }))
                                .filter((row) => row.link?.status === "LIVE");

                              const weightedTotal = liveClientRows.reduce(
                                (sum, row) =>
                                  sum +
                                  Math.max(
                                    0,
                                    routingWeights[row.client.id] ?? 0,
                                  ),
                                0,
                              );
                              const hasLiveClients = liveClientRows.length > 0;

                              const initialMode: DistributionMode =
                                campaign.distribution?.mode ?? "round_robin";
                              const initialEnabled =
                                campaign.distribution?.enabled ?? false;
                              const initialWeights: Record<string, number> =
                                (() => {
                                  if (!hasLiveClients) return {};
                                  const hasAnyWeight = liveClientRows.some(
                                    (row) =>
                                      typeof row.link?.weight === "number" &&
                                      row.link.weight > 0,
                                  );
                                  if (hasAnyWeight) {
                                    const seeded: Record<string, number> = {};
                                    liveClientRows.forEach((row) => {
                                      seeded[row.client.id] = Math.max(
                                        0,
                                        Math.round(row.link?.weight ?? 0),
                                      );
                                    });
                                    return seeded;
                                  }
                                  const n = liveClientRows.length;
                                  const base = Math.floor(100 / n);
                                  let remainder = 100 - base * n;
                                  const seeded: Record<string, number> = {};
                                  liveClientRows.forEach((row) => {
                                    const add = remainder > 0 ? 1 : 0;
                                    if (remainder > 0) remainder -= 1;
                                    seeded[row.client.id] = base + add;
                                  });
                                  return seeded;
                                })();
                              const weightDraftChanged =
                                routingMode === "weighted" &&
                                liveClientRows.some(
                                  (row) =>
                                    Math.max(
                                      0,
                                      routingWeights[row.client.id] ?? 0,
                                    ) !==
                                    Math.max(
                                      0,
                                      initialWeights[row.client.id] ?? 0,
                                    ),
                                );
                              const hasPendingRoutingChanges =
                                routingMode !== initialMode ||
                                routingEnabled !== initialEnabled ||
                                weightDraftChanged;

                              const rrCounts = liveClientRows.map((row) =>
                                getClientLeadCount(row.link),
                              );
                              const fairnessDelta =
                                rrCounts.length > 0
                                  ? Math.max(...rrCounts) -
                                    Math.min(...rrCounts)
                                  : 0;

                              return (
                                <>
                                  <div className="rounded-xl border border-[--color-border] bg-[--color-panel] p-4 space-y-4">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <p className="text-sm font-semibold text-[--color-text-strong]">
                                          Lead Routing
                                        </p>
                                        <p className="text-xs text-[--color-text-muted]">
                                          Configure how accepted leads are
                                          delivered to LIVE clients.
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        disabled={!hasLiveClients}
                                        onClick={() =>
                                          setRoutingEnabled((prev) => !prev)
                                        }
                                        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition ${
                                          !hasLiveClients
                                            ? "cursor-not-allowed border-red-500/30 bg-red-500/10 text-red-500 opacity-80"
                                            : routingEnabled
                                              ? "border-green-500/30 bg-green-500/10 text-green-600"
                                              : "border-red-500/30 bg-red-500/10 text-red-500"
                                        }`}
                                        title={
                                          hasLiveClients
                                            ? undefined
                                            : "Routing can be enabled after at least one client is LIVE."
                                        }
                                      >
                                        {routingEnabled
                                          ? "Enabled"
                                          : "Disabled"}
                                      </button>
                                    </div>
                                    {!hasLiveClients && (
                                      <p className="text-xs font-medium text-red-500">
                                        Routing is disabled because there are no
                                        LIVE clients in this campaign.
                                      </p>
                                    )}

                                    {routingEnabled && (
                                      <div className="space-y-2">
                                        {(
                                          [
                                            {
                                              key: "round_robin" as const,
                                              label: "Round Robin",
                                              description:
                                                "Cycles through LIVE clients in order.",
                                            },
                                            {
                                              key: "weighted" as const,
                                              label: "Weighted",
                                              description:
                                                "Routes to the client furthest below its target share.",
                                            },
                                          ] as const
                                        ).map((opt) => {
                                          const isSelected =
                                            routingMode === opt.key;
                                          const isSavedActive =
                                            campaign.distribution?.mode ===
                                              opt.key &&
                                            campaign.distribution?.enabled &&
                                            !hasPendingRoutingChanges;
                                          return (
                                            <div
                                              key={opt.key}
                                              role="button"
                                              tabIndex={0}
                                              onClick={() => {
                                                if (!isSelected) {
                                                  setConfirmModeChange(opt.key);
                                                }
                                              }}
                                              onKeyDown={(e) => {
                                                if (
                                                  e.key === "Enter" &&
                                                  !isSelected
                                                ) {
                                                  setConfirmModeChange(opt.key);
                                                }
                                              }}
                                              className={`rounded-lg border transition-all cursor-pointer select-none ${
                                                isSelected
                                                  ? "border-[--color-primary] bg-[--color-accent]"
                                                  : "border-[--color-border] opacity-60 hover:opacity-80"
                                              }`}
                                            >
                                              {/* Mode header row */}
                                              <div className="flex items-center gap-2.5 px-3 py-2.5">
                                                {/* Radio indicator */}
                                                <div
                                                  className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                                                    isSelected
                                                      ? "border-[--color-primary]"
                                                      : "border-[--color-border-alt]"
                                                  }`}
                                                >
                                                  {isSelected && (
                                                    <div className="h-2 w-2 rounded-full bg-[--color-primary]" />
                                                  )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                  <p
                                                    className={`text-xs font-semibold leading-none ${
                                                      isSelected
                                                        ? "text-[--color-text-strong]"
                                                        : "text-[--color-text-muted]"
                                                    }`}
                                                  >
                                                    {opt.label}
                                                  </p>
                                                  <p className="mt-0.5 text-[11px] text-[--color-text-muted]">
                                                    {opt.description}
                                                  </p>
                                                </div>
                                                {isSavedActive && (
                                                  <span className="ml-auto flex-shrink-0 rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[11px] font-semibold text-green-600">
                                                    Active
                                                  </span>
                                                )}
                                                {!isSelected &&
                                                  !isSavedActive && (
                                                    <span className="ml-auto flex-shrink-0 rounded-full border border-[--color-border-alt] bg-[--color-bg-muted] px-2 py-0.5 text-[11px] font-semibold text-[--color-text-muted]">
                                                      Inactive
                                                    </span>
                                                  )}
                                              </div>

                                              {/* Mode content — only for selected mode */}
                                              {isSelected && (
                                                <div className="border-t border-[--color-border] px-3 pb-3 pt-2">
                                                  {opt.key === "round_robin" ? (
                                                    <div className="space-y-1.5">
                                                      <div className="flex items-center justify-between">
                                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
                                                          Fairness
                                                        </p>
                                                        <span className="text-[11px] text-[--color-text-muted]">
                                                          Delta: {fairnessDelta}
                                                        </span>
                                                      </div>
                                                      {liveClientRows.length ===
                                                      0 ? (
                                                        <p className="text-xs text-[--color-text-muted]">
                                                          No LIVE clients
                                                          available.
                                                        </p>
                                                      ) : (
                                                        <div className="space-y-1">
                                                          {liveClientRows.map(
                                                            (row) => (
                                                              <div
                                                                key={`rr-${row.client.id}`}
                                                                className="flex items-center justify-between rounded bg-[--color-bg-muted] px-2.5 py-1.5 text-xs"
                                                              >
                                                                <span className="font-medium text-[--color-text]">
                                                                  {
                                                                    row.client
                                                                      .name
                                                                  }
                                                                </span>
                                                                <span className="text-[--color-text-muted]">
                                                                  Sold:{" "}
                                                                  {getClientLeadCount(
                                                                    row.link,
                                                                  )}
                                                                </span>
                                                              </div>
                                                            ),
                                                          )}
                                                        </div>
                                                      )}
                                                    </div>
                                                  ) : (
                                                    <div className="space-y-1.5">
                                                      <div className="flex items-center justify-between">
                                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
                                                          Client Shares
                                                        </p>
                                                        <span
                                                          className={`text-[11px] font-semibold ${
                                                            weightedTotal ===
                                                            100
                                                              ? "text-green-600"
                                                              : "text-[--color-danger]"
                                                          }`}
                                                        >
                                                          Total: {weightedTotal}
                                                          %
                                                        </span>
                                                      </div>
                                                      {liveClientRows.length ===
                                                      0 ? (
                                                        <p className="text-xs text-[--color-text-muted]">
                                                          No LIVE clients
                                                          available.
                                                        </p>
                                                      ) : (
                                                        <div className="space-y-1">
                                                          {liveClientRows.map(
                                                            (row) => (
                                                              <div
                                                                key={`w-${row.client.id}`}
                                                                className="grid grid-cols-[minmax(0,1fr)_82px] items-center gap-2 rounded bg-[--color-bg-muted] px-2.5 py-1.5 text-xs"
                                                              >
                                                                <span className="truncate font-medium text-[--color-text]">
                                                                  {
                                                                    row.client
                                                                      .name
                                                                  }
                                                                </span>
                                                                <div className="flex items-center gap-1">
                                                                  <input
                                                                    className="w-full rounded border border-[--color-border] bg-[--color-panel] px-2 py-1 text-right text-xs"
                                                                    type="number"
                                                                    min={0}
                                                                    max={100}
                                                                    value={
                                                                      routingWeights[
                                                                        row
                                                                          .client
                                                                          .id
                                                                      ] ?? 0
                                                                    }
                                                                    onChange={(
                                                                      e,
                                                                    ) => {
                                                                      const raw =
                                                                        Number(
                                                                          e
                                                                            .target
                                                                            .value,
                                                                        );
                                                                      const clamped =
                                                                        Number.isNaN(
                                                                          raw,
                                                                        )
                                                                          ? 0
                                                                          : Math.max(
                                                                              0,
                                                                              Math.min(
                                                                                100,
                                                                                Math.round(
                                                                                  raw,
                                                                                ),
                                                                              ),
                                                                            );
                                                                      const others =
                                                                        liveClientRows.filter(
                                                                          (r) =>
                                                                            r
                                                                              .client
                                                                              .id !==
                                                                            row
                                                                              .client
                                                                              .id,
                                                                        );
                                                                      const remainder =
                                                                        Math.max(
                                                                          0,
                                                                          100 -
                                                                            clamped,
                                                                        );
                                                                      setRoutingWeights(
                                                                        (
                                                                          prev,
                                                                        ) => {
                                                                          const next =
                                                                            {
                                                                              ...prev,
                                                                            };
                                                                          next[
                                                                            row.client.id
                                                                          ] =
                                                                            clamped;
                                                                          if (
                                                                            others.length >
                                                                            0
                                                                          ) {
                                                                            const base =
                                                                              Math.floor(
                                                                                remainder /
                                                                                  others.length,
                                                                              );
                                                                            let leftover =
                                                                              remainder -
                                                                              base *
                                                                                others.length;
                                                                            others.forEach(
                                                                              (
                                                                                other,
                                                                              ) => {
                                                                                const add =
                                                                                  leftover >
                                                                                  0
                                                                                    ? 1
                                                                                    : 0;
                                                                                if (
                                                                                  leftover >
                                                                                  0
                                                                                )
                                                                                  leftover--;
                                                                                next[
                                                                                  other.client.id
                                                                                ] =
                                                                                  base +
                                                                                  add;
                                                                              },
                                                                            );
                                                                          }
                                                                          return next;
                                                                        },
                                                                      );
                                                                    }}
                                                                  />
                                                                  <span className="text-[--color-text-muted]">
                                                                    %
                                                                  </span>
                                                                </div>
                                                              </div>
                                                            ),
                                                          )}
                                                        </div>
                                                      )}
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>

                                  {/* Confirm mode-switch dialog – rendered as popup in JSX root */}

                                  {hasPendingRoutingChanges && (
                                    <div className="flex justify-end">
                                      <Button
                                        size="sm"
                                        disabled={savingRouting}
                                        onClick={async () => {
                                          setSavingRouting(true);
                                          try {
                                            // When switching to weighted mode,
                                            // persist per-client shares first.
                                            if (
                                              routingMode === "weighted" &&
                                              liveClientRows.length > 0
                                            ) {
                                              try {
                                                await Promise.all(
                                                  liveClientRows
                                                    .filter(
                                                      (row) =>
                                                        row.link
                                                          ?.delivery_config,
                                                    )
                                                    .map((row) =>
                                                      onUpdateClientWeight(
                                                        campaign.id,
                                                        row.client.id,
                                                        row.link!
                                                          .delivery_config!,
                                                        routingWeights[
                                                          row.client.id
                                                        ] ?? 0,
                                                      ),
                                                    ),
                                                );
                                              } catch (err) {
                                                toast.error(
                                                  err instanceof Error
                                                    ? err.message
                                                    : "Failed to save client weights",
                                                );
                                                return;
                                              }
                                            }
                                            await onUpdateCampaignDistribution(
                                              campaign.id,
                                              {
                                                mode: routingMode,
                                                enabled: routingEnabled,
                                              },
                                            );
                                          } finally {
                                            setSavingRouting(false);
                                          }
                                        }}
                                      >
                                        Save Routing
                                      </Button>
                                    </div>
                                  )}
                                </>
                              );
                            })()}

                            {/* ── Cherry Pick Default ─────────────────────── */}
                            <div className="mt-6 space-y-3 border-t border-[--color-border] pt-4">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                                  Cherry Pick
                                </p>
                                <p className="text-[11px] text-[--color-text-muted] mt-1">
                                  When enabled, rejected (non-test) leads are
                                  automatically marked as cherry-pickable.
                                  Affiliates can override this per-participant.
                                </p>
                              </div>
                              <label className="flex items-center gap-2.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 accent-[--color-primary]"
                                  checked={
                                    campaign.default_cherry_pickable ?? false
                                  }
                                  onChange={async (e) => {
                                    const val = e.target.checked;
                                    try {
                                      const res = await updateCampaign(
                                        campaign.id,
                                        {
                                          name: campaign.name,
                                          default_cherry_pickable: val,
                                        },
                                      );
                                      if (res.success) {
                                        toast.success(
                                          val
                                            ? "Rejected leads will be auto-marked cherry-pickable."
                                            : "Auto cherry-pickable disabled.",
                                        );
                                        onCampaignUpdate?.({
                                          default_cherry_pickable: val,
                                        });
                                      } else {
                                        toast.error(
                                          (res as any).message ||
                                            "Failed to update cherry pick setting",
                                        );
                                      }
                                    } catch {
                                      toast.error(
                                        "Failed to update cherry pick setting.",
                                      );
                                    }
                                  }}
                                />
                                <span className="text-sm text-[--color-text]">
                                  Auto cherry-pickable on rejection
                                </span>
                              </label>
                            </div>
                          </motion.div>
                        )}

                        {settingsSubTab === "logic" && (
                          <motion.div
                            key="logic"
                            initial={{ opacity: 0, x: 8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -8 }}
                            transition={{ duration: 0.15, ease: "easeOut" }}
                            className="space-y-4"
                          >
                            {/* Header */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-h-[28px] flex items-center">
                                {localLogicSetId &&
                                localLogicSetVersion != null ? (
                                  <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-700">
                                    <Check
                                      size={12}
                                      className="shrink-0 text-emerald-600"
                                    />
                                    <span>
                                      Active catalog:{" "}
                                      <strong>
                                        {localLogicSetName ?? localLogicSetId}
                                      </strong>{" "}
                                      v{localLogicSetVersion}
                                    </span>
                                  </div>
                                ) : (
                                  <p className="text-[11px] text-[--color-text-muted]">
                                    No active logic catalog applied.
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {logicRules.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSaveLogicToSetMode(
                                        localLogicSetId
                                          ? "new_version"
                                          : "new_set",
                                      );
                                      setSaveLogicToSetDraft({
                                        name: localLogicSetName ?? "",
                                        description: "",
                                      });
                                      setSaveLogicToSetOpen(true);
                                    }}
                                    className="shrink-0 rounded-md border border-[--color-border] bg-[--color-bg-muted] px-3 py-1.5 text-[11px] font-medium text-[--color-text-muted] hover:bg-[--color-bg] hover:text-[--color-text] transition-colors"
                                  >
                                    Save to Catalog
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={openLogicCatalogModal}
                                  className="shrink-0 rounded-md border border-[--color-border] bg-[--color-bg-muted] px-3 py-1.5 text-[11px] font-medium text-[--color-text-muted] hover:bg-[--color-bg] hover:text-[--color-text] transition-colors"
                                >
                                  Logic Catalog
                                </button>
                                <Button
                                  size="sm"
                                  iconLeft={<Plus size={14} />}
                                  onClick={() => {
                                    setEditingRule(null);
                                    setLogicBuilderOpen(true);
                                  }}
                                >
                                  Create Rule
                                </Button>
                              </div>
                            </div>

                            {logicRulesLoading ? (
                              <p className="text-sm text-[--color-text-muted]">
                                Loading…
                              </p>
                            ) : logicRules.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-[--color-border] py-12 text-center text-sm text-[--color-text-muted]">
                                No logic rules yet.{" "}
                                <button
                                  type="button"
                                  className="text-[--color-primary] hover:underline"
                                  onClick={() => {
                                    setEditingRule(null);
                                    setLogicBuilderOpen(true);
                                  }}
                                >
                                  Create one
                                </button>
                                .
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {logicRules.map((rule) => (
                                  <div
                                    key={rule.id}
                                    className="flex items-center gap-3 rounded-xl border border-[--color-border] bg-[--color-bg] px-4 py-3"
                                  >
                                    {/* Enable toggle */}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleToggleLogicRule(rule)
                                      }
                                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${
                                        rule.enabled
                                          ? "bg-[--color-primary]"
                                          : "bg-[--color-border]"
                                      }`}
                                      aria-label={`${
                                        rule.enabled ? "Disable" : "Enable"
                                      } rule`}
                                    >
                                      <span
                                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform ${
                                          rule.enabled
                                            ? "translate-x-4"
                                            : "translate-x-0"
                                        }`}
                                      />
                                    </button>

                                    {/* Action badge */}
                                    <span
                                      className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-semibold ${
                                        rule.action === "pass"
                                          ? "bg-green-500/10 text-green-600"
                                          : "bg-red-500/10 text-red-500"
                                      }`}
                                    >
                                      {rule.action === "pass" ? "Pass" : "Fail"}
                                    </span>

                                    {/* Name */}
                                    <span
                                      className={`flex-1 text-sm truncate ${
                                        rule.enabled
                                          ? "text-[--color-text-strong]"
                                          : "text-[--color-text-muted] line-through"
                                      }`}
                                    >
                                      {rule.name}
                                    </span>

                                    {/* Group / condition count */}
                                    <span className="shrink-0 text-[11px] text-[--color-text-muted]">
                                      {rule.groups.length}{" "}
                                      {rule.groups.length === 1
                                        ? "group"
                                        : "groups"}
                                      {" · "}
                                      {rule.groups.reduce(
                                        (acc, g) => acc + g.conditions.length,
                                        0,
                                      )}{" "}
                                      cond.
                                    </span>

                                    {/* Edit */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingRule(rule);
                                        setLogicBuilderOpen(true);
                                      }}
                                      className="shrink-0 text-[--color-text-muted] hover:text-[--color-text] transition-colors"
                                    >
                                      <Pencil size={13} />
                                    </button>

                                    {/* Delete */}
                                    <button
                                      type="button"
                                      disabled={deletingRuleId === rule.id}
                                      onClick={() =>
                                        handleDeleteLogicRule(rule.id)
                                      }
                                      className="shrink-0 text-[--color-text-muted] hover:text-red-500 transition-colors disabled:opacity-40"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* ── History Tab ──────────────────────────────────── */}
                  {tab === "history" && (
                    <div className="divide-y divide-[--color-border]">
                      {!campaignAuditData ? (
                        <p className="py-10 text-center text-sm text-[--color-text-muted]">
                          Loading history…
                        </p>
                      ) : allCampaignAuditItems.length === 0 ? (
                        <div className="py-12 text-center">
                          <p className="text-sm text-[--color-text-muted]">
                            No history recorded for this campaign.
                          </p>
                        </div>
                      ) : (
                        allCampaignAuditItems.map((item) => (
                          <CampaignAuditRow
                            key={item.log_id}
                            item={item}
                            clientNameById={clientNameById}
                            affiliateNameById={affiliateNameById}
                          />
                        ))
                      )}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Confirm distribution mode change ──────────────────────────── */}
      <Modal
        title="Change distribution method?"
        isOpen={!!confirmModeChange}
        onClose={() => setConfirmModeChange(null)}
        width={380}
      >
        <div className="space-y-4">
          <p className="text-sm text-[--color-text-muted]">
            Switching from{" "}
            <span className="font-semibold text-[--color-text]">
              {routingMode === "round_robin" ? "Round Robin" : "Weighted"}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-[--color-text]">
              {confirmModeChange === "round_robin" ? "Round Robin" : "Weighted"}
            </span>
            . Save routing afterwards to apply the change.
          </p>
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmModeChange(null)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (confirmModeChange) {
                  setRoutingMode(confirmModeChange);
                  setConfirmModeChange(null);
                }
              }}
            >
              Confirm
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Logic Builder modal ────────────────────────────────────────── */}
      <LogicBuilderModal
        isOpen={logicBuilderOpen}
        onClose={() => {
          setLogicBuilderOpen(false);
          setEditingRule(null);
        }}
        onSave={handleSaveLogicRule}
        rule={editingRule}
        criteriaFields={criteriaFields}
        saving={savingRule}
      />

      {/* ── Logic Catalog modal ─────────────────────────────────────────── */}
      <Modal
        title="Campaign Logic Catalog"
        isOpen={logicCatalogOpen}
        onClose={() => setLogicCatalogOpen(false)}
        width={640}
        bodyClassName="px-5 py-4 overflow-y-auto h-[520px]"
      >
        <div className="space-y-4 text-sm">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs text-[--color-text-muted] leading-relaxed">
              Versioned logic sets. Applying a version replaces this campaign's
              current logic rules with that catalog version.
            </p>
            <Button size="sm" variant="outline" onClick={openLogicCatalogModal}>
              Refresh
            </Button>
          </div>

          {localLogicSetId && localLogicSetVersion != null && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
              Currently applied:{" "}
              <strong>
                {localLogicSetName ??
                  logicCatalogSets.find((s) => s.id === localLogicSetId)
                    ?.name ??
                  localLogicSetId}
              </strong>{" "}
              v{localLogicSetVersion}
            </div>
          )}

          {logicCatalogLoading ? (
            <p className="text-sm text-[--color-text-muted]">Loading…</p>
          ) : logicCatalogSets.length === 0 ? (
            <p className="text-sm text-[--color-text-muted]">
              No logic catalog sets yet. Save current rules as a catalog set to
              create one.
            </p>
          ) : (
            <div className="divide-y divide-[--color-border] rounded-xl border border-[--color-border] overflow-hidden">
              {logicCatalogSets.map((set) => (
                <div key={set.id}>
                  <div
                    className="flex items-center gap-3 px-4 py-3 bg-[--color-bg] hover:bg-[--color-bg-muted] transition-colors cursor-pointer"
                    onClick={async () => {
                      if (expandedLogicSetId === set.id) {
                        setExpandedLogicSetId(null);
                        return;
                      }
                      setExpandedLogicSetId(set.id);
                      if (logicSetVersionsMap[set.id]) return;
                      setLoadingLogicVersionsFor(set.id);
                      try {
                        const res = await getLogicCatalogSet(set.id);
                        if (res.success) {
                          setLogicSetVersionsMap((prev) => ({
                            ...prev,
                            [set.id]: res.data.versions,
                          }));
                        }
                      } catch {
                        toast.error("Failed to load logic catalog versions.");
                      } finally {
                        setLoadingLogicVersionsFor(null);
                      }
                    }}
                  >
                    <span className="text-[--color-text-muted]">
                      {expandedLogicSetId === set.id ? (
                        <ChevronDown size={14} />
                      ) : (
                        <ChevronRight size={14} />
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-[--color-text-strong] text-[13px]">
                          {set.name}
                        </span>
                        <span className="font-mono text-[10px] text-[--color-text-muted] bg-[--color-bg-muted] border border-[--color-border] rounded px-1.5 py-0.5">
                          v{set.latest_version}
                        </span>
                        {localLogicSetId === set.id && (
                          <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
                            Active
                          </span>
                        )}
                      </div>
                      {set.description && (
                        <p className="mt-0.5 text-[11px] text-[--color-text-muted]">
                          {set.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <AnimatePresence initial={false}>
                    {expandedLogicSetId === set.id && (
                      <motion.div
                        key={`logic-versions-${set.id}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        style={{ overflow: "hidden" }}
                        className="bg-[--color-bg-muted] border-t border-[--color-border]"
                      >
                        {loadingLogicVersionsFor === set.id ? (
                          <p className="px-6 py-3 text-xs text-[--color-text-muted]">
                            Loading versions…
                          </p>
                        ) : (logicSetVersionsMap[set.id] ?? []).length === 0 ? (
                          <p className="px-6 py-3 text-xs text-[--color-text-muted]">
                            No versions found.
                          </p>
                        ) : (
                          [...(logicSetVersionsMap[set.id] ?? [])]
                            .sort((a, b) => b.version - a.version)
                            .map((version) => {
                              const isApplied =
                                localLogicSetId === set.id &&
                                localLogicSetVersion === version.version;
                              const applyKey = `${set.id}#v${version.version}`;
                              return (
                                <div
                                  key={version.version}
                                  className="border-b last:border-0 border-[--color-border]"
                                >
                                  <div className="flex items-center gap-3 px-6 py-2.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setExpandedLogicVersionRules((prev) => {
                                          const next = new Set(prev);
                                          if (next.has(applyKey))
                                            next.delete(applyKey);
                                          else next.add(applyKey);
                                          return next;
                                        });
                                      }}
                                      className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                                    >
                                      <span className="text-[--color-text-muted]">
                                        {expandedLogicVersionRules.has(
                                          applyKey,
                                        ) ? (
                                          <ChevronDown size={11} />
                                        ) : (
                                          <ChevronRight size={11} />
                                        )}
                                      </span>
                                      <span className="font-mono text-[11px] font-semibold text-[--color-text-strong] w-6">
                                        v{version.version}
                                      </span>
                                      <span className="text-[11px] text-[--color-text-muted]">
                                        {version.rules.length} rule
                                        {version.rules.length !== 1 ? "s" : ""}
                                      </span>
                                    </button>
                                    {isApplied ? (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                                        <Check size={11} />
                                        Applied
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        disabled={applyingLogicCatalog !== null}
                                        onClick={() =>
                                          applyLogicCatalogVersion(
                                            set.id,
                                            set.name,
                                            version.version,
                                          )
                                        }
                                        className="inline-flex items-center gap-1 rounded-md border border-[--color-border] bg-[--color-surface] px-2.5 py-1 text-[11px] font-medium text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-bg] disabled:opacity-50 transition-colors"
                                      >
                                        {applyingLogicCatalog === applyKey
                                          ? "Applying…"
                                          : "Apply"}
                                      </button>
                                    )}
                                  </div>

                                  <AnimatePresence initial={false}>
                                    {expandedLogicVersionRules.has(
                                      applyKey,
                                    ) && (
                                      <motion.div
                                        key={`logic-rules-${applyKey}`}
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{
                                          duration: 0.18,
                                          ease: "easeOut",
                                        }}
                                        style={{ overflow: "hidden" }}
                                      >
                                        {version.rules.length === 0 ? (
                                          <p className="px-10 pb-3 text-[11px] text-[--color-text-muted]">
                                            No rules in this version.
                                          </p>
                                        ) : (
                                          <div className="space-y-1 border-t border-[--color-border] bg-[--color-bg] px-10 py-2.5">
                                            {version.rules.map((rule) => {
                                              const ruleDetailKey = `${applyKey}#rule:${rule.id}`;
                                              const condCount =
                                                rule.groups.reduce(
                                                  (acc, group) =>
                                                    acc +
                                                    group.conditions.length,
                                                  0,
                                                );
                                              return (
                                                <div
                                                  key={rule.id}
                                                  className="rounded-md border border-[--color-border] bg-[--color-bg-muted]"
                                                >
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setExpandedLogicRuleDetails(
                                                        (prev) => {
                                                          const next = new Set(
                                                            prev,
                                                          );
                                                          if (
                                                            next.has(
                                                              ruleDetailKey,
                                                            )
                                                          ) {
                                                            next.delete(
                                                              ruleDetailKey,
                                                            );
                                                          } else {
                                                            next.add(
                                                              ruleDetailKey,
                                                            );
                                                          }
                                                          return next;
                                                        },
                                                      );
                                                    }}
                                                    className="flex w-full items-center gap-2 px-2.5 py-2 text-[11px]"
                                                  >
                                                    <span className="text-[--color-text-muted]">
                                                      {expandedLogicRuleDetails.has(
                                                        ruleDetailKey,
                                                      ) ? (
                                                        <ChevronDown
                                                          size={11}
                                                        />
                                                      ) : (
                                                        <ChevronRight
                                                          size={11}
                                                        />
                                                      )}
                                                    </span>
                                                    <span
                                                      className={`rounded px-1.5 py-0.5 font-semibold ${
                                                        rule.action === "pass"
                                                          ? "bg-green-500/10 text-green-600"
                                                          : "bg-red-500/10 text-red-500"
                                                      }`}
                                                    >
                                                      {rule.action === "pass"
                                                        ? "Pass"
                                                        : "Fail"}
                                                    </span>
                                                    <span className="flex-1 truncate text-[--color-text] text-left">
                                                      {rule.name}
                                                    </span>
                                                    <span className="shrink-0 text-[10px] text-[--color-text-muted]">
                                                      {rule.groups.length} group
                                                      {rule.groups.length !== 1
                                                        ? "s"
                                                        : ""}{" "}
                                                      · {condCount} cond.
                                                    </span>
                                                  </button>
                                                  <AnimatePresence
                                                    initial={false}
                                                  >
                                                    {expandedLogicRuleDetails.has(
                                                      ruleDetailKey,
                                                    ) && (
                                                      <motion.div
                                                        key={`logic-rule-detail-${ruleDetailKey}`}
                                                        initial={{
                                                          height: 0,
                                                          opacity: 0,
                                                        }}
                                                        animate={{
                                                          height: "auto",
                                                          opacity: 1,
                                                        }}
                                                        exit={{
                                                          height: 0,
                                                          opacity: 0,
                                                        }}
                                                        transition={{
                                                          duration: 0.15,
                                                          ease: "easeOut",
                                                        }}
                                                        style={{
                                                          overflow: "hidden",
                                                        }}
                                                        className="border-t border-[--color-border] bg-[--color-bg] px-3 py-2"
                                                      >
                                                        <div className="space-y-2">
                                                          {rule.groups.map(
                                                            (
                                                              group,
                                                              groupIdx,
                                                            ) => (
                                                              <div
                                                                key={`${rule.id}-group-${groupIdx}`}
                                                                className="rounded-md border border-[--color-border] bg-[--color-bg-muted] p-2"
                                                              >
                                                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
                                                                  Group{" "}
                                                                  {groupIdx + 1}
                                                                </p>
                                                                <div className="space-y-1">
                                                                  {group.conditions.map(
                                                                    (
                                                                      condition,
                                                                      condIdx,
                                                                    ) => (
                                                                      <p
                                                                        key={`${rule.id}-group-${groupIdx}-cond-${condIdx}`}
                                                                        className="text-[11px] text-[--color-text]"
                                                                      >
                                                                        <span className="font-medium">
                                                                          {normalizeFieldLabel(
                                                                            condition.field_name,
                                                                          )}
                                                                        </span>{" "}
                                                                        <span className="text-[--color-text-muted]">
                                                                          {formatLogicOperatorLabel(
                                                                            condition.operator,
                                                                          )}
                                                                        </span>{" "}
                                                                        <span className="font-mono text-[10px] text-[--color-text-muted]">
                                                                          {formatLogicConditionValue(
                                                                            condition.value,
                                                                          )}
                                                                        </span>
                                                                      </p>
                                                                    ),
                                                                  )}
                                                                </div>
                                                              </div>
                                                            ),
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
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              );
                            })
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* ── Save campaign logic to catalog ──────────────────────────────── */}
      <Modal
        title="Save Logic Rules to Catalog"
        isOpen={saveLogicToSetOpen}
        onClose={() => setSaveLogicToSetOpen(false)}
        width={470}
      >
        <div className="space-y-4 text-sm">
          <p className="text-[13px] text-[--color-text-muted]">
            Save these campaign logic rules as either a new version of the
            active logic catalog entry or as a brand new logic catalog set.
          </p>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-[--color-text-muted]">
              Save Mode
            </label>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                disabled={!localLogicSetId}
                onClick={() => {
                  setSaveLogicToSetMode("new_version");
                  setSaveLogicToSetDraft((draft) => ({
                    ...draft,
                    name: localLogicSetName ?? localLogicSetId ?? draft.name,
                  }));
                }}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                  saveLogicToSetMode === "new_version"
                    ? "border-[--color-primary] bg-[--color-primary]/10"
                    : "border-[--color-border] bg-[--color-bg]"
                } ${!localLogicSetId ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <p className="text-xs font-medium text-[--color-text]">
                  Save as new version
                </p>
                <p className="text-[11px] text-[--color-text-muted]">
                  {localLogicSetId
                    ? `Adds a version to ${localLogicSetName ?? localLogicSetId}.`
                    : "No active catalog applied on this campaign yet."}
                </p>
              </button>
              <button
                type="button"
                onClick={() => setSaveLogicToSetMode("new_set")}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                  saveLogicToSetMode === "new_set"
                    ? "border-[--color-primary] bg-[--color-primary]/10"
                    : "border-[--color-border] bg-[--color-bg]"
                }`}
              >
                <p className="text-xs font-medium text-[--color-text]">
                  Save as new set
                </p>
                <p className="text-[11px] text-[--color-text-muted]">
                  Creates a brand new catalog entry with version 1.
                </p>
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wide text-[--color-text-muted]">
              Set Name{saveLogicToSetMode === "new_set" ? " *" : ""}
            </label>
            <input
              type="text"
              value={saveLogicToSetDraft.name}
              onChange={(e) =>
                setSaveLogicToSetDraft((draft) => ({
                  ...draft,
                  name: e.target.value,
                }))
              }
              disabled={saveLogicToSetMode === "new_version"}
              placeholder="e.g. Standard Campaign Logic"
              className={`w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] placeholder:text-[--color-text-muted] focus:outline-none focus:ring-1 focus:ring-[--color-primary] ${
                saveLogicToSetMode === "new_version"
                  ? "cursor-not-allowed opacity-60"
                  : ""
              }`}
            />
            {saveLogicToSetMode === "new_version" && (
              <p className="text-[11px] text-[--color-text-muted]">
                Set name is locked when saving a new version.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wide text-[--color-text-muted]">
              Description
            </label>
            <input
              type="text"
              value={saveLogicToSetDraft.description}
              onChange={(e) =>
                setSaveLogicToSetDraft((draft) => ({
                  ...draft,
                  description: e.target.value,
                }))
              }
              placeholder="Optional description"
              className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] placeholder:text-[--color-text-muted] focus:outline-none focus:ring-1 focus:ring-[--color-primary]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSaveLogicToSetOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={
                savingLogicToSet ||
                (saveLogicToSetMode === "new_set" &&
                  !saveLogicToSetDraft.name.trim())
              }
              onClick={saveCurrentLogicToCatalog}
            >
              {savingLogicToSet ? "Saving…" : "Save & Apply"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Campaign tags modal ─────────────────────────────────────────── */}
      <Modal
        title="Edit Campaign Tags"
        isOpen={editTagsOpen}
        onClose={() => setEditTagsOpen(false)}
        width={480}
      >
        <div className="space-y-4">
          {tagDefinitions.length === 0 ? (
            <p className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] px-3 py-2 text-sm text-[--color-text-muted]">
              No tag definitions are configured for this tenant.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tagDefinitions.map((def) => {
                const active = tagDraft.includes(def.label);
                return (
                  <button
                    key={def.id}
                    type="button"
                    onClick={() =>
                      setTagDraft((prev) =>
                        active
                          ? prev.filter((t) => t !== def.label)
                          : [...prev, def.label],
                      )
                    }
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
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
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditTagsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={savingTags}
              onClick={saveCampaignTagDraft}
            >
              {savingTags ? "Saving…" : "Save Tags"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Criteria Catalog modal ──────────────────────────────────────── */}
      <Modal
        title={
          catalogFormMode === "create"
            ? "New Catalog Set"
            : catalogFormMode === "edit"
              ? `Edit: ${editingCatalogSet?.name ?? ""}`
              : "Criteria Catalog"
        }
        isOpen={catalogOpen}
        onClose={() => {
          setCatalogOpen(false);
          setCatalogFormMode("browse");
        }}
        width={640}
        bodyClassName="px-5 py-4 overflow-y-auto h-[520px]"
      >
        <AnimatePresence mode="wait" initial={false}>
          {/* ── browse view ─────────────────────────────────────────────── */}
          {catalogFormMode === "browse" && (
            <motion.div
              key="catalog-browse"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="space-y-4 text-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs text-[--color-text-muted] leading-relaxed">
                  Versioned criteria sets. Apply a version to copy its fields
                  into this campaign's criteria.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCatalogFormMode("create");
                    setCatalogFormDraft({ name: "", description: "" });
                    setCatalogFieldDrafts([]);
                  }}
                  className="shrink-0 inline-flex items-center gap-1 rounded-md border border-[--color-border] bg-[--color-bg-muted] px-2.5 py-1.5 text-[11px] font-medium text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-bg] transition-colors"
                >
                  <Plus size={11} />
                  New Set
                </button>
              </div>

              {/* currently applied badge */}
              {localCriteriaSetId && (
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 flex items-center gap-2 text-[11px]">
                  <Check
                    size={12}
                    className="text-emerald-600 dark:text-emerald-400 shrink-0"
                  />
                  <span className="text-emerald-700 dark:text-emerald-400">
                    Currently applied:{" "}
                    <strong>
                      {localCriteriaSetName ??
                        catalogSets.find((s) => s.id === localCriteriaSetId)
                          ?.name ??
                        localCriteriaSetId}
                    </strong>{" "}
                    v{localCriteriaSetVersion}
                  </span>
                </div>
              )}

              {catalogLoading ? (
                <p className="text-sm text-[--color-text-muted]">Loading…</p>
              ) : catalogSets.length === 0 ? (
                <p className="text-sm text-[--color-text-muted]">
                  No catalog sets yet. Create one to get started.
                </p>
              ) : (
                <div className="divide-y divide-[--color-border] rounded-xl border border-[--color-border] overflow-hidden">
                  {catalogSets.map((set) => (
                    <div key={set.id}>
                      {/* set header row */}
                      <div
                        className="flex items-center gap-3 px-4 py-3 bg-[--color-bg] hover:bg-[--color-bg-muted] transition-colors cursor-pointer"
                        onClick={async () => {
                          if (expandedSetId === set.id) {
                            setExpandedSetId(null);
                            return;
                          }
                          setExpandedSetId(set.id);
                          if (setVersionsMap[set.id]) return;
                          setLoadingVersionsFor(set.id);
                          try {
                            const res = await getCriteriaCatalogSet(set.id);
                            if (res.success) {
                              setSetVersionsMap((prev) => ({
                                ...prev,
                                [set.id]: res.data.versions,
                              }));
                            }
                          } catch {
                            toast.error("Failed to load versions.");
                          } finally {
                            setLoadingVersionsFor(null);
                          }
                        }}
                      >
                        <span className="text-[--color-text-muted]">
                          {expandedSetId === set.id ? (
                            <ChevronDown size={14} />
                          ) : (
                            <ChevronRight size={14} />
                          )}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-[--color-text-strong] text-[13px]">
                              {set.name}
                            </span>
                            <span className="font-mono text-[10px] text-[--color-text-muted] bg-[--color-bg-muted] border border-[--color-border] rounded px-1.5 py-0.5">
                              {localCriteriaSetId === set.id &&
                              localCriteriaSetVersion != null
                                ? `v${localCriteriaSetVersion}`
                                : `v${set.latest_version}`}
                            </span>
                            {localCriteriaSetId === set.id && (
                              <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded px-1.5 py-0.5">
                                Active
                              </span>
                            )}
                          </div>
                          {set.description && (
                            <p className="mt-0.5 text-[11px] text-[--color-text-muted]">
                              {set.description}
                            </p>
                          )}
                        </div>
                        <div
                          className="flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={async () => {
                              setCatalogFormMode("edit");
                              setEditingCatalogSet(set);
                              setCatalogFormDraft({
                                name: set.name,
                                description: set.description ?? "",
                              });
                              // pre-populate field drafts from latest version
                              if (setVersionsMap[set.id]) {
                                const latest = setVersionsMap[set.id].find(
                                  (v) => v.version === set.latest_version,
                                );
                                setCatalogFieldDrafts(
                                  latest?.fields.map((f) => ({
                                    field_label: f.field_label,
                                    field_name: f.field_name,
                                    data_type: f.data_type,
                                    required: f.required,
                                    description: f.description ?? "",
                                    state_mapping: f.state_mapping ?? null,
                                  })) ?? [],
                                );
                              } else {
                                // fetch versions first
                                try {
                                  const res = await getCriteriaCatalogSet(
                                    set.id,
                                  );
                                  if (res.success) {
                                    setSetVersionsMap((prev) => ({
                                      ...prev,
                                      [set.id]: res.data.versions,
                                    }));
                                    const latest = res.data.versions.find(
                                      (v) => v.version === set.latest_version,
                                    );
                                    setCatalogFieldDrafts(
                                      latest?.fields.map((f) => ({
                                        field_label: f.field_label,
                                        field_name: f.field_name,
                                        data_type: f.data_type,
                                        required: f.required,
                                        description: f.description ?? "",
                                        state_mapping: f.state_mapping ?? null,
                                      })) ?? [],
                                    );
                                  }
                                } catch {
                                  toast.error("Failed to load set fields.");
                                }
                              }
                            }}
                            className="inline-flex items-center gap-1 rounded-md border border-[--color-border] bg-[--color-surface] px-2 py-1 text-[11px] font-medium text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-bg-muted] transition-colors"
                          >
                            <Pencil size={10} />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteSet(set)}
                            className="inline-flex items-center gap-1 rounded-md border border-rose-200 dark:border-rose-800 bg-[--color-surface] px-2 py-1 text-[11px] font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      {/* versions panel (expanded) */}
                      <AnimatePresence initial={false}>
                        {expandedSetId === set.id && (
                          <motion.div
                            key={`versions-${set.id}`}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            style={{ overflow: "hidden" }}
                            className="bg-[--color-bg-muted] border-t border-[--color-border]"
                          >
                            {loadingVersionsFor === set.id ? (
                              <p className="px-6 py-3 text-xs text-[--color-text-muted]">
                                Loading versions…
                              </p>
                            ) : (setVersionsMap[set.id] ?? []).length === 0 ? (
                              <p className="px-6 py-3 text-xs text-[--color-text-muted]">
                                No versions found.
                              </p>
                            ) : (
                              [...(setVersionsMap[set.id] ?? [])]
                                .sort((a, b) => b.version - a.version)
                                .map((v) => {
                                  const isApplied =
                                    localCriteriaSetId === set.id &&
                                    localCriteriaSetVersion === v.version;
                                  const applyKey = `${set.id}#v${v.version}`;
                                  return (
                                    <div
                                      key={v.version}
                                      className="border-b last:border-0 border-[--color-border]"
                                    >
                                      {/* version header row */}
                                      <div className="flex items-center gap-3 px-6 py-2.5">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const key = applyKey;
                                            setExpandedVersionFields((prev) => {
                                              const next = new Set(prev);
                                              if (next.has(key))
                                                next.delete(key);
                                              else next.add(key);
                                              return next;
                                            });
                                          }}
                                          className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                                        >
                                          <span className="text-[--color-text-muted]">
                                            {expandedVersionFields.has(
                                              applyKey,
                                            ) ? (
                                              <ChevronDown size={11} />
                                            ) : (
                                              <ChevronRight size={11} />
                                            )}
                                          </span>
                                          <span className="font-mono text-[11px] font-semibold text-[--color-text-strong] w-6">
                                            v{v.version}
                                          </span>
                                          <span className="text-[11px] text-[--color-text-muted]">
                                            {v.fields.length} field
                                            {v.fields.length !== 1 ? "s" : ""}
                                          </span>
                                          {v.campaigns_using.length > 0 && (
                                            <span className="text-[10px] text-[--color-text-muted]">
                                              · {v.campaigns_using.length}{" "}
                                              campaign
                                              {v.campaigns_using.length !== 1
                                                ? "s"
                                                : ""}
                                            </span>
                                          )}
                                        </button>
                                        <span className="text-[10px] text-[--color-text-muted]">
                                          {v.created_at
                                            ? new Date(
                                                v.created_at,
                                              ).toLocaleDateString()
                                            : ""}
                                        </span>
                                        <div className="shrink-0">
                                          {isApplied ? (
                                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                              <Check size={11} />
                                              Applied
                                            </span>
                                          ) : (
                                            <button
                                              type="button"
                                              disabled={
                                                applyingCatalog !== null
                                              }
                                              onClick={async () => {
                                                setApplyingCatalog(applyKey);
                                                try {
                                                  await applyCriteriaCatalog(
                                                    campaign.id,
                                                    set.id,
                                                    v.version,
                                                  );
                                                  toast.success(
                                                    `Applied "${set.name}" v${v.version}.`,
                                                  );
                                                  setLocalCriteriaSetId(set.id);
                                                  setLocalCriteriaSetName(
                                                    set.name,
                                                  );
                                                  setLocalCriteriaSetVersion(
                                                    v.version,
                                                  );
                                                  onCampaignUpdate?.({
                                                    criteria_set_id: set.id,
                                                    criteria_set_version:
                                                      v.version,
                                                  });
                                                  await refreshCriteria();
                                                } catch (err: any) {
                                                  toast.error(
                                                    err?.message ||
                                                      "Failed to apply catalog version.",
                                                  );
                                                } finally {
                                                  setApplyingCatalog(null);
                                                }
                                              }}
                                              className="inline-flex items-center gap-1 rounded-md border border-[--color-border] bg-[--color-surface] px-2.5 py-1 text-[11px] font-medium text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-bg] disabled:opacity-50 transition-colors"
                                            >
                                              {applyingCatalog === applyKey
                                                ? "Applying…"
                                                : "Apply"}
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                      {/* expandable fields table */}
                                      <AnimatePresence initial={false}>
                                        {expandedVersionFields.has(
                                          applyKey,
                                        ) && (
                                          <motion.div
                                            key={`vf-${applyKey}`}
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{
                                              height: "auto",
                                              opacity: 1,
                                            }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{
                                              duration: 0.18,
                                              ease: "easeOut",
                                            }}
                                            style={{ overflow: "hidden" }}
                                          >
                                            {v.fields.length === 0 ? (
                                              <p className="px-10 pb-3 text-[11px] text-[--color-text-muted]">
                                                No fields in this version.
                                              </p>
                                            ) : (
                                              <table className="w-full text-[11px] border-t border-[--color-border] bg-[--color-bg]">
                                                <thead>
                                                  <tr className="bg-[--color-bg-muted]">
                                                    <th className="pl-10 pr-3 py-1.5 text-left text-[10px] uppercase tracking-wide text-[--color-text-muted] font-medium">
                                                      Label
                                                    </th>
                                                    <th className="px-3 py-1.5 text-left text-[10px] uppercase tracking-wide text-[--color-text-muted] font-medium">
                                                      Name
                                                    </th>
                                                    <th className="px-3 py-1.5 text-left text-[10px] uppercase tracking-wide text-[--color-text-muted] font-medium">
                                                      Type
                                                    </th>
                                                    <th className="px-3 py-1.5 text-center text-[10px] uppercase tracking-wide text-[--color-text-muted] font-medium">
                                                      Req
                                                    </th>
                                                  </tr>
                                                </thead>
                                                <tbody className="divide-y divide-[--color-border]">
                                                  {v.fields.map((fld) => (
                                                    <tr key={fld.field_name}>
                                                      <td className="pl-10 pr-3 py-1.5 text-[--color-text]">
                                                        {fld.field_label}
                                                      </td>
                                                      <td className="px-3 py-1.5 font-mono text-[10px] text-[--color-text-muted]">
                                                        {fld.field_name}
                                                      </td>
                                                      <td className="px-3 py-1.5 text-[--color-text-muted]">
                                                        {fld.data_type}
                                                      </td>
                                                      <td className="px-3 py-1.5 text-center">
                                                        {fld.required ? (
                                                          <span className="text-[10px] font-medium text-rose-500">
                                                            Yes
                                                          </span>
                                                        ) : (
                                                          <span className="text-[10px] text-[--color-text-muted]">
                                                            —
                                                          </span>
                                                        )}
                                                      </td>
                                                    </tr>
                                                  ))}
                                                </tbody>
                                              </table>
                                            )}
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  );
                                })
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── create / edit form view ──────────────────────────────────── */}
          {(catalogFormMode === "create" || catalogFormMode === "edit") && (
            <motion.div
              key="catalog-form"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="space-y-4 text-sm"
            >
              {/* back link */}
              <button
                type="button"
                onClick={() => setCatalogFormMode("browse")}
                className="inline-flex items-center gap-1 text-[11px] text-[--color-text-muted] hover:text-[--color-text] transition-colors"
              >
                <ChevronRight size={11} className="rotate-180" />
                Back to catalog
              </button>

              {/* name */}
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                  Name
                </p>
                <input
                  className={inputClass}
                  placeholder="e.g. Standard residential criteria"
                  value={catalogFormDraft.name}
                  onChange={(e) =>
                    setCatalogFormDraft((p) => ({ ...p, name: e.target.value }))
                  }
                />
              </div>

              {/* description */}
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                  Description{" "}
                  <span className="normal-case font-normal">(optional)</span>
                </p>
                <textarea
                  className={inputClass}
                  rows={2}
                  placeholder="Optional notes about this criteria set"
                  value={catalogFormDraft.description}
                  onChange={(e) =>
                    setCatalogFormDraft((p) => ({
                      ...p,
                      description: e.target.value,
                    }))
                  }
                />
              </div>

              {/* fields list */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                    Fields{" "}
                    {catalogFormMode === "edit" && (
                      <span className="normal-case font-normal text-[--color-text-muted]">
                        — saving creates a new version
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCatalogBulkImportOpen((v) => !v)}
                      className="inline-flex items-center gap-1 text-[11px] text-[--color-text-muted] hover:text-[--color-text] hover:underline"
                    >
                      <Upload size={11} />
                      Bulk import
                    </button>
                  </div>
                </div>

                {/* bulk import panel */}
                <AnimatePresence initial={false}>
                  {catalogBulkImportOpen && (
                    <motion.div
                      key="catalog-bulk"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      style={{ overflow: "hidden" }}
                    >
                      <div className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-3 space-y-2 text-[11px]">
                        <p className="text-[--color-text-muted]">
                          Paste a JSON array of field objects. Each object must
                          have{" "}
                          <code className="font-mono text-[--color-text]">
                            field_label
                          </code>{" "}
                          and{" "}
                          <code className="font-mono text-[--color-text]">
                            field_name
                          </code>
                          . Optional:{" "}
                          <code className="font-mono text-[--color-text]">
                            data_type
                          </code>
                          ,{" "}
                          <code className="font-mono text-[--color-text]">
                            required
                          </code>
                          ,{" "}
                          <code className="font-mono text-[--color-text]">
                            description
                          </code>
                          .
                        </p>
                        <textarea
                          className={`${inputClass} min-h-[100px] resize-y font-mono text-[11px]`}
                          placeholder={`[
  {
    "field_label": "First Name",
    "field_name": "first_name",
    "data_type": "Text",
    "required": true,
    "description": "Applicant first name"
  }
]`}
                          value={catalogBulkImportText}
                          onChange={(e) =>
                            setCatalogBulkImportText(e.target.value)
                          }
                        />
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setCatalogBulkImportOpen(false);
                              setCatalogBulkImportText("");
                            }}
                            className="text-[11px] text-[--color-text-muted] hover:text-[--color-text] transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              let parsed: any[];
                              try {
                                parsed = JSON.parse(catalogBulkImportText);
                                if (!Array.isArray(parsed))
                                  throw new Error("Expected a JSON array");
                              } catch (err: any) {
                                toast.error(
                                  `Invalid JSON: ${err.message ?? "parse error"}`,
                                );
                                return;
                              }
                              const validTypes = [
                                "Text",
                                "Number",
                                "Boolean",
                                "Date",
                                "List",
                                "US State",
                              ];
                              const imported: CatalogFieldDraft[] = [];
                              for (const item of parsed) {
                                if (
                                  !item.field_label?.trim() ||
                                  !item.field_name?.trim()
                                ) {
                                  toast.error(
                                    "Each field must have field_label and field_name",
                                  );
                                  return;
                                }
                                const dt = validTypes.includes(item.data_type)
                                  ? item.data_type
                                  : "Text";
                                imported.push({
                                  field_label: String(item.field_label).trim(),
                                  field_name: String(item.field_name)
                                    .trim()
                                    .toLowerCase()
                                    .replace(/\s+/g, "_")
                                    .replace(/[^a-z0-9_]/g, ""),
                                  data_type: dt as CriteriaFieldType,
                                  required: Boolean(item.required),
                                  description: item.description
                                    ? String(item.description)
                                    : "",
                                  state_mapping: null,
                                });
                              }
                              setCatalogFieldDrafts((prev) => [
                                ...prev,
                                ...imported,
                              ]);
                              toast.success(
                                `${imported.length} field${imported.length !== 1 ? "s" : ""} imported.`,
                              );
                              setCatalogBulkImportOpen(false);
                              setCatalogBulkImportText("");
                            }}
                            className="rounded-md bg-[--color-primary] text-white px-2.5 py-1 text-[11px] font-medium hover:opacity-90 transition-opacity"
                          >
                            Import fields
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {catalogFieldDrafts.length === 0 ? (
                  <p className="text-[11px] text-[--color-text-muted]">
                    No fields yet. You can add them after saving too.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {catalogFieldDrafts.map((f, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-3 space-y-2"
                      >
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            className={inputClass}
                            placeholder="Label"
                            value={f.field_label}
                            onChange={(e) => {
                              const label = e.target.value;
                              setCatalogFieldDrafts((prev) =>
                                prev.map((item, idx) =>
                                  idx !== i
                                    ? item
                                    : {
                                        ...item,
                                        field_label: label,
                                        field_name:
                                          item.field_name ===
                                          item.field_label
                                            .toLowerCase()
                                            .replace(/\s+/g, "_")
                                            .replace(/[^a-z0-9_]/g, "")
                                            ? label
                                                .toLowerCase()
                                                .replace(/\s+/g, "_")
                                                .replace(/[^a-z0-9_]/g, "")
                                            : item.field_name,
                                      },
                                ),
                              );
                            }}
                          />
                          <input
                            className={`${inputClass} font-mono text-[11px]`}
                            placeholder="field_name"
                            value={f.field_name}
                            onChange={(e) =>
                              setCatalogFieldDrafts((prev) =>
                                prev.map((item, idx) =>
                                  idx === i
                                    ? { ...item, field_name: e.target.value }
                                    : item,
                                ),
                              )
                            }
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            className={inputClass}
                            value={f.data_type}
                            onChange={(e) =>
                              setCatalogFieldDrafts((prev) =>
                                prev.map((item, idx) =>
                                  idx === i
                                    ? {
                                        ...item,
                                        data_type: e.target
                                          .value as CriteriaFieldType,
                                      }
                                    : item,
                                ),
                              )
                            }
                          >
                            {(
                              [
                                "Text",
                                "Number",
                                "Boolean",
                                "Date",
                                "List",
                                "US State",
                              ] as CriteriaFieldType[]
                            ).map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                          <label className="flex items-center gap-2 text-[11px] text-[--color-text] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={f.required}
                              onChange={(e) =>
                                setCatalogFieldDrafts((prev) =>
                                  prev.map((item, idx) =>
                                    idx === i
                                      ? { ...item, required: e.target.checked }
                                      : item,
                                  ),
                                )
                              }
                            />
                            Required
                          </label>
                        </div>
                        <div className="flex items-start gap-2">
                          <input
                            className={`${inputClass} flex-1 text-[11px]`}
                            placeholder="Description (optional)"
                            value={f.description}
                            onChange={(e) =>
                              setCatalogFieldDrafts((prev) =>
                                prev.map((item, idx) =>
                                  idx === i
                                    ? { ...item, description: e.target.value }
                                    : item,
                                ),
                              )
                            }
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setCatalogFieldDrafts((prev) =>
                                prev.filter((_, idx) => idx !== i),
                              )
                            }
                            className="shrink-0 p-1.5 rounded text-[--color-text-muted] hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                            title="Delete field"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* add field button at bottom */}
              <button
                type="button"
                onClick={() =>
                  setCatalogFieldDrafts((prev) => [
                    ...prev,
                    {
                      field_label: "",
                      field_name: "",
                      data_type: "Text",
                      required: false,
                      description: "",
                      state_mapping: null,
                    },
                  ])
                }
                className="w-full rounded-lg border border-dashed border-[--color-border] py-2 text-xs text-[--color-text-muted] hover:border-[--color-primary] hover:text-[--color-primary] transition-colors inline-flex items-center justify-center gap-1"
              >
                <Plus size={12} />
                Add field
              </button>

              {/* submit row */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[--color-border]">
                <button
                  type="button"
                  onClick={() => setCatalogFormMode("browse")}
                  className="rounded-md border border-[--color-border] bg-[--color-bg-muted] px-3 py-1.5 text-[11px] font-medium text-[--color-text-muted] hover:text-[--color-text] disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingCatalog || !catalogFormDraft.name.trim()}
                  onClick={async () => {
                    setSavingCatalog(true);
                    const fields = catalogFieldDrafts
                      .filter(
                        (f) => f.field_label.trim() && f.field_name.trim(),
                      )
                      .map((f) => ({
                        field_label: f.field_label.trim(),
                        field_name: f.field_name.trim(),
                        data_type: f.data_type,
                        required: f.required,
                        ...(f.description
                          ? { description: f.description }
                          : {}),
                        ...(f.state_mapping
                          ? { state_mapping: f.state_mapping }
                          : {}),
                      }));
                    try {
                      if (catalogFormMode === "create") {
                        await createCriteriaCatalogSet({
                          name: catalogFormDraft.name.trim(),
                          ...(catalogFormDraft.description
                            ? { description: catalogFormDraft.description }
                            : {}),
                          ...(fields.length > 0 ? { fields } : {}),
                        });
                        toast.success("Catalog set created.");
                      } else {
                        await updateCriteriaCatalogSet(editingCatalogSet!.id, {
                          name: catalogFormDraft.name.trim(),
                          ...(catalogFormDraft.description !== undefined
                            ? { description: catalogFormDraft.description }
                            : {}),
                          fields,
                        });
                        // clear cached versions so they reload on next expand
                        setSetVersionsMap((prev) => {
                          const next = { ...prev };
                          delete next[editingCatalogSet!.id];
                          return next;
                        });
                        toast.success(
                          "Catalog set updated — new version saved.",
                        );
                      }
                      // refresh catalog list
                      const res = await listCriteriaCatalog();
                      if (res.success) {
                        setCatalogSets(res.data.items);
                        if (localCriteriaSetId && !localCriteriaSetName) {
                          const current = res.data.items.find(
                            (item) => item.id === localCriteriaSetId,
                          );
                          if (current) setLocalCriteriaSetName(current.name);
                        }
                      }
                      setCatalogFormMode("browse");
                    } catch (err: any) {
                      toast.error(
                        err?.message || "Failed to save catalog set.",
                      );
                    } finally {
                      setSavingCatalog(false);
                    }
                  }}
                  className="rounded-md bg-[--color-primary] text-white px-3 py-1.5 text-[11px] font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {savingCatalog
                    ? "Saving…"
                    : catalogFormMode === "create"
                      ? "Create Set"
                      : "Save Changes"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Modal>

      {/* ── Add / Edit Criteria Field modal ────────────────────────────── */}
      <Modal
        title={editFieldData ? "Edit Field" : "Add Field"}
        isOpen={addFieldOpen}
        onClose={() => {
          setAddFieldOpen(false);
          setEditFieldData(null);
        }}
        width={440}
      >
        {addFieldOpen && (
          <div className="space-y-4 text-sm">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                Field Label
              </p>
              <input
                className={inputClass}
                placeholder="e.g. Rideshare Abuse"
                value={fieldDraft.field_label}
                onChange={(e) => {
                  const label = e.target.value;
                  setFieldDraft((p) => ({
                    ...p,
                    field_label: label,
                    // Auto-fill field_name only when the user hasn't manually edited it
                    // (i.e. it still matches the auto-generated slug of the previous label)
                    field_name:
                      p.field_name ===
                      p.field_label
                        .toLowerCase()
                        .replace(/\s+/g, "_")
                        .replace(/[^a-z0-9_]/g, "")
                        ? label
                            .toLowerCase()
                            .replace(/\s+/g, "_")
                            .replace(/[^a-z0-9_]/g, "")
                        : p.field_name,
                  }));
                }}
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                Field Name (internal key)
              </p>
              <input
                className={inputClass}
                placeholder="e.g. rideshare_abuse"
                value={fieldDraft.field_name}
                onChange={(e) =>
                  setFieldDraft((p) => ({
                    ...p,
                    field_name: e.target.value
                      .toLowerCase()
                      .replace(/\s+/g, "_")
                      .replace(/[^a-z0-9_]/g, ""),
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                Data Type
              </p>
              <select
                className={inputClass}
                value={fieldDraft.data_type}
                onChange={(e) =>
                  setFieldDraft((p) => ({
                    ...p,
                    data_type: e.target.value as CriteriaFieldType,
                  }))
                }
              >
                {(
                  [
                    "Text",
                    "Number",
                    "Date",
                    "List",
                    "US State",
                    "Boolean",
                  ] as CriteriaFieldType[]
                ).map((t) => (
                  <option key={t} value={t}>
                    {CRITERIA_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[--color-primary]"
                checked={fieldDraft.required}
                onChange={(e) =>
                  setFieldDraft((p) => ({ ...p, required: e.target.checked }))
                }
              />
              Required field
            </label>
            {/* ── Description ───────────────────────────────────────── */}
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                Description{" "}
                <span className="normal-case text-[10px]">(optional)</span>
              </p>
              <input
                className={inputClass}
                placeholder="Short description of this field"
                value={fieldDraft.description}
                onChange={(e) =>
                  setFieldDraft((p) => ({
                    ...p,
                    description: e.target.value,
                  }))
                }
              />
            </div>
            {/* ── State Mapping preset (US State only) ──────────────── */}
            {fieldDraft.data_type === "US State" && (
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                  State Mapping Preset
                </p>
                <select
                  className={inputClass}
                  value={fieldDraft.state_mapping ?? ""}
                  onChange={(e) =>
                    setFieldDraft((p) => ({
                      ...p,
                      state_mapping: (e.target.value || null) as
                        | "abbr_to_name"
                        | "name_to_abbr"
                        | null,
                    }))
                  }
                >
                  <option value="">None</option>
                  <option value="abbr_to_name">
                    Abbreviation → Full name (CA → California)
                  </option>
                  <option value="name_to_abbr">
                    Full name → Abbreviation (California → CA)
                  </option>
                </select>
                <p className="text-[11px] text-[--color-text-muted]">
                  Covers all 50 US states automatically.
                </p>
              </div>
            )}
            {/* ── List Options (List only) ───────────────────────────── */}
            {fieldDraft.data_type === "List" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                    Options
                  </p>
                  {/* tab switcher */}
                  <div className="flex rounded-lg border border-[--color-border] text-xs">
                    <button
                      type="button"
                      onClick={() => setOptionsTab("manual")}
                      className={`px-2.5 py-1 rounded-l-md transition-colors ${
                        optionsTab === "manual"
                          ? "bg-[--color-primary] text-white"
                          : "text-[--color-text-muted] hover:text-[--color-text]"
                      }`}
                    >
                      Manual
                    </button>
                    <button
                      type="button"
                      onClick={() => setOptionsTab("bulk")}
                      className={`px-2.5 py-1 rounded-r-md transition-colors ${
                        optionsTab === "bulk"
                          ? "bg-[--color-primary] text-white"
                          : "text-[--color-text-muted] hover:text-[--color-text]"
                      }`}
                    >
                      Bulk
                    </button>
                  </div>
                </div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={optionsTab}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.13, ease: "easeOut" }}
                  >
                    {optionsTab === "manual" ? (
                      <>
                        {/* column headers */}
                        {fieldDraft.options.length > 0 && (
                          <div className="grid grid-cols-[1fr_1fr_auto] gap-x-2 px-0.5">
                            <p className="text-[10px] uppercase tracking-wide text-[--color-text-muted]">
                              Value (internal)
                            </p>
                            <p className="text-[10px] uppercase tracking-wide text-[--color-text-muted]">
                              Label (display)
                            </p>
                            <span />
                          </div>
                        )}
                        {fieldDraft.options.map((opt, i) => (
                          <div
                            key={i}
                            className="grid grid-cols-[1fr_1fr_auto] items-center gap-2"
                          >
                            {/* value — left */}
                            <input
                              className={inputClass}
                              placeholder="uber"
                              value={opt.value}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFieldDraft((p) => ({
                                  ...p,
                                  options: p.options.map((o, oi) =>
                                    oi === i
                                      ? {
                                          value: val,
                                          // autofill label only when it was empty or matched old value
                                          label:
                                            o.label === "" ||
                                            o.label === o.value
                                              ? val
                                              : o.label,
                                        }
                                      : o,
                                  ),
                                }));
                              }}
                            />
                            {/* label — right */}
                            <input
                              className={inputClass}
                              placeholder="Uber"
                              value={opt.label}
                              onChange={(e) =>
                                setFieldDraft((p) => ({
                                  ...p,
                                  options: p.options.map((o, oi) =>
                                    oi === i
                                      ? { ...o, label: e.target.value }
                                      : o,
                                  ),
                                }))
                              }
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setFieldDraft((p) => ({
                                  ...p,
                                  options: p.options.filter(
                                    (_, oi) => oi !== i,
                                  ),
                                }))
                              }
                              className="shrink-0 text-[--color-text-muted] hover:text-red-500 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            setFieldDraft((p) => ({
                              ...p,
                              options: [...p.options, { value: "", label: "" }],
                            }))
                          }
                          className="w-full rounded-lg border border-dashed border-[--color-border] py-2 text-xs text-[--color-text-muted] hover:border-[--color-primary] hover:text-[--color-primary] transition-colors"
                        >
                          + Add Option
                        </button>
                      </>
                    ) : (
                      /* ── Bulk import tab ── */
                      <div className="space-y-2">
                        <p className="text-[11px] text-[--color-text-muted]">
                          Enter values separated by commas. Labels will be
                          title-cased automatically.
                        </p>
                        <textarea
                          className={`${inputClass} min-h-[80px] resize-y font-mono`}
                          placeholder="uber,lyft,doordash,instacart"
                          value={optionsBulkText}
                          onChange={(e) => setOptionsBulkText(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newOpts = optionsBulkText
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean)
                              .map((v) => ({
                                value: v,
                                label: v
                                  .replace(/_/g, " ")
                                  .replace(/\b\w/g, (c) => c.toUpperCase()),
                              }));
                            setFieldDraft((p) => ({
                              ...p,
                              options: [
                                ...p.options.filter(
                                  (o) =>
                                    !newOpts.some((n) => n.value === o.value),
                                ),
                                ...newOpts,
                              ],
                            }));
                            setOptionsBulkText("");
                            setOptionsTab("manual");
                          }}
                          className="w-full rounded-lg bg-[--color-primary] py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
                        >
                          Add to list
                        </button>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAddFieldOpen(false);
                  setEditFieldData(null);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={
                  fieldSaving ||
                  !fieldDraft.field_label ||
                  !fieldDraft.field_name
                }
                onClick={async () => {
                  setFieldSaving(true);
                  try {
                    if (editFieldData) {
                      await updateCriteriaField(campaign.id, editFieldData.id, {
                        field_label: fieldDraft.field_label,
                        field_name: fieldDraft.field_name,
                        data_type: fieldDraft.data_type,
                        required: fieldDraft.required,
                        description: fieldDraft.description || undefined,
                        state_mapping: fieldDraft.state_mapping ?? null,
                        ...(fieldDraft.data_type === "List"
                          ? { options: fieldDraft.options }
                          : {}),
                      });
                      toast.success("Field updated");
                    } else {
                      await createCriteriaField(campaign.id, {
                        field_label: fieldDraft.field_label,
                        field_name: fieldDraft.field_name,
                        data_type: fieldDraft.data_type,
                        required: fieldDraft.required,
                        ...(fieldDraft.description
                          ? { description: fieldDraft.description }
                          : {}),
                        ...(fieldDraft.state_mapping
                          ? { state_mapping: fieldDraft.state_mapping }
                          : {}),
                        ...(fieldDraft.data_type === "List"
                          ? { options: fieldDraft.options }
                          : {}),
                      });
                      toast.success("Field added");
                      // Adding a custom field de-syncs the campaign from the
                      // applied catalog version.
                      setLocalCriteriaSetId(null);
                      setLocalCriteriaSetVersion(null);
                      setLocalCriteriaSetName(null);
                      onCampaignUpdate?.({
                        criteria_set_id: null,
                        criteria_set_version: null,
                      });
                    }
                    await refreshCriteria();
                    setAddFieldOpen(false);
                    setEditFieldData(null);
                  } catch (err: any) {
                    toast.error(err?.message || "Unable to save field");
                  } finally {
                    setFieldSaving(false);
                  }
                }}
              >
                {fieldSaving
                  ? "Saving…"
                  : editFieldData
                    ? "Save Changes"
                    : "Add Field"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Value Mappings modal ────────────────────────────────────────── */}
      <Modal
        title={
          valueMappingsField
            ? `Value Mappings: ${valueMappingsField.field_label}`
            : "Value Mappings"
        }
        isOpen={!!valueMappingsField}
        onClose={() => setValueMappingsField(null)}
        width={560}
      >
        {valueMappingsField && (
          <div className="space-y-4 text-sm">
            {/* State mapping preset — only for US State fields */}
            {valueMappingsField.data_type === "US State" && (
              <div className="space-y-2 rounded-xl border border-[--color-border] p-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-[--color-text-muted]">
                  State Mapping Preset
                </p>
                <p className="text-[11px] text-[--color-text-muted]">
                  Enable a built-in backend lookup for all 50 US states. Custom
                  mappings below always run first.
                </p>
                <div className="flex flex-col gap-1.5">
                  {(
                    [
                      ["", "None"],
                      [
                        "abbr_to_name",
                        "Abbreviation → Full name  (CA → California)",
                      ],
                      [
                        "name_to_abbr",
                        "Full name → Abbreviation  (California → CA)",
                      ],
                    ] as [string, string][]
                  ).map(([val, label]) => (
                    <label
                      key={val}
                      className="flex cursor-pointer items-center gap-2 text-xs"
                    >
                      <input
                        type="radio"
                        name="state_mapping_preset"
                        className="accent-[--color-primary]"
                        value={val}
                        checked={(valueMappingsStateDraft ?? "") === val}
                        onChange={() =>
                          setValueMappingsStateDraft(
                            (val || null) as
                              | "abbr_to_name"
                              | "name_to_abbr"
                              | null,
                          )
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            )}
            {/* Custom value mappings */}
            <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-x-3 gap-y-0.5 pb-1">
              <p className="text-[10px] uppercase tracking-wide text-[--color-text-muted]">
                From (aliases, comma-separated)
              </p>
              <span />
              <p className="text-[10px] uppercase tracking-wide text-[--color-text-muted]">
                To (normalised value)
              </p>
              <span />
            </div>
            <div className="space-y-2">
              {valueMappingsDraft.map((row, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-x-3"
                >
                  <input
                    className={inputClass}
                    placeholder="CA, ca, calif"
                    value={row.fromText}
                    onChange={(e) =>
                      setValueMappingsDraft((prev) =>
                        prev.map((r, ri) =>
                          ri === i ? { ...r, fromText: e.target.value } : r,
                        ),
                      )
                    }
                  />
                  <ArrowRight size={13} className="text-[--color-text-muted]" />
                  <input
                    className={inputClass}
                    placeholder="California"
                    value={row.to}
                    onChange={(e) =>
                      setValueMappingsDraft((prev) =>
                        prev.map((r, ri) =>
                          ri === i ? { ...r, to: e.target.value } : r,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setValueMappingsDraft((prev) =>
                        prev.filter((_, ri) => ri !== i),
                      )
                    }
                    className="shrink-0 text-[--color-text-muted] transition-colors hover:text-red-500"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                setValueMappingsDraft((prev) => [
                  ...prev,
                  { fromText: "", to: "" },
                ])
              }
              className="w-full rounded-lg border border-dashed border-[--color-border] py-2 text-xs text-[--color-text-muted] transition-colors hover:border-[--color-primary] hover:text-[--color-primary]"
            >
              + Add Mapping
            </button>
            <div className="flex justify-end gap-2 border-t border-[--color-border] pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setValueMappingsField(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={valueMappingsSaving}
                onClick={async () => {
                  if (!valueMappingsField) return;
                  setValueMappingsSaving(true);
                  try {
                    // Save state_mapping preset if this is a US State field and it changed
                    if (
                      valueMappingsField.data_type === "US State" &&
                      valueMappingsStateDraft !==
                        valueMappingsField.state_mapping
                    ) {
                      await updateCriteriaField(
                        campaign.id,
                        valueMappingsField.id,
                        { state_mapping: valueMappingsStateDraft },
                      );
                    }
                    // Save custom value_mappings
                    const mappings: CriteriaValueMapping[] = valueMappingsDraft
                      .map((r) => ({
                        from: r.fromText
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                        to: r.to.trim(),
                      }))
                      .filter((m) => m.from.length > 0 && m.to);
                    await updateCriteriaValueMappings(
                      campaign.id,
                      valueMappingsField.id,
                      mappings,
                    );
                    await refreshCriteria();
                    toast.success("Mappings saved");
                    setValueMappingsField(null);
                  } catch (err: any) {
                    toast.error(err?.message || "Unable to save mappings");
                  } finally {
                    setValueMappingsSaving(false);
                  }
                }}
              >
                {valueMappingsSaving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Delete catalog set confirm modal ────────────────────────────── */}
      <Modal
        title="Delete Catalog Set?"
        isOpen={!!confirmDeleteSet}
        onClose={() => setConfirmDeleteSet(null)}
        width={400}
      >
        {confirmDeleteSet && (
          <div className="space-y-4 px-1 pb-1 text-sm">
            <p className="text-[--color-text]">
              Permanently delete{" "}
              <span className="font-semibold text-[--color-text-strong]">
                {confirmDeleteSet.name}
              </span>
              ? This cannot be undone. Campaigns actively using a version of
              this set will retain their criteria fields but lose the catalog
              link.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDeleteSet(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={deletingSet}
                onClick={async () => {
                  if (!confirmDeleteSet) return;
                  setDeletingSet(true);
                  try {
                    await deleteCriteriaCatalogSet(confirmDeleteSet.id);
                    toast.success(`"${confirmDeleteSet.name}" deleted.`);
                    setCatalogSets((prev) =>
                      prev.filter((s) => s.id !== confirmDeleteSet.id),
                    );
                    setConfirmDeleteSet(null);
                  } catch {
                    toast.error("Failed to delete catalog set.");
                  } finally {
                    setDeletingSet(false);
                  }
                }}
              >
                {deletingSet ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Delete Criteria Field confirm modal ────────────────────────── */}
      <Modal
        title="Delete Field"
        isOpen={!!deleteFieldTarget}
        onClose={() => setDeleteFieldTarget(null)}
        width={420}
      >
        {deleteFieldTarget && (
          <div className="space-y-4 text-sm">
            <p className="text-[--color-text]">
              Delete field{" "}
              <span className="font-semibold text-[--color-text-strong]">
                {deleteFieldTarget.field_label}
              </span>
              ? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteFieldTarget(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={deletingField}
                onClick={async () => {
                  setDeletingField(true);
                  try {
                    await deleteCriteriaField(
                      campaign.id,
                      deleteFieldTarget.id,
                    );
                    await refreshCriteria();
                    toast.success("Field deleted");
                    // Deleting a field de-syncs the campaign from the applied catalog.
                    setLocalCriteriaSetId(null);
                    setLocalCriteriaSetVersion(null);
                    setLocalCriteriaSetName(null);
                    onCampaignUpdate?.({
                      criteria_set_id: null,
                      criteria_set_version: null,
                    });
                    setDeleteFieldTarget(null);
                  } catch (err: any) {
                    toast.error(err?.message || "Unable to delete field");
                  } finally {
                    setDeletingField(false);
                  }
                }}
              >
                {deletingField ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Save criteria fields to catalog ─────────────────────────────── */}
      <Modal
        title="Save Criteria to Catalog"
        isOpen={saveCriteriaToSetOpen}
        onClose={() => setSaveCriteriaToSetOpen(false)}
        width={470}
      >
        <div className="space-y-4 text-sm">
          <p className="text-[13px] text-[--color-text-muted]">
            Save this campaign's {criteriaFields.length} criteria field
            {criteriaFields.length !== 1 ? "s" : ""} as either a new version of
            the active catalog entry or as a brand new set.
          </p>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-[--color-text-muted]">
              Save Mode
            </label>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                disabled={!localCriteriaSetId}
                onClick={() => setSaveCriteriaToSetMode("new_version")}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                  saveCriteriaToSetMode === "new_version"
                    ? "border-[--color-primary] bg-[--color-primary]/10"
                    : "border-[--color-border] bg-[--color-bg]"
                } ${!localCriteriaSetId ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <p className="text-xs font-medium text-[--color-text]">
                  Save as new version
                </p>
                <p className="text-[11px] text-[--color-text-muted]">
                  {localCriteriaSetId
                    ? `Adds a version to ${localCriteriaSetName ?? localCriteriaSetId}.`
                    : "No active catalog is applied to this campaign yet."}
                </p>
              </button>
              <button
                type="button"
                onClick={() => setSaveCriteriaToSetMode("new_set")}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                  saveCriteriaToSetMode === "new_set"
                    ? "border-[--color-primary] bg-[--color-primary]/10"
                    : "border-[--color-border] bg-[--color-bg]"
                }`}
              >
                <p className="text-xs font-medium text-[--color-text]">
                  Save as new set
                </p>
                <p className="text-[11px] text-[--color-text-muted]">
                  Creates a new catalog entry with version 1.
                </p>
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wide text-[--color-text-muted]">
              Set Name{saveCriteriaToSetMode === "new_set" ? " *" : ""}
            </label>
            <input
              type="text"
              value={saveCriteriaToSetDraft.name}
              onChange={(e) =>
                setSaveCriteriaToSetDraft((draft) => ({
                  ...draft,
                  name: e.target.value,
                }))
              }
              placeholder="e.g. Rideshare Base Criteria"
              className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] placeholder:text-[--color-text-muted] focus:outline-none focus:ring-1 focus:ring-[--color-primary]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wide text-[--color-text-muted]">
              Description
            </label>
            <input
              type="text"
              value={saveCriteriaToSetDraft.description}
              onChange={(e) =>
                setSaveCriteriaToSetDraft((draft) => ({
                  ...draft,
                  description: e.target.value,
                }))
              }
              placeholder="Optional"
              className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] placeholder:text-[--color-text-muted] focus:outline-none focus:ring-1 focus:ring-[--color-primary]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSaveCriteriaToSetOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={
                savingCriteriaToSet ||
                (saveCriteriaToSetMode === "new_set" &&
                  !saveCriteriaToSetDraft.name.trim())
              }
              onClick={saveCurrentCriteriaToCatalog}
            >
              {savingCriteriaToSet ? "Saving…" : "Save & Apply"}
            </Button>
          </div>
        </div>
      </Modal>

      {participantAction &&
        (() => {
          const isClient = participantAction.type === "client";
          const pid = participantAction.id;
          const hasLeads = leadsForCampaign.length > 0;
          const isOnly = isClient
            ? linkedClients.length <= 1
            : linkedAffiliates.length <= 1;
          const cantRemove = isOnly || hasLeads;
          const removeReason = hasLeads
            ? `This campaign has ${leadsForCampaign.length} lead${
                leadsForCampaign.length === 1 ? "" : "s"
              }. Removing a participant would break lead history and data consistency. Set their status to DISABLED to stop receiving new leads.`
            : isOnly
              ? `At least one ${isClient ? "client" : "affiliate"} must remain linked to the campaign.`
              : "";
          const currentLink = isClient
            ? clientLinkMap.get(pid)
            : affiliateLinkMap.get(pid);
          const participant = isClient
            ? clients.find((c) => c.id === pid)
            : affiliates.find((a) => a.id === pid);
          return (
            <Modal
              title={`${isClient ? "Client" : "Affiliate"} Actions \u2014 ${participant?.name || pid}`}
              isOpen
              onClose={() => {
                setParticipantAction(null);
                setConfirmRotateKey(false);
              }}
              width={420}
            >
              <div className="space-y-5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-[--color-text-muted]">
                    Current status:
                  </span>
                  <Badge
                    tone={
                      statusColorMap[currentLink?.status || "TEST"] || "neutral"
                    }
                  >
                    {currentLink?.status || "TEST"}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                    Update Status
                  </p>
                  <div className="flex items-center gap-2">
                    <select
                      className={inputClass}
                      value={participantAction.statusDraft}
                      onChange={(e) =>
                        setParticipantAction((prev) =>
                          prev
                            ? {
                                ...prev,
                                statusDraft: e.target
                                  .value as CampaignParticipantStatus,
                              }
                            : null,
                        )
                      }
                    >
                      {participantStatusOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (
                          isClient &&
                          participantAction.statusDraft === "LIVE" &&
                          !(currentLink as CampaignClient)?.delivery_config?.url
                        ) {
                          toast.error(
                            "Delivery config required — set up a delivery endpoint for this client before switching to LIVE.",
                          );
                          return;
                        }
                        if (isClient) {
                          await onUpdateClientStatus(
                            campaign.id,
                            pid,
                            participantAction.statusDraft,
                          );
                          setLocalClientLinks((prev) =>
                            prev.map((l) =>
                              l.client_id === pid
                                ? {
                                    ...l,
                                    status: participantAction.statusDraft,
                                  }
                                : l,
                            ),
                          );
                        } else {
                          await onUpdateAffiliateStatus(
                            campaign.id,
                            pid,
                            participantAction.statusDraft,
                          );
                          setLocalAffiliateLinks((prev) =>
                            prev.map((l) =>
                              l.affiliate_id === pid
                                ? {
                                    ...l,
                                    status: participantAction.statusDraft,
                                  }
                                : l,
                            ),
                          );
                        }
                        setParticipantAction(null);
                      }}
                    >
                      Save
                    </Button>
                  </div>
                </div>

                {!isClient && (
                  <div className="space-y-2 border-t border-[--color-border] pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                      Key Management
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      iconLeft={<RotateCcw size={13} />}
                      onClick={() => setConfirmRotateKey(true)}
                    >
                      Generate New Campaign Key
                    </Button>
                    <p className="text-xs text-[--color-text-muted]">
                      Issues a fresh key for this affiliate. Share the new key —
                      the old one stops working immediately.
                    </p>
                    <Modal
                      title="Rotate Campaign Key?"
                      isOpen={confirmRotateKey}
                      onClose={() => setConfirmRotateKey(false)}
                      width={420}
                    >
                      <p className="text-sm text-[--color-text]">
                        A new key will be generated immediately. Any leads
                        submitted using the current key will be{" "}
                        <strong className="text-[--color-text-strong]">
                          rejected
                        </strong>{" "}
                        until the affiliate updates to the new key.
                      </p>
                      <div className="mt-5 flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirmRotateKey(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          iconLeft={<RotateCcw size={13} />}
                          onClick={async () => {
                            await onRotateParticipantKey(
                              campaign.id,
                              "affiliate",
                              pid,
                            );
                            setConfirmRotateKey(false);
                            setParticipantAction(null);
                          }}
                        >
                          Yes, Rotate Key
                        </Button>
                      </div>
                    </Modal>
                  </div>
                )}

                {!isClient && currentLink?.status === "LIVE" && (
                  <div className="space-y-2 border-t border-[--color-border] pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                      Lead Cap
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      iconLeft={<Gauge size={13} />}
                      onClick={() => {
                        setAffiliateCapModalId(pid);
                        setParticipantAction(null);
                      }}
                    >
                      Configure Lead Cap
                    </Button>
                    <p className="text-xs text-[--color-text-muted]">
                      Set a maximum number of leads this affiliate can send per
                      campaign.
                    </p>
                  </div>
                )}

                {!isClient && (
                  <div className="space-y-2 border-t border-[--color-border] pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                      Sold Pixel
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const existing = (
                          currentLink as CampaignAffiliate | undefined
                        )?.sold_pixel_config;
                        setPixelDraft(
                          existing
                            ? {
                                enabled: Boolean(existing.enabled),
                                url: existing.url ?? "",
                                method: existing.method ?? "POST",
                                headers: existing.headers,
                                payload_mapping: normalizePixelMappingRows(
                                  existing.payload_mapping,
                                  existing.parameter_mode ?? "query",
                                ),
                              }
                            : defaultAffiliatePixelConfig(),
                        );
                        setPixelSaveAttempted(false);
                        setPixelConfigTab("pixel");
                        setPixelAffiliateId(pid);
                        setParticipantAction(null);
                      }}
                    >
                      Configure Sold Pixel
                    </Button>
                    <p className="text-xs text-[--color-text-muted]">
                      Fire-and-forget callback sent only when this
                      affiliate&apos;s lead is sold.
                    </p>
                  </div>
                )}

                {!isClient && (
                  <div className="space-y-2 border-t border-[--color-border] pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                      Pixel Criteria
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setPixelConfigTab("pixel_criteria");
                        setPixelSaveAttempted(false);
                        const existing = (
                          currentLink as CampaignAffiliate | undefined
                        )?.sold_pixel_config;
                        setPixelDraft(
                          existing
                            ? {
                                enabled: Boolean(existing.enabled),
                                url: existing.url ?? "",
                                method: existing.method ?? "POST",
                                headers: existing.headers,
                                payload_mapping: normalizePixelMappingRows(
                                  existing.payload_mapping,
                                  existing.parameter_mode ?? "query",
                                ),
                              }
                            : defaultAffiliatePixelConfig(),
                        );
                        setPixelAffiliateId(pid);
                        setParticipantAction(null);
                      }}
                    >
                      Manage Pixel Criteria
                    </Button>
                    <p className="text-xs text-[--color-text-muted]">
                      Conditional rules that determine whether the sold pixel
                      fires for this affiliate.
                    </p>
                  </div>
                )}

                {!isClient && (
                  <div className="space-y-2 border-t border-[--color-border] pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                      Sold Criteria
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setPixelConfigTab("sold_criteria");
                        setPixelSaveAttempted(false);
                        const existing = (
                          currentLink as CampaignAffiliate | undefined
                        )?.sold_pixel_config;
                        setPixelDraft(
                          existing
                            ? {
                                enabled: Boolean(existing.enabled),
                                url: existing.url ?? "",
                                method: existing.method ?? "POST",
                                headers: existing.headers,
                                payload_mapping: normalizePixelMappingRows(
                                  existing.payload_mapping,
                                  existing.parameter_mode ?? "query",
                                ),
                              }
                            : defaultAffiliatePixelConfig(),
                        );
                        setPixelAffiliateId(pid);
                        setParticipantAction(null);
                      }}
                    >
                      Manage Sold Criteria
                    </Button>
                    <p className="text-xs text-[--color-text-muted]">
                      Conditional rules that determine whether a delivered lead
                      counts as &quot;sold&quot; for this affiliate.
                    </p>
                  </div>
                )}

                {!isClient && (
                  <div className="space-y-2 border-t border-[--color-border] pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                      Cherry Pick Override
                    </p>
                    <div className="flex items-center gap-3">
                      <select
                        className="rounded-lg border border-[--color-border] bg-[--color-bg] px-2.5 py-1.5 text-xs text-[--color-text] focus:outline-none focus:ring-2 focus:ring-[--color-primary]/40"
                        value={
                          (currentLink as CampaignAffiliate | undefined)
                            ?.cherry_pick_override === true
                            ? "true"
                            : (currentLink as CampaignAffiliate | undefined)
                                  ?.cherry_pick_override === false
                              ? "false"
                              : "inherit"
                        }
                        onChange={async (e) => {
                          const raw = e.target.value;
                          const val =
                            raw === "true"
                              ? true
                              : raw === "false"
                                ? false
                                : null;
                          try {
                            const res = await updateAffiliateCherryPickOverride(
                              campaign!.id,
                              pid,
                              val,
                            );
                            if (res.success) {
                              toast.success("Cherry pick override updated.");
                              setLocalAffiliateLinks((prev) =>
                                prev.map((l) =>
                                  l.affiliate_id === pid
                                    ? {
                                        ...l,
                                        cherry_pick_override: val ?? undefined,
                                      }
                                    : l,
                                ),
                              );
                            } else {
                              toast.error(
                                (res as any).message ||
                                  "Failed to update override",
                              );
                            }
                          } catch {
                            toast.error(
                              "Failed to update cherry pick override.",
                            );
                          }
                        }}
                      >
                        <option value="inherit">
                          Inherit from campaign (
                          {campaign?.default_cherry_pickable
                            ? "enabled"
                            : "disabled"}
                          )
                        </option>
                        <option value="true">Always cherry-pickable</option>
                        <option value="false">Never cherry-pickable</option>
                      </select>
                    </div>
                    <p className="text-xs text-[--color-text-muted]">
                      Controls whether rejected leads from this affiliate are
                      automatically marked as cherry-pickable.
                    </p>
                  </div>
                )}

                {!isClient && (
                  <div className="space-y-2 border-t border-[--color-border] pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                      Logic Rules
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openAffiliateLogicManager(pid)}
                    >
                      Manage Logic Rules
                    </Button>
                    <p className="text-xs text-[--color-text-muted]">
                      Override or extend the campaign logic rules for this
                      affiliate specifically.
                    </p>
                  </div>
                )}

                {isClient && (
                  <div className="space-y-2 border-t border-[--color-border] pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                      Delivery Configuration
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const existing = (
                          currentLink as CampaignClient | undefined
                        )?.delivery_config;
                        setDeliveryDraft(
                          existing
                            ? {
                                url: existing.url ?? "",
                                method: existing.method ?? "POST",
                                headers: existing.headers,
                                payload_mapping: normalizeDeliveryMappingRows(
                                  existing.payload_mapping,
                                ),
                                acceptance_rules:
                                  existing.acceptance_rules?.length > 0
                                    ? existing.acceptance_rules
                                    : [],
                              }
                            : defaultDeliveryConfig(),
                        );
                        setDeliverySaveAttempted(false);
                        setDeliveryTab("request");
                        setDeliveryClientId(pid);
                        setParticipantAction(null);
                      }}
                    >
                      Configure Delivery
                    </Button>
                    <p className="text-xs text-[--color-text-muted]">
                      Set the endpoint and payload mapping for delivering leads
                      to this client.
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openClientLogicManager(pid)}
                    >
                      Manage Logic Rules
                    </Button>
                    <p className="text-xs text-[--color-text-muted]">
                      Override or extend the campaign logic rules for this
                      client specifically.
                    </p>
                  </div>
                )}

                <div className="space-y-2 border-t border-[--color-border] pt-4">
                  <DisabledTooltip message={removeReason}>
                    <button
                      type="button"
                      disabled={cantRemove}
                      className={`w-full rounded-lg border px-3 py-2 text-sm font-medium transition ${
                        cantRemove
                          ? "cursor-not-allowed border-[--color-border] text-[--color-text-muted] opacity-40"
                          : "border-[--color-danger] text-[--color-danger] hover:bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)]"
                      }`}
                      onClick={async () => {
                        if (cantRemove) return;
                        if (isClient) {
                          await onRemoveClient(campaign.id, pid);
                          setLocalClientLinks((prev) =>
                            prev.filter((l) => l.client_id !== pid),
                          );
                        } else {
                          await onRemoveAffiliate(campaign.id, pid);
                          setLocalAffiliateLinks((prev) =>
                            prev.filter((l) => l.affiliate_id !== pid),
                          );
                        }
                        setParticipantAction(null);
                      }}
                    >
                      Remove from Campaign
                    </button>
                  </DisabledTooltip>
                </div>
              </div>
            </Modal>
          );
        })()}

      {/* ── Participant Logic Rules Modal ────────────────────────────────── */}
      <Modal
        title={
          pixelLogicIntroAffiliateId
            ? `Affiliate Logic Rules — ${affiliates.find((a) => a.id === pixelLogicIntroAffiliateId)?.name || pixelLogicIntroAffiliateId}`
            : deliveryLogicIntroClientId
              ? `Client Logic Rules — ${clients.find((c) => c.id === deliveryLogicIntroClientId)?.name || deliveryLogicIntroClientId}`
              : "Logic Rules"
        }
        isOpen={!!(pixelLogicIntroAffiliateId || deliveryLogicIntroClientId)}
        onClose={() => {
          setPixelLogicIntroAffiliateId(null);
          setDeliveryLogicIntroClientId(null);
          setParticipantLogicCatalogOpen(false);
          setParticipantLogicSetName(null);
          setParticipantLogicBaseSetId(null);
          setParticipantLogicBaseSetVersion(null);
          setParticipantLogicBaseSetName(null);
          setSaveParticipantLogicOpen(false);
          setSaveParticipantLogicDraft({ name: "", description: "" });
        }}
        width={720}
        bodyClassName="px-5 py-4 h-[620px] max-h-[80vh] overflow-hidden"
      >
        <div className="flex h-full min-h-0 flex-col gap-4">
          {/* Catalog applied badge */}
          {participantLogicSetId && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
              Applied from catalog:{" "}
              <strong>
                {participantLogicSetName ??
                  participantLogicCatalogSets.find(
                    (s) => s.id === participantLogicSetId,
                  )?.name ??
                  participantLogicSetId}
              </strong>{" "}
              v{participantLogicSetVersion}
            </div>
          )}

          {!participantLogicSetId &&
            participantLogicBaseSetId &&
            participantLogicBaseSetVersion != null && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                Modified from catalog:{" "}
                <strong>
                  {participantLogicBaseSetName ?? participantLogicBaseSetId}
                </strong>{" "}
                v{participantLogicBaseSetVersion}. Save to catalog to create a
                new version or new set.
              </div>
            )}

          {localLogicSetId && localLogicSetVersion != null && (
            <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] text-sky-700">
              Base campaign logic:{" "}
              <strong>
                {localLogicSetName ??
                  logicCatalogSets.find((s) => s.id === localLogicSetId)
                    ?.name ??
                  localLogicSetId}
              </strong>{" "}
              <button
                type="button"
                className="underline decoration-dotted underline-offset-2 hover:text-sky-900 transition-colors"
                onClick={() => {
                  setPinnedBaseExpandedRules(new Set());
                  setPinnedBaseLogicViewerOpen(true);
                }}
              >
                v{localLogicSetVersion} — view rules
              </button>
              . Participants inherit campaign logic automatically.
            </div>
          )}

          {participantLogicCatalogOpen ? (
            /* ── Catalog browser ── */
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                  Logic Catalog
                </p>
                <button
                  type="button"
                  onClick={() => setParticipantLogicCatalogOpen(false)}
                  className="text-[--color-text-muted] hover:text-[--color-text] transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
              {participantLogicCatalogLoading ? (
                <p className="text-sm text-[--color-text-muted]">Loading…</p>
              ) : participantLogicCatalogSets.length === 0 ? (
                <p className="text-sm text-[--color-text-muted]">
                  No logic catalog sets found.
                </p>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto divide-y divide-[--color-border] rounded-xl border border-[--color-border]">
                  {participantLogicCatalogSets.map((set) => (
                    <div key={set.id}>
                      <div
                        className="flex items-center gap-3 px-4 py-3 bg-[--color-bg] hover:bg-[--color-bg-muted] transition-colors cursor-pointer"
                        onClick={async () => {
                          if (participantExpandedSetId === set.id) {
                            setParticipantExpandedSetId(null);
                            return;
                          }
                          setParticipantExpandedSetId(set.id);
                          if (participantSetVersionsMap[set.id]) return;
                          setParticipantLoadingVersionsFor(set.id);
                          try {
                            const res = await getLogicCatalogSet(set.id);
                            if (res.success) {
                              setParticipantSetVersionsMap((prev) => ({
                                ...prev,
                                [set.id]: res.data.versions,
                              }));
                            }
                          } catch {
                            toast.error(
                              "Failed to load logic catalog versions.",
                            );
                          } finally {
                            setParticipantLoadingVersionsFor(null);
                          }
                        }}
                      >
                        <span className="text-[--color-text-muted]">
                          {participantExpandedSetId === set.id ? (
                            <ChevronDown size={14} />
                          ) : (
                            <ChevronRight size={14} />
                          )}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-[--color-text-strong] text-[13px]">
                              {set.name}
                            </span>
                            <span className="font-mono text-[10px] text-[--color-text-muted] bg-[--color-bg-muted] border border-[--color-border] rounded px-1.5 py-0.5">
                              v{set.latest_version}
                            </span>
                            {participantLogicSetId === set.id && (
                              <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
                                Active
                              </span>
                            )}
                          </div>
                          {set.description && (
                            <p className="mt-0.5 text-[11px] text-[--color-text-muted]">
                              {set.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <AnimatePresence initial={false}>
                        {participantExpandedSetId === set.id && (
                          <motion.div
                            key={`participant-logic-versions-${set.id}`}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            style={{ overflow: "hidden" }}
                            className="bg-[--color-bg-muted] border-t border-[--color-border]"
                          >
                            {participantLoadingVersionsFor === set.id ? (
                              <p className="px-6 py-3 text-xs text-[--color-text-muted]">
                                Loading versions…
                              </p>
                            ) : (participantSetVersionsMap[set.id] ?? [])
                                .length === 0 ? (
                              <p className="px-6 py-3 text-xs text-[--color-text-muted]">
                                No versions found.
                              </p>
                            ) : (
                              [...(participantSetVersionsMap[set.id] ?? [])]
                                .sort((a, b) => b.version - a.version)
                                .map((version) => {
                                  const isApplied =
                                    participantLogicSetId === set.id &&
                                    participantLogicSetVersion ===
                                      version.version;
                                  const applyKey = `${set.id}#v${version.version}`;
                                  return (
                                    <div
                                      key={version.version}
                                      className="border-b last:border-0 border-[--color-border]"
                                    >
                                      <div className="flex items-center gap-3 px-6 py-2.5">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setParticipantExpandedVersionRules(
                                              (prev) => {
                                                const next = new Set(prev);
                                                if (next.has(applyKey))
                                                  next.delete(applyKey);
                                                else next.add(applyKey);
                                                return next;
                                              },
                                            );
                                          }}
                                          className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                                        >
                                          <span className="text-[--color-text-muted]">
                                            {participantExpandedVersionRules.has(
                                              applyKey,
                                            ) ? (
                                              <ChevronDown size={11} />
                                            ) : (
                                              <ChevronRight size={11} />
                                            )}
                                          </span>
                                          <span className="font-mono text-[11px] font-semibold text-[--color-text-strong] w-6">
                                            v{version.version}
                                          </span>
                                          <span className="text-[11px] text-[--color-text-muted]">
                                            {version.rules.length} rule
                                            {version.rules.length !== 1
                                              ? "s"
                                              : ""}
                                          </span>
                                        </button>
                                        {isApplied ? (
                                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                                            <Check size={11} />
                                            Applied
                                          </span>
                                        ) : (
                                          <button
                                            type="button"
                                            disabled={
                                              participantLogicApplyingCatalogId !==
                                              null
                                            }
                                            onClick={() =>
                                              handleApplyParticipantLogicCatalog(
                                                set,
                                                version.version,
                                              )
                                            }
                                            className="inline-flex items-center gap-1 rounded-md border border-[--color-border] bg-[--color-surface] px-2.5 py-1 text-[11px] font-medium text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-bg] disabled:opacity-50 transition-colors"
                                          >
                                            {participantLogicApplyingCatalogId ===
                                            applyKey
                                              ? "Applying…"
                                              : "Apply"}
                                          </button>
                                        )}
                                      </div>

                                      <AnimatePresence initial={false}>
                                        {participantExpandedVersionRules.has(
                                          applyKey,
                                        ) && (
                                          <motion.div
                                            key={`participant-logic-rules-${applyKey}`}
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{
                                              height: "auto",
                                              opacity: 1,
                                            }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{
                                              duration: 0.18,
                                              ease: "easeOut",
                                            }}
                                            style={{ overflow: "hidden" }}
                                          >
                                            {version.rules.length === 0 ? (
                                              <p className="px-10 pb-3 text-[11px] text-[--color-text-muted]">
                                                No rules in this version.
                                              </p>
                                            ) : (
                                              <div className="space-y-1 border-t border-[--color-border] bg-[--color-bg] px-10 py-2.5">
                                                {version.rules.map((rule) => {
                                                  const ruleDetailKey = `${applyKey}#rule:${rule.id}`;
                                                  const condCount =
                                                    rule.groups.reduce(
                                                      (acc, group) =>
                                                        acc +
                                                        group.conditions.length,
                                                      0,
                                                    );
                                                  return (
                                                    <div
                                                      key={rule.id}
                                                      className="rounded-md border border-[--color-border] bg-[--color-bg-muted]"
                                                    >
                                                      <button
                                                        type="button"
                                                        onClick={() => {
                                                          setParticipantExpandedRuleDetails(
                                                            (prev) => {
                                                              const next =
                                                                new Set(prev);
                                                              if (
                                                                next.has(
                                                                  ruleDetailKey,
                                                                )
                                                              ) {
                                                                next.delete(
                                                                  ruleDetailKey,
                                                                );
                                                              } else {
                                                                next.add(
                                                                  ruleDetailKey,
                                                                );
                                                              }
                                                              return next;
                                                            },
                                                          );
                                                        }}
                                                        className="flex w-full items-center gap-2 px-2.5 py-2 text-[11px]"
                                                      >
                                                        <span className="text-[--color-text-muted]">
                                                          {participantExpandedRuleDetails.has(
                                                            ruleDetailKey,
                                                          ) ? (
                                                            <ChevronDown
                                                              size={11}
                                                            />
                                                          ) : (
                                                            <ChevronRight
                                                              size={11}
                                                            />
                                                          )}
                                                        </span>
                                                        <span
                                                          className={`rounded px-1.5 py-0.5 font-semibold ${
                                                            rule.action ===
                                                            "pass"
                                                              ? "bg-green-500/10 text-green-600"
                                                              : "bg-red-500/10 text-red-500"
                                                          }`}
                                                        >
                                                          {rule.action ===
                                                          "pass"
                                                            ? "Pass"
                                                            : "Fail"}
                                                        </span>
                                                        <span className="flex-1 truncate text-[--color-text] text-left">
                                                          {rule.name}
                                                        </span>
                                                        <span className="shrink-0 text-[10px] text-[--color-text-muted]">
                                                          {rule.groups.length}{" "}
                                                          group
                                                          {rule.groups
                                                            .length !== 1
                                                            ? "s"
                                                            : ""}{" "}
                                                          · {condCount} cond.
                                                        </span>
                                                      </button>
                                                      <AnimatePresence
                                                        initial={false}
                                                      >
                                                        {participantExpandedRuleDetails.has(
                                                          ruleDetailKey,
                                                        ) && (
                                                          <motion.div
                                                            key={`participant-logic-rule-detail-${ruleDetailKey}`}
                                                            initial={{
                                                              height: 0,
                                                              opacity: 0,
                                                            }}
                                                            animate={{
                                                              height: "auto",
                                                              opacity: 1,
                                                            }}
                                                            exit={{
                                                              height: 0,
                                                              opacity: 0,
                                                            }}
                                                            transition={{
                                                              duration: 0.15,
                                                              ease: "easeOut",
                                                            }}
                                                            style={{
                                                              overflow:
                                                                "hidden",
                                                            }}
                                                            className="border-t border-[--color-border] bg-[--color-bg] px-3 py-2"
                                                          >
                                                            <div className="space-y-2">
                                                              {rule.groups.map(
                                                                (
                                                                  group,
                                                                  groupIdx,
                                                                ) => (
                                                                  <div
                                                                    key={`${rule.id}-group-${groupIdx}`}
                                                                    className="rounded-md border border-[--color-border] bg-[--color-bg-muted] p-2"
                                                                  >
                                                                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
                                                                      Group{" "}
                                                                      {groupIdx +
                                                                        1}
                                                                    </p>
                                                                    <div className="space-y-1">
                                                                      {group.conditions.map(
                                                                        (
                                                                          condition,
                                                                          condIdx,
                                                                        ) => (
                                                                          <p
                                                                            key={`${rule.id}-group-${groupIdx}-cond-${condIdx}`}
                                                                            className="text-[11px] text-[--color-text]"
                                                                          >
                                                                            <span className="font-medium">
                                                                              {normalizeFieldLabel(
                                                                                condition.field_name,
                                                                              )}
                                                                            </span>{" "}
                                                                            <span className="text-[--color-text-muted]">
                                                                              {formatLogicOperatorLabel(
                                                                                condition.operator,
                                                                              )}
                                                                            </span>{" "}
                                                                            <span className="font-mono text-[10px] text-[--color-text-muted]">
                                                                              {formatLogicConditionValue(
                                                                                condition.value,
                                                                              )}
                                                                            </span>
                                                                          </p>
                                                                        ),
                                                                      )}
                                                                    </div>
                                                                  </div>
                                                                ),
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
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  );
                                })
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* ── Rules list ── */
            <>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {participantLogicLoading ? (
                  <p className="text-sm text-[--color-text-muted]">Loading…</p>
                ) : participantLogicRules.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[--color-border] py-12 text-center text-sm text-[--color-text-muted]">
                    No logic rules yet.{" "}
                    <button
                      type="button"
                      className="text-[--color-primary] hover:underline"
                      onClick={() => {
                        setParticipantLogicEditingRule(null);
                        setParticipantLogicBuilderOpen(true);
                      }}
                    >
                      Add one
                    </button>
                    .
                  </div>
                ) : (
                  <div className="space-y-2">
                    {participantLogicRules.map((rule) => (
                      <div
                        key={rule.id}
                        className="flex items-center gap-3 rounded-xl border border-[--color-border] bg-[--color-bg] px-4 py-3"
                      >
                        {/* Enable toggle */}
                        <button
                          type="button"
                          onClick={() => handleToggleParticipantLogicRule(rule)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${
                            rule.enabled
                              ? "bg-[--color-primary]"
                              : "bg-[--color-border]"
                          }`}
                          aria-label={`${rule.enabled ? "Disable" : "Enable"} rule`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform ${
                              rule.enabled ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>

                        {/* Action badge */}
                        <span
                          className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-semibold ${
                            rule.action === "pass"
                              ? "bg-green-500/10 text-green-600"
                              : "bg-red-500/10 text-red-500"
                          }`}
                        >
                          {rule.action === "pass" ? "Pass" : "Fail"}
                        </span>

                        {/* Name */}
                        <span
                          className={`flex-1 text-sm truncate ${
                            rule.enabled
                              ? "text-[--color-text-strong]"
                              : "text-[--color-text-muted] line-through"
                          }`}
                        >
                          {rule.name}
                        </span>

                        {/* Group / condition count */}
                        <span className="shrink-0 text-[11px] text-[--color-text-muted]">
                          {rule.groups.length}{" "}
                          {rule.groups.length === 1 ? "group" : "groups"}
                          {" · "}
                          {rule.groups.reduce(
                            (acc, g) => acc + g.conditions.length,
                            0,
                          )}{" "}
                          cond.
                        </span>

                        {/* Edit */}
                        <button
                          type="button"
                          onClick={() => {
                            setParticipantLogicEditingRule(rule);
                            setParticipantLogicBuilderOpen(true);
                          }}
                          className="shrink-0 text-[--color-text-muted] hover:text-[--color-text] transition-colors"
                        >
                          <Pencil size={13} />
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          disabled={participantLogicDeletingRuleId === rule.id}
                          onClick={() =>
                            handleDeleteParticipantLogicRule(rule.id)
                          }
                          className="shrink-0 text-[--color-text-muted] hover:text-red-500 transition-colors disabled:opacity-40"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer actions */}
              <div className="flex items-center justify-between border-t border-[--color-border] pt-3">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    iconLeft={<Plus size={14} />}
                    onClick={() => {
                      setParticipantLogicEditingRule(null);
                      setParticipantLogicBuilderOpen(true);
                    }}
                  >
                    Add Rule
                  </Button>
                  {participantLogicRules.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSaveParticipantLogicMode(
                          participantLogicBaseSetId ? "new_version" : "new_set",
                        );
                        setSaveParticipantLogicDraft({
                          name: participantLogicBaseSetName ?? "",
                          description: "",
                        });
                        setSaveParticipantLogicOpen(true);
                      }}
                    >
                      Save to Catalog
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {participantLogicType === "client" &&
                    deliveryLogicIntroClientId && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={syncingClientLogicToCampaign}
                        onClick={handleSyncClientLogicToCampaign}
                      >
                        {syncingClientLogicToCampaign
                          ? "Syncing…"
                          : "Sync to Campaign Logic"}
                      </Button>
                    )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={openParticipantLogicCatalog}
                  >
                    Apply from Logic Catalog
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* ── Pinned Base Campaign Logic Viewer ─────────────────────────── */}
      <Modal
        title={`Base Campaign Logic — ${localLogicSetName ?? localLogicSetId ?? "Campaign"} v${localLogicSetVersion ?? "?"}`}
        isOpen={pinnedBaseLogicViewerOpen}
        onClose={() => setPinnedBaseLogicViewerOpen(false)}
        width={620}
        bodyClassName="px-5 py-4 max-h-[70vh] overflow-y-auto"
      >
        <div className="space-y-2">
          {logicRules.length === 0 ? (
            <p className="text-sm text-[--color-text-muted]">
              No campaign-level logic rules defined.
            </p>
          ) : (
            logicRules.map((rule: any) => {
              const expanded = pinnedBaseExpandedRules.has(rule.id);
              return (
                <div
                  key={rule.id}
                  className="rounded-lg border border-[--color-border] bg-[--color-bg]"
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left"
                    onClick={() =>
                      setPinnedBaseExpandedRules((prev) => {
                        const next = new Set(prev);
                        if (next.has(rule.id)) next.delete(rule.id);
                        else next.add(rule.id);
                        return next;
                      })
                    }
                  >
                    <ChevronRight
                      size={14}
                      className={`shrink-0 text-[--color-text-muted] transition-transform ${expanded ? "rotate-90" : ""}`}
                    />
                    <span className="flex-1 text-sm font-medium text-[--color-text]">
                      {rule.name}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        rule.action === "pass"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {rule.action}
                    </span>
                    {!rule.enabled && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-500">
                        disabled
                      </span>
                    )}
                  </button>
                  {expanded && (
                    <div className="border-t border-[--color-border] px-3 py-2 space-y-2">
                      {(rule.groups ?? []).map((group: any, gi: number) => (
                        <div
                          key={group.id ?? gi}
                          className="rounded-md border border-[--color-border] bg-[--color-bg-muted] px-3 py-2"
                        >
                          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
                            Group {gi + 1}{" "}
                            <span className="font-normal">
                              (all conditions must match)
                            </span>
                          </p>
                          <div className="space-y-1">
                            {(group.conditions ?? []).map(
                              (cond: any, ci: number) => (
                                <div
                                  key={cond.id ?? ci}
                                  className="flex items-center gap-2 text-xs text-[--color-text]"
                                >
                                  <span className="font-mono text-[--color-primary]">
                                    {cond.field_name}
                                  </span>
                                  <span className="text-[--color-text-muted]">
                                    {(cond.operator ?? "").replace(/_/g, " ")}
                                  </span>
                                  {cond.value !== undefined && (
                                    <span className="font-medium">
                                      {Array.isArray(cond.value)
                                        ? cond.value.join(", ")
                                        : String(cond.value)}
                                    </span>
                                  )}
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      ))}
                      {(!rule.groups || rule.groups.length === 0) && (
                        <p className="text-xs text-[--color-text-muted]">
                          No condition groups defined.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Modal>

      {/* ── Save participant logic to catalog ───────────────────────────── */}
      <Modal
        title="Save Logic Rules to Catalog"
        isOpen={saveParticipantLogicOpen}
        onClose={() => setSaveParticipantLogicOpen(false)}
        width={470}
      >
        <div className="space-y-4 text-sm">
          <p className="text-[13px] text-[--color-text-muted]">
            Save these participant-specific rules as either a new version of the
            active logic catalog entry or as a brand new catalog set.
          </p>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-[--color-text-muted]">
              Save Mode
            </label>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                disabled={!participantLogicBaseSetId}
                onClick={() => setSaveParticipantLogicMode("new_version")}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                  saveParticipantLogicMode === "new_version"
                    ? "border-[--color-primary] bg-[--color-primary]/10"
                    : "border-[--color-border] bg-[--color-bg]"
                } ${!participantLogicBaseSetId ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <p className="text-xs font-medium text-[--color-text]">
                  Save as new version
                </p>
                <p className="text-[11px] text-[--color-text-muted]">
                  {participantLogicBaseSetId
                    ? `Adds a version to ${participantLogicBaseSetName ?? participantLogicBaseSetId}.`
                    : "No active catalog applied on this participant yet."}
                </p>
              </button>
              <button
                type="button"
                onClick={() => setSaveParticipantLogicMode("new_set")}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                  saveParticipantLogicMode === "new_set"
                    ? "border-[--color-primary] bg-[--color-primary]/10"
                    : "border-[--color-border] bg-[--color-bg]"
                }`}
              >
                <p className="text-xs font-medium text-[--color-text]">
                  Save as new set
                </p>
                <p className="text-[11px] text-[--color-text-muted]">
                  Creates a brand new catalog entry with version 1.
                </p>
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wide text-[--color-text-muted]">
              Set Name{saveParticipantLogicMode === "new_set" ? " *" : ""}
            </label>
            <input
              type="text"
              value={saveParticipantLogicDraft.name}
              onChange={(e) =>
                setSaveParticipantLogicDraft((draft) => ({
                  ...draft,
                  name: e.target.value,
                }))
              }
              placeholder="e.g. Happy Law Overrides"
              className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] placeholder:text-[--color-text-muted] focus:outline-none focus:ring-1 focus:ring-[--color-primary]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wide text-[--color-text-muted]">
              Description
            </label>
            <input
              type="text"
              value={saveParticipantLogicDraft.description}
              onChange={(e) =>
                setSaveParticipantLogicDraft((draft) => ({
                  ...draft,
                  description: e.target.value,
                }))
              }
              placeholder="Optional"
              className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] placeholder:text-[--color-text-muted] focus:outline-none focus:ring-1 focus:ring-[--color-primary]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSaveParticipantLogicOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={
                savingParticipantLogicToCatalog ||
                (saveParticipantLogicMode === "new_set" &&
                  !saveParticipantLogicDraft.name.trim())
              }
              onClick={saveParticipantLogicToCatalog}
            >
              {savingParticipantLogicToCatalog ? "Saving…" : "Save & Apply"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Participant rule builder modal ───────────────────────────────── */}
      <LogicBuilderModal
        isOpen={participantLogicBuilderOpen}
        onClose={() => {
          setParticipantLogicBuilderOpen(false);
          setParticipantLogicEditingRule(null);
        }}
        onSave={handleSaveParticipantLogicRule}
        rule={participantLogicEditingRule}
        criteriaFields={criteriaFields}
        saving={participantLogicSaving}
      />

      <Modal
        title={`Client Delivery${
          deliveryClientId
            ? ` — ${clients.find((c) => c.id === deliveryClientId)?.name || deliveryClientId}`
            : ""
        }`}
        isOpen={!!deliveryClientId}
        onClose={() => {
          setDeliverySaveAttempted(false);
          setDeliveryClientId(null);
        }}
        width={720}
        bodyClassName="px-5 py-4 h-[620px] max-h-[80vh]"
      >
        {deliveryClientId && (
          <div className="flex h-full min-h-0 flex-col gap-4">
            <div className="flex items-center gap-1 border-b border-[--color-border] pb-2">
              {(
                [
                  { key: "request" as const, label: "Delivery Request" },
                  { key: "response" as const, label: "Response Validation" },
                ] as const
              ).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setDeliveryTab(t.key)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    deliveryTab === t.key
                      ? "bg-[--color-primary] text-white"
                      : "text-[--color-text-muted] hover:text-[--color-text]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              {deliveryTab === "request" ? (
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-[--color-text-muted]">
                        Method
                      </span>
                      <select
                        className={inputClass}
                        value={deliveryDraft.method}
                        onChange={(e) =>
                          setDeliveryDraft((prev) => ({
                            ...prev,
                            method: e.target
                              .value as ClientDeliveryConfig["method"],
                          }))
                        }
                      >
                        {(["POST", "GET", "PUT", "PATCH"] as const).map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 md:col-span-1">
                      <span className="text-xs font-medium text-[--color-text-muted]">
                        Webhook URL <span className="text-red-500">*</span>
                      </span>
                      <input
                        className={`${inputClass} ${
                          deliveryInvalidUrl
                            ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/25"
                            : ""
                        }`}
                        value={deliveryDraft.url}
                        onChange={(e) =>
                          setDeliveryDraft((prev) => ({
                            ...prev,
                            url: e.target.value,
                          }))
                        }
                        placeholder="https://buyer.example.com/leads"
                      />
                    </label>
                  </div>

                  <div
                    className={`space-y-2 rounded-lg border p-3 ${
                      deliveryInvalidMappings
                        ? "border-red-500/60"
                        : "border-[--color-border]"
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                      Payload Mapping <span className="text-red-500">*</span>
                    </p>

                    {criteriaFields.length > 0 &&
                      (() => {
                        const alreadyMapped = new Set(
                          deliveryDraft.payload_mapping
                            .map((m) => m.field_name)
                            .filter(Boolean),
                        );
                        const unmappedCount = criteriaFields.filter(
                          (cf) => !alreadyMapped.has(cf.field_name),
                        ).length;
                        if (unmappedCount === 0) return null;
                        return (
                          <div className="flex items-center justify-between rounded-lg border border-[--color-border] bg-[--color-bg-muted] px-3 py-2.5">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-[--color-text-strong]">
                                Import from criteria fields
                              </p>
                              <p className="text-[11px] text-[--color-text-muted] mt-0.5">
                                Add all {unmappedCount} unmapped field
                                {unmappedCount !== 1 ? "s" : ""} at once.
                                Existing mappings are kept.
                              </p>
                            </div>
                            <button
                              type="button"
                              className="ml-3 shrink-0 rounded-md border border-[--color-border] bg-[--color-panel] px-3 py-1.5 text-xs font-semibold text-[--color-text] hover:border-[--color-primary] hover:text-[--color-primary] transition-colors"
                              onClick={() =>
                                setDeliveryDraft((prev) => {
                                  const mapped = new Set(
                                    prev.payload_mapping
                                      .map((m) => m.field_name)
                                      .filter(Boolean),
                                  );
                                  const toAdd = criteriaFields
                                    .filter((cf) => !mapped.has(cf.field_name))
                                    .map((cf) => ({
                                      key: cf.field_name,
                                      value_source: "field" as const,
                                      field_name: cf.field_name,
                                      parameter_target: "body" as const,
                                    }));
                                  if (toAdd.length === 0) return prev;
                                  const hasOnlyEmptyPlaceholder =
                                    prev.payload_mapping.length === 1 &&
                                    !prev.payload_mapping[0].key &&
                                    !prev.payload_mapping[0].field_name;
                                  return {
                                    ...prev,
                                    payload_mapping: hasOnlyEmptyPlaceholder
                                      ? toAdd
                                      : [...prev.payload_mapping, ...toAdd],
                                  };
                                })
                              }
                            >
                              Add All
                            </button>
                          </div>
                        );
                      })()}

                    <div className="space-y-2">
                      <AnimatePresence initial={false}>
                        {deliveryDraft.payload_mapping.map((row, idx) => (
                          <motion.div
                            key={`map-${idx}`}
                            layout
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.18 }}
                            className="grid gap-2 md:grid-cols-[minmax(0,1fr)_140px_minmax(0,1fr)_120px_auto]"
                          >
                            <input
                              className={inputClass}
                              placeholder="Outbound key"
                              value={row.key}
                              onChange={(e) =>
                                setDeliveryDraft((prev) => ({
                                  ...prev,
                                  payload_mapping: prev.payload_mapping.map(
                                    (m, i) =>
                                      i === idx
                                        ? { ...m, key: e.target.value }
                                        : m,
                                  ),
                                }))
                              }
                            />
                            <select
                              className={inputClass}
                              value={row.value_source}
                              onChange={(e) => {
                                const valueSource = e.target
                                  .value as ClientDeliveryConfig["payload_mapping"][number]["value_source"];
                                setDeliveryDraft((prev) => ({
                                  ...prev,
                                  payload_mapping: prev.payload_mapping.map(
                                    (m, i) =>
                                      i === idx
                                        ? {
                                            ...m,
                                            value_source: valueSource,
                                            field_name:
                                              valueSource === "field"
                                                ? (m.field_name ?? "")
                                                : undefined,
                                            static_value:
                                              valueSource === "static"
                                                ? (m.static_value ?? "")
                                                : undefined,
                                          }
                                        : m,
                                  ),
                                }));
                              }}
                            >
                              <option value="field">Lead Field</option>
                              <option value="static">Static Value</option>
                            </select>
                            {row.value_source === "field" ? (
                              <select
                                className={inputClass}
                                value={row.field_name ?? ""}
                                onChange={(e) =>
                                  setDeliveryDraft((prev) => ({
                                    ...prev,
                                    payload_mapping: prev.payload_mapping.map(
                                      (m, i) =>
                                        i === idx
                                          ? {
                                              ...m,
                                              field_name: e.target.value,
                                            }
                                          : m,
                                    ),
                                  }))
                                }
                              >
                                <option value="">
                                  {criteriaFields.length === 0
                                    ? "No fields defined"
                                    : "Select lead field\u2026"}
                                </option>
                                {criteriaFields.map((cf) => (
                                  <option key={cf.id} value={cf.field_name}>
                                    {cf.field_label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                className={inputClass}
                                placeholder="static_value"
                                value={String(row.static_value ?? "")}
                                onChange={(e) =>
                                  setDeliveryDraft((prev) => ({
                                    ...prev,
                                    payload_mapping: prev.payload_mapping.map(
                                      (m, i) =>
                                        i === idx
                                          ? {
                                              ...m,
                                              static_value: e.target.value,
                                            }
                                          : m,
                                    ),
                                  }))
                                }
                              />
                            )}
                            <select
                              className={inputClass}
                              value={row.parameter_target ?? "body"}
                              onChange={(e) =>
                                setDeliveryDraft((prev) => ({
                                  ...prev,
                                  payload_mapping: prev.payload_mapping.map(
                                    (m, i) =>
                                      i === idx
                                        ? {
                                            ...m,
                                            parameter_target: e.target.value as
                                              | "query"
                                              | "body",
                                          }
                                        : m,
                                  ),
                                }))
                              }
                            >
                              <option value="query">Query</option>
                              <option value="body">Body</option>
                            </select>
                            <button
                              type="button"
                              className="flex items-center justify-center rounded p-1.5 text-[--color-text-muted] hover:text-red-500 disabled:opacity-30 transition-colors"
                              onClick={() =>
                                setDeliveryDraft((prev) => ({
                                  ...prev,
                                  payload_mapping: prev.payload_mapping.filter(
                                    (_, i) => i !== idx,
                                  ),
                                }))
                              }
                              disabled={
                                deliveryDraft.payload_mapping.length <= 1
                              }
                              title="Remove row"
                            >
                              <Trash2 size={14} />
                            </button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>

                    <button
                      type="button"
                      className="mt-1 flex items-center gap-1 text-xs text-[--color-primary] hover:underline"
                      onClick={() =>
                        setDeliveryDraft((prev) => ({
                          ...prev,
                          payload_mapping: [
                            ...prev.payload_mapping,
                            {
                              key: "",
                              value_source: "field",
                              field_name: "",
                              parameter_target: "body",
                            },
                          ],
                        }))
                      }
                    >
                      <Plus size={12} />
                      Add mapping
                    </button>
                  </div>

                  {/* \u2500\u2500 Live payload preview */}
                  {(() => {
                    const sampleValueFor = (
                      field: CriteriaField | undefined,
                    ): string => {
                      if (!field) return "";
                      const lbl = field.field_label.toLowerCase();
                      if (lbl.includes("email")) return "john@example.com";
                      if (lbl.includes("phone")) return "+1 (555) 867-5309";
                      if (lbl.includes("first") && lbl.includes("name"))
                        return "John";
                      if (lbl.includes("last") && lbl.includes("name"))
                        return "Doe";
                      if (lbl.includes("name")) return "John Doe";
                      if (lbl.includes("zip") || lbl.includes("postal"))
                        return "90210";
                      if (lbl.includes("city")) return "Los Angeles";
                      if (
                        lbl.includes("ip") ||
                        field.field_name.toLowerCase().includes("ip")
                      )
                        return "203.0.113.42";
                      if (lbl.includes("address")) return "123 Main St";
                      if (lbl.includes("dob") || lbl.includes("birth"))
                        return "1990-06-15";
                      switch (field.data_type) {
                        case "US State":
                          return "CA";
                        case "Number":
                          return "30";
                        case "Boolean":
                          return "true";
                        case "Date":
                          return "2026-01-15";
                        case "List":
                          return field.options?.[0]?.value ?? "option1";
                        default:
                          return "Sample value";
                      }
                    };

                    const previewEntries = deliveryDraft.payload_mapping
                      .filter((m) => m.key.trim())
                      .map((m) => {
                        if (m.value_source === "static") {
                          return {
                            key: m.key.trim(),
                            value: String(m.static_value ?? ""),
                            target: (m.parameter_target ?? "body") as
                              | "query"
                              | "body",
                          };
                        }
                        const cf = criteriaFields.find(
                          (f) => f.field_name === m.field_name,
                        );
                        return {
                          key: m.key.trim(),
                          value: cf ? sampleValueFor(cf) : "\u2026",
                          target: (m.parameter_target ?? "body") as
                            | "query"
                            | "body",
                        };
                      });

                    if (previewEntries.length === 0) return null;

                    const queryEntries = previewEntries.filter(
                      (entry) => entry.target === "query",
                    );
                    const bodyEntries = previewEntries.filter(
                      (entry) => entry.target === "body",
                    );
                    const hasQuery = queryEntries.length > 0;
                    const hasBody = bodyEntries.length > 0;

                    if (!hasQuery && !hasBody) return null;

                    const baseUrl =
                      deliveryDraft.url.trim() ||
                      "https://buyer.example.com/leads";
                    const queryPreviewUrl = (() => {
                      try {
                        const url = new URL(baseUrl);
                        for (const entry of queryEntries) {
                          url.searchParams.set(entry.key, entry.value);
                        }
                        return url.toString();
                      } catch {
                        const query = queryEntries
                          .map(
                            (entry) =>
                              `${encodeURIComponent(entry.key)}=${encodeURIComponent(entry.value)}`,
                          )
                          .join("&");
                        return query ? `${baseUrl}?${query}` : baseUrl;
                      }
                    })();

                    const bodyLines = [
                      "{",
                      ...bodyEntries.map(
                        (e, i) =>
                          `  "${e.key}": "${e.value}"${i < bodyEntries.length - 1 ? "," : ""}`,
                      ),
                      "}",
                    ];

                    return (
                      <div className="space-y-2 rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-3">
                        {hasQuery && (
                          <details
                            className="rounded-md border border-[--color-border] bg-[--color-panel]"
                            open
                          >
                            <summary className="cursor-pointer px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
                              Expected URL with Query Params
                            </summary>
                            <div className="border-t border-[--color-border] p-3">
                              <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[--color-text]">
                                {queryPreviewUrl}
                              </pre>
                            </div>
                          </details>
                        )}

                        {hasBody && (
                          <details
                            className="rounded-md border border-[--color-border] bg-[--color-panel]"
                            open={!hasQuery}
                          >
                            <summary className="cursor-pointer px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
                              Expected Payload Preview
                            </summary>
                            <div className="border-t border-[--color-border] p-3">
                              <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[--color-text]">
                                {bodyLines.join("\n")}
                              </pre>
                            </div>
                          </details>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="space-y-3">
                  <div
                    className={`space-y-2 rounded-lg border p-3 ${
                      deliveryInvalidRules
                        ? "border-red-500/60"
                        : "border-[--color-border]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                          Acceptance Rules{" "}
                          <span className="text-red-500">*</span>
                        </p>
                        <p className="text-[11px] text-[--color-text-muted] mt-0.5">
                          Rules are evaluated as OR (first match wins). Matching
                          is case-insensitive.
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <AnimatePresence initial={false}>
                        {deliveryDraft.acceptance_rules.map((rule, idx) => (
                          <motion.div
                            key={`rule-${idx}`}
                            layout
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.18 }}
                            className="grid gap-2 md:grid-cols-[minmax(0,1fr)_110px_auto]"
                          >
                            <input
                              className={inputClass}
                              placeholder="Response contains..."
                              value={rule.match_value}
                              onChange={(e) =>
                                setDeliveryDraft((prev) => ({
                                  ...prev,
                                  acceptance_rules: prev.acceptance_rules.map(
                                    (r, i) =>
                                      i === idx
                                        ? { ...r, match_value: e.target.value }
                                        : r,
                                  ),
                                }))
                              }
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setDeliveryDraft((prev) => ({
                                  ...prev,
                                  acceptance_rules: prev.acceptance_rules.map(
                                    (r, i) =>
                                      i === idx
                                        ? {
                                            ...r,
                                            action:
                                              r.action === "passed"
                                                ? "failed"
                                                : "passed",
                                          }
                                        : r,
                                  ),
                                }))
                              }
                              className={`flex w-[100px] items-center justify-between rounded-full border px-1 py-1 text-xs font-semibold transition-colors ${
                                rule.action === "passed"
                                  ? "border-green-500/40 bg-green-500/10"
                                  : "border-red-500/40 bg-red-500/10"
                              }`}
                            >
                              <span
                                className={`flex h-5 w-5 items-center justify-center rounded-full text-white transition-all ${
                                  rule.action === "passed"
                                    ? "bg-green-500"
                                    : "bg-red-500"
                                }`}
                              >
                                {rule.action === "passed" ? "✓" : "✕"}
                              </span>
                              <span
                                className={`flex-1 text-center ${
                                  rule.action === "passed"
                                    ? "text-green-600"
                                    : "text-red-500"
                                }`}
                              >
                                {rule.action === "passed" ? "Pass" : "Fail"}
                              </span>
                            </button>
                            <button
                              type="button"
                              className="flex items-center justify-center rounded p-1.5 text-[--color-text-muted] hover:text-red-500 disabled:opacity-30 transition-colors"
                              onClick={() =>
                                setDeliveryDraft((prev) => ({
                                  ...prev,
                                  acceptance_rules:
                                    prev.acceptance_rules.filter(
                                      (_, i) => i !== idx,
                                    ),
                                }))
                              }
                              disabled={
                                deliveryDraft.acceptance_rules.length <= 1
                              }
                              title="Remove rule"
                            >
                              <Trash2 size={14} />
                            </button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                    <button
                      type="button"
                      className="mt-1 flex items-center gap-1 text-xs text-[--color-primary] hover:underline"
                      onClick={() =>
                        setDeliveryDraft((prev) => ({
                          ...prev,
                          acceptance_rules: [
                            ...prev.acceptance_rules,
                            { match_value: "", action: "passed" },
                          ],
                        }))
                      }
                    >
                      <Plus size={12} />
                      Add rule
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[--color-border] pt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDeliverySaveAttempted(false);
                  setDeliveryClientId(null);
                }}
              >
                Cancel
              </Button>
              <div className="inline-flex">
                <DisabledTooltip message={deliverySaveDisabledReason}>
                  <Button
                    size="sm"
                    disabled={
                      savingDeliveryConfig ||
                      Boolean(deliverySaveDisabledReason)
                    }
                    onClick={async () => {
                      setDeliverySaveAttempted(true);
                      const trimmedUrl = deliveryDraft.url.trim();
                      if (!trimmedUrl) {
                        toast.warning("Webhook URL is required.");
                        return;
                      }
                      try {
                        // URL validation
                        // eslint-disable-next-line no-new
                        new URL(trimmedUrl);
                      } catch {
                        toast.warning("Enter a valid webhook URL.");
                        return;
                      }

                      if (deliveryDraft.payload_mapping.length === 0) {
                        toast.warning(
                          "At least one payload mapping is required.",
                        );
                        return;
                      }
                      const hasBadMapping = deliveryDraft.payload_mapping.some(
                        (m) =>
                          !m.key.trim() ||
                          (m.parameter_target !== undefined &&
                            m.parameter_target !== "query" &&
                            m.parameter_target !== "body") ||
                          (m.value_source === "field"
                            ? !(m.field_name ?? "").trim()
                            : String(m.static_value ?? "").trim().length === 0),
                      );
                      if (hasBadMapping) {
                        toast.warning("Complete all payload mapping rows.");
                        return;
                      }

                      if (deliveryDraft.acceptance_rules.length === 0) {
                        toast.warning(
                          "At least one acceptance rule is required.",
                        );
                        return;
                      }
                      const hasBadRule = deliveryDraft.acceptance_rules.some(
                        (r) => !r.match_value.trim(),
                      );
                      if (hasBadRule) {
                        toast.warning("Complete all acceptance rules.");
                        return;
                      }

                      setSavingDeliveryConfig(true);
                      try {
                        const payload: ClientDeliveryConfig = {
                          ...deliveryDraft,
                          url: trimmedUrl,
                          payload_mapping: deliveryDraft.payload_mapping.map(
                            (m) =>
                              m.value_source === "field"
                                ? {
                                    key: m.key.trim(),
                                    value_source: "field",
                                    field_name: (m.field_name ?? "").trim(),
                                    parameter_target:
                                      m.parameter_target ?? "body",
                                  }
                                : {
                                    key: m.key.trim(),
                                    value_source: "static",
                                    static_value: m.static_value,
                                    parameter_target:
                                      m.parameter_target ?? "body",
                                  },
                          ),
                          acceptance_rules: deliveryDraft.acceptance_rules.map(
                            (r) => ({
                              match_value: r.match_value.trim(),
                              action: r.action,
                            }),
                          ),
                        };

                        await onUpdateClientDeliveryConfig(
                          campaign.id,
                          deliveryClientId,
                          payload,
                        );

                        setLocalClientLinks((prev) =>
                          prev.map((l) =>
                            l.client_id === deliveryClientId
                              ? { ...l, delivery_config: payload }
                              : l,
                          ),
                        );
                        setDeliveryClientId(null);
                      } finally {
                        setSavingDeliveryConfig(false);
                      }
                    }}
                  >
                    Save Delivery Config
                  </Button>
                </DisabledTooltip>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Affiliate Lead Cap Modal ───────────────────────────────────────── */}
      <Modal
        title={`Affiliate Lead Cap${
          affiliateCapModalId
            ? ` — ${affiliates.find((a) => a.id === affiliateCapModalId)?.name || affiliateCapModalId}`
            : ""
        }`}
        isOpen={!!affiliateCapModalId}
        onClose={() => setAffiliateCapModalId(null)}
        width={420}
      >
        {affiliateCapModalId && (
          <div className="space-y-4">
            <p className="text-sm text-[--color-text-muted]">
              Set a maximum number of leads this affiliate can submit for this
              campaign. Leave blank for uncapped.
            </p>
            <div className="flex items-center gap-2">
              <input
                className={inputClass}
                type="number"
                min={1}
                placeholder="Uncapped"
                value={affiliateCapDraft}
                onChange={(e) => setAffiliateCapDraft(e.target.value)}
              />
              <Button
                size="sm"
                disabled={savingAffiliateCap}
                onClick={async () => {
                  const trimmed = affiliateCapDraft.trim();
                  const parsed = Number(trimmed);
                  if (!trimmed || Number.isNaN(parsed) || parsed < 1) {
                    toast.warning(
                      "Enter a cap of at least 1, or use Uncapped.",
                    );
                    return;
                  }
                  setSavingAffiliateCap(true);
                  try {
                    await onUpdateAffiliateLeadCap(
                      campaign.id,
                      affiliateCapModalId,
                      parsed,
                    );
                    setLocalAffiliateLinks((prev) =>
                      prev.map((l) =>
                        l.affiliate_id === affiliateCapModalId
                          ? { ...l, lead_cap: parsed }
                          : l,
                      ),
                    );
                    setAffiliateCapModalId(null);
                  } finally {
                    setSavingAffiliateCap(false);
                  }
                }}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={savingAffiliateCap}
                onClick={async () => {
                  setSavingAffiliateCap(true);
                  try {
                    await onUpdateAffiliateLeadCap(
                      campaign.id,
                      affiliateCapModalId,
                      null,
                    );
                    setAffiliateCapDraft("");
                    setLocalAffiliateLinks((prev) =>
                      prev.map((l) =>
                        l.affiliate_id === affiliateCapModalId
                          ? { ...l, lead_cap: null }
                          : l,
                      ),
                    );
                    setAffiliateCapModalId(null);
                  } finally {
                    setSavingAffiliateCap(false);
                  }
                }}
              >
                Uncapped
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title={`${pixelConfigTab === "pixel" ? "Affiliate Sold Pixel" : pixelConfigTab === "pixel_criteria" ? "Pixel Criteria" : "Sold Criteria"}${
          pixelAffiliateId
            ? ` — ${affiliates.find((a) => a.id === pixelAffiliateId)?.name || pixelAffiliateId}`
            : ""
        }`}
        isOpen={!!pixelAffiliateId}
        onClose={() => {
          setPixelSaveAttempted(false);
          setPixelAffiliateId(null);
          setPixelCriteriaAffiliateId(null);
          setSoldCriteriaAffiliateId(null);
          setPixelCriteriaRules([]);
          setSoldCriteriaRules([]);
        }}
        width={720}
        bodyClassName="px-5 py-4 h-[620px] max-h-[80vh]"
      >
        {pixelAffiliateId && (
          <div className="flex h-full min-h-0 flex-col gap-4">
            {/* ── Tab bar ────────────────────────────────── */}
            <div className="flex gap-1 rounded-lg bg-[--color-bg-muted] p-1 shrink-0">
              {(
                [
                  { key: "pixel", label: "Sold Pixel" },
                  { key: "pixel_criteria", label: "Pixel Criteria" },
                  { key: "sold_criteria", label: "Sold Criteria" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setPixelConfigTab(tab.key)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    pixelConfigTab === tab.key
                      ? "bg-[--color-panel] text-[--color-text] shadow-sm"
                      : "text-[--color-text-muted] hover:text-[--color-text]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── Sold Pixel tab ─────────────────────────── */}
            {pixelConfigTab === "pixel" && (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                  <div className="space-y-3">
                    <div className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                            Enable Pixel
                          </p>
                          <p className="mt-0.5 text-[11px] text-[--color-text-muted]">
                            Fires only when this affiliate's lead is sold.
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={pixelDraft.enabled}
                          onClick={() =>
                            setPixelDraft((prev) => ({
                              ...prev,
                              enabled: !prev.enabled,
                            }))
                          }
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                            pixelDraft.enabled
                              ? "bg-[--color-primary]"
                              : "bg-[--color-border]"
                          }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-[--color-bg] transition ${
                              pixelDraft.enabled
                                ? "translate-x-5"
                                : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-1">
                        <span className="text-xs font-medium text-[--color-text-muted]">
                          Method
                        </span>
                        <select
                          className={inputClass}
                          value={pixelDraft.method}
                          onChange={(e) =>
                            setPixelDraft((prev) => ({
                              ...prev,
                              method: e.target
                                .value as AffiliateSoldPixelConfig["method"],
                            }))
                          }
                        >
                          {(["POST", "GET", "PUT", "PATCH"] as const).map(
                            (m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                      <label className="space-y-1 md:col-span-1">
                        <span className="text-xs font-medium text-[--color-text-muted]">
                          Pixel URL <span className="text-red-500">*</span>
                        </span>
                        <input
                          className={`${inputClass} ${
                            pixelInvalidUrl
                              ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/25"
                              : ""
                          }`}
                          value={pixelDraft.url}
                          onChange={(e) =>
                            setPixelDraft((prev) => ({
                              ...prev,
                              url: e.target.value,
                            }))
                          }
                          placeholder="https://affiliate.example.com/pixel"
                        />
                      </label>
                    </div>

                    <p className="text-xs text-[--color-text-muted]">
                      Choose query/body destination per mapping row below.
                    </p>

                    <div
                      className={`space-y-2 rounded-lg border p-3 ${
                        pixelInvalidMappings
                          ? "border-red-500/60"
                          : "border-[--color-border]"
                      }`}
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                        Payload Mapping <span className="text-red-500">*</span>
                      </p>

                      {criteriaFields.length > 0 &&
                        (() => {
                          const alreadyMapped = new Set(
                            pixelDraft.payload_mapping
                              .map((m) => m.field_name)
                              .filter(Boolean),
                          );
                          const unmappedCount = criteriaFields.filter(
                            (cf) => !alreadyMapped.has(cf.field_name),
                          ).length;
                          if (unmappedCount === 0) return null;
                          return (
                            <div className="flex items-center justify-between rounded-lg border border-[--color-border] bg-[--color-bg-muted] px-3 py-2.5">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-[--color-text-strong]">
                                  Import from criteria fields
                                </p>
                                <p className="mt-0.5 text-[11px] text-[--color-text-muted]">
                                  Add all {unmappedCount} unmapped field
                                  {unmappedCount !== 1 ? "s" : ""} at once.
                                </p>
                              </div>
                              <button
                                type="button"
                                className="ml-3 shrink-0 rounded-md border border-[--color-border] bg-[--color-panel] px-3 py-1.5 text-xs font-semibold text-[--color-text] hover:border-[--color-primary] hover:text-[--color-primary] transition-colors"
                                onClick={() =>
                                  setPixelDraft((prev) => {
                                    const mapped = new Set(
                                      prev.payload_mapping
                                        .map((m) => m.field_name)
                                        .filter(Boolean),
                                    );
                                    const toAdd = criteriaFields
                                      .filter(
                                        (cf) => !mapped.has(cf.field_name),
                                      )
                                      .map((cf) => ({
                                        key: cf.field_name,
                                        value_source: "field" as const,
                                        field_name: cf.field_name,
                                      }));
                                    if (toAdd.length === 0) return prev;
                                    const hasOnlyEmptyPlaceholder =
                                      prev.payload_mapping.length === 1 &&
                                      !prev.payload_mapping[0].key &&
                                      !prev.payload_mapping[0].field_name;
                                    return {
                                      ...prev,
                                      payload_mapping: hasOnlyEmptyPlaceholder
                                        ? toAdd
                                        : [...prev.payload_mapping, ...toAdd],
                                    };
                                  })
                                }
                              >
                                Add All
                              </button>
                            </div>
                          );
                        })()}

                      <div className="space-y-2">
                        <AnimatePresence initial={false}>
                          {pixelDraft.payload_mapping.map((row, idx) => (
                            <motion.div
                              key={`pixel-map-${idx}`}
                              layout
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -6 }}
                              transition={{ duration: 0.18 }}
                              className="grid gap-2 md:grid-cols-[minmax(0,1fr)_140px_minmax(0,1fr)_120px_auto]"
                            >
                              <input
                                className={inputClass}
                                placeholder="Outbound key"
                                value={row.key}
                                onChange={(e) =>
                                  setPixelDraft((prev) => ({
                                    ...prev,
                                    payload_mapping: prev.payload_mapping.map(
                                      (m, i) =>
                                        i === idx
                                          ? { ...m, key: e.target.value }
                                          : m,
                                    ),
                                  }))
                                }
                              />
                              <select
                                className={inputClass}
                                value={row.value_source}
                                onChange={(e) => {
                                  const valueSource = e.target
                                    .value as AffiliateSoldPixelConfig["payload_mapping"][number]["value_source"];
                                  setPixelDraft((prev) => ({
                                    ...prev,
                                    payload_mapping: prev.payload_mapping.map(
                                      (m, i) =>
                                        i === idx
                                          ? {
                                              ...m,
                                              value_source: valueSource,
                                              field_name:
                                                valueSource === "field"
                                                  ? (m.field_name ?? "")
                                                  : undefined,
                                              static_value:
                                                valueSource === "static"
                                                  ? (m.static_value ?? "")
                                                  : undefined,
                                            }
                                          : m,
                                    ),
                                  }));
                                }}
                              >
                                <option value="field">Lead Field</option>
                                <option value="static">Static Value</option>
                              </select>
                              {row.value_source === "field" ? (
                                <select
                                  className={inputClass}
                                  value={row.field_name ?? ""}
                                  onChange={(e) =>
                                    setPixelDraft((prev) => ({
                                      ...prev,
                                      payload_mapping: prev.payload_mapping.map(
                                        (m, i) =>
                                          i === idx
                                            ? {
                                                ...m,
                                                field_name: e.target.value,
                                              }
                                            : m,
                                      ),
                                    }))
                                  }
                                >
                                  <option value="">
                                    {criteriaFields.length === 0
                                      ? "No fields defined"
                                      : "Select lead field…"}
                                  </option>
                                  {criteriaFields.map((cf) => (
                                    <option key={cf.id} value={cf.field_name}>
                                      {cf.field_label}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  className={inputClass}
                                  placeholder="static_value"
                                  value={String(row.static_value ?? "")}
                                  onChange={(e) =>
                                    setPixelDraft((prev) => ({
                                      ...prev,
                                      payload_mapping: prev.payload_mapping.map(
                                        (m, i) =>
                                          i === idx
                                            ? {
                                                ...m,
                                                static_value: e.target.value,
                                              }
                                            : m,
                                      ),
                                    }))
                                  }
                                />
                              )}
                              <select
                                className={`${inputClass} ${
                                  pixelSaveAttempted &&
                                  row.parameter_target !== "query" &&
                                  row.parameter_target !== "body"
                                    ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/25"
                                    : ""
                                }`}
                                value={row.parameter_target ?? ""}
                                onChange={(e) =>
                                  setPixelDraft((prev) => ({
                                    ...prev,
                                    payload_mapping: prev.payload_mapping.map(
                                      (m, i) =>
                                        i === idx
                                          ? {
                                              ...m,
                                              parameter_target: e.target
                                                .value as "query" | "body",
                                            }
                                          : m,
                                    ),
                                  }))
                                }
                              >
                                <option value="">Target…</option>
                                <option value="query">Query</option>
                                <option value="body">Body</option>
                              </select>
                              <button
                                type="button"
                                className="flex items-center justify-center rounded p-1.5 text-[--color-text-muted] hover:text-red-500 disabled:opacity-30 transition-colors"
                                onClick={() =>
                                  setPixelDraft((prev) => ({
                                    ...prev,
                                    payload_mapping:
                                      prev.payload_mapping.filter(
                                        (_, i) => i !== idx,
                                      ),
                                  }))
                                }
                                disabled={
                                  pixelDraft.payload_mapping.length <= 1
                                }
                                title="Remove row"
                              >
                                <Trash2 size={14} />
                              </button>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>

                      <button
                        type="button"
                        className="mt-1 flex items-center gap-1 text-xs text-[--color-primary] hover:underline"
                        onClick={() =>
                          setPixelDraft((prev) => ({
                            ...prev,
                            payload_mapping: [
                              ...prev.payload_mapping,
                              {
                                key: "",
                                value_source: "field",
                                field_name: "",
                              },
                            ],
                          }))
                        }
                      >
                        <Plus size={12} />
                        Add mapping
                      </button>
                    </div>

                    {(() => {
                      const sampleValueFor = (
                        field: CriteriaField | undefined,
                      ): string => {
                        if (!field) return "";
                        const lbl = field.field_label.toLowerCase();
                        if (lbl.includes("email")) return "john@example.com";
                        if (lbl.includes("phone")) return "+1 (555) 867-5309";
                        if (lbl.includes("first") && lbl.includes("name"))
                          return "John";
                        if (lbl.includes("last") && lbl.includes("name"))
                          return "Doe";
                        if (lbl.includes("name")) return "John Doe";
                        if (lbl.includes("zip") || lbl.includes("postal"))
                          return "90210";
                        if (lbl.includes("city")) return "Los Angeles";
                        if (
                          lbl.includes("ip") ||
                          field.field_name.toLowerCase().includes("ip")
                        )
                          return "203.0.113.42";
                        if (lbl.includes("address")) return "123 Main St";
                        if (lbl.includes("dob") || lbl.includes("birth"))
                          return "1990-06-15";
                        switch (field.data_type) {
                          case "US State":
                            return "CA";
                          case "Number":
                            return "30";
                          case "Boolean":
                            return "true";
                          case "Date":
                            return "2026-01-15";
                          case "List":
                            return field.options?.[0]?.value ?? "option1";
                          default:
                            return "Sample value";
                        }
                      };

                      const previewEntries = pixelDraft.payload_mapping
                        .filter((m) => m.key.trim())
                        .map((m) => {
                          if (m.value_source === "static") {
                            return {
                              key: m.key.trim(),
                              value: String(m.static_value ?? ""),
                              target: m.parameter_target,
                            };
                          }
                          const cf = criteriaFields.find(
                            (f) => f.field_name === m.field_name,
                          );
                          return {
                            key: m.key.trim(),
                            value: cf ? sampleValueFor(cf) : "…",
                            target: m.parameter_target,
                          };
                        });

                      if (previewEntries.length === 0) return null;

                      const queryEntries = previewEntries.filter(
                        (entry) => entry.target === "query",
                      );
                      const bodyEntries = previewEntries.filter(
                        (entry) => entry.target === "body",
                      );
                      const hasQuery = queryEntries.length > 0;
                      const hasBody = bodyEntries.length > 0;

                      if (!hasQuery && !hasBody) return null;

                      const baseUrl =
                        pixelDraft.url.trim() ||
                        "https://affiliate.example.com/pixel";
                      const queryPreviewUrl = (() => {
                        try {
                          const url = new URL(baseUrl);
                          for (const entry of queryEntries) {
                            url.searchParams.set(entry.key, entry.value);
                          }
                          return url.toString();
                        } catch {
                          const query = queryEntries
                            .map(
                              (entry) =>
                                `${encodeURIComponent(entry.key)}=${encodeURIComponent(entry.value)}`,
                            )
                            .join("&");
                          return query ? `${baseUrl}?${query}` : baseUrl;
                        }
                      })();

                      const bodyLines = [
                        "{",
                        ...bodyEntries.map(
                          (e, i) =>
                            `  "${e.key}": "${e.value}"${i < bodyEntries.length - 1 ? "," : ""}`,
                        ),
                        "}",
                      ];

                      return (
                        <div className="space-y-2 rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-3">
                          {hasQuery && (
                            <details
                              className="rounded-md border border-[--color-border] bg-[--color-panel]"
                              open
                            >
                              <summary className="cursor-pointer px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
                                Expected URL with Query Params
                              </summary>
                              <div className="border-t border-[--color-border] p-3">
                                <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[--color-text]">
                                  {queryPreviewUrl}
                                </pre>
                              </div>
                            </details>
                          )}

                          {hasBody && (
                            <details
                              className="rounded-md border border-[--color-border] bg-[--color-panel]"
                              open={!hasQuery}
                            >
                              <summary className="cursor-pointer px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
                                Expected Payload Preview
                              </summary>
                              <div className="border-t border-[--color-border] p-3">
                                <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[--color-text]">
                                  {bodyLines.join("\n")}
                                </pre>
                              </div>
                            </details>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-[--color-border] pt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPixelSaveAttempted(false);
                      setPixelAffiliateId(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <div className="inline-flex">
                    <DisabledTooltip message={pixelFinalSaveDisabledReason}>
                      <Button
                        size="sm"
                        disabled={
                          savingPixelConfig ||
                          Boolean(pixelFinalSaveDisabledReason)
                        }
                        onClick={async () => {
                          setPixelSaveAttempted(true);
                          const trimmedUrl = pixelDraft.url.trim();
                          if (!trimmedUrl) {
                            toast.warning("Pixel URL is required.");
                            return;
                          }
                          try {
                            // eslint-disable-next-line no-new
                            new URL(trimmedUrl);
                          } catch {
                            toast.warning("Enter a valid pixel URL.");
                            return;
                          }

                          if (pixelDraft.payload_mapping.length === 0) {
                            toast.warning(
                              "At least one payload mapping is required.",
                            );
                            return;
                          }

                          const hasBadMapping = pixelDraft.payload_mapping.some(
                            (m) =>
                              !m.key.trim() ||
                              (m.parameter_target !== "query" &&
                                m.parameter_target !== "body") ||
                              (m.value_source === "field"
                                ? !(m.field_name ?? "").trim()
                                : String(m.static_value ?? "").trim().length ===
                                  0),
                          );
                          if (hasBadMapping) {
                            toast.warning("Complete all payload mapping rows.");
                            return;
                          }

                          if (pixelSaveBlockedByEnabledConfig) {
                            toast.warning(
                              "Enabled pixels require URL and payload mappings.",
                            );
                            return;
                          }

                          setSavingPixelConfig(true);
                          try {
                            const payload: AffiliateSoldPixelConfig = {
                              ...pixelDraft,
                              url: trimmedUrl,
                              payload_mapping: pixelDraft.payload_mapping.map(
                                (m) =>
                                  m.value_source === "field"
                                    ? {
                                        key: m.key.trim(),
                                        value_source: "field",
                                        field_name: (m.field_name ?? "").trim(),
                                        parameter_target: m.parameter_target,
                                      }
                                    : {
                                        key: m.key.trim(),
                                        value_source: "static",
                                        static_value: m.static_value,
                                        parameter_target: m.parameter_target,
                                      },
                              ),
                            };

                            await onUpdateAffiliateSoldPixelConfig(
                              campaign.id,
                              pixelAffiliateId,
                              payload,
                            );

                            setLocalAffiliateLinks((prev) =>
                              prev.map((l) =>
                                l.affiliate_id === pixelAffiliateId
                                  ? { ...l, sold_pixel_config: payload }
                                  : l,
                              ),
                            );

                            setPixelAffiliateId(null);
                          } finally {
                            setSavingPixelConfig(false);
                          }
                        }}
                      >
                        Save Pixel Config
                      </Button>
                    </DisabledTooltip>
                  </div>
                </div>
              </>
            )}

            {/* ── Pixel Criteria tab ─────────────────────── */}
            {pixelConfigTab === "pixel_criteria" && (
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <div className="space-y-4">
                  <div className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-3">
                    <p className="text-[11px] text-[--color-text-muted]">
                      <span className="font-semibold text-[--color-text]">
                        Optional.
                      </span>{" "}
                      Pixel criteria rules determine whether the sold pixel
                      fires for this affiliate. If any rule fails, the pixel is
                      suppressed. When no rules are configured, the pixel always
                      fires (if enabled).
                    </p>
                  </div>

                  {pixelCriteriaLoading ? (
                    <p className="text-sm text-[--color-text-muted]">
                      Loading…
                    </p>
                  ) : pixelCriteriaRules.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[--color-border] py-10 text-center text-sm text-[--color-text-muted]">
                      No pixel criteria rules yet.{" "}
                      <button
                        type="button"
                        className="text-[--color-primary] hover:underline"
                        onClick={() => {
                          setPixelCriteriaEditingRule(null);
                          setPixelCriteriaBuilderOpen(true);
                        }}
                      >
                        Add one
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {pixelCriteriaRules.map((rule) => (
                        <div
                          key={rule.id}
                          className={`rounded-lg border p-3 transition-colors ${
                            rule.enabled !== false
                              ? "border-[--color-border] bg-[--color-bg]"
                              : "border-[--color-border] bg-[--color-bg-muted] opacity-60"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-[--color-text] truncate">
                                  {rule.name}
                                </span>
                                <span
                                  className={`rounded px-1.5 py-px text-[10px] font-semibold leading-tight ${
                                    rule.action === "pass"
                                      ? "bg-green-500/15 text-green-500"
                                      : "bg-red-500/15 text-red-400"
                                  }`}
                                >
                                  {rule.action}
                                </span>
                                {rule.enabled === false && (
                                  <span className="rounded px-1.5 py-px text-[10px] font-semibold leading-tight bg-yellow-500/15 text-yellow-500">
                                    disabled
                                  </span>
                                )}
                              </div>
                              <div className="mt-1.5 space-y-1">
                                {rule.groups.map((group, gIdx) => (
                                  <div
                                    key={`pc-${rule.id}-g${gIdx}`}
                                    className="rounded-md border border-[--color-border] bg-[--color-bg-muted] p-2"
                                  >
                                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
                                      Group {gIdx + 1}
                                    </p>
                                    {group.conditions.map((cond, cIdx) => (
                                      <p
                                        key={`pc-${rule.id}-g${gIdx}-c${cIdx}`}
                                        className="text-[11px] text-[--color-text]"
                                      >
                                        <span className="font-medium">
                                          {normalizeFieldLabel(cond.field_name)}
                                        </span>{" "}
                                        <span className="text-[--color-text-muted]">
                                          {formatLogicOperatorLabel(
                                            cond.operator,
                                          )}
                                        </span>{" "}
                                        <span className="font-mono text-[10px] text-[--color-text-muted]">
                                          {formatLogicConditionValue(
                                            cond.value,
                                          )}
                                        </span>
                                      </p>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                title={
                                  rule.enabled !== false ? "Disable" : "Enable"
                                }
                                onClick={() =>
                                  handleTogglePixelCriteriaRule(rule)
                                }
                                className="rounded p-1 text-[--color-text-muted] hover:text-[--color-primary] transition-colors"
                              >
                                {rule.enabled !== false ? (
                                  <Check size={14} />
                                ) : (
                                  <RotateCcw size={14} />
                                )}
                              </button>
                              <button
                                type="button"
                                title="Edit"
                                onClick={() => {
                                  setPixelCriteriaEditingRule(rule);
                                  setPixelCriteriaBuilderOpen(true);
                                }}
                                className="rounded p-1 text-[--color-text-muted] hover:text-[--color-primary] transition-colors"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                title="Delete"
                                disabled={
                                  pixelCriteriaDeletingRuleId === rule.id
                                }
                                onClick={() =>
                                  handleDeletePixelCriteriaRule(rule.id)
                                }
                                className="rounded p-1 text-[--color-text-muted] hover:text-red-500 transition-colors disabled:opacity-50"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!pixelCriteriaLoading && pixelCriteriaRules.length > 0 && (
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setPixelCriteriaEditingRule(null);
                          setPixelCriteriaBuilderOpen(true);
                        }}
                      >
                        <Plus size={14} className="mr-1" />
                        Add Rule
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Sold Criteria tab ──────────────────────── */}
            {pixelConfigTab === "sold_criteria" && (
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <div className="space-y-4">
                  <div className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-3">
                    <p className="text-[11px] text-[--color-text-muted]">
                      <span className="font-semibold text-[--color-text]">
                        Optional.
                      </span>{" "}
                      Sold criteria rules determine whether a delivered lead
                      counts as &quot;sold&quot; for this affiliate. If any rule
                      fails, the lead is marked as not sold and does not count
                      toward the lead cap. When no rules are configured, the
                      delivery result is used as-is.
                    </p>
                  </div>

                  {soldCriteriaLoading ? (
                    <p className="text-sm text-[--color-text-muted]">
                      Loading…
                    </p>
                  ) : soldCriteriaRules.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[--color-border] py-10 text-center text-sm text-[--color-text-muted]">
                      No sold criteria rules yet.{" "}
                      <button
                        type="button"
                        className="text-[--color-primary] hover:underline"
                        onClick={() => {
                          setSoldCriteriaEditingRule(null);
                          setSoldCriteriaBuilderOpen(true);
                        }}
                      >
                        Add one
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {soldCriteriaRules.map((rule) => (
                        <div
                          key={rule.id}
                          className={`rounded-lg border p-3 transition-colors ${
                            rule.enabled !== false
                              ? "border-[--color-border] bg-[--color-bg]"
                              : "border-[--color-border] bg-[--color-bg-muted] opacity-60"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-[--color-text] truncate">
                                  {rule.name}
                                </span>
                                <span
                                  className={`rounded px-1.5 py-px text-[10px] font-semibold leading-tight ${
                                    rule.action === "pass"
                                      ? "bg-green-500/15 text-green-500"
                                      : "bg-red-500/15 text-red-400"
                                  }`}
                                >
                                  {rule.action}
                                </span>
                                {rule.enabled === false && (
                                  <span className="rounded px-1.5 py-px text-[10px] font-semibold leading-tight bg-yellow-500/15 text-yellow-500">
                                    disabled
                                  </span>
                                )}
                              </div>
                              <div className="mt-1.5 space-y-1">
                                {rule.groups.map((group, gIdx) => (
                                  <div
                                    key={`sc-${rule.id}-g${gIdx}`}
                                    className="rounded-md border border-[--color-border] bg-[--color-bg-muted] p-2"
                                  >
                                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
                                      Group {gIdx + 1}
                                    </p>
                                    {group.conditions.map((cond, cIdx) => (
                                      <p
                                        key={`sc-${rule.id}-g${gIdx}-c${cIdx}`}
                                        className="text-[11px] text-[--color-text]"
                                      >
                                        <span className="font-medium">
                                          {normalizeFieldLabel(cond.field_name)}
                                        </span>{" "}
                                        <span className="text-[--color-text-muted]">
                                          {formatLogicOperatorLabel(
                                            cond.operator,
                                          )}
                                        </span>{" "}
                                        <span className="font-mono text-[10px] text-[--color-text-muted]">
                                          {formatLogicConditionValue(
                                            cond.value,
                                          )}
                                        </span>
                                      </p>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                title={
                                  rule.enabled !== false ? "Disable" : "Enable"
                                }
                                onClick={() =>
                                  handleToggleSoldCriteriaRule(rule)
                                }
                                className="rounded p-1 text-[--color-text-muted] hover:text-[--color-primary] transition-colors"
                              >
                                {rule.enabled !== false ? (
                                  <Check size={14} />
                                ) : (
                                  <RotateCcw size={14} />
                                )}
                              </button>
                              <button
                                type="button"
                                title="Edit"
                                onClick={() => {
                                  setSoldCriteriaEditingRule(rule);
                                  setSoldCriteriaBuilderOpen(true);
                                }}
                                className="rounded p-1 text-[--color-text-muted] hover:text-[--color-primary] transition-colors"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                title="Delete"
                                disabled={
                                  soldCriteriaDeletingRuleId === rule.id
                                }
                                onClick={() =>
                                  handleDeleteSoldCriteriaRule(rule.id)
                                }
                                className="rounded p-1 text-[--color-text-muted] hover:text-red-500 transition-colors disabled:opacity-50"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!soldCriteriaLoading && soldCriteriaRules.length > 0 && (
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSoldCriteriaEditingRule(null);
                          setSoldCriteriaBuilderOpen(true);
                        }}
                      >
                        <Plus size={14} className="mr-1" />
                        Add Rule
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Pixel criteria rule builder modal ────────────────────────────── */}
      <LogicBuilderModal
        isOpen={pixelCriteriaBuilderOpen}
        onClose={() => {
          setPixelCriteriaBuilderOpen(false);
          setPixelCriteriaEditingRule(null);
        }}
        onSave={handleSavePixelCriteriaRule}
        rule={pixelCriteriaEditingRule}
        criteriaFields={criteriaFields}
        saving={pixelCriteriaSaving}
      />

      {/* ── Sold criteria rule builder modal ─────────────────────────────── */}
      <LogicBuilderModal
        isOpen={soldCriteriaBuilderOpen}
        onClose={() => {
          setSoldCriteriaBuilderOpen(false);
          setSoldCriteriaEditingRule(null);
        }}
        onSave={handleSaveSoldCriteriaRule}
        rule={soldCriteriaEditingRule}
        criteriaFields={criteriaFields}
        saving={soldCriteriaSaving}
      />

      <LinkClientModal
        isOpen={linkClientModalOpen}
        onClose={() => setLinkClientModalOpen(false)}
        clients={availableClients}
        onSubmit={async (clientId) => {
          await onLinkClient(campaign.id, clientId);
          setLocalClientLinks((prev) =>
            prev.some((l) => l.client_id === clientId)
              ? prev
              : [
                  ...prev,
                  {
                    client_id: clientId,
                    status: "TEST" as CampaignParticipantStatus,
                  },
                ],
          );
          setLinkClientModalOpen(false);
        }}
      />

      <LinkAffiliateModal
        isOpen={linkAffiliateModalOpen}
        onClose={() => setLinkAffiliateModalOpen(false)}
        affiliates={availableAffiliates}
        onSubmit={async (affiliateId) => {
          await onLinkAffiliate(campaign.id, affiliateId);
          setLocalAffiliateLinks((prev) =>
            prev.some((l) => l.affiliate_id === affiliateId)
              ? prev
              : [
                  ...prev,
                  {
                    affiliate_id: affiliateId,
                    campaign_key: "",
                    status: "TEST" as CampaignParticipantStatus,
                  },
                ],
          );
          setLinkAffiliateModalOpen(false);
        }}
      />

      {/* ── Title edit mini-modal ────────────────────────────────────────── */}
      <AnimatePresence>
        {titleEditing && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-start justify-center pt-20 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => {
              setNameDraft(campaign.name);
              setStatusDraft(campaign.status);
              setTitleEditing(false);
            }}
          >
            <motion.div
              className="panel w-full max-w-sm shadow-2xl ring-1 ring-black/10"
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[--color-border] px-4 py-3">
                <p className="text-sm font-semibold text-[--color-text-strong]">
                  Edit Campaign
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setNameDraft(campaign.name);
                    setStatusDraft(campaign.status);
                    setTitleEditing(false);
                  }}
                  className="rounded p-1 text-[--color-text-muted] hover:text-[--color-danger] transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="px-4 py-4 space-y-3 text-sm">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                    Campaign Name
                  </p>
                  <input
                    className={inputClass}
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setNameDraft(campaign.name);
                        setStatusDraft(campaign.status);
                        setTitleEditing(false);
                      }
                      if (e.key === "Enter") saveTitleEdit();
                    }}
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                    Status
                  </p>
                  <select
                    className={inputClass}
                    value={statusDraft}
                    onChange={(e) =>
                      setStatusDraft(e.target.value as Campaign["status"])
                    }
                  >
                    {(
                      [
                        "DRAFT",
                        "TEST",
                        "ACTIVE",
                        "INACTIVE",
                      ] as Campaign["status"][]
                    ).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setNameDraft(campaign.name);
                      setStatusDraft(campaign.status);
                      setTitleEditing(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={savingTitle}
                    onClick={saveTitleEdit}
                  >
                    {savingTitle ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
