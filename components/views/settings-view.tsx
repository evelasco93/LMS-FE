"use client";

import { useMemo, useState } from "react";
import { KeyRound, RotateCcw, UserCog, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import useSWR from "swr";
import { Table } from "@/components/table";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { DeleteConfirmModal } from "@/components/modals/delete-confirm-modal";
import {
  CreateUserModal,
  EditUserModal,
  ResetPasswordModal,
} from "@/components/modals/user-modals";
import {
  createUser,
  deleteUser,
  enableUser,
  listUsers,
  resetUserPassword,
  updateUser,
} from "@/lib/api";
import { formatDate, inputClass } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth";
import type { CognitoUser } from "@/lib/types";

// ─── SettingsView ─────────────────────────────────────────────────────────────

interface SettingsViewProps {
  role?: string;
}

export function SettingsView({ role }: SettingsViewProps) {
  // Identify the currently logged-in user so we can block self-deactivation.
  const currentUserEmail = getCurrentUser()?.email;

  const [settingsTab, setSettingsTab] = useState<"credentials" | "users">(
    "credentials",
  );
  const [userSearch, setUserSearch] = useState("");
  const [showDisabled, setShowDisabled] = useState(false);

  // User modals
  const [userCreateModal, setUserCreateModal] = useState(false);
  const [userEditModal, setUserEditModal] = useState(false);
  const [userResetModal, setUserResetModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CognitoUser | null>(null);
  const [editingUser, setEditingUser] = useState<CognitoUser | null>(null);
  const [resetPasswordUser, setResetPasswordUser] =
    useState<CognitoUser | null>(null);

  const {
    data: users = [],
    isLoading: usersLoading,
    mutate: refreshUsers,
  } = useSWR<CognitoUser[]>(
    settingsTab === "users" ? "users" : null,
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

  // Filter: by search and enabled/disabled toggle
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

  // ── Handlers ────────────────────────────────────────────────────────────────

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

  const onUpdateUser = async (
    id: string,
    payload: {
      role?: "admin" | "staff";
      firstName?: string;
      lastName?: string;
    },
  ) => {
    await toast.promise(
      (async () => {
        const res = await updateUser(id, payload);
        if (!(res as any)?.success)
          throw new Error((res as any)?.message || "Unable to update user");
        await refreshUsers();
        setUserEditModal(false);
        setEditingUser(null);
      })(),
      {
        loading: "Updating user…",
        success: "User updated",
        error: (err) => err?.message || "Unable to update user",
      },
    );
  };

  const onResetUserPassword = async (id: string, password: string) => {
    await toast.promise(
      (async () => {
        const res = await resetUserPassword(id, password);
        if (!(res as any)?.success)
          throw new Error((res as any)?.message || "Unable to reset password");
        await refreshUsers();
        setUserResetModal(false);
        setResetPasswordUser(null);
      })(),
      {
        loading: "Resetting password…",
        success: "Password reset",
        error: (err) => err?.message || "Unable to reset password",
      },
    );
  };

  const onDeleteUser = async (permanent: boolean) => {
    if (!deleteTarget) return;
    await toast.promise(
      (async () => {
        const res = await deleteUser(deleteTarget.username, permanent);
        if (!(res as any)?.success)
          throw new Error(
            (res as any)?.message ||
              (permanent
                ? "Unable to delete user"
                : "Unable to deactivate user"),
          );
        await refreshUsers();
        setDeleteTarget(null);
      })(),
      {
        loading: permanent ? "Deleting user…" : "Deactivating user…",
        success: permanent ? "User permanently deleted" : "User deactivated",
        error: (err) =>
          err?.message ||
          (permanent ? "Unable to delete user" : "Unable to deactivate user"),
      },
    );
  };

  const onReEnableUser = async (u: CognitoUser) => {
    await toast.promise(
      (async () => {
        const res = await enableUser(u.username);
        if (!(res as any)?.success)
          throw new Error((res as any)?.message || "Unable to re-enable user");
        await refreshUsers();
      })(),
      {
        loading: "Re-enabling user…",
        success: "User re-enabled",
        error: (err) => err?.message || "Unable to re-enable user",
      },
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <motion.section
      key="settings"
      className="space-y-5"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      {/* Sub-nav tabs */}
      <div className="flex gap-1 rounded-lg border border-[--color-border] bg-[--color-panel] p-1 w-fit">
        {(["credentials", "users"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setSettingsTab(tab)}
            className={
              settingsTab === tab
                ? "rounded-md px-4 py-1.5 text-sm font-medium bg-[--color-primary] text-white transition-colors"
                : "rounded-md px-4 py-1.5 text-sm font-medium text-[--color-text-muted] hover:text-[--color-text] transition-colors"
            }
          >
            {tab === "credentials" ? "Credentials" : "Users"}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {settingsTab === "credentials" && (
          <motion.div
            key="credentials"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="space-y-4"
          >
            <div className="rounded-2xl border border-dashed border-[--color-border] bg-[--color-panel] p-12 text-center text-[--color-text-muted]">
              <p className="text-3xl mb-3">🔑</p>
              <p className="font-medium text-[--color-text-strong]">
                Third-Party Integrations
              </p>
              <p className="mt-1 text-sm">
                Manage API credentials for services like IPQS and TrustedForm
                here. Coming soon.
              </p>
            </div>
          </motion.div>
        )}

        {settingsTab === "users" && (
          <motion.div
            key="users"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
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
                    [u.firstName, u.lastName].filter(Boolean).join(" ") || "—",
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
                    <Badge tone={u.enabled !== false ? "success" : "danger"}>
                      {u.enabled !== false
                        ? u.status || "Confirmed"
                        : "Deactivated"}
                    </Badge>
                  ),
                },
                {
                  key: "createdAt",
                  label: "Created",
                  render: (u) => (u.createdAt ? formatDate(u.createdAt) : "—"),
                },
                {
                  key: "actions",
                  label: "Actions",
                  render: (u) =>
                    u.enabled === false ? (
                      // Deactivated user — Re-enable or permanently delete
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          iconLeft={<RotateCcw size={14} />}
                          onClick={() => onReEnableUser(u)}
                        >
                          Re-enable
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setDeleteTarget(u)}
                        >
                          Delete
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          iconLeft={<UserCog size={14} />}
                          onClick={() => {
                            setEditingUser(u);
                            setUserEditModal(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          iconLeft={<KeyRound size={14} />}
                          onClick={() => {
                            setResetPasswordUser(u);
                            setUserResetModal(true);
                          }}
                        >
                          Reset PW
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={u.email === currentUserEmail}
                          title={
                            u.email === currentUserEmail
                              ? "You cannot deactivate your own account"
                              : undefined
                          }
                          onClick={() => {
                            if (u.email !== currentUserEmail)
                              setDeleteTarget(u);
                          }}
                        >
                          Deactivate
                        </Button>
                      </div>
                    ),
                },
              ]}
              data={filteredUsers}
              emptyLabel={usersLoading ? "Loading users…" : "No users found."}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <CreateUserModal
        isOpen={userCreateModal}
        onClose={() => setUserCreateModal(false)}
        onSubmit={onCreateUser}
      />
      <EditUserModal
        user={editingUser}
        isOpen={userEditModal}
        onClose={() => {
          setUserEditModal(false);
          setEditingUser(null);
        }}
        onSubmit={onUpdateUser}
      />
      <ResetPasswordModal
        user={resetPasswordUser}
        isOpen={userResetModal}
        onClose={() => {
          setUserResetModal(false);
          setResetPasswordUser(null);
        }}
        onSubmit={onResetUserPassword}
      />
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={onDeleteUser}
        entityType="user"
        entityName={deleteTarget?.email || ""}
        canHardDelete={true}
      />
    </motion.section>
  );
}
