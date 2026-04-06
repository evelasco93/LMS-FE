"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  GitBranch,
  Info,
  AlertTriangle,
  Settings2,
  UserPlus,
} from "lucide-react";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { SectionLabel } from "@/components/ui/section-label";
import { HoverTooltip } from "@/components/ui/hover-tooltip";
import { formatDateTime, statusColorMap } from "@/lib/utils";
import type {
  Campaign,
  Client,
  ClientDeliveryConfig,
  CampaignClient,
  CampaignParticipantStatus,
  LogicRule,
} from "@/lib/types";
import { defaultDeliveryConfig } from "./utils";

export function ClientsTab({
  campaign,
  clients,
  linkedClients,
  clientLinkMap,
  availableClients,
  logicRules,
  getClientLeadMode,
  getClientLeadCount,
  resolveChangedBy,
  onOpenLeadsForCampaign,
  openClientLogicManager,
  setDeliveryDraft,
  setDeliveryTab,
  setDeliveryClientId,
  setLinkClientModalOpen,
  setParticipantAction,
  onNavigateToSettings,
}: {
  campaign: Campaign;
  clients: Client[];
  linkedClients: Client[];
  clientLinkMap: Map<string, CampaignClient>;
  availableClients: Client[];
  logicRules: LogicRule[];
  getClientLeadMode: (link?: CampaignClient) => "all" | "test" | "live";
  getClientLeadCount: (link?: CampaignClient) => number;
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
  openClientLogicManager: (clientId: string) => void;
  setDeliveryDraft: (config: ClientDeliveryConfig) => void;
  setDeliveryTab: (tab: "request" | "response") => void;
  setDeliveryClientId: (id: string | null) => void;
  setLinkClientModalOpen: (open: boolean) => void;
  setParticipantAction: (
    action: {
      type: "client" | "affiliate";
      id: string;
      statusDraft: CampaignParticipantStatus;
    } | null,
  ) => void;
  onNavigateToSettings?: (subTab: "base-criteria" | "logic") => void;
}) {
  const [openInfoId, setOpenInfoId] = useState<string | null>(null);
  const [openHistoryId, setOpenHistoryId] = useState<string | null>(null);

  const missingCriteria = !campaign?.criteria_set_id;
  const missingLogic = !campaign?.logic_set_id;
  const missingConfig = missingCriteria || missingLogic;

  return (
    <div className="space-y-3">
      {missingConfig && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-sm text-[--color-text]">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />
          <div>
            <p className="font-medium">Missing configuration</p>
            <p className="mt-0.5 text-xs text-[--color-text-muted]">
              Before adding clients you need to set up{" "}
              {missingCriteria && (
                <button
                  type="button"
                  className="font-semibold text-[--color-primary] hover:underline"
                  onClick={() => onNavigateToSettings?.("base-criteria")}
                >
                  criteria questions
                </button>
              )}
              {missingCriteria && missingLogic && " and "}
              {missingLogic && (
                <button
                  type="button"
                  className="font-semibold text-[--color-primary] hover:underline"
                  onClick={() => onNavigateToSettings?.("logic")}
                >
                  logical validations
                </button>
              )}
              .
            </p>
          </div>
        </div>
      )}
      <div className="mb-2 flex items-center justify-between gap-3">
        <SectionLabel>Linked Clients</SectionLabel>
        <Button
          size="sm"
          iconLeft={<UserPlus size={14} />}
          disabled={missingConfig || availableClients.length === 0}
          onClick={() => setLinkClientModalOpen(true)}
          data-tour="btn-add-client"
        >
          Add Client
        </Button>
      </div>
      <div className="space-y-2 text-sm">
        {linkedClients.length === 0 ? (
          <p className="text-[--color-text-muted]">No linked clients yet.</p>
        ) : (
          linkedClients.map((c) => {
            const link = clientLinkMap.get(c.id);
            const infoOpen = openInfoId === `client-${c.id}`;
            return (
              <div
                key={c.id}
                className="rounded-md bg-[--color-panel] overflow-hidden"
              >
                <div className="flex items-center justify-between px-3 py-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[--color-text-strong]">
                        {c.name}
                      </span>
                      <span
                        className="text-xs text-[--color-text-muted] font-mono cursor-help"
                        title="Client ID"
                      >
                        ({c.id})
                      </span>
                      <Badge
                        tone={
                          statusColorMap[link?.status || "TEST"] || "neutral"
                        }
                      >
                        {link?.status || "TEST"}
                      </Badge>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onOpenLeadsForCampaign(campaign.id, {
                          mode: getClientLeadMode(link),
                        })
                      }
                      className="mt-1 text-left text-xs text-[--color-text-muted] hover:text-[--color-primary] hover:underline"
                    >
                      Leads sold: {getClientLeadCount(link)}
                    </button>
                    {(() => {
                      const clientOverride = campaign?.client_overrides?.[c.id];
                      const clientRules = clientOverride?.logic_rules ?? [];
                      const ruleCount = clientRules.length;
                      const campaignFieldNames = new Set(
                        logicRules.flatMap((r) =>
                          r.groups.flatMap((g) =>
                            g.conditions.map((cond) => cond.field_name),
                          ),
                        ),
                      );
                      let hasOverride = false;
                      let hasExtension = false;
                      if (campaignFieldNames.size > 0) {
                        for (const rule of clientRules) {
                          for (const group of rule.groups) {
                            for (const cond of group.conditions) {
                              if (campaignFieldNames.has(cond.field_name))
                                hasOverride = true;
                              else hasExtension = true;
                            }
                          }
                        }
                      }
                      return (
                        <button
                          type="button"
                          onClick={() => openClientLogicManager(c.id)}
                          className="mt-1 flex items-center gap-1.5 text-left text-xs text-[--color-text-muted] hover:text-[--color-primary] transition-colors group"
                          title="Manage logic rules for this client"
                        >
                          <GitBranch
                            size={11}
                            className="shrink-0 opacity-60 group-hover:opacity-100"
                          />
                          <span className="group-hover:underline">
                            {ruleCount > 0
                              ? `${ruleCount} logic rule${ruleCount !== 1 ? "s" : ""}`
                              : "Logic rules"}
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
                            title="Uses current campaign logic rules"
                          >
                            inherits
                          </span>
                        </button>
                      );
                    })()}
                    <button
                      type="button"
                      onClick={() => {
                        const existing = link?.delivery_config;
                        setDeliveryDraft(
                          existing
                            ? {
                                url: existing.url ?? "",
                                method: existing.method ?? "POST",
                                headers: existing.headers,
                                payload_mapping:
                                  existing.payload_mapping?.length > 0
                                    ? existing.payload_mapping
                                    : [],
                                acceptance_rules:
                                  existing.acceptance_rules?.length > 0
                                    ? existing.acceptance_rules
                                    : [],
                              }
                            : defaultDeliveryConfig(),
                        );
                        setDeliveryTab("request");
                        setDeliveryClientId(c.id);
                      }}
                      className="mt-1 flex items-center gap-1 text-left text-xs text-[--color-text-muted] hover:text-[--color-primary] transition-colors group"
                      title="Configure delivery endpoint"
                    >
                      <Settings2
                        size={11}
                        className="shrink-0 opacity-60 group-hover:opacity-100"
                      />
                      <span className="group-hover:underline">
                        Configure delivery
                      </span>
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-3">
                    <button
                      type="button"
                      title="Details"
                      onClick={() =>
                        setOpenInfoId(infoOpen ? null : `client-${c.id}`)
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
                          type: "client",
                          id: c.id,
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
                      key="client-info"
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
                              Email
                            </p>
                            <p className="font-medium text-[--color-text-strong]">
                              {c.email || "—"}
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
                            <HoverTooltip message="Whether this client is currently allowed to receive leads from this campaign (TEST = trial mode, LIVE = active, DISABLED = blocked)">
                              <p className="uppercase tracking-wide text-[--color-text-muted] inline-flex items-center gap-1">
                                Client Campaign Status
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
                              Client Status
                            </p>
                            <Badge
                              tone={
                                c.status === "ACTIVE" ? "success" : "neutral"
                              }
                            >
                              {c.status}
                            </Badge>
                          </div>
                          <div>
                            <p className="uppercase tracking-wide text-[--color-text-muted] mb-1">
                              Created By
                            </p>
                            <p className="font-medium text-[--color-text-strong]">
                              {resolveChangedBy(c.created_by) || "—"}
                            </p>
                          </div>
                          <div>
                            <p className="uppercase tracking-wide text-[--color-text-muted] mb-1">
                              Last Updated
                            </p>
                            <p className="font-medium text-[--color-text-strong]">
                              {c.updated_at
                                ? formatDateTime(c.updated_at)
                                : "—"}
                            </p>
                          </div>
                          {resolveChangedBy(c.updated_by) ? (
                            <div>
                              <p className="uppercase tracking-wide text-[--color-text-muted] mb-1">
                                Updated By
                              </p>
                              <p className="font-medium text-[--color-text-strong]">
                                {resolveChangedBy(c.updated_by)}
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
                                  openHistoryId === `client-hist-${c.id}`
                                    ? null
                                    : `client-hist-${c.id}`,
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
                                className={`text-[--color-text-muted] transition-transform duration-200 ${openHistoryId === `client-hist-${c.id}` ? "rotate-180" : ""}`}
                              />
                            </button>
                            <AnimatePresence>
                              {openHistoryId === `client-hist-${c.id}` && (
                                <motion.ul
                                  key="client-hist"
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
                                          <>Client key rotated</>
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
