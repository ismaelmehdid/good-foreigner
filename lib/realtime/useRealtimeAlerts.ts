"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Profile } from "@/lib/types";
import { getGoogle, loadGsi, type GoogleGsi } from "@/lib/gsi/loadGsi";
import { needsHomeScreenInstall, requestNotifications } from "@/lib/notify/notify";
import { sameKey, urlBase64ToUint8Array } from "@/lib/realtime/pushUtils";

const STORE_KEY = "gf.realtime";
const CHANGE_EVENT = "gf-realtime-change";
const CODE_SCOPE = "openid email https://www.googleapis.com/auth/gmail.readonly";
const SW_READY_TIMEOUT_MS = 10000;

export type RealtimeStatus = "off" | "enabling" | "on" | "error";

export interface UseRealtimeAlertsOptions {
  clientId: string | null;
  vapidPublicKey: string | null;
  enabledFlag: boolean;
  loginHint?: string;
  profile: Profile | null;
}

export interface RealtimeAlertsState {
  supported: boolean;
  status: RealtimeStatus;
  error: string | null;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  sendTest: () => Promise<boolean>;
}

interface StoredRealtime {
  status: "on";
  endpoint: string;
  email?: string;
  expiration?: number;
}

// ---- persisted state ("gf.realtime" in localStorage) -------------------------------------------

function readStoredRaw(): string | null {
  try {
    return window.localStorage.getItem(STORE_KEY);
  } catch {
    return null;
  }
}

function parseStored(raw: string | null): StoredRealtime | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<StoredRealtime>;
    return v.status === "on" && typeof v.endpoint === "string" && v.endpoint ? (v as StoredRealtime) : null;
  } catch {
    return null;
  }
}

function writeStored(value: StoredRealtime | null): void {
  try {
    if (value) window.localStorage.setItem(STORE_KEY, JSON.stringify(value));
    else window.localStorage.removeItem(STORE_KEY);
  } catch {
    // Storage blocked: status falls back to "off" on reload; the server side still works.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribeStored(cb: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

const noopSubscribe = () => () => {};

function pushEnvironmentSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    !needsHomeScreenInstall()
  );
}

// ---- helpers -----------------------------------------------------------------------------------

class RealtimeError extends Error {}

function message(e: unknown): string {
  return e instanceof RealtimeError ? e.message : "Could not turn on real-time alerts. Please try again.";
}

/** Opens the GIS consent popup. Must run while the tap's user activation is still valid. */
function requestCode(google: GoogleGsi, clientId: string, loginHint?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initCodeClient({
      client_id: clientId,
      scope: CODE_SCOPE,
      ux_mode: "popup",
      ...(loginHint ? { login_hint: loginHint } : {}),
      callback: (response) => {
        if (response.code) resolve(response.code);
        else
          reject(
            new RealtimeError(
              response.error === "access_denied"
                ? "Gmail access is needed for real-time alerts."
                : "Google sign-in did not complete. Please try again.",
            ),
          );
      },
      error_callback: (err) => {
        reject(
          new RealtimeError(
            err.type === "popup_failed_to_open"
              ? "Your browser blocked the Google window. Tap the button again."
              : err.type === "popup_closed"
                ? "The Google window was closed before finishing."
                : "Google sign-in did not complete. Please try again.",
          ),
        );
      },
    });
    client.requestCode();
  });
}

async function serviceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (!existing) await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new RealtimeError("Notifications service did not start. Reload and try again.")), SW_READY_TIMEOUT_MS),
    ),
  ]);
}

async function currentSubscription(): Promise<PushSubscription | null> {
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    return reg ? await reg.pushManager.getSubscription() : null;
  } catch {
    return null;
  }
}

function enableErrorMessage(status: number): string {
  if (status === 401) return "Google didn't grant Gmail access. Try again and allow access.";
  if (status === 503) return "Real-time alerts are not available right now.";
  if (status === 400) return "Something was missing. Check your profile and try again.";
  return "Could not turn on real-time alerts. Please try again.";
}

function postJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

// ---- hook --------------------------------------------------------------------------------------

/**
 * Real-time alerts via Gmail push → server → Web Push, so risky emails notify the phone even
 * when the app is closed. `enable()` must be called from a tap (permission prompt + popup).
 */
