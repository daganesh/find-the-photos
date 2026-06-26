import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./env.js', () => ({
  env: { googleMapsApiKey: 'test-key-123' },
  hasMaps: vi.fn(() => true),
}));

describe('loadGoogleMaps', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let appendChildSpy: ReturnType<typeof vi.spyOn<any, any>>;
  let createdScript: HTMLScriptElement | null = null;

  beforeEach(() => {
    vi.resetModules();
    appendChildSpy = vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      createdScript = node as HTMLScriptElement;
      return node;
    });
  });

  afterEach(() => {
    appendChildSpy.mockRestore();
    createdScript = null;
    delete (window as unknown as Record<string, unknown>)['__googleMapsInit__'];
    delete (window as unknown as Record<string, unknown>)['google'];
    delete (window as unknown as Record<string, unknown>)['gm_authFailure'];
  });

  it('rejects immediately when no Maps key is configured', async () => {
    const { hasMaps } = await import('./env.js');
    vi.mocked(hasMaps).mockReturnValueOnce(false);
    const { loadGoogleMaps } = await import('./maps.js');
    await expect(loadGoogleMaps()).rejects.toThrow('Maps not configured');
  });

  it('appends a script tag with callback and loading=async parameters', async () => {
    const fakeMaps = {} as typeof google.maps;
    const { loadGoogleMaps } = await import('./maps.js');
    const promise = loadGoogleMaps();

    expect(createdScript).not.toBeNull();
    const src = createdScript!.src;
    expect(src).toContain('key=test-key-123');
    expect(src).toContain('callback=__googleMapsInit__');
    expect(src).toContain('loading=async');
    expect(src).not.toContain('libraries=');
    expect(createdScript!.async).toBe(true);

    // Resolve the pending promise via the registered callback
    Object.assign(window, { google: { maps: fakeMaps } });
    const cb = (window as unknown as Record<string, unknown>)['__googleMapsInit__'] as (() => void);
    cb();

    await expect(promise).resolves.toBe(fakeMaps);
  });

  it('resolves with google.maps when the callback fires', async () => {
    const fakeMaps = { Map: class {}, Marker: class {} } as unknown as typeof google.maps;
    const { loadGoogleMaps } = await import('./maps.js');
    const promise = loadGoogleMaps();

    Object.assign(window, { google: { maps: fakeMaps } });
    const cb = (window as unknown as Record<string, unknown>)['__googleMapsInit__'] as (() => void);
    cb();

    await expect(promise).resolves.toBe(fakeMaps);
  });

  it('rejects when the script fires onerror', async () => {
    const { loadGoogleMaps } = await import('./maps.js');
    const promise = loadGoogleMaps();

    createdScript!.dispatchEvent(new Event('error'));

    await expect(promise).rejects.toThrow('Maps failed to load');
  });

  it('returns the same promise on repeated calls (singleton)', async () => {
    const fakeMaps = {} as typeof google.maps;
    const { loadGoogleMaps } = await import('./maps.js');
    const p1 = loadGoogleMaps();
    const p2 = loadGoogleMaps();
    expect(p1).toBe(p2);

    Object.assign(window, { google: { maps: fakeMaps } });
    const cb = (window as unknown as Record<string, unknown>)['__googleMapsInit__'] as (() => void);
    cb();
    await p1;
  });

  it('registers window.gm_authFailure when loading the script', async () => {
    const { loadGoogleMaps } = await import('./maps.js');
    loadGoogleMaps();
    expect(typeof (window as unknown as Record<string, unknown>)['gm_authFailure']).toBe('function');
  });

  it('notifies subscribeAuthFailure handlers when gm_authFailure fires', async () => {
    const { loadGoogleMaps, subscribeAuthFailure } = await import('./maps.js');
    loadGoogleMaps();

    const handler = vi.fn();
    subscribeAuthFailure(handler);

    const authFailure = (window as unknown as Record<string, unknown>)['gm_authFailure'] as () => void;
    authFailure();

    expect(handler).toHaveBeenCalledOnce();
  });

  it('unsubscribed handlers are not called when gm_authFailure fires', async () => {
    const { loadGoogleMaps, subscribeAuthFailure } = await import('./maps.js');
    loadGoogleMaps();

    const handler = vi.fn();
    const unsubscribe = subscribeAuthFailure(handler);
    unsubscribe();

    const authFailure = (window as unknown as Record<string, unknown>)['gm_authFailure'] as () => void;
    authFailure();

    expect(handler).not.toHaveBeenCalled();
  });

  it('rejects on subsequent calls after gm_authFailure has fired', async () => {
    const { loadGoogleMaps } = await import('./maps.js');
    loadGoogleMaps();

    const authFailure = (window as unknown as Record<string, unknown>)['gm_authFailure'] as () => void;
    authFailure();

    await expect(loadGoogleMaps()).rejects.toThrow('Maps auth failed');
  });

  it('chains onto an existing gm_authFailure handler', async () => {
    const existing = vi.fn();
    (window as unknown as Record<string, unknown>)['gm_authFailure'] = existing;

    const { loadGoogleMaps } = await import('./maps.js');
    loadGoogleMaps();

    const authFailure = (window as unknown as Record<string, unknown>)['gm_authFailure'] as () => void;
    authFailure();

    expect(existing).toHaveBeenCalledOnce();
  });

  it('allows a new load attempt after onerror (loaderPromise is reset)', async () => {
    const { loadGoogleMaps } = await import('./maps.js');
    const p1 = loadGoogleMaps();
    createdScript!.dispatchEvent(new Event('error'));
    await expect(p1).rejects.toThrow('Maps failed to load');

    // Second call should create a fresh script (not return the rejected promise)
    const p2 = loadGoogleMaps();
    expect(p2).not.toBe(p1);
  });
});

describe('googleMapsLink', () => {
  it('returns a Google Maps search URL for the given coordinates', async () => {
    vi.resetModules();
    const { googleMapsLink } = await import('./maps.js');
    expect(googleMapsLink(51.5, -0.1)).toBe(
      'https://www.google.com/maps/search/?api=1&query=51.5,-0.1',
    );
  });
});
