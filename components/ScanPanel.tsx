"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import type { Alert, Profile, ScanResponse } from "@/lib/types";
import AlertCard from "@/components/AlertCard";
import ConnectGmailButton from "@/components/ConnectGmailButton";
import Toast from "@/components/Toast";
import { useInboxWatch } from "@/lib/gmail/useInboxWatch";
import { notifyAlerts } from "@/lib/notify/notify";

const WATCH_INTERVAL_MS = 30_000;
const RISKY = new Set(["critical", "high", "medium"]);

/** "checked 20s ago" from a timestamp (number or Date). */
function agoLabel(at: unknown, now: number): string | null {
  const ms = at instanceof Date ? at.getTime() : typeof at === "number" ? at : null;
  if (ms === null) return null;
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 10) return "checked just now";
  if (s < 60) return `checked ${s}s ago`;
  const m = Math.round(s / 60);
  return `checked ${m} min ago`;
}

// The sample inbox has 8 emails; Gmail scans fetch up to 15 recent ones.
const SAMPLE_COUNT = 8;
const GMAIL_MAX = 15;

export type ScanMode = "demo" | "gmail";

type ScanState =
  | { kind: "idle" }
  | { kind: "loading"; mode: ScanMode }
  | { kind: "error"; mode: ScanMode; message: string; reconnect?: boolean }
  | { kind: "done"; mode: ScanMode; result: ScanResponse };

const TIMEOUT_MS = 100_000;
const TIMEOUT_MESSAGE = "The AI is slow right now — try again";

class RequestTimeout extends Error {}

async function postScan(profile: Profile, today: string, mode: ScanMode, token: string | null) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (mode === "gmail" && token) headers.authorization = `Bearer ${token}`;
  const body = mode === "demo" ? { profile, today, demo: true } : { profile, today };

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("/api/scan", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      // Non-JSON response (e.g. a crash page). Handled by the caller.
    }
    if (controller.signal.aborted) throw new RequestTimeout();
    return { status: res.status, ok: res.ok, data };
  } catch (e) {
    if (controller.signal.aborted) throw new RequestTimeout();
    throw e;
  } finally {
    window.clearTimeout(timer);
  }
}

const RISK_ORDER = ["critical", "high", "medium", "unknown", "low", "none"];
const byRisk = (a: Alert, b: Alert) => RISK_ORDER.indexOf(a.risk) - RISK_ORDER.indexOf(b.risk);

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-teal-600/30 border-t-teal-600 dark:border-teal-300/30 dark:border-t-teal-300"
    />
  );
}

const primaryBtn =
  "min-h-12 w-full rounded-full bg-teal-700 px-6 text-base font-semibold text-white shadow-sm transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto dark:bg-teal-500 dark:text-teal-950 dark:hover:bg-teal-400";
const linkBtn =
  "min-h-11 text-sm font-medium text-teal-700 underline underline-offset-2 hover:text-teal-900 disabled:opacity-50 dark:text-teal-300 dark:hover:text-teal-100";

interface Props {
  profile: Profile;
  /** Visitor's local calendar date, YYYY-MM-DD (same one the stay countdown uses). */
  today: string;
  googleClientId: string | null;
  /** Demo mode: no account, the sample inbox is the main action. */
  demo: boolean;
  loginHint?: string;
  /** Gmail access token, kept in Dashboard state and shared with onboarding. */
  token: string | null;
  /** Remount key for ConnectGmailButton (bumped after a 401/403 so the user can reconnect). */
  gmailKey: number;
  onToken: (token: string) => void;
  onTokenInvalid: () => void;
  /** A scan to start as soon as this panel is shown (after connecting Gmail, or entering the demo). */
  autoScan: ScanMode | null;
  onAutoScanHandled: () => void;
  /** Live inbox watch (polls Gmail and notifies on new risky emails). On by default once connected. */
  watchEnabled: boolean;
}

