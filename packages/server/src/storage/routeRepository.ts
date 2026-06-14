import path from 'node:path';
import type { Route } from '@ftp/shared';
import { averageRating } from '@ftp/shared';
import { JsonStore } from './jsonStore.js';
import { config } from '../config.js';

/**
 * Persistence seam for routes. Anything that stores routes implements this, so
 * the API never depends on *how* they're stored.
 */
export interface RouteRepository {
  list(): Promise<Route[]>;
  get(id: string): Promise<Route | undefined>;
  create(route: Route): Promise<Route>;
  update(id: string, patch: Partial<Route>): Promise<Route | undefined>;
  remove(id: string): Promise<boolean>;
}

/** Default JSON-file-backed implementation. */
export class JsonRouteRepository implements RouteRepository {
  private store = new JsonStore<Route>(path.join(config.paths.dataDir, 'routes.json'));

  list(): Promise<Route[]> {
    return this.store.all();
  }

  async get(id: string): Promise<Route | undefined> {
    return (await this.store.all()).find((r) => r.id === id);
  }

  create(route: Route): Promise<Route> {
    return this.store.mutate((rows) => {
      rows.push(route);
      return route;
    });
  }

  update(id: string, patch: Partial<Route>): Promise<Route | undefined> {
    return this.store.mutate((rows) => {
      const i = rows.findIndex((r) => r.id === id);
      if (i === -1) return undefined;
      const current = rows[i]!;
      const next: Route = { ...current, ...patch, id: current.id };
      // Keep the cached average rating in sync with the ratings list.
      next.avgRating = averageRating(next.ratings);
      rows[i] = next;
      return next;
    });
  }

  remove(id: string): Promise<boolean> {
    return this.store.mutate((rows) => {
      const i = rows.findIndex((r) => r.id === id);
      if (i === -1) return false;
      rows.splice(i, 1);
      return true;
    });
  }
}
