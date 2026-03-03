"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/button";

const inputClass =
  "w-full rounded-lg border border-[--color-border] bg-[--color-panel] px-3 py-2 text-sm text-[--color-text] outline-none transition-shadow focus:border-[--color-primary] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_35%,transparent)]";

/**
 * FlagRaiser — flag rises up the pole once and stays planted at the top.
 * repeatCount="1" + fill="freeze" locks the end state in place.
 */
function FlagRaiser() {
  const DUR_MS = 1200;
  const EASING = "cubic-bezier(0.4,0,0.2,1)";
  const polygonRef = useRef<SVGPolygonElement>(null);
  const waveRef = useRef<SVGAnimateElement>(null);

  useEffect(() => {
    // Start wave + color change after the CSS raise animation finishes.
    // beginElement() is safe here because the wave uses repeatCount="indefinite"
    // and fill="remove" (default) — no snap-to-end issue.
    const t = setTimeout(() => {
      waveRef.current?.beginElement();
      if (polygonRef.current) {
        polygonRef.current.style.transition = "fill 0.6s ease";
        polygonRef.current.style.fill = "var(--color-secondary)";
      }
    }, DUR_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <svg
      width="64"
      height="80"
      viewBox="0 0 60 80"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Signing in…"
    >
      <defs>
        <clipPath id="poleClip">
          <rect x="0" y="0" width="60" height="73" />
        </clipPath>
      </defs>

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

      {/* CSS animation always restarts on mount — no SMIL timeline issues */}
      <g clipPath="url(#poleClip)">
        <g style={{ animation: `flagRaise 1.2s ${EASING} forwards` }}>
          <polygon
            ref={polygonRef}
            points="19,14 44,20 19,26"
            fill="var(--color-primary)"
            opacity="0.9"
          >
            {/* Wave: begin="indefinite" + beginElement() after raise — no fill="freeze" so no snap-to-end */}
            <animate
              ref={waveRef}
              attributeName="points"
              values="19,14 44,20 19,26; 19,14 46,19 19,26; 19,14 43,21 19,26; 19,14 45,19.5 19,26; 19,14 44,20 19,26"
              keyTimes="0; 0.25; 0.5; 0.75; 1"
              begin="indefinite"
              dur="1.8s"
              repeatCount="indefinite"
              calcMode="spline"
              keySplines="0.4 0 0.6 1; 0.4 0 0.6 1; 0.4 0 0.6 1; 0 0 1 1"
            />
          </polygon>
        </g>
      </g>

      {/* Rope dot — CSS animation, circle anchored at final position cy=20, group translates down then up */}
      <g style={{ animation: `ropeRise 1.2s ${EASING} forwards` }}>
        <circle
          cx="18"
          cy="20"
          r="1.6"
          fill="var(--color-text-muted)"
          opacity="0.5"
        />
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: "easeInOut" }}
    >
      <motion.div
        initial={{ y: 18 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-sm rounded-2xl border border-[--color-border] bg-[--color-panel] p-8 shadow-xl overflow-hidden"
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
        <div className="min-h-[220px] flex flex-col">
          <AnimatePresence mode="wait" initial={false}>
            {pending ? (
              <motion.div
                key="loader"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-1 flex-col items-center justify-center gap-3"
              >
                <FlagRaiser />
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
                    <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
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
