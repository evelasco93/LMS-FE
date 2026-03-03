"use client";

import type React from "react";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  Building2,
  ChevronRight,
  FileSpreadsheet,
  Users2,
  Settings2,
} from "lucide-react";
import clsx from "clsx";
import { MountainMark } from "./logo";

export type NavKey =
  | "leads"
  | "clients"
  | "affiliates"
  | "campaigns"
  | "settings";

const items: Array<{ key: NavKey; label: string; icon: React.ReactNode }> = [
  { key: "leads", label: "Leads", icon: <FileSpreadsheet size={18} /> },
  { key: "clients", label: "Clients", icon: <Users2 size={18} /> },
  { key: "affiliates", label: "Affiliates", icon: <Building2 size={18} /> },
  { key: "campaigns", label: "Campaigns", icon: <BarChart3 size={18} /> },
  { key: "settings", label: "Settings", icon: <Settings2 size={18} /> },
];

interface SidebarProps {
  active: NavKey;
  onChange: (key: NavKey) => void;
  /** If provided, the Settings nav item is hidden unless role === "admin" */
  role?: string;
}

const EXPANDED_W = 240;
const COLLAPSED_W = 64;

/** Spring used for the sidebar width and the toggle chevron flip */
const widthSpring = { type: "spring" as const, stiffness: 300, damping: 30 };

/** Fast ease for text fade / slide */
const textTransition = { duration: 0.14, ease: "easeInOut" as const };

/**
 * Text that slides in from the left when entering and back left when exiting.
 * Using AnimatePresence lets the exit animation finish before React removes the node,
 * which eliminates the "pop" when collapsing.
 */
function SlideText({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.span
      initial={{ opacity: 0, width: 0 }}
      animate={{ opacity: 1, width: "auto" }}
      exit={{ opacity: 0, width: 0 }}
      transition={textTransition}
      className={clsx("overflow-hidden whitespace-nowrap", className)}
      style={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}
    >
      {children}
    </motion.span>
  );
}

export function Sidebar({ active, onChange, role }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(true);
  const visibleItems = items.filter(
    (item) => item.key !== "settings" || role === "admin",
  );

  return (
    /* Outer wrapper is relative so the toggle button can overflow the aside without being clipped */
    <div className="relative h-full shrink-0">
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? COLLAPSED_W : EXPANDED_W }}
        transition={widthSpring}
        className="flex h-full flex-col overflow-hidden border-r py-4 bg-[--color-nav-bg] text-[--color-nav-text] border-[--color-nav-border] shadow-xl"
      >
        {/* Logo — mark stays fixed, text slides in/out */}
        <div className="mb-6 flex h-10 items-center px-3">
          <div className="shrink-0">
            <MountainMark size={36} />
          </div>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                key="logo-text"
                initial={{ opacity: 0, x: -10, width: 0 }}
                animate={{ opacity: 1, x: 0, width: "auto" }}
                exit={{ opacity: 0, x: -10, width: 0 }}
                transition={textTransition}
                className="ml-2 overflow-hidden whitespace-nowrap"
              >
                <span className="block text-[9px] font-bold leading-snug tracking-[0.18em] text-[--color-nav-text]">
                  SUMMIT EDGE
                </span>
                <span className="block text-[9px] font-bold leading-snug tracking-[0.18em] text-[--color-nav-text]">
                  LEGAL
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Nav items */}
        <nav className="space-y-1 px-2">
          {visibleItems.map((item) => (
            <button
              key={item.key}
              onClick={() => onChange(item.key)}
              className={clsx(
                "flex h-10 w-full items-center rounded-lg px-3 text-sm font-medium transition-colors",
                active === item.key
                  ? "bg-[color-mix(in_srgb,var(--color-nav-accent)_35%,transparent)] text-[--color-nav-text]"
                  : "text-[--color-nav-text] hover:bg-[color-mix(in_srgb,var(--color-nav-accent)_15%,transparent)]",
              )}
            >
              <span className="flex shrink-0 items-center justify-center">
                {item.icon}
              </span>
              <AnimatePresence initial={false}>
                {!collapsed && (
                  <SlideText key="lbl">
                    <span className="ml-3">{item.label}</span>
                  </SlideText>
                )}
              </AnimatePresence>
            </button>
          ))}
        </nav>

        {/* Footer copyright — only shown when expanded */}
        <div className="mt-auto px-3">
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.p
                key="e"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="text-center text-[10px] text-[--color-text-muted]"
              >
                &copy; 2026 Summit Edge Legal
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </motion.aside>

      {/* Toggle — lives outside the aside so overflow:hidden never clips it */}
      <button
        type="button"
        aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        onClick={() => setCollapsed((v) => !v)}
        className="absolute -right-3 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-[--color-nav-border] bg-[--color-nav-bg] text-[--color-nav-text] shadow transition hover:bg-[color-mix(in_srgb,var(--color-nav-accent)_20%,var(--color-nav-bg))]"
      >
        <motion.span
          animate={{ rotate: collapsed ? 0 : 180 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          style={{ display: "flex" }}
        >
          <ChevronRight size={13} />
        </motion.span>
      </button>
    </div>
  );
}
