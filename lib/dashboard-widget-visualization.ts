import { DashboardWidgetQueryRow } from "@/lib/types";

export type WidgetLegendEntry = {
  key: string;
  name: string;
  value: number;
  percentage: number;
  color: string;
};

const DEFAULT_CATEGORICAL_COLORS = [
  "#2563eb",
  "#0f766e",
  "#f59e0b",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#65a30d",
  "#ea580c",
];

function normalizeLabelKey(value: string): string {
  return value.trim().toLowerCase();
}

function getDefaultCategoryColor(index: number): string {
  return DEFAULT_CATEGORICAL_COLORS[index % DEFAULT_CATEGORICAL_COLORS.length];
}

function resolveMappedColor(
  label: string,
  labelColors: Record<string, string> | undefined,
): string | undefined {
  if (!labelColors) return undefined;

  if (typeof labelColors[label] === "string") {
    return labelColors[label];
  }

  const normalizedLabel = normalizeLabelKey(label);
  const matchedEntry = Object.entries(labelColors).find(
    ([key]) => normalizeLabelKey(key) === normalizedLabel,
  );

  return matchedEntry?.[1];
}

export function buildWidgetLegendEntries(
  rows: DashboardWidgetQueryRow[],
  _accent: string,
  labelColors?: Record<string, string>,
): WidgetLegendEntry[] {
  const total = rows.reduce((sum, row) => sum + (Number(row.value) || 0), 0);

  return rows.map((row, index) => {
    const name = row.label || row.bucket_start || "Unknown";
    const color =
      resolveMappedColor(name, labelColors) || getDefaultCategoryColor(index);

    return {
      key: `${name}-${index}`,
      name,
      value: Number(row.value) || 0,
      percentage:
        total > 0 ? Math.round(((Number(row.value) || 0) / total) * 100) : 0,
      color,
    };
  });
}
