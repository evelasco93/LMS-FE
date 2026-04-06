"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import type { EditHistoryEntry } from "@/lib/types";
import { Modal } from "@/components/modal";
import { useAuthorResolver } from "@/hooks/use-author-resolver";

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
                    <span className="inline-flex items-center leading-none text-[--color-text-muted]">
                      →
                    </span>
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
                    .replace(/\b\w/g, (c: string) => c.toUpperCase());
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
                      <span className="inline-flex items-center leading-none text-[--color-text-muted]">
                        →
                      </span>
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
