import { useEffect, useRef, useState } from 'react';
import type { GeoPoint } from '@ftp/shared';
import { env } from '../services/env.js';
import { googleMapsLink, isMapsFailed, loadGoogleMaps, subscribeAuthFailure } from '../services/maps.js';

interface MapViewProps {
  /** The target (item) location — always shown when present. */
  target: GeoPoint;
  /** The hunter's current location — when present, draws a line to the target. */
  hunter?: GeoPoint;
  /** Draw the connecting route line (help level 2). */
  showRoute?: boolean;
}

export function MapView({ target, hunter, showRoute }: MapViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>(() =>
    isMapsFailed() ? 'failed' : 'loading',
  );
  const [log, setLog] = useState<string[]>(() => [
    `init: hasMaps=${!isMapsFailed()} key="${env.googleMapsApiKey ? env.googleMapsApiKey.slice(0, 8) + '…' : '(none)'}"`,
    `initState: ${isMapsFailed() ? 'failed' : 'loading'}`,
  ]);

  function addLog(msg: string) {
    setLog((prev) => [...prev, `${new Date().toISOString().slice(11, 23)} ${msg}`]);
  }

  useEffect(() => {
    if (state === 'failed') return;

    let cancelled = false;

    const unsubscribeAuth = subscribeAuthFailure(() => {
      addLog('gm_authFailure fired');
      if (!cancelled) setState('failed');
    });

    addLog('loadGoogleMaps() called');

    loadGoogleMaps()
      .then((maps) => {
        addLog('maps API resolved');
        if (cancelled || !ref.current) { addLog(`skipped (cancelled=${cancelled} ref=${!!ref.current})`); return; }
        addLog('creating maps.Map');
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
            new maps.Polyline({ path: [hunter, target], map, strokeColor: '#ff7a59', strokeWeight: 4 });
            const bounds = new maps.LatLngBounds();
            bounds.extend(hunter);
            bounds.extend(target);
            map.fitBounds(bounds, 60);
          }
        }
        maps.event.addListenerOnce(map, 'idle', () => {
          addLog('idle fired → ready');
          if (!cancelled) setState('ready');
        });
      })
      .catch((err: unknown) => {
        addLog(`loadGoogleMaps rejected: ${err instanceof Error ? err.message : String(err)}`);
        if (!cancelled) setState('failed');
      });

    return () => {
      addLog('effect cleanup (cancelled)');
      cancelled = true;
      unsubscribeAuth();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, hunter, showRoute]);

  const debugPanel = (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0,
      background: 'rgba(0,0,0,0.82)', color: '#0f0', fontFamily: 'monospace',
      fontSize: 11, padding: 8, zIndex: 9999, maxHeight: 200, overflowY: 'auto',
      borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
    }}>
      <b style={{ color: '#ff0' }}>MAP DEBUG — state: {state}</b>
      {log.map((l, i) => <div key={i}>{l}</div>)}
    </div>
  );

  if (state === 'failed') {
    return (
      <div className="map" style={{ position: 'relative' }}>
        {debugPanel}
        <div className="map__fallback" style={{ paddingTop: 80 }}>
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
    <div className="map" style={{ position: 'relative' }}>
      {debugPanel}
      <div
        ref={ref}
        style={{ width: '100%', height: '100%', visibility: state === 'loading' ? 'hidden' : undefined }}
      />
    </div>
  );
}
