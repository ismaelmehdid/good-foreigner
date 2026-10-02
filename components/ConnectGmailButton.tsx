"use client";

import { useEffect, useEffectEvent } from "react";
import { useGmailToken } from "@/lib/gmail/useGmailToken";

export default function ConnectGmailButton({
  clientId,
  onToken,
}: {
  clientId: string | null;
  onToken: (token: string) => void;
}) {
  const { token, request, ready, error } = useGmailToken(clientId);

  const emitToken = useEffectEvent((t: string) => onToken(t));
  useEffect(() => {
    if (token) emitToken(token);
  }, [token]);

  if (!clientId) return null;

  return (
    <div className="flex flex-col gap-1">
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
          className="w-fit rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          Connect Gmail (read-only)
        </button>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <p className="text-xs text-zinc-500 dark:text-zinc-400">Read-only. Emails are analyzed, never stored.</p>
    </div>
  );
}
