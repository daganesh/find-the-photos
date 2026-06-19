#!/usr/bin/env tsx
/**
 * Reads data/reports.json and prints bugs and feature requests as two separate lists.
 * Usage: npx tsx scripts/parse-reports.ts [path/to/reports.json]
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SEVERITY_LABEL: Record<number, string> = { 1: 'low', 2: 'medium', 3: 'high' };
const STATUS_ICON: Record<string, string> = {
  new: '🆕',
  in_progress: '🔄',
  done: '✅',
  dismissed: '🚫',
};

interface Reporter {
  userId: string;
  name: string;
  reportedAt: string;
}

interface BugReport {
  id: string;
  type: 'bug' | 'feature';
  severity: 1 | 2 | 3;
  status: 'new' | 'in_progress' | 'done' | 'dismissed';
  description: string;
  reporters: Reporter[];
  createdAt: string;
  updatedAt: string;
}

function formatReport(report: BugReport, index: number): string {
  const icon = STATUS_ICON[report.status] ?? '?';
  const severity = SEVERITY_LABEL[report.severity] ?? String(report.severity);
  const reporterNames = report.reporters.map((r) => r.name).join(', ') || 'unknown';
  const date = new Date(report.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  return [
    `  ${index + 1}. ${icon} [${report.status}] (severity: ${severity})`,
    `     ${report.description}`,
    `     Reported by: ${reporterNames} on ${date}`,
  ].join('\n');
}

async function main() {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const defaultPath = path.resolve(dir, '../packages/server/data/reports.json');
  const filePath = process.argv[2] ?? defaultPath;

  let reports: BugReport[] = [];
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    reports = JSON.parse(raw) as BugReport[];
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      console.error(`No reports file found at: ${filePath}`);
      console.error('Start the app and submit some reports first, or pass a custom path.');
      process.exit(1);
    }
    throw err;
  }

  const bugs = reports.filter((r) => r.type === 'bug');
  const features = reports.filter((r) => r.type === 'feature');

  console.log(`\nParsed ${reports.length} report(s) from: ${filePath}\n`);

  console.log(`=== BUGS (${bugs.length}) ===`);
  if (bugs.length === 0) {
    console.log('  (none)');
  } else {
    bugs.forEach((r, i) => console.log(formatReport(r, i)));
  }

  console.log(`\n=== FEATURE REQUESTS (${features.length}) ===`);
  if (features.length === 0) {
    console.log('  (none)');
  } else {
    features.forEach((r, i) => console.log(formatReport(r, i)));
  }

  console.log();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
