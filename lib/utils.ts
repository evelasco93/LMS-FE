export function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function formatPhone(value?: string) {
  if (!value) return "—";
  if (value.startsWith("+")) return value;
  const cleaned = value.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return value;
}

export const statusColorMap: Record<
  string,
  "success" | "warning" | "danger" | "info" | "neutral"
> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
  TEST: "info",
  LIVE: "success",
  DISABLED: "neutral",
  PAUSED: "warning",
  TERMINATED: "danger",
  DRAFT: "warning",
};

export function generateCodeFromName(name: string, fallback: string) {
  if (fallback) return fallback;
  const words = name.trim().split(/\s+/).filter(Boolean);
  let letters = "";

  if (words.length === 0) {
    letters = "XXX";
  } else if (words.length === 1) {
    letters = words[0].slice(0, 3);
  } else if (words.length === 2) {
    letters = `${words[0].slice(0, 2)}${words[1].slice(0, 1)}`;
  } else {
    letters = `${words[0].slice(0, 1)}${words[1].slice(0, 1)}${words[2].slice(0, 1)}`;
  }

  const randomDigits = Math.floor(100 + Math.random() * 900);
  return `${letters.toUpperCase()}${randomDigits}`;
}

export const inputClass =
  "w-full rounded-lg border border-[--color-border] bg-[--color-panel] px-3 py-2 text-sm text-[--color-text] outline-none transition-shadow focus:border-[--color-primary] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_35%,transparent)]";

/**
 * Smart field label normalizer — handles snake_case, camelCase, PascalCase,
 * kebab-case, dot.case, SCREAMING_SNAKE, and mixed forms.
 * Known abbreviations (id, url, utm, ip, etc.) are uppercased automatically.
 */
const UPPER_ABBREVS = new Set([
  "id",
  "url",
  "utm",
  "ip",
  "ipqs",
  "qa",
  "api",
  "ssl",
  "ssn",
  "dob",
  "sms",
  "tid",
  "sid",
  "lid",
  "cid",
  "uid",
  "pid",
]);

export function normalizeFieldLabel(key: string): string {
  const words = key
    // camelCase / PascalCase boundary: fooBar → foo Bar
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    // Acronym boundary: XMLParser → XML Parser
    .replace(/([A-Z]{2,})([A-Z][a-z])/g, "$1 $2")
    // Delimiters → spaces
    .replace(/[_\-\.]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .split(" ")
    .filter(Boolean);

  return words
    .map((w) =>
      UPPER_ABBREVS.has(w)
        ? w.toUpperCase()
        : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(" ");
}

export function formatRejectionDisplayText(text?: string | null): string {
  if (!text) return "";

  return text
    .split(/([;:\n])/)
    .map((chunk) => {
      if (chunk === ";" || chunk === ":" || chunk === "\n") return chunk;
      return chunk
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => {
          const cleaned = word.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
          if (!cleaned) return word;
          const lower = cleaned.toLowerCase();
          if (UPPER_ABBREVS.has(lower)) {
            return word.replace(cleaned, lower.toUpperCase());
          }
          return word.replace(
            cleaned,
            lower.charAt(0).toUpperCase() + lower.slice(1),
          );
        })
        .join(" ");
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The API occasionally returns user objects {sub, full_name, first_name,
 * last_name, email, …} instead of plain strings for created_by / updated_by
 * fields.  Prefers full name over email.
 */
export const resolveDisplayName = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === "string") return value || null;
  if (typeof value === "object") {
    const u = value as Record<string, unknown>;
    const firstLast = [
      typeof u.first_name === "string" ? u.first_name : "",
      typeof u.last_name === "string" ? u.last_name : "",
    ]
      .filter(Boolean)
      .join(" ");
    return (
      (typeof u.full_name === "string" && u.full_name) ||
      firstLast ||
      (typeof u.email === "string" && u.email) ||
      (typeof u.username === "string" && u.username) ||
      (typeof u.sub === "string" && u.sub) ||
      null
    );
  }
  return String(value);
};
