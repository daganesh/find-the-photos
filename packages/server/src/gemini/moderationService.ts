import { GoogleGenAI } from '@google/genai';
import type { ModerationIssue } from '@ftp/shared';
import type { InlineImage } from './imageMatch.js';
import { config, isGeminiConfigured } from '../config.js';

export interface ModerationService {
  checkTexts(checks: Array<{ field: string; text: string }>): Promise<ModerationIssue[]>;
  checkImage(image: InlineImage): Promise<ModerationIssue[]>;
}

class GeminiModerationService implements ModerationService {
  private ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });

  async checkTexts(checks: Array<{ field: string; text: string }>): Promise<ModerationIssue[]> {
    if (checks.length === 0) return [];
    const list = checks.map((c, i) => `[${i}] field="${c.field}": "${c.text}"`).join('\n');
    const prompt = `You are a content moderator for a family photo treasure-hunt app used by children and parents.\nReview these texts and flag anything inappropriate, offensive, sexual, violent, or unsuitable for families with young children.\nTexts to review:\n${list}\n\nReply with STRICT JSON only:\n{"issues": [{"field": "...", "text": "...", "reason": "short explanation"}]}\nReturn an empty issues array if all texts are appropriate.`;

    const response = await this.ai.models.generateContent({
      model: config.gemini.model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseMimeType: 'application/json' },
    });

    return parseIssues(response.text ?? '', checks);
  }

  async checkImage(image: InlineImage): Promise<ModerationIssue[]> {
    const prompt = `You are a content moderator for a family photo treasure-hunt app used by children and parents. Look at this image and determine if it contains anything inappropriate, offensive, sexual, violent, or unsuitable for families with young children.\n\nReply with STRICT JSON only:\n{"flagged": boolean, "reason": "short explanation or empty string if clean"}`;

    const response = await this.ai.models.generateContent({
      model: config.gemini.model,
      contents: [{ role: 'user', parts: [
        { text: prompt },
        { inlineData: { data: image.base64, mimeType: image.mimeType } },
      ] }],
      config: { responseMimeType: 'application/json' },
    });

    try {
      const text = response.text ?? '';
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) return [];
      const raw = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as { flagged?: boolean; reason?: string };
      if (raw.flagged && raw.reason) {
        return [{ field: 'image', text: '(uploaded image)', reason: raw.reason }];
      }
    } catch { /* ignore parse errors */ }
    return [];
  }
}

function parseIssues(text: string, _checks: Array<{ field: string; text: string }>): ModerationIssue[] {
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1) return [];
  try {
    const raw = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as { issues?: unknown[] };
    if (!Array.isArray(raw.issues)) return [];
    return raw.issues.filter(
      (i): i is ModerationIssue =>
        typeof i === 'object' && i !== null &&
        typeof (i as ModerationIssue).field === 'string' &&
        typeof (i as ModerationIssue).reason === 'string',
    ).map((i) => ({ field: i.field, text: i.text ?? '', reason: i.reason }));
  } catch {
    return [];
  }
}

class StubModerationService implements ModerationService {
  async checkTexts() { return []; }
  async checkImage() { return []; }
}

export function createModerationService(): ModerationService {
  return isGeminiConfigured() ? new GeminiModerationService() : new StubModerationService();
}
