"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Eye, EyeOff, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import { Badge } from "@/components/badge";
import {
  createCredential,
  updateCredential,
  deleteCredential,
  disableCredential,
  enableCredential,
  createCredentialSchema,
  updateCredentialSchema,
  deleteCredentialSchema,
  setPluginSetting,
  deletePluginSetting,
} from "@/lib/api";
import { inputClass } from "@/lib/utils";
import type {
  CredentialRecord,
  CredentialSchemaRecord,
  PluginView,
  PluginSchemaField,
  PluginSchemaFieldType,
  CredentialType,
} from "@/lib/types";

// ─── Shared helpers ───────────────────────────────────────────────────────────

interface DraftField {
  name: string;
  label: string;
  type: PluginSchemaFieldType;
  required: boolean;
  placeholder: string;
  options: string; // comma-separated for select type
}

const emptyDraftField = (): DraftField => ({
  name: "",
  label: "",
  type: "text",
  required: false,
  placeholder: "",
  options: "",
});

const toDraft = (f: PluginSchemaField): DraftField => ({
  name: f.name,
  label: f.label,
  type: f.type,
  required: f.required,
  placeholder: f.placeholder ?? "",
  options: (f.options ?? []).join(", "),
});

function FieldEditor({
  fields,
  onChange,
}: {
  fields: DraftField[];
  onChange: (fields: DraftField[]) => void;
}) {
  const update = (i: number, patch: Partial<DraftField>) =>
    onChange(fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  const remove = (i: number) => onChange(fields.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
          Fields
        </p>
        <Button
          size="sm"
          variant="outline"
          iconLeft={<Plus size={14} />}
          onClick={() => onChange([...fields, emptyDraftField()])}
        >
          Add Field
        </Button>
      </div>

      {fields.length === 0 && (
        <p className="text-xs italic text-[--color-text-muted]">
          No fields yet — click Add Field.
        </p>
      )}

      {fields.map((f, i) => (
        <div
          key={i}
          className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-3 space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[--color-text-strong]">
              Field {i + 1}
            </span>
            <button
              type="button"
              onClick={() => remove(i)}
              className="rounded p-1 text-[--color-text-muted] hover:text-[--color-danger] transition"
            >
              <X size={14} />
            </button>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs text-[--color-text-muted]">
                Key name <span className="text-[--color-danger]">*</span>
              </p>
              <input
                className={inputClass}
                placeholder="e.g. apiKey"
                value={f.name}
                onChange={(e) => update(i, { name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-[--color-text-muted]">
                Label <span className="text-[--color-danger]">*</span>
              </p>
              <input
                className={inputClass}
                placeholder="e.g. API Key"
                value={f.label}
                onChange={(e) => update(i, { label: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-[--color-text-muted]">Input type</p>
              <select
                className={inputClass}
                value={f.type}
                onChange={(e) =>
                  update(i, { type: e.target.value as PluginSchemaFieldType })
                }
              >
                <option value="text">Text</option>
                <option value="password">Password (masked)</option>
                <option value="select">Select (dropdown)</option>
              </select>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-[--color-text-muted]">Placeholder</p>
              <input
                className={inputClass}
                placeholder="Optional hint text"
                value={f.placeholder}
                onChange={(e) => update(i, { placeholder: e.target.value })}
              />
            </div>
          </div>
          {f.type === "select" && (
            <div className="space-y-1">
              <p className="text-xs text-[--color-text-muted]">
                Options <span className="font-normal">(comma-separated)</span>
              </p>
              <input
                className={inputClass}
                placeholder="option1, option2, option3"
                value={f.options}
                onChange={(e) => update(i, { options: e.target.value })}
              />
            </div>
          )}
          <label className="flex cursor-pointer items-center gap-2 text-xs text-[--color-text-muted]">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-[--color-primary]"
              checked={f.required}
              onChange={(e) => update(i, { required: e.target.checked })}
            />
            Required field
          </label>
        </div>
      ))}
    </div>
  );
}

function TabNav({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: string }[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex border-b border-[--color-border]">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            active === t.key
              ? "border-[--color-primary] text-[--color-primary]"
              : "border-transparent text-[--color-text-muted] hover:text-[--color-text]"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Add Credential Modal ─────────────────────────────────────────────────────

export function AddCredentialModal({
  isOpen,
  onClose,
  schemas,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  schemas: CredentialSchemaRecord[];
  onSuccess: () => void;
}) {
  const [selectedSchemaId, setSelectedSchemaId] = useState("");
  const [credName, setCredName] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>(
    {},
  );
  const [saving, setSaving] = useState(false);

  const selectedSchema = schemas.find((s) => s.id === selectedSchemaId) ?? null;

  const reset = () => {
    setSelectedSchemaId("");
    setCredName("");
    setFieldValues({});
    setShowPasswords({});
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedSchema) return toast.error("Please select a plugin schema");
    if (!credName.trim()) return toast.error("Credential name is required");
    const missing = selectedSchema.fields.filter(
      (f) => f.required && !fieldValues[f.name]?.trim(),
    );
    if (missing.length)
      return toast.error(`Required: ${missing.map((f) => f.label).join(", ")}`);
    setSaving(true);
    try {
      const res = await createCredential({
        provider: selectedSchema.provider,
        name: credName.trim(),
        credential_type: selectedSchema.credential_type,
        credentials: Object.fromEntries(
          Object.entries(fieldValues).map(([k, v]) => [k, v.trim()]),
        ),
      });
      if (!(res as any)?.success)
        throw new Error((res as any)?.message || "Failed");
      toast.success("Credential saved");
      onSuccess();
      handleClose();
    } catch (err: any) {
      toast.error(err?.message || "Unable to save credential");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Add Credential"
      isOpen={isOpen}
      onClose={handleClose}
      width={560}
    >
      <div className="space-y-4 text-sm">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
            Integration / Plugin
          </p>
          {schemas.length === 0 ? (
            <p className="text-xs italic text-[--color-text-muted]">
              No schemas found. Add one in the Credentials → Schemas tab first.
            </p>
          ) : (
            <select
              className={inputClass}
              value={selectedSchemaId}
              onChange={(e) => {
                setSelectedSchemaId(e.target.value);
                setFieldValues({});
              }}
            >
              <option value="">— select a plugin —</option>
              {schemas.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.provider})
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedSchema && (
          <>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                Credential Name <span className="text-[--color-danger]">*</span>
              </p>
              <input
                className={inputClass}
                placeholder="e.g. Main TrustedForm Key"
                value={credName}
                onChange={(e) => setCredName(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-[--color-border] bg-[--color-bg-muted] px-3 py-2">
              <span className="text-xs text-[--color-text-muted]">
                Credential type:
              </span>
              <Badge tone="info">{selectedSchema.credential_type}</Badge>
            </div>
            {selectedSchema.fields.map((field) => (
              <div key={field.name} className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                  {field.label}
                  {field.required && (
                    <span className="ml-1 text-[--color-danger]">*</span>
                  )}
                </p>
                {field.type === "select" && field.options ? (
                  <select
                    className={inputClass}
                    value={fieldValues[field.name] ?? ""}
                    onChange={(e) =>
                      setFieldValues((p) => ({
                        ...p,
                        [field.name]: e.target.value,
                      }))
                    }
                  >
                    <option value="">— select —</option>
                    {field.options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : field.type === "password" ? (
                  <div className="relative">
                    <input
                      className={inputClass}
                      type={showPasswords[field.name] ? "text" : "password"}
                      placeholder={field.placeholder ?? ""}
                      value={fieldValues[field.name] ?? ""}
                      onChange={(e) =>
                        setFieldValues((p) => ({
                          ...p,
                          [field.name]: e.target.value,
                        }))
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowPasswords((p) => ({
                          ...p,
                          [field.name]: !p[field.name],
                        }))
                      }
                      className="absolute inset-y-0 right-2.5 flex items-center text-[--color-text-muted] hover:text-[--color-text] transition"
                      tabIndex={-1}
                    >
                      {showPasswords[field.name] ? (
                        <EyeOff size={15} />
                      ) : (
                        <Eye size={15} />
                      )}
                    </button>
                  </div>
                ) : (
                  <input
                    className={inputClass}
                    placeholder={field.placeholder ?? ""}
                    value={fieldValues[field.name] ?? ""}
                    onChange={(e) =>
                      setFieldValues((p) => ({
                        ...p,
                        [field.name]: e.target.value,
                      }))
                    }
                  />
                )}
              </div>
            ))}
          </>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button disabled={saving || !selectedSchema} onClick={handleSubmit}>
            {saving ? "Saving…" : "Save Credential"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Credential Detail Modal ─────────────────────────────────────────────────

export function CredentialDetailModal({
  isOpen,
  onClose,
  credential,
  schemas,
  pluginSettings,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  credential: CredentialRecord | null;
  schemas: CredentialSchemaRecord[];
  pluginSettings: PluginSettingRecord[];
  onSuccess: () => void;
}) {
  const schema =
    schemas.find(
      (s) =>
        s.provider === credential?.provider &&
        s.credential_type === credential?.credential_type,
    ) ?? null;

  const originalFields: Record<string, string> = Object.fromEntries(
    Object.entries(credential?.credentials ?? {}).map(([k, v]) => [k, v ?? ""]),
  );

  const [credName, setCredName] = useState(credential?.name ?? "");
  const [fieldValues, setFieldValues] =
    useState<Record<string, string>>(originalFields);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>(
    {},
  );
  const [saving, setSaving] = useState(false);

  const [pendingEnabled, setPendingEnabled] = useState<boolean | null>(null);
  const [toggling, setToggling] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Check if this credential is currently wired to a plugin setting
  const wiredPlugin = pluginSettings.find(
    (ps) => ps.credentials_id === credential?.id,
  );

  useEffect(() => {
    if (isOpen && credential) {
      setCredName(credential.name);
      setFieldValues(
        Object.fromEntries(
          Object.entries(credential.credentials ?? {}).map(([k, v]) => [
            k,
            v ?? "",
          ]),
        ),
      );
      setShowPasswords({});
      setPendingEnabled(null);
      setShowDeleteConfirm(false);
      setDeleteConfirm("");
    }
  }, [isOpen, credential]);

  const handleClose = () => {
    setPendingEnabled(null);
    setShowDeleteConfirm(false);
    setDeleteConfirm("");
    onClose();
  };

  const handleSaveEdit = async () => {
    if (!credential) return;
    if (!credName.trim()) return toast.error("Credential name is required");
    setSaving(true);
    try {
      const payload: { name?: string; credentials?: Record<string, string> } =
        {};
      if (credName.trim() !== credential.name) payload.name = credName.trim();
      const changed = Object.fromEntries(
        Object.entries(fieldValues).filter(
          ([k, v]) => v.trim() !== (originalFields[k] ?? ""),
        ),
      );
      if (Object.keys(changed).length)
        payload.credentials = { ...originalFields, ...changed };
      if (!Object.keys(payload).length) return toast.info("No changes to save");
      const res = await updateCredential(credential.id, payload);
      if (!(res as any)?.success)
        throw new Error((res as any)?.message || "Failed");
      toast.success("Credential updated");
      onSuccess();
      handleClose();
    } catch (err: any) {
      toast.error(err?.message || "Unable to update credential");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleConfirm = async () => {
    if (!credential || pendingEnabled === null) return;
    setToggling(true);
    try {
      const action = pendingEnabled ? enableCredential : disableCredential;
      const res = await action(credential.id);
      if (!(res as any)?.success)
        throw new Error((res as any)?.message || "Failed");
      toast.success(
        pendingEnabled ? "Credential enabled" : "Credential disabled",
      );
      onSuccess();
      handleClose();
    } catch (err: any) {
      toast.error(err?.message || "Unable to update status");
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    if (!credential) return;
    setDeleting(true);
    try {
      const res = await deleteCredential(credential.id);
      if (!(res as any)?.success)
        throw new Error(
          (res as any)?.error ||
            (res as any)?.message ||
            "Failed to delete credential",
        );
      toast.success("Credential deleted");
      onSuccess();
      handleClose();
    } catch (err: any) {
      toast.error(err?.message || "Unable to delete credential");
    } finally {
      setDeleting(false);
    }
  };

  if (!credential) return null;

  const isEnabled = credential.enabled;

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          {credential.name}
          <Badge tone={isEnabled ? "success" : "neutral"}>
            {isEnabled ? "Active" : "Disabled"}
          </Badge>
        </span>
      }
      isOpen={isOpen}
      onClose={handleClose}
      width={560}
    >
      <div className="flex flex-col gap-4 text-sm" style={{ minHeight: 420 }}>
        {/* Info bar */}
        <div className="flex items-center gap-3 rounded-lg border border-[--color-border] bg-[--color-bg-muted] px-3 py-2">
          <span className="text-xs text-[--color-text-muted]">
            Provider:{" "}
            <span className="font-mono text-[--color-text]">
              {credential.provider}
            </span>
          </span>
          <span className="text-[--color-border]">·</span>
          <Badge tone="info">{credential.credential_type}</Badge>
        </div>

        {/* Credential Name */}
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
            Credential Name <span className="text-[--color-danger]">*</span>
          </p>
          <input
            className={inputClass}
            value={credName}
            onChange={(e) => setCredName(e.target.value)}
          />
        </div>

        {/* Dynamic fields */}
        {schema ? (
          schema.fields.map((field) => (
            <div key={field.name} className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                {field.label}
                {field.required && (
                  <span className="ml-1 text-[--color-danger]">*</span>
                )}
              </p>
              {field.type === "select" && field.options ? (
                <select
                  className={inputClass}
                  value={fieldValues[field.name] ?? ""}
                  onChange={(e) =>
                    setFieldValues((p) => ({
                      ...p,
                      [field.name]: e.target.value,
                    }))
                  }
                >
                  <option value="">— select —</option>
                  {field.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : field.type === "password" ? (
                <div className="relative">
                  <input
                    className={inputClass}
                    type={showPasswords[field.name] ? "text" : "password"}
                    placeholder={field.placeholder ?? ""}
                    value={fieldValues[field.name] ?? ""}
                    onChange={(e) =>
                      setFieldValues((p) => ({
                        ...p,
                        [field.name]: e.target.value,
                      }))
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowPasswords((p) => ({
                        ...p,
                        [field.name]: !p[field.name],
                      }))
                    }
                    className="absolute inset-y-0 right-2.5 flex items-center text-[--color-text-muted] hover:text-[--color-text] transition"
                    tabIndex={-1}
                  >
                    {showPasswords[field.name] ? (
                      <EyeOff size={15} />
                    ) : (
                      <Eye size={15} />
                    )}
                  </button>
                </div>
              ) : (
                <input
                  className={inputClass}
                  type="text"
                  placeholder={field.placeholder ?? ""}
                  value={fieldValues[field.name] ?? ""}
                  onChange={(e) =>
                    setFieldValues((p) => ({
                      ...p,
                      [field.name]: e.target.value,
                    }))
                  }
                />
              )}
            </div>
          ))
        ) : (
          <p className="text-xs italic text-[--color-text-muted]">
            No schema found — you can still rename the credential.
          </p>
        )}

        {/* Spacer pushes status + footer to bottom */}
        <div className="flex-1" />

        {/* Status toggle row */}
        <div className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] px-4 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide font-medium text-[--color-text-muted]">
                Status
              </p>
              <p className="text-xs text-[--color-text-muted] mt-0.5">
                {(pendingEnabled !== null ? pendingEnabled : isEnabled)
                  ? "Active — available for integrations."
                  : "Disabled — will not be used by any integration."}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={
                pendingEnabled !== null ? pendingEnabled : isEnabled
              }
              onClick={() =>
                setPendingEnabled((prev) => (prev !== null ? null : !isEnabled))
              }
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                (pendingEnabled !== null ? pendingEnabled : isEnabled)
                  ? "bg-[--color-primary]"
                  : "bg-[--color-border]"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-[--color-bg] transition ${
                  (pendingEnabled !== null ? pendingEnabled : isEnabled)
                    ? "translate-x-5"
                    : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <AnimatePresence>
            {pendingEnabled !== null && (
              <motion.div
                key="toggle-confirm"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="border-t border-[--color-border] pt-3 space-y-2">
                  {wiredPlugin && !pendingEnabled && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-50/50 dark:bg-amber-900/10 px-3 py-2">
                      <AlertTriangle
                        size={14}
                        className="mt-0.5 shrink-0 text-amber-500"
                      />
                      <p className="text-xs text-[--color-text-muted]">
                        This credential is wired to a plugin setting. Disabling
                        it will cause that integration to fail.
                      </p>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-[--color-text-muted]">
                      {pendingEnabled
                        ? "Re-enable this credential."
                        : "Disable this credential across all integrations."}
                    </p>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPendingEnabled(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        variant={pendingEnabled ? "primary" : "danger"}
                        disabled={toggling}
                        onClick={handleToggleConfirm}
                      >
                        {toggling ? "Saving…" : "Confirm"}
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Inline delete confirm */}
        <AnimatePresence>
          {showDeleteConfirm && (
            <motion.div
              key="delete-confirm"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="overflow-hidden"
            >
              {wiredPlugin ? (
                <div className="flex items-start gap-3 rounded-lg border border-amber-400/40 bg-amber-50/50 dark:bg-amber-900/10 px-4 py-3">
                  <AlertTriangle
                    size={16}
                    className="mt-0.5 shrink-0 text-amber-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-[--color-text-strong]">
                      Cannot delete this credential
                    </p>
                    <p className="mt-0.5 text-xs text-[--color-text-muted]">
                      It is wired to a plugin setting. Remove the wiring in
                      Plugin Settings first.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 rounded-lg border border-[--color-danger]/30 bg-[--color-danger]/5 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle
                      size={16}
                      className="mt-0.5 shrink-0 text-[--color-danger]"
                    />
                    <div>
                      <p className="text-sm font-medium text-[--color-text-strong]">
                        Delete this credential?
                      </p>
                      <p className="mt-0.5 text-xs text-[--color-text-muted]">
                        This action cannot be undone.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-[--color-text-muted]">
                      Type{" "}
                      <span className="font-mono font-semibold text-[--color-text-strong]">
                        {credential.name}
                      </span>{" "}
                      to confirm
                    </p>
                    <input
                      className={inputClass}
                      placeholder={credential.name}
                      value={deleteConfirm}
                      onChange={(e) => setDeleteConfirm(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirm("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      iconLeft={<Trash2 size={14} />}
                      disabled={
                        deleting ||
                        deleteConfirm.trim() !== credential.name.trim()
                      }
                      onClick={handleDelete}
                    >
                      {deleting ? "Deleting…" : "Delete Credential"}
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[--color-border] pt-3">
          <Button
            variant={showDeleteConfirm ? "ghost" : "danger"}
            size="sm"
            disabled={!!wiredPlugin && !showDeleteConfirm}
            title={
              wiredPlugin
                ? "Remove the plugin wiring in Plugin Settings before deleting"
                : undefined
            }
            onClick={() => {
              setShowDeleteConfirm((v) => !v);
              setDeleteConfirm("");
            }}
          >
            {showDeleteConfirm ? "Cancel Delete" : "Delete"}
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button disabled={saving} onClick={handleSaveEdit}>
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Add Credential Schema Modal ─────────────────────────────────────────────

export function AddCredentialSchemaModal({
  isOpen,
  onClose,
  existingSchemas = [],
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** Used to prevent creating a duplicate schema for an already-configured provider. */
  existingSchemas?: CredentialSchemaRecord[];
  onSuccess: () => void;
}) {
  const [provider, setProvider] = useState("");
  const [name, setName] = useState("");
  const [credentialType, setCredentialType] =
    useState<CredentialType>("api_key");
  const [fields, setFields] = useState<DraftField[]>([emptyDraftField()]);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setProvider("");
    setName("");
    setCredentialType("api_key");
    setFields([emptyDraftField()]);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!provider.trim()) return toast.error("Provider is required");
    if (!name.trim()) return toast.error("Schema name is required");
    if (!fields.length) return toast.error("At least one field is required");
    const invalid = fields.filter((f) => !f.name.trim() || !f.label.trim());
    if (invalid.length)
      return toast.error("All fields must have a name and label");
    // Prevent duplicate schemas for the same provider
    if (existingSchemas.some((s) => s.provider === provider.trim())) {
      return toast.error(
        `A schema for provider "${provider.trim()}" already exists. Only one schema per provider is allowed.`,
      );
    }
    setSaving(true);
    try {
      const builtFields = fields.map((f) => ({
        name: f.name.trim(),
        label: f.label.trim(),
        type: f.type,
        required: f.required,
        ...(f.placeholder.trim() ? { placeholder: f.placeholder.trim() } : {}),
        ...(f.type === "select" && f.options.trim()
          ? {
              options: f.options
                .split(",")
                .map((o) => o.trim())
                .filter(Boolean),
            }
          : {}),
      }));
      const res = await createCredentialSchema({
        provider: provider.trim(),
        name: name.trim(),
        credential_type: credentialType,
        fields: builtFields,
      });
      if (!(res as any)?.success)
        throw new Error((res as any)?.message || "Failed");
      toast.success("Schema created");
      onSuccess();
      handleClose();
    } catch (err: any) {
      toast.error(err?.message || "Unable to create schema");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Add Credential Schema"
      isOpen={isOpen}
      onClose={handleClose}
      width={640}
    >
      <div className="max-h-[600px] overflow-y-auto space-y-4 text-sm pr-1">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
              Provider <span className="text-[--color-danger]">*</span>
            </p>
            <input
              className={inputClass}
              placeholder="e.g. trusted_form"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            />
            {provider.trim() &&
              existingSchemas.some((s) => s.provider === provider.trim()) && (
                <p className="text-xs text-[--color-danger]">
                  A schema for &ldquo;{provider.trim()}&rdquo; already exists.
                  Only one schema per provider is allowed.
                </p>
              )}
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
              Schema Name <span className="text-[--color-danger]">*</span>
            </p>
            <input
              className={inputClass}
              placeholder="e.g. TrustedForm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
            Credential Type <span className="text-[--color-danger]">*</span>
          </p>
          <select
            className={inputClass}
            value={credentialType}
            onChange={(e) =>
              setCredentialType(e.target.value as CredentialType)
            }
          >
            <option value="api_key">API Key</option>
            <option value="basic_auth">Basic Auth</option>
            <option value="bearer_token">Bearer Token</option>
          </select>
        </div>
        <FieldEditor fields={fields} onChange={setFields} />
        <div className="flex justify-end gap-2 pt-2 sticky bottom-0 bg-[--color-panel]">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button disabled={saving} onClick={handleSubmit}>
            {saving ? "Saving…" : "Create Schema"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Credential Schema Detail Modal (Edit / Linked Credentials / Delete) ──────

export function CredentialSchemaDetailModal({
  isOpen,
  onClose,
  schema,
  linkedCredentials,
  isWiredToPlugin,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  schema: CredentialSchemaRecord | null;
  linkedCredentials: CredentialRecord[];
  isWiredToPlugin: boolean;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(schema?.name ?? "");
  const [credentialType, setCredentialType] = useState<CredentialType>(
    schema?.credential_type ?? "api_key",
  );
  const [fields, setFields] = useState<DraftField[]>(
    schema?.fields.map(toDraft) ?? [emptyDraftField()],
  );
  const [saving, setSaving] = useState(false);

  const [showLinked, setShowLinked] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showFields, setShowFields] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (isOpen && schema) {
      setName(schema.name);
      setCredentialType(schema.credential_type);
      setFields(schema.fields.map(toDraft));
      setShowLinked(false);
      setShowDelete(false);
      setShowFields(true);
      setDeleteConfirm("");
    }
  }, [isOpen, schema]);

  const handleClose = () => {
    setDeleteConfirm("");
    onClose();
  };

  const handleSaveEdit = async () => {
    if (!schema) return;
    if (!name.trim()) return toast.error("Schema name is required");
    if (!fields.length) return toast.error("At least one field is required");
    const invalid = fields.filter((f) => !f.name.trim() || !f.label.trim());
    if (invalid.length)
      return toast.error("All fields must have a name and label");
    setSaving(true);
    try {
      const builtFields = fields.map((f) => ({
        name: f.name.trim(),
        label: f.label.trim(),
        type: f.type,
        required: f.required,
        ...(f.placeholder.trim() ? { placeholder: f.placeholder.trim() } : {}),
        ...(f.type === "select" && f.options.trim()
          ? {
              options: f.options
                .split(",")
                .map((o) => o.trim())
                .filter(Boolean),
            }
          : {}),
      }));
      const res = await updateCredentialSchema(schema.id, {
        name: name.trim(),
        credential_type: credentialType,
        fields: builtFields,
      });
      if (!(res as any)?.success)
        throw new Error((res as any)?.message || "Failed");
      toast.success("Schema updated");
      onSuccess();
      handleClose();
    } catch (err: any) {
      toast.error(err?.message || "Unable to update schema");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (permanent: boolean) => {
    if (!schema) return;
    setDeleting(true);
    try {
      const res = await deleteCredentialSchema(schema.id, permanent);
      if (!(res as any)?.success)
        throw new Error((res as any)?.message || "Failed");
      toast.success(
        permanent ? "Schema permanently deleted" : "Schema removed",
      );
      onSuccess();
      handleClose();
    } catch (err: any) {
      toast.error(err?.message || "Unable to delete schema");
    } finally {
      setDeleting(false);
    }
  };

  if (!schema) return null;

  const blockedReason = isWiredToPlugin
    ? "This schema is wired to a plugin setting. Remove the wiring in Plugin Settings first."
    : linkedCredentials.length > 0
      ? `${linkedCredentials.length} credential${linkedCredentials.length !== 1 ? "s" : ""} reference this schema. Delete them first.`
      : "";

  return (
    <Modal
      title={schema.name}
      isOpen={isOpen}
      onClose={handleClose}
      width={580}
    >
      <div
        className="flex flex-col gap-5 text-sm overflow-y-auto"
        style={{ minHeight: 320, maxHeight: 520 }}
      >
        {/* ── Edit form ── */}
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                Provider
              </p>
              <div className="flex h-9 items-center rounded-lg border border-[--color-border] bg-[--color-bg-muted] px-3 font-mono text-xs text-[--color-text-muted]">
                {schema.provider}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                Schema Name <span className="text-[--color-danger]">*</span>
              </p>
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
              Credential Type <span className="text-[--color-danger]">*</span>
            </p>
            <select
              className={inputClass}
              value={credentialType}
              onChange={(e) =>
                setCredentialType(e.target.value as CredentialType)
              }
            >
              <option value="api_key">API Key</option>
              <option value="basic_auth">Basic Auth</option>
              <option value="bearer_token">Bearer Token</option>
            </select>
          </div>
          <div className="space-y-2">
            <button
              type="button"
              className="flex w-full items-center justify-between text-xs uppercase tracking-wide text-[--color-text-muted] hover:text-[--color-text] transition-colors"
              onClick={() => setShowFields((v) => !v)}
            >
              <span>
                Fields{" "}
                <span className="normal-case text-[--color-text-muted]">
                  ({fields.length})
                </span>
              </span>
              <motion.span
                animate={{ rotate: showFields ? 180 : 0 }}
                transition={{ duration: 0.18 }}
              >
                ▾
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {showFields && (
                <motion.div
                  key="field-editor"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  style={{ overflow: "hidden" }}
                >
                  <FieldEditor fields={fields} onChange={setFields} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button disabled={saving} onClick={handleSaveEdit}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>

        <div className="border-t border-[--color-border]" />

        {/* ── Linked Credentials (inline expandable) ── */}
        <div className="space-y-2">
          <button
            type="button"
            className="flex w-full items-center justify-between text-sm font-medium text-[--color-text] hover:text-[--color-primary] transition-colors"
            onClick={() => setShowLinked((v) => !v)}
          >
            <span>
              Linked Credentials
              {linkedCredentials.length > 0 && (
                <span className="ml-1.5 rounded-full bg-[--color-bg-muted] border border-[--color-border] px-1.5 py-0.5 text-xs text-[--color-text-muted]">
                  {linkedCredentials.length}
                </span>
              )}
            </span>
            <motion.span
              animate={{ rotate: showLinked ? 180 : 0 }}
              transition={{ duration: 0.18 }}
              className="text-[--color-text-muted]"
            >
              ▾
            </motion.span>
          </button>
          <AnimatePresence initial={false}>
            {showLinked && (
              <motion.div
                key="linked-creds"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                style={{ overflow: "hidden" }}
              >
                <div className="pt-1 space-y-2">
                  <p className="text-xs text-[--color-text-muted]">
                    Credentials using provider{" "}
                    <span className="font-mono text-[--color-text]">
                      {schema.provider}
                    </span>{" "}
                    with type{" "}
                    <span className="font-mono text-[--color-text]">
                      {schema.credential_type}
                    </span>
                    . These must be deleted before this schema can be removed.
                  </p>
                  {linkedCredentials.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[--color-border] py-8 text-center text-[--color-text-muted]">
                      <p className="text-sm">
                        No credentials linked to this schema.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {linkedCredentials.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between rounded-lg border border-[--color-border] bg-[--color-bg-muted] px-3 py-2.5"
                        >
                          <div>
                            <p className="font-medium text-[--color-text-strong] text-sm">
                              {c.name}
                            </p>
                            <p className="text-xs text-[--color-text-muted] font-mono">
                              {c.provider}
                            </p>
                          </div>
                          <Badge tone={c.enabled ? "success" : "neutral"}>
                            {c.enabled ? "Active" : "Disabled"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="border-t border-[--color-border]" />

        {/* ── Delete (inline expandable) ── */}
        <div className="space-y-2">
          <button
            type="button"
            className="flex w-full items-center justify-between text-sm font-medium text-[--color-danger] hover:opacity-80 transition-opacity"
            onClick={() => setShowDelete((v) => !v)}
          >
            <span>Delete Schema</span>
            <motion.span
              animate={{ rotate: showDelete ? 180 : 0 }}
              transition={{ duration: 0.18 }}
              className="opacity-70"
            >
              ▾
            </motion.span>
          </button>
          <AnimatePresence initial={false}>
            {showDelete && (
              <motion.div
                key="delete-section"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                style={{ overflow: "hidden" }}
              >
                <div className="pt-1 space-y-4">
                  {blockedReason ? (
                    <div className="flex items-start gap-3 rounded-lg border border-amber-400/40 bg-amber-50/50 px-4 py-3 dark:bg-amber-900/10">
                      <AlertTriangle
                        size={16}
                        className="mt-0.5 shrink-0 text-amber-500"
                      />
                      <div>
                        <p className="text-sm font-medium text-[--color-text-strong]">
                          Cannot delete this schema
                        </p>
                        <p className="mt-0.5 text-xs text-[--color-text-muted]">
                          {blockedReason}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start gap-3 rounded-lg border border-[--color-danger]/30 bg-[--color-danger]/5 px-4 py-3">
                        <AlertTriangle
                          size={16}
                          className="mt-0.5 shrink-0 text-[--color-danger]"
                        />
                        <div>
                          <p className="text-sm font-medium text-[--color-text-strong]">
                            Delete this schema?
                          </p>
                          <p className="mt-0.5 text-xs text-[--color-text-muted]">
                            This removes the schema definition. Any credentials
                            created under it will still exist but lose their
                            schema reference.
                          </p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-[--color-text-muted]">
                          Type{" "}
                          <span className="font-mono font-semibold text-[--color-text-strong]">
                            {schema.name}
                          </span>{" "}
                          to confirm
                        </p>
                        <input
                          className={inputClass}
                          placeholder={schema.name}
                          value={deleteConfirm}
                          onChange={(e) => setDeleteConfirm(e.target.value)}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          onClick={() => setShowDelete(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="danger"
                          iconLeft={<Trash2 size={14} />}
                          disabled={
                            deleting ||
                            deleteConfirm.trim() !== schema.name.trim()
                          }
                          onClick={() => handleDelete(true)}
                        >
                          {deleting ? "Deleting…" : "Delete Schema"}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex-1" />
      </div>
    </Modal>
  );
}

// ─── Plugin Setting Detail Modal ─────────────────────────────────────────────

export function PluginSettingDetailModal({
  isOpen,
  onClose,
  plugin,
  plugin,
  credentials,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** The enriched PluginView (PluginSettingRecord + registry metadata). */
  plugin: PluginView | null;
  credentials: CredentialRecord[];
  onSuccess: () => void;
}) {
  const [credentialsId, setCredentialsId] = useState(
    plugin?.credentials_id ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const [pendingEnabled, setPendingEnabled] = useState<boolean | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCredentialsId(plugin?.credentials_id ?? "");
      setPendingEnabled(null);
    }
  }, [isOpen, plugin]);

  // Credentials for this plugin — match by provider
  const matchingCredentials = plugin
    ? credentials.filter((c) => c.provider === plugin.provider && !c.is_deleted)
    : credentials.filter((c) => !c.is_deleted);

  const handleSaveWiring = async () => {
    if (!plugin) return;
    if (!credentialsId) return toast.error("Please select a credential");
    setSaving(true);
    try {
      const res = await setPluginSetting(plugin.provider, {
        credentials_id: credentialsId,
      });
      if (!(res as any)?.success)
        throw new Error((res as any)?.message || "Failed");
      toast.success("Plugin setting saved");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Unable to save plugin setting");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveWiring = async () => {
    if (!plugin) return;
    setRemoving(true);
    try {
      const res = await deletePluginSetting(plugin.provider);
      if (!(res as any)?.success)
        throw new Error((res as any)?.message || "Failed");
      toast.success("Plugin wiring removed");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Unable to remove plugin wiring");
    } finally {
      setRemoving(false);
    }
  };

  const handleToggleConfirm = async () => {
    if (!plugin || pendingEnabled === null) return;
    setToggling(true);
    try {
      const res = await setPluginSetting(plugin.provider, {
        credentials_id: plugin.credentials_id,
        enabled: pendingEnabled,
      });
      if (!(res as any)?.success)
        throw new Error((res as any)?.message || "Failed");
      toast.success(pendingEnabled ? "Plugin enabled" : "Plugin disabled");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Unable to update plugin status");
    } finally {
      setToggling(false);
    }
  };

  if (!plugin) return null;

  const isEnabled = plugin.enabled ?? false;
  // Plugin is "configured" when it has a real record (id is non-empty) or credentials_id set
  const isConfigured = !!(plugin.id || plugin.credentials_id);

  return (
    <Modal title={plugin.name} isOpen={isOpen} onClose={onClose} width={480}>
      <div
        className="flex flex-col gap-5 text-sm overflow-y-auto"
        style={{ minHeight: 300, maxHeight: 520 }}
      >
        {/* Plugin info bar */}
        <div className="flex items-center gap-3 rounded-lg border border-[--color-border] bg-[--color-bg-muted] px-3 py-2">
          <span className="text-xs font-mono text-[--color-text-muted]">
            {plugin.provider}
          </span>
          <span className="text-[--color-border]">·</span>
          <Badge tone="info">{plugin.credential_type}</Badge>
          {plugin.description && (
            <>
              <span className="text-[--color-border]">·</span>
              <span className="text-xs text-[--color-text-muted] truncate">
                {plugin.description}
              </span>
            </>
          )}
        </div>

        {/* Credential selector */}
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
            Credential <span className="text-[--color-danger]">*</span>
          </p>
          {matchingCredentials.length === 0 ? (
            <p className="text-xs italic text-[--color-text-muted]">
              No credentials found for provider &quot;{plugin.provider}
              &quot;. Add one in the Credentials tab first.
            </p>
          ) : (
            <select
              className={inputClass}
              value={credentialsId}
              onChange={(e) => setCredentialsId(e.target.value)}
            >
              <option value="">— Select credential —</option>
              {matchingCredentials.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.provider})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Status toggle — only shown when plugin is already configured */}
        {isConfigured && (
          <div className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide font-medium text-[--color-text-muted]">
                  Plugin Status
                </p>
                <p className="text-xs text-[--color-text-muted] mt-0.5">
                  {(pendingEnabled !== null ? pendingEnabled : isEnabled)
                    ? "Enabled globally for all campaigns."
                    : "Disabled globally across all campaigns."}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={
                  pendingEnabled !== null ? pendingEnabled : isEnabled
                }
                onClick={() =>
                  setPendingEnabled((prev) =>
                    prev !== null ? null : !isEnabled,
                  )
                }
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                  (pendingEnabled !== null ? pendingEnabled : isEnabled)
                    ? "bg-[--color-primary]"
                    : "bg-[--color-border]"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-[--color-bg] transition ${
                    (pendingEnabled !== null ? pendingEnabled : isEnabled)
                      ? "translate-x-5"
                      : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <AnimatePresence>
              {pendingEnabled !== null && (
                <motion.div
                  key="plugin-toggle-confirm"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-[--color-border] pt-3 flex items-center justify-between gap-3">
                    <p className="text-xs text-[--color-text-muted]">
                      {pendingEnabled
                        ? "This will enable the plugin for all campaigns."
                        : "This will disable the plugin globally."}
                    </p>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPendingEnabled(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        variant={pendingEnabled ? "primary" : "danger"}
                        disabled={toggling}
                        onClick={handleToggleConfirm}
                      >
                        {toggling ? "Saving…" : "Confirm"}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[--color-border] pt-3">
          {isConfigured ? (
            <Button
              variant="danger"
              size="sm"
              disabled={removing}
              onClick={handleRemoveWiring}
            >
              {removing ? "Removing…" : "Remove Wiring"}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={saving || !matchingCredentials.length}
              onClick={handleSaveWiring}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
