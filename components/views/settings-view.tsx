"use client";

import type React from "react";
import { useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowDownNarrowWide,
  ArrowRight,
  ArrowUpNarrowWide,
  Building2,
  ChevronDown,
  KeyRound,
  LayoutTemplate,
  Megaphone,
  Plug,
  PlusCircle,
  RefreshCw,
  Target,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import useSWR from "swr";
import { Table } from "@/components/table";
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
  getAuditActivity,
  getFullAuditLog,
} from "@/lib/api";
import { formatDate, inputClass, normalizeFieldLabel } from "@/lib/utils";
import { AuditPopover, HoverTooltip } from "@/components/shared-ui";
import { getCurrentUser } from "@/lib/auth";
import type {
  CognitoUser,
  CredentialRecord,
  CredentialSchemaRecord,
  PluginView,
  AuditLogItem,
  AuditActor,
} from "@/lib/types";

// ─── SettingsView ─────────────────────────────────────────────────────────────

function isComplexValue(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === "object") return true;
  if (typeof val === "string" && (val === "[previous]" || val === "[updated]"))
    return true;
  return false;
}

function humanizeAuditValue(val: unknown): string {
  if (val === null || val === undefined) return "\u2014";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "string") {
    const known: Record<string, string> = {
      name_to_abbr: "Name \u2192 Abbreviation",
      abbr_to_name: "Abbreviation \u2192 Name",
      round_robin: "Round Robin",
      weighted: "Weighted",
      round_robin_weighted: "Weighted Round Robin",
    };
    if (known[val]) return known[val];
    // snake_case values \u2192 human label
    if (/^[a-z][a-z0-9_]*$/.test(val)) return normalizeFieldLabel(val);
    return val;
  }
  return String(val);
}

function diffDeliveryConfig(
  from: unknown,
  to: unknown,
): { label: string; from: string; to: string }[] {
  if (!from || !to || typeof from !== "object" || typeof to !== "object") {
    return [{ label: "Config", from: "\u2014", to: "Updated" }];
  }
  const f = from as Record<string, unknown>;
  const t = to as Record<string, unknown>;
  const diffs: { label: string; from: string; to: string }[] = [];
  if (f.url !== t.url) {
    diffs.push({
      label: "URL",
      from: String(f.url ?? "\u2014"),
      to: String(t.url ?? "\u2014"),
    });
  }
  if (f.method !== t.method) {
    diffs.push({
      label: "Method",
      from: String(f.method ?? "\u2014"),
      to: String(t.method ?? "\u2014"),
    });
  }
  const fromMappings = Array.isArray(f.payload_mapping)
    ? f.payload_mapping
    : [];
  const toMappings = Array.isArray(t.payload_mapping) ? t.payload_mapping : [];
  if (fromMappings.length !== toMappings.length) {
    diffs.push({
      label: "Payload Fields",
      from: String(fromMappings.length),
      to: String(toMappings.length),
    });
  } else if (
    fromMappings.length > 0 &&
    JSON.stringify(fromMappings) !== JSON.stringify(toMappings)
  ) {
    diffs.push({
      label: "Payload Fields",
      from: `${fromMappings.length} fields`,
      to: "Modified",
    });
  }
  const fromRules = Array.isArray(f.acceptance_rules) ? f.acceptance_rules : [];
  const toRules = Array.isArray(t.acceptance_rules) ? t.acceptance_rules : [];
  if (fromRules.length !== toRules.length) {
    diffs.push({
      label: "Acceptance Rules",
      from: String(fromRules.length),
      to: String(toRules.length),
    });
  } else if (
    fromRules.length > 0 &&
    JSON.stringify(fromRules) !== JSON.stringify(toRules)
  ) {
    diffs.push({
      label: "Acceptance Rules",
      from: `${fromRules.length} rules`,
      to: "Modified",
    });
  }
  return diffs.length > 0
    ? diffs
    : [{ label: "Config", from: "\u2014", to: "Updated" }];
}

