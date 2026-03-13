"use client";

import { useMemo, useState } from "react";
import { Plug, PlusCircle, UserPlus } from "lucide-react";
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
} from "@/lib/api";
import { formatDate, inputClass } from "@/lib/utils";
import { AuditPopover } from "@/components/shared-ui";
import { getCurrentUser } from "@/lib/auth";
import type {
  CognitoUser,
  CredentialRecord,
  CredentialSchemaRecord,
  PluginView,
} from "@/lib/types";

// ─── SettingsView ─────────────────────────────────────────────────────────────

interface SettingsViewProps {
  role?: string;
}

type SettingsSectionKey =
  | "saved-credentials"
  | "schemas"
  | "plugin-settings"
  | "users";

// ── Main SettingsView ─────────────────────────────────────────────────────────

export function SettingsView({ role }: SettingsViewProps) {
  const currentUserEmail = getCurrentUser()?.email;

  const [activeSection, setActiveSection] =
    useState<SettingsSectionKey>("saved-credentials");
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
    group: "integrations" | "users";
    indent?: boolean;
  }[] = [
    {
      key: "saved-credentials",
      label: "Credentials",
      group: "integrations",
    },
    { key: "schemas", label: "Schemas", group: "integrations", indent: true },
    { key: "plugin-settings", label: "Plugin Settings", group: "integrations" },
    ...(role === "admin"
      ? [
          {
            key: "users" as SettingsSectionKey,
            label: "Manage",
            group: "users" as const,
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
      {item.indent && (
        <span className="mr-1.5 text-[--color-text-muted] opacity-50">└</span>
      )}
      {item.label}
    </button>
  );

  const integrationItems = navItems.filter((i) => i.group === "integrations");
  const userItems = navItems.filter((i) => i.group === "users");

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
                                  editHistory={plugin.edit_history}
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
