"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { listUsers } from "@/lib/api";

/** Converts an email address to a readable display name.
 *  e.g. "edgar.velasco@example.com" → "Edgar Velasco"
 *       "edgar@example.com"          → "Edgar"
 */
function emailToDisplayName(email: string): string {
  const local = email.split("@")[0];
  return local
    .split(/[._\-+]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Shared hook — fetches users once (SWR deduplicates) and returns a resolver
 * function that converts any author value (plain string, RequestActor object)
 * to the best available display name.
 *
 * Resolution order:
 *  1. full_name / first_name+last_name from embedded RequestActor fields
 *  2. firstName+lastName from the users list (matched by email or username)
 *  3. Email-local-part fallback: "edgar@..." → "Edgar"
 *  4. Plain string as-is
 */
export function useAuthorResolver(): (value: unknown) => string | null {
  const { data: usersRaw = [] } = useSWR("users:name-map", async () => {
    try {
      const res = await listUsers();
      return (res as any)?.data || [];
    } catch {
      return [];
    }
  });

  return useMemo(() => {
    // Build map: email/username → full name (only when name actually exists)
    const map = new Map<string, string>();
    (usersRaw as any[]).forEach((u: any) => {
      const full = [u.firstName, u.lastName].filter(Boolean).join(" ");
      if (full) {
        if (u.email) map.set(u.email.toLowerCase(), full);
        if (u.username) map.set(u.username.toLowerCase(), full);
      }
    });

    return (value: unknown): string | null => {
      if (!value) return null;

      if (typeof value === "string") {
        const lower = value.toLowerCase();
        if (map.has(lower)) return map.get(lower)!;
        // Email fallback: extract and title-case the local part
        if (value.includes("@")) return emailToDisplayName(value);
        return value || null;
      }

      if (typeof value === "object") {
        const u = value as Record<string, unknown>;
        // 1. Embedded name fields from RequestActor
        const first = typeof u.first_name === "string" ? u.first_name : "";
        const last = typeof u.last_name === "string" ? u.last_name : "";
        const fromParts = [first, last].filter(Boolean).join(" ");
        const fullName =
          (typeof u.full_name === "string" && u.full_name) || fromParts;
        if (fullName) return fullName;
        // 2. Look up in users list
        const email = typeof u.email === "string" ? u.email : "";
        const username = typeof u.username === "string" ? u.username : "";
        const key = email || username;
        if (key) {
          const fromMap = map.get(key.toLowerCase());
          if (fromMap) return fromMap;
          // 3. Email fallback
          if (email.includes("@")) return emailToDisplayName(email);
          return key;
        }
      }

      return String(value);
    };
  }, [usersRaw]);
}
