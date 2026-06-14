import { env } from './env.js';

/**
 * Thin wrapper over Google Identity Services. We only need: load the script,
 * render the sign-in button, and receive the credential (an ID token) which we
 * hand to our server to verify. Minimal typings kept local to avoid a dep.
 */

interface CredentialResponse {
  credential: string;
}
interface GoogleAccountsId {
  initialize(config: { client_id: string; callback: (r: CredentialResponse) => void }): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
  prompt(): void;
}
declare global {
  interface Window {
    google?: { accounts?: { id: GoogleAccountsId } };
  }
}

let scriptPromise: Promise<GoogleAccountsId> | null = null;

function loadScript(): Promise<GoogleAccountsId> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve(window.google.accounts.id);
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () =>
      window.google?.accounts?.id
        ? resolve(window.google.accounts.id)
        : reject(new Error('Google sign-in failed to load'));
    script.onerror = () => reject(new Error('Google sign-in failed to load'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/** Render the official Google button; resolve credentials via `onCredential`. */
export async function renderGoogleButton(
  parent: HTMLElement,
  onCredential: (credential: string) => void,
): Promise<void> {
  const id = await loadScript();
  id.initialize({
    client_id: env.googleClientId,
    callback: (r) => onCredential(r.credential),
  });
  id.renderButton(parent, { theme: 'filled_blue', size: 'large', shape: 'pill', text: 'continue_with' });
}

/** Dev fallback credential: a base64 JSON the server's dev stub accepts. */
export function makeDevCredential(name: string, email: string): string {
  return btoa(JSON.stringify({ name, email }));
}
