"use client";

import type { Dispatch, SetStateAction } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Gauge,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/modal";
import { Button } from "@/components/button";
import { DisabledTooltip } from "@/components/shared-ui";
import { Badge } from "@/components/badge";
import {
  normalizeDeliveryMappingRows,
  normalizePixelMappingRows,
  defaultDeliveryConfig,
  defaultAffiliatePixelConfig,
} from "@/components/campaign-detail/utils";
import { inputClass, statusColorMap } from "@/lib/utils";
import type {
  Affiliate,
  AffiliateSoldPixelConfig,
  Campaign,
  CampaignAffiliate,
  CampaignClient,
  CampaignParticipantStatus,
  Client,
  ClientDeliveryConfig,
  CriteriaField,
  Lead,
  LogicCatalogSet,
  LogicCatalogVersion,
  LogicRule,
} from "@/lib/types";
import {
  getLogicCatalogSet,
  updateAffiliateCherryPickOverride,
} from "@/lib/api";

interface ParticipantModalsProps {
  campaign: Campaign | null;
  clients: Client[];
  affiliates: Affiliate[];
  logicRules: LogicRule[];
  criteriaFields: CriteriaField[];
  leadsForCampaign: Lead[];
  linkedClients: Client[];
  linkedAffiliates: Affiliate[];
  clientLinkMap: Map<string, CampaignClient>;
  affiliateLinkMap: Map<string, CampaignAffiliate>;
  localClientLinks: NonNullable<Campaign["clients"]>;
  localAffiliateLinks: NonNullable<Campaign["affiliates"]>;
  participantAction: {
    type: "client" | "affiliate";
    id: string;
    statusDraft: CampaignParticipantStatus;
  } | null;
  confirmRotateKey: boolean;
  participantStatusOptions: CampaignParticipantStatus[];
  participantLogicType: "affiliate" | "client" | null;
  participantLogicRules: LogicRule[];
  participantLogicLoading: boolean;
  participantLogicSaving: boolean;
  participantLogicBuilderOpen: boolean;
  participantLogicEditingRule: LogicRule | null;
  participantLogicDeletingRuleId: string | null;
  participantLogicSetId: string | null;
  participantLogicSetVersion: number | null;
  participantLogicSetName: string | null;
  participantLogicBaseSetId: string | null;
  participantLogicBaseSetVersion: number | null;
  participantLogicBaseSetName: string | null;
  participantLogicCatalogOpen: boolean;
  participantLogicCatalogLoading: boolean;
  participantLogicCatalogSets: LogicCatalogSet[];
  participantLogicApplyingCatalogId: string | null;
  participantExpandedSetId: string | null;
  participantSetVersionsMap: Record<string, LogicCatalogVersion[]>;
  participantLoadingVersionsFor: string | null;
  participantExpandedVersionRules: Set<string>;
  participantExpandedRuleDetails: Set<string>;
  saveParticipantLogicOpen: boolean;
  saveParticipantLogicMode: "new_version" | "new_set";
  saveParticipantLogicDraft: { name: string; description: string };
  savingParticipantLogicToCatalog: boolean;
  syncingClientLogicToCampaign: boolean;
  pinnedBaseLogicViewerOpen: boolean;
  pinnedBaseExpandedRules: Set<string>;
  deliveryLogicIntroClientId: string | null;
  pixelLogicIntroAffiliateId: string | null;
  localLogicSetId: string | null;
  localLogicSetName: string | null;
  localLogicSetVersion: number | null;
  logicCatalogSets: LogicCatalogSet[];
  setParticipantAction: Dispatch<
    SetStateAction<{
      type: "client" | "affiliate";
      id: string;
      statusDraft: CampaignParticipantStatus;
    } | null>
  >;
  setConfirmRotateKey: Dispatch<SetStateAction<boolean>>;
  setParticipantLogicType: Dispatch<
    SetStateAction<"affiliate" | "client" | null>
  >;
  setParticipantLogicBuilderOpen: Dispatch<SetStateAction<boolean>>;
  setParticipantLogicEditingRule: Dispatch<SetStateAction<LogicRule | null>>;
  setParticipantLogicCatalogOpen: Dispatch<SetStateAction<boolean>>;
  setParticipantExpandedSetId: Dispatch<SetStateAction<string | null>>;
  setParticipantSetVersionsMap: Dispatch<
    SetStateAction<Record<string, LogicCatalogVersion[]>>
  >;
  setParticipantLoadingVersionsFor: Dispatch<SetStateAction<string | null>>;
  setParticipantExpandedVersionRules: Dispatch<SetStateAction<Set<string>>>;
  setParticipantExpandedRuleDetails: Dispatch<SetStateAction<Set<string>>>;
  setParticipantLogicBaseSetId: Dispatch<SetStateAction<string | null>>;
  setParticipantLogicBaseSetName: Dispatch<SetStateAction<string | null>>;
  setParticipantLogicBaseSetVersion: Dispatch<SetStateAction<number | null>>;
  setSaveParticipantLogicOpen: Dispatch<SetStateAction<boolean>>;
  setSaveParticipantLogicMode: Dispatch<
    SetStateAction<"new_version" | "new_set">
  >;
  setSaveParticipantLogicDraft: Dispatch<
    SetStateAction<{ name: string; description: string }>
  >;
  setPinnedBaseLogicViewerOpen: Dispatch<SetStateAction<boolean>>;
  setPinnedBaseExpandedRules: Dispatch<SetStateAction<Set<string>>>;
  setDeliveryClientId: Dispatch<SetStateAction<string | null>>;
  setDeliveryDraft: Dispatch<SetStateAction<ClientDeliveryConfig>>;
  setDeliverySaveAttempted: Dispatch<SetStateAction<boolean>>;
  setDeliveryTab: Dispatch<SetStateAction<"request" | "response">>;
  setLocalClientLinks: Dispatch<
    SetStateAction<NonNullable<Campaign["clients"]>>
  >;
  setLocalAffiliateLinks: Dispatch<
    SetStateAction<NonNullable<Campaign["affiliates"]>>
  >;
  setAffiliateCapModalId: Dispatch<SetStateAction<string | null>>;
  setPixelDraft: Dispatch<SetStateAction<AffiliateSoldPixelConfig>>;
  setPixelSaveAttempted: Dispatch<SetStateAction<boolean>>;
  setPixelConfigTab: Dispatch<
    SetStateAction<"pixel" | "pixel_criteria" | "sold_criteria">
  >;
  setPixelAffiliateId: Dispatch<SetStateAction<string | null>>;
  setPixelLogicIntroAffiliateId: Dispatch<SetStateAction<string | null>>;
  setDeliveryLogicIntroClientId: Dispatch<SetStateAction<string | null>>;
  setParticipantLogicSetName: Dispatch<SetStateAction<string | null>>;
  handleToggleParticipantLogicRule: (rule: LogicRule) => Promise<void>;
  handleDeleteParticipantLogicRule: (ruleId: string) => Promise<void>;
  handleApplyParticipantLogicCatalog: (
    set: LogicCatalogSet,
    version?: number,
  ) => Promise<void>;
  handleSyncClientLogicToCampaign: () => Promise<void>;
  openParticipantLogicCatalog: () => void;
  saveParticipantLogicToCatalog: () => Promise<void>;
  openAffiliateLogicManager: (affiliateId: string) => void;
  openClientLogicManager: (clientId: string) => void;
  onRotateParticipantKey: (
    campaignId: string,
    type: "client" | "affiliate",
    participantId: string,
  ) => Promise<void>;
  onUpdateClientStatus: (
    campaignId: string,
    clientId: string,
    status: CampaignParticipantStatus,
  ) => Promise<void>;
  onUpdateAffiliateStatus: (
    campaignId: string,
    affiliateId: string,
    status: CampaignParticipantStatus,
  ) => Promise<void>;
  onRemoveClient: (campaignId: string, clientId: string) => Promise<void>;
  onRemoveAffiliate: (campaignId: string, affiliateId: string) => Promise<void>;
  onOpenLeadsForCampaign: (
    campaignId: string,
    options?: { affiliateId?: string; mode?: "all" | "test" | "live" },
  ) => void;
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
  normalizeFieldLabel: (label: string) => string;
  formatLogicOperatorLabel: (operator: string) => string;
  formatLogicConditionValue: (value?: string | string[]) => string;
  getLogicCatalogSet: typeof getLogicCatalogSet;
  defaultDeliveryConfig: typeof defaultDeliveryConfig;
  normalizeDeliveryMappingRows: typeof normalizeDeliveryMappingRows;
}

