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

    const response = await this.ai.models.generateContent({
      model: config.gemini.model,
      contents: [{ role: 'user', parts }],
      config: { responseMimeType: 'application/json' },
    });

    return parseVerdict(response.text ?? '');
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
