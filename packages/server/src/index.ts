import { createApp } from './app.js';
import { config, isGeminiConfigured, isGoogleAuthConfigured } from './config.js';
import { initDb } from './storage/db.js';

async function start() {
  if (config.databaseUrl) {
    await initDb();
  }

  const app = createApp();
  app.listen(config.port, () => {
    console.log(`📸 Find the Photos API on http://localhost:${config.port}`);
    console.log(`   Google sign-in: ${isGoogleAuthConfigured() ? 'configured' : 'DEV stub'}`);
    console.log(`   Gemini matching: ${isGeminiConfigured() ? 'configured' : 'DEV stub'}`);
    if (config.databaseUrl) {
      console.log('   Storage: PostgreSQL ✓');
    } else {
      console.warn('   ⚠️  Storage: JSON files (ephemeral — set DATABASE_URL for persistence)');
    }
  });
}

start().catch((err) => {
  console.error('[startup] fatal error:', err);
  process.exit(1);
});
