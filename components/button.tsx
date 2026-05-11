import { cva, type VariantProps } from "class-variance-authority";
import clsx from "clsx";
import React from "react";

const buttonStyles = cva(
  "inline-flex items-center justify-center gap-2 rounded-[--radius-pill] border border-transparent px-3.5 py-2.5 text-sm font-semibold transition-[background-color,border-color,box-shadow,transform,color] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      variant: {
        primary:
          "bg-[--color-primary] text-white shadow-[4px_4px_12px_color-mix(in_srgb,var(--color-primary)_28%,transparent)] hover:bg-[--color-primary-hover] hover:shadow-[6px_6px_14px_color-mix(in_srgb,var(--color-primary)_32%,transparent)] focus-visible:outline-[--color-primary]",
        secondary:
          "bg-[--color-secondary] text-[--color-text-strong] shadow-[4px_4px_12px_color-mix(in_srgb,var(--color-secondary)_24%,transparent)] hover:opacity-95 focus-visible:outline-[--color-secondary]",
        ghost:
          "bg-[color-mix(in_srgb,var(--color-panel)_65%,transparent)] text-[--color-text] border-[color-mix(in_srgb,var(--color-border)_75%,transparent)] hover:bg-[--color-row-hover] focus-visible:outline-[--color-border]",
        outline:
          "border-[--color-border] bg-[color-mix(in_srgb,var(--color-panel)_84%,var(--color-bg-subtle))] text-[--color-text-strong] shadow-[3px_3px_10px_color-mix(in_srgb,var(--color-text-strong)_8%,transparent)] hover:bg-[--color-row-hover] focus-visible:outline-[--color-border]",
        danger:
          "bg-[--color-danger] text-white shadow-[4px_4px_12px_color-mix(in_srgb,var(--color-danger)_26%,transparent)] hover:opacity-95 focus-visible:outline-[--color-danger]",
      },
      size: {
        sm: "px-3 py-1.5 text-xs",
        md: "px-3.5 py-2.5 text-sm",
        lg: "px-4 py-3 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonStyles> & {
    iconLeft?: React.ReactNode;
    iconRight?: React.ReactNode;
  };

export function Button({
  variant,
  size,
  className,
  iconLeft,
  iconRight,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(buttonStyles({ variant, size }), className)}
      {...props}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
}
