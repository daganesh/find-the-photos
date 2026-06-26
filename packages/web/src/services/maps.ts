import { env, hasMaps } from './env.js';

let loaderPromise: Promise<typeof google.maps> | null = null;
let authFailed = false;
const authFailureHandlers: Set<() => void> = new Set();

function handleAuthFailure() {
  authFailed = true;
  loaderPromise = null;
  authFailureHandlers.forEach((h) => h());
}

/**
 * Subscribe to Google Maps authentication failures (invalid key, billing not enabled).
 * Returns an unsubscribe function. The handler will be called when gm_authFailure fires.
 */
export function subscribeAuthFailure(handler: () => void): () => void {
  authFailureHandlers.add(handler);
  return () => authFailureHandlers.delete(handler);
}

/**
 * Lazily load the Google Maps JS API once. Resolves to the maps namespace, or
 * rejects when no key is configured so callers can show a graceful fallback.
 */
export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (!hasMaps()) return Promise.reject(new Error('Maps not configured'));
  if (authFailed) return Promise.reject(new Error('Maps auth failed'));
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise((resolve, reject) => {
    const existing = window.google?.maps;
    if (existing) return resolve(existing);

    // Google Maps JS API requires either `callback` or `loading=async` when
    // the script is loaded asynchronously, otherwise it shows the "Oops!
    // Something went wrong" error overlay.
    const callbackName = '__googleMapsInit__';
    (window as unknown as Record<string, unknown>)[callbackName] = () => {
      delete (window as unknown as Record<string, unknown>)[callbackName];
      window.google?.maps ? resolve(window.google.maps) : reject(new Error('Maps failed to load'));
    };

    // gm_authFailure is called by Google Maps when the API key is invalid or
    // billing is not enabled. Chain onto any existing handler so we don't stomp
    // third-party code.
    const prev = (window as unknown as Record<string, unknown>)['gm_authFailure'];
    (window as unknown as Record<string, unknown>)['gm_authFailure'] = () => {
      (prev as (() => void) | undefined)?.();
      handleAuthFailure();
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${env.googleMapsApiKey}&libraries=marker&callback=${callbackName}&loading=async`;
    script.async = true;
    script.onerror = () => {
      delete (window as unknown as Record<string, unknown>)[callbackName];
      loaderPromise = null;
      reject(new Error('Maps failed to load'));
    };
    document.head.appendChild(script);
  });
  return loaderPromise;
}

/** True when Maps is known to be unavailable — no key configured or auth already failed. */
export function isMapsFailed(): boolean {
  return !hasMaps() || authFailed;
}

/** A plain Google Maps deep link, used when the JS API isn't available. */
export function googleMapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
