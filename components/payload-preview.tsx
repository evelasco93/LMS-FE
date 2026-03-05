"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Modal } from "@/components/modal";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { EditHistoryPopover, InfoItem } from "@/components/shared-ui";
import { updateLead } from "@/lib/api";
import { resolveDisplayName, inputClass } from "@/lib/utils";
import type { Lead } from "@/lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatUtcDateTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);
}

function formatLocalDateTimeWithZone(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

// ─── PayloadPreview ───────────────────────────────────────────────────────────

export function PayloadPreview({
  lead,
  allLeads,
}: {
  lead: Lead;
  allLeads: Lead[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"payload" | "quality-control">(
    "payload",
  );
  const [qualityTab, setQualityTab] =
    useState<"duplicate-check">("duplicate-check");
  const [selectedLead, setSelectedLead] = useState<Lead>(lead);
  const [localPayload, setLocalPayload] = useState<Record<string, string>>({});
  const originalPayloadRef = useRef<Record<string, string>>({});
  const [confirmSave, setConfirmSave] = useState(false);
  const [savingPayload, setSavingPayload] = useState(false);

  const setLeadQueryParams = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    Object.entries(next).forEach(([key, value]) => {
      if (value === undefined || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const currentLead = selectedLead;
  const entries = Object.entries(currentLead.payload || {});
  const duplicateLeadIds = currentLead.duplicate_matches?.lead_ids || [];
  const duplicateFailed = Boolean(currentLead.duplicate);

  useEffect(() => {
    const leadId = searchParams?.get("lead");
    if (!leadId) return;

    const targetLead = allLeads.find((item) => item.id === leadId);
    if (!targetLead || targetLead.id !== lead.id) return;

    setSelectedLead(targetLead);
    setIsOpen(true);
    const initP: Record<string, string> = {};
    Object.entries(targetLead.payload || {}).forEach(([k, v]) => {
      initP[k] = typeof v === "object" ? JSON.stringify(v) : String(v ?? "");
    });
    setLocalPayload(initP);
    originalPayloadRef.current = { ...initP };

    const tabParam = searchParams?.get("leadTab");
    if (tabParam === "payload" || tabParam === "quality-control") {
      setActiveTab(tabParam);
    }

    const qualityParam = searchParams?.get("leadQc");
    if (qualityParam === "duplicate-check") {
      setQualityTab("duplicate-check");
    }
  }, [allLeads, lead.id, searchParams]);

  const openPayload = () => {
    setSelectedLead(lead);
    setIsOpen(true);
    setActiveTab("payload");
    setQualityTab("duplicate-check");
    const initP: Record<string, string> = {};
    Object.entries(lead.payload || {}).forEach(([k, v]) => {
      initP[k] = typeof v === "object" ? JSON.stringify(v) : String(v ?? "");
    });
    setLocalPayload(initP);
    originalPayloadRef.current = { ...initP };
    setLeadQueryParams({
      view: undefined,
      campaign: undefined,
      section: undefined,
      affiliate: undefined,
      lead: lead.id,
      leadTab: "payload",
      leadQc: undefined,
    });
  };

  const closePayload = () => {
    setIsOpen(false);
    setActiveTab("payload");
    setQualityTab("duplicate-check");
    setSelectedLead(lead);
    setLocalPayload({});
    setConfirmSave(false);
    setLeadQueryParams({
      lead: undefined,
      leadTab: undefined,
      leadQc: undefined,
    });
  };

  const tabBtn = (label: string, onClick: () => void, active: boolean) => (
    <button
      type="button"
      onClick={onClick}
      aria-selected={active}
      role="tab"
      className={`border-b-2 px-1 py-2 text-sm font-medium transition ${
        active
          ? "border-[--color-primary] text-[--color-text-strong]"
          : "border-transparent text-[--color-text-muted] hover:text-[--color-text]"
      }`}
    >
      {label}
    </button>
  );

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="bg-[--color-primary] text-[--color-bg] hover:bg-[color-mix(in_srgb,var(--color-primary)_85%,black)]"
        onClick={openPayload}
      >
        View
      </Button>

      <Modal
        title="Lead Details"
        isOpen={isOpen}
        onClose={closePayload}
        width={720}
      >
        <div className="space-y-4 text-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <InfoItem label="Lead ID" value={currentLead.id} />
            <InfoItem label="Mode" value={currentLead.test ? "Test" : "Live"} />
            <InfoItem label="Campaign" value={currentLead.campaign_id} />
            <InfoItem label="Campaign Key" value={currentLead.campaign_key} />
            <InfoItem
              label="Affiliate Status at Intake"
              value={currentLead.affiliate_status_at_intake || "—"}
            />
            <InfoItem
              label="Created (UTC)"
              value={formatUtcDateTime(currentLead.created_at)}
            />
            <InfoItem
              label="Created (Local)"
              value={formatLocalDateTimeWithZone(currentLead.created_at)}
            />
            <InfoItem
              label="Last updated by"
              value={
                resolveDisplayName(currentLead.updated_by as unknown) || "—"
              }
            />
          </div>

          <div className="space-y-3">
            <div
              role="tablist"
              aria-label="Lead detail sections"
              className="flex items-center gap-4 border-b border-[--color-border]"
            >
              {tabBtn(
                "Payload",
                () => {
                  setActiveTab("payload");
                  setLeadQueryParams({
                    lead: currentLead.id,
                    leadTab: "payload",
                    leadQc: undefined,
                  });
                },
                activeTab === "payload",
              )}
              {tabBtn(
                "Quality Control",
                () => {
                  setActiveTab("quality-control");
                  setLeadQueryParams({
                    lead: currentLead.id,
                    leadTab: "quality-control",
                    leadQc: "duplicate-check",
                  });
                },
                activeTab === "quality-control",
              )}
            </div>

            {activeTab === "payload" ? (
              <div className="space-y-2">
                {entries.length === 0 ? (
                  <p className="text-[--color-text-muted]">Empty payload</p>
                ) : (
                  <>
                    <div className="space-y-2">
                      {entries.map(([key]) => {
                        const original = originalPayloadRef.current[key] ?? "";
                        const current = localPayload[key] ?? original;
                        const isDirty = current !== original;
                        return (
                          <div key={key} className="space-y-1">
                            <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                              {key}
                            </p>
                            <div className="flex items-center gap-1.5">
                              <input
                                className={inputClass}
                                value={current}
                                onChange={(e) =>
                                  setLocalPayload((prev) => ({
                                    ...prev,
                                    [key]: e.target.value,
                                  }))
                                }
                              />
                              <EditHistoryPopover
                                originalValue={isDirty ? original : undefined}
                                updatedBy={currentLead.updated_by}
                                updatedAt={currentLead.updated_at}
                                dirty={isDirty}
                                fieldLabel={key}
                                history={currentLead.edit_history?.filter(
                                  (e) => e.field === `payload.${key}`,
                                )}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {Object.keys(localPayload).some(
                      (k) =>
                        localPayload[k] !==
                        (originalPayloadRef.current[k] ?? ""),
                    ) && (
                      <div className="flex items-center gap-2 rounded-lg border border-[--color-border] bg-[--color-bg-muted] px-3 py-2">
                        <span className="mr-auto text-xs text-[--color-text-muted]">
                          Unsaved changes
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setLocalPayload({ ...originalPayloadRef.current })
                          }
                        >
                          Cancel
                        </Button>
                        <Button size="sm" onClick={() => setConfirmSave(true)}>
                          Save Changes
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div
                  role="tablist"
                  aria-label="Quality control modules"
                  className="flex items-center gap-4 border-b border-[--color-border]"
                >
                  {tabBtn(
                    "Duplicate Check",
                    () => {
                      setQualityTab("duplicate-check");
                      setLeadQueryParams({
                        lead: currentLead.id,
                        leadTab: "quality-control",
                        leadQc: "duplicate-check",
                      });
                    },
                    qualityTab === "duplicate-check",
                  )}
                </div>

                {qualityTab === "duplicate-check" && (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-3">
                      <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                        Duplicate Check
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        {duplicateFailed ? (
                          <X size={16} className="text-[--color-danger]" />
                        ) : (
                          <Check size={16} className="text-[--color-success]" />
                        )}
                        <span
                          className={`font-semibold ${
                            duplicateFailed
                              ? "text-[--color-danger]"
                              : "text-[--color-success]"
                          }`}
                        >
                          {duplicateFailed ? "Fail" : "Passed"}
                        </span>
                      </div>
                    </div>

                    {duplicateLeadIds.length > 0 && (
                      <details className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-3">
                        <summary className="cursor-pointer text-sm font-medium text-[--color-text-strong]">
                          Matched Leads ({duplicateLeadIds.length})
                        </summary>
                        <div className="mt-3">
                          <div className="flex flex-wrap gap-2">
                            {duplicateLeadIds.map((leadId) => (
                              <button
                                key={leadId}
                                type="button"
                                className="rounded-md"
                                onClick={() => {
                                  const matchedLead = allLeads.find(
                                    (item) => item.id === leadId,
                                  );
                                  if (!matchedLead) {
                                    toast.warning(
                                      "Matched lead is not available in the current list.",
                                    );
                                    return;
                                  }
                                  setSelectedLead(matchedLead);
                                  setActiveTab("payload");
                                  setQualityTab("duplicate-check");
                                  setLeadQueryParams({
                                    lead: matchedLead.id,
                                    leadTab: "payload",
                                    leadQc: undefined,
                                  });
                                }}
                              >
                                <Badge tone="warning">{leadId}</Badge>
                              </button>
                            ))}
                          </div>
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Confirm payload save */}
      <Modal
        title="Confirm Payload Edit"
        isOpen={confirmSave}
        onClose={() => setConfirmSave(false)}
        width={460}
      >
        <div className="space-y-4 text-sm">
          <p className="text-[--color-text]">
            You are about to overwrite lead payload fields in the database. This
            action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmSave(false)}>
              Cancel
            </Button>
            <Button
              disabled={savingPayload}
              onClick={async () => {
                setSavingPayload(true);
                try {
                  const newPayload: Record<string, unknown> = {};
                  Object.entries(localPayload).forEach(([k, v]) => {
                    try {
                      newPayload[k] = JSON.parse(v);
                    } catch {
                      newPayload[k] = v;
                    }
                  });
                  const res = await updateLead(currentLead.id, {
                    payload: newPayload,
                  });
                  if (!(res as any)?.success)
                    throw new Error((res as any)?.message || "Failed to save");
                  const updated = (res as any)?.data as Lead;
                  setSelectedLead(updated);
                  const strPayload: Record<string, string> = {};
                  Object.entries(updated.payload || {}).forEach(([k, v]) => {
                    strPayload[k] =
                      typeof v === "object"
                        ? JSON.stringify(v)
                        : String(v ?? "");
                  });
                  setLocalPayload(strPayload);
                  originalPayloadRef.current = { ...strPayload };
                  setConfirmSave(false);
                  toast.success("Lead payload updated");
                } catch (err: any) {
                  toast.error(err?.message || "Unable to update lead payload");
                } finally {
                  setSavingPayload(false);
                }
              }}
            >
              {savingPayload ? "Saving\u2026" : "Confirm Save"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
