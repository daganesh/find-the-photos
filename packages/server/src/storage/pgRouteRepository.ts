import type { Route } from '@ftp/shared';
import { averageRating } from '@ftp/shared';
import { getPool } from './db.js';
import type { RouteRepository } from './routeRepository.js';

export class PgRouteRepository implements RouteRepository {
  async list(): Promise<Route[]> {
    const { rows } = await getPool().query<{ data: Route }>('SELECT data FROM routes ORDER BY (data->>\'createdAt\') ASC');
    return rows.map((r) => r.data);
  }

  async get(id: string): Promise<Route | undefined> {
    const { rows } = await getPool().query<{ data: Route }>('SELECT data FROM routes WHERE id = $1', [id]);
    return rows[0]?.data;
  }

  async create(route: Route): Promise<Route> {
    await getPool().query('INSERT INTO routes (id, data) VALUES ($1, $2)', [route.id, JSON.stringify(route)]);
    return route;
  }

  async update(id: string, patch: Partial<Route>): Promise<Route | undefined> {
    const pool = getPool();
    const { rows } = await pool.query<{ data: Route }>('SELECT data FROM routes WHERE id = $1 FOR UPDATE', [id]);
    if (!rows[0]) return undefined;
    const next: Route = { ...rows[0].data, ...patch, id: rows[0].data.id };
    next.avgRating = averageRating(next.ratings);
    await pool.query('UPDATE routes SET data = $1 WHERE id = $2', [JSON.stringify(next), id]);
    return next;
  }

  async remove(id: string): Promise<boolean> {
    const { rowCount } = await getPool().query('DELETE FROM routes WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  }
}
