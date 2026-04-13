"use client";

import type { Dispatch, SetStateAction } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import type {
  Campaign,
  LogicCatalogSet,
  LogicCatalogVersion,
  LogicRule,
} from "@/lib/types";
import { getLogicCatalogSet } from "@/lib/api";

interface LogicCatalogModalsProps {
  campaign: Campaign | null;
  logicRules: LogicRule[];
  logicCatalogOpen: boolean;
  logicCatalogLoading: boolean;
  logicCatalogSets: LogicCatalogSet[];
  expandedLogicSetId: string | null;
  logicSetVersionsMap: Record<string, LogicCatalogVersion[]>;
  loadingLogicVersionsFor: string | null;
  applyingLogicCatalog: string | null;
  expandedLogicVersionRules: Set<string>;
  expandedLogicRuleDetails: Set<string>;
  localLogicSetId: string | null;
  localLogicSetName: string | null;
  localLogicSetVersion: number | null;
  saveLogicToSetOpen: boolean;
  saveLogicToSetMode: "new_version" | "new_set";
  saveLogicToSetDraft: { name: string; description: string };
  savingLogicToSet: boolean;
  setLogicCatalogOpen: Dispatch<SetStateAction<boolean>>;
  setExpandedLogicSetId: Dispatch<SetStateAction<string | null>>;
  setLogicSetVersionsMap: Dispatch<
    SetStateAction<Record<string, LogicCatalogVersion[]>>
  >;
  setLoadingLogicVersionsFor: Dispatch<SetStateAction<string | null>>;
  setExpandedLogicVersionRules: Dispatch<SetStateAction<Set<string>>>;
  setExpandedLogicRuleDetails: Dispatch<SetStateAction<Set<string>>>;
  setSaveLogicToSetOpen: Dispatch<SetStateAction<boolean>>;
  setSaveLogicToSetMode: Dispatch<SetStateAction<"new_version" | "new_set">>;
  setSaveLogicToSetDraft: Dispatch<
    SetStateAction<{ name: string; description: string }>
  >;
  applyLogicCatalogVersion: (
    setId: string,
    setName: string,
    version: number,
  ) => Promise<void>;
  saveCurrentLogicToCatalog: () => Promise<void>;
  openLogicCatalogModal: () => void;
  getLogicCatalogSet: typeof getLogicCatalogSet;
  normalizeFieldLabel: (label: string) => string;
  formatLogicOperatorLabel: (operator: string) => string;
  formatLogicConditionValue: (value?: string | string[]) => string;
}

