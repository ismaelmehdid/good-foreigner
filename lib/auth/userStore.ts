import type { GoogleUser } from "@/lib/auth/decodeIdToken";

const KEY = "gf.user";
const CHANGE_EVENT = "gf-user-change";

// Fallback when localStorage is blocked (private mode): user lives in memory for this tab only.
let memory: string | null = null;

function notify(): void {
  try {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Not in a browser.
  }
}

/** Raw stored JSON string (stable across calls), for useSyncExternalStore. */
export function getUserSnapshot(): string | null {
  try {
    return window.localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
}

export function subscribeUser(cb: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, cb);
  window.addEventListener("storage", cb); // other tabs
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function loadUser(): GoogleUser | null {
  const raw = getUserSnapshot();
  if (!raw) return null;
  try {
    const u = JSON.parse(raw) as GoogleUser;
    return u && typeof u.email === "string" && u.email ? u : null;
  } catch {
    return null;
  }
}

export function saveUser(u: GoogleUser): void {
  const raw = JSON.stringify(u);
  memory = raw;
  try {
    window.localStorage.setItem(KEY, raw);
  } catch {
    // Storage blocked: keep the in-memory copy.
  }
  notify();
}

export function clearUser(): void {
  memory = null;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Ignore.
  }
  notify();
}
