# Architecture

## Monorepo layout (npm workspaces)

```
find-the-photos/
├── packages/
│   ├── shared/          @ftp/shared — types + pure game logic (no runtime deps)
│   │   └── src/
│   │       ├── models/  Route, Item, HuntSession, Team, GeoPoint, MatchVerdict
│   │       ├── logic/   scoring.ts, huntMachine.ts, geo.ts, teamScoring.ts
│   │       └── contracts/api.ts  — shared request/response types
│   ├── server/          @ftp/server — Express API (Node 20, ESM)
│   │   └── src/
│   │       ├── api/     authRouter, routesRouter, huntRouter, teamsRouter, photosRouter, adminRouter
│   │       ├── auth/    Google Sign-In verification + JWT middleware
│   │       ├── config.ts          all env vars with fallbacks
│   │       ├── context.ts         AppContext (routes, hunts, teams, photos, imageMatch, moderation)
│   │       ├── gemini/  imageMatch.ts, moderationService.ts
│   │       ├── hunt/    huntService.ts — session business logic
│   │       ├── photos/  photoStore.ts — three-tier upload/read
│   │       └── storage/ db.ts, routeRepository, huntRepository, pgRouteRepository, pgHuntRepository, pgTeamRepository
│   └── web/             @ftp/web — React 18 + Vite SPA
│       └── src/
│           ├── auth/    AuthContext (Google Identity Services)
│           ├── hooks/   useHunt, useTeamHunt, useAsync
│           ├── screens/ Home, HuntPlayer, TeamHuntPlayer, RouteBuilder, ItemEditor, Results, TeamResults, Admin…
│           ├── services/ apiClient.ts, scoreCard.ts (canvas polaroid), geolocation.ts
│           ├── styles/  theme.css (design tokens), ui.css
│           └── ui/      Avatar, Button, Card, Banner, PhotoCapture, HintView, Timer…
├── .env.example
├── railway.json         Railway deployment config (build + start commands)
└── tsconfig.base.json   shared TS config (extended by each package)
```

## Entry points

| Package | Entry point |
|---------|-------------|
| server  | `packages/server/src/index.ts` → `app.ts` → routers |
| web     | `packages/web/src/main.tsx` → `App.tsx` → React Router routes |
| shared  | `packages/shared/src/index.ts` (barrel export) |

## Build order

shared must be compiled before server or web can import from it:
```bash
npm run build --workspace @ftp/shared   # always first
```

## Key patterns

- `AppContext` (`context.ts`) — single object holding all services; passed into every router
- Dual implementations — each repository has JSON (dev) + PostgreSQL (prod) version; `context.ts` picks based on `DATABASE_URL`
- Stub AI services — when `GEMINI_API_KEY` is absent, stub implementations keep the app runnable without credentials
- Shared contracts — `packages/shared/src/contracts/api.ts` is the single source of truth for request/response types used by both client and server
