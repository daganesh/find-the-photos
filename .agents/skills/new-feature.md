# Skill: New Feature

## Goal

Implement a requested feature end-to-end across the monorepo, following existing patterns.

## Steps

### 1. Understand the feature

- Clarify what the feature does and which layers it touches (shared types, server API, web UI).
- Read `.agents/knowledge/architecture.md` for the monorepo layout and build order.
- Read `.agents/knowledge/hunt-gameplay.md` for domain types.
- Read `.agents/knowledge/api-routes.md` for existing endpoints.

### 2. Plan the change layers (do this before writing code)

Typical stack for a new feature:

| Layer | Location | Notes |
|-------|----------|-------|
| Shared types | `packages/shared/src/models/` | Add new fields or interfaces |
| Shared contracts | `packages/shared/src/contracts/api.ts` | Request/response DTOs |
| Shared logic | `packages/shared/src/logic/` | Pure functions, scoring, state machine |
| Server API | `packages/server/src/api/` | New route or extend existing router |
| Server service | `packages/server/src/hunt/huntService.ts` | Business logic |
| AppContext | `packages/server/src/context.ts` | Wire in new service if needed |
| Web API client | `packages/web/src/services/apiClient.ts` | Add typed call |
| Web hook | `packages/web/src/hooks/` | State + action wrappers |
| Web screen | `packages/web/src/screens/` | UI rendering |

### 3. Implement — shared first

Always update `@ftp/shared` before server or web. The other two packages import from it.

```bash
# Verify shared types compile
npm run build --workspace @ftp/shared
```

### 4. Implement — server

- Follow the dual-implementation pattern: if adding a new service, add both a real and a stub implementation (see `packages/server/src/gemini/` for examples).
- Add the new service/repo to `AppContext` in `packages/server/src/context.ts`.
- Add or extend a router in `packages/server/src/api/`; mount it in `packages/server/src/index.ts`.

### 5. Implement — web

- Add the API call in `packages/web/src/services/apiClient.ts`.
- Add or extend a hook in `packages/web/src/hooks/`.
- Update screens in `packages/web/src/screens/`.
- Use existing CSS variables from `packages/web/src/styles/theme.css`.

### 6. Test and typecheck

```bash
npm run typecheck      # all workspaces
npm test               # vitest across server + shared
```

If the feature adds new pure logic (scoring, state transitions), add tests alongside the source file:
```bash
npx vitest run packages/shared/src/logic/<new-logic>.test.ts
```

### 7. Commit and push

```bash
git add <files>
git commit -m "feat: <short description>"
git push -u origin <branch>
```

## Key patterns to follow

- **Storage**: new persistent data goes in a JSONB column; add JSON + Postgres repository pair.
- **AI calls**: add to `ImageMatchService` or `ModerationService`; always provide a stub implementation.
- **Auth**: use `requireAuth` / `optionalAuth` / `requireAdmin` middleware from `packages/server/src/auth/middleware.ts`.
- **No new comments**: rely on well-named identifiers; only comment non-obvious WHY.
- **No speculative code**: implement only what the feature requires.
