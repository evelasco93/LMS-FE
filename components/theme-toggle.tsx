"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex items-center gap-1.5 rounded-full border border-[--color-border] bg-[--color-panel] px-2 py-1.5 text-[--color-text-muted] transition hover:border-[--color-primary] hover:text-[--color-primary]"
    >
      {/* Sun */}
      <Sun
        size={13}
        className={`transition-opacity ${
          isDark ? "opacity-35" : "text-[--color-primary] opacity-100"
        }`}
      />
      {/* Track */}
      <div className="relative h-[18px] w-8 rounded-full border border-[--color-border] bg-[--color-bg-muted] transition-colors">
        <div
          className={`absolute top-[1px] h-[14px] w-[14px] rounded-full bg-[--color-primary] shadow transition-all duration-200 ${
            isDark ? "left-[15px]" : "left-[1px]"
          }`}
        />
      </div>
      {/* Moon */}
      <Moon
        size={13}
        className={`transition-opacity ${
          isDark ? "text-[--color-primary] opacity-100" : "opacity-35"
        }`}
      />
    </button>
  );
}
