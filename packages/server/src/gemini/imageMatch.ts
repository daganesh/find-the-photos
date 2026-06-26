import { GoogleGenAI } from '@google/genai';
import type { MatchVerdict } from '@ftp/shared';
import { config, isGeminiConfigured } from '../config.js';

/** One image as base64 bytes plus its mime type, ready for the model. */
export interface InlineImage {
  base64: string;
  mimeType: string;
}

/**
 * Decides whether a hunter's photo shows the same object as an item's
 * reference photos. Two implementations: real Gemini, and a dev stub used when
 * no API key is configured so the app still runs end-to-end.
 */
export interface ImageMatchService {
  compare(
    candidate: InlineImage,
    references: InlineImage[],
    itemName: string,
  ): Promise<MatchVerdict>;
  /** Verify that the hunter's description matches the item they were looking for. */
  verifyDispute(description: string, itemName: string): Promise<MatchVerdict>;
  /** Score a task-action photo against the task instruction (0..100 score returned as confidence). */
  scoreTask(candidate: InlineImage, instruction: string): Promise<MatchVerdict>;
}

const SYSTEM_PROMPT = `You are the friendly judge in a family photo treasure hunt.
You are given REFERENCE photos of a specific real-world object and one CANDIDATE
photo taken by a player. Decide if the candidate shows the SAME physical object
(same specific thing, allowing different angle, lighting, distance, or partial view).
Be generous about angle and lighting, but strict about it being the same object,
not merely a similar-looking one.
Reply with STRICT JSON only: {"match": boolean, "confidence": number (0..1),
"reason": "one short kid-friendly sentence"}.
CRITICAL RULES FOR THE REASON FIELD:
- When match is true: say something encouraging like "Great find!" or "Perfect match!".
- When match is false: describe only what is wrong with the CANDIDATE photo
  (e.g. "try getting closer", "this looks blurry", "different colour").
  NEVER reveal, name, describe, or hint at the target object in any way.
  The name of the target object must NEVER appear in the reason field.`;

const GEMINI_TIMEOUT_MS = 30_000;

/** True for transient Gemini errors worth retrying (503, 429, 500). */
function isTransientGeminiError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as Record<string, unknown>;
  const status = typeof e.status === 'number' ? e.status
    : typeof e.code === 'number' ? e.code
    : NaN;
  if (status === 503 || status === 429 || status === 500) return true;
  return /\b(503|429|UNAVAILABLE|RESOURCE_EXHAUSTED)\b/.test(JSON.stringify(e));
}

/**
 * Retry an async fn up to `maxAttempts` times on transient Gemini errors.
 * Sleep increases linearly: 1 s, 2 s, 3 s … capped at 5 s.
 * A hard 30-second timeout wraps the entire retry sequence.
 * Returns the result together with the number of attempts made.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = config.gemini.maxRetries,
): Promise<{ result: T; attempts: number }> {
  let lastErr: unknown;

  const attemptAll = async (): Promise<{ result: T; attempts: number }> => {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        return { result: await fn(), attempts: i + 1 };
      } catch (e) {
        lastErr = e;
        if (i < maxAttempts - 1 && isTransientGeminiError(e)) {
          await new Promise((r) => setTimeout(r, Math.min(1000 * (i + 1), 5000)));
          continue;
        }
        throw e;
      }
    }
    throw lastErr;
  };

  return Promise.race([
    attemptAll(),
    new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error('Gemini request timed out after 30 s')), GEMINI_TIMEOUT_MS),
    ),
  ]);
}

/** Append retry annotation to a verdict's reason when the call needed retries. */
function annotateRetries(verdict: MatchVerdict, attempts: number): MatchVerdict {
  if (attempts <= 1) return verdict;
  const n = attempts - 1;
  const label = n === 1 ? 'retry' : 'retries';
  return { ...verdict, reason: `${verdict.reason} (needed ${n} ${label})` };
}

