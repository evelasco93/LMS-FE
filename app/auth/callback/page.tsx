"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");
  const oauthErrorDescription = searchParams.get("error_description");

  const message = useMemo(() => {
    if (oauthError) {
      return oauthErrorDescription || oauthError;
    }
    if (error) {
      return error;
    }
    return null;
  }, [error, oauthError, oauthErrorDescription]);

  useEffect(() => {
    if (oauthError) return;
    if (!code || !state) {
      setError("Missing OAuth callback parameters.");
      return;
    }

    let mounted = true;

    return () => {
      mounted = false;
    };
  }, [code, state, oauthError, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 px-6 text-slate-100">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-800 p-6 text-center">
        <h1 className="text-lg font-semibold">Completing sign-in...</h1>
        {message ? (
          <p className="mt-3 text-sm text-red-300">{message}</p>
        ) : (
          <p className="mt-3 text-sm text-slate-300">
            Please wait while we validate your session.
          </p>
        )}
      </div>
    </main>
  );
}
