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
  Plug,
  Plus,
  RotateCcw,
  Users,
  UserPlus,
  X,
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
  AuditPopover,
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
import {
  listUsers,
  listPluginSettings,
  listCredentialSchemas,
} from "@/lib/api";
import type {
  Affiliate,
  Campaign,
  Client,
  CognitoUser,
  CredentialSchemaRecord,
  Lead,
  PluginSettingRecord,
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
      trusted_form?: {
        enabled?: boolean;
      };
      ipqs?: {
        enabled?: boolean;
        phone?: { enabled?: boolean; criteria?: Record<string, unknown> };
        email?: { enabled?: boolean; criteria?: Record<string, unknown> };
        ip?: { enabled?: boolean; criteria?: Record<string, unknown> };
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
  const [titleEditing, setTitleEditing] = useState(false);
  const [savingTitle, setSavingTitle] = useState(false);
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
  const [nameDraft, setNameDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState<Campaign["status"]>("DRAFT");
  const [duplicateCheckEnabled, setDuplicateCheckEnabled] = useState(true);
  const [duplicateCheckCriteria, setDuplicateCheckCriteria] = useState<
    Array<"phone" | "email">
  >(["phone", "email"]);
  const [trustedFormEnabled, setTrustedFormEnabled] = useState(true);

  // ── IPQS config state ────────────────────────────────────────────────────
  interface IpqsCriterionFraud {
    enabled: boolean;
    operator: "lte" | "gte" | "eq";
    value: number;
  }
  interface IpqsCriterionValid {
    enabled: boolean;
    required: boolean;
  }
  interface IpqsCriterionCountry {
    enabled: boolean;
    allowed: string;
  } // comma-sep
  interface IpqsCriterionBool {
    enabled: boolean;
    allowed: boolean;
  }
  interface IpqsConfig {
    enabled: boolean;
    phone: {
      enabled: boolean;
      criteria: {
        valid: IpqsCriterionValid;
        fraud_score: IpqsCriterionFraud;
        country: IpqsCriterionCountry;
      };
    };
    email: {
      enabled: boolean;
      criteria: { valid: IpqsCriterionValid; fraud_score: IpqsCriterionFraud };
    };
    ip: {
      enabled: boolean;
      criteria: {
        fraud_score: IpqsCriterionFraud;
        country_code: IpqsCriterionCountry;
        proxy: IpqsCriterionBool;
        vpn: IpqsCriterionBool;
      };
    };
  }
  const defaultIpqsConfig: IpqsConfig = {
    enabled: false,
    phone: {
      enabled: true,
      criteria: {
        valid: { enabled: true, required: true },
        fraud_score: { enabled: true, operator: "lte", value: 85 },
        country: { enabled: false, allowed: "" },
      },
    },
    email: {
      enabled: true,
      criteria: {
        valid: { enabled: true, required: true },
        fraud_score: { enabled: true, operator: "lte", value: 85 },
      },
    },
    ip: {
      enabled: false,
      criteria: {
        fraud_score: { enabled: true, operator: "lte", value: 85 },
        country_code: { enabled: false, allowed: "" },
        proxy: { enabled: false, allowed: false },
        vpn: { enabled: false, allowed: false },
      },
    },
  };
  const [ipqsConfig, setIpqsConfig] = useState<IpqsConfig>(defaultIpqsConfig);
  const [ipqsPhoneOpen, setIpqsPhoneOpen] = useState(false);
  const [ipqsEmailOpen, setIpqsEmailOpen] = useState(false);
  const [ipqsIpOpen, setIpqsIpOpen] = useState(false);

  const { data: usersData } = useSWR(isOpen ? "users:all" : null, async () => {
    const res = await listUsers();
    return res?.data ?? [];
  });

  const { data: globalSchemasData } = useSWR(
    isOpen ? "credential-schemas:all" : null,
    async () => {
      const res = await listCredentialSchemas();
      return (res as any)?.data?.items ?? [];
    },
  );
  const globalSchemas: CredentialSchemaRecord[] = globalSchemasData ?? [];

  const { data: globalPluginSettingsData } = useSWR(
    isOpen ? "plugin-settings:all" : null,
    async () => {
      const res = await listPluginSettings();
      return (res as any)?.data?.items ?? [];
    },
  );
  const globalPluginSettings: PluginSettingRecord[] =
    globalPluginSettingsData ?? [];

  const getGlobalPluginDisabled = (provider: string): boolean => {
    const schema = globalSchemas.find((s) => s.provider === provider);
    if (!schema) return false;
    const setting = globalPluginSettings.find(
      (ps) => ps.schema_id === schema.id,
    );
    return setting ? setting.enabled === false : false;
  };

  const dupCheckGloballyDisabled = getGlobalPluginDisabled("duplicate_check");
  const trustedFormGloballyDisabled = getGlobalPluginDisabled("trusted_form");
  const ipqsGloballyDisabled = getGlobalPluginDisabled("ipqs");

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
      setTitleEditing(false);
      setDuplicateCheckEnabled(
        campaign.plugins?.duplicate_check?.enabled ?? true,
      );
      setDuplicateCheckCriteria(
        campaign.plugins?.duplicate_check?.criteria?.length
          ? campaign.plugins.duplicate_check.criteria
          : ["phone", "email"],
      );
      setTrustedFormEnabled(campaign.plugins?.trusted_form?.enabled ?? true);
      // Init IPQS config
      const qi = campaign.plugins?.ipqs;
      setIpqsConfig({
        enabled: qi?.enabled ?? false,
        phone: {
          enabled: qi?.phone?.enabled ?? true,
          criteria: {
            valid: {
              enabled: qi?.phone?.criteria?.valid?.enabled ?? true,
              required: qi?.phone?.criteria?.valid?.required ?? true,
            },
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
            valid: {
              enabled: qi?.email?.criteria?.valid?.enabled ?? true,
              required: qi?.email?.criteria?.valid?.required ?? true,
            },
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
              allowed: (qi?.ip?.criteria?.country_code?.allowed ?? []).join(
                ", ",
              ),
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
    }
  }, [campaign]);

  if (!campaign) return null;

  const saveTitleEdit = async () => {
    const nameChanged = nameDraft.trim() && nameDraft.trim() !== campaign.name;
    const statusChanged = statusDraft !== campaign.status;
    if (!nameChanged && !statusChanged) {
      setTitleEditing(false);
      return;
    }
    setSavingTitle(true);
    try {
      if (nameChanged) await onUpdateName(campaign.id, nameDraft.trim());
      if (statusChanged) await onStatusChange(campaign.id, statusDraft);
      setTitleEditing(false);
    } finally {
      setSavingTitle(false);
    }
  };

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
              <button
                type="button"
                title="Edit name & status"
                onClick={() => {
                  setNameDraft(campaign.name);
                  setStatusDraft(campaign.status);
                  setTitleEditing(true);
                }}
                className="rounded p-0.5 text-[--color-text-muted] hover:text-[--color-primary] transition-colors"
              >
                <Pencil size={13} />
              </button>
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
          setTitleEditing(false);
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
                  { key: "integrations", label: "Integrations", icon: Plug },
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

                  {tab === "integrations" && (
                    <div className="space-y-3">
                      {/* Duplicate Check card */}
                      <div className="rounded-xl border border-[--color-border] bg-[--color-bg-muted] p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[--color-text-strong]">
                              Duplicate Check
                            </p>
                            <p className="text-xs text-[--color-text-muted] mt-0.5">
                              Detect duplicates by matching lead payload fields.
                            </p>
                          </div>
                          <DisabledTooltip
                            message={
                              dupCheckGloballyDisabled
                                ? "Globally disabled by admin"
                                : ""
                            }
                            inline
                          >
                            <button
                              type="button"
                              role="switch"
                              aria-checked={
                                dupCheckGloballyDisabled
                                  ? false
                                  : duplicateCheckEnabled
                              }
                              disabled={dupCheckGloballyDisabled}
                              onClick={() =>
                                !dupCheckGloballyDisabled &&
                                setDuplicateCheckEnabled((prev) => !prev)
                              }
                              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                                dupCheckGloballyDisabled
                                  ? "opacity-40 cursor-not-allowed bg-[--color-border]"
                                  : duplicateCheckEnabled
                                    ? "bg-[--color-primary]"
                                    : "bg-[--color-border]"
                              }`}
                            >
                              <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-[--color-bg] transition ${
                                  !dupCheckGloballyDisabled &&
                                  duplicateCheckEnabled
                                    ? "translate-x-5"
                                    : "translate-x-1"
                                }`}
                              />
                            </button>
                          </DisabledTooltip>
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
                      </div>

                      {/* TrustedForm card */}
                      <div className="rounded-xl border border-[--color-border] bg-[--color-bg-muted] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[--color-text-strong]">
                              TrustedForm
                            </p>
                            <p className="text-xs text-[--color-text-muted] mt-0.5">
                              Validate TrustedForm certificates on incoming
                              leads for this campaign.
                            </p>
                          </div>
                          <DisabledTooltip
                            message={
                              trustedFormGloballyDisabled
                                ? "Globally disabled by admin"
                                : ""
                            }
                            inline
                          >
                            <button
                              type="button"
                              role="switch"
                              aria-checked={
                                trustedFormGloballyDisabled
                                  ? false
                                  : trustedFormEnabled
                              }
                              disabled={trustedFormGloballyDisabled}
                              onClick={() =>
                                !trustedFormGloballyDisabled &&
                                setTrustedFormEnabled((prev) => !prev)
                              }
                              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                                trustedFormGloballyDisabled
                                  ? "opacity-40 cursor-not-allowed bg-[--color-border]"
                                  : trustedFormEnabled
                                    ? "bg-[--color-primary]"
                                    : "bg-[--color-border]"
                              }`}
                            >
                              <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-[--color-bg] transition ${
                                  !trustedFormGloballyDisabled &&
                                  trustedFormEnabled
                                    ? "translate-x-5"
                                    : "translate-x-1"
                                }`}
                              />
                            </button>
                          </DisabledTooltip>
                        </div>
                      </div>

                      {/* IPQS card */}
                      <div className="rounded-xl border border-[--color-border] bg-[--color-bg-muted] p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[--color-text-strong]">
                              IPQualityScore (IPQS)
                            </p>
                            <p className="text-xs text-[--color-text-muted] mt-0.5">
                              Fraud and quality scoring on phone, email, and IP
                              for incoming leads.
                            </p>
                          </div>
                          <DisabledTooltip
                            message={
                              ipqsGloballyDisabled
                                ? "Globally disabled by admin"
                                : ""
                            }
                            inline
                          >
                            <button
                              type="button"
                              role="switch"
                              aria-checked={
                                ipqsGloballyDisabled
                                  ? false
                                  : ipqsConfig.enabled
                              }
                              disabled={ipqsGloballyDisabled}
                              onClick={() =>
                                !ipqsGloballyDisabled &&
                                setIpqsConfig((p) => ({
                                  ...p,
                                  enabled: !p.enabled,
                                }))
                              }
                              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                                ipqsGloballyDisabled
                                  ? "opacity-40 cursor-not-allowed bg-[--color-border]"
                                  : ipqsConfig.enabled
                                    ? "bg-[--color-primary]"
                                    : "bg-[--color-border]"
                              }`}
                            >
                              <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-[--color-bg] transition ${
                                  !ipqsGloballyDisabled && ipqsConfig.enabled
                                    ? "translate-x-5"
                                    : "translate-x-1"
                                }`}
                              />
                            </button>
                          </DisabledTooltip>
                        </div>

                        <AnimatePresence initial={false}>
                          {!ipqsGloballyDisabled && ipqsConfig.enabled && (
                            <motion.div
                              key="ipqs-subs"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: "easeInOut" }}
                              style={{ overflow: "hidden" }}
                            >
                              <div className="pt-2 space-y-2 border-t border-[--color-border]">
                                {/* ── Phone sub-check ── */}
                                <div className="rounded-lg border border-[--color-border] bg-[--color-bg] overflow-hidden">
                                  <div className="flex items-center justify-between px-3 py-2 gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setIpqsPhoneOpen((v) => !v)
                                      }
                                      className="flex items-center gap-1.5 text-sm font-medium text-[--color-text] hover:text-[--color-primary] transition-colors"
                                    >
                                      <motion.span
                                        animate={{
                                          rotate: ipqsPhoneOpen ? 90 : 0,
                                        }}
                                        transition={{ duration: 0.15 }}
                                        className="text-[10px] text-[--color-text-muted]"
                                      >
                                        ▶
                                      </motion.span>
                                      Phone
                                    </button>
                                    <button
                                      type="button"
                                      role="switch"
                                      aria-checked={ipqsConfig.phone.enabled}
                                      onClick={() =>
                                        setIpqsConfig((p) => ({
                                          ...p,
                                          phone: {
                                            ...p.phone,
                                            enabled: !p.phone.enabled,
                                          },
                                        }))
                                      }
                                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${ipqsConfig.phone.enabled ? "bg-[--color-primary]" : "bg-[--color-border]"}`}
                                    >
                                      <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-[--color-bg] transition ${ipqsConfig.phone.enabled ? "translate-x-4" : "translate-x-0.5"}`}
                                      />
                                    </button>
                                  </div>
                                  <AnimatePresence initial={false}>
                                    {ipqsPhoneOpen && (
                                      <motion.div
                                        key="phone-criteria"
                                        initial={{ height: 0 }}
                                        animate={{ height: "auto" }}
                                        exit={{ height: 0 }}
                                        transition={{ duration: 0.18 }}
                                        style={{ overflow: "hidden" }}
                                      >
                                        <div className="px-3 pb-3 space-y-2.5 border-t border-[--color-border] pt-2.5">
                                          {/* valid */}
                                          <div className="flex flex-wrap items-center gap-3 text-xs">
                                            <input
                                              type="checkbox"
                                              className="h-3.5 w-3.5 accent-[--color-primary]"
                                              checked={
                                                ipqsConfig.phone.criteria.valid
                                                  .enabled
                                              }
                                              onChange={(e) =>
                                                setIpqsConfig((p) => ({
                                                  ...p,
                                                  phone: {
                                                    ...p.phone,
                                                    criteria: {
                                                      ...p.phone.criteria,
                                                      valid: {
                                                        ...p.phone.criteria
                                                          .valid,
                                                        enabled:
                                                          e.target.checked,
                                                      },
                                                    },
                                                  },
                                                }))
                                              }
                                            />
                                            <span className="w-20 text-[--color-text-muted]">
                                              Valid
                                            </span>
                                            {ipqsConfig.phone.criteria.valid
                                              .enabled && (
                                              <label className="flex items-center gap-1.5 text-[--color-text-muted]">
                                                <input
                                                  type="checkbox"
                                                  className="h-3.5 w-3.5 accent-[--color-primary]"
                                                  checked={
                                                    ipqsConfig.phone.criteria
                                                      .valid.required
                                                  }
                                                  onChange={(e) =>
                                                    setIpqsConfig((p) => ({
                                                      ...p,
                                                      phone: {
                                                        ...p.phone,
                                                        criteria: {
                                                          ...p.phone.criteria,
                                                          valid: {
                                                            ...p.phone.criteria
                                                              .valid,
                                                            required:
                                                              e.target.checked,
                                                          },
                                                        },
                                                      },
                                                    }))
                                                  }
                                                />
                                                Required
                                              </label>
                                            )}
                                          </div>
                                          {/* fraud_score */}
                                          <div className="flex flex-wrap items-center gap-3 text-xs">
                                            <input
                                              type="checkbox"
                                              className="h-3.5 w-3.5 accent-[--color-primary]"
                                              checked={
                                                ipqsConfig.phone.criteria
                                                  .fraud_score.enabled
                                              }
                                              onChange={(e) =>
                                                setIpqsConfig((p) => ({
                                                  ...p,
                                                  phone: {
                                                    ...p.phone,
                                                    criteria: {
                                                      ...p.phone.criteria,
                                                      fraud_score: {
                                                        ...p.phone.criteria
                                                          .fraud_score,
                                                        enabled:
                                                          e.target.checked,
                                                      },
                                                    },
                                                  },
                                                }))
                                              }
                                            />
                                            <span className="w-20 text-[--color-text-muted]">
                                              Fraud Score
                                            </span>
                                            {ipqsConfig.phone.criteria
                                              .fraud_score.enabled && (
                                              <>
                                                <select
                                                  className="rounded border border-[--color-border] bg-[--color-bg-muted] px-2 py-0.5 text-xs"
                                                  value={
                                                    ipqsConfig.phone.criteria
                                                      .fraud_score.operator
                                                  }
                                                  onChange={(e) =>
                                                    setIpqsConfig((p) => ({
                                                      ...p,
                                                      phone: {
                                                        ...p.phone,
                                                        criteria: {
                                                          ...p.phone.criteria,
                                                          fraud_score: {
                                                            ...p.phone.criteria
                                                              .fraud_score,
                                                            operator: e.target
                                                              .value as
                                                              | "lte"
                                                              | "gte"
                                                              | "eq",
                                                          },
                                                        },
                                                      },
                                                    }))
                                                  }
                                                >
                                                  <option value="lte">
                                                    ≤ (lte)
                                                  </option>
                                                  <option value="gte">
                                                    ≥ (gte)
                                                  </option>
                                                  <option value="eq">
                                                    = (eq)
                                                  </option>
                                                </select>
                                                <input
                                                  type="number"
                                                  min={0}
                                                  max={100}
                                                  className="w-16 rounded border border-[--color-border] bg-[--color-bg-muted] px-2 py-0.5 text-xs"
                                                  value={
                                                    ipqsConfig.phone.criteria
                                                      .fraud_score.value
                                                  }
                                                  onChange={(e) =>
                                                    setIpqsConfig((p) => ({
                                                      ...p,
                                                      phone: {
                                                        ...p.phone,
                                                        criteria: {
                                                          ...p.phone.criteria,
                                                          fraud_score: {
                                                            ...p.phone.criteria
                                                              .fraud_score,
                                                            value: Number(
                                                              e.target.value,
                                                            ),
                                                          },
                                                        },
                                                      },
                                                    }))
                                                  }
                                                />
                                              </>
                                            )}
                                          </div>
                                          {/* country */}
                                          <div className="flex flex-wrap items-center gap-3 text-xs">
                                            <input
                                              type="checkbox"
                                              className="h-3.5 w-3.5 accent-[--color-primary]"
                                              checked={
                                                ipqsConfig.phone.criteria
                                                  .country.enabled
                                              }
                                              onChange={(e) =>
                                                setIpqsConfig((p) => ({
                                                  ...p,
                                                  phone: {
                                                    ...p.phone,
                                                    criteria: {
                                                      ...p.phone.criteria,
                                                      country: {
                                                        ...p.phone.criteria
                                                          .country,
                                                        enabled:
                                                          e.target.checked,
                                                      },
                                                    },
                                                  },
                                                }))
                                              }
                                            />
                                            <span className="w-20 text-[--color-text-muted]">
                                              Country
                                            </span>
                                            {ipqsConfig.phone.criteria.country
                                              .enabled && (
                                              <input
                                                type="text"
                                                placeholder="US, CA, GB…"
                                                className="flex-1 min-w-0 rounded border border-[--color-border] bg-[--color-bg-muted] px-2 py-0.5 text-xs"
                                                value={
                                                  ipqsConfig.phone.criteria
                                                    .country.allowed
                                                }
                                                onChange={(e) =>
                                                  setIpqsConfig((p) => ({
                                                    ...p,
                                                    phone: {
                                                      ...p.phone,
                                                      criteria: {
                                                        ...p.phone.criteria,
                                                        country: {
                                                          ...p.phone.criteria
                                                            .country,
                                                          allowed:
                                                            e.target.value,
                                                        },
                                                      },
                                                    },
                                                  }))
                                                }
                                              />
                                            )}
                                          </div>
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>

                                {/* ── Email sub-check ── */}
                                <div className="rounded-lg border border-[--color-border] bg-[--color-bg] overflow-hidden">
                                  <div className="flex items-center justify-between px-3 py-2 gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setIpqsEmailOpen((v) => !v)
                                      }
                                      className="flex items-center gap-1.5 text-sm font-medium text-[--color-text] hover:text-[--color-primary] transition-colors"
                                    >
                                      <motion.span
                                        animate={{
                                          rotate: ipqsEmailOpen ? 90 : 0,
                                        }}
                                        transition={{ duration: 0.15 }}
                                        className="text-[10px] text-[--color-text-muted]"
                                      >
                                        ▶
                                      </motion.span>
                                      Email
                                    </button>
                                    <button
                                      type="button"
                                      role="switch"
                                      aria-checked={ipqsConfig.email.enabled}
                                      onClick={() =>
                                        setIpqsConfig((p) => ({
                                          ...p,
                                          email: {
                                            ...p.email,
                                            enabled: !p.email.enabled,
                                          },
                                        }))
                                      }
                                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${ipqsConfig.email.enabled ? "bg-[--color-primary]" : "bg-[--color-border]"}`}
                                    >
                                      <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-[--color-bg] transition ${ipqsConfig.email.enabled ? "translate-x-4" : "translate-x-0.5"}`}
                                      />
                                    </button>
                                  </div>
                                  <AnimatePresence initial={false}>
                                    {ipqsEmailOpen && (
                                      <motion.div
                                        key="email-criteria"
                                        initial={{ height: 0 }}
                                        animate={{ height: "auto" }}
                                        exit={{ height: 0 }}
                                        transition={{ duration: 0.18 }}
                                        style={{ overflow: "hidden" }}
                                      >
                                        <div className="px-3 pb-3 space-y-2.5 border-t border-[--color-border] pt-2.5">
                                          {/* valid */}
                                          <div className="flex flex-wrap items-center gap-3 text-xs">
                                            <input
                                              type="checkbox"
                                              className="h-3.5 w-3.5 accent-[--color-primary]"
                                              checked={
                                                ipqsConfig.email.criteria.valid
                                                  .enabled
                                              }
                                              onChange={(e) =>
                                                setIpqsConfig((p) => ({
                                                  ...p,
                                                  email: {
                                                    ...p.email,
                                                    criteria: {
                                                      ...p.email.criteria,
                                                      valid: {
                                                        ...p.email.criteria
                                                          .valid,
                                                        enabled:
                                                          e.target.checked,
                                                      },
                                                    },
                                                  },
                                                }))
                                              }
                                            />
                                            <span className="w-20 text-[--color-text-muted]">
                                              Valid
                                            </span>
                                            {ipqsConfig.email.criteria.valid
                                              .enabled && (
                                              <label className="flex items-center gap-1.5 text-[--color-text-muted]">
                                                <input
                                                  type="checkbox"
                                                  className="h-3.5 w-3.5 accent-[--color-primary]"
                                                  checked={
                                                    ipqsConfig.email.criteria
                                                      .valid.required
                                                  }
                                                  onChange={(e) =>
                                                    setIpqsConfig((p) => ({
                                                      ...p,
                                                      email: {
                                                        ...p.email,
                                                        criteria: {
                                                          ...p.email.criteria,
                                                          valid: {
                                                            ...p.email.criteria
                                                              .valid,
                                                            required:
                                                              e.target.checked,
                                                          },
                                                        },
                                                      },
                                                    }))
                                                  }
                                                />
                                                Required
                                              </label>
                                            )}
                                          </div>
                                          {/* fraud_score */}
                                          <div className="flex flex-wrap items-center gap-3 text-xs">
                                            <input
                                              type="checkbox"
                                              className="h-3.5 w-3.5 accent-[--color-primary]"
                                              checked={
                                                ipqsConfig.email.criteria
                                                  .fraud_score.enabled
                                              }
                                              onChange={(e) =>
                                                setIpqsConfig((p) => ({
                                                  ...p,
                                                  email: {
                                                    ...p.email,
                                                    criteria: {
                                                      ...p.email.criteria,
                                                      fraud_score: {
                                                        ...p.email.criteria
                                                          .fraud_score,
                                                        enabled:
                                                          e.target.checked,
                                                      },
                                                    },
                                                  },
                                                }))
                                              }
                                            />
                                            <span className="w-20 text-[--color-text-muted]">
                                              Fraud Score
                                            </span>
                                            {ipqsConfig.email.criteria
                                              .fraud_score.enabled && (
                                              <>
                                                <select
                                                  className="rounded border border-[--color-border] bg-[--color-bg-muted] px-2 py-0.5 text-xs"
                                                  value={
                                                    ipqsConfig.email.criteria
                                                      .fraud_score.operator
                                                  }
                                                  onChange={(e) =>
                                                    setIpqsConfig((p) => ({
                                                      ...p,
                                                      email: {
                                                        ...p.email,
                                                        criteria: {
                                                          ...p.email.criteria,
                                                          fraud_score: {
                                                            ...p.email.criteria
                                                              .fraud_score,
                                                            operator: e.target
                                                              .value as
                                                              | "lte"
                                                              | "gte"
                                                              | "eq",
                                                          },
                                                        },
                                                      },
                                                    }))
                                                  }
                                                >
                                                  <option value="lte">
                                                    ≤ (lte)
                                                  </option>
                                                  <option value="gte">
                                                    ≥ (gte)
                                                  </option>
                                                  <option value="eq">
                                                    = (eq)
                                                  </option>
                                                </select>
                                                <input
                                                  type="number"
                                                  min={0}
                                                  max={100}
                                                  className="w-16 rounded border border-[--color-border] bg-[--color-bg-muted] px-2 py-0.5 text-xs"
                                                  value={
                                                    ipqsConfig.email.criteria
                                                      .fraud_score.value
                                                  }
                                                  onChange={(e) =>
                                                    setIpqsConfig((p) => ({
                                                      ...p,
                                                      email: {
                                                        ...p.email,
                                                        criteria: {
                                                          ...p.email.criteria,
                                                          fraud_score: {
                                                            ...p.email.criteria
                                                              .fraud_score,
                                                            value: Number(
                                                              e.target.value,
                                                            ),
                                                          },
                                                        },
                                                      },
                                                    }))
                                                  }
                                                />
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>

                                {/* ── IP sub-check ── */}
                                <div className="rounded-lg border border-[--color-border] bg-[--color-bg] overflow-hidden">
                                  <div className="flex items-center justify-between px-3 py-2 gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setIpqsIpOpen((v) => !v)}
                                      className="flex items-center gap-1.5 text-sm font-medium text-[--color-text] hover:text-[--color-primary] transition-colors"
                                    >
                                      <motion.span
                                        animate={{
                                          rotate: ipqsIpOpen ? 90 : 0,
                                        }}
                                        transition={{ duration: 0.15 }}
                                        className="text-[10px] text-[--color-text-muted]"
                                      >
                                        ▶
                                      </motion.span>
                                      IP Address
                                    </button>
                                    <button
                                      type="button"
                                      role="switch"
                                      aria-checked={ipqsConfig.ip.enabled}
                                      onClick={() =>
                                        setIpqsConfig((p) => ({
                                          ...p,
                                          ip: {
                                            ...p.ip,
                                            enabled: !p.ip.enabled,
                                          },
                                        }))
                                      }
                                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${ipqsConfig.ip.enabled ? "bg-[--color-primary]" : "bg-[--color-border]"}`}
                                    >
                                      <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-[--color-bg] transition ${ipqsConfig.ip.enabled ? "translate-x-4" : "translate-x-0.5"}`}
                                      />
                                    </button>
                                  </div>
                                  <AnimatePresence initial={false}>
                                    {ipqsIpOpen && (
                                      <motion.div
                                        key="ip-criteria"
                                        initial={{ height: 0 }}
                                        animate={{ height: "auto" }}
                                        exit={{ height: 0 }}
                                        transition={{ duration: 0.18 }}
                                        style={{ overflow: "hidden" }}
                                      >
                                        <div className="px-3 pb-3 space-y-2.5 border-t border-[--color-border] pt-2.5">
                                          {/* fraud_score */}
                                          <div className="flex flex-wrap items-center gap-3 text-xs">
                                            <input
                                              type="checkbox"
                                              className="h-3.5 w-3.5 accent-[--color-primary]"
                                              checked={
                                                ipqsConfig.ip.criteria
                                                  .fraud_score.enabled
                                              }
                                              onChange={(e) =>
                                                setIpqsConfig((p) => ({
                                                  ...p,
                                                  ip: {
                                                    ...p.ip,
                                                    criteria: {
                                                      ...p.ip.criteria,
                                                      fraud_score: {
                                                        ...p.ip.criteria
                                                          .fraud_score,
                                                        enabled:
                                                          e.target.checked,
                                                      },
                                                    },
                                                  },
                                                }))
                                              }
                                            />
                                            <span className="w-20 text-[--color-text-muted]">
                                              Fraud Score
                                            </span>
                                            {ipqsConfig.ip.criteria.fraud_score
                                              .enabled && (
                                              <>
                                                <select
                                                  className="rounded border border-[--color-border] bg-[--color-bg-muted] px-2 py-0.5 text-xs"
                                                  value={
                                                    ipqsConfig.ip.criteria
                                                      .fraud_score.operator
                                                  }
                                                  onChange={(e) =>
                                                    setIpqsConfig((p) => ({
                                                      ...p,
                                                      ip: {
                                                        ...p.ip,
                                                        criteria: {
                                                          ...p.ip.criteria,
                                                          fraud_score: {
                                                            ...p.ip.criteria
                                                              .fraud_score,
                                                            operator: e.target
                                                              .value as
                                                              | "lte"
                                                              | "gte"
                                                              | "eq",
                                                          },
                                                        },
                                                      },
                                                    }))
                                                  }
                                                >
                                                  <option value="lte">
                                                    ≤ (lte)
                                                  </option>
                                                  <option value="gte">
                                                    ≥ (gte)
                                                  </option>
                                                  <option value="eq">
                                                    = (eq)
                                                  </option>
                                                </select>
                                                <input
                                                  type="number"
                                                  min={0}
                                                  max={100}
                                                  className="w-16 rounded border border-[--color-border] bg-[--color-bg-muted] px-2 py-0.5 text-xs"
                                                  value={
                                                    ipqsConfig.ip.criteria
                                                      .fraud_score.value
                                                  }
                                                  onChange={(e) =>
                                                    setIpqsConfig((p) => ({
                                                      ...p,
                                                      ip: {
                                                        ...p.ip,
                                                        criteria: {
                                                          ...p.ip.criteria,
                                                          fraud_score: {
                                                            ...p.ip.criteria
                                                              .fraud_score,
                                                            value: Number(
                                                              e.target.value,
                                                            ),
                                                          },
                                                        },
                                                      },
                                                    }))
                                                  }
                                                />
                                              </>
                                            )}
                                          </div>
                                          {/* country_code */}
                                          <div className="flex flex-wrap items-center gap-3 text-xs">
                                            <input
                                              type="checkbox"
                                              className="h-3.5 w-3.5 accent-[--color-primary]"
                                              checked={
                                                ipqsConfig.ip.criteria
                                                  .country_code.enabled
                                              }
                                              onChange={(e) =>
                                                setIpqsConfig((p) => ({
                                                  ...p,
                                                  ip: {
                                                    ...p.ip,
                                                    criteria: {
                                                      ...p.ip.criteria,
                                                      country_code: {
                                                        ...p.ip.criteria
                                                          .country_code,
                                                        enabled:
                                                          e.target.checked,
                                                      },
                                                    },
                                                  },
                                                }))
                                              }
                                            />
                                            <span className="w-20 text-[--color-text-muted]">
                                              Country
                                            </span>
                                            {ipqsConfig.ip.criteria.country_code
                                              .enabled && (
                                              <input
                                                type="text"
                                                placeholder="US, CA, GB…"
                                                className="flex-1 min-w-0 rounded border border-[--color-border] bg-[--color-bg-muted] px-2 py-0.5 text-xs"
                                                value={
                                                  ipqsConfig.ip.criteria
                                                    .country_code.allowed
                                                }
                                                onChange={(e) =>
                                                  setIpqsConfig((p) => ({
                                                    ...p,
                                                    ip: {
                                                      ...p.ip,
                                                      criteria: {
                                                        ...p.ip.criteria,
                                                        country_code: {
                                                          ...p.ip.criteria
                                                            .country_code,
                                                          allowed:
                                                            e.target.value,
                                                        },
                                                      },
                                                    },
                                                  }))
                                                }
                                              />
                                            )}
                                          </div>
                                          {/* proxy */}
                                          <div className="flex flex-wrap items-center gap-3 text-xs">
                                            <input
                                              type="checkbox"
                                              className="h-3.5 w-3.5 accent-[--color-primary]"
                                              checked={
                                                ipqsConfig.ip.criteria.proxy
                                                  .enabled
                                              }
                                              onChange={(e) =>
                                                setIpqsConfig((p) => ({
                                                  ...p,
                                                  ip: {
                                                    ...p.ip,
                                                    criteria: {
                                                      ...p.ip.criteria,
                                                      proxy: {
                                                        ...p.ip.criteria.proxy,
                                                        enabled:
                                                          e.target.checked,
                                                      },
                                                    },
                                                  },
                                                }))
                                              }
                                            />
                                            <span className="w-20 text-[--color-text-muted]">
                                              Proxy
                                            </span>
                                            {ipqsConfig.ip.criteria.proxy
                                              .enabled && (
                                              <label className="flex items-center gap-1.5 text-[--color-text-muted]">
                                                <input
                                                  type="checkbox"
                                                  className="h-3.5 w-3.5 accent-[--color-primary]"
                                                  checked={
                                                    ipqsConfig.ip.criteria.proxy
                                                      .allowed
                                                  }
                                                  onChange={(e) =>
                                                    setIpqsConfig((p) => ({
                                                      ...p,
                                                      ip: {
                                                        ...p.ip,
                                                        criteria: {
                                                          ...p.ip.criteria,
                                                          proxy: {
                                                            ...p.ip.criteria
                                                              .proxy,
                                                            allowed:
                                                              e.target.checked,
                                                          },
                                                        },
                                                      },
                                                    }))
                                                  }
                                                />
                                                Allow proxies
                                              </label>
                                            )}
                                          </div>
                                          {/* vpn */}
                                          <div className="flex flex-wrap items-center gap-3 text-xs">
                                            <input
                                              type="checkbox"
                                              className="h-3.5 w-3.5 accent-[--color-primary]"
                                              checked={
                                                ipqsConfig.ip.criteria.vpn
                                                  .enabled
                                              }
                                              onChange={(e) =>
                                                setIpqsConfig((p) => ({
                                                  ...p,
                                                  ip: {
                                                    ...p.ip,
                                                    criteria: {
                                                      ...p.ip.criteria,
                                                      vpn: {
                                                        ...p.ip.criteria.vpn,
                                                        enabled:
                                                          e.target.checked,
                                                      },
                                                    },
                                                  },
                                                }))
                                              }
                                            />
                                            <span className="w-20 text-[--color-text-muted]">
                                              VPN
                                            </span>
                                            {ipqsConfig.ip.criteria.vpn
                                              .enabled && (
                                              <label className="flex items-center gap-1.5 text-[--color-text-muted]">
                                                <input
                                                  type="checkbox"
                                                  className="h-3.5 w-3.5 accent-[--color-primary]"
                                                  checked={
                                                    ipqsConfig.ip.criteria.vpn
                                                      .allowed
                                                  }
                                                  onChange={(e) =>
                                                    setIpqsConfig((p) => ({
                                                      ...p,
                                                      ip: {
                                                        ...p.ip,
                                                        criteria: {
                                                          ...p.ip.criteria,
                                                          vpn: {
                                                            ...p.ip.criteria
                                                              .vpn,
                                                            allowed:
                                                              e.target.checked,
                                                          },
                                                        },
                                                      },
                                                    }))
                                                  }
                                                />
                                                Allow VPNs
                                              </label>
                                            )}
                                          </div>
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Save button — outside all cards */}
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          onClick={async () => {
                            if (
                              !dupCheckGloballyDisabled &&
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
                                enabled: dupCheckGloballyDisabled
                                  ? false
                                  : duplicateCheckEnabled,
                                criteria: duplicateCheckCriteria,
                              },
                              trusted_form: {
                                enabled: trustedFormGloballyDisabled
                                  ? false
                                  : trustedFormEnabled,
                              },
                              ipqs: {
                                enabled: ipqsGloballyDisabled
                                  ? false
                                  : ipqsConfig.enabled,
                                phone: {
                                  enabled: ipqsConfig.phone.enabled,
                                  criteria: {
                                    valid: ipqsConfig.phone.criteria.valid,
                                    fraud_score:
                                      ipqsConfig.phone.criteria.fraud_score,
                                    country: {
                                      enabled:
                                        ipqsConfig.phone.criteria.country
                                          .enabled,
                                      allowed:
                                        ipqsConfig.phone.criteria.country.allowed
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
                                    fraud_score:
                                      ipqsConfig.ip.criteria.fraud_score,
                                    country_code: {
                                      enabled:
                                        ipqsConfig.ip.criteria.country_code
                                          .enabled,
                                      allowed:
                                        ipqsConfig.ip.criteria.country_code.allowed
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
                          }}
                        >
                          Save Integrations
                        </Button>
                      </div>

                      {/* Plugin change history */}
                      {(() => {
                        const pluginHistory = (campaign.edit_history ?? [])
                          .filter((e) => e.field?.startsWith("plugins."))
                          .sort(
                            (a, b) =>
                              new Date(b.changed_at).getTime() -
                              new Date(a.changed_at).getTime(),
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
                                      entry.changed_by as {
                                        username?: string;
                                        email?: string;
                                      },
                                    )
                                  : null;
                                const prev =
                                  entry.previous_value != null
                                    ? String(entry.previous_value)
                                    : null;
                                const next =
                                  entry.new_value != null
                                    ? String(entry.new_value)
                                    : null;
                                return (
                                  <div
                                    key={i}
                                    className="p-3 text-xs bg-[--color-bg-muted]"
                                  >
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
                                      <span className="text-[--color-text-muted]">
                                        →
                                      </span>
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
                      })()}
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

      {/* ── Title edit mini-modal ────────────────────────────────────────── */}
      <AnimatePresence>
        {titleEditing && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-start justify-center pt-20 px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => {
              setNameDraft(campaign.name);
              setStatusDraft(campaign.status);
              setTitleEditing(false);
            }}
          >
            <motion.div
              className="panel w-full max-w-sm shadow-2xl ring-1 ring-black/10"
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[--color-border] px-4 py-3">
                <p className="text-sm font-semibold text-[--color-text-strong]">
                  Edit Campaign
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setNameDraft(campaign.name);
                    setStatusDraft(campaign.status);
                    setTitleEditing(false);
                  }}
                  className="rounded p-1 text-[--color-text-muted] hover:text-[--color-danger] transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="px-4 py-4 space-y-3 text-sm">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                    Campaign Name
                  </p>
                  <input
                    className={inputClass}
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setNameDraft(campaign.name);
                        setStatusDraft(campaign.status);
                        setTitleEditing(false);
                      }
                      if (e.key === "Enter") saveTitleEdit();
                    }}
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                    Status
                  </p>
                  <select
                    className={inputClass}
                    value={statusDraft}
                    onChange={(e) =>
                      setStatusDraft(e.target.value as Campaign["status"])
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
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setNameDraft(campaign.name);
                      setStatusDraft(campaign.status);
                      setTitleEditing(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={savingTitle}
                    onClick={saveTitleEdit}
                  >
                    {savingTitle ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
