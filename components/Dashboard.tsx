"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Profile } from "@/lib/types";
import type { GoogleUser } from "@/lib/auth/decodeIdToken";
import { getUserSnapshot, loadUser, saveUser, subscribeUser } from "@/lib/auth/userStore";
import { loadProfile, saveProfile } from "@/lib/profileStore";
import { useGmailToken } from "@/lib/gmail/useGmailToken";
import { signOut } from "@/components/GoogleSignInButton";
import {
  needsHomeScreenInstall,
  notificationPermission,
  requestNotifications,
  sendTestNotification,
} from "@/lib/notify/notify";
import Toast, { type ToastTone } from "@/components/Toast";
import Welcome from "@/components/Welcome";
import Onboarding, { type StepId } from "@/components/Onboarding";
import StayCard from "@/components/StayCard";
import ScanPanel, { type ScanMode } from "@/components/ScanPanel";
import RealtimeAlertsCard from "@/components/RealtimeAlertsCard";
import ActionChecker from "@/components/ActionChecker";
import Disclaimer from "@/components/Disclaimer";
import Logo from "@/components/Logo";
import Chevron from "@/components/Chevron";

const DEMO_ACCOUNT = "demo";
const noopSubscribe = () => () => {};

/** False during SSR and hydration, true afterwards — lets us read localStorage without a hydration mismatch. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

function localISO(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayLocalISO(): string {
  return localISO(new Date());
}

/** Demo visitor: on ESTA, arrived 62 days ago (27 days left). */
function demoProfile(): Profile {
  const d = new Date();
  d.setDate(d.getDate() - 62);
  return { visaType: "VWP", entryDate: localISO(d), homeCountry: "France" };
}

