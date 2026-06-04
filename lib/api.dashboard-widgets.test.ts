import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCampaignDashboardWidget,
  listCampaignDashboardWidgets,
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
});
