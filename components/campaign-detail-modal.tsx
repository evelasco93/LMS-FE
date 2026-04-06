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
import { OverviewTab } from "@/components/campaign-detail/overview-tab";
import { HistoryTab } from "@/components/campaign-detail/history-tab";
import { ClientsTab } from "@/components/campaign-detail/clients-tab";
import { AffiliatesTab } from "@/components/campaign-detail/affiliates-tab";
import { IntegrationsTab } from "@/components/campaign-detail/integrations-tab";
import SettingsTab from "@/components/campaign-detail/settings-tab";
import { SettingsMiniModals } from "@/components/campaign-detail/settings-mini-modals";
import { LogicCatalogModals } from "@/components/campaign-detail/logic-catalog-modals";
import { CriteriaCatalogModal } from "@/components/campaign-detail/criteria-catalog-modal";
import { CriteriaFieldModals } from "@/components/campaign-detail/criteria-field-modals";
import { ParticipantModals } from "@/components/campaign-detail/participant-modals";
import { ClientDeliveryModal } from "@/components/campaign-detail/client-delivery-modal";
import { AffiliateConfigModals } from "@/components/campaign-detail/affiliate-config-modals";
import {
  useRoutingState,
  usePixelSoldCriteriaState,
  useParticipantLogicState,
  useCriteriaCatalogState,
  useLogicCatalogState,
} from "@/components/campaign-detail/hooks";

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
  onNestedModalChange,
  initialModal,
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
  onNestedModalChange?: (params: {
    window?: string;
    window_id?: string;
    window_tab?: string;
  }) => void;
  initialModal?: {
    window?: string;
    window_id?: string;
    window_tab?: string;
  };
}) {
  // ── Settings sub-tab ─────────────────────────────────────────────────────
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

  // ── Grouped state hooks ──────────────────────────────────────────────────
  const routing = useRoutingState();
  const {
    routingMode,
    setRoutingMode,
    routingEnabled,
    setRoutingEnabled,
    routingWeights,
    setRoutingWeights,
    savingRouting,
    setSavingRouting,
    confirmModeChange,
    setConfirmModeChange,
  } = routing;

  const pixelSoldCriteria = usePixelSoldCriteriaState();
  const {
    pixelCriteriaAffiliateId,
    setPixelCriteriaAffiliateId,
    pixelCriteriaRules,
    setPixelCriteriaRules,
    pixelCriteriaLoading,
    setPixelCriteriaLoading,
    pixelCriteriaSaving,
    setPixelCriteriaSaving,
    pixelCriteriaBuilderOpen,
    setPixelCriteriaBuilderOpen,
    pixelCriteriaEditingRule,
    setPixelCriteriaEditingRule,
    pixelCriteriaDeletingRuleId,
    setPixelCriteriaDeletingRuleId,
    soldCriteriaAffiliateId,
    setSoldCriteriaAffiliateId,
    soldCriteriaRules,
    setSoldCriteriaRules,
    soldCriteriaLoading,
    setSoldCriteriaLoading,
    soldCriteriaSaving,
    setSoldCriteriaSaving,
    soldCriteriaBuilderOpen,
    setSoldCriteriaBuilderOpen,
    soldCriteriaEditingRule,
    setSoldCriteriaEditingRule,
    soldCriteriaDeletingRuleId,
    setSoldCriteriaDeletingRuleId,
  } = pixelSoldCriteria;

  const participantLogic = useParticipantLogicState();
  const {
    participantLogicType,
    setParticipantLogicType,
    participantLogicRules,
    setParticipantLogicRules,
    participantLogicLoading,
    setParticipantLogicLoading,
    participantLogicSaving,
    setParticipantLogicSaving,
    participantLogicBuilderOpen,
    setParticipantLogicBuilderOpen,
    participantLogicEditingRule,
    setParticipantLogicEditingRule,
    participantLogicSetId,
    setParticipantLogicSetId,
    participantLogicSetVersion,
    setParticipantLogicSetVersion,
    participantLogicSetName,
    setParticipantLogicSetName,
    participantLogicBaseSetId,
    setParticipantLogicBaseSetId,
    participantLogicBaseSetVersion,
    setParticipantLogicBaseSetVersion,
    participantLogicBaseSetName,
    setParticipantLogicBaseSetName,
    participantLogicDeletingRuleId,
    setParticipantLogicDeletingRuleId,
    participantLogicCatalogOpen,
    setParticipantLogicCatalogOpen,
    participantLogicCatalogLoading,
    setParticipantLogicCatalogLoading,
    participantLogicCatalogSets,
    setParticipantLogicCatalogSets,
    participantLogicApplyingCatalogId,
    setParticipantLogicApplyingCatalogId,
    participantExpandedSetId,
    setParticipantExpandedSetId,
    participantSetVersionsMap,
    setParticipantSetVersionsMap,
    participantLoadingVersionsFor,
    setParticipantLoadingVersionsFor,
    participantExpandedVersionRules,
    setParticipantExpandedVersionRules,
    participantExpandedRuleDetails,
    setParticipantExpandedRuleDetails,
    saveParticipantLogicOpen,
    setSaveParticipantLogicOpen,
    saveParticipantLogicMode,
    setSaveParticipantLogicMode,
    saveParticipantLogicDraft,
    setSaveParticipantLogicDraft,
    savingParticipantLogicToCatalog,
    setSavingParticipantLogicToCatalog,
    syncingClientLogicToCampaign,
    setSyncingClientLogicToCampaign,
    pinnedBaseLogicViewerOpen,
    setPinnedBaseLogicViewerOpen,
    pinnedBaseExpandedRules,
    setPinnedBaseExpandedRules,
  } = participantLogic;

  const criteriaCatalog = useCriteriaCatalogState(campaign);
  const {
    catalogOpen,
    setCatalogOpen,
    catalogLoading,
    setCatalogLoading,
    catalogSets,
    setCatalogSets,
    expandedSetId,
    setExpandedSetId,
    setVersionsMap,
    setSetVersionsMap,
    loadingVersionsFor,
    setLoadingVersionsFor,
    applyingCatalog,
    setApplyingCatalog,
    catalogFormMode,
    setCatalogFormMode,
    editingCatalogSet,
    setEditingCatalogSet,
    catalogFormDraft,
    setCatalogFormDraft,
    catalogFieldDrafts,
    setCatalogFieldDrafts,
    savingCatalog,
    setSavingCatalog,
    catalogBulkImportOpen,
    setCatalogBulkImportOpen,
    catalogBulkImportText,
    setCatalogBulkImportText,
    campaignBulkImportOpen,
    setCampaignBulkImportOpen,
    campaignBulkImportText,
    setCampaignBulkImportText,
    campaignBulkImporting,
    setCampaignBulkImporting,
    confirmDeleteSet,
    setConfirmDeleteSet,
    deletingSet,
    setDeletingSet,
    expandedVersionFields,
    setExpandedVersionFields,
    localCriteriaSetId,
    setLocalCriteriaSetId,
    localCriteriaSetVersion,
    setLocalCriteriaSetVersion,
    localCriteriaSetName,
    setLocalCriteriaSetName,
    saveCriteriaToSetOpen,
    setSaveCriteriaToSetOpen,
    saveCriteriaToSetMode,
    setSaveCriteriaToSetMode,
    saveCriteriaToSetDraft,
    setSaveCriteriaToSetDraft,
    savingCriteriaToSet,
    setSavingCriteriaToSet,
    addFieldOpen,
    setAddFieldOpen,
    editFieldData,
    setEditFieldData,
    listMappingsField,
    setListMappingsField,
    listMappingsDraft,
    setListMappingsDraft,
    listMappingsSaving,
    setListMappingsSaving,
    valueMappingsField,
    setValueMappingsField,
    valueMappingsDraft,
    setValueMappingsDraft,
    valueMappingsStateDraft,
    setValueMappingsStateDraft,
    valueMappingsSaving,
    setValueMappingsSaving,
    optionsTab,
    setOptionsTab,
    optionsBulkText,
    setOptionsBulkText,
    deleteFieldTarget,
    setDeleteFieldTarget,
    deletingField,
    setDeletingField,
    emptyFieldDraft,
    fieldDraft,
    setFieldDraft,
    fieldSaving,
    setFieldSaving,
  } = criteriaCatalog;

  const logicCatalog = useLogicCatalogState(campaign, isOpen);
  const {
    logicCatalogOpen,
    setLogicCatalogOpen,
    logicCatalogLoading,
    setLogicCatalogLoading,
    logicCatalogSets,
    setLogicCatalogSets,
    expandedLogicSetId,
    setExpandedLogicSetId,
    logicSetVersionsMap,
    setLogicSetVersionsMap,
    loadingLogicVersionsFor,
    setLoadingLogicVersionsFor,
    applyingLogicCatalog,
    setApplyingLogicCatalog,
    expandedLogicVersionRules,
    setExpandedLogicVersionRules,
    expandedLogicRuleDetails,
    setExpandedLogicRuleDetails,
    saveLogicToSetOpen,
    setSaveLogicToSetOpen,
    saveLogicToSetMode,
    setSaveLogicToSetMode,
    saveLogicToSetDraft,
    setSaveLogicToSetDraft,
    savingLogicToSet,
    setSavingLogicToSet,
    editTagsOpen,
    setEditTagsOpen,
    tagDefinitions,
    setTagDefinitions,
    tagDraft,
    setTagDraft,
    savingTags,
    setSavingTags,
    localLogicSetId,
    setLocalLogicSetId,
    localLogicSetVersion,
    setLocalLogicSetVersion,
    localLogicSetName,
    setLocalLogicSetName,
    logicBuilderOpen,
    setLogicBuilderOpen,
    editingRule,
    setEditingRule,
    savingRule,
    setSavingRule,
    deletingRuleId,
    setDeletingRuleId,
  } = logicCatalog;

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
  // ── Criteria Catalog states ──────────────────────────────────────────────
  // ── Logic Catalog states ─────────────────────────────────────────────────
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

  // ── Sync nested modal state → URL ────────────────────────────────────────
  useEffect(() => {
    if (!onNestedModalChange || !isOpen) return;

    let nestedWindow: string | undefined;
    let window_id: string | undefined;
    let window_tab: string | undefined;

    if (pixelAffiliateId) {
      nestedWindow = "fire-pixel";
      window_id = pixelAffiliateId;
      window_tab = pixelConfigTab;
    } else if (deliveryClientId) {
      nestedWindow = "delivery";
      window_id = deliveryClientId;
      window_tab = deliveryTab;
    } else if (affiliateCapModalId) {
      nestedWindow = "lead-cap";
      window_id = affiliateCapModalId;
    } else if (linkClientModalOpen) {
      nestedWindow = "link-client";
    } else if (linkAffiliateModalOpen) {
      nestedWindow = "link-affiliate";
    } else if (catalogOpen) {
      nestedWindow = "criteria-catalog";
    } else if (logicCatalogOpen) {
      nestedWindow = "logic-catalog";
    } else if (logicBuilderOpen) {
      nestedWindow = "logic-builder";
    } else if (addFieldOpen) {
      nestedWindow = "add-field";
    }

    onNestedModalChange({ window: nestedWindow, window_id, window_tab });
  }, [
    isOpen,
    pixelAffiliateId,
    pixelConfigTab,
    deliveryClientId,
    deliveryTab,
    affiliateCapModalId,
    linkClientModalOpen,
    linkAffiliateModalOpen,
    catalogOpen,
    logicCatalogOpen,
    logicBuilderOpen,
    addFieldOpen,
    onNestedModalChange,
  ]);

  // ── Restore nested window from URL on mount ───────────────────────────────
  const initialModalAppliedRef = useRef(false);
  useEffect(() => {
    if (
      !initialModal?.window ||
      !isOpen ||
      !campaign ||
      initialModalAppliedRef.current
    )
      return;
    initialModalAppliedRef.current = true;

    const { window: m, window_id: id, window_tab: mt } = initialModal;
    switch (m) {
      case "fire-pixel":
        if (id) {
          setPixelAffiliateId(id);
          if (mt === "pixel_criteria" || mt === "sold_criteria")
            setPixelConfigTab(mt);
        }
        break;
      case "delivery":
        if (id) setDeliveryClientId(id);
        break;
      case "lead-cap":
        if (id) setAffiliateCapModalId(id);
        break;
      case "link-client":
        setLinkClientModalOpen(true);
        break;
      case "link-affiliate":
        setLinkAffiliateModalOpen(true);
        break;
      case "criteria-catalog":
        setCatalogOpen(true);
        break;
      case "logic-catalog":
        setLogicCatalogOpen(true);
        break;
      case "logic-builder":
        setLogicBuilderOpen(true);
        break;
      case "add-field":
        setAddFieldOpen(true);
        break;
    }
  }, [initialModal, isOpen, campaign]); // eslint-disable-line react-hooks/exhaustive-deps

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
                    data-tour={`campaign-tab-${item.key}`}
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
                    <OverviewTab
                      campaign={campaign}
                      leadsForCampaign={leadsForCampaign}
                      linkedClientsCount={linkedClients.length}
                      linkedAffiliatesCount={linkedAffiliates.length}
                      criteriaFields={criteriaFields}
                      logicRules={logicRules}
                      onTabChange={onTabChange}
                      onOpenLeadsForCampaign={onOpenLeadsForCampaign}
                      setSettingsSubTab={setSettingsSubTab}
                    />
                  )}
                  {tab === "clients" && (
                    <ClientsTab
                      campaign={campaign}
                      clients={clients}
                      linkedClients={linkedClients}
                      clientLinkMap={clientLinkMap}
                      availableClients={availableClients}
                      logicRules={logicRules}
                      getClientLeadMode={getClientLeadMode}
                      getClientLeadCount={getClientLeadCount}
                      resolveChangedBy={resolveChangedBy}
                      onOpenLeadsForCampaign={onOpenLeadsForCampaign}
                      openClientLogicManager={openClientLogicManager}
                      setDeliveryDraft={setDeliveryDraft}
                      setDeliveryTab={setDeliveryTab}
                      setDeliveryClientId={setDeliveryClientId}
                      setLinkClientModalOpen={setLinkClientModalOpen}
                      setParticipantAction={setParticipantAction}
                      onNavigateToSettings={(sub) =>
                        onTabChange("settings", sub)
                      }
                    />
                  )}

                  {tab === "affiliates" && (
                    <AffiliatesTab
                      campaign={campaign}
                      affiliates={affiliates}
                      linkedAffiliates={linkedAffiliates}
                      affiliateLinkMap={affiliateLinkMap}
                      availableAffiliates={availableAffiliates}
                      logicRules={logicRules}
                      focusAffiliateId={focusAffiliateId}
                      leadsByCampaignKey={leadsByCampaignKey}
                      liveLeadsByCampaignKey={liveLeadsByCampaignKey}
                      resolveChangedBy={resolveChangedBy}
                      onOpenLeadsForCampaign={onOpenLeadsForCampaign}
                      openAffiliateLogicManager={openAffiliateLogicManager}
                      setLinkAffiliateModalOpen={setLinkAffiliateModalOpen}
                      setParticipantAction={setParticipantAction}
                      setAffiliateCapModalId={setAffiliateCapModalId}
                      setPixelDraft={setPixelDraft}
                      setPixelSaveAttempted={setPixelSaveAttempted}
                      setPixelConfigTab={setPixelConfigTab}
                      setPixelAffiliateId={setPixelAffiliateId}
                      onNavigateToSettings={(sub) =>
                        onTabChange("settings", sub)
                      }
                    />
                  )}

                  {tab === "integrations" && (
                    <IntegrationsTab
                      campaign={campaign}
                      globallyDisabled={{
                        dupCheck: dupCheckGloballyDisabled,
                        trustedForm: trustedFormGloballyDisabled,
                        ipqs: ipqsGloballyDisabled,
                      }}
                      onUpdatePlugins={onUpdatePlugins}
                      resolveChangedBy={resolveChangedBy}
                    />
                  )}

                  {tab === "settings" && (
                    <SettingsTab
                      campaign={campaign}
                      settingsSubTab={settingsSubTab}
                      handleSubTabChange={handleSubTabChange}
                      localCriteriaSetId={localCriteriaSetId}
                      localCriteriaSetName={localCriteriaSetName}
                      localCriteriaSetVersion={localCriteriaSetVersion}
                      catalogSets={catalogSets}
                      criteriaFields={criteriaFields}
                      criteriaLoading={criteriaLoading}
                      emptyFieldDraft={emptyFieldDraft}
                      campaignBulkImportOpen={campaignBulkImportOpen}
                      campaignBulkImportText={campaignBulkImportText}
                      campaignBulkImporting={campaignBulkImporting}
                      setSaveCriteriaToSetMode={setSaveCriteriaToSetMode}
                      setSaveCriteriaToSetDraft={setSaveCriteriaToSetDraft}
                      setSaveCriteriaToSetOpen={setSaveCriteriaToSetOpen}
                      openCriteriaCatalogModal={openCriteriaCatalogModal}
                      setCampaignBulkImportOpen={setCampaignBulkImportOpen}
                      setCampaignBulkImportText={setCampaignBulkImportText}
                      setCampaignBulkImporting={setCampaignBulkImporting}
                      setFieldDraft={setFieldDraft}
                      setEditFieldData={setEditFieldData}
                      setAddFieldOpen={setAddFieldOpen}
                      setDeleteFieldTarget={setDeleteFieldTarget}
                      setValueMappingsField={setValueMappingsField}
                      setValueMappingsDraft={setValueMappingsDraft}
                      setValueMappingsStateDraft={setValueMappingsStateDraft}
                      refreshCriteria={refreshCriteria}
                      localLogicSetId={localLogicSetId}
                      localLogicSetName={localLogicSetName}
                      localLogicSetVersion={localLogicSetVersion}
                      logicRules={logicRules}
                      logicRulesLoading={logicRulesLoading}
                      deletingRuleId={deletingRuleId}
                      setSaveLogicToSetMode={setSaveLogicToSetMode}
                      setSaveLogicToSetDraft={setSaveLogicToSetDraft}
                      setSaveLogicToSetOpen={setSaveLogicToSetOpen}
                      openLogicCatalogModal={openLogicCatalogModal}
                      setEditingRule={setEditingRule}
                      setLogicBuilderOpen={setLogicBuilderOpen}
                      handleToggleLogicRule={handleToggleLogicRule}
                      handleDeleteLogicRule={handleDeleteLogicRule}
                      routingMode={routingMode}
                      routingEnabled={routingEnabled}
                      routingWeights={routingWeights}
                      savingRouting={savingRouting}
                      linkedClients={linkedClients}
                      clientLinkMap={clientLinkMap}
                      setRoutingEnabled={setRoutingEnabled}
                      setRoutingWeights={setRoutingWeights}
                      setSavingRouting={setSavingRouting}
                      setConfirmModeChange={setConfirmModeChange}
                      onCampaignUpdate={onCampaignUpdate}
                      onUpdateCampaignDistribution={
                        onUpdateCampaignDistribution
                      }
                      onUpdateClientWeight={onUpdateClientWeight}
                      updateCampaign={updateCampaign}
                    />
                  )}

                  {/* ── History Tab ──────────────────────────────────── */}
                  {tab === "history" && (
                    <HistoryTab
                      campaignAuditData={campaignAuditData}
                      allCampaignAuditItems={allCampaignAuditItems}
                      clientNameById={clientNameById}
                      affiliateNameById={affiliateNameById}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Confirm distribution mode change ──────────────────────────── */}
      <SettingsMiniModals
        campaign={campaign}
        confirmModeChange={confirmModeChange}
        routingMode={routingMode}
        savingTags={savingTags}
        tagDefinitions={tagDefinitions}
        tagDraft={tagDraft}
        editTagsOpen={editTagsOpen}
        setConfirmModeChange={setConfirmModeChange}
        setEditTagsOpen={setEditTagsOpen}
        setRoutingMode={setRoutingMode}
        setTagDraft={setTagDraft}
        saveCampaignTagDraft={saveCampaignTagDraft}
        onUpdateCampaignDistribution={onUpdateCampaignDistribution}
      />

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
      <LogicCatalogModals
        campaign={campaign}
        logicRules={logicRules}
        logicCatalogOpen={logicCatalogOpen}
        logicCatalogLoading={logicCatalogLoading}
        logicCatalogSets={logicCatalogSets}
        expandedLogicSetId={expandedLogicSetId}
        logicSetVersionsMap={logicSetVersionsMap}
        loadingLogicVersionsFor={loadingLogicVersionsFor}
        applyingLogicCatalog={applyingLogicCatalog}
        expandedLogicVersionRules={expandedLogicVersionRules}
        expandedLogicRuleDetails={expandedLogicRuleDetails}
        localLogicSetId={localLogicSetId}
        localLogicSetName={localLogicSetName}
        localLogicSetVersion={localLogicSetVersion}
        saveLogicToSetOpen={saveLogicToSetOpen}
        saveLogicToSetMode={saveLogicToSetMode}
        saveLogicToSetDraft={saveLogicToSetDraft}
        savingLogicToSet={savingLogicToSet}
        setLogicCatalogOpen={setLogicCatalogOpen}
        setExpandedLogicSetId={setExpandedLogicSetId}
        setLogicSetVersionsMap={setLogicSetVersionsMap}
        setLoadingLogicVersionsFor={setLoadingLogicVersionsFor}
        setExpandedLogicVersionRules={setExpandedLogicVersionRules}
        setExpandedLogicRuleDetails={setExpandedLogicRuleDetails}
        setSaveLogicToSetOpen={setSaveLogicToSetOpen}
        setSaveLogicToSetMode={setSaveLogicToSetMode}
        setSaveLogicToSetDraft={setSaveLogicToSetDraft}
        applyLogicCatalogVersion={applyLogicCatalogVersion}
        saveCurrentLogicToCatalog={saveCurrentLogicToCatalog}
        openLogicCatalogModal={openLogicCatalogModal}
        getLogicCatalogSet={getLogicCatalogSet}
        normalizeFieldLabel={normalizeFieldLabel}
        formatLogicOperatorLabel={formatLogicOperatorLabel}
        formatLogicConditionValue={formatLogicConditionValue}
      />

      {/* ── Save campaign logic to catalog ──────────────────────────────── */}

      {/* ── Campaign tags modal ─────────────────────────────────────────── */}

      {/* ── Criteria Catalog modal ──────────────────────────────────────── */}
      <CriteriaCatalogModal
        campaign={campaign}
        criteriaFields={criteriaFields}
        catalogOpen={catalogOpen}
        catalogLoading={catalogLoading}
        catalogSets={catalogSets}
        catalogFormMode={catalogFormMode}
        editingCatalogSet={editingCatalogSet}
        catalogFormDraft={catalogFormDraft}
        catalogFieldDrafts={catalogFieldDrafts}
        savingCatalog={savingCatalog}
        expandedSetId={expandedSetId}
        setVersionsMap={setVersionsMap}
        loadingVersionsFor={loadingVersionsFor}
        applyingCatalog={applyingCatalog}
        expandedVersionFields={expandedVersionFields}
        catalogBulkImportOpen={catalogBulkImportOpen}
        catalogBulkImportText={catalogBulkImportText}
        localCriteriaSetId={localCriteriaSetId}
        localCriteriaSetName={localCriteriaSetName}
        localCriteriaSetVersion={localCriteriaSetVersion}
        setCatalogOpen={setCatalogOpen}
        setCatalogFormMode={setCatalogFormMode}
        setEditingCatalogSet={setEditingCatalogSet}
        setCatalogFormDraft={setCatalogFormDraft}
        setCatalogFieldDrafts={setCatalogFieldDrafts}
        setSavingCatalog={setSavingCatalog}
        setCatalogSets={setCatalogSets}
        setExpandedSetId={setExpandedSetId}
        setSetVersionsMap={setSetVersionsMap}
        setLoadingVersionsFor={setLoadingVersionsFor}
        setApplyingCatalog={setApplyingCatalog}
        setExpandedVersionFields={setExpandedVersionFields}
        setCatalogBulkImportOpen={setCatalogBulkImportOpen}
        setCatalogBulkImportText={setCatalogBulkImportText}
        setLocalCriteriaSetId={setLocalCriteriaSetId}
        setLocalCriteriaSetName={setLocalCriteriaSetName}
        setLocalCriteriaSetVersion={setLocalCriteriaSetVersion}
        setConfirmDeleteSet={setConfirmDeleteSet}
        applyCriteriaCatalog={applyCriteriaCatalog}
        refreshCriteria={refreshCriteria}
        getCriteriaCatalogSet={getCriteriaCatalogSet}
        createCriteriaCatalogSet={createCriteriaCatalogSet}
        updateCriteriaCatalogSet={updateCriteriaCatalogSet}
        normalizeFieldLabel={normalizeFieldLabel}
        onCampaignUpdate={onCampaignUpdate}
      />

      {/* ── Add / Edit Criteria Field modal ────────────────────────────── */}
      <CriteriaFieldModals
        campaign={campaign}
        criteriaFields={criteriaFields}
        addFieldOpen={addFieldOpen}
        editFieldData={editFieldData}
        fieldDraft={fieldDraft}
        fieldSaving={fieldSaving}
        optionsTab={optionsTab}
        optionsBulkText={optionsBulkText}
        valueMappingsField={valueMappingsField}
        valueMappingsDraft={valueMappingsDraft}
        valueMappingsStateDraft={valueMappingsStateDraft}
        valueMappingsSaving={valueMappingsSaving}
        confirmDeleteSet={confirmDeleteSet}
        deletingSet={deletingSet}
        deleteFieldTarget={deleteFieldTarget}
        deletingField={deletingField}
        saveCriteriaToSetOpen={saveCriteriaToSetOpen}
        saveCriteriaToSetMode={saveCriteriaToSetMode}
        saveCriteriaToSetDraft={saveCriteriaToSetDraft}
        savingCriteriaToSet={savingCriteriaToSet}
        localCriteriaSetId={localCriteriaSetId}
        localCriteriaSetName={localCriteriaSetName}
        campaignBulkImportOpen={campaignBulkImportOpen}
        campaignBulkImportText={campaignBulkImportText}
        campaignBulkImporting={campaignBulkImporting}
        setAddFieldOpen={setAddFieldOpen}
        setEditFieldData={setEditFieldData}
        setFieldDraft={setFieldDraft}
        setFieldSaving={setFieldSaving}
        setOptionsTab={setOptionsTab}
        setOptionsBulkText={setOptionsBulkText}
        setValueMappingsField={setValueMappingsField}
        setValueMappingsDraft={setValueMappingsDraft}
        setValueMappingsStateDraft={setValueMappingsStateDraft}
        setValueMappingsSaving={setValueMappingsSaving}
        setConfirmDeleteSet={setConfirmDeleteSet}
        setDeletingSet={setDeletingSet}
        setDeleteFieldTarget={setDeleteFieldTarget}
        setDeletingField={setDeletingField}
        setSaveCriteriaToSetOpen={setSaveCriteriaToSetOpen}
        setSaveCriteriaToSetMode={setSaveCriteriaToSetMode}
        setSaveCriteriaToSetDraft={setSaveCriteriaToSetDraft}
        setLocalCriteriaSetId={setLocalCriteriaSetId}
        setLocalCriteriaSetName={setLocalCriteriaSetName}
        setLocalCriteriaSetVersion={setLocalCriteriaSetVersion}
        setCatalogSets={setCatalogSets}
        setCampaignBulkImportOpen={setCampaignBulkImportOpen}
        setCampaignBulkImportText={setCampaignBulkImportText}
        setCampaignBulkImporting={setCampaignBulkImporting}
        refreshCriteria={refreshCriteria}
        saveCurrentCriteriaToCatalog={saveCurrentCriteriaToCatalog}
        createCriteriaField={createCriteriaField}
        updateCriteriaField={updateCriteriaField}
        deleteCriteriaField={deleteCriteriaField}
        updateCriteriaValueMappings={updateCriteriaValueMappings}
        deleteCriteriaCatalogSet={deleteCriteriaCatalogSet}
        normalizeFieldLabel={normalizeFieldLabel}
        onCampaignUpdate={onCampaignUpdate}
        inputClass={inputClass}
      />

      {/* ── Value Mappings modal ────────────────────────────────────────── */}

      {/* ── Delete catalog set confirm modal ────────────────────────────── */}

      {/* ── Delete Criteria Field confirm modal ────────────────────────── */}

      {/* ── Save criteria fields to catalog ─────────────────────────────── */}

      <ParticipantModals
        campaign={campaign}
        clients={clients}
        affiliates={affiliates}
        logicRules={logicRules}
        criteriaFields={criteriaFields}
        leadsForCampaign={leadsForCampaign}
        linkedClients={linkedClients}
        linkedAffiliates={linkedAffiliates}
        clientLinkMap={clientLinkMap}
        affiliateLinkMap={affiliateLinkMap}
        localClientLinks={localClientLinks}
        localAffiliateLinks={localAffiliateLinks}
        participantAction={participantAction}
        confirmRotateKey={confirmRotateKey}
        participantStatusOptions={participantStatusOptions}
        participantLogicType={participantLogicType}
        participantLogicRules={participantLogicRules}
        participantLogicLoading={participantLogicLoading}
        participantLogicSaving={participantLogicSaving}
        participantLogicBuilderOpen={participantLogicBuilderOpen}
        participantLogicEditingRule={participantLogicEditingRule}
        participantLogicDeletingRuleId={participantLogicDeletingRuleId}
        participantLogicSetId={participantLogicSetId}
        participantLogicSetVersion={participantLogicSetVersion}
        participantLogicSetName={participantLogicSetName}
        participantLogicBaseSetId={participantLogicBaseSetId}
        participantLogicBaseSetVersion={participantLogicBaseSetVersion}
        participantLogicBaseSetName={participantLogicBaseSetName}
        participantLogicCatalogOpen={participantLogicCatalogOpen}
        participantLogicCatalogLoading={participantLogicCatalogLoading}
        participantLogicCatalogSets={participantLogicCatalogSets}
        participantLogicApplyingCatalogId={participantLogicApplyingCatalogId}
        participantExpandedSetId={participantExpandedSetId}
        participantSetVersionsMap={participantSetVersionsMap}
        participantLoadingVersionsFor={participantLoadingVersionsFor}
        participantExpandedVersionRules={participantExpandedVersionRules}
        participantExpandedRuleDetails={participantExpandedRuleDetails}
        saveParticipantLogicOpen={saveParticipantLogicOpen}
        saveParticipantLogicMode={saveParticipantLogicMode}
        saveParticipantLogicDraft={saveParticipantLogicDraft}
        savingParticipantLogicToCatalog={savingParticipantLogicToCatalog}
        syncingClientLogicToCampaign={syncingClientLogicToCampaign}
        pinnedBaseLogicViewerOpen={pinnedBaseLogicViewerOpen}
        pinnedBaseExpandedRules={pinnedBaseExpandedRules}
        deliveryLogicIntroClientId={deliveryLogicIntroClientId}
        pixelLogicIntroAffiliateId={pixelLogicIntroAffiliateId}
        localLogicSetId={localLogicSetId}
        localLogicSetName={localLogicSetName}
        localLogicSetVersion={localLogicSetVersion}
        setParticipantAction={setParticipantAction}
        setConfirmRotateKey={setConfirmRotateKey}
        setParticipantLogicType={setParticipantLogicType}
        setParticipantLogicBuilderOpen={setParticipantLogicBuilderOpen}
        setParticipantLogicEditingRule={setParticipantLogicEditingRule}
        setParticipantLogicCatalogOpen={setParticipantLogicCatalogOpen}
        setParticipantExpandedSetId={setParticipantExpandedSetId}
        setParticipantSetVersionsMap={setParticipantSetVersionsMap}
        setParticipantLoadingVersionsFor={setParticipantLoadingVersionsFor}
        setParticipantExpandedVersionRules={setParticipantExpandedVersionRules}
        setParticipantExpandedRuleDetails={setParticipantExpandedRuleDetails}
        setParticipantLogicBaseSetId={setParticipantLogicBaseSetId}
        setParticipantLogicBaseSetName={setParticipantLogicBaseSetName}
        setParticipantLogicBaseSetVersion={setParticipantLogicBaseSetVersion}
        setSaveParticipantLogicOpen={setSaveParticipantLogicOpen}
        setSaveParticipantLogicMode={setSaveParticipantLogicMode}
        setSaveParticipantLogicDraft={setSaveParticipantLogicDraft}
        setPinnedBaseLogicViewerOpen={setPinnedBaseLogicViewerOpen}
        setPinnedBaseExpandedRules={setPinnedBaseExpandedRules}
        setDeliveryClientId={setDeliveryClientId}
        setDeliveryDraft={setDeliveryDraft}
        setDeliverySaveAttempted={setDeliverySaveAttempted}
        setDeliveryTab={setDeliveryTab}
        setLocalClientLinks={setLocalClientLinks}
        setLocalAffiliateLinks={setLocalAffiliateLinks}
        setAffiliateCapModalId={setAffiliateCapModalId}
        setPixelDraft={setPixelDraft}
        setPixelSaveAttempted={setPixelSaveAttempted}
        setPixelConfigTab={setPixelConfigTab}
        setPixelAffiliateId={setPixelAffiliateId}
        setPixelLogicIntroAffiliateId={setPixelLogicIntroAffiliateId}
        setDeliveryLogicIntroClientId={setDeliveryLogicIntroClientId}
        setParticipantLogicSetName={setParticipantLogicSetName}
        logicCatalogSets={logicCatalogSets}
        handleToggleParticipantLogicRule={handleToggleParticipantLogicRule}
        handleDeleteParticipantLogicRule={handleDeleteParticipantLogicRule}
        handleApplyParticipantLogicCatalog={handleApplyParticipantLogicCatalog}
        handleSyncClientLogicToCampaign={handleSyncClientLogicToCampaign}
        openParticipantLogicCatalog={openParticipantLogicCatalog}
        saveParticipantLogicToCatalog={saveParticipantLogicToCatalog}
        openAffiliateLogicManager={openAffiliateLogicManager}
        openClientLogicManager={openClientLogicManager}
        onRotateParticipantKey={onRotateParticipantKey}
        onUpdateClientStatus={onUpdateClientStatus}
        onUpdateAffiliateStatus={onUpdateAffiliateStatus}
        onRemoveClient={onRemoveClient}
        onRemoveAffiliate={onRemoveAffiliate}
        onOpenLeadsForCampaign={onOpenLeadsForCampaign}
        resolveChangedBy={resolveChangedBy}
        normalizeFieldLabel={normalizeFieldLabel}
        formatLogicOperatorLabel={formatLogicOperatorLabel}
        formatLogicConditionValue={formatLogicConditionValue}
        getLogicCatalogSet={getLogicCatalogSet}
        defaultDeliveryConfig={defaultDeliveryConfig}
        normalizeDeliveryMappingRows={normalizeDeliveryMappingRows}
      />

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

      <ClientDeliveryModal
        campaign={campaign}
        clients={clients}
        criteriaFields={criteriaFields}
        deliveryClientId={deliveryClientId}
        deliveryDraft={deliveryDraft}
        deliveryTab={deliveryTab}
        savingDeliveryConfig={savingDeliveryConfig}
        deliverySaveAttempted={deliverySaveAttempted}
        deliveryHasUrl={deliveryHasUrl}
        deliveryHasMappings={deliveryHasMappings}
        deliveryHasValidationRule={deliveryHasValidationRule}
        deliveryInvalidUrl={deliveryInvalidUrl}
        deliveryInvalidMappings={deliveryInvalidMappings}
        deliveryInvalidRules={deliveryInvalidRules}
        deliverySaveDisabledReason={deliverySaveDisabledReason}
        setDeliveryClientId={setDeliveryClientId}
        setDeliveryDraft={setDeliveryDraft}
        setDeliveryTab={setDeliveryTab}
        setSavingDeliveryConfig={setSavingDeliveryConfig}
        setDeliverySaveAttempted={setDeliverySaveAttempted}
        setLocalClientLinks={setLocalClientLinks}
        onUpdateClientDeliveryConfig={onUpdateClientDeliveryConfig}
        normalizeFieldLabel={normalizeFieldLabel}
        inputClass={inputClass}
      />

      {/* ── Affiliate Lead Cap Modal ───────────────────────────────────────── */}
      <AffiliateConfigModals
        campaign={campaign}
        affiliates={affiliates}
        criteriaFields={criteriaFields}
        affiliateCapModalId={affiliateCapModalId}
        affiliateCapDraft={affiliateCapDraft}
        savingAffiliateCap={savingAffiliateCap}
        pixelAffiliateId={pixelAffiliateId}
        pixelConfigTab={pixelConfigTab}
        pixelDraft={pixelDraft}
        savingPixelConfig={savingPixelConfig}
        pixelSaveAttempted={pixelSaveAttempted}
        pixelHasUrl={pixelHasUrl}
        pixelHasMappings={pixelHasMappings}
        pixelInvalidUrl={pixelInvalidUrl}
        pixelInvalidMappings={pixelInvalidMappings}
        pixelFinalSaveDisabledReason={pixelFinalSaveDisabledReason}
        pixelSaveBlockedByEnabledConfig={pixelSaveBlockedByEnabledConfig}
        pixelCriteriaRules={pixelCriteriaRules}
        pixelCriteriaLoading={pixelCriteriaLoading}
        pixelCriteriaDeletingRuleId={pixelCriteriaDeletingRuleId}
        pixelCriteriaEditingRule={pixelCriteriaEditingRule}
        pixelCriteriaBuilderOpen={pixelCriteriaBuilderOpen}
        soldCriteriaRules={soldCriteriaRules}
        soldCriteriaLoading={soldCriteriaLoading}
        soldCriteriaDeletingRuleId={soldCriteriaDeletingRuleId}
        soldCriteriaEditingRule={soldCriteriaEditingRule}
        soldCriteriaBuilderOpen={soldCriteriaBuilderOpen}
        setAffiliateCapModalId={setAffiliateCapModalId}
        setAffiliateCapDraft={setAffiliateCapDraft}
        setSavingAffiliateCap={setSavingAffiliateCap}
        setPixelAffiliateId={setPixelAffiliateId}
        setPixelConfigTab={setPixelConfigTab}
        setPixelDraft={setPixelDraft}
        setSavingPixelConfig={setSavingPixelConfig}
        setPixelSaveAttempted={setPixelSaveAttempted}
        setPixelCriteriaAffiliateId={setPixelCriteriaAffiliateId}
        setPixelCriteriaBuilderOpen={setPixelCriteriaBuilderOpen}
        setPixelCriteriaEditingRule={setPixelCriteriaEditingRule}
        setPixelCriteriaRules={setPixelCriteriaRules}
        setSoldCriteriaAffiliateId={setSoldCriteriaAffiliateId}
        setSoldCriteriaBuilderOpen={setSoldCriteriaBuilderOpen}
        setSoldCriteriaEditingRule={setSoldCriteriaEditingRule}
        setSoldCriteriaRules={setSoldCriteriaRules}
        setLocalAffiliateLinks={setLocalAffiliateLinks}
        handleTogglePixelCriteriaRule={handleTogglePixelCriteriaRule}
        handleDeletePixelCriteriaRule={handleDeletePixelCriteriaRule}
        handleToggleSoldCriteriaRule={handleToggleSoldCriteriaRule}
        handleDeleteSoldCriteriaRule={handleDeleteSoldCriteriaRule}
        onUpdateAffiliateLeadCap={onUpdateAffiliateLeadCap}
        onUpdateAffiliateSoldPixelConfig={onUpdateAffiliateSoldPixelConfig}
        normalizeFieldLabel={normalizeFieldLabel}
        formatLogicOperatorLabel={formatLogicOperatorLabel}
        formatLogicConditionValue={formatLogicConditionValue}
        inputClass={inputClass}
      />

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
