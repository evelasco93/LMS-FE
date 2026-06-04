"use client";

import React, { useState } from "react";
import ReactPaginate from "react-paginate";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  totalItems: number;
  totalItemsExact?: boolean;
  showingFrom: number;
  showingTo: number;
  itemLabel: string;
  pageSizeOptions?: number[];
  leftActions?: React.ReactNode;
  allowNextPage?: boolean;
}

export function PaginationControls({
  page,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  totalItems,
  totalItemsExact = true,
  showingFrom,
  showingTo,
  itemLabel,
  pageSizeOptions = [10, 25, 50, 100],
  leftActions,
  allowNextPage = false,
}: PaginationControlsProps) {
  const [jumpValue, setJumpValue] = useState("");

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-[--radius-md] border border-[--color-border] bg-[color-mix(in_srgb,var(--color-panel)_90%,var(--color-bg-subtle))] px-3 py-1.5 shadow-[5px_8px_16px_color-mix(in_srgb,var(--color-primary)_7%,transparent)]">
      <p className="text-xs text-[--color-text-muted]">
        {totalItemsExact
          ? `Showing ${showingFrom} to ${showingTo} of ${totalItems} ${itemLabel}`
          : `Showing ${showingFrom} to ${showingTo} of at least ${totalItems} ${itemLabel}`}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {leftActions}
        {/* Page-size selector */}
        <label className="flex items-center gap-1.5 text-xs text-[--color-text-muted]">
          Show
          <select
            className="rounded-[--radius-sm] border border-[--color-border] bg-[--color-panel] px-2 py-0.5 text-xs text-[--color-text] outline-none transition focus:border-[--color-primary]"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        {/* react-paginate handles prev / numbered pages / ellipsis / next */}
        <ReactPaginate
          pageCount={Math.max(totalPages, allowNextPage ? page + 1 : page)}
          // react-paginate is 0-indexed; our state is 1-indexed
          forcePage={page - 1}
          onPageChange={({ selected }) => {
            const nextPage = selected + 1;
            const maxSelectable = Math.max(
              totalPages,
              allowNextPage ? page + 1 : page,
            );
            if (nextPage > maxSelectable) return;
            if (!allowNextPage && nextPage > totalPages) return;
            onPageChange(nextPage);
          }}
          pageRangeDisplayed={3}
          marginPagesDisplayed={2}
          previousLabel={
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-[--radius-sm] border border-[--color-border] bg-[--color-panel] text-[--color-text-muted] transition hover:border-[--color-border-alt] hover:text-[--color-text] disabled:opacity-40">
              <ChevronLeft size={14} />
            </span>
          }
          nextLabel={
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-[--radius-sm] border border-[--color-border] bg-[--color-panel] text-[--color-text-muted] transition hover:border-[--color-border-alt] hover:text-[--color-text] disabled:opacity-40">
              <ChevronRight size={14} />
            </span>
          }
          breakLabel={
            <span className="inline-flex h-7 w-7 items-center justify-center text-xs text-[--color-text-muted]">
              …
            </span>
          }
          containerClassName="flex items-center gap-1"
          pageClassName="inline-flex"
          pageLinkClassName="inline-flex h-7 w-7 items-center justify-center rounded-[--radius-sm] border border-[--color-border] bg-[--color-panel] text-xs font-medium text-[--color-text-muted] transition hover:border-[--color-border-alt] hover:text-[--color-text]"
          activeClassName="!border-[--color-primary]"
          activeLinkClassName="!bg-[color-mix(in_srgb,var(--color-primary)_18%,var(--color-panel))] !text-[--color-primary] !border-[--color-primary]"
          previousClassName="inline-flex"
          nextClassName="inline-flex"
          previousLinkClassName="flex"
          nextLinkClassName="flex"
          disabledClassName="opacity-40 pointer-events-none"
          breakClassName="inline-flex"
          renderOnZeroPageCount={null}
        />

        {/* Jump-to-page */}
        <div className="flex items-center gap-1.5">
          <input
            value={jumpValue}
            onChange={(e) =>
              setJumpValue(e.target.value.replace(/[^0-9]/g, ""))
            }
            placeholder="Page"
            className="w-16 rounded-[--radius-sm] border border-[--color-border] bg-[--color-panel] px-2 py-0.5 text-xs text-[--color-text] outline-none transition focus:border-[--color-primary]"
          />
          <button
            type="button"
            onClick={() => {
              const next = Number(jumpValue);
              if (!next || Number.isNaN(next)) return;
              const maxJump = Math.max(
                totalPages,
                allowNextPage ? page + 1 : page,
              );
              onPageChange(Math.max(1, Math.min(maxJump, next)));
              setJumpValue("");
            }}
            className="rounded-[--radius-sm] border border-[--color-border] bg-[--color-panel] px-2 py-0.5 text-xs font-medium text-[--color-text-muted] transition hover:border-[--color-border-alt] hover:text-[--color-text]"
          >
            Go
          </button>
        </div>
      </div>
    </div>
  );
}
