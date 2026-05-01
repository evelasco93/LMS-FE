"use client";

import { Dispatch, SetStateAction } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ListOrdered, Tag, X } from "lucide-react";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { TagDefinitionRecord } from "@/lib/types";

type AdminSettingsEditorsProps = {
  inputClass: string;
  catalogEditorOpen: boolean;
  closeCatalogEditor: () => void;
  catalogEditorKind: "criteria" | "logic" | "lists";
  catalogEditorMode: "create" | "new-version";
  catalogEditorName: string;
  setCatalogEditorName: Dispatch<SetStateAction<string>>;
  catalogEditorDescription: string;
  setCatalogEditorDescription: Dispatch<SetStateAction<string>>;
  tagDefinitions: TagDefinitionRecord[];
  catalogEditorTags: string[];
  setCatalogEditorTags: Dispatch<SetStateAction<string[]>>;
  catalogEditorJson: string;
  setCatalogEditorJson: Dispatch<SetStateAction<string>>;
  catalogEditorSaving: boolean;
  saveCatalogEditor: () => void;
  listEditorOpen: boolean;
  closeListEditor: () => void;
  listEditorMode: "create" | "edit";
  listEditorScope: "platform" | "tenant";
  listEditorName: string;
  setListEditorName: Dispatch<SetStateAction<string>>;
  listEditorDescription: string;
  setListEditorDescription: Dispatch<SetStateAction<string>>;
  listEditorOptions: { value: string; label: string }[];
  removeListOption: (index: number) => void;
  listEditorNewValue: string;
  setListEditorNewValue: Dispatch<SetStateAction<string>>;
  listEditorNewLabel: string;
  setListEditorNewLabel: Dispatch<SetStateAction<string>>;
  addListOption: () => void;
  listEditorSaving: boolean;
  saveListEditor: () => void;
  tagEditorOpen: boolean;
  closeTagEditor: () => void;
  tagEditorMode: "create" | "edit";
  tagEditorLabel: string;
  setTagEditorLabel: Dispatch<SetStateAction<string>>;
  tagEditorColor: string;
  setTagEditorColor: Dispatch<SetStateAction<string>>;
  tagEditorSaving: boolean;
  saveTagEditor: () => void;
};

