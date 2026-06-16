import type { Team } from '@ftp/shared';
import { JsonStore } from './jsonStore.js';

const store = new JsonStore<Team>('teams.json');

export class JsonTeamRepository {
  async get(id: string): Promise<Team | undefined> {
    return (await store.all()).find((t) => t.id === id);
  }

  async getByJoinCode(code: string): Promise<Team | undefined> {
    return (await store.all()).find((t) => t.joinCode === code.toUpperCase());
  }

  async listByRoute(routeId: string): Promise<Team[]> {
    return (await store.all()).filter((t) => t.routeId === routeId);
  }

  async create(team: Team): Promise<Team> {
    return store.mutate((rows) => { rows.push(team); return team; });
  }

  async update(id: string, patch: Partial<Team>): Promise<Team> {
    return store.mutate((rows) => {
      const i = rows.findIndex((t) => t.id === id);
      if (i === -1) throw new Error(`Team ${id} not found`);
      rows[i] = { ...rows[i]!, ...patch };
      return rows[i]!;
    });
  }
}
