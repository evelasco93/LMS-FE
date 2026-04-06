"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/button";
import { DisabledTooltip } from "@/components/ui/disabled-tooltip";
import { HoverTooltip } from "@/components/ui/hover-tooltip";
import { formatDateTime } from "@/lib/utils";
import type { Campaign } from "@/lib/types";
import { type IpqsConfig, defaultIpqsConfig } from "./types";

/* ── Props ──────────────────────────────────────────────────────────────── */

interface IntegrationsTabProps {
  campaign: Campaign;
  globallyDisabled: {
    dupCheck: boolean;
    trustedForm: boolean;
    ipqs: boolean;
  };
  onUpdatePlugins: (
    campaignId: string,
    payload: {
      duplicate_check?: {
        enabled?: boolean;
        criteria?: Array<"phone" | "email">;
      };
      trusted_form?: { enabled?: boolean; stage?: number; gate?: boolean };
      ipqs?: {
        enabled?: boolean;
        stage?: number;
        gate?: boolean;
        phone?: { enabled?: boolean; criteria?: Record<string, unknown> };
        email?: { enabled?: boolean; criteria?: Record<string, unknown> };
        ip?: { enabled?: boolean; criteria?: Record<string, unknown> };
      };
    },
  ) => Promise<void>;
  resolveChangedBy: (
    changed_by?:
      | string
      | {
          username?: string;
          email?: string;
          full_name?: string;
          first_name?: string;
          last_name?: string;
        }
      | null,
  ) => string;
}

/* ── Component ──────────────────────────────────────────────────────────── */

