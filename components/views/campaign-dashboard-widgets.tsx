"use client";

import React from "react";
import { useMemo, useState } from "react";
import useSWR from "swr";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Plus, Settings } from "lucide-react";
import { Button } from "@/components/button";
import { Modal } from "@/components/modal";
import {
  createCampaignDashboardWidget,
  deleteCampaignDashboardWidget,
  listCampaignDashboardWidgets,
  queryCampaignDashboardWidget,
  updateCampaignDashboardWidget,
} from "@/lib/api";
import { buildWidgetLegendEntries } from "@/lib/dashboard-widget-visualization";
import { inputClass, normalizeFieldLabel } from "@/lib/utils";
import {
  buildSelectableLabelOptions,
  deriveLabelChoiceOptionsForField,
  getNextLabelValue,
  LabelChoiceOption,
  seedLabelColorEntries,
} from "@/lib/widget-label-options";
import {
  Affiliate,
  Campaign,
  CampaignDashboardWidget,
  CampaignDashboardWidgetInput,
  CriteriaField,
  DashboardWidgetChartType,
  DashboardWidgetQueryRow,
  DashboardWidgetSize,
  MetricsQueryParams,
} from "@/lib/types";

const CHART_TYPES: DashboardWidgetChartType[] = [
  "pie",
  "donut",
  "bar",
  "line",
  "table",
];
const WIDGET_SIZES: DashboardWidgetSize[] = ["sm", "md", "lg"];
const ACCENTS = ["#2563eb", "#16a34a", "#f59e0b", "#ef4444", "#8b5cf6"];
const numberFormatter = new Intl.NumberFormat("en-US");

type LabelColorEntry = {
  label: string;
  color: string;
};

type CampaignDashboardWidgetsProps = {
  campaign: Campaign;
  affiliates: Affiliate[];
  filters: Pick<MetricsQueryParams, "from_date" | "to_date">;
};

type WidgetDraft = Omit<
  CampaignDashboardWidgetInput,
  "label_colors" | "chart_type"
> & {
  id?: string;
  chart_type: DashboardWidgetChartType | "";
  label_color_entries: LabelColorEntry[];
};

function emptyDraft(nextOrder: number): WidgetDraft {
  return {
    title: "",
    criteria_field_name: "",
    chart_type: "",
    accent: ACCENTS[0],
    label_color_entries: [],
    size: "md",
    order: nextOrder,
    scope: null,
  };
}

function toLabelColorEntries(
  labelColors?: Record<string, string>,
): LabelColorEntry[] {
  if (!labelColors) return [];
  return Object.entries(labelColors).map(([label, color]) => ({
    label,
    color,
  }));
}

function toLabelColorMap(entries: LabelColorEntry[]): Record<string, string> {
  return entries.reduce<Record<string, string>>((acc, entry) => {
    const label = entry.label.trim();
    const color = entry.color.trim();
    if (!label || !color) return acc;
    acc[label] = color;
    return acc;
  }, {});
}

function widgetGridClass(size: DashboardWidgetSize) {
  if (size === "lg") return "lg:col-span-2";
  if (size === "sm") return "lg:col-span-1";
  return "lg:col-span-1";
}

function formatChartType(type: DashboardWidgetChartType) {
  return type === "donut" ? "Donut" : normalizeFieldLabel(type);
}

function getWidgetRows(data?: {
  rows?: DashboardWidgetQueryRow[];
  points?: DashboardWidgetQueryRow[];
  buckets?: Array<{
    value?: string;
    label?: string;
    counters?: { received?: number };
  }>;
}) {
  const rows = data?.rows?.length
    ? data.rows
    : data?.points?.length
      ? data.points
      : (data?.buckets || []).map((bucket) => ({
          label: String(bucket.label ?? bucket.value ?? ""),
          value: Number(bucket.counters?.received ?? 0) || 0,
          bucket_start: undefined,
        }));

  return rows.filter((row) => row.label || row.bucket_start);
}

