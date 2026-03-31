"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  Cherry,
  Copy,
  ExternalLink,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Modal } from "@/components/modal";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import {
  EditHistoryPopover,
  HoverTooltip,
  InfoItem,
} from "@/components/shared-ui";
import { updateLead, getEntityAudit } from "@/lib/api";
import {
  resolveDisplayName,
  inputClass,
  normalizeFieldLabel,
} from "@/lib/utils";
import type {
  Campaign,
  Client,
  EditHistoryEntry,
  Lead,
  TrustedFormResult,
  IpqsResult,
  IpqsCheckResult,
  AuditLogItem,
  AuditActor,
} from "@/lib/types";

// ─── Audit helpers ───────────────────────────────────────────────────────────

function resolveAuditActor(actor?: AuditActor | null): string {
  if (!actor) return "System";
  return actor.full_name || actor.email || actor.username || "Unknown";
}

function auditActionLabel(action: string): string {
  return action
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function auditActionTone(
  action: string,
): "success" | "danger" | "info" | "warning" | "neutral" {
  if (
    action === "created" ||
    action === "restored" ||
    action === "credential_enabled" ||
    action === "plugin_setting_enabled"
  )
    return "success";
  if (
    action === "deleted" ||
    action === "soft_deleted" ||
    action === "credential_disabled" ||
    action === "plugin_setting_disabled"
  )
    return "danger";
  if (
    action === "status_changed" ||
    action === "key_rotated" ||
    action === "password_reset"
  )
    return "warning";
  if (
    action === "updated" ||
    action.endsWith("_added") ||
    action.endsWith("_updated") ||
    action === "mappings_updated" ||
    action === "plugins_updated"
  )
    return "info";
  return "neutral";
}

function formatAuditValue(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function formatHistoryDetailValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    const maybeDate = new Date(value);
    if (!Number.isNaN(maybeDate.getTime()) && value.includes("T")) {
      return formatLocalDateTimeWithZone(value);
    }
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatActorLike(value: unknown): string {
  const actor = asRecord(value);
  if (!actor) return "System";
  return (
    (typeof actor.full_name === "string" && actor.full_name) ||
    (typeof actor.email === "string" && actor.email) ||
    (typeof actor.username === "string" && actor.username) ||
    "Unknown"
  );
}

function renderHistoryRows(
  rows: Array<{
    label: string;
    value: unknown;
    tone?: "default" | "success" | "danger" | "warning";
  }>,
  keyPrefix: string,
) {
  return rows
    .filter(
      (row) =>
        row.value !== undefined && row.value !== null && row.value !== "",
    )
    .map((row, idx) => (
      <div
        key={`${keyPrefix}-row-${idx}`}
        className="grid grid-cols-[9rem_1fr] items-start gap-2 text-[11px]"
      >
        <span className="truncate font-medium text-[--color-text]">
          {row.label}
        </span>
        <span
          className={
            row.tone === "success"
              ? "text-emerald-600 dark:text-emerald-400"
              : row.tone === "danger"
                ? "text-rose-600 dark:text-rose-400"
                : row.tone === "warning"
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-[--color-text-muted]"
          }
        >
          {formatHistoryDetailValue(row.value)}
        </span>
      </div>
    ));
}

function renderHistoryPayloadBlock(label: string, value: unknown, key: string) {
  if (value === undefined || value === null || value === "") return null;

  let display = value;
  if (typeof value === "string") {
    try {
      display = JSON.parse(value);
    } catch {
      display = value;
    }
  }

  return (
    <div key={key} className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
        {label}
      </p>
      <pre className="max-h-36 overflow-auto rounded border border-[--color-border] bg-[--color-bg] px-2.5 py-2 text-[11px] text-[--color-text] whitespace-pre-wrap break-all">
        {typeof display === "string"
          ? display
          : JSON.stringify(display, null, 2)}
      </pre>
    </div>
  );
}

function renderStructuredLeadHistoryChange(
  field: string,
  from: unknown,
  to: unknown,
  key: string,
) {
  const normalizedField = field.replace(/^payload\./, "").toLowerCase();
  const root = asRecord(to) ?? asRecord(from);
  if (!root) return null;

  if (normalizedField === "affiliate_pixel_result") {
    const success = root.success === true;
    const errorMessage =
      typeof root.error === "string" ? root.error.toLowerCase() : "";
    const status = success
      ? "Fired"
      : errorMessage.includes("not fired") || errorMessage.includes("disabled")
        ? "Not fired"
        : "Failed";

    return (
      <div
        key={key}
        className="space-y-2 rounded-md border border-[--color-border] bg-[--color-panel] px-2.5 py-2"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
          Affiliate Pixel Result
        </p>
        <div className="space-y-1">
          {renderHistoryRows(
            [
              {
                label: "Status",
                value: status,
                tone: success
                  ? "success"
                  : status === "Not fired"
                    ? "warning"
                    : "danger",
              },
              { label: "Affiliate ID", value: root.affiliate_id },
              { label: "Campaign ID", value: root.campaign_id },
              { label: "Fired At", value: root.fired_at },
              { label: "Method", value: root.webhook_method },
              { label: "Configured URL", value: root.webhook_url },
              { label: "Final URL", value: root.final_webhook_url },
              { label: "HTTP Status", value: root.webhook_response_status },
              { label: "Error", value: root.error, tone: "danger" },
            ],
            key,
          )}
        </div>
        {renderHistoryPayloadBlock(
          "Query Params Sent",
          root.sent_query_params,
          `${key}-query`,
        )}
        {renderHistoryPayloadBlock(
          "Body Payload Sent",
          root.sent_body_payload,
          `${key}-body`,
        )}
        {renderHistoryPayloadBlock(
          "Request Snapshot",
          root.sent_payload_snapshot,
          `${key}-request-snapshot`,
        )}
        {renderHistoryPayloadBlock(
          "Webhook Response",
          root.webhook_response_body,
          `${key}-response`,
        )}
      </div>
    );
  }

  if (normalizedField === "delivery_result") {
    const accepted = root.accepted === true;
    return (
      <div
        key={key}
        className="space-y-2 rounded-md border border-[--color-border] bg-[--color-panel] px-2.5 py-2"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
          Delivery Result
        </p>
        <div className="space-y-1">
          {renderHistoryRows(
            [
              {
                label: "Accepted",
                value: accepted ? "Yes" : "No",
                tone: accepted ? "success" : "danger",
              },
              { label: "Client ID", value: root.client_id },
              { label: "Delivered At", value: root.delivered_at },
              { label: "Attempts", value: root.attempts },
              { label: "Method", value: root.webhook_method },
              { label: "Configured URL", value: root.webhook_url },
              { label: "Final URL", value: root.final_webhook_url },
              { label: "HTTP Status", value: root.webhook_response_status },
              { label: "Acceptance Match", value: root.acceptance_match },
              { label: "Error", value: root.error, tone: "danger" },
            ],
            key,
          )}
        </div>
        {renderHistoryPayloadBlock(
          "Query Params Sent",
          root.sent_query_params,
          `${key}-query`,
        )}
        {renderHistoryPayloadBlock(
          "Body Payload Sent",
          root.sent_body_payload,
          `${key}-body`,
        )}
        {renderHistoryPayloadBlock(
          "Webhook Response",
          root.webhook_response_body,
          `${key}-response`,
        )}
      </div>
    );
  }

  if (normalizedField === "cherry_pick_meta") {
    const nestedDelivery = asRecord(root.delivery_result);
    return (
      <div
        key={key}
        className="space-y-2 rounded-md border border-[--color-border] bg-[--color-panel] px-2.5 py-2"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[--color-text-muted]">
          Cherry-Pick Details
        </p>
        <div className="space-y-1">
          {renderHistoryRows(
            [
              { label: "Target Client", value: root.target_client_id },
              { label: "Source Campaign", value: root.source_campaign_id },
              { label: "Executed At", value: root.executed_at },
              {
                label: "Executed By",
                value: formatActorLike(root.executed_by),
              },
              {
                label: "Delivery Accepted",
                value: nestedDelivery?.accepted === true ? "Yes" : "No",
                tone: nestedDelivery?.accepted === true ? "success" : "danger",
              },
              { label: "Delivery Client", value: nestedDelivery?.client_id },
              {
                label: "Delivery Method",
                value: nestedDelivery?.webhook_method,
              },
              {
                label: "Delivery URL",
                value:
                  asRecord(nestedDelivery?.sent_payload_snapshot)
                    ?.final_webhook_url ??
                  nestedDelivery?.final_webhook_url ??
                  nestedDelivery?.webhook_url,
              },
              {
                label: "Delivery Error",
                value: nestedDelivery?.error,
                tone: "danger",
              },
            ],
            key,
          )}
        </div>
        {renderHistoryPayloadBlock(
          "Delivery Request Snapshot",
          nestedDelivery?.sent_payload_snapshot,
          `${key}-request-snapshot`,
        )}
      </div>
    );
  }

  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatUtcDateTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);
}

function formatLocalDateTimeWithZone(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

// ─── Payload label normalizer → moved to lib/utils.ts (normalizeFieldLabel) ──

// ─── CopyButton ──────────────────────────────────────────────────────────────

function CopyButton({ value }: { value: string | null | undefined }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="ml-1.5 inline-flex shrink-0 items-center rounded p-0.5 text-[--color-text-muted] transition hover:text-[--color-primary] focus:outline-none"
      title="Copy"
    >
      {copied ? (
        <Check size={12} className="text-[--color-success]" />
      ) : (
        <Copy size={12} />
      )}
    </button>
  );
}

function CopyableValue({ value }: { value: string | null | undefined }) {
  return (
    <span className="inline-flex items-center gap-0">
      <span className="truncate">{value || "—"}</span>
      <CopyButton value={value ?? undefined} />
    </span>
  );
}

// ─── Rejection reason parser ──────────────────────────────────────────────────

/** Extracts { fieldName -> error sentence } from a rejection_reason string. */
function parseRejectedFields(reason: string): Record<string, string> {
  const map: Record<string, string> = {};
  const pattern =
    /'([\w_]+)'\s+((?:must|should|is required|cannot|does\s+not|failed|is\s+(?:required|empty|not))[^.;(]*)(?:\([^)]*\))?/gi;
  let m;
  while ((m = pattern.exec(reason)) !== null) {
    map[m[1]] = m[0].trim().replace(/\.$/, "");
  }
  return map;
}

// ─── TrustedForm result card ───────────────────────────────────────────────────

function TrustedFormCard({
  result,
  pluginEnabled = true,
}: {
  result: TrustedFormResult | null | undefined;
  pluginEnabled?: boolean;
}) {
  const noResult = result == null;
  const passed = !noResult && result.success === true;
  const failed = !noResult && result.success === false;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-3">
        <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
          TrustedForm Verification
        </p>
        <div className="mt-2 flex items-center gap-2">
          {noResult ? (
            <span className="text-sm text-[--color-text-muted]">
              {pluginEnabled === false
                ? "Disabled for this campaign"
                : "Not evaluated"}
            </span>
          ) : passed ? (
            <>
              <Check size={16} className="text-[--color-success]" />
              <span className="font-semibold text-[--color-success]">
                Passed
              </span>
            </>
          ) : (
            <>
              <X size={16} className="text-[--color-danger]" />
              <span className="font-semibold text-[--color-danger]">
                Failed
              </span>
            </>
          )}
        </div>
        {passed && (
          <div className="mt-2 space-y-1 text-xs text-[--color-text-muted]">
            {result.cert_id && (
              <p className="flex items-center gap-1.5">
                <span className="font-medium text-[--color-text]">
                  Cert ID:{" "}
                </span>
                <span className="font-mono">{result.cert_id}</span>
                <a
                  href={`https://cert.trustedform.com/${result.cert_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-0.5 text-[--color-primary] hover:opacity-75"
                  aria-label="View TrustedForm certificate"
                >
                  <ExternalLink size={11} />
                </a>
              </p>
            )}
            {result.expires_at && (
              <p>
                <span className="font-medium text-[--color-text]">
                  Expires:{" "}
                </span>
                {result.expires_at}
              </p>
            )}
            {result.previously_retained != null && (
              <p>
                <span className="font-medium text-[--color-text]">
                  Previously Retained:{" "}
                </span>
                {result.previously_retained ? "Yes" : "No"}
              </p>
            )}
            {result.phone_match != null && (
              <p>
                <span className="font-medium text-[--color-text]">
                  Phone Match:{" "}
                </span>
                {result.phone_match ? "Yes" : "No"}
              </p>
            )}
            {result.vendor && (
              <p>
                <span className="font-medium text-[--color-text]">
                  Retained By:{" "}
                </span>
                {result.vendor}
              </p>
            )}
          </div>
        )}
      </div>

      {failed && (
        <details
          className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-3"
          open
        >
          <summary className="cursor-pointer text-sm font-medium text-[--color-text-strong]">
            Failure Details
          </summary>
          <div className="mt-3 space-y-2 text-xs">
            {result.outcome && (
              <div className="flex gap-2">
                <span className="w-36 shrink-0 font-medium text-[--color-text-muted]">
                  Outcome
                </span>
                <span className="text-[--color-text]">{result.outcome}</span>
              </div>
            )}
            {result.error && (
              <div className="flex gap-2">
                <span className="w-36 shrink-0 font-medium text-[--color-text-muted]">
                  Error
                </span>
                <span className="text-[--color-danger]">{result.error}</span>
              </div>
            )}
            {result.phone_match != null && (
              <div className="flex gap-2">
                <span className="w-36 shrink-0 font-medium text-[--color-text-muted]">
                  Phone Match
                </span>
                <span
                  className={
                    result.phone_match
                      ? "text-[--color-success]"
                      : "text-[--color-danger]"
                  }
                >
                  {result.phone_match ? "Yes" : "No"}
                </span>
              </div>
            )}
            {result.phone && (
              <div className="flex gap-2">
                <span className="w-36 shrink-0 font-medium text-[--color-text-muted]">
                  Phone
                </span>
                <span className="text-[--color-text]">{result.phone}</span>
              </div>
            )}
            {result.cert_id && (
              <div className="flex gap-2">
                <span className="w-36 shrink-0 font-medium text-[--color-text-muted]">
                  Cert ID
                </span>
                <span className="flex items-center gap-1.5 break-all text-[--color-text]">
                  <span className="font-mono">{result.cert_id}</span>
                  <a
                    href={`https://cert.trustedform.com/${result.cert_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-[--color-primary] hover:opacity-75"
                    aria-label="View TrustedForm certificate"
                  >
                    <ExternalLink size={11} />
                  </a>
                </span>
              </div>
            )}
            {result.expires_at && (
              <div className="flex gap-2">
                <span className="w-36 shrink-0 font-medium text-[--color-text-muted]">
                  Expires
                </span>
                <span className="text-[--color-text]">{result.expires_at}</span>
              </div>
            )}
            {result.previously_retained != null && (
              <div className="flex gap-2">
                <span className="w-36 shrink-0 font-medium text-[--color-text-muted]">
                  Prev. Retained
                </span>
                <span className="text-[--color-text]">
                  {result.previously_retained ? "Yes" : "No"}
                </span>
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
// ─── IPQS result card ─────────────────────────────────────────────────────────

function IpqsCheckSection({
  label,
  check,
}: {
  label: string;
  check: IpqsCheckResult | undefined | null;
}) {
  const [open, setOpen] = useState(false);
  if (!check) return null;

  const passed = check.success === true;
  const failed = check.success === false;

  const rawFields = check.raw ? Object.entries(check.raw) : [];
  const criteriaEntries = check.criteria_results
    ? Object.entries(check.criteria_results)
    : [];

  return (
    <div className="rounded-lg border border-[--color-border] bg-[--color-bg] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium text-[--color-text] hover:bg-[--color-bg-muted] transition-colors"
      >
        <span className="flex items-center gap-2">
          {check.success != null ? (
            passed ? (
              <Check size={13} className="text-[--color-success]" />
            ) : (
              <X size={13} className="text-[--color-danger]" />
            )
          ) : null}
          {label}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.18 }}
          className="text-[--color-text-muted]"
        >
          <ChevronDown size={14} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="ipqs-check-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-3 pb-3 pt-1 space-y-3 border-t border-[--color-border]">
              {check.error && (
                <p className="text-xs text-[--color-danger]">{check.error}</p>
              )}

              {criteriaEntries.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wide text-[--color-text-muted] font-semibold">
                    Criteria Results
                  </p>
                  {criteriaEntries.map(([key, pass]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="capitalize text-[--color-text-muted]">
                        {key.replace(/_/g, " ")}
                      </span>
                      <span
                        className={`flex items-center gap-1 font-medium ${
                          pass
                            ? "text-[--color-success]"
                            : "text-[--color-danger]"
                        }`}
                      >
                        {pass ? <Check size={11} /> : <X size={11} />}
                        {pass ? "Pass" : "Fail"}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {rawFields.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wide text-[--color-text-muted] font-semibold">
                    Raw Response
                  </p>
                  {rawFields.map(([key, val]) => (
                    <div
                      key={key}
                      className="flex items-start justify-between gap-2 text-xs"
                    >
                      <span className="shrink-0 capitalize text-[--color-text-muted]">
                        {key.replace(/_/g, " ")}
                      </span>
                      <span className="text-right font-mono text-[--color-text] break-all">
                        {typeof val === "boolean"
                          ? val
                            ? "true"
                            : "false"
                          : val == null
                            ? "—"
                            : String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function IpqsResultCard({
  result,
  pluginEnabled = true,
}: {
  result: IpqsResult | null | undefined;
  pluginEnabled?: boolean;
}) {
  const noResult = result == null;
  const overallPassed = !noResult && result.success === true;
  const overallFailed = !noResult && result.success === false;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-3">
        <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
          IPQS Verification
        </p>
        <div className="mt-2 flex items-center gap-2">
          {noResult ? (
            <span className="text-sm text-[--color-text-muted]">
              {pluginEnabled === false
                ? "Disabled for this campaign"
                : "Not evaluated"}
            </span>
          ) : overallPassed ? (
            <>
              <Check size={16} className="text-[--color-success]" />
              <span className="font-semibold text-[--color-success]">
                Passed
              </span>
            </>
          ) : overallFailed ? (
            <>
              <X size={16} className="text-[--color-danger]" />
              <span className="font-semibold text-[--color-danger]">
                Failed
              </span>
            </>
          ) : (
            <span className="text-sm text-[--color-text-muted]">No result</span>
          )}
        </div>
        {result?.error && (
          <p className="mt-1.5 text-xs text-[--color-danger]">{result.error}</p>
        )}
      </div>

      {!noResult && (result.phone || result.email || result.ip) && (
        <div className="space-y-2">
          <IpqsCheckSection label="Phone" check={result.phone} />
          <IpqsCheckSection label="Email" check={result.email} />
          <IpqsCheckSection label="IP Address" check={result.ip} />
        </div>
      )}
    </div>
  );
}
// ─── PayloadPreview ───────────────────────────────────────────────────────────

export function PayloadPreview({
  lead,
  allLeads,
  campaignPlugins,
  clients,
  onOpenClient,
  onCherryPick,
}: {
  lead: Lead;
  allLeads: Lead[];
  campaignPlugins?: Campaign["plugins"];
  clients?: Client[];
  onOpenClient?: (clientId: string) => void;
  onCherryPick?: (lead: Lead) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "summary" | "payload" | "quality-control" | "history" | "delivery"
  >("summary");
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<string>>(
    new Set(),
  );
  const [payloadTab, setPayloadTab] = useState<"normalized" | "raw">(
    "normalized",
  );
  const [qualityTab, setQualityTab] = useState<
    "duplicate-check" | "trusted-form" | "ipqs"
  >("duplicate-check");
  const [selectedLead, setSelectedLead] = useState<Lead>(lead);
  const [localPayload, setLocalPayload] = useState<Record<string, string>>({});
  const originalPayloadRef = useRef<Record<string, string>>({});
  const [confirmSave, setConfirmSave] = useState(false);
  const [savingPayload, setSavingPayload] = useState(false);

  const setLeadQueryParams = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    Object.entries(next).forEach(([key, value]) => {
      if (value === undefined || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const currentLead = selectedLead;
  const entries = Object.entries(currentLead.payload || {});
  const duplicateLeadIds = currentLead.duplicate_matches?.lead_ids || [];
  const duplicateFailed = Boolean(currentLead.duplicate);
  const trustedFormResult = currentLead.trusted_form_result ?? null;
  const ipqsResult = currentLead.ipqs_result ?? null;

  const {
    data: auditItems = [],
    isLoading: auditLoading,
    mutate: refreshAudit,
  } = useSWR<AuditLogItem[]>(
    isOpen ? ["entity-audit", currentLead.id] : null,
    async () => {
      try {
        const res = await getEntityAudit(currentLead.id, { limit: 100 });
        return res?.data?.items ?? [];
      } catch {
        return [];
      }
    },
    { revalidateOnFocus: true, refreshInterval: 30_000 },
  );

  useEffect(() => {
    const leadId = searchParams?.get("lead");
    if (!leadId) return;

    const targetLead = allLeads.find((item) => item.id === leadId);
    if (!targetLead || targetLead.id !== lead.id) return;

    setSelectedLead(targetLead);
    setIsOpen(true);
    const initP: Record<string, string> = {};
    Object.entries(targetLead.payload || {}).forEach(([k, v]) => {
      initP[k] = typeof v === "object" ? JSON.stringify(v) : String(v ?? "");
    });
    setLocalPayload(initP);
    originalPayloadRef.current = { ...initP };

    const tabParam = searchParams?.get("leadTab");
    if (
      tabParam === "summary" ||
      tabParam === "payload" ||
      tabParam === "quality-control" ||
      tabParam === "history" ||
      tabParam === "delivery"
    ) {
      setActiveTab(tabParam);
    }

    const qualityParam = searchParams?.get("leadQc");
    if (
      qualityParam === "duplicate-check" ||
      qualityParam === "trusted-form" ||
      qualityParam === "ipqs"
    ) {
      setQualityTab(qualityParam);
    }

    const ptParam = searchParams?.get("leadPt");
    if (ptParam === "normalized" || ptParam === "raw") {
      setPayloadTab(ptParam);
    }
  }, [allLeads, lead.id, searchParams]);

  const openPayload = () => {
    setSelectedLead(lead);
    setIsOpen(true);
    setActiveTab("summary");
    setPayloadTab("normalized");
    setQualityTab("duplicate-check");
    const initP: Record<string, string> = {};
    Object.entries(lead.payload || {}).forEach(([k, v]) => {
      initP[k] = typeof v === "object" ? JSON.stringify(v) : String(v ?? "");
    });
    setLocalPayload(initP);
    originalPayloadRef.current = { ...initP };
    setLeadQueryParams({
      view: undefined,
      campaign: undefined,
      section: undefined,
      affiliate: undefined,
      lead: lead.id,
      leadTab: "summary",
      leadQc: undefined,
      leadPt: undefined,
    });
  };

  const closePayload = () => {
    setIsOpen(false);
    setActiveTab("summary");
    setPayloadTab("normalized");
    setQualityTab("duplicate-check");
    setSelectedLead(lead);
    setLocalPayload({});
    setConfirmSave(false);
    setLeadQueryParams({
      lead: undefined,
      leadTab: undefined,
      leadQc: undefined,
      leadPt: undefined,
    });
  };

  const tabBtn = (label: string, onClick: () => void, active: boolean) => (
    <button
      type="button"
      onClick={onClick}
      aria-selected={active}
      role="tab"
      className={`border-b-2 px-1 py-2 text-sm font-medium transition ${
        active
          ? "border-[--color-primary] text-[--color-text-strong]"
          : "border-transparent text-[--color-text-muted] hover:text-[--color-text]"
      }`}
    >
      {label}
    </button>
  );

  const subTabBtn = (label: string, onClick: () => void, active: boolean) => (
    <button
      type="button"
      onClick={onClick}
      aria-selected={active}
      role="tab"
      className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "bg-[--color-primary] text-[--color-bg]"
          : "bg-[--color-bg-muted] text-[--color-text-muted] hover:text-[--color-text]"
      }`}
    >
      {label}
    </button>
  );

  const hasDirtyPayload = Object.keys(localPayload).some(
    (k) => localPayload[k] !== (originalPayloadRef.current[k] ?? ""),
  );

  const mappedFieldNames = new Set(
    (selectedLead.mapped_fields ?? []).map((mf) => mf.field),
  );

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="bg-[--color-primary] text-[--color-bg] hover:bg-[color-mix(in_srgb,var(--color-primary)_85%,black)]"
        onClick={openPayload}
      >
        View
      </Button>

      <Modal
        title="Lead Details"
        isOpen={isOpen}
        onClose={closePayload}
        width={920}
      >
        <div className="space-y-3 text-sm">
          {
            /* Primary tabs */
            <div
              role="tablist"
              aria-label="Lead detail sections"
              className="flex items-center gap-4 border-b border-[--color-border]"
            >
              {tabBtn(
                "Summary",
                () => {
                  setActiveTab("summary");
                  setLeadQueryParams({
                    lead: currentLead.id,
                    leadTab: "summary",
                    leadQc: undefined,
                    leadPt: undefined,
                  });
                },
                activeTab === "summary",
              )}
              {tabBtn(
                "Payload",
                () => {
                  setActiveTab("payload");
                  setLeadQueryParams({
                    lead: currentLead.id,
                    leadTab: "payload",
                    leadQc: undefined,
                    leadPt: payloadTab,
                  });
                },
                activeTab === "payload",
              )}
              {tabBtn(
                "Quality Control",
                () => {
                  setActiveTab("quality-control");
                  setLeadQueryParams({
                    lead: currentLead.id,
                    leadTab: "quality-control",
                    leadQc: qualityTab,
                    leadPt: undefined,
                  });
                },
                activeTab === "quality-control",
              )}
              {tabBtn(
                "Delivery",
                () => {
                  setActiveTab("delivery");
                  setLeadQueryParams({
                    lead: currentLead.id,
                    leadTab: "delivery",
                    leadQc: undefined,
                    leadPt: undefined,
                  });
                },
                activeTab === "delivery",
              )}
              {tabBtn(
                "History",
                () => {
                  setActiveTab("history");
                  setLeadQueryParams({
                    lead: currentLead.id,
                    leadTab: "history",
                    leadQc: undefined,
                    leadPt: undefined,
                  });
                },
                activeTab === "history",
              )}
              {(() => {
                const isSold =
                  currentLead.sold === true ||
                  currentLead.sold_status === "sold";
                const hasManualEditsFromHistory = (
                  currentLead.edit_history ?? []
                ).some((e) => {
                  if (!e.field.startsWith("payload.")) return false;
                  return !mappedFieldNames.has(e.field.slice(8));
                });
                if (
                  !onCherryPick ||
                  isSold ||
                  currentLead.cherry_picked === true ||
                  currentLead.cherry_pickable === false ||
                  !hasManualEditsFromHistory
                )
                  return null;
                return (
                  <button
                    type="button"
                    onClick={() => onCherryPick(currentLead)}
                    className="ml-auto mb-1 flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-700 transition-colors"
                  >
                    <Cherry size={12} />
                    Cherry Pick
                  </button>
                );
              })()}
            </div>
          }
          <div className="h-[540px] overflow-y-auto">
            <AnimatePresence mode="wait" initial={false}>
              {/* ── Summary ── */}
              {activeTab === "summary" && (
                <motion.div
                  key="summary"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    <InfoItem
                      label="Lead ID"
                      value={<CopyableValue value={currentLead.id} />}
                    />
                    <InfoItem
                      label="Mode"
                      value={currentLead.test ? "Test" : "Live"}
                    />
                    <InfoItem
                      label="Campaign"
                      value={<CopyableValue value={currentLead.campaign_id} />}
                    />
                    <InfoItem
                      label="Campaign Key"
                      value={<CopyableValue value={currentLead.campaign_key} />}
                    />
                    <InfoItem
                      label="Affiliate Status at Intake"
                      value={currentLead.affiliate_status_at_intake || "—"}
                    />
                    <InfoItem
                      label="Status"
                      value={
                        <Badge
                          tone={currentLead.rejected ? "danger" : "success"}
                        >
                          {currentLead.rejected ? "Rejected" : "Accepted"}
                        </Badge>
                      }
                    />
                    {currentLead.rejection_reason && (
                      <div className="md:col-span-2">
                        <InfoItem
                          label="Rejection Reason"
                          value={currentLead.rejection_reason}
                        />
                      </div>
                    )}
                    <InfoItem
                      label="Duplicate"
                      value={
                        <button
                          type="button"
                          onClick={() => {
                            setQualityTab("duplicate-check");
                            setActiveTab("quality-control");
                            setLeadQueryParams({
                              lead: currentLead.id,
                              leadTab: "quality-control",
                              leadQc: "duplicate-check",
                            });
                          }}
                          className="group inline-flex items-center gap-1 transition hover:opacity-80"
                        >
                          <span
                            className={`font-medium ${
                              duplicateFailed
                                ? "text-[--color-danger]"
                                : "text-[--color-success]"
                            }`}
                          >
                            {duplicateFailed ? "Yes" : "No"}
                          </span>
                          <ArrowRight
                            size={12}
                            className="text-[--color-text-muted] transition group-hover:translate-x-0.5"
                          />
                        </button>
                      }
                    />
                    <InfoItem
                      label="TrustedForm"
                      value={
                        trustedFormResult == null ? (
                          "—"
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setQualityTab("trusted-form");
                              setActiveTab("quality-control");
                              setLeadQueryParams({
                                lead: currentLead.id,
                                leadTab: "quality-control",
                                leadQc: "trusted-form",
                              });
                            }}
                            className="group inline-flex items-center gap-1 transition hover:opacity-80"
                          >
                            <span
                              className={`font-medium ${
                                trustedFormResult.success
                                  ? "text-[--color-success]"
                                  : "text-[--color-danger]"
                              }`}
                            >
                              {trustedFormResult.success ? "Passed" : "Failed"}
                            </span>
                            <ArrowRight
                              size={12}
                              className="text-[--color-text-muted] transition group-hover:translate-x-0.5"
                            />
                          </button>
                        )
                      }
                    />
                    <InfoItem
                      label="IPQS"
                      value={
                        ipqsResult == null ? (
                          "—"
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setQualityTab("ipqs");
                              setActiveTab("quality-control");
                              setLeadQueryParams({
                                lead: currentLead.id,
                                leadTab: "quality-control",
                                leadQc: "ipqs",
                              });
                            }}
                            className="group inline-flex items-center gap-1 transition hover:opacity-80"
                          >
                            <span
                              className={`font-medium ${
                                ipqsResult.success
                                  ? "text-[--color-success]"
                                  : "text-[--color-danger]"
                              }`}
                            >
                              {ipqsResult.success ? "Passed" : "Failed"}
                            </span>
                            <ArrowRight
                              size={12}
                              className="text-[--color-text-muted] transition group-hover:translate-x-0.5"
                            />
                          </button>
                        )
                      }
                    />
                    <InfoItem
                      label="Created (UTC)"
                      value={formatUtcDateTime(currentLead.created_at)}
                    />
                    <InfoItem
                      label="Created (Local)"
                      value={formatLocalDateTimeWithZone(
                        currentLead.created_at,
                      )}
                    />
                    <InfoItem
                      label="Submitted By"
                      value={resolveDisplayName(currentLead.created_by) || "—"}
                    />
                    <InfoItem
                      label="Last Updated By"
                      value={resolveDisplayName(currentLead.updated_by) || "—"}
                    />
                  </div>
                </motion.div>
              )}

              {/* ── Payload ── */}
              {activeTab === "payload" && (
                <motion.div
                  key="payload"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                >
                  <div className="space-y-3">
                    <AnimatePresence mode="wait" initial={false}>
                      {/* Normalized – editable form with human-readable labels */}
                      {
                        <motion.div
                          key="normalized"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -3 }}
                          transition={{ duration: 0.12, ease: "easeOut" }}
                        >
                          <div className="space-y-2">
                            {entries.length === 0 ? (
                              <p className="text-[--color-text-muted]">
                                Empty payload
                              </p>
                            ) : (
                              <>
                                <div className="space-y-2">
                                  {(() => {
                                    const rejectedFieldMap =
                                      currentLead.rejected &&
                                      currentLead.rejection_reason
                                        ? parseRejectedFields(
                                            currentLead.rejection_reason,
                                          )
                                        : {};
                                    return entries.map(([key]) => {
                                      const original =
                                        originalPayloadRef.current[key] ?? "";
                                      const current =
                                        localPayload[key] ?? original;
                                      const isDirty = current !== original;

                                      // Field-level edit/remap detection from audit log
                                      const fieldHistory: EditHistoryEntry[] =
                                        auditItems.flatMap((item) =>
                                          item.changes
                                            .filter(
                                              (c) =>
                                                c.field === `payload.${key}` ||
                                                c.field === key,
                                            )
                                            .map(
                                              (c): EditHistoryEntry => ({
                                                field: c.field,
                                                previous_value: c.from,
                                                new_value: c.to,
                                                changed_at: item.changed_at,
                                                changed_by: item.actor ?? null,
                                              }),
                                            ),
                                        );
                                      const isEdited =
                                        !isDirty &&
                                        fieldHistory.some(
                                          (e) =>
                                            !!(
                                              e.changed_by?.email ||
                                              e.changed_by?.username
                                            ),
                                        );

                                      // Check lead-level mapped_fields for value-mapping highlight
                                      const mappedEntry = (
                                        currentLead.mapped_fields ?? []
                                      ).find((mf) => mf.field === key);
                                      const isMappedField = !!mappedEntry;
                                      // Synthesise a history entry so the popover shows the mapping
                                      const mappedFieldHistory: EditHistoryEntry[] =
                                        mappedEntry
                                          ? [
                                              {
                                                field: key,
                                                previous_value:
                                                  mappedEntry.original_value,
                                                new_value:
                                                  mappedEntry.mapped_value,
                                                changed_at:
                                                  mappedEntry.mapped_at,
                                                changed_by: null,
                                              },
                                            ]
                                          : [];
                                      const combinedHistory = [
                                        ...fieldHistory,
                                        ...mappedFieldHistory,
                                      ];

                                      // A rejected field gets a red ring (highest priority)
                                      const rejectionMsg =
                                        rejectedFieldMap[key];
                                      const isRejected =
                                        !isDirty && !!rejectionMsg;

                                      const inputRing = isDirty
                                        ? "border-[--color-warning] shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-warning)_20%,transparent)]"
                                        : isRejected
                                          ? "border-red-400 shadow-[0_0_0_3px_color-mix(in_srgb,#f87171_20%,transparent)]"
                                          : isEdited
                                            ? "border-amber-400 shadow-[0_0_0_3px_color-mix(in_srgb,#f59e0b_18%,transparent)]"
                                            : isMappedField
                                              ? "border-violet-400 shadow-[0_0_0_3px_color-mix(in_srgb,#8b5cf6_18%,transparent)]"
                                              : "";
                                      const showHistory =
                                        isDirty || isEdited || isMappedField;

                                      return (
                                        <div key={key} className="space-y-1">
                                          <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                                            {normalizeFieldLabel(key)}{" "}
                                            <span className="normal-case tracking-normal opacity-60">
                                              ({key})
                                            </span>
                                          </p>
                                          <div className="relative flex items-center">
                                            <input
                                              className={`${inputClass} ${inputRing}`}
                                              value={current}
                                              onChange={(e) =>
                                                setLocalPayload((prev) => ({
                                                  ...prev,
                                                  [key]: e.target.value,
                                                }))
                                              }
                                            />
                                            {isRejected && (
                                              <span
                                                className={`absolute ${
                                                  showHistory
                                                    ? "right-7"
                                                    : "right-2"
                                                }`}
                                              >
                                                <HoverTooltip
                                                  message={rejectionMsg}
                                                >
                                                  <AlertCircle
                                                    size={14}
                                                    className="text-red-400"
                                                  />
                                                </HoverTooltip>
                                              </span>
                                            )}
                                            {showHistory && (
                                              <span className="absolute right-2">
                                                <EditHistoryPopover
                                                  originalValue={
                                                    isDirty
                                                      ? original
                                                      : undefined
                                                  }
                                                  updatedBy={
                                                    currentLead.updated_by
                                                  }
                                                  updatedAt={
                                                    currentLead.updated_at
                                                  }
                                                  dirty={isDirty}
                                                  fieldLabel={normalizeFieldLabel(
                                                    key,
                                                  )}
                                                  history={combinedHistory}
                                                />
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    });
                                  })()}
                                </div>
                                {hasDirtyPayload && (
                                  <div className="sticky bottom-0 flex items-center gap-2 rounded-lg border border-[--color-border] bg-[--color-bg-muted] px-3 py-2">
                                    <span className="mr-auto text-xs text-[--color-text-muted]">
                                      Unsaved changes
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() =>
                                        setLocalPayload({
                                          ...originalPayloadRef.current,
                                        })
                                      }
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() => setConfirmSave(true)}
                                    >
                                      Save Changes
                                    </Button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </motion.div>
                      }
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}

              {/* ── Quality Control ── */}
              {activeTab === "quality-control" && (
                <motion.div
                  key="quality-control"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                >
                  <div className="space-y-3">
                    {/* QC sub-tabs — ordered by execution stage */}
                    <div
                      role="tablist"
                      aria-label="Quality control modules"
                      className="flex items-center gap-2"
                    >
                      {[
                        {
                          key: "duplicate-check" as const,
                          label: "Duplicate Check",
                          stage: 1,
                        },
                        {
                          key: "trusted-form" as const,
                          label: "TrustedForm",
                          stage: campaignPlugins?.trusted_form?.stage ?? 2,
                        },
                        {
                          key: "ipqs" as const,
                          label: "IPQS",
                          stage: campaignPlugins?.ipqs?.stage ?? 3,
                        },
                      ]
                        .sort((a, b) =>
                          a.stage !== b.stage
                            ? a.stage - b.stage
                            : a.key.localeCompare(b.key),
                        )
                        .map(({ key, label }) =>
                          subTabBtn(
                            label,
                            () => {
                              setQualityTab(key);
                              setLeadQueryParams({
                                lead: currentLead.id,
                                leadTab: "quality-control",
                                leadQc: key,
                              });
                            },
                            qualityTab === key,
                          ),
                        )}
                    </div>

                    <AnimatePresence mode="wait" initial={false}>
                      {/* Duplicate Check */}
                      {qualityTab === "duplicate-check" && (
                        <motion.div
                          key="duplicate-check"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -3 }}
                          transition={{ duration: 0.12, ease: "easeOut" }}
                        >
                          <div className="space-y-3">
                            <div className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-3">
                              <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                                Duplicate Check
                              </p>
                              <div className="mt-2 flex items-center gap-2">
                                {duplicateFailed ? (
                                  <X
                                    size={16}
                                    className="text-[--color-danger]"
                                  />
                                ) : (
                                  <Check
                                    size={16}
                                    className="text-[--color-success]"
                                  />
                                )}
                                <span
                                  className={`font-semibold ${
                                    duplicateFailed
                                      ? "text-[--color-danger]"
                                      : "text-[--color-success]"
                                  }`}
                                >
                                  {duplicateFailed ? "Fail" : "Passed"}
                                </span>
                              </div>
                            </div>

                            {duplicateLeadIds.length > 0 && (
                              <details className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-3">
                                <summary className="cursor-pointer text-sm font-medium text-[--color-text-strong]">
                                  Matched Leads ({duplicateLeadIds.length})
                                </summary>
                                <div className="mt-3">
                                  <div className="flex flex-wrap gap-2">
                                    {duplicateLeadIds.map((leadId) => (
                                      <button
                                        key={leadId}
                                        type="button"
                                        className="rounded-md"
                                        onClick={() => {
                                          const matchedLead = allLeads.find(
                                            (item) => item.id === leadId,
                                          );
                                          if (!matchedLead) {
                                            toast.warning(
                                              "Matched lead is not available in the current list.",
                                            );
                                            return;
                                          }
                                          setSelectedLead(matchedLead);
                                          setActiveTab("payload");
                                          setPayloadTab("normalized");
                                          setQualityTab("duplicate-check");
                                          setLeadQueryParams({
                                            lead: matchedLead.id,
                                            leadTab: "payload",
                                            leadPt: "normalized",
                                            leadQc: undefined,
                                          });
                                        }}
                                      >
                                        <Badge tone="warning">{leadId}</Badge>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </details>
                            )}
                          </div>
                        </motion.div>
                      )}

                      {/* TrustedForm */}
                      {qualityTab === "trusted-form" && (
                        <motion.div
                          key="trusted-form"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -3 }}
                          transition={{ duration: 0.12, ease: "easeOut" }}
                        >
                          <TrustedFormCard
                            result={trustedFormResult}
                            pluginEnabled={
                              campaignPlugins?.trusted_form?.enabled !== false
                            }
                          />
                        </motion.div>
                      )}

                      {/* IPQS */}
                      {qualityTab === "ipqs" && (
                        <motion.div
                          key="ipqs"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -3 }}
                          transition={{ duration: 0.12, ease: "easeOut" }}
                        >
                          <IpqsResultCard
                            result={ipqsResult}
                            pluginEnabled={
                              campaignPlugins?.ipqs?.enabled !== false
                            }
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}

              {/* ── History ── */}
              {activeTab === "history" && (
                <motion.div
                  key="history"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                >
                  {auditLoading ? (
                    <p className="py-8 text-center text-sm text-[--color-text-muted]">
                      Loading history…
                    </p>
                  ) : auditItems.length === 0 &&
                    !currentLead.mapped_fields?.length ? (
                    <div className="py-12 text-center">
                      <p className="text-sm text-[--color-text-muted]">
                        No history available for this lead.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(currentLead.mapped_fields?.length ?? 0) > 0 &&
                        currentLead.mapped_fields!.map((mf, i) => (
                          <div
                            key={`mapped-field-${i}`}
                            className="rounded-lg border border-[--color-border] bg-[--color-panel]"
                          >
                            <div className="flex w-full flex-wrap items-center justify-between gap-2 p-3 text-left">
                              <div className="flex items-center gap-2">
                                <Badge tone="info">Value Mapped</Badge>
                                <span className="text-xs text-[--color-text-muted]">
                                  by{" "}
                                  <span className="font-medium text-[--color-text]">
                                    Intake Mapping
                                  </span>
                                </span>
                              </div>
                              <span className="ml-auto flex items-center gap-1.5 text-xs text-[--color-text-muted]">
                                {mf.mapped_at
                                  ? new Intl.DateTimeFormat(undefined, {
                                      year: "numeric",
                                      month: "short",
                                      day: "2-digit",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      second: "2-digit",
                                      timeZoneName: "short",
                                    }).format(new Date(mf.mapped_at))
                                  : "—"}
                              </span>
                            </div>
                            <div className="border-t border-[--color-border] px-3 pb-3 pt-2">
                              <div className="flex flex-col gap-0.5 rounded bg-[--color-bg-muted] px-2 py-1.5 text-xs">
                                <span className="font-semibold text-[--color-text-strong]">
                                  {normalizeFieldLabel(mf.field)}{" "}
                                  <span className="font-mono font-normal text-[--color-text-muted]">
                                    ({mf.field})
                                  </span>
                                </span>
                                <span className="flex items-center gap-1 text-[--color-text-muted]">
                                  <span className="line-through">
                                    {mf.original_value}
                                  </span>
                                  <ArrowRight size={10} className="shrink-0" />
                                  <span className="font-medium text-[--color-text]">
                                    {mf.mapped_value}
                                  </span>
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      {auditItems
                        .filter((item) => {
                          const mappedFields = currentLead.mapped_fields ?? [];
                          if (mappedFields.length === 0) return true;

                          // Mapping events are already represented in the VALUE MAPPINGS
                          // block. Drop equivalent audit entries to avoid duplicate cards.
                          const mappingActions = new Set([
                            "mappings_updated",
                            "value_mapped",
                            "mapped_fields_updated",
                          ]);

                          if (mappingActions.has(item.action)) return false;

                          if (item.changes.length > 0) {
                            const mappedTuples = new Set(
                              mappedFields.map(
                                (mf) =>
                                  `${mf.field}|${String(mf.original_value)}|${String(mf.mapped_value)}`,
                              ),
                            );

                            const allChangesAreMapped = item.changes.every(
                              (c) =>
                                mappedTuples.has(
                                  `${c.field.replace(/^payload\./, "")}|${String(c.from)}|${String(c.to)}`,
                                ),
                            );

                            if (allChangesAreMapped) return false;
                          }

                          return true;
                        })
                        .map((item) => {
                          const isExpanded = expandedHistoryIds.has(
                            item.log_id,
                          );
                          const toggleExpand = () =>
                            setExpandedHistoryIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(item.log_id)) {
                                next.delete(item.log_id);
                              } else {
                                next.add(item.log_id);
                              }
                              return next;
                            });
                          return (
                            <div
                              key={item.log_id}
                              className="rounded-lg border border-[--color-border] bg-[--color-panel]"
                            >
                              <button
                                type="button"
                                className="flex w-full flex-wrap items-center justify-between gap-2 p-3 text-left"
                                onClick={toggleExpand}
                              >
                                <div className="flex items-center gap-2">
                                  <Badge tone={auditActionTone(item.action)}>
                                    {auditActionLabel(item.action)}
                                  </Badge>
                                  <span className="text-xs text-[--color-text-muted]">
                                    by{" "}
                                    <span className="font-medium text-[--color-text]">
                                      {resolveAuditActor(item.actor)}
                                    </span>
                                  </span>
                                </div>
                                <span className="ml-auto flex items-center gap-1.5 text-xs text-[--color-text-muted]">
                                  {item.changed_at
                                    ? new Intl.DateTimeFormat(undefined, {
                                        year: "numeric",
                                        month: "short",
                                        day: "2-digit",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                        second: "2-digit",
                                        timeZoneName: "short",
                                      }).format(new Date(item.changed_at))
                                    : "—"}
                                  <ChevronDown
                                    size={13}
                                    className={`shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                  />
                                </span>
                              </button>
                              <AnimatePresence initial={false}>
                                {isExpanded && (
                                  <motion.div
                                    key="body"
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{
                                      duration: 0.15,
                                      ease: "easeInOut",
                                    }}
                                    className="overflow-hidden"
                                  >
                                    <div className="border-t border-[--color-border] px-3 pb-3 pt-2">
                                      {item.changes.length > 0 ? (
                                        <div className="space-y-1.5">
                                          {item.changes.map((change, i) => {
                                            const isPluginsEvent =
                                              item.action === "plugins_updated";
                                            const structured =
                                              renderStructuredLeadHistoryChange(
                                                change.field,
                                                change.from,
                                                change.to,
                                                `${item.log_id}-${i}`,
                                              );
                                            if (structured) {
                                              return structured;
                                            }
                                            const pluginDisplayNames: Record<
                                              string,
                                              string
                                            > = {
                                              duplicate_check:
                                                "Duplicate Check",
                                              trusted_form: "TrustedForm",
                                              ipqs: "IPQS",
                                            };
                                            const rawField =
                                              change.field.replace(
                                                /^payload\./,
                                                "",
                                              );
                                            let fieldLabel: string;
                                            if (
                                              isPluginsEvent &&
                                              rawField.includes(".")
                                            ) {
                                              const dotIdx =
                                                rawField.indexOf(".");
                                              const pluginKey = rawField.slice(
                                                0,
                                                dotIdx,
                                              );
                                              const pluginPath = rawField
                                                .slice(dotIdx + 1)
                                                .split(".")
                                                .map((segment) =>
                                                  normalizeFieldLabel(segment),
                                                )
                                                .join(" · ");
                                              const pluginName =
                                                pluginDisplayNames[pluginKey] ??
                                                normalizeFieldLabel(pluginKey);
                                              fieldLabel = `${pluginName} — ${pluginPath}`;
                                            } else {
                                              fieldLabel = normalizeFieldLabel(
                                                rawField.includes(".")
                                                  ? rawField.split(".").pop()!
                                                  : rawField,
                                              );
                                            }
                                            return (
                                              <div
                                                key={`${item.log_id}-${i}`}
                                                className="flex flex-col gap-0.5 rounded bg-[--color-bg-muted] px-2 py-1.5 text-xs"
                                              >
                                                <span className="font-semibold text-[--color-text-strong]">
                                                  {fieldLabel}
                                                </span>
                                                <span className="flex items-center gap-1 text-[--color-text-muted]">
                                                  <span className="line-through">
                                                    {formatAuditValue(
                                                      change.from,
                                                    )}
                                                  </span>
                                                  <ArrowRight
                                                    size={10}
                                                    className="shrink-0"
                                                  />
                                                  <span className="font-medium text-[--color-text]">
                                                    {formatAuditValue(
                                                      change.to,
                                                    )}
                                                  </span>
                                                </span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <p className="text-xs text-[--color-text-muted]">
                                          No field-level changes recorded.
                                        </p>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </motion.div>
              )}
              {/* ── Delivery ── */}
              {activeTab === "delivery" && (
                <motion.div
                  key="delivery"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                >
                  {currentLead.delivery_result ? (
                    <div className="space-y-4">
                      {/* Status banner */}
                      <div
                        className={`flex items-center gap-2 rounded-lg border px-4 py-3 ${
                          currentLead.delivery_result.accepted
                            ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400"
                            : "border-[--color-danger]/30 bg-[--color-danger]/10 text-[--color-danger]"
                        }`}
                      >
                        {currentLead.delivery_result.accepted ? (
                          <Check size={15} className="shrink-0" />
                        ) : (
                          <X size={15} className="shrink-0" />
                        )}
                        <span className="text-sm font-semibold">
                          {currentLead.delivery_result.accepted
                            ? "Accepted by client"
                            : "Rejected by client"}
                        </span>
                        {currentLead.delivery_result.acceptance_match && (
                          <span className="ml-auto text-xs opacity-75">
                            Match:{" "}
                            <span className="font-mono">
                              {currentLead.delivery_result.acceptance_match}
                            </span>
                          </span>
                        )}
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-3">
                          <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
                            Client
                          </p>
                          {onOpenClient ? (
                            <button
                              type="button"
                              onClick={() =>
                                onOpenClient(
                                  currentLead.delivery_result!.client_id,
                                )
                              }
                              className="mt-0.5 text-sm font-medium text-[--color-primary] hover:underline"
                            >
                              {clients?.find(
                                (c) =>
                                  c.id ===
                                  currentLead.delivery_result!.client_id,
                              )?.name ?? currentLead.delivery_result.client_id}
                            </button>
                          ) : (
                            <p className="mt-0.5 text-sm font-medium text-[--color-text-strong]">
                              {clients?.find(
                                (c) =>
                                  c.id ===
                                  currentLead.delivery_result!.client_id,
                              )?.name ?? currentLead.delivery_result.client_id}
                            </p>
                          )}
                        </div>
                        <InfoItem
                          label="Delivered At"
                          value={new Intl.DateTimeFormat(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                            timeZoneName: "short",
                          }).format(
                            new Date(currentLead.delivery_result.delivered_at),
                          )}
                        />
                        <InfoItem
                          label="Distribution Mode"
                          value={
                            currentLead.delivery_result.distribution_mode ===
                            "weighted"
                              ? "Weighted"
                              : "Round Robin"
                          }
                        />
                        {currentLead.delivery_result.distribution_mode ===
                          "weighted" && (
                          <InfoItem
                            label="Weight at Delivery"
                            value={`${currentLead.delivery_result.client_weight_at_delivery}`}
                          />
                        )}
                        <InfoItem
                          label="Webhook Method"
                          value={currentLead.delivery_result.webhook_method}
                        />
                        <InfoItem
                          label="Webhook URL"
                          value={
                            <span className="break-all font-mono text-xs">
                              {currentLead.delivery_result.webhook_url}
                            </span>
                          }
                        />
                        {currentLead.delivery_result.webhook_response_status !=
                          null && (
                          <InfoItem
                            label="HTTP Status"
                            value={
                              <Badge
                                tone={
                                  currentLead.delivery_result
                                    .webhook_response_status >= 200 &&
                                  currentLead.delivery_result
                                    .webhook_response_status < 300
                                    ? "success"
                                    : "danger"
                                }
                              >
                                {
                                  currentLead.delivery_result
                                    .webhook_response_status
                                }
                              </Badge>
                            }
                          />
                        )}
                        {currentLead.delivery_result.error && (
                          <div className="md:col-span-2">
                            <InfoItem
                              label="Error"
                              value={
                                <span className="text-[--color-danger]">
                                  {currentLead.delivery_result.error}
                                </span>
                              }
                            />
                          </div>
                        )}
                      </div>

                      {currentLead.delivery_result.webhook_response_body && (
                        <div>
                          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[--color-text-muted]">
                            Response Body
                          </p>
                          <pre className="max-h-40 overflow-auto rounded-lg bg-[--color-bg-muted] p-3 text-[11px] leading-relaxed text-[--color-text]">
                            {(() => {
                              try {
                                return JSON.stringify(
                                  JSON.parse(
                                    currentLead.delivery_result
                                      .webhook_response_body!,
                                  ),
                                  null,
                                  2,
                                );
                              } catch {
                                return currentLead.delivery_result
                                  .webhook_response_body;
                              }
                            })()}
                          </pre>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-12 text-center">
                      <p className="text-sm text-[--color-text-muted]">
                        No delivery data available for this lead.
                      </p>
                      {currentLead.test && (
                        <p className="mt-1 text-xs text-[--color-text-muted]">
                          Test leads are not delivered to clients.
                        </p>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </Modal>

      {/* Confirm payload save */}
      <Modal
        title="Confirm Payload Edit"
        isOpen={confirmSave}
        onClose={() => setConfirmSave(false)}
        width={460}
      >
        <div className="space-y-4 text-sm">
          <p className="text-[--color-text]">
            You are about to overwrite lead payload fields in the database. This
            action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmSave(false)}>
              Cancel
            </Button>
            <Button
              disabled={savingPayload}
              onClick={async () => {
                setSavingPayload(true);
                try {
                  const newPayload: Record<string, unknown> = {};
                  Object.entries(localPayload).forEach(([k, v]) => {
                    // Send only changed keys so audit/logging reflects actual edits.
                    if (v === (originalPayloadRef.current[k] ?? "")) return;
                    try {
                      newPayload[k] = JSON.parse(v);
                    } catch {
                      newPayload[k] = v;
                    }
                  });
                  const res = await updateLead(currentLead.id, {
                    payload: newPayload,
                  });
                  if (!(res as any)?.success)
                    throw new Error((res as any)?.message || "Failed to save");
                  const updated = (res as any)?.data as Lead;
                  setSelectedLead(updated);
                  const strPayload: Record<string, string> = {};
                  Object.entries(updated.payload || {}).forEach(([k, v]) => {
                    strPayload[k] =
                      typeof v === "object"
                        ? JSON.stringify(v)
                        : String(v ?? "");
                  });
                  setLocalPayload(strPayload);
                  originalPayloadRef.current = { ...strPayload };
                  setConfirmSave(false);
                  toast.success("Lead payload updated");
                  // Re-fetch audit trail so the History tab and field highlights
                  // immediately reflect the new change.
                  refreshAudit();
                } catch (err: any) {
                  toast.error(err?.message || "Unable to update lead payload");
                } finally {
                  setSavingPayload(false);
                }
              }}
            >
              {savingPayload ? "Saving\u2026" : "Confirm Save"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
