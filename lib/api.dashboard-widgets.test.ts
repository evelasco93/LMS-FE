import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCampaignDashboardWidget,
  listCampaignDashboardWidgets,
  queryCampaignDashboardWidget,
} from "./api";

vi.mock("./auth", () => ({
  getIdToken: vi.fn(async () => "test-token"),
  refreshSession: vi.fn(async () => null),
  forceSignOut: vi.fn(),
}));

describe("dashboard widget API compatibility", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  it("sends layout alongside modern widget fields on the primary route", async () => {
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            id: "DW101",
            title: "State",
            criteria_field_name: "state",
            chart_type: "donut",
            color: "#16a34a",
            size: "md",
            order: 2,
            scope: null,
          },
        }),
        { status: 200 },
      ),
    );

    await createCampaignDashboardWidget("CM1", {
      title: "State",
      criteria_field_name: "state",
      chart_type: "donut",
      accent: "#16a34a",
      label_colors: {
        Yes: "#22c55e",
        No: "#ef4444",
      },
      size: "md",
      order: 2,
      scope: null,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const firstUrl = String(fetchMock.mock.calls[0][0]);
    expect(firstUrl).toContain("/campaigns/CM1/dashboard/widgets");

    const firstInit = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(firstInit.body));
    expect(body).toMatchObject({
      title: "State",
      criteria_field_name: "state",
      chart_type: "donut",
      color: "#16a34a",
      label_colors: {
        Yes: "#22c55e",
        No: "#ef4444",
      },
      value_colors: {
        Yes: "#22c55e",
        No: "#ef4444",
      },
      size: "md",
      order: 2,
      scope: null,
      layout: { size: "medium", order: 2 },
    });
    expect(body.accent).toBeUndefined();
  });

  it("falls back to legacy dashboard-widgets route and sends backend color payload", async () => {
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;

    fetchMock
      .mockResolvedValueOnce(new Response("Route not found", { status: 404 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              id: "DW100",
              title: "State",
              criteria_field_name: "state",
              chart_type: "donut",
              color: "#16a34a",
              layout: { size: "medium", order: 2 },
            },
          }),
          { status: 200 },
        ),
      );

    const result = await createCampaignDashboardWidget("CM1", {
      title: "State",
      criteria_field_name: "state",
      chart_type: "donut",
      accent: "#16a34a",
      size: "md",
      order: 2,
      scope: null,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstUrl = String(fetchMock.mock.calls[0][0]);
    const secondUrl = String(fetchMock.mock.calls[1][0]);
    expect(firstUrl).toContain("/campaigns/CM1/dashboard/widgets");
    expect(secondUrl).toContain("/campaigns/CM1/dashboard-widgets");

    const secondInit = fetchMock.mock.calls[1][1] as RequestInit;
    const body = JSON.parse(String(secondInit.body));
    expect(body).toMatchObject({
      title: "State",
      criteria_field_name: "state",
      chart_type: "donut",
      color: "#16a34a",
      layout: { size: "medium", order: 2 },
    });
    expect(body.accent).toBeUndefined();

    expect(result.data.accent).toBe("#16a34a");
    expect(result.data.size).toBe("md");
  });

  it("normalizes backend widget shape to frontend shape", async () => {
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            items: [
              {
                id: "DW200",
                title: "Zip",
                criteria_field_name: "zip_code",
                chart_type: "bar",
                color: "#2563eb",
                layout: { size: "small", order: 5 },
                affiliate_id: "AFF1",
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    const result = await listCampaignDashboardWidgets("CM9");
    expect(result.data.items).toHaveLength(1);
    expect(result.data.items[0]).toMatchObject({
      id: "DW200",
      campaign_id: "CM9",
      accent: "#2563eb",
      size: "sm",
      order: 5,
      scope: { affiliate_id: "AFF1" },
    });
  });

  it("normalizes backend raw array shape to frontend items list", async () => {
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          message: "Dashboard widgets retrieved",
          data: [
            {
              id: "DW201",
              title: "Device",
              criteria_field_name: "device_type",
              chart_type: "pie",
              color: "#0ea5e9",
              size: "md",
              order: 3,
              scope: { campaign_key: "SRC-1" },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await listCampaignDashboardWidgets("CM10");
    expect(result.data.items).toHaveLength(1);
    expect(result.data.items[0]).toMatchObject({
      id: "DW201",
      campaign_id: "CM10",
      accent: "#0ea5e9",
      size: "md",
      order: 3,
      scope: { campaign_key: "SRC-1" },
    });
  });

  it("normalizes label color maps from either label_colors or value_colors", async () => {
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            items: [
              {
                id: "DW250",
                title: "Opt In",
                criteria_field_name: "opt_in",
                chart_type: "pie",
                color: "#2563eb",
                size: "md",
                order: 1,
                value_colors: {
                  Yes: "#10b981",
                  No: "#ef4444",
                },
              },
              {
                id: "DW251",
                title: "Consent",
                criteria_field_name: "consent",
                chart_type: "pie",
                color: "#2563eb",
                size: "md",
                order: 2,
                label_colors: {
                  Accepted: "#22c55e",
                  Declined: "#f97316",
                },
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    const result = await listCampaignDashboardWidgets("CM11");
    expect(result.data.items[0].label_colors).toEqual({
      Yes: "#10b981",
      No: "#ef4444",
    });
    expect(result.data.items[1].label_colors).toEqual({
      Accepted: "#22c55e",
      Declined: "#f97316",
    });
  });

  it("normalizes widget query buckets payload into rows for rendering", async () => {
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            widget_id: "DW300",
            campaign_id: "CM1",
            criteria_field_name: "state",
            buckets: [
              { value: "CA", label: "California", counters: { received: 12 } },
              { value: "TX", label: "Texas", counters: { received: 7 } },
            ],
            totals: { received: 19 },
          },
        }),
        { status: 200 },
      ),
    );

    const result = await queryCampaignDashboardWidget(
      "CM1",
      { id: "DW300" },
      { from_date: "2026-06-01", to_date: "2026-06-04" },
    );

    expect(result.data.widget_id).toBe("DW300");
    expect(result.data.rows).toEqual([
      { label: "California", value: 12, bucket_start: undefined },
      { label: "Texas", value: 7, bucket_start: undefined },
    ]);
    expect(result.data.total).toBe(19);
    expect(result.data.totals?.received).toBe(19);
  });

  it("keeps widget query empty when buckets are empty", async () => {
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            widget_id: "DW301",
            buckets: [],
            totals: { received: 0 },
          },
        }),
        { status: 200 },
      ),
    );

    const result = await queryCampaignDashboardWidget(
      "CM1",
      { id: "DW301" },
      { from_date: "2026-06-01", to_date: "2026-06-04" },
    );

    expect(result.data.rows).toEqual([]);
    expect(result.data.total).toBe(0);
  });
});
