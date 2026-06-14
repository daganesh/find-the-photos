import { describe, it, expect } from 'vitest';
import { distanceMeters, proximityTo } from './geo.js';

describe('distanceMeters', () => {
  it('is zero for the same point', () => {
    const p = { lat: 32.08, lng: 34.78 };
    expect(distanceMeters(p, p)).toBe(0);
  });

  it('matches a known short distance (~111m per 0.001° lat)', () => {
    const a = { lat: 32.0, lng: 34.0 };
    const b = { lat: 32.001, lng: 34.0 };
    expect(distanceMeters(a, b)).toBeCloseTo(111, 0);
  });
});

describe('proximityTo', () => {
  const target = { lat: 32.0, lng: 34.0 };

  it('is unknown without GPS on either side', () => {
    expect(proximityTo(undefined, target)).toBe('unknown');
    expect(proximityTo(target, undefined)).toBe('unknown');
  });

  it('buckets near / mid / far by distance', () => {
    expect(proximityTo({ lat: 32.0, lng: 34.0 }, target)).toBe('near');
    expect(proximityTo({ lat: 32.0008, lng: 34.0 }, target)).toBe('mid'); // ~89m
    expect(proximityTo({ lat: 32.01, lng: 34.0 }, target)).toBe('far'); // ~1.1km
  });
});
