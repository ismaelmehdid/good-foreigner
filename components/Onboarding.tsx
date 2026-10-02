"use client";

import { useEffect, useEffectEvent, useState, type ReactNode } from "react";
import type { Profile, VisaType } from "@/lib/types";
import { computeStay } from "@/lib/stay/stayCalculator";
import {
  needsHomeScreenInstall,
  notificationPermission,
  notificationsSupported,
  requestNotifications,
} from "@/lib/notify/notify";
import ConnectGmailButton from "@/components/ConnectGmailButton";
import { formatDate } from "@/components/StayCard";
import Logo from "@/components/Logo";

export type StepId = "visa" | "arrival" | "i94" | "country" | "gmail" | "notify";

const VISA_CHOICES: { value: VisaType; title: string; hint: string }[] = [
  { value: "VWP", title: "ESTA / Visa Waiver", hint: "No visa, just ESTA. Most Europeans, 90 days max." },
  { value: "B1", title: "B-1 visa", hint: "Business visitor: meetings, conferences, negotiations." },
  { value: "B2", title: "B-2 visa", hint: "Tourist: travel, visiting family, medical care." },
  { value: "B1/B2", title: "B-1/B-2 visa", hint: "Combined visitor visa, the most common kind." },
];

const inputClass =
  "block min-h-14 w-full min-w-0 appearance-none rounded-2xl border border-stone-300 bg-white px-4 text-lg text-stone-900 shadow-sm outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-600/15 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:focus:border-teal-400 dark:focus:ring-teal-400/15";

const primaryBtn =
  "min-h-14 w-full rounded-full bg-teal-700 px-6 text-base font-semibold text-white shadow-sm transition-colors active:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-teal-500 dark:text-teal-950 dark:active:bg-teal-400";
const secondaryBtn =
  "min-h-14 w-full rounded-full border border-stone-300 bg-white px-6 text-base font-semibold text-stone-800 transition-colors active:bg-stone-100 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:active:bg-stone-800";
const quietBtn =
  "min-h-14 w-full rounded-2xl border border-dashed border-stone-300 px-4 text-base font-medium text-stone-700 transition-colors active:bg-teal-50 dark:border-stone-700 dark:text-stone-300 dark:active:bg-teal-950/40";
const headingClass = "block text-3xl font-semibold leading-tight tracking-tight text-stone-900 dark:text-stone-50";
const leadClass = "mt-2 text-base leading-relaxed text-stone-600 dark:text-stone-400";

