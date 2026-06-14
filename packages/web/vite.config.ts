import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Env lives in the repo root (.env), shared with the server.
export default defineConfig(({ mode }) => {
  const rootEnv = loadEnv(mode, '../../', '');
  const apiBase = rootEnv.VITE_API_BASE_URL || 'http://localhost:4000';
  return {
    plugins: [react()],
    envDir: '../../',
    server: {
      port: 5173,
      // Proxy uploaded media so the browser can load photos from the API.
      proxy: {
        '/api': apiBase,
        '/uploads': apiBase,
      },
    },
  };
});
