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
  MetricsHourlyPoint,
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

function deriveSoldExclusive(c: MetricsCounters): {
  cherry: number;
  soldExclusive: number;
} {
  const cherry = c.cherry_picked ?? 0;
  const soldExclusive = Math.max(c.sold - cherry, 0);
  return { cherry, soldExclusive };
}

/** Sold % = soldExclusive / received × 100. */
export function soldRate(c: MetricsCounters): number {
  const { soldExclusive } = deriveSoldExclusive(c);
  return safePct(soldExclusive, c.received);
}

/** Cherry-picked % = cherry_picked / received × 100. */
export function cherryPickedRate(c: MetricsCounters): number {
  return safePct(c.cherry_picked ?? 0, c.received);
}

/** Accepted % = (soldExclusive + cherry_picked) / received × 100. */
export function acceptedRate(c: MetricsCounters): number {
  const { cherry, soldExclusive } = deriveSoldExclusive(c);
  return safePct(soldExclusive + cherry, c.received);
}

/**
 * Rejected % = (DNQ + Duplicate) / received × 100.
 * Mirrors the Volume tile identity `Rejected = DNQ + Duplicate`.
 */
export function rejectedRate(
  c: MetricsCounters,
  q?: QualityRollup | null,
): number {
  const duplicates = resolveDuplicateCount(c, q);
  const dnq = Math.max(c.rejected - duplicates, 0);
  return safePct(dnq + duplicates, c.received);
}

/**
 * DNQ % = (rejected − duplicates) / received × 100. Duplicates are tracked
 * separately and excluded from DNQ. IPQS fails are folded into DNQ.
 */
export function dnqRate(c: MetricsCounters, q?: QualityRollup | null): number {
  const duplicates = resolveDuplicateCount(c, q);
  const dnq = Math.max(c.rejected - duplicates, 0);
  return safePct(dnq, c.received);
}

/** Duplicate % = duplicates / received × 100. */
export function duplicateRate(
  c: MetricsCounters,
  q?: QualityRollup | null,
): number {
  return safePct(resolveDuplicateCount(c, q), c.received);
}

/** Per-row IPQS fail rate, used for the IPQS fail-rate column. */
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
  sold: number;
  rejected: number;
  dnq: number;
  duplicate: number;
  soldPct: number;
  rejectedPct: number;
  dnqPct: number;
  duplicatePct: number;
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
      const duplicates = resolveDuplicateCount(counters, quality);
      const dnq = Math.max(counters.rejected - duplicates, 0);
      const { cherry, soldExclusive } = deriveSoldExclusive(counters);

      return {
        key,
        label: labelResolver(key) || key,
        leads: counters.received,
        cherryPicked: cherry,
        sold: soldExclusive,
        // CR — Rejected = DNQ + Duplicate (matches BE `counters.rejected`).
        // Previously displayed `accepted_not_sold` (buyer-rejection); the user
        // mental model uses the QA-rejection bucket so OVERALL math identities
        // (Rejected = DNQ + Duplicate) hold across the dashboard.
        rejected: dnq + duplicates,
        dnq,
        duplicate: duplicates,
        soldPct: safePct(soldExclusive, counters.received),
        rejectedPct: rejectedRate(counters, quality),
        dnqPct: dnqRate(counters, quality),
        duplicatePct: duplicateRate(counters, quality),
        trustedScorePct: entry.ipqs?.trusted_score_pct ?? null,
        ipqs: entry.ipqs ?? null,
      };
    })
    .filter((row): row is MarketingSourceRow => row !== null);
}

export type StatusBreakdownDatum = {
  key: "sold" | "rejected" | "dnq" | "duplicate";
  name: string;
  value: number;
};

/**
 * Status donut data — four-bucket taxonomy: Sold, Rejected, DNQ, Duplicate.
 * Zero-value wedges are filtered out.
 */
export function buildStatusBreakdown(
  c: MetricsCounters,
  q?: QualityRollup | null,
): StatusBreakdownDatum[] {
  const duplicates = resolveDuplicateCount(c, q);
  const dnq = Math.max(c.rejected - duplicates, 0);

  const data: StatusBreakdownDatum[] = [
    { key: "sold", name: "Sold", value: c.sold },
    { key: "rejected", name: "Rejected", value: c.accepted_not_sold },
    { key: "dnq", name: "DNQ", value: dnq },
    { key: "duplicate", name: "Duplicate", value: duplicates },
  ];
  return data.filter((d) => d.value > 0);
}

