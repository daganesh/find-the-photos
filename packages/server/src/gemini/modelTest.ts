import type { GeminiModelTestResponse, GeminiModelTestResult } from '@ftp/shared';
import { config, isGeminiConfigured } from '../config.js';
import { geminiClient, isTransientGeminiError } from './imageMatch.js';

/** One lightweight probe per configured model — confirms the model ID resolves and the key can call it. */
async function probeModel(
  role: GeminiModelTestResult['role'],
  model: string,
  isImageModel: boolean,
): Promise<GeminiModelTestResult> {
  const started = Date.now();
  try {
    await geminiClient.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: 'Reply with the single word: OK' }] }],
      config: isImageModel ? { responseModalities: ['TEXT', 'IMAGE'] } : undefined,
    });
    return { role, model, ok: true, message: 'Reachable', ms: Date.now() - started };
  } catch (err) {
    const ms = Date.now() - started;
    if (isTransientGeminiError(err)) {
      return { role, model, ok: true, message: 'Reachable (currently under high demand)', ms };
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { role, model, ok: false, message, ms };
  }
}

/** Probe every configured Gemini model (primary + fallback, text + image) in parallel. */
export async function testGeminiModels(): Promise<GeminiModelTestResponse> {
  if (!isGeminiConfigured()) {
    return { configured: false, results: [] };
  }

  const jobs: Array<Promise<GeminiModelTestResult>> = [
    probeModel('text-primary', config.gemini.model, false),
    probeModel('image-primary', config.gemini.imageModel, true),
  ];
  if (config.gemini.modelFallback && config.gemini.modelFallback !== config.gemini.model) {
    jobs.push(probeModel('text-fallback', config.gemini.modelFallback, false));
  }
  if (config.gemini.imageModelFallback && config.gemini.imageModelFallback !== config.gemini.imageModel) {
    jobs.push(probeModel('image-fallback', config.gemini.imageModelFallback, true));
  }

  const results = await Promise.all(jobs);
  return { configured: true, results };
}
