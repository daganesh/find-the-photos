/**
 * Extracts the source images for the bottom-bar icons from the app's photo
 * store, removes their background (by trimming whitespace with sharp), crops
 * to the drawing, and writes the results as PNG files into
 * packages/web/public/.
 *
 * Usage (after `npm install`):
 *   node scripts/extract-bottom-bar-icons.mjs
 *
 * Reads DATABASE_URL from the environment (or .env in the repo root).
 * The two source image IDs come from the bug report screenshots:
 *   - WXj9Lpl8EEb9rwkTcMpJw.jpg → icon-my-hunts.png   (rolled maps)
 *   - zNrQHjRw1Ndk0Sz1v5aMv.jpg → icon-create-hunt.png (circular map + brush)
 *
 * After running, commit the generated PNG files and update BottomBar.tsx
 * to reference the .png versions instead of the .svg placeholders.
 */

import 'dotenv/config';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import pg from 'pg';

const { Client } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const publicDir = path.join(repoRoot, 'packages', 'web', 'public');
const uploadsDir = path.join(repoRoot, 'packages', 'server', 'uploads');

/** Map from photo key → output icon filename. */
const ICONS = {
  'WXj9Lpl8EEb9rwkTcMpJw.jpg': 'icon-my-hunts.png',
  'zNrQHjRw1Ndk0Sz1v5aMv.jpg': 'icon-create-hunt.png',
};

async function fetchFromDatabase(key, dbUrl) {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    const { rows } = await client.query(
      'SELECT data FROM photos WHERE id = $1',
      [key],
    );
    return rows[0] ? Buffer.from(rows[0].data) : null;
  } finally {
    await client.end();
  }
}

async function fetchFromFilesystem(key) {
  try {
    return await readFile(path.join(uploadsDir, key));
  } catch {
    return null;
  }
}

async function processIcon(buffer, outPath) {
  // Trim whitespace/solid-colour borders, then resize to fit inside 256×256
  // while preserving aspect ratio.  Output as PNG so it composites cleanly
  // over the bottom-bar background.
  await sharp(buffer)
    .trim({ background: '#ffffff', threshold: 10 })
    .resize(256, 256, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toFile(outPath);
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;

  await mkdir(publicDir, { recursive: true });

  for (const [key, iconName] of Object.entries(ICONS)) {
    const outPath = path.join(publicDir, iconName);
    console.log(`\nProcessing ${key} → ${iconName}`);

    let buffer = null;

    if (dbUrl) {
      console.log('  Fetching from PostgreSQL…');
      buffer = await fetchFromDatabase(key, dbUrl).catch((err) => {
        console.warn('  DB fetch failed:', err.message);
        return null;
      });
    }

    if (!buffer) {
      console.log('  Trying local uploads/ directory…');
      buffer = await fetchFromFilesystem(key);
    }

    if (!buffer) {
      console.error(`  ERROR: could not find ${key} — skipping.`);
      continue;
    }

    await processIcon(buffer, outPath);
    console.log(`  Saved ${outPath}`);
  }

  console.log('\nDone. Remember to:');
  console.log('  1. Commit the generated PNG files.');
  console.log('  2. Update BottomBar.tsx to use .png instead of .svg for these two icons.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
