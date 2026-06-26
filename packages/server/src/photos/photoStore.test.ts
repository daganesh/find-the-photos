import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { resizeIfNeeded } from './photoStore.js';

async function makeJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 100, g: 150, b: 200 } },
  })
    .jpeg()
    .toBuffer();
}

describe('resizeIfNeeded', () => {
  it('throws when buffer is not a valid image (e.g. random bytes with image/jpeg mime)', async () => {
    const buf = Buffer.from('this is definitely not an image');
    await expect(resizeIfNeeded(buf, 'image/jpeg')).rejects.toThrow('File is not a valid image');
  });

  it('throws when buffer is an SVG claiming to be image/jpeg', async () => {
    const svg = Buffer.from(
      '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>',
    );
    await expect(resizeIfNeeded(svg, 'image/jpeg')).rejects.toThrow('File is not a valid image');
  });

  it('passes through audio buffers without validation (mimeType starts with audio/)', async () => {
    const buf = Buffer.from('fake audio data');
    const result = await resizeIfNeeded(buf, 'audio/webm');
    expect(result.buffer).toBe(buf);
    expect(result.mimeType).toBe('audio/webm');
  });

  it('downsizes an image wider than 1440px', async () => {
    const bigImg = await makeJpeg(2000, 100);
    const result = await resizeIfNeeded(bigImg, 'image/jpeg');
    const meta = await sharp(result.buffer).metadata();
    expect(meta.width).toBeLessThanOrEqual(1440);
    expect(result.mimeType).toBe('image/jpeg');
  });

  it('passes through an image smaller than 1440px unchanged (no re-encode)', async () => {
    const smallImg = await makeJpeg(100, 100);
    const result = await resizeIfNeeded(smallImg, 'image/jpeg');
    expect(result.buffer).toBe(smallImg);
    expect(result.mimeType).toBe('image/jpeg');
  });
});
