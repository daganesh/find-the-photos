import { useEffect, useRef, useState } from 'react';
import type { GeoPoint } from '@ftp/shared';
import { googleMapsLink, loadGoogleMaps, subscribeAuthFailure } from '../services/maps.js';

interface MapViewProps {
  /** The target (item) location — always shown when present. */
  target: GeoPoint;
  /** The hunter's current location — when present, draws a line to the target. */
  hunter?: GeoPoint;
  /** Draw the connecting route line (help level 2). */
  showRoute?: boolean;
}

/**
 * Shows the target on a Google Map, optionally with a line from the hunter.
 * Degrades to a "Open in Google Maps" link when no Maps key is configured.
 */
export function MapView({ target, hunter, showRoute }: MapViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const unsubscribeAuth = subscribeAuthFailure(() => {
      if (!cancelled) setFailed(true);
    });
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !ref.current) return;
        const map = new maps.Map(ref.current, {
          center: target,
          zoom: 17,
          disableDefaultUI: true,
          zoomControl: true,
        });
        new maps.Marker({ position: target, map, title: 'Treasure!', label: '🎯' });
        if (hunter) {
          new maps.Marker({ position: hunter, map, title: 'You', label: '🧍' });
          if (showRoute) {
            new maps.Polyline({
              path: [hunter, target],
              map,
              strokeColor: '#ff7a59',
              strokeWeight: 4,
            });
            const bounds = new maps.LatLngBounds();
            bounds.extend(hunter);
            bounds.extend(target);
            map.fitBounds(bounds, 60);
          }
        }
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      unsubscribeAuth();
    };
  }, [target, hunter, showRoute]);

  if (failed) {
    return (
      <div className="map">
        <div className="map__fallback">
          <span style={{ fontSize: '2rem' }}>🗺️</span>
          <p className="muted">Map preview isn't available here.</p>
          <a className="btn btn--accent" href={googleMapsLink(target.lat, target.lng)} target="_blank" rel="noreferrer">
            Open in Google Maps
          </a>
        </div>
      </div>
    );
  }

  return <div className="map" ref={ref} />;
}
