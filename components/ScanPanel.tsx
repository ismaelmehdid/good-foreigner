"use client";

import { useState } from "react";
import type { Alert, Profile, ScanResponse } from "@/lib/types";
import AlertCard from "@/components/AlertCard";
import ConnectGmailButton from "@/components/ConnectGmailButton";

// The sample inbox has 8 emails; Gmail scans fetch up to 15 recent ones.
const SAMPLE_COUNT = 8;
const GMAIL_MAX = 15;

type Mode = "demo" | "gmail";

type ScanState =
  | { kind: "idle" }
  | { kind: "loading"; mode: Mode }
  | { kind: "error"; mode: Mode; message: string; expired?: boolean }
  | { kind: "done"; mode: Mode; result: ScanResponse };

const TIMEOUT_MS = 100_000;
const TIMEOUT_MESSAGE = "The AI is slow right now — try again";

class RequestTimeout extends Error {}

async function postScan(profile: Profile, today: string, mode: Mode, token: string | null) {
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

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-teal-600/30 border-t-teal-600 dark:border-teal-300/30 dark:border-t-teal-300"
    />
  );
}

function FineList({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) return null;
  return (
    <details className="group rounded-2xl border border-stone-200 bg-white px-5 py-4 dark:border-stone-800 dark:bg-stone-900">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-stone-700 dark:text-stone-300">
        <span className="flex items-center gap-2">
          <span aria-hidden className="h-2 w-2 rounded-full bg-green-600 dark:bg-green-400" />
          {alerts.length} {alerts.length === 1 ? "email looks" : "emails look"} fine
        </span>
        <span aria-hidden className="text-stone-400 transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <ul className="mt-3 space-y-2 border-t border-stone-100 pt-3 text-sm text-stone-600 dark:border-stone-800 dark:text-stone-400">
        {alerts.map((a) => (
          <li key={a.item.id} className="min-w-0">
            <span className="font-medium text-stone-800 dark:text-stone-200">
              {a.item.subject || "(no subject)"}
            </span>
            {a.item.from && <span className="block truncate text-xs">{a.item.from}</span>}
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function ScanPanel({
  profile,
  today,
  googleClientId,
}: {
  profile: Profile;
  /** Visitor's local calendar date, YYYY-MM-DD (same one the stay countdown uses). */
  today: string;
  googleClientId: string | null;
}) {
  const [state, setState] = useState<ScanState>({ kind: "idle" });
  const [token, setToken] = useState<string | null>(null);
  // Bumping this remounts ConnectGmailButton so the user can sign in again after a 401.
  const [gmailKey, setGmailKey] = useState(0);

  const loading = state.kind === "loading";

  async function scan(mode: Mode, tokenOverride?: string) {
    if (loading) return;
    setState({ kind: "loading", mode });
    try {
      const { status, ok, data } = await postScan(profile, today, mode, tokenOverride ?? token);
      if (status === 403) {
        setToken(null);
        setGmailKey((k) => k + 1);
        setState({
          kind: "error",
          mode,
          message:
            "Gmail refused access. Reconnect and make sure you tick the box that lets Good Foreigner read your email.",
          expired: true,
        });
        return;
      }
      if (status === 401) {
        setToken(null);
        setGmailKey((k) => k + 1);
        setState({
          kind: "error",
          mode,
          message: "Gmail session expired — reconnect",
          expired: true,
        });
        return;
      }
      if (!ok || !data || !Array.isArray((data as ScanResponse).alerts)) {
        const message =
          (data as { error?: string } | null)?.error ?? `The scan failed (error ${status}).`;
        setState({ kind: "error", mode, message });
        return;
      }
      setState({ kind: "done", mode, result: data as ScanResponse });
    } catch (e) {
      setState({
        kind: "error",
        mode,
        message:
          e instanceof RequestTimeout
            ? TIMEOUT_MESSAGE
            : "We couldn't reach the server. Check your connection and try again.",
      });
    }
  }

  const result = state.kind === "done" ? state.result : null;
  const flagged = result ? result.alerts.filter((a) => a.risk !== "none") : [];
  const fine = result ? result.alerts.filter((a) => a.risk === "none") : [];

  return (
    <section aria-labelledby="scan-heading" className="space-y-4">
      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6 dark:border-stone-800 dark:bg-stone-900">
        <h2 id="scan-heading" className="text-lg font-semibold text-stone-900 dark:text-stone-50">
          Check your inbox
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
          We look for job offers, payments, contracts and travel plans that could affect your
          status. Gemma screens every email first; only the ones that matter go to Gemini for a
          closer look.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
          <button
            type="button"
            onClick={() => scan("demo")}
            disabled={loading}
            className="rounded-full bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-500 dark:text-teal-950 dark:hover:bg-teal-400"
          >
            Try with sample inbox
          </button>

          <ConnectGmailButton
            key={gmailKey}
            clientId={googleClientId}
            onToken={(t) => {
              setToken(t);
              // Start the scan right away; the state update above lands after this call.
              void scan("gmail", t);
            }}
          />

          {token && (
            <button
              type="button"
              onClick={() => scan("gmail")}
              disabled={loading}
              className="rounded-full border border-teal-700 px-5 py-2.5 text-sm font-semibold text-teal-800 transition-colors hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-teal-400 dark:text-teal-200 dark:hover:bg-teal-950"
            >
              Scan my Gmail again
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
            {state.expired ? (
              <span className="text-xs text-red-700 dark:text-red-300">
                Use “Connect Gmail” above to sign in again.
              </span>
            ) : (
              <button
                type="button"
                onClick={() => scan(state.mode)}
                className="w-fit rounded-full border border-red-300 px-3 py-1 text-xs font-semibold hover:bg-red-100 dark:border-red-800 dark:hover:bg-red-900/50"
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
              {flagged.length === 0
                ? "Nothing risky found"
                : `${flagged.length} ${flagged.length === 1 ? "email needs" : "emails need"} your attention`}
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Scanned {result.scanned} {result.scanned === 1 ? "email" : "emails"}
              {state.kind === "done" && state.mode === "demo" ? " · sample inbox" : ""}
            </p>
          </div>
          {flagged.length === 0 && (
            <p className="px-1 text-sm text-stone-600 dark:text-stone-400">
              None of these emails look like they could affect your status.
            </p>
          )}
          {flagged.map((a) => (
            <AlertCard key={a.item.id} alert={a} />
          ))}
          <FineList alerts={fine} />
        </div>
      )}
    </section>
  );
}
