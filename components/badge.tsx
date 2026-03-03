import clsx from "clsx";
import React from "react";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const toneMap: Record<Tone, string> = {
  success:
    "bg-[color-mix(in_srgb,var(--color-success)_15%,transparent)] text-[--color-success] border border-[color-mix(in_srgb,var(--color-success)_25%,transparent)]",
  warning:
    "bg-[color-mix(in_srgb,var(--color-warning)_18%,transparent)] text-[--color-warning] border border-[color-mix(in_srgb,var(--color-warning)_25%,transparent)]",
  danger:
    "bg-[color-mix(in_srgb,var(--color-danger)_18%,transparent)] text-[--color-danger] border border-[color-mix(in_srgb,var(--color-danger)_25%,transparent)]",
  info: "bg-[color-mix(in_srgb,var(--color-info)_18%,transparent)] text-[--color-info] border border-[color-mix(in_srgb,var(--color-info)_25%,transparent)]",
  neutral:
    "bg-[color-mix(in_srgb,var(--color-text-muted)_12%,transparent)] text-[--color-text] border border-[color-mix(in_srgb,var(--color-border)_80%,transparent)]",
};

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        toneMap[tone],
      )}
    >
      {children}
    </span>
  );
}
