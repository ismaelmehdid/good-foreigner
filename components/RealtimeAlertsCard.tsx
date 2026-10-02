"use client";

import { useState, useSyncExternalStore } from "react";
import type { Profile } from "@/lib/types";
import { needsHomeScreenInstall } from "@/lib/notify/notify";
import { useRealtimeAlerts } from "@/lib/realtime/useRealtimeAlerts";

const noopSubscribe = () => () => {};

const PRIMARY =
  "min-h-12 w-full rounded-full bg-teal-700 px-6 text-base font-semibold text-white shadow-sm transition-colors enabled:hover:bg-teal-800 enabled:active:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto dark:bg-teal-500 dark:text-teal-950 dark:enabled:hover:bg-teal-400 dark:enabled:active:bg-teal-400";
const SECONDARY =
  "min-h-12 w-full rounded-full border border-stone-300 px-6 text-base font-medium text-stone-700 transition-colors enabled:hover:bg-stone-50 enabled:active:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto dark:border-stone-700 dark:text-stone-300 dark:enabled:hover:bg-stone-800 dark:enabled:active:bg-stone-800";

export default function RealtimeAlertsCard({
  clientId,
  vapidPublicKey,
  enabledFlag,
  loginHint,
  profile,
}: {
  clientId: string | null;
  vapidPublicKey: string | null;
  enabledFlag: boolean;
  loginHint?: string;
  profile: Profile | null;
}) {
  const { supported, status, error, enable, disable, sendTest } = useRealtimeAlerts({
    clientId,
    vapidPublicKey,
    enabledFlag,
    loginHint,
    profile,
  });
  const needsInstall = useSyncExternalStore(noopSubscribe, needsHomeScreenInstall, () => false);
  const [testState, setTestState] = useState<"idle" | "sending" | "sent">("idle");
  const [turningOff, setTurningOff] = useState(false);

  if (!enabledFlag || !clientId || !vapidPublicKey) return null;

  async function handleTest() {
    setTestState("sending");
    const ok = await sendTest();
    setTestState(ok ? "sent" : "idle");
    if (ok) setTimeout(() => setTestState("idle"), 4000);
  }

  async function handleOff() {
    setTurningOff(true);
    await disable();
    setTurningOff(false);
    setTestState("idle");
  }

  return (
    <section
      aria-labelledby="realtime-alerts-title"
      className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6 dark:border-stone-800 dark:bg-stone-900"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0m6 0H9"
            />
          </svg>
        </span>
        <div className="min-w-0">
          <h2 id="realtime-alerts-title" className="text-base font-semibold text-stone-900 dark:text-stone-100">
            Real-time alerts
          </h2>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
            Get a notification the moment a risky email arrives — even when the app is closed.
          </p>
        </div>
      </div>

      <div className="mt-4">
        {needsInstall ? (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
            On iPhone, add Good Foreigner to your Home Screen first: tap <strong>Share</strong>, then{" "}
            <strong>Add to Home Screen</strong>, and open it from there.
          </p>
        ) : !supported ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">
            This browser can&apos;t receive push notifications. Try Chrome on Android, or the Home Screen app on
            iPhone.
          </p>
        ) : status === "on" ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => void handleTest()}
              disabled={testState === "sending" || turningOff}
              className={PRIMARY}
            >
              {testState === "sending" ? "Sending…" : testState === "sent" ? "Test sent — check your phone" : "On ✓ · Send test"}
            </button>
            <button type="button" onClick={() => void handleOff()} disabled={turningOff} className={SECONDARY}>
              {turningOff ? "Turning off…" : "Turn off"}
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void enable()}
              disabled={status === "enabling" || !profile}
              className={PRIMARY}
            >
              {status === "enabling" ? "Turning on…" : "Turn on real-time alerts"}
            </button>
            {!profile && (
              <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">Save your visa profile first.</p>
            )}
          </>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </p>
        )}
      </div>

      <p className="mt-4 text-xs text-stone-500 dark:text-stone-400">
        Gives our server read-only Gmail access (stored encrypted) so it can check new emails. Email contents are
        never stored. Turn off anytime.
      </p>
    </section>
  );
}
