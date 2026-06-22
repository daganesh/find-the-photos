import { distanceMeters } from '@ftp/shared';
import type { GeoPoint, RouteSummary } from '@ftp/shared';

export type DateFilter = '24h' | '7d' | '30d';

export interface HuntFilterOptions {
  name: string;
  creator: string;
  distanceKm: number | null;
  dateFilter: DateFilter | null;
  myLocation: GeoPoint | undefined;
}

const DATE_FILTER_MS: Record<DateFilter, number> = {
  '24h': 86_400_000,
  '7d': 7 * 86_400_000,
  '30d': 30 * 86_400_000,
};

export function filterHunts(routes: RouteSummary[], opts: HuntFilterOptions): RouteSummary[] {
  const nameLower = opts.name.trim().toLowerCase();
  const creatorLower = opts.creator.trim().toLowerCase();
  const now = Date.now();

  return routes.filter((r) => {
    if (nameLower && !r.title.toLowerCase().includes(nameLower)) return false;

    if (creatorLower && !(r.authorName ?? '').toLowerCase().includes(creatorLower)) return false;

    if (opts.distanceKm !== null) {
      if (!opts.myLocation || !r.startLocation) return false;
      const dist = distanceMeters(opts.myLocation, r.startLocation);
      if (dist > opts.distanceKm * 1000) return false;
    }

    if (opts.dateFilter) {
      const created = new Date(r.createdAt).getTime();
      if (created < now - DATE_FILTER_MS[opts.dateFilter]) return false;
    }

    return true;
  });
}

export function hasActiveFilters(opts: Pick<HuntFilterOptions, 'name' | 'creator' | 'distanceKm' | 'dateFilter'>): boolean {
  return Boolean(opts.name.trim() || opts.creator.trim() || opts.distanceKm !== null || opts.dateFilter);
}
