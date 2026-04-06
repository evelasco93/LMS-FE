"use client";

import type React from "react";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import { Badge } from "@/components/badge";
import { Field } from "@/components/ui/field";
import { inputClass, formatDate } from "@/lib/utils";
import {
  updateUser,
  resetUserPassword,
  deleteUser,
  enableUser,
} from "@/lib/api";
import type { CognitoUser } from "@/lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generates a random 12-char password meeting common complexity rules. */
export const generatePassword = (): string => {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%";
  const all = upper + lower + digits + special;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  const base = [pick(upper), pick(lower), pick(digits), pick(special)];
  const rest = Array.from({ length: 8 }, () => pick(all));
  return [...base, ...rest].sort(() => Math.random() - 0.5).join("");
};

// ─── CreateUserModal ──────────────────────────────────────────────────────────

export function CreateUserModal({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    role: "admin" | "staff";
  }) => void;
}) {
  const blank = {
    email: "",
    firstName: "",
    lastName: "",
    role: "staff" as "admin" | "staff",
    password: "",
  };
  const [form, setForm] = useState(blank);
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setForm(blank);
      setShowPass(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleGenerate = () => {
    setForm((prev) => ({ ...prev, password: generatePassword() }));
    setShowPass(true);
  };

  const handleCopy = () => {
    if (!form.password) return;
    navigator.clipboard
      .writeText(form.password)
      .then(() => toast.success("Password copied to clipboard"));
  };

  return (
    <Modal title="Create User" isOpen={isOpen} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            email: form.email.trim(),
            password: form.password,
            firstName: form.firstName.trim() || undefined,
            lastName: form.lastName.trim() || undefined,
            role: form.role,
          });
        }}
      >
        <Field label="Email" required>
          <input
            required
            type="email"
            className={inputClass}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="jane@example.com"
            autoComplete="off"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <input
              className={inputClass}
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              placeholder="Jane"
              autoComplete="off"
            />
          </Field>
          <Field label="Last name">
            <input
              className={inputClass}
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              placeholder="Doe"
              autoComplete="off"
            />
          </Field>
        </div>
        <Field label="Role" required>
          <select
            className={inputClass}
            value={form.role}
            onChange={(e) =>
              setForm({ ...form, role: e.target.value as "admin" | "staff" })
            }
          >
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
        <Field label="Password" required>
          <div className="flex gap-2">
            <input
              required
              type={showPass ? "text" : "password"}
              className={`${inputClass} min-w-0 flex-1`}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Min 8 chars"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="shrink-0 px-1 text-[--color-text-muted] hover:text-[--color-text] transition-colors"
              title={showPass ? "Hide" : "Show"}
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={handleGenerate}
            >
              Generate
            </Button>
            <Button
              size="sm"
              variant="outline"
              type="button"
              iconLeft={<Copy size={14} />}
              onClick={handleCopy}
              disabled={!form.password}
            >
              Copy
            </Button>
          </div>
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Create User</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── EditUserModal ────────────────────────────────────────────────────────────

export function EditUserModal({
  user,
  isOpen,
  onClose,
  onSubmit,
}: {
  user: CognitoUser | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    id: string,
    payload: {
      role?: "admin" | "staff";
      firstName?: string;
      lastName?: string;
    },
  ) => void;
}) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    role: "staff" as "admin" | "staff",
  });

  useEffect(() => {
    if (user) {
      setForm({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        role: user.role,
      });
    }
  }, [user]);

  if (!user) return null;

  return (
    <Modal title="Edit User" isOpen={isOpen} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(user.username, {
            firstName: form.firstName.trim() || undefined,
            lastName: form.lastName.trim() || undefined,
            role: form.role,
          });
        }}
      >
        <div className="rounded-lg border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text-muted]">
          {user.email}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <input
              className={inputClass}
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              placeholder="Jane"
            />
          </Field>
          <Field label="Last name">
            <input
              className={inputClass}
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              placeholder="Doe"
            />
          </Field>
        </div>
        <Field label="Role">
          <select
            className={inputClass}
            value={form.role}
            onChange={(e) =>
              setForm({ ...form, role: e.target.value as "admin" | "staff" })
            }
          >
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save Changes</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── ResetPasswordModal ───────────────────────────────────────────────────────

