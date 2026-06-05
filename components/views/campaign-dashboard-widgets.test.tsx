// @ts-nocheck
import React from "react";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createCampaignDashboardWidget,
  deleteCampaignDashboardWidget,
  listCampaignDashboardWidgets,
  queryCampaignDashboardWidget,
  updateCampaignDashboardWidget,
} from "@/lib/api";
import { CampaignDashboardWidgets } from "@/components/views/campaign-dashboard-widgets";
import { Affiliate, Campaign, CampaignDashboardWidget } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  createCampaignDashboardWidget: vi.fn(),
  deleteCampaignDashboardWidget: vi.fn(),
  listCampaignDashboardWidgets: vi.fn(),
  queryCampaignDashboardWidget: vi.fn(),
  updateCampaignDashboardWidget: vi.fn(),
}));

const baseCriteriaField = {
  id: "field-1",
  campaign_id: "CM-1",
  field_label: "Own Home",
  field_name: "own_home",
  data_type: "Boolean",
  required: false,
  options: [
    { label: "Yes", value: "Yes" },
    { label: "No", value: "No" },
  ],
};

const freeTextCriteriaField = {
  id: "field-2",
  campaign_id: "CM-1",
  field_label: "Notes",
  field_name: "notes",
  data_type: "String",
  required: false,
};

const campaign: Campaign = {
  id: "CM-1",
  name: "Campaign One",
  status: "ACTIVE",
  base_criteria: [baseCriteriaField, freeTextCriteriaField],
  affiliates: [],
};

const affiliates: Affiliate[] = [];

function renderWidgets() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <CampaignDashboardWidgets
        campaign={campaign}
        affiliates={affiliates}
        filters={{ from_date: "", to_date: "" }}
      />
    </SWRConfig>,
  );
}

