# Testing

## Framework

[Vitest](https://vitest.dev/) — used in both `@ftp/server` and `@ftp/shared`.  
No test framework in `@ftp/web` currently (component tests use typecheck only).

## Where tests live

```
packages/shared/src/logic/
    geo.test.ts              geographic distance helpers
    huntMachine.test.ts      step state machine (lock/unlock/skip/found)
    scoring.test.ts          scoreStep, scoreSession, stepStars

packages/server/src/gemini/
    imageMatch.test.ts       parseVerdict, stub service

packages/server/src/storage/
    db.test.ts               DB initialisation
    pgHuntRepository.test.ts hunt CRUD via PostgreSQL
    pgRouteRepository.test.ts route CRUD via PostgreSQL
```

## Running tests

```bash
# All workspaces
npm test

# Single workspace
npm run test --workspace @ftp/server
npm run test --workspace @ftp/shared

# Single file (from repo root)
npx vitest run packages/server/src/gemini/imageMatch.test.ts
npx vitest run packages/shared/src/logic/scoring.test.ts

# Watch mode (re-runs on save)
npx vitest packages/server/src/storage/db.test.ts
```

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every push to `main` and `claude/**`:
1. `npm install`
2. `npm run build --workspace @ftp/shared`
3. `npm run typecheck`
4. `npm test`

PostgreSQL repository tests (`pgHuntRepository.test.ts`, `pgRouteRepository.test.ts`) skip gracefully when `DATABASE_URL` is absent, so CI passes without a database.

## Writing new tests

- Place tests alongside the file being tested (same directory, `.test.ts` suffix)
- Import from `vitest`: `import { describe, it, expect } from 'vitest'`
- For server-side tests that need `AppContext`, construct a minimal in-memory context rather than importing `createAppContext()`
- Shared logic tests require no setup — pure functions only
