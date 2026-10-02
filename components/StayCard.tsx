import type { ReactNode } from "react";
import type { Profile, StayStatus } from "@/lib/types";
import { computeStay } from "@/lib/stay/stayCalculator";

const VISA_LABEL: Record<Profile["visaType"], string> = {
  VWP: "Visa Waiver Program (ESTA)",
  B1: "B-1 visa",
  B2: "B-2 visa",
  "B1/B2": "B-1/B-2 visa",
};

const STATUS: Record<
  StayStatus,
  { label: string; pill: string; number: string; bar: string }
> = {
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
  onEditProfile: () => void;
}

export default function StayCard({ profile, today, onEditProfile }: Props) {
  const stay = computeStay(profile, today);
  const s = STATUS[stay.status];
  // The unknown state already explains the I-94 lookup in its body; don't repeat it as a note.
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
      className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6 dark:border-stone-800 dark:bg-stone-900"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="stay-heading" className="text-sm font-medium text-stone-600 dark:text-stone-400">
          Your stay · {VISA_LABEL[profile.visaType]}
        </h2>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${s.pill}`}
        >
          {s.label}
        </span>
      </div>

      {stay.status === "unknown" || stay.daysLeft === null ? (
        <div className="mt-4">
          <p className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
            Add your I-94 admit-until date
          </p>
          <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
            On a B visa, your last day is the date on your I-94 record, not your visa. Look it up on{" "}
            <a
              href="https://i94.cbp.dhs.gov"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-teal-700 underline underline-offset-2 dark:text-teal-300"
            >
              i94.cbp.dhs.gov
            </a>
            , then add it here.
          </p>
          <button
            type="button"
            onClick={onEditProfile}
            className="mt-4 rounded-full bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-800 dark:bg-teal-500 dark:text-teal-950 dark:hover:bg-teal-400"
          >
            Add I-94 date
          </button>
        </div>
      ) : stay.status === "overstay" ? (
        <div className="mt-4">
          <p className={`text-5xl font-semibold tracking-tight tabular-nums ${s.number}`}>
            {Math.abs(stay.daysLeft)}
            <span className="ml-2 text-lg font-medium text-stone-600 dark:text-stone-400">
              {Math.abs(stay.daysLeft) === 1 ? "day" : "days"} past your last day
            </span>
          </p>
          <p className="mt-3 text-sm leading-relaxed text-stone-700 dark:text-stone-300">
            Your last permitted day was {formatDate(stay.lastDay!)}. Please talk to an immigration
            attorney today — acting quickly limits the consequences.
          </p>
        </div>
      ) : (
        <div className="mt-4">
          <p className={`text-6xl font-semibold tracking-tight tabular-nums ${s.number}`}>
            {stay.daysLeft}
            <span className="ml-2 text-lg font-medium text-stone-600 dark:text-stone-400">
              {stay.daysLeft === 1 ? "day left" : "days left"}
            </span>
          </p>
          <p className="mt-2 text-sm text-stone-700 dark:text-stone-300">
            Last day in the U.S.:{" "}
            <span className="font-semibold text-stone-900 dark:text-stone-50">
              {formatDate(stay.lastDay!)}
            </span>
          </p>
          {progress !== null && (
            <div
              className="mt-4 h-2 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800"
              role="progressbar"
              aria-label="Share of your stay used"
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      )}

      {notes.length > 0 && (
        <ul className="mt-5 space-y-2 border-t border-stone-100 pt-4 text-sm leading-relaxed text-stone-600 dark:border-stone-800 dark:text-stone-400">
          {notes.map((note) => (
            <li key={note} className="flex gap-2">
              <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-stone-400" />
              <span className="min-w-0">{linkify(note)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
