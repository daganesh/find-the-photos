# Skill: Bug Fix

## Goal

Diagnose and fix a reported bug with minimal blast radius — no refactoring, no new abstractions.

## Steps

### 1. Reproduce and locate

- Read the bug report carefully; note the exact symptom and any error message or stack trace.
- Find the relevant code using Grep/Glob. Check:
  - `packages/shared/src/` for shared logic bugs
  - `packages/server/src/` for API / data bugs
  - `packages/web/src/` for UI bugs
- Read the file(s) containing the suspected code.

### 2. Understand the context

- Trace the data flow: where does the value originate, what transforms it, where does it get rendered/used?
- Check if there are existing tests for this path (`packages/shared/src/logic/*.test.ts`, `packages/server/src/gemini/*.test.ts`).
- Confirm the bug is reproducible in the logic you've read — do not guess.

### 3. Fix

- Make the smallest change that fixes the symptom without altering surrounding behaviour.
- Do not add error handling for scenarios that cannot occur.
- Do not add comments explaining what the code does — only add a comment if the WHY is non-obvious.

### 4. Test

- If a test file exists for the module, run it:
  ```bash
  npx vitest run <path-to-test-file>
  ```
- If the bug is in shared logic, write a targeted test case in the existing `.test.ts` file.
- Run the full test suite to check for regressions:
  ```bash
  npm test
  ```
- Run typecheck:
  ```bash
  npm run typecheck
  ```

### 5. Commit and push

```bash
git add <changed files>
git commit -m "fix: <one-line description of the symptom fixed>"
git push -u origin <branch>
```

## Reference

- Architecture overview: `.agents/knowledge/architecture.md`
- Gameplay types and flow: `.agents/knowledge/hunt-gameplay.md`
- API endpoints: `.agents/knowledge/api-routes.md`
- Test locations and commands: `.agents/knowledge/testing.md`
