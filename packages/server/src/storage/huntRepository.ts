import path from 'node:path';
import type { HuntSession } from '@ftp/shared';
import { JsonStore } from './jsonStore.js';
import { config } from '../config.js';

/** Persistence seam for hunt play-throughs. */
export interface HuntRepository {
  get(id: string): Promise<HuntSession | undefined>;
  create(session: HuntSession): Promise<HuntSession>;
  update(id: string, patch: Partial<HuntSession>): Promise<HuntSession | undefined>;
  listByRoute(routeId: string): Promise<HuntSession[]>;
}

export class JsonHuntRepository implements HuntRepository {
  private store = new JsonStore<HuntSession>(
    path.join(config.paths.dataDir, 'hunts.json'),
  );

  async get(id: string): Promise<HuntSession | undefined> {
    return (await this.store.all()).find((s) => s.id === id);
  }

  create(session: HuntSession): Promise<HuntSession> {
    return this.store.mutate((rows) => {
      rows.push(session);
      return session;
    });
  }

  update(id: string, patch: Partial<HuntSession>): Promise<HuntSession | undefined> {
    return this.store.mutate((rows) => {
      const i = rows.findIndex((s) => s.id === id);
      if (i === -1) return undefined;
      const next: HuntSession = { ...rows[i]!, ...patch, id: rows[i]!.id };
      rows[i] = next;
      return next;
    });
  }

  async listByRoute(routeId: string): Promise<HuntSession[]> {
    return (await this.store.all()).filter((s) => s.routeId === routeId);
  }
}