function MenuLabel({ label, value, on }: { label: string; value: string; on: boolean }) {
  return (
    <span className="flex w-full items-center justify-between gap-3">
      {label}
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
          on
            ? "bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-200"
            : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300"
        }`}
      >
        {value}
      </span>
    </span>
  );
}

function AccountMenu({
  user,
  demo,
  watchAvailable,
  watchEnabled,
  onToggleWatch,
  onTestNotification,
  onToggleNotifications,
  inboxAction,
  onEditProfile,
  onSignOut,
}: {
  user: GoogleUser | null;
  demo: boolean;
  watchAvailable: boolean;
  watchEnabled: boolean;
  onToggleWatch: () => void;
  onTestNotification: () => void;
  onToggleNotifications: () => void;
  /** "Sync inbox now", "Connect Gmail" or "Rescan sample inbox"; null hides the item. */
  inboxAction: { label: string; onSelect: () => void; disabled?: boolean } | null;
  onEditProfile: () => void;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const notificationsOn = open && notificationPermission() === "granted";
  const firstName = user ? user.name.split(/\s+/)[0] || user.email : "Demo";
  const initial = (user?.name || user?.email || "D").charAt(0).toUpperCase();

  const item =
    "flex min-h-11 w-full items-center px-4 text-left text-sm font-medium text-stone-800 hover:bg-stone-100 dark:text-stone-100 dark:hover:bg-stone-800";

  return (
    <div className="relative min-w-0" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex min-h-11 max-w-full min-w-0 items-center gap-2 rounded-full py-1 pr-2.5 pl-1 transition-colors hover:bg-stone-200/60 active:bg-stone-200/80 dark:hover:bg-stone-800 dark:active:bg-stone-800"
      >
        {user?.picture ? (
          // Google profile photo; a plain img avoids configuring remote image domains.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.picture}
            alt=""
            referrerPolicy="no-referrer"
            className="h-8 w-8 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-700 text-sm font-semibold text-white dark:bg-teal-500 dark:text-teal-950"
          >
            {initial}
          </span>
        )}
        <span className="min-w-0 max-w-[5.5rem] truncate text-sm font-medium text-stone-800 sm:max-w-32 dark:text-stone-100">
          {firstName}
        </span>
        <span
          aria-hidden
          className={`text-stone-400 transition-transform duration-200 dark:text-stone-500 ${open ? "rotate-180" : ""}`}
        >
          <Chevron className="h-4 w-4" />
        </span>
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div
            role="menu"
            className="absolute right-0 z-20 mt-2 w-64 origin-top-right animate-fade-in overflow-hidden rounded-2xl border border-stone-200 bg-white py-1 shadow-lg dark:border-stone-700 dark:bg-stone-900"
          >
            {user && (
              <p className="truncate border-b border-stone-100 px-4 py-2 text-xs text-stone-500 dark:border-stone-800 dark:text-stone-400">
                {user.email}
              </p>
            )}
            {watchAvailable && (
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={watchEnabled}
                className={item}
                onClick={() => {
                  setOpen(false);
                  onToggleWatch();
                }}
              >
                <MenuLabel label="Live inbox watch" value={watchEnabled ? "On" : "Off"} on={watchEnabled} />
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              className={item}
              onClick={() => {
                setOpen(false);
                onToggleNotifications();
              }}
            >
              <MenuLabel label="Notifications" value={notificationsOn ? "On" : "Off"} on={notificationsOn} />
            </button>
            <button
              type="button"
              role="menuitem"
              className={item}
              onClick={() => {
                setOpen(false);
                onTestNotification();
              }}
            >
              Send test notification
            </button>
            {inboxAction && (
              <button
                type="button"
                role="menuitem"
                disabled={inboxAction.disabled}
                className={`${item} disabled:opacity-50`}
                onClick={() => {
                  setOpen(false);
                  // Called straight from the tap so the Google consent popup isn't blocked.
                  inboxAction.onSelect();
                }}
              >
                {inboxAction.label}
              </button>
            )}
            <div className="my-1 border-t border-stone-100 dark:border-stone-800" />
            <button
              type="button"
              role="menuitem"
              className={item}
              onClick={() => {
                setOpen(false);
                onEditProfile();
              }}
            >
              Edit profile
            </button>
            <button
              type="button"
              role="menuitem"
              className={item}
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
            >
              {demo ? "Exit demo" : "Sign out"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function Dashboard({
  googleClientId,
  vapidPublicKey = null,
  realtimeEnabled = false,
}: {
  googleClientId: string | null;
  /** Web Push public key; null hides real-time alerts. */
  vapidPublicKey?: string | null;
  /** Server flag (REALTIME_ENABLED) for Gmail push → phone notifications. */
  realtimeEnabled?: boolean;
}) {
  const hydrated = useHydrated();
  const rawUser = useSyncExternalStore(subscribeUser, getUserSnapshot, () => null);
  const user = useMemo(() => (rawUser ? loadUser() : null), [rawUser]);
  const [demo, setDemo] = useState(false);
  const account = user ? user.email : demo ? DEMO_ACCOUNT : null;
  const isDemo = !user && demo;

  // Profiles saved this session, by account; otherwise read from the browser.
  const [saved, setSaved] = useState<Record<string, Profile>>({});
  const profile = account
    ? (saved[account] ?? (hydrated ? loadProfile(account) : null))
    : null;

  const [editing, setEditing] = useState<{ startAt?: StepId } | null>(null);
  // Gmail access token lives here so onboarding and the inbox panel share it. Memory only.
  const [token, setToken] = useState<string | null>(null);
  const [gmailKey, setGmailKey] = useState(0);
  const [autoScan, setAutoScan] = useState<ScanMode | null>(null);
  const [watchEnabled, setWatchEnabled] = useState(true);

  // Header-menu "Connect Gmail": the hook lives here so request() runs straight from the tap.
  const gmail = useGmailToken(user && !isDemo ? googleClientId : null, user?.email);
  const emitGmailToken = useEffectEvent((t: string) => handleToken(t));
  useEffect(() => {
    if (gmail.token) emitGmailToken(gmail.token);
  }, [gmail.token]);
  const emitGmailError = useEffectEvent((message: string) => showToast(message, "warning"));
  useEffect(() => {
    if (gmail.error) emitGmailError(gmail.error);
  }, [gmail.error]);
  const [toast, setToast] = useState<{ id: number; message: string; tone: ToastTone } | null>(null);
  const closeToast = useCallback(() => setToast(null), []);

  // One toast for the whole page: a newer message replaces the one on screen.
  function showToast(message: string, tone: ToastTone = "neutral") {
    setToast({ id: Date.now(), message, tone });
  }

  async function handleTestNotification() {
    const ok = await sendTestNotification().catch(() => false);
    showToast(
      ok
        ? "Test notification sent."
        : needsHomeScreenInstall()
          ? "On iPhone, add Good Foreigner to your Home Screen first, then allow notifications."
          : "Notifications are off. Turn them on to get warned on your phone.",
    );
  }

  async function handleToggleNotifications() {
    const current = notificationPermission();
    if (current === "granted") {
      showToast("Notifications are on. To turn them off, use your browser's site settings.");
      return;
    }
    if (needsHomeScreenInstall()) {
      showToast("On iPhone: Share → Add to Home Screen, then open Good Foreigner from the icon.");
      return;
    }
    if (current === "unsupported") {
      showToast("This browser doesn't support notifications.");
      return;
    }
    if (current === "denied") {
      showToast("Notifications are blocked. Allow them in your browser's site settings.");
      return;
    }
    const result = await requestNotifications();
    showToast(result === "granted" ? "Notifications are on." : "Notifications stay off.");
  }

  // One local calendar date shared by the countdown and the AI requests, so they agree.
  const today = hydrated ? todayLocalISO() : "";

  function handleSignIn(u: GoogleUser) {
    saveUser(u); // Idempotent; the button already stores the user.
    setDemo(false);
  }

  function startDemo() {
    if (!loadProfile(DEMO_ACCOUNT)) saveProfile(DEMO_ACCOUNT, demoProfile());
    setDemo(true);
    setAutoScan("demo");
  }

  function handleSignOut() {
    if (user) signOut();
    setDemo(false);
    setToken(null);
    setGmailKey((k) => k + 1);
    setAutoScan(null);
    setEditing(null);
    setWatchEnabled(true);
  }

  function handleToken(t: string) {
    setToken(t);
    // Scan as soon as the inbox panel is on screen (now, or after onboarding).
    setAutoScan("gmail");
  }

  function handleTokenInvalid() {
    setToken(null);
    setGmailKey((k) => k + 1);
  }

  function handleComplete(p: Profile) {
    if (!account) return;
    saveProfile(account, p);
    setSaved((s) => ({ ...s, [account]: p }));
    setEditing(null);
    window.scrollTo({ top: 0 });
  }

  function openWizard(startAt?: StepId) {
    setEditing({ startAt });
    window.scrollTo({ top: 0 });
  }

  const inboxAction = isDemo
    ? { label: "Rescan sample inbox", onSelect: () => setAutoScan("demo") }
    : token
      ? { label: "Sync inbox now", onSelect: () => setAutoScan("gmail") }
      : user && googleClientId
        ? { label: "Connect Gmail", onSelect: gmail.request, disabled: !gmail.ready }
        : null;

  // The wizard fills exactly one screen with a sticky action bar; a footer below it would make it scroll.
  const inWizard = hydrated && Boolean(account) && (!profile || Boolean(editing));

  let body: ReactNode;
  if (!hydrated) {
    // Mirrors the dashboard layout (header, then stay and inbox cards) so nothing jumps on load.
    const bone = "animate-pulse bg-stone-200/60 dark:bg-stone-800/60";
    body = (
      <div aria-busy="true" aria-label="Loading" className="mx-auto w-full max-w-2xl px-4 sm:px-6">
        <div className="flex items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-2.5">
            <div className={`h-7 w-7 rounded-lg ${bone}`} />
            <div className={`h-5 w-32 rounded-md ${bone}`} />
          </div>
          <div className={`h-11 w-28 rounded-full ${bone}`} />
        </div>
        <div className="space-y-8 pt-2">
          <div className={`h-56 rounded-2xl ${bone}`} />
          <div className={`h-48 rounded-2xl ${bone}`} />
        </div>
      </div>
    );
  } else if (!account) {
    body = <Welcome googleClientId={googleClientId} onSignIn={handleSignIn} onDemo={startDemo} />;
  } else if (!profile || editing) {
    body = (
      <Onboarding
        key={`${account}:${editing?.startAt ?? "all"}`}
        initial={profile}
        today={today}
        googleClientId={googleClientId}
        demo={isDemo}
        loginHint={user?.email}
        token={token}
        gmailKey={gmailKey}
        onToken={handleToken}
        startAt={editing?.startAt}
        onCancel={profile ? () => setEditing(null) : undefined}
        onComplete={handleComplete}
      />
    );
  } else {
    body = (
      <div className="mx-auto w-full max-w-2xl px-4 sm:px-6">
        <header className="flex items-center justify-between gap-3 py-4">
          <div className="flex shrink-0 items-center gap-2.5">
            <Logo />
            <span className="whitespace-nowrap text-base font-semibold text-stone-900 dark:text-stone-50">
              Good Foreigner
            </span>
          </div>
          <AccountMenu
            user={user}
            demo={isDemo}
            watchAvailable={Boolean(token) && !isDemo}
            watchEnabled={watchEnabled}
            onToggleWatch={() => {
              setWatchEnabled((w) => !w);
              showToast(watchEnabled ? "Live inbox watch is off." : "Live inbox watch is on.");
            }}
            onTestNotification={handleTestNotification}
            onToggleNotifications={handleToggleNotifications}
            inboxAction={inboxAction}
            onEditProfile={() => openWizard()}
            onSignOut={handleSignOut}
          />
        </header>

        {isDemo && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-teal-50 py-1 pr-1 pl-4 text-sm text-teal-900 ring-1 ring-inset ring-teal-200 dark:bg-teal-950/50 dark:text-teal-100 dark:ring-teal-900">
            <p className="py-2">Demo with a sample inbox.</p>
            <button
              type="button"
              onClick={handleSignOut}
              className="min-h-11 shrink-0 rounded-full px-4 font-semibold underline underline-offset-2 transition-colors hover:bg-teal-100 active:bg-teal-100 dark:hover:bg-teal-900/60 dark:active:bg-teal-900/60"
            >
              Sign in for Gmail
            </button>
          </div>
        )}

        <main className="space-y-8 pt-2">
          <StayCard profile={profile} today={today} onAddI94={() => openWizard("i94")} />
          <ScanPanel
            profile={profile}
            today={today}
            googleClientId={googleClientId}
            demo={isDemo}
            token={token}
            onTokenInvalid={handleTokenInvalid}
            onConnectGmail={gmail.request}
            autoScan={autoScan}
            onAutoScanHandled={() => setAutoScan(null)}
            watchEnabled={watchEnabled}
            onToast={showToast}
          />
          {!isDemo && (
            <RealtimeAlertsCard
              clientId={googleClientId}
              vapidPublicKey={vapidPublicKey}
              enabledFlag={realtimeEnabled}
              loginHint={user?.email}
              profile={profile}
            />
          )}
          <ActionChecker profile={profile} today={today} />
        </main>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-1 flex-col">
      <div className="flex flex-1 flex-col">{body}</div>
      {/* Client-only: rendered under the short SSR skeleton it would jump down after hydration. */}
      {hydrated && !inWizard && (
        <div className="mx-auto w-full max-w-2xl px-4 sm:px-6">
          <Disclaimer />
        </div>
      )}
      {toast && <Toast key={toast.id} message={toast.message} tone={toast.tone} onClose={closeToast} />}
    </div>
  );
}
