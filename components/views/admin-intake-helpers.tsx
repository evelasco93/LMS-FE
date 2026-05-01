import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ScrollText, X } from "lucide-react";
import { Badge } from "@/components/badge";
import type { IntakeLogItem } from "@/lib/types";

/** Returns the browser's local timezone identifier (e.g. "America/Chicago"). */
function getBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Format a UTC ISO string as local time with abbreviated timezone name.
 * Example output: "2026-03-15 10:32 AM CST"
 */
export function formatLocalTime(utcString?: string): string {
  if (!utcString) return "—";
  const date = new Date(utcString);
  if (Number.isNaN(date.getTime())) return "—";
  const tz = getBrowserTimezone();
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: tz,
    timeZoneName: "short",
  }).formatToParts(date);
  const byType = new Map(parts.map((p) => [p.type, p.value]));
  const month = byType.get("month") ?? "--";
  const day = byType.get("day") ?? "--";
  const year = byType.get("year") ?? "----";
  const hour = byType.get("hour") ?? "--";
  const minute = byType.get("minute") ?? "--";
  const period = byType.get("dayPeriod") ?? "";
  const abbr = byType.get("timeZoneName") ?? tz;
  return `${year}-${month}-${day} ${hour}:${minute}${period ? ` ${period}` : ""} ${abbr}`;
}

/**
 * Format a UTC ISO string as a UTC timestamp string.
 * Example output: "2026-03-15 16:32 UTC"
 */
export function formatUtcTime(utcString?: string): string {
  if (!utcString) return "—";
  const date = new Date(utcString);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
    timeZoneName: "short",
  }).formatToParts(date);
  const byType = new Map(parts.map((p) => [p.type, p.value]));
  const month = byType.get("month") ?? "--";
  const day = byType.get("day") ?? "--";
  const year = byType.get("year") ?? "----";
  const hour = byType.get("hour") ?? "--";
  const minute = byType.get("minute") ?? "--";
  const period = byType.get("dayPeriod") ?? "";
  return `${year}-${month}-${day} ${hour}:${minute}${period ? ` ${period}` : ""} UTC`;
}

export function intakeStatusTone(
  status: string,
): "success" | "danger" | "warning" | "neutral" {
  if (status === "accepted") return "success";
  if (status === "rejected") return "danger";
  if (status === "test") return "warning";
  return "neutral";
}

function buildSynthesizedResponse(
  item: IntakeLogItem,
): Record<string, unknown> {
  if (item.status === "rejected") {
    return {
      result: "failed",
      lead_id: item.id,
      msg: item.rejection_reason || "Lead rejected",
      errors: item.rejection_errors || [],
    };
  }
  if (item.status === "test") {
    return {
      id: item.id,
      test: true,
      duplicate: false,
      rejected: false,
      message: "Test lead received",
    };
  }
  return {
    id: item.id,
    test: false,
    duplicate: false,
    rejected: false,
    message: "Lead accepted",
  };
}

function buildDisplayedResponse(item: IntakeLogItem): unknown {
  if (item.response_body !== undefined) {
    return item.response_body;
  }

  return buildSynthesizedResponse(item);
}

export function isRejectedIntake(item: IntakeLogItem): boolean {
  if (item.status === "rejected") return true;

  const response = buildDisplayedResponse(item);
  if (!response || typeof response !== "object") return false;

  const record = response as Record<string, unknown>;
  const result = String(record.result ?? "").toLowerCase();
  if (result === "failed" || result === "rejected") return true;

  if (record.rejected === true) return true;

  const errors = record.errors;
  if (Array.isArray(errors) && errors.length > 0) return true;

  const message = String(record.message ?? record.msg ?? "").toLowerCase();
  if (message.includes("rejected") || message.includes("failed")) return true;

  return false;
}

