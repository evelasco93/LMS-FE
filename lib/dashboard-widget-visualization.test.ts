import { describe, expect, it } from "vitest";
import { buildWidgetLegendEntries } from "./dashboard-widget-visualization";

describe("buildWidgetLegendEntries", () => {
  it("uses configured label colors with case-insensitive label matching", () => {
    const rows = [
      { label: "Yes", value: 12 },
      { label: "No", value: 8 },
    ];

    const result = buildWidgetLegendEntries(rows, "#2563eb", {
      yes: "#10b981",
      NO: "#ef4444",
    });

    expect(result[0].color).toBe("#10b981");
    expect(result[1].color).toBe("#ef4444");
    expect(result[0].percentage).toBe(60);
    expect(result[1].percentage).toBe(40);
  });

  it("uses default categorical palette when label colors are not provided", () => {
    const rows = [
      { label: "A", value: 1 },
      { label: "B", value: 1 },
    ];

    const result = buildWidgetLegendEntries(rows, "#2563eb");

    expect(result[0].color).toBe("#2563eb");
    expect(result[1].color).toBe("#0f766e");
  });

  it("does not use accent as the default categorical palette", () => {
    const rows = [{ label: "Only", value: 5 }];

    const result = buildWidgetLegendEntries(rows, "#ff00aa");
    expect(result[0].color).toBe("#2563eb");
  });

  it("still uses explicit label colors when provided", () => {
    const rows = [
      { label: "Positive", value: 10 },
      { label: "Negative", value: 2 },
    ];

    const result = buildWidgetLegendEntries(rows, "#ff00aa", {
      Positive: "#22c55e",
      Negative: "#ef4444",
    });

    expect(result[0].color).toBe("#22c55e");
    expect(result[1].color).toBe("#ef4444");
  });
});
