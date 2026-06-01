/**
 * Pure derive helpers for the metrics dashboard.
 *
 * These mirror the LMS domain math used by the "overall metrics" tiles,
 * the marketing-sources table, and the status donut. Keep them framework
 * free so they can be unit-tested in isolation.
 */
import type {
  IpqsRollup,
  MetricsBreakdownEntry,
  MetricsCounters,
  QualityRollup,
  RejectionBuckets,
} from "./types";
export const ZERO_COUNTERS: MetricsCounters = {
  received: 0,
  accepted: 0,
  sold: 0,
  accepted_not_sold: 0,
  rejected: 0,
};

export const ZERO_REJECTION_BUCKETS: RejectionBuckets = {
  duplicate: 0,
  validation: 0,
  logic_rules: 0,
  trusted_form: 0,
  ipqs_phone: 0,
  ipqs_email: 0,
  ipqs_ip: 0,
  affiliate_disabled: 0,
  other: 0,
};

function safePct(numerator: number, denominator: number): number {
  if (!denominator || denominator <= 0) return 0;
  return (numerator / denominator) * 100;
}

/** Sold % = sold / received × 100 (Lead → Signed in the screenshot taxonomy). */
export function soldRate(c: MetricsCounters): number {
  return safePct(c.sold, c.received);
}

/** Accepted-not-Sold % = accepted_not_sold / received × 100 (Lead → Transfer). */
export function acceptedNotSoldRate(c: MetricsCounters): number {
  return safePct(c.accepted_not_sold, c.received);
}

/**
 * DNQ % = (rejected − duplicate_count) / received × 100. Duplicates are
 * tracked separately and excluded from DNQ.
 */
export function dnqRate(c: MetricsCounters, q?: QualityRollup | null): number {
  const duplicates = q?.duplicate_count ?? 0;
  const nonDupRejected = Math.max(c.rejected - duplicates, 0);
  return safePct(nonDupRejected, c.received);
}

/** Spam % = IPQS-driven rejection share of received. */
export function spamRate(c: MetricsCounters, q?: QualityRollup | null): number {
  if (!q) return 0;
  const spam =
    q.rejection_buckets.ipqs_phone +
    q.rejection_buckets.ipqs_email +
    q.rejection_buckets.ipqs_ip;
  return safePct(spam, c.received);
}

/** Per-row IPQS fail rate, used for the Marketing Sources "Spam %" column. */
export function ipqsFailRate(ipqs?: IpqsRollup | null): number {
  if (!ipqs) return 0;
  const fails = ipqs.phone.fail + ipqs.email.fail + ipqs.ip.fail;
  const total =
    ipqs.phone.pass +
    ipqs.phone.fail +
    ipqs.email.pass +
    ipqs.email.fail +
    ipqs.ip.pass +
    ipqs.ip.fail;
  return safePct(fails, total);
}

export type MarketingSourceRow = {
  /** affiliate_id when the breakdown is sourced by affiliate, otherwise the entry key. */
  key: string;
  label: string;
  leads: number;
  cherryPicked: number;
  dnq: number;
  signed: number;
  acceptedNotSold: number;
  leadToSignedPct: number;
  acceptedNotSoldPct: number;
  spamPct: number;
  trustedScorePct: number | null;
  /** Raw IPQS rollup for the row (when present) — used by the Trusted Score
   *  hover tooltip in the Marketing Sources table. */
  ipqs?: IpqsRollup | null;
};

/**
 * Build the Marketing Sources table rows from a breakdown entry list.
 * `labelResolver` should map the entry key to the display source name
 * (affiliate name or campaign_key fallback).
 */
export function buildMarketingSourceRows(
  entries: ReadonlyArray<MetricsBreakdownEntry>,
  labelResolver: (key: string) => string,
): MarketingSourceRow[] {
  return entries
    .map((entry): MarketingSourceRow | null => {
      const key = entry.key?.trim();
      if (!key) return null;
      const counters = entry.counters || ZERO_COUNTERS;
      const quality = entry.quality;
      const duplicates = quality?.duplicate_count ?? 0;
      const dnq = Math.max(counters.rejected - duplicates, 0);

      return {
        key,
        label: labelResolver(key) || key,
        leads: counters.received,
        cherryPicked: counters.cherry_picked ?? 0,
        dnq,
        signed: counters.sold,
        acceptedNotSold: counters.accepted_not_sold,
        leadToSignedPct: soldRate(counters),
        acceptedNotSoldPct: acceptedNotSoldRate(counters),
        spamPct: spamRate(counters, quality),
        trustedScorePct: entry.ipqs?.trusted_score_pct ?? null,
        ipqs: entry.ipqs ?? null,
      };
    })
    .filter((row): row is MarketingSourceRow => row !== null);
}

export type StatusBreakdownDatum = {
  key: "sold" | "accepted_not_sold" | "dnq" | "duplicate" | "spam";
  name: string;
  value: number;
};

/**
 * Status donut data — splits rejected into duplicate / spam / DNQ buckets so
 * the donut reflects the screenshot's status mix.
 */
