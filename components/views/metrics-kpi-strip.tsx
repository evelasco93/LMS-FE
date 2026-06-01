"use client";

import type { IpqsRollup, MetricsCounters, QualityRollup } from "@/lib/types";
import {
  acceptedNotSoldRate,
  resolveDnqCount,
  resolveDuplicateCount,
  resolveSpamCount,
  soldRate,
} from "@/lib/metrics-derive";
import { formatTrustedScorePct } from "@/lib/utils";

const numberFormatter = new Intl.NumberFormat("en-US");

type MetricsKpiStripProps = {
  totals: MetricsCounters;
  quality?: QualityRollup | null;
  ipqs?: IpqsRollup | null;
  /** When provided, used as the OVERALL Trusted Score on the top row.
   *  When null, the tile renders an em-dash (no side-channel fallback). */
  overallTrustedScorePct: number | null;
  loading?: boolean;
};

type CountTile = {
  key: string;
  label: string;
  value: number | null;
  tone: string;
};

type PercentTile = {
  key: string;
  label: string;
  value: number;
  tone: string;
};

function pct(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}%`;
}

export function MetricsKpiStrip({
  totals,
  quality,
  ipqs,
  overallTrustedScorePct,
  loading,
}: MetricsKpiStripProps) {
  const dnq = resolveDnqCount(totals, quality ?? null);
  const spam = resolveSpamCount(totals, quality ?? null);
  const duplicates = resolveDuplicateCount(totals, quality ?? null);

  // Tones are paired so a percentage column matches its count column.
  const toneSold = "text-[--color-success]";
  const toneAcceptedNotSold = "text-[--color-primary]";
  const toneDnq = "text-[--color-warning]";
  const toneSpam = "text-[--color-danger]";
  const toneNeutral = "text-[--color-text-strong]";
  const toneAccent = "text-[--color-secondary]";

  const counts: CountTile[] = [
    {
      key: "received",
      label: "Received",
      value: totals.received,
      tone: toneNeutral,
    },
    {
      key: "accepted",
      label: "Accepted",
      value: totals.accepted,
      tone: toneSold,
    },
    { key: "sold", label: "Sold", value: totals.sold, tone: toneSold },
    {
      key: "accepted_not_sold",
      label: "Accepted Not Sold",
      value: totals.accepted_not_sold,
      tone: toneAcceptedNotSold,
    },
    { key: "dnq", label: "DNQ", value: dnq, tone: toneDnq },
    { key: "spam", label: "SPAM", value: spam, tone: toneSpam },
    {
      key: "duplicates",
      label: "Duplicates",
      value: duplicates,
      tone: toneNeutral,
    },
    {
      key: "trusted_score",
      label: "Trusted Score",
      // ipqs reference kept so the Trusted Score tile is fed by IPQS rollup
      // when the BE doesn't supply an explicit `overallTrustedScorePct`.
      value: overallTrustedScorePct ?? ipqs?.trusted_score_pct ?? null,
      tone: toneAccent,
    },
  ];

  const percentages: PercentTile[] = [
    {
      key: "sold_pct",
      label: "SOLD %",
      value: soldRate(totals),
      tone: toneSold,
    },
    {
      key: "ans_pct",
      label: "ACCEPTED NOT SOLD %",
      value: acceptedNotSoldRate(totals),
      tone: toneAcceptedNotSold,
    },
    {
      key: "dnq_pct",
      label: "DNQ %",
      value: totals.received > 0 ? (dnq / totals.received) * 100 : 0,
      tone: toneDnq,
    },
    {
      key: "spam_pct",
      label: "SPAM %",
      value: totals.received > 0 ? (spam / totals.received) * 100 : 0,
      tone: toneSpam,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {counts.map((tile) => (
          <div
            key={tile.key}
            className="panel flex min-h-[96px] flex-col items-center justify-center p-3 text-center sm:p-4"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
              {tile.label}
            </p>
            <p
              className={`mt-2 text-2xl font-bold tabular-nums sm:text-3xl ${tile.tone}`}
            >
              {loading || tile.value === null
                ? "—"
                : tile.key === "trusted_score"
                  ? formatTrustedScorePct(tile.value)
                  : numberFormatter.format(tile.value)}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {percentages.map((tile) => (
          <div
            key={tile.key}
            className="panel flex min-h-[96px] flex-col items-center justify-center p-3 text-center sm:p-4"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
              {tile.label}
            </p>
            <p
              className={`mt-2 text-2xl font-bold tabular-nums sm:text-3xl ${tile.tone}`}
            >
              {loading ? "—" : pct(tile.value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