const TAG_SWATCHES = [
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

export function AdminSettingsEditors({
  inputClass,
  catalogEditorOpen,
  closeCatalogEditor,
  catalogEditorKind,
  catalogEditorMode,
  catalogEditorName,
  setCatalogEditorName,
  catalogEditorDescription,
  setCatalogEditorDescription,
  tagDefinitions,
  catalogEditorTags,
  setCatalogEditorTags,
  catalogEditorJson,
  setCatalogEditorJson,
  catalogEditorSaving,
  saveCatalogEditor,
  listEditorOpen,
  closeListEditor,
  listEditorMode,
  listEditorScope,
  listEditorName,
  setListEditorName,
  listEditorDescription,
  setListEditorDescription,
  listEditorOptions,
  removeListOption,
  listEditorNewValue,
  setListEditorNewValue,
  listEditorNewLabel,
  setListEditorNewLabel,
  addListOption,
  listEditorSaving,
  saveListEditor,
  tagEditorOpen,
  closeTagEditor,
  tagEditorMode,
  tagEditorLabel,
  setTagEditorLabel,
  tagEditorColor,
  setTagEditorColor,
  tagEditorSaving,
  saveTagEditor,
}: AdminSettingsEditorsProps) {
  return (
    <>
      <AnimatePresence>
        {catalogEditorOpen && (
          <>
            <motion.div
              key="catalog-editor-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
              onClick={closeCatalogEditor}
            />
            <motion.div
              key="catalog-editor-modal"
              initial={{ opacity: 0, scale: 0.97, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div
                className="pointer-events-auto relative w-full max-w-3xl rounded-2xl border border-[--color-border] bg-[--color-panel] shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 border-b border-[--color-border] px-5 py-4">
                  <Badge tone="info">
                    {catalogEditorKind === "criteria"
                      ? "Fields"
                      : catalogEditorKind === "logic"
                        ? "Rules"
                        : "Lists"}
                  </Badge>
                  <span className="text-base font-semibold text-[--color-text-strong]">
                    {catalogEditorMode === "create"
                      ? "Create Preset"
                      : "Create New Version"}
                  </span>
                  <button
                    type="button"
                    onClick={closeCatalogEditor}
                    className="ml-auto shrink-0 rounded-lg p-1.5 text-[--color-text-muted] hover:bg-[--color-bg-muted] hover:text-[--color-text] transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[--color-text-muted]">
                        Set Name
                      </span>
                      <input
                        className={inputClass}
                        value={catalogEditorName}
                        onChange={(e) => setCatalogEditorName(e.target.value)}
                        placeholder="Enter preset name"
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[--color-text-muted]">
                        Description
                      </span>
                      <input
                        className={inputClass}
                        value={catalogEditorDescription}
                        onChange={(e) =>
                          setCatalogEditorDescription(e.target.value)
                        }
                        placeholder="Optional description"
                      />
                    </label>
                  </div>

                  {catalogEditorMode === "create" &&
                    tagDefinitions.filter((d) => !d.is_deleted).length > 0 && (
                      <div className="space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-[--color-text-muted]">
                          Tags
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {tagDefinitions
                            .filter((d) => !d.is_deleted)
                            .map((def) => {
                              const active = catalogEditorTags.includes(
                                def.label,
                              );
                              return (
                                <button
                                  key={def.id}
                                  type="button"
                                  onClick={() =>
                                    setCatalogEditorTags((prev) =>
                                      active
                                        ? prev.filter((t) => t !== def.label)
                                        : [...prev, def.label],
                                    )
                                  }
                                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
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
                      </div>
                    )}

                  <label className="space-y-1.5 block">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[--color-text-muted]">
                      {catalogEditorKind === "criteria"
                        ? "Fields JSON"
                        : "Rules JSON"}
                    </span>
                    <textarea
                      className={`${inputClass} min-h-[240px] font-mono text-xs leading-relaxed`}
                      value={catalogEditorJson}
                      onChange={(e) => setCatalogEditorJson(e.target.value)}
                      spellCheck={false}
                    />
                    <p className="text-xs text-[--color-text-muted]">
                      Provide a JSON array for
                      {catalogEditorKind === "criteria"
                        ? " lead fields"
                        : " logic rules"}
                      .
                    </p>
                  </label>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button
                      variant="outline"
                      disabled={catalogEditorSaving}
                      onClick={closeCatalogEditor}
                    >
                      Cancel
                    </Button>
                    <Button
                      disabled={catalogEditorSaving}
                      onClick={saveCatalogEditor}
                    >
                      {catalogEditorSaving ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {listEditorOpen && (
          <>
            <motion.div
              key="list-editor-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
              onClick={closeListEditor}
            />
            <motion.div
              key="list-editor-modal"
              initial={{ opacity: 0, scale: 0.97, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div
                className="pointer-events-auto relative w-full max-w-lg rounded-2xl border border-[--color-border] bg-[--color-panel] shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 border-b border-[--color-border] px-5 py-4">
                  <ListOrdered
                    size={16}
                    className="text-[--color-text-muted]"
                  />
                  <span className="text-base font-semibold text-[--color-text-strong]">
                    {listEditorMode === "create" ? "New" : "Edit"}{" "}
                    {listEditorScope === "platform" ? "System" : "Custom"} List
                    Preset
                  </span>
                  <button
                    type="button"
                    onClick={closeListEditor}
                    className="ml-auto p-1 rounded-md hover:bg-[--color-bg-muted]"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-4 p-5 max-h-[70vh] overflow-auto">
                  <div>
                    <label className="block text-xs font-medium text-[--color-text-muted] mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      className={inputClass}
                      placeholder="e.g. US States"
                      value={listEditorName}
                      onChange={(e) => setListEditorName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[--color-text-muted] mb-1">
                      Description (optional)
                    </label>
                    <input
                      type="text"
                      className={inputClass}
                      placeholder="Brief description"
                      value={listEditorDescription}
                      onChange={(e) => setListEditorDescription(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[--color-text-muted] mb-2">
                      Options ({listEditorOptions.length})
                    </label>
                    {listEditorOptions.length > 0 && (
                      <div className="rounded-lg border border-[--color-border] divide-y divide-[--color-border] mb-3 max-h-52 overflow-auto">
                        {listEditorOptions.map((opt, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between px-3 py-2 text-sm"
                          >
                            <span>
                              <span className="font-mono text-xs text-[--color-text-muted]">
                                {opt.value}
                              </span>
                              {opt.label !== opt.value && (
                                <span className="ml-2 text-[--color-text]">
                                  {opt.label}
                                </span>
                              )}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeListOption(idx)}
                              className="p-0.5 rounded hover:bg-[--color-bg-muted] text-[--color-text-muted] hover:text-red-500"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className={inputClass}
                        placeholder="Value"
                        value={listEditorNewValue}
                        onChange={(e) => setListEditorNewValue(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" &&
                          (e.preventDefault(), addListOption())
                        }
                      />
                      <input
                        type="text"
                        className={inputClass}
                        placeholder="Label (optional)"
                        value={listEditorNewLabel}
                        onChange={(e) => setListEditorNewLabel(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" &&
                          (e.preventDefault(), addListOption())
                        }
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={addListOption}
                        disabled={!listEditorNewValue.trim()}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-[--color-border] px-5 py-3">
                  <Button
                    variant="outline"
                    onClick={closeListEditor}
                    disabled={listEditorSaving}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={saveListEditor}
                    disabled={listEditorSaving || !listEditorName.trim()}
                  >
                    {listEditorSaving
                      ? "Saving..."
                      : listEditorMode === "create"
                        ? "Create"
                        : "Save"}
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {tagEditorOpen && (
          <>
            <motion.div
              key="tag-editor-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
              onClick={closeTagEditor}
            />
            <motion.div
              key="tag-editor-modal"
              initial={{ opacity: 0, scale: 0.97, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div
                className="pointer-events-auto relative w-full max-w-lg rounded-2xl border border-[--color-border] bg-[--color-panel] shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 border-b border-[--color-border] px-5 py-4">
                  <Tag size={16} className="text-[--color-text-muted]" />
                  <span className="text-base font-semibold text-[--color-text-strong]">
                    {tagEditorMode === "create" ? "New Tag" : "Edit Tag"}
                  </span>
                  <button
                    type="button"
                    onClick={closeTagEditor}
                    className="ml-auto p-1 rounded-md hover:bg-[--color-bg-muted]"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-4 p-5">
                  <div>
                    <label className="block text-xs font-medium text-[--color-text-muted] mb-1">
                      Label
                    </label>
                    <input
                      type="text"
                      className={inputClass}
                      placeholder="e.g. rideshare"
                      value={tagEditorLabel}
                      onChange={(e) => setTagEditorLabel(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[--color-text-muted] mb-2">
                      Color
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      {TAG_SWATCHES.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() =>
                            setTagEditorColor(tagEditorColor === hex ? "" : hex)
                          }
                          className={`h-7 w-7 rounded-full border-2 transition-all ${
                            tagEditorColor === hex
                              ? "border-white scale-110 ring-2 ring-offset-1 ring-offset-[--color-panel]"
                              : "border-transparent hover:scale-110"
                          }`}
                          style={{
                            backgroundColor: hex,
                            ...(tagEditorColor === hex
                              ? { ringColor: hex }
                              : {}),
                          }}
                          title={hex}
                        />
                      ))}
                      <label
                        className={`relative h-7 w-7 rounded-full border-2 cursor-pointer transition-all overflow-hidden ${
                          tagEditorColor &&
                          !TAG_SWATCHES.includes(tagEditorColor)
                            ? "border-white scale-110 ring-2 ring-offset-1 ring-offset-[--color-panel]"
                            : "border-[--color-border] hover:scale-110"
                        }`}
                        style={{
                          background:
                            tagEditorColor &&
                            !TAG_SWATCHES.includes(tagEditorColor)
                              ? tagEditorColor
                              : "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)",
                        }}
                        title="Custom color"
                      >
                        <input
                          type="color"
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                          value={tagEditorColor || "#3b82f6"}
                          onChange={(e) => setTagEditorColor(e.target.value)}
                        />
                      </label>
                    </div>
                    {tagEditorColor && (
                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className="inline-block h-4 w-4 rounded-full border border-[--color-border]"
                          style={{ backgroundColor: tagEditorColor }}
                        />
                        <span className="text-xs text-[--color-text-muted]">
                          <span
                            style={{ color: tagEditorColor }}
                            className="font-semibold"
                          >
                            {tagEditorColor}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setTagEditorColor("")}
                          className="ml-auto text-[10px] text-[--color-text-muted] hover:text-[--color-text] transition-colors"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button
                      variant="outline"
                      disabled={tagEditorSaving}
                      onClick={closeTagEditor}
                    >
                      Cancel
                    </Button>
                    <Button disabled={tagEditorSaving} onClick={saveTagEditor}>
                      {tagEditorSaving ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
