import { cva, type VariantProps } from "class-variance-authority";
import clsx from "clsx";
import React from "react";

const buttonStyles = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary:
          "bg-[--color-primary] text-white hover:bg-[--color-primary-hover] focus-visible:outline-[--color-primary]",
        secondary:
          "bg-[--color-secondary] text-[--color-text-strong] hover:opacity-90 focus-visible:outline-[--color-secondary]",
        ghost:
          "bg-transparent text-[--color-text] hover:bg-[--color-row-hover] focus-visible:outline-[--color-border]",
        outline:
          "border border-[--color-border] text-[--color-text-strong] hover:bg-[--color-row-hover] focus-visible:outline-[--color-border]",
        danger:
          "bg-[--color-danger] text-white hover:opacity-90 focus-visible:outline-[--color-danger]",
      },
      size: {
        sm: "px-3 py-2 text-xs",
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
