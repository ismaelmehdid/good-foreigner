"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import type { CheckResponse, Profile } from "@/lib/types";
import AlertCard from "@/components/AlertCard";

const EXAMPLES = [
  "Can I accept $150 for a paid feedback session?",
  "Can I do a few days of remote work for my employer back home?",
  "If I go to Vancouver for a weekend, does my 90-day clock reset?",
];

type CheckState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "done"; result: CheckResponse };

// The server only analyzes the first 2,000 characters.
const MAX_CHARS = 2000;
const TIMEOUT_MS = 100_000;

export default function ActionChecker({ profile, today }: { profile: Profile; today: string }) {
  const [text, setText] = useState("");
  const [state, setState] = useState<CheckState>({ kind: "idle" });

  const loading = state.kind === "loading";
  const canSubmit = text.trim().length > 0 && !loading;

  async function check() {
    const value = text.trim();
    if (!value || loading) return;
    setState({ kind: "loading" });
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: value, profile, today }),
        signal: controller.signal,
      });
      let data: unknown = null;
      try {
        data = await res.json();
      } catch {
        // Non-JSON response; handled below.
      }
      if (controller.signal.aborted) throw new Error("timeout");
      if (!res.ok || !data || !(data as CheckResponse).alert) {
        const message =
          (data as { error?: string } | null)?.error ?? `The check failed (error ${res.status}).`;
        setState({ kind: "error", message });
        return;
      }
      setState({ kind: "done", result: data as CheckResponse });
    } catch {
      setState({
        kind: "error",
        message: controller.signal.aborted
          ? "The AI is slow right now — try again"
          : "We couldn't reach the server. Check your connection and try again.",
      });
    } finally {
      window.clearTimeout(timer);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void check();
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void check();
    }
  }

  return (
    <section aria-labelledby="check-heading" className="space-y-4">
      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6 dark:border-stone-800 dark:bg-stone-900"
      >
        <h2 id="check-heading" className="text-lg font-semibold text-stone-900 dark:text-stone-50">
          Check before you act
        </h2>
        <label
          htmlFor="action-text"
          className="mt-1 block text-sm text-stone-600 dark:text-stone-400"
        >
          About to do or send something? Paste it here
        </label>
        <textarea
          id="action-text"
          rows={4}
          value={text}
          maxLength={MAX_CHARS}
          onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
          onKeyDown={onKeyDown}
          aria-describedby="action-text-count"
          placeholder="A question, a job offer, or a message you're about to send…"
          className="mt-3 block w-full min-w-0 resize-y rounded-xl border border-stone-300 bg-white px-3.5 py-3 text-base leading-relaxed text-stone-900 shadow-sm outline-none transition placeholder:text-stone-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:border-teal-400 dark:focus:ring-teal-400/20"
        />
        <p
          id="action-text-count"
          className={`mt-1 text-right text-xs tabular-nums ${
            text.length >= MAX_CHARS
              ? "font-medium text-amber-700 dark:text-amber-300"
              : "text-stone-500 dark:text-stone-400"
          }`}
        >
          {text.length}/{MAX_CHARS}
        </p>

        <div className="mt-2 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setText(ex)}
              className="min-h-11 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-2 text-left text-sm text-stone-700 transition-colors active:border-teal-300 active:bg-teal-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:active:border-teal-700 dark:active:bg-teal-950"
            >
              {ex}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="submit"
            disabled={!canSubmit}
            className="order-1 min-h-12 w-full rounded-full bg-teal-700 px-6 text-base font-semibold sm:w-auto text-white shadow-sm transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 sm:order-2 dark:bg-teal-500 dark:text-teal-950 dark:hover:bg-teal-400"
          >
            {loading ? "Checking…" : "Check it"}
          </button>
          {loading ? (
            <p
              role="status"
              className="order-2 flex items-center gap-2 text-sm text-stone-600 sm:order-1 dark:text-stone-400"
            >
              <span
                aria-hidden
                className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-teal-600/30 border-t-teal-600 dark:border-teal-300/30 dark:border-t-teal-300"
              />
              Checking with Gemma, then Gemini…
            </p>
          ) : (
            <p className="order-2 text-xs text-stone-500 sm:order-1 dark:text-stone-400">
              This app stores nothing. Answers cite official sources.
            </p>
          )}
        </div>

        {state.kind === "error" && (
          <div
            role="alert"
            className="mt-4 flex flex-col gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-inset ring-red-200 sm:flex-row sm:items-center sm:justify-between dark:bg-red-950/50 dark:text-red-200 dark:ring-red-900"
          >
            <span>{state.message}</span>
            <button
              type="submit"
              disabled={!canSubmit}
              className="min-h-11 w-fit rounded-full border border-red-300 px-4 text-sm font-semibold hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:hover:bg-red-900/50"
            >
              Try again
            </button>
          </div>
        )}
      </form>

      {state.kind === "done" && (
        <div aria-live="polite">
          <AlertCard key={state.result.alert.item.id} alert={state.result.alert} defaultOpen />
        </div>
      )}
    </section>
  );
}