export function IntegrationsTab({
  campaign,
  globallyDisabled,
  onUpdatePlugins,
  resolveChangedBy,
}: IntegrationsTabProps) {
  /* ── State ──────────────────────────────────────────────────────────── */
  const [duplicateCheckEnabled, setDuplicateCheckEnabled] = useState(true);
  const [duplicateCheckCriteria, setDuplicateCheckCriteria] = useState<
    Array<"phone" | "email">
  >(["phone", "email"]);
  const [trustedFormEnabled, setTrustedFormEnabled] = useState(true);
  const [trustedFormGate, setTrustedFormGate] = useState(true);
  const [ipqsGate, setIpqsGate] = useState(true);
  const [tfStep, setTfStep] = useState(2);
  const [ipqsStep, setIpqsStep] = useState(3);
  const [tfStepEditing, setTfStepEditing] = useState(false);
  const [ipqsStepEditing, setIpqsStepEditing] = useState(false);

  const [dupCheckOpen, setDupCheckOpen] = useState(false);
  const [trustedFormOpen, setTrustedFormOpen] = useState(false);
  const [ipqsOpen, setIpqsOpen] = useState(false);

  const [ipqsConfig, setIpqsConfig] = useState<IpqsConfig>(defaultIpqsConfig);
  const [ipqsPhoneOpen, setIpqsPhoneOpen] = useState(false);
  const [ipqsEmailOpen, setIpqsEmailOpen] = useState(false);
  const [ipqsIpOpen, setIpqsIpOpen] = useState(false);

  const [integrationsDirty, setIntegrationsDirty] = useState(false);
  const pluginsInitRef = useRef(false);

  /* ── Init from campaign ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!campaign) return;
    setIntegrationsDirty(false);
    pluginsInitRef.current = false;
    setDupCheckOpen(false);
    setTrustedFormOpen(false);
    setIpqsOpen(false);
    setDuplicateCheckEnabled(
      globallyDisabled.dupCheck
        ? false
        : (campaign.plugins?.duplicate_check?.enabled ?? true),
    );
    setDuplicateCheckCriteria(
      campaign.plugins?.duplicate_check?.criteria?.length
        ? campaign.plugins.duplicate_check.criteria
        : ["phone", "email"],
    );
    setTrustedFormEnabled(
      globallyDisabled.trustedForm
        ? false
        : (campaign.plugins?.trusted_form?.enabled ?? true),
    );
    setTrustedFormGate(campaign.plugins?.trusted_form?.gate ?? true);
    setIpqsGate(campaign.plugins?.ipqs?.gate ?? true);
    setTfStep(campaign.plugins?.trusted_form?.stage ?? 2);
    setIpqsStep(campaign.plugins?.ipqs?.stage ?? 3);
    setTfStepEditing(false);
    setIpqsStepEditing(false);

    const qi = campaign.plugins?.ipqs;
    setIpqsConfig({
      enabled: globallyDisabled.ipqs ? false : (qi?.enabled ?? false),
      phone: {
        enabled: qi?.phone?.enabled ?? true,
        criteria: {
          valid: { enabled: qi?.phone?.criteria?.valid?.enabled ?? true },
          fraud_score: {
            enabled: qi?.phone?.criteria?.fraud_score?.enabled ?? true,
            operator: qi?.phone?.criteria?.fraud_score?.operator ?? "lte",
            value: qi?.phone?.criteria?.fraud_score?.value ?? 85,
          },
          country: {
            enabled: qi?.phone?.criteria?.country?.enabled ?? false,
            allowed: (qi?.phone?.criteria?.country?.allowed ?? []).join(", "),
          },
        },
      },
      email: {
        enabled: qi?.email?.enabled ?? true,
        criteria: {
          valid: { enabled: qi?.email?.criteria?.valid?.enabled ?? true },
          fraud_score: {
            enabled: qi?.email?.criteria?.fraud_score?.enabled ?? true,
            operator: qi?.email?.criteria?.fraud_score?.operator ?? "lte",
            value: qi?.email?.criteria?.fraud_score?.value ?? 85,
          },
        },
      },
      ip: {
        enabled: qi?.ip?.enabled ?? false,
        criteria: {
          fraud_score: {
            enabled: qi?.ip?.criteria?.fraud_score?.enabled ?? true,
            operator: qi?.ip?.criteria?.fraud_score?.operator ?? "lte",
            value: qi?.ip?.criteria?.fraud_score?.value ?? 85,
          },
          country_code: {
            enabled: qi?.ip?.criteria?.country_code?.enabled ?? false,
            allowed: (qi?.ip?.criteria?.country_code?.allowed ?? []).join(", "),
          },
          proxy: {
            enabled: qi?.ip?.criteria?.proxy?.enabled ?? false,
            allowed: qi?.ip?.criteria?.proxy?.allowed ?? false,
          },
          vpn: {
            enabled: qi?.ip?.criteria?.vpn?.enabled ?? false,
            allowed: qi?.ip?.criteria?.vpn?.allowed ?? false,
          },
        },
      },
    });
  }, [campaign]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Globally-disabled sync ─────────────────────────────────────────── */
  useEffect(() => {
    if (globallyDisabled.dupCheck) setDuplicateCheckEnabled(false);
  }, [globallyDisabled.dupCheck]);

  useEffect(() => {
    if (globallyDisabled.trustedForm) setTrustedFormEnabled(false);
  }, [globallyDisabled.trustedForm]);

  useEffect(() => {
    if (globallyDisabled.ipqs) setIpqsConfig((p) => ({ ...p, enabled: false }));
  }, [globallyDisabled.ipqs]);

  /* ── Dirty tracking ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (!pluginsInitRef.current) {
      pluginsInitRef.current = true;
      return;
    }
    setIntegrationsDirty(true);
  }, [
    duplicateCheckEnabled,
    duplicateCheckCriteria,
    trustedFormEnabled,
    trustedFormGate,
    ipqsGate,
    tfStep,
    ipqsStep,
    ipqsConfig,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Save handler ───────────────────────────────────────────────────── */
  const handleSave = async () => {
    if (
      !globallyDisabled.dupCheck &&
      duplicateCheckEnabled &&
      duplicateCheckCriteria.length === 0
    ) {
      toast.warning(
        "Select at least one criterion (phone or email) when duplicate check is enabled.",
      );
      return;
    }
    await onUpdatePlugins(campaign.id, {
      duplicate_check: {
        enabled: globallyDisabled.dupCheck ? false : duplicateCheckEnabled,
        criteria: duplicateCheckCriteria,
      },
      trusted_form: {
        enabled: globallyDisabled.trustedForm ? false : trustedFormEnabled,
        stage: tfStep,
        gate: trustedFormGate,
      },
      ipqs: {
        enabled: globallyDisabled.ipqs ? false : ipqsConfig.enabled,
        stage: ipqsStep,
        gate: ipqsGate,
        phone: {
          enabled: ipqsConfig.phone.enabled,
          criteria: {
            valid: ipqsConfig.phone.criteria.valid,
            fraud_score: ipqsConfig.phone.criteria.fraud_score,
            country: {
              enabled: ipqsConfig.phone.criteria.country.enabled,
              allowed: ipqsConfig.phone.criteria.country.allowed
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            },
          },
        },
        email: {
          enabled: ipqsConfig.email.enabled,
          criteria: ipqsConfig.email.criteria,
        },
        ip: {
          enabled: ipqsConfig.ip.enabled,
          criteria: {
            fraud_score: ipqsConfig.ip.criteria.fraud_score,
            country_code: {
              enabled: ipqsConfig.ip.criteria.country_code.enabled,
              allowed: ipqsConfig.ip.criteria.country_code.allowed
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            },
            proxy: ipqsConfig.ip.criteria.proxy,
            vpn: ipqsConfig.ip.criteria.vpn,
          },
        },
      },
    });
    setIntegrationsDirty(false);
  };

  /* ── Helpers ────────────────────────────────────────────────────────── */
  const tfFirst = tfStep <= ipqsStep;

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-3">
      {/* Duplicate Check card */}
      <div className="rounded-xl border border-[--color-border] bg-[--color-bg-muted] p-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDupCheckOpen((v) => !v)}
            className="flex-1 flex items-center gap-2 text-left min-w-0"
          >
            <motion.span
              animate={{ rotate: dupCheckOpen ? 90 : 0 }}
              transition={{ duration: 0.15 }}
              className="shrink-0 text-[--color-text-muted]"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </motion.span>
            <p className="text-sm font-semibold text-[--color-text-strong]">
              Duplicate Check
            </p>
          </button>
          <HoverTooltip message="Duplicate check always runs first — it cannot be reordered">
            <span className="rounded border border-[--color-border] bg-[--color-bg] px-1.5 py-0.5 text-[10px] font-mono text-[--color-text-muted] cursor-help">
              Step 1
            </span>
          </HoverTooltip>
          <DisabledTooltip
            message={
              globallyDisabled.dupCheck ? "Globally disabled by admin" : ""
            }
            inline
          >
            <button
              type="button"
              role="switch"
              aria-checked={
                globallyDisabled.dupCheck ? false : duplicateCheckEnabled
              }
              disabled={globallyDisabled.dupCheck}
              onClick={() =>
                !globallyDisabled.dupCheck &&
                setDuplicateCheckEnabled((prev) => !prev)
              }
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                globallyDisabled.dupCheck
                  ? "opacity-40 cursor-not-allowed bg-[--color-border]"
                  : duplicateCheckEnabled
                    ? "bg-[--color-primary]"
                    : "bg-[--color-border]"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-[--color-bg] transition ${
                  !globallyDisabled.dupCheck && duplicateCheckEnabled
                    ? "translate-x-5"
                    : "translate-x-1"
                }`}
              />
            </button>
          </DisabledTooltip>
        </div>

        <AnimatePresence initial={false}>
          {dupCheckOpen && (
            <motion.div
              key="dupcheck-details"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeInOut" }}
              style={{ overflow: "hidden" }}
            >
              <div
                className={`mt-3 pt-3 border-t border-[--color-border] space-y-2 ${!duplicateCheckEnabled || globallyDisabled.dupCheck ? "opacity-50 pointer-events-none select-none" : ""}`}
              >
                <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                  Matching Criteria
                </p>
                <div className="flex flex-wrap gap-4">
                  {(["phone", "email"] as const).map((criterion) => {
                    const checked = duplicateCheckCriteria.includes(criterion);
                    return (
                      <label
                        key={criterion}
                        className="flex items-center gap-2 text-sm text-[--color-text]"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[--color-primary]"
                          checked={checked}
                          onChange={(e) => {
                            setDuplicateCheckCriteria((prev) => {
                              if (e.target.checked) {
                                return prev.includes(criterion)
                                  ? prev
                                  : [...prev, criterion];
                              }
                              return prev.filter((item) => item !== criterion);
                            });
                          }}
                        />
                        <span className="capitalize">{criterion}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Non-duplicate plugins */}
      <div className="flex flex-col gap-3">
        {/* TrustedForm card */}
        <div
          style={{ order: tfFirst ? 1 : 3 }}
          className="rounded-xl border border-[--color-border] bg-[--color-bg-muted] p-4"
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTrustedFormOpen((v) => !v)}
              className="flex-1 flex items-start gap-2 text-left min-w-0"
            >
              <motion.span
                animate={{ rotate: trustedFormOpen ? 90 : 0 }}
                transition={{ duration: 0.15 }}
                className="shrink-0 text-[--color-text-muted] mt-0.5"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </motion.span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[--color-text-strong]">
                  TrustedForm
                </p>
              </div>
            </button>
            {tfStepEditing ? (
              <input
                type="number"
                min={2}
                max={99}
                autoFocus
                value={tfStep}
                className="w-12 rounded border border-[--color-primary] bg-[--color-bg] px-1 py-0.5 text-[10px] font-mono text-center text-[--color-text]"
                onChange={(e) =>
                  setTfStep(Math.max(2, parseInt(e.target.value, 10) || 2))
                }
                onBlur={() => setTfStepEditing(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Escape")
                    setTfStepEditing(false);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <HoverTooltip message="Click to manually set the step number">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTfStepEditing(true);
                  }}
                  className="rounded border border-[--color-border] bg-[--color-bg] px-1.5 py-0.5 text-[10px] font-mono text-[--color-text-muted] hover:border-[--color-primary] hover:text-[--color-primary] transition-colors"
                >
                  Step {tfStep}
                </button>
              </HoverTooltip>
            )}
            <DisabledTooltip
              message={
                globallyDisabled.trustedForm ? "Globally disabled by admin" : ""
              }
              inline
            >
              <button
                type="button"
                role="switch"
                aria-checked={
                  globallyDisabled.trustedForm ? false : trustedFormEnabled
                }
                disabled={globallyDisabled.trustedForm}
                onClick={() =>
                  !globallyDisabled.trustedForm &&
                  setTrustedFormEnabled((prev) => !prev)
                }
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                  globallyDisabled.trustedForm
                    ? "opacity-40 cursor-not-allowed bg-[--color-border]"
                    : trustedFormEnabled
                      ? "bg-[--color-primary]"
                      : "bg-[--color-border]"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-[--color-bg] transition ${
                    !globallyDisabled.trustedForm && trustedFormEnabled
                      ? "translate-x-5"
                      : "translate-x-1"
                  }`}
                />
              </button>
            </DisabledTooltip>
          </div>
          <AnimatePresence initial={false}>
            {trustedFormOpen && (
              <motion.div
                key="tf-details"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeInOut" }}
                style={{ overflow: "hidden" }}
              >
                <div
                  className={`mt-3 pt-3 border-t border-[--color-border] space-y-3 ${!trustedFormEnabled || globallyDisabled.trustedForm ? "opacity-50 pointer-events-none select-none" : ""}`}
                >
                  <div className="flex items-center gap-1.5 text-xs">
                    <HoverTooltip message="When on, a TrustedForm failure rejects the lead. When off, failure is recorded but processing continues.">
                      <span className="cursor-help text-[--color-text-muted]">
                        Reject on failure
                      </span>
                    </HoverTooltip>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={trustedFormGate}
                      onClick={() => setTrustedFormGate((prev) => !prev)}
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
                        trustedFormGate
                          ? "bg-[--color-primary]"
                          : "bg-[--color-border]"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-[--color-bg] transition ${
                          trustedFormGate ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                    <span className="text-[--color-text-muted]">
                      {trustedFormGate ? "On" : "Off"}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Parallel indicator */}
        {tfStep === ipqsStep && (
          <div
            style={{ order: 2 }}
            className="flex w-full items-center gap-2 px-3 text-[10px] text-[--color-text-muted]"
          >
            <div className="h-px flex-1 border-t border-dashed border-[--color-border]" />
            <span className="flex items-center gap-1 font-medium">
              <LayoutGrid className="h-3 w-3" />
              Parallel
            </span>
            <div className="h-px flex-1 border-t border-dashed border-[--color-border]" />
          </div>
        )}

        {/* IPQS card */}
        <div
          style={{ order: tfFirst ? 3 : 1 }}
          className="rounded-xl border border-[--color-border] bg-[--color-bg-muted] p-4"
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIpqsOpen((v) => !v)}
              className="flex-1 flex items-start gap-2 text-left min-w-0"
            >
              <motion.span
                animate={{ rotate: ipqsOpen ? 90 : 0 }}
                transition={{ duration: 0.15 }}
                className="shrink-0 text-[--color-text-muted] mt-0.5"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </motion.span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[--color-text-strong]">
                  IPQualityScore (IPQS)
                </p>
              </div>
            </button>
            {ipqsStepEditing ? (
              <input
                type="number"
                min={2}
                max={99}
                autoFocus
                value={ipqsStep}
                className="w-12 rounded border border-[--color-primary] bg-[--color-bg] px-1 py-0.5 text-[10px] font-mono text-center text-[--color-text]"
                onChange={(e) =>
                  setIpqsStep(Math.max(2, parseInt(e.target.value, 10) || 2))
                }
                onBlur={() => setIpqsStepEditing(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Escape")
                    setIpqsStepEditing(false);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <HoverTooltip message="Click to manually set the step number">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIpqsStepEditing(true);
                  }}
                  className="rounded border border-[--color-border] bg-[--color-bg] px-1.5 py-0.5 text-[10px] font-mono text-[--color-text-muted] hover:border-[--color-primary] hover:text-[--color-primary] transition-colors"
                >
                  Step {ipqsStep}
                </button>
              </HoverTooltip>
            )}
            <DisabledTooltip
              message={
                globallyDisabled.ipqs ? "Globally disabled by admin" : ""
              }
              inline
            >
              <button
                type="button"
                role="switch"
                aria-checked={
                  globallyDisabled.ipqs ? false : ipqsConfig.enabled
                }
                disabled={globallyDisabled.ipqs}
                onClick={() =>
                  !globallyDisabled.ipqs &&
                  setIpqsConfig((p) => ({ ...p, enabled: !p.enabled }))
                }
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                  globallyDisabled.ipqs
                    ? "opacity-40 cursor-not-allowed bg-[--color-border]"
                    : ipqsConfig.enabled
                      ? "bg-[--color-primary]"
                      : "bg-[--color-border]"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-[--color-bg] transition ${
                    !globallyDisabled.ipqs && ipqsConfig.enabled
                      ? "translate-x-5"
                      : "translate-x-1"
                  }`}
                />
              </button>
            </DisabledTooltip>
          </div>

          <AnimatePresence initial={false}>
            {ipqsOpen && (
              <motion.div
                key="ipqs-details"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeInOut" }}
                style={{ overflow: "hidden" }}
              >
                <div
                  className={`mt-3 pt-3 border-t border-[--color-border] space-y-3 ${!ipqsConfig.enabled || globallyDisabled.ipqs ? "opacity-50 pointer-events-none select-none" : ""}`}
                >
                  {/* Reject-on-failure */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <HoverTooltip message="When on, an IPQS failure rejects the lead. When off, failure is recorded but processing continues.">
                      <span className="cursor-help text-[--color-text-muted]">
                        Reject on failure
                      </span>
                    </HoverTooltip>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={ipqsGate}
                      onClick={() => setIpqsGate((prev) => !prev)}
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
                        ipqsGate
                          ? "bg-[--color-primary]"
                          : "bg-[--color-border]"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-[--color-bg] transition ${
                          ipqsGate ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                    <span className="text-[--color-text-muted]">
                      {ipqsGate ? "On" : "Off"}
                    </span>
                  </div>

                  {/* Sub-checks */}
                  <div className="pt-2 space-y-2 border-t border-[--color-border]">
                    {/* Phone sub-check */}
                    <IpqsSubCheck
                      label="Phone"
                      open={ipqsPhoneOpen}
                      onToggleOpen={() => setIpqsPhoneOpen((v) => !v)}
                      enabled={ipqsConfig.phone.enabled}
                      onToggleEnabled={() =>
                        setIpqsConfig((p) => ({
                          ...p,
                          phone: {
                            ...p.phone,
                            enabled: !p.phone.enabled,
                          },
                        }))
                      }
                    >
                      {/* valid */}
                      <CriterionRow
                        label="Valid"
                        checked={ipqsConfig.phone.criteria.valid.enabled}
                        onChange={(checked) =>
                          setIpqsConfig((p) => ({
                            ...p,
                            phone: {
                              ...p.phone,
                              criteria: {
                                ...p.phone.criteria,
                                valid: {
                                  ...p.phone.criteria.valid,
                                  enabled: checked,
                                },
                              },
                            },
                          }))
                        }
                      />
                      {/* fraud_score */}
                      <FraudScoreRow
                        criterion={ipqsConfig.phone.criteria.fraud_score}
                        onChange={(fraud_score) =>
                          setIpqsConfig((p) => ({
                            ...p,
                            phone: {
                              ...p.phone,
                              criteria: { ...p.phone.criteria, fraud_score },
                            },
                          }))
                        }
                      />
                      {/* country */}
                      <CountryRow
                        criterion={ipqsConfig.phone.criteria.country}
                        onChange={(country) =>
                          setIpqsConfig((p) => ({
                            ...p,
                            phone: {
                              ...p.phone,
                              criteria: { ...p.phone.criteria, country },
                            },
                          }))
                        }
                      />
                    </IpqsSubCheck>

                    {/* Email sub-check */}
                    <IpqsSubCheck
                      label="Email"
                      open={ipqsEmailOpen}
                      onToggleOpen={() => setIpqsEmailOpen((v) => !v)}
                      enabled={ipqsConfig.email.enabled}
                      onToggleEnabled={() =>
                        setIpqsConfig((p) => ({
                          ...p,
                          email: {
                            ...p.email,
                            enabled: !p.email.enabled,
                          },
                        }))
                      }
                    >
                      <CriterionRow
                        label="Valid"
                        checked={ipqsConfig.email.criteria.valid.enabled}
                        onChange={(checked) =>
                          setIpqsConfig((p) => ({
                            ...p,
                            email: {
                              ...p.email,
                              criteria: {
                                ...p.email.criteria,
                                valid: {
                                  ...p.email.criteria.valid,
                                  enabled: checked,
                                },
                              },
                            },
                          }))
                        }
                      />
                      <FraudScoreRow
                        criterion={ipqsConfig.email.criteria.fraud_score}
                        onChange={(fraud_score) =>
                          setIpqsConfig((p) => ({
                            ...p,
                            email: {
                              ...p.email,
                              criteria: { ...p.email.criteria, fraud_score },
                            },
                          }))
                        }
                      />
                    </IpqsSubCheck>

                    {/* IP sub-check */}
                    <IpqsSubCheck
                      label="IP Address"
                      open={ipqsIpOpen}
                      onToggleOpen={() => setIpqsIpOpen((v) => !v)}
                      enabled={ipqsConfig.ip.enabled}
                      onToggleEnabled={() =>
                        setIpqsConfig((p) => ({
                          ...p,
                          ip: { ...p.ip, enabled: !p.ip.enabled },
                        }))
                      }
                    >
                      <FraudScoreRow
                        criterion={ipqsConfig.ip.criteria.fraud_score}
                        onChange={(fraud_score) =>
                          setIpqsConfig((p) => ({
                            ...p,
                            ip: {
                              ...p.ip,
                              criteria: { ...p.ip.criteria, fraud_score },
                            },
                          }))
                        }
                      />
                      <CountryRow
                        criterion={ipqsConfig.ip.criteria.country_code}
                        onChange={(country_code) =>
                          setIpqsConfig((p) => ({
                            ...p,
                            ip: {
                              ...p.ip,
                              criteria: { ...p.ip.criteria, country_code },
                            },
                          }))
                        }
                      />
                      <BoolRow
                        label="Proxy"
                        criterion={ipqsConfig.ip.criteria.proxy}
                        allowLabel="Allow proxies"
                        onChange={(proxy) =>
                          setIpqsConfig((p) => ({
                            ...p,
                            ip: {
                              ...p.ip,
                              criteria: { ...p.ip.criteria, proxy },
                            },
                          }))
                        }
                      />
                      <BoolRow
                        label="VPN"
                        criterion={ipqsConfig.ip.criteria.vpn}
                        allowLabel="Allow VPNs"
                        onChange={(vpn) =>
                          setIpqsConfig((p) => ({
                            ...p,
                            ip: {
                              ...p.ip,
                              criteria: { ...p.ip.criteria, vpn },
                            },
                          }))
                        }
                      />
                    </IpqsSubCheck>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Save button */}
      {integrationsDirty && (
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSave}>
            Save
          </Button>
        </div>
      )}

      {/* Plugin change history */}
      <PluginHistory campaign={campaign} resolveChangedBy={resolveChangedBy} />
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

function IpqsSubCheck({
  label,
  open,
  onToggleOpen,
  enabled,
  onToggleEnabled,
  children,
}: {
  label: string;
  open: boolean;
  onToggleOpen: () => void;
  enabled: boolean;
  onToggleEnabled: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[--color-border] bg-[--color-bg] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 gap-2">
        <button
          type="button"
          onClick={onToggleOpen}
          className="flex items-center gap-1.5 text-sm font-medium text-[--color-text] hover:text-[--color-primary] transition-colors"
        >
          <motion.span
            animate={{ rotate: open ? 90 : 0 }}
            transition={{ duration: 0.15 }}
            className="text-[10px] text-[--color-text-muted]"
          >
            ▶
          </motion.span>
          {label}
        </button>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={onToggleEnabled}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${enabled ? "bg-[--color-primary]" : "bg-[--color-border]"}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-[--color-bg] transition ${enabled ? "translate-x-4" : "translate-x-0.5"}`}
          />
        </button>
      </div>
      <AnimatePresence initial={false}>
        {open && enabled && (
          <motion.div
            key={`${label}-criteria`}
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.18 }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-3 pb-3 space-y-2.5 border-t border-[--color-border] pt-2.5">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CriterionRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <input
        type="checkbox"
        className="h-3.5 w-3.5 accent-[--color-primary]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="w-20 text-[--color-text-muted]">{label}</span>
    </div>
  );
}

