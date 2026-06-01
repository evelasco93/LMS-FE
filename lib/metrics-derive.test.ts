import { describe, expect, it } from "vitest";
import {
  ZERO_COUNTERS,
  ZERO_REJECTION_BUCKETS,
  acceptedNotSoldRate,
  assertMetricsFilterCompat,
  buildMarketingSourceRows,
  buildOverallTrustedScorePct,
  buildStatusBreakdown,
  dnqRate,
  ipqsFailRate,
  resolveDnqCount,
  resolveDuplicateCount,
  resolveSpamCount,
  soldRate,
  spamRate,
} from "@/lib/metrics-derive";
import type {
  IpqsRollup,
  MetricsBreakdownEntry,
  MetricsCounters,
  QualityRollup,
} from "@/lib/types";

const counters: MetricsCounters = {
  received: 200,
  accepted: 120,
  sold: 40,
  accepted_not_sold: 80,
  rejected: 80,
};

const quality: QualityRollup = {
  duplicate_count: 10,
  duplicate_pct: 5,
  source_quality_score: 60,
  rejection_buckets: {
    ...ZERO_REJECTION_BUCKETS,
    duplicate: 10,
    validation: 20,
    logic_rules: 5,
    trusted_form: 3,
    ipqs_phone: 12,
    ipqs_email: 6,
    ipqs_ip: 2,
    affiliate_disabled: 1,
    other: 1,
  },
};

const ipqs: IpqsRollup = {
  phone: {
    pass: 80,
    fail: 20,
    score_sum: 0,
    score_count: 0,
    avg_fraud_score: 35,
  },
  email: {
    pass: 90,
    fail: 10,
    score_sum: 0,
    score_count: 0,
    avg_fraud_score: 20,
  },
  ip: { pass: 95, fail: 5, score_sum: 0, score_count: 0, avg_fraud_score: 12 },
  trusted_score_pct: 88.3,
};

describe("rate helpers", () => {
  it("guards against zero denominators", () => {
    expect(soldRate(ZERO_COUNTERS)).toBe(0);
    expect(acceptedNotSoldRate(ZERO_COUNTERS)).toBe(0);
    expect(dnqRate(ZERO_COUNTERS, null)).toBe(0);
    expect(spamRate(ZERO_COUNTERS, null)).toBe(0);
    expect(ipqsFailRate(null)).toBe(0);
  });

  it("computes sold and accepted-not-sold rates from received", () => {
    expect(soldRate(counters)).toBe(20);
    expect(acceptedNotSoldRate(counters)).toBe(40);
  });

  it("excludes duplicates from DNQ %", () => {
    // rejected=80, duplicates=10 → (80-10)/200 = 35%
    expect(dnqRate(counters, quality)).toBe(35);
  });

  it("derives spam % from IPQS-rejected buckets only", () => {
    // (12+6+2)/200 = 10%
    expect(spamRate(counters, quality)).toBe(10);
  });

  it("ipqsFailRate uses combined pass+fail of all 3 checks", () => {
    // fails 20+10+5=35, total 100+100+100=300 → 11.666…
    expect(ipqsFailRate(ipqs)).toBeCloseTo(11.6667, 3);
  });
});

describe("buildMarketingSourceRows", () => {
  it("maps breakdown entries into source rows with derived columns", () => {
    const entries: MetricsBreakdownEntry[] = [
      { key: "aff-1", counters, quality, ipqs },
      { key: "", counters: ZERO_COUNTERS },
    ];
    const rows = buildMarketingSourceRows(entries, (key) =>
      key === "aff-1" ? "Affiliate One" : "",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      key: "aff-1",
      label: "Affiliate One",
      leads: 200,
      dnq: 70,
      signed: 40,
      acceptedNotSold: 80,
      leadToSignedPct: 20,
      acceptedNotSoldPct: 40,
      spamPct: 10,
      trustedScorePct: 88.3,
    });
  });

  it("falls back to the key when labelResolver returns empty", () => {
    const [row] = buildMarketingSourceRows(
      [{ key: "raw-key", counters }],
      () => "",
    );
    expect(row.label).toBe("raw-key");
  });
});

describe("buildStatusBreakdown", () => {
  it("splits rejected into duplicate, spam, and DNQ slices", () => {
    const data = buildStatusBreakdown(counters, quality);
    const lookup = Object.fromEntries(data.map((d) => [d.key, d.value]));
    expect(lookup.sold).toBe(40);
    expect(lookup.accepted_not_sold).toBe(80);
    expect(lookup.duplicate).toBe(10);
    expect(lookup.spam).toBe(20); // ipqs_phone+email+ip
    expect(lookup.dnq).toBe(50); // 80 rejected - 10 dup - 20 spam
  });

  it("omits zero slices", () => {
    const data = buildStatusBreakdown(ZERO_COUNTERS, null);
    expect(data).toHaveLength(0);
  });
});

describe("rejected bucket resolvers", () => {
  it("prefers BE-provided rejected_dnq / rejected_spam / rejected_duplicates", () => {
    const c: MetricsCounters = {
      ...counters,
      rejected_dnq: 7,
      rejected_spam: 3,
      rejected_duplicates: 2,
    };
    expect(resolveDnqCount(c, quality)).toBe(7);
    expect(resolveSpamCount(c, quality)).toBe(3);
    expect(resolveDuplicateCount(c, quality)).toBe(2);
  });

  it("falls back to quality-derived buckets when counters omit splits", () => {
    expect(resolveSpamCount(counters, quality)).toBe(20); // ipqs phone+email+ip
    expect(resolveDuplicateCount(counters, quality)).toBe(10);
    // rejected 80 − dup 10 − spam 20 = 50
    expect(resolveDnqCount(counters, quality)).toBe(50);
  });
});

describe("buildOverallTrustedScorePct", () => {
  it("returns weighted average across rows with non-null scores", () => {
    const rows = [
      {
        key: "a",
        label: "A",
        leads: 100,
        cherryPicked: 0,
        dnq: 0,
        signed: 0,
        acceptedNotSold: 0,
        leadToSignedPct: 0,
        acceptedNotSoldPct: 0,
        spamPct: 0,
        trustedScorePct: 80,
      },
      {
        key: "b",
        label: "B",
        leads: 100,
        cherryPicked: 0,
        dnq: 0,
        signed: 0,
        acceptedNotSold: 0,
        leadToSignedPct: 0,
        acceptedNotSoldPct: 0,
        spamPct: 0,
        trustedScorePct: 60,
      },
      {
        key: "c",
        label: "C",
        leads: 50,
        cherryPicked: 0,
        dnq: 0,
        signed: 0,
        acceptedNotSold: 0,
        leadToSignedPct: 0,
        acceptedNotSoldPct: 0,
        spamPct: 0,
        trustedScorePct: null,
      },
    ];
    expect(buildOverallTrustedScorePct(rows)).toBe(70);
  });

  it("returns null when no row contributes weight", () => {
    expect(buildOverallTrustedScorePct([])).toBeNull();
  });
});
describe("assertMetricsFilterCompat", () => {
  it("returns an error when affiliate_id and campaign_key are both set", () => {
    expect(
      assertMetricsFilterCompat({
        affiliate_id: "a1",
        campaign_key: "ck1",
      }),
    ).toMatch(/either/i);
  });

  it("returns null when only one is set", () => {
    expect(assertMetricsFilterCompat({ affiliate_id: "a1" })).toBeNull();
    expect(assertMetricsFilterCompat({ campaign_key: "ck1" })).toBeNull();
    expect(assertMetricsFilterCompat({})).toBeNull();
  });
});
