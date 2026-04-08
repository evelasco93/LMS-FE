"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DeleteEntityType =
  | "user"
  | "client"
  | "affiliate"
  | "campaign"
  | "credential"
  | "credential-schema";

export interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** permanent = true means hard delete; false means soft deactivate */
  onConfirm: (permanent: boolean) => Promise<void>;
  entityType: DeleteEntityType;
  entityName: string;
  /**
   * If false, only soft-delete (deactivate) is offered and the permanent
   * checkbox is hidden. For users this is always false (Cognito disable).
   * For campaigns it should be false when the campaign has ever had linked
   * participants or received leads.
   */
  canHardDelete?: boolean;
  /** When set, the entire deactivate/delete action is blocked and this reason is shown. */
  softDeleteDisabledReason?: string;
  /** When set, the permanent checkbox is disabled and this reason is shown beneath it. */
  hardDeleteDisabledReason?: string;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const ENTITY_LABEL: Record<DeleteEntityType, string> = {
  user: "user",
  client: "client",
  affiliate: "source",
  campaign: "campaign",
  credential: "credential",
  "credential-schema": "credential schema",
};

function softMessage(type: DeleteEntityType, name: string) {
  if (type === "user") {
    return (
      <>
        This will{" "}
        <span className="font-semibold text-[--color-text-strong]">
          deactivate
        </span>{" "}
        the account for{" "}
        <span className="font-semibold text-[--color-text-strong]">{name}</span>
        . Their data will be preserved and the account can be re-enabled later.
      </>
    );
  }
  return (
    <>
      This will{" "}
      <span className="font-semibold text-[--color-text-strong]">
        deactivate
      </span>{" "}
      <span className="font-semibold text-[--color-text-strong]">{name}</span>.
      They will no longer appear in active lists but can be reinstated at any
      time.
    </>
  );
}

// ─── DeleteConfirmModal ───────────────────────────────────────────────────────

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  entityType,
  entityName,
  canHardDelete = false,
  softDeleteDisabledReason,
  hardDeleteDisabledReason,
}: DeleteConfirmModalProps) {
  const [permanent, setPermanent] = useState(false);
  const [loading, setLoading] = useState(false);

  // Reset state when modal closes
  const handleClose = () => {
    setPermanent(false);
    setLoading(false);
    onClose();
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(permanent);
      handleClose();
    } catch {
      // parent handles toast; just stop loading
      setLoading(false);
    }
  };

  const label = ENTITY_LABEL[entityType];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="delete-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={(e) => e.target === e.currentTarget && handleClose()}
        >
          <motion.div
            key="delete-modal-panel"
            className="w-full max-w-md rounded-2xl border border-[--color-border] bg-[--color-panel] shadow-2xl"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-[--color-border] px-6 py-5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-500">
                <AlertTriangle size={18} />
              </span>
              <h2 className="text-base font-semibold text-[--color-text-strong]">
                {permanent
                  ? `Permanently delete ${label}`
                  : `Deactivate ${label}`}
              </h2>
            </div>

            {/* Body */}
            <div className="space-y-4 px-6 py-5">
              {/* Blocked: soft delete disabled */}
              {softDeleteDisabledReason && (
                <div className="flex items-start gap-2.5 rounded-xl border border-[--color-warning]/40 bg-[--color-warning]/8 px-4 py-3">
                  <AlertTriangle
                    size={15}
                    className="mt-0.5 shrink-0 text-[--color-warning]"
                  />
                  <p className="text-xs leading-relaxed text-[--color-warning]">
                    {softDeleteDisabledReason}
                  </p>
                </div>
              )}

              {/* Soft-delete explanation */}
              <p className="text-sm leading-relaxed text-[--color-text-muted]">
                {softMessage(entityType, entityName)}
              </p>

              {/* Hard-delete checkbox — shown only when allowed */}
              {canHardDelete && (
                <div>
                  <label
                    className={`flex items-start gap-3 rounded-xl border p-3.5 transition ${
                      hardDeleteDisabledReason
                        ? "cursor-not-allowed border-[--color-border] opacity-50"
                        : "cursor-pointer border-[--color-border] hover:border-red-500/40 hover:bg-red-500/5"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 shrink-0 accent-red-500"
                      checked={permanent}
                      disabled={!!hardDeleteDisabledReason}
                      onChange={(e) => setPermanent(e.target.checked)}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[--color-text-strong]">
                        Permanently delete &mdash; this cannot be undone
                      </p>
                      <p className="mt-0.5 text-xs text-[--color-text-muted]">
                        All data associated with this {label} will be erased and
                        cannot be recovered.
                      </p>
                    </div>
                  </label>
                  {hardDeleteDisabledReason && (
                    <p className="mt-1.5 flex items-start gap-1.5 text-xs text-[--color-text-muted]">
                      <AlertTriangle
                        size={12}
                        className="mt-0.5 shrink-0 text-[--color-warning]"
                      />
                      {hardDeleteDisabledReason}
                    </p>
                  )}
                </div>
              )}

              {/* Extra warning when hard-delete selected */}
              <AnimatePresence>
                {permanent && (
                  <motion.div
                    key="perm-warning"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-xl border border-red-500/30 bg-red-500/8 px-4 py-3">
                      <p className="text-xs font-medium text-red-500">
                        ⚠ This action is irreversible. The {label} and all its
                        associated records will be permanently deleted from the
                        system.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-[--color-border] px-6 py-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="rounded-lg px-4 py-2 text-sm text-[--color-text-muted] transition hover:bg-[--color-bg-muted] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading || !!softDeleteDisabledReason}
                className={`rounded-lg px-5 py-2 text-sm font-medium text-white transition disabled:opacity-50 ${
                  permanent
                    ? "bg-red-600 hover:bg-red-700 focus-visible:ring-red-500"
                    : "bg-[--color-primary] hover:bg-[--color-primary-hover]"
                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2`}
              >
                {loading
                  ? "Processing…"
                  : permanent
                    ? "Permanently Delete"
                    : entityType === "user"
                      ? "Deactivate Account"
                      : "Deactivate"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
