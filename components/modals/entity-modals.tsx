"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  History,
  Sparkles,
  ChevronDown,
  ArrowRight,
  Tag,
  Plus,
} from "lucide-react";
import useSWR from "swr";
import { AnimatePresence, motion } from "framer-motion";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import { Badge } from "@/components/badge";
import { Field } from "@/components/ui/field";
import {
  inputClass,
  generateCodeFromName,
  formatDate,
  normalizeFieldLabel,
} from "@/lib/utils";
import {
  getEntityAudit,
  listTagDefinitions,
  createTagDefinition,
} from "@/lib/api";
import type {
  Affiliate,
  Client,
  Credential,
  AuditLogItem,
  TagDefinitionRecord,
} from "@/lib/types";
import type { AffiliateStatus, ClientStatus } from "@/lib/types";

// ─── Shared audit helpers ──────────────────────────────────────────────────────

function auditActionLabel(action: string): string {
  const labels: Record<string, string> = {
    created: "Created",
    updated: "Updated",
    deleted: "Deleted",
    soft_deleted: "Deactivated",
    restored: "Restored",
    delivery_config_updated: "Delivery Config Updated",
    distribution_updated: "Distribution Updated",
    lead_delivered: "Lead Delivered",
    delivery_skipped: "Delivery Skipped",
    weight_updated: "End User Weight Updated",
    status_changed: "Status Changed",
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
  if (action === "delivery_skipped") return "warning";
  if (action.endsWith("_updated") || action === "updated") return "info";
  return "neutral";
}

function formatAuditVal(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "object") {
    const o = val as Record<string, unknown>;
    if ("mode" in o) return `mode: ${o.mode}`;
    if ("enabled" in o) return `enabled: ${o.enabled}`;
    return "…";
  }
  return String(val);
}

function resolveActor(actor?: AuditLogItem["actor"]): string {
  if (!actor) return "System";
  return actor.full_name || actor.email || actor.username || "Unknown";
}

