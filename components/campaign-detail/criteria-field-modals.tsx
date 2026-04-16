"use client";

import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronDown, ChevronRight, ChevronUp, X } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import type {
  Campaign,
  CasingMode,
  CriteriaCatalogSet,
  CriteriaField,
  CriteriaFieldOption,
  CriteriaFieldType,
  CriteriaValueMapping,
} from "@/lib/types";
import {
  createCriteriaField,
  deleteCriteriaCatalogSet,
  deleteCriteriaField,
  listPlatformPresets,
  listTenantPresets,
  updateCriteriaField,
  updateCriteriaValueMappings,
} from "@/lib/api";

type OptionPreset = {
  id: string;
  name: string;
  scope: "platform" | "tenant";
  options: CriteriaFieldOption[];
};

function applyCasing(label: string, mode: CasingMode): string {
  switch (mode) {
    case "title_case":
      return label.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    case "capitalize_first":
      return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
    case "lowercase":
      return label.toLowerCase();
    case "uppercase":
      return label.toUpperCase();
    default:
      return label;
  }
}

type FieldDraft = {
  field_label: string;
  field_name: string;
  data_type: CriteriaFieldType;
  required: boolean;
  description: string;
  state_mapping: "abbr_to_name" | "name_to_abbr" | null;
  options: CriteriaFieldOption[];
  casing: CasingMode;
};

interface CriteriaFieldModalsProps {
  campaign: Campaign | null;
  criteriaFields: CriteriaField[];
  addFieldOpen: boolean;
  editFieldData: CriteriaField | null;
  fieldDraft: FieldDraft;
  fieldSaving: boolean;
  optionsTab: "manual" | "bulk";
  optionsBulkText: string;
  valueMappingsField: CriteriaField | null;
  valueMappingsDraft: { fromText: string; to: string }[];
  valueMappingsStateDraft: "abbr_to_name" | "name_to_abbr" | null;
  valueMappingsSaving: boolean;
  confirmDeleteSet: CriteriaCatalogSet | null;
  deletingSet: boolean;
  deleteFieldTarget: CriteriaField | null;
  deletingField: boolean;
  saveCriteriaToSetOpen: boolean;
  saveCriteriaToSetMode: "new_version" | "new_set";
  saveCriteriaToSetDraft: { name: string; description: string };
  savingCriteriaToSet: boolean;
  localCriteriaSetId: string | null;
  localCriteriaSetName: string | null;
  campaignBulkImportOpen: boolean;
  campaignBulkImportText: string;
  campaignBulkImporting: boolean;
  setAddFieldOpen: Dispatch<SetStateAction<boolean>>;
  setEditFieldData: Dispatch<SetStateAction<CriteriaField | null>>;
  setFieldDraft: Dispatch<SetStateAction<FieldDraft>>;
  setFieldSaving: Dispatch<SetStateAction<boolean>>;
  setOptionsTab: Dispatch<SetStateAction<"manual" | "bulk">>;
  setOptionsBulkText: Dispatch<SetStateAction<string>>;
  setValueMappingsField: Dispatch<SetStateAction<CriteriaField | null>>;
  setValueMappingsDraft: Dispatch<
    SetStateAction<{ fromText: string; to: string }[]>
  >;
  setValueMappingsStateDraft: Dispatch<
    SetStateAction<"abbr_to_name" | "name_to_abbr" | null>
  >;
  setValueMappingsSaving: Dispatch<SetStateAction<boolean>>;
  setConfirmDeleteSet: Dispatch<SetStateAction<CriteriaCatalogSet | null>>;
  setDeletingSet: Dispatch<SetStateAction<boolean>>;
  setDeleteFieldTarget: Dispatch<SetStateAction<CriteriaField | null>>;
  setDeletingField: Dispatch<SetStateAction<boolean>>;
  setSaveCriteriaToSetOpen: Dispatch<SetStateAction<boolean>>;
  setSaveCriteriaToSetMode: Dispatch<SetStateAction<"new_version" | "new_set">>;
  setSaveCriteriaToSetDraft: Dispatch<
    SetStateAction<{ name: string; description: string }>
  >;
  setLocalCriteriaSetId: Dispatch<SetStateAction<string | null>>;
  setLocalCriteriaSetName: Dispatch<SetStateAction<string | null>>;
  setLocalCriteriaSetVersion: Dispatch<SetStateAction<number | null>>;
  setCatalogSets: Dispatch<SetStateAction<CriteriaCatalogSet[]>>;
  setCampaignBulkImportOpen: Dispatch<SetStateAction<boolean>>;
  setCampaignBulkImportText: Dispatch<SetStateAction<string>>;
  setCampaignBulkImporting: Dispatch<SetStateAction<boolean>>;
  refreshCriteria: () => void;
  saveCurrentCriteriaToCatalog: () => Promise<void>;
  createCriteriaField: typeof createCriteriaField;
  updateCriteriaField: typeof updateCriteriaField;
  deleteCriteriaField: typeof deleteCriteriaField;
  updateCriteriaValueMappings: typeof updateCriteriaValueMappings;
  deleteCriteriaCatalogSet: typeof deleteCriteriaCatalogSet;
  normalizeFieldLabel: (label: string) => string;
  onCampaignUpdate?: (update: Partial<Campaign>) => void;
  inputClass: string;
}

