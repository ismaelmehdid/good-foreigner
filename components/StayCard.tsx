import type { ReactNode } from "react";
import type { Profile, StayStatus } from "@/lib/types";
import { computeStay } from "@/lib/stay/stayCalculator";
import Chevron from "@/components/Chevron";

export const VISA_LABEL: Record<Profile["visaType"], string> = {
  VWP: "ESTA / Visa Waiver",
  B1: "B-1 visa",
  B2: "B-2 visa",
  "B1/B2": "B-1/B-2 visa",
};

const STATUS: Record<StayStatus, { label: string; pill: string; number: string; bar: string }> = {
  ok: {
    label: "On track",
    pill: "bg-green-50 text-green-800 ring-green-200 dark:bg-green-950/60 dark:text-green-200 dark:ring-green-900",
    number: "text-stone-900 dark:text-stone-50",
    bar: "bg-teal-600 dark:bg-teal-400",
  },
  warning: {
    label: "Getting close",
    pill: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:ring-amber-900",
    number: "text-amber-700 dark:text-amber-300",
    bar: "bg-amber-500 dark:bg-amber-400",
  },
  critical: {
    label: "Leave very soon",
    pill: "bg-red-50 text-red-800 ring-red-200 dark:bg-red-950/60 dark:text-red-200 dark:ring-red-900",
    number: "text-red-700 dark:text-red-300",
    bar: "bg-red-600 dark:bg-red-400",
  },
  overstay: {
    label: "Past your date",
    pill: "bg-red-50 text-red-800 ring-red-200 dark:bg-red-950/60 dark:text-red-200 dark:ring-red-900",
    number: "text-red-700 dark:text-red-300",
    bar: "bg-red-600 dark:bg-red-400",
  },
  unknown: {
    label: "Needs your I-94 date",
    pill: "bg-stone-100 text-stone-700 ring-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-700",
    number: "text-stone-900 dark:text-stone-50",
    bar: "bg-stone-400",
  },
};

const DAY_MS = 86_400_000;

function utcMs(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function formatDate(iso: string): string {
  return new Date(utcMs(iso)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Turn bare URLs inside a note into links. */
function linkify(text: string): ReactNode[] {
  return text.split(/(https?:\/\/[^\s]+?)(?=[.,)]?(?:\s|$))/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-teal-700 underline underline-offset-2 dark:text-teal-300"
      >
        {part.replace(/^https?:\/\//, "")}
      </a>
    ) : (
      part
    ),
  );
}

interface Props {
  profile: Profile;
  today: string;
  /** Opens the wizard at the I-94 question. */
  onAddI94: () => void;
}

export default function StayCard({ profile, today, onAddI94 }: Props) {
  const stay = computeStay(profile, today);
  const s = STATUS[stay.status];
  // The unknown state already explains the I-94 lookup; don't repeat it as a note.
  const notes =
    stay.status === "unknown" ? stay.notes.filter((n) => !/^Add your I-94/i.test(n)) : stay.notes;

  let progress: number | null = null;
  if (stay.lastDay) {
    const total = (utcMs(stay.lastDay) - utcMs(profile.entryDate)) / DAY_MS + 1;
    const used = (utcMs(today) - utcMs(profile.entryDate)) / DAY_MS + 1;
    if (total > 0) progress = Math.min(100, Math.max(0, (used / total) * 100));
  }

  return (
    <section
      aria-labelledby="stay-heading"
      className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="stay-heading" className="text-sm font-medium text-stone-600 dark:text-stone-400">
          Your stay · <span className="whitespace-nowrap">{VISA_LABEL[profile.visaType]}</span>
        </h2>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${s.pill}`}>
          {s.label}
        </span>
      </div>

      {stay.daysLeft === null || stay.lastDay === null ? (
        <div className="mt-3">
          <p className="text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
            Add your I-94 date to see your days left
          </p>
          <p className="mt-1 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
            On a B visa, your last day is on your I-94 record. Find it free at{" "}
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
          <button
            type="button"
            onClick={onAddI94}
            className="mt-3 min-h-11 rounded-full bg-teal-700 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-800 active:bg-teal-800 dark:bg-teal-500 dark:text-teal-950 dark:hover:bg-teal-400 dark:active:bg-teal-400"
          >
            Add I-94 date
          </button>
        </div>
      ) : (
        <div className="mt-2">
          <p className={`text-6xl font-semibold tracking-tight tabular-nums ${s.number}`}>
            {Math.abs(stay.daysLeft)}
            <span className="ml-2 text-lg font-medium tracking-normal text-stone-600 dark:text-stone-400">
              {stay.status === "overstay"
                ? `${Math.abs(stay.daysLeft) === 1 ? "day" : "days"} past your last day`
                : stay.daysLeft === 1
                  ? "day left"
                  : "days left"}
            </span>
          </p>
          <p className="mt-1 text-sm text-stone-700 dark:text-stone-300">
            {stay.status === "overstay" ? "Your last day was " : "Last day in the U.S.: "}
            <span className="font-semibold text-stone-900 dark:text-stone-50">
              {formatDate(stay.lastDay)}
            </span>
          </p>
          {stay.status === "overstay" && (
            <p className="mt-2 text-sm leading-relaxed text-red-800 dark:text-red-200">
              Please talk to an immigration attorney today — acting quickly limits the consequences.
            </p>
          )}
          {progress !== null && (
            <div
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800"
              role="progressbar"
              aria-label="Share of your stay used"
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${s.bar}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {stay.warning && (
        <p
          role="note"
          className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/50 dark:text-amber-100 dark:ring-amber-900"
        >
          {linkify(stay.warning)}
        </p>
      )}

      {notes.length > 0 && (
        <details className="group mt-3">
          <summary className="-mb-2 flex min-h-11 w-fit cursor-pointer list-none items-center gap-1 rounded-lg text-sm font-medium text-teal-700 transition-colors hover:text-teal-900 dark:text-teal-300 dark:hover:text-teal-100 [&::-webkit-details-marker]:hidden">
            Good to know
            <span aria-hidden className="transition-transform duration-200 group-open:rotate-180">
              <Chevron />
            </span>
          </summary>
          <ul className="mt-1 animate-fade-in space-y-1.5 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
            {notes.map((note) => (
              <li key={note} className="flex gap-2">
                <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-stone-400" />
                <span className="min-w-0">{linkify(note)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
