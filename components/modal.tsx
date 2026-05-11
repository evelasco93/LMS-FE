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
  const titleIdRef = useRef(`modal-title-${Math.random().toString(36).slice(2, 9)}`);
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,black_68%,var(--color-bg))] p-4 backdrop-blur-[4px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleIdRef.current}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="panel relative w-full max-h-[88vh] overflow-hidden border-[color-mix(in_srgb,var(--color-border)_92%,transparent)] shadow-[var(--shadow-soft)]"
            style={{ maxWidth: width }}
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <header className="flex items-center justify-between border-b border-[--color-border] bg-[color-mix(in_srgb,var(--color-panel)_86%,var(--color-bg-subtle))] px-6 py-4">
              <h3
                id={titleIdRef.current}
                className="text-lg font-semibold text-[--color-text-strong]"
              >
                {title}
              </h3>
              <Button
                aria-label="Close"
                variant="ghost"
                size="sm"
                onClick={tryClose}
                className="min-h-[30px] min-w-[30px] rounded-[--radius-pill]"
                iconLeft={<X size={16} />}
              />
            </header>
            <div
              className={
                bodyClassName ??
                "max-h-[calc(88vh-72px)] overflow-y-auto bg-[color-mix(in_srgb,var(--color-panel)_92%,var(--color-bg-subtle))] px-6 py-5"
              }
            >
              {children}
            </div>

            {/* Discard unsaved changes confirmation */}
            <AnimatePresence>
              {showDiscardConfirm && (
                <motion.div
                  className="absolute inset-0 z-10 flex items-center justify-center rounded-[--radius-lg] bg-black/42 backdrop-blur-[2px]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="panel mx-4 max-w-sm overflow-hidden border-[color-mix(in_srgb,var(--color-border)_92%,transparent)] shadow-[var(--shadow-soft)]">
                    <div className="space-y-2 px-5 py-4">
                      <p className="text-sm font-medium text-[--color-text-strong]">
                        You have unsaved changes
                      </p>
                      <p className="text-sm text-[--color-text-muted]">
                        Are you sure you want to discard your changes?
                      </p>
                    </div>
                    <div className="flex justify-end gap-2 border-t border-[--color-border] bg-[color-mix(in_srgb,var(--color-panel)_88%,var(--color-bg-subtle))] px-5 py-3">
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
