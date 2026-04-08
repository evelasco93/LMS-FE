"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  ChevronRight,
  ChevronLeft,
  HelpCircle,
  Compass,
  Rocket,
  SkipForward,
  BookOpen,
} from "lucide-react";
import { createPortal } from "react-dom";

// ─── Tour step definition ──────────────────────────────────────────────────────

export interface TourStep {
  /** CSS selector for the element to spotlight (e.g. '[data-tour="sidebar"]') */
  target: string;
  /** Title shown in the tooltip */
  title: string;
  /** Description text */
  content: string;
  /** Which side of the target to show the tooltip */
  placement?: "top" | "bottom" | "left" | "right";
  /** Optional: navigate to a view before showing this step */
  beforeStep?: () => void | Promise<void>;
  /** If true, the tooltip is centered on screen with no spotlight */
  centered?: boolean;
  /** CSS selector for tooltip positioning when different from spotlight target */
  tooltipAnchor?: string;
  /** Extra delay in ms before showing the tooltip (e.g. for sidebar animation) */
  delay?: number;
  /** If true, hide Next button — step advances when user clicks the target element */
  waitForAction?: boolean;
  /** Label shown instead of "Next" when waitForAction is true (e.g. "Click 'New Client'") */
  actionLabel?: string;
  /** If true, hide Back button on this step */
  hideBack?: boolean;
  /** If true, overlay is non-blocking so user can interact with the page (e.g. fill a form) */
  freeInteract?: boolean;
}

// ─── Site Overview Tour ────────────────────────────────────────────────────────

export function getSiteOverviewTour(
  navigate: (view: string) => void,
  expandSidebar: (expanded: boolean) => void,
): TourStep[] {
  return [
    {
      target: "",
      title: "Welcome to the LMS",
      content:
        "This guided tour will walk you through every section of the Lead Management System. You can skip at any time.",
      centered: true,
      beforeStep: () => {
        navigate("home");
        expandSidebar(false);
      },
    },
    {
      target: '[data-tour="sidebar"]',
      title: "Navigation Sidebar",
      content:
        "This is your main navigation. Click any section to switch views. Hover or click the tab on the right edge to expand and see labels.",
      placement: "right",
      tooltipAnchor: '[data-tour="nav-home"]',
      delay: 400,
      beforeStep: () => expandSidebar(true),
    },
    {
      target: '[data-tour="nav-home"]',
      title: "Home",
      content:
        "The Home view will show dashboard metrics and key performance summaries.",
      placement: "right",
      beforeStep: () => navigate("home"),
    },
    {
      target: '[data-tour="nav-leads"]',
      title: "Leads",
      content:
        "Browse every lead across all campaigns. Filter by campaign, source, test/live mode, and status. Click a lead to see its full decision trace and delivery result.",
      placement: "right",
      beforeStep: () => navigate("leads"),
    },
    {
      target: '[data-tour="nav-clients"]',
      title: "Clients",
      content:
        "Clients are your lead buyers. Create, edit, and manage the companies that receive leads through delivery webhooks.",
      placement: "right",
      beforeStep: () => navigate("clients"),
    },
    {
      target: '[data-tour="nav-affiliates"]',
      title: "Sources",
      content:
        "Sources are your lead providers. Manage partners that submit leads. Each source gets a campaign key to send leads through.",
      placement: "right",
      beforeStep: () => navigate("affiliates"),
    },
    {
      target: '[data-tour="nav-campaigns"]',
      title: "Campaigns",
      content:
        "Campaigns tie everything together. Create campaigns, link clients and sources, set up fields, rules, and integrations. Search, filter, and sort from the toolbar.",
      placement: "right",
      beforeStep: () => navigate("campaigns"),
    },
    {
      target: '[data-tour="nav-tools"]',
      title: "Tools",
      content:
        "QA utilities for testing external integrations like TrustedForm and IPQS without creating real leads.",
      placement: "right",
      beforeStep: () => navigate("tools"),
    },
    {
      target: '[data-tour="nav-admin"]',
      title: "Admin",
      content:
        "Admin-only section for user management, API credentials, plugin settings, fields/rules catalogs, tags, and audit logs.",
      placement: "right",
      beforeStep: () => navigate("admin"),
    },
    {
      target: '[data-tour="header-actions"]',
      title: "Quick Actions",
      content:
        "Toggle dark/light theme and manage your account from here. The user badge shows your name and role.",
      placement: "bottom",
    },
    {
      target: '[data-tour="tour-help"]',
      title: "You're all set!",
      content:
        'That covers the interface. Ready to create your first campaign? Launch the "Campaign Creation" tour from this help menu anytime.',
      placement: "top",
    },
  ];
}

