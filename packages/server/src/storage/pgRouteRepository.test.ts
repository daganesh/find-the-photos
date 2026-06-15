import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Route } from '@ftp/shared';

// Mock must be declared before the import that uses it.
vi.mock('./db.js', () => ({ getPool: vi.fn() }));

import { getPool } from './db.js';
import { PgRouteRepository } from './pgRouteRepository.js';

const mockQuery = vi.fn();

beforeEach(() => {
  vi.mocked(getPool).mockReturnValue({ query: mockQuery } as ReturnType<typeof getPool>);
  mockQuery.mockReset();
});

const route: Route = {
  id: 'r1',
  title: 'Park loop',
  authorId: 'u1',
  status: 'ready',
  createdAt: '2026-01-01T00:00:00Z',
  ratings: [],
  items: [],
};

describe('PgRouteRepository', () => {
  describe('list', () => {
    it('returns all routes from the db', async () => {
      mockQuery.mockResolvedValue({ rows: [{ data: route }] });
      const repo = new PgRouteRepository();
      expect(await repo.list()).toEqual([route]);
    });

    it('returns an empty array when there are no routes', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      expect(await new PgRouteRepository().list()).toEqual([]);
    });
  });

  describe('get', () => {
    it('returns the matching route', async () => {
      mockQuery.mockResolvedValue({ rows: [{ data: route }] });
      expect(await new PgRouteRepository().get('r1')).toEqual(route);
    });

    it('returns undefined for an unknown id', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      expect(await new PgRouteRepository().get('nope')).toBeUndefined();
    });
  });

  describe('create', () => {
    it('inserts the route and returns it', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      const repo = new PgRouteRepository();
      const result = await repo.create(route);
      expect(result).toEqual(route);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT'),
        [route.id, JSON.stringify(route)],
      );
    });
  });

  describe('update', () => {
    it('merges the patch and preserves the id', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ data: route }] }) // SELECT FOR UPDATE
        .mockResolvedValueOnce({ rows: [] });               // UPDATE

      const result = await new PgRouteRepository().update('r1', { title: 'New title' });
      expect(result?.title).toBe('New title');
      expect(result?.id).toBe('r1');
    });

    it('recomputes avgRating from the ratings array', async () => {
      const withRatings: Route = { ...route, ratings: [{ hunterId: 'u2', stars: 4, createdAt: '2026-01-02T00:00:00Z' }] };
      mockQuery
        .mockResolvedValueOnce({ rows: [{ data: withRatings }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await new PgRouteRepository().update('r1', {});
      expect(result?.avgRating).toBe(4);
    });

    it('returns undefined for an unknown id', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      expect(await new PgRouteRepository().update('nope', { title: 'x' })).toBeUndefined();
    });
  });

  describe('remove', () => {
    it('returns true when a row was deleted', async () => {
      mockQuery.mockResolvedValue({ rowCount: 1 });
      expect(await new PgRouteRepository().remove('r1')).toBe(true);
    });

    it('returns false when the row did not exist', async () => {
      mockQuery.mockResolvedValue({ rowCount: 0 });
      expect(await new PgRouteRepository().remove('nope')).toBe(false);
    });
  });
});