export function LogicCatalogModals({
  campaign,
  logicRules,
  logicCatalogOpen,
  logicCatalogLoading,
  logicCatalogSets,
  expandedLogicSetId,
  logicSetVersionsMap,
  loadingLogicVersionsFor,
  applyingLogicCatalog,
  expandedLogicVersionRules,
  expandedLogicRuleDetails,
  localLogicSetId,
  localLogicSetName,
  localLogicSetVersion,
  saveLogicToSetOpen,
  saveLogicToSetMode,
  saveLogicToSetDraft,
  savingLogicToSet,
  setLogicCatalogOpen,
  setExpandedLogicSetId,
  setLogicSetVersionsMap,
  setLoadingLogicVersionsFor,
  setExpandedLogicVersionRules,
  setExpandedLogicRuleDetails,
  setSaveLogicToSetOpen,
  setSaveLogicToSetMode,
  setSaveLogicToSetDraft,
  applyLogicCatalogVersion,
  saveCurrentLogicToCatalog,
  openLogicCatalogModal,
  getLogicCatalogSet,
  normalizeFieldLabel,
  formatLogicOperatorLabel,
  formatLogicConditionValue,
}: LogicCatalogModalsProps) {
  return (
    <>
      <Modal
        title="Campaign Rules Catalog"
        isOpen={logicCatalogOpen}
        onClose={() => setLogicCatalogOpen(false)}
        width={640}
        bodyClassName="px-5 py-4 overflow-y-auto h-[520px]"
      >
        <div className="space-y-4 text-sm">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs text-[--color-text-muted] leading-relaxed">
              Versioned rule sets. Applying a version replaces this campaign's
              current rules with that catalog version.
            </p>
            <Button size="sm" variant="outline" onClick={openLogicCatalogModal}>
              Refresh
            </Button>
          </div>

          {localLogicSetId && localLogicSetVersion != null && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
              Currently applied:{" "}
              <strong>
                {localLogicSetName ??
                  logicCatalogSets.find((s) => s.id === localLogicSetId)
                    ?.name ??
                  localLogicSetId}
              </strong>{" "}
              v{localLogicSetVersion}
            </div>
          )}

          {logicCatalogLoading ? (
            <p className="text-sm text-[--color-text-muted]">Loading…</p>
          ) : logicCatalogSets.length === 0 ? (
            <p className="text-sm text-[--color-text-muted]">
              No rules catalog sets yet. Save current rules as a catalog set to
              create one.
            </p>
          ) : (
            <div className="divide-y divide-[--color-border] rounded-xl border border-[--color-border] overflow-hidden">
              {logicCatalogSets.map((set) => (
                <div key={set.id}>
                  <div
                    className="flex items-center gap-3 px-4 py-3 bg-[--color-bg] hover:bg-[--color-bg-muted] transition-colors cursor-pointer"
                    onClick={async () => {
                      if (expandedLogicSetId === set.id) {
                        setExpandedLogicSetId(null);
                        return;
                      }
                      setExpandedLogicSetId(set.id);
                      if (logicSetVersionsMap[set.id]) return;
                      setLoadingLogicVersionsFor(set.id);
                      try {
                        const res = await getLogicCatalogSet(set.id);
                        if (res.success) {
                          setLogicSetVersionsMap((prev) => ({
                            ...prev,
                            [set.id]: res.data.versions,
                          }));
                        }
                      } catch {
                        toast.error("Failed to load rules catalog versions.");
                      } finally {
                        setLoadingLogicVersionsFor(null);
                      }
                    }}
                  >
                    <span className="text-[--color-text-muted]">
                      {expandedLogicSetId === set.id ? (
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
                        {localLogicSetId === set.id && (
                          <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
                            Active
                          </span>
                        )}
                      </div>
                      {set.description && (
                        <p className="mt-0.5 text-[11px] text-[--color-text-muted]">
                          {set.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <AnimatePresence initial={false}>
                    {expandedLogicSetId === set.id && (
                      <motion.div
                        key={`logic-versions-${set.id}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        style={{ overflow: "hidden" }}
                        className="bg-[--color-bg-muted] border-t border-[--color-border]"
                      >
                        {loadingLogicVersionsFor === set.id ? (
                          <p className="px-6 py-3 text-xs text-[--color-text-muted]">
                            Loading versions…
                          </p>
                        ) : (logicSetVersionsMap[set.id] ?? []).length === 0 ? (
                          <p className="px-6 py-3 text-xs text-[--color-text-muted]">
                            No versions found.
                          </p>
                        ) : (
                          [...(logicSetVersionsMap[set.id] ?? [])]
                            .sort((a, b) => b.version - a.version)
                            .map((version) => {
                              const isApplied =
                                localLogicSetId === set.id &&
                                localLogicSetVersion === version.version;
                              const applyKey = `${set.id}#v${version.version}`;
                              return (
                                <div
                                  key={version.version}
                                  className="border-b last:border-0 border-[--color-border]"
                                >
                                  <div className="flex items-center gap-3 px-6 py-2.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setExpandedLogicVersionRules((prev) => {
                                          const next = new Set(prev);
                                          if (next.has(applyKey))
                                            next.delete(applyKey);
                                          else next.add(applyKey);
                                          return next;
                                        });
                                      }}
                                      className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                                    >
                                      <span className="text-[--color-text-muted]">
                                        {expandedLogicVersionRules.has(
                                          applyKey,
                                        ) ? (
                                          <ChevronDown size={11} />
                                        ) : (
                                          <ChevronRight size={11} />
                                        )}
                                      </span>
                                      <span className="font-mono text-[11px] font-semibold text-[--color-text-strong] w-6">
                                        v{version.version}
                                      </span>
                                      <span className="text-[11px] text-[--color-text-muted]">
                                        {version.rules.length} rule
                                        {version.rules.length !== 1 ? "s" : ""}
                                      </span>
                                    </button>
                                    {isApplied ? (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                                        <Check size={11} />
                                        Applied
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        disabled={applyingLogicCatalog !== null}
                                        onClick={() =>
                                          applyLogicCatalogVersion(
                                            set.id,
                                            set.name,
                                            version.version,
                                          )
                                        }
                                        className="inline-flex items-center gap-1 rounded-md border border-[--color-border] bg-[--color-surface] px-2.5 py-1 text-[11px] font-medium text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-bg] disabled:opacity-50 transition-colors"
                                      >
                                        {applyingLogicCatalog === applyKey
                                          ? "Applying…"
                                          : "Apply"}
                                      </button>
                                    )}
                                  </div>

                                  <AnimatePresence initial={false}>
                                    {expandedLogicVersionRules.has(
                                      applyKey,
                                    ) && (
                                      <motion.div
                                        key={`logic-rules-${applyKey}`}
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{
                                          duration: 0.18,
                                          ease: "easeOut",
                                        }}
                                        style={{ overflow: "hidden" }}
                                      >
                                        {version.rules.length === 0 ? (
                                          <p className="px-10 pb-3 text-[11px] text-[--color-text-muted]">
                                            No rules in this version.
                                          </p>
                                        ) : (
                                          <div className="space-y-1 border-t border-[--color-border] bg-[--color-bg] px-10 py-2.5">
                                            {version.rules.map((rule) => {
                                              const ruleDetailKey = `${applyKey}#rule:${rule.id}`;
                                              const condCount = (
                                                rule.conditions ?? []
                                              ).length;
                                              return (
                                                <div
                                                  key={rule.id}
                                                  className="rounded-md border border-[--color-border] bg-[--color-bg-muted]"
                                                >
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setExpandedLogicRuleDetails(
                                                        (prev) => {
                                                          const next = new Set(
                                                            prev,
                                                          );
                                                          if (
                                                            next.has(
                                                              ruleDetailKey,
                                                            )
                                                          ) {
                                                            next.delete(
                                                              ruleDetailKey,
                                                            );
                                                          } else {
                                                            next.add(
                                                              ruleDetailKey,
                                                            );
                                                          }
                                                          return next;
                                                        },
                                                      );
                                                    }}
                                                    className="flex w-full items-center gap-2 px-2.5 py-2 text-[11px]"
                                                  >
                                                    <span className="text-[--color-text-muted]">
                                                      {expandedLogicRuleDetails.has(
                                                        ruleDetailKey,
                                                      ) ? (
                                                        <ChevronDown
                                                          size={11}
                                                        />
                                                      ) : (
                                                        <ChevronRight
                                                          size={11}
                                                        />
                                                      )}
                                                    </span>
                                                    <span className="flex-1 truncate text-[--color-text] text-left">
                                                      {rule.name}
                                                    </span>
                                                    <span className="shrink-0 text-[10px] text-[--color-text-muted]">
                                                      {condCount}{" "}
                                                      {condCount === 1
                                                        ? "condition"
                                                        : "conditions"}
                                                    </span>
                                                  </button>
                                                  <AnimatePresence
                                                    initial={false}
                                                  >
                                                    {expandedLogicRuleDetails.has(
                                                      ruleDetailKey,
                                                    ) && (
                                                      <motion.div
                                                        key={`logic-rule-detail-${ruleDetailKey}`}
                                                        initial={{
                                                          height: 0,
                                                          opacity: 0,
                                                        }}
                                                        animate={{
                                                          height: "auto",
                                                          opacity: 1,
                                                        }}
                                                        exit={{
                                                          height: 0,
                                                          opacity: 0,
                                                        }}
                                                        transition={{
                                                          duration: 0.15,
                                                          ease: "easeOut",
                                                        }}
                                                        style={{
                                                          overflow: "hidden",
                                                        }}
                                                        className="border-t border-[--color-border] bg-[--color-bg] px-3 py-2"
                                                      >
                                                        <div className="space-y-1">
                                                          {(
                                                            rule.conditions ??
                                                            []
                                                          ).map(
                                                            (
                                                              condition,
                                                              condIdx,
                                                            ) => (
                                                              <p
                                                                key={`${rule.id}-cond-${condIdx}`}
                                                                className="text-[11px] text-[--color-text]"
                                                              >
                                                                <span className="font-medium">
                                                                  {normalizeFieldLabel(
                                                                    condition.field_name,
                                                                  )}
                                                                </span>{" "}
                                                                <span className="text-[--color-text-muted]">
                                                                  {formatLogicOperatorLabel(
                                                                    condition.operator,
                                                                  )}
                                                                </span>{" "}
                                                                <span className="font-mono text-[10px] text-[--color-text-muted]">
                                                                  {formatLogicConditionValue(
                                                                    condition.value,
                                                                  )}
                                                                </span>
                                                              </p>
                                                            ),
                                                          )}
                                                        </div>
                                                      </motion.div>
                                                    )}
                                                  </AnimatePresence>
                                                </div>
                                              );
                                            })}
                                          </div>
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
        </div>
      </Modal>
      <Modal
        title="Save Rules to Catalog"
        isOpen={saveLogicToSetOpen}
        onClose={() => setSaveLogicToSetOpen(false)}
        width={470}
      >
        <div className="space-y-4 text-sm">
          <p className="text-[13px] text-[--color-text-muted]">
            Save these campaign rules as either a new version of the active
            rules catalog entry or as a brand new rules catalog set.
          </p>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-[--color-text-muted]">
              Save Mode
            </label>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                disabled={!localLogicSetId}
                onClick={() => {
                  setSaveLogicToSetMode("new_version");
                  setSaveLogicToSetDraft((draft) => ({
                    ...draft,
                    name: localLogicSetName ?? localLogicSetId ?? draft.name,
                  }));
                }}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                  saveLogicToSetMode === "new_version"
                    ? "border-[--color-primary] bg-[--color-primary]/10"
                    : "border-[--color-border] bg-[--color-bg]"
                } ${!localLogicSetId ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <p className="text-xs font-medium text-[--color-text]">
                  Save as new version
                </p>
                <p className="text-[11px] text-[--color-text-muted]">
                  {localLogicSetId
                    ? `Adds a version to ${localLogicSetName ?? localLogicSetId}.`
                    : "No active catalog applied on this campaign yet."}
                </p>
              </button>
              <button
                type="button"
                onClick={() => setSaveLogicToSetMode("new_set")}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                  saveLogicToSetMode === "new_set"
                    ? "border-[--color-primary] bg-[--color-primary]/10"
                    : "border-[--color-border] bg-[--color-bg]"
                }`}
              >
                <p className="text-xs font-medium text-[--color-text]">
                  Save as new set
                </p>
                <p className="text-[11px] text-[--color-text-muted]">
                  Creates a brand new catalog entry with version 1.
                </p>
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wide text-[--color-text-muted]">
              Set Name{saveLogicToSetMode === "new_set" ? " *" : ""}
            </label>
            <input
              type="text"
              value={saveLogicToSetDraft.name}
              onChange={(e) =>
                setSaveLogicToSetDraft((draft) => ({
                  ...draft,
                  name: e.target.value,
                }))
              }
              disabled={saveLogicToSetMode === "new_version"}
              placeholder="e.g. Standard Campaign Logic"
              className={`w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] placeholder:text-[--color-text-muted] focus:outline-none focus:ring-1 focus:ring-[--color-primary] ${
                saveLogicToSetMode === "new_version"
                  ? "cursor-not-allowed opacity-60"
                  : ""
              }`}
            />
            {saveLogicToSetMode === "new_version" && (
              <p className="text-[11px] text-[--color-text-muted]">
                Set name is locked when saving a new version.
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wide text-[--color-text-muted]">
              Description
            </label>
            <input
              type="text"
              value={saveLogicToSetDraft.description}
              onChange={(e) =>
                setSaveLogicToSetDraft((draft) => ({
                  ...draft,
                  description: e.target.value,
                }))
              }
              placeholder="Optional description"
              className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] placeholder:text-[--color-text-muted] focus:outline-none focus:ring-1 focus:ring-[--color-primary]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSaveLogicToSetOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={
                savingLogicToSet ||
                (saveLogicToSetMode === "new_set" &&
                  !saveLogicToSetDraft.name.trim())
              }
              onClick={saveCurrentLogicToCatalog}
            >
              {savingLogicToSet ? "Saving…" : "Save & Apply"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
