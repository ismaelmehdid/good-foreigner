"use client";

import { useEffect } from "react";

/** Registers /sw.js (used only to display alert notifications). Renders nothing. */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((err: unknown) => {
        console.warn("[sw] registration failed:", err instanceof Error ? err.message : err);
      });
  }, []);

  return null;
}
