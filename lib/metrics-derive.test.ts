import { describe, expect, it } from "vitest";
import {
  ZERO_COUNTERS,
  ZERO_REJECTION_BUCKETS,
  acceptedRate,
  assertMetricsFilterCompat,
  bucketHourlyByLocalHour,
  bucketWeekdayByLocal,
  buildMarketingSourceRows,
  buildOverallTrustedScorePct,
  buildStatusBreakdown,
  deriveVolumeCounts,
  dnqRate,
  duplicateRate,
  ipqsFailRate,
  rejectedRate,
  resolveDnqCount,
  resolveDuplicateCount,
  soldRate,
} from "@/lib/metrics-derive";
import type {
  IpqsRollup,
  MetricsBreakdownEntry,
  MetricsCounters,
  MetricsHourlyPoint,
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
    expect(rejectedRate(ZERO_COUNTERS)).toBe(0);
    expect(dnqRate(ZERO_COUNTERS, null)).toBe(0);
    expect(duplicateRate(ZERO_COUNTERS, null)).toBe(0);
    expect(ipqsFailRate(null)).toBe(0);
  });

  it("computes sold, accepted, and rejected rates from received", () => {
    expect(soldRate(counters)).toBe(20);
    expect(acceptedRate(counters)).toBe(20);
    expect(rejectedRate(counters)).toBe(40);
  });

  it("uses sold-exclusive overlap math when cherry_picked is included in sold", () => {
    const overlap: MetricsCounters = {
      received: 90,
      accepted: 0,
      sold: 28,
      accepted_not_sold: 0,
      rejected: 62,
      cherry_picked: 2,
    };
    expect(soldRate(overlap)).toBeCloseTo((26 / 90) * 100, 5);
    expect(acceptedRate(overlap)).toBeCloseTo((28 / 90) * 100, 5);
  });

  it("DNQ % = (rejected − duplicates) / received, IPQS fails folded in", () => {
    // rejected=80, duplicates=10 → (80-10)/200 = 35%. The IPQS-rejected
    // rows (12+6+2=20) are part of `rejected` and remain inside DNQ.
    expect(dnqRate(counters, quality)).toBe(35);
  });

  it("Duplicate % = duplicates / received", () => {
    expect(duplicateRate(counters, quality)).toBe(5);
  });

  it("ipqsFailRate uses combined pass+fail of all 3 checks", () => {
    // fails 20+10+5=35, total 100+100+100=300 → 11.666…
    expect(ipqsFailRate(ipqs)).toBeCloseTo(11.6667, 3);
  });
});

describe("buildMarketingSourceRows", () => {
  it("maps breakdown entries into source rows with renamed sold/rejected/dnq fields", () => {
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
      sold: 40,
      rejected: 80,
      dnq: 70,
      duplicate: 10,
      soldPct: 20,
      rejectedPct: 40,
      dnqPct: 35,
      duplicatePct: 5,
      trustedScorePct: 88.3,
    });
    // Old field names must not survive.
    expect(rows[0]).not.toHaveProperty("signed");
    expect(rows[0]).not.toHaveProperty("acceptedNotSold");
    expect(rows[0]).not.toHaveProperty("spamPct");
    expect(rows[0]).not.toHaveProperty("leadToSignedPct");
    expect(rows[0]).not.toHaveProperty("acceptedNotSoldPct");
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
  it("returns four buckets in order: sold, rejected, dnq, duplicate", () => {
    const data = buildStatusBreakdown(counters, quality);
    expect(data.map((d) => d.key)).toEqual([
      "sold",
      "rejected",
      "dnq",
      "duplicate",
    ]);
    const lookup = Object.fromEntries(data.map((d) => [d.key, d.value]));
    expect(lookup.sold).toBe(40);
    expect(lookup.rejected).toBe(80);
    expect(lookup.dnq).toBe(70); // 80 rejected − 10 duplicates (IPQS folded in)
    expect(lookup.duplicate).toBe(10);
  });

  it("never emits a spam wedge — IPQS fails are folded into DNQ", () => {
    // Construct counters where rejections are entirely IPQS-driven.
    const c: MetricsCounters = {
      received: 100,
      accepted: 0,
      sold: 0,
      accepted_not_sold: 0,
      rejected: 30,
    };
    const q: QualityRollup = {
      duplicate_count: 0,
      duplicate_pct: 0,
      source_quality_score: 0,
      rejection_buckets: {
        ...ZERO_REJECTION_BUCKETS,
        ipqs_phone: 15,
        ipqs_email: 10,
        ipqs_ip: 5,
      },
    };
    const data = buildStatusBreakdown(c, q);
    expect(data.find((d) => d.key === "dnq")?.value).toBe(30);
    // No "spam" bucket exists in the new taxonomy.
    expect(data.some((d) => (d.key as string) === "spam")).toBe(false);
    expect(resolveDnqCount(c, q)).toBe(30);
  });

  it("omits zero slices", () => {
    const data = buildStatusBreakdown(ZERO_COUNTERS, null);
    expect(data).toHaveLength(0);
  });
});

