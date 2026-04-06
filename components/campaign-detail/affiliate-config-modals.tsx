"use client";

import type { Dispatch, SetStateAction } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import { DisabledTooltip } from "@/components/shared-ui";
import type {
  Affiliate,
  AffiliateSoldPixelConfig,
  Campaign,
  CriteriaField,
  LogicRule,
} from "@/lib/types";

interface AffiliateConfigModalsProps {
  campaign: Campaign | null;
  affiliates: Affiliate[];
  criteriaFields: CriteriaField[];
  affiliateCapModalId: string | null;
  affiliateCapDraft: string;
  savingAffiliateCap: boolean;
  pixelAffiliateId: string | null;
  pixelConfigTab: "pixel" | "pixel_criteria" | "sold_criteria";
  pixelDraft: AffiliateSoldPixelConfig;
  savingPixelConfig: boolean;
  pixelSaveAttempted: boolean;
  pixelHasUrl: boolean;
  pixelHasMappings: boolean;
  pixelInvalidUrl: boolean;
  pixelInvalidMappings: boolean;
  pixelFinalSaveDisabledReason: string;
  pixelSaveBlockedByEnabledConfig: boolean;
  pixelCriteriaRules: LogicRule[];
  pixelCriteriaLoading: boolean;
  pixelCriteriaDeletingRuleId: string | null;
  pixelCriteriaEditingRule: LogicRule | null;
  pixelCriteriaBuilderOpen: boolean;
  soldCriteriaRules: LogicRule[];
  soldCriteriaLoading: boolean;
  soldCriteriaDeletingRuleId: string | null;
  soldCriteriaEditingRule: LogicRule | null;
  soldCriteriaBuilderOpen: boolean;
  setAffiliateCapModalId: Dispatch<SetStateAction<string | null>>;
  setAffiliateCapDraft: Dispatch<SetStateAction<string>>;
  setSavingAffiliateCap: Dispatch<SetStateAction<boolean>>;
  setPixelAffiliateId: Dispatch<SetStateAction<string | null>>;
  setPixelConfigTab: Dispatch<
    SetStateAction<"pixel" | "pixel_criteria" | "sold_criteria">
  >;
  setPixelDraft: Dispatch<SetStateAction<AffiliateSoldPixelConfig>>;
  setSavingPixelConfig: Dispatch<SetStateAction<boolean>>;
  setPixelSaveAttempted: Dispatch<SetStateAction<boolean>>;
  setPixelCriteriaAffiliateId: Dispatch<SetStateAction<string | null>>;
  setPixelCriteriaBuilderOpen: Dispatch<SetStateAction<boolean>>;
  setPixelCriteriaEditingRule: Dispatch<SetStateAction<LogicRule | null>>;
  setPixelCriteriaRules: Dispatch<SetStateAction<LogicRule[]>>;
  setSoldCriteriaAffiliateId: Dispatch<SetStateAction<string | null>>;
  setSoldCriteriaBuilderOpen: Dispatch<SetStateAction<boolean>>;
  setSoldCriteriaEditingRule: Dispatch<SetStateAction<LogicRule | null>>;
  setSoldCriteriaRules: Dispatch<SetStateAction<LogicRule[]>>;
  setLocalAffiliateLinks: Dispatch<
    SetStateAction<NonNullable<Campaign["affiliates"]>>
  >;
  handleTogglePixelCriteriaRule: (rule: LogicRule) => Promise<void>;
  handleDeletePixelCriteriaRule: (ruleId: string) => Promise<void>;
  handleToggleSoldCriteriaRule: (rule: LogicRule) => Promise<void>;
  handleDeleteSoldCriteriaRule: (ruleId: string) => Promise<void>;
  onUpdateAffiliateLeadCap: (
    campaignId: string,
    affiliateId: string,
    leadCap: number | null,
  ) => Promise<void>;
  onUpdateAffiliateSoldPixelConfig: (
    campaignId: string,
    affiliateId: string,
    payload: AffiliateSoldPixelConfig,
  ) => Promise<void>;
  normalizeFieldLabel: (label: string) => string;
  formatLogicOperatorLabel: (operator: string) => string;
  formatLogicConditionValue: (value?: string | string[]) => string;
  inputClass: string;
}

