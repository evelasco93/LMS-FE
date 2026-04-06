import type React from "react";

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs uppercase tracking-wide text-[--color-text-muted]">
      {children}
    </p>
  );
}