function extractReadableFieldLabel(field: string): string {
  const raw = field.replace(/^payload\./, "");
  // Dotted path \u2192 take the last segment
  if (raw.includes(".")) {
    return normalizeFieldLabel(raw.split(".").pop()!);
  }
  // Strip leading ID-like segments (all uppercase + digits)
  const parts = raw.split("_");
  let startIdx = 0;
  for (let i = 0; i < parts.length; i++) {
    if (/^[A-Z0-9]+$/.test(parts[i])) {
      startIdx = i + 1;
    } else {
      break;
    }
  }
  const semanticParts = startIdx > 0 ? parts.slice(startIdx) : parts;
  if (semanticParts.length === 0) return normalizeFieldLabel(raw);
  return normalizeFieldLabel(semanticParts.join("_"));
}

function formatAuditValue(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "object") {
    const o = val as Record<string, unknown>;
    if ("mode" in o) return `mode: ${o.mode}`;
    if ("enabled" in o) return `enabled: ${o.enabled}`;
    if ("url" in o || "method" in o) return "Config object";
    return "…";
  }
  return String(val);
}

function resolveAuditActor(actor?: AuditActor | null): string {
  if (!actor) return "System";
  return actor.full_name || actor.email || actor.username || "Unknown";
}

function auditActionLabel(action: string): string {
  const labels: Record<string, string> = {
    created: "Created",
    updated: "Updated",
    deleted: "Deleted",
    soft_deleted: "Deactivated",
    restored: "Restored",
    status_changed: "Status Changed",
    key_rotated: "Key Rotated",
    password_reset: "Password Reset",
    credential_enabled: "Credential Enabled",
    credential_disabled: "Credential Disabled",
    plugin_setting_enabled: "Integration Enabled",
    plugin_setting_disabled: "Integration Disabled",
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
): "success" | "danger" | "info" | "warning" | "neutral" {
  if (
    action === "created" ||
    action === "restored" ||
    action === "lead_delivered" ||
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
    action === "password_reset" ||
    action === "delivery_skipped"
  )
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
  if (!value) return "\u2014";
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

interface SettingsViewProps {
  role?: string;
}

type SettingsSectionKey =
  | "saved-credentials"
  | "schemas"
  | "plugin-settings"
  | "users"
  | "logs";

// ── Main SettingsView ─────────────────────────────────────────────────────────

export function SettingsView({ role }: SettingsViewProps) {
  const currentUserEmail = getCurrentUser()?.email;

  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // ── URL-derived state ──────────────────────────────────────────────────────
  const VALID_SECTIONS: SettingsSectionKey[] = [
    "saved-credentials",
    "schemas",
    "plugin-settings",
    "users",
    "logs",
  ];
  const rawSection = searchParams?.get("settings_section");
  const activeSection: SettingsSectionKey = (
    VALID_SECTIONS.includes(rawSection as SettingsSectionKey)
      ? rawSection
      : "saved-credentials"
  ) as SettingsSectionKey;
  const logsEntityType = searchParams?.get("logs_entity") ?? "";
  const logsActorSub = searchParams?.get("logs_actor") ?? "";
  const logsSort = (searchParams?.get("logs_sort") ?? "newest") as
    | "newest"
    | "oldest";

  const setSettingsParams = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    Object.entries(next).forEach(([key, value]) => {
      if (value === undefined || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const setActiveSection = (key: SettingsSectionKey) =>
    setSettingsParams({ settings_section: key });

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
        return `?view=settings&settings_section=users`;
      case "credential":
        return `?view=settings&settings_section=saved-credentials`;
      case "credential_schema":
        return `?view=settings&settings_section=schemas`;
      case "plugin_setting":
        return `?view=settings&settings_section=plugin-settings`;
      default:
        return `?view=settings`;
    }
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

  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) => {
    setExpandedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Logs filters (derived from URL — see above)

  // ── Data fetching ────────────────────────────────────────────────────────────

  const {
    data: users = [],
    isLoading: usersLoading,
    mutate: refreshUsers,
  } = useSWR<CognitoUser[]>(
    activeSection === "users" ? "users" : null,
    async () => {
      try {
        const res = await listUsers();
        return (res as any)?.data || [];
      } catch (error) {
        console.warn("Users listing not available", error);
        return [] as CognitoUser[];
      }
    },
  );

  const {
    data: credentials = [],
    isLoading: credsLoading,
    mutate: refreshCreds,
  } = useSWR<CredentialRecord[]>(
    activeSection !== "users" ? "credentials" : null,
    async () => {
      try {
        const res = await listCredentials();
        return (res as any)?.data?.items || (res as any)?.data || [];
      } catch (err) {
        console.warn("Credentials listing not available", err);
        return [] as CredentialRecord[];
      }
    },
  );

  const {
    data: schemas = [],
    isLoading: schemasLoading,
    mutate: refreshSchemas,
  } = useSWR<CredentialSchemaRecord[]>(
    activeSection !== "users" ? "credential-schemas" : null,
    async () => {
      try {
        const res = await listCredentialSchemas();
        return (res as any)?.data?.items || (res as any)?.data || [];
      } catch (err) {
        console.warn("Credential schemas not available", err);
        return [] as CredentialSchemaRecord[];
      }
    },
  );

  const {
    data: pluginSettings = [],
    isLoading: pluginSettingsLoading,
    mutate: refreshPluginSettings,
  } = useSWR<PluginView[]>(
    activeSection === "plugin-settings" ? "plugin-settings" : null,
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
  );

  const {
    data: logsRaw = [],
    isLoading: logsLoading,
    mutate: refreshLogs,
  } = useSWR<AuditLogItem[]>(
    activeSection === "logs"
      ? logsEntityType
        ? // When an entity type is selected, hit /audit/activity (supports both
          // entity_type and actor_sub filters server-side).
          ["audit-logs-activity", logsEntityType, logsActorSub]
        : // When "All" is selected, use the full-scan endpoint and cache on a
          // stable key (no actor_sub) so changing the actor doesn't re-fetch —
          // actor filtering is done client-side from the full dataset.
          ["audit-logs-all"]
      : null,
    async () => {
      try {
        const res = !logsEntityType
          ? await getFullAuditLog({ limit: 200 })
          : await getAuditActivity({
              entity_type: logsEntityType,
              actor_sub: logsActorSub || undefined,
              limit: 200,
            });
        return res?.data?.items ?? [];
      } catch (err) {
        console.warn("Audit activity not available", err);
        return [] as AuditLogItem[];
      }
    },
    { revalidateOnFocus: true, refreshInterval: 30_000 },
  );

  // Actor filtering is always done client-side so the full actor list is
  // preserved in the dropdown regardless of which user is selected.
  const logsActorFiltered = useMemo(() => {
    if (!logsActorSub) return logsRaw;
    return logsRaw.filter((item) => item.actor?.sub === logsActorSub);
  }, [logsRaw, logsActorSub]);

  const logsItems = useMemo(() => {
    const sorted = [...logsActorFiltered].sort((a, b) => {
      const ta = a.changed_at ? new Date(a.changed_at).getTime() : 0;
      const tb = b.changed_at ? new Date(b.changed_at).getTime() : 0;
      return logsSort === "oldest" ? ta - tb : tb - ta;
    });
    return sorted;
  }, [logsActorFiltered, logsSort]);

  // Build a set of entity IDs whose last-known action in the loaded log is
  // deletion. Used to swap navigation links for a tooltip on deleted records.
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
    // Also flag credential/schema IDs that are loaded but absent from current data
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

  // Scroll shadow state for the log panel fades
  const logScrollRef = useRef<HTMLDivElement>(null);
  const [logScrollState, setLogScrollState] = useState({
    atTop: true,
    atBottom: false,
  });
  const handleLogScroll = () => {
    const el = logScrollRef.current;
    if (!el) return;
    const atTop = el.scrollTop <= 4;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
    setLogScrollState({ atTop, atBottom });
  };

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

  // ── Render ───────────────────────────────────────────────────────────────────

  const navItems: {
    key: SettingsSectionKey;
    label: string;
    group: "integrations" | "users" | "platform";
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
    ...(role === "admin"
      ? [
          {
            key: "users" as SettingsSectionKey,
            label: "Manage",
            group: "users" as const,
            icon: <UserCog size={14} />,
          },
          {
            key: "logs" as SettingsSectionKey,
            label: "Logs",
            group: "platform" as const,
            icon: <Activity size={14} />,
          },
        ]
      : []),
  ];

  const NavBtn = ({ item }: { item: (typeof navItems)[number] }) => (
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

  const integrationItems = navItems.filter((i) => i.group === "integrations");
  const userItems = navItems.filter((i) => i.group === "users");
  const platformItems = navItems.filter((i) => i.group === "platform");

  return (
    <motion.section
      key="settings"
      className="space-y-5"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      {/* Two-column layout: left sidebar nav + right content */}
      <div className="flex gap-6 items-start">
        {/* ── Left sidebar nav ──────────────────────────────────────────────── */}
        <nav className="w-[188px] shrink-0 rounded-xl border border-[--color-border] bg-[--color-panel] p-2 space-y-0.5">
          <p className="px-3 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-widest text-[--color-text-muted]">
            Integrations
          </p>
          {integrationItems.map((item) => (
            <NavBtn key={item.key} item={item} />
          ))}
          {userItems.length > 0 && (
            <>
              <div className="mx-1 my-1.5 border-t border-[--color-border]" />
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[--color-text-muted]">
                Users
              </p>
              {userItems.map((item) => (
                <NavBtn key={item.key} item={item} />
              ))}
            </>
          )}
          {platformItems.length > 0 && (
            <>
              <div className="mx-1 my-1.5 border-t border-[--color-border]" />
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[--color-text-muted]">
                Platform
              </p>
              {platformItems.map((item) => (
                <NavBtn key={item.key} item={item} />
              ))}
            </>
          )}
        </nav>

        {/* ── Right content ─────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            {/* ── Saved Credentials ── */}
            {activeSection === "saved-credentials" && (
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
                        <span className="font-mono text-xs">{c.provider}</span>
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
            {activeSection === "schemas" && (
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
                {schemasLoading ? (
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
            {activeSection === "plugin-settings" && (
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
                {pluginSettingsLoading || credsLoading ? (
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
            {activeSection === "users" && (
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

            {/* ── Logs ── */}
            {activeSection === "logs" && (
              <motion.div
                key="logs"
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
                        Activity
                      </span>
                    </div>
                    {!logsLoading && logsItems.length > 0 && (
                      <span className="rounded-full bg-[--color-bg-muted] px-2.5 py-0.5 text-xs font-medium text-[--color-text-muted]">
                        {logsItems.length} events
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
                        User
                      </span>
                      <select
                        className="rounded-lg border border-[--color-border] bg-[--color-panel] px-2.5 py-1.5 text-sm text-[--color-text] outline-none transition focus:border-[--color-primary]"
                        value={logsActorSub}
                        onChange={(e) =>
                          setSettingsParams({
                            logs_actor: e.target.value || undefined,
                          })
                        }
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
                        onClick={() =>
                          setSettingsParams({
                            logs_sort:
                              logsSort === "newest" ? "oldest" : undefined,
                          })
                        }
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

                {/* Entity type filter chips */}
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
                    const meta = value ? getEntityTypeMeta(value) : null;
                    const isActive = logsEntityType === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setExpandedLogIds(new Set());
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
                          <span className="opacity-80">{meta.icon}</span>
                        )}
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* Scrollable log panel */}
                <div className="relative overflow-hidden rounded-xl border border-[--color-border] bg-[--color-panel]">
                  <AnimatePresence mode="wait">
                    {logsLoading ? (
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
                        className="h-[72vh] divide-y divide-[--color-border] overflow-y-auto"
                        ref={logScrollRef}
                        onScroll={handleLogScroll}
                      >
                        {logsItems.map((item) => {
                          const meta = getEntityTypeMeta(item.entity_type);
                          const isExpanded = expandedLogIds.has(item.log_id);
                          const hasChanges = item.changes.length > 0;
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
                                  {auditActionLabel(item.action)}
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
                                        router.push(
                                          getEntityUrl(
                                            item.entity_type,
                                            item.entity_id,
                                            item.action,
                                          ),
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
                                      const isCriteriaAddEvent =
                                        item.action === "criteria_field_added";

                                      const filtered = item.changes
                                        .filter(
                                          (c) =>
                                            c.field !== "field_id" &&
                                            c.field !== "rule_id",
                                        )
                                        .filter((change) => {
                                          // Always keep delivery_config — handled with sub-diff
                                          if (
                                            change.field ===
                                              "delivery_config" ||
                                            change.field.endsWith(
                                              ".delivery_config",
                                            )
                                          )
                                            return true;
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
                                        // Collapse mappings into a single human-readable summary
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

                                      // Logic rule: show name + action as summary at top
                                      const ruleNameVal = isLogicRuleEvent
                                        ? filtered.find(
                                            (c) => c.field === "name",
                                          )?.to
                                        : null;
                                      const ruleActionVal = isLogicRuleEvent
                                        ? filtered.find(
                                            (c) => c.field === "action",
                                          )?.to
                                        : null;

                                      return filtered.map((change, i) => {
                                        // ── Delivery config: show sub-diff ──
                                        if (
                                          change.field === "delivery_config" ||
                                          change.field.endsWith(
                                            ".delivery_config",
                                          )
                                        ) {
                                          const subDiffs = diffDeliveryConfig(
                                            change.from,
                                            change.to,
                                          );
                                          return (
                                            <div
                                              key={`${item.log_id}-${i}`}
                                              className="grid grid-cols-[8rem_1fr] items-start gap-2 text-[11px]"
                                            >
                                              <span className="truncate font-medium text-[--color-text]">
                                                Delivery Config
                                              </span>
                                              <div className="space-y-1">
                                                {subDiffs.map((d, j) => (
                                                  <div
                                                    key={j}
                                                    className="flex items-center gap-1.5"
                                                  >
                                                    <span className="w-28 shrink-0 text-[--color-text-muted]">
                                                      {d.label}
                                                    </span>
                                                    <span className="max-w-[120px] truncate line-through opacity-60">
                                                      {d.from}
                                                    </span>
                                                    <ArrowRight
                                                      size={9}
                                                      className="shrink-0"
                                                    />
                                                    <span className="max-w-[120px] truncate font-medium text-[--color-text]">
                                                      {d.to}
                                                    </span>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          );
                                        }

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

                                        const fieldLabel =
                                          extractReadableFieldLabel(
                                            change.field,
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
                                                {Array.isArray(change.from) &&
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
                                                {humanizeAuditValue(change.to)}
                                              </span>
                                            ) : (
                                              <span className="flex min-w-0 items-center gap-1.5 text-[--color-text-muted]">
                                                <span className="max-w-[160px] truncate line-through">
                                                  {humanizeAuditValue(
                                                    change.from,
                                                  )}
                                                </span>
                                                <ArrowRight
                                                  size={9}
                                                  className="shrink-0"
                                                />
                                                <span className="max-w-[160px] truncate font-medium text-[--color-text]">
                                                  {humanizeAuditValue(
                                                    change.to,
                                                  )}
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
                  <div
                    className={`pointer-events-none absolute inset-x-0 top-0 h-20 rounded-t-xl bg-gradient-to-b from-[--color-panel] to-transparent transition-opacity duration-200 ${
                      logScrollState.atTop ? "opacity-0" : "opacity-100"
                    }`}
                  />
                  <div
                    className={`pointer-events-none absolute inset-x-0 bottom-0 h-20 rounded-b-xl bg-gradient-to-t from-[--color-panel] to-transparent transition-opacity duration-200 ${
                      logScrollState.atBottom ? "opacity-0" : "opacity-100"
                    }`}
                  />
                </div>
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
    </motion.section>
  );
}