export function AffiliateConfigModals({
  campaign,
  affiliates,
  criteriaFields,
  affiliateCapModalId,
  affiliateCapDraft,
  savingAffiliateCap,
  pixelAffiliateId,
  pixelConfigTab,
  pixelDraft,
  savingPixelConfig,
  pixelSaveAttempted,
  pixelHasUrl,
  pixelHasMappings,
  pixelInvalidUrl,
  pixelInvalidMappings,
  pixelFinalSaveDisabledReason,
  pixelSaveBlockedByEnabledConfig,
  pixelCriteriaRules,
  pixelCriteriaLoading,
  pixelCriteriaDeletingRuleId,
  pixelCriteriaEditingRule,
  pixelCriteriaBuilderOpen,
  soldCriteriaRules,
  soldCriteriaLoading,
  soldCriteriaDeletingRuleId,
  soldCriteriaEditingRule,
  soldCriteriaBuilderOpen,
  setAffiliateCapModalId,
  setAffiliateCapDraft,
  setSavingAffiliateCap,
  setPixelAffiliateId,
  setPixelConfigTab,
  setPixelDraft,
  setSavingPixelConfig,
  setPixelSaveAttempted,
  setPixelCriteriaAffiliateId,
  setPixelCriteriaBuilderOpen,
  setPixelCriteriaEditingRule,
  setPixelCriteriaRules,
  setSoldCriteriaAffiliateId,
  setSoldCriteriaBuilderOpen,
  setSoldCriteriaEditingRule,
  setSoldCriteriaRules,
  setLocalAffiliateLinks,
  handleTogglePixelCriteriaRule,
  handleDeletePixelCriteriaRule,
  handleToggleSoldCriteriaRule,
  handleDeleteSoldCriteriaRule,
  onUpdateAffiliateLeadCap,
  onUpdateAffiliateSoldPixelConfig,
  normalizeFieldLabel,
  formatLogicOperatorLabel,
  formatLogicConditionValue,
  inputClass,
}: AffiliateConfigModalsProps) {
  if (!campaign) return null;

  return (
    <>
      <Modal
        title={`Affiliate Lead Cap${
          affiliateCapModalId
            ? ` — ${affiliates.find((a) => a.id === affiliateCapModalId)?.name || affiliateCapModalId}`
            : ""
        }`}
        isOpen={!!affiliateCapModalId}
        onClose={() => setAffiliateCapModalId(null)}
        width={420}
      >
        {affiliateCapModalId && (
          <div className="space-y-4">
            <p className="text-sm text-[--color-text-muted]">
              Set a maximum number of leads this affiliate can submit for this
              campaign. Leave blank for uncapped.
            </p>
            <div className="flex items-center gap-2">
              <input
                className={inputClass}
                type="number"
                min={1}
                placeholder="Uncapped"
                value={affiliateCapDraft}
                onChange={(e) => setAffiliateCapDraft(e.target.value)}
              />
              <Button
                size="sm"
                disabled={savingAffiliateCap}
                onClick={async () => {
                  const trimmed = affiliateCapDraft.trim();
                  const parsed = Number(trimmed);
                  if (!trimmed || Number.isNaN(parsed) || parsed < 1) {
                    toast.warning(
                      "Enter a cap of at least 1, or use Uncapped.",
                    );
                    return;
                  }
                  setSavingAffiliateCap(true);
                  try {
                    await onUpdateAffiliateLeadCap(
                      campaign.id,
                      affiliateCapModalId,
                      parsed,
                    );
                    setLocalAffiliateLinks((prev) =>
                      prev.map((l) =>
                        l.affiliate_id === affiliateCapModalId
                          ? { ...l, lead_cap: parsed }
                          : l,
                      ),
                    );
                    setAffiliateCapModalId(null);
                  } finally {
                    setSavingAffiliateCap(false);
                  }
                }}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={savingAffiliateCap}
                onClick={async () => {
                  setSavingAffiliateCap(true);
                  try {
                    await onUpdateAffiliateLeadCap(
                      campaign.id,
                      affiliateCapModalId,
                      null,
                    );
                    setAffiliateCapDraft("");
                    setLocalAffiliateLinks((prev) =>
                      prev.map((l) =>
                        l.affiliate_id === affiliateCapModalId
                          ? { ...l, lead_cap: null }
                          : l,
                      ),
                    );
                    setAffiliateCapModalId(null);
                  } finally {
                    setSavingAffiliateCap(false);
                  }
                }}
              >
                Uncapped
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title={`${pixelConfigTab === "pixel" ? "Affiliate Sold Pixel" : pixelConfigTab === "pixel_criteria" ? "Pixel Criteria" : "Sold Criteria"}${
          pixelAffiliateId
            ? ` — ${affiliates.find((a) => a.id === pixelAffiliateId)?.name || pixelAffiliateId}`
            : ""
        }`}
        isOpen={!!pixelAffiliateId}
        onClose={() => {
          setPixelSaveAttempted(false);
          setPixelAffiliateId(null);
          setPixelCriteriaAffiliateId(null);
          setSoldCriteriaAffiliateId(null);
          setPixelCriteriaRules([]);
          setSoldCriteriaRules([]);
        }}
        width={720}
        bodyClassName="px-5 py-4 h-[620px] max-h-[80vh]"
      >
        {pixelAffiliateId && (
          <div className="flex h-full min-h-0 flex-col gap-4">
            {/* ── Tab bar ────────────────────────────────── */}
            <div className="flex gap-1 rounded-lg bg-[--color-bg-muted] p-1 shrink-0">
              {(
                [
                  { key: "pixel", label: "Sold Pixel" },
                  { key: "pixel_criteria", label: "Pixel Criteria" },
                  { key: "sold_criteria", label: "Sold Criteria" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setPixelConfigTab(tab.key)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                    pixelConfigTab === tab.key
                      ? "bg-[--color-panel] text-[--color-text] shadow-sm"
                      : "text-[--color-text-muted] hover:text-[--color-text]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── Sold Pixel tab ─────────────────────────── */}
            {pixelConfigTab === "pixel" && (
              <>
                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                  <div className="space-y-3">
                    <div className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                            Enable Pixel
                          </p>
                          <p className="mt-0.5 text-[11px] text-[--color-text-muted]">
                            Fires only when this affiliate's lead is sold.
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={pixelDraft.enabled}
                          onClick={() =>
                            setPixelDraft((prev) => ({
                              ...prev,
                              enabled: !prev.enabled,
                            }))
                          }
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                            pixelDraft.enabled
                              ? "bg-[--color-primary]"
                              : "bg-[--color-border]"
                          }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-[--color-bg] transition ${
                              pixelDraft.enabled
                                ? "translate-x-5"
                                : "translate-x-1"
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-1">
                        <span className="text-xs font-medium text-[--color-text-muted]">
                          Method
                        </span>
                        <select
                          className={inputClass}
                          value={pixelDraft.method}
                          onChange={(e) =>
                            setPixelDraft((prev) => ({
                              ...prev,
                              method: e.target
                                .value as AffiliateSoldPixelConfig["method"],
                            }))
                          }
                        >
                          {(["POST", "GET", "PUT", "PATCH"] as const).map(
                            (m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                      <label className="space-y-1 md:col-span-1">
                        <span className="text-xs font-medium text-[--color-text-muted]">
                          Pixel URL <span className="text-red-500">*</span>
                        </span>
                        <input
                          className={`${inputClass} ${
                            pixelInvalidUrl
                              ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/25"
                              : ""
                          }`}
                          value={pixelDraft.url}
                          onChange={(e) =>
                            setPixelDraft((prev) => ({
                              ...prev,
                              url: e.target.value,
                            }))
                          }
                          placeholder="https://affiliate.example.com/pixel"
                        />
                      </label>
                    </div>

                    <p className="text-xs text-[--color-text-muted]">
                      Choose query/body destination per mapping row below.
                    </p>

                    <div
                      className={`space-y-2 rounded-lg border p-3 ${
                        pixelInvalidMappings
                          ? "border-red-500/60"
                          : "border-[--color-border]"
                      }`}
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                        Payload Mapping <span className="text-red-500">*</span>
                      </p>

                      {criteriaFields.length > 0 &&
                        (() => {
                          const alreadyMapped = new Set(
                            pixelDraft.payload_mapping
                              .map((m) => m.field_name)
                              .filter(Boolean),
                          );
                          const unmappedCount = criteriaFields.filter(
                            (cf) => !alreadyMapped.has(cf.field_name),
                          ).length;
                          if (unmappedCount === 0) return null;
                          return (
                            <div className="flex items-center justify-between rounded-lg border border-[--color-border] bg-[--color-bg-muted] px-3 py-2.5">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-[--color-text-strong]">
                                  Import from criteria fields
                                </p>
                                <p className="mt-0.5 text-[11px] text-[--color-text-muted]">
                                  Add all {unmappedCount} unmapped field
                                  {unmappedCount !== 1 ? "s" : ""} at once.
                                </p>
                              </div>
                              <button
                                type="button"
                                className="ml-3 shrink-0 rounded-md border border-[--color-border] bg-[--color-panel] px-3 py-1.5 text-xs font-semibold text-[--color-text] hover:border-[--color-primary] hover:text-[--color-primary] transition-colors"
                                onClick={() =>
                                  setPixelDraft((prev) => {
                                    const mapped = new Set(
                                      prev.payload_mapping
                                        .map((m) => m.field_name)
                                        .filter(Boolean),
                                    );
                                    const toAdd = criteriaFields
                                      .filter(
                                        (cf) => !mapped.has(cf.field_name),
                                      )
                                      .map((cf) => ({
                                        key: cf.field_name,
                                        value_source: "field" as const,
                                        field_name: cf.field_name,
                                      }));
                                    if (toAdd.length === 0) return prev;
                                    const hasOnlyEmptyPlaceholder =
                                      prev.payload_mapping.length === 1 &&
                                      !prev.payload_mapping[0].key &&
                                      !prev.payload_mapping[0].field_name;
                                    return {
                                      ...prev,
                                      payload_mapping: hasOnlyEmptyPlaceholder
                                        ? toAdd
                                        : [...prev.payload_mapping, ...toAdd],
                                    };
                                  })
                                }
                              >
                                Add All
                              </button>
                            </div>
                          );
                        })()}

                      <div className="space-y-2">
                        <AnimatePresence initial={false}>
                          {pixelDraft.payload_mapping.map((row, idx) => (
                            <motion.div
                              key={`pixel-map-${idx}`}
                              layout
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -6 }}
                              transition={{ duration: 0.18 }}
                              className="grid gap-2 md:grid-cols-[minmax(0,1fr)_140px_minmax(0,1fr)_120px_auto]"
                            >
                              <input
                                className={inputClass}
                                placeholder="Outbound key"
                                value={row.key}
                                onChange={(e) =>
                                  setPixelDraft((prev) => ({
                                    ...prev,
                                    payload_mapping: prev.payload_mapping.map(
                                      (m, i) =>
                                        i === idx
                                          ? { ...m, key: e.target.value }
                                          : m,
                                    ),
                                  }))
                                }
                              />
                              <select
                                className={inputClass}
                                value={row.value_source}
                                onChange={(e) => {
                                  const valueSource = e.target
                                    .value as AffiliateSoldPixelConfig["payload_mapping"][number]["value_source"];
                                  setPixelDraft((prev) => ({
                                    ...prev,
                                    payload_mapping: prev.payload_mapping.map(
                                      (m, i) =>
                                        i === idx
                                          ? {
                                              ...m,
                                              value_source: valueSource,
                                              field_name:
                                                valueSource === "field"
                                                  ? (m.field_name ?? "")
                                                  : undefined,
                                              static_value:
                                                valueSource === "static"
                                                  ? (m.static_value ?? "")
                                                  : undefined,
                                            }
                                          : m,
                                    ),
                                  }));
                                }}
                              >
                                <option value="field">Lead Field</option>
                                <option value="static">Static Value</option>
                              </select>
                              {row.value_source === "field" ? (
                                <select
                                  className={inputClass}
                                  value={row.field_name ?? ""}
                                  onChange={(e) =>
                                    setPixelDraft((prev) => ({
                                      ...prev,
                                      payload_mapping: prev.payload_mapping.map(
                                        (m, i) =>
                                          i === idx
                                            ? {
                                                ...m,
                                                field_name: e.target.value,
                                              }
                                            : m,
                                      ),
                                    }))
                                  }
                                >
                                  <option value="">
                                    {criteriaFields.length === 0
                                      ? "No fields defined"
                                      : "Select lead field…"}
                                  </option>
                                  {criteriaFields.map((cf) => (
                                    <option key={cf.id} value={cf.field_name}>
                                      {cf.field_label}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  className={inputClass}
                                  placeholder="static_value"
                                  value={String(row.static_value ?? "")}
                                  onChange={(e) =>
                                    setPixelDraft((prev) => ({
                                      ...prev,
                                      payload_mapping: prev.payload_mapping.map(
                                        (m, i) =>
                                          i === idx
                                            ? {
                                                ...m,
                                                static_value: e.target.value,
                                              }
                                            : m,
                                      ),
                                    }))
                                  }
                                />
                              )}
                              <select
                                className={`${inputClass} ${
                                  pixelSaveAttempted &&
                                  row.parameter_target !== "query" &&
                                  row.parameter_target !== "body"
                                    ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/25"
                                    : ""
                                }`}
                                value={row.parameter_target ?? ""}
                                onChange={(e) =>
                                  setPixelDraft((prev) => ({
                                    ...prev,
                                    payload_mapping: prev.payload_mapping.map(
                                      (m, i) =>
                                        i === idx
                                          ? {
                                              ...m,
                                              parameter_target: e.target
                                                .value as "query" | "body",
                                            }
                                          : m,
                                    ),
                                  }))
                                }
                              >
                                <option value="">Target…</option>
                                <option value="query">Query</option>
                                <option value="body">Body</option>
                              </select>
                              <button
                                type="button"
                                className="flex items-center justify-center rounded p-1.5 text-[--color-text-muted] hover:text-red-500 disabled:opacity-30 transition-colors"
                                onClick={() =>
                                  setPixelDraft((prev) => ({
                                    ...prev,
                                    payload_mapping:
                                      prev.payload_mapping.filter(
                                        (_, i) => i !== idx,
                                      ),
                                  }))
                                }
                                disabled={
                                  pixelDraft.payload_mapping.length <= 1
                                }
                                title="Remove row"
                              >
                                <Trash2 size={14} />
                              </button>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>

                      <button
                        type="button"
                        className="mt-1 flex items-center gap-1 text-xs text-[--color-primary] hover:underline"
                        onClick={() =>
                          setPixelDraft((prev) => ({
                            ...prev,
                            payload_mapping: [
                              ...prev.payload_mapping,
                              {
                                key: "",
                                value_source: "field",
                                field_name: "",
                              },
                            ],
                          }))
                        }
                      >
                        <Plus size={12} />
                        Add mapping
                      </button>
                    </div>

                    {(() => {
                      const sampleValueFor = (
                        field: CriteriaField | undefined,
                      ): string => {
                        if (!field) return "";
                        const lbl = field.field_label.toLowerCase();
                        if (lbl.includes("email")) return "john@example.com";
                        if (lbl.includes("phone")) return "+1 (555) 867-5309";
                        if (lbl.includes("first") && lbl.includes("name"))
                          return "John";
                        if (lbl.includes("last") && lbl.includes("name"))
                          return "Doe";
                        if (lbl.includes("name")) return "John Doe";
                        if (lbl.includes("zip") || lbl.includes("postal"))
                          return "90210";
                        if (lbl.includes("city")) return "Los Angeles";
                        if (
                          lbl.includes("ip") ||
                          field.field_name.toLowerCase().includes("ip")
                        )
                          return "203.0.113.42";
                        if (lbl.includes("address")) return "123 Main St";
                        if (lbl.includes("dob") || lbl.includes("birth"))
                          return "1990-06-15";
                        switch (field.data_type) {
                          case "US State":
                            return "CA";
                          case "Number":
                            return "30";
                          case "Boolean":
                            return "true";
                          case "Date":
                            return "2026-01-15";
                          case "List":
                            return field.options?.[0]?.value ?? "option1";
                          default:
                            return "Sample value";
                        }
                      };

                      const previewEntries = pixelDraft.payload_mapping
                        .filter((m) => m.key.trim())
                        .map((m) => {
                          if (m.value_source === "static") {
                            return {
                              key: m.key.trim(),
                              value: String(m.static_value ?? ""),
                              target: m.parameter_target,
                            };
                          }
                          const cf = criteriaFields.find(
                            (f) => f.field_name === m.field_name,
                          );
                          return {
                            key: m.key.trim(),
                            value: cf ? sampleValueFor(cf) : "…",
                            target: m.parameter_target,
                          };
                        });

                      if (previewEntries.length === 0) return null;

                      const queryEntries = previewEntries.filter(
                        (entry) => entry.target === "query",
                      );
                      const bodyEntries = previewEntries.filter(
                        (entry) => entry.target === "body",
                      );
                      const hasQuery = queryEntries.length > 0;
                      const hasBody = bodyEntries.length > 0;

                      if (!hasQuery && !hasBody) return null;

                      const baseUrl =
                        pixelDraft.url.trim() ||
                        "https://affiliate.example.com/pixel";
                      const queryPreviewUrl = (() => {
                        try {
                          const url = new URL(baseUrl);
                          for (const entry of queryEntries) {
                            url.searchParams.set(entry.key, entry.value);
                          }
                          return url.toString();
                        } catch {
                          const query = queryEntries
                            .map(
                              (entry) =>
                                `${encodeURIComponent(entry.key)}=${encodeURIComponent(entry.value)}`,
                            )
                            .join("&");
                          return query ? `${baseUrl}?${query}` : baseUrl;
                        }
                      })();

                      const bodyLines = [
                        "{",
                        ...bodyEntries.map(
                          (e, i) =>
                            `  "${e.key}": "${e.value}"${i < bodyEntries.length - 1 ? "," : ""}`,
                        ),
                        "}",
                      ];

                      return (
                        <div className="space-y-2 rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-3">
                          {hasQuery && (
                            <details
                              className="rounded-md border border-[--color-border] bg-[--color-panel]"
                              open
                            >
                              <summary className="cursor-pointer px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
                                Expected URL with Query Params
                              </summary>
                              <div className="border-t border-[--color-border] p-3">
                                <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[--color-text]">
                                  {queryPreviewUrl}
                                </pre>
                              </div>
                            </details>
                          )}

                          {hasBody && (
                            <details
                              className="rounded-md border border-[--color-border] bg-[--color-panel]"
                              open={!hasQuery}
                            >
                              <summary className="cursor-pointer px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
                                Expected Payload Preview
                              </summary>
                              <div className="border-t border-[--color-border] p-3">
                                <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[--color-text]">
                                  {bodyLines.join("\n")}
                                </pre>
                              </div>
                            </details>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-[--color-border] pt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPixelSaveAttempted(false);
                      setPixelAffiliateId(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <div className="inline-flex">
                    <DisabledTooltip message={pixelFinalSaveDisabledReason}>
                      <Button
                        size="sm"
                        disabled={
                          savingPixelConfig ||
                          Boolean(pixelFinalSaveDisabledReason)
                        }
                        onClick={async () => {
                          setPixelSaveAttempted(true);
                          const trimmedUrl = pixelDraft.url.trim();
                          if (!trimmedUrl) {
                            toast.warning("Pixel URL is required.");
                            return;
                          }
                          try {
                            // eslint-disable-next-line no-new
                            new URL(trimmedUrl);
                          } catch {
                            toast.warning("Enter a valid pixel URL.");
                            return;
                          }

                          if (pixelDraft.payload_mapping.length === 0) {
                            toast.warning(
                              "At least one payload mapping is required.",
                            );
                            return;
                          }

                          const hasBadMapping = pixelDraft.payload_mapping.some(
                            (m) =>
                              !m.key.trim() ||
                              (m.parameter_target !== "query" &&
                                m.parameter_target !== "body") ||
                              (m.value_source === "field"
                                ? !(m.field_name ?? "").trim()
                                : String(m.static_value ?? "").trim().length ===
                                  0),
                          );
                          if (hasBadMapping) {
                            toast.warning("Complete all payload mapping rows.");
                            return;
                          }

                          if (pixelSaveBlockedByEnabledConfig) {
                            toast.warning(
                              "Enabled pixels require URL and payload mappings.",
                            );
                            return;
                          }

                          setSavingPixelConfig(true);
                          try {
                            const payload: AffiliateSoldPixelConfig = {
                              ...pixelDraft,
                              url: trimmedUrl,
                              payload_mapping: pixelDraft.payload_mapping.map(
                                (m) =>
                                  m.value_source === "field"
                                    ? {
                                        key: m.key.trim(),
                                        value_source: "field",
                                        field_name: (m.field_name ?? "").trim(),
                                        parameter_target: m.parameter_target,
                                      }
                                    : {
                                        key: m.key.trim(),
                                        value_source: "static",
                                        static_value: m.static_value,
                                        parameter_target: m.parameter_target,
                                      },
                              ),
                            };

                            await onUpdateAffiliateSoldPixelConfig(
                              campaign.id,
                              pixelAffiliateId,
                              payload,
                            );

                            setLocalAffiliateLinks((prev) =>
                              prev.map((l) =>
                                l.affiliate_id === pixelAffiliateId
                                  ? { ...l, sold_pixel_config: payload }
                                  : l,
                              ),
                            );

                            setPixelAffiliateId(null);
                          } finally {
                            setSavingPixelConfig(false);
                          }
                        }}
                      >
                        Save Pixel Config
                      </Button>
                    </DisabledTooltip>
                  </div>
                </div>
              </>
            )}

            {/* ── Pixel Criteria tab ─────────────────────── */}
            {pixelConfigTab === "pixel_criteria" && (
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <div className="space-y-4">
                  <div className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-3">
                    <p className="text-[11px] text-[--color-text-muted]">
                      <span className="font-semibold text-[--color-text]">
                        Optional.
                      </span>{" "}
                      Pixel criteria rules determine whether the sold pixel
                      fires for this affiliate. If any rule fails, the pixel is
                      suppressed. When no rules are configured, the pixel always
                      fires (if enabled).
                    </p>
                  </div>

                  {pixelCriteriaLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <svg
                        className="h-6 w-6 animate-spin text-[--color-primary]"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                    </div>
                  ) : pixelCriteriaRules.length === 0 ? (
                    <div className="animate-[fadeIn_200ms_ease-in] rounded-xl border border-dashed border-[--color-border] py-10 text-center text-sm text-[--color-text-muted]">
                      No pixel criteria rules yet.{" "}
                      <button
                        type="button"
                        className="text-[--color-primary] hover:underline"
                        onClick={() => {
                          setPixelCriteriaEditingRule(null);
                          setPixelCriteriaBuilderOpen(true);
                        }}
                      >
                        Add one
                      </button>
                    </div>
                  ) : (
                    <div className="animate-[fadeIn_200ms_ease-in] space-y-2">
                      {pixelCriteriaRules.map((rule) => (
                        <div
                          key={rule.id}
                          className={`rounded-lg border p-3 transition-colors ${
                            rule.enabled !== false
                              ? "border-[--color-border] bg-[--color-bg]"
                              : "border-[--color-border] bg-[--color-bg-muted] opacity-60"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-[--color-text] truncate">
                                  {rule.name}
                                </span>
                                <span
                                  className={`rounded px-1.5 py-px text-[10px] font-semibold leading-tight ${
                                    rule.action === "pass"
                                      ? "bg-green-500/15 text-green-500"
                                      : "bg-red-500/15 text-red-400"
                                  }`}
                                >
                                  {rule.action}
                                </span>
                                {rule.enabled === false && (
                                  <span className="rounded px-1.5 py-px text-[10px] font-semibold leading-tight bg-yellow-500/15 text-yellow-500">
                                    disabled
                                  </span>
                                )}
                              </div>
                              <div className="mt-1.5 space-y-1">
                                {rule.groups.map((group, gIdx) => (
                                  <div
                                    key={`pc-${rule.id}-g${gIdx}`}
                                    className="rounded-md border border-[--color-border] bg-[--color-bg-muted] p-2"
                                  >
                                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
                                      Group {gIdx + 1}
                                    </p>
                                    {group.conditions.map((cond, cIdx) => (
                                      <p
                                        key={`pc-${rule.id}-g${gIdx}-c${cIdx}`}
                                        className="text-[11px] text-[--color-text]"
                                      >
                                        <span className="font-medium">
                                          {normalizeFieldLabel(cond.field_name)}
                                        </span>{" "}
                                        <span className="text-[--color-text-muted]">
                                          {formatLogicOperatorLabel(
                                            cond.operator,
                                          )}
                                        </span>{" "}
                                        <span className="font-mono text-[10px] text-[--color-text-muted]">
                                          {formatLogicConditionValue(
                                            cond.value,
                                          )}
                                        </span>
                                      </p>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                title={
                                  rule.enabled !== false ? "Disable" : "Enable"
                                }
                                onClick={() =>
                                  handleTogglePixelCriteriaRule(rule)
                                }
                                className="rounded p-1 text-[--color-text-muted] hover:text-[--color-primary] transition-colors"
                              >
                                {rule.enabled !== false ? (
                                  <Check size={14} />
                                ) : (
                                  <RotateCcw size={14} />
                                )}
                              </button>
                              <button
                                type="button"
                                title="Edit"
                                onClick={() => {
                                  setPixelCriteriaEditingRule(rule);
                                  setPixelCriteriaBuilderOpen(true);
                                }}
                                className="rounded p-1 text-[--color-text-muted] hover:text-[--color-primary] transition-colors"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                title="Delete"
                                disabled={
                                  pixelCriteriaDeletingRuleId === rule.id
                                }
                                onClick={() =>
                                  handleDeletePixelCriteriaRule(rule.id)
                                }
                                className="rounded p-1 text-[--color-text-muted] hover:text-red-500 transition-colors disabled:opacity-50"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!pixelCriteriaLoading && pixelCriteriaRules.length > 0 && (
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setPixelCriteriaEditingRule(null);
                          setPixelCriteriaBuilderOpen(true);
                        }}
                      >
                        <Plus size={14} className="mr-1" />
                        Add Rule
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Sold Criteria tab ──────────────────────── */}
            {pixelConfigTab === "sold_criteria" && (
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <div className="space-y-4">
                  <div className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-3">
                    <p className="text-[11px] text-[--color-text-muted]">
                      <span className="font-semibold text-[--color-text]">
                        Optional.
                      </span>{" "}
                      Sold criteria rules determine whether a delivered lead
                      counts as &quot;sold&quot; for this affiliate. If any rule
                      fails, the lead is marked as not sold and does not count
                      toward the lead cap. When no rules are configured, the
                      delivery result is used as-is.
                    </p>
                  </div>

                  {soldCriteriaLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <svg
                        className="h-6 w-6 animate-spin text-[--color-primary]"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                    </div>
                  ) : soldCriteriaRules.length === 0 ? (
                    <div className="animate-[fadeIn_200ms_ease-in] rounded-xl border border-dashed border-[--color-border] py-10 text-center text-sm text-[--color-text-muted]">
                      No sold criteria rules yet.{" "}
                      <button
                        type="button"
                        className="text-[--color-primary] hover:underline"
                        onClick={() => {
                          setSoldCriteriaEditingRule(null);
                          setSoldCriteriaBuilderOpen(true);
                        }}
                      >
                        Add one
                      </button>
                    </div>
                  ) : (
                    <div className="animate-[fadeIn_200ms_ease-in] space-y-2">
                      {soldCriteriaRules.map((rule) => (
                        <div
                          key={rule.id}
                          className={`rounded-lg border p-3 transition-colors ${
                            rule.enabled !== false
                              ? "border-[--color-border] bg-[--color-bg]"
                              : "border-[--color-border] bg-[--color-bg-muted] opacity-60"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-[--color-text] truncate">
                                  {rule.name}
                                </span>
                                <span
                                  className={`rounded px-1.5 py-px text-[10px] font-semibold leading-tight ${
                                    rule.action === "pass"
                                      ? "bg-green-500/15 text-green-500"
                                      : "bg-red-500/15 text-red-400"
                                  }`}
                                >
                                  {rule.action}
                                </span>
                                {rule.enabled === false && (
                                  <span className="rounded px-1.5 py-px text-[10px] font-semibold leading-tight bg-yellow-500/15 text-yellow-500">
                                    disabled
                                  </span>
                                )}
                              </div>
                              <div className="mt-1.5 space-y-1">
                                {rule.groups.map((group, gIdx) => (
                                  <div
                                    key={`sc-${rule.id}-g${gIdx}`}
                                    className="rounded-md border border-[--color-border] bg-[--color-bg-muted] p-2"
                                  >
                                    <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
                                      Group {gIdx + 1}
                                    </p>
                                    {group.conditions.map((cond, cIdx) => (
                                      <p
                                        key={`sc-${rule.id}-g${gIdx}-c${cIdx}`}
                                        className="text-[11px] text-[--color-text]"
                                      >
                                        <span className="font-medium">
                                          {normalizeFieldLabel(cond.field_name)}
                                        </span>{" "}
                                        <span className="text-[--color-text-muted]">
                                          {formatLogicOperatorLabel(
                                            cond.operator,
                                          )}
                                        </span>{" "}
                                        <span className="font-mono text-[10px] text-[--color-text-muted]">
                                          {formatLogicConditionValue(
                                            cond.value,
                                          )}
                                        </span>
                                      </p>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                title={
                                  rule.enabled !== false ? "Disable" : "Enable"
                                }
                                onClick={() =>
                                  handleToggleSoldCriteriaRule(rule)
                                }
                                className="rounded p-1 text-[--color-text-muted] hover:text-[--color-primary] transition-colors"
                              >
                                {rule.enabled !== false ? (
                                  <Check size={14} />
                                ) : (
                                  <RotateCcw size={14} />
                                )}
                              </button>
                              <button
                                type="button"
                                title="Edit"
                                onClick={() => {
                                  setSoldCriteriaEditingRule(rule);
                                  setSoldCriteriaBuilderOpen(true);
                                }}
                                className="rounded p-1 text-[--color-text-muted] hover:text-[--color-primary] transition-colors"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                title="Delete"
                                disabled={
                                  soldCriteriaDeletingRuleId === rule.id
                                }
                                onClick={() =>
                                  handleDeleteSoldCriteriaRule(rule.id)
                                }
                                className="rounded p-1 text-[--color-text-muted] hover:text-red-500 transition-colors disabled:opacity-50"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {!soldCriteriaLoading && soldCriteriaRules.length > 0 && (
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSoldCriteriaEditingRule(null);
                          setSoldCriteriaBuilderOpen(true);
                        }}
                      >
                        <Plus size={14} className="mr-1" />
                        Add Rule
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
