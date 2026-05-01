"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global app error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="text-2xl font-semibold">Application error</h1>
          <p className="max-w-md text-sm opacity-80">
            A critical error occurred. Please retry the action.
          </p>
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-black px-4 py-2 text-white"
          >
            Reload view
          </button>
        </main>
      </body>
    </html>
  );
}