describe("rejected bucket resolvers", () => {
  it("DNQ = rejected − duplicates regardless of IPQS rollup", () => {
    expect(resolveDnqCount(counters, quality)).toBe(70);
    expect(resolveDuplicateCount(counters, quality)).toBe(10);
  });

  it("prefers BE-provided rejected_duplicates when present", () => {
    const c: MetricsCounters = {
      ...counters,
      rejected_duplicates: 25,
    };
    expect(resolveDuplicateCount(c, quality)).toBe(25);
    // DNQ is then rejected − rejected_duplicates = 80 − 25 = 55
    expect(resolveDnqCount(c, quality)).toBe(55);
  });
});

describe("buildOverallTrustedScorePct", () => {
  const baseRow = {
    cherryPicked: 0,
    sold: 0,
    rejected: 0,
    dnq: 0,
    duplicate: 0,
    soldPct: 0,
    rejectedPct: 0,
    dnqPct: 0,
    duplicatePct: 0,
  };

  it("returns weighted average across rows with non-null scores", () => {
    const rows = [
      {
        ...baseRow,
        key: "a",
        label: "A",
        leads: 100,
        trustedScorePct: 80,
      },
      {
        ...baseRow,
        key: "b",
        label: "B",
        leads: 100,
        trustedScorePct: 60,
      },
      {
        ...baseRow,
        key: "c",
        label: "C",
        leads: 50,
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
  it("rejects sending campaign_key and affiliate_id together", () => {
    expect(
      assertMetricsFilterCompat({
        campaign_key: "ck",
        affiliate_id: "aff",
      }),
    ).toMatch(/either an affiliate or a campaign key/);
  });

  it("returns null when filters are compatible", () => {
    expect(assertMetricsFilterCompat({ campaign_key: "ck" })).toBeNull();
    expect(assertMetricsFilterCompat({ affiliate_id: "aff" })).toBeNull();
    expect(assertMetricsFilterCompat({})).toBeNull();
  });
});

describe("deriveVolumeCounts (Volume tile identities)", () => {
  it("Accepted = Sold + Cherry Picked; Rejected = DNQ + Duplicate", () => {
    const c: MetricsCounters = {
      received: 100,
      accepted: 30,
      sold: 20,
      accepted_not_sold: 0,
      rejected: 7,
      cherry_picked: 5,
    };
    const q: QualityRollup = {
      duplicate_count: 2,
      duplicate_pct: null,
      source_quality_score: null,
      rejection_buckets: { ...ZERO_REJECTION_BUCKETS, duplicate: 2 },
    };
    const v = deriveVolumeCounts(c, q);
    expect(v.received).toBe(100);
    expect(v.sold).toBe(15);
    expect(v.cherryPicked).toBe(5);
    expect(v.accepted).toBe(20);
    expect(v.accepted).toBe(v.sold + v.cherryPicked);
    expect(v.duplicate).toBe(2);
    expect(v.dnq).toBe(5);
    expect(v.rejected).toBe(7);
    expect(v.rejected).toBe(v.dnq + v.duplicate);
  });

  it("treats missing cherry_picked / quality as zero", () => {
    const c: MetricsCounters = {
      received: 10,
      accepted: 0,
      sold: 4,
      accepted_not_sold: 0,
      rejected: 0,
    };
    const v = deriveVolumeCounts(c, null);
    expect(v.cherryPicked).toBe(0);
    expect(v.accepted).toBe(4);
    expect(v.duplicate).toBe(0);
    expect(v.dnq).toBe(0);
    expect(v.rejected).toBe(0);
  });

  it("Marketing Sources OVERALL row identity: rejected column == dnq + duplicate", () => {
    // Bug repro — wire `accepted_not_sold=0` while DNQ+Duplicate=7. Without
    // the derivation the OVERALL Rejected column rendered 0 (drift).
    const totals: MetricsCounters = {
      received: 50,
      accepted: 25,
      sold: 18,
      accepted_not_sold: 0,
      rejected: 7,
      cherry_picked: 7,
    };
    const q: QualityRollup = {
      duplicate_count: 2,
      duplicate_pct: null,
      source_quality_score: null,
      rejection_buckets: { ...ZERO_REJECTION_BUCKETS, duplicate: 2 },
    };
    const v = deriveVolumeCounts(totals, q);
    // Volume tile math
    expect(v.accepted).toBe(v.sold + v.cherryPicked);
    expect(v.accepted).toBe(18);
    expect(v.rejected).toBe(v.dnq + v.duplicate);
    expect(v.rejected).toBe(7);
    // Marketing Sources OVERALL row reads the same derivation, so
    // overallRejected (= dnq + duplicate) matches the Volume tile value.
    const overallStatus = buildStatusBreakdown(totals, q);
    const overallDnq = overallStatus.find((d) => d.key === "dnq")?.value ?? 0;
    const overallDuplicate =
      overallStatus.find((d) => d.key === "duplicate")?.value ?? 0;
    expect(overallDnq + overallDuplicate).toBe(v.rejected);
  });

  it("derives overlap case: sold=26, cherry=2, accepted=28, rejected=62", () => {
    const c: MetricsCounters = {
      received: 90,
      accepted: 0,
      sold: 28,
      accepted_not_sold: 0,
      rejected: 62,
      cherry_picked: 2,
    };
    const q: QualityRollup = {
      duplicate_count: 12,
      duplicate_pct: null,
      source_quality_score: null,
      rejection_buckets: { ...ZERO_REJECTION_BUCKETS, duplicate: 12 },
    };
    const v = deriveVolumeCounts(c, q);
    expect(v.sold).toBe(26);
    expect(v.cherryPicked).toBe(2);
    expect(v.accepted).toBe(28);
    expect(v.rejected).toBe(62);
  });
});

describe("buildMarketingSourceRows — sold bucket parity", () => {
  it("uses sold-exclusive values for sold and soldPct", () => {
    const overlap: MetricsCounters = {
      received: 90,
      accepted: 0,
      sold: 28,
      accepted_not_sold: 0,
      rejected: 62,
      cherry_picked: 2,
    };
    const q: QualityRollup = {
      duplicate_count: 12,
      duplicate_pct: null,
      source_quality_score: null,
      rejection_buckets: { ...ZERO_REJECTION_BUCKETS, duplicate: 12 },
    };
    const [row] = buildMarketingSourceRows(
      [{ key: "aff-overlap", counters: overlap, quality: q }],
      () => "Overlap Affiliate",
    );
    expect(row.sold).toBe(26);
    expect(row.cherryPicked).toBe(2);
    expect(row.soldPct).toBeCloseTo((26 / 90) * 100, 5);
  });
});

describe("buildMarketingSourceRows — per-row Rejected identity", () => {
  it("row.rejected always equals row.dnq + row.duplicate", () => {
    const c1: MetricsCounters = {
      received: 30,
      accepted: 15,
      sold: 10,
      accepted_not_sold: 999, // intentionally inconsistent — must be ignored
      rejected: 5,
    };
    const q1: QualityRollup = {
      duplicate_count: 2,
      duplicate_pct: null,
      source_quality_score: null,
      rejection_buckets: { ...ZERO_REJECTION_BUCKETS, duplicate: 2 },
    };
    const [row] = buildMarketingSourceRows(
      [{ key: "k", counters: c1, quality: q1 }],
      () => "K",
    );
    expect(row.dnq).toBe(3);
    expect(row.duplicate).toBe(2);
    expect(row.rejected).toBe(5);
    expect(row.rejected).toBe(row.dnq + row.duplicate);
  });
});

describe("bucketHourlyByLocalHour (Time Breakdown — local TZ)", () => {
  const date = "2026-01-15";

  it("re-buckets a UTC hour into the browser-local hour", () => {
    const utcHour = 14;
    const expectedLocalHour = new Date(
      `${date}T${String(utcHour).padStart(2, "0")}:00:00Z`,
    ).getHours();
    const points: MetricsHourlyPoint[] = [
      {
        date,
        hour: utcHour,
        weekday: 4,
        counters: { ...ZERO_COUNTERS, received: 5 },
      },
    ];
    const buckets = bucketHourlyByLocalHour(points);
    expect(buckets[expectedLocalHour].received).toBe(5);
    // Total preserved.
    expect(buckets.reduce((acc, b) => acc + b.received, 0)).toBe(5);
  });

  it("two distinct UTC hours land in two distinct local hour buckets", () => {
    const points: MetricsHourlyPoint[] = [
      {
        date,
        hour: 0,
        weekday: 4,
        counters: { ...ZERO_COUNTERS, received: 3 },
      },
      {
        date,
        hour: 12,
        weekday: 4,
        counters: { ...ZERO_COUNTERS, received: 7 },
      },
    ];
    const buckets = bucketHourlyByLocalHour(points);
    const local0 = new Date(`${date}T00:00:00Z`).getHours();
    const local12 = new Date(`${date}T12:00:00Z`).getHours();
    expect(buckets[local0].received).toBe(3);
    expect(buckets[local12].received).toBe(7);
    expect(buckets.reduce((acc, b) => acc + b.received, 0)).toBe(10);
  });

  it("returns 24 buckets and ignores malformed points", () => {
    const buckets = bucketHourlyByLocalHour([
      // @ts-expect-error — runtime guard for missing hour
      { date, weekday: 4, counters: { received: 1 } },
      {
        date: "not-a-date",
        hour: 5,
        weekday: 0,
        counters: { ...ZERO_COUNTERS, received: 1 },
      },
    ]);
    expect(buckets).toHaveLength(24);
    expect(buckets.every((b) => b.received === 0)).toBe(true);
  });
});

describe("bucketWeekdayByLocal (parity with hour-of-day)", () => {
  it("derives weekday/weekend slices from hourly UTC instants in local TZ", () => {
    // 2026-01-17 is a Saturday in UTC. Pick noon UTC so even far-east TZs
    // still see Saturday locally — the test asserts the value lands in the
    // weekend bucket.
    const points: MetricsHourlyPoint[] = [
      {
        date: "2026-01-17",
        hour: 12,
        weekday: 6,
        counters: { ...ZERO_COUNTERS, received: 4 },
      },
    ];
    const slices = bucketWeekdayByLocal(points);
    const weekend = slices.find((s) => s.key === "weekend");
    const weekday = slices.find((s) => s.key === "weekday");
    expect(weekend?.value).toBe(4);
    expect(weekday).toBeUndefined();
  });

  it("omits empty slices", () => {
    expect(bucketWeekdayByLocal([])).toEqual([]);
  });
});