function formatEntityLogDate(value: string): string {
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

// ─── EntityAuditTimeline ───────────────────────────────────────────────────────

function EntityAuditRow({ item }: { item: AuditLogItem }) {
  const [expanded, setExpanded] = useState(false);
  const actor = resolveActor(item.actor);
  const hasChanges = item.changes.length > 0;

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
          {item.changed_at ? formatEntityLogDate(item.changed_at) : "\u2014"}
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
            {item.changes.map((ch, i) => {
              const isAddedValue = ch.from == null && ch.to != null;
              const rawField = ch.field.replace(/^payload\./, "");
              const fieldLabel = normalizeFieldLabel(
                rawField.includes(".") ? rawField.split(".").pop()! : rawField,
              );
              return (
                <div
                  key={i}
                  className="grid grid-cols-[10rem_1fr] items-start gap-2 text-[11px]"
                >
                  <span className="truncate font-medium text-[--color-text]">
                    {fieldLabel}
                  </span>
                  {isAddedValue ? (
                    <span className="font-medium text-[--color-text]">
                      {formatAuditVal(ch.to)}
                    </span>
                  ) : (
                    <span className="flex min-w-0 items-center gap-1.5 text-[--color-text-muted]">
                      <span className="max-w-[140px] truncate line-through">
                        {formatAuditVal(ch.from)}
                      </span>
                      <ArrowRight size={9} className="shrink-0" />
                      <span className="max-w-[140px] truncate font-medium text-[--color-text]">
                        {formatAuditVal(ch.to)}
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

function EntityAuditTimeline({ entityId }: { entityId: string }) {
  const { data, isLoading } = useSWR(
    entityId ? ["entity-audit", entityId] : null,
    () => getEntityAudit(entityId, { limit: 100 }),
  );

  const items: AuditLogItem[] = data?.data?.items ?? [];

  if (isLoading)
    return (
      <div className="py-10 text-center text-sm text-[--color-text-muted]">
        Loading history…
      </div>
    );

  if (items.length === 0)
    return (
      <div className="py-10 text-center text-sm text-[--color-text-muted]">
        No history for this record.
      </div>
    );

  const sorted = [...items].sort(
    (a, b) =>
      new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime(),
  );

  return (
    <div className="divide-y divide-[--color-border]">
      {sorted.map((item) => (
        <EntityAuditRow key={item.log_id} item={item} />
      ))}
    </div>
  );
}

// ─── ClientModal ──────────────────────────────────────────────────────────────

export function ClientModal({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: Partial<Client>) => void;
}) {
  const [form, setForm] = useState<Partial<Client>>({});
  const generateCode = () => generateCodeFromName(form.name || "", "");

  useEffect(() => {
    if (!isOpen) setForm({});
  }, [isOpen]);

  return (
    <Modal title="Create End User" isOpen={isOpen} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const payload: Partial<Client> = {
            name: form.name?.trim() || "",
            notes: form.notes?.trim() || undefined,
            client_code: form.client_code?.trim() || undefined,
          };
          onSubmit(payload);
        }}
      >
        <Field label="Name" required>
          <input
            required
            className={inputClass}
            value={form.name || ""}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, name: e.target.value }))
            }
            placeholder="Acme Corp"
          />
        </Field>
        <Field label="Notes">
          <div className="relative">
            <textarea
              className={`${inputClass} resize-none`}
              rows={3}
              maxLength={500}
              placeholder="Optional notes about this end user"
              value={form.notes || ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
            <span
              className={`absolute bottom-1.5 right-2 text-[10px] ${(form.notes?.length ?? 0) >= 450 ? "text-red-500" : "text-[--color-text-muted]"}`}
            >
              {form.notes?.length ?? 0}/500
            </span>
          </div>
        </Field>
        <Field label="End User Code">
          <div className="flex gap-2">
            <input
              className={inputClass}
              value={form.client_code || ""}
              onChange={(e) =>
                setForm({ ...form, client_code: e.target.value })
              }
              placeholder="Auto (e.g., ABC123)"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              iconLeft={<Sparkles size={14} />}
              onClick={() => setForm({ ...form, client_code: generateCode() })}
            >
              Generate
            </Button>
          </div>
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Create</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── EditClientModal ──────────────────────────────────────────────────────────

export function EditClientModal({
  isOpen,
  onClose,
  client,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  onSubmit: (id: string, payload: Partial<Client>) => void;
}) {
  const [form, setForm] = useState<Partial<Client>>({});

  useEffect(() => {
    if (client) {
      setForm({
        name: client.name,
        notes: client.notes,
        client_code: client.client_code,
        status: client.status,
      });
    }
  }, [client]);

  if (!client) return null;

  const clientStatusOptions: ClientStatus[] = ["ACTIVE", "INACTIVE"];

  return (
    <Modal
      title={`Edit End User \u2014 ${client.name}`}
      isOpen={isOpen}
      onClose={onClose}
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(client.id, {
            name: form.name?.trim() || "",
            notes: form.notes?.trim() || undefined,
            client_code: form.client_code?.trim() || undefined,
            status: form.status,
          });
        }}
      >
        <Field label="Name" required>
          <input
            required
            className={inputClass}
            value={form.name || ""}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, name: e.target.value }))
            }
          />
        </Field>
        <Field label="Notes">
          <div className="relative">
            <textarea
              className={`${inputClass} resize-none`}
              rows={3}
              maxLength={500}
              placeholder="Optional notes"
              value={form.notes || ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
            <span
              className={`absolute bottom-1.5 right-2 text-[10px] ${(form.notes?.length ?? 0) >= 450 ? "text-red-500" : "text-[--color-text-muted]"}`}
            >
              {form.notes?.length ?? 0}/500
            </span>
          </div>
        </Field>
        <Field label="End User Code">
          <input
            className={inputClass}
            value={form.client_code || ""}
            onChange={(e) => setForm({ ...form, client_code: e.target.value })}
          />
        </Field>
        <Field label="Status">
          <select
            className={inputClass}
            value={form.status || "ACTIVE"}
            onChange={(e) =>
              setForm({ ...form, status: e.target.value as ClientStatus })
            }
          >
            {clientStatusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save Changes</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── AffiliateModal ───────────────────────────────────────────────────────────

export function AffiliateModal({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: Partial<Affiliate>) => void;
}) {
  const [form, setForm] = useState<Partial<Affiliate>>({});
  const generateCode = () => generateCodeFromName(form.name || "", "");

  useEffect(() => {
    if (!isOpen) setForm({});
  }, [isOpen]);

  return (
    <Modal title="Create Source" isOpen={isOpen} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const payload: Partial<Affiliate> = {
            name: form.name?.trim() || "",
            notes: form.notes?.trim() || undefined,
            affiliate_code: form.affiliate_code?.trim() || undefined,
          };
          onSubmit(payload);
        }}
      >
        <Field label="Name" required>
          <input
            required
            className={inputClass}
            value={form.name || ""}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, name: e.target.value }))
            }
            placeholder="Growth Partners"
          />
        </Field>
        <Field label="Notes">
          <div className="relative">
            <textarea
              className={`${inputClass} resize-none`}
              rows={3}
              maxLength={500}
              placeholder="Optional notes about this source"
              value={form.notes || ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
            <span
              className={`absolute bottom-1.5 right-2 text-[10px] ${(form.notes?.length ?? 0) >= 450 ? "text-red-500" : "text-[--color-text-muted]"}`}
            >
              {form.notes?.length ?? 0}/500
            </span>
          </div>
        </Field>
        <Field label="Affiliate Code">
          <div className="flex gap-2">
            <input
              className={inputClass}
              value={form.affiliate_code || ""}
              onChange={(e) =>
                setForm({ ...form, affiliate_code: e.target.value })
              }
              placeholder="Auto (e.g., ABC123)"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              iconLeft={<Sparkles size={14} />}
              onClick={() =>
                setForm({ ...form, affiliate_code: generateCode() })
              }
            >
              Generate
            </Button>
          </div>
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Create</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── EditAffiliateModal ───────────────────────────────────────────────────────

export function EditAffiliateModal({
  isOpen,
  onClose,
  affiliate,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  affiliate: Affiliate | null;
  onSubmit: (id: string, payload: Partial<Affiliate>) => void;
}) {
  const [form, setForm] = useState<Partial<Affiliate>>({});

  useEffect(() => {
    if (affiliate) {
      setForm({
        name: affiliate.name,
        notes: affiliate.notes,
        affiliate_code: affiliate.affiliate_code,
        status: affiliate.status,
      });
    }
  }, [affiliate]);

  if (!affiliate) return null;

  const generateCode = () => generateCodeFromName(form.name || "", "");
  const affiliateStatusOptions: AffiliateStatus[] = ["ACTIVE", "INACTIVE"];

  return (
    <Modal
      title={`Edit Affiliate \u2014 ${affiliate.name}`}
      isOpen={isOpen}
      onClose={onClose}
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(affiliate.id, {
            name: form.name?.trim() || "",
            notes: form.notes?.trim() || undefined,
            affiliate_code: form.affiliate_code?.trim() || undefined,
            status: form.status,
          });
        }}
      >
        <Field label="Name" required>
          <input
            required
            className={inputClass}
            value={form.name || ""}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, name: e.target.value }))
            }
          />
        </Field>
        <Field label="Notes">
          <div className="relative">
            <textarea
              className={`${inputClass} resize-none`}
              rows={3}
              maxLength={500}
              placeholder="Optional notes"
              value={form.notes || ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
            <span
              className={`absolute bottom-1.5 right-2 text-[10px] ${(form.notes?.length ?? 0) >= 450 ? "text-red-500" : "text-[--color-text-muted]"}`}
            >
              {form.notes?.length ?? 0}/500
            </span>
          </div>
        </Field>
        <Field label="Source Code">
          <div className="flex gap-2">
            <input
              className={inputClass}
              value={form.affiliate_code || ""}
              onChange={(e) =>
                setForm({ ...form, affiliate_code: e.target.value })
              }
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              iconLeft={<Sparkles size={14} />}
              onClick={() =>
                setForm({ ...form, affiliate_code: generateCode() })
              }
            >
              Generate
            </Button>
          </div>
        </Field>
        <Field label="Status">
          <select
            className={inputClass}
            value={form.status || "ACTIVE"}
            onChange={(e) =>
              setForm({ ...form, status: e.target.value as AffiliateStatus })
            }
          >
            {affiliateStatusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save Changes</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── CredentialModal ──────────────────────────────────────────────────────────

export function CredentialModal({
  isOpen,
  onClose,
  onSubmit,
  initial,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: Credential) => void;
  initial?: Credential | null;
}) {
  const blank: Credential = {
    provider: "",
    type: "api_key",
    credentials: {},
  };
  const [form, setForm] = useState<Credential>(initial ?? blank);

  useEffect(() => {
    setForm(initial ?? blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const setField = <K extends keyof Credential>(key: K, value: Credential[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setCredField = (key: string, value: string) =>
    setForm((prev) => ({
      ...prev,
      credentials: { ...prev.credentials, [key]: value },
    }));

  return (
    <Modal
      title={initial ? "Edit Credential" : "New Credential"}
      isOpen={isOpen}
      onClose={onClose}
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ ...form, provider: form.provider.trim() });
        }}
      >
        <Field label="Provider" required>
          <input
            required
            className={inputClass}
            value={form.provider}
            onChange={(e) => setField("provider", e.target.value)}
            placeholder="e.g. salesforce, sendgrid"
            disabled={!!initial}
          />
        </Field>
        <Field label="Type" required>
          <select
            required
            className={inputClass}
            value={form.type}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                type: e.target.value as Credential["type"],
                credentials: {},
              }))
            }
          >
            <option value="api_key">API Key</option>
            <option value="basic_auth">Basic Auth</option>
            <option value="bearer_token">Bearer Token</option>
          </select>
        </Field>
        {form.type === "api_key" && (
          <Field label="API Key" required>
            <input
              required
              type="password"
              className={inputClass}
              value={form.credentials.apiKey ?? ""}
              onChange={(e) => setCredField("apiKey", e.target.value)}
              placeholder="sk-…"
              autoComplete="off"
            />
          </Field>
        )}
        {form.type === "basic_auth" && (
          <>
            <Field label="Username" required>
              <input
                required
                className={inputClass}
                value={form.credentials.username ?? ""}
                onChange={(e) => setCredField("username", e.target.value)}
                placeholder="username"
                autoComplete="off"
              />
            </Field>
            <Field label="Password" required>
              <input
                required
                type="password"
                className={inputClass}
                value={form.credentials.password ?? ""}
                onChange={(e) => setCredField("password", e.target.value)}
                placeholder="password"
                autoComplete="off"
              />
            </Field>
          </>
        )}
        {form.type === "bearer_token" && (
          <Field label="Token" required>
            <input
              required
              type="password"
              className={inputClass}
              value={form.credentials.token ?? ""}
              onChange={(e) => setCredField("token", e.target.value)}
              placeholder="Bearer token…"
              autoComplete="off"
            />
          </Field>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">{initial ? "Save" : "Create"}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── CampaignModal ────────────────────────────────────────────────────────────

export function CampaignModal({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: { name: string; tags?: string[] }) => void;
}) {
  const [name, setName] = useState("");
  const [tagDraft, setTagDraft] = useState<string[]>([]);
  const [tagDefs, setTagDefs] = useState<TagDefinitionRecord[]>([]);
  const [newTagLabel, setNewTagLabel] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3b82f6");
  const [showNewTagForm, setShowNewTagForm] = useState(false);
  const [creatingTag, setCreatingTag] = useState(false);

  const tagPalette = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#06b6d4",
    "#f97316",
    "#6366f1",
    "#14b8a6",
  ];

  useEffect(() => {
    if (!isOpen) {
      setName("");
      setTagDraft([]);
      setShowNewTagForm(false);
      setNewTagLabel("");
      setNewTagColor("#3b82f6");
      return;
    }
    listTagDefinitions()
      .then((res) => {
        const items = res?.data?.items ?? [];
        setTagDefs(items.filter((t) => !t.is_deleted));
      })
      .catch(() => setTagDefs([]));
  }, [isOpen]);

  return (
    <Modal title="Create Campaign" isOpen={isOpen} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const tags = tagDraft.length > 0 ? tagDraft : undefined;
          onSubmit({ name, tags });
        }}
      >
        <Field label="Name" required>
          <input
            required
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Spring Promo"
          />
        </Field>
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
            Tags{" "}
            <span className="font-normal normal-case tracking-normal">
              (recommended for preset filtering)
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {tagDefs.map((def) => {
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
            {!showNewTagForm && (
              <button
                type="button"
                onClick={() => setShowNewTagForm(true)}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-[--color-border] px-3 py-1.5 text-xs text-[--color-text-muted] hover:border-[--color-text-muted] hover:text-[--color-text] transition-colors"
              >
                <Plus size={12} />
                New Tag
              </button>
            )}
          </div>
          {showNewTagForm && (
            <div className="flex items-end gap-2 p-2 rounded-lg border border-[--color-border] bg-[--color-bg-muted]">
              <div className="flex-1 space-y-1">
                <label className="text-[10px] font-medium text-[--color-text-muted]">
                  Label
                </label>
                <input
                  className={inputClass + " !py-1 !text-xs"}
                  placeholder="e.g. Insurance"
                  value={newTagLabel}
                  onChange={(e) => setNewTagLabel(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-[--color-text-muted]">
                  Color
                </label>
                <div className="flex gap-1">
                  {tagPalette.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewTagColor(c)}
                      className="w-5 h-5 rounded-full border-2 transition-transform"
                      style={{
                        backgroundColor: c,
                        borderColor:
                          newTagColor === c ? "white" : "transparent",
                        transform: newTagColor === c ? "scale(1.2)" : undefined,
                      }}
                    />
                  ))}
                </div>
              </div>
              <Button
                size="sm"
                disabled={!newTagLabel.trim() || creatingTag}
                type="button"
                onClick={async () => {
                  const label = newTagLabel.trim();
                  if (!label) return;
                  setCreatingTag(true);
                  try {
                    const res = await createTagDefinition({
                      label,
                      color: newTagColor,
                    });
                    if (res?.data) {
                      setTagDefs((prev) => [
                        ...prev,
                        res.data as TagDefinitionRecord,
                      ]);
                      setTagDraft((prev) => [...prev, label]);
                    }
                    setNewTagLabel("");
                    setShowNewTagForm(false);
                  } catch {
                    /* ignore */
                  }
                  setCreatingTag(false);
                }}
              >
                {creatingTag ? "…" : "Add"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={() => {
                  setShowNewTagForm(false);
                  setNewTagLabel("");
                }}
              >
                ✕
              </Button>
            </div>
          )}
          {tagDraft.length === 0 && (
            <p className="text-[10px] text-amber-500">
              Filling in tags helps filter presets and avoid cross-contamination
              between campaign types.
            </p>
          )}
        </div>
        <p className="text-xs text-[--color-text-muted]">
          Campaigns start as DRAFT. Link a client and affiliate to move to TEST.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Create</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── LinkClientModal ──────────────────────────────────────────────────────────

export function LinkClientModal({
  isOpen,
  onClose,
  clients,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  onSubmit: (payload: {
    client_id: string;
    contract_name: string;
  }) => void | Promise<void>;
}) {
  const [clientId, setClientId] = useState("");
  const [contractName, setContractName] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setClientId("");
      setContractName("");
    }
  }, [isOpen]);

  return (
    <Modal title="Add Contract" isOpen={isOpen} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Contract Name" required>
          <input
            className={inputClass}
            value={contractName}
            onChange={(e) => setContractName(e.target.value)}
            placeholder="e.g. Auto PI - CA TCPA"
          />
        </Field>
        <Field label="End User" required>
          <select
            className={inputClass}
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            <option value="">Select end user</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.client_code || "no code"})
              </option>
            ))}
          </select>
        </Field>
        <p className="text-xs text-[--color-text-muted]">
          New links start as TEST; update their status from the campaign panel
          after linking.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              const trimmedContractName = contractName.trim();
              if (!clientId || !trimmedContractName) return;
              onSubmit({
                client_id: clientId,
                contract_name: trimmedContractName,
              });
            }}
            disabled={!clientId || !contractName.trim()}
          >
            Add
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── LinkAffiliateModal ───────────────────────────────────────────────────────

