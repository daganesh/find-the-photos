export type ReportType = 'bug' | 'feature';
export type ReportSeverity = 1 | 2 | 3;
export type ReportStatus = 'new' | 'in_progress' | 'done' | 'dismissed';

export interface Reporter {
  userId: string;
  name: string;
  reportedAt: string;
}

/** Link to the GitHub issue filed from a report, plus whether Claude was asked to work it. */
export interface GithubIssueRef {
  issueNumber: number;
  issueUrl: string;
  createdAt: string;
  /** True when an @claude comment was posted to hand the issue to the agent. */
  assignedToAgent: boolean;
}

export interface BugReport {
  id: string;
  type: ReportType;
  severity: ReportSeverity;
  status: ReportStatus;
  title?: string;
  description: string;
  reporters: Reporter[];
  createdAt: string;
  updatedAt: string;
  /** Up to 3 image URLs attached by the reporter (resized before upload). */
  imageUrls?: string[];
  /** Set once an admin files this report as a GitHub issue. */
  github?: GithubIssueRef;
  /** IDs of reports grouped under this one. Grouped reports share status and priority. */
  linkedReportIds?: string[];
}
