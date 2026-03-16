"use client";

import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Info } from "lucide-react";
import useSWR from "swr";
import PhoneInput from "react-phone-input-2";
import {
  formatDate,
  formatDateTime,
  inputClass,
  normalizeFieldLabel,
} from "@/lib/utils";
import { listUsers, getEntityAudit } from "@/lib/api";
import type { AuditLogItem } from "@/lib/types";
import { Modal } from "@/components/modal";

// ─── SectionLabel ────────────────────────────────────────────────────────────

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
      {children}
    </p>
  );
}

// ─── InfoItem ────────────────────────────────────────────────────────────────

export function InfoItem({
  label,
  value,
  onClick,
}: {
  label: string;
  value?: React.ReactNode;
  onClick?: () => void;
}) {
  const Wrapper: React.ElementType = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`w-full rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-3 text-left ${onClick ? "transition hover:border-[--color-primary]" : ""}`}
    >
      <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
        {label}
      </p>
      <div className="text-sm font-medium text-[--color-text-strong]">
        {value ?? "—"}
      </div>
    </Wrapper>
  );
}

// ─── Shared author-resolution helpers ────────────────────────────────────────

/** Converts an email address to a readable display name.
 *  e.g. "edgar.velasco@example.com" → "Edgar Velasco"
 *       "edgar@example.com"          → "Edgar"
 */