function FraudScoreRow({
  criterion,
  onChange,
}: {
  criterion: {
    enabled: boolean;
    operator: "lte" | "gte" | "eq";
    value: number;
  };
  onChange: (v: {
    enabled: boolean;
    operator: "lte" | "gte" | "eq";
    value: number;
  }) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <input
        type="checkbox"
        className="h-3.5 w-3.5 accent-[--color-primary]"
        checked={criterion.enabled}
        onChange={(e) => onChange({ ...criterion, enabled: e.target.checked })}
      />
      <span className="w-20 text-[--color-text-muted]">Fraud Score</span>
      {criterion.enabled && (
        <>
          <select
            className="rounded border border-[--color-border] bg-[--color-bg-muted] px-2 py-0.5 text-xs"
            value={criterion.operator}
            onChange={(e) =>
              onChange({
                ...criterion,
                operator: e.target.value as "lte" | "gte" | "eq",
              })
            }
          >
            <option value="lte">≤ (lte)</option>
            <option value="gte">≥ (gte)</option>
            <option value="eq">= (eq)</option>
          </select>
          <input
            type="number"
            min={0}
            max={100}
            className="w-16 rounded border border-[--color-border] bg-[--color-bg-muted] px-2 py-0.5 text-xs"
            value={criterion.value}
            onChange={(e) =>
              onChange({ ...criterion, value: Number(e.target.value) })
            }
          />
        </>
      )}
    </div>
  );
}

