"use client";

import type React from "react";
import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/button";

const inputClass =
  "w-full rounded-lg border border-[--color-border] bg-[--color-panel] px-3 py-2 text-sm text-[--color-text] outline-none transition-shadow focus:border-[--color-primary] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_35%,transparent)]";

/**
 * FlagRaiser — flag rises up the pole once and stays planted at the top.
 * repeatCount="1" + fill="freeze" locks the end state in place.
 */
function FlagRaiser() {
  const DUR = "1.2s";
  return (
    <svg
      width="64"
      height="80"
      viewBox="0 0 60 80"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Signing in…"
    >
      {/* Pole */}
      <line
        x1="18"
        y1="14"
        x2="18"
        y2="72"
        stroke="var(--color-text-muted)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Base */}
      <line
        x1="10"
        y1="72"
        x2="26"
        y2="72"
        stroke="var(--color-text-muted)"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Flag group — rises from base to top, then holds */}
      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0,54; 0,0"
          keyTimes="0; 1"
          dur={DUR}
          repeatCount="1"
          fill="freeze"
          calcMode="spline"
          keySplines="0.4 0 0.2 1"
        />
        {/* Pennant */}
        <polygon
          points="19,14 44,20 19,26"
          fill="var(--color-primary)"
          opacity="0.9"
        >
          {/* Gentle wave starts only after flag reaches top */}
          <animate
            attributeName="points"
            values="19,14 44,20 19,26; 19,14 46,19 19,26; 19,14 43,21 19,26; 19,14 45,19.5 19,26; 19,14 44,20 19,26"
            keyTimes="0; 0.25; 0.5; 0.75; 1"
            begin={DUR}
            dur="1.8s"
            repeatCount="indefinite"
            calcMode="spline"
            keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0 0 1 1"
          />
        </polygon>
      </g>

      {/* Rope dot travels up with the flag */}
      <circle
        cx="18"
        cy="20"
        r="1.6"
        fill="var(--color-text-muted)"
        opacity="0.5"
      >
        <animate
          attributeName="cy"
          values="72; 20"
          keyTimes="0; 1"
          dur={DUR}
          repeatCount="1"
          fill="freeze"
          calcMode="spline"
          keySplines="0.4 0 0.2 1"
        />
      </circle>
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
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[--color-bg] px-4 text-[--color-text]">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-sm rounded-2xl border border-[--color-border] bg-[--color-panel] p-8 shadow-xl"
      >
        {/* ── Logo ── */}
        <div className="mb-2 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo_2.png"
            alt="Summit Edge Legal"
            style={{ width: 280, objectFit: "contain", display: "block" }}
          />
        </div>

        {/* ── Loader or form ── */}
        {pending ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <FlagRaiser />
            <p className="text-sm text-[--color-text-muted]">Signing in…</p>
          </div>
        ) : (
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
              <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {error}
              </p>
            ) : null}

            <Button type="submit" className="w-full">
              Sign in
            </Button>
          </form>
        )}

        {/* ── Help note ── */}
        <p className="mt-6 text-center text-xs text-[--color-text-muted]">
          Having trouble with your password?{" "}
          <span className="text-[--color-primary]">
            Contact your administrator for assistance.
          </span>
        </p>
      </motion.div>
    </main>
  );
}
