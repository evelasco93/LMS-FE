import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PaginationControls } from "@/components/pagination-controls";

describe("PaginationControls", () => {
  it("renders exact totals without lower-bound wording", () => {
    render(
      <PaginationControls
        page={2}
        totalPages={5}
        onPageChange={vi.fn()}
        pageSize={25}
        onPageSizeChange={vi.fn()}
        totalItems={123}
        showingFrom={26}
        showingTo={50}
        itemLabel="leads"
      />,
    );

    expect(
      screen.getByText("Showing 26 to 50 of 123 leads"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/at least/i)).not.toBeInTheDocument();
  });

  it("navigates to selected page", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();

    render(
      <PaginationControls
        page={1}
        totalPages={4}
        onPageChange={onPageChange}
        pageSize={25}
        onPageSizeChange={vi.fn()}
        totalItems={100}
        showingFrom={1}
        showingTo={25}
        itemLabel="intake logs"
      />,
    );

    await user.click(screen.getByText("3"));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});
