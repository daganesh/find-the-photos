import type { Team } from '@ftp/shared';
import { getPool } from './db.js';

export class PgTeamRepository {
  async get(id: string): Promise<Team | undefined> {
    const { rows } = await getPool().query<{ data: Team }>(
      'SELECT data FROM teams WHERE id = $1',
      [id],
    );
    return rows[0]?.data;
  }

  async getByJoinCode(code: string): Promise<Team | undefined> {
    const { rows } = await getPool().query<{ data: Team }>(
      'SELECT data FROM teams WHERE join_code = $1',
      [code.toUpperCase()],
    );
    return rows[0]?.data;
  }

  async listByRoute(routeId: string): Promise<Team[]> {
    const { rows } = await getPool().query<{ data: Team }>(
      'SELECT data FROM teams WHERE route_id = $1 ORDER BY (data->>\'createdAt\') DESC',
      [routeId],
    );
    return rows.map((r) => r.data);
  }

  async listByMember(userId: string): Promise<Team[]> {
    const { rows } = await getPool().query<{ data: Team }>(
      `SELECT data FROM teams
       WHERE EXISTS (
         SELECT 1 FROM jsonb_array_elements(data->'members') elem
         WHERE elem->>'userId' = $1
       )
       AND data->>'status' = ANY(ARRAY['playing', 'paused'])
       ORDER BY (data->>'createdAt') DESC`,
      [userId],
    );
    return rows.map((r) => r.data);
  }

  async create(team: Team): Promise<Team> {
    await getPool().query(
      'INSERT INTO teams (id, route_id, join_code, data) VALUES ($1, $2, $3, $4)',
      [team.id, team.routeId, team.joinCode, JSON.stringify(team)],
    );
    return team;
  }

  async update(id: string, patch: Partial<Team>): Promise<Team> {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<{ data: Team }>(
        'SELECT data FROM teams WHERE id = $1 FOR UPDATE',
        [id],
      );
      if (!rows[0]) throw new Error(`Team ${id} not found`);
      const updated = { ...rows[0].data, ...patch };
      await client.query('UPDATE teams SET data = $1 WHERE id = $2', [JSON.stringify(updated), id]);
      await client.query('COMMIT');
      return updated;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
