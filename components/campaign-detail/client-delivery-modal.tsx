"use client";

import type { Dispatch, SetStateAction } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import { DisabledTooltip } from "@/components/shared-ui";
import type {
  Campaign,
  Client,
  ClientDeliveryConfig,
  CriteriaField,
} from "@/lib/types";

interface ClientDeliveryModalProps {
  campaign: Campaign | null;
  clients: Client[];
  criteriaFields: CriteriaField[];
  deliveryClientId: string | null;
  deliveryDraft: ClientDeliveryConfig;
  deliveryTab: "request" | "response";
  savingDeliveryConfig: boolean;
  deliverySaveAttempted: boolean;
  deliveryHasUrl: boolean;
  deliveryHasMappings: boolean;
  deliveryHasValidationRule: boolean;
  deliveryInvalidUrl: boolean;
  deliveryInvalidMappings: boolean;
  deliveryInvalidRules: boolean;
  deliverySaveDisabledReason: string;
  setDeliveryClientId: Dispatch<SetStateAction<string | null>>;
  setDeliveryDraft: Dispatch<SetStateAction<ClientDeliveryConfig>>;
  setDeliveryTab: Dispatch<SetStateAction<"request" | "response">>;
  setSavingDeliveryConfig: Dispatch<SetStateAction<boolean>>;
  setDeliverySaveAttempted: Dispatch<SetStateAction<boolean>>;
  setLocalClientLinks: Dispatch<
    SetStateAction<NonNullable<Campaign["clients"]>>
  >;
  onUpdateClientDeliveryConfig: (
    campaignId: string,
    clientId: string,
    payload: ClientDeliveryConfig,
  ) => Promise<void>;
  normalizeFieldLabel: (label: string) => string;
  inputClass: string;
}

