"use client";

import { useState } from "react";
import ReactPaginate from "react-paginate";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  totalItems: number;
  showingFrom: number;
  showingTo: number;
  itemLabel: string;
  pageSizeOptions?: number[];
}

export function PaginationControls({
  page,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  totalItems,
  showingFrom,
  showingTo,
  itemLabel,
  pageSizeOptions = [10, 25, 50, 100],
}: PaginationControlsProps) {
  const [jumpValue, setJumpValue] = useState("");

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[--color-border] bg-[--color-panel] px-3 py-2">
      <p className="text-xs text-[--color-text-muted]">
        Showing {showingFrom} to {showingTo} of {totalItems} {itemLabel}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {/* Page-size selector */}
        <label className="flex items-center gap-1.5 text-xs text-[--color-text-muted]">
          Show
          <select
            className="rounded-md border border-[--color-border] bg-[--color-panel] px-2 py-1 text-xs text-[--color-text]"
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
          pageCount={totalPages}
          // react-paginate is 0-indexed; our state is 1-indexed
          forcePage={page - 1}
          onPageChange={({ selected }) => onPageChange(selected + 1)}
          pageRangeDisplayed={3}
          marginPagesDisplayed={2}
          previousLabel={
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[--color-border] text-[--color-text-muted] transition hover:text-[--color-text] disabled:opacity-40">
              <ChevronLeft size={14} />
            </span>
          }
          nextLabel={
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[--color-border] text-[--color-text-muted] transition hover:text-[--color-text] disabled:opacity-40">
              <ChevronRight size={14} />
            </span>
          }
          breakLabel={
            <span className="inline-flex h-8 w-8 items-center justify-center text-xs text-[--color-text-muted]">
              …
            </span>
          }
          containerClassName="flex items-center gap-1"
          pageClassName="inline-flex"
          pageLinkClassName="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[--color-border] text-sm font-medium text-[--color-text-muted] transition hover:text-[--color-text]"
          activeClassName="!border-[--color-primary]"
          activeLinkClassName="!bg-[--color-primary] !text-white !border-[--color-primary]"
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
            className="w-16 rounded-md border border-[--color-border] bg-[--color-panel] px-2 py-1 text-xs text-[--color-text]"
          />
          <button
            type="button"
            onClick={() => {
              const next = Number(jumpValue);
              if (!next || Number.isNaN(next)) return;
              onPageChange(Math.max(1, Math.min(totalPages, next)));
              setJumpValue("");
            }}
            className="rounded-md border border-[--color-border] px-2 py-1 text-xs font-medium text-[--color-text-muted] transition hover:text-[--color-text]"
          >
            Go
          </button>
        </div>
      </div>
    </div>
  );
}
