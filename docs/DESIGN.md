# System Design — Find the Photos

A photo-based treasure hunt for families. This document is the source of truth
for *why* the system is shaped the way it is. It favors a simple, friendly
product and a clean separation of concerns so we can grow into mobile later.

---

## 1. Product summary

Two roles, one game object (a **Route**):

### Hiders (route authors)
1. Sign in with Google.
2. Start a new route; walk the neighborhood with GPS on.
3. For each interesting object, capture an **Item**:
   - several **photos** from different angles,
   - a **name**,
   - a **hint** (text *or* a short audio clip),
   - an optional longer **description**,
   - the **GPS location** (auto-filled, editable).
4. Reorder items into a route, then **finalize** → status `ready`.
5. Share the route via link.

### Hunters (players)
1. Open a route from the list or a shared link (Google sign-in to play).
2. For the current step, read/listen to the **hint**.
3. Walk to the guessed location and look for the object.
4. Take a photo and attach it to the step.
5. The app asks Gemini: *is this the same object?*
   - **Yes** → score the step, advance to the next clue.
   - **No** → allow more tries and escalate **help**:
     - far from target → show the dot / route on the map,
     - near the target → reveal description / surroundings text,
     - still stuck → allow **skip** (route marked internally as *difficult*).
6. If the hunter believes the AI was wrong, they can **dispute** the result and
   override to "found".
7. Per-item time and total time are tracked. Each step is scored by how few
   clues were needed.
8. At the end, the hunter can **rate** the route.

### Accessibility / UX north star
Friendly, colorful, very simple. Big tap targets, minimal text, works for a
7-year-old and a grandparent. Reading required; everything else is photos,
audio, and maps.

---

## 2. Architecture overview

```
┌─────────────────────────────────────────────────────────────┐
│                     packages/web (React)                     │
│  Presentational components  ·  screens  ·  hooks/adapters    │
│        (knows nothing about Gemini or storage details)       │
└───────────────▲───────────────────────────┬─────────────────┘
                │ imports types + game logic │ HTTP (JSON + multipart)
                │                            ▼
┌───────────────┴──────────┐   ┌──────────────────────────────┐
│   packages/shared (TS)   │   │     packages/server (Node)    │
│  domain models           │◄──│  REST API                     │
│  pure game logic:        │   │  - Google token verification  │
│   - geo distance         │   │  - Route repository (storage) │
│   - scoring              │   │  - Photo storage              │
│   - difficulty           │   │  - Gemini image-match service │
│   - hunt state machine   │   │  imports shared for logic     │
└──────────────────────────┘   └──────────────────────────────┘
```

**Key rule:** game rules live in `packages/shared` as pure functions. The
server and the web app both import them. A future React Native app imports the
same package. UI components never embed business rules; they call shared logic
or the API.

---

## 3. Package responsibilities

### `packages/shared`
Pure, dependency-free TypeScript. No DOM, no Node APIs.
- **Models**: `Route`, `Item`, `Photo`, `Hint`, `GeoPoint`, `HuntSession`,
  `StepProgress`, `User`, `Rating`, enums for status/help-level.
- **Logic** (all pure, unit-tested):
  - `geo.ts` — haversine distance, proximity bucket (`near | mid | far`).
  - `scoring.ts` — per-step score from clues used; route totals.
  - `difficulty.ts` — mark an item/route *difficult* from skip + clue signals.
  - `huntMachine.ts` — the hunter's step state machine and help escalation.
- **Contracts**: request/response DTO types shared with the server, so the
  client and server can't drift.

### `packages/server`
- **`config`** — env loading + validation (fail fast on missing keys).
- **`auth`** — verify Google ID tokens; issue a lightweight session token.
- **`storage`** — `RouteRepository` interface + a JSON-file implementation
  (`JsonRouteRepository`). Swappable for SQL/Firestore later.
- **`photos`** — store uploaded images (local disk default), return URLs.
- **`gemini`** — `ImageMatchService`: given a candidate photo + an item's
  reference photos, ask Gemini "same object?" → `{ match, confidence, reason }`.
- **`api`** — Express routers: `/auth`, `/routes`, `/photos`, `/hunt`.

### `packages/web`
- **`ui/`** — reusable presentational components (Button, Card, PhotoGallery,
  HintPlayer, MapView, Timer, ScorePill…). No business logic.
- **`screens/`** — composed flows (Home, RouteBuilder, ItemEditor, HuntPlayer,
  RouteSummary).
- **`services/`** — thin API client + Google sign-in + geolocation + Maps
  loader. The only place that talks to the outside world.
- **`hooks/`** — bind shared logic + services to React state.

---

## 4. Data model (shared)

```ts
GeoPoint   { lat, lng, accuracyM? }
Hint       { kind: 'text' | 'audio', text?, audioUrl? }
Photo      { id, url, angleLabel? }
Item       { id, name, description?, hint, photos[], location?, difficult }
Route      { id, title, description?, authorId, items[], status, createdAt,
             ratings[], avgRating? }
RouteStatus = 'draft' | 'ready'

StepProgress { itemId, status, photoAttempts[], cluesUsed, helpLevel,
               startedAt, finishedAt?, disputed }
StepStatus   = 'locked' | 'active' | 'found' | 'skipped'
HuntSession  { id, routeId, hunterId, steps[], startedAt, finishedAt?,
               totalScore }
HelpLevel    = 0 none · 1 map-dot · 2 route-line · 3 describe · 4 surroundings
```

GPS is optional per the spec: if the device has no location or the user
disables it, the app degrades gracefully (no map help, hints + photos only).

---

## 5. Core flows

### Image matching (the heart of the game)
1. Hunter submits a candidate photo for the active item.
2. Server calls `ImageMatchService.compare(candidate, item.photos)`.
3. Gemini returns `{ match: boolean, confidence: 0..1, reason: string }`.
4. Server records the attempt and returns the verdict + updated step.
5. On `match=false`, the client escalates help based on GPS proximity and the
   number of attempts (see `huntMachine.ts`).
6. The hunter may **dispute**: this overrides to `found`, flags the attempt,
   and (later) feeds back into tuning.

### Help escalation (pure logic, `huntMachine.ts`)
```
attempt fails →
  if GPS available and distance == far  → show map dot / route line
  else                                  → reveal description / surroundings
  each escalation raises helpLevel and lowers the achievable step score
skip allowed after N tries → step 'skipped', item flagged 'difficult'
```

### Scoring (pure logic, `scoring.ts`)
- Base points per item, minus a penalty per clue/help level used.
- Found-first-try = max; skipped = 0.
- Route total = sum of step scores; total time tracked separately.

---

## 6. Security & privacy
- `GEMINI_API_KEY` lives only on the server; the browser never sees it.
- Google ID tokens are verified server-side against `GOOGLE_CLIENT_ID`.
- Family-scale app: photos and routes stored simply (local disk + JSON) with a
  clear repository seam to move to managed storage when needed.

---

## 7. Build order (incremental, commit-often)
1. ✅ Monorepo scaffold + this design.
2. Shared models + pure logic (+ unit tests).
3. Server: config, storage, routes API.
4. Server: auth + photos + Gemini match.
5. Web: design system + sign-in + home.
6. Web: route builder (hider flow).
7. Web: hunt player (hunter flow) + map + scoring.
8. Ratings, dispute, difficulty, polish.

Each step is a small, working, committed slice.

---

## 8. Deliberate non-goals (for now)
- Native mobile app (the shared package makes this cheap later).
- Real-time multiplayer / leaderboards across families.
- A managed database (the repository seam keeps this a config change).
