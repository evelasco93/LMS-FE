"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

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

        const params = new URLSearchParams(merged);
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
