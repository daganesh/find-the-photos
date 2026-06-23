import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./env.js', () => ({
  env: { googleMapsApiKey: 'test-key-123' },
  hasMaps: vi.fn(() => true),
}));

describe('loadGoogleMaps', () => {
  let appendChildSpy: ReturnType<typeof vi.spyOn>;
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
    delete (window as Record<string, unknown>)['__googleMapsInit__'];
    delete (window as Record<string, unknown>)['google'];
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
    expect(src).toContain('libraries=marker');
    expect(createdScript!.async).toBe(true);

    // Resolve the pending promise via the registered callback
    Object.assign(window, { google: { maps: fakeMaps } });
    const cb = (window as Record<string, unknown>)['__googleMapsInit__'] as (() => void);
    cb();

    await expect(promise).resolves.toBe(fakeMaps);
  });

  it('resolves with google.maps when the callback fires', async () => {
    const fakeMaps = { Map: class {}, Marker: class {} } as unknown as typeof google.maps;
    const { loadGoogleMaps } = await import('./maps.js');
    const promise = loadGoogleMaps();

    Object.assign(window, { google: { maps: fakeMaps } });
    const cb = (window as Record<string, unknown>)['__googleMapsInit__'] as (() => void);
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
    const cb = (window as Record<string, unknown>)['__googleMapsInit__'] as (() => void);
    cb();
    await p1;
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
