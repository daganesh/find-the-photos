import type { Route, Rating } from '../models/route.js';

/** True when a route is complete enough to be finalised / played. */
export function isRoutePlayable(route: Pick<Route, 'items' | 'title'>): boolean {
  return route.title.trim().length > 0 && route.items.length > 0;
}

/** Average star rating, or undefined when there are no ratings. */
export function averageRating(ratings: Rating[]): number | undefined {
  if (ratings.length === 0) return undefined;
  const sum = ratings.reduce((acc, r) => acc + r.stars, 0);
  return Math.round((sum / ratings.length) * 10) / 10;
}