export function useRealtimeAlerts({
  clientId,
  vapidPublicKey,
  enabledFlag,
  loginHint,
  profile,
}: UseRealtimeAlertsOptions): RealtimeAlertsState {
  const envSupported = useSyncExternalStore(noopSubscribe, pushEnvironmentSupported, () => false);
  const storedRaw = useSyncExternalStore(subscribeStored, readStoredRaw, () => null);
  const stored = useMemo(() => parseStored(storedRaw), [storedRaw]);

  const [pending, setPending] = useState<"enabling" | "error" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supported = enabledFlag && envSupported && !!clientId && !!vapidPublicKey;

  // Preload GIS so the consent popup can open synchronously inside the tap.
  useEffect(() => {
    if (supported) loadGsi().catch(() => {});
  }, [supported]);

  // If the browser dropped the push subscription (permission revoked, data cleared), show "off".
  useEffect(() => {
    if (!envSupported || !stored) return;
    let cancelled = false;
    currentSubscription().then((sub) => {
      if (!cancelled && (!sub || sub.endpoint !== stored.endpoint)) writeStored(null);
    });
    return () => {
      cancelled = true;
    };
  }, [envSupported, stored]);

  const enable = useCallback(async () => {
    if (!supported || !clientId || !vapidPublicKey) {
      setPending("error");
      setError("Real-time alerts aren't available in this browser.");
      return;
    }
    if (!profile) {
      setPending("error");
      setError("Save your visa profile first.");
      return;
    }
    setPending("enabling");
    setError(null);
    try {
      // 1. Notification permission (first await, so it runs inside the tap).
      const permission = await requestNotifications();
      if (permission !== "granted") {
        throw new RealtimeError(
          permission === "denied"
            ? "Notifications are blocked for this site. Allow them in your browser settings, then try again."
            : "Allow notifications to get real-time alerts.",
        );
      }

      // 2. Offline Gmail consent → one-time authorization code for the server.
      let google = getGoogle();
      if (!google) {
        await loadGsi();
        google = getGoogle();
      }
      if (!google) throw new RealtimeError("Could not load Google sign-in.");
      const code = await requestCode(google, clientId, loginHint);

      // 3. Web Push subscription for this device.
      const registration = await serviceWorkerRegistration();
      const key = urlBase64ToUint8Array(vapidPublicKey);
      let subscription = await registration.pushManager.getSubscription();
      if (subscription && !sameKey(subscription.options.applicationServerKey, key)) {
        await subscription.unsubscribe().catch(() => false);
        subscription = null;
      }
      subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });

      // 4. Hand everything to the server, which starts the Gmail watch.
      const res = await postJson("/api/realtime/enable", {
        code,
        profile,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        subscription: subscription.toJSON(),
      });
      if (!res.ok) throw new RealtimeError(enableErrorMessage(res.status));
      const data = (await res.json().catch(() => ({}))) as { email?: string; expiration?: number };

      writeStored({ status: "on", endpoint: subscription.endpoint, email: data.email, expiration: data.expiration });
      setPending(null);
    } catch (e) {
      setPending("error");
      setError(message(e));
    }
  }, [supported, clientId, vapidPublicKey, profile, loginHint]);

  const disable = useCallback(async () => {
    setError(null);
    const subscription = envSupported ? await currentSubscription() : null;
    const endpoint = stored?.endpoint ?? subscription?.endpoint;
    let serverOk = true;
    if (endpoint) {
      try {
        serverOk = (await postJson("/api/realtime/disable", { endpoint })).ok;
      } catch {
        serverOk = false;
      }
    }
    await subscription?.unsubscribe().catch(() => false);
    writeStored(null);
    setPending(null);
    if (!serverOk) setError("Turned off on this phone, but the server could not be reached.");
  }, [envSupported, stored]);

  const sendTest = useCallback(async () => {
    setError(null);
    const endpoint = stored?.endpoint;
    if (!endpoint) {
      setError("Real-time alerts are off on this phone.");
      return false;
    }
    try {
      const res = await postJson("/api/realtime/test", { endpoint });
      if (res.ok) return true;
      if (res.status === 404) {
        writeStored(null);
        setError("This phone is no longer registered. Turn real-time alerts on again.");
        return false;
      }
      setError("Could not send a test notification. Please try again.");
      return false;
    } catch {
      setError("Could not reach the server.");
      return false;
    }
  }, [stored]);

  const status: RealtimeStatus = pending ?? (stored ? "on" : "off");

  return { supported, status, error, enable, disable, sendTest };
}
