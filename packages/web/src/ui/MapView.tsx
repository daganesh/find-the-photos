import { useEffect, useRef, useState } from 'react';
import type { GeoPoint } from '@ftp/shared';
import { env } from '../services/env.js';
import { googleMapsLink, isMapsFailed, loadGoogleMaps, subscribeAuthFailure } from '../services/maps.js';

interface MapViewProps {
  target: GeoPoint;
  hunter?: GeoPoint;
  showRoute?: boolean;
}

export function MapView({ target, hunter, showRoute }: MapViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>(() =>
    isMapsFailed() ? 'failed' : 'loading',
  );
  const [log, setLog] = useState<string[]>(() => {
    const keyHint = env.googleMapsApiKey ? env.googleMapsApiKey.slice(0, 8) + '…' : '(none)';
    return [
      `key: ${keyHint}`,
      `initState: ${isMapsFailed() ? 'failed' : 'loading'}`,
    ];
  });

  function addLog(msg: string) {
    const ts = new Date().toISOString().slice(11, 23);
    setLog((prev) => [...prev, `${ts} ${msg}`]);
  }

  useEffect(() => {
    if (state === 'failed') return;

    let cancelled = false;

    const unsubscribeAuth = subscribeAuthFailure(() => {
      addLog('⚡ gm_authFailure fired');
      if (!cancelled) setState('failed');
    });

    addLog('loadGoogleMaps()…');

    loadGoogleMaps()
      .then((maps) => {
        addLog('maps resolved ✓');
        if (cancelled || !ref.current) {
          addLog(`skip (cancelled=${cancelled} ref=${!!ref.current})`);
          return;
        }
        addLog('new maps.Map()…');
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
          addLog('idle ✓ → ready');
          if (!cancelled) setState('ready');
        });
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        addLog(`rejected: ${msg}`);
        if (!cancelled) setState('failed');
      });

    return () => {
      addLog('cleanup / cancelled');
      cancelled = true;
      unsubscribeAuth();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, hunter, showRoute]);

  const debugOverlay = (
    <div style={{
      position: 'absolute', inset: '0 0 auto 0', zIndex: 9999,
      background: 'rgba(0,0,0,0.85)', color: '#0f0',
      fontFamily: 'monospace', fontSize: 11, padding: 8,
      maxHeight: 180, overflowY: 'auto', borderRadius: 'inherit',
    }}>
      <div style={{ color: '#ff0', marginBottom: 2 }}>🗺 MAP DEBUG — state: <b>{state}</b></div>
      {log.map((l, i) => <div key={i}>{l}</div>)}
    </div>
  );

  if (state === 'failed') {
    return (
      <div className="map" style={{ position: 'relative' }}>
        {debugOverlay}
        <div className="map__fallback" style={{ paddingTop: 90 }}>
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
      {debugOverlay}
      <div
        ref={ref}
        style={{ width: '100%', height: '100%', visibility: state === 'loading' ? 'hidden' : undefined }}
      />
    </div>
  );
}
