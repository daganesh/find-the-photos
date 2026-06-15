import { describe, it, expect, vi } from 'vitest';

/**
 * Unit test — verifies getPool creates a Pool once and reuses it,
 * without touching a real database.
 */
describe('getPool (singleton)', () => {
  it('returns the same Pool instance on repeated calls', async () => {
    vi.resetModules(); // fresh module state for this test

    // Stub pg so we never open a real socket.
    vi.doMock('pg', () => {
      const Pool = vi.fn().mockImplementation(() => ({ query: vi.fn() }));
      return { default: { Pool } };
    });

    // Also stub config so DATABASE_URL and production are predictable.
    vi.doMock('../config.js', () => ({
      config: { databaseUrl: 'postgresql://test', production: false },
    }));

    const { getPool } = await import('./db.js');
    const a = getPool();
    const b = getPool();
    expect(a).toBe(b); // same object reference
  });
});

/**
 * Integration tests — only run when DATABASE_URL is set in the environment.
 * In CI and local dev without Postgres these are skipped automatically.
 */
const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)('database integration', () => {
  it('initDb creates tables without throwing', async () => {
    const { initDb } = await import('./db.js');
    await expect(initDb()).resolves.not.toThrow();
  });

  it('routes table accepts insert, select, and delete', async () => {
    const { getPool, initDb } = await import('./db.js');
    await initDb();
    const pool = getPool();
    const id = `_test_${Date.now()}`;

    try {
      await pool.query('INSERT INTO routes (id, data) VALUES ($1, $2)', [
        id,
        JSON.stringify({ id, title: 'integration test route' }),
      ]);

      const { rows } = await pool.query<{ data: { title: string } }>(
        'SELECT data FROM routes WHERE id = $1',
        [id],
      );
      expect(rows[0]?.data.title).toBe('integration test route');
    } finally {
      await pool.query('DELETE FROM routes WHERE id = $1', [id]);
    }
  });

  it('hunt_sessions table accepts insert, select, and delete', async () => {
    const { getPool } = await import('./db.js');
    const pool = getPool();
    const id = `_test_${Date.now()}`;

    try {
      await pool.query(
        'INSERT INTO hunt_sessions (id, route_id, data) VALUES ($1, $2, $3)',
        [id, 'r1', JSON.stringify({ id, routeId: 'r1', hunterId: 'u1' })],
      );

      const { rows } = await pool.query<{ data: { hunterId: string } }>(
        'SELECT data FROM hunt_sessions WHERE id = $1',
        [id],
      );
      expect(rows[0]?.data.hunterId).toBe('u1');

      const byRoute = await pool.query(
        'SELECT id FROM hunt_sessions WHERE route_id = $1',
        ['r1'],
      );
      expect(byRoute.rows.some((r: { id: string }) => r.id === id)).toBe(true);
    } finally {
      await pool.query('DELETE FROM hunt_sessions WHERE id = $1', [id]);
    }
  });
});