function BackArrow({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stone-700 active:bg-stone-200/70 dark:text-stone-200 dark:active:bg-stone-800"
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6" aria-hidden>
        <path
          fillRule="evenodd"
          d="M12.8 4.2a1 1 0 0 1 0 1.4L8.4 10l4.4 4.4a1 1 0 1 1-1.4 1.4l-5.1-5.1a1 1 0 0 1 0-1.4l5.1-5.1a1 1 0 0 1 1.4 0Z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );
}

/** Full-height step layout: top bar, content, and a sticky bottom action bar (safe-area aware). */
function Frame({
  top,
  children,
  actions,
}: {
  top: ReactNode;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 sm:px-6">
      <div className="pt-3">{top}</div>
      <div className="flex-1 pt-8 pb-8">{children}</div>
      <div className="sticky bottom-0 -mx-4 space-y-2 border-t border-stone-200/70 bg-background/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:-mx-6 sm:px-6 dark:border-stone-800/70">
        {actions}
      </div>
    </div>
  );
}

interface Props {
  initial: Profile | null;
  today: string;
  googleClientId: string | null;
  demo: boolean;
  loginHint?: string;
  token: string | null;
  gmailKey: number;
  onToken: (token: string) => void;
  /** Jump straight to one question (e.g. "i94" from the stay card). */
  startAt?: StepId;
  /** Back from the first step when editing an existing profile. */
  onCancel?: () => void;
  onComplete: (profile: Profile) => void;
}

export default function Onboarding({
  initial,
  today,
  googleClientId,
  demo,
  loginHint,
  token,
  gmailKey,
  onToken,
  startAt,
  onCancel,
  onComplete,
}: Props) {
  // Ask about Gmail only when it can be connected and isn't yet; about notifications unless already on.
  const [steps] = useState<StepId[]>(() => {
    const list: StepId[] = ["visa", "arrival", "i94", "country"];
    if (!demo && googleClientId && !token) list.push("gmail");
    if (notificationPermission() !== "granted") list.push("notify");
    return list;
  });
  const [index, setIndex] = useState(() => Math.max(0, startAt ? steps.indexOf(startAt) : 0));
  const [done, setDone] = useState(false);

  const [visaType, setVisaType] = useState<VisaType | null>(initial?.visaType ?? null);
  const [entryDate, setEntryDate] = useState(initial?.entryDate ?? "");
  const [admitUntil, setAdmitUntil] = useState(initial?.admitUntil ?? "");
  const [homeCountry, setHomeCountry] = useState(initial?.homeCountry ?? "");
  const [permission, setPermission] = useState<string>(() => String(notificationPermission()));
  const [asking, setAsking] = useState(false);

  const step = steps[index];
  const isVwp = visaType === "VWP";

  function buildProfile(): Profile {
    const p: Profile = { visaType: visaType ?? "VWP", entryDate };
    if (admitUntil) p.admitUntil = admitUntil;
    if (homeCountry.trim()) p.homeCountry = homeCountry.trim();
    return p;
  }

  let error: string | null = null;
  if (step === "arrival" && entryDate && today && entryDate > today) {
    error = "That date is in the future. Use the day you arrived in the U.S.";
  }
  if (step === "i94" && admitUntil && entryDate && admitUntil < entryDate) {
    error = "This should be after the day you arrived.";
  }

  const canContinue =
    !error &&
    (step === "visa"
      ? visaType !== null
      : step === "arrival"
        ? Boolean(entryDate)
        : step === "i94"
          ? Boolean(admitUntil)
          : true);

  function advance() {
    if (index < steps.length - 1) setIndex(index + 1);
    else setDone(true);
    window.scrollTo({ top: 0 });
  }

  function next() {
    if (done || !canContinue) return;
    advance();
  }

  function back() {
    if (done) setDone(false);
    else if (index > 0) setIndex(index - 1);
    else onCancel?.();
  }

  function notSureAboutI94() {
    setAdmitUntil("");
    advance();
  }

  async function allowNotifications() {
    setAsking(true);
    try {
      await requestNotifications();
    } catch {
      // Permission prompt failed or was dismissed; the status below reflects it.
    }
    setPermission(String(notificationPermission()));
    setAsking(false);
  }

  const onEnter = useEffectEvent((e: KeyboardEvent) => {
    if (e.key !== "Enter" || e.isComposing) return;
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === "BUTTON" || tag === "A" || tag === "TEXTAREA" || tag === "SELECT") return;
    e.preventDefault();
    if (done) onComplete(buildProfile());
    else next();
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onEnter(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const total = steps.length;
  const canGoBack = done || index > 0 || Boolean(onCancel);

  if (done) {
    const profile = buildProfile();
    const stay = computeStay(profile, today);
    return (
      <Frame
        top={
          <div className="flex min-h-11 items-center gap-2">
            <BackArrow onClick={back} label="Back" />
            <Logo />
          </div>
        }
        actions={
          <button type="button" onClick={() => onComplete(profile)} className={primaryBtn}>
            Go to my dashboard
          </button>
        }
      >
        <div className="flex min-h-[50dvh] flex-col justify-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
            You&apos;re all set
          </p>
          {stay.daysLeft !== null && stay.lastDay ? (
            <>
              <p className="mt-4 text-8xl font-semibold tracking-tight tabular-nums text-stone-900 dark:text-stone-50">
                {Math.abs(stay.daysLeft)}
              </p>
              <p className="mt-1 text-xl font-medium text-stone-700 dark:text-stone-300">
                {stay.daysLeft < 0
                  ? "days past your last day"
                  : stay.daysLeft === 1
                    ? "day left in the U.S."
                    : "days left in the U.S."}
              </p>
              <p className="mt-3 text-base text-stone-600 dark:text-stone-400">
                Your last day is <span className="font-semibold">{formatDate(stay.lastDay)}</span>.
                {!profile.admitUntil && " Estimated: 90 days from arrival."}
              </p>
            </>
          ) : (
            <>
              <h1 className={`mt-4 ${headingClass}`}>We&apos;ll keep an eye out for you.</h1>
              <p className={leadClass}>
                Add your I-94 date when you have it to see how many days you have left. We&apos;ll
                remind you on your dashboard.
              </p>
            </>
          )}
          {token && !demo && (
            <p className="mt-6 text-base text-stone-700 dark:text-stone-300">
              Gmail is connected. We&apos;ll check your inbox as soon as you open your dashboard.
            </p>
          )}
        </div>
      </Frame>
    );
  }

  let actions: ReactNode;
  if (step === "country" && !homeCountry.trim()) {
    actions = (
      <button type="button" onClick={next} className={secondaryBtn}>
        Skip
      </button>
    );
  } else if ((step === "gmail" && !token) || (step === "notify" && permission !== "granted")) {
    actions = (
      <button type="button" onClick={next} className={secondaryBtn}>
        {step === "gmail" ? "Skip for now" : "Skip"}
      </button>
    );
  } else {
    actions = (
      <button type="button" onClick={next} disabled={!canContinue} className={primaryBtn}>
        Continue
      </button>
    );
  }

  const supported = notificationsSupported();
  const needsInstall = needsHomeScreenInstall();

  return (
    <Frame
      top={
        <>
          <div className="flex min-h-11 items-center gap-2">
            {canGoBack ? (
              <BackArrow onClick={back} label={index === 0 ? "Cancel" : "Back"} />
            ) : (
              <Logo />
            )}
            <p className="ml-auto text-sm font-medium tabular-nums text-stone-500 dark:text-stone-400">
              Step {index + 1} of {total}
            </p>
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800"
            role="progressbar"
            aria-label={`Step ${index + 1} of ${total}`}
            aria-valuenow={index + 1}
            aria-valuemin={1}
            aria-valuemax={total}
          >
            <div
              className="h-full rounded-full bg-teal-600 transition-[width] duration-300 dark:bg-teal-400"
              style={{ width: `${((index + 1) / total) * 100}%` }}
            />
          </div>
        </>
      }
      actions={actions}
    >
      {step === "visa" && (
        <fieldset>
          <legend className={headingClass}>How did you enter the U.S.?</legend>
          <div role="radiogroup" aria-label="How did you enter the U.S.?" className="mt-6 grid gap-3">
            {VISA_CHOICES.map((c) => {
              const selected = visaType === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setVisaType(c.value)}
                  className={`flex min-h-[72px] w-full items-center gap-4 rounded-2xl border-2 px-5 py-4 text-left transition-colors ${
                    selected
                      ? "border-teal-600 bg-teal-50 dark:border-teal-400 dark:bg-teal-950/50"
                      : "border-stone-200 bg-white active:bg-stone-50 dark:border-stone-800 dark:bg-stone-900 dark:active:bg-stone-800"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                      selected ? "border-teal-600 dark:border-teal-400" : "border-stone-300 dark:border-stone-600"
                    }`}
                  >
                    {selected && <span className="h-3 w-3 rounded-full bg-teal-600 dark:bg-teal-400" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-lg font-semibold text-stone-900 dark:text-stone-50">{c.title}</span>
                    <span className="block text-sm text-stone-600 dark:text-stone-400">{c.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {step === "arrival" && (
        <div>
          <label htmlFor="ob-arrival" className={headingClass}>
            When did you arrive?
          </label>
          <p className={leadClass}>The day you last entered the U.S.</p>
          <input
            id="ob-arrival"
            type="date"
            autoFocus
            value={entryDate}
            max={today || undefined}
            onChange={(e) => setEntryDate(e.target.value)}
            className={`mt-6 ${inputClass}`}
          />
        </div>
      )}

      {step === "i94" && (
        <div>
          <label htmlFor="ob-i94" className={headingClass}>
            What&apos;s your I-94 &ldquo;admit until&rdquo; date?
          </label>
          <p className={leadClass}>
            It&apos;s the date you must leave by. Look it up free at{" "}
            <a
              href="https://i94.cbp.dhs.gov"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-teal-700 underline underline-offset-2 dark:text-teal-300"
            >
              i94.cbp.dhs.gov
            </a>
            .
          </p>
          <input
            id="ob-i94"
            type="date"
            autoFocus
            value={admitUntil}
            min={entryDate || undefined}
            onChange={(e) => setAdmitUntil(e.target.value)}
            className={`mt-6 ${inputClass}`}
          />
          <button type="button" onClick={notSureAboutI94} className={`mt-3 ${quietBtn}`}>
            {isVwp ? "I'm not sure — estimate 90 days" : "I'm not sure — remind me later"}
          </button>
        </div>
      )}

      {step === "country" && (
        <div>
          <label htmlFor="ob-country" className={headingClass}>
            Where are you from?
          </label>
          <p className={leadClass}>Optional. It helps with country-specific rules.</p>
          <input
            id="ob-country"
            type="text"
            inputMode="text"
            autoFocus
            autoComplete="country-name"
            autoCapitalize="words"
            enterKeyHint="next"
            value={homeCountry}
            onChange={(e) => setHomeCountry(e.target.value)}
            placeholder="e.g. France"
            className={`mt-6 ${inputClass}`}
          />
        </div>
      )}

      {step === "gmail" && (
        <div>
          <h1 className={headingClass}>Connect your Gmail so we can warn you about risky emails</h1>
          <p className={leadClass}>
            Job offers, payment requests and travel plans are where visitors slip up. We&apos;ll flag
            them before you reply.
          </p>
          <div className="mt-6 min-h-14">
            {token ? (
              <p className="flex min-h-14 items-center gap-2 text-base font-medium text-green-800 dark:text-green-200">
                <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-green-600 dark:bg-green-400" />
                Gmail connected. We&apos;ll scan it when you reach your dashboard.
              </p>
            ) : (
              <ConnectGmailButton key={gmailKey} clientId={googleClientId} loginHint={loginHint} onToken={onToken} />
            )}
          </div>
          <p className="mt-6 text-sm text-stone-500 dark:text-stone-400">
            Read-only access. This app stores nothing; recent emails are sent to Google&apos;s Gemini API
            for analysis.
          </p>
        </div>
      )}

      {step === "notify" && (
        <div>
          <h1 className={headingClass}>Get warned on your phone</h1>
          <p className={leadClass}>
            We&apos;ll send a notification when a new email could put your status at risk.
          </p>
          <div className="mt-6">
            {permission === "granted" ? (
              <p className="flex min-h-14 items-center gap-2 text-base font-medium text-green-800 dark:text-green-200">
                <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-green-600 dark:bg-green-400" />
                Notifications are on.
              </p>
            ) : needsInstall ? (
              <div className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
                <p className="text-base font-semibold text-stone-900 dark:text-stone-50">
                  On iPhone, add Good Foreigner to your Home Screen first:
                </p>
                <ol className="mt-3 space-y-2 text-base text-stone-700 dark:text-stone-300">
                  <li>
                    1. Tap <span className="font-semibold">Share</span>{" "}
                    <span aria-hidden className="inline-block rounded border border-stone-300 px-1 text-sm dark:border-stone-600">
                      ↑
                    </span>
                  </li>
                  <li>
                    2. Choose <span className="font-semibold">Add to Home Screen</span>
                  </li>
                  <li>
                    3. Open Good Foreigner from the new icon, then allow notifications
                  </li>
                </ol>
              </div>
            ) : !supported ? (
              <p className="text-base text-stone-700 dark:text-stone-300">
                This browser doesn&apos;t support notifications. You can still check your dashboard any
                time.
              </p>
            ) : permission === "denied" ? (
              <p className="text-base text-stone-700 dark:text-stone-300">
                Notifications are blocked for this site. You can turn them on in your browser settings.
              </p>
            ) : (
              <button type="button" onClick={allowNotifications} disabled={asking} className={primaryBtn}>
                {asking ? "Waiting for your answer…" : "Allow notifications"}
              </button>
            )}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </Frame>
  );
}
