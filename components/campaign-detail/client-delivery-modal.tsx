"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Globe, Plus, Shield, Trash2, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import type {
  CriteriaField,
  Destination,
  ValidationCondition,
  ResponseValidation,
} from "@/lib/types";
import {
  listDestinations,
  addDestination,
  updateDestination,
  deleteDestination,
  getResponseValidation,
  saveResponseValidation,
} from "@/lib/api";

/* ── helpers ──────────────────────────────────────────────────────────────── */

function emptyDestinationDraft(): Omit<Destination, "id"> {
  return {
    name: "",
    type: "webhook",
    url: "",
    method: "POST",
    payload_mapping: [
      {
        key: "",
        value_source: "field",
        field_name: "",
        parameter_target: "body",
      },
    ],
    is_primary: false,
    non_webhook_delivery_action: undefined,
  };
}

function sampleValueFor(field: CriteriaField | undefined): string {
  if (!field) return "";
  const lbl = field.field_label.toLowerCase();
  if (lbl.includes("email")) return "john@example.com";
  if (lbl.includes("phone")) return "+1 (555) 867-5309";
  if (lbl.includes("first") && lbl.includes("name")) return "John";
  if (lbl.includes("last") && lbl.includes("name")) return "Doe";
  if (lbl.includes("name")) return "John Doe";
  if (lbl.includes("zip") || lbl.includes("postal")) return "90210";
  if (lbl.includes("city")) return "Los Angeles";
  if (lbl.includes("ip") || field.field_name.toLowerCase().includes("ip"))
    return "203.0.113.42";
  if (lbl.includes("address")) return "123 Main St";
  if (lbl.includes("dob") || lbl.includes("birth")) return "1990-06-15";
  switch (field.data_type) {
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
}

const inputClass =
  "w-full rounded-md border border-[--color-border] bg-[--color-panel] px-2.5 py-1.5 text-sm text-[--color-text] outline-none transition focus:border-[--color-primary] focus:ring-1 focus:ring-[--color-primary]/25";

/* ── props ────────────────────────────────────────────────────────────────── */

interface ClientDeliveryModalProps {
  campaignId: string | null;
  clientId: string | null;
  clientName: string;
  criteriaFields: CriteriaField[];
  onClose: () => void;
  onDestinationsChanged?: () => void;
}

/* ── component ────────────────────────────────────────────────────────────── */

export function ClientDeliveryModal({
  campaignId,
  clientId,
  clientName,
  criteriaFields,
  onClose,
  onDestinationsChanged,
}: ClientDeliveryModalProps) {
  const isOpen = !!campaignId && !!clientId;

  /* ── destination list ────────────────────────────────────────────────── */
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /* ── editing state ───────────────────────────────────────────────────── */
  const [draft, setDraft] = useState<Omit<Destination, "id">>(
    emptyDestinationDraft(),
  );
  const [activeView, setActiveView] = useState<"destination" | "validation">(
    "destination",
  );
  const [saving, setSaving] = useState(false);
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [isNew, setIsNew] = useState(false);

  /* ── dirty tracking ──────────────────────────────────────────────────── */
  const originalDraftRef = useRef<string>("");
  const isDirty = useMemo(() => {
    const { acceptance_rules: _ar, ...rest } = draft;
    return JSON.stringify(rest) !== originalDraftRef.current;
  }, [draft]);

  /* ── response validation (contract-level OR rules) ───────────────────── */
  const [rvRules, setRvRules] = useState<ValidationCondition[]>([]);
  const rvOriginalRef = useRef<string>("");
  const rvDirty = useMemo(() => {
    return JSON.stringify({ rules: rvRules }) !== rvOriginalRef.current;
  }, [rvRules]);
  const [rvSaving, setRvSaving] = useState(false);

  /* ── fetch destinations ──────────────────────────────────────────────── */
  const fetchDestinations = useCallback(async () => {
    if (!campaignId || !clientId) return [];
    setLoading(true);
    try {
      const res = await listDestinations(campaignId, clientId);
      const items: Destination[] = (res as any)?.data ?? [];
      setDestinations(items);
      return items;
    } catch {
      toast.error("Failed to load destinations.");
      return [];
    } finally {
      setLoading(false);
    }
  }, [campaignId, clientId]);

  /* ── fetch response validation ─────────────────────────────────────── */
  const fetchResponseValidation = useCallback(async () => {
    if (!campaignId || !clientId) return;
    try {
      const res = await getResponseValidation(campaignId, clientId);
      const rv: ResponseValidation | null = (res as any)?.data ?? null;
      // Backward-compatible read: flatten legacy group payloads into OR-only rules.
      const normalizedRules: ValidationCondition[] = rv
        ? Array.isArray((rv as { rules?: ValidationCondition[] }).rules)
          ? ((rv as { rules: ValidationCondition[] }).rules ?? [])
          : Array.isArray(
                (
                  rv as {
                    groups?: Array<{ conditions?: ValidationCondition[] }>;
                  }
                ).groups,
              )
            ? ((
                (
                  rv as {
                    groups?: Array<{ conditions?: ValidationCondition[] }>;
                  }
                ).groups ?? []
              ).flatMap(
                (group) => group.conditions ?? [],
              ) as ValidationCondition[])
            : []
        : [];
      setRvRules(normalizedRules);
      const snap = JSON.stringify({ rules: normalizedRules });
      rvOriginalRef.current = snap;
    } catch {
      /* silently use defaults */
    }
  }, [campaignId, clientId]);

  useEffect(() => {
    if (!isOpen) return;
    setSaveAttempted(false);
    setActiveView("destination");
    setIsNew(false);
    setRvRules([]);
    rvOriginalRef.current = JSON.stringify({ rules: [] });
    fetchDestinations().then((items) => {
      if (items && items.length > 0) {
        setSelectedId(items[0].id);
        loadDraftFrom(items[0]);
      } else {
        setSelectedId(null);
        setDraft(emptyDestinationDraft());
        originalDraftRef.current = JSON.stringify(emptyDestinationDraft());
      }
    });
    fetchResponseValidation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  /* ── load draft from destination ─────────────────────────────────────── */
  const loadDraftFrom = (d: Destination) => {
    const newDraft: Omit<Destination, "id"> = {
      name: d.name,
      type: d.type,
      url: d.url,
      method: d.method,
      headers: d.headers,
      payload_mapping:
        d.payload_mapping.length > 0
          ? d.payload_mapping
          : [
              {
                key: "",
                value_source: "field",
                field_name: "",
                parameter_target: "body",
              },
            ],
      is_primary: d.is_primary,
      non_webhook_delivery_action: d.non_webhook_delivery_action,
      state_mapping_override: d.state_mapping_override,
      claim_trusted_form: d.claim_trusted_form,
      require_successful_claim: d.require_successful_claim,
    };
    setDraft(newDraft);
    const { acceptance_rules: _ar, ...rest } = newDraft;
    originalDraftRef.current = JSON.stringify(rest);
    setSaveAttempted(false);
    setIsNew(false);
  };

  const selectedDest = useMemo(
    () => destinations.find((d) => d.id === selectedId) ?? null,
    [destinations, selectedId],
  );

  const primaryDestination = useMemo(
    () => destinations.find((d) => d.is_primary) ?? destinations[0] ?? null,
    [destinations],
  );
  const primaryDestinationId = primaryDestination?.id ?? null;
  const primaryIsWebhook = primaryDestination?.type === "webhook";

  const primaryValidationConditionCount = useMemo(() => {
    if (!primaryDestinationId) return 0;
    return rvRules.filter(
      (condition) => condition.destination_id === primaryDestinationId,
    ).length;
  }, [rvRules, primaryDestinationId]);

  const primaryHasPassCondition = useMemo(() => {
    if (!primaryDestinationId) return false;
    return rvRules.some(
      (condition) =>
        condition.destination_id === primaryDestinationId &&
        condition.action === "passed" &&
        condition.match_value.trim().length > 0,
    );
  }, [rvRules, primaryDestinationId]);

  const hasAnyPassCondition = useMemo(
    () =>
      rvRules.some(
        (condition) =>
          condition.action === "passed" &&
          condition.match_value.trim().length > 0,
      ),
    [rvRules],
  );

  const showPrimaryValidationWarning =
    !!primaryDestination &&
    primaryDestination.type === "webhook" &&
    !primaryHasPassCondition;

  /* ── validation ──────────────────────────────────────────────────────── */
  const hasName = draft.name.trim().length > 0;
  const hasUrl = draft.url.trim().length > 0;
  const hasNonWebhookOutcome =
    draft.type === "webhook" ||
    draft.non_webhook_delivery_action === "passed" ||
    draft.non_webhook_delivery_action === "failed";
  const hasMappings =
    draft.payload_mapping.length > 0 &&
    draft.payload_mapping.every(
      (m) =>
        m.key.trim().length > 0 &&
        (m.value_source === "field"
          ? (m.field_name ?? "").trim().length > 0
          : String(m.static_value ?? "").trim().length > 0),
    );

  const saveDisabledReason = !hasName
    ? "Destination name is required."
    : !hasUrl
      ? "Destination URL is required."
      : !hasNonWebhookOutcome
        ? "Choose Sold or Rejected behavior for this non-webhook destination."
        : !hasMappings
          ? "Complete all payload mapping rows."
          : "";

  /* ── add new destination ─────────────────────────────────────────────── */
  const handleAddNew = () => {
    const newDraft = emptyDestinationDraft();
    newDraft.name = `Destination ${destinations.length + 1}`;
    newDraft.is_primary = destinations.length === 0;
    setDraft(newDraft);
    setSelectedId(null);
    setIsNew(true);
    setSaveAttempted(false);
    setActiveView("destination");
  };

  /* ── select existing ─────────────────────────────────────────────────── */
  const handleSelect = (d: Destination) => {
    setSelectedId(d.id);
    loadDraftFrom(d);
    setActiveView("destination");
  };

  /* ── save (create or update) ─────────────────────────────────────────── */
  const handleSave = async () => {
    setSaveAttempted(true);
    if (saveDisabledReason) {
      toast.warning(saveDisabledReason);
      return;
    }
    const trimmedUrl = draft.url.trim();
    try {
      new URL(trimmedUrl);
    } catch {
      toast.warning("Enter a valid destination URL.");
      return;
    }

    const payload: Partial<Destination> = {
      name: draft.name.trim(),
      type: draft.type,
      url: trimmedUrl,
      method: draft.method,
      is_primary: draft.is_primary,
      ...(draft.type !== "webhook"
        ? {
            non_webhook_delivery_action: draft.non_webhook_delivery_action,
          }
        : {}),
      headers: draft.headers,
      payload_mapping: draft.payload_mapping.map((m) =>
        m.value_source === "field"
          ? {
              key: m.key.trim(),
              value_source: "field" as const,
              field_name: (m.field_name ?? "").trim(),
              parameter_target: m.parameter_target ?? "body",
            }
          : {
              key: m.key.trim(),
              value_source: "static" as const,
              static_value: m.static_value,
              parameter_target: m.parameter_target ?? "body",
            },
      ),
    };

    setSaving(true);
    try {
      if (isNew) {
        const res = await addDestination(campaignId!, clientId!, payload);
        const created: Destination = (res as any)?.data;
        toast.success(`Destination "${draft.name.trim()}" created.`);
        const updated = await fetchDestinations();
        if (created?.id) {
          setSelectedId(created.id);
          const found = updated?.find((d) => d.id === created.id);
          if (found) loadDraftFrom(found);
        }
        setIsNew(false);
      } else if (selectedId) {
        await updateDestination(campaignId!, clientId!, selectedId, payload);
        toast.success(`Destination "${draft.name.trim()}" saved.`);
        const updated = await fetchDestinations();
        const found = updated?.find((d) => d.id === selectedId);
        if (found) loadDraftFrom(found);
      }
      onDestinationsChanged?.();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save destination.");
    } finally {
      setSaving(false);
    }
  };

  /* ── delete ──────────────────────────────────────────────────────────── */
  const handleDelete = async (destId: string) => {
    setSaving(true);
    try {
      await deleteDestination(campaignId!, clientId!, destId);
      toast.success("Destination deleted.");
      const updated = await fetchDestinations();
      if (updated && updated.length > 0) {
        setSelectedId(updated[0].id);
        loadDraftFrom(updated[0]);
      } else {
        setSelectedId(null);
        setDraft(emptyDestinationDraft());
        setIsNew(false);
      }
      onDestinationsChanged?.();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete destination.");
    } finally {
      setSaving(false);
    }
  };

  /* ── payload preview ─────────────────────────────────────────────────── */
  const payloadPreview = useMemo(() => {
    const previewEntries = draft.payload_mapping
      .filter((m) => m.key.trim())
      .map((m) => {
        if (m.value_source === "static") {
          return {
            key: m.key.trim(),
            value: String(m.static_value ?? ""),
            target: (m.parameter_target ?? "body") as "query" | "body",
          };
        }
        const cf = criteriaFields.find((f) => f.field_name === m.field_name);
        return {
          key: m.key.trim(),
          value: cf ? sampleValueFor(cf) : "\u2026",
          target: (m.parameter_target ?? "body") as "query" | "body",
        };
      });
    if (previewEntries.length === 0) return null;

    const queryEntries = previewEntries.filter((e) => e.target === "query");
    const bodyEntries = previewEntries.filter((e) => e.target === "body");
    if (queryEntries.length === 0 && bodyEntries.length === 0) return null;

    const baseUrl = draft.url.trim() || "https://buyer.example.com/leads";
    let queryPreviewUrl = baseUrl;
    if (queryEntries.length > 0) {
      try {
        const url = new URL(baseUrl);
        for (const entry of queryEntries)
          url.searchParams.set(entry.key, entry.value);
        queryPreviewUrl = url.toString();
      } catch {
        const query = queryEntries
          .map(
            (e) =>
              `${encodeURIComponent(e.key)}=${encodeURIComponent(e.value)}`,
          )
          .join("&");
        queryPreviewUrl = query ? `${baseUrl}?${query}` : baseUrl;
      }
    }
    const bodyLines =
      bodyEntries.length > 0
        ? [
            "{",
            ...bodyEntries.map(
              (e, i) =>
                `  "${e.key}": "${e.value}"${i < bodyEntries.length - 1 ? "," : ""}`,
            ),
            "}",
          ]
        : null;

    return { queryEntries, bodyEntries, queryPreviewUrl, bodyLines };
  }, [draft.payload_mapping, draft.url, criteriaFields]);

  /* ── response validation helpers ─────────────────────────────────────── */
  const handleSaveValidation = async () => {
    if (!campaignId || !clientId) return;
    if (!primaryDestinationId || !primaryIsWebhook) {
      toast.warning(
        "Response validation is only available when the primary destination is a webhook.",
      );
      return;
    }

    const trimmedRules = rvRules
      .filter((condition) => condition.match_value.trim().length > 0)
      .map((condition) => ({
        destination_id: primaryDestinationId,
        match_value: condition.match_value.trim(),
        action: condition.action,
      }));

    const hasPass = trimmedRules.some(
      (condition) => condition.action === "passed",
    );
    const hasFail = trimmedRules.some(
      (condition) => condition.action === "failed",
    );

    if (trimmedRules.length > 0 && !hasPass) {
      toast.warning(
        "Add at least one PASS condition so leads can be marked sold.",
      );
      return;
    }
    if (hasFail && !hasPass) {
      toast.warning("FAILED conditions require an existing PASS condition.");
      return;
    }

    setRvSaving(true);
    try {
      await saveResponseValidation(campaignId, clientId, {
        rules: trimmedRules,
      });
      toast.success("Response validation saved.");
      setRvRules(trimmedRules);
      rvOriginalRef.current = JSON.stringify({ rules: trimmedRules });
      onDestinationsChanged?.();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save validation.");
    } finally {
      setRvSaving(false);
    }
  };

  /* ── render ──────────────────────────────────────────────────────────── */
  const showForm = activeView === "validation" || isNew || selectedId;

  return (
    <Modal
      title={`Destination Config — ${clientName}`}
      isOpen={isOpen}
      onClose={onClose}
      width={920}
      bodyClassName="px-0 py-0 h-[640px] max-h-[80vh]"
    >
      <div className="flex h-full min-h-0">
        {/* ── sidebar ────────────────────────────────────────────────── */}
        <div className="flex w-[220px] shrink-0 flex-col border-r border-[--color-border] bg-[--color-bg-muted]">
          <div className="flex items-center justify-between px-3 pt-3 pb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[--color-text-muted]">
              Destinations
            </span>
            <button
              type="button"
              onClick={handleAddNew}
              className="rounded p-1 text-[--color-text-muted] hover:bg-[--color-border] hover:text-[--color-primary] transition-colors"
              title="Add destination"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-1.5 pb-2 space-y-0.5">
            {loading && destinations.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-[--color-text-muted]">
                Loading…
              </p>
            )}

            {!loading && destinations.length === 0 && !isNew && (
              <div className="px-2 py-6 text-center">
                <p className="text-xs text-[--color-text-muted]">
                  No destinations yet.
                </p>
                <button
                  type="button"
                  onClick={handleAddNew}
                  className="mt-2 text-xs font-medium text-[--color-primary] hover:underline"
                >
                  + Add first destination
                </button>
              </div>
            )}

            {destinations.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => handleSelect(d)}
                className={`group flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors ${
                  selectedId === d.id && !isNew && activeView === "destination"
                    ? "bg-[--color-primary]/10 text-[--color-primary] font-semibold"
                    : "text-[--color-text] hover:bg-[--color-border]/50"
                }`}
              >
                <Globe size={12} className="shrink-0 opacity-60" />
                <span className="min-w-0 flex-1 truncate">{d.name}</span>
                {d.is_primary && (
                  <span className="shrink-0 rounded-full border border-[--color-border] bg-[--color-panel] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
                    Primary
                  </span>
                )}
              </button>
            ))}

            {isNew && (
              <div className="flex w-full items-center gap-2 rounded-md bg-[--color-primary]/10 px-2.5 py-2 text-left text-xs font-semibold text-[--color-primary]">
                <Globe size={12} className="shrink-0 opacity-60" />
                <span className="min-w-0 flex-1 truncate">
                  {draft.name || "New Destination"}
                </span>
              </div>
            )}
          </div>

          {/* ── response validation nav ────────────────────────────── */}
          <div className="border-t border-[--color-border] px-1.5 py-2">
            <button
              type="button"
              onClick={() => {
                setActiveView("validation");
                setIsNew(false);
              }}
              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors ${
                activeView === "validation"
                  ? "bg-[--color-primary]/10 text-[--color-primary] font-semibold"
                  : "text-[--color-text] hover:bg-[--color-border]/50"
              }`}
            >
              <Shield size={12} className="shrink-0 opacity-60" />
              <span className="min-w-0 flex-1 truncate">
                Response Validation
              </span>
              {showPrimaryValidationWarning && (
                <span
                  className="shrink-0"
                  title="Primary webhook has no PASS validation condition"
                >
                  <AlertTriangle
                    size={12}
                    className="shrink-0 text-amber-500"
                  />
                </span>
              )}
              {primaryValidationConditionCount > 0 && (
                <span className="shrink-0 rounded-full bg-[--color-primary]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[--color-primary]">
                  {primaryValidationConditionCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── main content ───────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col">
          {showForm ? (
            <>
              {/* header bar */}
              <div className="flex items-center gap-1 border-b border-[--color-border] px-4 pt-3 pb-2">
                <p className="text-sm font-semibold text-[--color-text]">
                  {activeView === "validation"
                    ? "Response Validation"
                    : isNew
                      ? "New Destination"
                      : (selectedDest?.name ?? "Destination")}
                </p>
                <div className="ml-auto flex items-center gap-2">
                  {activeView === "destination" && !isNew && selectedId && (
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          confirm(
                            `Delete destination "${selectedDest?.name || selectedId}"?`,
                          )
                        ) {
                          handleDelete(selectedId);
                        }
                      }}
                      className="rounded p-1.5 text-[--color-text-muted] hover:text-red-500 transition-colors"
                      title="Delete destination"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* scrollable form */}
              <div className="min-h-0 flex-1 overflow-y-auto">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={`${activeView}-${selectedId ?? "new"}`}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="px-4 py-3"
                  >
                    {activeView === "destination" ? (
                      <div className="space-y-3">
                        <div className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] px-3 py-2.5">
                          <p className="text-xs font-semibold text-[--color-text-strong]">
                            How routing works
                          </p>
                          <p className="mt-1 text-[11px] leading-relaxed text-[--color-text-muted]">
                            Exactly one destination should be marked primary.
                            The primary destination decides whether a lead is
                            sold or rejected. For webhook primaries,
                            sold/rejected is determined by Response Validation
                            rules. For non-webhook primaries, use the
                            Sold/Rejected behavior below.
                          </p>
                        </div>

                        {/* destination name */}
                        <label className="space-y-1">
                          <span className="text-xs font-medium text-[--color-text-muted]">
                            Destination Name{" "}
                            <span className="text-red-500">*</span>
                          </span>
                          <input
                            className={`${inputClass} ${
                              saveAttempted && !hasName
                                ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/25"
                                : ""
                            }`}
                            value={draft.name}
                            onChange={(e) =>
                              setDraft((prev) => ({
                                ...prev,
                                name: e.target.value,
                              }))
                            }
                            placeholder="e.g. Primary CRM Webhook"
                          />
                        </label>

                        <div className="grid gap-3 md:grid-cols-[220px_1fr]">
                          <label className="space-y-1">
                            <span className="text-xs font-medium text-[--color-text-muted]">
                              Destination Type
                            </span>
                            <select
                              className={inputClass}
                              value={draft.type}
                              onChange={(e) => {
                                const nextType = e.target
                                  .value as Destination["type"];
                                setDraft((prev) => ({
                                  ...prev,
                                  type: nextType,
                                  non_webhook_delivery_action:
                                    nextType === "webhook"
                                      ? undefined
                                      : (prev.non_webhook_delivery_action ??
                                        "failed"),
                                }));
                              }}
                            >
                              <option value="webhook">Webhook</option>
                              <option value="email">Email</option>
                              <option value="google_sheets">
                                Google Sheets
                              </option>
                            </select>
                          </label>

                          <label className="flex items-end gap-2 rounded-md border border-[--color-border] bg-[--color-bg-muted] px-3 py-2 text-xs text-[--color-text]">
                            <input
                              type="checkbox"
                              checked={!!draft.is_primary}
                              onChange={(e) =>
                                setDraft((prev) => ({
                                  ...prev,
                                  is_primary: e.target.checked,
                                }))
                              }
                              className="h-3.5 w-3.5 rounded border-[--color-border] text-[--color-primary] focus:ring-[--color-primary]/30"
                            />
                            <span>
                              Mark as primary destination (controls sold or
                              rejected outcome)
                            </span>
                          </label>
                        </div>

                        {/* method + URL */}
                        <div className="grid gap-3 md:grid-cols-[140px_1fr]">
                          <label className="space-y-1">
                            <span className="text-xs font-medium text-[--color-text-muted]">
                              Method
                            </span>
                            <select
                              className={inputClass}
                              value={draft.method}
                              onChange={(e) =>
                                setDraft((prev) => ({
                                  ...prev,
                                  method: e.target
                                    .value as Destination["method"],
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
                          <label className="space-y-1">
                            <span className="text-xs font-medium text-[--color-text-muted]">
                              Destination URL{" "}
                              <span className="text-red-500">*</span>
                            </span>
                            <input
                              className={`${inputClass} ${
                                saveAttempted && !hasUrl
                                  ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/25"
                                  : ""
                              }`}
                              value={draft.url}
                              onChange={(e) =>
                                setDraft((prev) => ({
                                  ...prev,
                                  url: e.target.value,
                                }))
                              }
                              placeholder="https://buyer.example.com/leads"
                            />
                          </label>
                        </div>

                        {draft.type !== "webhook" && (
                          <div
                            className={`rounded-lg border p-3 ${
                              saveAttempted && !hasNonWebhookOutcome
                                ? "border-red-500/60"
                                : "border-[--color-border]"
                            }`}
                          >
                            <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                              Non-Webhook Outcome{" "}
                              <span className="text-red-500">*</span>
                            </p>
                            <p className="mt-1 text-[11px] text-[--color-text-muted]">
                              Without webhook response validation, choose how a
                              successful delivery should be treated.
                            </p>
                            <div className="mt-2 grid gap-2 md:grid-cols-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setDraft((prev) => ({
                                    ...prev,
                                    non_webhook_delivery_action: "passed",
                                  }))
                                }
                                className={`rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                                  draft.non_webhook_delivery_action === "passed"
                                    ? "border-emerald-400 bg-emerald-500/10 text-emerald-700"
                                    : "border-[--color-border] text-[--color-text] hover:border-emerald-300"
                                }`}
                              >
                                Sold
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setDraft((prev) => ({
                                    ...prev,
                                    non_webhook_delivery_action: "failed",
                                  }))
                                }
                                className={`rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                                  draft.non_webhook_delivery_action === "failed"
                                    ? "border-rose-400 bg-rose-500/10 text-rose-700"
                                    : "border-[--color-border] text-[--color-text] hover:border-rose-300"
                                }`}
                              >
                                Rejected
                              </button>
                            </div>
                          </div>
                        )}

                        {/* payload mapping */}
                        <div
                          className={`space-y-2 rounded-lg border p-3 ${
                            saveAttempted && !hasMappings
                              ? "border-red-500/60"
                              : "border-[--color-border]"
                          }`}
                        >
                          <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                            Payload Mapping{" "}
                            <span className="text-red-500">*</span>
                          </p>

                          {/* import from lead fields */}
                          {criteriaFields.length > 0 &&
                            (() => {
                              const alreadyMapped = new Set(
                                draft.payload_mapping
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
                                      Import from lead fields
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
                                      setDraft((prev) => {
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
                                            parameter_target: "body" as const,
                                          }));
                                        if (toAdd.length === 0) return prev;
                                        const hasOnlyEmptyPlaceholder =
                                          prev.payload_mapping.length === 1 &&
                                          !prev.payload_mapping[0].key &&
                                          !prev.payload_mapping[0].field_name;
                                        return {
                                          ...prev,
                                          payload_mapping:
                                            hasOnlyEmptyPlaceholder
                                              ? toAdd
                                              : [
                                                  ...prev.payload_mapping,
                                                  ...toAdd,
                                                ],
                                        };
                                      })
                                    }
                                  >
                                    Add All
                                  </button>
                                </div>
                              );
                            })()}

                          {/* mapping rows */}
                          <div className="space-y-2">
                            <AnimatePresence initial={false}>
                              {draft.payload_mapping.map((row, idx) => (
                                <motion.div
                                  key={`map-${idx}`}
                                  layout
                                  initial={{ opacity: 0, y: 6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -6 }}
                                  transition={{ duration: 0.18 }}
                                  className="grid gap-2 md:grid-cols-[minmax(0,1fr)_130px_minmax(0,1fr)_100px_auto]"
                                >
                                  <input
                                    className={inputClass}
                                    placeholder="Outbound key"
                                    value={row.key}
                                    onChange={(e) =>
                                      setDraft((prev) => ({
                                        ...prev,
                                        payload_mapping:
                                          prev.payload_mapping.map((m, i) =>
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
                                      const vs = e.target.value as
                                        | "field"
                                        | "static";
                                      setDraft((prev) => ({
                                        ...prev,
                                        payload_mapping:
                                          prev.payload_mapping.map((m, i) =>
                                            i === idx
                                              ? {
                                                  ...m,
                                                  value_source: vs,
                                                  field_name:
                                                    vs === "field"
                                                      ? (m.field_name ?? "")
                                                      : undefined,
                                                  static_value:
                                                    vs === "static"
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
                                        setDraft((prev) => ({
                                          ...prev,
                                          payload_mapping:
                                            prev.payload_mapping.map((m, i) =>
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
                                        <option
                                          key={cf.id}
                                          value={cf.field_name}
                                        >
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
                                        setDraft((prev) => ({
                                          ...prev,
                                          payload_mapping:
                                            prev.payload_mapping.map((m, i) =>
                                              i === idx
                                                ? {
                                                    ...m,
                                                    static_value:
                                                      e.target.value,
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
                                      setDraft((prev) => ({
                                        ...prev,
                                        payload_mapping:
                                          prev.payload_mapping.map((m, i) =>
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
                                    <option value="query">Query</option>
                                    <option value="body">Body</option>
                                  </select>
                                  <button
                                    type="button"
                                    className="flex items-center justify-center rounded p-1.5 text-[--color-text-muted] hover:text-red-500 disabled:opacity-30 transition-colors"
                                    onClick={() =>
                                      setDraft((prev) => ({
                                        ...prev,
                                        payload_mapping:
                                          prev.payload_mapping.filter(
                                            (_, i) => i !== idx,
                                          ),
                                      }))
                                    }
                                    disabled={draft.payload_mapping.length <= 1}
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
                              setDraft((prev) => ({
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

                        {/* payload preview */}
                        {payloadPreview && (
                          <div className="space-y-2 rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-3">
                            {payloadPreview.queryEntries.length > 0 && (
                              <details
                                className="rounded-md border border-[--color-border] bg-[--color-panel]"
                                open
                              >
                                <summary className="cursor-pointer px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
                                  Expected URL with Query Params
                                </summary>
                                <div className="border-t border-[--color-border] p-3">
                                  <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[--color-text]">
                                    {payloadPreview.queryPreviewUrl}
                                  </pre>
                                </div>
                              </details>
                            )}
                            {payloadPreview.bodyLines && (
                              <details
                                className="rounded-md border border-[--color-border] bg-[--color-panel]"
                                open={payloadPreview.queryEntries.length === 0}
                              >
                                <summary className="cursor-pointer px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
                                  Expected Payload Preview
                                </summary>
                                <div className="border-t border-[--color-border] p-3">
                                  <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[--color-text]">
                                    {payloadPreview.bodyLines.join("\n")}
                                  </pre>
                                </div>
                              </details>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* ── Response Validation view ────────────────────────── */
                      <div className="space-y-4">
                        <div className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] px-3 py-2.5">
                          <div className="flex items-start gap-2">
                            <Info
                              size={13}
                              className="mt-0.5 shrink-0 text-[--color-primary]"
                            />
                            <div className="text-[11px] text-[--color-text-muted]">
                              <p>
                                Rules are evaluated top-to-bottom with
                                <strong> OR</strong> semantics. First match
                                wins.
                              </p>
                              <p className="mt-1">
                                Match examples: <strong>approved</strong>,{" "}
                                <strong>result:ok</strong>,{" "}
                                <strong>status:200</strong>,{" "}
                                <strong>status:2xx</strong>,{" "}
                                <strong>status:&gt;=400</strong>. XML response
                                text and leaf nodes are also matched.
                              </p>
                            </div>
                          </div>
                        </div>

                        {!primaryDestination && (
                          <p className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] px-3 py-6 text-center text-xs text-[--color-text-muted]">
                            Select or create a primary destination first.
                          </p>
                        )}

                        {primaryDestination && !primaryIsWebhook && (
                          <p className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] px-3 py-6 text-center text-xs text-[--color-text-muted]">
                            Primary destination "{primaryDestination.name}" is
                            not a webhook. Response validation is disabled; use
                            non-webhook Sold/Rejected behavior on the primary.
                          </p>
                        )}

                        {primaryDestination && primaryIsWebhook && (
                          <>
                            <div className="rounded-md border border-[--color-border] bg-[--color-panel] px-3 py-2 text-[11px] text-[--color-text-muted]">
                              Validation is linked to primary destination:{" "}
                              <span className="font-semibold text-[--color-text]">
                                {primaryDestination.name}
                              </span>
                            </div>

                            {/* rules */}
                            <AnimatePresence initial={false}>
                              {rvRules.map((rule, ri) => (
                                <motion.div
                                  key={`rule-${ri}`}
                                  layout
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -8 }}
                                  transition={{ duration: 0.18 }}
                                >
                                  {ri > 0 && (
                                    <div className="flex items-center gap-3 py-2">
                                      <div className="flex-1 border-t border-[--color-border]" />
                                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-[--color-text-muted]">
                                        OR
                                      </span>
                                      <div className="flex-1 border-t border-[--color-border]" />
                                    </div>
                                  )}
                                  <div className="rounded-xl border border-[--color-border] border-l-[3px] border-l-blue-400 pl-4 pr-3 py-3">
                                    <div className="grid gap-2 md:grid-cols-[180px_minmax(0,1fr)_110px_auto]">
                                      <div className="flex items-center rounded-md border border-[--color-border] bg-[--color-bg-muted] px-2.5 text-[11px] text-[--color-text-muted]">
                                        {primaryDestination.name}
                                      </div>

                                      <input
                                        className={inputClass}
                                        placeholder="approved | result:ok | status:2xx"
                                        value={rule.match_value}
                                        onChange={(e) =>
                                          setRvRules((prev) =>
                                            prev.map((r, idx) =>
                                              idx === ri
                                                ? {
                                                    ...r,
                                                    destination_id:
                                                      primaryDestinationId,
                                                    match_value: e.target.value,
                                                  }
                                                : r,
                                            ),
                                          )
                                        }
                                      />

                                      <button
                                        type="button"
                                        onClick={() =>
                                          setRvRules((prev) => {
                                            const current = prev[ri];
                                            if (!current) return prev;
                                            const nextAction =
                                              current.action === "passed"
                                                ? "failed"
                                                : "passed";

                                            if (nextAction === "failed") {
                                              const hasOtherPass = prev.some(
                                                (r, idx) =>
                                                  idx !== ri &&
                                                  r.action === "passed" &&
                                                  r.match_value.trim().length >
                                                    0,
                                              );
                                              if (!hasOtherPass) {
                                                toast.warning(
                                                  "Keep at least one PASS condition before marking this as FAILED.",
                                                );
                                                return prev;
                                              }
                                            }

                                            return prev.map((r, idx) =>
                                              idx === ri
                                                ? {
                                                    ...r,
                                                    destination_id:
                                                      primaryDestinationId,
                                                    action: nextAction,
                                                  }
                                                : r,
                                            );
                                          })
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
                                          {rule.action === "passed"
                                            ? "Pass"
                                            : "Fail"}
                                        </span>
                                      </button>

                                      <button
                                        type="button"
                                        className="flex items-center justify-center rounded p-1.5 text-[--color-text-muted] hover:text-red-500 transition-colors"
                                        onClick={() =>
                                          setRvRules((prev) =>
                                            prev.filter((_, idx) => idx !== ri),
                                          )
                                        }
                                        title="Remove rule"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </div>
                                </motion.div>
                              ))}
                            </AnimatePresence>

                            {rvRules.length === 0 && (
                              <p className="py-6 text-center text-xs text-[--color-text-muted]">
                                No rules yet. Add one below.
                              </p>
                            )}

                            {/* add rule */}
                            <button
                              type="button"
                              className="flex items-center gap-1 text-xs text-[--color-primary] hover:underline"
                              onClick={() =>
                                setRvRules((prev) => [
                                  ...prev,
                                  {
                                    destination_id: primaryDestinationId,
                                    match_value: "",
                                    action: hasAnyPassCondition
                                      ? ("failed" as const)
                                      : ("passed" as const),
                                  },
                                ])
                              }
                            >
                              <Plus size={12} />
                              Add rule
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* footer */}
              <div className="flex items-center justify-end gap-2 border-t border-[--color-border] px-4 py-3">
                <Button variant="ghost" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                {activeView === "destination"
                  ? (isNew || isDirty) && (
                      <Button
                        size="sm"
                        disabled={saving || !!saveDisabledReason}
                        onClick={handleSave}
                      >
                        {isNew ? "Create Destination" : "Save Destination"}
                      </Button>
                    )
                  : rvDirty && (
                      <Button
                        size="sm"
                        disabled={rvSaving}
                        onClick={handleSaveValidation}
                      >
                        Save Validation
                      </Button>
                    )}
              </div>
            </>
          ) : (
            /* ── empty state ─────────────────────────────────────────── */
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <Globe
                  size={32}
                  className="mx-auto mb-2 text-[--color-text-muted] opacity-40"
                />
                <p className="text-sm text-[--color-text-muted]">
                  No destinations configured.
                </p>
                <button
                  type="button"
                  onClick={handleAddNew}
                  className="mt-2 text-sm font-medium text-[--color-primary] hover:underline"
                >
                  + Add first destination
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
