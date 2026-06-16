# Storage

## Three tiers (selected at startup by environment variables)

### Tier 1 — Structured data (routes, hunts, teams)

| Condition | Implementation | Location |
|-----------|---------------|----------|
| `DATABASE_URL` set | `PgRouteRepository`, `PgHuntRepository`, `PgTeamRepository` | PostgreSQL JSONB columns |
| No `DATABASE_URL` | `JsonRouteRepository`, `JsonHuntRepository`, `JsonTeamRepository` | `data/*.json` files (ephemeral on Railway) |

`context.ts` picks the implementation:
```typescript
const usePostgres = config.databaseUrl !== '';
routes: usePostgres ? new PgRouteRepository() : new JsonRouteRepository(),
```

### Tier 2 — Photos

| Condition | Where photos go |
|-----------|----------------|
| `S3_BUCKET` set | S3-compatible bucket (AWS S3, Cloudflare R2, Backblaze B2) |
| `DATABASE_URL` set (no S3) | PostgreSQL `photos` table — `bytea` column |
| Neither | `uploads/` directory on local disk |

`PhotoStore` (`packages/server/src/photos/photoStore.ts`) handles all three transparently.  
When serving photos stored in PostgreSQL, the server dynamically serves them via `GET /uploads/:key`.

## Database schema

Auto-migrated on startup (`packages/server/src/storage/db.ts`):

```sql
CREATE TABLE IF NOT EXISTS routes (
  id TEXT PRIMARY KEY, author_id TEXT NOT NULL, data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS hunts (
  id TEXT PRIMARY KEY, route_id TEXT NOT NULL, data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY, route_id TEXT NOT NULL, join_code TEXT NOT NULL UNIQUE, data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY, mime_type TEXT NOT NULL, data BYTEA NOT NULL
);
```

All domain data lives in the `data` JSONB column — schema changes require no migrations, just type updates in `@ftp/shared`.

## JSON fallback file layout

```
data/
  routes.json    Route[]
  hunts.json     HuntSession[]
  teams.json     Team[]
uploads/
  <nanoid>.<ext>  uploaded photos and audio clips
```

## Admin cleanup

`DELETE /api/admin/cleanup/orphaned-photos` — removes photos not referenced by any route/step.  
`DELETE /api/admin/cleanup/old-sessions?days=N` — removes finished hunts/teams older than N days.  
Both are gated by `requireAdmin` middleware (`ADMIN_EMAILS` env var).
