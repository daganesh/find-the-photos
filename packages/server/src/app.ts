import fs from 'node:fs';
import path from 'node:path';
import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { createAppContext, type AppContext } from './context.js';
import { authRouter } from './api/authRouter.js';
import { routesRouter } from './api/routesRouter.js';
import { photosRouter } from './api/photosRouter.js';
import { huntRouter } from './api/huntRouter.js';
import { teamsRouter } from './api/teamsRouter.js';
import { adminRouter } from './api/adminRouter.js';
import { reportsRouter } from './api/reportsRouter.js';
import { chatRouter } from './api/chatRouter.js';
import { avatarRouter } from './api/avatarRouter.js';

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please try again later.' },
});

/**
 * Build the Express app. Takes an optional context so tests can inject fakes.
 */
export function createApp(ctx: AppContext = createAppContext()): express.Express {
  const app = express();

  // Trust the first proxy hop so req.ip reflects the real client IP (Railway / cloud).
  if (config.production) app.set('trust proxy', 1);

  // Security headers — disable CSP, COEP, and COOP.
  // COOP same-origin breaks Google Sign-In by preventing the OAuth popup from
  // posting its credential back to the opener window.
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
  }));

  app.use(cors({ origin: config.webOrigin }));
  app.use(express.json({ limit: '1mb' }));

  // Rate limiting: tighter on auth, global cap on all API routes.
  app.use('/api/auth/google', authLimiter);
  app.use('/api', globalLimiter);

  // Log every API request so Railway logs show the full request/response picture.
  app.use('/api', (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      console.log(`[api] ${req.method} ${req.path} → ${res.statusCode} (${Date.now() - start}ms)`);
    });
    next();
  });

  // Serve uploaded media — dynamically from PostgreSQL when using DB storage,
  // or statically from disk for local dev / S3 (S3 URLs are absolute, no route needed).
  if (ctx.photos.needsDynamicServing) {
    app.get('/uploads/:key', async (req, res, next) => {
      try {
        const photo = await ctx.photos.getForServing(req.params.key);
        if (!photo) return void res.status(404).json({ error: 'Photo not found' });
        res.setHeader('Content-Type', photo.mimeType);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.send(photo.data);
      } catch (err) { next(err); }
    });
  } else {
    app.use('/uploads', express.static(config.paths.uploadsDir));
  }

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRouter());
  app.use('/api/routes', routesRouter(ctx));
  app.use('/api/photos', photosRouter(ctx));
  app.use('/api/hunt', huntRouter(ctx));
  app.use('/api/teams', teamsRouter(ctx));
  app.use('/api/reports', reportsRouter(ctx));
  app.use('/api/teams/:teamId/chat', chatRouter(ctx));
  app.use('/api/avatar', avatarRouter(ctx));
  app.use('/api/admin', adminRouter(ctx));

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
    // Never expose internal error details (DB errors, stack traces) to the client in production.
    const message = config.production
      ? 'An unexpected error occurred'
      : (err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    res.status(500).json({ error: message });
  };
  app.use(onError);

  return app;
}
