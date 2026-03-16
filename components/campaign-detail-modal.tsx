"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  ChevronDown,
  Copy,
  FileText,
  HandHeart,
  Settings2,
  Info,
  KeyRound,
  LayoutGrid,
  Link2,
  Pencil,
  Plug,
  Plus,
  RotateCcw,
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
  seedBaseFields,
  listLogicRules,
  createLogicRule,
  updateLogicRule,
  deleteLogicRule,
  getEntityAudit,
} from "@/lib/api";
import type {
  Affiliate,
  AuditLogItem,
  Campaign,
  Client,
  CognitoUser,
  CriteriaField,
  CriteriaFieldOption,
  CriteriaFieldType,
  CriteriaValueMapping,
  Lead,
  LogicRule,
  PluginSettingRecord,
} from "@/lib/types";
import type { CampaignDetailTab, CampaignParticipantStatus } from "@/lib/types";
import { generatePostingInstructions } from "@/lib/generate-posting-instructions";

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
  return action
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
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

function leadModeFromAffiliateStatus(
  status?: CampaignParticipantStatus,
): "all" | "test" | "live" {
  if (status === "TEST") return "test";
  if (status === "LIVE") return "live";
  return "all";
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
  onOpenLeadsForCampaign,
  tab,
  onTabChange,
  focusAffiliateId,
  subTab,
  onSubTabChange,
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
        claim?: boolean;
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
  onOpenLeadsForCampaign: (
    campaignId: string,
    options?: { affiliateId?: string; mode?: "all" | "test" | "live" },
  ) => void;
  tab: CampaignDetailTab;
  onTabChange: (tab: CampaignDetailTab) => void;
  focusAffiliateId: string | null;
  subTab?: "base-criteria" | "logic";
  onSubTabChange?: (sub: "base-criteria" | "logic") => void;
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
  const [trustedFormClaim, setTrustedFormClaim] = useState(false);
  const [ipqsGate, setIpqsGate] = useState(true);
  const [tfStep, setTfStep] = useState(2);
  const [ipqsStep, setIpqsStep] = useState(3);
  const [tfStepEditing, setTfStepEditing] = useState(false);
  const [ipqsStepEditing, setIpqsStepEditing] = useState(false);

  // ── Settings tab ─────────────────────────────────────────────────────────
  const [settingsSubTab, setSettingsSubTab] = useState<
    "base-criteria" | "logic"
  >("base-criteria");

  useEffect(() => {
    if (subTab) setSettingsSubTab(subTab);
  }, [subTab]);

  const handleSubTabChange = (sub: "base-criteria" | "logic") => {
    setSettingsSubTab(sub);
    onSubTabChange?.(sub);
  };

  const [seedingBaseFields, setSeedingBaseFields] = useState(false);
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
    isOpen && campaign?.id && (tab === "settings" || tab === "affiliates")
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
    isOpen && campaign?.id && tab === "settings"
      ? `logic-rules-${campaign.id}`
      : null,
    () => listLogicRules(campaign!.id),
  );
  const logicRules: LogicRule[] = (logicRulesData as any)?.data ?? [];

  const { data: campaignAuditData } = useSWR(
    isOpen && campaign?.id && tab === "overview"
      ? `campaign-audit-${campaign.id}`
      : null,
    () => getEntityAudit(campaign!.id, { limit: 50 }),
    { revalidateOnFocus: true },
  );
  const configAuditItems = useMemo(
    () =>
      (campaignAuditData?.data?.items ?? []).filter((item: AuditLogItem) =>
        CONFIG_AUDIT_ACTIONS.has(item.action),
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
    } catch (err: any) {
      toast.error(err?.message || "An error occurred.");
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
      setTrustedFormClaim(campaign.plugins?.trusted_form?.claim ?? false);
      setIpqsGate(campaign.plugins?.ipqs?.gate ?? true);
      setTfStep(campaign.plugins?.trusted_form?.stage ?? 2);
      setIpqsStep(campaign.plugins?.ipqs?.stage ?? 3);
      setTfStepEditing(false);
      setIpqsStepEditing(false);
      setLocalClientLinks(campaign.clients ?? []);
      setLocalAffiliateLinks(campaign.affiliates ?? []);
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
    trustedFormClaim,
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

  const linkedClients = clients.filter((c) => clientLinkMap.has(c.id));
  const linkedAffiliates = affiliates.filter((a) => affiliateLinkMap.has(a.id));

  const availableClients = clients.filter(
    (c) => c.status === "ACTIVE" && !clientLinkMap.has(c.id),
  );
  const availableAffiliates = affiliates.filter(
    (a) => a.status === "ACTIVE" && !affiliateLinkMap.has(a.id),
  );

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

                      {campaignChangeHistory.length > 0 ? (
                        <div className="rounded-lg border border-[--color-border] overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setHistoryOpen((v) => !v)}
                            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm transition hover:bg-[--color-panel]"
                          >
                            <span className="flex items-center gap-2 font-semibold text-[--color-text-strong]">
                              Change History
                              <span className="text-xs font-normal text-[--color-text-muted]">
                                ({campaignChangeHistory.length} event
                                {campaignChangeHistory.length !== 1 ? "s" : ""})
                              </span>
                            </span>
                            <ChevronDown
                              size={14}
                              className={`text-[--color-text-muted] transition-transform duration-200 ${historyOpen ? "rotate-180" : ""}`}
                            />
                          </button>
                          <AnimatePresence>
                            {historyOpen && (
                              <motion.div
                                key="change-history"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{
                                  duration: 0.2,
                                  ease: "easeOut",
                                }}
                                className="overflow-hidden"
                              >
                                <ul className="divide-y divide-[--color-border] px-4 pb-3">
                                  {campaignChangeHistory.map((entry, idx) => (
                                    <li
                                      key={idx}
                                      className="flex items-start gap-3 py-3"
                                    >
                                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[--color-panel]">
                                        <ArrowRight
                                          size={10}
                                          className="text-[--color-text-muted]"
                                        />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        {entry.kind === "status" ? (
                                          <p className="text-sm text-[--color-text]">
                                            {entry.from ? (
                                              <>
                                                Status changed from{" "}
                                                <Badge
                                                  tone={
                                                    statusColorMap[
                                                      entry.from
                                                    ] || "neutral"
                                                  }
                                                >
                                                  {entry.from}
                                                </Badge>{" "}
                                                to{" "}
                                                <Badge
                                                  tone={
                                                    statusColorMap[entry.to] ||
                                                    "neutral"
                                                  }
                                                >
                                                  {entry.to}
                                                </Badge>
                                              </>
                                            ) : (
                                              <>
                                                Status initialized to{" "}
                                                <Badge
                                                  tone={
                                                    statusColorMap[entry.to] ||
                                                    "neutral"
                                                  }
                                                >
                                                  {entry.to}
                                                </Badge>
                                              </>
                                            )}
                                          </p>
                                        ) : (
                                          <p className="text-sm text-[--color-text]">
                                            {entry.previous_value != null ? (
                                              <>
                                                Campaign renamed from{" "}
                                                <span className="font-medium text-[--color-text-strong]">
                                                  &ldquo;
                                                  {String(entry.previous_value)}
                                                  &rdquo;
                                                </span>{" "}
                                                to{" "}
                                                <span className="font-medium text-[--color-text-strong]">
                                                  &ldquo;
                                                  {String(
                                                    entry.new_value ?? "",
                                                  )}
                                                  &rdquo;
                                                </span>
                                              </>
                                            ) : (
                                              <>
                                                Campaign name set to{" "}
                                                <span className="font-medium text-[--color-text-strong]">
                                                  &ldquo;
                                                  {String(
                                                    entry.new_value ?? "",
                                                  )}
                                                  &rdquo;
                                                </span>
                                              </>
                                            )}
                                          </p>
                                        )}
                                        <p className="mt-0.5 text-xs text-[--color-text-muted]">
                                          {formatDateTime(entry.changed_at)}
                                          {` · by ${resolveChangedBy(entry.changed_by) || "System"}`}
                                        </p>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ) : null}

                      {configAuditItems.length > 0 && (
                        <div className="rounded-lg border border-[--color-border] overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setConfigActivityOpen((v) => !v)}
                            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm transition hover:bg-[--color-panel]"
                          >
                            <span className="flex items-center gap-2 font-semibold text-[--color-text-strong]">
                              Configuration Activity
                              <span className="text-xs font-normal text-[--color-text-muted]">
                                ({configAuditItems.length} event
                                {configAuditItems.length !== 1 ? "s" : ""})
                              </span>
                            </span>
                            <ChevronDown
                              size={14}
                              className={`text-[--color-text-muted] transition-transform duration-200 ${configActivityOpen ? "rotate-180" : ""}`}
                            />
                          </button>
                          <AnimatePresence>
                            {configActivityOpen && (
                              <motion.div
                                key="config-activity"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{
                                  duration: 0.2,
                                  ease: "easeOut",
                                }}
                                className="overflow-hidden"
                              >
                                <ul className="max-h-72 divide-y divide-[--color-border] overflow-y-auto">
                                  {configAuditItems.map(
                                    (item: AuditLogItem) => {
                                      // For logic_rule events: filter out rule_id, and for *_added skip changes where from is null (just show the added value)
                                      const isMappingsEvent =
                                        item.action === "mappings_updated";
                                      const isLogicRuleEvent =
                                        item.action.startsWith("logic_rule");
                                      const isCriteriaAddEvent =
                                        item.action === "criteria_field_added";

                                      // Build visible changes
                                      let visibleChanges = item.changes.filter(
                                        (c) =>
                                          c.field !== "field_id" &&
                                          c.field !== "rule_id",
                                      );

                                      // For mappings_updated collapse all changes into one summary row
                                      // (the field names are raw IDs — we show "Value Mapping" instead)
                                      const mappingFieldName = isMappingsEvent
                                        ? (() => {
                                            // Try to find a field_label in changes, or fall back to a field_name
                                            const labelChange =
                                              item.changes.find(
                                                (c) =>
                                                  c.field
                                                    .toLowerCase()
                                                    .includes("field_label") ||
                                                  c.field
                                                    .toLowerCase()
                                                    .includes("label"),
                                              );
                                            // Field names often look like "CFxxxxxx.value_mappings"
                                            const rawField =
                                              item.changes[0]?.field ?? "";
                                            const m =
                                              rawField.match(
                                                /^(CF[A-Z0-9]+)\./i,
                                              );
                                            const entityId = m ? m[1] : null;
                                            return labelChange
                                              ? String(
                                                  labelChange.to ??
                                                    labelChange.from ??
                                                    "",
                                                )
                                              : (entityId ?? "Value Mapping");
                                          })()
                                        : null;

                                      const hasChanges =
                                        visibleChanges.length > 0;
                                      const isExpanded = expandedAuditIds.has(
                                        item.log_id,
                                      );

                                      // For logic_rule_added: find name + action from changes for summary
                                      const ruleNameChange = isLogicRuleEvent
                                        ? item.changes.find(
                                            (c) => c.field === "name",
                                          )
                                        : null;
                                      const ruleActionChange = isLogicRuleEvent
                                        ? item.changes.find(
                                            (c) => c.field === "action",
                                          )
                                        : null;

                                      // Build tooltip content for logic rules showing conditions
                                      const ruleConditions = isLogicRuleEvent
                                        ? item.changes.filter(
                                            (c) =>
                                              c.field
                                                .toLowerCase()
                                                .includes("condition") ||
                                              c.field
                                                .toLowerCase()
                                                .includes("group"),
                                          )
                                        : [];

                                      return (
                                        <li key={item.log_id}>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              hasChanges &&
                                              setExpandedAuditIds((prev) => {
                                                const next = new Set(prev);
                                                if (next.has(item.log_id))
                                                  next.delete(item.log_id);
                                                else next.add(item.log_id);
                                                return next;
                                              })
                                            }
                                            className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                                              hasChanges
                                                ? "cursor-pointer hover:bg-[--color-bg-muted]"
                                                : "cursor-default"
                                            } ${isExpanded ? "bg-[--color-bg-muted]" : ""}`}
                                          >
                                            <span className="w-40 shrink-0 text-[11px] text-[--color-text-muted]">
                                              {formatDateTime(item.changed_at)}
                                            </span>
                                            <span className="flex-1 flex items-center gap-2 text-[--color-text]">
                                              {auditActionLabel(item.action)}
                                              {/* Logic rule summary inline */}
                                              {isLogicRuleEvent &&
                                                (ruleNameChange ||
                                                  ruleActionChange) && (
                                                  <span className="font-semibold text-[--color-text-strong]">
                                                    {ruleNameChange
                                                      ? String(
                                                          ruleNameChange.to ??
                                                            ruleNameChange.from ??
                                                            "",
                                                        )
                                                      : ""}
                                                    {ruleActionChange && (
                                                      <span
                                                        className={`ml-1.5 text-xs font-mono px-1 py-0.5 rounded ${
                                                          String(
                                                            ruleActionChange.to ??
                                                              ruleActionChange.from,
                                                          ) === "pass"
                                                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                                        }`}
                                                      >
                                                        {String(
                                                          ruleActionChange.to ??
                                                            ruleActionChange.from ??
                                                            "",
                                                        )}
                                                      </span>
                                                    )}
                                                  </span>
                                                )}
                                              {/* Mappings summary */}
                                              {isMappingsEvent && (
                                                <span className="text-xs text-[--color-text-muted]">
                                                  Value Mapping
                                                </span>
                                              )}
                                            </span>
                                            <span className="shrink-0 text-[11px] text-[--color-text-muted]">
                                              {resolveChangedBy(item.actor)}
                                            </span>
                                            {hasChanges && (
                                              <ChevronDown
                                                size={13}
                                                className={`shrink-0 text-[--color-text-muted] transition-transform duration-150 ${
                                                  isExpanded ? "rotate-180" : ""
                                                }`}
                                              />
                                            )}
                                          </button>
                                          {isExpanded && hasChanges && (
                                            <div className="border-t border-[--color-border] bg-[--color-bg-muted] px-4 py-3">
                                              <div className="space-y-2 pl-2">
                                                {isMappingsEvent ? (
                                                  // Mappings: show a clean summary
                                                  <div className="text-[11px] text-[--color-text-muted]">
                                                    <span className="font-medium text-[--color-text]">
                                                      Value Mapping updated
                                                    </span>
                                                    {mappingFieldName && (
                                                      <span className="ml-1 text-[--color-text-muted]">
                                                        — field:{" "}
                                                        <span className="font-mono text-[--color-text]">
                                                          {mappingFieldName}
                                                        </span>
                                                      </span>
                                                    )}
                                                    <div className="mt-1.5 space-y-1">
                                                      {visibleChanges
                                                        .filter(
                                                          (c) =>
                                                            !c.field.includes(
                                                              "value_mappings",
                                                            ) ||
                                                            Array.isArray(
                                                              c.from,
                                                            ) ||
                                                            Array.isArray(c.to),
                                                        )
                                                        .slice(0, 6)
                                                        .map((c, i) => {
                                                          const isArray =
                                                            Array.isArray(
                                                              c.from,
                                                            ) ||
                                                            Array.isArray(c.to);
                                                          if (isArray) {
                                                            const fromLen =
                                                              Array.isArray(
                                                                c.from,
                                                              )
                                                                ? (
                                                                    c.from as unknown[]
                                                                  ).length
                                                                : 0;
                                                            const toLen =
                                                              Array.isArray(
                                                                c.to,
                                                              )
                                                                ? (
                                                                    c.to as unknown[]
                                                                  ).length
                                                                : 0;
                                                            return (
                                                              <div
                                                                key={i}
                                                                className="text-[--color-text-muted]"
                                                              >
                                                                {toLen > fromLen
                                                                  ? `${toLen - fromLen} mapping${toLen - fromLen !== 1 ? "s" : ""} added`
                                                                  : toLen <
                                                                      fromLen
                                                                    ? `${fromLen - toLen} mapping${fromLen - toLen !== 1 ? "s" : ""} removed`
                                                                    : `${toLen} mapping${toLen !== 1 ? "s" : ""} updated`}
                                                              </div>
                                                            );
                                                          }
                                                          return null;
                                                        })}
                                                    </div>
                                                  </div>
                                                ) : (
                                                  visibleChanges
                                                    .filter((change) => {
                                                      const fromObj =
                                                        change.from !== null &&
                                                        change.from !==
                                                          undefined &&
                                                        typeof change.from ===
                                                          "object" &&
                                                        !Array.isArray(
                                                          change.from,
                                                        );
                                                      const toObj =
                                                        change.to !== null &&
                                                        change.to !==
                                                          undefined &&
                                                        typeof change.to ===
                                                          "object" &&
                                                        !Array.isArray(
                                                          change.to,
                                                        );
                                                      return !(
                                                        fromObj && toObj
                                                      );
                                                    })
                                                    .map((change, i) => {
                                                      const fieldLower =
                                                        change.field.toLowerCase();
                                                      const isCondition =
                                                        fieldLower.includes(
                                                          "condition",
                                                        );
                                                      // "Added" event where from is null — just show the new value
                                                      const isAddedValue =
                                                        change.from == null &&
                                                        change.to != null;

                                                      if (isCondition) {
                                                        const isAdded =
                                                          fieldLower.endsWith(
                                                            ".added",
                                                          ) ||
                                                          (change.from ==
                                                            null &&
                                                            change.to != null);
                                                        const isRemoved =
                                                          fieldLower.endsWith(
                                                            ".removed",
                                                          ) ||
                                                          (change.to == null &&
                                                            change.from !=
                                                              null);
                                                        const condVal = isAdded
                                                          ? formatAuditVal(
                                                              change.to,
                                                            )
                                                          : isRemoved
                                                            ? formatAuditVal(
                                                                change.from,
                                                              )
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
                                                                `${formatAuditVal(change.from)} → ${formatAuditVal(change.to)}`}
                                                            </span>
                                                          </div>
                                                        );
                                                      }

                                                      const complex =
                                                        isComplexValue(
                                                          change.from,
                                                        ) ||
                                                        isComplexValue(
                                                          change.to,
                                                        );

                                                      // Human-readable field label
                                                      const rawFieldName =
                                                        change.field.replace(
                                                          /^payload\./,
                                                          "",
                                                        );
                                                      // For criteria_field_added flatten dotted field names like "CFxxx.field_label" → "Field Label"
                                                      const fieldLabel =
                                                        normalizeFieldLabel(
                                                          rawFieldName.includes(
                                                            ".",
                                                          )
                                                            ? rawFieldName
                                                                .split(".")
                                                                .pop()!
                                                            : rawFieldName,
                                                        );

                                                      return (
                                                        <div
                                                          key={`${item.log_id}-${i}`}
                                                          className="grid grid-cols-[8rem_1fr] items-start gap-2 text-[11px]"
                                                        >
                                                          <span className="truncate font-medium text-[--color-text]">
                                                            {fieldLabel}
                                                          </span>
                                                          {complex ? (
                                                            <span className="italic text-[11px] text-[--color-text-muted]">
                                                              {Array.isArray(
                                                                change.from,
                                                              ) &&
                                                              Array.isArray(
                                                                change.to,
                                                              )
                                                                ? change.to
                                                                    .length >
                                                                  change.from
                                                                    .length
                                                                  ? `Added ${change.to.length - change.from.length} item${change.to.length - change.from.length !== 1 ? "s" : ""}`
                                                                  : change.to
                                                                        .length <
                                                                      change
                                                                        .from
                                                                        .length
                                                                    ? `Removed ${change.from.length - change.to.length} item${change.from.length - change.to.length !== 1 ? "s" : ""}`
                                                                    : "Modified"
                                                                : "Updated"}
                                                            </span>
                                                          ) : isAddedValue ? (
                                                            // From null → value: just show the new value, no strikethrough
                                                            <span className="font-medium text-[--color-text]">
                                                              {formatAuditVal(
                                                                change.to,
                                                              )}
                                                            </span>
                                                          ) : (
                                                            <span className="flex min-w-0 items-start gap-1.5 text-[--color-text-muted]">
                                                              <span className="max-w-[120px] truncate line-through">
                                                                {formatAuditVal(
                                                                  change.from,
                                                                )}
                                                              </span>
                                                              <ArrowRight
                                                                size={9}
                                                                className="shrink-0"
                                                              />
                                                              <span className="max-w-[120px] truncate font-medium text-[--color-text]">
                                                                {formatAuditVal(
                                                                  change.to,
                                                                )}
                                                              </span>
                                                            </span>
                                                          )}
                                                        </div>
                                                      );
                                                    })
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </li>
                                      );
                                    },
                                  )}
                                </ul>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </>
                  )}

                  {tab === "clients" && (
                    <div className="space-y-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <SectionLabel>Linked Clients</SectionLabel>
                        <DisabledTooltip
                          inline
                          message={
                            availableClients.length === 0
                              ? clients.filter((c) => c.status === "ACTIVE")
                                  .length === 0
                                ? "There are no active clients to add to this campaign."
                                : "All active clients are already linked to this campaign."
                              : ""
                          }
                        >
                          <Button
                            size="sm"
                            iconLeft={<UserPlus size={14} />}
                            disabled={availableClients.length === 0}
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
                            availableAffiliates.length === 0
                              ? affiliates.filter((a) => a.status === "ACTIVE")
                                  .length === 0
                                ? "There are no active affiliates to add to this campaign."
                                : "All active affiliates are already linked to this campaign."
                              : ""
                          }
                        >
                          <Button
                            size="sm"
                            iconLeft={<UserPlus size={14} />}
                            disabled={availableAffiliates.length === 0}
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
                            const affiliateLeadCount = link?.campaign_key
                              ? (leadsByCampaignKey.get(link.campaign_key) ?? 0)
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
                                {/* Reject-on-failure + Claim certificate — collapsed by default */}
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
                                        <div className="flex items-center gap-1.5 text-xs">
                                          <HoverTooltip message="When on, a successful validation also claims (retains) the certificate with TrustedForm, consuming it. When off, the certificate is only validated.">
                                            <span className="cursor-help text-[--color-text-muted]">
                                              Claim certificate
                                            </span>
                                          </HoverTooltip>
                                          <button
                                            type="button"
                                            role="switch"
                                            aria-checked={trustedFormClaim}
                                            onClick={() =>
                                              setTrustedFormClaim(
                                                (prev) => !prev,
                                              )
                                            }
                                            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
                                              trustedFormClaim
                                                ? "bg-[--color-primary]"
                                                : "bg-[--color-border]"
                                            }`}
                                          >
                                            <span
                                              className={`inline-block h-4 w-4 transform rounded-full bg-[--color-bg] transition ${
                                                trustedFormClaim
                                                  ? "translate-x-4"
                                                  : "translate-x-0.5"
                                              }`}
                                            />
                                          </button>
                                          <span className="text-[--color-text-muted]">
                                            {trustedFormClaim ? "On" : "Off"}
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
                                                    {ipqsPhoneOpen && (
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
                                                                ipqsConfig.phone
                                                                  .criteria
                                                                  .valid.enabled
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
                                                                ipqsConfig.phone
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
                                                                ipqsConfig.phone
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
                                                              .criteria.country
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
                                                    {ipqsEmailOpen && (
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
                                                                ipqsConfig.email
                                                                  .criteria
                                                                  .valid.enabled
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
                                                                ipqsConfig.email
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
                                                    {ipqsIpOpen && (
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
                                                                  ipqsConfig.ip
                                                                    .criteria
                                                                    .country_code
                                                                    .allowed
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
                                                                  .proxy.enabled
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
                                                                  .criteria.vpn
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
                                  claim: trustedFormClaim,
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
                        {(["base-criteria", "logic"] as const).map((sub) => (
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
                            {sub === "base-criteria" ? "Criteria" : "Logic"}
                          </button>
                        ))}
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
                            <div className="flex items-center justify-end gap-2">
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
                                    <div className="rounded-xl border border-dashed border-[--color-border] py-12 text-center text-sm text-[--color-text-muted]">
                                      No criteria fields yet.{" "}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setFieldDraft(emptyFieldDraft);
                                          setEditFieldData(null);
                                          setAddFieldOpen(true);
                                        }}
                                        className="text-[--color-primary] hover:underline"
                                      >
                                        Add the first field
                                      </button>
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
                            <div className="flex items-center justify-end gap-2">
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
                </motion.div>
              </AnimatePresence>
            </div>
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
            {/* ── Seed base fields quickstart ───────────────────────── */}
            {!editFieldData && (
              <div className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-[--color-text-strong] text-[13px]">
                      Seed standard fields
                    </p>
                    <p className="mt-0.5 text-[11px] text-[--color-text-muted] leading-snug">
                      Instantly add 10 pre-defined fields — First Name, Last
                      Name, Phone, State, Email, IP Address, and more. Existing
                      fields are skipped.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={seedingBaseFields}
                    onClick={async () => {
                      setSeedingBaseFields(true);
                      try {
                        await seedBaseFields(campaign.id);
                        toast.success("Standard fields seeded.");
                        refreshCriteria();
                        setAddFieldOpen(false);
                      } catch {
                        toast.error("Failed to seed base fields.");
                      } finally {
                        setSeedingBaseFields(false);
                      }
                    }}
                    className="shrink-0 rounded-md border border-[--color-border] bg-[--color-surface] px-3 py-1.5 text-[11px] font-medium text-[--color-text] hover:bg-[--color-bg-muted] disabled:opacity-50 transition-colors"
                  >
                    {seedingBaseFields ? "Seeding…" : "Add All"}
                  </button>
                </div>
              </div>
            )}
            {!editFieldData && (
              <div className="flex items-center gap-2 text-[11px] text-[--color-text-muted]">
                <div className="flex-1 border-t border-[--color-border]" />
                or add a custom field
                <div className="flex-1 border-t border-[--color-border]" />
              </div>
            )}
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
