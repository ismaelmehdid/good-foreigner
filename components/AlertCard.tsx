"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Alert, Citation } from "@/lib/types";
import { RISK_DOT, RISK_LABEL, RISK_TEXT } from "@/components/RiskBadge";
import Chevron from "@/components/Chevron";

/** Below Tailwind's `sm` breakpoint the details open in a bottom sheet instead of inline. */
const SHEET_QUERY = "(max-width: 639px)";
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const UNVERIFIED_LINE =
  "We couldn't match this to an official rule. Confirm with an immigration attorney.";

/** "Jordan Lee <jordan@x.com>" → "Jordan Lee". */
function senderName(from?: string): string {
  if (!from) return "";
  const m = from.match(/^\s*"?([^"<]+?)"?\s*<[^>]+>\s*$/);
  return (m ? m[1] : from).trim();
}

function sourceLine(alert: Alert): string {
  const { item } = alert;
  if (item.source === "action") return "Your question";
  const parts = [senderName(item.from), item.subject].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Email";
}

function titleFor(alert: Alert): string {
  if (alert.verdict?.title) return alert.verdict.title;
  if (alert.risk === "unknown") return "We couldn't check this one";
  if (alert.item.source === "email" && alert.item.subject) return alert.item.subject;
  return "Nothing here looks like a status issue";
}

function firstSentence(text: string): string {
  const m = text.trim().match(/^[\s\S]*?[.!?](?=\s|$)/);
  return (m ? m[0] : text).trim();
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
      className="min-h-11 rounded-full border border-stone-300 px-4 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-stone-600 dark:text-stone-200 dark:hover:bg-stone-800"
    >
      {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy"}
    </button>
  );
}

