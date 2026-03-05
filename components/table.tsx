import type React from "react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";

export interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (row: T) => React.ReactNode;
  width?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyLabel?: string;
  onRowClick?: (row: T) => void;
  rowKey?: (row: T, idx: number) => string | number;
}

export function Table<T extends Record<string, any>>({
  columns,
  data,
  emptyLabel = "No data",
  onRowClick,
  rowKey,
}: TableProps<T>) {
  return (
    <div className="panel overflow-hidden">
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-[--color-bg-muted] text-left text-xs uppercase tracking-wide text-[--color-text-muted]">
          <tr>
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className="border-b border-[--color-border] px-4 py-3 font-semibold"
                style={{ width: col.width }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-6 text-center text-[--color-text-muted]"
              >
                {emptyLabel}
              </td>
            </tr>
          )}
          <AnimatePresence initial={false}>
            {data.map((row, idx) => (
              <motion.tr
                key={rowKey ? rowKey(row, idx) : (row.id ?? idx)}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{
                  duration: 0.16,
                  delay: idx * 0.018,
                  ease: "easeOut",
                }}
                className={clsx(
                  "border-b border-[--color-border] transition-colors",
                  onRowClick
                    ? "cursor-pointer hover:bg-[--color-row-hover]"
                    : "",
                  idx % 2 === 0
                    ? "bg-transparent"
                    : "bg-[color-mix(in_srgb,var(--color-border)_8%,transparent)]",
                )}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td
                    key={String(col.key)}
                    className="px-4 py-3 text-[--color-text]"
                  >
                    {col.render
                      ? col.render(row)
                      : ((row as any)[col.key] ?? "—")}
                  </td>
                ))}
              </motion.tr>
            ))}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  );
}
