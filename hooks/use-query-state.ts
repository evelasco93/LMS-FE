"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const QUERY_PARAM_PRIORITY: string[] = [
  "view",
  "dashboard_mode",
  "campaign",
  "section",
  "subsection",
  "affiliate",
  "window",
  "window_id",
  "window_tab",
  "campaign_scope",
  "campaign_id",
  "campaign_key",
  "affiliate_id",
  "time_preset",
  "from_date",
  "to_date",
  "lead",
  "leadTab",
  "leadQc",
  "leadPt",
];

function toOrderedSearchParams(state: Record<string, string>): URLSearchParams {
  const priorityIndex = new Map(
    QUERY_PARAM_PRIORITY.map((key, index) => [key, index]),
  );
  const orderedKeys = Object.keys(state).sort((left, right) => {
    const leftIndex = priorityIndex.get(left);
    const rightIndex = priorityIndex.get(right);
    if (leftIndex !== undefined && rightIndex !== undefined) {
      return leftIndex - rightIndex;
    }
    if (leftIndex !== undefined) return -1;
    if (rightIndex !== undefined) return 1;
    return left.localeCompare(right);
  });

  const params = new URLSearchParams();
  orderedKeys.forEach((key) => {
    params.set(key, state[key]);
  });
  return params;
}

/**
 * Lightweight URL query-param state manager (no Next.js router overhead).
 * Replaces query params in the URL via replaceState and syncs on popstate.
 */
export function useQueryState() {
  const pathname = usePathname();

  const [queryState, setQueryState] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    const obj: Record<string, string> = {};
    new URLSearchParams(window.location.search).forEach((v, k) => {
      obj[k] = v;
    });
    return obj;
  });

  const getParam = useCallback(
    (key: string): string | null => queryState[key] ?? null,
    [queryState],
  );

  const setQueryParams = useCallback(
    (next: Record<string, string | undefined>) => {
      setQueryState((prev) => {
        const merged = { ...prev };
        Object.entries(next).forEach(([k, v]) => {
          if (v === undefined || v === "") delete merged[k];
          else merged[k] = v;
        });

        // Bail out when nothing actually changed — returning the same ref
        // tells React to skip the re-render, which prevents an infinite loop
        // between Effects that read getParam and call setQueryParams.
        const prevKeys = Object.keys(prev);
        const mergedKeys = Object.keys(merged);
        if (
          prevKeys.length === mergedKeys.length &&
          prevKeys.every((k) => prev[k] === merged[k])
        ) {
          return prev;
        }

        const params = toOrderedSearchParams(merged);
        const qs = params.toString();
        window.history.replaceState(
          window.history.state,
          "",
          qs ? `${pathname}?${qs}` : pathname,
        );
        return merged;
      });
    },
    [pathname],
  );

  // Sync state on browser back / forward
  useEffect(() => {
    const onPop = () => {
      const obj: Record<string, string> = {};
      new URLSearchParams(window.location.search).forEach((v, k) => {
        obj[k] = v;
      });
      setQueryState(obj);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return { getParam, setQueryParams } as const;
}
