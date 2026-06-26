import { useEffect, useRef, useState } from 'react';
import type { GeoPoint } from '@ftp/shared';
import { googleMapsLink, isMapsFailed, loadGoogleMaps, subscribeAuthFailure } from '../services/maps.js';

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
 *
 * The map div is kept invisible (visibility:hidden) until the first `idle`
 * event fires, which means tiles have loaded and the key is valid. If
 * gm_authFailure fires first the fallback renders instead — this prevents
 * Google's own "Oops!" error overlay from flashing before we can swap it out.
 */
export function MapView({ target, hunter, showRoute }: MapViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  // 'loading' → map div hidden while Google initialises
  // 'ready'   → map visible (idle event fired, key is valid)
  // 'failed'  → show our fallback
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>(() =>
    isMapsFailed() ? 'failed' : 'loading',
  );

  useEffect(() => {
    // Already in a terminal state — nothing to set up.
    if (state === 'failed') return;

    let cancelled = false;

    const unsubscribeAuth = subscribeAuthFailure(() => {
      if (!cancelled) setState('failed');
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
        // Only reveal the map once tiles have loaded. gm_authFailure fires
        // before idle when the key is bad, so the subscribeAuthFailure handler
        // above will set state to 'failed' first and idle never shows.
        maps.event.addListenerOnce(map, 'idle', () => {
          if (!cancelled) setState('ready');
        });
      })
      .catch(() => !cancelled && setState('failed'));

    return () => {
      cancelled = true;
      unsubscribeAuth();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, hunter, showRoute]);

  if (state === 'failed') {
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

  return (
    <div
      className="map"
      ref={ref}
      style={state === 'loading' ? { visibility: 'hidden' } : undefined}
    />
  );
}