function emailToDisplayName(email: string): string {
  const local = email.split("@")[0];
  return local
    .split(/[._\-+]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Shared hook — fetches users once (SWR deduplicates) and returns a resolver
 * function that converts any author value (plain string, RequestActor object)
 * to the best available display name.
 *
 * Resolution order:
 *  1. full_name / first_name+last_name from embedded RequestActor fields
 *  2. firstName+lastName from the users list (matched by email or username)
 *  3. Email-local-part fallback: "edgar@..." → "Edgar"
 *  4. Plain string as-is
 */
function useAuthorResolver(): (value: unknown) => string | null {
  const { data: usersRaw = [] } = useSWR("users:name-map", async () => {
    try {
      const res = await listUsers();
      return (res as any)?.data || [];
    } catch {
      return [];
    }
  });

  return useMemo(() => {
    // Build map: email/username → full name (only when name actually exists)
    const map = new Map<string, string>();
    (usersRaw as any[]).forEach((u: any) => {
      const full = [u.firstName, u.lastName].filter(Boolean).join(" ");
      if (full) {
        if (u.email) map.set(u.email.toLowerCase(), full);
        if (u.username) map.set(u.username.toLowerCase(), full);
      }
    });

    return (value: unknown): string | null => {
      if (!value) return null;

      if (typeof value === "string") {
        const lower = value.toLowerCase();
        if (map.has(lower)) return map.get(lower)!;
        // Email fallback: extract and title-case the local part
        if (value.includes("@")) return emailToDisplayName(value);
        return value || null;
      }

      if (typeof value === "object") {
        const u = value as Record<string, unknown>;
        // 1. Embedded name fields from RequestActor
        const first = typeof u.first_name === "string" ? u.first_name : "";
        const last = typeof u.last_name === "string" ? u.last_name : "";
        const fromParts = [first, last].filter(Boolean).join(" ");
        const fullName =
          (typeof u.full_name === "string" && u.full_name) || fromParts;
        if (fullName) return fullName;
        // 2. Look up in users list
        const email = typeof u.email === "string" ? u.email : "";
        const username = typeof u.username === "string" ? u.username : "";
        const key = email || username;
        if (key) {
          const fromMap = map.get(key.toLowerCase());
          if (fromMap) return fromMap;
          // 3. Email fallback
          if (email.includes("@")) return emailToDisplayName(email);
          return key;
        }
      }

      return String(value);
    };
  }, [usersRaw]);
}

// ─── AuditPopover ────────────────────────────────────────────────────────────

export function AuditPopover({
  createdBy,
  updatedBy,
  updatedAt,
  createdAt,
  entityId,
}: {
  createdBy?: unknown;
  updatedBy?: unknown;
  updatedAt?: string | null;
  createdAt?: string | null;
  entityId?: string;
}) {
  const [open, setOpen] = useState(false);
  const resolveAuthor = useAuthorResolver();

  const { data: auditData, isLoading: auditLoading } = useSWR(
    open && entityId ? `audit-popover-${entityId}` : null,
    () => getEntityAudit(entityId!, { limit: 100 }),
    { revalidateOnFocus: false },
  );

  const changeItems: AuditLogItem[] = (auditData?.data?.items ?? []).filter(
    (item: AuditLogItem) => item.changes && item.changes.length > 0,
  );

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="ml-1.5 rounded p-0.5 text-[--color-text-muted] transition-colors hover:text-[--color-primary]"
        aria-label="History"
      >
        <Info size={13} />
      </button>

      <Modal
        title="Change History"
        isOpen={open}
        onClose={() => setOpen(false)}
        width={520}
      >
        <div className="space-y-4 text-sm">
          {/* Summary row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-3">
              <p className="text-[10px] uppercase tracking-wide text-[--color-text-muted]">
                Created by
              </p>
              <p className="mt-1 text-sm font-medium text-[--color-text-strong]">
                {resolveAuthor(createdBy) || "—"}
              </p>
              {createdAt && (
                <p className="mt-0.5 text-xs text-[--color-text-muted]">
                  {formatDateTime(createdAt)}
                </p>
              )}
            </div>
            <div className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-3">
              <p className="text-[10px] uppercase tracking-wide text-[--color-text-muted]">
                Last updated by
              </p>
              <p className="mt-1 text-sm font-medium text-[--color-text-strong]">
                {resolveAuthor(updatedBy) || "—"}
              </p>
              {updatedAt && (
                <p className="mt-0.5 text-xs text-[--color-text-muted]">
                  {formatDateTime(updatedAt)}
                </p>
              )}
            </div>
          </div>

          {/* Change list */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
              Changes ({auditLoading ? "…" : changeItems.length})
            </p>
            {auditLoading ? (
              <p className="text-sm italic text-[--color-text-muted]">
                Loading…
              </p>
            ) : changeItems.length > 0 ? (
              <div className="max-h-80 space-y-2 overflow-y-auto pr-0.5">
                {changeItems.map((item) =>
                  item.changes.map((change, i) => {
                    const by = resolveAuthor(item.actor);
                    const isComplex =
                      change.from !== null &&
                      change.from !== undefined &&
                      typeof change.from === "object";
                    const fmtVal = (v: unknown) =>
                      v === null || v === undefined
                        ? "—"
                        : typeof v === "object"
                          ? "..."
                          : String(v);
                    return (
                      <div
                        key={`${item.log_id}-${i}`}
                        className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-mono text-xs font-semibold text-[--color-primary]">
                            {normalizeFieldLabel(
                              change.field.replace(/^payload\./, ""),
                            )}
                          </span>
                          <span className="shrink-0 text-right text-xs text-[--color-text-muted]">
                            {formatDateTime(item.changed_at)}
                          </span>
                        </div>
                        {!isComplex && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="rounded bg-[--color-bg] px-2 py-0.5 text-sm text-[--color-text-muted] line-through">
                              {fmtVal(change.from)}
                            </span>
                            <span className="text-[--color-text-muted]">→</span>
                            <span className="rounded bg-[--color-bg] px-2 py-0.5 text-sm font-medium text-[--color-text-strong]">
                              {fmtVal(change.to)}
                            </span>
                          </div>
                        )}
                        {by && (
                          <p className="mt-1.5 text-xs text-[--color-text-muted]">
                            by {by}
                          </p>
                        )}
                      </div>
                    );
                  }),
                )}
              </div>
            ) : (
              <p className="text-sm italic text-[--color-text-muted]">
                {entityId
                  ? "No change history recorded."
                  : "Change history not available."}
              </p>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}

// ─── DisabledTooltip ─────────────────────────────────────────────────────────

export function DisabledTooltip({
  children,
  message,
  inline,
}: {
  children: React.ReactNode;
  message: string;
  inline?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  if (!message) return <>{children}</>;

  const show = () => {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPos({ top: r.top, left: r.left + r.width / 2 });
      setVisible(true);
    }
  };
  const hide = () => setVisible(false);

  return (
    <div
      ref={triggerRef}
      className={inline ? "inline-flex" : "inline-block w-full"}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          visible ? (
            <div
              style={{
                position: "fixed",
                top: pos.top - 8,
                left: pos.left,
                transform: "translate(-50%, -100%)",
                zIndex: 9999,
              }}
              className="pointer-events-none w-64 rounded-lg border border-[--color-border] bg-[--color-panel] px-3 py-2 text-center text-xs text-[--color-text-muted] shadow-lg"
            >
              {message}
            </div>
          ) : null,
          document.body,
        )}
    </div>
  );
}

// ─── HoverTooltip ────────────────────────────────────────────────────────────

export function HoverTooltip({
  children,
  message,
}: {
  children: React.ReactNode;
  message: string;
}) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  const show = () => {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPos({ top: r.top, left: r.left + r.width / 2 });
      setVisible(true);
    }
  };
  const hide = () => setVisible(false);

  return (
    <div
      ref={triggerRef}
      className="inline-flex items-center gap-1"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          visible ? (
            <div
              style={{
                position: "fixed",
                top: pos.top - 8,
                left: pos.left,
                transform: "translate(-50%, -100%)",
                zIndex: 9999,
              }}
              className="pointer-events-none w-64 rounded-lg border border-[--color-border] bg-[--color-panel] px-3 py-2 text-center text-xs text-[--color-text-muted] shadow-lg"
            >
              {message}
            </div>
          ) : null,
          document.body,
        )}
    </div>
  );
}

