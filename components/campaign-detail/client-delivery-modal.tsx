"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Globe, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import type { CriteriaField, Destination } from "@/lib/types";
import {
  listDestinations,
  addDestination,
  updateDestination,
  deleteDestination,
} from "@/lib/api";

/* ── helpers ──────────────────────────────────────────────────────────────── */

function emptyDestinationDraft(): Omit<Destination, "id"> {
  return {
    name: "",
    type: "webhook",
    url: "",
    method: "POST",
    payload_mapping: [
      { key: "", value_source: "field", field_name: "", parameter_target: "body" },
    ],
    acceptance_rules: [{ match_value: "", action: "passed" }],
    is_primary: false,
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
  const [editTab, setEditTab] = useState<"request" | "response">("request");
  const [saving, setSaving] = useState(false);
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [isNew, setIsNew] = useState(false);

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

  useEffect(() => {
    if (!isOpen) return;
    setSaveAttempted(false);
    setEditTab("request");
    setIsNew(false);
    fetchDestinations().then((items) => {
      if (items && items.length > 0) {
        setSelectedId(items[0].id);
        loadDraftFrom(items[0]);
      } else {
        setSelectedId(null);
        setDraft(emptyDestinationDraft());
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  /* ── load draft from destination ─────────────────────────────────────── */
  const loadDraftFrom = (d: Destination) => {
    setDraft({
      name: d.name,
      type: d.type,
      url: d.url,
      method: d.method,
      headers: d.headers,
      payload_mapping:
        d.payload_mapping.length > 0
          ? d.payload_mapping
          : [{ key: "", value_source: "field", field_name: "", parameter_target: "body" }],
      acceptance_rules:
        d.acceptance_rules.length > 0
          ? d.acceptance_rules
          : [{ match_value: "", action: "passed" }],
      is_primary: d.is_primary,
      state_mapping_override: d.state_mapping_override,
      claim_trusted_form: d.claim_trusted_form,
      require_successful_claim: d.require_successful_claim,
    });
    setSaveAttempted(false);
    setEditTab("request");
    setIsNew(false);
  };

  const selectedDest = useMemo(
    () => destinations.find((d) => d.id === selectedId) ?? null,
    [destinations, selectedId],
  );

  /* ── validation ──────────────────────────────────────────────────────── */
  const hasName = draft.name.trim().length > 0;
  const hasUrl = draft.url.trim().length > 0;
  const hasMappings =
    draft.payload_mapping.length > 0 &&
    draft.payload_mapping.every(
      (m) =>
        m.key.trim().length > 0 &&
        (m.value_source === "field"
          ? (m.field_name ?? "").trim().length > 0
          : String(m.static_value ?? "").trim().length > 0),
    );
  const hasRules =
    draft.acceptance_rules.length > 0 &&
    draft.acceptance_rules.every((r) => r.match_value.trim().length > 0);

  const saveDisabledReason = !hasName
    ? "Destination name is required."
    : !hasUrl
      ? "Destination URL is required."
      : !hasMappings
        ? "Complete all payload mapping rows."
        : !hasRules
          ? "Add at least one complete acceptance rule."
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
    setEditTab("request");
  };

  /* ── select existing ─────────────────────────────────────────────────── */
  const handleSelect = (d: Destination) => {
    setSelectedId(d.id);
    loadDraftFrom(d);
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
      acceptance_rules: draft.acceptance_rules.map((r) => ({
        match_value: r.match_value.trim(),
        action: r.action,
      })),
      is_primary: draft.is_primary,
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
        for (const entry of queryEntries) url.searchParams.set(entry.key, entry.value);
        queryPreviewUrl = url.toString();
      } catch {
        const query = queryEntries
          .map((e) => `${encodeURIComponent(e.key)}=${encodeURIComponent(e.value)}`)
          .join("&");
        queryPreviewUrl = query ? `${baseUrl}?${query}` : baseUrl;
      }
    }
    const bodyLines =
      bodyEntries.length > 0
        ? [
            "{",
            ...bodyEntries.map(
              (e, i) => `  "${e.key}": "${e.value}"${i < bodyEntries.length - 1 ? "," : ""}`,
            ),
            "}",
          ]
        : null;

    return { queryEntries, bodyEntries, queryPreviewUrl, bodyLines };
  }, [draft.payload_mapping, draft.url, criteriaFields]);

  /* ── render ──────────────────────────────────────────────────────────── */
  const showForm = isNew || selectedId;

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
                <p className="text-xs text-[--color-text-muted]">No destinations yet.</p>
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
                  selectedId === d.id && !isNew
                    ? "bg-[--color-primary]/10 text-[--color-primary] font-semibold"
                    : "text-[--color-text] hover:bg-[--color-border]/50"
                }`}
              >
                <Globe size={12} className="shrink-0 opacity-60" />
                <span className="min-w-0 flex-1 truncate">{d.name}</span>
                {d.is_primary && (
                  <Star size={11} className="shrink-0 fill-amber-400 text-amber-400" />
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
        </div>

        {/* ── main content ───────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col">
          {showForm ? (
            <>
              {/* tab bar + actions */}
              <div className="flex items-center gap-1 border-b border-[--color-border] px-4 pt-3 pb-2">
                {(
                  [
                    { key: "request" as const, label: "Delivery Request" },
                    { key: "response" as const, label: "Response Validation" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setEditTab(t.key)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                      editTab === t.key
                        ? "bg-[--color-primary] text-white"
                        : "text-[--color-text-muted] hover:text-[--color-text]"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}

                <div className="ml-auto flex items-center gap-2">
                  {!isNew && selectedDest && (
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((prev) => ({ ...prev, is_primary: !prev.is_primary }))
                      }
                      className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        draft.is_primary
                          ? "border-amber-400/40 bg-amber-400/10 text-amber-600"
                          : "border-[--color-border] text-[--color-text-muted] hover:border-amber-400/40"
                      }`}
                      title={
                        draft.is_primary
                          ? "This is the primary destination (determines sold status)"
                          : "Mark as primary"
                      }
                    >
                      <Star
                        size={11}
                        className={draft.is_primary ? "fill-amber-400 text-amber-400" : ""}
                      />
                      Primary
                    </button>
                  )}
                  {!isNew && selectedId && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Delete destination "${selectedDest?.name || selectedId}"?`)) {
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
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                {editTab === "request" ? (
                  <div className="space-y-3">
                    {/* destination name */}
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-[--color-text-muted]">
                        Destination Name <span className="text-red-500">*</span>
                      </span>
                      <input
                        className={`${inputClass} ${
                          saveAttempted && !hasName
                            ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/25"
                            : ""
                        }`}
                        value={draft.name}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, name: e.target.value }))
                        }
                        placeholder="e.g. Primary CRM Webhook"
                      />
                    </label>

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
                              method: e.target.value as Destination["method"],
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
                      <label className="space-y-1">
                        <span className="text-xs font-medium text-[--color-text-muted]">
                          Destination URL <span className="text-red-500">*</span>
                        </span>
                        <input
                          className={`${inputClass} ${
                            saveAttempted && !hasUrl
                              ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/25"
                              : ""
                          }`}
                          value={draft.url}
                          onChange={(e) =>
                            setDraft((prev) => ({ ...prev, url: e.target.value }))
                          }
                          placeholder="https://buyer.example.com/leads"
                        />
                      </label>
                    </div>

                    {/* payload mapping */}
                    <div
                      className={`space-y-2 rounded-lg border p-3 ${
                        saveAttempted && !hasMappings
                          ? "border-red-500/60"
                          : "border-[--color-border]"
                      }`}
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                        Payload Mapping <span className="text-red-500">*</span>
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
                                    payload_mapping: prev.payload_mapping.map(
                                      (m, i) =>
                                        i === idx ? { ...m, key: e.target.value } : m,
                                    ),
                                  }))
                                }
                              />
                              <select
                                className={inputClass}
                                value={row.value_source}
                                onChange={(e) => {
                                  const vs = e.target.value as "field" | "static";
                                  setDraft((prev) => ({
                                    ...prev,
                                    payload_mapping: prev.payload_mapping.map(
                                      (m, i) =>
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
                                      payload_mapping: prev.payload_mapping.map(
                                        (m, i) =>
                                          i === idx
                                            ? { ...m, field_name: e.target.value }
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
                                    setDraft((prev) => ({
                                      ...prev,
                                      payload_mapping: prev.payload_mapping.map(
                                        (m, i) =>
                                          i === idx
                                            ? { ...m, static_value: e.target.value }
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
                                  setDraft((prev) => ({
                                    ...prev,
                                    payload_mapping: prev.payload_mapping.filter(
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
                  /* ── Response Validation tab ──────────────────────────── */
                  <div className="space-y-3">
                    <div
                      className={`space-y-2 rounded-lg border p-3 ${
                        saveAttempted && !hasRules
                          ? "border-red-500/60"
                          : "border-[--color-border]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                            Acceptance Rules <span className="text-red-500">*</span>
                          </p>
                          <p className="mt-0.5 text-[11px] text-[--color-text-muted]">
                            Rules are evaluated as OR (first match wins). Matching is
                            case-insensitive.
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <AnimatePresence initial={false}>
                          {draft.acceptance_rules.map((rule, idx) => (
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
                                  setDraft((prev) => ({
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
                                  setDraft((prev) => ({
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
                                  setDraft((prev) => ({
                                    ...prev,
                                    acceptance_rules: prev.acceptance_rules.filter(
                                      (_, i) => i !== idx,
                                    ),
                                  }))
                                }
                                disabled={draft.acceptance_rules.length <= 1}
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
                          setDraft((prev) => ({
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

              {/* footer */}
              <div className="flex items-center justify-end gap-2 border-t border-[--color-border] px-4 py-3">
                <Button variant="ghost" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button size="sm" disabled={saving} onClick={handleSave}>
                  {isNew ? "Create Destination" : "Save Destination"}
                </Button>
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