export function ParticipantModals(props: ParticipantModalsProps) {
  const {
    campaign,
    clients,
    affiliates,
    logicRules,
    criteriaFields,
    localClientLinks,
    localAffiliateLinks,
    participantAction,
    confirmRotateKey,
    participantStatusOptions,
    participantLogicType,
    participantLogicRules,
    participantLogicLoading,
    participantLogicSaving,
    participantLogicBuilderOpen,
    participantLogicEditingRule,
    participantLogicDeletingRuleId,
    participantLogicSetId,
    participantLogicSetVersion,
    participantLogicSetName,
    participantLogicBaseSetId,
    participantLogicBaseSetVersion,
    participantLogicBaseSetName,
    participantLogicCatalogOpen,
    participantLogicCatalogLoading,
    participantLogicCatalogSets,
    participantLogicApplyingCatalogId,
    participantExpandedSetId,
    participantSetVersionsMap,
    participantLoadingVersionsFor,
    participantExpandedVersionRules,
    participantExpandedRuleDetails,
    saveParticipantLogicOpen,
    saveParticipantLogicMode,
    saveParticipantLogicDraft,
    savingParticipantLogicToCatalog,
    syncingClientLogicToCampaign,
    pinnedBaseLogicViewerOpen,
    pinnedBaseExpandedRules,
    deliveryLogicIntroClientId,
    pixelLogicIntroAffiliateId,
    localLogicSetId,
    localLogicSetName,
    localLogicSetVersion,
    setParticipantAction,
    setConfirmRotateKey,
    setParticipantLogicType,
    setParticipantLogicBuilderOpen,
    setParticipantLogicEditingRule,
    setParticipantLogicCatalogOpen,
    setParticipantExpandedSetId,
    setParticipantSetVersionsMap,
    setParticipantLoadingVersionsFor,
    setParticipantExpandedVersionRules,
    setParticipantExpandedRuleDetails,
    setParticipantLogicBaseSetId,
    setParticipantLogicBaseSetName,
    setParticipantLogicBaseSetVersion,
    setSaveParticipantLogicOpen,
    setSaveParticipantLogicMode,
    setSaveParticipantLogicDraft,
    setPinnedBaseLogicViewerOpen,
    setPinnedBaseExpandedRules,
    setDeliveryClientId,
    setDeliveryDraft,
    setDeliverySaveAttempted,
    setDeliveryTab,
    setLocalClientLinks,
    setLocalAffiliateLinks,
    setAffiliateCapModalId,
    setPixelDraft,
    setPixelSaveAttempted,
    setPixelConfigTab,
    setPixelAffiliateId,
    setPixelLogicIntroAffiliateId,
    setDeliveryLogicIntroClientId,
    setParticipantLogicSetName,
    logicCatalogSets,
    handleToggleParticipantLogicRule,
    handleDeleteParticipantLogicRule,
    handleApplyParticipantLogicCatalog,
    handleSyncClientLogicToCampaign,
    openParticipantLogicCatalog,
    saveParticipantLogicToCatalog,
    openAffiliateLogicManager,
    openClientLogicManager,
    onRotateParticipantKey,
    onUpdateClientStatus,
    onUpdateAffiliateStatus,
    onRemoveClient,
    onRemoveAffiliate,
    onOpenLeadsForCampaign,
    resolveChangedBy,
    normalizeFieldLabel,
    formatLogicOperatorLabel,
    formatLogicConditionValue,
    leadsForCampaign,
    linkedClients,
    linkedAffiliates,
    clientLinkMap,
    affiliateLinkMap,
    getLogicCatalogSet,
    defaultDeliveryConfig,
    normalizeDeliveryMappingRows,
  } = props as ParticipantModalsProps;

  if (!campaign) return null;

  const isClient = participantAction?.type === "client";
  const pid = participantAction?.id ?? "";
  const hasLeads = leadsForCampaign?.length > 0;
  const isOnly = isClient
    ? linkedClients?.length <= 1
    : linkedAffiliates?.length <= 1;
  const cantRemove = isOnly || hasLeads;
  const removeReason = hasLeads
    ? `This campaign has ${leadsForCampaign.length} lead${
        leadsForCampaign.length === 1 ? "" : "s"
      }. Removing a participant would break lead history and data consistency. Set their status to DISABLED to stop receiving new leads.`
    : isOnly
      ? `At least one ${isClient ? "client" : "affiliate"} must remain linked to the campaign.`
      : "";
  const currentLink = isClient
    ? clientLinkMap?.get(pid)
    : affiliateLinkMap?.get(pid);
  const participant = isClient
    ? clients?.find((c: any) => c.id === pid)
    : affiliates?.find((a: any) => a.id === pid);

  return (
    <>
      {participantAction && (
        <Modal
          title={`${isClient ? "Client" : "Affiliate"} Actions \u2014 ${participant?.name || pid}`}
          isOpen
          onClose={() => {
            setParticipantAction(null);
            setConfirmRotateKey(false);
          }}
          width={420}
          bodyClassName="px-5 py-4 max-h-[70vh] overflow-y-auto"
        >
          <div className="space-y-5 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-[--color-text-muted]">Current status:</span>
              <Badge
                tone={
                  statusColorMap[currentLink?.status || "TEST"] || "neutral"
                }
              >
                {currentLink?.status || "TEST"}
              </Badge>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                Update Status
              </p>
              <div className="flex items-center gap-2">
                <select
                  className={inputClass}
                  value={participantAction.statusDraft}
                  onChange={(e) =>
                    setParticipantAction((prev) =>
                      prev
                        ? {
                            ...prev,
                            statusDraft: e.target
                              .value as CampaignParticipantStatus,
                          }
                        : null,
                    )
                  }
                >
                  {participantStatusOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  onClick={async () => {
                    if (
                      isClient &&
                      participantAction.statusDraft === "LIVE" &&
                      !(currentLink as CampaignClient)?.delivery_config?.url
                    ) {
                      toast.error(
                        "Delivery config required — set up a delivery endpoint for this client before switching to LIVE.",
                      );
                      return;
                    }
                    if (isClient) {
                      await onUpdateClientStatus(
                        campaign.id,
                        pid,
                        participantAction.statusDraft,
                      );
                      setLocalClientLinks((prev) =>
                        prev.map((l) =>
                          l.client_id === pid
                            ? {
                                ...l,
                                status: participantAction.statusDraft,
                              }
                            : l,
                        ),
                      );
                    } else {
                      await onUpdateAffiliateStatus(
                        campaign.id,
                        pid,
                        participantAction.statusDraft,
                      );
                      setLocalAffiliateLinks((prev) =>
                        prev.map((l) =>
                          l.affiliate_id === pid
                            ? {
                                ...l,
                                status: participantAction.statusDraft,
                              }
                            : l,
                        ),
                      );
                    }
                    setParticipantAction(null);
                  }}
                >
                  Save
                </Button>
              </div>
            </div>

            {!isClient && (
              <div className="space-y-2 border-t border-[--color-border] pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                  Key Management
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  iconLeft={<RotateCcw size={13} />}
                  onClick={() => setConfirmRotateKey(true)}
                >
                  Generate New Campaign Key
                </Button>
                <p className="text-xs text-[--color-text-muted]">
                  Issues a fresh key for this affiliate. Share the new key — the
                  old one stops working immediately.
                </p>
                <Modal
                  title="Rotate Campaign Key?"
                  isOpen={confirmRotateKey}
                  onClose={() => setConfirmRotateKey(false)}
                  width={420}
                >
                  <p className="text-sm text-[--color-text]">
                    A new key will be generated immediately. Any leads submitted
                    using the current key will be{" "}
                    <strong className="text-[--color-text-strong]">
                      rejected
                    </strong>{" "}
                    until the affiliate updates to the new key.
                  </p>
                  <div className="mt-5 flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmRotateKey(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      iconLeft={<RotateCcw size={13} />}
                      onClick={async () => {
                        await onRotateParticipantKey(
                          campaign.id,
                          "affiliate",
                          pid,
                        );
                        setConfirmRotateKey(false);
                        setParticipantAction(null);
                      }}
                    >
                      Yes, Rotate Key
                    </Button>
                  </div>
                </Modal>
              </div>
            )}

            {!isClient && currentLink?.status === "LIVE" && (
              <div className="space-y-2 border-t border-[--color-border] pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                  Lead Cap
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  iconLeft={<Gauge size={13} />}
                  onClick={() => {
                    setAffiliateCapModalId(pid);
                    setParticipantAction(null);
                  }}
                >
                  Configure Lead Cap
                </Button>
                <p className="text-xs text-[--color-text-muted]">
                  Set a maximum number of leads this affiliate can send per
                  campaign.
                </p>
              </div>
            )}

            {!isClient && (
              <div className="space-y-2 border-t border-[--color-border] pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                  Fire Pixel
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const existing = (
                      currentLink as CampaignAffiliate | undefined
                    )?.sold_pixel_config;
                    setPixelDraft(
                      existing
                        ? {
                            enabled: Boolean(existing.enabled),
                            url: existing.url ?? "",
                            method: existing.method ?? "POST",
                            headers: existing.headers,
                            payload_mapping: normalizePixelMappingRows(
                              existing.payload_mapping,
                              existing.parameter_mode ?? "query",
                            ),
                          }
                        : defaultAffiliatePixelConfig(),
                    );
                    setPixelSaveAttempted(false);
                    setPixelConfigTab("pixel");
                    setPixelAffiliateId(pid);
                    setParticipantAction(null);
                  }}
                >
                  Configure Fire Pixel
                </Button>
                <p className="text-xs text-[--color-text-muted]">
                  Fire-and-forget callback sent only when this affiliate&apos;s
                  lead is sold.
                </p>
              </div>
            )}

            {!isClient && (
              <div className="space-y-2 border-t border-[--color-border] pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                  Cherry Pick Override
                </p>
                <div className="flex items-center gap-3">
                  <select
                    className="rounded-lg border border-[--color-border] bg-[--color-bg] px-2.5 py-1.5 text-xs text-[--color-text] focus:outline-none focus:ring-2 focus:ring-[--color-primary]/40"
                    value={
                      (currentLink as CampaignAffiliate | undefined)
                        ?.cherry_pick_override === true
                        ? "true"
                        : (currentLink as CampaignAffiliate | undefined)
                              ?.cherry_pick_override === false
                          ? "false"
                          : "inherit"
                    }
                    onChange={async (e) => {
                      const raw = e.target.value;
                      const val =
                        raw === "true" ? true : raw === "false" ? false : null;
                      try {
                        const res = await updateAffiliateCherryPickOverride(
                          campaign!.id,
                          pid,
                          val,
                        );
                        if (res.success) {
                          toast.success("Cherry pick override updated.");
                          setLocalAffiliateLinks((prev) =>
                            prev.map((l) =>
                              l.affiliate_id === pid
                                ? {
                                    ...l,
                                    cherry_pick_override: val ?? undefined,
                                  }
                                : l,
                            ),
                          );
                        } else {
                          toast.error(
                            (res as any).message || "Failed to update override",
                          );
                        }
                      } catch {
                        toast.error("Failed to update cherry pick override.");
                      }
                    }}
                  >
                    <option value="inherit">
                      Inherit from campaign (
                      {campaign?.default_cherry_pickable
                        ? "enabled"
                        : "disabled"}
                      )
                    </option>
                    <option value="true">Always cherry-pickable</option>
                    <option value="false">Never cherry-pickable</option>
                  </select>
                </div>
                <p className="text-xs text-[--color-text-muted]">
                  Controls whether rejected leads from this affiliate are
                  automatically marked as cherry-pickable.
                </p>
              </div>
            )}

            {!isClient && (
              <div className="space-y-2 border-t border-[--color-border] pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                  Logic Rules
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    openAffiliateLogicManager(pid);
                    setParticipantAction(null);
                  }}
                >
                  Manage Logic Rules
                </Button>
                <p className="text-xs text-[--color-text-muted]">
                  Override or extend the campaign logic rules for this affiliate
                  specifically.
                </p>
              </div>
            )}

            {isClient && (
              <div className="space-y-2 border-t border-[--color-border] pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                  Delivery Configuration
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const existing = (currentLink as CampaignClient | undefined)
                      ?.delivery_config;
                    setDeliveryDraft(
                      existing
                        ? {
                            url: existing.url ?? "",
                            method: existing.method ?? "POST",
                            headers: existing.headers,
                            payload_mapping: normalizeDeliveryMappingRows(
                              existing.payload_mapping,
                            ),
                            acceptance_rules:
                              existing.acceptance_rules?.length > 0
                                ? existing.acceptance_rules
                                : [],
                          }
                        : defaultDeliveryConfig(),
                    );
                    setDeliverySaveAttempted(false);
                    setDeliveryTab("request");
                    setDeliveryClientId(pid);
                    setParticipantAction(null);
                  }}
                >
                  Configure Delivery
                </Button>
                <p className="text-xs text-[--color-text-muted]">
                  Set the endpoint and payload mapping for delivering leads to
                  this client.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openClientLogicManager(pid)}
                >
                  Manage Logic Rules
                </Button>
                <p className="text-xs text-[--color-text-muted]">
                  Override or extend the campaign logic rules for this client
                  specifically.
                </p>
              </div>
            )}

            <div className="space-y-2 border-t border-[--color-border] pt-4">
              <DisabledTooltip message={removeReason}>
                <button
                  type="button"
                  disabled={cantRemove}
                  className={`w-full rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    cantRemove
                      ? "cursor-not-allowed border-[--color-border] text-[--color-text-muted] opacity-40"
                      : "border-[--color-danger] text-[--color-danger] hover:bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)]"
                  }`}
                  onClick={async () => {
                    if (cantRemove) return;
                    if (isClient) {
                      await onRemoveClient(campaign.id, pid);
                      setLocalClientLinks((prev) =>
                        prev.filter((l) => l.client_id !== pid),
                      );
                    } else {
                      await onRemoveAffiliate(campaign.id, pid);
                      setLocalAffiliateLinks((prev) =>
                        prev.filter((l) => l.affiliate_id !== pid),
                      );
                    }
                    setParticipantAction(null);
                  }}
                >
                  Remove from Campaign
                </button>
              </DisabledTooltip>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Participant Logic Rules Modal ────────────────────────────────── */}
      <Modal
        title={
          pixelLogicIntroAffiliateId
            ? `Affiliate Logic Rules — ${affiliates.find((a) => a.id === pixelLogicIntroAffiliateId)?.name || pixelLogicIntroAffiliateId}`
            : deliveryLogicIntroClientId
              ? `Client Logic Rules — ${clients.find((c) => c.id === deliveryLogicIntroClientId)?.name || deliveryLogicIntroClientId}`
              : "Logic Rules"
        }
        isOpen={!!(pixelLogicIntroAffiliateId || deliveryLogicIntroClientId)}
        onClose={() => {
          setPixelLogicIntroAffiliateId(null);
          setDeliveryLogicIntroClientId(null);
          setParticipantLogicCatalogOpen(false);
          setParticipantLogicSetName(null);
          setParticipantLogicBaseSetId(null);
          setParticipantLogicBaseSetVersion(null);
          setParticipantLogicBaseSetName(null);
          setSaveParticipantLogicOpen(false);
          setSaveParticipantLogicDraft({ name: "", description: "" });
        }}
        width={720}
        bodyClassName="px-5 py-4 h-[620px] max-h-[80vh] overflow-hidden"
      >
        <div className="flex h-full min-h-0 flex-col gap-4">
          {/* Catalog applied badge */}
          {participantLogicSetId && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
              Applied from catalog:{" "}
              <strong>
                {participantLogicSetName ??
                  participantLogicCatalogSets.find(
                    (s) => s.id === participantLogicSetId,
                  )?.name ??
                  participantLogicSetId}
              </strong>{" "}
              v{participantLogicSetVersion}
            </div>
          )}

          {!participantLogicSetId &&
            participantLogicBaseSetId &&
            participantLogicBaseSetVersion != null && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                Modified from catalog:{" "}
                <strong>
                  {participantLogicBaseSetName ?? participantLogicBaseSetId}
                </strong>{" "}
                v{participantLogicBaseSetVersion}. Save to catalog to create a
                new version or new set.
              </div>
            )}

          {localLogicSetId && localLogicSetVersion != null && (
            <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] text-sky-700">
              Base campaign logic:{" "}
              <strong>
                {localLogicSetName ??
                  logicCatalogSets.find((s) => s.id === localLogicSetId)
                    ?.name ??
                  localLogicSetId}
              </strong>{" "}
              <button
                type="button"
                className="underline decoration-dotted underline-offset-2 hover:text-sky-900 transition-colors"
                onClick={() => {
                  setPinnedBaseExpandedRules(new Set());
                  setPinnedBaseLogicViewerOpen(true);
                }}
              >
                v{localLogicSetVersion} — view rules
              </button>
              . Participants inherit campaign logic automatically.
            </div>
          )}

          {participantLogicCatalogOpen ? (
            /* ── Catalog browser ── */
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                  Logic Catalog
                </p>
                <button
                  type="button"
                  onClick={() => setParticipantLogicCatalogOpen(false)}
                  className="text-[--color-text-muted] hover:text-[--color-text] transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
              {participantLogicCatalogLoading ? (
                <p className="text-sm text-[--color-text-muted]">Loading…</p>
              ) : participantLogicCatalogSets.length === 0 ? (
                <p className="text-sm text-[--color-text-muted]">
                  No logic catalog sets found.
                </p>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto divide-y divide-[--color-border] rounded-xl border border-[--color-border]">
                  {participantLogicCatalogSets.map((set) => (
                    <div key={set.id}>
                      <div
                        className="flex items-center gap-3 px-4 py-3 bg-[--color-bg] hover:bg-[--color-bg-muted] transition-colors cursor-pointer"
                        onClick={async () => {
                          if (participantExpandedSetId === set.id) {
                            setParticipantExpandedSetId(null);
                            return;
                          }
                          setParticipantExpandedSetId(set.id);
                          if (participantSetVersionsMap[set.id]) return;
                          setParticipantLoadingVersionsFor(set.id);
                          try {
                            const res = await getLogicCatalogSet(set.id);
                            if (res.success) {
                              setParticipantSetVersionsMap((prev) => ({
                                ...prev,
                                [set.id]: res.data.versions,
                              }));
                            }
                          } catch {
                            toast.error(
                              "Failed to load logic catalog versions.",
                            );
                          } finally {
                            setParticipantLoadingVersionsFor(null);
                          }
                        }}
                      >
                        <span className="text-[--color-text-muted]">
                          {participantExpandedSetId === set.id ? (
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
                            {participantLogicSetId === set.id && (
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
                        {participantExpandedSetId === set.id && (
                          <motion.div
                            key={`participant-logic-versions-${set.id}`}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            style={{ overflow: "hidden" }}
                            className="bg-[--color-bg-muted] border-t border-[--color-border]"
                          >
                            {participantLoadingVersionsFor === set.id ? (
                              <p className="px-6 py-3 text-xs text-[--color-text-muted]">
                                Loading versions…
                              </p>
                            ) : (participantSetVersionsMap[set.id] ?? [])
                                .length === 0 ? (
                              <p className="px-6 py-3 text-xs text-[--color-text-muted]">
                                No versions found.
                              </p>
                            ) : (
                              [...(participantSetVersionsMap[set.id] ?? [])]
                                .sort((a, b) => b.version - a.version)
                                .map((version) => {
                                  const isApplied =
                                    participantLogicSetId === set.id &&
                                    participantLogicSetVersion ===
                                      version.version;
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
                                            setParticipantExpandedVersionRules(
                                              (prev) => {
                                                const next = new Set(prev);
                                                if (next.has(applyKey))
                                                  next.delete(applyKey);
                                                else next.add(applyKey);
                                                return next;
                                              },
                                            );
                                          }}
                                          className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                                        >
                                          <span className="text-[--color-text-muted]">
                                            {participantExpandedVersionRules.has(
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
                                            {version.rules.length !== 1
                                              ? "s"
                                              : ""}
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
                                            disabled={
                                              participantLogicApplyingCatalogId !==
                                              null
                                            }
                                            onClick={() =>
                                              handleApplyParticipantLogicCatalog(
                                                set,
                                                version.version,
                                              )
                                            }
                                            className="inline-flex items-center gap-1 rounded-md border border-[--color-border] bg-[--color-surface] px-2.5 py-1 text-[11px] font-medium text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-bg] disabled:opacity-50 transition-colors"
                                          >
                                            {participantLogicApplyingCatalogId ===
                                            applyKey
                                              ? "Applying…"
                                              : "Apply"}
                                          </button>
                                        )}
                                      </div>

                                      <AnimatePresence initial={false}>
                                        {participantExpandedVersionRules.has(
                                          applyKey,
                                        ) && (
                                          <motion.div
                                            key={`participant-logic-rules-${applyKey}`}
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{
                                              height: "auto",
                                              opacity: 1,
                                            }}
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
                                                  const condCount =
                                                    rule.groups.reduce(
                                                      (acc, group) =>
                                                        acc +
                                                        group.conditions.length,
                                                      0,
                                                    );
                                                  return (
                                                    <div
                                                      key={rule.id}
                                                      className="rounded-md border border-[--color-border] bg-[--color-bg-muted]"
                                                    >
                                                      <button
                                                        type="button"
                                                        onClick={() => {
                                                          setParticipantExpandedRuleDetails(
                                                            (prev) => {
                                                              const next =
                                                                new Set(prev);
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
                                                          {participantExpandedRuleDetails.has(
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
                                                        <span
                                                          className={`rounded px-1.5 py-0.5 font-semibold ${
                                                            rule.action ===
                                                            "pass"
                                                              ? "bg-green-500/10 text-green-600"
                                                              : "bg-red-500/10 text-red-500"
                                                          }`}
                                                        >
                                                          {rule.action ===
                                                          "pass"
                                                            ? "Pass"
                                                            : "Fail"}
                                                        </span>
                                                        <span className="flex-1 truncate text-[--color-text] text-left">
                                                          {rule.name}
                                                        </span>
                                                        <span className="shrink-0 text-[10px] text-[--color-text-muted]">
                                                          {rule.groups.length}{" "}
                                                          group
                                                          {rule.groups
                                                            .length !== 1
                                                            ? "s"
                                                            : ""}{" "}
                                                          · {condCount} cond.
                                                        </span>
                                                      </button>
                                                      <AnimatePresence
                                                        initial={false}
                                                      >
                                                        {participantExpandedRuleDetails.has(
                                                          ruleDetailKey,
                                                        ) && (
                                                          <motion.div
                                                            key={`participant-logic-rule-detail-${ruleDetailKey}`}
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
                                                              overflow:
                                                                "hidden",
                                                            }}
                                                            className="border-t border-[--color-border] bg-[--color-bg] px-3 py-2"
                                                          >
                                                            <div className="space-y-2">
                                                              {rule.groups.map(
                                                                (
                                                                  group,
                                                                  groupIdx,
                                                                ) => (
                                                                  <div
                                                                    key={`${rule.id}-group-${groupIdx}`}
                                                                    className="rounded-md border border-[--color-border] bg-[--color-bg-muted] p-2"
                                                                  >
                                                                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
                                                                      Group{" "}
                                                                      {groupIdx +
                                                                        1}
                                                                    </p>
                                                                    <div className="space-y-1">
                                                                      {group.conditions.map(
                                                                        (
                                                                          condition,
                                                                          condIdx,
                                                                        ) => (
                                                                          <p
                                                                            key={`${rule.id}-group-${groupIdx}-cond-${condIdx}`}
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
                                                                  </div>
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
          ) : (
            /* ── Rules list ── */
            <>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {participantLogicLoading ? (
                  <p className="text-sm text-[--color-text-muted]">Loading…</p>
                ) : participantLogicRules.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[--color-border] py-12 text-center text-sm text-[--color-text-muted]">
                    No logic rules yet.{" "}
                    <button
                      type="button"
                      className="text-[--color-primary] hover:underline"
                      onClick={() => {
                        setParticipantLogicEditingRule(null);
                        setParticipantLogicBuilderOpen(true);
                      }}
                    >
                      Add one
                    </button>
                    .
                  </div>
                ) : (
                  <div className="space-y-2">
                    {participantLogicRules.map((rule) => (
                      <div
                        key={rule.id}
                        className="flex items-center gap-3 rounded-xl border border-[--color-border] bg-[--color-bg] px-4 py-3"
                      >
                        {/* Enable toggle */}
                        <button
                          type="button"
                          onClick={() => handleToggleParticipantLogicRule(rule)}
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
                            setParticipantLogicEditingRule(rule);
                            setParticipantLogicBuilderOpen(true);
                          }}
                          className="shrink-0 text-[--color-text-muted] hover:text-[--color-text] transition-colors"
                        >
                          <Pencil size={13} />
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          disabled={participantLogicDeletingRuleId === rule.id}
                          onClick={() =>
                            handleDeleteParticipantLogicRule(rule.id)
                          }
                          className="shrink-0 text-[--color-text-muted] hover:text-red-500 transition-colors disabled:opacity-40"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer actions */}
              <div className="flex items-center justify-between border-t border-[--color-border] pt-3">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    iconLeft={<Plus size={14} />}
                    onClick={() => {
                      setParticipantLogicEditingRule(null);
                      setParticipantLogicBuilderOpen(true);
                    }}
                  >
                    Add Rule
                  </Button>
                  {participantLogicRules.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSaveParticipantLogicMode(
                          participantLogicBaseSetId ? "new_version" : "new_set",
                        );
                        setSaveParticipantLogicDraft({
                          name: participantLogicBaseSetName ?? "",
                          description: "",
                        });
                        setSaveParticipantLogicOpen(true);
                      }}
                    >
                      Save to Catalog
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {participantLogicType === "client" &&
                    deliveryLogicIntroClientId && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={syncingClientLogicToCampaign}
                        onClick={handleSyncClientLogicToCampaign}
                      >
                        {syncingClientLogicToCampaign
                          ? "Syncing…"
                          : "Sync to Campaign Logic"}
                      </Button>
                    )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={openParticipantLogicCatalog}
                  >
                    Apply from Logic Catalog
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* ── Pinned Base Campaign Logic Viewer ─────────────────────────── */}
      <Modal
        title={`Base Campaign Logic — ${localLogicSetName ?? localLogicSetId ?? "Campaign"} v${localLogicSetVersion ?? "?"}`}
        isOpen={pinnedBaseLogicViewerOpen}
        onClose={() => setPinnedBaseLogicViewerOpen(false)}
        width={620}
        bodyClassName="px-5 py-4 max-h-[70vh] overflow-y-auto"
      >
        <div className="space-y-2">
          {logicRules.length === 0 ? (
            <p className="text-sm text-[--color-text-muted]">
              No campaign-level logic rules defined.
            </p>
          ) : (
            logicRules.map((rule: any) => {
              const expanded = pinnedBaseExpandedRules.has(rule.id);
              return (
                <div
                  key={rule.id}
                  className="rounded-lg border border-[--color-border] bg-[--color-bg]"
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left"
                    onClick={() =>
                      setPinnedBaseExpandedRules((prev) => {
                        const next = new Set(prev);
                        if (next.has(rule.id)) next.delete(rule.id);
                        else next.add(rule.id);
                        return next;
                      })
                    }
                  >
                    <ChevronRight
                      size={14}
                      className={`shrink-0 text-[--color-text-muted] transition-transform ${expanded ? "rotate-90" : ""}`}
                    />
                    <span className="flex-1 text-sm font-medium text-[--color-text]">
                      {rule.name}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        rule.action === "pass"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {rule.action}
                    </span>
                    {!rule.enabled && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-500">
                        disabled
                      </span>
                    )}
                  </button>
                  {expanded && (
                    <div className="border-t border-[--color-border] px-3 py-2 space-y-2">
                      {(rule.groups ?? []).map((group: any, gi: number) => (
                        <div
                          key={group.id ?? gi}
                          className="rounded-md border border-[--color-border] bg-[--color-bg-muted] px-3 py-2"
                        >
                          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
                            Group {gi + 1}{" "}
                            <span className="font-normal">
                              (all conditions must match)
                            </span>
                          </p>
                          <div className="space-y-1">
                            {(group.conditions ?? []).map(
                              (cond: any, ci: number) => (
                                <div
                                  key={cond.id ?? ci}
                                  className="flex items-center gap-2 text-xs text-[--color-text]"
                                >
                                  <span className="font-mono text-[--color-primary]">
                                    {cond.field_name}
                                  </span>
                                  <span className="text-[--color-text-muted]">
                                    {(cond.operator ?? "").replace(/_/g, " ")}
                                  </span>
                                  {cond.value !== undefined && (
                                    <span className="font-medium">
                                      {Array.isArray(cond.value)
                                        ? cond.value.join(", ")
                                        : String(cond.value)}
                                    </span>
                                  )}
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      ))}
                      {(!rule.groups || rule.groups.length === 0) && (
                        <p className="text-xs text-[--color-text-muted]">
                          No condition groups defined.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Modal>

      {/* ── Save participant logic to catalog ───────────────────────────── */}
      <Modal
        title="Save Logic Rules to Catalog"
        isOpen={saveParticipantLogicOpen}
        onClose={() => setSaveParticipantLogicOpen(false)}
        width={470}
      >
        <div className="space-y-4 text-sm">
          <p className="text-[13px] text-[--color-text-muted]">
            Save these participant-specific rules as either a new version of the
            active logic catalog entry or as a brand new catalog set.
          </p>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-[--color-text-muted]">
              Save Mode
            </label>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                disabled={!participantLogicBaseSetId}
                onClick={() => setSaveParticipantLogicMode("new_version")}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                  saveParticipantLogicMode === "new_version"
                    ? "border-[--color-primary] bg-[--color-primary]/10"
                    : "border-[--color-border] bg-[--color-bg]"
                } ${!participantLogicBaseSetId ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <p className="text-xs font-medium text-[--color-text]">
                  Save as new version
                </p>
                <p className="text-[11px] text-[--color-text-muted]">
                  {participantLogicBaseSetId
                    ? `Adds a version to ${participantLogicBaseSetName ?? participantLogicBaseSetId}.`
                    : "No active catalog applied on this participant yet."}
                </p>
              </button>
              <button
                type="button"
                onClick={() => setSaveParticipantLogicMode("new_set")}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                  saveParticipantLogicMode === "new_set"
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
              Set Name{saveParticipantLogicMode === "new_set" ? " *" : ""}
            </label>
            <input
              type="text"
              value={saveParticipantLogicDraft.name}
              onChange={(e) =>
                setSaveParticipantLogicDraft((draft) => ({
                  ...draft,
                  name: e.target.value,
                }))
              }
              placeholder="e.g. Happy Law Overrides"
              className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] placeholder:text-[--color-text-muted] focus:outline-none focus:ring-1 focus:ring-[--color-primary]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wide text-[--color-text-muted]">
              Description
            </label>
            <input
              type="text"
              value={saveParticipantLogicDraft.description}
              onChange={(e) =>
                setSaveParticipantLogicDraft((draft) => ({
                  ...draft,
                  description: e.target.value,
                }))
              }
              placeholder="Optional"
              className="w-full rounded-md border border-[--color-border] bg-[--color-bg] px-3 py-2 text-sm text-[--color-text] placeholder:text-[--color-text-muted] focus:outline-none focus:ring-1 focus:ring-[--color-primary]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSaveParticipantLogicOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={
                savingParticipantLogicToCatalog ||
                (saveParticipantLogicMode === "new_set" &&
                  !saveParticipantLogicDraft.name.trim())
              }
              onClick={saveParticipantLogicToCatalog}
            >
              {savingParticipantLogicToCatalog ? "Saving…" : "Save & Apply"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
