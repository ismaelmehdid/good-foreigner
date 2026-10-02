"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getGoogle, loadGsi, type GsiTokenClient } from "@/lib/gsi/loadGsi";

const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

/**
 * Short-lived Gmail read-only access token via the GIS token client.
 * The token lives only in React state (never stored). `loginHint` (the signed-in
 * user's email) makes Google preselect that account in the consent popup.
 */
export function useGmailToken(
  clientId: string | null,
  loginHint?: string,
): {
  token: string | null;
  request: () => void;
  ready: boolean;
  error: string | null;
} {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<GsiTokenClient | null>(null);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    loadGsi()
      .then(() => {
        const google = getGoogle();
        if (cancelled || !google) return;
        clientRef.current = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: GMAIL_READONLY_SCOPE,
          ...(loginHint ? { login_hint: loginHint } : {}),
          callback: (response) => {
            if (cancelled) return;
            if (response.error || !response.access_token) {
              setError(response.error_description || response.error || "Gmail authorization failed");
              return;
            }
            setError(null);
            setToken(response.access_token);
          },
          error_callback: (err) => {
            if (cancelled) return;
            setError(
              err.type === "popup_closed" ? "Sign-in window was closed" : err.message || "Gmail authorization failed",
            );
          },
        });
        setReady(true);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load Google sign-in");
      });

    return () => {
      cancelled = true;
      clientRef.current = null;
      setReady(false);
      // A different client or account invalidates the previous token.
      setToken(null);
    };
  }, [clientId, loginHint]);

  const request = useCallback(() => {
    setError(null);
    clientRef.current?.requestAccessToken();
  }, []);

  return { token, request, ready, error };
}
