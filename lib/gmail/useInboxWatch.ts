"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import type { Alert, Profile, ScanResponse } from "@/lib/types";

const SEEN_KEY = "gf.seen";
const MAX_SEEN = 300; // matches the server's skipIds cap

export interface InboxWatchOptions {
  token: string | null;
  profile: Profile | null;
  today: string;
  enabled: boolean;
  intervalMs?: number;
  onNewAlerts: (alerts: Alert[]) => void;
  onAuthError: (status: number) => void;
}

export interface InboxWatchState {
  lastCheckedAt: number | null;
  checking: boolean;
  error: string | null;
  markSeen: (ids: string[]) => void;
}

function readSeen(): string[] {
  try {
    const raw = window.sessionStorage.getItem(SEEN_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeSeen(ids: string[]): void {
  try {
    window.sessionStorage.setItem(SEEN_KEY, JSON.stringify(ids));
  } catch {
    // Storage blocked: the in-memory ref still dedupes for this page.
  }
}

/**
 * Polls /api/scan while the page is visible and reports only emails it has not seen before.
 * Seen Gmail ids are sent as `skipIds`, so a poll with nothing new costs one Gmail list call
 * and no model calls. Call `markSeen` with the ids from a manual scan so they are not
 * re-analyzed or re-notified.
 */
export function useInboxWatch({
  token,
  profile,
  today,
  enabled,
  intervalMs = 30000,
  onNewAlerts,
  onAuthError,
}: InboxWatchOptions): InboxWatchState {
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seenRef = useRef<string[] | null>(null); // oldest first; loaded lazily from sessionStorage
  const inFlightRef = useRef(false);
  const stoppedRef = useRef(false); // set after a 401/403 until the watch is re-armed

  const getSeen = useCallback((): string[] => {
    if (seenRef.current === null) seenRef.current = readSeen();
    return seenRef.current;
  }, []);

  const markSeen = useCallback(
    (ids: string[]) => {
      const seen = getSeen();
      const known = new Set(seen);
      let changed = false;
      for (const id of ids) {
        if (typeof id === "string" && id && !known.has(id)) {
          seen.push(id);
          known.add(id);
          changed = true;
        }
      }
      if (!changed) return;
      if (seen.length > MAX_SEEN) seen.splice(0, seen.length - MAX_SEEN);
      writeSeen(seen);
    },
    [getSeen],
  );

  const poll = useEffectEvent(async () => {
    if (!enabled || !token || !profile || stoppedRef.current || inFlightRef.current) return;
    if (document.visibilityState !== "visible") return;

    inFlightRef.current = true;
    setChecking(true);
    try {
      const skipIds = getSeen().slice(-MAX_SEEN);
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ profile, today, skipIds }),
      });
      if (res.status === 401 || res.status === 403) {
        stoppedRef.current = true;
        setError(res.status === 401 ? "Gmail session expired" : "Gmail access was refused");
        onAuthError(res.status);
        return;
      }
      if (!res.ok) {
        setError(`Inbox check failed (${res.status})`);
        return;
      }
      const data = (await res.json()) as ScanResponse;
      const seen = new Set(getSeen());
      const fresh = (data.alerts ?? []).filter((a) => !seen.has(a.item.id));
      markSeen((data.alerts ?? []).map((a) => a.item.id));
      setError(null);
      setLastCheckedAt(Date.now());
      if (fresh.length > 0) onNewAlerts(fresh);
    } catch {
      setError("Could not reach the server");
    } finally {
      inFlightRef.current = false;
      setChecking(false);
    }
  });

  useEffect(() => {
    if (!enabled || !token) return;
    stoppedRef.current = false; // new token or re-enabled: resume after a previous auth error

    const id = window.setInterval(() => void poll(), intervalMs);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, token, intervalMs]);

  return { lastCheckedAt, checking, error, markSeen };
}
