"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/button";

const inputClass =
  "w-full rounded-lg border border-[--color-border] bg-[--color-panel] px-3 py-2 text-sm text-[--color-text] outline-none transition-shadow focus:border-[--color-primary] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_28%,transparent)]";

function OrbitLoader() {
  return (
    <svg
      width="86"
      height="86"
      viewBox="0 0 86 86"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Signing in…"
      role="img"
    >
      <defs>
        <linearGradient
          id="planetGradient"
          x1="30"
          y1="27"
          x2="58"
          y2="59"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#e0f2f9" />
          <stop offset="42%" stopColor="#1e73b1" />
          <stop offset="100%" stopColor="#051083" />
        </linearGradient>
        <linearGradient id="moonGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#81cff0" />
          <stop offset="100%" stopColor="#2550a2" />
        </linearGradient>
      </defs>

      <g transform="rotate(-63 43 43)">
        <ellipse
          cx="43"
          cy="43"
          rx="30"
          ry="11"
          fill="none"
          stroke="color-mix(in_srgb,var(--color-primary)_40%,var(--color-border))"
          strokeWidth="1.35"
          strokeDasharray="4 6"
        />
      </g>

      <motion.g
        initial={{ rotate: 0 }}
        animate={{ rotate: [0, 360] }}
        transition={{
          duration: 1.7,
          repeat: Infinity,
          repeatType: "loop",
          ease: "linear",
        }}
        style={{ transformOrigin: "43px 43px", transformBox: "view-box" }}
      >
        <circle cx="43" cy="43" r="18" fill="url(#planetGradient)" />
        <ellipse
          cx="43"
          cy="39"
          rx="10"
          ry="3.6"
          fill="none"
          stroke="color-mix(in_srgb,#e0f2f9_70%,transparent)"
          strokeWidth="1"
        />
      </motion.g>

      <g transform="rotate(-63 43 43)">
        <motion.g
          initial={{ rotate: 0 }}
          animate={{ rotate: [0, 360] }}
          transition={{
            duration: 2.6,
            repeat: Infinity,
            repeatType: "loop",
            ease: "linear",
          }}
          style={{ transformOrigin: "43px 43px", transformBox: "view-box" }}
        >
          <g transform="translate(75 43)">
            <motion.g
              animate={{ scale: [0.92, 1.02, 0.92] }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                repeatType: "mirror",
                ease: "easeInOut",
              }}
            >
              <circle cx="0" cy="0" r="5.5" fill="url(#moonGradient)" />
              <ellipse
                cx="0"
                cy="0"
                rx="8"
                ry="6"
                fill="none"
                stroke="color-mix(in_srgb,#2550a2_46%,transparent)"
                strokeWidth="1"
              />
            </motion.g>
          </g>
        </motion.g>
      </g>
    </svg>
  );
}

interface SignInScreenProps {
  onSignIn: (email: string, password: string) => Promise<void>;
  error?: string | null;
}

export function SignInScreen({ onSignIn, error }: SignInScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);

    try {
      await onSignIn(email.trim(), password);
      // On success, keep pending=true so the loader stays visible
      // while the parent's AnimatePresence transitions away
    } catch {
      setPending(false);
    }
  };

  return (
    <motion.main
      className="flex min-h-screen items-center justify-center bg-[--color-bg] px-4 text-[--color-text]"
      style={{
        backgroundImage:
          "radial-gradient(circle at 20% 10%, color-mix(in_srgb, var(--color-primary) 14%, transparent), transparent 38%), radial-gradient(circle at 85% 90%, color-mix(in_srgb, var(--color-secondary) 12%, transparent), transparent 42%)",
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: "easeInOut" }}
    >
      <motion.div
        initial={{ y: 18 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-[--color-border] bg-[--color-panel] p-8 shadow-xl"
      >
        {/* ── Logo ── */}
        <div className="mb-4 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Summit Edge Legal"
            onError={(e) => {
              e.currentTarget.src = "/logo.png";
            }}
            style={{
              width: 250,
              maxWidth: "100%",
              objectFit: "contain",
              display: "block",
            }}
          />
        </div>

        {/* ── Loader or form ── */}
        <div className="min-h-[220px] flex flex-col">
          <AnimatePresence mode="wait" initial={false}>
            {pending ? (
              <motion.div
                key="loader"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="relative flex flex-1 flex-col items-center justify-center gap-3"
              >
                <OrbitLoader />
                <p className="text-sm text-[--color-text-muted]">Signing in…</p>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div className="space-y-1">
                    <label
                      htmlFor="email"
                      className="block text-sm text-[--color-text-strong]"
                    >
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      className={inputClass}
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="password"
                      className="block text-sm text-[--color-text-strong]"
                    >
                      Password
                    </label>
                    <input
                      id="password"
                      type="password"
                      required
                      autoComplete="current-password"
                      className={inputClass}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>

                  {error ? (
                    <p className="rounded-md border border-[color-mix(in_srgb,var(--color-danger)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] px-3 py-2 text-sm text-[--color-danger]">
                      {error}
                    </p>
                  ) : null}

                  <Button type="submit" className="w-full">
                    Sign in
                  </Button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Help note ── */}
        <p className="mt-6 text-center text-xs text-[--color-text-muted]">
          Having trouble with your password?{" "}
          <span className="text-[--color-primary]">
            Contact your administrator for assistance.
          </span>
        </p>
      </motion.div>
    </motion.main>
  );
}
