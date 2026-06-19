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

    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      route_id TEXT NOT NULL,
      join_code TEXT NOT NULL UNIQUE,
      data JSONB NOT NULL
    );

    CREATE INDEX IF NOT EXISTS teams_route_id_idx ON teams (route_id);
    CREATE INDEX IF NOT EXISTS teams_join_code_idx ON teams (join_code);

    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      mime_type TEXT NOT NULL,
      data BYTEA NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL
    );
  `);
  console.log('[db] tables ready');
}
