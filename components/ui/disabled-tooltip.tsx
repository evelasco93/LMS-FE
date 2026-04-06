"use client";

import type React from "react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";

export function DisabledTooltip({
  children,
  message,
  inline,
}: {
  children: React.ReactNode;
  message: string;
  inline?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  if (!message) return <>{children}</>;

  const show = () => {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPos({ top: r.top, left: r.left + r.width / 2 });
      setVisible(true);
    }
  };
  const hide = () => setVisible(false);

  return (
    <div
      ref={triggerRef}
      className={inline ? "inline-flex" : "inline-block w-full"}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          visible ? (
            <div
              style={{
                position: "fixed",
                top: pos.top - 8,
                left: pos.left,
                transform: "translate(-50%, -100%)",
                zIndex: 9999,
              }}
              className="pointer-events-none w-64 rounded-lg border border-[--color-border] bg-[--color-panel] px-3 py-2 text-center text-xs text-[--color-text-muted] shadow-lg"
            >
              {message}
            </div>
          ) : null,
          document.body,
        )}
    </div>
  );
}
