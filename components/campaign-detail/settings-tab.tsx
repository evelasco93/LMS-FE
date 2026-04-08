"use client";

import type { Dispatch, SetStateAction } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/button";
import { createCriteriaField, updateCampaign } from "@/lib/api";
import type {
  Campaign,
  CampaignClient,
  Client,
  ClientDeliveryConfig,
  CriteriaField,
  CriteriaFieldOption,
  CriteriaFieldType,
  CriteriaCatalogSet,
  CriteriaValueMapping,
  DistributionMode,
  LogicRule,
} from "@/lib/types";

type FieldDraft = {
  field_label: string;
  field_name: string;
  data_type: CriteriaFieldType;
  required: boolean;
  description: string;
  state_mapping: "abbr_to_name" | "name_to_abbr" | null;
  options: CriteriaFieldOption[];
};

interface SettingsTabProps {
  campaign: Campaign | null;
  settingsSubTab: "base-criteria" | "logic" | "routing";
  handleSubTabChange: (sub: "base-criteria" | "logic" | "routing") => void;
  localCriteriaSetId: string | null;
  localCriteriaSetName: string | null;
  localCriteriaSetVersion: number | null;
  catalogSets: CriteriaCatalogSet[];
  criteriaFields: CriteriaField[];
  criteriaLoading: boolean;
  emptyFieldDraft: FieldDraft;
  campaignBulkImportOpen: boolean;
  campaignBulkImportText: string;
  campaignBulkImporting: boolean;
  setSaveCriteriaToSetMode: Dispatch<SetStateAction<"new_version" | "new_set">>;
  setSaveCriteriaToSetDraft: Dispatch<
    SetStateAction<{ name: string; description: string }>
  >;
  setSaveCriteriaToSetOpen: Dispatch<SetStateAction<boolean>>;
  openCriteriaCatalogModal: () => void;
  setCampaignBulkImportOpen: Dispatch<SetStateAction<boolean>>;
  setCampaignBulkImportText: Dispatch<SetStateAction<string>>;
  setCampaignBulkImporting: Dispatch<SetStateAction<boolean>>;
  setFieldDraft: Dispatch<SetStateAction<FieldDraft>>;
  setEditFieldData: Dispatch<SetStateAction<CriteriaField | null>>;
  setAddFieldOpen: Dispatch<SetStateAction<boolean>>;
  setDeleteFieldTarget: Dispatch<SetStateAction<CriteriaField | null>>;
  setValueMappingsField: Dispatch<SetStateAction<CriteriaField | null>>;
  setValueMappingsDraft: Dispatch<
    SetStateAction<{ fromText: string; to: string }[]>
  >;
  setValueMappingsStateDraft: Dispatch<
    SetStateAction<"abbr_to_name" | "name_to_abbr" | null>
  >;
  refreshCriteria: () => void;
  localLogicSetId: string | null;
  localLogicSetName: string | null;
  localLogicSetVersion: number | null;
  logicRules: LogicRule[];
  logicRulesLoading: boolean;
  deletingRuleId: string | null;
  setSaveLogicToSetMode: Dispatch<SetStateAction<"new_version" | "new_set">>;
  setSaveLogicToSetDraft: Dispatch<
    SetStateAction<{ name: string; description: string }>
  >;
  setSaveLogicToSetOpen: Dispatch<SetStateAction<boolean>>;
  openLogicCatalogModal: () => void;
  setEditingRule: Dispatch<SetStateAction<LogicRule | null>>;
  setLogicBuilderOpen: Dispatch<SetStateAction<boolean>>;
  handleToggleLogicRule: (rule: LogicRule) => Promise<void>;
  handleDeleteLogicRule: (ruleId: string) => Promise<void>;
  routingMode: DistributionMode;
  routingEnabled: boolean;
  routingWeights: Record<string, number>;
  savingRouting: boolean;
  linkedClients: Client[];
  clientLinkMap: Map<string, CampaignClient>;
  setRoutingEnabled: Dispatch<SetStateAction<boolean>>;
  setRoutingWeights: Dispatch<SetStateAction<Record<string, number>>>;
  setSavingRouting: Dispatch<SetStateAction<boolean>>;
  setConfirmModeChange: Dispatch<SetStateAction<DistributionMode | null>>;
  onCampaignUpdate?: (update: Partial<Campaign>) => void;
  onUpdateCampaignDistribution: (
    campaignId: string,
    payload: { mode: DistributionMode; enabled: boolean },
  ) => Promise<void>;
  onUpdateClientWeight: (
    campaignId: string,
    clientId: string,
    deliveryConfig: ClientDeliveryConfig,
    weight: number,
  ) => Promise<void>;
  updateCampaign: typeof updateCampaign;
}

