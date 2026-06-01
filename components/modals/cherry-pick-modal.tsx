"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronRight, Cherry, AlertTriangle, X } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import {
  getEligibleContracts,
  executeCherryPick,
  updateLeadPickability,
  getEntityAudit,
} from "@/lib/api";
import type {
  Lead,
  EligibleContractEntry,
  SourceAffiliatePixelInfo,
  CriteriaField,
  Client,
  AuditLogItem,
} from "@/lib/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

// ─── Step types ───────────────────────────────────────────────────────────────

type Step = "payload" | "skippables" | "delivery";
const STEPS: { key: Step; label: string }[] = [
  { key: "payload", label: "Payload" },
  { key: "skippables", label: "Quality Checks" },
  { key: "delivery", label: "Delivery" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepIndicator({
  steps,
  current,
}: {
  steps: { key: Step; label: string }[];
  current: Step;
}) {
  const idx = steps.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center gap-0 mb-5">
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center flex-1 min-w-0">
          <div className="flex flex-col items-center flex-1">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
                i < idx
                  ? "bg-[--color-primary] text-white"
                  : i === idx
                    ? "bg-[--color-primary] text-white ring-4 ring-[--color-primary]/20"
                    : "bg-[--color-bg-muted] border border-[--color-border] text-[--color-text-muted]"
              }`}
            >
              {i < idx ? <Check size={11} /> : i + 1}
            </div>
            <span
              className={`mt-1 text-[10px] font-medium text-center whitespace-nowrap ${
                i === idx
                  ? "text-[--color-text-strong]"
                  : "text-[--color-text-muted]"
              }`}
            >
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`h-px flex-1 mx-1 mb-4 transition-colors ${
                i < idx ? "bg-[--color-primary]" : "bg-[--color-border]"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface CherryPickModalProps {
  isOpen: boolean;
  lead: Lead | null;
  /** Kept for compatibility with existing call sites */
  criteriaFields?: CriteriaField[];
  onClose: () => void;
  /** Called after a successful cherry-pick so the parent can refresh the lead list */
  onSuccess: (leadId: string) => void;
}

export function CherryPickModal({
  isOpen,
  lead,
  criteriaFields: _criteriaFields = [],
  onClose,
  onSuccess,
}: CherryPickModalProps) {
  const [step, setStep] = useState<Step>("payload");

  // ── Step 1: payload ───────────────────────────────────────────────────────
  const [localPayload, setLocalPayload] = useState<Record<string, string>>({});
  const [removedKeys, setRemovedKeys] = useState<Set<string>>(new Set());
  const [editingField, setEditingField] = useState<string | null>(null);
  const [notPickable, setNotPickable] = useState(false);
  const [markingPickable, setMarkingPickable] = useState(false);

  // ── Step 2: skippables ────────────────────────────────────────────────────
  const [skipTrustedForm, setSkipTrustedForm] = useState(false);
  const [skipDuplicate, setSkipDuplicate] = useState(false);
  const [skipIpqsPhone, setSkipIpqsPhone] = useState(false);
  const [skipIpqsEmail, setSkipIpqsEmail] = useState(false);
  const [skipIpqsIp, setSkipIpqsIp] = useState(false);

  // ── Step 3: delivery ──────────────────────────────────────────────────────
  const [eligibleContracts, setEligibleContracts] = useState<
    EligibleContractEntry[]
  >([]);
  const [sourceAffiliatePixel, setSourceAffiliatePixel] =
    useState<SourceAffiliatePixelInfo | null>(null);
  const [fireAffiliatePixel, setFireAffiliatePixel] = useState(false);
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [contractsLoaded, setContractsLoaded] = useState(false);
  const [contractSearch, setContractSearch] = useState("");
  const [selectedContractId, setSelectedContractId] = useState("");
  const [executing, setExecuting] = useState(false);

  // Fetch audit log for the lead (authoritative source for edited fields)
  const { data: auditItems = [] } = useSWR<AuditLogItem[]>(
    isOpen && lead ? ["entity-audit", lead.id] : null,
    async () => {
      const res = await getEntityAudit(lead!.id, { limit: 100 });
      return res?.data?.items ?? [];
    },
  );

  // Reset state when modal opens on a different lead
  useEffect(() => {
    if (!isOpen || !lead) return;
    setStep("payload");
    setRemovedKeys(new Set());
    setEditingField(null);
    setNotPickable(lead.cherry_pickable === false);
    setSkipTrustedForm(false);
    setSkipDuplicate(false);
    setSkipIpqsPhone(false);
    setSkipIpqsEmail(false);
    setSkipIpqsIp(false);
    setFireAffiliatePixel(false);
    setEligibleContracts([]);
    setContractsLoaded(false);
    setContractSearch("");
    setSourceAffiliatePixel(null);
    setSelectedContractId("");

    const initP: Record<string, string> = {};
    Object.entries(lead.payload || {}).forEach(([k, v]) => {
      initP[k] = typeof v === "object" ? JSON.stringify(v) : String(v ?? "");
    });
    setLocalPayload(initP);
  }, [isOpen, lead?.id]);

  if (!lead) return null;

  // Build map of fields that already have saved edits (from audit log — authoritative)
  // key = fieldName, value = earliest previous_value (the original intake value)
  const historyEdited: Record<string, string> = {};
  [...auditItems]
    .sort(
      (a, b) =>
        new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime(),
    )
    .forEach((item) => {
      (item.changes ?? [])
        .filter((c) => c.field.startsWith("payload."))
        .forEach((c) => {
          const fn = c.field.slice(8); // "payload.state" → "state"
          if (!historyEdited[fn]) {
            historyEdited[fn] =
              typeof c.from === "string" ? c.from : String(c.from ?? "");
          }
        });
    });

  const originalPayload = Object.fromEntries(
    Object.entries(lead.payload || {}).map(([k, v]) => [
      k,
      typeof v === "object" ? JSON.stringify(v) : String(v ?? ""),
    ]),
  );

  const visiblePayloadKeys = Object.keys(originalPayload).filter(
    (k) => !removedKeys.has(k),
  );

  // ── fetch eligible contracts when entering delivery step ─────────────────
  // SWR-style key shape: ["cherry-pick-eligible-contracts", lead.id]. We keep
  // useState here (not useSWR) because the fetch is gated on entering step 3,
  // but we mirror the SWR conventions: no auto refetch, gate loading UI by
  // (loading && data.length === 0).
  const loadEligibleContracts = async () => {
    if (contractsLoaded) return;
    setLoadingContracts(true);
    try {
      const res = await getEligibleContracts(lead.id);
      if (res.success) {
        const items: EligibleContractEntry[] = res.data?.contracts ?? [];
        setEligibleContracts(items);
        setSourceAffiliatePixel(res.data?.source_affiliate_pixel ?? null);
        if (items.length === 1) {
          setSelectedContractId(items[0].contract_id);
        }
      }
    } catch {
      toast.error("Could not load eligible contracts.");
    } finally {
      setLoadingContracts(false);
      setContractsLoaded(true);
    }
  };

  const goNext = async () => {
    if (step === "payload") {
      // If user toggled "not cherry-pickable", save that first
      if (notPickable && lead.cherry_pickable !== false) {
        setMarkingPickable(true);
        try {
          await updateLeadPickability(lead.id, false);
          toast.success("Lead marked as not cherry-pickable.");
          onSuccess(lead.id);
          onClose();
          return;
        } catch {
          toast.error("Failed to update pickability.");
        } finally {
          setMarkingPickable(false);
        }
        return;
      }
      // If user re-enabled cherry-picking (was false, now unchecked)
      if (!notPickable && lead.cherry_pickable === false) {
        setMarkingPickable(true);
        try {
          await updateLeadPickability(lead.id, true);
          toast.success("Lead re-enabled for cherry-picking.");
          onSuccess(lead.id);
          onClose();
          return;
        } catch {
          toast.error("Failed to update pickability.");
        } finally {
          setMarkingPickable(false);
        }
        return;
      }
      setStep("skippables");
    } else if (step === "skippables") {
      setStep("delivery");
      await loadEligibleContracts();
    }
  };

  const goPrev = () => {
    if (step === "skippables") setStep("payload");
    else if (step === "delivery") setStep("skippables");
  };

  const handleExecute = async () => {
    if (!selectedContractId) {
      toast.error("Please select a destination contract.");
      return;
    }
    setExecuting(true);
    try {
      const payloadOverrides: Record<string, unknown> = {};
      visiblePayloadKeys.forEach((k) => {
        const nextValue = localPayload[k] ?? originalPayload[k];
        if (nextValue !== originalPayload[k]) {
          payloadOverrides[k] = nextValue;
        }
      });
      const removedPayloadFields = [...removedKeys];

      const selectedEntry = (eligibleContracts ?? []).find(
        (c) => c.contract_id === selectedContractId,
      );

      const res = await executeCherryPick(lead.id, {
        target_contract_id: selectedContractId,
        campaign_id: selectedEntry?.campaign_id,
        fire_affiliate_pixel: fireAffiliatePixel,
        skip_trusted_form_claim: skipTrustedForm || undefined,
        skip_duplicate_check: skipDuplicate || undefined,
        skip_ipqs_phone: skipIpqsPhone || undefined,
        skip_ipqs_email: skipIpqsEmail || undefined,
        skip_ipqs_ip: skipIpqsIp || undefined,
        payload_overrides:
          Object.keys(payloadOverrides).length > 0
            ? payloadOverrides
            : undefined,
        removed_payload_fields:
          removedPayloadFields.length > 0 ? removedPayloadFields : undefined,
      });

      if (res.success) {
        const accepted = res.data?.delivery_result?.accepted;
        if (accepted) {
          toast.success("Cherry-pick delivered and accepted.");
        } else {
          toast.warning(
            "Cherry-pick delivered but the destination did not accept the lead.",
          );
        }
        onSuccess(lead.id);
        onClose();
      } else {
        toast.error((res as any).message || "Cherry-pick failed.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Cherry-pick failed.");
    } finally {
      setExecuting(false);
    }
  };

  // ── IPQS flag helpers ──────────────────────────────────────────────────────
  const ipqsResult = lead.ipqs_result;
  const ipqsPhoneFailed =
    ipqsResult?.phone != null && ipqsResult.phone.success === false;
  const ipqsEmailFailed =
    ipqsResult?.email != null && ipqsResult.email.success === false;
  const ipqsIpFailed =
    ipqsResult?.ip != null && ipqsResult.ip.success === false;
  const tfFailed =
    lead.trusted_form_result != null &&
    lead.trusted_form_result.success === false;
  const isDuplicate = lead.duplicate === true;

  const selectedEntry = (eligibleContracts ?? []).find(
    (c) => c.contract_id === selectedContractId,
  );

  // Filter contracts by search term (contract / buyer / campaign name).
  const normalizedSearch = contractSearch.trim().toLowerCase();
  const filteredContracts = normalizedSearch
    ? eligibleContracts.filter((c) => {
        const haystack = [c.contract_name, c.end_user_name, c.campaign_name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedSearch);
      })
    : eligibleContracts;

  // Source campaign name (best-effort): if any contract reports the lead's
  // source campaign, use its name; otherwise fall back to the campaign id.
  const sourceCampaignFromContracts = eligibleContracts.find(
    (c) => c.campaign_id === lead.campaign_id,
  );
  const sourceCampaignDisplay =
    sourceCampaignFromContracts?.campaign_name || lead.campaign_id;

  const isCrossCampaign =
    !!selectedEntry && selectedEntry.campaign_id !== lead.campaign_id;

  return (
    <Modal
      title="Cherry-Pick Lead"
      isOpen={isOpen}
      onClose={onClose}
      width={740}
      bodyClassName="px-5 py-4 h-[660px] overflow-y-auto"
    >
      <div className="space-y-0">
        <StepIndicator steps={STEPS} current={step} />

        <AnimatePresence mode="wait" initial={false}>
          {/* ── Step 1: Payload ──────────────────────────────────────────── */}
          {step === "payload" && (
            <motion.div
              key="step-payload"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="space-y-4 text-sm"
            >
              {/* Not cherry-pickable toggle */}
              <div className="flex items-start gap-3 rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-3">
                <input
                  id="not-pickable"
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-rose-500"
                  checked={notPickable}
                  onChange={(e) => setNotPickable(e.target.checked)}
                />
                <label
                  htmlFor="not-pickable"
                  className="cursor-pointer text-[11px] leading-relaxed"
                >
                  <span className="font-semibold text-rose-600 dark:text-rose-400">
                    {lead.cherry_pickable === false && !notPickable
                      ? "Cherry-picking is currently disabled for this lead"
                      : "Mark as not cherry-pickable"}
                  </span>
                  <span className="block text-[--color-text-muted] mt-0.5">
                    {lead.cherry_pickable === false
                      ? notPickable
                        ? "Uncheck to re-enable cherry-picking for this lead."
                        : "Saving will re-enable this lead for cherry-picking."
                      : notPickable
                        ? "Saving will exclude this lead from future cherry-pick attempts."
                        : "Exclude this lead from future cherry-pick attempts. You can reverse this later."}
                  </span>
                </label>
              </div>

              {notPickable && lead.cherry_pickable !== false ? (
                <p className="text-[11px] text-[--color-text-muted]">
                  Saving will mark this lead as not cherry-pickable and close
                  the dialog.
                </p>
              ) : !notPickable && lead.cherry_pickable === false ? (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                  Saving will re-enable cherry-picking for this lead and close
                  the dialog.
                </p>
              ) : notPickable && lead.cherry_pickable === false ? (
                <p className="text-[11px] text-[--color-text-muted]">
                  This lead is currently excluded from cherry-picking. Uncheck
                  the box above to re-enable it.
                </p>
              ) : (
                <>
                  {/* Payload editor */}
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-[--color-text-muted] font-semibold">
                      Payload
                    </p>
                    <p className="text-[11px] text-[--color-text-muted]">
                      Remove or edit fields before delivery. Removed fields
                      won't be sent.
                    </p>
                  </div>
                  <div className="space-y-1.5 pr-0.5">
                    {visiblePayloadKeys.length === 0 && (
                      <p className="text-[11px] text-[--color-text-muted]">
                        All fields removed.
                      </p>
                    )}
                    {visiblePayloadKeys.map((key) => {
                      const locallyEdited =
                        localPayload[key] !== originalPayload[key];
                      const hasHistory = historyEdited[key] !== undefined;
                      const edited = locallyEdited || hasHistory;
                      // Show prev→current display when field has history, not locally
                      // modified, and not currently focused for editing
                      const showDisplayChip =
                        hasHistory && !locallyEdited && editingField !== key;
                      return (
                        <div
                          key={key}
                          className={`grid grid-cols-[120px_1fr_auto] items-center gap-2 rounded-md px-2 py-1.5 ${
                            edited
                              ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
                              : "bg-[--color-bg-muted] border border-[--color-border]"
                          }`}
                        >
                          <span
                            className="font-mono text-[10px] truncate text-[--color-text-muted]"
                            title={key}
                          >
                            {key}
                          </span>
                          {showDisplayChip ? (
                            <button
                              type="button"
                              className="min-w-0 text-left text-[11px] rounded px-1 py-0.5 hover:bg-amber-100 dark:hover:bg-amber-800/30 transition-colors"
                              onClick={() => setEditingField(key)}
                            >
                              <span className="text-[--color-text-muted] line-through mr-1">
                                {historyEdited[key] || "—"}
                              </span>
                              <span className="text-[--color-text-muted] mx-1">
                                →
                              </span>
                              <span className="text-[--color-text] font-medium">
                                {localPayload[key] ?? ""}
                              </span>
                            </button>
                          ) : (
                            <input
                              className="min-w-0 bg-transparent text-[11px] text-[--color-text] focus:outline-none focus:ring-1 focus:ring-[--color-primary] rounded px-1 py-0.5"
                              value={localPayload[key] ?? ""}
                              autoFocus={editingField === key}
                              onChange={(e) =>
                                setLocalPayload((prev) => ({
                                  ...prev,
                                  [key]: e.target.value,
                                }))
                              }
                              onBlur={() => {
                                if (editingField === key) setEditingField(null);
                              }}
                            />
                          )}
                          <button
                            type="button"
                            title="Remove field"
                            onClick={() =>
                              setRemovedKeys((prev) => new Set([...prev, key]))
                            }
                            className="shrink-0 p-0.5 text-[--color-text-muted] hover:text-rose-500 transition-colors"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      );
                    })}
                    {/* Removed keys — allow restoring */}
                    {[...removedKeys].map((key) => (
                      <div
                        key={`removed-${key}`}
                        className="grid grid-cols-[120px_1fr_auto] items-center gap-2 rounded-md px-2 py-1.5 opacity-40 border border-dashed border-[--color-border]"
                      >
                        <span
                          className="font-mono text-[10px] truncate text-[--color-text-muted] line-through"
                          title={key}
                        >
                          {key}
                        </span>
                        <span className="text-[11px] text-[--color-text-muted] italic">
                          removed
                        </span>
                        <button
                          type="button"
                          title="Restore field"
                          onClick={() =>
                            setRemovedKeys((prev) => {
                              const next = new Set(prev);
                              next.delete(key);
                              return next;
                            })
                          }
                          className="shrink-0 p-0.5 text-[--color-primary] hover:opacity-70 transition-opacity"
                        >
                          <ChevronRight size={12} className="rotate-180" />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="flex justify-end pt-2 border-t border-[--color-border]">
                <Button
                  size="sm"
                  disabled={
                    markingPickable ||
                    (notPickable && lead.cherry_pickable === false)
                  }
                  onClick={goNext}
                >
                  {markingPickable
                    ? "Saving…"
                    : notPickable && lead.cherry_pickable !== false
                      ? "Save — Exclude Lead"
                      : !notPickable && lead.cherry_pickable === false
                        ? "Save — Re-enable"
                        : "Next — Quality Checks"}
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── Step 2: Skippables ───────────────────────────────────────── */}
          {step === "skippables" && (
            <motion.div
              key="step-skippables"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="space-y-4 text-sm"
            >
              <p className="text-[11px] text-[--color-text-muted]">
                Review the quality check results for this lead. Toggle any gates
                you want to bypass for this cherry-pick.
              </p>

              <div className="space-y-2">
                {/* Duplicate check */}
                <SkippableRow
                  label="Duplicate check"
                  failed={isDuplicate}
                  failureNote={
                    isDuplicate
                      ? `This lead is flagged as a duplicate of ${(lead.duplicate_matches?.lead_ids ?? []).length} other lead(s).`
                      : undefined
                  }
                  passNote="No duplicate detected."
                  checked={skipDuplicate}
                  onChange={setSkipDuplicate}
                />

                {/* TrustedForm */}
                <SkippableRow
                  label="TrustedForm claim"
                  failed={tfFailed}
                  failureNote={
                    tfFailed
                      ? `TrustedForm verification failed. The delivery config may re-attempt claiming — skip to prevent that.`
                      : undefined
                  }
                  passNote={
                    lead.trusted_form_result == null
                      ? "No TrustedForm check on this lead."
                      : "TrustedForm verified OK."
                  }
                  checked={skipTrustedForm}
                  onChange={setSkipTrustedForm}
                  alwaysShowToggle
                  toggleLabel="Skip TF claim during delivery"
                />

                {/* IPQS: phone */}
                <SkippableRow
                  label="IPQS — Phone"
                  failed={ipqsPhoneFailed}
                  failureNote={
                    ipqsPhoneFailed ? "Phone IPQS check failed." : undefined
                  }
                  passNote={
                    ipqsResult?.phone == null
                      ? "Phone not checked."
                      : "Phone IPQS OK."
                  }
                  checked={skipIpqsPhone}
                  onChange={setSkipIpqsPhone}
                />

                {/* IPQS: email */}
                <SkippableRow
                  label="IPQS — Email"
                  failed={ipqsEmailFailed}
                  failureNote={
                    ipqsEmailFailed ? "Email IPQS check failed." : undefined
                  }
                  passNote={
                    ipqsResult?.email == null
                      ? "Email not checked."
                      : "Email IPQS OK."
                  }
                  checked={skipIpqsEmail}
                  onChange={setSkipIpqsEmail}
                />

                {/* IPQS: IP */}
                <SkippableRow
                  label="IPQS — IP Address"
                  failed={ipqsIpFailed}
                  failureNote={
                    ipqsIpFailed ? "IP IPQS check failed." : undefined
                  }
                  passNote={
                    ipqsResult?.ip == null ? "IP not checked." : "IP IPQS OK."
                  }
                  checked={skipIpqsIp}
                  onChange={setSkipIpqsIp}
                />
              </div>

              <div className="flex justify-between pt-2 border-t border-[--color-border]">
                <Button variant="ghost" size="sm" onClick={goPrev}>
                  Back
                </Button>
                <Button size="sm" onClick={goNext}>
                  Next — Delivery
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── Step 3: Delivery ─────────────────────────────────────────── */}
          {step === "delivery" && (
            <motion.div
              key="step-delivery"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="space-y-4 text-sm"
            >
              {/* Contract picker */}
              <div className="space-y-1.5" data-testid="contract-picker">
                <p className="text-xs uppercase tracking-wide text-[--color-text-muted] font-semibold">
                  Destination Contract
                </p>

                {loadingContracts && eligibleContracts.length === 0 ? (
                  <p className="text-[11px] text-[--color-text-muted]">
                    Loading eligible contracts…
                  </p>
                ) : eligibleContracts.length === 0 ? (
                  <p
                    className="text-[11px] text-rose-500"
                    data-testid="contracts-empty"
                  >
                    No active contracts available. Create or activate a contract
                    before cherry-picking.
                  </p>
                ) : (
                  <>
                    <input
                      type="search"
                      placeholder="Filter by contract, buyer, or campaign…"
                      className="w-full rounded-lg border border-[--color-border] bg-[--color-bg] px-3 py-2 text-[12px] text-[--color-text] focus:outline-none focus:ring-2 focus:ring-[--color-primary]/40"
                      value={contractSearch}
                      onChange={(e) => setContractSearch(e.target.value)}
                    />

                    <div
                      role="radiogroup"
                      aria-label="Destination contract"
                      className="max-h-[260px] overflow-y-auto rounded-lg border border-[--color-border] divide-y divide-[--color-border]"
                    >
                      {filteredContracts.length === 0 ? (
                        <p className="text-[11px] text-[--color-text-muted] px-3 py-2">
                          No contracts match “{contractSearch}”.
                        </p>
                      ) : (
                        filteredContracts.map((c) => {
                          const checked = selectedContractId === c.contract_id;
                          const status = (
                            c.campaign_status || ""
                          ).toUpperCase();
                          const showStatusPill =
                            status !== "" && status !== "ACTIVE";
                          return (
                            <label
                              key={c.contract_id}
                              className={`flex items-start gap-2.5 px-3 py-2 cursor-pointer transition-colors ${
                                checked
                                  ? "bg-[--color-primary]/10"
                                  : "hover:bg-[--color-bg-muted]"
                              }`}
                            >
                              <input
                                type="radio"
                                name="cherry-pick-contract"
                                className="mt-1 h-3.5 w-3.5 accent-[--color-primary]"
                                value={c.contract_id}
                                checked={checked}
                                onChange={() =>
                                  setSelectedContractId(c.contract_id)
                                }
                              />
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <div className="flex items-center flex-wrap gap-1.5">
                                  <span className="text-[12px] font-medium text-[--color-text-strong] truncate">
                                    {c.contract_name}
                                  </span>
                                  {showStatusPill && (
                                    <span
                                      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                                        status === "PAUSED"
                                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                          : status === "CLOSED"
                                            ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                                            : "bg-[--color-bg-muted] text-[--color-text-muted]"
                                      }`}
                                    >
                                      {status}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-[--color-text-muted] truncate">
                                  {c.end_user_name}
                                  {c.campaign_name
                                    ? ` · ${c.campaign_name}`
                                    : ""}
                                </p>
                                {c.delivery_url && (
                                  <p className="font-mono text-[10px] text-[--color-text-muted] truncate">
                                    {c.delivery_url}
                                  </p>
                                )}
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Cross-campaign delivery warning */}
              {isCrossCampaign && selectedEntry && (
                <div
                  className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300"
                  data-testid="cross-campaign-warning"
                  role="status"
                >
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  <span>
                    Cross-campaign delivery — lead source attribution stays on{" "}
                    <span className="font-semibold">
                      {sourceCampaignDisplay}
                    </span>
                    .
                  </span>
                </div>
              )}

              {/* Affiliate pixel control */}
              <div className="space-y-2 rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-3">
                <div className="flex items-start gap-2.5">
                  <input
                    id="fire-affiliate-pixel"
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-[--color-primary]"
                    checked={fireAffiliatePixel}
                    disabled={!sourceAffiliatePixel?.pixel_url}
                    onChange={(e) => setFireAffiliatePixel(e.target.checked)}
                  />
                  <label
                    htmlFor="fire-affiliate-pixel"
                    className="cursor-pointer text-[11px] leading-relaxed"
                  >
                    <span className="font-semibold text-[--color-text-strong]">
                      Fire source webhook for this cherry-pick
                    </span>
                    <span className="block text-[--color-text-muted] mt-0.5">
                      Default is OFF. The pixel only fires when this cherry-pick
                      is accepted by the destination end user.
                    </span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[--color-text-muted] font-semibold">
                      Source
                    </p>
                    <p className="font-mono text-[--color-text]">
                      {sourceAffiliatePixel?.affiliate_id ?? "Not resolved"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[--color-text-muted] font-semibold">
                      Source Campaign
                    </p>
                    <p className="font-mono text-[--color-text]">
                      {sourceAffiliatePixel?.campaign_id ?? "Not resolved"}
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wide text-[--color-text-muted] font-semibold">
                    Webhook Destination
                  </p>
                  {sourceAffiliatePixel?.pixel_url ? (
                    <p className="font-mono text-[11px] text-[--color-text] break-all rounded bg-[--color-bg] border border-[--color-border] px-2.5 py-1.5">
                      {sourceAffiliatePixel.pixel_method ?? "POST"}{" "}
                      {sourceAffiliatePixel.pixel_url}
                    </p>
                  ) : (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                      No source webhook destination is configured for this lead.
                      Webhook firing is unavailable.
                    </p>
                  )}
                </div>

                <p
                  className={`text-[11px] font-medium ${
                    fireAffiliatePixel
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-[--color-text-muted]"
                  }`}
                >
                  Source webhook: {fireAffiliatePixel ? "ON" : "OFF"}
                </p>
              </div>

              <div className="flex justify-between pt-2 border-t border-[--color-border]">
                <Button variant="ghost" size="sm" onClick={goPrev}>
                  Back
                </Button>
                <Button
                  size="sm"
                  disabled={
                    executing || !selectedContractId || loadingContracts
                  }
                  onClick={handleExecute}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {executing ? (
                    "Sending…"
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Cherry size={13} />
                      Send Cherry-Pick
                    </span>
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  );
}

// ─── SkippableRow ─────────────────────────────────────────────────────────────

function SkippableRow({
  label,
  failed,
  failureNote,
  passNote,
  checked,
  onChange,
  alwaysShowToggle = false,
  toggleLabel,
}: {
  label: string;
  failed: boolean;
  failureNote?: string;
  passNote?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  alwaysShowToggle?: boolean;
  toggleLabel?: string;
}) {
  const showToggle = failed || alwaysShowToggle;
  return (
    <div
      className={`rounded-lg border px-3 py-2.5 space-y-1.5 ${
        failed
          ? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10"
          : "border-[--color-border] bg-[--color-bg-muted]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium text-[--color-text-strong]">
          {label}
        </span>
        {failed ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
            <AlertTriangle size={10} />
            Failed
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
            <Check size={10} />
            OK
          </span>
        )}
      </div>
      <p className="text-[11px] text-[--color-text-muted]">
        {failed ? failureNote : passNote}
      </p>
      {showToggle && (
        <label className="flex items-center gap-2 cursor-pointer text-[11px] text-[--color-text]">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-[--color-primary]"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
          />
          {toggleLabel ?? `Skip / acknowledge this issue`}
        </label>
      )}
    </div>
  );
}

// ─── Cherry-Pick History Modal ────────────────────────────────────────────────

export function CherryPickHistoryModal({
  isOpen,
  lead,
  clients,
  onClose,
}: {
  isOpen: boolean;
  lead: Lead | null;
  clients?: Client[];
  onClose: () => void;
}) {
  if (!lead?.cherry_pick_meta) return null;

  const meta = lead.cherry_pick_meta;
  const actor = meta.executed_by;
  const actorName =
    actor?.full_name ||
    [actor?.first_name, actor?.last_name].filter(Boolean).join(" ") ||
    actor?.username ||
    actor?.email ||
    "Unknown";

  const dr = meta.delivery_result;
  const accepted = dr?.accepted === true;
  const sentPayloadSnapshot = dr?.sent_payload_snapshot;
  const sentQueryParams =
    sentPayloadSnapshot?.query_params ?? dr?.sent_query_params;
  const sentBodyPayload =
    sentPayloadSnapshot?.body_payload ?? dr?.sent_body_payload;
  const deliveryClient = clients?.find((c) => c.id === dr?.client_id);
  const configuredWebhookUrl =
    sentPayloadSnapshot?.configured_webhook_url ?? dr?.webhook_url;
  const hasSentQueryParams =
    sentQueryParams != null && Object.keys(sentQueryParams).length > 0;
  const hasSentBodyPayload =
    sentBodyPayload != null && Object.keys(sentBodyPayload).length > 0;

  return (
    <Modal
      title={
        <div>
          <p className="text-lg font-semibold text-[--color-text-strong]">
            Cherry-Pick Record
          </p>
          <p className="text-xs font-normal text-[--color-text-muted] mt-0.5">
            Delivery details for this lead
          </p>
        </div>
      }
      isOpen={isOpen}
      onClose={onClose}
      width={540}
    >
      <div className="space-y-4 text-sm">
        {/* Outcome badge */}
        <div
          className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold ${
            accepted
              ? "bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-600 dark:text-emerald-300"
              : "bg-rose-50 border-rose-300 text-rose-700 dark:bg-rose-950/60 dark:border-rose-600 dark:text-rose-300"
          }`}
        >
          <Cherry size={14} />
          <span>
            {accepted ? "Accepted by end user" : "Rejected by end user"}
          </span>
          {dr?.acceptance_match && (
            <span className="ml-auto rounded border border-current/30 px-1.5 py-0.5 font-mono text-[11px] font-semibold">
              matched: {dr.acceptance_match}
            </span>
          )}
        </div>

        {/* Who / when */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wide text-[--color-text-muted] font-semibold">
              Executed by
            </p>
            <p className="text-[--color-text]">{actorName}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wide text-[--color-text-muted] font-semibold">
              Executed at
            </p>
            <p className="text-[--color-text]">
              {new Date(meta.executed_at).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Sent to */}
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-[--color-text-muted] font-semibold">
            Sent to
          </p>
          <p className="text-[--color-text]">
            {deliveryClient?.name ?? meta.target_contract_id}
          </p>
        </div>

        {/* Webhook details */}
        {dr && (
          <div className="space-y-3 rounded-lg border border-[--color-border] bg-[--color-bg] p-3">
            <div className="flex items-center gap-2">
              <span className="rounded bg-[--color-bg] border border-[--color-border] px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-[--color-text-muted]">
                {dr.webhook_method}
              </span>
              <span className="font-mono text-[11px] text-[--color-text] break-all">
                {configuredWebhookUrl}
              </span>
            </div>
            {(hasSentQueryParams || hasSentBodyPayload) && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wide text-[--color-text-muted] font-semibold">
                  Sent Payload
                </p>
                {hasSentQueryParams && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-[--color-text-muted] uppercase tracking-wide">
                      Query Params
                    </p>
                    <pre className="max-h-28 overflow-y-auto rounded border border-[--color-border] bg-[--color-bg-muted] px-2.5 py-2 font-mono text-[11px] text-[--color-text] whitespace-pre-wrap break-all">
                      {JSON.stringify(sentQueryParams, null, 2)}
                    </pre>
                  </div>
                )}
                {hasSentBodyPayload && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold text-[--color-text-muted] uppercase tracking-wide">
                      Body
                    </p>
                    <pre className="max-h-28 overflow-y-auto rounded border border-[--color-border] bg-[--color-bg-muted] px-2.5 py-2 font-mono text-[11px] text-[--color-text] whitespace-pre-wrap break-all">
                      {JSON.stringify(sentBodyPayload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
            {dr.webhook_response_status != null && (
              <div className="flex items-center gap-2">
                <p className="text-[10px] uppercase tracking-wide text-[--color-text-muted] font-semibold">
                  Response status
                </p>
                <span
                  className={`font-mono text-xs font-semibold ${
                    dr.webhook_response_status >= 200 &&
                    dr.webhook_response_status < 300
                      ? "text-emerald-600"
                      : "text-rose-500"
                  }`}
                >
                  {dr.webhook_response_status}
                </span>
              </div>
            )}
            {dr.webhook_response_body && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wide text-[--color-text-muted] font-semibold">
                  Response body
                </p>
                <pre className="max-h-32 overflow-y-auto rounded border border-[--color-border] bg-[--color-bg-muted] px-2.5 py-2 font-mono text-[11px] text-[--color-text] whitespace-pre-wrap break-all">
                  {dr.webhook_response_body}
                </pre>
              </div>
            )}
            {dr.error && (
              <p className="text-[11px] text-rose-500">Error: {dr.error}</p>
            )}
          </div>
        )}

        <div className="flex justify-end pt-1 border-t border-[--color-border]">
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
