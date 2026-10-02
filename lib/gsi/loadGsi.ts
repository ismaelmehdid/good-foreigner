// Loads Google Identity Services (https://accounts.google.com/gsi/client) once per page.
// Shared by Sign in with Google (accounts.id) and the Gmail token client (accounts.oauth2).

const GSI_SRC = "https://accounts.google.com/gsi/client";
const GSI_SCRIPT_ID = "google-gsi-client";

// Minimal GIS types (no @types package). Only the members this app uses.
export interface GsiTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

export interface GsiTokenClient {
  requestAccessToken: (overrides?: { prompt?: string; login_hint?: string }) => void;
}

export interface GsiCredentialResponse {
  credential: string;
  select_by?: string;
}

export interface GoogleGsi {
  accounts: {
    oauth2: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (response: GsiTokenResponse) => void;
        error_callback?: (error: { type?: string; message?: string }) => void;
        login_hint?: string;
        prompt?: string;
      }) => GsiTokenClient;
    };
    id: {
      initialize: (config: {
        client_id: string;
        callback: (response: GsiCredentialResponse) => void;
        auto_select?: boolean;
        use_fedcm_for_button?: boolean;
      }) => void;
      renderButton: (
        parent: HTMLElement,
        options: {
          theme?: "outline" | "filled_blue" | "filled_black";
          size?: "large" | "medium" | "small";
          shape?: "rectangular" | "pill" | "circle" | "square";
          text?: "signin_with" | "signup_with" | "continue_with" | "signin";
          width?: number;
        },
      ) => void;
      disableAutoSelect: () => void;
    };
  };
}

/** window.google once GIS is loaded, else undefined. */
export function getGoogle(): GoogleGsi | undefined {
  if (typeof window === "undefined") return undefined;
  const g = (window as unknown as { google?: GoogleGsi }).google;
  return g?.accounts?.oauth2 && g.accounts.id ? g : undefined;
}

let pending: Promise<void> | null = null;

export function loadGsi(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Google sign-in needs a browser"));
  if (getGoogle()) return Promise.resolve();
  if (pending) return pending;

  pending = new Promise<void>((resolve, reject) => {
    let script = document.getElementById(GSI_SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = GSI_SCRIPT_ID;
      script.src = GSI_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", () => {
      if (getGoogle()) resolve();
      else reject(new Error("Google sign-in loaded but is unavailable"));
    });
    script.addEventListener("error", () => reject(new Error("Could not load Google sign-in")));
  }).catch((e: unknown) => {
    pending = null; // allow a retry on the next call
    document.getElementById(GSI_SCRIPT_ID)?.remove();
    throw e;
  });
  return pending;
}
