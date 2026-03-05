"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { Copy, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import { Field } from "@/components/shared-ui";
import { inputClass } from "@/lib/utils";
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
