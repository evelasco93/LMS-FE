import clsx from "clsx";

interface LogoProps {
  mode?: "light" | "dark" | "auto";
  size?: number;
}

/** Renders the actual Summit Edge Legal logo from public/logo.png */
export function MountainMark({ size = 40 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt="Summit Edge Legal"
      width={size}
      height={size}
      style={{ objectFit: "contain", display: "block" }}
    />
  );
}

/** Full horizontal logo: mark + logotype */
export function Logo({ size = 32 }: LogoProps) {
  return (
    <div className="flex items-center gap-2" style={{ height: size }}>
      <MountainMark size={size} />
      <svg
        height={size}
        viewBox="0 0 148 32"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <text
          y="14"
          fontFamily="Inter, system-ui, sans-serif"
          fontSize="10"
          fontWeight="700"
          letterSpacing="2"
          fill="var(--color-nav-text)"
        >
          SUMMIT EDGE
        </text>
        <text
          y="27"
          fontFamily="Inter, system-ui, sans-serif"
          fontSize="10"
          fontWeight="700"
          letterSpacing="2"
          fill="var(--color-nav-text)"
        >
          LEGAL
        </text>
      </svg>
    </div>
  );
}

/** Collapsed sidebar chip */
export function AvatarMark({
  className,
  background = true,
}: {
  className?: string;
  background?: boolean;
}) {
  return (
    <div
      className={clsx(
        "grid place-items-center rounded-lg",
        background &&
          "bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)]",
        className,
      )}
      style={{ width: 40, height: 40 }}
    >
      <MountainMark size={32} />
    </div>
  );
}
