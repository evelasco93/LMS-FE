import React from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "./button";

interface ModalProps {
  title: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: number | string;
  bodyClassName?: string;
}

export function Modal({
  title,
  isOpen,
  onClose,
  children,
  width = 560,
  bodyClassName,
}: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="panel w-full"
            style={{ maxWidth: width }}
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
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
            <div className={bodyClassName ?? "px-5 py-4"}>{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
