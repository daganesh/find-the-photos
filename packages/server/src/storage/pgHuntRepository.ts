import type { HuntSession } from '@ftp/shared';
import { getPool } from './db.js';
import type { HuntRepository } from './huntRepository.js';

export class PgHuntRepository implements HuntRepository {
  async get(id: string): Promise<HuntSession | undefined> {
    const { rows } = await getPool().query<{ data: HuntSession }>(
      'SELECT data FROM hunt_sessions WHERE id = $1',
      [id],
    );
    return rows[0]?.data;
  }

  async create(session: HuntSession): Promise<HuntSession> {
    await getPool().query(
      'INSERT INTO hunt_sessions (id, route_id, data) VALUES ($1, $2, $3)',
      [session.id, session.routeId, JSON.stringify(session)],
    );
    return session;
  }

  async update(id: string, patch: Partial<HuntSession>): Promise<HuntSession | undefined> {
    const pool = getPool();
    const { rows } = await pool.query<{ data: HuntSession }>(
      'SELECT data FROM hunt_sessions WHERE id = $1 FOR UPDATE',
      [id],
    );
    if (!rows[0]) return undefined;
    const next: HuntSession = { ...rows[0].data, ...patch, id: rows[0].data.id };
    await pool.query('UPDATE hunt_sessions SET data = $1 WHERE id = $2', [JSON.stringify(next), id]);
    return next;
  }

  async listByRoute(routeId: string): Promise<HuntSession[]> {
    const { rows } = await getPool().query<{ data: HuntSession }>(
      'SELECT data FROM hunt_sessions WHERE route_id = $1',
      [routeId],
    );
    return rows.map((r) => r.data);
  }
}