export function CampaignDashboardWidgets({
  campaign,
  affiliates,
  filters,
}: CampaignDashboardWidgetsProps) {
  const [builderOpen, setBuilderOpen] = useState(false);
  const [draft, setDraft] = useState<WidgetDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const affiliateNameById = useMemo(() => {
    const map = new Map<string, string>();
    affiliates.forEach((affiliate) => {
      if (affiliate.id && affiliate.name) map.set(affiliate.id, affiliate.name);
    });
    return map;
  }, [affiliates]);

  const criteriaFields = useMemo(
    () =>
      [...(campaign.base_criteria || [])].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0),
      ),
    [campaign.base_criteria],
  );

  const criteriaFieldOptions = useMemo(
    () =>
      criteriaFields
        .map((field, index) => ({
          field,
          index,
          displayLabel: (field.field_label || field.field_name || "").trim(),
        }))
        .sort((a, b) => {
          const byLabel = a.displayLabel.localeCompare(b.displayLabel, "en", {
            sensitivity: "base",
          });
          if (byLabel !== 0) return byLabel;
          const byFieldName = (a.field.field_name || "").localeCompare(
            b.field.field_name || "",
            "en",
            { sensitivity: "base" },
          );
          if (byFieldName !== 0) return byFieldName;
          return a.index - b.index;
        })
        .map((item) => item.field),
    [criteriaFields],
  );

  const sourceOptions = useMemo(
    () =>
      (campaign.affiliates || [])
        .map((link) => {
          const name =
            affiliateNameById.get(link.affiliate_id) ||
            link.affiliate_id ||
            link.campaign_key;
          return {
            affiliateId: link.affiliate_id,
            campaignKey: link.campaign_key,
            name,
          };
        })
        .filter((option) => option.affiliateId || option.campaignKey),
    [affiliateNameById, campaign.affiliates],
  );

  const {
    data: widgetResponse,
    error: widgetsError,
    mutate,
    isLoading,
  } = useSWR(
    ["campaign-dashboard-widgets", campaign.id],
    () => listCampaignDashboardWidgets(campaign.id),
    { revalidateOnFocus: false },
  );

  const widgets = useMemo(
    () =>
      [...(widgetResponse?.data?.items || [])].sort(
        (a, b) => a.order - b.order,
      ),
    [widgetResponse?.data?.items],
  );

  const openCreate = () => {
    setError(null);
    const nextDraft = emptyDraft(widgets.length + 1);
    const options = deriveLabelChoiceOptionsForField(
      criteriaFields,
      nextDraft.criteria_field_name,
    );
    setDraft({
      ...nextDraft,
      label_color_entries: seedLabelColorEntries(options, []),
    });
    setBuilderOpen(true);
  };

  const openEdit = (widget: CampaignDashboardWidget) => {
    setError(null);
    setDraft({
      id: widget.id,
      title: widget.title,
      criteria_field_name: widget.criteria_field_name,
      chart_type: widget.chart_type,
      accent: widget.accent || ACCENTS[0],
      label_color_entries: toLabelColorEntries(widget.label_colors),
      size: widget.size || "md",
      order: widget.order || 1,
      scope: widget.scope || null,
    });
    setBuilderOpen(true);
  };

  const closeBuilder = () => {
    if (saving) return;
    setBuilderOpen(false);
    setDraft(null);
    setError(null);
  };

  const saveDraft = async () => {
    if (!draft) return;
    if (!draft.title.trim()) {
      setError("Title is required.");
      return;
    }
    if (
      !criteriaFields.some((f) => f.field_name === draft.criteria_field_name)
    ) {
      setError("Select an available campaign criteria field.");
      return;
    }
    if (!draft.chart_type) {
      setError("Select a chart type.");
      return;
    }

    setSaving(true);
    setError(null);
    const isCreate = !draft.id;
    const payload: CampaignDashboardWidgetInput = {
      ...draft,
      title: draft.title.trim(),
      chart_type: draft.chart_type,
      label_colors:
        draft.chart_type === "line" || draft.chart_type === "table"
          ? {}
          : toLabelColorMap(draft.label_color_entries),
      order: isCreate ? widgets.length + 1 : Number(draft.order) || 1,
      scope:
        draft.scope?.affiliate_id || draft.scope?.campaign_key
          ? draft.scope
          : null,
    };

    try {
      if (draft.id) {
        await updateCampaignDashboardWidget(campaign.id, draft.id, payload);
      } else {
        await createCampaignDashboardWidget(campaign.id, payload);
      }
      await mutate();
      closeBuilder();
    } catch (err) {
      setError((err as Error)?.message || "Unable to save widget.");
    } finally {
      setSaving(false);
    }
  };

  const removeWidget = async (widget: CampaignDashboardWidget) => {
    await deleteCampaignDashboardWidget(campaign.id, widget.id);
    await mutate();
  };

  const selectedScopeValue = draft?.scope?.affiliate_id
    ? `affiliate:${draft.scope.affiliate_id}`
    : draft?.scope?.campaign_key
      ? `source:${draft.scope.campaign_key}`
      : "";

  const selectedFieldLabelOptions = useMemo(
    () =>
      deriveLabelChoiceOptionsForField(
        criteriaFields,
        draft?.criteria_field_name || "",
      ),
    [criteriaFields, draft?.criteria_field_name],
  );
  const isDynamicLabelListMode = selectedFieldLabelOptions.length > 0;

  const canSaveDraft =
    !!draft &&
    !saving &&
    draft.title.trim().length > 0 &&
    !!draft.chart_type &&
    criteriaFields.some(
      (field) => field.field_name === draft.criteria_field_name,
    );

  return (
    <section className="space-y-3" aria-label="Custom criteria widgets">
      {criteriaFields.length === 0 ? (
        <div className="panel border-dashed p-4 text-sm text-[--color-text-muted]">
          No campaign criteria fields are available for custom widgets.
        </div>
      ) : widgetsError ? (
        <div className="panel border-[color-mix(in_srgb,var(--color-danger)_45%,var(--color-border))] p-4 text-sm text-[--color-danger]">
          {(widgetsError as Error)?.message || "Unable to load widgets."}
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="panel h-[220px] animate-pulse bg-[--color-bg-muted]" />
          <div className="panel h-[220px] animate-pulse bg-[--color-bg-muted]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {widgets.map((widget) => (
            <DashboardWidgetCard
              key={widget.id}
              widget={widget}
              campaign={campaign}
              filters={filters}
              criteriaFields={criteriaFields}
              sourceOptions={sourceOptions}
              onEdit={() => openEdit(widget)}
              onDelete={() => removeWidget(widget)}
            />
          ))}
        </div>
      )}

      <div className="flex justify-center">
        <Button
          size="sm"
          onClick={openCreate}
          disabled={criteriaFields.length === 0}
          iconLeft={<Plus size={14} />}
        >
          Add widget
        </Button>
      </div>

      <Modal
        title={draft?.id ? "Edit Custom Widget" : "Add Custom Widget"}
        isOpen={builderOpen}
        onClose={closeBuilder}
        width={720}
        bodyClassName="flex h-[min(78vh,720px)] max-h-[calc(88vh-72px)] flex-col bg-[color-mix(in_srgb,var(--color-panel)_92%,var(--color-bg-subtle))]"
      >
        {draft && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm md:col-span-2">
                  <span className="mb-1 block text-xs font-semibold text-[--color-text-muted]">
                    Title
                    <span className="ml-1 text-[--color-danger]" aria-hidden>
                      *
                    </span>
                  </span>
                  <input
                    className={inputClass}
                    placeholder="Widget title"
                    value={draft.title}
                    onChange={(event) =>
                      setDraft((prev) =>
                        prev ? { ...prev, title: event.target.value } : prev,
                      )
                    }
                  />
                </label>

                <label className="text-sm">
                  <span className="mb-1 block text-xs font-semibold text-[--color-text-muted]">
                    Criteria field
                    <span className="ml-1 text-[--color-danger]" aria-hidden>
                      *
                    </span>
                  </span>
                  <select
                    className={inputClass}
                    value={draft.criteria_field_name}
                    onChange={(event) =>
                      setDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              criteria_field_name: event.target.value,
                              label_color_entries: seedLabelColorEntries(
                                deriveLabelChoiceOptionsForField(
                                  criteriaFields,
                                  event.target.value,
                                ),
                                prev.label_color_entries,
                              ),
                            }
                          : prev,
                      )
                    }
                  >
                    <option value="">Select criteria field</option>
                    {criteriaFieldOptions.map((field) => (
                      <option key={field.field_name} value={field.field_name}>
                        {field.field_label || field.field_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">
                  <span className="mb-1 block text-xs font-semibold text-[--color-text-muted]">
                    Chart type
                    <span className="ml-1 text-[--color-danger]" aria-hidden>
                      *
                    </span>
                  </span>
                  <select
                    className={inputClass}
                    value={draft.chart_type}
                    onChange={(event) =>
                      setDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              chart_type: event.target
                                .value as DashboardWidgetChartType,
                              label_color_entries:
                                (event.target
                                  .value as DashboardWidgetChartType) ===
                                  "line" ||
                                (event.target
                                  .value as DashboardWidgetChartType) ===
                                  "table"
                                  ? []
                                  : prev.label_color_entries,
                            }
                          : prev,
                      )
                    }
                  >
                    <option value="">Select chart type</option>
                    {CHART_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {formatChartType(type)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">
                  <span className="mb-1 block text-xs font-semibold text-[--color-text-muted]">
                    Source scope
                  </span>
                  <select
                    className={inputClass}
                    value={selectedScopeValue}
                    onChange={(event) => {
                      const value = event.target.value;
                      setDraft((prev) => {
                        if (!prev) return prev;
                        if (!value) return { ...prev, scope: null };
                        const [kind, id] = value.split(":");
                        if (kind === "affiliate") {
                          const option = sourceOptions.find(
                            (item) => item.affiliateId === id,
                          );
                          return {
                            ...prev,
                            scope: {
                              affiliate_id: id,
                              campaign_key: option?.campaignKey,
                            },
                          };
                        }
                        return { ...prev, scope: { campaign_key: id } };
                      });
                    }}
                  >
                    <option value="">All sources</option>
                    {sourceOptions.map((option) => (
                      <option
                        key={`${option.affiliateId || option.campaignKey}`}
                        value={
                          option.affiliateId
                            ? `affiliate:${option.affiliateId}`
                            : `source:${option.campaignKey}`
                        }
                      >
                        {option.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">
                  <span className="mb-1 block text-xs font-semibold text-[--color-text-muted]">
                    Size
                  </span>
                  <select
                    className={inputClass}
                    value={draft.size}
                    onChange={(event) =>
                      setDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              size: event.target.value as DashboardWidgetSize,
                            }
                          : prev,
                      )
                    }
                  >
                    {WIDGET_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">
                  <span className="mb-1 block text-xs font-semibold text-[--color-text-muted]">
                    Order
                  </span>
                  <input
                    className={inputClass}
                    type="number"
                    min={1}
                    value={draft.order}
                    onChange={(event) =>
                      setDraft((prev) =>
                        prev
                          ? { ...prev, order: Number(event.target.value) }
                          : prev,
                      )
                    }
                  />
                </label>

                <fieldset className="md:col-span-2">
                  <legend className="mb-2 text-xs font-semibold text-[--color-text-muted]">
                    Accent
                  </legend>
                  <div className="flex flex-wrap items-center gap-2">
                    {ACCENTS.map((accent) => {
                      const selected =
                        (draft.accent || ACCENTS[0]).toLowerCase() ===
                        accent.toLowerCase();
                      return (
                        <button
                          key={accent}
                          type="button"
                          aria-label={`Accent ${accent}`}
                          aria-pressed={selected}
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-[--radius-sm] border transition ${
                            selected
                              ? "border-[--color-primary] ring-2 ring-[color-mix(in_srgb,var(--color-primary)_30%,transparent)]"
                              : "border-[--color-border]"
                          }`}
                          onClick={() =>
                            setDraft((prev) =>
                              prev ? { ...prev, accent } : prev,
                            )
                          }
                        >
                          <span
                            className="h-5 w-5 rounded-full border border-black/10"
                            style={{ backgroundColor: accent }}
                            aria-hidden
                          />
                        </button>
                      );
                    })}
                    <input
                      aria-label="Custom accent color"
                      className="h-10 w-14 cursor-pointer rounded-[--radius-sm] border border-[--color-border] bg-[--color-panel] p-1"
                      type="color"
                      value={draft.accent || ACCENTS[0]}
                      onChange={(event) =>
                        setDraft((prev) =>
                          prev ? { ...prev, accent: event.target.value } : prev,
                        )
                      }
                    />
                  </div>
                </fieldset>

                {draft.chart_type !== "line" &&
                  draft.chart_type !== "table" && (
                    <fieldset className="md:col-span-2">
                      <legend className="mb-2 text-xs font-semibold text-[--color-text-muted]">
                        Response label colors
                      </legend>
                      <p className="mb-2 text-xs text-[--color-text-muted]">
                        Defaults follow the selected criteria responses. Edit
                        labels or colors as needed.
                      </p>
                      <div className="space-y-2">
                        {draft.label_color_entries.length > 0 &&
                          draft.label_color_entries.map((entry, index) =>
                            (() => {
                              const selectableLabelOptions =
                                buildSelectableLabelOptions(
                                  selectedFieldLabelOptions,
                                  draft.label_color_entries,
                                  index,
                                );
                              const knownValues = new Set(
                                selectableLabelOptions.map((option) =>
                                  option.value.trim().toLowerCase(),
                                ),
                              );
                              const currentLabel = entry.label.trim();
                              const showCustomCurrent =
                                currentLabel.length > 0 &&
                                !knownValues.has(currentLabel.toLowerCase());

                              return (
                                <div
                                  key={`${index}-${entry.label}`}
                                  className="grid grid-cols-[1fr_auto_auto] items-center gap-2"
                                >
                                  {selectedFieldLabelOptions.length > 0 ? (
                                    <select
                                      className={inputClass}
                                      value={entry.label}
                                      onChange={(event) =>
                                        setDraft((prev) => {
                                          if (!prev) return prev;
                                          const next = [
                                            ...prev.label_color_entries,
                                          ];
                                          next[index] = {
                                            ...next[index],
                                            label: event.target.value,
                                          };
                                          return {
                                            ...prev,
                                            label_color_entries: next,
                                          };
                                        })
                                      }
                                    >
                                      <option value="">
                                        Select response label
                                      </option>
                                      {showCustomCurrent && (
                                        <option value={entry.label}>
                                          {entry.label} (custom)
                                        </option>
                                      )}
                                      {selectableLabelOptions.map((option) => (
                                        <option
                                          key={option.value}
                                          value={option.value}
                                        >
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      className={inputClass}
                                      value={entry.label}
                                      placeholder="Response label (e.g. Yes)"
                                      onChange={(event) =>
                                        setDraft((prev) => {
                                          if (!prev) return prev;
                                          const next = [
                                            ...prev.label_color_entries,
                                          ];
                                          next[index] = {
                                            ...next[index],
                                            label: event.target.value,
                                          };
                                          return {
                                            ...prev,
                                            label_color_entries: next,
                                          };
                                        })
                                      }
                                    />
                                  )}
                                  <input
                                    className="h-10 w-14 cursor-pointer rounded-[--radius-sm] border border-[--color-border] bg-[--color-panel] p-1"
                                    type="color"
                                    value={entry.color || ACCENTS[0]}
                                    onChange={(event) =>
                                      setDraft((prev) => {
                                        if (!prev) return prev;
                                        const next = [
                                          ...prev.label_color_entries,
                                        ];
                                        next[index] = {
                                          ...next[index],
                                          color: event.target.value,
                                        };
                                        return {
                                          ...prev,
                                          label_color_entries: next,
                                        };
                                      })
                                    }
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      setDraft((prev) => {
                                        if (!prev) return prev;
                                        return {
                                          ...prev,
                                          label_color_entries:
                                            prev.label_color_entries.filter(
                                              (_, itemIndex) =>
                                                itemIndex !== index,
                                            ),
                                        };
                                      })
                                    }
                                  >
                                    Remove
                                  </Button>
                                </div>
                              );
                            })(),
                          )}
                      </div>
                      {!isDynamicLabelListMode && (
                        <div className="mt-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      label_color_entries: [
                                        ...prev.label_color_entries,
                                        {
                                          label: getNextLabelValue(
                                            selectedFieldLabelOptions,
                                            prev.label_color_entries,
                                          ),
                                          color: ACCENTS[0],
                                        },
                                      ],
                                    }
                                  : prev,
                              )
                            }
                          >
                            Add label color
                          </Button>
                        </div>
                      )}
                    </fieldset>
                  )}
              </div>

              {error && (
                <p className="text-sm text-[--color-danger]">{error}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-[--color-border] px-6 py-4">
              <Button variant="ghost" onClick={closeBuilder} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={saveDraft} disabled={!canSaveDraft}>
                {saving ? "Saving..." : "Save widget"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}

function DashboardWidgetCard({
  widget,
  campaign,
  filters,
  criteriaFields,
  sourceOptions,
  onEdit,
  onDelete,
}: {
  widget: CampaignDashboardWidget;
  campaign: Campaign;
  filters: Pick<MetricsQueryParams, "from_date" | "to_date">;
  criteriaFields: CriteriaField[];
  sourceOptions: { affiliateId?: string; campaignKey?: string; name: string }[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { data, error, isLoading } = useSWR(
    [
      "campaign-dashboard-widget-query",
      campaign.id,
      widget.id,
      filters.from_date || "",
      filters.to_date || "",
    ],
    () => queryCampaignDashboardWidget(campaign.id, widget, filters),
    { revalidateOnFocus: false },
  );
  const [actionsOpen, setActionsOpen] = useState(false);

  const fieldExists = criteriaFields.some(
    (field) => field.field_name === widget.criteria_field_name,
  );
  const rows = getWidgetRows(data?.data);
  const scopeName =
    sourceOptions.find(
      (option) =>
        option.affiliateId === widget.scope?.affiliate_id ||
        option.campaignKey === widget.scope?.campaign_key,
    )?.name || "All sources";
  const accent = widget.accent || ACCENTS[0];

  return (
    <article className={`panel p-3 sm:p-4 ${widgetGridClass(widget.size)}`}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h4 className="min-w-0 truncate text-sm font-semibold text-[--color-text-strong]">
          {widget.title}
        </h4>
        <Button
          aria-label={`Actions for ${widget.title}`}
          variant="ghost"
          size="sm"
          onClick={() => setActionsOpen(true)}
          iconLeft={<Settings size={14} />}
        />
      </div>
      <div
        className="mb-2 h-1 rounded-full"
        style={{ backgroundColor: accent }}
        aria-hidden
      />
      <p className="mb-3 text-xs text-[--color-text-muted]">
        {widget.criteria_field_label ||
          criteriaFields.find(
            (field) => field.field_name === widget.criteria_field_name,
          )?.field_label ||
          normalizeFieldLabel(widget.criteria_field_name)}
        {" · "}
        {scopeName}
      </p>

      <Modal
        title="Widget actions"
        isOpen={actionsOpen}
        onClose={() => setActionsOpen(false)}
        width={340}
      >
        <div className="space-y-2 p-4">
          <Button
            className="w-full justify-center"
            onClick={() => {
              setActionsOpen(false);
              onEdit();
            }}
          >
            Edit widget
          </Button>
          <Button
            className="w-full justify-center"
            variant="ghost"
            onClick={() => {
              setActionsOpen(false);
              onDelete();
            }}
          >
            Delete widget
          </Button>
        </div>
      </Modal>

      {!fieldExists ? (
        <div className="flex h-[190px] items-center justify-center rounded-[--radius-sm] border border-dashed border-[--color-border] px-4 text-center text-sm text-[--color-danger]">
          This widget uses a criteria field that is no longer available.
        </div>
      ) : error ? (
        <div className="flex h-[190px] items-center justify-center rounded-[--radius-sm] border border-dashed border-[--color-border] px-4 text-center text-sm text-[--color-danger]">
          {(error as Error)?.message || "Unable to load widget data."}
        </div>
      ) : isLoading ? (
        <div className="h-[190px] animate-pulse rounded-[--radius-sm] bg-[--color-bg-subtle]" />
      ) : rows.length === 0 ? (
        <div className="flex h-[190px] items-center justify-center rounded-[--radius-sm] border border-dashed border-[--color-border] text-sm text-[--color-text-muted]">
          No aggregated data for this widget yet.
        </div>
      ) : (
        <WidgetVisualization
          chartType={widget.chart_type}
          rows={rows}
          accent={accent}
          labelColors={widget.label_colors}
        />
      )}
    </article>
  );
}

function WidgetVisualization({
  chartType,
  rows,
  accent,
  labelColors,
}: {
  chartType: DashboardWidgetChartType;
  rows: DashboardWidgetQueryRow[];
  accent: string;
  labelColors?: Record<string, string>;
}) {
  const legendRows = buildWidgetLegendEntries(rows, accent, labelColors);
  const chartRows = legendRows.map((row) => ({
    name: row.name,
    value: row.value,
    color: row.color,
    percentage: row.percentage,
  }));
  const totalLeads = chartRows.reduce((sum, row) => sum + row.value, 0);

  if (chartType === "table") {
    return (
      <div className="max-h-[220px] overflow-auto rounded-[--radius-sm] border border-[--color-border]">
        <table className="min-w-full text-sm">
          <thead className="bg-[--color-bg-muted] text-xs uppercase tracking-wide text-[--color-text-muted]">
            <tr>
              <th className="px-3 py-2 text-left">Value</th>
              <th className="px-3 py-2 text-right">Leads</th>
              <th className="px-3 py-2 text-right">Percentage</th>
            </tr>
          </thead>
          <tbody>
            {chartRows.map((row) => (
              <tr key={row.name} className="border-t border-[--color-border]">
                <td className="px-3 py-2 text-[--color-text]">{row.name}</td>
                <td className="px-3 py-2 text-right font-semibold text-[--color-text-strong]">
                  {numberFormatter.format(row.value)}
                </td>
                <td className="px-3 py-2 text-right text-[--color-text-muted]">
                  {row.percentage}%
                </td>
              </tr>
            ))}
            <tr className="border-t border-[--color-border] bg-[--color-bg-muted]">
              <td className="px-3 py-2 font-semibold text-[--color-text-strong]">
                Total
              </td>
              <td className="px-3 py-2 text-right font-semibold text-[--color-text-strong]">
                {numberFormatter.format(totalLeads)}
              </td>
              <td className="px-3 py-2 text-right font-semibold text-[--color-text-strong]">
                100%
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  if (chartType === "bar") {
    return (
      <div className="space-y-2">
        <div className="h-[170px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows} margin={{ top: 8, right: 8, left: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
              />
              <XAxis
                dataKey="name"
                stroke="var(--color-text-muted)"
                tick={{ fontSize: 10 }}
              />
              <YAxis stroke="var(--color-text-muted)" tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(value) => numberFormatter.format(Number(value))}
              />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {chartRows.map((row) => (
                  <Cell key={row.name} fill={row.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <WidgetLegend rows={legendRows} />
      </div>
    );
  }

  if (chartType === "line") {
    return (
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartRows} margin={{ top: 8, right: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="name"
              stroke="var(--color-text-muted)"
              tick={{ fontSize: 10 }}
            />
            <YAxis stroke="var(--color-text-muted)" tick={{ fontSize: 10 }} />
            <Tooltip
              formatter={(value) => numberFormatter.format(Number(value))}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={accent}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="h-[170px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartRows}
              dataKey="value"
              nameKey="name"
              innerRadius={chartType === "donut" ? 46 : 0}
              outerRadius={84}
              paddingAngle={2}
              stroke="var(--color-panel)"
              label={({
                percent,
                cx,
                cy,
                midAngle,
                innerRadius,
                outerRadius,
              }) => {
                const pct = Math.round(Number(percent || 0) * 100);
                if (pct < 5) return null;
                const RAD = Math.PI / 180;
                const r = (Number(innerRadius) + Number(outerRadius)) / 2;
                const x = Number(cx) + r * Math.cos(-Number(midAngle) * RAD);
                const y = Number(cy) + r * Math.sin(-Number(midAngle) * RAD);
                return (
                  <text
                    x={x}
                    y={y}
                    fill="#ffffff"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={11}
                    fontWeight={600}
                  >
                    {`${pct}%`}
                  </text>
                );
              }}
              labelLine={false}
            >
              {chartRows.map((row) => (
                <Cell key={row.name} fill={row.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => numberFormatter.format(Number(value))}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <WidgetLegend rows={legendRows} />
    </div>
  );
}

function WidgetLegend({
  rows,
}: {
  rows: ReturnType<typeof buildWidgetLegendEntries>;
}) {
  return (
    <div className="space-y-1 text-xs text-[--color-text]">
      {rows.map((row) => (
        <div key={row.key} className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
            style={{ backgroundColor: row.color }}
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate">{row.name}</span>
          <span className="text-[--color-text-muted]">
            {numberFormatter.format(row.value)} ({row.percentage}%)
          </span>
        </div>
      ))}
    </div>
  );
}
