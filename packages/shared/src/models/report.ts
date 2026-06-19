export type ReportType = 'bug' | 'feature';
export type ReportSeverity = 1 | 2 | 3;
export type ReportStatus = 'new' | 'in_progress' | 'done' | 'dismissed';

export interface Reporter {
  userId: string;
  name: string;
  reportedAt: string;
}

export interface BugReport {
  id: string;
  type: ReportType;
  severity: ReportSeverity;
  status: ReportStatus;
  description: string;
  reporters: Reporter[];
  createdAt: string;
  updatedAt: string;
}
