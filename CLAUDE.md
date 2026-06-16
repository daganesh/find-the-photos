# Claude Code — Project Guide

See `.agents/README.md` for the full knowledge base: architecture, dev environment, storage, gameplay model, Gemini AI services, API routes, and reusable skills.

## Quick-start

```bash
npm install
npm run dev          # API :4000, Web :5173
npm run typecheck    # all workspaces
npm test             # vitest
```

## Key constraint

Never commit `DATABASE_URL` or any other secret. Railway injects all credentials as environment variables at runtime.
