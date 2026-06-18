# Dev Environment

## Prerequisites

- Node.js 20+
- npm 10+ (workspaces support)
- (Optional) PostgreSQL 15+ for persistent storage
- (Optional) Gemini API key for real AI matching

## Environment variables

Copy `.env.example` to `.env` in the repo root and fill in:

```bash
# Google Sign-In (both server and web use the same client ID)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com

# Gemini (server only — never sent to browser)
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.0-flash          # default

# Google Maps (web only)
GOOGLE_MAPS_API_KEY=your-maps-browser-key
VITE_GOOGLE_MAPS_API_KEY=your-maps-browser-key

# Server
PORT=4000
WEB_ORIGIN=http://localhost:5173
SESSION_SECRET=change-me-to-a-long-random-string

# Web (Vite exposes VITE_* to the browser)
VITE_API_BASE_URL=http://localhost:4000

# Persistence — omit to fall back to JSON files + local disk
DATABASE_URL=postgresql://user:pass@localhost:5432/ftp

# S3-compatible photo storage — omit to use PostgreSQL bytea or local disk
S3_BUCKET=my-bucket
S3_ENDPOINT=https://<id>.r2.cloudflarestorage.com   # R2/B2; omit for AWS
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_PUBLIC_URL=https://cdn.example.com               # public base URL

# Admin panel access (comma-separated emails)
ADMIN_EMAILS=dagane@gmail.com
```

## Running locally

```bash
npm install                  # install all workspace deps

# Start everything (shared build + server + web in parallel)
npm run dev
# → API on http://localhost:4000
# → Web on http://localhost:5173
```

## Typecheck only

`@ftp/web` and `@ftp/server` import compiled types from `@ftp/shared/dist/`, which is gitignored.
**Always build shared first** when shared types have changed, otherwise typecheck will use stale `.d.ts` files:

```bash
npm run build --workspace @ftp/shared           # build shared first
npm run typecheck                               # then check all workspaces
npm run typecheck --workspace @ftp/server       # server only
npm run typecheck --workspace @ftp/web          # web only
```

CI (`.github/workflows/ci.yml`) handles this automatically: it runs `Build shared` before `Type-check all packages`.

## Deployment

Merging a PR into `main` triggers automatic deployment to Railway — no manual steps required.  
`railway.json` configures build (`npm install && npm run build`) and start (`npm start`).  
`npm start` runs `packages/server/dist/index.js`, which serves the compiled web app from `packages/web/dist/`.  
Railway injects `DATABASE_URL`, `GEMINI_API_KEY`, `GOOGLE_CLIENT_ID`, etc. as env vars.

## No-credentials dev mode

Without `GEMINI_API_KEY` the app uses stub AI services (photo match always returns "tap I found it!" stub).  
Without `GOOGLE_CLIENT_ID` sign-in uses a dev stub that accepts any credential.  
Without `DATABASE_URL` data is stored in `data/*.json` and photos in `uploads/` (ephemeral between deploys).
