import type { ModerationIssue } from '@ftp/shared';
import type { InlineImage } from './imageMatch.js';
import { geminiClient, withModelFallback } from './imageMatch.js';
import { config, isGeminiConfigured } from '../config.js';

export interface ModerationService {
  checkTexts(checks: Array<{ field: string; text: string }>): Promise<ModerationIssue[]>;
  checkImage(image: InlineImage): Promise<ModerationIssue[]>;
}

class GeminiModerationService implements ModerationService {
  private ai = geminiClient;

  async checkTexts(checks: Array<{ field: string; text: string }>): Promise<ModerationIssue[]> {
    if (checks.length === 0) return [];
    const list = checks.map((c, i) => `[${i}] field="${c.field}": "${c.text}"`).join('\n');
    const prompt = `You are a content moderator for a family photo treasure-hunt app used by children and parents.\nReview these texts and flag anything inappropriate, offensive, sexual, violent, or unsuitable for families with young children.\nTexts to review:\n${list}\n\nReply with STRICT JSON only:\n{"issues": [{"field": "...", "text": "...", "reason": "short explanation", "severity": "blocked|flagged"}]}\nClassify each issue severity: use "blocked" for violence, sexual content, illegal activity, or abuse; use "flagged" for adult themes, political topics, debatable subjects, or content that is not-for-kids but not harmful.\nReturn an empty issues array if all texts are appropriate.`;

    const { result } = await withModelFallback(
      config.gemini.model,
      config.gemini.modelFallback,
      (model) => this.ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json' },
      }),
    );

    return parseIssues(result.text ?? '', checks);
  }

  async checkImage(image: InlineImage): Promise<ModerationIssue[]> {
    const prompt = `You are a content moderator for a family photo treasure-hunt app used by children and parents. Look at this image and determine if it contains anything inappropriate, offensive, sexual, violent, or unsuitable for families with young children.\n\nReply with STRICT JSON only:\n{"flagged": boolean, "severity": "blocked|flagged", "reason": "short explanation or empty string if clean"}\nUse severity "blocked" for violence, sexual content, illegal activity, or abuse. Use severity "flagged" for adult themes, political topics, debatable subjects, or content that is not-for-kids but not harmful.`;

    const { result } = await withModelFallback(
      config.gemini.model,
      config.gemini.modelFallback,
      (model) => this.ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [
          { text: prompt },
          { inlineData: { data: image.base64, mimeType: image.mimeType } },
        ] }],
        config: { responseMimeType: 'application/json' },
      }),
    );

    try {
      const text = result.text ?? '';
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) return [];
      const raw = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as { flagged?: boolean; severity?: string; reason?: string };
      if (raw.flagged && raw.reason) {
        const severity: 'blocked' | 'flagged' = raw.severity === 'blocked' ? 'blocked' : 'flagged';
        return [{ field: 'image', text: '(uploaded image)', reason: raw.reason, severity }];
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
    ).map((i) => {
      const issue = i as { field: string; text?: string; reason: string; severity?: string };
      const severity: 'blocked' | 'flagged' = issue.severity === 'blocked' ? 'blocked' : 'flagged';
      return { field: issue.field, text: issue.text ?? '', reason: issue.reason, severity };
    });
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
