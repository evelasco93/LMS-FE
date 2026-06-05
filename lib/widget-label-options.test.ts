import { describe, expect, it } from "vitest";
import type { CriteriaField } from "@/lib/types";
import {
  buildSelectableLabelOptions,
  deriveLabelChoiceOptionsForField,
  getNextLabelValue,
  seedLabelColorEntries,
} from "@/lib/widget-label-options";

describe("widget label options", () => {
  const criteriaFields: CriteriaField[] = [
    {
      id: "field-1",
      campaign_id: "campaign-1",
      field_label: "Consent",
      field_name: "consent",
      data_type: "List",
      required: false,
      options: [
        { label: "Yes", value: "yes" },
        { label: " No ", value: "no" },
        { label: "yes", value: "Y" },
      ],
    },
    {
      id: "field-2",
      campaign_id: "campaign-1",
      field_label: "Message",
      field_name: "message",
      data_type: "Text",
      required: false,
    },
  ];

  it("derives unique, trimmed label options from criteria field metadata", () => {
    const options = deriveLabelChoiceOptionsForField(criteriaFields, "consent");
    expect(options).toEqual([
      { label: "Yes", value: "Yes" },
      { label: "No", value: "No" },
    ]);
  });

  it("returns no options for fields without configured choices", () => {
    const options = deriveLabelChoiceOptionsForField(criteriaFields, "message");
    expect(options).toEqual([]);
  });

  it("marks already-selected labels from other rows as disabled", () => {
    const options = deriveLabelChoiceOptionsForField(criteriaFields, "consent");
    const selectable = buildSelectableLabelOptions(
      options,
      [{ label: "Yes" }, { label: "No" }],
      0,
    );

    expect(selectable.find((option) => option.value === "Yes")?.disabled).toBe(
      false,
    );
    expect(selectable.find((option) => option.value === "No")?.disabled).toBe(
      true,
    );
  });

  it("suggests the next unused label and falls back to empty when exhausted", () => {
    const options = deriveLabelChoiceOptionsForField(criteriaFields, "consent");
    expect(getNextLabelValue(options, [{ label: "Yes" }])).toBe("No");
    expect(
      getNextLabelValue(options, [{ label: "Yes" }, { label: "No" }]),
    ).toBe("");
  });

  it("auto-seeds label rows from criteria options with deterministic default colors", () => {
    const options = deriveLabelChoiceOptionsForField(criteriaFields, "consent");
    const seeded = seedLabelColorEntries(options, []);

    expect(seeded).toEqual([
      { label: "Yes", color: "#1d4ed8" },
      { label: "No", color: "#0f766e" },
    ]);
  });

  it("re-seeds when existing entries are stale for the selected field", () => {
    const options = deriveLabelChoiceOptionsForField(criteriaFields, "consent");
    const seeded = seedLabelColorEntries(options, [
      { label: "Unknown", color: "#000000" },
    ]);

    expect(seeded).toEqual([
      { label: "Yes", color: "#1d4ed8" },
      { label: "No", color: "#0f766e" },
    ]);
  });

  it("keeps existing entries when they already match the selected field options", () => {
    const options = deriveLabelChoiceOptionsForField(criteriaFields, "consent");
    const existing = [
      { label: "Yes", color: "#22c55e" },
      { label: "No", color: "#ef4444" },
    ];

    const seeded = seedLabelColorEntries(options, existing);
    expect(seeded).toEqual(existing);
  });
});
