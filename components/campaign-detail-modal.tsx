"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  ChevronDown,
  Copy,
  HandHeart,
  Info,
  KeyRound,
  LayoutGrid,
  Link2,
  Pencil,
  Plus,
  RotateCcw,
  Settings2,
  Users,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Modal } from "@/components/modal";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import {
  SectionLabel,
  InfoItem,
  DisabledTooltip,
  HoverTooltip,
} from "@/components/shared-ui";
import {
  LinkClientModal,
  LinkAffiliateModal,
} from "@/components/modals/entity-modals";
import {
  formatDateTime,
  statusColorMap,
  inputClass,
  resolveDisplayName,
} from "@/lib/utils";
import { listUsers } from "@/lib/api";
import type {
  Affiliate,
  Campaign,
  Client,
  CognitoUser,
  Lead,
} from "@/lib/types";
import type { CampaignDetailTab, CampaignParticipantStatus } from "@/lib/types";

export function CampaignDetailModal({
  campaign,
  clients,
  affiliates,
  leads,
  isOpen,
  onClose,
  onStatusChange,
  onLinkClient,
  onLinkAffiliate,
  onUpdateClientStatus,
  onUpdateAffiliateStatus,
  onRemoveClient,
  onRemoveAffiliate,
  onUpdatePlugins,
  onUpdateName,
  onRotateParticipantKey,
  tab,
  onTabChange,
  focusAffiliateId,
}: {
  campaign: Campaign | null;
  clients: Client[];
  affiliates: Affiliate[];
  leads: Lead[];
  isOpen: boolean;
  onClose: () => void;
  onStatusChange: (id: string, status: Campaign["status"]) => Promise<boolean>;
  onLinkClient: (campaignId: string, clientId: string) => Promise<void>;
  onLinkAffiliate: (campaignId: string, affiliateId: string) => Promise<void>;
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
  onUpdatePlugins: (
    campaignId: string,
    payload: {
      duplicate_check?: {
        enabled?: boolean;
        criteria?: Array<"phone" | "email">;
      };
    },
  ) => Promise<void>;
  onUpdateName: (campaignId: string, name: string) => Promise<void>;
  onRotateParticipantKey: (
    campaignId: string,
    type: "client" | "affiliate",
    participantId: string,
  ) => Promise<void>;
  tab: CampaignDetailTab;
  onTabChange: (tab: CampaignDetailTab) => void;
  focusAffiliateId: string | null;
}) {
  const [statusEditing, setStatusEditing] = useState(false);
  const [statusDraft, setStatusDraft] = useState<Campaign["status"]>("DRAFT");
  const [linkClientModalOpen, setLinkClientModalOpen] = useState(false);
  const [linkAffiliateModalOpen, setLinkAffiliateModalOpen] = useState(false);
  const participantStatusOptions: CampaignParticipantStatus[] = [
    "TEST",
    "LIVE",
    "DISABLED",
  ];
  const [participantAction, setParticipantAction] = useState<{
    type: "client" | "affiliate";
    id: string;
    statusDraft: CampaignParticipantStatus;
  } | null>(null);
  const [confirmRotateKey, setConfirmRotateKey] = useState(false);
  const [openInfoId, setOpenInfoId] = useState<string | null>(null);
  const [openHistoryId, setOpenHistoryId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const campaignChangeHistory = useMemo(() => {
    type StatusEntry = {
      kind: "status";
      from?: string;
      to: string;
      changed_at: string;
      changed_by?: string;
    };
    type NameEntry = {
      kind: "name";
      previous_value?: unknown;
      new_value?: unknown;
      changed_at: string;
      changed_by?: { username?: string; email?: string } | null;
    };
    const entries: Array<StatusEntry | NameEntry> = [
      ...(campaign?.status_history ?? []).map(
        (s): StatusEntry => ({ kind: "status", ...s }),
      ),
      ...(campaign?.edit_history ?? [])
        .filter((e) => e.field === "name")
        .map(
          (e): NameEntry => ({
            kind: "name",
            previous_value: e.previous_value,
            new_value: e.new_value,
            changed_at: e.changed_at,
            changed_by: e.changed_by ?? null,
          }),
        ),
    ];
    return entries.sort(
      (a, b) =>
        new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime(),
    );
  }, [campaign]);
  const [nameEditing, setNameEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [duplicateCheckEnabled, setDuplicateCheckEnabled] = useState(true);
  const [duplicateCheckCriteria, setDuplicateCheckCriteria] = useState<
    Array<"phone" | "email">
  >(["phone", "email"]);

  const { data: usersData } = useSWR(isOpen ? "users:all" : null, async () => {
    const res = await listUsers();
    return res?.data ?? [];
  });

  const userNameMap = useMemo(() => {
    const map = new Map<string, string>();
    (usersData as CognitoUser[] | undefined)?.forEach((u) => {
      const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ");
      const display = fullName || u.email;
      map.set(u.email, display);
      map.set(u.username, display);
    });
    return map;
  }, [usersData]);

  function resolveChangedBy(
    changed_by?: { username?: string; email?: string } | null,
  ): string {
    if (!changed_by) return "";
    const key = changed_by.email ?? changed_by.username ?? "";
    return (
      userNameMap.get(key) ||
      userNameMap.get(changed_by.username ?? "") ||
      changed_by.email ||
      changed_by.username ||
      ""
    );
  }

  useEffect(() => {
    if (campaign) {
      setStatusDraft(campaign.status);
      setNameDraft(campaign.name);
      setDuplicateCheckEnabled(
        campaign.plugins?.duplicate_check?.enabled ?? true,
      );
      setDuplicateCheckCriteria(
        campaign.plugins?.duplicate_check?.criteria?.length
          ? campaign.plugins.duplicate_check.criteria
          : ["phone", "email"],
      );
    }
  }, [campaign]);

  if (!campaign) return null;

  const clientLinks = campaign.clients || [];
  const affiliateLinks = campaign.affiliates || [];
  const clientLinkMap = new Map(clientLinks.map((cc) => [cc.client_id, cc]));
  const affiliateLinkMap = new Map(
    affiliateLinks.map((ca) => [ca.affiliate_id, ca]),
  );

  const linkedClients = clients.filter((c) => clientLinkMap.has(c.id));
  const linkedAffiliates = affiliates.filter((a) => affiliateLinkMap.has(a.id));
  const leadsForCampaign = leads.filter((l) => l.campaign_id === campaign.id);

  const availableClients = clients.filter(
    (c) => c.status === "ACTIVE" && !clientLinkMap.has(c.id),
  );
  const availableAffiliates = affiliates.filter(
    (a) => a.status === "ACTIVE" && !affiliateLinkMap.has(a.id),
  );

  return (
    <>
      <Modal
        title={
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-2.5">
              {campaign.name}
              <Badge tone={statusColorMap[campaign.status] || "neutral"}>
                {campaign.status}
              </Badge>
            </span>
            <span className="flex items-center gap-1">
              <HoverTooltip message="Campaign ID">
                <span className="font-mono text-sm text-[--color-text-muted] select-all cursor-help">
                  {campaign.id}
                </span>
              </HoverTooltip>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(campaign.id);
                  toast.success("Campaign ID copied to clipboard");
                }}
                className="rounded p-0.5 text-[--color-text-muted] hover:text-[--color-primary] transition-colors"
              >
                <Copy size={12} />
              </button>
            </span>
          </div>
        }
        isOpen={isOpen}
        onClose={() => {
          setStatusEditing(false);
          setStatusDraft(campaign.status);
          onClose();
        }}
        width={900}
        bodyClassName="px-5 py-4 max-h-[78vh] overflow-y-auto"
      >
        <div className="space-y-4">
          <div className="flex gap-6 min-h-[480px]">
            <nav className="w-44 shrink-0 space-y-1">
              {(
                [
                  { key: "overview", label: "Overview", icon: LayoutGrid },
                  { key: "clients", label: "Clients", icon: Users },
                  { key: "affiliates", label: "Affiliates", icon: HandHeart },
                  { key: "settings", label: "Settings", icon: Settings2 },
                ] as const
              ).map((item) => {
                const Icon = item.icon || Link2;
                const active = tab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onTabChange(item.key)}
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition ${active ? "bg-[--color-panel] text-[--color-text-strong]" : "text-[--color-text-muted] hover:text-[--color-text]"}`}
                  >
                    <Icon size={16} />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div className="flex-1 min-w-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="space-y-4"
                >
                  {tab === "overview" && (
                    <>
                      <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
                        <InfoItem
                          label="Created"
                          value={formatDateTime(campaign.created_at)}
                        />
                        <InfoItem
                          label="Updated"
                          value={formatDateTime(campaign.updated_at)}
                        />
                        <InfoItem
                          label="Lead Count"
                          value={leadsForCampaign.length.toString()}
                        />
                        <InfoItem
                          label="Linked Clients"
                          value={linkedClients.length.toString()}
                          onClick={() => onTabChange("clients")}
                        />
                        <InfoItem
                          label="Linked Affiliates"
                          value={linkedAffiliates.length.toString()}
                          onClick={() => onTabChange("affiliates")}
                        />
                      </div>

                      {campaignChangeHistory.length > 0 ? (
                        <div className="rounded-lg border border-[--color-border] overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setHistoryOpen((v) => !v)}
                            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm transition hover:bg-[--color-panel]"
                          >
                            <span className="flex items-center gap-2 font-semibold text-[--color-text-strong]">
                              Change History
                              <span className="text-xs font-normal text-[--color-text-muted]">
                                ({campaignChangeHistory.length} event
                                {campaignChangeHistory.length !== 1 ? "s" : ""})
                              </span>
                            </span>
                            <ChevronDown
                              size={14}
                              className={`text-[--color-text-muted] transition-transform duration-200 ${historyOpen ? "rotate-180" : ""}`}
                            />
                          </button>
                          <AnimatePresence>
                            {historyOpen && (
                              <motion.div
                                key="change-history"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2, ease: "easeOut" }}
                                className="overflow-hidden"
                              >
                                <ul className="divide-y divide-[--color-border] px-4 pb-3">
                                  {campaignChangeHistory.map((entry, idx) => (
                                    <li
                                      key={idx}
                                      className="flex items-start gap-3 py-3"
                                    >
                                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[--color-panel]">
                                        <ArrowRight
                                          size={10}
                                          className="text-[--color-text-muted]"
                                        />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        {entry.kind === "status" ? (
                                          <p className="text-sm text-[--color-text]">
                                            {entry.from ? (
                                              <>
                                                Status changed from{" "}
                                                <Badge
                                                  tone={
                                                    statusColorMap[
                                                      entry.from
                                                    ] || "neutral"
                                                  }
                                                >
                                                  {entry.from}
                                                </Badge>{" "}
                                                to{" "}
                                                <Badge
                                                  tone={
                                                    statusColorMap[entry.to] ||
                                                    "neutral"
                                                  }
                                                >
                                                  {entry.to}
                                                </Badge>
                                              </>
                                            ) : (
                                              <>
                                                Status initialized to{" "}
                                                <Badge
                                                  tone={
                                                    statusColorMap[entry.to] ||
                                                    "neutral"
                                                  }
                                                >
                                                  {entry.to}
                                                </Badge>
                                              </>
                                            )}
                                          </p>
                                        ) : (
                                          <p className="text-sm text-[--color-text]">
                                            {entry.previous_value != null ? (
                                              <>
                                                Campaign renamed from{" "}
                                                <span className="font-medium text-[--color-text-strong]">
                                                  &ldquo;
                                                  {String(entry.previous_value)}
                                                  &rdquo;
                                                </span>{" "}
                                                to{" "}
                                                <span className="font-medium text-[--color-text-strong]">
                                                  &ldquo;
                                                  {String(
                                                    entry.new_value ?? "",
                                                  )}
                                                  &rdquo;
                                                </span>
                                              </>
                                            ) : (
                                              <>
                                                Campaign name set to{" "}
                                                <span className="font-medium text-[--color-text-strong]">
                                                  &ldquo;
                                                  {String(
                                                    entry.new_value ?? "",
                                                  )}
                                                  &rdquo;
                                                </span>
                                              </>
                                            )}
                                          </p>
                                        )}
                                        <p className="mt-0.5 text-xs text-[--color-text-muted]">
                                          {formatDateTime(entry.changed_at)}
                                          {entry.changed_by
                                            ? ` · by ${
                                                typeof entry.changed_by ===
                                                "string"
                                                  ? entry.changed_by
                                                  : resolveChangedBy(
                                                      entry.changed_by,
                                                    )
                                              }`
                                            : ""}
                                        </p>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ) : null}
                    </>
                  )}

                  {tab === "clients" && (
                    <div className="space-y-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <SectionLabel>Linked Clients</SectionLabel>
                        <DisabledTooltip
                          inline
                          message={
                            availableClients.length === 0
                              ? clients.filter((c) => c.status === "ACTIVE")
                                  .length === 0
                                ? "There are no active clients to add to this campaign."
                                : "All active clients are already linked to this campaign."
                              : ""
                          }
                        >
                          <Button
                            size="sm"
                            iconLeft={<UserPlus size={14} />}
                            disabled={availableClients.length === 0}
                            onClick={() => setLinkClientModalOpen(true)}
                          >
                            Add Client
                          </Button>
                        </DisabledTooltip>
                      </div>
                      <div className="space-y-2 text-sm">
                        {linkedClients.length === 0 ? (
                          <p className="text-[--color-text-muted]">
                            No linked clients yet.
                          </p>
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
                                          statusColorMap[
                                            link?.status || "TEST"
                                          ] || "neutral"
                                        }
                                      >
                                        {link?.status || "TEST"}
                                      </Badge>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0 ml-3">
                                    <button
                                      type="button"
                                      title="Details"
                                      onClick={() =>
                                        setOpenInfoId(
                                          infoOpen ? null : `client-${c.id}`,
                                        )
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
                                      transition={{
                                        duration: 0.2,
                                        ease: "easeOut",
                                      }}
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
                                                statusColorMap[
                                                  link?.status || "TEST"
                                                ] || "neutral"
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
                                                c.status === "ACTIVE"
                                                  ? "success"
                                                  : "neutral"
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
                                              {resolveDisplayName(
                                                c.created_by,
                                              ) || "—"}
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
                                          {resolveDisplayName(c.updated_by) ? (
                                            <div>
                                              <p className="uppercase tracking-wide text-[--color-text-muted] mb-1">
                                                Updated By
                                              </p>
                                              <p className="font-medium text-[--color-text-strong]">
                                                {resolveDisplayName(
                                                  c.updated_by,
                                                )}
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
                                                  openHistoryId ===
                                                    `client-hist-${c.id}`
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
                                              {openHistoryId ===
                                                `client-hist-${c.id}` && (
                                                <motion.ul
                                                  key="client-hist"
                                                  initial={{
                                                    opacity: 0,
                                                    height: 0,
                                                  }}
                                                  animate={{
                                                    opacity: 1,
                                                    height: "auto",
                                                  }}
                                                  exit={{
                                                    opacity: 0,
                                                    height: 0,
                                                  }}
                                                  transition={{
                                                    duration: 0.18,
                                                    ease: "easeOut",
                                                  }}
                                                  className="overflow-hidden divide-y divide-[--color-border] px-2.5"
                                                >
                                                  {link.history.map(
                                                    (entry, idx) => (
                                                      <li
                                                        key={idx}
                                                        className="py-1.5 space-y-0.5"
                                                      >
                                                        <p className="text-[--color-text]">
                                                          {entry.event ===
                                                            "linked" && (
                                                            <>
                                                              Linked — status
                                                              set to{" "}
                                                              <span className="font-semibold">
                                                                {entry.to}
                                                              </span>
                                                            </>
                                                          )}
                                                          {entry.event ===
                                                            "status_changed" && (
                                                            <>
                                                              Status changed
                                                              from{" "}
                                                              <span className="font-semibold">
                                                                {entry.from}
                                                              </span>{" "}
                                                              to{" "}
                                                              <span className="font-semibold">
                                                                {entry.to}
                                                              </span>
                                                            </>
                                                          )}
                                                          {entry.event ===
                                                            "key_rotated" && (
                                                            <>
                                                              Client key rotated
                                                            </>
                                                          )}
                                                        </p>
                                                        <p className="text-[--color-text-muted]">
                                                          {formatDateTime(
                                                            entry.changed_at,
                                                          )}
                                                          {resolveChangedBy(
                                                            entry.changed_by,
                                                          )
                                                            ? ` · by ${resolveChangedBy(entry.changed_by)}`
                                                            : ""}
                                                        </p>
                                                      </li>
                                                    ),
                                                  )}
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
                  )}

                  {tab === "affiliates" && (
                    <div className="space-y-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <SectionLabel>Linked Affiliates</SectionLabel>
                        <DisabledTooltip
                          inline
                          message={
                            availableAffiliates.length === 0
                              ? affiliates.filter((a) => a.status === "ACTIVE")
                                  .length === 0
                                ? "There are no active affiliates to add to this campaign."
                                : "All active affiliates are already linked to this campaign."
                              : ""
                          }
                        >
                          <Button
                            size="sm"
                            iconLeft={<UserPlus size={14} />}
                            disabled={availableAffiliates.length === 0}
                            onClick={() => setLinkAffiliateModalOpen(true)}
                          >
                            Add Affiliate
                          </Button>
                        </DisabledTooltip>
                      </div>
                      <div className="space-y-2 text-sm">
                        {linkedAffiliates.length === 0 ? (
                          <p className="text-[--color-text-muted]">
                            No linked affiliates yet.
                          </p>
                        ) : (
                          linkedAffiliates.map((a) => {
                            const link = affiliateLinkMap.get(a.id);
                            const isFocused = focusAffiliateId === a.id;
                            const infoOpen = openInfoId === `affiliate-${a.id}`;
                            return (
                              <div
                                key={a.id}
                                className={`rounded-md bg-[--color-panel] overflow-hidden ${
                                  isFocused
                                    ? "ring-2 ring-[--color-primary]"
                                    : ""
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
                                        title="Affiliate ID"
                                      >
                                        ({a.id})
                                      </span>
                                      <Badge
                                        tone={
                                          statusColorMap[
                                            link?.status || "TEST"
                                          ] || "neutral"
                                        }
                                      >
                                        {link?.status || "TEST"}
                                      </Badge>
                                    </div>
                                    {link?.campaign_key ? (
                                      <div className="flex items-center gap-1 mt-1 text-xs text-[--color-text-muted]">
                                        <HoverTooltip message="Affiliate Campaign Key">
                                          <span className="font-mono cursor-help">
                                            {link.campaign_key}
                                          </span>
                                        </HoverTooltip>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            navigator.clipboard.writeText(
                                              link.campaign_key,
                                            );
                                            toast.success(
                                              "Campaign Key copied to clipboard",
                                            );
                                          }}
                                          className="rounded p-0.5 hover:text-[--color-primary] transition-colors"
                                        >
                                          <Copy size={11} />
                                        </button>
                                      </div>
                                    ) : null}
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0 ml-3">
                                    <button
                                      type="button"
                                      title="Details"
                                      onClick={() =>
                                        setOpenInfoId(
                                          infoOpen ? null : `affiliate-${a.id}`,
                                        )
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
                                      transition={{
                                        duration: 0.2,
                                        ease: "easeOut",
                                      }}
                                      className="overflow-hidden"
                                    >
                                      <div className="border-t border-[--color-border] bg-[--color-bg-muted] px-3 py-3 text-xs space-y-2">
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                          <div>
                                            <p className="uppercase tracking-wide text-[--color-text-muted] mb-1">
                                              Email
                                            </p>
                                            <p className="font-medium text-[--color-text-strong]">
                                              {a.email || "—"}
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
                                            <HoverTooltip message="Whether this affiliate is currently allowed to send leads to this campaign (TEST = trial mode, LIVE = active, DISABLED = blocked)">
                                              <p className="uppercase tracking-wide text-[--color-text-muted] inline-flex items-center gap-1">
                                                Affiliate Campaign Status
                                                <Info size={10} />
                                              </p>
                                            </HoverTooltip>
                                            <Badge
                                              tone={
                                                statusColorMap[
                                                  link?.status || "TEST"
                                                ] || "neutral"
                                              }
                                            >
                                              {link?.status || "TEST"}
                                            </Badge>
                                          </div>
                                          <div>
                                            <p className="uppercase tracking-wide text-[--color-text-muted] mb-1">
                                              Affiliate Status
                                            </p>
                                            <Badge
                                              tone={
                                                a.status === "ACTIVE"
                                                  ? "success"
                                                  : "neutral"
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
                                              {resolveDisplayName(
                                                a.created_by,
                                              ) || "—"}
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
                                          {resolveDisplayName(a.updated_by) ? (
                                            <div>
                                              <p className="uppercase tracking-wide text-[--color-text-muted] mb-1">
                                                Updated By
                                              </p>
                                              <p className="font-medium text-[--color-text-strong]">
                                                {resolveDisplayName(
                                                  a.updated_by,
                                                )}
                                              </p>
                                            </div>
                                          ) : null}
                                          {a.phone ? (
                                            <div>
                                              <p className="uppercase tracking-wide text-[--color-text-muted] mb-1">
                                                Phone
                                              </p>
                                              <p className="font-medium text-[--color-text-strong]">
                                                {a.phone}
                                              </p>
                                            </div>
                                          ) : null}
                                          {a.affiliate_code ? (
                                            <div>
                                              <p className="uppercase tracking-wide text-[--color-text-muted] mb-1">
                                                Affiliate Code
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
                                                  openHistoryId ===
                                                    `affiliate-hist-${a.id}`
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
                                              {openHistoryId ===
                                                `affiliate-hist-${a.id}` && (
                                                <motion.ul
                                                  key="affiliate-hist"
                                                  initial={{
                                                    opacity: 0,
                                                    height: 0,
                                                  }}
                                                  animate={{
                                                    opacity: 1,
                                                    height: "auto",
                                                  }}
                                                  exit={{
                                                    opacity: 0,
                                                    height: 0,
                                                  }}
                                                  transition={{
                                                    duration: 0.18,
                                                    ease: "easeOut",
                                                  }}
                                                  className="overflow-hidden divide-y divide-[--color-border] px-2.5"
                                                >
                                                  {link.history.map(
                                                    (entry, idx) => (
                                                      <li
                                                        key={idx}
                                                        className="py-1.5 space-y-0.5"
                                                      >
                                                        <p className="text-[--color-text]">
                                                          {entry.event ===
                                                            "linked" && (
                                                            <>
                                                              Linked — status
                                                              set to{" "}
                                                              <span className="font-semibold">
                                                                {entry.to}
                                                              </span>
                                                            </>
                                                          )}
                                                          {entry.event ===
                                                            "status_changed" && (
                                                            <>
                                                              Status changed
                                                              from{" "}
                                                              <span className="font-semibold">
                                                                {entry.from}
                                                              </span>{" "}
                                                              to{" "}
                                                              <span className="font-semibold">
                                                                {entry.to}
                                                              </span>
                                                            </>
                                                          )}
                                                          {entry.event ===
                                                            "key_rotated" && (
                                                            <>
                                                              Campaign key
                                                              rotated
                                                            </>
                                                          )}
                                                        </p>
                                                        <p className="text-[--color-text-muted]">
                                                          {formatDateTime(
                                                            entry.changed_at,
                                                          )}
                                                          {resolveChangedBy(
                                                            entry.changed_by,
                                                          )
                                                            ? ` · by ${resolveChangedBy(entry.changed_by)}`
                                                            : ""}
                                                        </p>
                                                      </li>
                                                    ),
                                                  )}
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
                  )}

                  {tab === "settings" && (
                    <div className="space-y-4">
                      <SectionLabel>Campaign Name</SectionLabel>
                      <div className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-4">
                        {nameEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              className={`${inputClass} flex-1`}
                              value={nameDraft}
                              onChange={(e) => setNameDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  if (
                                    nameDraft.trim() &&
                                    nameDraft.trim() !== campaign.name
                                  ) {
                                    onUpdateName(
                                      campaign.id,
                                      nameDraft.trim(),
                                    ).then(() => setNameEditing(false));
                                  } else {
                                    setNameEditing(false);
                                  }
                                }
                                if (e.key === "Escape") {
                                  setNameDraft(campaign.name);
                                  setNameEditing(false);
                                }
                              }}
                              autoFocus
                            />
                            <Button
                              size="sm"
                              onClick={async () => {
                                if (
                                  nameDraft.trim() &&
                                  nameDraft.trim() !== campaign.name
                                ) {
                                  await onUpdateName(
                                    campaign.id,
                                    nameDraft.trim(),
                                  );
                                }
                                setNameEditing(false);
                              }}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => {
                                setNameDraft(campaign.name);
                                setNameEditing(false);
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium text-[--color-text-strong]">
                              {campaign.name}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              iconLeft={<Pencil size={13} />}
                              onClick={() => {
                                setNameDraft(campaign.name);
                                setNameEditing(true);
                              }}
                            >
                              Edit Name
                            </Button>
                          </div>
                        )}
                      </div>

                      <SectionLabel>Campaign Status</SectionLabel>
                      <div className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-4">
                        <div className="flex items-center gap-3 flex-wrap">
                          {statusEditing ? (
                            <>
                              <select
                                className={`${inputClass} w-36`}
                                value={statusDraft}
                                onChange={(e) =>
                                  setStatusDraft(
                                    e.target.value as Campaign["status"],
                                  )
                                }
                              >
                                {(
                                  [
                                    "DRAFT",
                                    "TEST",
                                    "ACTIVE",
                                    "INACTIVE",
                                  ] as Campaign["status"][]
                                ).map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                              <Button
                                size="sm"
                                onClick={async () => {
                                  const ok = await onStatusChange(
                                    campaign.id,
                                    statusDraft,
                                  );
                                  if (ok) setStatusEditing(false);
                                }}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => {
                                  setStatusDraft(campaign.status);
                                  setStatusEditing(false);
                                }}
                              >
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Badge
                                tone={
                                  statusColorMap[campaign.status] || "neutral"
                                }
                              >
                                {campaign.status}
                              </Badge>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setStatusDraft(campaign.status);
                                  setStatusEditing(true);
                                }}
                              >
                                Edit Status
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      <SectionLabel>Quality Controls</SectionLabel>
                      <div className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-4">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[--color-text-strong]">
                              Duplicate Check
                            </p>
                            <p className="text-xs text-[--color-text-muted]">
                              Detect duplicates by matching lead payload fields.
                            </p>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={duplicateCheckEnabled}
                            onClick={() =>
                              setDuplicateCheckEnabled((prev) => !prev)
                            }
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${duplicateCheckEnabled ? "bg-[--color-primary]" : "bg-[--color-border]"}`}
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-[--color-bg] transition ${duplicateCheckEnabled ? "translate-x-5" : "translate-x-1"}`}
                            />
                          </button>
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                            Matching Criteria
                          </p>
                          <div className="flex flex-wrap gap-4">
                            {(["phone", "email"] as const).map((criterion) => {
                              const checked =
                                duplicateCheckCriteria.includes(criterion);
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
                                        return prev.filter(
                                          (item) => item !== criterion,
                                        );
                                      });
                                    }}
                                  />
                                  <span className="capitalize">
                                    {criterion}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        <div className="mt-4 flex justify-end">
                          <Button
                            size="sm"
                            onClick={async () => {
                              if (
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
                                  enabled: duplicateCheckEnabled,
                                  criteria: duplicateCheckCriteria,
                                },
                              });
                            }}
                          >
                            Save Quality Controls
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </Modal>

      {participantAction &&
        (() => {
          const isClient = participantAction.type === "client";
          const pid = participantAction.id;
          const hasLeads = leadsForCampaign.length > 0;
          const isOnly = isClient
            ? linkedClients.length <= 1
            : linkedAffiliates.length <= 1;
          const cantRemove = isOnly || hasLeads;
          const removeReason = hasLeads
            ? `This campaign has ${leadsForCampaign.length} lead${
                leadsForCampaign.length === 1 ? "" : "s"
              }. Removing a participant would break lead history and data consistency. Set their status to DISABLED to stop receiving new leads.`
            : isOnly
              ? `At least one ${isClient ? "client" : "affiliate"} must remain linked to the campaign.`
              : "";
          const currentLink = isClient
            ? clientLinkMap.get(pid)
            : affiliateLinkMap.get(pid);
          const participant = isClient
            ? clients.find((c) => c.id === pid)
            : affiliates.find((a) => a.id === pid);
          return (
            <Modal
              title={`${isClient ? "Client" : "Affiliate"} Actions \u2014 ${participant?.name || pid}`}
              isOpen
              onClose={() => {
                setParticipantAction(null);
                setConfirmRotateKey(false);
              }}
              width={420}
            >
              <div className="space-y-5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-[--color-text-muted]">
                    Current status:
                  </span>
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
                        if (isClient) {
                          await onUpdateClientStatus(
                            campaign.id,
                            pid,
                            participantAction.statusDraft,
                          );
                        } else {
                          await onUpdateAffiliateStatus(
                            campaign.id,
                            pid,
                            participantAction.statusDraft,
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
                      Issues a fresh key for this affiliate. Share the new key —
                      the old one stops working immediately.
                    </p>
                    <Modal
                      title="Rotate Campaign Key?"
                      isOpen={confirmRotateKey}
                      onClose={() => setConfirmRotateKey(false)}
                      width={420}
                    >
                      <p className="text-sm text-[--color-text]">
                        A new key will be generated immediately. Any leads
                        submitted using the current key will be{" "}
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
                        } else {
                          await onRemoveAffiliate(campaign.id, pid);
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
          );
        })()}

      <LinkClientModal
        isOpen={linkClientModalOpen}
        onClose={() => setLinkClientModalOpen(false)}
        clients={availableClients}
        onSubmit={async (clientId) => {
          await onLinkClient(campaign.id, clientId);
          setLinkClientModalOpen(false);
        }}
      />

      <LinkAffiliateModal
        isOpen={linkAffiliateModalOpen}
        onClose={() => setLinkAffiliateModalOpen(false)}
        affiliates={availableAffiliates}
        onSubmit={async (affiliateId) => {
          await onLinkAffiliate(campaign.id, affiliateId);
          setLinkAffiliateModalOpen(false);
        }}
      />
    </>
  );
}
