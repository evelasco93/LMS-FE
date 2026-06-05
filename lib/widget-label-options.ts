import type { CriteriaField } from "@/lib/types";

export type LabelChoiceOption = {
  label: string;
  value: string;
};

export type LabelColorEntry = {
  label: string;
  color: string;
};

type LabelEntry = { label: string };

const DEFAULT_LABEL_COLORS = [
  "#1d4ed8",
  "#0f766e",
  "#f59e0b",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#65a30d",
  "#ea580c",
];

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function deriveLabelChoiceOptionsForField(
  criteriaFields: CriteriaField[],
  fieldName: string,
): LabelChoiceOption[] {
  const field = criteriaFields.find((item) => item.field_name === fieldName);
  if (!field) return [];

  if (!field?.options?.length) {
    if (field.data_type === "Boolean") {
      return [
        { label: "Yes", value: "Yes" },
        { label: "No", value: "No" },
      ];
    }
    return [];
  }

  const seen = new Set<string>();
  const options: LabelChoiceOption[] = [];

  for (const option of field.options) {
    const label = (option.label || option.value || "").trim();
    if (!label) continue;
    const key = normalize(label);
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({ label, value: label });
  }

  return options;
}

export function buildSelectableLabelOptions(
  options: LabelChoiceOption[],
  entries: LabelEntry[],
  currentIndex: number,
): Array<LabelChoiceOption & { disabled: boolean }> {
  const usedByOtherRows = new Set<string>();
  entries.forEach((entry, index) => {
    if (index === currentIndex) return;
    const key = normalize(entry.label || "");
    if (key) usedByOtherRows.add(key);
  });

  return options.map((option) => ({
    ...option,
    disabled: usedByOtherRows.has(normalize(option.value)),
  }));
}

export function getNextLabelValue(
  options: LabelChoiceOption[],
  entries: LabelEntry[],
): string {
  const used = new Set(
    entries
      .map((entry) => normalize(entry.label || ""))
      .filter((value) => value.length > 0),
  );

  const next = options.find((option) => !used.has(normalize(option.value)));
  return next?.value || "";
}

function isStaleForFieldOptions(
  options: LabelChoiceOption[],
  entries: LabelColorEntry[],
): boolean {
  if (entries.length === 0) return true;

  const normalizedOptions = new Set(
    options.map((option) => normalize(option.value)),
  );
  const normalizedLabels = entries
    .map((entry) => normalize(entry.label || ""))
    .filter((label) => label.length > 0);

  if (normalizedLabels.length !== options.length) return true;
  if (normalizedLabels.some((label) => !normalizedOptions.has(label)))
    return true;

  return false;
}

export function seedLabelColorEntries(
  options: LabelChoiceOption[],
  entries: LabelColorEntry[],
): LabelColorEntry[] {
  if (options.length === 0) return entries;
  if (!isStaleForFieldOptions(options, entries)) return entries;

  return options.map((option, index) => ({
    label: option.value,
    color: DEFAULT_LABEL_COLORS[index % DEFAULT_LABEL_COLORS.length],
  }));
}