export function IntakeLogDetailModal({
  item,
  onClose,
  onOpenLead,
}: {
  item: IntakeLogItem | null;
  onClose: () => void;
  onOpenLead?: (leadId: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<"request" | "response">("request");
  const [overviewOpen, setOverviewOpen] = useState(true);

  useEffect(() => {
    if (!item) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [item, onClose]);

  if (!item) return null;

  const displayedResponse = buildDisplayedResponse(item);
  const isRejected = isRejectedIntake(item);

  return (
    <AnimatePresence>
      {item && (
        <>
          <motion.div
            key="intake-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            key="intake-modal"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="pointer-events-auto relative w-full max-w-4xl h-[80vh] max-h-[760px] min-h-[620px] flex flex-col rounded-2xl border border-[--color-border] bg-[--color-panel] shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-center gap-3 border-b border-[--color-border] px-5 py-4">
                <Badge tone={isRejected ? "danger" : "success"}>
                  {isRejected ? "Rejected" : "Accepted"}
                </Badge>
                <Badge
                  tone={
                    item.status === "test" || item.is_test ? "info" : "success"
                  }
                >
                  {item.status === "test" || item.is_test ? "Test" : "Live"}
                </Badge>
                <span className="text-base font-semibold text-[--color-text-strong]">
                  Intake Log Details
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  className="ml-auto shrink-0 rounded-lg p-1.5 text-[--color-text-muted] hover:bg-[--color-bg-muted] hover:text-[--color-text] transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="rounded-xl border border-[--color-border] bg-[--color-bg-muted]/50 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOverviewOpen((v) => !v)}
                    className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-[--color-text-strong] hover:bg-[--color-bg-muted] transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <ScrollText
                        size={14}
                        className="text-[--color-text-muted]"
                      />
                      Overview
                    </span>
                    <ChevronDown
                      size={14}
                      className={`text-[--color-text-muted] transition-transform duration-150 ${overviewOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {overviewOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="px-4 pb-4 pt-1 grid grid-cols-2 gap-x-8 gap-y-3"
                    >
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-[--color-text-muted] mb-0.5">
                          Lead ID
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            onOpenLead?.(item.id);
                            onClose();
                          }}
                          className="font-mono text-sm font-medium text-[--color-primary] hover:underline"
                          title="Open lead details"
                        >
                          {item.id}
                        </button>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-[--color-text-muted] mb-0.5">
                          Campaign Key
                        </p>
                        <p className="font-mono text-sm text-[--color-text] truncate max-w-[200px]">
                          {item.campaign_key || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-[--color-text-muted] mb-0.5">
                          Received At
                        </p>
                        <p className="text-sm text-[--color-text]">
                          {formatLocalTime(item.received_at)}
                        </p>
                        <p className="text-xs text-[--color-text-muted] mt-0.5">
                          {formatUtcTime(item.received_at)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-[--color-text-muted] mb-0.5">
                          Method
                        </p>
                        <p className="text-sm font-medium text-[--color-text]">
                          POST
                        </p>
                      </div>
                    </motion.div>
                  )}
                </div>

                {isRejected && (
                  <div className="rounded-xl border border-[--color-danger] bg-[--color-panel] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.03)]">
                    <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-[--color-danger]">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[--color-danger] bg-[--color-bg-muted]">
                        <X size={12} />
                      </span>
                      Rejection Reason
                    </p>
                    {item.rejection_errors &&
                    item.rejection_errors.length > 0 ? (
                      <ul className="space-y-1.5">
                        {item.rejection_errors.map((err, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm text-[--color-text-strong]"
                          >
                            <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[--color-danger]" />
                            {err}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-[--color-text-strong]">
                        {item.rejection_reason || "Unknown rejection reason"}
                      </p>
                    )}
                  </div>
                )}

                <div className="rounded-xl border border-[--color-border] overflow-hidden">
                  <div className="flex border-b border-[--color-border] bg-[--color-bg-muted]/60">
                    {(["request", "response"] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2.5 text-sm font-medium transition-colors capitalize ${
                          activeTab === tab
                            ? "border-b-2 border-[--color-primary] text-[--color-primary]"
                            : "text-[--color-text-muted] hover:text-[--color-text]"
                        }`}
                      >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      </button>
                    ))}
                  </div>
                  <div className="h-[360px] overflow-hidden bg-[--color-bg]">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.pre
                        key={activeTab}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className="h-full overflow-y-auto p-4 text-xs text-[--color-text] font-mono leading-relaxed whitespace-pre-wrap break-all"
                      >
                        {activeTab === "request"
                          ? item.raw_body
                            ? JSON.stringify(item.raw_body, null, 2)
                            : "No request body available."
                          : JSON.stringify(displayedResponse, null, 2)}
                      </motion.pre>
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
