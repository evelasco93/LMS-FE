import type React from "react";

export function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-[--color-text-strong]">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}