/**
 * Resolve DNQ count: `rejected − duplicates`. IPQS fails are folded into
 * DNQ under the new four-bucket taxonomy.
 */
export function resolveDnqCount(
  c: MetricsCounters,
  q?: QualityRollup | null,
): number {
  return Math.max(c.rejected - resolveDuplicateCount(c, q), 0);
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

// ── Volume tile math (parent = sum of children) ─────────────────────────

export type VolumeCounts = {
  received: number;
  /** Derived as sold + cherryPicked (where sold is non-overlap sold). */
  accepted: number;
  /** Non-overlap sold; excludes cherry-picked overlap from sold. */
  sold: number;
  cherryPicked: number;
  /** Derived: dnq + duplicate. Matches BE `counters.rejected`. */
  rejected: number;
  dnq: number;
  duplicate: number;
};

/**
 * Derive Volume tile counts from the same MetricsCounters / QualityRollup
 * shape used by the donut and Marketing Sources table.
 *
 * Accepted is derived as `sold + cherry_picked` so the parent tile is always
 * the exact sum of its visible children.
 * Rejected is derived as `dnq + duplicate` to keep bucket parity with the
 * status donut and Marketing Sources OVERALL row.
 */
export function deriveVolumeCounts(
  c: MetricsCounters,
  q?: QualityRollup | null,
): VolumeCounts {
  const duplicate = resolveDuplicateCount(c, q);
  const dnq = Math.max(c.rejected - duplicate, 0);
  const { cherry: cherryPicked, soldExclusive } = deriveSoldExclusive(c);
  return {
    received: c.received,
    accepted: soldExclusive + cherryPicked,
    sold: soldExclusive,
    cherryPicked,
    rejected: dnq + duplicate,
    dnq,
    duplicate,
  };
}

// ── Time Breakdown — local-timezone re-bucketing ────────────────────────

export type HourBucket = {
  hour: number;
  label: string;
  received: number;
};

/**
 * Re-bucket BE-aggregated hourly points (keyed by UTC hour) into the
 * browser's local hour. The BE returns `{ date, hour, ... }` where `hour`
 * is the UTC hour-of-day; we reconstruct the UTC instant and read
 * `Date.prototype.getHours()` to get the local hour.
 */
export function bucketHourlyByLocalHour(
  points: ReadonlyArray<MetricsHourlyPoint>,
): HourBucket[] {
  const buckets: HourBucket[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${hour.toString().padStart(2, "0")}:00`,
    received: 0,
  }));
  for (const p of points) {
    if (typeof p.hour !== "number" || p.hour < 0 || p.hour > 23) continue;
    const utc = new Date(
      `${p.date}T${p.hour.toString().padStart(2, "0")}:00:00Z`,
    );
    if (Number.isNaN(utc.getTime())) continue;
    const localHour = utc.getHours();
    if (localHour < 0 || localHour > 23) continue;
    buckets[localHour].received += p.counters?.received ?? 0;
  }
  return buckets;
}

export type WeekdaySlice = {
  key: "weekday" | "weekend";
  name: string;
  value: number;
};

/**
 * Derive weekday/weekend slices from hourly points using the browser's
 * local timezone (parity with `bucketHourlyByLocalHour`). Reconstructs the
 * UTC instant for each point and reads `Date.prototype.getDay()`.
 */
export function bucketWeekdayByLocal(
  points: ReadonlyArray<MetricsHourlyPoint>,
): WeekdaySlice[] {
  let weekday = 0;
  let weekend = 0;
  for (const p of points) {
    if (typeof p.hour !== "number" || p.hour < 0 || p.hour > 23) continue;
    const utc = new Date(
      `${p.date}T${p.hour.toString().padStart(2, "0")}:00:00Z`,
    );
    if (Number.isNaN(utc.getTime())) continue;
    const dow = utc.getDay();
    const received = p.counters?.received ?? 0;
    if (dow === 0 || dow === 6) weekend += received;
    else weekday += received;
  }
  const out: WeekdaySlice[] = [];
  if (weekday > 0)
    out.push({ key: "weekday", name: "Weekday", value: weekday });
  if (weekend > 0)
    out.push({ key: "weekend", name: "Weekend", value: weekend });
  return out;
}