// ─── Campaign Creation Tour ────────────────────────────────────────────────────

export function getCampaignCreationTour(
  navigate: (view: string) => void,
  expandSidebar: (expanded: boolean) => void,
): TourStep[] {
  return [
    // 0 — Welcome
    {
      target: "",
      title: "Create Your First Campaign",
      content:
        "This interactive guide walks you through the full campaign setup. You'll create a client, a source, and a campaign — then wire everything together. Let's start!",
      centered: true,
      hideBack: true,
      beforeStep: () => {
        expandSidebar(true);
        navigate("clients");
      },
    },

    // 1 — Click "New Client"
    {
      target: '[data-tour="btn-new-client"]',
      title: "Step 1 — Create a Client",
      content:
        'Clients are your lead buyers. Click "New Client" to open the creation form.',
      placement: "bottom",
      waitForAction: true,
      actionLabel: "Click 'New Client'",
      hideBack: true,
      delay: 400,
      beforeStep: () => {
        expandSidebar(false);
        navigate("clients");
      },
    },

    // 2 — Fill in client form (free interact)
    {
      target: "",
      title: "Fill in Client Details",
      content:
        "Enter the client's name and email, then click Create. Click Next when you're done.",
      freeInteract: true,
    },

    // 3 — Click "New Affiliate"
    {
      target: '[data-tour="btn-new-affiliate"]',
      title: "Step 2 — Create a Source",
      content:
        'Sources submit leads into campaigns. Click "New Source" to create one.',
      placement: "bottom",
      waitForAction: true,
      actionLabel: "Click 'New Source'",
      hideBack: true,
      delay: 400,
      beforeStep: () => navigate("affiliates"),
    },

    // 4 — Fill in affiliate form (free interact)
    {
      target: "",
      title: "Fill in Source Details",
      content:
        "Enter the name, email, and phone, then click Create. Click Next when you're done.",
      freeInteract: true,
    },

    // 5 — Click "New Campaign"
    {
      target: '[data-tour="btn-new-campaign"]',
      title: "Step 3 — Create a Campaign",
      content:
        'Campaigns tie clients and sources together. Click "New Campaign" to create one.',
      placement: "bottom",
      waitForAction: true,
      actionLabel: "Click 'New Campaign'",
      hideBack: true,
      delay: 400,
      beforeStep: () => navigate("campaigns"),
    },

    // 6 — Fill in campaign form (free interact)
    {
      target: "",
      title: "Fill in Campaign Details",
      content:
        "Give it a name and optional tags, then click Create. It starts in DRAFT status. Click Next when you're done.",
      freeInteract: true,
    },

    // 7 — Click a campaign row
    {
      target: '[data-tour="campaign-row-first"]',
      title: "Step 4 — Open Your Campaign",
      content:
        "Click this campaign to open its detail window. All configuration happens inside.",
      placement: "top",
      waitForAction: true,
      actionLabel: "Click the campaign row",
      hideBack: true,
      delay: 300,
      beforeStep: () => navigate("campaigns"),
    },

    // 8 — Click Settings tab (must come before clients/affiliates)
    {
      target: '[data-tour="campaign-tab-settings"]',
      title: "Step 5 — Set Up Configuration",
      content:
        "First, set up fields and rules. Clients and sources require this to be configured first.",
      placement: "right",
      waitForAction: true,
      actionLabel: "Click 'Configuration' tab",
      hideBack: true,
      delay: 500,
    },

    // 9 — Explain settings (free interact)
    {
      target: "",
      title: "Fields & Rules",
      content:
        "Define what data leads must contain (fields) and conditional accept/reject rules. You can apply pre-built sets from catalogs. Click Next when you're done.",
      freeInteract: true,
    },

    // 10 — Click Clients tab
    {
      target: '[data-tour="campaign-tab-clients"]',
      title: "Step 6 — Link a Client",
      content:
        "Now that configuration is set, go to the Clients tab to connect a lead buyer.",
      placement: "right",
      waitForAction: true,
      actionLabel: "Click 'Clients' tab",
      hideBack: true,
      delay: 300,
    },

    // 11 — Click "Add Client"
    {
      target: '[data-tour="btn-add-client"]',
      title: "Add a Client",
      content:
        'Click "Add Client" to link one of your clients to this campaign.',
      placement: "bottom",
      waitForAction: true,
      actionLabel: "Click 'Add Client'",
      hideBack: true,
      delay: 300,
    },

    // 12 — Configure client delivery (free interact)
    {
      target: "",
      title: "Configure Client Delivery",
      content:
        "Select your client, set the delivery URL, headers, payload mapping, and acceptance rules. Click Next when you're done.",
      freeInteract: true,
    },

    // 13 — Click Affiliates tab
    {
      target: '[data-tour="campaign-tab-affiliates"]',
      title: "Step 7 — Link a Source",
      content: "Go to the Sources tab to add a lead source to this campaign.",
      placement: "right",
      waitForAction: true,
      actionLabel: "Click 'Sources' tab",
      hideBack: true,
      delay: 300,
    },

    // 14 — Click "Add Affiliate"
    {
      target: '[data-tour="btn-add-affiliate"]',
      title: "Add a Source",
      content:
        'Click "Add Source" to link one of your sources. They\'ll get a campaign key to submit leads.',
      placement: "bottom",
      waitForAction: true,
      actionLabel: "Click 'Add Source'",
      hideBack: true,
      delay: 300,
    },

    // 15 — Configure affiliate (free interact)
    {
      target: "",
      title: "Configure Source",
      content:
        "Select your source, configure lead caps and webhook settings if needed. Click Next when you're done.",
      freeInteract: true,
    },

    // 16 — Click Integrations tab
    {
      target: '[data-tour="campaign-tab-integrations"]',
      title: "Step 8 — Integrations",
      content: "Open the Integrations tab to enable third-party validations.",
      placement: "right",
      waitForAction: true,
      actionLabel: "Click 'Integrations' tab",
      hideBack: true,
      delay: 300,
    },

    // 17 — Explain integrations (free interact)
    {
      target: "",
      title: "Enable Integrations",
      content:
        "Turn on TrustedForm for consent validation and IPQS for fraud detection. Duplicate check is on by default. Click Next when you're done.",
      freeInteract: true,
    },

    // 18 — Done
    {
      target: "",
      title: "You're all set! 🎉",
      content:
        "Your campaign is configured! Change the status from DRAFT → TEST to try test leads, then promote to ACTIVE when you're ready to go live. You can revisit this tour anytime from the help button.",
      centered: true,
    },
  ];
}

