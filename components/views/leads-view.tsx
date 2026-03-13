"use client";

import { useMemo } from "react";
import { Check, MinusCircle, X } from "lucide-react";
import { motion } from "framer-motion";
import { Table } from "@/components/table";
import { Badge } from "@/components/badge";
import type { Affiliate, Campaign, Lead } from "@/lib/types";
import type { CampaignDetailTab } from "@/lib/types";
import type React from "react";

// ─── Helpers (local) ──────────────────────────────────────────────────────────

function formatCompactDateTimeFallback(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).formatToParts(date);
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  const month = byType.get("month") || "--";
  const day = byType.get("day") || "--";
  const year = byType.get("year") || "----";
  const hour = byType.get("hour") || "--";
  const minute = byType.get("minute") || "--";
  const dayPeriod = byType.get("dayPeriod") || "";
  const abbr = byType.get("timeZoneName") || "";
  return `${month}/${day}/${year} ${hour}:${minute}${dayPeriod ? ` ${dayPeriod}` : ""} ${abbr}`.trim();
}

function getLeadIpTz(lead: Lead): string | null {
  try {
    const ipqs = lead.payload?.ipqs_response as
      | Record<string, unknown>
      | undefined;
    const tz = ipqs?.timezone;
    if (typeof tz === "string" && tz.length > 0) {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return tz;
    }
  } catch {
    // invalid tz
  }
  return null;
}

function formatInTz(
  value: string,
  timeZone: string,
): { time: string; abbr: string } {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone,
    timeZoneName: "short",
  }).formatToParts(date);
  const byType = new Map(parts.map((p) => [p.type, p.value]));
  const month = byType.get("month") || "--";
  const day = byType.get("day") || "--";
  const year = byType.get("year") || "----";
  const hour = byType.get("hour") || "--";
  const minute = byType.get("minute") || "--";
  const dayPeriod = byType.get("dayPeriod") || "";
  const abbr = byType.get("timeZoneName") || timeZone;
  return {
    time: `${month}/${day}/${year} ${hour}:${minute}${dayPeriod ? ` ${dayPeriod}` : ""}`,
    abbr,
  };
}

// ─── LeadsView ────────────────────────────────────────────────────────────────

interface LeadsViewProps {
  leads: Lead[];
  campaigns: Campaign[];
  affiliates: Affiliate[];
  isLoading: boolean;
  /** Open campaign detail modal */
  onOpenCampaign: (
    campaignId: string,
    section?: CampaignDetailTab,
    affiliateId?: string,
  ) => void;
  /** PayloadPreview component injected — since it depends on router hooks */
  renderPayloadPreview: (lead: Lead, allLeads: Lead[]) => React.ReactNode;
}

