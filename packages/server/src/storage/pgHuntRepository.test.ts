import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HelpLevel, type HuntSession } from '@ftp/shared';

vi.mock('./db.js', () => ({ getPool: vi.fn() }));

import { getPool } from './db.js';
import { PgHuntRepository } from './pgHuntRepository.js';

const mockQuery = vi.fn();

beforeEach(() => {
  vi.mocked(getPool).mockReturnValue({ query: mockQuery } as ReturnType<typeof getPool>);
  mockQuery.mockReset();
});

const session: HuntSession = {
  id: 's1',
  routeId: 'r1',
  hunterId: 'u1',
  startedAt: '2026-01-01T10:00:00Z',
  totalScore: 0,
  steps: [
    {
      itemId: 'i1',
      status: 'active',
      photoAttempts: [],
      cluesUsed: 0,
      helpLevel: HelpLevel.None,
      disputed: false,
    },
  ],
};

describe('PgHuntRepository', () => {
  describe('get', () => {
    it('returns the session when found', async () => {
      mockQuery.mockResolvedValue({ rows: [{ data: session }] });
      expect(await new PgHuntRepository().get('s1')).toEqual(session);
    });

    it('returns undefined for an unknown id', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      expect(await new PgHuntRepository().get('nope')).toBeUndefined();
    });
  });

  describe('create', () => {
    it('inserts and returns the session', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      const result = await new PgHuntRepository().create(session);
      expect(result).toEqual(session);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT'),
        [session.id, session.routeId, JSON.stringify(session)],
      );
    });
  });

  describe('update', () => {
    it('merges the patch and preserves the id', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ data: session }] }) // SELECT FOR UPDATE
        .mockResolvedValueOnce({ rows: [] });                 // UPDATE

      const result = await new PgHuntRepository().update('s1', { totalScore: 42 });
      expect(result?.totalScore).toBe(42);
      expect(result?.id).toBe('s1');
    });

    it('returns undefined for an unknown id', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      expect(await new PgHuntRepository().update('nope', { totalScore: 1 })).toBeUndefined();
    });
  });

  describe('listByRoute', () => {
    it('returns sessions matching the route id', async () => {
      mockQuery.mockResolvedValue({ rows: [{ data: session }] });
      const result = await new PgHuntRepository().listByRoute('r1');
      expect(result).toEqual([session]);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE route_id'),
        ['r1'],
      );
    });

    it('returns empty array when no sessions match', async () => {
      mockQuery.mockResolvedValue({ rows: [] });
      expect(await new PgHuntRepository().listByRoute('r99')).toEqual([]);
    });
  });
});