// ─── Spotlight overlay ─────────────────────────────────────────────────────────

function SpotlightOverlay({
  rect,
  onClick,
  passthrough,
}: {
  rect: DOMRect | null;
  onClick: () => void;
  /** When true the overlay lets clicks pass through to the page */
  passthrough?: boolean;
}) {
  const pad = 8;
  const radius = 10;

  return (
    <motion.div
      className="fixed inset-0 z-[9998]"
      style={passthrough ? { pointerEvents: "none" } : undefined}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={passthrough ? undefined : onClick}
    >
      <svg className="absolute inset-0 h-full w-full">
        <defs>
          <mask id="tour-spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left - pad}
                y={rect.top - pad}
                width={rect.width + pad * 2}
                height={rect.height + pad * 2}
                rx={radius}
                ry={radius}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.55)"
          mask="url(#tour-spotlight-mask)"
        />
      </svg>
      {/* Bright ring around the highlighted element */}
      {rect && (
        <motion.div
          className="pointer-events-none absolute rounded-[10px] ring-2 ring-[--color-primary] ring-offset-2 ring-offset-transparent"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.2 }}
          style={{
            left: rect.left - pad,
            top: rect.top - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
          }}
        />
      )}
    </motion.div>
  );
}

// ─── Tooltip position calculator ───────────────────────────────────────────────

