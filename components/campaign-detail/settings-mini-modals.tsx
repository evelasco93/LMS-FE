"use client";

import type { Dispatch, SetStateAction } from "react";
import { Tag } from "lucide-react";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import type {
  Campaign,
  DistributionMode,
  TagDefinitionRecord,
} from "@/lib/types";

interface SettingsMiniModalsProps {
  campaign: Campaign | null;
  confirmModeChange: DistributionMode | null;
  routingMode: DistributionMode;
  savingTags: boolean;
  tagDefinitions: TagDefinitionRecord[];
  tagDraft: string[];
  editTagsOpen: boolean;
  setConfirmModeChange: Dispatch<SetStateAction<DistributionMode | null>>;
  setEditTagsOpen: Dispatch<SetStateAction<boolean>>;
  setRoutingMode: Dispatch<SetStateAction<DistributionMode>>;
  setTagDraft: Dispatch<SetStateAction<string[]>>;
  saveCampaignTagDraft: () => Promise<void>;
  onUpdateCampaignDistribution: (
    campaignId: string,
    payload: { mode: DistributionMode; enabled: boolean },
  ) => Promise<void>;
}

export function SettingsMiniModals({
  campaign,
  confirmModeChange,
  routingMode,
  savingTags,
  tagDefinitions,
  tagDraft,
  editTagsOpen,
  setConfirmModeChange,
  setEditTagsOpen,
  setRoutingMode,
  setTagDraft,
  saveCampaignTagDraft,
  onUpdateCampaignDistribution,
}: SettingsMiniModalsProps) {
  return (
    <>
      <Modal
        title="Change distribution method?"
        isOpen={!!confirmModeChange}
        onClose={() => setConfirmModeChange(null)}
        width={380}
      >
        <div className="space-y-4">
          <p className="text-sm text-[--color-text-muted]">
            Switching from{" "}
            <span className="font-semibold text-[--color-text]">
              {routingMode === "round_robin" ? "Round Robin" : "Weighted"}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-[--color-text]">
              {confirmModeChange === "round_robin" ? "Round Robin" : "Weighted"}
            </span>
            . Save routing afterwards to apply the change.
          </p>
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmModeChange(null)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (confirmModeChange) {
                  setRoutingMode(confirmModeChange);
                  setConfirmModeChange(null);
                }
              }}
            >
              Confirm
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        title="Edit Campaign Tags"
        isOpen={editTagsOpen}
        onClose={() => setEditTagsOpen(false)}
        width={480}
      >
        <div className="space-y-4">
          {tagDefinitions.length === 0 ? (
            <p className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] px-3 py-2 text-sm text-[--color-text-muted]">
              No tag definitions are configured for this tenant.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tagDefinitions.map((def) => {
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
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditTagsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={savingTags}
              onClick={saveCampaignTagDraft}
            >
              {savingTags ? "Saving…" : "Save Tags"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
