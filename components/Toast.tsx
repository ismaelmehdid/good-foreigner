"use client";

import { useEffect } from "react";

/** Small bottom toast that dismisses itself after a few seconds. Render with a changing `key` to restart it. */
export default function Toast({
  message,
  onClose,
  tone = "neutral",
}: {
  message: string;
  onClose: () => void;
  tone?: "neutral" | "warning";
}) {
  useEffect(() => {
    const t = window.setTimeout(onClose, 5000);
    return () => window.clearTimeout(t);
  }, [onClose]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-auto flex w-full max-w-md animate-toast-in items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium shadow-lg ${
          tone === "warning"
            ? "bg-orange-600 text-white dark:bg-orange-500 dark:text-orange-950"
            : "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
        }`}
      >
        <span className="min-w-0 flex-1">{message}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full opacity-80 active:opacity-100"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
            <path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
