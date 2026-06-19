import path from 'node:path';
import type { BugReport } from '@ftp/shared';
import { JsonStore } from './jsonStore.js';
import { config } from '../config.js';
import type { ReportRepository } from '../context.js';

export class JsonReportRepository implements ReportRepository {
  private store = new JsonStore<BugReport>(path.join(config.paths.dataDir, 'reports.json'));

  list(): Promise<BugReport[]> {
    return this.store.all();
  }

  upsert(report: BugReport): Promise<void> {
    return this.store.mutate((rows) => {
      const i = rows.findIndex((r) => r.id === report.id);
      if (i === -1) {
        rows.push(report);
      } else {
        rows[i] = report;
      }
    });
  }
}
