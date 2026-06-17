# Skill: Write Test

## Goal

Add a Vitest test for a specific function, service, or API behaviour.

## Where tests live

```
packages/shared/src/logic/          pure logic tests (no setup needed)
packages/server/src/gemini/         AI service + parseVerdict tests
packages/server/src/storage/        DB repository tests (skip if no DATABASE_URL)
```

Place the new test file alongside the source file with a `.test.ts` suffix.

## Steps

### 1. Read the code under test

- Read the source file to understand the function's inputs, outputs, and edge cases.
- Check if a test file already exists — prefer extending it over creating a new one.

### 2. Write the test

```typescript
import { describe, it, expect } from 'vitest';
import { functionUnderTest } from './module.js';

describe('functionUnderTest', () => {
  it('returns X for input Y', () => {
    expect(functionUnderTest(Y)).toEqual(X);
  });

  it('handles edge case Z', () => {
    expect(functionUnderTest(Z)).toBe(false);
  });
});
```

### 3. Rules

- Test files use `.test.ts` suffix and live **next to** the source file.
- Import from `vitest`, not from `jest`.
- For shared logic: import directly — no mocks, no setup, pure functions only.
- For server-side tests needing `AppContext`: construct a minimal in-memory context object (see `pgHuntRepository.test.ts` for a pattern); do NOT call `createAppContext()`.
- For DB tests: guard with `if (!process.env.DATABASE_URL) { it.skip(...) }` so CI passes without a DB.
- Keep tests focused: one behaviour per `it()` block.
- No comments explaining what the test does — the `it()` description does that.

### 4. Run the new test

```bash
# Run just the new file
npx vitest run packages/<workspace>/src/<path>/<file>.test.ts

# Run all tests to check for regressions
npm test
```

### 5. Typecheck

```bash
npm run typecheck
```

### 6. Commit

```bash
git add <test file>
git commit -m "test: <describe what is now covered>"
git push -u origin <branch>
```

## Reference

- Test locations and run commands: `.agents/knowledge/testing.md`
- Shared types: `.agents/knowledge/hunt-gameplay.md`
- AI service interfaces: `.agents/knowledge/gemini-ai.md`