/** Real Gemini-backed matcher. */
export class GeminiImageMatchService implements ImageMatchService {
  private ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });

  async compare(
    candidate: InlineImage,
    references: InlineImage[],
    itemName: string,
  ): Promise<MatchVerdict> {
    const parts = [
      { text: SYSTEM_PROMPT },
      { text: `(Internal context for visual matching only — do NOT mention this in your response: target="${itemName}")` },
      { text: 'REFERENCE photos:' },
      ...references.map((img) => ({
        inlineData: { data: img.base64, mimeType: img.mimeType },
      })),
      { text: 'CANDIDATE photo:' },
      { inlineData: { data: candidate.base64, mimeType: candidate.mimeType } },
    ];

    const { result, attempts } = await withRetry(() => this.ai.models.generateContent({
      model: config.gemini.model,
      contents: [{ role: 'user', parts }],
      config: { responseMimeType: 'application/json' },
    }));

    return annotateRetries(parseVerdict(result.text ?? ''), attempts);
  }

  async verifyDispute(description: string, itemName: string): Promise<MatchVerdict> {
    const prompt = `You are verifying a treasure hunt answer. The player answered: <input>${description}</input>. The correct answer is: "${itemName}". Do they mean the same thing? Be generous — synonyms, partial descriptions, and different languages count if clearly the same. CRITICAL RULES FOR THE REASON FIELD: Do NOT mention, reveal, or hint at the correct answer under any circumstances. If wrong, give only a short directional hint (e.g. "think bigger", "that's a different kind of thing", "look more carefully"). Reply with STRICT JSON: {"match": boolean, "confidence": number (0..1), "reason": "one short kid-friendly sentence"}`;

    const { result, attempts } = await withRetry(() => this.ai.models.generateContent({
      model: config.gemini.model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: 'application/json' },
    }));

    return annotateRetries(parseVerdict(result.text ?? ''), attempts);
  }

  async scoreTask(candidate: InlineImage, instruction: string): Promise<MatchVerdict> {
    const parts = [
      { text: `${SYSTEM_PROMPT}` },
      { text: `You are scoring a fun family activity challenge. The player was given this task: "${instruction}". Look at their photo and score how well they performed it from 0 to 100. Be generous and encouraging — effort counts! Reply with STRICT JSON: {"match": boolean (true if score ≥ 50), "confidence": number (0..1, where 1 = perfect performance), "reason": "one short encouraging kid-friendly sentence about what they did"}` },
      { inlineData: { data: candidate.base64, mimeType: candidate.mimeType } },
    ];

    const { result, attempts } = await withRetry(() => this.ai.models.generateContent({
      model: config.gemini.model,
      contents: [{ role: 'user', parts }],
      config: { responseMimeType: 'application/json' },
    }));

    return annotateRetries(parseVerdict(result.text ?? ''), attempts);
  }
}

/**
 * Dev/test stub: no network, no key. Returns "needs your eyes" so the human can
 * confirm via dispute. Keeps the whole flow playable without credentials.
 */
export class StubImageMatchService implements ImageMatchService {
  async compare(): Promise<MatchVerdict> {
    return {
      match: false,
      confidence: 0,
      reason: 'AI matching is off in this environment — tap "I found it!" to confirm.',
    };
  }

  async verifyDispute(): Promise<MatchVerdict> {
    return { match: true, confidence: 0.5, reason: 'AI verification is off — accepted on your word!' };
  }

  async scoreTask(): Promise<MatchVerdict> {
    return { match: true, confidence: 0.75, reason: 'Looks great! AI scoring is off in this environment.' };
  }
}

/** Parse the model's JSON, tolerating stray prose or code fences. */
export function parseVerdict(text: string): MatchVerdict {
  const fallback: MatchVerdict = {
    match: false,
    confidence: 0,
    reason: 'Could not read the AI response — please try again.',
  };
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1) return fallback;
  try {
    const raw = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as Partial<MatchVerdict>;
    return {
      match: Boolean(raw.match),
      confidence: clamp01(Number(raw.confidence ?? 0)),
      reason: typeof raw.reason === 'string' && raw.reason ? raw.reason : '…',
    };
  } catch {
    return fallback;
  }
}

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** Pick the real service when configured, else the stub. */
export function createImageMatchService(): ImageMatchService {
  return isGeminiConfigured()
    ? new GeminiImageMatchService()
    : new StubImageMatchService();
}