export function ClientDeliveryModal({
  campaign,
  clients,
  criteriaFields,
  deliveryClientId,
  deliveryDraft,
  deliveryTab,
  savingDeliveryConfig,
  deliverySaveAttempted,
  deliveryHasUrl,
  deliveryHasMappings,
  deliveryHasValidationRule,
  deliveryInvalidUrl,
  deliveryInvalidMappings,
  deliveryInvalidRules,
  deliverySaveDisabledReason,
  setDeliveryClientId,
  setDeliveryDraft,
  setDeliveryTab,
  setSavingDeliveryConfig,
  setDeliverySaveAttempted,
  setLocalClientLinks,
  onUpdateClientDeliveryConfig,
  normalizeFieldLabel,
  inputClass,
}: ClientDeliveryModalProps) {
  if (!campaign) return null;

  return (
    <>
      <Modal
        title={`Client Delivery${
          deliveryClientId
            ? ` — ${clients.find((c) => c.id === deliveryClientId)?.name || deliveryClientId}`
            : ""
        }`}
        isOpen={!!deliveryClientId}
        onClose={() => {
          setDeliverySaveAttempted(false);
          setDeliveryClientId(null);
        }}
        width={720}
        bodyClassName="px-5 py-4 h-[620px] max-h-[80vh]"
      >
        {deliveryClientId && (
          <div className="flex h-full min-h-0 flex-col gap-4">
            <div className="flex items-center gap-1 border-b border-[--color-border] pb-2">
              {(
                [
                  { key: "request" as const, label: "Delivery Request" },
                  { key: "response" as const, label: "Response Validation" },
                ] as const
              ).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setDeliveryTab(t.key)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    deliveryTab === t.key
                      ? "bg-[--color-primary] text-white"
                      : "text-[--color-text-muted] hover:text-[--color-text]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              {deliveryTab === "request" ? (
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-[--color-text-muted]">
                        Method
                      </span>
                      <select
                        className={inputClass}
                        value={deliveryDraft.method}
                        onChange={(e) =>
                          setDeliveryDraft((prev) => ({
                            ...prev,
                            method: e.target
                              .value as ClientDeliveryConfig["method"],
                          }))
                        }
                      >
                        {(["POST", "GET", "PUT", "PATCH"] as const).map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 md:col-span-1">
                      <span className="text-xs font-medium text-[--color-text-muted]">
                        Webhook URL <span className="text-red-500">*</span>
                      </span>
                      <input
                        className={`${inputClass} ${
                          deliveryInvalidUrl
                            ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/25"
                            : ""
                        }`}
                        value={deliveryDraft.url}
                        onChange={(e) =>
                          setDeliveryDraft((prev) => ({
                            ...prev,
                            url: e.target.value,
                          }))
                        }
                        placeholder="https://buyer.example.com/leads"
                      />
                    </label>
                  </div>

                  <div
                    className={`space-y-2 rounded-lg border p-3 ${
                      deliveryInvalidMappings
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
                          deliveryDraft.payload_mapping
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
                              <p className="text-[11px] text-[--color-text-muted] mt-0.5">
                                Add all {unmappedCount} unmapped field
                                {unmappedCount !== 1 ? "s" : ""} at once.
                                Existing mappings are kept.
                              </p>
                            </div>
                            <button
                              type="button"
                              className="ml-3 shrink-0 rounded-md border border-[--color-border] bg-[--color-panel] px-3 py-1.5 text-xs font-semibold text-[--color-text] hover:border-[--color-primary] hover:text-[--color-primary] transition-colors"
                              onClick={() =>
                                setDeliveryDraft((prev) => {
                                  const mapped = new Set(
                                    prev.payload_mapping
                                      .map((m) => m.field_name)
                                      .filter(Boolean),
                                  );
                                  const toAdd = criteriaFields
                                    .filter((cf) => !mapped.has(cf.field_name))
                                    .map((cf) => ({
                                      key: cf.field_name,
                                      value_source: "field" as const,
                                      field_name: cf.field_name,
                                      parameter_target: "body" as const,
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
                        {deliveryDraft.payload_mapping.map((row, idx) => (
                          <motion.div
                            key={`map-${idx}`}
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
                                setDeliveryDraft((prev) => ({
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
                                  .value as ClientDeliveryConfig["payload_mapping"][number]["value_source"];
                                setDeliveryDraft((prev) => ({
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
                                  setDeliveryDraft((prev) => ({
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
                                    : "Select lead field\u2026"}
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
                                  setDeliveryDraft((prev) => ({
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
                              className={inputClass}
                              value={row.parameter_target ?? "body"}
                              onChange={(e) =>
                                setDeliveryDraft((prev) => ({
                                  ...prev,
                                  payload_mapping: prev.payload_mapping.map(
                                    (m, i) =>
                                      i === idx
                                        ? {
                                            ...m,
                                            parameter_target: e.target.value as
                                              | "query"
                                              | "body",
                                          }
                                        : m,
                                  ),
                                }))
                              }
                            >
                              <option value="query">Query</option>
                              <option value="body">Body</option>
                            </select>
                            <button
                              type="button"
                              className="flex items-center justify-center rounded p-1.5 text-[--color-text-muted] hover:text-red-500 disabled:opacity-30 transition-colors"
                              onClick={() =>
                                setDeliveryDraft((prev) => ({
                                  ...prev,
                                  payload_mapping: prev.payload_mapping.filter(
                                    (_, i) => i !== idx,
                                  ),
                                }))
                              }
                              disabled={
                                deliveryDraft.payload_mapping.length <= 1
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
                        setDeliveryDraft((prev) => ({
                          ...prev,
                          payload_mapping: [
                            ...prev.payload_mapping,
                            {
                              key: "",
                              value_source: "field",
                              field_name: "",
                              parameter_target: "body",
                            },
                          ],
                        }))
                      }
                    >
                      <Plus size={12} />
                      Add mapping
                    </button>
                  </div>

                  {/* \u2500\u2500 Live payload preview */}
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

                    const previewEntries = deliveryDraft.payload_mapping
                      .filter((m) => m.key.trim())
                      .map((m) => {
                        if (m.value_source === "static") {
                          return {
                            key: m.key.trim(),
                            value: String(m.static_value ?? ""),
                            target: (m.parameter_target ?? "body") as
                              | "query"
                              | "body",
                          };
                        }
                        const cf = criteriaFields.find(
                          (f) => f.field_name === m.field_name,
                        );
                        return {
                          key: m.key.trim(),
                          value: cf ? sampleValueFor(cf) : "\u2026",
                          target: (m.parameter_target ?? "body") as
                            | "query"
                            | "body",
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
                      deliveryDraft.url.trim() ||
                      "https://buyer.example.com/leads";
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
              ) : (
                <div className="space-y-3">
                  <div
                    className={`space-y-2 rounded-lg border p-3 ${
                      deliveryInvalidRules
                        ? "border-red-500/60"
                        : "border-[--color-border]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                          Acceptance Rules{" "}
                          <span className="text-red-500">*</span>
                        </p>
                        <p className="text-[11px] text-[--color-text-muted] mt-0.5">
                          Rules are evaluated as OR (first match wins). Matching
                          is case-insensitive.
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <AnimatePresence initial={false}>
                        {deliveryDraft.acceptance_rules.map((rule, idx) => (
                          <motion.div
                            key={`rule-${idx}`}
                            layout
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.18 }}
                            className="grid gap-2 md:grid-cols-[minmax(0,1fr)_110px_auto]"
                          >
                            <input
                              className={inputClass}
                              placeholder="Response contains..."
                              value={rule.match_value}
                              onChange={(e) =>
                                setDeliveryDraft((prev) => ({
                                  ...prev,
                                  acceptance_rules: prev.acceptance_rules.map(
                                    (r, i) =>
                                      i === idx
                                        ? { ...r, match_value: e.target.value }
                                        : r,
                                  ),
                                }))
                              }
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setDeliveryDraft((prev) => ({
                                  ...prev,
                                  acceptance_rules: prev.acceptance_rules.map(
                                    (r, i) =>
                                      i === idx
                                        ? {
                                            ...r,
                                            action:
                                              r.action === "passed"
                                                ? "failed"
                                                : "passed",
                                          }
                                        : r,
                                  ),
                                }))
                              }
                              className={`flex w-[100px] items-center justify-between rounded-full border px-1 py-1 text-xs font-semibold transition-colors ${
                                rule.action === "passed"
                                  ? "border-green-500/40 bg-green-500/10"
                                  : "border-red-500/40 bg-red-500/10"
                              }`}
                            >
                              <span
                                className={`flex h-5 w-5 items-center justify-center rounded-full text-white transition-all ${
                                  rule.action === "passed"
                                    ? "bg-green-500"
                                    : "bg-red-500"
                                }`}
                              >
                                {rule.action === "passed" ? "✓" : "✕"}
                              </span>
                              <span
                                className={`flex-1 text-center ${
                                  rule.action === "passed"
                                    ? "text-green-600"
                                    : "text-red-500"
                                }`}
                              >
                                {rule.action === "passed" ? "Pass" : "Fail"}
                              </span>
                            </button>
                            <button
                              type="button"
                              className="flex items-center justify-center rounded p-1.5 text-[--color-text-muted] hover:text-red-500 disabled:opacity-30 transition-colors"
                              onClick={() =>
                                setDeliveryDraft((prev) => ({
                                  ...prev,
                                  acceptance_rules:
                                    prev.acceptance_rules.filter(
                                      (_, i) => i !== idx,
                                    ),
                                }))
                              }
                              disabled={
                                deliveryDraft.acceptance_rules.length <= 1
                              }
                              title="Remove rule"
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
                        setDeliveryDraft((prev) => ({
                          ...prev,
                          acceptance_rules: [
                            ...prev.acceptance_rules,
                            { match_value: "", action: "passed" },
                          ],
                        }))
                      }
                    >
                      <Plus size={12} />
                      Add rule
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[--color-border] pt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDeliverySaveAttempted(false);
                  setDeliveryClientId(null);
                }}
              >
                Cancel
              </Button>
              <div className="inline-flex">
                <DisabledTooltip message={deliverySaveDisabledReason}>
                  <Button
                    size="sm"
                    disabled={
                      savingDeliveryConfig ||
                      Boolean(deliverySaveDisabledReason)
                    }
                    onClick={async () => {
                      setDeliverySaveAttempted(true);
                      const trimmedUrl = deliveryDraft.url.trim();
                      if (!trimmedUrl) {
                        toast.warning("Webhook URL is required.");
                        return;
                      }
                      try {
                        // URL validation
                        // eslint-disable-next-line no-new
                        new URL(trimmedUrl);
                      } catch {
                        toast.warning("Enter a valid webhook URL.");
                        return;
                      }

                      if (deliveryDraft.payload_mapping.length === 0) {
                        toast.warning(
                          "At least one payload mapping is required.",
                        );
                        return;
                      }
                      const hasBadMapping = deliveryDraft.payload_mapping.some(
                        (m) =>
                          !m.key.trim() ||
                          (m.parameter_target !== undefined &&
                            m.parameter_target !== "query" &&
                            m.parameter_target !== "body") ||
                          (m.value_source === "field"
                            ? !(m.field_name ?? "").trim()
                            : String(m.static_value ?? "").trim().length === 0),
                      );
                      if (hasBadMapping) {
                        toast.warning("Complete all payload mapping rows.");
                        return;
                      }

                      if (deliveryDraft.acceptance_rules.length === 0) {
                        toast.warning(
                          "At least one acceptance rule is required.",
                        );
                        return;
                      }
                      const hasBadRule = deliveryDraft.acceptance_rules.some(
                        (r) => !r.match_value.trim(),
                      );
                      if (hasBadRule) {
                        toast.warning("Complete all acceptance rules.");
                        return;
                      }

                      setSavingDeliveryConfig(true);
                      try {
                        const payload: ClientDeliveryConfig = {
                          ...deliveryDraft,
                          url: trimmedUrl,
                          payload_mapping: deliveryDraft.payload_mapping.map(
                            (m) =>
                              m.value_source === "field"
                                ? {
                                    key: m.key.trim(),
                                    value_source: "field",
                                    field_name: (m.field_name ?? "").trim(),
                                    parameter_target:
                                      m.parameter_target ?? "body",
                                  }
                                : {
                                    key: m.key.trim(),
                                    value_source: "static",
                                    static_value: m.static_value,
                                    parameter_target:
                                      m.parameter_target ?? "body",
                                  },
                          ),
                          acceptance_rules: deliveryDraft.acceptance_rules.map(
                            (r) => ({
                              match_value: r.match_value.trim(),
                              action: r.action,
                            }),
                          ),
                        };

                        await onUpdateClientDeliveryConfig(
                          campaign.id,
                          deliveryClientId,
                          payload,
                        );

                        setLocalClientLinks((prev) =>
                          prev.map((l) =>
                            l.client_id === deliveryClientId
                              ? { ...l, delivery_config: payload }
                              : l,
                          ),
                        );
                        setDeliveryClientId(null);
                      } finally {
                        setSavingDeliveryConfig(false);
                      }
                    }}
                  >
                    Save Delivery Config
                  </Button>
                </DisabledTooltip>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
