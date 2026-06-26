import { describe, it, expect } from 'vitest';
import type { BugReport } from '@ftp/shared';
import { visibleReports } from './reportsRouter.js';

function makeReport(id: string, reporterUserId: string): BugReport {
  return {
    id,
    type: 'bug',
    severity: 2,
    status: 'new',
    description: `Report ${id}`,
    reporters: [{ userId: reporterUserId, name: 'Tester', reportedAt: '2026-01-01T00:00:00Z' }],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

const reports = [
  makeReport('r1', 'user-a'),
  makeReport('r2', 'user-b'),
  makeReport('r3', 'user-a'),
];

describe('visibleReports', () => {
  it('admin sees all reports regardless of who filed them', () => {
    const visible = visibleReports(reports, { id: 'user-a', isAdmin: true });
    expect(visible).toHaveLength(3);
  });

  it('non-admin sees only their own reports', () => {
    const visible = visibleReports(reports, { id: 'user-a', isAdmin: false });
    expect(visible).toHaveLength(2);
    expect(visible.every((r) => r.reporters.some((rep) => rep.userId === 'user-a'))).toBe(true);
  });

  it('non-admin with no reports sees an empty list', () => {
    const visible = visibleReports(reports, { id: 'user-c', isAdmin: false });
    expect(visible).toHaveLength(0);
  });

  it('treats missing isAdmin as non-admin', () => {
    const visible = visibleReports(reports, { id: 'user-b' });
    expect(visible).toHaveLength(1);
    expect(visible[0]!.id).toBe('r2');
  });
});