export default function SettingsTab({
  campaign,
  settingsSubTab,
  handleSubTabChange,
  localCriteriaSetId,
  localCriteriaSetName,
  localCriteriaSetVersion,
  catalogSets,
  criteriaFields,
  criteriaLoading,
  emptyFieldDraft,
  campaignBulkImportOpen,
  campaignBulkImportText,
  campaignBulkImporting,
  setSaveCriteriaToSetMode,
  setSaveCriteriaToSetDraft,
  setSaveCriteriaToSetOpen,
  openCriteriaCatalogModal,
  setCampaignBulkImportOpen,
  setCampaignBulkImportText,
  setCampaignBulkImporting,
  setFieldDraft,
  setEditFieldData,
  setAddFieldOpen,
  setDeleteFieldTarget,
  setValueMappingsField,
  setValueMappingsDraft,
  setValueMappingsStateDraft,
  refreshCriteria,
  localLogicSetId,
  localLogicSetName,
  localLogicSetVersion,
  logicRules,
  logicRulesLoading,
  deletingRuleId,
  setSaveLogicToSetMode,
  setSaveLogicToSetDraft,
  setSaveLogicToSetOpen,
  openLogicCatalogModal,
  setEditingRule,
  setLogicBuilderOpen,
  handleToggleLogicRule,
  handleDeleteLogicRule,
  routingMode,
  routingEnabled,
  routingWeights,
  savingRouting,
  linkedClients,
  clientLinkMap,
  setRoutingEnabled,
  setRoutingWeights,
  setSavingRouting,
  setConfirmModeChange,
  onCampaignUpdate,
  onUpdateCampaignDistribution,
  onUpdateClientWeight,
  updateCampaign,
}: SettingsTabProps) {
  if (!campaign) return null;

  const CRITERIA_TYPE_LABELS: Record<CriteriaFieldType, string> = {
    Text: "Text",
    Number: "Number",
    Date: "Date",
    List: "List",
    "US State": "US State",
    Boolean: "Boolean",
  };

  const getClientLeadCount = (link?: CampaignClient) => {
    return link?.leads_delivered_count ?? 0;
  };

  return (
    <div className="space-y-4">
      {/* Settings sub-tabs */}
      <div
        role="tablist"
        className="flex items-center gap-1 border-b border-[--color-border]"
      >
        {(["base-criteria", "logic", "routing"] as const).map((sub) => (
          <button
            key={sub}
            type="button"
            role="tab"
            aria-selected={settingsSubTab === sub}
            onClick={() => handleSubTabChange(sub)}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition ${
              settingsSubTab === sub
                ? "border-[--color-primary] text-[--color-text-strong]"
                : "border-transparent text-[--color-text-muted] hover:text-[--color-text]"
            }`}
          >
            {sub === "base-criteria"
              ? "Fields"
              : sub === "logic"
                ? "Rules"
                : "Distribution"}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {settingsSubTab === "base-criteria" && (
          <motion.div
            key="criteria"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="space-y-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2">
              <div className="min-h-[28px] flex items-center">
                {localCriteriaSetId && localCriteriaSetVersion != null ? (
                  <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-700">
                    <Check size={12} className="shrink-0 text-emerald-600" />
                    <span>
                      Active catalog:{" "}
                      <strong>
                        {localCriteriaSetName ??
                          catalogSets.find((s) => s.id === localCriteriaSetId)
                            ?.name ??
                          localCriteriaSetId}
                      </strong>{" "}
                      v{localCriteriaSetVersion}
                    </span>
                  </div>
                ) : (
                  <p className="text-[11px] text-[--color-text-muted]">
                    No active fields catalog applied.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {criteriaFields.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSaveCriteriaToSetMode(
                        localCriteriaSetId ? "new_version" : "new_set",
                      );
                      setSaveCriteriaToSetDraft({
                        name: localCriteriaSetName ?? "",
                        description: "",
                      });
                      setSaveCriteriaToSetOpen(true);
                    }}
                    className="shrink-0 rounded-md border border-[--color-border] bg-[--color-bg-muted] px-3 py-1.5 text-[11px] font-medium text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-bg] transition-colors"
                  >
                    Save to Catalog
                  </button>
                )}
                <button
                  type="button"
                  onClick={openCriteriaCatalogModal}
                  className="shrink-0 rounded-md border border-[--color-border] bg-[--color-bg-muted] px-3 py-1.5 text-[11px] font-medium text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-bg] transition-colors"
                >
                  Fields Catalog
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCampaignBulkImportOpen((v) => !v);
                    setCampaignBulkImportText("");
                  }}
                  className="shrink-0 rounded-md border border-[--color-border] bg-[--color-bg-muted] px-3 py-1.5 text-[11px] font-medium text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-bg] transition-colors"
                >
                  Bulk import
                </button>
                <Button
                  size="sm"
                  iconLeft={<Plus size={14} />}
                  onClick={() => {
                    setFieldDraft(emptyFieldDraft);
                    setEditFieldData(null);
                    setAddFieldOpen(true);
                  }}
                >
                  Add Field
                </Button>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {campaignBulkImportOpen && (
                <motion.div
                  key="campaign-bulk-import"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{
                    duration: 0.18,
                    ease: "easeOut",
                  }}
                  className="overflow-hidden"
                >
                  <div className="rounded-xl border border-[--color-border] bg-[--color-bg-muted] p-4 space-y-3">
                    <p className="text-[11px] font-medium text-[--color-text-muted] uppercase tracking-wide">
                      Bulk import fields — paste a JSON array
                    </p>
                    <p className="text-[11px] text-[--color-text-muted]">
                      Each object must have{" "}
                      <code className="font-mono">field_label</code> and{" "}
                      <code className="font-mono">field_name</code>. Optional:{" "}
                      <code className="font-mono">data_type</code>,{" "}
                      <code className="font-mono">required</code>,{" "}
                      <code className="font-mono">description</code>.
                    </p>
                    <textarea
                      rows={5}
                      className="w-full rounded-lg border border-[--color-border] bg-[--color-bg] px-3 py-2 font-mono text-[11px] text-[--color-text] placeholder:text-[--color-text-muted] focus:outline-none focus:ring-1 focus:ring-[--color-primary] resize-y"
                      placeholder={
                        '[\n  { "field_label": "First Name", "field_name": "first_name", "data_type": "Text", "required": true }\n]'
                      }
                      value={campaignBulkImportText}
                      onChange={(e) =>
                        setCampaignBulkImportText(e.target.value)
                      }
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCampaignBulkImportOpen(false);
                          setCampaignBulkImportText("");
                        }}
                        className="rounded-md border border-[--color-border] bg-[--color-bg] px-2.5 py-1 text-[11px] font-medium text-[--color-text-muted] hover:text-[--color-text] transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={
                          campaignBulkImporting ||
                          !campaignBulkImportText.trim()
                        }
                        onClick={async () => {
                          let parsed: any[];
                          try {
                            parsed = JSON.parse(campaignBulkImportText);
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
                            "US State",
                          ];
                          const toCreate: Array<{
                            field_label: string;
                            field_name: string;
                            data_type: CriteriaFieldType;
                            required: boolean;
                            description?: string;
                          }> = [];
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
                            toCreate.push({
                              field_label: String(item.field_label).trim(),
                              field_name: String(item.field_name)
                                .trim()
                                .toLowerCase()
                                .replace(/\s+/g, "_")
                                .replace(/[^a-z0-9_]/g, ""),
                              data_type: (validTypes.includes(item.data_type)
                                ? item.data_type
                                : "Text") as CriteriaFieldType,
                              required: Boolean(item.required),
                              ...(item.description
                                ? {
                                    description: String(item.description),
                                  }
                                : {}),
                            });
                          }
                          setCampaignBulkImporting(true);
                          try {
                            for (const fieldPayload of toCreate) {
                              await createCriteriaField(
                                campaign.id,
                                fieldPayload,
                              );
                            }
                            await refreshCriteria();
                            toast.success(
                              `${toCreate.length} field${
                                toCreate.length !== 1 ? "s" : ""
                              } added to campaign.`,
                            );
                            setCampaignBulkImportOpen(false);
                            setCampaignBulkImportText("");
                          } catch {
                            toast.error("Failed to import some fields.");
                          } finally {
                            setCampaignBulkImporting(false);
                          }
                        }}
                        className="rounded-md bg-[--color-primary] text-white px-2.5 py-1 text-[11px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {campaignBulkImporting
                          ? "Saving…"
                          : "Add fields to campaign"}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {criteriaLoading ? (
              <p className="text-sm text-[--color-text-muted]">Loading…</p>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{
                    duration: 0.15,
                    ease: "easeOut",
                  }}
                >
                  {criteriaFields.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[--color-border] px-6 py-10 text-center">
                      <p className="text-sm text-[--color-text-muted] mb-4">
                        No fields yet.
                      </p>
                      <div className="flex flex-col items-center gap-2">
                        <button
                          type="button"
                          onClick={openCriteriaCatalogModal}
                          className="rounded-md bg-[--color-primary] px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 transition-opacity"
                        >
                          Apply from Fields Catalog
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFieldDraft(emptyFieldDraft);
                            setEditFieldData(null);
                            setAddFieldOpen(true);
                          }}
                          className="text-[12px] text-[--color-text-muted] hover:text-[--color-text] hover:underline transition-colors"
                        >
                          or add a custom field
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-[--color-border]">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-[--color-border] bg-[--color-bg-muted]">
                            <th className="w-10 px-4 py-2.5 text-center text-[10px] font-medium uppercase tracking-wide text-[--color-text-muted]">
                              #
                            </th>
                            <th className="px-4 py-2.5 text-left text-[10px] font-medium uppercase tracking-wide text-[--color-text-muted]">
                              Field Label
                            </th>
                            <th className="px-4 py-2.5 text-left text-[10px] font-medium uppercase tracking-wide text-[--color-text-muted]">
                              Field Name
                            </th>
                            <th className="w-28 px-4 py-2.5 text-left text-[10px] font-medium uppercase tracking-wide text-[--color-text-muted] whitespace-nowrap">
                              Data Type
                            </th>
                            <th className="w-20 px-4 py-2.5 text-center text-[10px] font-medium uppercase tracking-wide text-[--color-text-muted]">
                              Required
                            </th>
                            <th className="w-20 px-4 py-2.5 text-center text-[10px] font-medium uppercase tracking-wide text-[--color-text-muted]">
                              Mappings
                            </th>
                            <th className="w-20 px-4 py-2.5 text-center text-[10px] font-medium uppercase tracking-wide text-[--color-text-muted]">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[--color-border]">
                          {criteriaFields.map((field, idx) => (
                            <tr
                              key={field.id}
                              className="bg-[--color-bg] transition-colors hover:bg-[--color-bg-muted]"
                            >
                              <td className="px-4 py-3 text-center text-xs text-[--color-text-muted]">
                                {idx + 1}
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFieldDraft({
                                      field_label: field.field_label,
                                      field_name: field.field_name,
                                      data_type: field.data_type,
                                      required: field.required,
                                      description: field.description ?? "",
                                      state_mapping:
                                        field.state_mapping ?? null,
                                      options: field.options ?? [],
                                    });
                                    setEditFieldData(field);
                                    setAddFieldOpen(true);
                                  }}
                                  className="text-left font-medium text-[--color-primary] hover:underline"
                                >
                                  {field.field_label}
                                </button>
                              </td>
                              <td className="px-4 py-3 font-mono text-xs text-[--color-text-muted]">
                                {field.field_name}
                              </td>
                              <td className="px-4 py-3">
                                {field.data_type === "List" ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFieldDraft({
                                        field_label: field.field_label,
                                        field_name: field.field_name,
                                        data_type: field.data_type,
                                        required: field.required,
                                        description: field.description ?? "",
                                        state_mapping:
                                          field.state_mapping ?? null,
                                        options: field.options ?? [],
                                      });
                                      setEditFieldData(field);
                                      setAddFieldOpen(true);
                                    }}
                                    className="rounded-md border border-[--color-primary]/30 bg-[--color-primary]/10 px-2 py-0.5 text-xs font-medium text-[--color-primary] transition-colors hover:bg-[--color-primary]/20"
                                  >
                                    List
                                  </button>
                                ) : (
                                  <span className="rounded-md border border-[--color-border] bg-[--color-bg-muted] px-2 py-0.5 text-xs text-[--color-text-muted] whitespace-nowrap">
                                    {CRITERIA_TYPE_LABELS[field.data_type] ??
                                      field.data_type}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span
                                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                                    field.required
                                      ? "bg-green-500"
                                      : "bg-[--color-border]"
                                  }`}
                                />
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  type="button"
                                  title="Edit value mappings"
                                  onClick={() => {
                                    setValueMappingsField(field);
                                    setValueMappingsStateDraft(
                                      field.state_mapping ?? null,
                                    );
                                    setValueMappingsDraft(
                                      (field.value_mappings ?? []).map((m) => ({
                                        fromText: m.from.join(", "),
                                        to: m.to,
                                      })),
                                    );
                                  }}
                                >
                                  <span
                                    className={`inline-block h-2.5 w-2.5 rounded-full transition-colors ${
                                      (field.value_mappings ?? []).length > 0 ||
                                      field.state_mapping
                                        ? "bg-green-500"
                                        : "bg-[--color-border] hover:bg-[--color-text-muted]"
                                    }`}
                                  />
                                </button>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-3">
                                  <button
                                    type="button"
                                    title="Edit field"
                                    onClick={() => {
                                      setFieldDraft({
                                        field_label: field.field_label,
                                        field_name: field.field_name,
                                        data_type: field.data_type,
                                        required: field.required,
                                        description: field.description ?? "",
                                        state_mapping:
                                          field.state_mapping ?? null,
                                        options: field.options ?? [],
                                      });
                                      setEditFieldData(field);
                                      setAddFieldOpen(true);
                                    }}
                                    className="text-[--color-text-muted] transition-colors hover:text-[--color-primary]"
                                  >
                                    <Pencil size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    title="Delete field"
                                    onClick={() => setDeleteFieldTarget(field)}
                                    className="text-[--color-text-muted] transition-colors hover:text-red-500"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </motion.div>
        )}

        {settingsSubTab === "routing" && (
          <motion.div
            key="routing"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="space-y-4"
          >
            {(() => {
              const liveClientRows = linkedClients
                .map((client) => ({
                  client,
                  link: clientLinkMap.get(client.id),
                }))
                .filter((row) => row.link?.status === "LIVE");

              const weightedTotal = liveClientRows.reduce(
                (sum, row) =>
                  sum + Math.max(0, routingWeights[row.client.id] ?? 0),
                0,
              );
              const hasLiveClients = liveClientRows.length > 0;

              const initialMode: DistributionMode =
                campaign.distribution?.mode ?? "round_robin";
              const initialEnabled = campaign.distribution?.enabled ?? false;
              const initialWeights: Record<string, number> = (() => {
                if (!hasLiveClients) return {};
                const hasAnyWeight = liveClientRows.some(
                  (row) =>
                    typeof row.link?.weight === "number" && row.link.weight > 0,
                );
                if (hasAnyWeight) {
                  const seeded: Record<string, number> = {};
                  liveClientRows.forEach((row) => {
                    seeded[row.client.id] = Math.max(
                      0,
                      Math.round(row.link?.weight ?? 0),
                    );
                  });
                  return seeded;
                }
                const n = liveClientRows.length;
                const base = Math.floor(100 / n);
                let remainder = 100 - base * n;
                const seeded: Record<string, number> = {};
                liveClientRows.forEach((row) => {
                  const add = remainder > 0 ? 1 : 0;
                  if (remainder > 0) remainder -= 1;
                  seeded[row.client.id] = base + add;
                });
                return seeded;
              })();
              const weightDraftChanged =
                routingMode === "weighted" &&
                liveClientRows.some(
                  (row) =>
                    Math.max(0, routingWeights[row.client.id] ?? 0) !==
                    Math.max(0, initialWeights[row.client.id] ?? 0),
                );
              const hasPendingRoutingChanges =
                routingMode !== initialMode ||
                routingEnabled !== initialEnabled ||
                weightDraftChanged;

              const rrCounts = liveClientRows.map((row) =>
                getClientLeadCount(row.link),
              );
              const fairnessDelta =
                rrCounts.length > 0
                  ? Math.max(...rrCounts) - Math.min(...rrCounts)
                  : 0;

              return (
                <>
                  <div className="rounded-xl border border-[--color-border] bg-[--color-panel] p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-[--color-text-strong]">
                          Lead Routing
                        </p>
                        <p className="text-xs text-[--color-text-muted]">
                          Configure how accepted leads are delivered to LIVE
                          clients.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={!hasLiveClients}
                        onClick={() => setRoutingEnabled((prev) => !prev)}
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition ${
                          !hasLiveClients
                            ? "cursor-not-allowed border-red-500/30 bg-red-500/10 text-red-500 opacity-80"
                            : routingEnabled
                              ? "border-green-500/30 bg-green-500/10 text-green-600"
                              : "border-red-500/30 bg-red-500/10 text-red-500"
                        }`}
                        title={
                          hasLiveClients
                            ? undefined
                            : "Routing can be enabled after at least one client is LIVE."
                        }
                      >
                        {routingEnabled ? "Enabled" : "Disabled"}
                      </button>
                    </div>
                    {!hasLiveClients && (
                      <p className="text-xs font-medium text-red-500">
                        Routing is disabled because there are no LIVE clients in
                        this campaign.
                      </p>
                    )}

                    {routingEnabled && (
                      <div className="space-y-2">
                        {(
                          [
                            {
                              key: "round_robin" as const,
                              label: "Round Robin",
                              description:
                                "Cycles through LIVE clients in order.",
                            },
                            {
                              key: "weighted" as const,
                              label: "Weighted",
                              description:
                                "Routes to the client furthest below its target share.",
                            },
                          ] as const
                        ).map((opt) => {
                          const isSelected = routingMode === opt.key;
                          const isSavedActive =
                            campaign.distribution?.mode === opt.key &&
                            campaign.distribution?.enabled &&
                            !hasPendingRoutingChanges;
                          return (
                            <div
                              key={opt.key}
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                if (!isSelected) {
                                  setConfirmModeChange(opt.key);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !isSelected) {
                                  setConfirmModeChange(opt.key);
                                }
                              }}
                              className={`rounded-lg border transition-all cursor-pointer select-none ${
                                isSelected
                                  ? "border-[--color-primary] bg-[--color-accent]"
                                  : "border-[--color-border] opacity-60 hover:opacity-80"
                              }`}
                            >
                              {/* Mode header row */}
                              <div className="flex items-center gap-2.5 px-3 py-2.5">
                                {/* Radio indicator */}
                                <div
                                  className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                                    isSelected
                                      ? "border-[--color-primary]"
                                      : "border-[--color-border-alt]"
                                  }`}
                                >
                                  {isSelected && (
                                    <div className="h-2 w-2 rounded-full bg-[--color-primary]" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p
                                    className={`text-xs font-semibold leading-none ${
                                      isSelected
                                        ? "text-[--color-text-strong]"
                                        : "text-[--color-text-muted]"
                                    }`}
                                  >
                                    {opt.label}
                                  </p>
                                  <p className="mt-0.5 text-[11px] text-[--color-text-muted]">
                                    {opt.description}
                                  </p>
                                </div>
                                {isSavedActive && (
                                  <span className="ml-auto flex-shrink-0 rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[11px] font-semibold text-green-600">
                                    Active
                                  </span>
                                )}
                                {!isSelected && !isSavedActive && (
                                  <span className="ml-auto flex-shrink-0 rounded-full border border-[--color-border-alt] bg-[--color-bg-muted] px-2 py-0.5 text-[11px] font-semibold text-[--color-text-muted]">
                                    Inactive
                                  </span>
                                )}
                              </div>

                              {/* Mode content — only for selected mode */}
                              {isSelected && (
                                <div className="border-t border-[--color-border] px-3 pb-3 pt-2">
                                  {opt.key === "round_robin" ? (
                                    <div className="space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
                                          Fairness
                                        </p>
                                        <span className="text-[11px] text-[--color-text-muted]">
                                          Delta: {fairnessDelta}
                                        </span>
                                      </div>
                                      {liveClientRows.length === 0 ? (
                                        <p className="text-xs text-[--color-text-muted]">
                                          No LIVE clients available.
                                        </p>
                                      ) : (
                                        <div className="space-y-1">
                                          {liveClientRows.map((row) => (
                                            <div
                                              key={`rr-${row.client.id}`}
                                              className="flex items-center justify-between rounded bg-[--color-bg-muted] px-2.5 py-1.5 text-xs"
                                            >
                                              <span className="font-medium text-[--color-text]">
                                                {row.client.name}
                                              </span>
                                              <span className="text-[--color-text-muted]">
                                                Sold:{" "}
                                                {getClientLeadCount(row.link)}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
                                          Client Shares
                                        </p>
                                        <span
                                          className={`text-[11px] font-semibold ${
                                            weightedTotal === 100
                                              ? "text-green-600"
                                              : "text-[--color-danger]"
                                          }`}
                                        >
                                          Total: {weightedTotal}%
                                        </span>
                                      </div>
                                      {liveClientRows.length === 0 ? (
                                        <p className="text-xs text-[--color-text-muted]">
                                          No LIVE clients available.
                                        </p>
                                      ) : (
                                        <div className="space-y-1">
                                          {liveClientRows.map((row) => (
                                            <div
                                              key={`w-${row.client.id}`}
                                              className="grid grid-cols-[minmax(0,1fr)_82px] items-center gap-2 rounded bg-[--color-bg-muted] px-2.5 py-1.5 text-xs"
                                            >
                                              <span className="truncate font-medium text-[--color-text]">
                                                {row.client.name}
                                              </span>
                                              <div className="flex items-center gap-1">
                                                <input
                                                  className="w-full rounded border border-[--color-border] bg-[--color-panel] px-2 py-1 text-right text-xs"
                                                  type="number"
                                                  min={0}
                                                  max={100}
                                                  value={
                                                    routingWeights[
                                                      row.client.id
                                                    ] ?? 0
                                                  }
                                                  onChange={(e) => {
                                                    const raw = Number(
                                                      e.target.value,
                                                    );
                                                    const clamped =
                                                      Number.isNaN(raw)
                                                        ? 0
                                                        : Math.max(
                                                            0,
                                                            Math.min(
                                                              100,
                                                              Math.round(raw),
                                                            ),
                                                          );
                                                    const others =
                                                      liveClientRows.filter(
                                                        (r) =>
                                                          r.client.id !==
                                                          row.client.id,
                                                      );
                                                    const remainder = Math.max(
                                                      0,
                                                      100 - clamped,
                                                    );
                                                    setRoutingWeights(
                                                      (prev) => {
                                                        const next = {
                                                          ...prev,
                                                        };
                                                        next[row.client.id] =
                                                          clamped;
                                                        if (others.length > 0) {
                                                          const base =
                                                            Math.floor(
                                                              remainder /
                                                                others.length,
                                                            );
                                                          let leftover =
                                                            remainder -
                                                            base *
                                                              others.length;
                                                          others.forEach(
                                                            (other) => {
                                                              const add =
                                                                leftover > 0
                                                                  ? 1
                                                                  : 0;
                                                              if (leftover > 0)
                                                                leftover--;
                                                              next[
                                                                other.client.id
                                                              ] = base + add;
                                                            },
                                                          );
                                                        }
                                                        return next;
                                                      },
                                                    );
                                                  }}
                                                />
                                                <span className="text-[--color-text-muted]">
                                                  %
                                                </span>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Confirm mode-switch dialog – rendered as popup in JSX root */}

                  {hasPendingRoutingChanges && (
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        disabled={savingRouting}
                        onClick={async () => {
                          setSavingRouting(true);
                          try {
                            // When switching to weighted mode,
                            // persist per-client shares first.
                            if (
                              routingMode === "weighted" &&
                              liveClientRows.length > 0
                            ) {
                              try {
                                await Promise.all(
                                  liveClientRows
                                    .filter((row) => row.link?.delivery_config)
                                    .map((row) =>
                                      onUpdateClientWeight(
                                        campaign.id,
                                        row.client.id,
                                        row.link!.delivery_config!,
                                        routingWeights[row.client.id] ?? 0,
                                      ),
                                    ),
                                );
                              } catch (err) {
                                toast.error(
                                  err instanceof Error
                                    ? err.message
                                    : "Failed to save client weights",
                                );
                                return;
                              }
                            }
                            await onUpdateCampaignDistribution(campaign.id, {
                              mode: routingMode,
                              enabled: routingEnabled,
                            });
                          } finally {
                            setSavingRouting(false);
                          }
                        }}
                      >
                        Save Routing
                      </Button>
                    </div>
                  )}
                </>
              );
            })()}

            {/* ── Cherry Pick Default ─────────────────────── */}
            <div className="mt-6 space-y-3 border-t border-[--color-border] pt-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                  Cherry Pick
                </p>
                <p className="text-[11px] text-[--color-text-muted] mt-1">
                  When enabled, rejected (non-test) leads are automatically
                  marked as cherry-pickable. Affiliates can override this
                  per-participant.
                </p>
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[--color-primary]"
                  checked={campaign.default_cherry_pickable ?? false}
                  onChange={async (e) => {
                    const val = e.target.checked;
                    try {
                      const res = await updateCampaign(campaign.id, {
                        name: campaign.name,
                        default_cherry_pickable: val,
                      });
                      if (res.success) {
                        toast.success(
                          val
                            ? "Rejected leads will be auto-marked cherry-pickable."
                            : "Auto cherry-pickable disabled.",
                        );
                        onCampaignUpdate?.({
                          default_cherry_pickable: val,
                        });
                      } else {
                        toast.error(
                          (res as any).message ||
                            "Failed to update cherry pick setting",
                        );
                      }
                    } catch {
                      toast.error("Failed to update cherry pick setting.");
                    }
                  }}
                />
                <span className="text-sm text-[--color-text]">
                  Auto cherry-pickable on rejection
                </span>
              </label>
            </div>
          </motion.div>
        )}

        {settingsSubTab === "logic" && (
          <motion.div
            key="logic"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="space-y-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2">
              <div className="min-h-[28px] flex items-center">
                {localLogicSetId && localLogicSetVersion != null ? (
                  <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-700">
                    <Check size={12} className="shrink-0 text-emerald-600" />
                    <span>
                      Active catalog:{" "}
                      <strong>{localLogicSetName ?? localLogicSetId}</strong> v
                      {localLogicSetVersion}
                    </span>
                  </div>
                ) : (
                  <p className="text-[11px] text-[--color-text-muted]">
                    No active rules catalog applied.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {logicRules.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSaveLogicToSetMode(
                        localLogicSetId ? "new_version" : "new_set",
                      );
                      setSaveLogicToSetDraft({
                        name: localLogicSetName ?? "",
                        description: "",
                      });
                      setSaveLogicToSetOpen(true);
                    }}
                    className="shrink-0 rounded-md border border-[--color-border] bg-[--color-bg-muted] px-3 py-1.5 text-[11px] font-medium text-[--color-text-muted] hover:bg-[--color-bg] hover:text-[--color-text] transition-colors"
                  >
                    Save to Catalog
                  </button>
                )}
                <button
                  type="button"
                  onClick={openLogicCatalogModal}
                  className="shrink-0 rounded-md border border-[--color-border] bg-[--color-bg-muted] px-3 py-1.5 text-[11px] font-medium text-[--color-text-muted] hover:bg-[--color-bg] hover:text-[--color-text] transition-colors"
                >
                  Rules Catalog
                </button>
                <Button
                  size="sm"
                  iconLeft={<Plus size={14} />}
                  onClick={() => {
                    setEditingRule(null);
                    setLogicBuilderOpen(true);
                  }}
                >
                  Create Rule
                </Button>
              </div>
            </div>

            {logicRulesLoading ? (
              <p className="text-sm text-[--color-text-muted]">Loading…</p>
            ) : logicRules.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[--color-border] py-12 text-center text-sm text-[--color-text-muted]">
                No rules yet.{" "}
                <button
                  type="button"
                  className="text-[--color-primary] hover:underline"
                  onClick={() => {
                    setEditingRule(null);
                    setLogicBuilderOpen(true);
                  }}
                >
                  Create one
                </button>
                .
              </div>
            ) : (
              <div className="space-y-2">
                {logicRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center gap-3 rounded-xl border border-[--color-border] bg-[--color-bg] px-4 py-3"
                  >
                    {/* Enable toggle */}
                    <button
                      type="button"
                      onClick={() => handleToggleLogicRule(rule)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${
                        rule.enabled
                          ? "bg-[--color-primary]"
                          : "bg-[--color-border]"
                      }`}
                      aria-label={`${rule.enabled ? "Disable" : "Enable"} rule`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform ${
                          rule.enabled ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>

                    {/* Action badge */}
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-semibold ${
                        rule.action === "pass"
                          ? "bg-green-500/10 text-green-600"
                          : "bg-red-500/10 text-red-500"
                      }`}
                    >
                      {rule.action === "pass" ? "Pass" : "Fail"}
                    </span>

                    {/* Name */}
                    <span
                      className={`flex-1 text-sm truncate ${
                        rule.enabled
                          ? "text-[--color-text-strong]"
                          : "text-[--color-text-muted] line-through"
                      }`}
                    >
                      {rule.name}
                    </span>

                    {/* Group / condition count */}
                    <span className="shrink-0 text-[11px] text-[--color-text-muted]">
                      {rule.groups.length}{" "}
                      {rule.groups.length === 1 ? "group" : "groups"}
                      {" · "}
                      {rule.groups.reduce(
                        (acc, g) => acc + g.conditions.length,
                        0,
                      )}{" "}
                      cond.
                    </span>

                    {/* Edit */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRule(rule);
                        setLogicBuilderOpen(true);
                      }}
                      className="shrink-0 text-[--color-text-muted] hover:text-[--color-text] transition-colors"
                    >
                      <Pencil size={13} />
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      disabled={deletingRuleId === rule.id}
                      onClick={() => handleDeleteLogicRule(rule.id)}
                      className="shrink-0 text-[--color-text-muted] hover:text-red-500 transition-colors disabled:opacity-40"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