export function LeadsView({
  leads,
  campaigns,
  affiliates,
  isLoading,
  onOpenCampaign,
  renderPayloadPreview,
}: LeadsViewProps) {
  const sortedLeads = useMemo(() => {
    return [...leads].sort((a, b) => {
      const left = a.created_at ? new Date(a.created_at).getTime() : 0;
      const right = b.created_at ? new Date(b.created_at).getTime() : 0;
      return left - right;
    });
  }, [leads]);

  const campaignIdMap = useMemo(() => {
    const map = new Map<string, Campaign>();
    campaigns.forEach((c) => map.set(c.id, c));
    return map;
  }, [campaigns]);

  const campaignKeyMap = useMemo(() => {
    const map = new Map<string, { campaign: Campaign; affiliateId?: string }>();
    campaigns.forEach((c) => {
      (c.affiliates || []).forEach((a) => {
        if (a.campaign_key) {
          map.set(a.campaign_key, { campaign: c, affiliateId: a.affiliate_id });
        }
      });
    });
    return map;
  }, [campaigns]);

  const affiliateIdMap = useMemo(() => {
    const map = new Map<string, Affiliate>();
    affiliates.forEach((a) => map.set(a.id, a));
    return map;
  }, [affiliates]);

  return (
    <motion.section
      key="leads"
      className="space-y-4"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <Table
        columns={[
          {
            key: "id",
            label: "ID",
            width: "120px",
            render: (lead) => <span className="font-medium">{lead.id}</span>,
          },
          {
            key: "campaign_id",
            label: "Campaign",
            width: "180px",
            render: (lead) => (
              <button
                type="button"
                className="text-[--color-primary] underline underline-offset-2"
                onClick={() => onOpenCampaign(lead.campaign_id)}
              >
                {campaignIdMap.get(lead.campaign_id)?.name || lead.campaign_id}
              </button>
            ),
          },
          {
            key: "campaign_key",
            label: "Affiliate",
            width: "180px",
            render: (lead) => {
              const mapping = campaignKeyMap.get(lead.campaign_key || "");
              if (!mapping) return lead.campaign_key || "";
              const affiliateName = mapping.affiliateId
                ? affiliateIdMap.get(mapping.affiliateId)?.name
                : null;
              return (
                <button
                  type="button"
                  className="text-[--color-primary] underline underline-offset-2"
                  onClick={() =>
                    onOpenCampaign(
                      mapping.campaign.id,
                      "affiliates",
                      mapping.affiliateId,
                    )
                  }
                >
                  {affiliateName || lead.campaign_key || ""}
                </button>
              );
            },
          },
          {
            key: "test",
            label: "Mode",
            width: "96px",
            render: (lead) => (
              <Badge tone={lead.test ? "info" : "success"}>
                {lead.test ? "Test" : "Live"}
              </Badge>
            ),
          },
          {
            key: "qa_duplicate",
            label: "Duplicate",
            width: "96px",
            render: (lead) => (
              <div className="mx-auto flex w-fit items-center justify-center">
                {lead.duplicate ? (
                  <X size={18} className="text-[--color-danger]" />
                ) : (
                  <Check size={18} className="text-[--color-success]" />
                )}
              </div>
            ),
          },
          {
            key: "qa_trusted_form",
            label: "TrustedForm",
            width: "108px",
            render: (lead) => {
              const tf = lead.trusted_form_result;
              if (tf == null) {
                const campaign = campaignIdMap.get(lead.campaign_id);
                const disabled =
                  campaign?.plugins?.trusted_form?.enabled === false;
                return (
                  <div className="mx-auto flex w-fit items-center justify-center">
                    {disabled ? (
                      <span className="flex items-center gap-1 text-xs text-[--color-text-muted]">
                        <MinusCircle size={13} />
                        Disabled
                      </span>
                    ) : (
                      <span className="text-[--color-text-muted]">—</span>
                    )}
                  </div>
                );
              }
              return (
                <div className="mx-auto flex w-fit items-center justify-center">
                  {tf.success ? (
                    <Check size={18} className="text-[--color-success]" />
                  ) : (
                    <X size={18} className="text-[--color-danger]" />
                  )}
                </div>
              );
            },
          },
          {
            key: "qa_ipqs",
            label: "IPQS",
            width: "96px",
            render: (lead) => {
              const iq = lead.ipqs_result;
              if (iq == null) {
                const campaign = campaignIdMap.get(lead.campaign_id);
                const disabled = campaign?.plugins?.ipqs?.enabled === false;
                return (
                  <div className="mx-auto flex w-fit items-center justify-center">
                    {disabled ? (
                      <span className="flex items-center gap-1 text-xs text-[--color-text-muted]">
                        <MinusCircle size={13} />
                        Disabled
                      </span>
                    ) : (
                      <span className="text-[--color-text-muted]">—</span>
                    )}
                  </div>
                );
              }
              return (
                <div className="mx-auto flex w-fit items-center justify-center">
                  {iq.success ? (
                    <Check size={18} className="text-[--color-success]" />
                  ) : (
                    <X size={18} className="text-[--color-danger]" />
                  )}
                </div>
              );
            },
          },
          {
            key: "created_at",
            label: "Created",
            width: "190px",
            render: (lead) => {
              const ipTz = lead.created_at ? getLeadIpTz(lead) : null;
              if (lead.created_at && ipTz) {
                const { time, abbr } = formatInTz(lead.created_at, ipTz);
                return (
                  <div>
                    <span>{time}</span>
                    <span className="ml-1.5 text-xs text-[--color-text-muted]">
                      {abbr}
                    </span>
                  </div>
                );
              }
              return (
                <span>{formatCompactDateTimeFallback(lead.created_at)}</span>
              );
            },
          },
          {
            key: "intake_status",
            label: "Status",
            width: "112px",
            render: (lead) => (
              <Badge tone={lead.rejected ? "danger" : "success"}>
                {lead.rejected ? "Rejected" : "Accepted"}
              </Badge>
            ),
          },
          {
            key: "payload",
            label: "Details",
            render: (lead) => renderPayloadPreview(lead, sortedLeads),
          },
        ]}
        data={sortedLeads}
        emptyLabel={isLoading ? "Loading leads…" : "No leads available."}
      />
    </motion.section>
  );
}
