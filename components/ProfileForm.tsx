"use client";

import { useState, type FormEvent } from "react";
import type { Profile, VisaType } from "@/lib/types";

const VISA_OPTIONS: { value: VisaType; label: string }[] = [
  { value: "VWP", label: "Visa Waiver Program (ESTA)" },
  { value: "B1", label: "B-1 business visitor visa" },
  { value: "B2", label: "B-2 tourist visa" },
  { value: "B1/B2", label: "B-1/B-2 visitor visa" },
];

const fieldClass =
  "mt-1.5 block w-full min-w-0 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-base text-stone-900 shadow-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100 dark:focus:border-teal-400 dark:focus:ring-teal-400/20";

const labelClass = "block text-sm font-medium text-stone-800 dark:text-stone-200";
const hintClass = "mt-1.5 text-sm text-stone-500 dark:text-stone-400";

interface Props {
  initial?: Profile | null;
  onSave: (profile: Profile) => void;
  onCancel?: () => void;
}

export default function ProfileForm({ initial, onSave, onCancel }: Props) {
  const [visaType, setVisaType] = useState<VisaType>(initial?.visaType ?? "VWP");
  const [entryDate, setEntryDate] = useState(initial?.entryDate ?? "");
  const [admitUntil, setAdmitUntil] = useState(initial?.admitUntil ?? "");
  const [homeCountry, setHomeCountry] = useState(initial?.homeCountry ?? "");
  const [error, setError] = useState<string | null>(null);

  const isB = visaType !== "VWP";

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!entryDate) {
      setError("Please add the date you entered the U.S.");
      return;
    }
    if (admitUntil && admitUntil < entryDate) {
      setError("Your I-94 admit-until date should be after your entry date.");
      return;
    }
    setError(null);
    const profile: Profile = { visaType, entryDate };
    if (admitUntil) profile.admitUntil = admitUntil;
    if (homeCountry.trim()) profile.homeCountry = homeCountry.trim();
    onSave(profile);
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="space-y-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6 dark:border-stone-800 dark:bg-stone-900"
    >
      <div>
        <label htmlFor="visaType" className={labelClass}>
          How did you enter the U.S.?
        </label>
        <select
          id="visaType"
          value={visaType}
          onChange={(e) => setVisaType(e.target.value as VisaType)}
          className={fieldClass}
        >
          {VISA_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="entryDate" className={labelClass}>
          Date you entered the U.S.
        </label>
        <input
          id="entryDate"
          type="date"
          required
          value={entryDate}
          onChange={(e) => setEntryDate(e.target.value)}
          className={fieldClass}
        />
      </div>

      <div>
        <label htmlFor="admitUntil" className={labelClass}>
          I-94 admit-until date{" "}
          <span className="font-normal text-stone-500 dark:text-stone-400">
            {isB ? "(needed to count your days)" : "(recommended)"}
          </span>
        </label>
        <input
          id="admitUntil"
          type="date"
          value={admitUntil}
          min={entryDate || undefined}
          onChange={(e) => setAdmitUntil(e.target.value)}
          className={fieldClass}
          aria-describedby="admitUntilHint"
        />
        <p id="admitUntilHint" className={hintClass}>
          This is the date you must leave by. Look it up for free on{" "}
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
      </div>

      <div>
        <label htmlFor="homeCountry" className={labelClass}>
          Home country <span className="font-normal text-stone-500 dark:text-stone-400">(optional)</span>
        </label>
        <input
          id="homeCountry"
          type="text"
          autoComplete="country-name"
          value={homeCountry}
          onChange={(e) => setHomeCountry(e.target.value)}
          placeholder="e.g. France"
          className={fieldClass}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-stone-500 dark:text-stone-400">Saved only in this browser.</p>
        <div className="flex gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-full border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-100 sm:flex-none dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="flex-1 rounded-full bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 sm:flex-none dark:bg-teal-500 dark:text-teal-950 dark:hover:bg-teal-400"
          >
            {initial ? "Save changes" : "See my status"}
          </button>
        </div>
      </div>
    </form>
  );
}