export function ResetPasswordModal({
  user,
  isOpen,
  onClose,
  onSubmit,
}: {
  user: CognitoUser | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (id: string, password: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setPassword("");
      setShowPass(false);
    }
  }, [isOpen]);

  if (!user) return null;

  const handleGenerate = () => {
    const pw = generatePassword();
    setPassword(pw);
    setShowPass(true);
  };

  const handleCopy = () => {
    if (!password) return;
    navigator.clipboard
      .writeText(password)
      .then(() => toast.success("Password copied to clipboard"));
  };

  return (
    <Modal title="Reset Password" isOpen={isOpen} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(user.username, password);
        }}
      >
        <p className="text-sm text-[--color-text-muted]">
          Set a new password for{" "}
          <strong className="text-[--color-text-strong]">{user.email}</strong>
        </p>
        <Field label="New Password" required>
          <div className="flex gap-2">
            <input
              required
              type={showPass ? "text" : "password"}
              className={`${inputClass} min-w-0 flex-1`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 chars"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="shrink-0 px-1 text-[--color-text-muted] hover:text-[--color-text] transition-colors"
              title={showPass ? "Hide" : "Show"}
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={handleGenerate}
            >
              Generate
            </Button>
            <Button
              size="sm"
              variant="outline"
              type="button"
              iconLeft={<Copy size={14} />}
              onClick={handleCopy}
              disabled={!password}
            >
              Copy
            </Button>
          </div>
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Reset Password</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── UserDetailModal ──────────────────────────────────────────────────────────

export function UserDetailModal({
  user,
  isOpen,
  onClose,
  currentUserEmail,
  onSuccess,
}: {
  user: CognitoUser | null;
  isOpen: boolean;
  onClose: () => void;
  currentUserEmail?: string;
  onSuccess: () => void;
}) {
  const isActive = user?.enabled !== false;
  const isSelf = user?.email === currentUserEmail;

  // Edit state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [userRole, setUserRole] = useState<"admin" | "staff">("staff");
  const [saving, setSaving] = useState(false);

  // Reset password state
  const [showReset, setShowReset] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showPassValue, setShowPassValue] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Deactivate / delete state
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [deactivateConfirm, setDeactivateConfirm] = useState("");
  const [deactivating, setDeactivating] = useState(false);

  // Re-enable
  const [reenabling, setReenabling] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      setUserRole(user.role ?? "staff");
      setShowReset(false);
      setNewPassword("");
      setShowPassValue(false);
      setShowDeactivate(false);
      setDeactivateConfirm("");
    }
  }, [isOpen, user]);

  const handleClose = () => {
    setShowReset(false);
    setShowDeactivate(false);
    setDeactivateConfirm("");
    setNewPassword("");
    onClose();
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const res = await updateUser(user.username, {
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        role: userRole,
      });
      if (!(res as any)?.success)
        throw new Error((res as any)?.message || "Failed to update user");
      toast.success("User updated");
      onSuccess();
      handleClose();
    } catch (err: any) {
      toast.error(err?.message || "Unable to update user");
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePassword = () => {
    setNewPassword(generatePassword());
    setShowPassValue(true);
  };

  const handleCopyPassword = () => {
    if (!newPassword) return;
    navigator.clipboard
      .writeText(newPassword)
      .then(() => toast.success("Password copied to clipboard"));
  };

  const handleResetPassword = async () => {
    if (!user || !newPassword.trim()) return;
    setResetting(true);
    try {
      const res = await resetUserPassword(user.username, newPassword);
      if (!(res as any)?.success)
        throw new Error((res as any)?.message || "Failed to reset password");
      toast.success("Password reset");
      setShowReset(false);
      setNewPassword("");
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message || "Unable to reset password");
    } finally {
      setResetting(false);
    }
  };

  const handleDeactivate = async () => {
    if (!user) return;
    setDeactivating(true);
    try {
      const res = await deleteUser(user.username, false);
      if (!(res as any)?.success)
        throw new Error((res as any)?.message || "Failed to deactivate user");
      toast.success("User deactivated");
      onSuccess();
      handleClose();
    } catch (err: any) {
      toast.error(err?.message || "Unable to deactivate user");
    } finally {
      setDeactivating(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!user) return;
    setDeactivating(true);
    try {
      const res = await deleteUser(user.username, true);
      if (!(res as any)?.success)
        throw new Error(
          (res as any)?.message || "Failed to permanently delete user",
        );
      toast.success("User permanently deleted");
      onSuccess();
      handleClose();
    } catch (err: any) {
      toast.error(err?.message || "Unable to delete user");
    } finally {
      setDeactivating(false);
    }
  };

  const handleReEnable = async () => {
    if (!user) return;
    setReenabling(true);
    try {
      const res = await enableUser(user.username);
      if (!(res as any)?.success)
        throw new Error((res as any)?.message || "Failed to re-enable user");
      toast.success("User re-enabled");
      onSuccess();
      handleClose();
    } catch (err: any) {
      toast.error(err?.message || "Unable to re-enable user");
    } finally {
      setReenabling(false);
    }
  };

  if (!user) return null;

  const expandBtn = (
    label: string,
    open: boolean,
    toggle: () => void,
    danger = false,
    disabled = false,
  ) => (
    <button
      type="button"
      disabled={disabled}
      title={
        disabled && danger && isSelf
          ? "You cannot deactivate your own account"
          : undefined
      }
      onClick={toggle}
      className={`flex w-full items-center justify-between text-sm font-medium transition-opacity disabled:opacity-40 ${
        danger
          ? "text-[--color-danger] hover:opacity-80"
          : "text-[--color-text] hover:text-[--color-primary]"
      }`}
    >
      <span>{label}</span>
      <motion.span
        animate={{ rotate: open ? 180 : 0 }}
        transition={{ duration: 0.18 }}
        className="opacity-60"
      >
        ▾
      </motion.span>
    </button>
  );

  return (
    <Modal
      title={
        <span className="flex items-center gap-2 flex-wrap">
          <span className="truncate">
            {[user.firstName, user.lastName].filter(Boolean).join(" ") ||
              user.email}
          </span>
          <Badge tone={isActive ? "success" : "danger"}>
            {isActive ? "Active" : "Deactivated"}
          </Badge>
          <Badge tone={user.role === "admin" ? "info" : "neutral"}>
            {user.role}
          </Badge>
        </span>
      }
      isOpen={isOpen}
      onClose={handleClose}
      width={480}
    >
      <div
        className="flex flex-col gap-5 text-sm overflow-y-auto"
        style={{ minHeight: 360, maxHeight: 540 }}
      >
        {/* Email info bar */}
        <div className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] px-3 py-2 font-mono text-xs text-[--color-text-muted]">
          {user.email}
          {user.createdAt && (
            <span className="ml-2 text-[--color-text-muted]/60">
              · joined {formatDate(user.createdAt)}
            </span>
          )}
        </div>

        {isActive ? (
          <>
            {/* ── Edit fields ── */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                    First name
                  </p>
                  <input
                    className={inputClass}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jane"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                    Last name
                  </p>
                  <input
                    className={inputClass}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                  Role
                </p>
                <select
                  className={inputClass}
                  value={userRole}
                  onChange={(e) =>
                    setUserRole(e.target.value as "admin" | "staff")
                  }
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex justify-end">
                <Button disabled={saving} onClick={handleSave}>
                  {saving ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </div>

            <div className="border-t border-[--color-border]" />

            {/* ── Reset Password expandable ── */}
            <div className="space-y-2">
              {expandBtn(
                (
                  <span className="flex items-center gap-2">
                    <KeyRound size={14} />
                    Reset Password
                  </span>
                ) as any,
                showReset,
                () => {
                  setShowReset((v) => !v);
                  setNewPassword("");
                  setShowPassValue(false);
                },
              )}
              <AnimatePresence initial={false}>
                {showReset && (
                  <motion.div
                    key="reset-pass"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    style={{ overflow: "hidden" }}
                  >
                    <div className="pt-2 space-y-3">
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                          New Password
                        </p>
                        <div className="flex gap-2">
                          <input
                            type={showPassValue ? "text" : "password"}
                            className={`${inputClass} flex-1 min-w-0`}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Min 8 chars"
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassValue((v) => !v)}
                            className="shrink-0 px-1 text-[--color-text-muted] hover:text-[--color-text] transition"
                          >
                            {showPassValue ? (
                              <EyeOff size={16} />
                            ) : (
                              <Eye size={16} />
                            )}
                          </button>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            type="button"
                            onClick={handleGeneratePassword}
                          >
                            Generate
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            type="button"
                            iconLeft={<Copy size={14} />}
                            onClick={handleCopyPassword}
                            disabled={!newPassword}
                          >
                            Copy
                          </Button>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowReset(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          disabled={resetting || !newPassword.trim()}
                          onClick={handleResetPassword}
                        >
                          {resetting ? "Resetting…" : "Reset Password"}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="border-t border-[--color-border]" />

            {/* ── Deactivate expandable ── */}
            <div className="space-y-2">
              {expandBtn(
                (
                  <span className="flex items-center gap-2">
                    Deactivate User
                  </span>
                ) as any,
                showDeactivate,
                () => {
                  if (!isSelf) {
                    setShowDeactivate((v) => !v);
                    setDeactivateConfirm("");
                  }
                },
                true,
                isSelf,
              )}
              <AnimatePresence initial={false}>
                {showDeactivate && (
                  <motion.div
                    key="deactivate"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    style={{ overflow: "hidden" }}
                  >
                    <div className="pt-2 space-y-3">
                      <div className="flex items-start gap-3 rounded-lg border border-[--color-danger]/30 bg-[--color-danger]/5 px-4 py-3">
                        <AlertTriangle
                          size={15}
                          className="mt-0.5 shrink-0 text-[--color-danger]"
                        />
                        <p className="text-xs text-[--color-text-muted]">
                          The user will be deactivated and lose access. You can
                          re-enable them later.
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-[--color-text-muted]">
                          Type{" "}
                          <span className="font-mono font-semibold text-[--color-text-strong]">
                            {user.email}
                          </span>{" "}
                          to confirm
                        </p>
                        <input
                          className={inputClass}
                          placeholder={user.email}
                          value={deactivateConfirm}
                          onChange={(e) => setDeactivateConfirm(e.target.value)}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowDeactivate(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={
                            deactivating ||
                            deactivateConfirm.trim() !== user.email.trim()
                          }
                          onClick={handleDeactivate}
                        >
                          {deactivating ? "Deactivating…" : "Deactivate User"}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        ) : (
          <>
            {/* ── Deactivated user: Re-enable ── */}
            <div className="rounded-lg border border-amber-400/40 bg-amber-50/60 dark:bg-amber-900/10 px-4 py-3 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle
                  size={15}
                  className="mt-0.5 shrink-0 text-amber-500"
                />
                <p className="text-xs text-[--color-text-muted]">
                  This account is deactivated. The user cannot log in.
                </p>
              </div>
              <Button
                iconLeft={<RotateCcw size={14} />}
                disabled={reenabling}
                onClick={handleReEnable}
              >
                {reenabling ? "Re-enabling…" : "Re-enable Account"}
              </Button>
            </div>

            <div className="border-t border-[--color-border]" />

            {/* ── Permanent delete expandable ── */}
            <div className="space-y-2">
              {expandBtn(
                (
                  <span className="flex items-center gap-2">
                    Permanently Delete
                  </span>
                ) as any,
                showDeactivate,
                () => {
                  setShowDeactivate((v) => !v);
                  setDeactivateConfirm("");
                },
                true,
              )}
              <AnimatePresence initial={false}>
                {showDeactivate && (
                  <motion.div
                    key="perm-delete"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    style={{ overflow: "hidden" }}
                  >
                    <div className="pt-2 space-y-3">
                      <div className="flex items-start gap-3 rounded-lg border border-[--color-danger]/30 bg-[--color-danger]/5 px-4 py-3">
                        <AlertTriangle
                          size={15}
                          className="mt-0.5 shrink-0 text-[--color-danger]"
                        />
                        <p className="text-xs text-[--color-text-muted]">
                          This will permanently remove the user account. This
                          action cannot be undone.
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-[--color-text-muted]">
                          Type{" "}
                          <span className="font-mono font-semibold text-[--color-text-strong]">
                            {user.email}
                          </span>{" "}
                          to confirm
                        </p>
                        <input
                          className={inputClass}
                          placeholder={user.email}
                          value={deactivateConfirm}
                          onChange={(e) => setDeactivateConfirm(e.target.value)}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowDeactivate(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={
                            deactivating ||
                            deactivateConfirm.trim() !== user.email.trim()
                          }
                          onClick={handlePermanentDelete}
                        >
                          {deactivating ? "Deleting…" : "Delete Forever"}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}

        <div className="flex-1" />
      </div>
    </Modal>
  );
}
