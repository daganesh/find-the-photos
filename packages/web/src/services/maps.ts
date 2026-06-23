import { env, hasMaps } from './env.js';

let loaderPromise: Promise<typeof google.maps> | null = null;

/**
 * Lazily load the Google Maps JS API once. Resolves to the maps namespace, or
 * rejects when no key is configured so callers can show a graceful fallback.
 */
export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (!hasMaps()) return Promise.reject(new Error('Maps not configured'));
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise((resolve, reject) => {
    const existing = window.google?.maps;
    if (existing) return resolve(existing);

    // Google Maps JS API requires either `callback` or `loading=async` when
    // the script is loaded asynchronously, otherwise it shows the "Oops!
    // Something went wrong" error overlay.
    const callbackName = '__googleMapsInit__';
    (window as Record<string, unknown>)[callbackName] = () => {
      delete (window as Record<string, unknown>)[callbackName];
      window.google?.maps ? resolve(window.google.maps) : reject(new Error('Maps failed to load'));
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${env.googleMapsApiKey}&libraries=marker&callback=${callbackName}&loading=async`;
    script.async = true;
    script.onerror = () => {
      delete (window as Record<string, unknown>)[callbackName];
      reject(new Error('Maps failed to load'));
    };
    document.head.appendChild(script);
  });
  return loaderPromise;
}

/** A plain Google Maps deep link, used when the JS API isn't available. */
export function googleMapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