// ─── EditHistoryPopover ──────────────────────────────────────────────────────

export function EditHistoryPopover({
  originalValue,
  updatedBy,
  updatedAt,
  dirty,
  history,
  fieldLabel,
}: {
  /** Value before the current unsaved edit — only set when dirty */
  originalValue?: string;
  updatedBy?: unknown;
  updatedAt?: string | null;
  /** When true the icon turns amber — indicates unsaved local change */
  dirty?: boolean;
  /** Full persisted changelog for this specific payload field, newest-first */
  history?: EditHistoryEntry[];
  /** Display name of the payload field, shown in the modal title */
  fieldLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const resolveAuthor = useAuthorResolver();

  const hasHistory = Array.isArray(history) && history.length > 0;
  const sorted = hasHistory
    ? (() => {
        // Deduplicate entries with the same timestamp + value pair.
        // Prefer entries that have a changed_by actor over system-generated ones.
        const seen = new Map<string, EditHistoryEntry>();
        for (const entry of history) {
          const key = `${entry.changed_at}|${String(entry.previous_value)}|${String(entry.new_value)}`;
          const existing = seen.get(key);
          if (!existing || (!existing.changed_by && entry.changed_by)) {
            seen.set(key, entry);
          }
        }
        return [...seen.values()].sort(
          (a, b) =>
            new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime(),
        );
      })()
    : [];

  const hasFallback = !!(resolveAuthor(updatedBy) || updatedAt);
  const isEmpty = !dirty && !hasHistory && !hasFallback;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={`rounded p-0.5 transition-colors hover:text-[--color-primary] ${
          dirty ? "text-[--color-warning]" : "text-[--color-text-muted]"
        }`}
        aria-label="Edit history"
      >
        <Info size={14} />
      </button>

      <Modal
        title={
          <span className="flex items-baseline gap-2">
            Field History
            {fieldLabel && (
              <span className="font-mono text-sm font-normal text-[--color-primary]">
                {fieldLabel}
              </span>
            )}
          </span>
        }
        isOpen={open}
        onClose={() => setOpen(false)}
        width={480}
      >
        <div className="space-y-3 text-sm">
          {isEmpty ? (
            <p className="italic text-[--color-text-muted]">
              No edit history available.
            </p>
          ) : (
            <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-0.5">
              {/* Unsaved in-session change — shown at top */}
              {dirty && originalValue !== undefined && (
                <div className="rounded-lg border border-[--color-warning]/40 bg-[--color-warning]/8 p-3">
                  <p className="mb-2 text-xs font-semibold text-[--color-warning]">
                    Pending (unsaved)
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-[--color-bg] px-2 py-0.5 text-sm text-[--color-text-muted] line-through">
                      {originalValue || "—"}
                    </span>
                    <span className="text-[--color-text-muted]">→</span>
                    <span className="rounded bg-[--color-bg] px-2 py-0.5 text-sm font-medium text-[--color-text-strong]">
                      (editing…)
                    </span>
                  </div>
                </div>
              )}

              {/* Persisted changelog entries */}
              {sorted.map((entry, i) => {
                const by = entry.changed_by
                  ? resolveAuthor(entry.changed_by)
                  : null;
                const prev =
                  entry.previous_value != null
                    ? String(entry.previous_value)
                    : null;
                const next =
                  entry.new_value != null ? String(entry.new_value) : null;
                const displayField =
                  fieldLabel ||
                  entry.field
                    .replace(/^payload\./, "")
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase());
                return (
                  <div
                    key={i}
                    className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-3 space-y-1.5"
                  >
                    <p className="text-xs font-semibold text-[--color-text-strong]">
                      {displayField}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-[--color-bg] px-2 py-0.5 text-sm text-[--color-text-muted] line-through">
                        {prev ?? "—"}
                      </span>
                      <span className="text-[--color-text-muted]">→</span>
                      <span className="rounded bg-[--color-bg] px-2 py-0.5 text-sm font-medium text-[--color-text-strong]">
                        {next ?? "—"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[--color-text-muted]">
                      <span>{formatDateTime(entry.changed_at)}</span>
                      {by ? (
                        <span>by {by}</span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 rounded border border-[--color-border] bg-[--color-bg-muted] px-1.5 py-0.5 text-[10px] font-medium text-[--color-text-muted]">
                          Value Mapping
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Fallback: no per-field history, but lead-level updated_by/at available */}
              {!hasHistory && hasFallback && (
                <div className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-3">
                  {resolveAuthor(updatedBy) && (
                    <p className="text-xs text-[--color-text-muted]">
                      Last updated by {resolveAuthor(updatedBy)}
                    </p>
                  )}
                  {updatedAt && (
                    <p className="text-xs text-[--color-text-muted]">
                      {formatDateTime(updatedAt)}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}

// ─── Field ───────────────────────────────────────────────────────────────────

export function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-[--color-text-strong]">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}

// ─── PhoneField ──────────────────────────────────────────────────────────────

export function PhoneField({
  value,
  onChange,
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div className="phone-input-wrapper">
      <PhoneInput
        country="us"
        value={(value || "").replace(/^\+/, "")}
        onChange={(val) => {
          const normalized = val.startsWith("+") ? val : `+${val}`;
          onChange(normalized);
        }}
        enableSearch
        inputClass="phone-input-field"
        buttonClass="phone-input-button"
        dropdownClass="phone-input-dropdown"
        inputProps={{ required }}
      />
    </div>
  );
}

// ─── ViewWrapper ─────────────────────────────────────────────────────────────
// Consistent enter/exit animation for main view sections

export function ViewWrapper({
  id,
  children,
  className = "space-y-4",
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.section
      key={id}
      className={className}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      {children}
    </motion.section>
  );
}

// Re-export inputClass for components that need it
export { inputClass };
