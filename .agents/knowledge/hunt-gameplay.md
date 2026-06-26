# Hunt Gameplay Model

## Core types (`packages/shared/src/models/`)

```
Route                            the authored game
  id, title, description
  items: Item[]                  ordered list of things to find
  status: 'draft' | 'ready'
  visibility?: 'public' | 'private'   defaults to 'public'; 'private' hides from browse list (owner still sees it; direct link still works)
  ratings: Rating[]
  finalItem?: FinalItem          optional bonus challenge (see below)

Item
  kind: 'photo' | 'task'         photo = match reference photos; task = perform an action
  name                           the answer / display label
  taskInstruction?               for task items: shown to player
  hint: Hint                     primary clue (text or audio)
  extraHints?: Hint[]            additional clue levels
  photos: Photo[]                reference photos (empty for task items)
  location?: GeoPoint            GPS for map help
  difficult: boolean             flagged when players struggle (auto-set)

HuntSession                      one play-through (solo or team)
  routeId, hunterId, teamId?
  teamSize: number               1 = sequential solo; N = N items active in parallel
  steps: StepProgress[]
  startLocation?: GeoPoint       captured when hunt began
  totalScore: number

StepProgress                     one item in a session
  itemId, status: 'locked'|'active'|'found'|'skipped'
  photoAttempts: PhotoAttempt[]
  helpLevel: HelpLevel (0–4)     0=none, 1=map dot, 2=route line, 3=description, 4=surroundings
  cluesUsed: number              drives score penalty
  disputed: boolean              player overrode AI verdict
  foundBy?: string               userId (team play)

Team
  joinCode: string               6-char shareable code
  members: TeamMember[]          userId, name, avatarEmoji
  status: 'lobby'|'playing'|'paused'|'finished'
  sessionId?: string             the shared HuntSession
```

## Gameplay flow

1. Hider creates a `Route` (draft), adds `Item[]`, publishes (`finalize` → `'ready'`)
2. Hunter starts: `POST /api/hunt/start` → `HuntSession` with first item(s) active
3. Hunter submits photo → AI judges → verdict stored in `PhotoAttempt`
4. On match (or successful dispute): step → `'found'`; next locked step unlocks
5. Scoring: `scoreStep()` in `packages/shared/src/logic/scoring.ts`
6. Session done when all steps are `'found'` or `'skipped'`

## Scoring rules (`packages/shared/src/logic/scoring.ts`)

- Base score per item: 100 pts
- Each clue used: -10 pts
- Skip: 0 pts
- Dispute (override AI): score capped at 50 pts
- `scoreSession(session)` sums all steps

## Team play specifics

- `teamSize = N` → up to N items active simultaneously
- `advance()` in `huntService.ts` refills active slots after any step completes
- `foundBy` on `StepProgress` tracks which member found it
- MVP = member with most items found (`computeTeamResult` in shared)
- Pause/resume affects all members via `Team.status`

## Item kinds

| Kind | Photo needed | AI method | Can dispute |
|------|-------------|-----------|-------------|
| `photo` | Yes (reference photos) | `compare()` — match vs references | Yes, with description |
| `task` | No references | `scoreTask()` — score performance 0–100 | No |

Dispute verification: `verifyDispute(description, itemName)` — player must name the item correctly before override is accepted.

## FinalItem (code kind only)

The final item only supports `kind: 'code'`. Riddle and jigsaw kinds are no longer available in the RouteBuilder.

`FinalItem` with `kind: 'code'` has these key fields:

| Field | Role |
|-------|------|
| `answer` | The code players enter (letters/digits collected from solved items, verified server-side) |
| `revealAnswer?` | Prize text revealed inside the open chest after the correct code is entered |
| `prizeImageUrl?` | Prize image URL revealed inside the open chest. Takes precedence over `revealAnswer` when set |

The `answer` is the key to the lock. `revealAnswer` or `prizeImageUrl` (mutually exclusive, image wins) is the prize inside the chest. The route author configures these in the `RouteBuilder` under the "Final item" section.

### Chest UX flow (player side)
1. **Locked chest** — shown on the final-challenge screen. Tapping opens the code-entry form.
2. **Code entry** — `CodeAssemblyDisplay` shows collected characters; player fills blanks and submits.
3. **Open chest** — on correct code, `FinalItemPanel` renders the open chest image with the prize (text or image) overlaid inside. A "Continue to results" button calls `onPrizeContinue`.
4. **Celebration** — `HuntPlayer`/`TeamHuntPlayer` transitions to the results/fireworks screen.
