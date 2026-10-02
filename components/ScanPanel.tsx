"use client";

import { useEffect, useEffectEvent, useId, useRef, useState, type ReactNode } from "react";
import type { Alert, Profile, ScanResponse } from "@/lib/types";
import AlertCard from "@/components/AlertCard";
import Chevron from "@/components/Chevron";
import type { ToastTone } from "@/components/Toast";
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


export type ScanMode = "demo" | "gmail";

type ScanState =
  | { kind: "idle" }
  | { kind: "loading"; mode: ScanMode }
  | { kind: "error"; mode: ScanMode; message: string; reconnect?: boolean }
  | { kind: "done"; mode: ScanMode; result: ScanResponse };

const TIMEOUT_MS = 100_000;
/** After this long, reassure the visitor that a slow scan is still running. */
const SLOW_MS = 15_000;
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

/** One collapsible group per risk level, most severe first. */
const GROUPS: { id: string; label: string; risks: Alert["risk"][]; dot: string }[] = [
  { id: "dont", label: "Don't do this", risks: ["critical", "high"], dot: "bg-red-600 dark:bg-red-400" },
  { id: "careful", label: "Be careful", risks: ["medium"], dot: "bg-amber-500 dark:bg-amber-400" },
  { id: "unknown", label: "Couldn't check", risks: ["unknown"], dot: "bg-stone-400 dark:bg-stone-500" },
  { id: "low", label: "Probably fine", risks: ["low"], dot: "bg-blue-500 dark:bg-blue-400" },
  { id: "none", label: "All good", risks: ["none"], dot: "bg-green-600 dark:bg-green-400" },
];

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-teal-600/30 border-t-teal-600 dark:border-teal-300/30 dark:border-t-teal-300"
    />
  );
}

