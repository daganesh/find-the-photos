import { createApp } from './app.js';
import { config, isGeminiConfigured, isGoogleAuthConfigured } from './config.js';

const app = createApp();

app.listen(config.port, () => {
  console.log(`📸 Find the Photos API on http://localhost:${config.port}`);
  console.log(`   Google sign-in: ${isGoogleAuthConfigured() ? 'configured' : 'DEV stub'}`);
  console.log(`   Gemini matching: ${isGeminiConfigured() ? 'configured' : 'DEV stub'}`);
});
