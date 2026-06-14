import type { GeoPoint } from '@ftp/shared';

/**
 * Read the device's current location. Returns undefined when GPS is
 * unavailable or the user has disabled/denied it — the game stays playable
 * without it (per the spec).
 */
export function getCurrentLocation(timeoutMs = 8000): Promise<GeoPoint | undefined> {
  if (!('geolocation' in navigator)) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
        }),
      () => resolve(undefined),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 10_000 },
    );
  });
}

/** True if the browser exposes geolocation at all (button enable/disable). */
export const geolocationAvailable = (): boolean => 'geolocation' in navigator;
