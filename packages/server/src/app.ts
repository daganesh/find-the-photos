import fs from 'node:fs';
import path from 'node:path';
import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import { config } from './config.js';
import { createAppContext, type AppContext } from './context.js';
import { authRouter } from './api/authRouter.js';
import { routesRouter } from './api/routesRouter.js';
import { photosRouter } from './api/photosRouter.js';
import { huntRouter } from './api/huntRouter.js';
import { teamsRouter } from './api/teamsRouter.js';

/**
 * Build the Express app. Takes an optional context so tests can inject fakes.
 */
export function createApp(ctx: AppContext = createAppContext()): express.Express {
  const app = express();

  app.use(cors({ origin: config.webOrigin }));
  app.use(express.json({ limit: '1mb' }));

  // Log every API request so Railway logs show the full request/response picture.
  app.use('/api', (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      console.log(`[api] ${req.method} ${req.path} → ${res.statusCode} (${Date.now() - start}ms)`);
    });
    next();
  });

  // Uploaded photos and audio clips are served statically.
  app.use('/uploads', express.static(config.paths.uploadsDir));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRouter());
  app.use('/api/routes', routesRouter(ctx));
  app.use('/api/photos', photosRouter(ctx));
  app.use('/api/hunt', huntRouter(ctx));
  app.use('/api/teams', teamsRouter(ctx));

  // In production, serve the pre-built React app and handle client-side routing.
  if (config.production && fs.existsSync(config.paths.webDist)) {
    app.use(express.static(config.paths.webDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(config.paths.webDist, 'index.html'));
    });
  }

  // Central error handler — log the full error so Railway logs capture it.
  const onError: ErrorRequestHandler = (err, req, res, _next) => {
    console.error(`[api error] ${req.method} ${req.path}`, err);
    const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
    res.status(500).json({ error: message });
  };
  app.use(onError);

  return app;
}
