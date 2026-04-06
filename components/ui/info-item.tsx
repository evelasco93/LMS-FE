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
      className={`w-full rounded-lg border border-[--color-border] bg-[--color-bg-muted] p-3 text-left ${onClick ? "transition hover:border-[--color-primary]" : ""}`}
    >
      <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
        {label}
      </p>
      <div className="text-sm font-medium text-[--color-text-strong]">
        {value ?? "—"}
      </div>
    </Wrapper>
  );
}
