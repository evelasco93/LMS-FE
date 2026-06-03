"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Search } from "lucide-react";
import { trustedScoreBandColor } from "@/lib/utils";

type CampaignCardMetrics = {
  totalLeads: number;
  trustedScorePct: number | null;
  accepted: number;
  acceptedPct: number;
  rejected: number;
  rejectedPct: number;
};

export type CampaignSummaryCardItem = {
  id: string;
  title: string;
  subtitle?: string;
  metrics: CampaignCardMetrics;
};

type CampaignSummaryCardProps = {
  item: CampaignSummaryCardItem;
  active: boolean;
  onSelect: (id: string) => void;
};

type CampaignSummaryCardGridProps = {
  items: CampaignSummaryCardItem[];
  selectedId?: string;
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  onSelect: (id: string) => void;
};

const COUNT_FORMATTER = new Intl.NumberFormat("en-US");

function formatCampaignCardCount(value: number): string {
  return COUNT_FORMATTER.format(value);
}

function formatCampaignCardTrustedScore(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}%`;
}

function formatCampaignCardRate(value: number): string {
  if (!Number.isFinite(value)) return "0.0%";
  return `${value.toFixed(1)}%`;
}

function clampTrustedPercent(value: number | null): number {
  if (value === null || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function CampaignSummaryCard({
  item,
  active,
  onSelect,
}: CampaignSummaryCardProps) {
  const trustedPercent = clampTrustedPercent(item.metrics.trustedScorePct);

  return (
    <motion.button
      type="button"
      layout
      onClick={() => onSelect(item.id)}
      whileHover={{ scale: 1.018 }}
      whileTap={{ scale: 0.985 }}
      className={`group relative w-full overflow-hidden rounded-[calc(var(--radius-sm)+8px)] border p-4 text-center transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-primary] focus-visible:ring-offset-2 focus-visible:ring-offset-[--color-bg] md:aspect-square ${
        active
          ? "border-[--color-border-alt] bg-[color-mix(in_srgb,var(--color-primary)_12%,var(--color-panel))] shadow-[0_18px_38px_-22px_color-mix(in_srgb,var(--color-primary)_68%,transparent)]"
          : "border-[--color-border] bg-[--color-panel] shadow-[0_12px_28px_-22px_color-mix(in_srgb,var(--color-text)_38%,transparent)] hover:border-[color-mix(in_srgb,var(--color-border-alt)_78%,var(--color-border))] hover:shadow-[0_22px_44px_-22px_color-mix(in_srgb,var(--color-text)_45%,transparent)]"
      }`}
      aria-pressed={active}
    >
      <div className="mb-3 min-w-0 text-center">
        <p className="truncate text-xl font-bold text-[--color-text-strong]">
          {item.title}
        </p>
        {item.subtitle && (
          <p className="mt-0.5 truncate text-[11px] text-[--color-text-muted]">
            {item.subtitle}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2">
        <MetricLabel
          label="Total Leads"
          value={formatCampaignCardCount(item.metrics.totalLeads)}
        />
        <MetricLabel
          label="Accepted"
          value={`${formatCampaignCardCount(item.metrics.accepted)} (${formatCampaignCardRate(item.metrics.acceptedPct)})`}
          tone="text-[--color-success]"
        />
        <MetricLabel
          label="Rejected"
          value={`${formatCampaignCardCount(item.metrics.rejected)} (${formatCampaignCardRate(item.metrics.rejectedPct)})`}
          tone="text-[--color-danger]"
        />

        <div className="rounded-[--radius-sm] border border-[color-mix(in_srgb,var(--color-border)_76%,transparent)] bg-[color-mix(in_srgb,var(--color-bg-muted)_72%,var(--color-panel))] p-2.5">
          <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
            <span>Trusted score</span>
            <span className="text-[--color-text-strong]">
              {formatCampaignCardTrustedScore(item.metrics.trustedScorePct)}
            </span>
          </div>
          <div className="h-2 rounded-[--radius-pill] bg-[color-mix(in_srgb,var(--color-border)_72%,transparent)]">
            <motion.div
              className="h-full rounded-[--radius-pill]"
              style={{ backgroundColor: trustedScoreBandColor(trustedPercent) }}
              initial={{ width: 0 }}
              animate={{ width: `${trustedPercent}%` }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[--color-text-muted] transition-colors group-hover:text-[--color-text-strong]">
        <span>Open dashboard</span>
        <ArrowRight size={12} aria-hidden="true" />
      </div>
    </motion.button>
  );
}

export function CampaignSummaryCardGrid({
  items,
  selectedId,
  searchValue,
  onSearchValueChange,
  onSelect,
}: CampaignSummaryCardGridProps) {
  const [localSearchValue, setLocalSearchValue] = useState(searchValue);

  useEffect(() => {
    setLocalSearchValue(searchValue);
  }, [searchValue]);

  const handleSearchChange = (value: string) => {
    setLocalSearchValue(value);
    onSearchValueChange(value);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-center">
        <div className="relative block w-full max-w-[680px]">
          <Search
            size={14}
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[--color-text-muted]"
            aria-hidden="true"
          />
          <input
            type="text"
            value={localSearchValue}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Search campaigns"
            aria-label="Search campaigns"
            className="w-full rounded-[--radius-sm] border border-[--color-border] bg-[color-mix(in_srgb,var(--color-panel)_88%,var(--color-bg-subtle))] py-2.5 pr-3.5 pl-8 text-sm text-[--color-text] outline-none transition-shadow focus:border-[--color-primary] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_30%,transparent)]"
          />
        </div>
      </div>

      <motion.div
        layout
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
      >
        {items.length === 0 ? (
          <div className="col-span-full rounded-[--radius-sm] border border-dashed border-[--color-border] p-6 text-center text-sm text-[--color-text-muted]">
            No campaigns match your search.
          </div>
        ) : (
          items.map((item) => (
            <CampaignSummaryCard
              key={item.id}
              item={item}
              active={selectedId === item.id}
              onSelect={onSelect}
            />
          ))
        )}
      </motion.div>
    </div>
  );
}

function MetricLabel({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-[--radius-sm] border border-[color-mix(in_srgb,var(--color-border)_84%,transparent)] bg-[color-mix(in_srgb,var(--color-bg-muted)_72%,var(--color-panel))] px-2 py-2 text-center">
      <span className="block text-[10px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
        {label}
      </span>
      <span
        className={`mt-0.5 block text-sm font-semibold tabular-nums ${tone ?? "text-[--color-text-strong]"}`}
      >
        {value}
      </span>
    </div>
  );
}
