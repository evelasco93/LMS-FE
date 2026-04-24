"use client";

import type { Dispatch, SetStateAction } from "react";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronRight, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import type {
  Campaign,
  CriteriaCatalogSet,
  CriteriaCatalogVersion,
  CriteriaField,
  CriteriaFieldType,
} from "@/lib/types";
import type { CatalogFieldDraft } from "@/components/campaign-detail/types";
import {
  applyCriteriaCatalog,
  createCriteriaCatalogSet,
  getCriteriaCatalogSet,
  listCriteriaCatalog,
  updateCriteriaCatalogSet,
} from "@/lib/api";
import { inputClass } from "@/lib/utils";

interface CriteriaCatalogModalProps {
  campaign: Campaign | null;
  criteriaFields: CriteriaField[];
  catalogOpen: boolean;
  catalogLoading: boolean;
  catalogSets: CriteriaCatalogSet[];
  catalogFormMode: "browse" | "create" | "edit";
  editingCatalogSet: CriteriaCatalogSet | null;
  catalogFormDraft: { name: string; description: string };
  catalogFieldDrafts: CatalogFieldDraft[];
  savingCatalog: boolean;
  expandedSetId: string | null;
  setVersionsMap: Record<string, CriteriaCatalogVersion[]>;
  loadingVersionsFor: string | null;
  applyingCatalog: string | null;
  expandedVersionFields: Set<string>;
  catalogBulkImportOpen: boolean;
  catalogBulkImportText: string;
  localCriteriaSetId: string | null;
  localCriteriaSetName: string | null;
  localCriteriaSetVersion: number | null;
  setCatalogOpen: Dispatch<SetStateAction<boolean>>;
  setCatalogFormMode: Dispatch<SetStateAction<"browse" | "create" | "edit">>;
  setEditingCatalogSet: Dispatch<SetStateAction<CriteriaCatalogSet | null>>;
  setCatalogFormDraft: Dispatch<
    SetStateAction<{ name: string; description: string }>
  >;
  setCatalogFieldDrafts: Dispatch<SetStateAction<CatalogFieldDraft[]>>;
  setSavingCatalog: Dispatch<SetStateAction<boolean>>;
  setCatalogSets: Dispatch<SetStateAction<CriteriaCatalogSet[]>>;
  setExpandedSetId: Dispatch<SetStateAction<string | null>>;
  setSetVersionsMap: Dispatch<
    SetStateAction<Record<string, CriteriaCatalogVersion[]>>
  >;
  setLoadingVersionsFor: Dispatch<SetStateAction<string | null>>;
  setApplyingCatalog: Dispatch<SetStateAction<string | null>>;
  setExpandedVersionFields: Dispatch<SetStateAction<Set<string>>>;
  setCatalogBulkImportOpen: Dispatch<SetStateAction<boolean>>;
  setCatalogBulkImportText: Dispatch<SetStateAction<string>>;
  setLocalCriteriaSetId: Dispatch<SetStateAction<string | null>>;
  setLocalCriteriaSetName: Dispatch<SetStateAction<string | null>>;
  setLocalCriteriaSetVersion: Dispatch<SetStateAction<number | null>>;
  setConfirmDeleteSet: Dispatch<SetStateAction<CriteriaCatalogSet | null>>;
  applyCriteriaCatalog: typeof applyCriteriaCatalog;
  refreshCriteria: () => void;
  getCriteriaCatalogSet: typeof getCriteriaCatalogSet;
  createCriteriaCatalogSet: typeof createCriteriaCatalogSet;
  updateCriteriaCatalogSet: typeof updateCriteriaCatalogSet;
  normalizeFieldLabel: (label: string) => string;
  onCampaignUpdate?: (update: Partial<Campaign>) => void;
}

