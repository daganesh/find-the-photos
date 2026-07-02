import sharp from 'sharp';
import { config, isGeminiConfigured } from '../config.js';
import { geminiClient, withModelFallback } from './imageMatch.js';
import type { InlineImage } from './imageMatch.js';

/** Resolved at startup from GEMINI_IMAGE_MODEL env var (default: gemini-2.5-flash-image). */
const CARTOON_MODEL = config.gemini.imageModel;
const CARTOON_MODEL_FALLBACK = config.gemini.imageModelFallback;
const INPUT_MAX_DIM = 512;
const OUTPUT_MAX_DIM = 128;

/** Each call picks one at random so retries produce a visibly different hero. */
const CARTOON_STYLES = [
  'bold comic-book superhero, halftone dots, primary colours, strong black outlines, dynamic cape',
  'cute chibi superhero, oversized head, big sparkly eyes, tiny stylized costume, pastel palette',
  'retro 1960s pop-art superhero, limited two-tone palette, thick lines, action-comic feel',
  'pixel-art 16-bit RPG superhero portrait, chunky pixels, vibrant palette, glowing aura',
  'vector sticker-style superhero, bright gradient fills, thick white stroke outline, bold mask',
  'claymation-style superhero figure, chunky rounded shapes, playful lighting',
  'neon cyberpunk superhero, glowing outlines, electric colours, futuristic visor',
  'saturday-morning-cartoon superhero, exaggerated proportions, thick outlines, bright primary costume',
];

function randomStyle(): string {
  return CARTOON_STYLES[Math.floor(Math.random() * CARTOON_STYLES.length)]!;
}

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
  private ai = geminiClient;

  async cartoonify(image: InlineImage): Promise<CartoonResult> {
    const smallBase64 = await shrinkToJpeg(image.base64, INPUT_MAX_DIM);

    // Step 1: face check using the fast text model (cheap — rejects bad photos early)
    const { result: faceResp } = await withModelFallback(
      config.gemini.model,
      config.gemini.modelFallback,
      (model) => this.ai.models.generateContent({
        model,
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
      }),
    );

    const faceResult = parseFaceCheck(faceResp.text ?? '');
    if (!faceResult.hasFace) {
      throw new FaceNotDetectedError(
        faceResult.reason ||
          'No clear face detected. Please use a close-up photo where your face takes up most of the image.',
      );
    }

    // Step 2: generate cartoon — style is random so each retry looks different
    const style = randomStyle();
    const { result: genResp } = await withModelFallback(
      CARTOON_MODEL,
      CARTOON_MODEL_FALLBACK,
      (model) => this.ai.models.generateContent({
        model,
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { data: smallBase64, mimeType: 'image/jpeg' } },
            {
              text: `Turn this person into a fun, exaggerated cartoon SUPERHERO avatar in this style: ${style}. This should NOT be a realistic or 1-to-1 likeness of the photo — stylize and exaggerate freely (bigger eyes, playful proportions, a fun superhero costume/mask/cape) while loosely keeping their hair colour and skin tone as a personal touch. Head-and-shoulders BUST portrait only, cropped at the chest/shoulders, facing forward, centered. Plain solid WHITE background — no scenery, no border, no frame, no text, no logos, no drop shadow.`,
            },
          ],
        }],
        config: { responseModalities: ['IMAGE', 'TEXT'] },
      }),
    );

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
