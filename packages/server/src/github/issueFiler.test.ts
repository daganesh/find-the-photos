import { describe, it, expect, vi } from 'vitest';
import type { BugReport } from '@ftp/shared';
import { AGENT_PROMPT, buildIssueContent, fileReportIssue } from './issueFiler.js';

function makeReport(overrides: Partial<BugReport> = {}): BugReport {
  return {
    id: 'r1',
    type: 'bug',
    severity: 3,
    status: 'new',
    description: 'Login button does nothing on iOS Safari',
    reporters: [{ userId: 'u1', name: 'Dana', reportedAt: '2026-06-01T00:00:00.000Z' }],
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('buildIssueContent', () => {
  it('formats a bug issue with title prefix, labels and details', () => {
    const { title, body, labels } = buildIssueContent(makeReport());
    expect(title).toBe('[Bug] Login button does nothing on iOS Safari');
    expect(labels).toEqual(['bug', 'priority: high']);
    expect(body).toContain('## Description');
    expect(body).toContain('**Report ID:** r1');
    expect(body).toContain('**Severity:** High');
    expect(body).toContain('## Acceptance criteria');
  });

  it('uses the feature prefix and enhancement label for features', () => {
    const { title, labels } = buildIssueContent(makeReport({ type: 'feature', severity: 1 }));
    expect(title.startsWith('[Feature]')).toBe(true);
    expect(labels).toEqual(['enhancement', 'priority: low']);
  });

  it('truncates long descriptions in the title', () => {
    const { title } = buildIssueContent(makeReport({ description: 'x'.repeat(120) }));
    expect(title.length).toBeLessThanOrEqual(80);
    expect(title.endsWith('…')).toBe(true);
  });
});

describe('fileReportIssue', () => {
  it('creates an issue, posts the agent comment, and links it to the report', async () => {
    const github = {
      createIssue: vi.fn().mockResolvedValue({ number: 42, url: 'https://github.com/x/y/issues/42' }),
      addComment: vi.fn().mockResolvedValue(undefined),
    };
    const reports = { upsert: vi.fn().mockResolvedValue(undefined) };
    const report = makeReport();

    const updated = await fileReportIssue({ github, reports }, report, true);

    expect(github.createIssue).toHaveBeenCalledOnce();
    expect(github.addComment).toHaveBeenCalledWith(42, AGENT_PROMPT);
    expect(updated.github).toMatchObject({ issueNumber: 42, issueUrl: 'https://github.com/x/y/issues/42', assignedToAgent: true });
    expect(updated.status).toBe('in_progress');
    expect(reports.upsert).toHaveBeenCalledWith(updated);
  });

  it('skips the agent comment when assignToAgent is false', async () => {
    const github = {
      createIssue: vi.fn().mockResolvedValue({ number: 7, url: 'u' }),
      addComment: vi.fn(),
    };
    const reports = { upsert: vi.fn() };

    const updated = await fileReportIssue({ github, reports }, makeReport(), false);

    expect(github.addComment).not.toHaveBeenCalled();
    expect(updated.github?.assignedToAgent).toBe(false);
  });

  it('leaves a non-new status untouched when filing', async () => {
    const github = {
      createIssue: vi.fn().mockResolvedValue({ number: 9, url: 'u' }),
      addComment: vi.fn(),
    };
    const reports = { upsert: vi.fn() };

    const updated = await fileReportIssue({ github, reports }, makeReport({ status: 'done' }), false);

    expect(updated.status).toBe('done');
  });

  it('is idempotent — does not file twice for a report that already has an issue', async () => {
    const github = { createIssue: vi.fn(), addComment: vi.fn() };
    const reports = { upsert: vi.fn() };
    const report = makeReport({
      github: { issueNumber: 1, issueUrl: 'u', createdAt: 'x', assignedToAgent: true },
    });

    const updated = await fileReportIssue({ github, reports }, report, true);

    expect(github.createIssue).not.toHaveBeenCalled();
    expect(reports.upsert).not.toHaveBeenCalled();
    expect(updated).toBe(report);
  });
});
