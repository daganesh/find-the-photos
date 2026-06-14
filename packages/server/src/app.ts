import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import { config } from './config.js';
import { createAppContext, type AppContext } from './context.js';
import { authRouter } from './api/authRouter.js';
import { routesRouter } from './api/routesRouter.js';
import { photosRouter } from './api/photosRouter.js';
import { huntRouter } from './api/huntRouter.js';

/**
 * Build the Express app. Takes an optional context so tests can inject fakes.
 */
export function createApp(ctx: AppContext = createAppContext()): express.Express {
  const app = express();

  app.use(cors({ origin: config.webOrigin }));
  app.use(express.json({ limit: '1mb' }));

  // Uploaded photos and audio clips are served statically.
  app.use('/uploads', express.static(config.paths.uploadsDir));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRouter());
  app.use('/api/routes', routesRouter(ctx));
  app.use('/api/photos', photosRouter(ctx));
  app.use('/api/hunt', huntRouter(ctx));

  // Central error handler — never leak stack traces to families.
  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    console.error('[api error]', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  };
  app.use(onError);

  return app;
}
