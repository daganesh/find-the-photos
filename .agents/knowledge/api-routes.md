# API Routes

All routes are mounted at `/api` in `packages/server/src/index.ts`.  
Auth is session-token based (`Authorization: Bearer <token>`).

## Auth (`/api/auth`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/auth/config` | None | Returns `{ googleConfigured: boolean }` |
| POST | `/api/auth/google` | None | Exchange Google credential → `{ token, user }` |

## Routes (`/api/routes`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/routes` | Optional | List all `ready` routes + caller's own drafts |
| POST | `/api/routes` | Required | Create a draft route; body: `{ title, description? }` |
| GET | `/api/routes/:id` | Optional | Get full route (drafts visible to owner only) |
| PATCH | `/api/routes/:id` | Owner | Update title/description/coverPhotoUrl/items |
| DELETE | `/api/routes/:id` | Owner | Delete route |
| POST | `/api/routes/:id/moderate` | Owner | AI text moderation check → `ModerationResult` |
| POST | `/api/routes/:id/finalize` | Owner | Mark draft `→ ready`; validates playability |
| POST | `/api/routes/:id/ratings` | Required | Rate a route; body: `{ stars: 1-5, comment? }` |

## Hunt (`/api/hunt`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/hunt/start` | Required | Begin a solo play-through; body: `{ routeId, location? }` → `{ session }` |
| GET | `/api/hunt/:sessionId` | Required | Fetch current session state |
| POST | `/api/hunt/:sessionId/steps/:itemId/photo` | Required | Upload photo (multipart `file`); AI judges → `SubmitPhotoResponse` |
| POST | `/api/hunt/:sessionId/steps/:itemId/help` | Required | Escalate help level; body: `{ hunterLocation? }` |
| POST | `/api/hunt/:sessionId/steps/:itemId/skip` | Required | Skip step → `'skipped'`, 0 pts |
| POST | `/api/hunt/:sessionId/steps/:itemId/dispute` | Required | Override AI verdict; body: `{ description }` — AI verifies description matches item |
| POST | `/api/hunt/:sessionId/steps/:itemId/return` | Required | Re-activate a previously skipped step |

## Teams (`/api/teams`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/teams` | Required | Create team + lobby; body: `{ routeId, name?, avatarEmoji? }` |
| GET | `/api/teams/:id` | Required | Get team state (members, status, sessionId) |
| POST | `/api/teams/join/:code` | Required | Join via 6-char code; body: `{ avatarEmoji? }` |
| PATCH | `/api/teams/:id` | Owner | Update team name/photoUrl |
| POST | `/api/teams/:id/start` | Owner | Start hunt; body: `{ location? }` → `{ team, session }` |
| POST | `/api/teams/:id/pause` | Member | Toggle pause/resume for whole team |
| GET | `/api/teams/route/:routeId/leaderboard` | Required | Finished teams sorted by score then time |

## Photos (`/api/photos`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/photos` | Required | Upload image or audio (multipart `file`, max 15 MB); runs image moderation before saving → `{ url }` |

## Reports (`/api/reports`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/reports` | Required | List all reports |
| POST | `/api/reports` | Required | Submit a bug/feature report; deduplicates via word-overlap |
| PATCH | `/api/reports/:id` | Admin | Update `status` and/or `severity` of a report |

## Admin (`/api/admin`) — `ADMIN_EMAILS` gate

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/admin/storage` | Admin | Storage stats: DB size, table breakdown, photo count/MB, warnings |
| DELETE | `/api/admin/cleanup/orphaned-photos` | Admin | Delete photos not referenced by any route or session |
| DELETE | `/api/admin/cleanup/old-sessions?days=N` | Admin | Delete finished hunts/teams older than N days (default 30) |

## Common response shapes

```typescript
// Photo submit
SubmitPhotoResponse { verdict: MatchVerdict, step: StepProgress, session: HuntSession }

// Moderation
ModerationResult { flagged: boolean, issues: ModerationIssue[] }
ModerationIssue  { field: string, text: string, reason: string }

// Errors
{ error: string }   // with appropriate HTTP status code
```

## Auth middleware

- `requireAuth` — reads `Authorization: Bearer <jwt>` header; 401 if absent/invalid
- `optionalAuth` — same but does not reject unauthenticated requests
- `requireAdmin` — `requireAuth` + checks `user.isAdmin` (set from `ADMIN_EMAILS` env var)
