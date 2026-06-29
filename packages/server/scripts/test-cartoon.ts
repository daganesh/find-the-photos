/**
 * Isolated test: send a photo to gemini-2.0-flash-preview-image-generation
 * and get a cartoon avatar back.
 *
 * Usage:
 *   GEMINI_API_KEY=your-key npx tsx packages/server/scripts/test-cartoon.ts <input.jpg> [output.png]
 *
 * Output defaults to cartoon-output.png in the same directory as the input file.
 */

import { GoogleGenAI } from '@google/genai';
import fs from 'node:fs';
import path from 'node:path';

const IMAGE_GEN_MODEL = 'gemini-2.0-flash-preview-image-generation';

async function cartoonify(inputPath: string, outputPath: string): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('ERROR: GEMINI_API_KEY is not set.');
    process.exit(1);
  }

  if (!fs.existsSync(inputPath)) {
    console.error(`ERROR: input file not found: ${inputPath}`);
    process.exit(1);
  }

  const ext = path.extname(inputPath).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png'
    : ext === '.webp' ? 'image/webp'
    : 'image/jpeg';

  console.log(`Reading ${inputPath} (${mimeType})…`);
  const base64 = fs.readFileSync(inputPath).toString('base64');

  const ai = new GoogleGenAI({ apiKey });

  console.log(`Sending to ${IMAGE_GEN_MODEL}…`);
  const response = await ai.models.generateContent({
    model: IMAGE_GEN_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { data: base64, mimeType } },
          {
            text:
              'Transform this photo into a bright, fun cartoon avatar. ' +
              'Keep the person recognisable — same hair colour, skin tone, and face shape — ' +
              'but render them in a clean flat-colour cartoon style suitable for a family game app. ' +
              'Square crop, friendly expression, no background clutter.',
          },
        ],
      },
    ],
    config: {
      responseModalities: ['IMAGE', 'TEXT'],
    },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);

  if (!imagePart?.inlineData?.data) {
    console.error('No image returned. Text response:');
    const textPart = parts.find((p) => p.text);
    console.error(textPart?.text ?? '(no text either)');
    process.exit(1);
  }

  const outMime = imagePart.inlineData.mimeType ?? 'image/png';
  const outExt = outMime.includes('png') ? '.png' : outMime.includes('webp') ? '.webp' : '.jpg';
  const finalOutput = outputPath.endsWith('.png') || outputPath.endsWith('.jpg') || outputPath.endsWith('.webp')
    ? outputPath
    : outputPath.replace(/\.[^.]+$/, outExt);

  fs.writeFileSync(finalOutput, Buffer.from(imagePart.inlineData.data, 'base64'));
  console.log(`Done. Cartoon saved to: ${finalOutput}`);

  const textPart = parts.find((p) => p.text);
  if (textPart?.text) {
    console.log('Model note:', textPart.text.trim());
  }
}

const [, , input, output] = process.argv;
if (!input) {
  console.error('Usage: tsx test-cartoon.ts <input.jpg> [output.png]');
  process.exit(1);
}

const resolvedInput = path.resolve(input);
const resolvedOutput = output
  ? path.resolve(output)
  : path.join(path.dirname(resolvedInput), 'cartoon-output.png');

cartoonify(resolvedInput, resolvedOutput).catch((err) => {
  console.error('Failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
