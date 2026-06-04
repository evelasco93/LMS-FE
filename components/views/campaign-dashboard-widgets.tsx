"use client";

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
import { Edit3, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/button";
import { Modal } from "@/components/modal";
import {
  createCampaignDashboardWidget,
  deleteCampaignDashboardWidget,
  listCampaignDashboardWidgets,
  queryCampaignDashboardWidget,
  updateCampaignDashboardWidget,
} from "@/lib/api";
import { inputClass, normalizeFieldLabel } from "@/lib/utils";
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

type CampaignDashboardWidgetsProps = {
  campaign: Campaign;
  affiliates: Affiliate[];
  filters: Pick<MetricsQueryParams, "from_date" | "to_date">;
};

type WidgetDraft = CampaignDashboardWidgetInput & { id?: string };

function emptyDraft(nextOrder: number, firstField?: CriteriaField): WidgetDraft {
  return {
    title: firstField?.field_label ? `${firstField.field_label} Breakdown` : "",
    criteria_field_name: firstField?.field_name || "",
    chart_type: "donut",
    accent: ACCENTS[0],
    size: "md",
    order: nextOrder,
    scope: null,
  };
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
}) {
  return (data?.rows?.length ? data.rows : data?.points || []).filter(
    (row) => row.label || row.bucket_start,
  );
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
    setDraft(emptyDraft(widgets.length + 1, criteriaFields[0]));
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
    if (!criteriaFields.some((f) => f.field_name === draft.criteria_field_name)) {
      setError("Select an available campaign criteria field.");
      return;
    }

    setSaving(true);
    setError(null);
    const payload: CampaignDashboardWidgetInput = {
      ...draft,
      title: draft.title.trim(),
      order: Number(draft.order) || widgets.length + 1,
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

  return (
    <section className="space-y-3" aria-labelledby="custom-widgets-title">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3
            id="custom-widgets-title"
            className="text-sm font-semibold uppercase tracking-wide text-[--color-text-strong]"
          >
            Custom Criteria Widgets
          </h3>
          <p className="text-xs text-[--color-text-muted]">
            {campaign.name}
          </p>
        </div>
        <Button
          size="sm"
          onClick={openCreate}
          disabled={criteriaFields.length === 0}
          iconLeft={<Plus size={14} />}
        >
          Add widget
        </Button>
      </div>

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
      ) : widgets.length === 0 ? (
        <div className="panel p-4 text-sm text-[--color-text-muted]">
          No custom widgets saved for this campaign yet.
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

      <Modal
        title={draft?.id ? "Edit Custom Widget" : "Add Custom Widget"}
        isOpen={builderOpen}
        onClose={closeBuilder}
        width={720}
      >
        {draft && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-[--color-text-muted]">
                  Title
                </span>
                <input
                  className={inputClass}
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
                </span>
                <select
                  className={inputClass}
                  value={draft.criteria_field_name}
                  onChange={(event) =>
                    setDraft((prev) =>
                      prev
                        ? { ...prev, criteria_field_name: event.target.value }
                        : prev,
                    )
                  }
                >
                  {criteriaFields.map((field) => (
                    <option key={field.field_name} value={field.field_name}>
                      {field.field_label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm">
                <span className="mb-1 block text-xs font-semibold text-[--color-text-muted]">
                  Chart type
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
                          }
                        : prev,
                    )
                  }
                >
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
                <div className="flex flex-wrap gap-2">
                  {ACCENTS.map((accent) => (
                    <button
                      key={accent}
                      type="button"
                      aria-label={`Use accent ${accent}`}
                      className={`h-8 w-8 rounded-full border-2 ${
                        draft.accent === accent
                          ? "border-[--color-text-strong]"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: accent }}
                      onClick={() =>
                        setDraft((prev) =>
                          prev ? { ...prev, accent } : prev,
                        )
                      }
                    />
                  ))}
                </div>
              </fieldset>
            </div>

            {error && <p className="text-sm text-[--color-danger]">{error}</p>}

            <div className="flex justify-end gap-2 border-t border-[--color-border] pt-4">
              <Button variant="ghost" onClick={closeBuilder} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={saveDraft} disabled={saving}>
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

  return (
    <article className={`panel p-3 sm:p-4 ${widgetGridClass(widget.size)}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-[--color-text-strong]">
            {widget.title}
          </h4>
          <p className="mt-0.5 text-xs text-[--color-text-muted]">
            {widget.criteria_field_label ||
              criteriaFields.find(
                (field) => field.field_name === widget.criteria_field_name,
              )?.field_label ||
              normalizeFieldLabel(widget.criteria_field_name)}
            {" · "}
            {scopeName}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            aria-label={`Edit ${widget.title}`}
            variant="ghost"
            size="sm"
            onClick={onEdit}
            iconLeft={<Edit3 size={14} />}
          />
          <Button
            aria-label={`Delete ${widget.title}`}
            variant="ghost"
            size="sm"
            onClick={onDelete}
            iconLeft={<Trash2 size={14} />}
          />
        </div>
      </div>

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
          accent={widget.accent || ACCENTS[0]}
        />
      )}
    </article>
  );
}

function WidgetVisualization({
  chartType,
  rows,
  accent,
}: {
  chartType: DashboardWidgetChartType;
  rows: DashboardWidgetQueryRow[];
  accent: string;
}) {
  const chartRows = rows.map((row) => ({
    ...row,
    name: row.label || row.bucket_start || "Unknown",
  }));

  if (chartType === "table") {
    return (
      <div className="max-h-[220px] overflow-auto rounded-[--radius-sm] border border-[--color-border]">
        <table className="min-w-full text-sm">
          <thead className="bg-[--color-bg-muted] text-xs uppercase tracking-wide text-[--color-text-muted]">
            <tr>
              <th className="px-3 py-2 text-left">Value</th>
              <th className="px-3 py-2 text-right">Leads</th>
            </tr>
          </thead>
          <tbody>
            {chartRows.map((row) => (
              <tr key={row.name} className="border-t border-[--color-border]">
                <td className="px-3 py-2 text-[--color-text]">{row.name}</td>
                <td className="px-3 py-2 text-right font-semibold text-[--color-text-strong]">
                  {numberFormatter.format(row.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (chartType === "bar") {
    return (
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartRows} margin={{ top: 8, right: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="name" stroke="var(--color-text-muted)" tick={{ fontSize: 10 }} />
            <YAxis stroke="var(--color-text-muted)" tick={{ fontSize: 10 }} />
            <Tooltip formatter={(value) => numberFormatter.format(Number(value))} />
            <Bar dataKey="value" fill={accent} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (chartType === "line") {
    return (
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartRows} margin={{ top: 8, right: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="name" stroke="var(--color-text-muted)" tick={{ fontSize: 10 }} />
            <YAxis stroke="var(--color-text-muted)" tick={{ fontSize: 10 }} />
            <Tooltip formatter={(value) => numberFormatter.format(Number(value))} />
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
    <div className="h-[220px] w-full">
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
          >
            {chartRows.map((row, index) => (
              <Cell
                key={row.name}
                fill={
                  index === 0
                    ? accent
                    : `color-mix(in_srgb, ${accent} ${Math.max(28, 82 - index * 14)}%, var(--color-bg-subtle))`
                }
              />
            ))}
          </Pie>
          <Tooltip formatter={(value) => numberFormatter.format(Number(value))} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
