# .agents/ — Find the Photos knowledge base

Family photo treasure-hunt game: a hider builds a route of photo/task items; hunters find them in order, guided by clues and AI photo-matching.

## Knowledge files

| File | Covers |
|------|--------|
| [`knowledge/architecture.md`](knowledge/architecture.md) | Monorepo layout, entry points, key modules, external services |
| [`knowledge/dev-environment.md`](knowledge/dev-environment.md) | Prerequisites, env vars, local run commands, Railway deploy |
| [`knowledge/testing.md`](knowledge/testing.md) | Vitest setup, where tests live, how to run one or all |
| [`knowledge/storage.md`](knowledge/storage.md) | Three-tier storage (JSON → PostgreSQL → S3), DB schema |
| [`knowledge/ui-ux-guidelines.md`](knowledge/ui-ux-guidelines.md) | UI/UX design principles, visual identity, button rules, interaction patterns |
| [`knowledge/hunt-gameplay.md`](knowledge/hunt-gameplay.md) | Domain model: Route, Item, HuntSession, StepProgress, scoring |
| [`knowledge/gemini-ai.md`](knowledge/gemini-ai.md) | Gemini services: image match, task scoring, dispute verify, moderation |
| [`knowledge/api-routes.md`](knowledge/api-routes.md) | All REST endpoints, auth, request/response shapes |

## Skill files

| File | When to use |
|------|-------------|
| [`skills/bug-fix.md`](skills/bug-fix.md) | Diagnosing and fixing a defect end-to-end |
| [`skills/new-feature.md`](skills/new-feature.md) | Adding a new feature across shared/server/web |
| [`skills/write-test.md`](skills/write-test.md) | Writing and running Vitest unit tests |

## Keeping Knowledge Up to Date

After any change that affects **architecture, APIs, domain models, env vars, or dev workflow**, update the relevant knowledge file in a **separate commit** with message `docs(agents): update <filename>`.

Triggers:
- New npm package added → `dev-environment.md`
- New API endpoint → `api-routes.md`
- `Route`, `Item`, `HuntSession`, `Team` type changes → `hunt-gameplay.md`
- New storage tier or DB table → `storage.md`
- New Gemini service method → `gemini-ai.md`
- New package or major refactor → `architecture.md`
