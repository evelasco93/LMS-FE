"use client";

import type { IpqsRollup, MetricsCounters, QualityRollup } from "@/lib/types";
import {
  type MarketingSourceRow,
  buildOverallIpqsRollup,
  buildOverallTrustedScorePct,
  buildStatusBreakdown,
} from "@/lib/metrics-derive";
import { HoverTooltip } from "@/components/ui/hover-tooltip";
import { formatTrustedScorePct } from "@/lib/utils";

const numberFormatter = new Intl.NumberFormat("en-US");

function fmtPct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}%`;
}

function trustedBandColor(pct: number | null): string {
  if (pct === null) return "var(--color-bg-tertiary)";
  if (pct >= 80) return "var(--color-success)";
  if (pct >= 50) return "var(--color-warning)";
  return "var(--color-danger)";
}

type MetricsMarketingSourcesTableProps = {
  rows: MarketingSourceRow[];
  loading?: boolean;
  overallTotals: MetricsCounters;
  overallQuality?: QualityRollup | null;
  scopeLabel?: string;
  onRowOpen?: (row: MarketingSourceRow) => void;
};

export function MetricsMarketingSourcesTable({
  rows,
  loading,
  overallTotals,
  overallQuality,
  scopeLabel,
  onRowOpen,
}: MetricsMarketingSourcesTableProps) {
  const overallStatus = buildStatusBreakdown(
    overallTotals,
    overallQuality ?? null,
  );
  const overallSpam = overallStatus.find((d) => d.key === "spam")?.value ?? 0;
  const overallDnq = overallStatus.find((d) => d.key === "dnq")?.value ?? 0;
  const overallSpamPct =
    overallTotals.received > 0
      ? (overallSpam / overallTotals.received) * 100
      : 0;
  const overallSignedPct =
    overallTotals.received > 0
      ? (overallTotals.sold / overallTotals.received) * 100
      : 0;
  const overallAcceptedNotSoldPct =
    overallTotals.received > 0
      ? (overallTotals.accepted_not_sold / overallTotals.received) * 100
      : 0;
  // CR-002 — Trusted Score for OVERALL is now derived from visible rows
  // (weighted by row leads); no longer pulled from `summary.ipqs.trusted_score_pct`.
  const overallTrustedScorePct = buildOverallTrustedScorePct(rows);
  const overallIpqs = buildOverallIpqsRollup(rows);
  // CR-003 — Cherry Picked OVERALL prefers BE-rolled `cherry_picked` on totals;
  // falls back to summing visible rows so older BE payloads still render a value.
  const overallCherryPicked =
    overallTotals.cherry_picked ??
    rows.reduce((sum, row) => sum + row.cherryPicked, 0);

  return (
    <div className="panel p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[--color-text-strong]">
          Marketing Sources
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
              <tr className="text-left text-[11px] uppercase tracking-wide text-[--color-text-muted]">
                <th className="px-3 py-1">Source</th>
                <th className="px-3 py-1 text-right"># Leads</th>
                <th className="px-3 py-1 text-right">Cherry Picked</th>
                <th className="px-3 py-1 text-right">DNQ</th>
                <th className="px-3 py-1 text-right">Signed</th>
                <th className="px-3 py-1 text-right">Accepted Not Sold</th>
                <th className="px-3 py-1 text-right">Signed %</th>
                <th className="px-3 py-1 text-right">Accepted Not Sold %</th>
                <th className="px-3 py-1 text-right">Spam %</th>
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
                    className="px-3 py-2 font-medium text-[--color-text-strong]"
                    title={row.label}
                  >
                    <span className="block max-w-[18rem] truncate">
                      {row.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {numberFormatter.format(row.leads)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {numberFormatter.format(row.cherryPicked)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {numberFormatter.format(row.dnq)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {numberFormatter.format(row.signed)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {numberFormatter.format(row.acceptedNotSold)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {fmtPct(row.leadToSignedPct)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {fmtPct(row.acceptedNotSoldPct)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {fmtPct(row.spamPct)}
                  </td>
                  <td className="px-3 py-2">
                    <TrustedScoreBar
                      pct={row.trustedScorePct}
                      ipqs={row.ipqs ?? null}
                      label={row.label}
                    />
                  </td>
                </tr>
              ))}

              <tr className="rounded-[--radius-sm] bg-[color-mix(in_srgb,var(--color-primary)_10%,var(--color-panel))] text-[--color-text-strong]">
                <td className="px-3 py-2 text-xs font-bold uppercase tracking-wide">
                  Overall
                </td>
                <td className="px-3 py-2 text-right font-semibold">
                  {numberFormatter.format(overallTotals.received)}
                </td>
                <td className="px-3 py-2 text-right font-semibold">
                  {numberFormatter.format(overallCherryPicked)}
                </td>
                <td className="px-3 py-2 text-right font-semibold">
                  {numberFormatter.format(overallDnq)}
                </td>
                <td className="px-3 py-2 text-right font-semibold">
                  {numberFormatter.format(overallTotals.sold)}
                </td>
                <td className="px-3 py-2 text-right font-semibold">
                  {numberFormatter.format(overallTotals.accepted_not_sold)}
                </td>
                <td className="px-3 py-2 text-right font-semibold">
                  {fmtPct(overallSignedPct)}
                </td>
                <td className="px-3 py-2 text-right font-semibold">
                  {fmtPct(overallAcceptedNotSoldPct)}
                </td>
                <td className="px-3 py-2 text-right font-semibold">
                  {fmtPct(overallSpamPct)}
                </td>
                <td className="px-3 py-2">
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
    <div className="flex w-32 cursor-default select-none items-center gap-2">
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
              backgroundColor: trustedBandColor(safe),
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
