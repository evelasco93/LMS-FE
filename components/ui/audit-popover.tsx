"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import useSWR from "swr";
import { formatDateTime, normalizeFieldLabel } from "@/lib/utils";
import { getEntityAudit } from "@/lib/api";
import type { AuditLogItem } from "@/lib/types";
import { Modal } from "@/components/modal";
import { useAuthorResolver } from "@/hooks/use-author-resolver";

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
                    const summarizeObject = (value: unknown): string => {
                      if (!value || typeof value !== "object") return "…";
                      const obj = value as Record<string, unknown>;
                      if ("mode" in obj || "enabled" in obj) {
                        const mode =
                          typeof obj.mode === "string" ? obj.mode : undefined;
                        const enabled =
                          typeof obj.enabled === "boolean"
                            ? obj.enabled
                            : undefined;
                        if (mode && enabled !== undefined) {
                          const modeLabel =
                            mode === "round_robin"
                              ? "Round Robin"
                              : mode === "weighted"
                                ? "Weighted"
                                : mode;
                          return `${modeLabel} · ${enabled ? "Enabled" : "Disabled"}`;
                        }
                      }
                      try {
                        return JSON.stringify(value);
                      } catch {
                        return "…";
                      }
                    };
                    const fmtVal = (v: unknown) =>
                      v === null || v === undefined
                        ? "—"
                        : typeof v === "object"
                          ? summarizeObject(v)
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
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="rounded bg-[--color-bg] px-2 py-0.5 text-sm text-[--color-text-muted] line-through">
                            {fmtVal(change.from)}
                          </span>
                          <span className="inline-flex items-center leading-none text-[--color-text-muted]">
                            →
                          </span>
                          <span className="rounded bg-[--color-bg] px-2 py-0.5 text-sm font-medium text-[--color-text-strong]">
                            {fmtVal(change.to)}
                          </span>
                        </div>
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
