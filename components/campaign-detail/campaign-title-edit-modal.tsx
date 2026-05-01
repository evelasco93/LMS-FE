"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/button";
import { Campaign } from "@/lib/types";

interface CampaignTitleEditModalProps {
  isOpen: boolean;
  nameDraft: string;
  statusDraft: Campaign["status"];
  savingTitle: boolean;
  inputClass: string;
  onNameChange: (value: string) => void;
  onStatusChange: (value: Campaign["status"]) => void;
  onClose: () => void;
  onSave: () => void;
}

export function CampaignTitleEditModal({
  isOpen,
  nameDraft,
  statusDraft,
  savingTitle,
  inputClass,
  onNameChange,
  onStatusChange,
  onClose,
  onSave,
}: CampaignTitleEditModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-start justify-center pt-20 px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
        >
          <motion.div
            className="panel w-full max-w-sm shadow-2xl ring-1 ring-black/10"
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[--color-border] px-4 py-3">
              <p className="text-sm font-semibold text-[--color-text-strong]">
                Edit Campaign
              </p>
              <button
                type="button"
                aria-label="Close edit campaign modal"
                onClick={onClose}
                className="rounded p-1 text-[--color-text-muted] hover:text-[--color-danger] transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <div className="px-4 py-4 space-y-3 text-sm">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                  Campaign Name
                </p>
                <input
                  className={inputClass}
                  value={nameDraft}
                  onChange={(e) => onNameChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      onClose();
                    }
                    if (e.key === "Enter") onSave();
                  }}
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                  Status
                </p>
                <select
                  className={inputClass}
                  value={statusDraft}
                  onChange={(e) =>
                    onStatusChange(e.target.value as Campaign["status"])
                  }
                >
                  {(
                    [
                      "DRAFT",
                      "TEST",
                      "ACTIVE",
                      "INACTIVE",
                    ] as Campaign["status"][]
                  ).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button size="sm" disabled={savingTitle} onClick={onSave}>
                  {savingTitle ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
