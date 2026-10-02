"use client";

import type { GoogleUser } from "@/lib/auth/decodeIdToken";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import Logo from "@/components/Logo";

export default function Welcome({
  googleClientId,
  onSignIn,
  onDemo,
}: {
  googleClientId: string | null;
  onSignIn: (u: GoogleUser) => void;
  onDemo: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <Logo className="h-16 w-16" />
      <p className="mt-4 text-sm font-semibold uppercase tracking-widest text-teal-700 dark:text-teal-300">
        Good Foreigner
      </p>
      <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-balance text-stone-900 dark:text-stone-50">
        Stay in status. Get warned before you act.
      </h1>
      <p className="mt-4 text-base leading-relaxed text-pretty text-stone-600 dark:text-stone-400">
        For visitors on ESTA or a B-1/B-2 visa. We count your days and flag emails and plans that
        could cost you future visits.
      </p>
      <div className="mt-8">
        <GoogleSignInButton clientId={googleClientId} onSignIn={onSignIn} />
      </div>
      <button
        type="button"
        onClick={onDemo}
        className="mt-5 min-h-11 px-3 text-sm font-medium text-teal-700 underline underline-offset-4 hover:text-teal-900 dark:text-teal-300 dark:hover:text-teal-100"
      >
        Just try the demo
      </button>
    </div>
  );
}
