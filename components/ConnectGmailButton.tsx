"use client";

import { useEffect, useEffectEvent } from "react";
import { useGmailToken } from "@/lib/gmail/useGmailToken";

export default function ConnectGmailButton({
  clientId,
  onToken,
  loginHint,
  className = "min-h-12 sm:w-auto",
}: {
  clientId: string | null;
  onToken: (token: string) => void;
  loginHint?: string;
  /** Height and width overrides for the button (defaults: 48px tall, full width on phones). */
  className?: string;
}) {
  const { token, request, ready, error } = useGmailToken(clientId, loginHint);

  const emitToken = useEffectEvent((t: string) => onToken(t));
  useEffect(() => {
    if (token) emitToken(token);
  }, [token]);

  if (!clientId) return null;

  return (
    <div className="flex w-full flex-col gap-2">
      {token ? (
        <span className="inline-flex w-fit items-center gap-2 rounded-xl border border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path
              fillRule="evenodd"
              d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4l3.3 3.3 7.3-7.3a1 1 0 0 1 1.4 0Z"
              clipRule="evenodd"
            />
          </svg>
          Gmail connected
        </span>
      ) : (
        <button
          type="button"
          onClick={request}
          disabled={!ready}
          className={`w-full rounded-full bg-teal-700 px-6 text-base font-semibold text-white shadow-sm transition-colors enabled:hover:bg-teal-800 enabled:active:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-teal-500 dark:text-teal-950 dark:enabled:hover:bg-teal-400 dark:enabled:active:bg-teal-400 ${className}`}
        >
          Connect Gmail
        </button>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <p className="text-xs leading-relaxed text-stone-500 dark:text-stone-400">Read-only. Recent inbox emails are sent to Google&apos;s Gemini API for analysis. This app stores nothing.</p>
    </div>
  );
}