function SourceLink({ c }: { c: Citation }) {
  return (
    <a
      href={c.url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-teal-700 underline decoration-teal-700/30 underline-offset-2 hover:decoration-teal-700 dark:text-teal-300 dark:decoration-teal-300/30 dark:hover:decoration-teal-300"
    >
      {c.name}
    </a>
  );
}

/** "Why (official sources)": each claim with the official source of its rule. */
function WhySources({ alert }: { alert: Alert }) {
  const byRule = new Map(alert.citations?.map((c) => [c.ruleId, c]) ?? []);
  const evidence = (alert.verdict?.evidence ?? []).filter((e) => e.claim?.trim());
  const matched = evidence.filter((e) => byRule.has(e.ruleId));
  const citations = alert.citations ?? [];
  const hasLink = matched.length > 0 || citations.length > 0;

  return (
    <div>
      {hasLink && (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
            Why (official sources)
          </p>
          {matched.length > 0 ? (
            <ul className="mt-2 space-y-2.5">
              {evidence.map((e, i) => {
                const c = byRule.get(e.ruleId);
                return (
                  <li key={i} className="text-sm leading-relaxed">
                    <p className="text-stone-800 dark:text-stone-200">{e.claim}</p>
                    {c ? (
                      <p className="text-xs">
                        <span className="text-stone-500 dark:text-stone-400">{c.title} — </span>
                        <SourceLink c={c} />
                      </p>
                    ) : (
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        No official source matched this point.
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {citations.map((c) => (
                <li key={c.ruleId} className="text-sm">
                  <span className="text-stone-700 dark:text-stone-300">{c.title} — </span>
                  <SourceLink c={c} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {(alert.unsourced || !hasLink) && (
        <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/50 dark:text-amber-100 dark:ring-amber-900">
          {UNVERIFIED_LINE}
        </p>
      )}
    </div>
  );
}

export default function AlertCard({
  alert,
  defaultOpen = false,
}: {
  alert: Alert;
  defaultOpen?: boolean;
}) {
  const { verdict } = alert;
  const risk = RISK_LABEL[alert.risk] ? alert.risk : "unknown";
  const expandable = Boolean(verdict);
  const [open, setOpen] = useState(defaultOpen && expandable);
  const detailsId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const doInstead = verdict?.whatToDoInstead?.trim() ?? "";
  const doInsteadShort = doInstead ? firstSentence(doInstead) : "";
  const showFullDoInstead = doInstead.length > doInsteadShort.length + 1;

  const summary = (
    <>
      <span aria-hidden className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${RISK_DOT[risk]}`} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`text-xs font-semibold ${RISK_TEXT[risk]}`}>{RISK_LABEL[risk]}</span>
          {alert.unsourced && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">
              Unverified — no official rule found
            </span>
          )}
        </span>
        <span className="mt-0.5 block font-semibold leading-snug text-stone-900 dark:text-stone-50">
          {titleFor(alert)}
        </span>
        <span className="mt-0.5 block truncate text-xs text-stone-500 dark:text-stone-400">
          {sourceLine(alert)}
        </span>
        {doInsteadShort && (
          <span className="mt-2 block text-sm leading-snug text-teal-900 dark:text-teal-100">
            <span className="font-semibold">Do this instead:</span> {doInsteadShort}
          </span>
        )}
        {risk === "unknown" && (
          <span className="mt-1 block text-sm text-stone-600 dark:text-stone-400">
            {alert.error || "Something went wrong while checking this one. Please try again."}
          </span>
        )}
      </span>
    </>
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Phones: while the sheet is open, lock page scroll, move focus into the sheet and keep Tab
  // inside it; on close, give focus back to the card.
  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia(SHEET_QUERY);
    const root = document.documentElement;
    const body = document.body;
    const prev = { root: root.style.overflow, body: body.style.overflow };
    const toggle = toggleRef.current;
    let sheet = false;

    const unlock = () => {
      root.style.overflow = prev.root;
      body.style.overflow = prev.body;
    };
    const apply = () => {
      sheet = mq.matches;
      if (sheet) {
        root.style.overflow = "hidden";
        body.style.overflow = "hidden";
        closeRef.current?.focus({ preventScroll: true });
      } else {
        unlock();
      }
    };
    const trapTab = (e: KeyboardEvent) => {
      const dialog = dialogRef.current;
      if (!sheet || e.key !== "Tab" || !dialog) return;
      const nodes = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => n.tabIndex >= 0 && n.offsetParent !== null,
      );
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      const inside = active instanceof Node && dialog.contains(active);
      if (e.shiftKey && (active === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };

    apply();
    mq.addEventListener("change", apply);
    document.addEventListener("keydown", trapTab);
    return () => {
      mq.removeEventListener("change", apply);
      document.removeEventListener("keydown", trapTab);
      unlock();
      if (sheet) toggle?.focus({ preventScroll: true });
    };
  }, [open]);

  const details = verdict ? (
    <div className="space-y-4">
      {verdict.explanation && (
        <p className="text-sm leading-relaxed text-stone-700 dark:text-stone-300">{verdict.explanation}</p>
      )}

      {showFullDoInstead && (
        <div className="rounded-xl bg-teal-50 p-4 ring-1 ring-inset ring-teal-200 dark:bg-teal-950/50 dark:ring-teal-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-800 dark:text-teal-300">
            What to do instead
          </p>
          <p className="mt-1 text-sm leading-relaxed text-teal-950 dark:text-teal-50">{doInstead}</p>
        </div>
      )}

      {verdict.suggestedReply && (
        <div className="rounded-xl border border-stone-200 p-4 dark:border-stone-700">
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

      <WhySources alert={alert} />
    </div>
  ) : null;

  return (
    <article className="min-w-0 rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-900">
      {expandable ? (
        <button
          ref={toggleRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={detailsId}
          className={`flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-stone-50 active:bg-stone-100/70 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-600 sm:p-5 dark:hover:bg-stone-800/60 dark:active:bg-stone-800 ${
            open ? "rounded-2xl sm:rounded-b-none" : "rounded-2xl"
          }`}
        >
          {summary}
          <span
            aria-hidden
            className={`mt-0.5 text-stone-400 transition-transform duration-200 dark:text-stone-500 ${open ? "sm:rotate-180" : ""}`}
          >
            <Chevron />
          </span>
          <span className="sr-only">{open ? "Hide details" : "Show details"}</span>
        </button>
      ) : (
        <div className="flex items-start gap-3 p-4 sm:p-5">{summary}</div>
      )}

      {open && details && (
        <>
          {/* sm and up: details expand inline. */}
          <div
            id={detailsId}
            className="hidden animate-fade-in border-t border-stone-100 px-5 pt-4 pb-5 sm:block dark:border-stone-800"
          >
            {details}
          </div>

          {/* Phones: details slide up in a bottom sheet. */}
          <div
            ref={dialogRef}
            className="fixed inset-0 z-50 sm:hidden"
            role="dialog"
            aria-modal="true"
            aria-label={titleFor(alert)}
          >
            <button
              type="button"
              aria-label="Close details"
              tabIndex={-1}
              onClick={() => setOpen(false)}
              className="absolute inset-0 touch-none animate-fade-in bg-black/45 dark:bg-black/65"
            />
            <div className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] animate-sheet-up flex-col rounded-t-3xl bg-white shadow-2xl dark:bg-stone-900 dark:ring-1 dark:ring-white/10">
              <div className="flex shrink-0 items-start gap-3 px-5 pt-2">
                <div className="min-w-0 flex-1 pt-2">
                  <span aria-hidden className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-stone-300 dark:bg-stone-600" />
                  <p className={`text-xs font-semibold ${RISK_TEXT[risk]}`}>{RISK_LABEL[risk]}</p>
                  <p className="mt-0.5 text-lg font-semibold leading-snug text-stone-900 dark:text-stone-50">
                    {titleFor(alert)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-stone-500 dark:text-stone-400">{sourceLine(alert)}</p>
                </div>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 active:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800 dark:active:bg-stone-800"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
                    <path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4Z" />
                  </svg>
                </button>
              </div>
              <div className="overflow-y-auto overscroll-contain px-5 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                {details}
              </div>
            </div>
          </div>
        </>
      )}
    </article>
  );
}
