/** A point on the map. Accuracy (metres) comes from the device GPS when known. */
export interface GeoPoint {
  lat: number;
  lng: number;
  accuracyM?: number;
}

/**
 * How close the hunter is to the target, in friendly buckets.
 * Drives which kind of help the game offers next.
 */
export type ProximityBucket = 'near' | 'mid' | 'far' | 'unknown';