function CountryRow({
  criterion,
  onChange,
}: {
  criterion: { enabled: boolean; allowed: string };
  onChange: (v: { enabled: boolean; allowed: string }) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <input
        type="checkbox"
        className="h-3.5 w-3.5 accent-[--color-primary]"
        checked={criterion.enabled}
        onChange={(e) => onChange({ ...criterion, enabled: e.target.checked })}
      />
      <span className="w-20 text-[--color-text-muted]">Country</span>
      {criterion.enabled && (
        <input
          type="text"
          placeholder="US, CA, GB…"
          className="flex-1 min-w-0 rounded border border-[--color-border] bg-[--color-bg-muted] px-2 py-0.5 text-xs"
          value={criterion.allowed}
          onChange={(e) => onChange({ ...criterion, allowed: e.target.value })}
        />
      )}
    </div>
  );
}

function BoolRow({
  label,
  criterion,
  allowLabel,
  onChange,
}: {
  label: string;
  criterion: { enabled: boolean; allowed: boolean };
  allowLabel: string;
  onChange: (v: { enabled: boolean; allowed: boolean }) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <input
        type="checkbox"
        className="h-3.5 w-3.5 accent-[--color-primary]"
        checked={criterion.enabled}
        onChange={(e) => onChange({ ...criterion, enabled: e.target.checked })}
      />
      <span className="w-20 text-[--color-text-muted]">{label}</span>
      {criterion.enabled && (
        <label className="flex items-center gap-1.5 text-[--color-text-muted]">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-[--color-primary]"
            checked={criterion.allowed}
            onChange={(e) =>
              onChange({ ...criterion, allowed: e.target.checked })
            }
          />
          {allowLabel}
        </label>
      )}
    </div>
  );
}