export function CriteriaFieldModals({
  campaign,
  criteriaFields,
  addFieldOpen,
  editFieldData,
  fieldDraft,
  fieldSaving,
  optionsTab,
  optionsBulkText,
  valueMappingsField,
  valueMappingsDraft,
  valueMappingsStateDraft,
  valueMappingsSaving,
  confirmDeleteSet,
  deletingSet,
  deleteFieldTarget,
  deletingField,
  saveCriteriaToSetOpen,
  saveCriteriaToSetMode,
  saveCriteriaToSetDraft,
  savingCriteriaToSet,
  localCriteriaSetId,
  localCriteriaSetName,
  campaignBulkImportOpen,
  campaignBulkImportText,
  campaignBulkImporting,
  setAddFieldOpen,
  setEditFieldData,
  setFieldDraft,
  setFieldSaving,
  setOptionsTab,
  setOptionsBulkText,
  setValueMappingsField,
  setValueMappingsDraft,
  setValueMappingsStateDraft,
  setValueMappingsSaving,
  setConfirmDeleteSet,
  setDeletingSet,
  setDeleteFieldTarget,
  setDeletingField,
  setSaveCriteriaToSetOpen,
  setSaveCriteriaToSetMode,
  setSaveCriteriaToSetDraft,
  setLocalCriteriaSetId,
  setLocalCriteriaSetName,
  setLocalCriteriaSetVersion,
  setCatalogSets,
  setCampaignBulkImportOpen,
  setCampaignBulkImportText,
  setCampaignBulkImporting,
  refreshCriteria,
  saveCurrentCriteriaToCatalog,
  createCriteriaField,
  updateCriteriaField,
  deleteCriteriaField,
  updateCriteriaValueMappings,
  deleteCriteriaCatalogSet,
  normalizeFieldLabel,
  onCampaignUpdate,
  inputClass,
}: CriteriaFieldModalsProps) {
  // ── Fetch list-option presets for the Bulk tab ──────────────────────────
  const [optionPresets, setOptionPresets] = useState<OptionPreset[]>([]);
  const [presetsLoaded, setPresetsLoaded] = useState(false);
  const [presetsExpanded, setPresetsExpanded] = useState(false);

  useEffect(() => {
    if (!addFieldOpen || presetsLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        const [platResult, tenResult] = await Promise.allSettled([
          listPlatformPresets(),
          listTenantPresets(),
        ]);
        if (cancelled) return;
        const toArray = (d: unknown): unknown[] => Array.isArray(d) ? d : (d as any)?.items ?? [];
        const toPreset = (r: Record<string, unknown>, scope: "platform" | "tenant"): OptionPreset | null => {
          const opts = r.options as CriteriaFieldOption[] | undefined;
          if (!opts?.length || r.data_type !== "List") return null;
          return { id: r.id as string, name: r.name as string, scope, options: opts };
        };
        const merged: OptionPreset[] = [];
        if (platResult.status === "fulfilled") {
          for (const r of toArray(platResult.value.data) as Record<string, unknown>[]) {
            const p = toPreset(r, "platform");
            if (p) merged.push(p);
          }
        }
        if (tenResult.status === "fulfilled") {
          for (const r of toArray(tenResult.value.data) as Record<string, unknown>[]) {
            const p = toPreset(r, "tenant");
            if (p) merged.push(p);
          }
        }
        setOptionPresets(merged);
      } catch { /* non-critical */ }
      if (!cancelled) setPresetsLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [addFieldOpen, presetsLoaded]);

  if (!campaign) return null;

  const CRITERIA_TYPE_LABELS: Record<CriteriaFieldType, string> = {
    Text: "Text",
    Number: "Number",
    Date: "Date",
    List: "List",
    Boolean: "Boolean",
  };

  return (
    <>
      <Modal
        title={editFieldData ? "Edit Field" : "Add Field"}
        isOpen={addFieldOpen}
        onClose={() => {
          setAddFieldOpen(false);
          setEditFieldData(null);
        }}
        width={440}
        bodyClassName="flex flex-col overflow-hidden"
      >
        {addFieldOpen && (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-sm" style={{ maxHeight: "70vh" }}>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                Field Label
              </p>
              <p className="text-[10px] text-[--color-text-muted] -mt-0.5 mb-1">
                The display name shown in the UI for this field.
              </p>
              <input
                className={inputClass}
                placeholder="e.g. Rideshare Abuse"
                value={fieldDraft.field_label}
                onChange={(e) => {
                  const label = e.target.value;
                  setFieldDraft((p) => ({
                    ...p,
                    field_label: label,
                    // Auto-fill field_name only when the user hasn't manually edited it
                    // (i.e. it still matches the auto-generated slug of the previous label)
                    field_name:
                      p.field_name ===
                      p.field_label
                        .toLowerCase()
                        .replace(/\s+/g, "_")
                        .replace(/[^a-z0-9_]/g, "")
                        ? label
                            .toLowerCase()
                            .replace(/\s+/g, "_")
                            .replace(/[^a-z0-9_]/g, "")
                        : p.field_name,
                  }));
                }}
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                Field Key
              </p>
              <p className="text-[10px] text-[--color-text-muted] -mt-0.5 mb-1">
                The key used for this value in incoming leads. Auto-generated
                from label.
              </p>
              <input
                className={inputClass}
                placeholder="e.g. rideshare_abuse"
                value={fieldDraft.field_name}
                onChange={(e) =>
                  setFieldDraft((p) => ({
                    ...p,
                    field_name: e.target.value
                      .toLowerCase()
                      .replace(/\s+/g, "_")
                      .replace(/[^a-z0-9_]/g, ""),
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                Data Type
              </p>
              <select
                className={inputClass}
                value={fieldDraft.data_type}
                onChange={(e) => {
                  const dt = e.target.value as CriteriaFieldType;
                  setFieldDraft((p) => ({
                    ...p,
                    data_type: dt,
                    options:
                      dt !== "List" && p.data_type !== dt ? [] : p.options,
                  }));
                }}
              >
                {(
                  [
                    "Text",
                    "Number",
                    "Date",
                    "List",
                    "Boolean",
                  ] as CriteriaFieldType[]
                ).map((t) => (
                  <option key={t} value={t}>
                    {CRITERIA_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[--color-primary]"
                checked={fieldDraft.required}
                onChange={(e) =>
                  setFieldDraft((p) => ({ ...p, required: e.target.checked }))
                }
              />
              Required field
            </label>
            {/* ── Description ───────────────────────────────────────── */}
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                Description{" "}
                <span className="normal-case text-[10px]">(optional)</span>
              </p>
              <input
                className={inputClass}
                placeholder="Short description of this field"
                value={fieldDraft.description}
                onChange={(e) =>
                  setFieldDraft((p) => ({
                    ...p,
                    description: e.target.value,
                  }))
                }
              />
            </div>
            {/* ── List Options (List only) ───────────────────────────── */}
            {fieldDraft.data_type === "List" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                    Options
                  </p>
                  {/* tab switcher */}
                  <div className="flex rounded-lg border border-[--color-border] text-xs">
                    <button
                      type="button"
                      onClick={() => setOptionsTab("manual")}
                      className={`px-2.5 py-1 rounded-l-md transition-colors ${
                        optionsTab === "manual"
                          ? "bg-[--color-primary] text-white"
                          : "text-[--color-text-muted] hover:text-[--color-text]"
                      }`}
                    >
                      Manual
                    </button>
                    <button
                      type="button"
                      onClick={() => setOptionsTab("bulk")}
                      className={`px-2.5 py-1 rounded-r-md transition-colors ${
                        optionsTab === "bulk"
                          ? "bg-[--color-primary] text-white"
                          : "text-[--color-text-muted] hover:text-[--color-text]"
                      }`}
                    >
                      Bulk
                    </button>
                  </div>
                </div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={optionsTab}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.13, ease: "easeOut" }}
                  >
                    {optionsTab === "manual" ? (
                      <div className="space-y-2">
                        {/* column headers */}
                        {fieldDraft.options.length > 0 && (
                          <div className="grid grid-cols-[auto_1fr_1fr_auto] gap-x-2 px-0.5">
                            <span />
                            <p className="text-[10px] uppercase tracking-wide text-[--color-text-muted]">
                              Value (internal)
                            </p>
                            <p className="text-[10px] uppercase tracking-wide text-[--color-text-muted]">
                              Label (display)
                            </p>
                            <span />
                          </div>
                        )}
                        {fieldDraft.options.map((opt, i) => (
                          <div
                            key={i}
                            className="grid grid-cols-[auto_1fr_1fr_auto] items-center gap-2"
                          >
                            {/* reorder controls */}
                            <div className="flex flex-col -my-1">
                              <button
                                type="button"
                                disabled={i === 0}
                                onClick={() =>
                                  setFieldDraft((p) => {
                                    const opts = [...p.options];
                                    [opts[i - 1], opts[i]] = [opts[i], opts[i - 1]];
                                    return { ...p, options: opts };
                                  })
                                }
                                className="text-[--color-text-muted] hover:text-[--color-text] disabled:opacity-25 transition-colors"
                              >
                                <ChevronUp size={12} />
                              </button>
                              <button
                                type="button"
                                disabled={i === fieldDraft.options.length - 1}
                                onClick={() =>
                                  setFieldDraft((p) => {
                                    const opts = [...p.options];
                                    [opts[i], opts[i + 1]] = [opts[i + 1], opts[i]];
                                    return { ...p, options: opts };
                                  })
                                }
                                className="text-[--color-text-muted] hover:text-[--color-text] disabled:opacity-25 transition-colors"
                              >
                                <ChevronDown size={12} />
                              </button>
                            </div>
                            {/* value — left */}
                            <input
                              className={inputClass}
                              placeholder="uber"
                              value={opt.value}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFieldDraft((p) => ({
                                  ...p,
                                  options: p.options.map((o, oi) =>
                                    oi === i
                                      ? {
                                          value: val,
                                          label:
                                            o.label === "" ||
                                            o.label === o.value
                                              ? applyCasing(val, p.casing)
                                              : o.label,
                                        }
                                      : o,
                                  ),
                                }));
                              }}
                            />
                            {/* label — right */}
                            <input
                              className={inputClass}
                              placeholder="Uber"
                              value={opt.label}
                              onChange={(e) =>
                                setFieldDraft((p) => ({
                                  ...p,
                                  options: p.options.map((o, oi) =>
                                    oi === i
                                      ? { ...o, label: e.target.value }
                                      : o,
                                  ),
                                }))
                              }
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setFieldDraft((p) => ({
                                  ...p,
                                  options: p.options.filter(
                                    (_, oi) => oi !== i,
                                  ),
                                }))
                              }
                              className="shrink-0 text-[--color-text-muted] hover:text-red-500 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        <div className="flex gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() =>
                              setFieldDraft((p) => ({
                                ...p,
                                options: [
                                  ...p.options,
                                  { value: "", label: "" },
                                ],
                              }))
                            }
                            className="flex-1 rounded-lg border border-dashed border-[--color-border] py-2 text-xs text-[--color-text-muted] hover:border-[--color-primary] hover:text-[--color-primary] transition-colors"
                          >
                            + Add Option
                          </button>
                          {fieldDraft.options.length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setFieldDraft((p) => ({ ...p, options: [] }))
                              }
                              className="rounded-lg border border-[--color-border] px-3 py-2 text-xs text-red-500 hover:bg-red-500/10 transition-colors"
                            >
                              Clear All
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* ── Bulk import tab ── */
                      <div className="space-y-2">
                        {/* ── Quick-apply presets (collapsible) ── */}
                        {optionPresets.length > 0 && (
                          <div>
                            <button
                              type="button"
                              onClick={() => setPresetsExpanded((v) => !v)}
                              className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-[--color-text-muted] hover:text-[--color-text] transition-colors w-full"
                            >
                              <span className="shrink-0">{presetsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
                              Quick Apply from Presets
                              <span className="text-[9px] font-normal normal-case">({optionPresets.length})</span>
                            </button>
                            <AnimatePresence initial={false}>
                              {presetsExpanded && (
                                <motion.div
                                  key="presets-panel"
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.18, ease: "easeOut" }}
                                  className="overflow-hidden"
                                >
                                  <div className="flex flex-wrap gap-1.5 pt-1.5">
                                    {optionPresets.map((pr) => (
                                      <button
                                        key={pr.id}
                                        type="button"
                                        onClick={() => {
                                          setFieldDraft((p) => ({
                                            ...p,
                                            options: [
                                              ...p.options.filter(
                                                (o) =>
                                                  !pr.options.some(
                                                    (n) => n.value === o.value,
                                                  ),
                                              ),
                                              ...pr.options,
                                            ],
                                          }));
                                          setOptionsTab("manual");
                                        }}
                                        className="inline-flex items-center gap-1 rounded-md border border-[--color-border] bg-[--color-bg] px-2 py-1 text-[11px] text-[--color-text] hover:border-[--color-primary] hover:text-[--color-primary] transition-colors"
                                      >
                                        <ArrowRight size={10} />
                                        {pr.name}
                                        {pr.scope === "platform" && (
                                          <span className="ml-0.5 rounded bg-blue-500/10 px-1 py-px text-[9px] font-semibold uppercase text-blue-600 dark:text-blue-400">
                                            Platform
                                          </span>
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                        <p className="text-[11px] text-[--color-text-muted]">
                          Enter values separated by commas.
                        </p>
                        <textarea
                          className={`${inputClass} h-[120px] resize-none font-mono`}
                          placeholder="uber,lyft,doordash,instacart"
                          value={optionsBulkText}
                          onChange={(e) => setOptionsBulkText(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newOpts = optionsBulkText
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean)
                              .map((v) => ({
                                value: v,
                                label: applyCasing(v, fieldDraft.casing),
                              }));
                            setFieldDraft((p) => ({
                              ...p,
                              options: [
                                ...p.options.filter(
                                  (o) =>
                                    !newOpts.some((n) => n.value === o.value),
                                ),
                                ...newOpts,
                              ],
                            }));
                            setOptionsBulkText("");
                            setOptionsTab("manual");
                          }}
                          className="w-full rounded-lg bg-[--color-primary] py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
                        >
                          Add to list
                        </button>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* ── Label Casing ─────────────────────────────────── */}
                <div className="space-y-1 pt-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs uppercase tracking-wide text-[--color-text-muted] shrink-0">
                      Label Casing
                    </p>
                    <select
                      className={`${inputClass} !py-1 !text-xs max-w-[160px]`}
                      value={fieldDraft.casing}
                      onChange={(e) => {
                        const next = e.target.value as CasingMode;
                        setFieldDraft((p) => ({
                          ...p,
                          casing: next,
                          options: p.options.map((o) => ({
                            ...o,
                            label: o.label ? applyCasing(o.label, next) : o.label,
                          })),
                        }));
                      }}
                    >
                      <option value="default">None</option>
                      <option value="title_case">Title Case</option>
                      <option value="capitalize_first">First Letter</option>
                      <option value="lowercase">lowercase</option>
                      <option value="uppercase">UPPERCASE</option>
                    </select>
                  </div>
                  <p className="text-[10px] text-[--color-text-muted]">
                    Controls how the label (display) values are shown. Does not affect internal values.
                  </p>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAddFieldOpen(false);
                  setEditFieldData(null);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={
                  fieldSaving ||
                  !fieldDraft.field_label ||
                  !fieldDraft.field_name
                }
                onClick={async () => {
                  setFieldSaving(true);
                  try {
                    if (editFieldData) {
                      await updateCriteriaField(campaign.id, editFieldData.id, {
                        field_label: fieldDraft.field_label,
                        field_name: fieldDraft.field_name,
                        data_type: fieldDraft.data_type,
                        required: fieldDraft.required,
                        description: fieldDraft.description || undefined,
                        state_mapping: fieldDraft.state_mapping ?? null,
                        casing: fieldDraft.casing,
                        ...(fieldDraft.data_type === "List"
                          ? { options: fieldDraft.options }
                          : {}),
                      });
                      toast.success("Field updated");
                    } else {
                      await createCriteriaField(campaign.id, {
                        field_label: fieldDraft.field_label,
                        field_name: fieldDraft.field_name,
                        data_type: fieldDraft.data_type,
                        required: fieldDraft.required,
                        ...(fieldDraft.description
                          ? { description: fieldDraft.description }
                          : {}),
                        ...(fieldDraft.state_mapping
                          ? { state_mapping: fieldDraft.state_mapping }
                          : {}),
                        casing: fieldDraft.casing,
                        ...(fieldDraft.data_type === "List"
                          ? { options: fieldDraft.options }
                          : {}),
                      });
                      toast.success("Field added");
                    }
                    await refreshCriteria();
                    setAddFieldOpen(false);
                    setEditFieldData(null);
                  } catch (err: any) {
                    toast.error(err?.message || "Unable to save field");
                  } finally {
                    setFieldSaving(false);
                  }
                }}
              >
                {fieldSaving
                  ? "Saving…"
                  : editFieldData
                    ? "Save Changes"
                    : "Add Field"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
      <Modal
        title={
          valueMappingsField
            ? `Value Mappings: ${valueMappingsField.field_label}`
            : "Value Mappings"
        }
        isOpen={!!valueMappingsField}
        onClose={() => setValueMappingsField(null)}
        width={560}
      >
        {valueMappingsField && (
          <div className="space-y-4 text-sm">
            {/* State mapping preset — for fields with state mapping support */}
            {(valueMappingsField.data_type === "List" ||
              valueMappingsField.data_type === ("US State" as string)) && (
              <div className="space-y-2 rounded-xl border border-[--color-border] p-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-[--color-text-muted]">
                  State Mapping Preset
                </p>
                <p className="text-[11px] text-[--color-text-muted]">
                  Enable a built-in backend lookup for all 50 US states. Custom
                  mappings below always run first.
                </p>
                <div className="flex flex-col gap-1.5">
                  {(
                    [
                      ["", "None"],
                      [
                        "abbr_to_name",
                        "Abbreviation → Full name  (CA → California)",
                      ],
                      [
                        "name_to_abbr",
                        "Full name → Abbreviation  (California → CA)",
                      ],
                    ] as [string, string][]
                  ).map(([val, label]) => (
                    <label
                      key={val}
                      className="flex cursor-pointer items-center gap-2 text-xs"
                    >
                      <input
                        type="radio"
                        name="state_mapping_preset"
                        className="accent-[--color-primary]"
                        value={val}
                        checked={(valueMappingsStateDraft ?? "") === val}
                        onChange={() =>
                          setValueMappingsStateDraft(
                            (val || null) as
                              | "abbr_to_name"
                              | "name_to_abbr"
                              | null,
                          )
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            )}
            {/* Custom value mappings */}
            <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-x-3 gap-y-0.5 pb-1">
              <p className="text-[10px] uppercase tracking-wide text-[--color-text-muted]">
                From (aliases, comma-separated)
              </p>
              <span />
              <p className="text-[10px] uppercase tracking-wide text-[--color-text-muted]">
                To (normalised value)
              </p>
              <span />
            </div>
            <div className="space-y-2">
              {valueMappingsDraft.map((row, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-x-3"
                >
                  <input
                    className={inputClass}
                    placeholder="CA, ca, calif"
                    value={row.fromText}
                    onChange={(e) =>
                      setValueMappingsDraft((prev) =>
                        prev.map((r, ri) =>
                          ri === i ? { ...r, fromText: e.target.value } : r,
                        ),
                      )
                    }
                  />
                  <ArrowRight size={13} className="text-[--color-text-muted]" />
                  {valueMappingsField.data_type === "List" &&
                  (valueMappingsField.options?.length ?? 0) > 0 ? (
                    <select
                      className={inputClass}
                      value={row.to}
                      onChange={(e) =>
                        setValueMappingsDraft((prev) =>
                          prev.map((r, ri) =>
                            ri === i ? { ...r, to: e.target.value } : r,
                          ),
                        )
                      }
                    >
                      <option value="">Select…</option>
                      {valueMappingsField.options!.map((opt) => (
                        <option key={opt.value} value={opt.label}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className={inputClass}
                      placeholder="California"
                      value={row.to}
                      onChange={(e) =>
                        setValueMappingsDraft((prev) =>
                          prev.map((r, ri) =>
                            ri === i ? { ...r, to: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setValueMappingsDraft((prev) =>
                        prev.filter((_, ri) => ri !== i),
                      )
                    }
                    className="shrink-0 text-[--color-text-muted] transition-colors hover:text-red-500"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                setValueMappingsDraft((prev) => [
                  ...prev,
                  { fromText: "", to: "" },
                ])
              }
              className="w-full rounded-lg border border-dashed border-[--color-border] py-2 text-xs text-[--color-text-muted] transition-colors hover:border-[--color-primary] hover:text-[--color-primary]"
            >
              + Add Mapping
            </button>
            <div className="flex justify-end gap-2 border-t border-[--color-border] pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setValueMappingsField(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={valueMappingsSaving}
                onClick={async () => {
                  if (!valueMappingsField) return;
                  setValueMappingsSaving(true);
                  try {
                    // Save custom value_mappings
                    const mappings: CriteriaValueMapping[] = valueMappingsDraft
                      .map((r) => ({
                        from: r.fromText
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                        to: r.to.trim(),
                      }))
                      .filter((m) => m.from.length > 0 && m.to);
                    await updateCriteriaValueMappings(
                      campaign.id,
                      valueMappingsField.id,
                      mappings,
                    );
                    await refreshCriteria();
                    toast.success("Mappings saved");
                    setValueMappingsField(null);
                  } catch (err: any) {
                    toast.error(err?.message || "Unable to save mappings");
                  } finally {
                    setValueMappingsSaving(false);
                  }
                }}
              >
                {valueMappingsSaving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
      <Modal
        title="Delete Preset?"
        isOpen={!!confirmDeleteSet}
        onClose={() => setConfirmDeleteSet(null)}
        width={400}
      >
        {confirmDeleteSet && (
          <div className="space-y-4 px-1 pb-1 text-sm">
            <p className="text-[--color-text]">
              Permanently delete{" "}
              <span className="font-semibold text-[--color-text-strong]">
                {confirmDeleteSet.name}
              </span>
              ? This cannot be undone. Campaigns actively using a version of
              this set will retain their lead fields but lose the preset
              link.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDeleteSet(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={deletingSet}
                onClick={async () => {
                  if (!confirmDeleteSet) return;
                  setDeletingSet(true);
                  try {
                    await deleteCriteriaCatalogSet(confirmDeleteSet.id);
                    toast.success(`"${confirmDeleteSet.name}" deleted.`);
                    setCatalogSets((prev) =>
                      prev.filter((s) => s.id !== confirmDeleteSet.id),
                    );
                    setConfirmDeleteSet(null);
                  } catch {
                    toast.error("Failed to delete preset.");
                  } finally {
                    setDeletingSet(false);
                  }
                }}
              >
                {deletingSet ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
      <Modal
        title="Delete Field"
        isOpen={!!deleteFieldTarget}
        onClose={() => setDeleteFieldTarget(null)}
        width={420}
      >
        {deleteFieldTarget && (
          <div className="space-y-4 text-sm">
            <p className="text-[--color-text]">
              Delete field{" "}
              <span className="font-semibold text-[--color-text-strong]">
                {deleteFieldTarget.field_label}
              </span>
              ? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteFieldTarget(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={deletingField}
                onClick={async () => {
                  setDeletingField(true);
                  try {
                    await deleteCriteriaField(
                      campaign.id,
                      deleteFieldTarget.id,
                    );
                    await refreshCriteria();
                    toast.success("Field deleted");
                    setDeleteFieldTarget(null);
                    setDeleteFieldTarget(null);
                  } catch (err: any) {
                    toast.error(err?.message || "Unable to delete field");
                  } finally {
                    setDeletingField(false);
                  }
                }}
              >
                {deletingField ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
      <Modal
        title="Save Fields to Presets"
        isOpen={saveCriteriaToSetOpen}
        onClose={() => setSaveCriteriaToSetOpen(false)}
        width={470}
      >
        <div className="space-y-4 text-sm">
          <p className="text-[13px] text-[--color-text-muted]">
            Save this campaign's {criteriaFields.length} field
            {criteriaFields.length !== 1 ? "s" : ""} as either a new version of
            the active preset or as a brand new preset.
          </p>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-[--color-text-muted]">
              Save Mode
            </label>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                disabled={!localCriteriaSetId}
                onClick={() => setSaveCriteriaToSetMode("new_version")}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                  saveCriteriaToSetMode === "new_version"
                    ? "border-[--color-primary] bg-[--color-primary]/10"
                    : "border-[--color-border] bg-[--color-bg]"
                } ${!localCriteriaSetId ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <p className="text-xs font-medium text-[--color-text]">
                  Save as new version
                </p>
                <p className="text-[11px] text-[--color-text-muted]">
                  {localCriteriaSetId
                    ? `Adds a version to "${localCriteriaSetName || "Unnamed Preset"}".`
                    : "No active preset is applied to this campaign yet."}
                </p>
              </button>
              <button
                type="button"
                onClick={() => setSaveCriteriaToSetMode("new_set")}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                  saveCriteriaToSetMode === "new_set"
                    ? "border-[--color-primary] bg-[--color-primary]/10"
                    : "border-[--color-border] bg-[--color-bg]"
                }`}
              >
                <p className="text-xs font-medium text-[--color-text]">
                  Save as new Preset
                </p>
                <p className="text-[11px] text-[--color-text-muted]">
                  Creates a new preset with version 1.
                </p>
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wide text-[--color-text-muted]">
              Preset Name{saveCriteriaToSetMode === "new_set" ? " *" : ""}
            </label>
            <input
              type="text"
              value={saveCriteriaToSetDraft.name}
              onChange={(e) =>
                setSaveCriteriaToSetDraft((draft) => ({
                  ...draft,
                  name: e.target.value,
                }))
              }
              placeholder="e.g. Rideshare Base Criteria"
              className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] placeholder:text-[--color-text-muted] focus:outline-none focus:ring-1 focus:ring-[--color-primary]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wide text-[--color-text-muted]">
              Description
            </label>
            <input
              type="text"
              value={saveCriteriaToSetDraft.description}
              onChange={(e) =>
                setSaveCriteriaToSetDraft((draft) => ({
                  ...draft,
                  description: e.target.value,
                }))
              }
              placeholder="Optional"
              className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] placeholder:text-[--color-text-muted] focus:outline-none focus:ring-1 focus:ring-[--color-primary]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSaveCriteriaToSetOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={
                savingCriteriaToSet ||
                (saveCriteriaToSetMode === "new_set" &&
                  !saveCriteriaToSetDraft.name.trim())
              }
              onClick={saveCurrentCriteriaToCatalog}
            >
              {savingCriteriaToSet ? "Saving…" : "Save & Apply"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
