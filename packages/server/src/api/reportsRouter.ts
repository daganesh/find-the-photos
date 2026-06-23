import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type { BugReport, ReportSeverity, ReportStatus, ReportType } from '@ftp/shared';
import type { AppContext } from '../context.js';
import { requireAdmin, requireAuth, type AuthedRequest } from '../auth/middleware.js';
import { isGithubConfigured } from '../config.js';
import { fileReportIssue } from '../github/issueFiler.js';

function wordOverlap(a: string, b: string): number {
  const words = (s: string) => new Set(s.toLowerCase().match(/\b\w{4,}\b/g) ?? []);
  const wa = words(a);
  const wb = words(b);
  const intersection = [...wa].filter((w) => wb.has(w)).length;
  const union = new Set([...wa, ...wb]).size;
  return union === 0 ? 0 : intersection / union;
}

export function reportsRouter(ctx: AppContext): Router {
  const router = Router();

  router.get('/', requireAdmin, async (_req, res, next) => {
    try {
      const reports = await ctx.reports.list();
      res.json({ reports });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const { description, title, type, severity } = req.body as {
        description: string;
        title?: string;
        type: ReportType;
        severity: ReportSeverity;
      };
      const user = req.user!;
      const now = new Date().toISOString();

      if (!description || !type || !severity) {
        res.status(400).json({ error: 'description, type and severity are required' });
        return;
      }

      const existing = await ctx.reports.list();
      const match = existing.find(
        (r) => r.type === type && wordOverlap(r.description, description) >= 0.5,
      );

      if (match) {
        if (!match.reporters.some((reporter) => reporter.userId === user.id)) {
          match.reporters.push({ userId: user.id, name: user.name, reportedAt: now });
          match.updatedAt = now;
        }
        await ctx.reports.upsert(match);
        res.json({ report: match, merged: true });
        return;
      }

      const report: BugReport = {
        id: randomUUID(),
        type,
        severity,
        status: 'new',
        ...(title ? { title: title.trim() } : {}),
        description,
        reporters: [{ userId: user.id, name: user.name, reportedAt: now }],
        createdAt: now,
        updatedAt: now,
      };
      await ctx.reports.upsert(report);
      res.status(201).json({ report, merged: false });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id', requireAdmin, async (req: AuthedRequest, res, next) => {
    try {
      const { id } = req.params as { id: string };
      const { status, severity } = req.body as { status?: ReportStatus; severity?: ReportSeverity };

      const existing = await ctx.reports.list();
      const report = existing.find((r) => r.id === id);
      if (!report) {
        res.status(404).json({ error: 'Report not found' });
        return;
      }

      if (status !== undefined) report.status = status;
      if (severity !== undefined) report.severity = severity;
      report.updatedAt = new Date().toISOString();

      await ctx.reports.upsert(report);
      res.json({ report });
    } catch (err) {
      next(err);
    }
  });

  // Admin: file a report as a GitHub issue and (optionally) hand it to Claude.
  router.post('/:id/github-issue', requireAdmin, async (req: AuthedRequest, res, next) => {
    try {
      const { id } = req.params as { id: string };
      const { assignToAgent = true } = (req.body ?? {}) as { assignToAgent?: boolean };

      if (!isGithubConfigured()) {
        res.status(503).json({ error: 'GitHub integration is not configured. Set GITHUB_TOKEN on the server.' });
        return;
      }

      const existing = await ctx.reports.list();
      const report = existing.find((r) => r.id === id);
      if (!report) {
        res.status(404).json({ error: 'Report not found' });
        return;
      }

      const alreadyFiled = Boolean(report.github);
      const updated = await fileReportIssue(ctx, report, assignToAgent);
      res.status(alreadyFiled ? 200 : 201).json({ report: updated });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
