import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

let _pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: config.production ? { rejectUnauthorized: false } : false,
    });
  }
  return _pool;
}

export async function initDb(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS routes (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hunt_sessions (
      id TEXT PRIMARY KEY,
      route_id TEXT NOT NULL,
      data JSONB NOT NULL
    );

    CREATE INDEX IF NOT EXISTS hunt_sessions_route_id_idx ON hunt_sessions (route_id);
  `);
  console.log('[db] tables ready');
}
