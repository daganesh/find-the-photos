# Gemini AI Services

All AI calls live in `packages/server/src/gemini/`. Two implementations per interface: real (Gemini) and stub (no-key dev mode). The factory picks based on `isGeminiConfigured()`.

## ImageMatchService (`imageMatch.ts`)

```typescript
interface ImageMatchService {
  compare(candidate, references, itemName): Promise<MatchVerdict>
  verifyDispute(description, itemName): Promise<MatchVerdict>
  scoreTask(candidate, instruction): Promise<MatchVerdict>
}
```

### `compare` — photo item matching

- Sends reference photos + candidate photo to `gemini-2.0-flash`
- System prompt forbids revealing the item name in `reason`; item name is passed as an internal context hint separate from the prompt
- Returns `{ match: boolean, confidence: 0..1, reason: string }`
- `StubImageMatchService.compare()` always returns `match: false` so dev flow requires dispute

### `verifyDispute` — dispute verification

- Text-only call; compares player's free-text description to the item name
- Generous: synonyms, partial descriptions, other languages count
- `StubImageMatchService.verifyDispute()` always returns `match: true`

### `scoreTask` — task performance scoring

- Sends candidate photo + instruction text
- Returns `match: true` if `confidence ≥ 0.50` (i.e. score ≥ 50/100)
- `confidence` encodes the 0–100 score normalised to 0–1
- `StubImageMatchService.scoreTask()` returns `match: true, confidence: 0.75`

### JSON parsing

`parseVerdict(text)` handles stray prose and code fences. Falls back to `{ match: false, confidence: 0, reason: 'Could not read...' }` on parse failure.

## ModerationService (`moderationService.ts`)

```typescript
interface ModerationService {
  checkTexts(checks: { field, text }[]): Promise<ModerationIssue[]>
  checkImage(image: InlineImage): Promise<ModerationIssue[]>
}
```

### `checkTexts` — pre-publish gate

Called by `POST /api/routes/:id/moderate` before finalizing a route.  
Sends all route texts (title, description, item names, clues, task instructions) in one prompt.  
Returns array of `{ field, text, reason }` for flagged content.

### `checkImage` — upload-time check

Called in `POST /api/photos` before saving to storage.  
Returns 422 with the reason if the image is flagged.

`StubModerationService` returns empty arrays (no issues) so dev mode always passes.

## Configuration

```typescript
// packages/server/src/config.ts
gemini: {
  apiKey: process.env.GEMINI_API_KEY ?? '',
  model: process.env.GEMINI_MODEL ?? 'gemini-2.0-flash',
}
```

`isGeminiConfigured()` returns `config.gemini.apiKey !== ''`.