export function buildStatusBreakdown(
  c: MetricsCounters,
  q?: QualityRollup | null,
): StatusBreakdownDatum[] {
  const duplicates = q?.duplicate_count ?? 0;
  const spam = q
    ? q.rejection_buckets.ipqs_phone +
      q.rejection_buckets.ipqs_email +
      q.rejection_buckets.ipqs_ip
    : 0;
  const dnq = Math.max(c.rejected - duplicates - spam, 0);

  return [
    { key: "sold", name: "Signed", value: c.sold },
    {
      key: "accepted_not_sold",
      name: "Accepted Not Sold",
      value: c.accepted_not_sold,
    },
    { key: "dnq", name: "DNQ", value: dnq },
    { key: "duplicate", name: "Duplicate", value: duplicates },
    { key: "spam", name: "Spam", value: spam },
  ].filter((d) => d.value > 0) as StatusBreakdownDatum[];
}

/**
 * Resolve DNQ count for a counters/quality pair. Prefers the BE-provided
 * `rejected_dnq` field (CR-002); otherwise derives from `rejected − duplicates − spam`.
 */
export function resolveDnqCount(
  c: MetricsCounters,
  q?: QualityRollup | null,
): number {
  if (typeof c.rejected_dnq === "number") return c.rejected_dnq;
  const duplicates = q?.duplicate_count ?? 0;
  const spam = q
    ? q.rejection_buckets.ipqs_phone +
      q.rejection_buckets.ipqs_email +
      q.rejection_buckets.ipqs_ip
    : 0;
  return Math.max(c.rejected - duplicates - spam, 0);
}

/** Resolve SPAM count — IPQS-driven rejected share. */
export function resolveSpamCount(
  c: MetricsCounters,
  q?: QualityRollup | null,
): number {
  if (typeof c.rejected_spam === "number") return c.rejected_spam;
  if (!q) return 0;
  return (
    q.rejection_buckets.ipqs_phone +
    q.rejection_buckets.ipqs_email +
    q.rejection_buckets.ipqs_ip
  );
}

/** Resolve DUPLICATE count. */
export function resolveDuplicateCount(
  c: MetricsCounters,
  q?: QualityRollup | null,
): number {
  if (typeof c.rejected_duplicates === "number") return c.rejected_duplicates;
  return q?.duplicate_count ?? 0;
}

/**
 * Weighted overall Trusted Score across visible rows — `Σ(score × leads) / Σ(leads)`.
 * Rows without a trusted score are excluded from both sums. Returns null when
 * no row contributes weight.
 */
export function buildOverallTrustedScorePct(
  rows: ReadonlyArray<MarketingSourceRow>,
): number | null {
  let weightedSum = 0;
  let weightTotal = 0;
  for (const row of rows) {
    if (row.trustedScorePct === null) continue;
    const w = row.leads;
    if (w <= 0) continue;
    weightedSum += row.trustedScorePct * w;
    weightTotal += w;
  }
  if (weightTotal === 0) return null;
  return weightedSum / weightTotal;
}

/**
 * Aggregate IPQS rollups across visible Marketing Sources rows. Returns null
 * when no row contributes any IPQS data. Used by the OVERALL row's Trusted
 * Score hover tooltip so it reflects the same data as the per-row tooltips.
 */
export function buildOverallIpqsRollup(
  rows: ReadonlyArray<MarketingSourceRow>,
): IpqsRollup | null {
  let any = false;
  const acc = {
    phone: { pass: 0, fail: 0, score_sum: 0, score_count: 0 },
    email: { pass: 0, fail: 0, score_sum: 0, score_count: 0 },
    ip: { pass: 0, fail: 0, score_sum: 0, score_count: 0 },
  };
  let trustedWeighted = 0;
  let trustedWeight = 0;
  for (const row of rows) {
    if (!row.ipqs) continue;
    any = true;
    for (const k of ["phone", "email", "ip"] as const) {
      acc[k].pass += row.ipqs[k].pass;
      acc[k].fail += row.ipqs[k].fail;
      acc[k].score_sum += row.ipqs[k].score_sum;
      acc[k].score_count += row.ipqs[k].score_count;
    }
    if (row.trustedScorePct !== null && row.leads > 0) {
      trustedWeighted += row.trustedScorePct * row.leads;
      trustedWeight += row.leads;
    }
  }
  if (!any) return null;
  const toCheck = (c: (typeof acc)[keyof typeof acc]) => ({
    pass: c.pass,
    fail: c.fail,
    score_sum: c.score_sum,
    score_count: c.score_count,
    avg_fraud_score: c.score_count > 0 ? c.score_sum / c.score_count : null,
  });
  return {
    phone: toCheck(acc.phone),
    email: toCheck(acc.email),
    ip: toCheck(acc.ip),
    trusted_score_pct:
      trustedWeight > 0 ? trustedWeighted / trustedWeight : null,
  };
}

/**
 * Validate that a metrics filter set respects the API mutual exclusion:
 * affiliate_id and campaign_key cannot be sent together.
 */
export function assertMetricsFilterCompat(filters: {
  campaign_key?: string;
  affiliate_id?: string;
}): string | null {
  if (filters.campaign_key && filters.affiliate_id) {
    return "Select either an affiliate or a campaign key, not both.";
  }
  return null;
}
