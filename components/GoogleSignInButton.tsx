"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { decodeIdToken, type GoogleUser } from "@/lib/auth/decodeIdToken";
import { clearUser, saveUser } from "@/lib/auth/userStore";
import { getGoogle, loadGsi } from "@/lib/gsi/loadGsi";

/** Signs out locally: stops GIS auto sign-in, then forgets the stored user. */
export function signOut(): void {
  try {
    getGoogle()?.accounts.id.disableAutoSelect();
  } catch {
    // GIS not loaded or unavailable: nothing to disable.
  }
  clearUser();
}

export default function GoogleSignInButton({
  clientId,
  onSignIn,
}: {
  clientId: string | null;
  onSignIn: (u: GoogleUser) => void;
}) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCredential = useEffectEvent((credential: string) => {
    try {
      const user = decodeIdToken(credential);
      saveUser(user);
      setError(null);
      onSignIn(user);
    } catch {
      setError("Could not read your Google account. Please try again.");
    }
  });

  const handleLoadError = useEffectEvent((e: unknown) => {
    setError(e instanceof Error ? e.message : "Could not load Google sign-in");
  });

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    loadGsi()
      .then(() => {
        const google = getGoogle();
        const el = buttonRef.current;
        if (cancelled || !google || !el) return;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => handleCredential(response.credential),
          auto_select: false,
          use_fedcm_for_button: true,
        });
        google.accounts.id.renderButton(el, {
          theme: "outline",
          size: "large",
          shape: "pill",
          text: "continue_with",
          width: 280,
        });
      })
      .catch((e: unknown) => {
        if (!cancelled) handleLoadError(e);
      });

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (!clientId) {
    return (
      <div
        aria-disabled="true"
        className="inline-flex h-11 w-[280px] cursor-not-allowed items-center justify-center rounded-full border border-zinc-300 text-sm text-zinc-400 dark:border-zinc-700 dark:text-zinc-500"
      >
        Google sign-in not configured
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {/* GIS renders its official button into this element. Fixed height avoids layout shift. */}
      <div ref={buttonRef} className="flex min-h-11 w-[280px] items-center justify-center" />
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
