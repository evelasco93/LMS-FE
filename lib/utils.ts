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
