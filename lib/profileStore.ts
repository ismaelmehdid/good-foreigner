import type { Profile } from "@/lib/types";

/** Profiles are stored per account: `gf.profile:<email>`, or `gf.profile:demo` for the demo. */
function keyFor(account: string): string {
  return `gf.profile:${account}`;
}

// Fallback when localStorage is blocked (private mode): profiles live in memory for this tab.
const memory = new Map<string, string>();

export function loadProfile(account: string): Profile | null {
  try {
    const raw = window.localStorage.getItem(keyFor(account)) ?? memory.get(account) ?? null;
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    const raw = memory.get(account);
    try {
      return raw ? (JSON.parse(raw) as Profile) : null;
    } catch {
      return null;
    }
  }
}

export function saveProfile(account: string, profile: Profile): void {
  const raw = JSON.stringify(profile);
  memory.set(account, raw);
  try {
    window.localStorage.setItem(keyFor(account), raw);
  } catch {
    // Storage blocked: keep the in-memory copy.
  }
}

export function clearProfile(account: string): void {
  memory.delete(account);
  try {
    window.localStorage.removeItem(keyFor(account));
  } catch {
    // Ignore.
  }
}
