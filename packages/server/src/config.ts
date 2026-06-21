import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
/** Repo root (…/find-the-photos), so data/uploads live alongside the package. */
const packageRoot = path.resolve(here, '..');

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

/**
 * Central, validated configuration. Reads from .env (loaded above). Missing
 * Google keys degrade gracefully rather than crashing, so the app is runnable
 * in development without real credentials (auth + AI fall back to dev stubs).
 */
export const config = {
  port: Number(optional('PORT', '4000')),
  webOrigin: optional('WEB_ORIGIN', 'http://localhost:5173'),
  sessionSecret: optional('SESSION_SECRET', 'dev-insecure-secret-change-me'),

  databaseUrl: optional('DATABASE_URL'),

  /** S3-compatible object storage for uploaded photos.
   *  When S3_BUCKET is set, photos go to S3/R2/B2 instead of local disk. */
  s3: {
    bucket: optional('S3_BUCKET'),
    endpoint: optional('S3_ENDPOINT'),   // omit for AWS; for R2: https://<id>.r2.cloudflarestorage.com
    region: optional('S3_REGION', 'auto'),
    accessKey: optional('S3_ACCESS_KEY'),
    secretKey: optional('S3_SECRET_KEY'),
    publicUrl: optional('S3_PUBLIC_URL'), // public base URL, e.g. https://cdn.example.com
  },

  google: {
    clientId: optional('GOOGLE_CLIENT_ID'),
  },

  /** Emails allowed to access /api/admin endpoints. Comma-separated in env. */
  adminEmails: optional('ADMIN_EMAILS', 'dagane@gmail.com').split(',').map((e) => e.trim()).filter(Boolean),
  gemini: {
    apiKey: optional('GEMINI_API_KEY'),
    model: optional('GEMINI_MODEL', 'gemini-2.0-flash'),
  },

  /** GitHub integration: file admin-triaged reports as issues and hand them to Claude. */
  github: {
    token: optional('GITHUB_TOKEN'),
    owner: optional('GITHUB_OWNER', 'daganesh'),
    repo: optional('GITHUB_REPO', 'find-the-photos'),
  },

  paths: {
    dataDir: path.join(packageRoot, 'data'),
    uploadsDir: path.join(packageRoot, 'uploads'),
    /** Built web app — served in production when this directory exists. */
    webDist: path.join(packageRoot, '..', 'web', 'dist'),
  },

  /** True when running in a deployed environment (not local dev). */
  production: optional('NODE_ENV') === 'production',
} as const;

/** True when real Google sign-in is configured; otherwise we use a dev stub. */
export const isGoogleAuthConfigured = (): boolean => config.google.clientId !== '';

/** True when Gemini is configured; otherwise image matching uses a dev stub. */
export const isGeminiConfigured = (): boolean => config.gemini.apiKey !== '';

/** True when a GitHub token is configured; otherwise issue creation uses a dev stub. */
export const isGithubConfigured = (): boolean => config.github.token !== '';