describe("CampaignDashboardWidgets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createCampaignDashboardWidget).mockResolvedValue({});
    vi.mocked(updateCampaignDashboardWidget).mockResolvedValue({});
    vi.mocked(deleteCampaignDashboardWidget).mockResolvedValue({});
    vi.mocked(queryCampaignDashboardWidget).mockResolvedValue({
      data: { rows: [] },
    });
  });

  it("starts create flow blank with placeholders and keeps save disabled until required fields are set", async () => {
    vi.mocked(listCampaignDashboardWidgets).mockResolvedValue({
      data: { items: [] },
    });

    const user = userEvent.setup();
    renderWidgets();

    await user.click(await screen.findByRole("button", { name: "Add widget" }));

    const titleInput = screen.getByLabelText(/Title/i) as HTMLInputElement;
    const criteriaSelect = screen.getByLabelText(
      /Criteria field/i,
    ) as HTMLSelectElement;
    const chartTypeSelect = screen.getByLabelText(
      /Chart type/i,
    ) as HTMLSelectElement;
    const saveButton = screen.getByRole("button", { name: "Save widget" });

    expect(titleInput).toHaveValue("");
    expect(titleInput).toHaveAttribute("placeholder", "Widget title");
    expect(criteriaSelect).toHaveValue("");
    expect(chartTypeSelect).toHaveValue("");
    expect(saveButton).toBeDisabled();

    await user.type(titleInput, "Lead Ownership");
    await user.selectOptions(criteriaSelect, "own_home");
    await user.selectOptions(chartTypeSelect, "pie");

    expect(saveButton).toBeEnabled();
  });

  it("sorts criteria field options alphabetically by displayed label", async () => {
    vi.mocked(listCampaignDashboardWidgets).mockResolvedValue({
      data: { items: [] },
    });

    const user = userEvent.setup();
    renderWidgets();

    await user.click(await screen.findByRole("button", { name: "Add widget" }));

    const criteriaSelect = screen.getByLabelText(
      /Criteria field/i,
    ) as HTMLSelectElement;
    const optionLabels = Array.from(criteriaSelect.options)
      .slice(1)
      .map((option) => option.textContent);

    expect(optionLabels).toEqual(["Notes", "Own Home"]);
  });

  it("renders only centered add button area without section/campaign header text", async () => {
    vi.mocked(listCampaignDashboardWidgets).mockResolvedValue({
      data: { items: [] },
    });

    renderWidgets();

    await screen.findByRole("button", { name: "Add widget" });
    expect(
      screen.queryByText("Custom Criteria Widgets"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Campaign One")).not.toBeInTheDocument();
  });

  it("always appends new widgets to the bottom on create", async () => {
    const user = userEvent.setup();
    vi.mocked(listCampaignDashboardWidgets).mockResolvedValue({
      data: {
        items: [
          {
            id: "w-1",
            campaign_id: "CM-1",
            title: "Existing 1",
            criteria_field_name: "own_home",
            chart_type: "pie",
            accent: "#2563eb",
            label_colors: {},
            size: "md",
            order: 1,
            scope: null,
          },
          {
            id: "w-2",
            campaign_id: "CM-1",
            title: "Existing 2",
            criteria_field_name: "own_home",
            chart_type: "bar",
            accent: "#16a34a",
            label_colors: {},
            size: "md",
            order: 2,
            scope: null,
          },
        ],
      },
    });

    renderWidgets();

    await user.click(await screen.findByRole("button", { name: "Add widget" }));
    await user.type(screen.getByLabelText(/Title/i), "Newest widget");
    await user.selectOptions(
      screen.getByLabelText(/Criteria field/i),
      "own_home",
    );
    await user.selectOptions(screen.getByLabelText(/Chart type/i), "donut");

    const orderInput = screen.getByLabelText("Order") as HTMLInputElement;
    fireEvent.change(orderInput, { target: { value: "1" } });

    await user.click(screen.getByRole("button", { name: "Save widget" }));

    await waitFor(() => {
      expect(createCampaignDashboardWidget).toHaveBeenCalledTimes(1);
    });

    const [, payload] = vi.mocked(createCampaignDashboardWidget).mock.calls[0];
    expect(payload.order).toBe(3);
  });

  it("renders add widget button below the widget list", async () => {
    vi.mocked(listCampaignDashboardWidgets).mockResolvedValue({
      data: {
        items: [
          {
            id: "w-1",
            campaign_id: "CM-1",
            title: "Existing 1",
            criteria_field_name: "own_home",
            chart_type: "pie",
            accent: "#2563eb",
            label_colors: {},
            size: "md",
            order: 1,
            scope: null,
          },
          {
            id: "w-2",
            campaign_id: "CM-1",
            title: "Existing 2",
            criteria_field_name: "own_home",
            chart_type: "bar",
            accent: "#16a34a",
            label_colors: {},
            size: "md",
            order: 2,
            scope: null,
          },
        ],
      },
    });

    renderWidgets();

    const lastWidgetTitle = await screen.findByText("Existing 2");
    const addButton = screen.getByRole("button", { name: "Add widget" });
    expect(
      lastWidgetTitle.compareDocumentPosition(addButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("allows editing label select values and colors in edit mode", async () => {
    const existingWidget: CampaignDashboardWidget = {
      id: "w-1",
      campaign_id: "CM-1",
      title: "Own Home Split",
      criteria_field_name: "own_home",
      chart_type: "donut",
      accent: "#2563eb",
      label_colors: {
        Yes: "#ff0000",
        No: "#00ff00",
      },
      size: "md",
      order: 1,
      scope: null,
    };

    vi.mocked(listCampaignDashboardWidgets).mockResolvedValue({
      data: { items: [existingWidget] },
    });

    const user = userEvent.setup();
    renderWidgets();

    await user.click(
      await screen.findByLabelText("Actions for Own Home Split"),
    );
    await user.click(screen.getByRole("button", { name: "Edit widget" }));

    const yesSelect = screen.getByDisplayValue("Yes") as HTMLSelectElement;
    await user.selectOptions(yesSelect, "No");
    expect(yesSelect).toHaveValue("No");

    const colorInput = screen.getByDisplayValue("#ff0000") as HTMLInputElement;
    fireEvent.change(colorInput, { target: { value: "#123456" } });
    expect(colorInput).toHaveValue("#123456");
  });

  it("renders only a single gear actions control instead of separate edit/delete icon buttons", async () => {
    vi.mocked(listCampaignDashboardWidgets).mockResolvedValue({
      data: {
        items: [
          {
            id: "w-1",
            campaign_id: "CM-1",
            title: "Existing 1",
            criteria_field_name: "own_home",
            chart_type: "pie",
            accent: "#2563eb",
            label_colors: {},
            size: "md",
            order: 1,
            scope: null,
          },
        ],
      },
    });

    renderWidgets();

    await screen.findByLabelText("Actions for Existing 1");

    expect(
      screen.getByRole("button", { name: "Actions for Existing 1" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Edit Existing 1")).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Delete Existing 1"),
    ).not.toBeInTheDocument();
  });

  it("allows deleting a widget from the gear actions modal", async () => {
    vi.mocked(listCampaignDashboardWidgets).mockResolvedValue({
      data: {
        items: [
          {
            id: "w-1",
            campaign_id: "CM-1",
            title: "Existing 1",
            criteria_field_name: "own_home",
            chart_type: "pie",
            accent: "#2563eb",
            label_colors: {},
            size: "md",
            order: 1,
            scope: null,
          },
        ],
      },
    });

    const user = userEvent.setup();
    renderWidgets();

    await user.click(await screen.findByLabelText("Actions for Existing 1"));
    await user.click(screen.getByRole("button", { name: "Delete widget" }));

    await waitFor(() => {
      expect(deleteCampaignDashboardWidget).toHaveBeenCalledWith("CM-1", "w-1");
    });
  });

  it("uses preset/custom accent controls without showing an accent hex text field", async () => {
    vi.mocked(listCampaignDashboardWidgets).mockResolvedValue({
      data: { items: [] },
    });

    const user = userEvent.setup();
    renderWidgets();

    await user.click(await screen.findByRole("button", { name: "Add widget" }));

    expect(screen.queryByLabelText("Accent hex value")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Accent #ef4444" }));
    expect(
      screen.getByRole("button", { name: "Accent #ef4444" }),
    ).toHaveAttribute("aria-pressed", "true");

    expect(screen.getByLabelText("Custom accent color")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Title/i), "Accent Preset Widget");
    await user.selectOptions(
      screen.getByLabelText(/Criteria field/i),
      "own_home",
    );
    await user.selectOptions(screen.getByLabelText(/Chart type/i), "pie");
    await user.click(screen.getByRole("button", { name: "Save widget" }));

    await waitFor(() => {
      expect(createCampaignDashboardWidget).toHaveBeenCalledTimes(1);
    });

    const [, payload] = vi.mocked(createCampaignDashboardWidget).mock.calls[0];
    expect(payload.accent).toBe("#ef4444");
  });

  it("shows red required markers for title, criteria field, and chart type", async () => {
    vi.mocked(listCampaignDashboardWidgets).mockResolvedValue({
      data: { items: [] },
    });

    const user = userEvent.setup();
    renderWidgets();

    await user.click(await screen.findByRole("button", { name: "Add widget" }));

    const titleLabel = screen.getByText("Title").closest("label");
    const criteriaLabel = screen.getByText("Criteria field").closest("label");
    const chartTypeLabel = screen.getByText("Chart type").closest("label");

    expect(titleLabel).not.toBeNull();
    expect(criteriaLabel).not.toBeNull();
    expect(chartTypeLabel).not.toBeNull();

    expect(
      within(titleLabel as HTMLElement).getByText("*"),
    ).toBeInTheDocument();
    expect(
      within(criteriaLabel as HTMLElement).getByText("*"),
    ).toBeInTheDocument();
    expect(
      within(chartTypeLabel as HTMLElement).getByText("*"),
    ).toBeInTheDocument();
  });

  it("hides add label color for criteria fields with options and keeps it for free-text fields", async () => {
    vi.mocked(listCampaignDashboardWidgets).mockResolvedValue({
      data: { items: [] },
    });

    const user = userEvent.setup();
    renderWidgets();

    await user.click(await screen.findByRole("button", { name: "Add widget" }));

    await user.selectOptions(
      screen.getByLabelText(/Criteria field/i),
      "own_home",
    );
    expect(
      screen.queryByRole("button", { name: "Add label color" }),
    ).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/Criteria field/i), "notes");
    expect(
      screen.getByRole("button", { name: "Add label color" }),
    ).toBeInTheDocument();
  });

  it("hides response label color controls when chart type is line", async () => {
    vi.mocked(listCampaignDashboardWidgets).mockResolvedValue({
      data: { items: [] },
    });

    const user = userEvent.setup();
    renderWidgets();

    await user.click(await screen.findByRole("button", { name: "Add widget" }));
    await user.selectOptions(
      screen.getByLabelText(/Criteria field/i),
      "own_home",
    );
    await user.selectOptions(screen.getByLabelText(/Chart type/i), "line");

    expect(screen.queryByText("Response label colors")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add label color" }),
    ).not.toBeInTheDocument();
  });

  it("hides response label color controls when chart type is table", async () => {
    vi.mocked(listCampaignDashboardWidgets).mockResolvedValue({
      data: { items: [] },
    });

    const user = userEvent.setup();
    renderWidgets();

    await user.click(await screen.findByRole("button", { name: "Add widget" }));
    await user.selectOptions(
      screen.getByLabelText(/Criteria field/i),
      "own_home",
    );
    await user.selectOptions(screen.getByLabelText(/Chart type/i), "table");

    expect(screen.queryByText("Response label colors")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add label color" }),
    ).not.toBeInTheDocument();
  });

  it("does not render the empty-state custom widgets message panel", async () => {
    vi.mocked(listCampaignDashboardWidgets).mockResolvedValue({
      data: { items: [] },
    });

    renderWidgets();

    await screen.findByRole("button", { name: "Add widget" });
    expect(
      screen.queryByText("No custom widgets saved for this campaign yet."),
    ).not.toBeInTheDocument();
  });

  it("renders table widgets with percentage column and totals row", async () => {
    vi.mocked(listCampaignDashboardWidgets).mockResolvedValue({
      data: {
        items: [
          {
            id: "w-table-1",
            campaign_id: "CM-1",
            title: "Own Home Table",
            criteria_field_name: "own_home",
            chart_type: "table",
            accent: "#2563eb",
            label_colors: {},
            size: "md",
            order: 1,
            scope: null,
          },
        ],
      },
    });
    vi.mocked(queryCampaignDashboardWidget).mockResolvedValue({
      data: {
        rows: [
          { label: "Yes", value: 6 },
          { label: "No", value: 4 },
        ],
      },
    });

    renderWidgets();

    expect(await screen.findByText("Own Home Table")).toBeInTheDocument();
    expect(
      await screen.findByRole("columnheader", { name: "Value" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("columnheader", { name: "Leads" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("columnheader", { name: "Percentage" }),
    ).toBeInTheDocument();

    expect(screen.getByRole("cell", { name: "Yes" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "No" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "60%" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "40%" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Total" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "10" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "100%" })).toBeInTheDocument();
  });
});