export function CriteriaCatalogModal({
  campaign,
  criteriaFields,
  catalogOpen,
  catalogLoading,
  catalogSets,
  catalogFormMode,
  editingCatalogSet,
  catalogFormDraft,
  catalogFieldDrafts,
  savingCatalog,
  expandedSetId,
  setVersionsMap,
  loadingVersionsFor,
  applyingCatalog,
  expandedVersionFields,
  catalogBulkImportOpen,
  catalogBulkImportText,
  localCriteriaSetId,
  localCriteriaSetName,
  localCriteriaSetVersion,
  setCatalogOpen,
  setCatalogFormMode,
  setEditingCatalogSet,
  setCatalogFormDraft,
  setCatalogFieldDrafts,
  setSavingCatalog,
  setCatalogSets,
  setExpandedSetId,
  setSetVersionsMap,
  setLoadingVersionsFor,
  setApplyingCatalog,
  setExpandedVersionFields,
  setCatalogBulkImportOpen,
  setCatalogBulkImportText,
  setLocalCriteriaSetId,
  setLocalCriteriaSetName,
  setLocalCriteriaSetVersion,
  setConfirmDeleteSet,
  applyCriteriaCatalog,
  refreshCriteria,
  getCriteriaCatalogSet,
  createCriteriaCatalogSet,
  updateCriteriaCatalogSet,
  normalizeFieldLabel,
  onCampaignUpdate,
}: CriteriaCatalogModalProps) {
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    catalogSets.forEach((s) => s.tags?.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [catalogSets]);

  const filteredSets = useMemo(
    () =>
      activeTag
        ? catalogSets.filter((s) => s.tags?.includes(activeTag))
        : catalogSets,
    [catalogSets, activeTag],
  );

  if (!campaign) return null;

  return (
    <>
      <Modal
        title={
          catalogFormMode === "create"
            ? "New Preset"
            : catalogFormMode === "edit"
              ? `Edit: ${editingCatalogSet?.name ?? ""}`
              : "Presets Library"
        }
        isOpen={catalogOpen}
        onClose={() => {
          setCatalogOpen(false);
          setCatalogFormMode("browse");
        }}
        width={640}
        bodyClassName="px-5 py-4 overflow-y-auto h-[520px]"
      >
        <AnimatePresence mode="wait" initial={false}>
          {/* ── browse view ─────────────────────────────────────────────── */}
          {catalogFormMode === "browse" && (
            <motion.div
              key="catalog-browse"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="space-y-4 text-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs text-[--color-text-muted] leading-relaxed">
                  Versioned criteria sets. Apply a version to copy its fields
                  into this campaign's criteria.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCatalogFormMode("create");
                    setCatalogFormDraft({ name: "", description: "" });
                    setCatalogFieldDrafts([]);
                  }}
                  className="shrink-0 inline-flex items-center gap-1 rounded-md border border-[--color-border] bg-[--color-bg-muted] px-2.5 py-1.5 text-[11px] font-medium text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-bg] transition-colors"
                >
                  <Plus size={11} />
                  New Set
                </button>
              </div>

              {/* Tag filter pills */}
              {allTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveTag(null)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      activeTag === null
                        ? "bg-[--color-primary] text-white"
                        : "bg-[--color-bg-muted] text-[--color-text-muted] hover:text-[--color-text] border border-[--color-border]"
                    }`}
                  >
                    All
                  </button>
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        setActiveTag(activeTag === tag ? null : tag)
                      }
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        activeTag === tag
                          ? "bg-[--color-primary] text-white"
                          : "bg-[--color-bg-muted] text-[--color-text-muted] hover:text-[--color-text] border border-[--color-border]"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}

              {catalogLoading ? (
                <p className="text-sm text-[--color-text-muted]">Loading…</p>
              ) : filteredSets.length === 0 ? (
                <p className="text-sm text-[--color-text-muted]">
                  {activeTag
                    ? `No presets with tag "${activeTag}".`
                    : "No presets yet. Create one to get started."}
                </p>
              ) : (
                <div className="divide-y divide-[--color-border] rounded-xl border border-[--color-border] overflow-hidden">
                  {filteredSets.map((set) => (
                    <div key={set.id}>
                      {/* set header row */}
                      <div
                        className="flex items-center gap-3 px-4 py-3 bg-[--color-bg] hover:bg-[--color-bg-muted] transition-colors cursor-pointer"
                        onClick={async () => {
                          if (expandedSetId === set.id) {
                            setExpandedSetId(null);
                            return;
                          }
                          setExpandedSetId(set.id);
                          if (setVersionsMap[set.id]) return;
                          setLoadingVersionsFor(set.id);
                          try {
                            const res = await getCriteriaCatalogSet(set.id);
                            if (res.success) {
                              setSetVersionsMap((prev) => ({
                                ...prev,
                                [set.id]: res.data.versions,
                              }));
                            }
                          } catch {
                            toast.error("Failed to load versions.");
                          } finally {
                            setLoadingVersionsFor(null);
                          }
                        }}
                      >
                        <span className="text-[--color-text-muted]">
                          {expandedSetId === set.id ? (
                            <ChevronDown size={14} />
                          ) : (
                            <ChevronRight size={14} />
                          )}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-[--color-text-strong] text-[13px]">
                              {set.name}
                            </span>
                            <span className="font-mono text-[10px] text-[--color-text-muted] bg-[--color-bg-muted] border border-[--color-border] rounded px-1.5 py-0.5">
                              v{set.latest_version}
                            </span>
                          </div>
                          {set.description && (
                            <p className="mt-0.5 text-[11px] text-[--color-text-muted]">
                              {set.description}
                            </p>
                          )}
                          {set.tags && set.tags.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {set.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded bg-[--color-bg-muted] border border-[--color-border] px-1.5 py-0.5 text-[10px] text-[--color-text-muted]"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* versions panel (expanded) */}
                      <AnimatePresence initial={false}>
                        {expandedSetId === set.id && (
                          <motion.div
                            key={`versions-${set.id}`}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            style={{ overflow: "hidden" }}
                            className="bg-[--color-bg-muted] border-t border-[--color-border]"
                          >
                            {loadingVersionsFor === set.id ? (
                              <p className="px-6 py-3 text-xs text-[--color-text-muted]">
                                Loading versions…
                              </p>
                            ) : (setVersionsMap[set.id] ?? []).length === 0 ? (
                              <p className="px-6 py-3 text-xs text-[--color-text-muted]">
                                No versions found.
                              </p>
                            ) : (
                              [...(setVersionsMap[set.id] ?? [])]
                                .sort((a, b) => b.version - a.version)
                                .map((v) => {
                                  const applyKey = `${set.id}#v${v.version}`;
                                  return (
                                    <div
                                      key={v.version}
                                      className="border-b last:border-0 border-[--color-border]"
                                    >
                                      {/* version header row */}
                                      <div className="flex items-center gap-3 px-6 py-2.5">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const key = applyKey;
                                            setExpandedVersionFields((prev) => {
                                              const next = new Set(prev);
                                              if (next.has(key))
                                                next.delete(key);
                                              else next.add(key);
                                              return next;
                                            });
                                          }}
                                          className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                                        >
                                          <span className="text-[--color-text-muted]">
                                            {expandedVersionFields.has(
                                              applyKey,
                                            ) ? (
                                              <ChevronDown size={11} />
                                            ) : (
                                              <ChevronRight size={11} />
                                            )}
                                          </span>
                                          <span className="font-mono text-[11px] font-semibold text-[--color-text-strong] w-6">
                                            v{v.version}
                                          </span>
                                          <span className="text-[11px] text-[--color-text-muted]">
                                            {v.fields.length} field
                                            {v.fields.length !== 1 ? "s" : ""}
                                          </span>
                                          {v.campaigns_using.length > 0 && (
                                            <span className="text-[10px] text-[--color-text-muted]">
                                              · {v.campaigns_using.length}{" "}
                                              campaign
                                              {v.campaigns_using.length !== 1
                                                ? "s"
                                                : ""}
                                            </span>
                                          )}
                                        </button>
                                        <span className="text-[10px] text-[--color-text-muted]">
                                          {v.created_at
                                            ? new Date(
                                                v.created_at,
                                              ).toLocaleDateString()
                                            : ""}
                                        </span>
                                        <div className="shrink-0">
                                          <button
                                            type="button"
                                            disabled={applyingCatalog !== null}
                                            onClick={async () => {
                                              setApplyingCatalog(applyKey);
                                              try {
                                                await applyCriteriaCatalog(
                                                  campaign.id,
                                                  set.id,
                                                  v.version,
                                                );
                                                toast.success(
                                                  `Applied "${set.name}" v${v.version}.`,
                                                );
                                                await refreshCriteria();
                                              } catch (err: any) {
                                                toast.error(
                                                  err?.message ||
                                                    "Failed to apply preset version.",
                                                );
                                              } finally {
                                                setApplyingCatalog(null);
                                              }
                                            }}
                                            className="inline-flex items-center gap-1 rounded-md border border-[--color-border] bg-[--color-surface] px-2.5 py-1 text-[11px] font-medium text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-bg] disabled:opacity-50 transition-colors"
                                          >
                                            {applyingCatalog === applyKey
                                              ? "Applying…"
                                              : "Apply"}
                                          </button>
                                        </div>
                                      </div>
                                      {/* expandable fields table */}
                                      <AnimatePresence initial={false}>
                                        {expandedVersionFields.has(
                                          applyKey,
                                        ) && (
                                          <motion.div
                                            key={`vf-${applyKey}`}
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{
                                              height: "auto",
                                              opacity: 1,
                                            }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{
                                              duration: 0.18,
                                              ease: "easeOut",
                                            }}
                                            style={{ overflow: "hidden" }}
                                          >
                                            {v.fields.length === 0 ? (
                                              <p className="px-10 pb-3 text-[11px] text-[--color-text-muted]">
                                                No fields in this version.
                                              </p>
                                            ) : (
                                              <table className="w-full text-[11px] border-t border-[--color-border] bg-[--color-bg]">
                                                <thead>
                                                  <tr className="bg-[--color-bg-muted]">
                                                    <th className="pl-10 pr-3 py-1.5 text-left text-[10px] uppercase tracking-wide text-[--color-text-muted] font-medium">
                                                      Label
                                                    </th>
                                                    <th className="px-3 py-1.5 text-left text-[10px] uppercase tracking-wide text-[--color-text-muted] font-medium">
                                                      Name
                                                    </th>
                                                    <th className="px-3 py-1.5 text-left text-[10px] uppercase tracking-wide text-[--color-text-muted] font-medium">
                                                      Type
                                                    </th>
                                                    <th className="px-3 py-1.5 text-center text-[10px] uppercase tracking-wide text-[--color-text-muted] font-medium">
                                                      Req
                                                    </th>
                                                  </tr>
                                                </thead>
                                                <tbody className="divide-y divide-[--color-border]">
                                                  {v.fields.map((fld) => (
                                                    <tr key={fld.field_name}>
                                                      <td className="pl-10 pr-3 py-1.5 text-[--color-text]">
                                                        {fld.field_label}
                                                      </td>
                                                      <td className="px-3 py-1.5 font-mono text-[10px] text-[--color-text-muted]">
                                                        {fld.field_name}
                                                      </td>
                                                      <td className="px-3 py-1.5 text-[--color-text-muted]">
                                                        {fld.data_type}
                                                      </td>
                                                      <td className="px-3 py-1.5 text-center">
                                                        {fld.required ? (
                                                          <span className="text-[10px] font-medium text-rose-500">
                                                            Yes
                                                          </span>
                                                        ) : (
                                                          <span className="text-[10px] text-[--color-text-muted]">
                                                            —
                                                          </span>
                                                        )}
                                                      </td>
                                                    </tr>
                                                  ))}
                                                </tbody>
                                              </table>
                                            )}
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  );
                                })
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── create / edit form view ──────────────────────────────────── */}
          {(catalogFormMode === "create" || catalogFormMode === "edit") && (
            <motion.div
              key="catalog-form"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="space-y-4 text-sm"
            >
              {/* back link */}
              <button
                type="button"
                onClick={() => setCatalogFormMode("browse")}
                className="inline-flex items-center gap-1 text-[11px] text-[--color-text-muted] hover:text-[--color-text] transition-colors"
              >
                <ChevronRight size={11} className="rotate-180" />
                Back to presets
              </button>

              {/* name */}
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                  Name
                </p>
                <input
                  className={inputClass}
                  placeholder="e.g. Standard residential criteria"
                  value={catalogFormDraft.name}
                  onChange={(e) =>
                    setCatalogFormDraft((p) => ({ ...p, name: e.target.value }))
                  }
                />
              </div>

              {/* description */}
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                  Description{" "}
                  <span className="normal-case font-normal">(optional)</span>
                </p>
                <textarea
                  className={inputClass}
                  rows={2}
                  placeholder="Optional notes about this criteria set"
                  value={catalogFormDraft.description}
                  onChange={(e) =>
                    setCatalogFormDraft((p) => ({
                      ...p,
                      description: e.target.value,
                    }))
                  }
                />
              </div>

              {/* fields list */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                    Fields{" "}
                    {catalogFormMode === "edit" && (
                      <span className="normal-case font-normal text-[--color-text-muted]">
                        — saving creates a new version
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCatalogBulkImportOpen((v) => !v)}
                      className="inline-flex items-center gap-1 text-[11px] text-[--color-text-muted] hover:text-[--color-text] hover:underline"
                    >
                      <Upload size={11} />
                      Bulk import
                    </button>
                  </div>
                </div>

                {/* bulk import panel */}
                <AnimatePresence initial={false}>
                  {catalogBulkImportOpen && (
                    <motion.div
                      key="catalog-bulk"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      style={{ overflow: "hidden" }}
                    >
                      <div className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-3 space-y-2 text-[11px]">
                        <p className="text-[--color-text-muted]">
                          Paste a JSON array of field objects. Each object must
                          have{" "}
                          <code className="font-mono text-[--color-text]">
                            field_label
                          </code>{" "}
                          and{" "}
                          <code className="font-mono text-[--color-text]">
                            field_name
                          </code>
                          . Optional:{" "}
                          <code className="font-mono text-[--color-text]">
                            data_type
                          </code>
                          ,{" "}
                          <code className="font-mono text-[--color-text]">
                            required
                          </code>
                          ,{" "}
                          <code className="font-mono text-[--color-text]">
                            description
                          </code>
                          .
                        </p>
                        <textarea
                          className={`${inputClass} min-h-[100px] resize-y font-mono text-[11px]`}
                          placeholder={`[
  {
    "field_label": "First Name",
    "field_name": "first_name",
    "data_type": "Text",
    "required": true,
    "description": "Applicant first name"
  }
]`}
                          value={catalogBulkImportText}
                          onChange={(e) =>
                            setCatalogBulkImportText(e.target.value)
                          }
                        />
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setCatalogBulkImportOpen(false);
                              setCatalogBulkImportText("");
                            }}
                            className="text-[11px] text-[--color-text-muted] hover:text-[--color-text] transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              let parsed: any[];
                              try {
                                parsed = JSON.parse(catalogBulkImportText);
                                if (!Array.isArray(parsed))
                                  throw new Error("Expected a JSON array");
                              } catch (err: any) {
                                toast.error(
                                  `Invalid JSON: ${err.message ?? "parse error"}`,
                                );
                                return;
                              }
                              const validTypes = [
                                "Text",
                                "Number",
                                "Boolean",
                                "Date",
                                "List",
                              ];
                              const imported: CatalogFieldDraft[] = [];
                              for (const item of parsed) {
                                if (
                                  !item.field_label?.trim() ||
                                  !item.field_name?.trim()
                                ) {
                                  toast.error(
                                    "Each field must have field_label and field_name",
                                  );
                                  return;
                                }
                                const dt = validTypes.includes(item.data_type)
                                  ? item.data_type
                                  : "Text";
                                imported.push({
                                  field_label: String(item.field_label).trim(),
                                  field_name: String(item.field_name)
                                    .trim()
                                    .toLowerCase()
                                    .replace(/\s+/g, "_")
                                    .replace(/[^a-z0-9_]/g, ""),
                                  data_type: dt as CriteriaFieldType,
                                  required: Boolean(item.required),
                                  description: item.description
                                    ? String(item.description)
                                    : "",
                                  state_mapping: null,
                                });
                              }
                              setCatalogFieldDrafts((prev) => [
                                ...prev,
                                ...imported,
                              ]);
                              toast.success(
                                `${imported.length} field${imported.length !== 1 ? "s" : ""} imported.`,
                              );
                              setCatalogBulkImportOpen(false);
                              setCatalogBulkImportText("");
                            }}
                            className="rounded-md bg-[--color-primary] text-white px-2.5 py-1 text-[11px] font-medium hover:opacity-90 transition-opacity"
                          >
                            Import fields
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {catalogFieldDrafts.length === 0 ? (
                  <p className="text-[11px] text-[--color-text-muted]">
                    No fields yet. You can add them after saving too.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {catalogFieldDrafts.map((f, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-3 space-y-2"
                      >
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            className={inputClass}
                            placeholder="Label"
                            value={f.field_label}
                            onChange={(e) => {
                              const label = e.target.value;
                              setCatalogFieldDrafts((prev) =>
                                prev.map((item, idx) =>
                                  idx !== i
                                    ? item
                                    : {
                                        ...item,
                                        field_label: label,
                                        field_name:
                                          item.field_name ===
                                          item.field_label
                                            .toLowerCase()
                                            .replace(/\s+/g, "_")
                                            .replace(/[^a-z0-9_]/g, "")
                                            ? label
                                                .toLowerCase()
                                                .replace(/\s+/g, "_")
                                                .replace(/[^a-z0-9_]/g, "")
                                            : item.field_name,
                                      },
                                ),
                              );
                            }}
                          />
                          <input
                            className={`${inputClass} font-mono text-[11px]`}
                            placeholder="field_name"
                            value={f.field_name}
                            onChange={(e) =>
                              setCatalogFieldDrafts((prev) =>
                                prev.map((item, idx) =>
                                  idx === i
                                    ? { ...item, field_name: e.target.value }
                                    : item,
                                ),
                              )
                            }
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            className={inputClass}
                            value={f.data_type}
                            onChange={(e) =>
                              setCatalogFieldDrafts((prev) =>
                                prev.map((item, idx) =>
                                  idx === i
                                    ? {
                                        ...item,
                                        data_type: e.target
                                          .value as CriteriaFieldType,
                                      }
                                    : item,
                                ),
                              )
                            }
                          >
                            {(
                              [
                                "Text",
                                "Number",
                                "Boolean",
                                "Date",
                                "List",
                              ] as CriteriaFieldType[]
                            ).map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                          <label className="flex items-center gap-2 text-[11px] text-[--color-text] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={f.required}
                              onChange={(e) =>
                                setCatalogFieldDrafts((prev) =>
                                  prev.map((item, idx) =>
                                    idx === i
                                      ? { ...item, required: e.target.checked }
                                      : item,
                                  ),
                                )
                              }
                            />
                            Required
                          </label>
                        </div>
                        <div className="flex items-start gap-2">
                          <input
                            className={`${inputClass} flex-1 text-[11px]`}
                            placeholder="Description (optional)"
                            value={f.description}
                            onChange={(e) =>
                              setCatalogFieldDrafts((prev) =>
                                prev.map((item, idx) =>
                                  idx === i
                                    ? { ...item, description: e.target.value }
                                    : item,
                                ),
                              )
                            }
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setCatalogFieldDrafts((prev) =>
                                prev.filter((_, idx) => idx !== i),
                              )
                            }
                            className="shrink-0 p-1.5 rounded text-[--color-text-muted] hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                            title="Delete field"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* add field button at bottom */}
              <button
                type="button"
                onClick={() =>
                  setCatalogFieldDrafts((prev) => [
                    ...prev,
                    {
                      field_label: "",
                      field_name: "",
                      data_type: "Text",
                      required: false,
                      description: "",
                      state_mapping: null,
                    },
                  ])
                }
                className="w-full rounded-lg border border-dashed border-[--color-border] py-2 text-xs text-[--color-text-muted] hover:border-[--color-primary] hover:text-[--color-primary] transition-colors inline-flex items-center justify-center gap-1"
              >
                <Plus size={12} />
                Add field
              </button>

              {/* submit row */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[--color-border]">
                <button
                  type="button"
                  onClick={() => setCatalogFormMode("browse")}
                  className="rounded-md border border-[--color-border] bg-[--color-bg-muted] px-3 py-1.5 text-[11px] font-medium text-[--color-text-muted] hover:text-[--color-text] disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingCatalog || !catalogFormDraft.name.trim()}
                  onClick={async () => {
                    setSavingCatalog(true);
                    const fields = catalogFieldDrafts
                      .filter(
                        (f) => f.field_label.trim() && f.field_name.trim(),
                      )
                      .map((f) => ({
                        field_label: f.field_label.trim(),
                        field_name: f.field_name.trim(),
                        data_type: f.data_type,
                        required: f.required,
                        ...(f.description
                          ? { description: f.description }
                          : {}),
                        ...(f.state_mapping
                          ? { state_mapping: f.state_mapping }
                          : {}),
                      }));
                    try {
                      if (catalogFormMode === "create") {
                        await createCriteriaCatalogSet({
                          name: catalogFormDraft.name.trim(),
                          ...(catalogFormDraft.description
                            ? { description: catalogFormDraft.description }
                            : {}),
                          ...(fields.length > 0 ? { fields } : {}),
                        });
                        toast.success("Preset created.");
                      } else {
                        await updateCriteriaCatalogSet(editingCatalogSet!.id, {
                          name: catalogFormDraft.name.trim(),
                          ...(catalogFormDraft.description !== undefined
                            ? { description: catalogFormDraft.description }
                            : {}),
                          fields,
                        });
                        // clear cached versions so they reload on next expand
                        setSetVersionsMap((prev) => {
                          const next = { ...prev };
                          delete next[editingCatalogSet!.id];
                          return next;
                        });
                        toast.success("Preset updated — new version saved.");
                      }
                      // refresh catalog list
                      const res = await listCriteriaCatalog();
                      if (res.success) {
                        setCatalogSets(res.data.items);
                      }
                      setCatalogFormMode("browse");
                    } catch (err: any) {
                      toast.error(err?.message || "Failed to save preset.");
                    } finally {
                      setSavingCatalog(false);
                    }
                  }}
                  className="rounded-md bg-[--color-primary] text-white px-3 py-1.5 text-[11px] font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {savingCatalog
                    ? "Saving…"
                    : catalogFormMode === "create"
                      ? "Create Set"
                      : "Save Changes"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Modal>
    </>
  );
}
