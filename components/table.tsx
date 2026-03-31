import type React from "react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Fingerprint,
  Hash,
  ListChecks,
  Mail,
  Megaphone,
  Phone,
  ShieldCheck,
  User,
  Users,
  Wrench,
} from "lucide-react";

export interface Column<T> {
  key: keyof T | string;
  label: React.ReactNode;
  render?: (row: T) => React.ReactNode;
  width?: string;
}

function getHeaderIcon(label: string, key: string): React.ReactNode | null {
  const normalized = `${label} ${key}`.toLowerCase();
  if (normalized.includes("id")) return <Hash size={12} />;
  if (normalized.includes("date") || normalized.includes("created"))
    return <CalendarDays size={12} />;
  if (normalized.includes("time") || normalized.includes("updated"))
    return <Clock3 size={12} />;
  if (normalized.includes("name") || normalized.includes("user"))
    return <User size={12} />;
  if (normalized.includes("email")) return <Mail size={12} />;
  if (normalized.includes("phone")) return <Phone size={12} />;
  if (normalized.includes("campaign")) return <Megaphone size={12} />;
  if (normalized.includes("affiliate")) return <Users size={12} />;
  if (normalized.includes("status") || normalized.includes("mode"))
    return <BadgeCheck size={12} />;
  if (normalized.includes("duplicate")) return <CheckCircle2 size={12} />;
  if (normalized.includes("trusted") || normalized.includes("ipqs"))
    return <ShieldCheck size={12} />;
  if (normalized.includes("role") || normalized.includes("type"))
    return <ListChecks size={12} />;
  if (normalized.includes("provider") || normalized.includes("actions"))
    return <Wrench size={12} />;
  if (normalized.includes("details")) return <Fingerprint size={12} />;
  return null;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyLabel?: string;
  onRowClick?: (row: T) => void;
  rowKey?: (row: T, idx: number) => string | number;
  rowAnimation?: "stagger" | "subtle";
}

export function Table<T extends Record<string, any>>({
  columns,
  data,
  emptyLabel = "No data",
  onRowClick,
  rowKey,
  rowAnimation = "stagger",
}: TableProps<T>) {
  return (
    <div className="panel overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-[--color-bg-muted] text-left text-xs uppercase tracking-wide text-[--color-text-muted]">
          <tr>
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className="border-b border-[--color-border] px-4 py-3 font-semibold"
                style={{ width: col.width }}
              >
                {typeof col.label === "string" ? (
                  <span className="inline-flex items-center gap-1.5">
                    {getHeaderIcon(col.label, String(col.key))}
                    {col.label}
                  </span>
                ) : (
                  col.label
                )}
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
                  duration: rowAnimation === "subtle" ? 0.1 : 0.16,
                  delay: rowAnimation === "subtle" ? 0 : idx * 0.018,
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
                    className="whitespace-nowrap px-4 py-3 text-[--color-text]"
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
