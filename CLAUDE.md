# Claude Code — Project Guide

See `.agents/README.md` for the full knowledge base: architecture, dev environment, storage, gameplay model, Gemini AI services, API routes, and reusable skills.

## Quick-start

```bash
npm install
npm run dev          # API :4000, Web :5173
npm run typecheck    # all workspaces
npm test             # vitest
```

## Key constraints

- Never commit `DATABASE_URL` or any other secret to server config or code. Railway injects all production credentials as environment variables at runtime.
- Exception: `.claude/settings.json` may contain the Railway TCP proxy URL for MCP database access. This is intentional — it is a dev tooling credential for Claude sessions, scoped to this private repo.
