"use client";

import type React from "react";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  Building2,
  ChevronRight,
  FileSpreadsheet,
  Home,
  Users2,
  Settings2,
  Wrench,
} from "lucide-react";
import clsx from "clsx";
import { MountainMark } from "./logo";

export type NavKey =
  | "home"
  | "leads"
  | "clients"
  | "affiliates"
  | "campaigns"
  | "tools"
  | "settings";

const items: Array<{ key: NavKey; label: string; icon: React.ReactNode }> = [
  { key: "home", label: "Home", icon: <Home size={18} /> },
  { key: "leads", label: "Leads", icon: <FileSpreadsheet size={18} /> },
  { key: "clients", label: "Clients", icon: <Users2 size={18} /> },
  { key: "affiliates", label: "Affiliates", icon: <Building2 size={18} /> },
  { key: "campaigns", label: "Campaigns", icon: <BarChart3 size={18} /> },
  { key: "tools", label: "Tools", icon: <Wrench size={18} /> },
  { key: "settings", label: "Settings", icon: <Settings2 size={18} /> },
];

interface SidebarProps {
  active: NavKey;
  onChange: (key: NavKey) => void;
  /** Called when the logo is clicked — typically navigates to home */
  onLogoClick?: () => void;
  /** If provided, the Settings nav item is hidden unless role === "admin" */
  role?: string;
}

const EXPANDED_W = 240;
const COLLAPSED_W = 64;

/** Spring used for the sidebar width, chevron flip, and icon position */
const widthSpring = { type: "spring" as const, stiffness: 300, damping: 30 };

/** Fast ease for text fade / slide */
const textTransition = { duration: 0.14, ease: "easeInOut" as const };

/**
 * paddingLeft for nav buttons (nav has px-2 so each button is COLLAPSED_W-16 wide).
 * Collapsed: center the 18px icon in (64-16)=48px → (48-18)/2 = 15px
 * Expanded:  match px-3 = 12px
 */
const NAV_PL_COLLAPSED = 15;
const NAV_PL_EXPANDED = 12;

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

export function Sidebar({ active, onChange, onLogoClick, role }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(true);
  const visibleItems = items.filter(
    (item) => item.key !== "settings" || role === "admin",
  );

  return (
    /* Outer wrapper is relative so the toggle tab can sit on the sidebar edge */
    <div className="relative h-full shrink-0">
      {/* Toggle tab — rectangular tab flush against the right edge of the sidebar */}
      <button
        type="button"
        aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        onClick={() => setCollapsed((v) => !v)}
        className="absolute z-20 flex w-4 items-center justify-center rounded-r-md border border-l-0 border-[--color-nav-border] bg-[--color-nav-bg] shadow-sm text-[--color-nav-text] hover:bg-[color-mix(in_srgb,var(--color-nav-accent)_20%,var(--color-nav-bg))] transition-colors"
        style={{ right: -16, top: 14, height: 36 }}
      >
        <motion.span
          animate={{ rotate: collapsed ? 0 : 180 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          style={{ display: "flex" }}
        >
          <ChevronRight size={11} />
        </motion.span>
      </button>

      <motion.aside
        initial={false}
        animate={{ width: collapsed ? COLLAPSED_W : EXPANDED_W }}
        transition={widthSpring}
        className="flex h-full flex-col overflow-hidden border-r py-4 bg-[--color-nav-bg] text-[--color-nav-text] border-[--color-nav-border] shadow-xl"
      >
        {/* Logo — mark always centered in a fixed 64px zone, text slides in */}
        <button
          type="button"
          onClick={onLogoClick}
          className="mb-6 flex h-10 w-full items-center cursor-pointer focus-visible:outline-none"
          aria-label="Go to home"
        >
          <span className="flex w-16 shrink-0 items-center justify-center">
            <MountainMark size={48} />
          </span>
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
        </button>

        {/* Nav items */}
        <nav className="space-y-1 px-2">
          {visibleItems.map((item) => (
            <motion.button
              key={item.key}
              onClick={() => onChange(item.key)}
              animate={{
                paddingLeft: collapsed ? NAV_PL_COLLAPSED : NAV_PL_EXPANDED,
              }}
              transition={widthSpring}
              className={clsx(
                "flex h-10 w-full items-center rounded-lg text-sm font-medium transition-colors",
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
            </motion.button>
          ))}
        </nav>

        {/* Footer: copyright */}
        <div className="mt-auto overflow-hidden">
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.p
                key="e"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                exit={{ opacity: 0, transition: { duration: 0.08 } }}
                transition={{ duration: 0.15, delay: 0.22 }}
                className="pb-2 text-center text-[10px] whitespace-nowrap text-[--color-text-muted]"
              >
                &copy; 2026 Summit Edge Legal
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </motion.aside>
    </div>
  );
}
