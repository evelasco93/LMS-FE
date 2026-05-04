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
  IntakeLogItem,
  TagDefinitionRecord,
} from "@/lib/types";
import {
  formatLocalTime,
  IntakeLogDetailModal,
  intakeStatusTone,
  isRejectedIntake,
} from "@/components/views/admin-intake-helpers";
import { AdminIntakeLogSection } from "@/components/views/admin-intake-log-section";
import {
  formatAuditValue,
  resolveAuditActor,
  auditActionLabel,
  getEntityTypeMeta,
  formatLogDate,
  summarizeTablePreferenceConfig,
  renderLeadStructuredAuditChange,
  isComplexValue,
} from "@/components/views/admin-audit-helpers";
import { AdminSettingsEditors } from "@/components/views/admin-settings-editors";

// Intake log helpers and detail modal were extracted to admin-intake-helpers.tsx.

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

const normalizePresetOptionValue = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, "_");

const normalizePresetOptions = (
  options: { value: string; label: string }[],
) => {
  const seen = new Set<string>();
  const normalized: { value: string; label: string }[] = [];

  for (const option of options) {
    const normalizedValue = normalizePresetOptionValue(
      String(option.value ?? ""),
    );
    if (!normalizedValue || seen.has(normalizedValue)) continue;
    seen.add(normalizedValue);

    normalized.push({
      value: normalizedValue,
      label: String(option.label ?? "").trim() || normalizedValue,
    });
  }

  return normalized;
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
            const opts = normalizePresetOptions(
              (r.options as {
                value: string;
                label: string;
              }[]) ?? [],
            );
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
            const opts = normalizePresetOptions(
              (r.options ?? []) as {
                value: string;
                label: string;
              }[],
            );
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
          normalizePresetOptions(
            ((data.options as { value: string; label: string }[]) ?? []) as {
              value: string;
              label: string;
            }[],
          ),
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
    const normalizedValue = normalizePresetOptionValue(v);
    if (!normalizedValue) return;
    if (listEditorOptions.some((option) => option.value === normalizedValue)) {
      toast.error(`Option key "${normalizedValue}" already exists`);
      return;
    }

    setListEditorOptions((prev) => [
      ...prev,
      { value: normalizedValue, label: l || v },
    ]);
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
    const normalizedOptions = normalizePresetOptions(listEditorOptions);

    setListEditorSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name,
        description: listEditorDescription.trim() || undefined,
        data_type: "List",
        options: normalizedOptions,
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
          options: normalizedOptions,
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
            const opts = normalizePresetOptions(
              (r.options ?? []) as {
                value: string;
                label: string;
              }[],
            );
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
            const opts = normalizePresetOptions(
              (r.options ?? []) as {
                value: string;
                label: string;
              }[],
            );
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
              <AdminIntakeLogSection
                showIntakeLogsLoading={showIntakeLogsLoading}
                intakeLogsRaw={intakeLogsRaw}
                refreshIntakeLogs={refreshIntakeLogs}
                inputClass={inputClass}
                intakeSearch={intakeSearch}
                setIntakeSearch={setIntakeSearch}
                intakeFiltersOpen={intakeFiltersOpen}
                setIntakeFiltersOpen={setIntakeFiltersOpen}
                setIntakeStatusFilter={setIntakeStatusFilter}
                setIntakeSort={setIntakeSort}
                intakeSort={intakeSort}
                intakeStatusFilter={intakeStatusFilter}
                intakeStatusCounts={intakeStatusCounts}
                filteredIntakeLogs={filteredIntakeLogs}
                paginatedIntakeLogs={paginatedIntakeLogs}
                setSelectedIntakeLog={setSelectedIntakeLog}
                onOpenCampaign={onOpenCampaign}
                intakePage={intakePage}
                intakeTotalPages={intakeTotalPages}
                setIntakePage={setIntakePage}
                intakePageSize={intakePageSize}
                setIntakePageSize={setIntakePageSize}
                intakeShowingFrom={intakeShowingFrom}
                intakeShowingTo={intakeShowingTo}
              />
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

      <AdminSettingsEditors
        inputClass={inputClass}
        catalogEditorOpen={catalogEditorOpen}
        closeCatalogEditor={closeCatalogEditor}
        catalogEditorKind={catalogEditorKind}
        catalogEditorMode={catalogEditorMode}
        catalogEditorName={catalogEditorName}
        setCatalogEditorName={setCatalogEditorName}
        catalogEditorDescription={catalogEditorDescription}
        setCatalogEditorDescription={setCatalogEditorDescription}
        tagDefinitions={tagDefinitions}
        catalogEditorTags={catalogEditorTags}
        setCatalogEditorTags={setCatalogEditorTags}
        catalogEditorJson={catalogEditorJson}
        setCatalogEditorJson={setCatalogEditorJson}
        catalogEditorSaving={catalogEditorSaving}
        saveCatalogEditor={saveCatalogEditor}
        listEditorOpen={listEditorOpen}
        closeListEditor={closeListEditor}
        listEditorMode={listEditorMode}
        listEditorScope={listEditorScope}
        listEditorName={listEditorName}
        setListEditorName={setListEditorName}
        listEditorDescription={listEditorDescription}
        setListEditorDescription={setListEditorDescription}
        listEditorOptions={listEditorOptions}
        removeListOption={removeListOption}
        listEditorNewValue={listEditorNewValue}
        setListEditorNewValue={setListEditorNewValue}
        listEditorNewLabel={listEditorNewLabel}
        setListEditorNewLabel={setListEditorNewLabel}
        addListOption={addListOption}
        listEditorSaving={listEditorSaving}
        saveListEditor={saveListEditor}
        tagEditorOpen={tagEditorOpen}
        closeTagEditor={closeTagEditor}
        tagEditorMode={tagEditorMode}
        tagEditorLabel={tagEditorLabel}
        setTagEditorLabel={setTagEditorLabel}
        tagEditorColor={tagEditorColor}
        setTagEditorColor={setTagEditorColor}
        tagEditorSaving={tagEditorSaving}
        saveTagEditor={saveTagEditor}
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
