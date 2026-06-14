import type { GeoPoint, ProximityBucket } from '../models/geo.js';

const EARTH_RADIUS_M = 6_371_000;

const toRadians = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Great-circle distance between two points, in metres (haversine).
 * Good enough for neighbourhood-scale games.
 */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Distance thresholds (metres) for the friendly proximity buckets. */
export const PROXIMITY_THRESHOLDS = {
  /** At or under this, the hunter is basically on top of it. */
  nearM: 25,
  /** Under this, they're in the right area. Beyond it, they're far. */
  midM: 120,
} as const;

/**
 * Bucket the hunter's distance to the target. When either point lacks a
 * location (GPS off/unavailable), proximity is 'unknown' and the game falls
 * back to non-map help.
 */
export function proximityTo(
  hunter: GeoPoint | undefined,
  target: GeoPoint | undefined,
): ProximityBucket {
  if (!hunter || !target) return 'unknown';
  const d = distanceMeters(hunter, target);
  if (d <= PROXIMITY_THRESHOLDS.nearM) return 'near';
  if (d <= PROXIMITY_THRESHOLDS.midM) return 'mid';
  return 'far';
}
