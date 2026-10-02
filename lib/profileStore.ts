import type { Profile } from "@/lib/types";

const KEY = "gf.profile";

export function loadProfile(): Profile | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

export function saveProfile(profile: Profile): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // Storage blocked (private mode): profile lives in memory for this session only.
  }
}

export function clearProfile(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Ignore.
  }
}