function getTooltipPosition(
  rect: DOMRect | null,
  placement: TourStep["placement"],
  tooltipWidth: number,
  tooltipHeight: number,
) {
  if (!rect) {
    return {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
    } as const;
  }

  const gap = 16;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top: number;
  let left: number;

  switch (placement) {
    case "right":
      top = rect.top + rect.height / 2 - tooltipHeight / 2;
      left = rect.right + gap;
      break;
    case "left":
      top = rect.top + rect.height / 2 - tooltipHeight / 2;
      left = rect.left - gap - tooltipWidth;
      break;
    case "top":
      top = rect.top - gap - tooltipHeight;
      left = rect.left + rect.width / 2 - tooltipWidth / 2;
      break;
    case "bottom":
    default:
      top = rect.bottom + gap;
      left = rect.left + rect.width / 2 - tooltipWidth / 2;
      break;
  }

  // Clamp to viewport
  top = Math.max(12, Math.min(vh - tooltipHeight - 12, top));
  left = Math.max(12, Math.min(vw - tooltipWidth - 12, left));

  return {
    top: `${top}px`,
    left: `${left}px`,
    transform: "none",
  } as const;
}

// ─── Tour tooltip ──────────────────────────────────────────────────────────────

function TourTooltip({
  step,
  stepIndex,
  totalSteps,
  targetRect,
  onNext,
  onPrev,
  onSkip,
}: {
  step: TourStep;
  stepIndex: number;
  totalSteps: number;
  targetRect: DOMRect | null;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: "-9999px", left: "-9999px" });
  const prevStepRef = useRef(stepIndex);

  // On step change: hide immediately
  if (prevStepRef.current !== stepIndex) {
    prevStepRef.current = stepIndex;
    if (visible) setVisible(false);
  }

  useEffect(() => {
    if (visible) return;
    const el = tooltipRef.current;
    if (!el) return;

    const compute = () => {
      // Force a reflow to get accurate measurements after content change
      const w = el.offsetWidth;
      const h = el.offsetHeight;

      // Pin freeInteract tooltips to bottom-right so they don't cover modals
      if (step.freeInteract) {
        setPos({
          top: `${window.innerHeight - h - 24}px`,
          left: `${window.innerWidth - w - 24}px`,
        });
        requestAnimationFrame(() => setVisible(true));
        return;
      }

      if (step.centered) {
        const main = document.querySelector("main");
        if (main) {
          const r = main.getBoundingClientRect();
          setPos({
            top: `${r.top + (r.height - h) / 2}px`,
            left: `${r.left + (r.width - w) / 2}px`,
          });
        } else {
          setPos({
            top: `${(window.innerHeight - h) / 2}px`,
            left: `${(window.innerWidth - w) / 2}px`,
          });
        }
        requestAnimationFrame(() => setVisible(true));
        return;
      }

      // For anchored steps, measure the anchor/target live instead of using stale targetRect
      const selector = step.tooltipAnchor || step.target;
      const anchor = selector ? document.querySelector(selector) : null;
      const posRect = anchor?.getBoundingClientRect() ?? targetRect;
      if (!posRect) return;

      const p = getTooltipPosition(posRect, step.placement, w, h);
      setPos({ top: p.top, left: p.left });
      requestAnimationFrame(() => setVisible(true));
    };

    // Give animations time to settle
    const delay = step.centered ? 80 : (step.delay ?? 80);
    const timer = setTimeout(compute, delay);
    return () => clearTimeout(timer);
  }, [visible, targetRect, step, stepIndex]);

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;

  return (
    <motion.div
      ref={tooltipRef}
      className="fixed z-[9999] w-[380px] max-w-[calc(100vw-32px)] rounded-xl border border-[--color-border] bg-[--color-panel] shadow-2xl"
      initial={false}
      animate={{
        opacity: visible ? 1 : 0,
      }}
      transition={{
        opacity: { duration: 0.3, ease: "easeOut" },
      }}
      style={{
        top: pos.top,
        left: pos.left,
        visibility: visible ? "visible" : "hidden",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-5">
        {/* Header */}
        <div className="mb-2 flex items-start justify-between">
          <h3 className="text-sm font-bold text-[--color-text-strong]">
            {step.title}
          </h3>
          <button
            type="button"
            className="ml-2 shrink-0 rounded-md p-0.5 text-[--color-text-muted] hover:text-[--color-text] transition-colors"
            onClick={onSkip}
            title="Close tour"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <p className="mb-4 text-[13px] leading-relaxed text-[--color-text-muted]">
          {step.content}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {!isLast && !step.waitForAction && (
              <button
                type="button"
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-[--color-text-muted] hover:text-[--color-text] transition-colors"
                onClick={onSkip}
              >
                <SkipForward size={13} />
                Skip
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isFirst && !step.hideBack && (
              <button
                type="button"
                className="flex items-center gap-1 rounded-lg border border-[--color-border] px-3 py-1.5 text-xs font-medium text-[--color-text] hover:bg-[--color-bg-muted] transition-colors"
                onClick={onPrev}
              >
                <ChevronLeft size={14} />
                Back
              </button>
            )}
            {step.waitForAction ? (
              <span className="flex items-center gap-1.5 rounded-lg bg-[--color-primary]/10 px-4 py-1.5 text-xs font-medium text-[--color-primary]">
                {step.actionLabel || "Waiting…"}
              </span>
            ) : (
              <button
                type="button"
                className="flex items-center gap-1 rounded-lg bg-[--color-primary] px-4 py-1.5 text-xs font-semibold text-white hover:brightness-110 transition-all"
                onClick={onNext}
              >
                {isLast ? (
                  "Finish"
                ) : isFirst ? (
                  <>
                    Let&apos;s Go
                    <ChevronRight size={14} />
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight size={14} />
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Step pills */}
        <div className="mt-4 flex items-center justify-center gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <motion.div
              key={i}
              className="rounded-full"
              animate={{
                width: i === stepIndex ? 20 : 8,
                height: 8,
                backgroundColor:
                  i === stepIndex
                    ? "var(--color-primary)"
                    : i < stepIndex
                      ? "var(--color-primary)"
                      : "var(--color-border)",
                opacity: i <= stepIndex ? 1 : 0.5,
              }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Tour runner hook ──────────────────────────────────────────────────────────

export function useTour() {
  const [activeTour, setActiveTour] = useState<TourStep[] | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const currentStep = activeTour?.[stepIndex] ?? null;

  // Find and track the target element position
  useEffect(() => {
    if (!currentStep || currentStep.centered || !currentStep.target) {
      setTargetRect(null);
      return;
    }

    const findElement = () => {
      const el = document.querySelector(currentStep.target);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      }
    };

    // Wait for animations (sidebar expand/collapse is ~300ms)
    const timer = setTimeout(findElement, 350);
    // Re-measure shortly after in case animation was still settling
    const timer2 = setTimeout(findElement, 500);

    // Re-measure on scroll/resize
    const handleReposition = () => {
      const el = document.querySelector(currentStep.target);
      if (el) setTargetRect(el.getBoundingClientRect());
    };
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [currentStep]);

  // Auto-advance when user clicks target on waitForAction steps
  const nextRef = useRef<(() => void) | null>(null);

  const startTour = useCallback((steps: TourStep[]) => {
    setStepIndex(0);
    setTargetRect(null);
    setActiveTour(steps);
    if (steps[0]?.beforeStep) {
      steps[0].beforeStep();
    }
  }, []);

  const endTour = useCallback(() => {
    setActiveTour(null);
    setStepIndex(0);
    setTargetRect(null);
  }, []);

  const next = useCallback(() => {
    if (!activeTour) return;
    if (stepIndex >= activeTour.length - 1) {
      endTour();
      return;
    }
    const nextIdx = stepIndex + 1;
    const nextStep = activeTour[nextIdx];
    if (nextStep?.beforeStep) {
      nextStep.beforeStep();
    }
    setStepIndex(nextIdx);
  }, [activeTour, stepIndex, endTour]);

  // Keep nextRef in sync so the click listener always calls the latest next()
  useEffect(() => {
    nextRef.current = next;
  }, [next]);

  useEffect(() => {
    if (!currentStep?.waitForAction || !currentStep.target) return;

    const handleClick = () => {
      // Small delay so the click's own handler fires first
      setTimeout(() => nextRef.current?.(), 150);
    };

    // Wait for element to appear
    const timer = setTimeout(() => {
      const el = document.querySelector(currentStep.target);
      if (el) {
        el.addEventListener("click", handleClick, { once: true });
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      const el = document.querySelector(currentStep.target);
      if (el) el.removeEventListener("click", handleClick);
    };
  }, [currentStep]);

  const prev = useCallback(() => {
    if (stepIndex <= 0) return;
    const prevIdx = stepIndex - 1;
    const prevStep = activeTour?.[prevIdx];
    if (prevStep?.beforeStep) {
      prevStep.beforeStep();
    }
    setStepIndex(prevIdx);
  }, [activeTour, stepIndex]);

  return {
    activeTour,
    currentStep,
    stepIndex,
    targetRect,
    startTour,
    endTour,
    next,
    prev,
    isActive: activeTour !== null,
  };
}

// ─── Tour overlay (portal) ─────────────────────────────────────────────────────

export function TourOverlay({
  currentStep,
  stepIndex,
  totalSteps,
  targetRect,
  onNext,
  onPrev,
  onSkip,
}: {
  currentStep: TourStep | null;
  stepIndex: number;
  totalSteps: number;
  targetRect: DOMRect | null;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || !currentStep) return null;

  return createPortal(
    <AnimatePresence mode="wait">
      {!currentStep.freeInteract && (
        <SpotlightOverlay
          key={`overlay-${stepIndex}`}
          rect={currentStep.centered ? null : targetRect}
          onClick={onSkip}
          passthrough={currentStep.waitForAction}
        />
      )}
      <TourTooltip
        key={`tooltip-${stepIndex}`}
        step={currentStep}
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        targetRect={currentStep.centered ? null : targetRect}
        onNext={onNext}
        onPrev={onPrev}
        onSkip={onSkip}
      />
    </AnimatePresence>,
    document.body,
  );
}

// ─── Help button (floating) ────────────────────────────────────────────────────

export function TourHelpButton({
  onStartSiteOverview,
  onStartCampaignCreation,
}: {
  onStartSiteOverview: () => void;
  onStartCampaignCreation: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  return (
    <div
      ref={containerRef}
      className="fixed bottom-6 right-6 z-[9990]"
      data-tour="tour-help"
    >
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="absolute bottom-14 right-0 w-60 overflow-hidden rounded-xl border border-[--color-border] bg-[--color-panel] shadow-2xl"
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.9 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <div className="border-b border-[--color-border] px-4 py-3">
              <p className="text-xs font-bold text-[--color-text-strong] flex items-center gap-1.5">
                <BookOpen size={14} />
                Guided Tours
              </p>
              <p className="mt-0.5 text-[11px] text-[--color-text-muted]">
                Learn the app step by step
              </p>
            </div>
            <div className="p-2">
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[--color-bg-muted]"
                onClick={() => {
                  setMenuOpen(false);
                  onStartSiteOverview();
                }}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
                  <Compass
                    size={16}
                    className="text-blue-600 dark:text-blue-400"
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[--color-text-strong]">
                    Site Overview
                  </p>
                  <p className="text-[11px] text-[--color-text-muted]">
                    Tour every section of the app
                  </p>
                </div>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[--color-bg-muted]"
                onClick={() => {
                  setMenuOpen(false);
                  onStartCampaignCreation();
                }}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/30">
                  <Rocket
                    size={16}
                    className="text-emerald-600 dark:text-emerald-400"
                  />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[--color-text-strong]">
                    Campaign Creation
                  </p>
                  <p className="text-[11px] text-[--color-text-muted]">
                    Step-by-step guide to go live
                  </p>
                </div>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating action button */}
      <motion.button
        type="button"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-[--color-primary] text-white shadow-lg hover:brightness-110 transition-all"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setMenuOpen((v) => !v)}
        title="Guided tours"
      >
        <HelpCircle size={22} />
      </motion.button>
    </div>
  );
}
