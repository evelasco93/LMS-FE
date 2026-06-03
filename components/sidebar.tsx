"use client";

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Building2,
  ChevronRight,
  LayoutDashboard,
  Megaphone,
  ShieldCheck,
  Target,
  Users,
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
  | "admin";

const items: Array<{ key: NavKey; label: string; icon: React.ReactNode }> = [
  { key: "home", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
  { key: "leads", label: "Leads", icon: <Target size={18} /> },
  { key: "clients", label: "End Users", icon: <Building2 size={18} /> },
  { key: "affiliates", label: "Sources", icon: <Users size={18} /> },
  { key: "campaigns", label: "Campaigns", icon: <Megaphone size={18} /> },
  { key: "tools", label: "Tools", icon: <Wrench size={18} /> },
  { key: "admin", label: "Admin", icon: <ShieldCheck size={18} /> },
];

interface SidebarProps {
  active: NavKey;
  onChange: (key: NavKey) => void;
  /** Called when the logo is clicked — typically navigates to home */
  onLogoClick?: () => void;
  /** If provided, the Settings nav item is hidden unless role === "admin" */
  role?: string;
  /** When true, force the sidebar to be expanded (e.g. during a guided tour) */
  forceExpanded?: boolean;
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

const logoTransition = { duration: 0.3, ease: "easeOut" as const };
const LOGO_SLOT_HEIGHT = 132;
const EXPANDED_LOGO_SIZE = 220;
const COLLAPSED_LOGO_SIZE = 960;
const COLLAPSED_LOGO_SCALE = 1.6;

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

export function Sidebar({
  active,
  onChange,
  onLogoClick,
  role,
  forceExpanded,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(true);
  const isCollapsed = forceExpanded ? false : collapsed;

  const visibleItems = items.filter(
    (item) => item.key !== "admin" || role === "admin",
  );

  return (
    /* Outer wrapper is relative so the toggle tab can sit on the sidebar edge */
    <div className="relative h-full shrink-0">
      {/* Toggle tab — rectangular tab flush against the right edge of the sidebar */}
      <button
        type="button"
        aria-label={isCollapsed ? "Expand navigation" : "Collapse navigation"}
        onClick={() => setCollapsed((v) => !v)}
        className="absolute z-20 flex w-4 items-center justify-center rounded-r-md bg-[--color-nav-bg] text-[--color-nav-text] hover:bg-[color-mix(in_srgb,var(--color-nav-accent)_18%,var(--color-nav-bg))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--color-nav-accent)_35%,transparent)]"
        style={{ right: -16, top: 14, height: 36 }}
      >
        <motion.span
          animate={{ rotate: isCollapsed ? 0 : 180 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          style={{ display: "flex" }}
        >
          <ChevronRight size={11} />
        </motion.span>
      </button>

      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? COLLAPSED_W : EXPANDED_W }}
        transition={widthSpring}
        className="flex h-full flex-col overflow-hidden border-r py-4 bg-[--color-nav-bg] text-[--color-nav-text] border-[--color-nav-border] shadow-[var(--shadow-soft)]"
        data-tour="sidebar"
      >
        {/* Logo mark only to reduce shell clutter */}
        <button
          type="button"
          onClick={onLogoClick}
          className="relative mb-6 flex w-full cursor-pointer items-center justify-center overflow-visible focus-visible:outline-none"
          style={{ height: LOGO_SLOT_HEIGHT }}
          aria-label="Go to home"
        >
          <AnimatePresence initial={false} mode="wait">
            {isCollapsed ? (
              <motion.span
                key="logo-collapsed"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={logoTransition}
                className="absolute inset-0 flex items-center justify-center"
              >
                <motion.span
                  initial={false}
                  animate={{ scale: COLLAPSED_LOGO_SCALE }}
                  transition={logoTransition}
                  style={{ display: "inline-flex" }}
                >
                  <MountainMark
                    size={COLLAPSED_LOGO_SIZE}
                    variant="mark"
                    alt="Summit Edge mark"
                  />
                </motion.span>
              </motion.span>
            ) : (
              <motion.span
                key="logo-expanded"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={logoTransition}
                className="absolute inset-0 flex items-center justify-center"
              >
                <MountainMark
                  size={EXPANDED_LOGO_SIZE}
                  variant="default"
                  alt="Summit Edge Legal"
                />
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* Nav items */}
        <nav className="space-y-1 px-2">
          {visibleItems.map((item) => (
            <motion.button
              key={item.key}
              data-tour={`nav-${item.key}`}
              onClick={() => onChange(item.key)}
              animate={{
                paddingLeft: isCollapsed ? NAV_PL_COLLAPSED : NAV_PL_EXPANDED,
              }}
              transition={widthSpring}
              className={clsx(
                "group flex h-10 w-full items-center rounded-[--radius-sm] text-sm font-medium transition-colors",
                active === item.key
                  ? "bg-[color-mix(in_srgb,var(--color-nav-active)_28%,var(--color-nav-bg))] text-[--color-nav-text] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-nav-active)_58%,transparent)]"
                  : "text-[--color-nav-text] hover:bg-[color-mix(in_srgb,var(--color-nav-active)_18%,transparent)]",
              )}
            >
              <span
                className={clsx(
                  "h-2 shrink-0 rounded-full transition-all",
                  isCollapsed ? "mr-0 w-0 opacity-0" : "mr-2 w-2",
                  active === item.key
                    ? "opacity-100 bg-[--color-nav-active]"
                    : "opacity-0 group-hover:opacity-60 bg-[--color-nav-active]",
                )}
              />
              <span className="flex shrink-0 items-center justify-center">
                {item.icon}
              </span>
              <AnimatePresence initial={false}>
                {!isCollapsed && (
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
            {!isCollapsed && (
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
