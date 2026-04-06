import React, { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "./button";

/* ------------------------------------------------------------------ */
/*  Module-level modal stack – only the topmost modal handles Escape  */
/* ------------------------------------------------------------------ */
let nextId = 0;
const stack: number[] = [];

function pushModal(): number {
  const id = nextId++;
  stack.push(id);
  return id;
}
function popModal(id: number) {
  const idx = stack.indexOf(id);
  if (idx !== -1) stack.splice(idx, 1);
}
function isTopModal(id: number): boolean {
  return stack.length > 0 && stack[stack.length - 1] === id;
}

/* ------------------------------------------------------------------ */

interface ModalProps {
  title: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: number | string;
  bodyClassName?: string;
  /** When true, Escape shows a discard-changes confirmation instead of closing immediately. */
  hasUnsavedChanges?: boolean;
}

export function Modal({
  title,
  isOpen,
  onClose,
  children,
  width = 560,
  bodyClassName,
  hasUnsavedChanges = false,
}: ModalProps) {
  const stackId = useRef<number | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Register / deregister from the module-level stack
  useEffect(() => {
    if (isOpen) {
      stackId.current = pushModal();
      return () => {
        if (stackId.current !== null) {
          popModal(stackId.current);
          stackId.current = null;
        }
      };
    } else if (stackId.current !== null) {
      popModal(stackId.current);
      stackId.current = null;
    }
  }, [isOpen]);

  const tryClose = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  }, [hasUnsavedChanges, onClose]);

  // Escape handler — only fires for the topmost modal
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        stackId.current !== null &&
        isTopModal(stackId.current)
      ) {
        e.stopImmediatePropagation();
        if (showDiscardConfirm) {
          // The discard confirmation is showing — dismiss it (cancel)
          setShowDiscardConfirm(false);
        } else {
          tryClose();
        }
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [isOpen, tryClose, showDiscardConfirm]);

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
                onClick={tryClose}
                iconLeft={<X size={16} />}
              />
            </header>
            <div className={bodyClassName ?? "px-5 py-4"}>{children}</div>

            {/* Discard unsaved changes confirmation */}
            <AnimatePresence>
              {showDiscardConfirm && (
                <motion.div
                  className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/40 backdrop-blur-[2px]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="panel mx-4 max-w-sm space-y-4 p-5">
                    <p className="text-sm font-medium text-[--color-text-strong]">
                      You have unsaved changes
                    </p>
                    <p className="text-sm text-[--color-text-muted]">
                      Are you sure you want to discard your changes?
                    </p>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowDiscardConfirm(false)}
                      >
                        Keep Editing
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          setShowDiscardConfirm(false);
                          onClose();
                        }}
                      >
                        Discard
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
