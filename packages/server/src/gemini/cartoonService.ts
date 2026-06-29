import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';
import { config, isGeminiConfigured } from '../config.js';
import type { InlineImage } from './imageMatch.js';

/** Model that can output images — separate from the analysis model in config. */
const CARTOON_MODEL = 'gemini-2.0-flash-preview-image-generation';
const INPUT_MAX_DIM = 512;
const OUTPUT_MAX_DIM = 400;

/** Thrown when the photo doesn't contain a sufficiently prominent face. */
export class FaceNotDetectedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'FaceNotDetectedError';
  }
}

export interface CartoonResult {
  imageBase64: string;
  mimeType: string;
}

export interface CartoonService {
  cartoonify(image: InlineImage): Promise<CartoonResult>;
}

async function shrinkToJpeg(base64: string, maxDim: number): Promise<string> {
  const buf = Buffer.from(base64, 'base64');
  const out = await sharp(buf)
    .resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
  return out.toString('base64');
}

function parseFaceCheck(text: string): { hasFace: boolean; reason: string } {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) return { hasFace: true, reason: '' };
    const obj = JSON.parse(text.slice(start, end + 1)) as { hasFace?: unknown; reason?: unknown };
    return {
      hasFace: Boolean(obj.hasFace),
      reason: typeof obj.reason === 'string' ? obj.reason : '',
    };
  } catch {
    return { hasFace: true, reason: '' };
  }
}

export class GeminiCartoonService implements CartoonService {
  private ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });

  async cartoonify(image: InlineImage): Promise<CartoonResult> {
    const smallBase64 = await shrinkToJpeg(image.base64, INPUT_MAX_DIM);

    // Step 1: face check using the fast text model (cheap — rejects bad photos early)
    const faceResp = await this.ai.models.generateContent({
      model: config.gemini.model,
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { data: smallBase64, mimeType: 'image/jpeg' } },
          {
            text: 'Does this image contain at least one clearly visible human face that occupies at least 25% of the image frame? Reply with STRICT JSON only, no prose: {"hasFace": boolean, "reason": "one short sentence"}',
          },
        ],
      }],
      config: { responseMimeType: 'application/json' },
    });

    const faceResult = parseFaceCheck(faceResp.text ?? '');
    if (!faceResult.hasFace) {
      throw new FaceNotDetectedError(
        faceResult.reason ||
          'No clear face detected. Please use a close-up photo where your face takes up most of the image.',
      );
    }

    // Step 2: generate cartoon
    const genResp = await this.ai.models.generateContent({
      model: CARTOON_MODEL,
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { data: smallBase64, mimeType: 'image/jpeg' } },
          {
            text: 'Transform this photo into a bright, fun cartoon avatar. Keep the person recognisable — same hair colour, skin tone, and face shape — but render them in a clean flat-colour cartoon style suitable for a family game app. Square crop, friendly expression, no background clutter.',
          },
        ],
      }],
      config: { responseModalities: ['IMAGE', 'TEXT'] },
    });

    const parts = genResp.candidates?.[0]?.content?.parts ?? [];
    const imgPart = parts.find((p) => p.inlineData?.data);
    if (!imgPart?.inlineData?.data) {
      const textPart = parts.find((p) => p.text);
      throw new Error(textPart?.text?.trim() ?? 'Cartoon generation produced no image.');
    }

    // Step 3: downsample output before returning
    const outBase64 = await shrinkToJpeg(imgPart.inlineData.data, OUTPUT_MAX_DIM);
    return { imageBase64: outBase64, mimeType: 'image/jpeg' };
  }
}

/** Dev stub — echoes the input image so the UI flow is exercisable without a key. */
export class StubCartoonService implements CartoonService {
  async cartoonify(image: InlineImage): Promise<CartoonResult> {
    const outBase64 = await shrinkToJpeg(image.base64, OUTPUT_MAX_DIM);
    return { imageBase64: outBase64, mimeType: 'image/jpeg' };
  }
}

export function createCartoonService(): CartoonService {
  return isGeminiConfigured() ? new GeminiCartoonService() : new StubCartoonService();
}
