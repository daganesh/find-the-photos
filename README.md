# 📸 Find the Photos — Family Treasure Hunt

A happy, friendly, photo-based treasure hunt game for the whole family (ages 6–100).

One group (the **hiders**) walks a neighborhood route, photographs everyday
objects from a few angles, and adds clues. Another group (the **hunters**)
follows the clues, finds each object, snaps a photo, and the app uses AI to
check whether they found the right thing.

> Web first. The game logic is kept separate from the UI so a mobile version
> can reuse it later.

## Project layout

This is an npm-workspaces monorepo:

| Package           | What it is                                                            |
| ----------------- | -------------------------------------------------------------------- |
| `packages/shared` | Pure TypeScript domain models + game logic. No UI, no server. Reused everywhere. |
| `packages/server` | Node + Express API: auth, storage, photo handling, Gemini image match. |
| `packages/web`    | React + Vite web app. UI components + thin adapters over the API.     |

The separation is deliberate: **UI ↔ logic ↔ infrastructure** are decoupled so
each can be tested, reused, and later swapped (e.g. a React Native client that
imports `packages/shared` unchanged).

## Quick start

```bash
npm install                 # install all workspaces
cp .env.example .env        # add your Google keys (see below)
npm run dev                 # runs server + web together
```

Open http://localhost:5173.

## Required keys (all from Google Cloud Console)

| Variable               | Used by | Purpose                                    |
| ---------------------- | ------- | ------------------------------------------ |
| `GOOGLE_CLIENT_ID`     | both    | Google Sign-In (required to create/play).  |
| `GEMINI_API_KEY`       | server  | Gemini image comparison.                   |
| `GOOGLE_MAPS_API_KEY`  | web     | Google Maps display + directions.          |

See [`docs/DESIGN.md`](docs/DESIGN.md) for the full system design.
