import React from "react";
import { X } from "lucide-react";
import { Button } from "./button";

interface ModalProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: number | string;
}

export function Modal({
  title,
  isOpen,
  onClose,
  children,
  width = 560,
}: ModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="panel w-full" style={{ maxWidth: width }}>
        <header className="flex items-center justify-between border-b border-[--color-border] px-5 py-4">
          <h3 className="text-lg font-semibold text-[--color-text-strong]">
            {title}
          </h3>
          <Button
            aria-label="Close"
            variant="ghost"
            size="sm"
            onClick={onClose}
            iconLeft={<X size={16} />}
          />
        </header>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
