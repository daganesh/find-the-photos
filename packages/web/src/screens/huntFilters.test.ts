import { describe, it, expect } from 'vitest';
import { filterHunts, hasActiveFilters } from './huntFilters.js';
import type { RouteSummary } from '@ftp/shared';

function makeRoute(overrides: Partial<RouteSummary> = {}): RouteSummary {
  return {
    id: 'r1',
    title: 'Park Adventure',
    authorId: 'u1',
    authorName: 'Alice',
    itemCount: 3,
    status: 'ready',
    createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
    ...overrides,
  };
}

const blank = { name: '', creator: '', distanceKm: null, dateFilter: null, myLocation: undefined } as const;

describe('filterHunts', () => {
  it('returns all routes when no filters are active', () => {
    const routes = [makeRoute(), makeRoute({ id: 'r2', title: 'Beach Hunt' })];
    expect(filterHunts(routes, blank)).toHaveLength(2);
  });

  it('filters by partial name (case-insensitive)', () => {
    const routes = [makeRoute({ title: 'Park Adventure' }), makeRoute({ id: 'r2', title: 'Beach Hunt' })];
    expect(filterHunts(routes, { ...blank, name: 'park' })).toHaveLength(1);
    expect(filterHunts(routes, { ...blank, name: 'BEACH' })).toHaveLength(1);
    expect(filterHunts(routes, { ...blank, name: 'xyz' })).toHaveLength(0);
  });

  it('filters by partial creator name (case-insensitive)', () => {
    const routes = [makeRoute({ authorName: 'Alice Smith' }), makeRoute({ id: 'r2', authorName: 'Bob Jones' })];
    expect(filterHunts(routes, { ...blank, creator: 'alice' })).toHaveLength(1);
    expect(filterHunts(routes, { ...blank, creator: 'BOB' })).toHaveLength(1);
    expect(filterHunts(routes, { ...blank, creator: 'unknown' })).toHaveLength(0);
  });

  it('excludes routes without authorName when creator filter is set', () => {
    const routes = [makeRoute({ authorName: undefined }), makeRoute({ id: 'r2', authorName: 'Alice' })];
    expect(filterHunts(routes, { ...blank, creator: 'Alice' })).toHaveLength(1);
  });

  it('filters by date (last 24h)', () => {
    const recent = makeRoute({ createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString() });
    const old = makeRoute({ id: 'r2', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() });
    const result = filterHunts([recent, old], { ...blank, dateFilter: '24h' });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('r1');
  });

  it('filters by date (last week)', () => {
    const recent = makeRoute({ createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() });
    const old = makeRoute({ id: 'r2', createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() });
    expect(filterHunts([recent, old], { ...blank, dateFilter: '7d' })).toHaveLength(1);
  });

  it('filters by date (last month)', () => {
    const recent = makeRoute({ createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString() });
    const old = makeRoute({ id: 'r2', createdAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString() });
    expect(filterHunts([recent, old], { ...blank, dateFilter: '30d' })).toHaveLength(1);
  });

  it('excludes routes without startLocation when distance filter is set', () => {
    const withLoc = makeRoute({ startLocation: { lat: 51.5, lng: -0.1 } });
    const noLoc = makeRoute({ id: 'r2' });
    const myLocation = { lat: 51.5, lng: -0.1 };
    const result = filterHunts([withLoc, noLoc], { ...blank, distanceKm: 5, myLocation });
    expect(result).toHaveLength(1);
  });

  it('filters by distance (km)', () => {
    const nearby = makeRoute({ startLocation: { lat: 51.5, lng: -0.1 } });
    const faraway = makeRoute({ id: 'r2', startLocation: { lat: 52.5, lng: -0.1 } });
    const myLocation = { lat: 51.5, lng: -0.1 };
    expect(filterHunts([nearby, faraway], { ...blank, distanceKm: 1, myLocation })).toHaveLength(1);
    expect(filterHunts([nearby, faraway], { ...blank, distanceKm: 200, myLocation })).toHaveLength(2);
  });

  it('excludes all when distance filter is set but no location provided', () => {
    const routes = [makeRoute({ startLocation: { lat: 51.5, lng: -0.1 } })];
    expect(filterHunts(routes, { ...blank, distanceKm: 5, myLocation: undefined })).toHaveLength(0);
  });

  it('combines multiple filters', () => {
    const r1 = makeRoute({ title: 'Park Hunt', authorName: 'Alice' });
    const r2 = makeRoute({ id: 'r2', title: 'Beach Hunt', authorName: 'Alice' });
    const r3 = makeRoute({ id: 'r3', title: 'Park Hunt', authorName: 'Bob' });
    const result = filterHunts([r1, r2, r3], { ...blank, name: 'Park', creator: 'Alice' });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('r1');
  });
});

describe('hasActiveFilters', () => {
  it('returns false when all filters are empty', () => {
    expect(hasActiveFilters({ name: '', creator: '', distanceKm: null, dateFilter: null })).toBe(false);
  });

  it('returns true when any filter is set', () => {
    expect(hasActiveFilters({ name: 'park', creator: '', distanceKm: null, dateFilter: null })).toBe(true);
    expect(hasActiveFilters({ name: '', creator: 'alice', distanceKm: null, dateFilter: null })).toBe(true);
    expect(hasActiveFilters({ name: '', creator: '', distanceKm: 5, dateFilter: null })).toBe(true);
    expect(hasActiveFilters({ name: '', creator: '', distanceKm: null, dateFilter: '24h' })).toBe(true);
  });
});
