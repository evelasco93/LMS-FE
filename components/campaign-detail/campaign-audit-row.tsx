"use client";

import { useState } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import type { AuditLogItem } from "@/lib/types";
import {
  auditActionLabel,
  formatAuditChangeValue,
  formatAuditFieldLabel,
  formatLogDate,
  getMeaningfulAuditChanges,
} from "./utils";

export function CampaignAuditRow({
  item,
  clientNameById,
  affiliateNameById,
}: {
  item: AuditLogItem;
  clientNameById: Map<string, string>;
  affiliateNameById: Map<string, string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const actor = item.actor
    ? item.actor.full_name ||
      item.actor.email ||
      item.actor.username ||
      "Unknown"
    : "System";
  const changes = getMeaningfulAuditChanges(item);
  const hasChanges = changes.length > 0;

  return (
    <div>
      <button
        type="button"
        onClick={() => hasChanges && setExpanded((v) => !v)}
        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
          hasChanges
            ? "cursor-pointer hover:bg-[--color-bg-muted]"
            : "cursor-default"
        } ${expanded ? "bg-[--color-bg-muted]" : ""}`}
      >
        <span className="w-48 shrink-0 text-[11px] text-[--color-text-muted]">
          {item.changed_at ? formatLogDate(item.changed_at) : "\u2014"}
        </span>
        <span className="w-32 shrink-0 truncate text-sm font-medium text-[--color-text]">
          {actor}
        </span>
        <span className="flex flex-1 items-center gap-1.5 truncate text-sm text-[--color-text-muted]">
          {auditActionLabel(item.action)}
        </span>
        {hasChanges && (
          <ChevronDown
            size={14}
            className={`shrink-0 text-[--color-text-muted] transition-transform duration-150 ${
              expanded ? "rotate-180" : ""
            }`}
          />
        )}
      </button>
      {expanded && hasChanges && (
        <div className="border-t border-[--color-border] bg-[--color-bg-muted] px-4 py-3">
          <div className="space-y-2 pl-2">
            {changes.map((ch, i) => {
              const isAddedValue = ch.from == null && ch.to != null;
              return (
                <div
                  key={i}
                  className="grid grid-cols-[10rem_1fr] items-start gap-2 text-[11px]"
                >
                  <span className="truncate font-medium text-[--color-text]">
                    {formatAuditFieldLabel(
                      ch.field,
                      clientNameById,
                      affiliateNameById,
                    )}
                  </span>
                  {isAddedValue ? (
                    <span className="font-medium text-[--color-text]">
                      {formatAuditChangeValue(
                        ch.to,
                        ch.field,
                        clientNameById,
                        affiliateNameById,
                      )}
                    </span>
                  ) : (
                    <span className="flex min-w-0 items-center gap-1.5 text-[--color-text-muted]">
                      <span className="max-w-[140px] truncate line-through">
                        {formatAuditChangeValue(
                          ch.from,
                          ch.field,
                          clientNameById,
                          affiliateNameById,
                        )}
                      </span>
                      <ArrowRight size={9} className="shrink-0" />
                      <span className="max-w-[140px] truncate font-medium text-[--color-text]">
                        {formatAuditChangeValue(
                          ch.to,
                          ch.field,
                          clientNameById,
                          affiliateNameById,
                        )}
                      </span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
