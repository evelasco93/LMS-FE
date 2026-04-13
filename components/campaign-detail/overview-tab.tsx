"use client";

import { ArrowRight, GitBranch, LayoutGrid, Settings2 } from "lucide-react";
import { InfoItem } from "@/components/ui/info-item";
import { formatDateTime } from "@/lib/utils";
import type { Campaign, CriteriaField, LogicRule, Lead } from "@/lib/types";
import type { CampaignDetailTab } from "@/lib/types";

export function OverviewTab({
  campaign,
  leadsForCampaign,
  linkedClientsCount,
  linkedAffiliatesCount,
  criteriaFields,
  logicRules,
  onTabChange,
  onOpenLeadsForCampaign,
  setSettingsSubTab,
}: {
  campaign: Campaign;
  leadsForCampaign: Lead[];
  linkedClientsCount: number;
  linkedAffiliatesCount: number;
  criteriaFields: CriteriaField[];
  logicRules: LogicRule[];
  onTabChange: (
    tab: CampaignDetailTab,
    subTab?: "base-criteria" | "logic" | "routing",
  ) => void;
  onOpenLeadsForCampaign: (campaignId: string) => void;
  setSettingsSubTab: (sub: "base-criteria" | "logic" | "routing") => void;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
        <InfoItem label="Created" value={formatDateTime(campaign.created_at)} />
        <InfoItem label="Updated" value={formatDateTime(campaign.updated_at)} />
        <InfoItem
          label="Lead Count"
          value={leadsForCampaign.length.toString()}
          onClick={() => onOpenLeadsForCampaign(campaign.id)}
        />
        <InfoItem
          label="Linked End Users"
          value={linkedClientsCount.toString()}
          onClick={() => onTabChange("clients")}
        />
        <InfoItem
          label="Linked Sources"
          value={linkedAffiliatesCount.toString()}
          onClick={() => onTabChange("affiliates")}
        />
      </div>

      {/* Overview shortcuts → Fields, Rules, Distribution */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {/* Fields */}
        <button
          type="button"
          onClick={() => {
            setSettingsSubTab("base-criteria");
            onTabChange("settings", "base-criteria");
          }}
          className="flex items-start gap-3 rounded-lg border border-[--color-border] bg-[--color-panel] px-4 py-3 text-left transition hover:border-[--color-primary] hover:bg-[--color-accent]"
        >
          <LayoutGrid
            size={16}
            className="mt-0.5 shrink-0 text-[--color-primary]"
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[--color-text-strong]">
              Fields
            </p>
            <p className="mt-0.5 text-[11px] text-[--color-text-muted]">
              {criteriaFields.length} field
              {criteriaFields.length !== 1 ? "s" : ""} defined
            </p>
          </div>
          <ArrowRight
            size={13}
            className="ml-auto mt-0.5 shrink-0 text-[--color-text-muted]"
          />
        </button>

        {/* Rules */}
        <button
          type="button"
          onClick={() => {
            setSettingsSubTab("logic");
            onTabChange("settings", "logic");
          }}
          className="flex items-start gap-3 rounded-lg border border-[--color-border] bg-[--color-panel] px-4 py-3 text-left transition hover:border-[--color-primary] hover:bg-[--color-accent]"
        >
          <GitBranch
            size={16}
            className="mt-0.5 shrink-0 text-[--color-primary]"
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[--color-text-strong]">
              Rules
            </p>
            <p className="mt-0.5 text-[11px] text-[--color-text-muted]">
              {logicRules.length} rule{logicRules.length !== 1 ? "s" : ""}{" "}
              defined
            </p>
          </div>
          <ArrowRight
            size={13}
            className="ml-auto mt-0.5 shrink-0 text-[--color-text-muted]"
          />
        </button>

        {/* Distribution */}
        <button
          type="button"
          onClick={() => {
            setSettingsSubTab("routing");
            onTabChange("settings", "routing");
          }}
          className="flex items-start gap-3 rounded-lg border border-[--color-border] bg-[--color-panel] px-4 py-3 text-left transition hover:border-[--color-primary] hover:bg-[--color-accent]"
        >
          <Settings2
            size={16}
            className="mt-0.5 shrink-0 text-[--color-primary]"
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[--color-text-strong]">
              Distribution
            </p>
            <p className="mt-0.5 text-[11px] text-[--color-text-muted]">
              {campaign.distribution?.enabled
                ? `${campaign.distribution.mode === "round_robin" ? "Round Robin" : "Weighted"} · Enabled`
                : "Distribution disabled"}
            </p>
          </div>
          <ArrowRight
            size={13}
            className="ml-auto mt-0.5 shrink-0 text-[--color-text-muted]"
          />
        </button>
      </div>
    </>
  );
}
