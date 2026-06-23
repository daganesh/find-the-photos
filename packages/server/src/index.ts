import { createApp } from './app.js';
import { config, isGeminiConfigured, isGoogleAuthConfigured } from './config.js';
import { initDb } from './storage/db.js';

function storageStatus(): string {
  if (config.databaseUrl) return 'PostgreSQL ✓';
  return 'JSON files  ⚠️  (set DATABASE_URL for persistence)';
}

function photoStatus(): string {
  if (config.s3.bucket) return `S3 bucket "${config.s3.bucket}" ✓`;
  if (config.databaseUrl) return 'PostgreSQL bytea ✓';
  return 'local disk  ⚠️  (ephemeral — set DATABASE_URL for persistence)';
}

async function start() {
  if (config.production && config.sessionSecret === 'dev-insecure-secret-change-me') {
    throw new Error('FATAL: SESSION_SECRET must be set to a strong random secret in production');
  }

  if (config.databaseUrl) {
    await initDb();
  }

  const app = createApp();
  app.listen(config.port, () => {
    console.log(`📸 Find the Photos API on http://localhost:${config.port}`);
    console.log(`   Google sign-in:  ${isGoogleAuthConfigured() ? 'configured' : 'DEV stub'}`);
    console.log(`   Gemini matching: ${isGeminiConfigured() ? 'configured' : 'DEV stub'}`);
    console.log(`   DB storage:      ${storageStatus()}`);
    console.log(`   Photo storage:   ${photoStatus()}`);
  });
}

start().catch((err) => {
  console.error('[startup] fatal error:', err);
  process.exit(1);
});