function RiskGroup({
  label,
  dot,
  alerts,
  open,
  onToggle,
}: {
  label: string;
  dot: string;
  alerts: Alert[];
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = useId();
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-5 text-left text-sm font-medium text-stone-800 transition-colors hover:bg-stone-50 active:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800/60 dark:active:bg-stone-800"
      >
        <span className="flex items-center gap-2.5">
          <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
          {label} <span className="tabular-nums text-stone-500 dark:text-stone-400">({alerts.length})</span>
        </span>
        <span
          aria-hidden
          className={`text-stone-400 transition-transform duration-300 dark:text-stone-500 ${open ? "rotate-180" : ""}`}
        >
          <Chevron />
        </span>
      </button>
      {/* Grid-rows trick animates height smoothly; global reduced-motion rule shortens it to ~0. */}
      <div
        id={panelId}
        inert={!open}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-3 pt-3">
            {alerts.map((a) => (
              <AlertCard key={a.item.id} alert={a} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Groups start with only the most severe non-empty one open. Remount (new `key`) per scan to reset. */
function RiskGroups({ alerts }: { alerts: Alert[] }) {
  const groups = GROUPS.map((g) => ({ ...g, alerts: alerts.filter((a) => g.risks.includes(a.risk)) })).filter(
    (g) => g.alerts.length > 0,
  );
  const [open, setOpen] = useState<Set<string>>(() => new Set(groups.length ? [groups[0].id] : []));
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (groups.length === 0) {
    return <p className="px-1 text-sm text-stone-600 dark:text-stone-400">No emails to show.</p>;
  }
  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <RiskGroup
          key={g.id}
          label={g.label}
          dot={g.dot}
          alerts={g.alerts}
          open={open.has(g.id)}
          onToggle={() => toggle(g.id)}
        />
      ))}
    </div>
  );
}

interface Props {
  profile: Profile;
  /** Visitor's local calendar date, YYYY-MM-DD (same one the stay countdown uses). */
  today: string;
  googleClientId: string | null;
  /** Demo mode: no account, the sample inbox is the only inbox. */
  demo: boolean;
  /** Gmail access token, kept in Dashboard state and shared with onboarding and the header menu. */
  token: string | null;
  onTokenInvalid: () => void;
  /** Starts the Gmail connect flow; must be called straight from a tap. */
  onConnectGmail: () => void;
  /** A scan to run now (after connecting Gmail, entering the demo, or "Sync inbox now" in the menu). */
  autoScan: ScanMode | null;
  onAutoScanHandled: () => void;
  /** Live inbox watch (polls Gmail and notifies on new risky emails). On by default once connected. */
  watchEnabled: boolean;
  /** Page-level toast (owned by Dashboard so only one shows at a time). */
  onToast: (message: string, tone?: ToastTone) => void;
}

const RECONNECT_401 = "Gmail session expired — reconnect from the menu.";
const RECONNECT_403 =
  "Gmail refused access. Reconnect from the menu and tick the box that lets Good Foreigner read your email.";

/** The inbox results: one muted status line, then collapsible risk groups. Actions live in the header menu. */
export default function ScanPanel({
  profile,
  today,
  googleClientId,
  demo,
  token,
  onTokenInvalid,
  onConnectGmail,
  autoScan,
  onAutoScanHandled,
  watchEnabled,
  onToast,
}: Props) {
  const [state, setState] = useState<ScanState>({ kind: "idle" });
  // Bumped per completed scan so the groups reset to "most severe open".
  const [scanId, setScanId] = useState(0);
  const inFlight = useRef(false);
  const [slow, setSlow] = useState(false);
  const [syncing, setSyncing] = useState<ScanMode | null>(null);
  const [now, setNow] = useState(() => Date.now());

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
      // Re-open the most severe group so a new risky email is visible right away.
      if (risky > 0) setScanId((n) => n + 1);
      onToast(
        risky > 0
          ? `${risky} new ${risky === 1 ? "email needs" : "emails need"} your attention`
          : `${newAlerts.length} new ${newAlerts.length === 1 ? "email looks" : "emails look"} fine`,
        risky > 0 ? "warning" : "neutral",
      );
    },
    onAuthError: (status: number) => {
      onTokenInvalid();
      onToast(status === 403 ? RECONNECT_403 : RECONNECT_401, "warning");
    },
  });

  // Re-render every 10s so "checked 20s ago" stays current.
  useEffect(() => {
    if (!watching) return;
    const t = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(t);
  }, [watching]);

  async function scan(mode: ScanMode) {
    if (inFlight.current) return;
    inFlight.current = true;
    // Keep showing the previous results while syncing.
    setState((prev) => (prev.kind === "done" ? prev : { kind: "loading", mode }));
    setSyncing(mode);
    setSlow(false);
    const slowTimer = window.setTimeout(() => setSlow(true), SLOW_MS);
    try {
      const { status, ok, data } = await postScan(profile, today, mode, token);
      if (status === 401 || status === 403) {
        onTokenInvalid();
        onToast(status === 401 ? RECONNECT_401 : RECONNECT_403, "warning");
        setState((prev) => (prev.kind === "loading" ? { kind: "idle" } : prev));
        return;
      }
      if (!ok || !data || !Array.isArray((data as ScanResponse).alerts)) {
        const message =
          (data as { error?: string } | null)?.error ?? `The scan failed (error ${status}).`;
        onToast(message, "warning");
        setState((prev) => (prev.kind === "loading" ? { kind: "idle" } : prev));
        return;
      }
      const scanResult = data as ScanResponse;
      setState({ kind: "done", mode, result: scanResult });
      setScanId((n) => n + 1);
      // Live watch only reports emails that arrive after this scan.
      if (mode === "gmail") watch.markSeen(scanResult.alerts.map((a) => a.item.id));
    } catch (e) {
      onToast(
        e instanceof RequestTimeout
          ? TIMEOUT_MESSAGE
          : "We couldn't reach the server. Check your connection and try again.",
        "warning",
      );
      setState((prev) => (prev.kind === "loading" ? { kind: "idle" } : prev));
    } finally {
      window.clearTimeout(slowTimer);
      setSlow(false);
      setSyncing(null);
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
  const ago = watching ? agoLabel(watch.lastCheckedAt, now) : null;
  const busy = syncing !== null || (watching && watch.checking);
  const canConnect = !demo && Boolean(googleClientId) && !token;

  let status: ReactNode;
  if (busy) {
    status = (
      <>
        <Spinner />
        <span>
          {syncing === "demo" ? "Checking the sample inbox…" : "Syncing…"}
          {slow && " This can take up to a minute."}
        </span>
      </>
    );
  } else if (watching) {
    status = (
      <>
        <span aria-hidden className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-green-600 dark:bg-green-400" />
        <span>Watching your inbox{ago ? ` · ${ago}` : ""}</span>
      </>
    );
  } else if (token) {
    status = <span>Gmail connected · live watch off</span>;
  } else if (canConnect) {
    status = (
      <>
        <span>Gmail not connected ·</span>
        <button
          type="button"
          onClick={onConnectGmail}
          className="-my-2 min-h-11 font-medium text-teal-700 underline underline-offset-2 dark:text-teal-300"
        >
          Connect Gmail
        </button>
      </>
    );
  } else if (demo) {
    status = <span>Sample inbox</span>;
  } else {
    status = null;
  }

  return (
    <section aria-label="Inbox alerts" className="space-y-3">
      {(status || result) && (
        <div className="flex min-h-6 items-center justify-between gap-3 px-1 text-xs text-stone-500 dark:text-stone-400">
          <p role="status" className="flex min-w-0 items-center gap-2">
            {status}
          </p>
          {result && (
            <p className="shrink-0 tabular-nums">
              {result.scanned} {result.scanned === 1 ? "email" : "emails"}
            </p>
          )}
        </div>
      )}

      {state.kind === "loading" && (
        <div aria-hidden className="space-y-3">
          <div className="h-14 animate-pulse rounded-2xl bg-stone-200/60 dark:bg-stone-800/60" />
          <div className="h-14 animate-pulse rounded-2xl bg-stone-200/60 dark:bg-stone-800/60" />
        </div>
      )}

      {result && (
        <div className="animate-fade-in" aria-live="polite">
          <RiskGroups key={scanId} alerts={result.alerts} />
        </div>
      )}
    </section>
  );
}
