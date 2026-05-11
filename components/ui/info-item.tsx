import type React from "react";

export function InfoItem({
  label,
  value,
  onClick,
}: {
  label: string;
  value?: React.ReactNode;
  onClick?: () => void;
}) {
  const Wrapper: React.ElementType = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`min-w-0 w-full rounded-[--radius-sm] border border-[--color-border] bg-[color-mix(in_srgb,var(--color-panel)_92%,var(--color-bg-subtle))] p-3 text-left shadow-[var(--shadow-inset)] ${onClick ? "transition hover:border-[--color-border-alt] hover:bg-[color-mix(in_srgb,var(--color-primary)_10%,var(--color-panel))]" : ""}`}
    >
      <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
        {label}
      </p>
      <div className="min-w-0 break-words text-sm font-medium text-[--color-text-strong]">
        {value ?? "—"}
      </div>
    </Wrapper>
  );
}
