"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ChevronDown,
  Copy,
  FileText,
  Flame,
  Gauge,
  GitBranch,
  Info,
  Plug,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { SectionLabel } from "@/components/ui/section-label";
import { HoverTooltip } from "@/components/ui/hover-tooltip";
import { formatDateTime, statusColorMap } from "@/lib/utils";
import { generatePostingInstructions } from "@/lib/generate-posting-instructions";
import type {
  Affiliate,
  AffiliateSoldPixelConfig,
  Campaign,
  CampaignAffiliate,
  CampaignParticipantStatus,
  CriteriaField,
  LogicRule,
} from "@/lib/types";
import {
  defaultAffiliatePixelConfig,
  leadModeFromAffiliateStatus,
  normalizePixelMappingRows,
} from "./utils";

export function AffiliatesTab({
  campaign,
  affiliates,
  linkedAffiliates,
  affiliateLinkMap,
  availableAffiliates,
  criteriaFields,
  logicRules,
  focusAffiliateId,
  leadsByCampaignKey,
  liveLeadsByCampaignKey,
  resolveChangedBy,
  onOpenLeadsForCampaign,
  openAffiliateLogicManager,
  setLinkAffiliateModalOpen,
  setParticipantAction,
  setAffiliateCapModalId,
  setPixelDraft,
  setPixelSaveAttempted,
  setPixelConfigTab,
  setPixelAffiliateId,
  onNavigateToSettings,
}: {
  campaign: Campaign;
  affiliates: Affiliate[];
  linkedAffiliates: Affiliate[];
  affiliateLinkMap: Map<string, CampaignAffiliate>;
  availableAffiliates: Affiliate[];
  criteriaFields: CriteriaField[];
  logicRules: LogicRule[];
  focusAffiliateId: string | null;
  leadsByCampaignKey: Map<string, number>;
  liveLeadsByCampaignKey: Map<string, number>;
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
  onOpenLeadsForCampaign: (
    campaignId: string,
    options?: { affiliateId?: string; mode?: "all" | "test" | "live" },
  ) => void;
  openAffiliateLogicManager: (affiliateId: string) => void;
  setLinkAffiliateModalOpen: (open: boolean) => void;
  setParticipantAction: (
    action: {
      type: "client" | "affiliate";
      id: string;
      statusDraft: CampaignParticipantStatus;
      openSkipChecks?: boolean;
    } | null,
  ) => void;
  setAffiliateCapModalId: (id: string | null) => void;
  setPixelDraft: (config: AffiliateSoldPixelConfig) => void;
  setPixelSaveAttempted: (val: boolean) => void;
  setPixelConfigTab: (
    tab: "pixel" | "pixel_criteria" | "sold_criteria",
  ) => void;
  setPixelAffiliateId: (id: string | null) => void;
  onNavigateToSettings?: (subTab: "base-criteria" | "logic") => void;
}) {
  const [openInfoId, setOpenInfoId] = useState<string | null>(null);
  const [openHistoryId, setOpenHistoryId] = useState<string | null>(null);
  const [generatingPdfForAffiliate, setGeneratingPdfForAffiliate] = useState<
    string | null
  >(null);

  const hasCriteria = criteriaFields.length > 0 || !!campaign?.criteria_set_id;
  const hasLogic = logicRules.length > 0 || !!campaign?.logic_set_id;
  const missingConfig = !hasCriteria || !hasLogic;

  return (
    <div className="space-y-3">
      {missingConfig && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-sm text-[--color-text]">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />
          <div>
            <p className="font-medium">Missing configuration</p>
            <p className="mt-0.5 text-xs text-[--color-text-muted]">
              Before adding sources you need to set up{" "}
              {!hasCriteria && (
                <button
                  type="button"
                  className="font-semibold text-[--color-primary] hover:underline"
                  onClick={() => onNavigateToSettings?.("base-criteria")}
                >
                  field definitions
                </button>
              )}
              {!hasCriteria && !hasLogic && " and "}
              {!hasLogic && (
                <button
                  type="button"
                  className="font-semibold text-[--color-primary] hover:underline"
                  onClick={() => onNavigateToSettings?.("logic")}
                >
                  validation rules
                </button>
              )}
              .
            </p>
          </div>
        </div>
      )}
      <div className="mb-2 flex items-center justify-between gap-3">
        <SectionLabel>Linked Sources</SectionLabel>
        <Button
          size="sm"
          iconLeft={<UserPlus size={14} />}
          disabled={missingConfig || availableAffiliates.length === 0}
          onClick={() => setLinkAffiliateModalOpen(true)}
          data-tour="btn-add-affiliate"
        >
          Add Source
        </Button>
      </div>
      <div className="space-y-2 text-sm">
        {linkedAffiliates.length === 0 ? (
          <p className="text-[--color-text-muted]">No linked sources yet.</p>
        ) : (
          linkedAffiliates.map((a) => {
            const link = affiliateLinkMap.get(a.id);
            const isFocused = focusAffiliateId === a.id;
            const infoOpen = openInfoId === `affiliate-${a.id}`;
            const isLiveAffiliate = link?.status === "LIVE";
            const affiliateLeadCount = link?.campaign_key
              ? ((isLiveAffiliate
                  ? liveLeadsByCampaignKey
                  : leadsByCampaignKey
                ).get(link.campaign_key) ?? 0)
              : 0;
            return (
              <div
                key={a.id}
                className={`rounded-md bg-[--color-panel] overflow-hidden ${
                  isFocused ? "ring-2 ring-[--color-primary]" : ""
                }`}
              >
                <div className="flex items-center justify-between px-3 py-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[--color-text-strong]">
                        {a.name}
                      </span>
                      <span
                        className="text-xs text-[--color-text-muted] font-mono cursor-help"
                        title="Source ID"
                      >
                        ({a.id})
                      </span>
                      <Badge
                        tone={
                          statusColorMap[link?.status || "TEST"] || "neutral"
                        }
                      >
                        {link?.status || "TEST"}
                      </Badge>
                    </div>
                    {link?.campaign_key ? (
                      <div className="flex flex-col gap-0.5 mt-1">
                        <div className="flex items-center gap-1 text-xs text-[--color-text-muted]">
                          <HoverTooltip message="Source Campaign Key">
                            <span className="font-mono cursor-help">
                              {link.campaign_key}
                            </span>
                          </HoverTooltip>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(link.campaign_key);
                              toast.success("Campaign Key copied to clipboard");
                            }}
                            className="rounded p-0.5 hover:text-[--color-primary] transition-colors"
                          >
                            <Copy size={11} />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            onOpenLeadsForCampaign(campaign.id, {
                              affiliateId: a.id,
                              mode: leadModeFromAffiliateStatus(link?.status),
                            })
                          }
                          className="text-left text-xs text-[--color-text-muted] hover:text-[--color-primary] hover:underline w-fit"
                        >
                          Total leads: {affiliateLeadCount}
                        </button>
                        {link?.status === "LIVE" &&
                          (() => {
                            const cap = link?.lead_cap ?? null;
                            const remaining = link?.leads_remaining ?? null;
                            const pct = link?.quota_completion_percent ?? null;
                            return (
                              <>
                                {cap !== null && (
                                  <>
                                    <p className="text-xs text-[--color-text-muted]">
                                      Remaining:{" "}
                                      <span
                                        className={`font-medium ${
                                          remaining === 0
                                            ? "text-red-500"
                                            : pct !== null && pct >= 90
                                              ? "text-amber-500"
                                              : "text-[--color-text]"
                                        }`}
                                      >
                                        {remaining}
                                      </span>
                                    </p>
                                    <div className="flex items-center gap-2">
                                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[--color-border]">
                                        <div
                                          className={`h-full rounded-full transition-all ${
                                            pct !== null && pct >= 100
                                              ? "bg-red-500"
                                              : pct !== null && pct >= 90
                                                ? "bg-amber-500"
                                                : "bg-[--color-primary]"
                                          }`}
                                          style={{ width: `${pct ?? 0}%` }}
                                        />
                                      </div>
                                      <span className="shrink-0 text-[11px] text-[--color-text-muted]">
                                        {pct ?? 0}%
                                      </span>
                                    </div>
                                  </>
                                )}
                              </>
                            );
                          })()}
                        {isLiveAffiliate && (
                          <button
                            type="button"
                            onClick={() => setAffiliateCapModalId(a.id)}
                            className="flex items-center gap-1.5 text-left text-xs text-[--color-text-muted] hover:text-[--color-primary] transition-colors group w-fit"
                            title="Configure lead cap"
                          >
                            <Gauge
                              size={11}
                              className="shrink-0 opacity-60 group-hover:opacity-100"
                            />
                            <span className="group-hover:underline">
                              Lead cap:{" "}
                              <span className="font-medium text-[--color-text] group-hover:text-[--color-primary]">
                                {(link?.lead_cap ?? null) === null
                                  ? "Uncapped"
                                  : link!.lead_cap}
                              </span>
                            </span>
                          </button>
                        )}
                        {(() => {
                          const affiliateOverride =
                            campaign?.affiliate_overrides?.[a.id];
                          const affiliateRules =
                            affiliateOverride?.logic_rules ?? [];
                          const ruleCount = affiliateRules.length;
                          const campaignFieldNames = new Set(
                            logicRules.flatMap((r) =>
                              r.conditions.map((cond) => cond.field_name),
                            ),
                          );
                          let hasOverride = false;
                          let hasExtension = false;
                          if (campaignFieldNames.size > 0) {
                            for (const rule of affiliateRules) {
                              for (const cond of rule.conditions ?? []) {
                                if (campaignFieldNames.has(cond.field_name))
                                  hasOverride = true;
                                else hasExtension = true;
                              }
                            }
                          }
                          return (
                            <button
                              type="button"
                              onClick={() => openAffiliateLogicManager(a.id)}
                              className="flex items-center gap-1.5 text-left text-xs text-[--color-text-muted] hover:text-[--color-primary] transition-colors group w-fit"
                              title="Manage rules for this source"
                            >
                              <GitBranch
                                size={11}
                                className="shrink-0 opacity-60 group-hover:opacity-100"
                              />
                              <span className="group-hover:underline">
                                {ruleCount > 0
                                  ? `${ruleCount} rule${ruleCount !== 1 ? "s" : ""}`
                                  : "Rules"}
                              </span>
                              {hasOverride && (
                                <span className="rounded px-1 py-px text-[10px] font-semibold bg-amber-500/15 text-amber-500 leading-tight">
                                  override
                                </span>
                              )}
                              {hasExtension && (
                                <span className="rounded px-1 py-px text-[10px] font-semibold bg-blue-500/15 text-blue-400 leading-tight">
                                  extension
                                </span>
                              )}
                              <span
                                className="rounded px-1 py-px text-[10px] font-semibold leading-tight bg-purple-500/15 text-purple-400"
                                title="Uses current campaign rules"
                              >
                                inherits
                              </span>
                            </button>
                          );
                        })()}
                        {(() => {
                          const bypass = link?.validation_bypass;
                          const enabledCount = Object.values({
                            all: bypass?.all === true,
                            duplicate_check: bypass?.duplicate_check === true,
                            trusted_form_claim:
                              bypass?.trusted_form_claim === true,
                            ipqs_phone: bypass?.ipqs_phone === true,
                            ipqs_email: bypass?.ipqs_email === true,
                            ipqs_ip: bypass?.ipqs_ip === true,
                          }).filter(Boolean).length;
                          return (
                            <button
                              type="button"
                              onClick={() =>
                                setParticipantAction({
                                  type: "affiliate",
                                  id: a.id,
                                  statusDraft: link?.status || "TEST",
                                  openSkipChecks: true,
                                })
                              }
                              className="flex items-center gap-1.5 text-left text-xs text-[--color-text-muted] hover:text-[--color-primary] transition-colors group w-fit"
                              title="Configure integration overrides for this source"
                            >
                              <Plug
                                size={11}
                                className="shrink-0 opacity-60 group-hover:opacity-100"
                              />
                              <span className="group-hover:underline">
                                Integration Overrides
                                {enabledCount > 0 ? ` (${enabledCount})` : ""}
                              </span>
                            </button>
                          );
                        })()}
                        <div className="flex items-center gap-1.5 text-xs text-[--color-text-muted]">
                          <button
                            type="button"
                            title="Configure webhook"
                            onClick={() => {
                              const existing = link?.sold_pixel_config;
                              setPixelDraft(
                                existing
                                  ? {
                                      enabled: Boolean(existing.enabled),
                                      url: existing.url ?? "",
                                      method: existing.method ?? "POST",
                                      headers: existing.headers,
                                      payload_mapping:
                                        normalizePixelMappingRows(
                                          existing.payload_mapping,
                                          existing.parameter_mode ?? "query",
                                        ),
                                    }
                                  : defaultAffiliatePixelConfig(),
                              );
                              setPixelSaveAttempted(false);
                              setPixelConfigTab("pixel");
                              setPixelAffiliateId(a.id);
                            }}
                            className="flex items-center gap-1.5 text-left text-xs text-[--color-text-muted] hover:text-[--color-primary] transition-colors group w-fit"
                          >
                            <Flame
                              size={11}
                              className="shrink-0 opacity-60 group-hover:opacity-100"
                            />
                            <span className="group-hover:underline">
                              Fire pixel:{" "}
                              <span
                                className={`font-medium group-hover:no-underline ${
                                  link?.sold_pixel_config?.enabled
                                    ? "text-green-600"
                                    : "text-[--color-text-muted]"
                                }`}
                              >
                                {link?.sold_pixel_config?.enabled
                                  ? "Enabled"
                                  : "Disabled"}
                              </span>
                            </span>
                          </button>
                        </div>
                        {campaign && (
                          <button
                            type="button"
                            disabled={generatingPdfForAffiliate === a.id}
                            onClick={async () => {
                              setGeneratingPdfForAffiliate(a.id);
                              try {
                                await generatePostingInstructions({
                                  campaignId: campaign.id,
                                  affiliateId: a.id,
                                });
                              } catch (err: any) {
                                toast.error(
                                  err?.message ||
                                    "Failed to generate posting instructions",
                                );
                              } finally {
                                setGeneratingPdfForAffiliate(null);
                              }
                            }}
                            className="flex items-center gap-1 text-xs text-[--color-primary] hover:underline w-fit disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <FileText size={11} />
                            {generatingPdfForAffiliate === a.id
                              ? "Generating…"
                              : "Generate Posting Instructions"}
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-3">
                    <button
                      type="button"
                      title="Details"
                      onClick={() =>
                        setOpenInfoId(infoOpen ? null : `affiliate-${a.id}`)
                      }
                      className={`rounded p-1 transition-colors ${
                        infoOpen
                          ? "text-[--color-primary]"
                          : "text-[--color-text-muted] hover:text-[--color-primary]"
                      }`}
                    >
                      <Info size={15} />
                    </button>
                    <Button
                      size="sm"
                      className="bg-amber-500 text-white hover:bg-amber-600"
                      onClick={() =>
                        setParticipantAction({
                          type: "affiliate",
                          id: a.id,
                          statusDraft: link?.status || "TEST",
                        })
                      }
                    >
                      Actions
                    </Button>
                  </div>
                </div>
                <AnimatePresence>
                  {infoOpen && (
                    <motion.div
                      key="affiliate-info"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-[--color-border] bg-[--color-bg-muted] px-3 py-3 text-xs space-y-2">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                          <div>
                            <p className="uppercase tracking-wide text-[--color-text-muted] mb-1">
                              Company
                            </p>
                            <p className="font-medium text-[--color-text-strong]">
                              {a.company || "—"}
                            </p>
                          </div>
                          <div>
                            <p className="uppercase tracking-wide text-[--color-text-muted] mb-1">
                              Added
                            </p>
                            <p className="font-medium text-[--color-text-strong]">
                              {link?.added_at
                                ? formatDateTime(link.added_at)
                                : "—"}
                            </p>
                          </div>
                          <div className="flex flex-col items-start gap-1">
                            <HoverTooltip message="Whether this source is currently allowed to send leads to this campaign (TEST = trial mode, LIVE = active, DISABLED = blocked)">
                              <p className="uppercase tracking-wide text-[--color-text-muted] inline-flex items-center gap-1">
                                Source Campaign Status
                                <Info size={10} />
                              </p>
                            </HoverTooltip>
                            <Badge
                              tone={
                                statusColorMap[link?.status || "TEST"] ||
                                "neutral"
                              }
                            >
                              {link?.status || "TEST"}
                            </Badge>
                          </div>
                          <div>
                            <p className="uppercase tracking-wide text-[--color-text-muted] mb-1">
                              Source Status
                            </p>
                            <Badge
                              tone={
                                a.status === "ACTIVE" ? "success" : "neutral"
                              }
                            >
                              {a.status}
                            </Badge>
                          </div>
                          <div>
                            <p className="uppercase tracking-wide text-[--color-text-muted] mb-1">
                              Created By
                            </p>
                            <p className="font-medium text-[--color-text-strong]">
                              {resolveChangedBy(a.created_by) || "—"}
                            </p>
                          </div>
                          <div>
                            <p className="uppercase tracking-wide text-[--color-text-muted] mb-1">
                              Last Updated
                            </p>
                            <p className="font-medium text-[--color-text-strong]">
                              {a.updated_at
                                ? formatDateTime(a.updated_at)
                                : "—"}
                            </p>
                          </div>
                          {resolveChangedBy(a.updated_by) ? (
                            <div>
                              <p className="uppercase tracking-wide text-[--color-text-muted] mb-1">
                                Updated By
                              </p>
                              <p className="font-medium text-[--color-text-strong]">
                                {resolveChangedBy(a.updated_by)}
                              </p>
                            </div>
                          ) : null}
                          {a.affiliate_code ? (
                            <div>
                              <p className="uppercase tracking-wide text-[--color-text-muted] mb-1">
                                Source Code
                              </p>
                              <p className="font-medium font-mono text-[--color-text-strong]">
                                {a.affiliate_code}
                              </p>
                            </div>
                          ) : null}
                        </div>
                        {link?.history?.length ? (
                          <div className="mt-2 rounded border border-[--color-border] overflow-hidden">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenHistoryId(
                                  openHistoryId === `affiliate-hist-${a.id}`
                                    ? null
                                    : `affiliate-hist-${a.id}`,
                                )
                              }
                              className="flex w-full items-center justify-between px-2.5 py-1.5 text-left text-xs transition hover:bg-[--color-panel]"
                            >
                              <span className="font-semibold text-[--color-text-muted] uppercase tracking-wide">
                                Participation History
                                <span className="ml-1 font-normal normal-case">
                                  ({link.history.length})
                                </span>
                              </span>
                              <ChevronDown
                                size={12}
                                className={`text-[--color-text-muted] transition-transform duration-200 ${openHistoryId === `affiliate-hist-${a.id}` ? "rotate-180" : ""}`}
                              />
                            </button>
                            <AnimatePresence>
                              {openHistoryId === `affiliate-hist-${a.id}` && (
                                <motion.ul
                                  key="affiliate-hist"
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{
                                    duration: 0.18,
                                    ease: "easeOut",
                                  }}
                                  className="overflow-hidden divide-y divide-[--color-border] px-2.5"
                                >
                                  {link.history.map((entry, idx) => (
                                    <li
                                      key={idx}
                                      className="py-1.5 space-y-0.5"
                                    >
                                      <p className="text-[--color-text]">
                                        {entry.event === "linked" && (
                                          <>
                                            Linked — status set to{" "}
                                            <span className="font-semibold">
                                              {entry.to}
                                            </span>
                                          </>
                                        )}
                                        {entry.event === "status_changed" && (
                                          <>
                                            Status changed from{" "}
                                            <span className="font-semibold">
                                              {entry.from}
                                            </span>{" "}
                                            to{" "}
                                            <span className="font-semibold">
                                              {entry.to}
                                            </span>
                                          </>
                                        )}
                                        {entry.event === "key_rotated" && (
                                          <>Campaign key rotated</>
                                        )}
                                      </p>
                                      <p className="text-[--color-text-muted]">
                                        {formatDateTime(entry.changed_at)}
                                        {resolveChangedBy(entry.changed_by)
                                          ? ` · by ${resolveChangedBy(entry.changed_by)}`
                                          : ""}
                                      </p>
                                    </li>
                                  ))}
                                </motion.ul>
                              )}
                            </AnimatePresence>
                          </div>
                        ) : null}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
