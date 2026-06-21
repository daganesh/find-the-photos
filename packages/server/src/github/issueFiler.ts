import type { BugReport } from '@ftp/shared';
import type { GitHubService } from './githubClient.js';

/** Minimal persistence surface needed to record the filed issue back onto the report. */
export interface ReportSink {
  upsert(report: BugReport): Promise<void>;
}

const TYPE_LABEL: Record<BugReport['type'], string> = {
  bug: 'bug',
  feature: 'enhancement',
};

const SEVERITY_LABEL: Record<BugReport['severity'], string> = {
  1: 'priority: low',
  2: 'priority: medium',
  3: 'priority: high',
};

const SEVERITY_NAME: Record<BugReport['severity'], string> = {
  1: 'Low',
  2: 'Medium',
  3: 'High',
};

/** The comment that hands an issue to Claude in GitHub Actions (@claude trigger). */
export const AGENT_PROMPT = `@claude please pick up this issue.

Plan your approach, create a new branch, implement the change across the relevant packages (shared / server / web), add or update tests, then run \`npm run typecheck\` and \`npm test\`. Open a pull request for review — do not merge it yourself. Follow the conventions in CLAUDE.md and the \`.agents/\` knowledge base.`;

/** Build the GitHub issue title, body, and labels from a triaged report. */
export function buildIssueContent(report: BugReport): {
  title: string;
  body: string;
  labels: string[];
} {
  const firstLine = report.description.split('\n')[0]!.trim();
  const short = firstLine.length > 70 ? `${firstLine.slice(0, 67)}…` : firstLine;
  const prefix = report.type === 'bug' ? '[Bug]' : '[Feature]';
  const reporterNames = report.reporters.map((r) => r.name).join(', ') || 'unknown';
  const created = new Date(report.createdAt).toISOString().slice(0, 10);

  const body = [
    '## Description',
    report.description,
    '',
    '## Details',
    `- **Severity:** ${SEVERITY_NAME[report.severity]}`,
    `- **Status:** ${report.status}`,
    `- **Reporters:** ${report.reporters.length} user(s) — ${reporterNames}`,
    `- **First reported:** ${created}`,
    `- **Report ID:** ${report.id}`,
    '',
    '## Acceptance criteria',
    '<!-- Refine before/while working -->',
    '- [ ] ',
    '',
    '---',
    '🤖 Filed from the Find the Photos admin panel.',
  ].join('\n');

  return {
    title: `${prefix} ${short}`,
    body,
    labels: [TYPE_LABEL[report.type], SEVERITY_LABEL[report.severity]],
  };
}

/**
 * File a report as a GitHub issue, optionally hand it to Claude via an @claude
 * comment, and record the issue link back onto the report. Idempotent: a report
 * that already has a linked issue is returned untouched.
 */
export async function fileReportIssue(
  deps: { github: GitHubService; reports: ReportSink },
  report: BugReport,
  assignToAgent: boolean,
): Promise<BugReport> {
  if (report.github) return report; // already filed

  const { title, body, labels } = buildIssueContent(report);
  const issue = await deps.github.createIssue({ title, body, labels });

  if (assignToAgent) {
    await deps.github.addComment(issue.number, AGENT_PROMPT);
  }

  const now = new Date().toISOString();
  report.github = {
    issueNumber: issue.number,
    issueUrl: issue.url,
    createdAt: now,
    assignedToAgent: assignToAgent,
  };
  if (report.status === 'new') report.status = 'in_progress';
  report.updatedAt = now;
  await deps.reports.upsert(report);
  return report;
}
