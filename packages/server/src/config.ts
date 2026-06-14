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

  google: {
    clientId: optional('GOOGLE_CLIENT_ID'),
  },
  gemini: {
    apiKey: optional('GEMINI_API_KEY'),
    model: optional('GEMINI_MODEL', 'gemini-2.0-flash'),
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
