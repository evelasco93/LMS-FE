"use client";

import type { IpqsRollup, MetricsCounters, QualityRollup } from "@/lib/types";
import {
  acceptedRate,
  cherryPickedRate,
  dnqRate,
  duplicateRate,
  deriveVolumeCounts,
  type MarketingSourceRow,
  buildOverallIpqsRollup,
  buildOverallTrustedScorePct,
  rejectedRate,
  soldRate,
} from "@/lib/metrics-derive";
import { HoverTooltip } from "@/components/ui/hover-tooltip";
import { formatTrustedScorePct, trustedScoreBandColor } from "@/lib/utils";

const numberFormatter = new Intl.NumberFormat("en-US");

function fmtPct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}%`;
}

type MetricsMarketingSourcesTableProps = {
  rows: MarketingSourceRow[];
  loading?: boolean;
  overallTotals: MetricsCounters;
  overallQuality?: QualityRollup | null;
  scopeLabel?: string;
  /** Heading override for the table panel. Defaults to "Marketing Sources". */
  headingLabel?: string;
  /** First column header override. Defaults to "Source". */
  firstColumnLabel?: string;
  onRowOpen?: (row: MarketingSourceRow) => void;
};

export function MetricsMarketingSourcesTable({
  rows,
  loading,
  overallTotals,
  overallQuality,
  scopeLabel,
  headingLabel = "Marketing Sources",
  firstColumnLabel = "Source",
  onRowOpen,
}: MetricsMarketingSourcesTableProps) {
  const overallVolume = deriveVolumeCounts(
    overallTotals,
    overallQuality ?? null,
  );
  const overallDnq = overallVolume.dnq;
  const overallDuplicate = overallVolume.duplicate;
  const overallRejected = overallVolume.rejected;
  const overallSoldPct = soldRate(overallTotals);
  const overallRejectedPct = rejectedRate(
    overallTotals,
    overallQuality ?? null,
  );
  const overallDnqPct = dnqRate(overallTotals, overallQuality ?? null);
  const overallDuplicatePct = duplicateRate(
    overallTotals,
    overallQuality ?? null,
  );
  // CR-002 — Trusted Score for OVERALL is now derived from visible rows
  // (weighted by row leads); no longer pulled from `summary.ipqs.trusted_score_pct`.
  const overallTrustedScorePct = buildOverallTrustedScorePct(rows);
  const overallIpqs = buildOverallIpqsRollup(rows);
  // CR-003 — Cherry Picked OVERALL prefers BE-rolled `cherry_picked` on totals;
  // falls back to summing visible rows so older BE payloads still render a value.
  const overallCherryPicked =
    overallTotals.cherry_picked ??
    rows.reduce((sum, row) => sum + row.cherryPicked, 0);
  const overallCherryPickedPct =
    overallTotals.cherry_picked !== undefined
      ? cherryPickedRate(overallTotals)
      : overallTotals.received > 0
        ? (overallCherryPicked / overallTotals.received) * 100
        : 0;
  const overallAcceptedPct = acceptedRate(overallTotals);

  return (
    <div className="panel p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[--color-text-strong]">
          {headingLabel}
        </h3>
        {scopeLabel && (
          <span className="text-xs text-[--color-text-muted]">
            {scopeLabel}
          </span>
        )}
      </div>

      {loading && rows.length === 0 ? (
        <div className="h-40 animate-pulse rounded-[--radius-sm] bg-[--color-bg-subtle]" />
      ) : rows.length === 0 ? (
        <div className="rounded-[--radius-sm] border border-dashed border-[--color-border] p-6 text-center text-sm text-[--color-text-muted]">
          No sources available for this filter scope.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-center text-[11px] uppercase tracking-wide text-[--color-text-muted]">
                <th className="px-3 py-1">{firstColumnLabel}</th>
                <th className="px-3 py-1"># Leads</th>
                <th className="px-3 py-1">Cherry Picked</th>
                <th className="px-3 py-1">Sold</th>
                <th className="px-3 py-1">Accepted</th>
                <th className="px-3 py-1">Rejected</th>
                <th className="px-3 py-1">DNQ</th>
                <th className="px-3 py-1">Duplicate</th>
                <th className="px-3 py-1">Sold %</th>
                <th className="px-3 py-1">Cherry Picked %</th>
                <th className="px-3 py-1">Accepted %</th>
                <th className="px-3 py-1">Rejected %</th>
                <th className="px-3 py-1">DNQ %</th>
                <th className="px-3 py-1">Duplicate %</th>
                <th className="px-3 py-1">Trusted Score</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`mkt-src-${row.key}`}
                  className="cursor-pointer rounded-[--radius-sm] bg-[--color-bg-muted] text-[--color-text] transition hover:bg-[--color-row-hover]"
                  onClick={() => onRowOpen?.(row)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onRowOpen?.(row);
                    }
                  }}
                >
                  <td
                    className="px-3 py-2 text-center font-medium text-[--color-text-strong]"
                    title={row.label}
                  >
                    <span className="mx-auto block max-w-[18rem] truncate text-center">
                      {row.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {numberFormatter.format(row.leads)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {numberFormatter.format(row.cherryPicked)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {numberFormatter.format(row.sold)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {numberFormatter.format(row.sold + row.cherryPicked)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {numberFormatter.format(row.rejected)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {numberFormatter.format(row.dnq)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {numberFormatter.format(row.duplicate)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {fmtPct(row.soldPct)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {fmtPct(
                      row.leads > 0 ? (row.cherryPicked / row.leads) * 100 : 0,
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {fmtPct(
                      row.soldPct +
                        (row.leads > 0
                          ? (row.cherryPicked / row.leads) * 100
                          : 0),
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {fmtPct(row.rejectedPct)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {fmtPct(row.dnqPct)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {fmtPct(row.duplicatePct)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <TrustedScoreBar
                      pct={row.trustedScorePct}
                      ipqs={row.ipqs ?? null}
                      label={row.label}
                    />
                  </td>
                </tr>
              ))}

              <tr className="rounded-[--radius-sm] bg-[color-mix(in_srgb,var(--color-primary)_10%,var(--color-panel))] text-[--color-text-strong]">
                <td className="px-3 py-2 text-center text-xs font-bold uppercase tracking-wide">
                  Overall
                </td>
                <td className="px-3 py-2 text-center font-semibold">
                  {numberFormatter.format(overallTotals.received)}
                </td>
                <td className="px-3 py-2 text-center font-semibold">
                  {numberFormatter.format(overallCherryPicked)}
                </td>
                <td className="px-3 py-2 text-center font-semibold">
                  {numberFormatter.format(overallVolume.sold)}
                </td>
                <td className="px-3 py-2 text-center font-semibold">
                  {numberFormatter.format(overallVolume.accepted)}
                </td>
                <td className="px-3 py-2 text-center font-semibold">
                  {numberFormatter.format(overallRejected)}
                </td>
                <td className="px-3 py-2 text-center font-semibold">
                  {numberFormatter.format(overallDnq)}
                </td>
                <td className="px-3 py-2 text-center font-semibold">
                  {numberFormatter.format(overallDuplicate)}
                </td>
                <td className="px-3 py-2 text-center font-semibold">
                  {fmtPct(overallSoldPct)}
                </td>
                <td className="px-3 py-2 text-center font-semibold">
                  {fmtPct(overallCherryPickedPct)}
                </td>
                <td className="px-3 py-2 text-center font-semibold">
                  {fmtPct(overallAcceptedPct)}
                </td>
                <td className="px-3 py-2 text-center font-semibold">
                  {fmtPct(overallRejectedPct)}
                </td>
                <td className="px-3 py-2 text-center font-semibold">
                  {fmtPct(overallDnqPct)}
                </td>
                <td className="px-3 py-2 text-center font-semibold">
                  {fmtPct(overallDuplicatePct)}
                </td>
                <td className="px-3 py-2 text-center">
                  <TrustedScoreBar
                    pct={overallTrustedScorePct}
                    ipqs={overallIpqs}
                    label="Overall"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TrustedScoreBar({
  pct,
  ipqs,
  label,
}: {
  pct: number | null;
  ipqs?: IpqsRollup | null;
  label?: string;
}) {
  const safe = pct === null ? null : Math.max(0, Math.min(100, pct));
  const bar = (
    <div className="mx-auto flex w-32 cursor-default select-none items-center gap-2">
      <div
        className="h-2 flex-1 overflow-hidden rounded-[--radius-pill] bg-[--color-bg-tertiary]"
        role="progressbar"
        aria-valuenow={safe ?? 0}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Trusted score"
      >
        {safe !== null && (
          <div
            className="h-full rounded-[--radius-pill]"
            style={{
              width: `${safe}%`,
              backgroundColor: trustedScoreBandColor(safe),
            }}
          />
        )}
      </div>
      <span className="w-10 text-right text-[11px] text-[--color-text-muted]">
        {formatTrustedScorePct(safe)}
      </span>
    </div>
  );
  if (!ipqs) return bar;
  return (
    <HoverTooltip message={<IpqsBreakdown ipqs={ipqs} label={label} />}>
      {bar}
    </HoverTooltip>
  );
}

function IpqsBreakdown({ ipqs, label }: { ipqs: IpqsRollup; label?: string }) {
  const rows: Array<{
    key: string;
    name: string;
    pass: number;
    fail: number;
    avg: number | null;
  }> = [
    {
      key: "phone",
      name: "Phone",
      pass: ipqs.phone.pass,
      fail: ipqs.phone.fail,
      avg: ipqs.phone.avg_fraud_score,
    },
    {
      key: "email",
      name: "Email",
      pass: ipqs.email.pass,
      fail: ipqs.email.fail,
      avg: ipqs.email.avg_fraud_score,
    },
    {
      key: "ip",
      name: "IP",
      pass: ipqs.ip.pass,
      fail: ipqs.ip.fail,
      avg: ipqs.ip.avg_fraud_score,
    },
  ];
  return (
    <div className="space-y-1.5 text-left">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[--color-text-strong]">
          IPQS · {label ?? ""}
        </span>
        <span className="text-[11px] font-semibold text-[--color-text-strong]">
          {formatTrustedScorePct(ipqs.trusted_score_pct)}
        </span>
      </div>
      <table className="w-full text-[11px] text-[--color-text-muted]">
        <thead>
          <tr>
            <th className="text-left font-medium">Check</th>
            <th className="text-right font-medium text-[--color-success]">
              Pass
            </th>
            <th className="text-right font-medium text-[--color-danger]">
              Fail
            </th>
            <th className="text-right font-medium">Avg fraud</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="text-left">{r.name}</td>
              <td className="text-right tabular-nums">{r.pass}</td>
              <td className="text-right tabular-nums">{r.fail}</td>
              <td className="text-right tabular-nums">
                {r.avg === null ? "—" : r.avg.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
