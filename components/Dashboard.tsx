"use client";

import { useState, useSyncExternalStore } from "react";
import type { Profile } from "@/lib/types";
import { clearProfile, loadProfile, saveProfile } from "@/lib/profileStore";
import ProfileForm from "@/components/ProfileForm";
import StayCard from "@/components/StayCard";
import ScanPanel from "@/components/ScanPanel";
import ActionChecker from "@/components/ActionChecker";
import Disclaimer from "@/components/Disclaimer";

const noopSubscribe = () => () => {};

/** False during SSR and hydration, true afterwards — lets us read localStorage without a hydration mismatch. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

function todayLocalISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function Logo() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-7 w-7 text-teal-700 dark:text-teal-400">
      <path
        fill="currentColor"
        d="M12 2 4 5v6.1c0 5 3.4 9.7 8 10.9 4.6-1.2 8-5.9 8-10.9V5l-8-3Z"
        opacity=".15"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        d="M12 2 4 5v6.1c0 5 3.4 9.7 8 10.9 4.6-1.2 8-5.9 8-10.9V5l-8-3Z"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m8.5 12 2.5 2.5 4.5-5"
      />
    </svg>
  );
}

export default function Dashboard({ googleClientId }: { googleClientId: string | null }) {
  const hydrated = useHydrated();
  // undefined = not changed this session, so fall back to what is saved in the browser.
  const [override, setOverride] = useState<Profile | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);

  const profile = override !== undefined ? override : hydrated ? loadProfile() : null;
  const showForm = hydrated && (!profile || editing);
  // One local calendar date shared by the countdown and the AI requests, so they agree.
  const today = hydrated ? todayLocalISO() : "";

  function handleSave(p: Profile) {
    saveProfile(p);
    setOverride(p);
    setEditing(false);
    window.scrollTo({ top: 0 });
  }

  function handleReset() {
    clearProfile();
    setOverride(null);
    setEditing(false);
  }

  function startEditing() {
    setEditing(true);
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 sm:px-6">
      <header className="flex items-center justify-between gap-3 py-5">
        <div className="flex items-center gap-2.5">
          <Logo />
          <div>
            <p className="text-base font-semibold leading-tight text-stone-900 dark:text-stone-50">
              Good Foreigner
            </p>
            <p className="text-xs text-stone-500 dark:text-stone-400">Stay in status</p>
          </div>
        </div>
        {hydrated && profile && !editing && (
          <button
            type="button"
            onClick={startEditing}
            className="rounded-full px-3 py-1.5 text-sm font-medium text-teal-700 underline-offset-2 hover:underline dark:text-teal-300"
          >
            Edit profile
          </button>
        )}
      </header>

      <main className="flex-1">
        {!hydrated ? (
          <div aria-busy="true" className="space-y-4 pt-2">
            <div className="h-40 animate-pulse rounded-2xl bg-stone-200/60 dark:bg-stone-800/60" />
            <div className="h-28 animate-pulse rounded-2xl bg-stone-200/60 dark:bg-stone-800/60" />
          </div>
        ) : showForm ? (
          <div className="space-y-6 pt-2">
            {editing && profile ? (
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
                  Edit your profile
                </h1>
                <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
                  Keep your dates current so your countdown stays accurate.
                </p>
              </div>
            ) : (
              <div className="pt-4 pb-2">
                <h1 className="text-3xl font-semibold leading-tight tracking-tight text-balance text-stone-900 sm:text-4xl dark:text-stone-50">
                  Stay in status. Get warned before you act.
                </h1>
                <p className="mt-3 text-base leading-relaxed text-stone-600 dark:text-stone-400">
                  For visitors on a B-1/B-2 visa or the Visa Waiver Program (ESTA). We count your
                  days and check your emails and plans against official U.S. rules — so a small
                  paid gig or a missed date doesn&apos;t cost you future visits.
                </p>
              </div>
            )}
            <ProfileForm
              key={editing ? "edit" : "new"}
              initial={editing ? profile : null}
              onSave={handleSave}
              onCancel={editing && profile ? () => setEditing(false) : undefined}
            />
            {editing && profile && (
              <button
                type="button"
                onClick={handleReset}
                className="text-sm text-stone-500 underline underline-offset-2 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
              >
                Clear my profile from this browser
              </button>
            )}
          </div>
        ) : profile ? (
          <div className="space-y-8 pt-2">
            <StayCard profile={profile} today={today} onEditProfile={startEditing} />
            <ScanPanel profile={profile} today={today} googleClientId={googleClientId} />
            <ActionChecker profile={profile} today={today} />
          </div>
        ) : null}
      </main>

      <Disclaimer />
    </div>
  );
}
