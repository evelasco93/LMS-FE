"use client";

import { motion } from "framer-motion";

export function HomeView() {
  return (
    <motion.section
      key="home"
      className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-6 text-center"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <div className="rounded-2xl border border-dashed border-[--color-border] bg-[--color-panel] px-16 py-14 flex flex-col items-center gap-3 shadow-inner">
        <p className="text-4xl select-none">📊</p>
        <p className="text-lg font-semibold text-[--color-text-strong]">
          Metrics &amp; Dashboard
        </p>
        <p className="text-sm text-[--color-text-muted] max-w-xs">
          This area will show key performance metrics, summaries, and insights.
          Coming soon.
        </p>
      </div>
    </motion.section>
  );
}
