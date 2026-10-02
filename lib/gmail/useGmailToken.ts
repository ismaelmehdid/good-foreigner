"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const GSI_SRC = "https://accounts.google.com/gsi/client";
const GSI_SCRIPT_ID = "google-gsi-client";
const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

// Minimal Google Identity Services types (no @types package needed).
interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken: (overrides?: { prompt?: string }) => void;
}

interface GoogleGsi {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (response: TokenResponse) => void;
        error_callback?: (error: { type?: string; message?: string }) => void;
      }) => TokenClient;
    };
  };
}

function getGoogle(): GoogleGsi | undefined {
  return (window as unknown as { google?: GoogleGsi }).google;
}

/** Inject the GSI script once (deduped by element id) and resolve when it is usable. */
function loadGsi(): Promise<GoogleGsi> {
  return new Promise((resolve, reject) => {
    const ready = getGoogle();
    if (ready?.accounts?.oauth2) {
      resolve(ready);
      return;
    }
    let script = document.getElementById(GSI_SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = GSI_SCRIPT_ID;
      script.src = GSI_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", () => {
      const g = getGoogle();
      if (g?.accounts?.oauth2) resolve(g);
      else reject(new Error("Google sign-in loaded but is unavailable"));
    });
    script.addEventListener("error", () => reject(new Error("Could not load Google sign-in")));
  });
}

export function useGmailToken(clientId: string | null): {
  token: string | null;
  request: () => void;
  ready: boolean;
  error: string | null;
} {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<TokenClient | null>(null);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    loadGsi()
      .then((google) => {
        if (cancelled) return;
        clientRef.current = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: GMAIL_READONLY_SCOPE,
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
            setError(err.type === "popup_closed" ? "Sign-in window was closed" : err.message || "Gmail authorization failed");
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
    };
  }, [clientId]);

  const request = useCallback(() => {
    setError(null);
    clientRef.current?.requestAccessToken();
  }, []);

  return { token, request, ready, error };
}
