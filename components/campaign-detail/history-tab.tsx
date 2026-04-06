"use client";

import type { AuditLogItem } from "@/lib/types";
import { CampaignAuditRow } from "./campaign-audit-row";

export function HistoryTab({
  campaignAuditData,
  allCampaignAuditItems,
  clientNameById,
  affiliateNameById,
}: {
  campaignAuditData: unknown;
  allCampaignAuditItems: AuditLogItem[];
  clientNameById: Map<string, string>;
  affiliateNameById: Map<string, string>;
}) {
  return (
    <div className="divide-y divide-[--color-border]">
      {!campaignAuditData ? (
        <p className="py-10 text-center text-sm text-[--color-text-muted]">
          Loading history…
        </p>
      ) : allCampaignAuditItems.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-[--color-text-muted]">
            No history recorded for this campaign.
          </p>
        </div>
      ) : (
        allCampaignAuditItems.map((item) => (
          <CampaignAuditRow
            key={item.log_id}
            item={item}
            clientNameById={clientNameById}
            affiliateNameById={affiliateNameById}
          />
        ))
      )}
    </div>
  );
}