export function LinkAffiliateModal({
  isOpen,
  onClose,
  affiliates,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  affiliates: Affiliate[];
  onSubmit: (affiliateId: string) => void | Promise<void>;
}) {
  const [affiliateId, setAffiliateId] = useState("");

  useEffect(() => {
    if (!isOpen) setAffiliateId("");
  }, [isOpen]);

  return (
    <Modal title="Add Affiliate to Campaign" isOpen={isOpen} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Affiliate" required>
          <select
            className={inputClass}
            value={affiliateId}
            onChange={(e) => setAffiliateId(e.target.value)}
          >
            <option value="">Select affiliate</option>
            {affiliates.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.affiliate_code || "no code"})
              </option>
            ))}
          </select>
        </Field>
        <p className="text-xs text-[--color-text-muted]">
          New links start as TEST; update their status from the campaign panel
          after linking.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!affiliateId) return;
              onSubmit(affiliateId);
            }}
            disabled={!affiliateId}
          >
            Add
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── ClientDetailModal ────────────────────────────────────────────────────────

export function ClientDetailModal({
  client,
  isOpen,
  onClose,
  onSave,
  onRequestDelete,
}: {
  client: Client | null;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (id: string, payload: Partial<Client>) => Promise<void> | void;
  onRequestDelete?: (client: Client) => void;
}) {
  const [activeTab, setActiveTab] = useState<"details" | "history">("details");
  const [saving, setSaving] = useState(false);
  const initialForm = useMemo(
    () => ({
      name: client?.name ?? "",
      notes: client?.notes ?? "",
      client_code: client?.client_code ?? "",
      status: client?.status ?? "ACTIVE",
    }),
    [client],
  );
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    if (!isOpen) {
      setActiveTab("details");
      return;
    }
    setForm(initialForm);
  }, [isOpen, initialForm]);

  const dirtyFields = useMemo(() => {
    const fields: Array<"name" | "notes" | "client_code" | "status"> = [];
    if (form.name.trim() !== initialForm.name.trim()) fields.push("name");
    if ((form.notes ?? "").trim() !== (initialForm.notes ?? "").trim())
      fields.push("notes");
    if (
      (form.client_code ?? "").trim() !== (initialForm.client_code ?? "").trim()
    )
      fields.push("client_code");
    if (form.status !== initialForm.status) fields.push("status");
    return fields;
  }, [form, initialForm]);

  const isDirty = dirtyFields.length > 0;
  const clientStatusOptions: ClientStatus[] = ["ACTIVE", "INACTIVE"];

  const handleSave = async () => {
    if (!client || !onSave || !isDirty) return;
    setSaving(true);
    try {
      await onSave(client.id, {
        name: form.name.trim(),
        notes: form.notes?.trim() || undefined,
        client_code: form.client_code?.trim() || undefined,
        status: form.status as ClientStatus,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const tabBtn = (
    label: string,
    tab: "details" | "history",
    icon?: React.ReactNode,
  ) => (
    <button
      type="button"
      onClick={() => setActiveTab(tab)}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        activeTab === tab
          ? "bg-[--color-primary] text-white"
          : "text-[--color-text-muted] hover:text-[--color-text]"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <Modal
      title={client?.name ?? "End User"}
      isOpen={isOpen}
      onClose={onClose}
      width={640}
      bodyClassName="px-5 py-4 h-[620px]"
    >
      {client && (
        <div className="flex h-full min-h-0 flex-col">
          {/* Tab bar */}
          <div className="flex gap-1 border-b border-[--color-border] pb-2">
            {tabBtn("Details", "details")}
            {tabBtn("History", "history", <History size={13} />)}
          </div>

          <div className="mt-4 flex-1 min-h-0 overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              {activeTab === "details" && (
                <motion.div
                  key="details"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.13 }}
                  className="h-full space-y-2 overflow-y-auto pr-1"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                        Name
                      </p>
                      <input
                        className={`${inputClass} ${
                          dirtyFields.includes("name")
                            ? "border-[--color-warning] bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)]"
                            : ""
                        }`}
                        value={form.name}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, name: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                        Status
                      </p>
                      <select
                        className={`${inputClass} ${
                          dirtyFields.includes("status")
                            ? "border-[--color-warning] bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)]"
                            : ""
                        }`}
                        value={form.status}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            status: e.target.value as ClientStatus,
                          }))
                        }
                      >
                        {clientStatusOptions.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                        Notes
                      </p>
                      <div className="relative">
                        <textarea
                          className={`${inputClass} resize-none ${
                            dirtyFields.includes("notes")
                              ? "border-[--color-warning] bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)]"
                              : ""
                          }`}
                          rows={3}
                          maxLength={500}
                          placeholder="Optional notes"
                          value={form.notes}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              notes: e.target.value,
                            }))
                          }
                        />
                        <span
                          className={`absolute bottom-1.5 right-2 text-[10px] ${(form.notes?.length ?? 0) >= 450 ? "text-red-500" : "text-[--color-text-muted]"}`}
                        >
                          {form.notes?.length ?? 0}/500
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                        Client Code
                      </p>
                      <input
                        className={`${inputClass} font-mono ${
                          dirtyFields.includes("client_code")
                            ? "border-[--color-warning] bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)]"
                            : ""
                        }`}
                        value={form.client_code}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            client_code: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                        Created
                      </p>
                      <p className="text-sm">
                        {client.created_at
                          ? formatDate(client.created_at)
                          : "—"}
                      </p>
                    </div>
                    {client.updated_at && (
                      <div className="col-span-2">
                        <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                          Last Updated
                        </p>
                        <p className="text-sm">
                          {formatDate(client.updated_at)}
                        </p>
                      </div>
                    )}
                    {client.deleted_at && (
                      <div className="col-span-2">
                        <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                          Deactivated
                        </p>
                        <p className="text-sm text-[--color-danger]">
                          {formatDate(client.deleted_at)}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-[--color-border] pt-3">
                    <Button
                      variant="danger"
                      onClick={() => {
                        if (onRequestDelete && client) {
                          onRequestDelete(client);
                          onClose();
                        }
                      }}
                    >
                      Delete
                    </Button>
                    <div className="flex items-center gap-2">
                      {isDirty && (
                        <Button
                          variant="ghost"
                          onClick={() => setForm(initialForm)}
                          disabled={saving}
                        >
                          Reset
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        onClick={onClose}
                        disabled={saving}
                      >
                        Close
                      </Button>
                      {isDirty && (
                        <Button onClick={handleSave} disabled={saving}>
                          {saving ? "Saving…" : "Save"}
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === "history" && (
                <motion.div
                  key="history"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.13 }}
                  className="h-full overflow-y-auto pr-1"
                >
                  <EntityAuditTimeline entityId={client.id} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function AffiliateDetailModal({
  affiliate,
  isOpen,
  onClose,
  onSave,
  onRequestDelete,
}: {
  affiliate: Affiliate | null;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (id: string, payload: Partial<Affiliate>) => Promise<void> | void;
  onRequestDelete?: (affiliate: Affiliate) => void;
}) {
  const [activeTab, setActiveTab] = useState<"details" | "history">("details");
  const [saving, setSaving] = useState(false);
  const initialForm = useMemo(
    () => ({
      name: affiliate?.name ?? "",
      notes: affiliate?.notes ?? "",
      affiliate_code: affiliate?.affiliate_code ?? "",
      status: affiliate?.status ?? "ACTIVE",
    }),
    [affiliate],
  );
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    if (!isOpen) {
      setActiveTab("details");
      return;
    }
    setForm(initialForm);
  }, [isOpen, initialForm]);

  const dirtyFields = useMemo(() => {
    const fields: Array<"name" | "notes" | "affiliate_code" | "status"> = [];
    if (form.name.trim() !== initialForm.name.trim()) fields.push("name");
    if ((form.notes ?? "").trim() !== (initialForm.notes ?? "").trim())
      fields.push("notes");
    if (
      (form.affiliate_code ?? "").trim() !==
      (initialForm.affiliate_code ?? "").trim()
    )
      fields.push("affiliate_code");
    if (form.status !== initialForm.status) fields.push("status");
    return fields;
  }, [form, initialForm]);

  const isDirty = dirtyFields.length > 0;
  const affiliateStatusOptions: AffiliateStatus[] = ["ACTIVE", "INACTIVE"];

  const tabBtn = (
    label: string,
    tab: "details" | "history",
    icon?: React.ReactNode,
  ) => (
    <button
      type="button"
      onClick={() => setActiveTab(tab)}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        activeTab === tab
          ? "bg-[--color-primary] text-white"
          : "text-[--color-text-muted] hover:text-[--color-text]"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  const handleSave = async () => {
    if (!affiliate || !onSave || !isDirty) return;
    setSaving(true);
    try {
      await onSave(affiliate.id, {
        name: form.name.trim(),
        notes: form.notes?.trim() || undefined,
        affiliate_code: form.affiliate_code?.trim() || undefined,
        status: form.status as AffiliateStatus,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={affiliate?.name ?? "Affiliate"}
      isOpen={isOpen}
      onClose={onClose}
      width={640}
      bodyClassName="px-5 py-4 h-[620px]"
    >
      {affiliate && (
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex gap-1 border-b border-[--color-border] pb-2">
            {tabBtn("Details", "details")}
            {tabBtn("History", "history", <History size={13} />)}
          </div>

          <div className="mt-4 flex-1 min-h-0 overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              {activeTab === "details" && (
                <motion.div
                  key="affiliate-details"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.13 }}
                  className="h-full space-y-2 overflow-y-auto pr-1"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                        Name
                      </p>
                      <input
                        className={`${inputClass} ${
                          dirtyFields.includes("name")
                            ? "border-[--color-warning] bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)]"
                            : ""
                        }`}
                        value={form.name}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, name: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                        Status
                      </p>
                      <select
                        className={`${inputClass} ${
                          dirtyFields.includes("status")
                            ? "border-[--color-warning] bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)]"
                            : ""
                        }`}
                        value={form.status}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            status: e.target.value as AffiliateStatus,
                          }))
                        }
                      >
                        {affiliateStatusOptions.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                        Notes
                      </p>
                      <div className="relative">
                        <textarea
                          className={`${inputClass} resize-none ${
                            dirtyFields.includes("notes")
                              ? "border-[--color-warning] bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)]"
                              : ""
                          }`}
                          rows={3}
                          maxLength={500}
                          placeholder="Optional notes"
                          value={form.notes}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              notes: e.target.value,
                            }))
                          }
                        />
                        <span
                          className={`absolute bottom-1.5 right-2 text-[10px] ${(form.notes?.length ?? 0) >= 450 ? "text-red-500" : "text-[--color-text-muted]"}`}
                        >
                          {form.notes?.length ?? 0}/500
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                        Affiliate Code
                      </p>
                      <input
                        className={`${inputClass} font-mono ${
                          dirtyFields.includes("affiliate_code")
                            ? "border-[--color-warning] bg-[color-mix(in_srgb,var(--color-warning)_10%,transparent)]"
                            : ""
                        }`}
                        value={form.affiliate_code}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            affiliate_code: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                        Created
                      </p>
                      <p className="text-sm">
                        {affiliate.created_at
                          ? formatDate(affiliate.created_at)
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-[--color-border] pt-3">
                    <Button
                      variant="danger"
                      onClick={() => {
                        if (onRequestDelete && affiliate) {
                          onRequestDelete(affiliate);
                          onClose();
                        }
                      }}
                    >
                      Delete
                    </Button>
                    <div className="flex items-center gap-2">
                      {isDirty && (
                        <Button
                          variant="ghost"
                          onClick={() => setForm(initialForm)}
                          disabled={saving}
                        >
                          Reset
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        onClick={onClose}
                        disabled={saving}
                      >
                        Close
                      </Button>
                      {isDirty && (
                        <Button onClick={handleSave} disabled={saving}>
                          {saving ? "Saving…" : "Save"}
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === "history" && (
                <motion.div
                  key="affiliate-history"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.13 }}
                  className="h-full overflow-y-auto pr-1"
                >
                  <EntityAuditTimeline entityId={affiliate.id} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </Modal>
  );
}
