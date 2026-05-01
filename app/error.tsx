"use client";

import { useEffect } from "react";
import { Button } from "@/components/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h2 className="text-xl font-semibold text-[--color-text-strong]">
        Something went wrong
      </h2>
      <p className="max-w-md text-sm text-[--color-text-muted]">
        We hit an unexpected issue while loading this view. Try again, and if it
        continues please contact support.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
