import type { BugReport } from '@ftp/shared';
import { getPool } from './db.js';
import type { ReportRepository } from '../context.js';

export class PgReportRepository implements ReportRepository {
  async list(): Promise<BugReport[]> {
    const { rows } = await getPool().query<{ data: BugReport }>(
      "SELECT data FROM reports ORDER BY (data->>'createdAt') DESC",
    );
    return rows.map((r) => r.data);
  }

  async upsert(report: BugReport): Promise<void> {
    await getPool().query(
      `INSERT INTO reports (id, data) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
      [report.id, JSON.stringify(report)],
    );
  }
}