function PluginHistory({
  campaign,
  resolveChangedBy,
}: {
  campaign: Campaign;
  resolveChangedBy: (
    changed_by?:
      | string
      | {
          username?: string;
          email?: string;
          full_name?: string;
          first_name?: string;
          last_name?: string;
        }
      | null,
  ) => string;
}) {
  const pluginHistory = (campaign.edit_history ?? [])
    .filter((e) => e.field?.startsWith("plugins."))
    .sort(
      (a, b) =>
        new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime(),
    );
  if (pluginHistory.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-xs uppercase tracking-wide text-[--color-text-muted]">
        Integration Change History
      </p>
      <div className="max-h-52 overflow-y-auto rounded-lg border border-[--color-border] divide-y divide-[--color-border]">
        {pluginHistory.map((entry, i) => {
          const by = entry.changed_by
            ? resolveChangedBy(
                entry.changed_by as { username?: string; email?: string },
              )
            : null;
          const prev =
            entry.previous_value != null ? String(entry.previous_value) : null;
          const next = entry.new_value != null ? String(entry.new_value) : null;
          return (
            <div key={i} className="p-3 text-xs bg-[--color-bg-muted]">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono font-medium text-[--color-primary]">
                  {entry.field}
                </span>
                <span className="shrink-0 text-[--color-text-muted]">
                  {formatDateTime(entry.changed_at)}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="rounded bg-[--color-bg] px-1.5 py-0.5 text-[--color-text-muted] line-through">
                  {prev ?? "—"}
                </span>
                <span className="text-[--color-text-muted]">→</span>
                <span className="rounded bg-[--color-bg] px-1.5 py-0.5 font-medium text-[--color-text-strong]">
                  {next ?? "—"}
                </span>
                {by && (
                  <span className="ml-auto text-[--color-text-muted]">
                    by {by}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
