"use client";

import { useState } from "react";
import type { Alert } from "@/lib/types";
import RiskBadge, { RISK_EDGE } from "@/components/RiskBadge";

function sourceLine(alert: Alert): string {
  const { item } = alert;
  if (item.source === "action") return "Your planned action";
  const parts = [item.from, item.subject].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Email";
}

function fallbackTitle(alert: Alert): string {
  if (alert.risk === "unknown") return "We couldn't analyze this one";
  if (alert.risk === "none") return "Nothing here looks like a status issue";
  return "Worth a closer look";
}

function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    window.setTimeout(() => setState("idle"), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-full border border-stone-300 px-3 py-1 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-stone-600 dark:text-stone-200 dark:hover:bg-stone-800"
    >
      {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy"}
    </button>
  );
}

export default function AlertCard({ alert }: { alert: Alert }) {
  const { verdict } = alert;
  const title = verdict?.title || fallbackTitle(alert);
  const explanation =
    verdict?.explanation ||
    (alert.risk === "none" && alert.triage?.reason ? alert.triage.reason : "");

  return (
    <article
      className={`min-w-0 rounded-2xl border border-l-4 border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900 ${RISK_EDGE[alert.risk] ?? RISK_EDGE.unknown}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <RiskBadge risk={alert.risk} />
        <p className="min-w-0 flex-1 line-clamp-2 text-xs text-stone-500 dark:text-stone-400">
          {sourceLine(alert)}
        </p>
      </div>

      <h3 className="mt-3 text-base font-semibold leading-snug text-stone-900 dark:text-stone-50">
        {title}
      </h3>

      {explanation && (
        <p className="mt-2 text-sm leading-relaxed text-stone-700 dark:text-stone-300">
          {explanation}
        </p>
      )}

      {alert.risk === "unknown" && (
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
          {alert.error || "Something went wrong while checking this one. Please try again in a moment."}
        </p>
      )}

      {verdict?.whatToDoInstead && (
        <div className="mt-4 rounded-xl bg-teal-50 p-4 ring-1 ring-inset ring-teal-200 dark:bg-teal-950/50 dark:ring-teal-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-800 dark:text-teal-300">
            What to do instead
          </p>
          <p className="mt-1 text-sm leading-relaxed text-teal-950 dark:text-teal-50">
            {verdict.whatToDoInstead}
          </p>
        </div>
      )}

      {verdict?.suggestedReply && (
        <div className="mt-4 rounded-xl border border-stone-200 p-4 dark:border-stone-700">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-600 dark:text-stone-400">
              Suggested reply
            </p>
            <CopyButton text={verdict.suggestedReply} />
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-stone-800 dark:text-stone-200">
            {verdict.suggestedReply}
          </p>
        </div>
      )}

      {alert.citations?.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
            Rules and sources
          </p>
          <ul className="mt-1 space-y-1">
            {alert.citations.map((c) => (
              <li key={c.ruleId} className="text-sm">
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-700 underline decoration-teal-700/30 underline-offset-2 hover:decoration-teal-700 dark:text-teal-300 dark:decoration-teal-300/30 dark:hover:decoration-teal-300"
                >
                  {c.title}
                </a>
                <span className="text-stone-500 dark:text-stone-400"> — {c.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
