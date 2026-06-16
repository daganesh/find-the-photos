# GitHub Copilot — Project Instructions

See `.agents/README.md` for the full knowledge base: architecture, dev environment, storage, gameplay model, Gemini AI services, API routes, and reusable skills.

## Monorepo structure

- `packages/shared` — TypeScript types + pure game logic (build this first)
- `packages/server` — Express.js API, port 4000
- `packages/web` — React 18 + Vite, port 5173

## Critical patterns

- Always build `@ftp/shared` before server or web: `npm run build --workspace @ftp/shared`
- Storage is dual: JSON files (dev) + PostgreSQL JSONB (prod) — both must stay in sync
- AI services always have a real (Gemini) and stub implementation — stubs run when `GEMINI_API_KEY` is absent
- Never leak the item answer/name in AI rejection reasons or UI error messages
- Never commit secrets or connection strings
