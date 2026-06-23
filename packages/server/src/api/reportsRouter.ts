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

/** Return the subset of reports a given user is allowed to see. */
export function visibleReports(reports: BugReport[], user: { id: string; isAdmin?: boolean }): BugReport[] {
  return user.isAdmin
    ? reports
    : reports.filter((r) => r.reporters.some((rep) => rep.userId === user.id));
}

export function reportsRouter(ctx: AppContext): Router {
  const router = Router();

  // Non-admins only see their own tickets.
  router.get('/', requireAuth, async (req: AuthedRequest, res, next) => {
    try {
      const user = req.user!;
      const reports = await ctx.reports.list();
      res.json({ reports: visibleReports(reports, user) });
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

  // Admin: update status, severity, title, and/or description. Cascades status/severity to linked reports.
  router.patch('/:id', requireAdmin, async (req: AuthedRequest, res, next) => {
    try {
      const { id } = req.params as { id: string };
      const { status, severity, title, description } = req.body as {
        status?: ReportStatus;
        severity?: ReportSeverity;
        title?: string;
        description?: string;
      };

      const existing = await ctx.reports.list();
      const report = existing.find((r) => r.id === id);
      if (!report) {
        res.status(404).json({ error: 'Report not found' });
        return;
      }

      if (status !== undefined) report.status = status;
      if (severity !== undefined) report.severity = severity;
      if (title !== undefined) report.title = title.trim() || undefined;
      if (description !== undefined) report.description = description;
      const now = new Date().toISOString();
      report.updatedAt = now;

      await ctx.reports.upsert(report);

      // Cascade status and severity changes to linked reports.
      if (report.linkedReportIds?.length && (status !== undefined || severity !== undefined)) {
        for (const linkedId of report.linkedReportIds) {
          const linked = existing.find((r) => r.id === linkedId);
          if (linked) {
            if (status !== undefined) linked.status = status;
            if (severity !== undefined) linked.severity = severity;
            linked.updatedAt = now;
            await ctx.reports.upsert(linked);
          }
        }
      }

      res.json({ report });
    } catch (err) {
      next(err);
    }
  });

  // Admin: link another report as a child of this one.
  router.post('/:id/link', requireAdmin, async (req: AuthedRequest, res, next) => {
    try {
      const { id } = req.params as { id: string };
      const { targetId } = req.body as { targetId: string };

      if (!targetId) {
        res.status(400).json({ error: 'targetId is required' });
        return;
      }
      if (targetId === id) {
        res.status(400).json({ error: 'Cannot link a report to itself' });
        return;
      }

      const existing = await ctx.reports.list();
      const report = existing.find((r) => r.id === id);
      if (!report) {
        res.status(404).json({ error: 'Report not found' });
        return;
      }
      const target = existing.find((r) => r.id === targetId);
      if (!target) {
        res.status(404).json({ error: 'Target report not found' });
        return;
      }

      // Prevent linking a report that is itself already a parent (no nesting).
      const alreadyParent = existing.some((r) => r.linkedReportIds?.includes(targetId));
      if (alreadyParent) {
        res.status(400).json({ error: 'Target report is already grouped under another ticket' });
        return;
      }

      report.linkedReportIds = [...new Set([...(report.linkedReportIds ?? []), targetId])];
      report.updatedAt = new Date().toISOString();

      // Align linked report's status and severity with the parent.
      target.status = report.status;
      target.severity = report.severity;
      target.updatedAt = report.updatedAt;

      await ctx.reports.upsert(report);
      await ctx.reports.upsert(target);

      res.json({ report });
    } catch (err) {
      next(err);
    }
  });

  // Admin: unlink a child report from this group.
  router.delete('/:id/link/:linkedId', requireAdmin, async (req: AuthedRequest, res, next) => {
    try {
      const { id, linkedId } = req.params as { id: string; linkedId: string };

      const existing = await ctx.reports.list();
      const report = existing.find((r) => r.id === id);
      if (!report) {
        res.status(404).json({ error: 'Report not found' });
        return;
      }

      report.linkedReportIds = (report.linkedReportIds ?? []).filter((lid) => lid !== linkedId);
      if (report.linkedReportIds.length === 0) delete report.linkedReportIds;
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

      const linkedReports = (report.linkedReportIds ?? [])
        .map((lid) => existing.find((r) => r.id === lid))
        .filter((r): r is BugReport => r !== undefined);

      const alreadyFiled = Boolean(report.github);
      const updated = await fileReportIssue(ctx, report, assignToAgent, linkedReports);
      res.status(alreadyFiled ? 200 : 201).json({ report: updated });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