export default function ScanPanel({
  profile,
  today,
  googleClientId,
  demo,
  loginHint,
  token,
  gmailKey,
  onToken,
  onTokenInvalid,
  autoScan,
  onAutoScanHandled,
  watchEnabled,
}: Props) {
  const [state, setState] = useState<ScanState>({ kind: "idle" });
  const inFlight = useRef(false);
  const [toast, setToast] = useState<{ id: number; message: string; warning: boolean } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const closeToast = useCallback(() => setToast(null), []);

  const watching = watchEnabled && Boolean(token) && !demo;
  const watch = useInboxWatch({
    token,
    profile,
    today,
    enabled: watching,
    intervalMs: WATCH_INTERVAL_MS,
    onNewAlerts: (newAlerts: Alert[]) => {
      if (!newAlerts.length) return;
      setState((prev) => {
        const base = prev.kind === "done" ? prev.result : { alerts: [], scanned: 0 };
        const known = new Set(newAlerts.map((a) => a.item.id));
        return {
          kind: "done",
          mode: "gmail",
          result: {
            alerts: [...newAlerts, ...base.alerts.filter((a) => !known.has(a.item.id))],
            scanned: base.scanned + newAlerts.length,
          },
        };
      });
      void notifyAlerts(newAlerts).catch(() => 0);
      const risky = newAlerts.filter((a) => RISKY.has(a.risk)).length;
      setToast({
        id: Date.now(),
        warning: risky > 0,
        message:
          risky > 0
            ? `${risky} new ${risky === 1 ? "email needs" : "emails need"} your attention`
            : `${newAlerts.length} new ${newAlerts.length === 1 ? "email looks" : "emails look"} fine`,
      });
    },
    onAuthError: (status: number) => {
      onTokenInvalid();
      setState({
        kind: "error",
        mode: "gmail",
        reconnect: true,
        message:
          status === 403
            ? "Gmail refused access. Reconnect and make sure you tick the box that lets Good Foreigner read your email."
            : "Gmail session expired — reconnect",
      });
    },
  });

  // Re-render every 10s so "checked 20s ago" stays current.
  useEffect(() => {
    if (!watching) return;
    const t = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(t);
  }, [watching]);

  const loading = state.kind === "loading";
  const gmailAvailable = !demo && Boolean(googleClientId);

  async function scan(mode: ScanMode) {
    if (inFlight.current) return;
    inFlight.current = true;
    setState({ kind: "loading", mode });
    try {
      const { status, ok, data } = await postScan(profile, today, mode, token);
      if (status === 401 || status === 403) {
        onTokenInvalid();
        setState({
          kind: "error",
          mode,
          reconnect: true,
          message:
            status === 401
              ? "Gmail session expired — reconnect"
              : "Gmail refused access. Reconnect and make sure you tick the box that lets Good Foreigner read your email.",
        });
        return;
      }
      if (!ok || !data || !Array.isArray((data as ScanResponse).alerts)) {
        const message =
          (data as { error?: string } | null)?.error ?? `The scan failed (error ${status}).`;
        setState({ kind: "error", mode, message });
        return;
      }
      const scanResult = data as ScanResponse;
      setState({ kind: "done", mode, result: scanResult });
      // Live watch only reports emails that arrive after this scan.
      if (mode === "gmail") watch.markSeen(scanResult.alerts.map((a) => a.item.id));
    } catch (e) {
      setState({
        kind: "error",
        mode,
        message:
          e instanceof RequestTimeout
            ? TIMEOUT_MESSAGE
            : "We couldn't reach the server. Check your connection and try again.",
      });
    } finally {
      inFlight.current = false;
    }
  }

  const runAutoScan = useEffectEvent((mode: ScanMode) => {
    onAutoScanHandled();
    if (mode === "gmail" && !token) return;
    void scan(mode);
  });
  useEffect(() => {
    if (!autoScan) return;
    // Deferred so StrictMode's double effect run cancels the first call instead of scanning twice.
    const t = window.setTimeout(() => runAutoScan(autoScan), 0);
    return () => window.clearTimeout(t);
  }, [autoScan]);

  const result = state.kind === "done" ? state.result : null;
  const sorted = result ? [...result.alerts].sort(byRisk) : [];
  const attention = sorted.filter((a) => ["critical", "high", "medium"].includes(a.risk));
  const unchecked = sorted.filter((a) => a.risk === "unknown");
  const fine = sorted.filter((a) => a.risk === "low" || a.risk === "none");

  return (
    <section aria-labelledby="scan-heading" className="space-y-4">
      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900">
        <h2 id="scan-heading" className="text-lg font-semibold text-stone-900 dark:text-stone-50">
          Your inbox
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
          {demo
            ? "See how it works on a sample inbox with job offers, prizes and travel plans."
            : "We check your recent emails for job offers, payments and travel plans that could affect your status."}
        </p>

        <div className="mt-4 flex flex-col items-start gap-3">
          {!gmailAvailable ? (
            <button type="button" onClick={() => scan("demo")} disabled={loading} className={primaryBtn}>
              {result ? "Scan the sample inbox again" : "Scan the sample inbox"}
            </button>
          ) : token ? (
            <>
              <button type="button" onClick={() => scan("gmail")} disabled={loading} className={primaryBtn}>
                Scan Gmail
              </button>
              <p
                className={`inline-flex min-h-8 items-center gap-2 rounded-full px-3 text-xs font-medium ${
                  watching
                    ? "bg-green-50 text-green-800 ring-1 ring-inset ring-green-200 dark:bg-green-950/50 dark:text-green-200 dark:ring-green-900"
                    : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300"
                }`}
              >
                <span
                  aria-hidden
                  className={`h-2 w-2 rounded-full ${
                    watching ? "animate-pulse bg-green-600 dark:bg-green-400" : "bg-stone-400"
                  }`}
                />
                {watching
                  ? watch.checking
                    ? "Watching your inbox · checking…"
                    : `Watching your inbox${
                        agoLabel(watch.lastCheckedAt, now) ? ` · ${agoLabel(watch.lastCheckedAt, now)}` : ""
                      }`
                  : "Gmail connected · live watch off"}
              </p>
              {watching && watch.error && (
                <p className="text-xs text-red-700 dark:text-red-300">{watch.error}</p>
              )}
            </>
          ) : (
            <ConnectGmailButton
              key={gmailKey}
              clientId={googleClientId}
              loginHint={loginHint}
              onToken={onToken}
            />
          )}

          {gmailAvailable && (
            <button type="button" onClick={() => scan("demo")} disabled={loading} className={linkBtn}>
              Or try the sample inbox
            </button>
          )}
        </div>

        {state.kind === "loading" && (
          <p
            role="status"
            className="mt-4 flex items-center gap-3 rounded-xl bg-stone-50 px-4 py-3 text-sm text-stone-700 dark:bg-stone-800/60 dark:text-stone-300"
          >
            <Spinner />
            {state.mode === "demo"
              ? `Checking ${SAMPLE_COUNT} emails with Gemma, then Gemini…`
              : `Checking up to ${GMAIL_MAX} recent emails with Gemma, then Gemini…`}
          </p>
        )}

        {state.kind === "error" && (
          <div
            role="alert"
            className="mt-4 flex flex-col gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-inset ring-red-200 sm:flex-row sm:items-center sm:justify-between dark:bg-red-950/50 dark:text-red-200 dark:ring-red-900"
          >
            <span>{state.message}</span>
            {state.reconnect ? (
              <span className="text-xs text-red-700 dark:text-red-300">
                Use “Connect Gmail” above to sign in again.
              </span>
            ) : (
              <button
                type="button"
                onClick={() => scan(state.mode)}
                className="min-h-11 w-fit rounded-full border border-red-300 px-4 text-sm font-semibold hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-900/50"
              >
                Try again
              </button>
            )}
          </div>
        )}
      </div>

      {result && (
        <div className="space-y-3" aria-live="polite">
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
            <h3 className="text-base font-semibold text-stone-900 dark:text-stone-50">
              {attention.length === 0 ? "Nothing risky found" : "Needs your attention"}
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Scanned {result.scanned} {result.scanned === 1 ? "email" : "emails"}
              {state.kind === "done" && state.mode === "demo" ? " · sample inbox" : ""}
            </p>
          </div>
          {attention.length === 0 && unchecked.length === 0 && (
            <p className="px-1 text-sm text-stone-600 dark:text-stone-400">
              None of these emails look like they could affect your status.
            </p>
          )}
          {attention.map((a) => (
            <AlertCard key={a.item.id} alert={a} />
          ))}
          {unchecked.map((a) => (
            <AlertCard key={a.item.id} alert={a} />
          ))}
          {fine.length > 0 && (
            <details className="group">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-5 text-sm font-medium text-stone-700 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300">
                <span className="flex items-center gap-2">
                  <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-green-600 dark:bg-green-400" />
                  {fine.length} look fine
                </span>
                <span aria-hidden className="text-stone-400 transition-transform group-open:rotate-180">
                  ▾
                </span>
              </summary>
              <div className="mt-3 space-y-3">
                {fine.map((a) => (
                  <AlertCard key={a.item.id} alert={a} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
      {toast && (
        <Toast key={toast.id} message={toast.message} tone={toast.warning ? "warning" : "neutral"} onClose={closeToast} />
      )}
    </section>
  );
}
