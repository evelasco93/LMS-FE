"use client";

import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Plus, Tag } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import type {
  Campaign,
  DistributionMode,
  TagDefinitionRecord,
} from "@/lib/types";
import { createTagDefinition } from "@/lib/api";

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
  setTagDefinitions: Dispatch<SetStateAction<TagDefinitionRecord[]>>;
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
  setTagDefinitions,
  saveCampaignTagDraft,
  onUpdateCampaignDistribution,
}: SettingsMiniModalsProps) {
  const [newTagLabel, setNewTagLabel] = useState("");
  const [newTagColor, setNewTagColor] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);

  const TAG_COLORS = [
    "#ef4444",
    "#f97316",
    "#eab308",
    "#22c55e",
    "#06b6d4",
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
    "#6b7280",
  ];

  const handleCreateTag = async () => {
    const label = newTagLabel.trim();
    if (!label) return;
    if (
      tagDefinitions.some((d) => d.label.toLowerCase() === label.toLowerCase())
    ) {
      toast.error("A tag with that name already exists.");
      return;
    }
    setCreatingTag(true);
    try {
      const res = await createTagDefinition({
        label,
        ...(newTagColor ? { color: newTagColor } : {}),
      });
      if (!res?.success)
        throw new Error(res?.message || "Failed to create tag.");
      const created = (res as any).data;
      if (created) {
        setTagDefinitions((prev) => [...prev, created]);
        setTagDraft((prev) => [...prev, created.label]);
      }
      setNewTagLabel("");
      setNewTagColor("");
      toast.success(`Tag "${label}" created.`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to create tag.");
    } finally {
      setCreatingTag(false);
    }
  };
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
              No tag definitions yet. Create one below.
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

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newTagLabel}
                onChange={(e) => setNewTagLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreateTag();
                  }
                }}
                placeholder="New tag name…"
                className="flex-1 rounded-md border border-[--color-border] bg-[--color-bg] px-2.5 py-1.5 text-sm text-[--color-text] placeholder:text-[--color-text-muted] focus:border-[--color-primary] focus:outline-none"
              />
              <Button
                size="sm"
                variant="ghost"
                disabled={!newTagLabel.trim() || creatingTag}
                onClick={handleCreateTag}
                iconLeft={<Plus size={14} />}
              >
                {creatingTag ? "Creating…" : "Create"}
              </Button>
            </div>
            {newTagLabel.trim() && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wide text-[--color-text-muted] mr-1">
                  Color
                </span>
                {TAG_COLORS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() =>
                      setNewTagColor(newTagColor === hex ? "" : hex)
                    }
                    className={`h-5 w-5 rounded-full border-2 transition-all ${
                      newTagColor === hex
                        ? "border-white scale-110 ring-2 ring-offset-1 ring-offset-[--color-panel]"
                        : "border-transparent hover:scale-110"
                    }`}
                    style={{
                      backgroundColor: hex,
                      ...(newTagColor === hex ? { ringColor: hex } : {}),
                    }}
                  />
                ))}
                <label
                  className={`relative h-5 w-5 rounded-full border-2 cursor-pointer transition-all overflow-hidden ${
                    newTagColor && !TAG_COLORS.includes(newTagColor)
                      ? "border-white scale-110 ring-2 ring-offset-1 ring-offset-[--color-panel]"
                      : "border-[--color-border] hover:scale-110"
                  }`}
                  style={{
                    background:
                      newTagColor && !TAG_COLORS.includes(newTagColor)
                        ? newTagColor
                        : "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)",
                  }}
                  title="Custom color"
                >
                  <input
                    type="color"
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    value={newTagColor || "#3b82f6"}
                    onChange={(e) => setNewTagColor(e.target.value)}
                  />
                </label>
                {newTagColor && (
                  <button
                    type="button"
                    onClick={() => setNewTagColor("")}
                    className="ml-1 text-[10px] text-[--color-text-muted] hover:text-[--color-text] transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>

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
